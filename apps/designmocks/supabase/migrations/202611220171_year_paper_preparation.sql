-- Allow a separately reviewed historic marking and worked explanation.
create or replace function dm_private.year_paper_ready(p_paper_id uuid) returns boolean
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
      and (r.exam<>'uceed' or r.paper_year not between 2024 and 2026 or r.question_count=57)
      and (select min(q.ordinal)=1 and max(q.ordinal)=r.question_count
           from dm_private.questions q where q.paper_id=p.id)
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
          or q.media is distinct from b.runtime_payload->'media'
          or jsonb_typeof(q.marking) is distinct from 'object'
          or (q.marking->>'correct')::numeric is distinct from q.points
          or (q.marking->>'wrong')::numeric is distinct from -q.negative_points
          or q.topic is distinct from b.topic
          or k.key is distinct from b.runtime_payload->'key')
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

-- Preparation writes an unpublished-for-students draft. A separate service
-- call must register its exact manifest after human review.
create table dm_private.year_paper_preparations (
  plan_sha256 text primary key check(plan_sha256 ~ '^[a-f0-9]{64}$'),
  paper_id uuid not null unique references dm_private.papers(id),
  manifest_sha256 text not null check(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  marking_reference text not null check(char_length(marking_reference) between 8 and 2000),
  prepared_at timestamptz not null default clock_timestamp()
);
alter table dm_private.year_paper_preparations enable row level security;
revoke all on dm_private.year_paper_preparations from public,anon,authenticated,service_role;

create function public.prepare_free_year_paper(p_plan jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare
  v_plan_sha text;v_previous dm_private.year_paper_preparations;v_paper uuid;v_question uuid;
  v_exam text;v_year integer;v_source text;v_part text;v_title text;v_duration integer;v_marking_reference text;
  v_count integer;v_item jsonb;v_bank dm_private.bank_questions;v_ordinal integer:=0;
  v_correct numeric;v_wrong numeric;v_manifest text;v_seen text[]:='{}';
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden';end if;
  if jsonb_typeof(p_plan) is distinct from 'object' or jsonb_typeof(p_plan->'questions') is distinct from 'array' then
    raise exception 'Invalid year-paper plan';end if;
  if p_plan->>'format' is distinct from 'dmocks-free-year-paper-v1' then raise exception 'Invalid year-paper plan';end if;
  v_exam:=lower(p_plan->>'exam');v_year:=(p_plan->>'year')::integer;
  v_source:=p_plan->>'sourcePaperId';v_part:=btrim(p_plan->>'partLabel');
  v_title:=btrim(p_plan->>'title');v_duration:=(p_plan->>'durationSeconds')::integer;
  v_marking_reference:=btrim(p_plan->>'markingReference');
  v_count:=jsonb_array_length(p_plan->'questions');
  if v_exam not in('uceed','ceed','nift','nid') or v_year not between 2000 and 2100
    or v_source !~ '^[a-z0-9-]{4,100}$' or char_length(v_part) not between 2 and 40
    or char_length(v_title) not between 2 and 180 or v_duration not between 60 and 21600
    or char_length(v_marking_reference) not between 8 and 2000
    or v_count not between 1 and 200 then raise exception 'Invalid year-paper plan';end if;
  if v_exam='uceed' and v_year between 2024 and 2026 and v_count<>57 then
    raise exception 'The full 57-question UCEED Part A is required';end if;
  v_plan_sha:=encode(public.digest(convert_to(p_plan::text,'UTF8'),'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('year-paper-plan:'||v_plan_sha,0));
  select * into v_previous from dm_private.year_paper_preparations where plan_sha256=v_plan_sha;
  if v_previous.paper_id is not null then
    if dm_private.year_paper_manifest(v_previous.paper_id) is distinct from v_previous.manifest_sha256 then
      raise exception 'Prepared year paper changed';end if;
    return jsonb_build_object('paperId',v_previous.paper_id,'manifestSha256',v_previous.manifest_sha256,
      'questionCount',v_count,'created',false);
  end if;
  if exists(select 1 from dm_private.year_paper_releases r where r.exam=v_exam
    and r.source_paper_id=v_source and r.part_label=v_part) then raise exception 'Year paper already released';end if;
  if (select count(*) from dm_private.bank_questions b where b.exam=v_exam and b.active
    and b.question_type<>'DESCRIPTIVE' and b.payload->'holds'='[]'::jsonb
    and b.payload#>>'{provenance,paperId}'=v_source
    and b.payload#>>'{provenance,year}'=v_year::text)<>v_count then
    raise exception 'The complete hold-free objective source group is required';end if;
  insert into dm_private.papers(title,exam,duration_seconds,published,reviewed,rights_confirmed,source_kind)
    values(v_title,v_exam,v_duration,true,true,true,'year') returning id into v_paper;
  for v_item in select value from jsonb_array_elements(p_plan->'questions') loop
    v_ordinal:=v_ordinal+1;
    if jsonb_typeof(v_item) is distinct from 'object' or v_item->>'externalKey'=any(v_seen)
      or (v_item->>'externalKey') is null then raise exception 'Duplicate or missing source question';end if;
    select * into v_bank from dm_private.bank_questions where external_key=v_item->>'externalKey';
    if v_bank.external_key is null or not v_bank.active or not v_bank.owner_approved or not v_bank.rights_confirmed
      or v_bank.runtime_payload is null or v_bank.question_type='DESCRIPTIVE'
      or v_bank.exam is distinct from v_exam or v_bank.payload->'holds' is distinct from '[]'::jsonb
      or v_bank.payload#>>'{provenance,paperId}' is distinct from v_source
      or v_bank.payload#>>'{provenance,year}' is distinct from v_year::text
      or v_bank.content_sha256 is distinct from v_item->>'contentSha256'
      or v_bank.runtime_payload->>'kind' not in('nat','mcq','msq') then
      raise exception 'Current approved source question is required';end if;
    if jsonb_typeof(v_item->'marking') is distinct from 'object'
      or jsonb_typeof(v_item->'marking'->'correct') is distinct from 'number'
      or jsonb_typeof(v_item->'marking'->'wrong') is distinct from 'number'
      or coalesce(char_length(btrim(v_item->>'explanation')),0) not between 20 and 10000 then
      raise exception 'Reviewed historical marking and worked explanation are required';end if;
    v_correct:=(v_item->'marking'->>'correct')::numeric;
    v_wrong:=(v_item->'marking'->>'wrong')::numeric;
    if v_correct is null or v_correct<=0 or v_correct>100 or v_wrong is null or v_wrong>0 or v_wrong< -100 then
      raise exception 'Invalid historical marking';end if;
    insert into dm_private.questions(paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
      values(v_paper,v_ordinal,v_bank.runtime_payload->>'prompt',v_bank.runtime_payload->'options',
        v_bank.runtime_payload->>'kind',v_item->'marking',v_bank.runtime_payload->'media',
        v_correct,-v_wrong,v_bank.topic,true) returning id into v_question;
    insert into dm_private.answer_keys(question_id,key,explanation)
      values(v_question,v_bank.runtime_payload->'key',btrim(v_item->>'explanation'));
    v_seen:=array_append(v_seen,v_bank.external_key);
  end loop;
  v_manifest:=dm_private.year_paper_manifest(v_paper);
  insert into dm_private.year_paper_preparations(plan_sha256,paper_id,manifest_sha256,marking_reference)
    values(v_plan_sha,v_paper,v_manifest,v_marking_reference);
  return jsonb_build_object('paperId',v_paper,'manifestSha256',v_manifest,
    'questionCount',v_count,'created',true);
end$$;
revoke all on function public.prepare_free_year_paper(jsonb) from public,anon,authenticated;
grant execute on function public.prepare_free_year_paper(jsonb) to service_role;

-- Freeze a consistent source while starting an attempt, including private
-- figures. The ready check runs after these locks have been acquired.
create function dm_private.lock_year_paper(p_paper_id uuid) returns void
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
  perform 1 from dm_private.year_paper_releases where paper_id=p_paper_id for share;
  perform 1 from dm_private.papers where id=p_paper_id for share;
  perform 1 from dm_private.questions where paper_id=p_paper_id order by id for share;
  perform 1 from dm_private.answer_keys k join dm_private.questions q on q.id=k.question_id
    where q.paper_id=p_paper_id order by k.question_id for share of k;
  perform 1 from dm_private.bank_questions b where b.external_key in
    (select k.key->>'sourceExternalKey' from dm_private.questions q
      join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=p_paper_id)
    order by b.external_key for share;
  perform 1 from storage.buckets where id='paper-media' for share;
  perform 1 from dm_private.bank_media_assets a where a.sha256 in
    (select figure->>'sha256' from dm_private.questions q
      cross join lateral jsonb_array_elements(q.media) figure where q.paper_id=p_paper_id)
    order by a.sha256 for share;
  perform 1 from storage.objects o where o.bucket_id='paper-media' and o.name in
    (select figure->>'path' from dm_private.questions q
      cross join lateral jsonb_array_elements(q.media) figure where q.paper_id=p_paper_id)
    order by o.name for share;
end$$;
revoke all on function dm_private.lock_year_paper(uuid) from public,anon,authenticated,service_role;

create or replace function public.start_free_year_paper(p_paper_id uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare v_paper dm_private.papers;v_attempt uuid;v_started timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in required';end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  perform dm_private.lock_year_paper(p_paper_id);
  if not dm_private.year_paper_ready(p_paper_id) then raise exception 'Year paper is not released';end if;
  select * into v_paper from dm_private.papers where id=p_paper_id;
  select id into v_attempt from dm_private.attempts
    where user_id=auth.uid() and paper_id=p_paper_id and status='active' and deadline>clock_timestamp()
    order by started_at desc limit 1;
  if v_attempt is not null then return v_attempt;end if;
  if (select count(*) from dm_private.attempts where user_id=auth.uid() and status='active'
      and deadline>clock_timestamp())>=3 then raise exception 'Finish an active attempt before starting another';end if;
  v_started:=clock_timestamp();
  insert into dm_private.attempts(user_id,paper_id,started_at,deadline)
    values(auth.uid(),p_paper_id,v_started,v_started+make_interval(secs=>v_paper.duration_seconds))
    returning id into v_attempt;
  insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
    select v_attempt,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation
    from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=p_paper_id;
  return v_attempt;
end$$;
