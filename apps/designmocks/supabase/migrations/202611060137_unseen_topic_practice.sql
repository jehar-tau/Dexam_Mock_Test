begin;

create or replace function public.topic_catalog()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  return(select coalesce(jsonb_agg(jsonb_build_object('topic',topic,'exam',exam,'questions',questions)
    order by questions desc,topic,exam),'[]') from (
      select topic,exam,count(*) as questions from dm_private.bank_questions
      where active and owner_approved and rights_confirmed and runtime_payload->>'kind' in('mcq','msq','nat')
      group by topic,exam
    ) catalog);
end $$;
revoke all on function public.topic_catalog() from public,anon;
grant execute on function public.topic_catalog() to authenticated;

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
  if (select count(*) from dm_private.bank_questions where active and owner_approved and rights_confirmed
    and runtime_payload->>'kind' in('mcq','msq','nat') and topic=p_topic and exam=p_exam)<p_count then
    raise exception 'Not enough reviewed questions for this practice';
  end if;
  insert into dm_private.papers(title,exam,duration_seconds,published,reviewed,rights_confirmed,owner_user_id,source_kind)
    values(initcap(replace(p_topic,'-',' '))||' practice',p_exam,p_duration_seconds,false,true,true,student,'topic')
    returning id into paper;
  -- Delivery history stays private and is scoped to the caller, including earlier active attempts.
  -- Legacy snapshots without an explicit source identity cannot establish that a bank row was seen.
  for question in
    with delivered as materialized (
      select distinct i.key->>'sourceExternalKey' as external_key
      from dm_private.attempts a join dm_private.attempt_items i on i.attempt_id=a.id
      where a.user_id=student and jsonb_typeof(i.key->'sourceExternalKey')='string'
        and nullif(i.key->>'sourceExternalKey','') is not null
    )
    select b.* from dm_private.bank_questions b left join delivered d on d.external_key=b.external_key
    where b.active and b.owner_approved and b.rights_confirmed and b.runtime_payload->>'kind' in('mcq','msq','nat')
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
revoke all on function public.start_topic_practice(text,text,integer,integer) from public,anon;
grant execute on function public.start_topic_practice(text,text,integer,integer) to authenticated;

commit;
