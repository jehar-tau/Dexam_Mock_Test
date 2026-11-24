-- An exam-wise mock may only use the exact reviewed question frozen for an
-- All India event whose results have been released.
create view dm_private.released_parallel_exam_questions as
select bank.*
from dm_private.parallel_question_routes route
join dm_private.bank_questions bank on bank.external_key=route.external_key
join dm_private.all_india_events event on event.id=route.all_india_event_id and event.exam=bank.exam
join dm_private.papers paper on paper.id=event.paper_id
where event.results_released_at is not null and paper.source_kind='all_india'
  and dm_private.parallel_question_ready(route.external_key)
  and exists (
    select 1 from dm_private.questions question
    join dm_private.answer_keys answer on answer.question_id=question.id
    where question.paper_id=paper.id
      and answer.key=bank.runtime_payload->'key'
      and answer.explanation is not distinct from bank.runtime_payload->>'explanation'
      and question.prompt=bank.runtime_payload->>'prompt' and question.topic=bank.topic
      and question.kind=bank.runtime_payload->>'kind'
      and question.options=bank.runtime_payload->'options'
      and question.marking=bank.runtime_payload->'marking'
      and question.media=bank.runtime_payload->'media'
      and question.points=(bank.runtime_payload->>'points')::numeric
      and question.negative_points=(bank.runtime_payload->>'negativePoints')::numeric
  );
revoke all on dm_private.released_parallel_exam_questions from public,anon,authenticated,service_role;

create or replace function dm_private.exam_blueprint_ready(p_exam text,p_count integer,p_manifest jsonb)
returns boolean language sql stable set search_path=pg_catalog,dm_private as $$
  select case
    -- The current All India route validates objective items only. A full
    -- two-part mock cannot open until Part B has its own eligible pool.
    when p_exam in('uceed','ceed') then false
    when p_manifest is null then (
      select count(*)>=p_count from dm_private.released_parallel_exam_questions where exam=p_exam
    )
    else not exists (
      select 1 from jsonb_each_text(p_manifest->'counts') required
      where (select count(*) from dm_private.released_parallel_exam_questions
             where exam=p_exam and runtime_payload->>'kind'=required.key)<required.value::integer
    )
  end
$$;

create or replace function public.admin_exam_mock_blueprints()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  return (
    select jsonb_agg(jsonb_build_object(
      'exam',b.exam,'questionCount',b.question_count,'durationSeconds',b.duration_seconds,
      'freeAttemptLimit',b.free_attempt_limit,'enabled',b.enabled,
      'structureVersion',b.structure_version,'sectionLabel',b.section_manifest->>'label',
      'sectionCounts',b.section_manifest->'counts',
      'ready',dm_private.exam_blueprint_ready(b.exam,b.question_count,b.section_manifest),
      'reviewedQuestions',(select count(*) from dm_private.released_parallel_exam_questions where exam=b.exam)
    ) order by b.exam) from dm_private.exam_mock_blueprints b
  );
end $$;

create or replace function public.start_exam_mock(p_exam text)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,dm_private
as $$
declare
  student uuid := auth.uid();
  blueprint dm_private.exam_mock_blueprints;
  payment_mode text;
  has_pass boolean;
  used_attempts integer;
  new_paper uuid;
  new_attempt uuid;
  question_id uuid;
  shuffle_seed uuid := gen_random_uuid();
  bank_question record;
  ordinal integer := 0;
begin
  if student is null then raise exception 'Sign in required'; end if;
  -- Topic practice uses this same account lock before checking the shared limit.
  perform pg_advisory_xact_lock(hashtextextended(student::text, 1));

  select * into blueprint from dm_private.exam_mock_blueprints where exam=lower(p_exam) and enabled;
  if blueprint.exam is null then raise exception 'This exam mock is not released'; end if;
  if not exists (select 1 from public.profiles where user_id=student and onboarding_completed_at is not null) then
    raise exception 'Complete your verified profile first';
  end if;

  select environment_mode into payment_mode from public.launch_settings where singleton;
  select exists (
    select 1 from dm_private.passes where user_id=student and mode=payment_mode and expires_at>now()
  ) into has_pass;
  select count(*) into used_attempts
  from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id
  where a.user_id=student and p.source_kind='exam' and p.exam=blueprint.exam;
  if not has_pass and used_attempts>=blueprint.free_attempt_limit then raise exception 'An active pass is required'; end if;
  if (select count(*) from dm_private.attempts where user_id=student and status='active' and deadline>now())>=3 then
    raise exception 'Finish an active attempt before starting another';
  end if;
  if not dm_private.exam_blueprint_ready(blueprint.exam, blueprint.question_count, blueprint.section_manifest) then
    raise exception 'Not enough reviewed questions for every required section';
  end if;

  insert into dm_private.papers(title,exam,duration_seconds,published,reviewed,rights_confirmed,owner_user_id,source_kind)
  values (upper(blueprint.exam) || case when blueprint.section_manifest is null then ' exam-wise mock'
    else ' 2027 ' || (blueprint.section_manifest->>'label') || ' mock' end,
    blueprint.exam,blueprint.duration_seconds,false,true,true,student,'exam')
  returning id into new_paper;

  for bank_question in
    with sections as (
      select null::text as kind, 0 as position, blueprint.question_count as required
      where blueprint.section_manifest is null
      union all
      select key, case key when 'nat' then 1 when 'msq' then 2 when 'mcq' then 3 end, value::integer
      from jsonb_each_text(blueprint.section_manifest->'counts')
    )
    select picked.*
    from sections
    cross join lateral (
      select q.*, md5(q.external_key || shuffle_seed::text) as shuffle_order
      from dm_private.released_parallel_exam_questions q
      where q.exam=blueprint.exam
        and (sections.kind is null or q.runtime_payload->>'kind'=sections.kind)
      order by shuffle_order limit sections.required
    ) picked
    order by sections.position, picked.shuffle_order
  loop
    ordinal := ordinal + 1;
    insert into dm_private.questions(paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
    values(new_paper,ordinal,bank_question.runtime_payload->>'prompt',bank_question.runtime_payload->'options',
      bank_question.runtime_payload->>'kind',bank_question.runtime_payload->'marking',bank_question.runtime_payload->'media',
      (bank_question.runtime_payload->>'points')::numeric,(bank_question.runtime_payload->>'negativePoints')::numeric,
      bank_question.topic,true)
    returning id into question_id;
    insert into dm_private.answer_keys(question_id,key,explanation)
    values(question_id,bank_question.runtime_payload->'key',bank_question.runtime_payload->>'explanation');
  end loop;

  if ordinal<>blueprint.question_count then raise exception 'Frozen paper does not match verified manifest'; end if;
  insert into dm_private.attempts(user_id,paper_id,deadline)
  values(student,new_paper,now()+make_interval(secs=>blueprint.duration_seconds)) returning id into new_attempt;
  insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
  select new_attempt,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation
  from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=new_paper;
  return new_attempt;
end $$;

-- Existing frozen Part B attempts remain resumable. Starting a new Part B
-- would generate legacy bank tasks, including for a pre-migration Part A.
create or replace function public.start_exam_mock_part_b(p_part_a_attempt uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  student uuid := auth.uid();
  session dm_private.exam_mock_sessions;
begin
  if student is null then raise exception 'Sign in required'; end if;
  select * into session from dm_private.exam_mock_sessions
  where user_id=student and part_a_attempt=p_part_a_attempt;
  if session.id is null then raise exception 'Exam session not found'; end if;
  if session.part_b_attempt is not null then return session.part_b_attempt; end if;
  raise exception 'Part B is unavailable until reviewed drawing tasks are released';
end $$;

create or replace function public.my_exam_mock_session(p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare
  session dm_private.exam_mock_sessions;
  part_a dm_private.attempts;
  duration_seconds integer;
  part_b_state text;
begin
  select * into session from dm_private.exam_mock_sessions
  where user_id=auth.uid() and (part_a_attempt=p_attempt_id or part_b_attempt=p_attempt_id);
  if session.id is null then return null; end if;
  select * into part_a from dm_private.attempts where id=session.part_a_attempt;
  duration_seconds:=case when session.exam='uceed' then 3600 else 7200 end;
  part_b_state:=case
    when session.part_b_attempt is not null then 'started'
    when part_a.status<>'submitted' then 'part_a_active'
    when now()>=part_a.deadline+make_interval(secs=>duration_seconds) then 'closed'
    else 'unavailable'
  end;
  return jsonb_build_object(
    'sessionId',session.id,'exam',session.exam,'partAAttemptId',session.part_a_attempt,
    'partBAttemptId',session.part_b_attempt,'partBState',part_b_state,
    'partBOpensAt',part_a.deadline,
    'partBClosesAt',part_a.deadline+make_interval(secs=>duration_seconds),
    'partBDurationSeconds',duration_seconds,
    'partBTaskCount',case when session.exam='uceed' then 2 else 5 end
  );
end $$;


-- Recheck each fixed released year paper once per topic query. A correlated
-- ready check recomputes the entire paper manifest for every candidate row.
create function dm_private.ready_year_topic_keys() returns table(external_key text)
language sql stable security definer set search_path=pg_catalog,dm_private as $$
  with ready as materialized (
    select r.paper_id from dm_private.year_paper_releases r
    where dm_private.year_paper_ready(r.paper_id)
  )
  select distinct k.key->>'sourceExternalKey'
  from ready r
  join dm_private.questions q on q.paper_id=r.paper_id
  join dm_private.answer_keys k on k.question_id=q.id
  where nullif(k.key->>'sourceExternalKey','') is not null
$$;
revoke all on function dm_private.ready_year_topic_keys() from public,anon,authenticated,service_role;

create or replace function public.topic_catalog()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  return(select coalesce(jsonb_agg(jsonb_build_object('topic',topic,'exam',exam,'questions',questions)
    order by questions desc,topic,exam),'[]') from (
      with ready_keys as materialized (select external_key from dm_private.ready_year_topic_keys())
      select b.topic,b.exam,count(*) as questions from dm_private.bank_questions b
      join ready_keys ready on ready.external_key=b.external_key
      where b.active and owner_approved and rights_confirmed and runtime_payload->>'kind' in('mcq','msq','nat')
        and payload->'holds'='[]'::jsonb
      group by topic,exam
    ) catalog);
end $$;

create or replace function public.start_topic_practice(p_topic text,p_exam text,p_count integer,p_duration_seconds integer)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  student uuid:=auth.uid();
  v_mode text;
  paper uuid;
  attempt uuid;
  seed uuid:=gen_random_uuid();
  question record;
  ordinal integer:=0;
  question_id uuid;
begin
  if student is null then raise exception 'Sign in required'; end if;
  if nullif(btrim(p_topic),'') is null or p_exam is null or p_exam not in('uceed','nid','nift','ceed')
    or p_count is null or p_count not in(10,20,30)
    or p_duration_seconds is null or p_duration_seconds not in(900,1800,2700) then
    raise exception 'Invalid practice configuration';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(student::text,1));
  select environment_mode into v_mode from public.launch_settings where singleton;
  if not exists(select 1 from dm_private.passes p where p.user_id=student and p.mode=v_mode and p.expires_at>now()) then
    raise exception 'An active pass is required';
  end if;
  if not exists(select 1 from public.profiles where user_id=student and onboarding_completed_at is not null) then
    raise exception 'Complete your verified profile first';
  end if;
  if (select count(*) from dm_private.attempts where user_id=student and status='active' and deadline>now())>=3 then
    raise exception 'Finish an active attempt before starting another';
  end if;
  if (with ready_keys as materialized (select external_key from dm_private.ready_year_topic_keys())
    select count(*) from dm_private.bank_questions b
    join ready_keys ready on ready.external_key=b.external_key where b.active and owner_approved and rights_confirmed
    and runtime_payload->>'kind' in('mcq','msq','nat') and payload->'holds'='[]'::jsonb
    and topic=p_topic and exam=p_exam)<p_count then
    raise exception 'Not enough reviewed questions for this practice';
  end if;
  insert into dm_private.papers(title,exam,duration_seconds,published,reviewed,rights_confirmed,owner_user_id,source_kind)
    values(initcap(replace(p_topic,'-',' '))||' practice',p_exam,p_duration_seconds,false,true,true,student,'topic')
    returning id into paper;
  -- Delivery history stays private and is scoped to the caller, including earlier active attempts.
  -- Legacy snapshots without an explicit source identity cannot establish that a bank row was seen.
  for question in
    with ready_keys as materialized (select external_key from dm_private.ready_year_topic_keys()),
    delivered as materialized (
      select distinct i.key->>'sourceExternalKey' as external_key
      from dm_private.attempts a join dm_private.attempt_items i on i.attempt_id=a.id
      where a.user_id=student and jsonb_typeof(i.key->'sourceExternalKey')='string'
        and nullif(i.key->>'sourceExternalKey','') is not null
    )
    select b.* from dm_private.bank_questions b
    join ready_keys ready on ready.external_key=b.external_key
    left join delivered d on d.external_key=b.external_key
    where b.active and b.owner_approved and b.rights_confirmed and b.runtime_payload->>'kind' in('mcq','msq','nat')
      and b.payload->'holds'='[]'::jsonb
      and b.topic=p_topic and b.exam=p_exam
    order by (d.external_key is not null),md5(b.external_key||seed::text),b.external_key limit p_count
  loop
    ordinal:=ordinal+1;
    insert into dm_private.questions(paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
      values(paper,ordinal,question.runtime_payload->>'prompt',question.runtime_payload->'options',
        question.runtime_payload->>'kind',question.runtime_payload->'marking',question.runtime_payload->'media',
        (question.runtime_payload->>'points')::numeric,(question.runtime_payload->>'negativePoints')::numeric,question.topic,true)
      returning id into question_id;
    insert into dm_private.answer_keys(question_id,key,explanation)
      values(question_id,question.runtime_payload->'key',question.runtime_payload->>'explanation');
  end loop;
  if ordinal<>p_count then raise exception 'Not enough reviewed questions for this practice'; end if;
  insert into dm_private.attempts(user_id,paper_id,deadline)
    values(student,paper,now()+make_interval(secs=>p_duration_seconds)) returning id into attempt;
  insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
    select attempt,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation
    from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=paper;
  return attempt;
end $$;
