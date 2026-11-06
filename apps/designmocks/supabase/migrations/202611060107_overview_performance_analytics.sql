create or replace function public.my_overview_analytics()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare
  v_user uuid:=auth.uid();
  v_topics jsonb;
  v_exams jsonb;
  v_answered integer;
  v_correct integer;
  v_recommended jsonb;
begin
  if v_user is null then raise exception'Sign in required';end if;
  with topic_stats as(
    select i.topic,count(*)filter(where i.answer is not null)answered,
      count(*)filter(where i.answer is not null and(select outcome from dm_private.score_response(i.kind,i.key,i.answer,i.marking))in('correct','full_marks'))correct
    from dm_private.attempt_items i join dm_private.attempts a on a.id=i.attempt_id
    where a.user_id=v_user and a.status='submitted'and i.kind<>'drawing'
      and not exists(select 1 from dm_private.all_india_attempts ai join dm_private.all_india_events e on e.id=ai.event_id where ai.attempt_id=a.id and e.results_released_at is null)
    group by i.topic
  )
  select coalesce(jsonb_agg(jsonb_build_object('topic',topic,'answered',answered,'correct',correct,'accuracy',case when answered=0 then 0 else round(correct*100.0/answered)end)order by answered desc,topic),'[]'),
    coalesce(sum(answered),0),coalesce(sum(correct),0),
    (select jsonb_build_object('topic',topic,'answered',answered,'accuracy',round(correct*100.0/answered))from topic_stats where answered>0 order by correct*1.0/answered,answered desc,topic limit 1)
  into v_topics,v_answered,v_correct,v_recommended from topic_stats;

  select coalesce(jsonb_agg(jsonb_build_object('exam',exam,'attempts',attempts,'averagePercent',average_percent,'bestPercent',best_percent)order by exam),'[]')into v_exams
  from(
    select p.exam,count(*)attempts,round(avg(a.score*100.0/nullif(a.total,0)))average_percent,round(max(a.score*100.0/nullif(a.total,0)))best_percent
    from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id
    where a.user_id=v_user and a.status='submitted'and a.total>0
      and not exists(select 1 from dm_private.all_india_attempts ai join dm_private.all_india_events e on e.id=ai.event_id where ai.attempt_id=a.id and e.results_released_at is null)
    group by p.exam
  )s;

  return jsonb_build_object(
    'activeAttempt',(select jsonb_build_object('id',a.id,'title',p.title,'deadline',a.deadline)from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id where a.user_id=v_user and a.status='active'and a.deadline>now()order by a.started_at desc limit 1),
    'completed',(select count(*)from dm_private.attempts where user_id=v_user and status='submitted'),
    'objectiveAnswered',v_answered,
    'objectiveAccuracy',case when v_answered=0 then null else round(v_correct*100.0/v_answered)end,
    'recommendedTopic',v_recommended,
    'topics',v_topics,
    'exams',v_exams,
    'drawingReviews',jsonb_build_object(
      'pending',(select count(*)from dm_private.drawing_reviews r join dm_private.attempts a on a.id=r.attempt_id where a.user_id=v_user and r.status<>'released'),
      'released',(select count(*)from dm_private.drawing_reviews r join dm_private.attempts a on a.id=r.attempt_id where a.user_id=v_user and r.status='released'))
  );
end$$;
