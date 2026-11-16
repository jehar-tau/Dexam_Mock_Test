begin;

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
      from dm_private.bank_questions q
      where q.exam=blueprint.exam and q.active and q.owner_approved and q.rights_confirmed and q.runtime_payload is not null
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

commit;
