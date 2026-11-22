-- A year-wise paper is a fixed, reviewed catalogue paper. Registering one
-- never grants a pass or changes the paid mock products.
alter table dm_private.papers drop constraint papers_source_kind_check;
alter table dm_private.papers add constraint papers_source_kind_check
  check(source_kind in('catalogue','topic','exam','exam_part_b','all_india','year'));

create table dm_private.year_paper_releases (
  paper_id uuid primary key references dm_private.papers(id),
  exam text not null check(exam in('uceed','ceed','nift','nid')),
  paper_year integer not null check(paper_year between 2000 and 2100),
  source_paper_id text not null check(source_paper_id ~ '^[a-z0-9-]{4,100}$'),
  part_label text not null check(char_length(part_label) between 2 and 40),
  question_count integer not null check(question_count between 1 and 200),
  review_sha256 text not null check(review_sha256 ~ '^[a-f0-9]{64}$'),
  released_at timestamptz not null default now(),
  unique(exam,source_paper_id,part_label)
);
alter table dm_private.year_paper_releases enable row level security;
revoke all on dm_private.year_paper_releases from public,anon,authenticated,service_role;

-- The review receipt identifies the exact fixed paper, its bank versions,
-- marking, figures, keys and explanations. Any subsequent edit closes release.
create function dm_private.year_paper_manifest(p_paper_id uuid) returns text
language sql stable security definer set search_path=pg_catalog,dm_private,public as $$
  select encode(public.digest(convert_to(jsonb_build_object(
    'id',p.id,'title',p.title,'exam',p.exam,'durationSeconds',p.duration_seconds,
    'questions',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',q.id,'ordinal',q.ordinal,'prompt',q.prompt,'options',q.options,
      'kind',q.kind,'marking',q.marking,'media',q.media,'points',q.points,
      'negativePoints',q.negative_points,'topic',q.topic,'key',k.key,
      'explanation',k.explanation,'bankContentSha256',b.content_sha256
      ) order by q.ordinal),'[]'::jsonb)
      from dm_private.questions q
      left join dm_private.answer_keys k on k.question_id=q.id
      left join dm_private.bank_questions b on b.external_key=k.key->>'sourceExternalKey'
      where q.paper_id=p.id)
  )::text,'UTF8'),'sha256'),'hex')
  from dm_private.papers p where p.id=p_paper_id
$$;
revoke all on function dm_private.year_paper_manifest(uuid) from public,anon,authenticated,service_role;

create function dm_private.year_paper_ready(p_paper_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select exists(
    select 1 from dm_private.year_paper_releases r
    join dm_private.papers p on p.id=r.paper_id
    where r.paper_id=p_paper_id and p.exam=r.exam and p.source_kind='year'
      and p.published and p.reviewed and p.rights_confirmed
      and r.review_sha256=dm_private.year_paper_manifest(p.id)
      and not dm_private.paper_quality_held(p.id)
      and exists(select 1 from storage.buckets where id='paper-media' and public=false)
      and (select count(*) from dm_private.questions q where q.paper_id=p.id)=r.question_count
      and (select count(*) from dm_private.bank_questions b
           where b.exam=r.exam and b.active
             and b.question_type<>'DESCRIPTIVE'
             and b.payload->'holds'='[]'::jsonb
             and b.payload#>>'{provenance,paperId}'=r.source_paper_id
             and b.payload#>>'{provenance,year}'=r.paper_year::text)=r.question_count
      and (select count(distinct k.key->>'sourceExternalKey') from dm_private.questions q
           join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=p.id)=r.question_count
      and not exists(
        select 1 from dm_private.questions q
        left join dm_private.answer_keys k on k.question_id=q.id
        left join dm_private.bank_questions b on b.external_key=k.key->>'sourceExternalKey'
        where q.paper_id=p.id and (not q.reviewed or q.kind not in('nat','mcq','msq')
          or k.question_id is null or char_length(btrim(k.explanation))<20
          or b.external_key is null or not b.active or not b.owner_approved or not b.rights_confirmed
          or b.runtime_payload is null
          or b.payload->'holds' is distinct from '[]'::jsonb or b.exam is distinct from r.exam
          or b.payload#>>'{provenance,paperId}' is distinct from r.source_paper_id
          or b.payload#>>'{provenance,year}' is distinct from r.paper_year::text
          or q.prompt is distinct from b.runtime_payload->>'prompt'
          or q.options is distinct from b.runtime_payload->'options'
          or q.kind is distinct from b.runtime_payload->>'kind'
          or q.marking is distinct from b.runtime_payload->'marking'
          or q.media is distinct from b.runtime_payload->'media'
          or q.points is distinct from (b.runtime_payload->>'points')::numeric
          or q.negative_points is distinct from (b.runtime_payload->>'negativePoints')::numeric
          or q.topic is distinct from b.topic
          or k.key is distinct from b.runtime_payload->'key'
          or k.explanation is distinct from b.runtime_payload->>'explanation')
      )
      and not exists(
        select 1 from dm_private.questions q
        cross join lateral jsonb_array_elements(q.media) figure
        left join dm_private.bank_media_assets asset on asset.sha256=figure->>'sha256'
        left join storage.objects stored on stored.bucket_id='paper-media' and stored.name=asset.storage_path
        where q.paper_id=p.id and (asset.sha256 is null
          or asset.storage_path is distinct from figure->>'path'
          or asset.width is distinct from (figure->>'width')::integer
          or asset.height is distinct from (figure->>'height')::integer
          or stored.name is null or stored.metadata->>'mimetype' is distinct from 'image/png'
          or stored.metadata->>'size' is distinct from asset.byte_size::text)
      )
  )
$$;
revoke all on function dm_private.year_paper_ready(uuid) from public,anon,authenticated,service_role;

create function public.register_free_year_paper(
  p_paper_id uuid,p_exam text,p_year integer,p_source_paper_id text,
  p_part_label text,p_question_count integer,p_review_sha256 text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden';end if;
  if p_review_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Exact paper review receipt required';end if;
  insert into dm_private.year_paper_releases(paper_id,exam,paper_year,source_paper_id,part_label,question_count,review_sha256)
  values(p_paper_id,lower(p_exam),p_year,p_source_paper_id,btrim(p_part_label),p_question_count,p_review_sha256)
  on conflict(paper_id) do nothing;
  if not dm_private.year_paper_ready(p_paper_id) then raise exception 'Year paper is not ready for release';end if;
  select jsonb_build_object('paperId',r.paper_id,'exam',r.exam,'year',r.paper_year,
    'sourcePaperId',r.source_paper_id,'partLabel',r.part_label,'questionCount',r.question_count)
    into v_result from dm_private.year_paper_releases r where r.paper_id=p_paper_id;
  if v_result->>'sourcePaperId' is distinct from p_source_paper_id or
     v_result->>'partLabel' is distinct from btrim(p_part_label) or
     v_result->>'exam' is distinct from lower(p_exam) or
     (v_result->>'year')::integer is distinct from p_year or
     (v_result->>'questionCount')::integer is distinct from p_question_count or
     (select review_sha256 from dm_private.year_paper_releases where paper_id=p_paper_id)
       is distinct from p_review_sha256 then raise exception 'Year paper release changed';end if;
  return v_result;
end$$;
revoke all on function public.register_free_year_paper(uuid,text,integer,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.register_free_year_paper(uuid,text,integer,text,text,integer,text) to service_role;

create function public.free_year_paper_catalog() returns jsonb
language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select coalesce(jsonb_agg(jsonb_build_object('paperId',r.paper_id,'exam',r.exam,
    'year',r.paper_year,'sourcePaperId',r.source_paper_id,'partLabel',r.part_label,
    'questionCount',r.question_count,'durationSeconds',p.duration_seconds)
    order by r.exam,r.paper_year desc,r.source_paper_id,r.part_label),'[]'::jsonb)
  from dm_private.year_paper_releases r join dm_private.papers p on p.id=r.paper_id
  where dm_private.year_paper_ready(r.paper_id)
$$;
revoke all on function public.free_year_paper_catalog() from public;
grant execute on function public.free_year_paper_catalog() to anon,authenticated;

-- Fixed year papers have their own free catalogue. They cannot appear as
-- paid catalogue papers before the separate year-paper release is recorded.
create or replace function public.available_papers() returns jsonb
language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'exam',exam,
    'durationSeconds',duration_seconds,'qualityHeld',dm_private.paper_quality_held(id))),'[]'::jsonb)
  from dm_private.papers where published and reviewed and rights_confirmed
    and source_kind<>'year' and auth.uid() is not null
$$;

create function dm_private.guard_unreleased_year_paper() returns trigger
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
  if exists(select 1 from dm_private.papers where id=new.paper_id and source_kind='year')
     and not dm_private.year_paper_ready(new.paper_id) then
    raise exception 'Year paper is not released';
  end if;
  return new;
end$$;
create trigger guard_unreleased_year_paper before insert on dm_private.attempts
  for each row execute function dm_private.guard_unreleased_year_paper();

create function public.start_free_year_paper(p_paper_id uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare v_paper dm_private.papers;v_attempt uuid;v_started timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in required';end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  if not dm_private.year_paper_ready(p_paper_id) then raise exception 'Year paper is not released';end if;
  if (select count(*) from dm_private.attempts where user_id=auth.uid() and status='active'
      and deadline>clock_timestamp())>=3 then raise exception 'Finish an active attempt before starting another';end if;
  select * into v_paper from dm_private.papers where id=p_paper_id;
  select id into v_attempt from dm_private.attempts
    where user_id=auth.uid() and paper_id=p_paper_id and status='active' and deadline>clock_timestamp()
    order by started_at desc limit 1;
  if v_attempt is not null then return v_attempt;end if;
  v_started:=clock_timestamp();
  insert into dm_private.attempts(user_id,paper_id,started_at,deadline)
    values(auth.uid(),p_paper_id,v_started,v_started+make_interval(secs=>v_paper.duration_seconds))
    returning id into v_attempt;
  insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
    select v_attempt,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation
    from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=p_paper_id;
  return v_attempt;
end$$;
revoke all on function public.start_free_year_paper(uuid) from public,anon;
grant execute on function public.start_free_year_paper(uuid) to authenticated;
