-- Parallel questions are separately reviewed derivatives of complete released
-- year papers. Their first student use is one fixed All India event.
create table dm_private.parallel_question_routes (
  external_key text primary key references dm_private.bank_questions(external_key),
  content_sha256 text not null unique check(content_sha256 ~ '^[a-f0-9]{64}$'),
  source_external_key text not null references dm_private.bank_questions(external_key),
  source_year_paper_id uuid not null references dm_private.year_paper_releases(paper_id),
  review_note text not null check(char_length(btrim(review_note)) between 20 and 2000),
  registered_at timestamptz not null default clock_timestamp(),
  all_india_event_id uuid references dm_private.all_india_events(id),
  allocated_at timestamptz,
  check(external_key<>source_external_key),
  check((all_india_event_id is null)=(allocated_at is null))
);
create index parallel_question_event_idx on dm_private.parallel_question_routes(all_india_event_id)
  where all_india_event_id is not null;
alter table dm_private.parallel_question_routes enable row level security;
revoke all on dm_private.parallel_question_routes from public,anon,authenticated,service_role;

create function dm_private.parallel_question_ready(p_external_key text)
returns boolean language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select exists(
    select 1 from dm_private.parallel_question_routes r
    join dm_private.bank_questions b on b.external_key=r.external_key
    join dm_private.year_paper_releases release on release.paper_id=r.source_year_paper_id
    join dm_private.bank_questions source on source.external_key=r.source_external_key
    where r.external_key=p_external_key
      and b.content_sha256=r.content_sha256 and b.exam=release.exam and source.exam=b.exam
      and b.active and b.owner_approved and b.rights_confirmed and b.objective_ready
      and b.payload->'holds'='[]'::jsonb and b.runtime_payload is not null
      and b.payload#>>'{provenance,kind}'='parallel'
      and b.payload#>>'{provenance,generatedFrom}'=r.source_external_key
      and b.runtime_payload->>'kind' in('mcq','msq','nat')
      and b.question_type=upper(b.runtime_payload->>'kind')
      and b.runtime_payload#>>'{key,sourceExternalKey}'=b.external_key
      and char_length(btrim(b.runtime_payload->>'explanation'))>=20
      and jsonb_typeof(b.runtime_payload->'media')='array'
      and dm_private.year_paper_ready(r.source_year_paper_id)
      and exists(select 1 from dm_private.questions q
        join dm_private.answer_keys k on k.question_id=q.id
        where q.paper_id=r.source_year_paper_id
          and k.key->>'sourceExternalKey'=r.source_external_key)
      and not exists(select 1 from dm_private.bank_local_holds h where h.external_key=b.external_key)
      and not exists(select 1 from dm_private.reported_question_queue report
        where report.source_external_key=b.external_key and report.quarantines_bank
          and report.status in('pending','retired'))
      and not exists(
        select 1 from jsonb_array_elements(b.runtime_payload->'media') figure
        left join dm_private.bank_media_assets asset on asset.sha256=figure->>'sha256'
        left join storage.objects stored on stored.bucket_id='paper-media' and stored.name=asset.storage_path
        where asset.sha256 is null or asset.storage_path is distinct from figure->>'path'
          or asset.width is distinct from (figure->>'width')::integer
          or asset.height is distinct from (figure->>'height')::integer
          or stored.name is null or stored.metadata->>'mimetype' is distinct from 'image/png'
          or stored.metadata->>'size' is distinct from asset.byte_size::text
      )
  )
$$;
revoke all on function dm_private.parallel_question_ready(text) from public,anon,authenticated,service_role;

create function dm_private.all_india_parallel_ready(p_event_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select exists(
    select 1 from dm_private.all_india_events e
    join dm_private.papers p on p.id=e.paper_id
    where e.id=p_event_id and p.source_kind='all_india'
      and (select count(*) from dm_private.questions q where q.paper_id=p.id)>0
      and (select count(*) from dm_private.parallel_question_routes r
        where r.all_india_event_id=e.id)=(select count(*) from dm_private.questions q where q.paper_id=p.id)
      and not exists(
        select 1 from dm_private.questions q
        left join dm_private.answer_keys k on k.question_id=q.id
        left join dm_private.parallel_question_routes r
          on r.all_india_event_id=e.id and r.external_key=k.key->>'sourceExternalKey'
        where q.paper_id=p.id and (q.kind not in('mcq','msq','nat')
          or k.question_id is null or r.external_key is null
          or not dm_private.parallel_question_ready(r.external_key))
      )
  )
$$;
revoke all on function dm_private.all_india_parallel_ready(uuid) from public,anon,authenticated,service_role;

create function public.register_parallel_question(
  p_external_key text,p_content_sha256 text,p_source_external_key text,
  p_source_year_paper_id uuid,p_review_note text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare v_route dm_private.parallel_question_routes;v_bank dm_private.bank_questions;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden';end if;
  if p_external_key is null or p_source_external_key is null or p_external_key=p_source_external_key
    or p_content_sha256 !~ '^[a-f0-9]{64}$'
    or char_length(btrim(coalesce(p_review_note,''))) not between 20 and 2000 then
    raise exception 'Exact parallel review receipt required';
  end if;
  select * into v_bank from dm_private.bank_questions where external_key=p_external_key for update;
  if v_bank.external_key is null or v_bank.content_sha256<>p_content_sha256
    or v_bank.payload#>>'{provenance,kind}'<>'parallel'
    or v_bank.payload#>>'{provenance,generatedFrom}'<>p_source_external_key then
    raise exception 'Parallel source and frozen content do not match';
  end if;
  insert into dm_private.parallel_question_routes(
    external_key,content_sha256,source_external_key,source_year_paper_id,review_note)
  values(p_external_key,p_content_sha256,p_source_external_key,p_source_year_paper_id,btrim(p_review_note))
  on conflict(external_key) do nothing;
  select * into v_route from dm_private.parallel_question_routes where external_key=p_external_key;
  if v_route.content_sha256 is distinct from p_content_sha256
    or v_route.source_external_key is distinct from p_source_external_key
    or v_route.source_year_paper_id is distinct from p_source_year_paper_id
    or v_route.review_note is distinct from btrim(p_review_note) then
    raise exception 'Parallel review receipt changed';
  end if;
  if not dm_private.parallel_question_ready(p_external_key) then
    raise exception 'Parallel question or released source paper is not ready';
  end if;
  return jsonb_build_object('externalKey',v_route.external_key,
    'contentSha256',v_route.content_sha256,'sourceExternalKey',v_route.source_external_key,
    'sourceYearPaperId',v_route.source_year_paper_id,'allIndiaEventId',v_route.all_india_event_id);
end$$;
revoke all on function public.register_parallel_question(text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.register_parallel_question(text,text,text,uuid,text) to service_role;

create or replace function public.admin_create_all_india_event(
  p_exam text,p_title text,p_starts_at timestamptz,p_question_count integer,p_duration_seconds integer,
  p_drawing_count integer default 0,p_upload_grace_seconds integer default 900
) returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  event_id uuid:=gen_random_uuid();paper_id uuid;question_id uuid;exam_code text:=lower(p_exam);
  selected_question record;ordinal integer:=0;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required';end if;
  if exam_code is null or exam_code not in('uceed','nid','nift','ceed')
    or coalesce(char_length(btrim(p_title)),0) not between 5 and 140
    or p_starts_at is null or p_question_count is null or p_question_count not between 10 and 100
    or p_duration_seconds is null or p_duration_seconds not between 900 and 21600
    or p_drawing_count is null or p_drawing_count<>0
    or p_upload_grace_seconds is null or p_upload_grace_seconds not between 600 and 900 then
    raise exception 'Only objective All India events are available';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(exam_code,30));
  if p_starts_at<=clock_timestamp() then raise exception 'Schedule the event in the future';end if;
  if exists(select 1 from dm_private.all_india_events e where e.exam=exam_code
    and tstzrange(e.starts_at,e.review_ends_at,'[)')
      &&tstzrange(p_starts_at,p_starts_at+interval '20 days','[)')) then
    raise exception 'An event already overlaps this review cycle';
  end if;
  insert into dm_private.papers(title,exam,duration_seconds,published,reviewed,rights_confirmed,source_kind,upload_grace_seconds)
    values(btrim(p_title),exam_code,p_duration_seconds,false,true,true,'all_india',0)
    returning id into paper_id;
  insert into dm_private.all_india_events(id,exam,title,paper_id,starts_at,ends_at,review_ends_at,created_by)
    values(event_id,exam_code,btrim(p_title),paper_id,p_starts_at,
      p_starts_at+interval '10 days',p_starts_at+interval '20 days',auth.uid());
  for selected_question in
    select b.* from dm_private.parallel_question_routes route
    join dm_private.bank_questions b on b.external_key=route.external_key
    where b.exam=exam_code and route.all_india_event_id is null
      and dm_private.parallel_question_ready(route.external_key)
    order by md5(route.external_key||event_id::text),route.external_key
    limit p_question_count for update of route
  loop
    ordinal:=ordinal+1;
    insert into dm_private.questions(paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
      values(paper_id,ordinal,selected_question.runtime_payload->>'prompt',
        selected_question.runtime_payload->'options',selected_question.runtime_payload->>'kind',
        selected_question.runtime_payload->'marking',selected_question.runtime_payload->'media',
        (selected_question.runtime_payload->>'points')::numeric,
        (selected_question.runtime_payload->>'negativePoints')::numeric,selected_question.topic,true)
      returning id into question_id;
    insert into dm_private.answer_keys(question_id,key,explanation)
      values(question_id,selected_question.runtime_payload->'key',selected_question.runtime_payload->>'explanation');
    update dm_private.parallel_question_routes set all_india_event_id=event_id,
      allocated_at=clock_timestamp() where external_key=selected_question.external_key;
  end loop;
  if ordinal<>p_question_count then
    raise exception 'Not enough reviewed fresh parallel questions for this event';
  end if;
  return event_id;
end$$;

create or replace function public.start_all_india_attempt(p_event_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  event dm_private.all_india_events;
  paper dm_private.papers;
  candidate uuid:=auth.uid();
  attempt_id uuid;
  started_at timestamptz;
begin
  if candidate is null then raise exception 'Sign in required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(candidate::text||p_event_id::text,3));
  if exists(select 1 from dm_private.all_india_attempts ai where ai.event_id=p_event_id and ai.user_id=candidate) then
    raise exception 'This All India mock can only be attempted once';
  end if;
  select * into event from dm_private.all_india_events where id=p_event_id and results_released_at is null for share;
  if not found then raise exception 'This All India mock is not open'; end if;
  select * into paper from dm_private.papers where id=event.paper_id;
  if not dm_private.all_india_parallel_ready(event.id) then
    raise exception 'All India paper paused for fresh-question review';
  end if;
  started_at:=clock_timestamp();
  if started_at<event.starts_at or started_at>=event.ends_at-make_interval(secs=>paper.duration_seconds+paper.upload_grace_seconds) then
    raise exception 'There is no full attempt window available';
  end if;
  if not exists(select 1 from dm_private.passes p join public.launch_settings s on s.singleton and s.environment_mode=p.mode
    where p.user_id=candidate and p.expires_at>started_at) then raise exception 'An active pass is required'; end if;
  if not exists(select 1 from public.profiles where user_id=candidate and onboarding_completed_at is not null) then
    raise exception 'Complete your verified profile first';
  end if;
  insert into dm_private.attempts(user_id,paper_id,started_at,deadline)
    values(candidate,paper.id,started_at,started_at+make_interval(secs=>paper.duration_seconds)) returning id into attempt_id;
  insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
    select attempt_id,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation
    from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=paper.id;
  insert into dm_private.all_india_attempts(event_id,user_id,attempt_id) values(p_event_id,candidate,attempt_id);
  return attempt_id;
end $$;

create or replace function public.all_india_event_catalog()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if auth.uid() is null then raise exception 'Sign in required';end if;
  return(select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'exam',e.exam,'title',e.title,'startsAt',e.starts_at,'endsAt',e.ends_at,'lastStartAt',timing.last_start,
    'reviewEndsAt',e.review_ends_at,'durationSeconds',p.duration_seconds,'uploadGraceSeconds',p.upload_grace_seconds,
    'qualityHeld',(dm_private.paper_quality_held(p.id) or not dm_private.all_india_parallel_ready(e.id)),
    'state',case when e.results_released_at is not null then 'released'
      when (dm_private.paper_quality_held(p.id) or not dm_private.all_india_parallel_ready(e.id)) then 'paused' when now()<e.starts_at then 'scheduled'
      when now()<timing.last_start then 'open' when now()<e.ends_at then 'closing' else 'review' end,
    'attemptId',ai.attempt_id,
    'result',case when r.attempt_id is not null and e.results_released_at is not null then
      jsonb_build_object('score',r.score,'total',r.total,'rank',r.rank,'alias',r.alias,
        'cohortSize',(select count(*) from dm_private.all_india_results s where s.event_id=e.id),
        'sharing',case when sharing.publication_id is not null and exists(
          select 1 from dm_private.all_india_ranking_top_ten(e.id) t where t.attempt_id=r.attempt_id
        ) then jsonb_build_object('publicationId',sharing.publication_id,'revision',coalesce(c.revision,0),
          'shared',coalesce(c.shared,false),'alias',r.alias) end) end
  ) order by e.starts_at desc),'[]') from dm_private.all_india_events e join dm_private.papers p on p.id=e.paper_id
  cross join lateral(select e.ends_at-make_interval(secs=>p.duration_seconds+p.upload_grace_seconds) as last_start) timing
  left join dm_private.all_india_attempts ai on ai.event_id=e.id and ai.user_id=auth.uid()
  left join dm_private.all_india_results r on r.event_id=e.id and r.user_id=ai.user_id and r.attempt_id=ai.attempt_id
  left join lateral (
    select dm_private.active_all_india_ranking_publication(e.id) as publication_id
    where r.attempt_id is not null and e.results_released_at is not null and exists(
      select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and not u.is_anonymous
    )
  ) sharing on true
  left join dm_private.all_india_ranking_consents c on c.publication_id=sharing.publication_id and c.user_id=r.user_id
  where e.starts_at>now()-interval '90 days');
end $$;
