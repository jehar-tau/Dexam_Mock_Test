create table dm_private.exam_mock_blueprints (
  exam text primary key check(exam in ('uceed','nid','nift','ceed')),
  question_count integer not null check(question_count between 10 and 100),
  duration_seconds integer not null check(duration_seconds between 900 and 21600),
  free_attempt_limit integer not null default 0 check(free_attempt_limit between 0 and 2),
  enabled boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into dm_private.exam_mock_blueprints(exam,question_count,duration_seconds) values('uceed',30,3600),('nid',30,3600),('nift',30,3600),('ceed',30,3600);
alter table dm_private.exam_mock_blueprints enable row level security;
revoke all on dm_private.exam_mock_blueprints from anon,authenticated;

create or replace function public.admin_exam_mock_blueprints()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  return (select jsonb_agg(jsonb_build_object('exam',b.exam,'questionCount',b.question_count,'durationSeconds',b.duration_seconds,'freeAttemptLimit',b.free_attempt_limit,'enabled',b.enabled,'reviewedQuestions',(select count(*) from dm_private.bank_questions q where q.exam=b.exam and q.active and q.owner_approved and q.rights_confirmed and q.runtime_payload is not null)) order by b.exam) from dm_private.exam_mock_blueprints b);
end $$;

create or replace function public.admin_configure_exam_mock(p_exam text,p_question_count integer,p_duration_seconds integer,p_free_attempt_limit integer,p_enabled boolean)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  update dm_private.exam_mock_blueprints set question_count=p_question_count,duration_seconds=p_duration_seconds,free_attempt_limit=p_free_attempt_limit,enabled=p_enabled,updated_by=auth.uid(),updated_at=now() where exam=lower(p_exam);
  if not found then raise exception 'Unknown exam'; end if;
  if p_enabled and (select count(*) from dm_private.bank_questions where exam=lower(p_exam) and active and owner_approved and rights_confirmed and runtime_payload is not null)<p_question_count then raise exception 'Not enough reviewed questions to enable this mock'; end if;
end $$;

create or replace function public.exam_mock_catalog()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  return (select jsonb_agg(jsonb_build_object('exam',b.exam,'questionCount',b.question_count,'durationSeconds',b.duration_seconds,'freeAttemptLimit',b.free_attempt_limit,'freeAttemptsUsed',(select count(*) from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id where a.user_id=auth.uid() and p.source_kind='exam' and p.exam=b.exam),'enabled',b.enabled,'ready',b.enabled and (select count(*) from dm_private.bank_questions q where q.exam=b.exam and q.active and q.owner_approved and q.rights_confirmed and q.runtime_payload is not null)>=b.question_count) order by b.exam) from dm_private.exam_mock_blueprints b);
end $$;

create or replace function public.start_exam_mock(p_exam text)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_blueprint dm_private.exam_mock_blueprints; v_mode text; v_paid boolean; v_used integer; v_paper uuid; v_attempt uuid; v_question_id uuid; v_seed uuid:=gen_random_uuid(); v_question record; v_ordinal integer:=0;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,2));
  select * into v_blueprint from dm_private.exam_mock_blueprints where exam=lower(p_exam) and enabled;
  if v_blueprint.exam is null then raise exception 'This exam mock is not released'; end if;
  if not exists(select 1 from public.profiles where user_id=auth.uid() and onboarding_completed_at is not null) then raise exception 'Complete your verified profile first'; end if;
  select environment_mode into v_mode from public.launch_settings where singleton;
  select exists(select 1 from dm_private.passes where user_id=auth.uid() and mode=v_mode and expires_at>now()) into v_paid;
  select count(*) into v_used from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id where a.user_id=auth.uid() and p.source_kind='exam' and p.exam=v_blueprint.exam;
  if not v_paid and v_used>=v_blueprint.free_attempt_limit then raise exception 'An active pass is required'; end if;
  if (select count(*) from dm_private.attempts where user_id=auth.uid() and status='active' and deadline>now())>=3 then raise exception 'Finish an active attempt before starting another'; end if;
  if (select count(*) from dm_private.bank_questions where exam=v_blueprint.exam and active and owner_approved and rights_confirmed and runtime_payload is not null)<v_blueprint.question_count then raise exception 'Not enough reviewed questions for this mock'; end if;
  insert into dm_private.papers(title,exam,duration_seconds,published,reviewed,rights_confirmed,owner_user_id,source_kind) values(upper(v_blueprint.exam)||' exam-wise mock',v_blueprint.exam,v_blueprint.duration_seconds,false,true,true,auth.uid(),'exam') returning id into v_paper;
  for v_question in select * from dm_private.bank_questions where exam=v_blueprint.exam and active and owner_approved and rights_confirmed and runtime_payload is not null order by md5(external_key||v_seed::text) limit v_blueprint.question_count loop
    v_ordinal:=v_ordinal+1;
    insert into dm_private.questions(paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed) values(v_paper,v_ordinal,v_question.runtime_payload->>'prompt',v_question.runtime_payload->'options',v_question.runtime_payload->>'kind',v_question.runtime_payload->'marking',v_question.runtime_payload->'media',(v_question.runtime_payload->>'points')::numeric,(v_question.runtime_payload->>'negativePoints')::numeric,v_question.topic,true) returning id into v_question_id;
    insert into dm_private.answer_keys(question_id,key,explanation) values(v_question_id,v_question.runtime_payload->'key',v_question.runtime_payload->>'explanation');
  end loop;
  insert into dm_private.attempts(user_id,paper_id,deadline) values(auth.uid(),v_paper,now()+make_interval(secs=>v_blueprint.duration_seconds)) returning id into v_attempt;
  insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
  select v_attempt,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=v_paper;
  return v_attempt;
end $$;

revoke all on function public.admin_exam_mock_blueprints(),public.admin_configure_exam_mock(text,integer,integer,integer,boolean),public.exam_mock_catalog(),public.start_exam_mock(text) from public,anon;
grant execute on function public.admin_exam_mock_blueprints(),public.admin_configure_exam_mock(text,integer,integer,integer,boolean),public.exam_mock_catalog(),public.start_exam_mock(text) to authenticated;
