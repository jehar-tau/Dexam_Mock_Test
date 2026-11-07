begin;

-- Exam percentages use one published whole-test result, including human marks.
create or replace function public.my_overview_analytics()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare
  student uuid:=auth.uid();
begin
  if student is null then raise exception 'Sign in required'; end if;
  return (
    with attempts as materialized (select * from dm_private.student_attempt_visibility(student)),
    topics as (
      select a.topic,count(*) as answered,count(*) filter(where a.correct) as correct
      from dm_private.released_objective_answers(student) a group by a.topic
    ), counts as (
      select coalesce(sum(t.answered),0) as answered,coalesce(sum(t.correct),0) as correct from topics t
    ), released_scores as (
      select a.exam,
        case when event.id is not null then cohort.score
          when session.id is not null then (report.value->>'combinedScore')::numeric else a.score end as score,
        case when event.id is not null then cohort.total
          when session.id is not null then (report.value->>'combinedTotal')::numeric else a.total end as total
      from attempts a
      left join dm_private.all_india_attempts ai on ai.attempt_id=a.id and ai.user_id=student
      left join dm_private.all_india_events event on event.id=ai.event_id
      left join dm_private.all_india_results cohort on cohort.attempt_id=a.id and cohort.user_id=student
        and event.results_released_at is not null
      left join dm_private.exam_mock_sessions session on session.user_id=student
        and a.id in(session.part_a_attempt,session.part_b_attempt)
      left join lateral (select public.my_exam_mock_report(session.part_a_attempt) as value) report on session.id is not null
      where a.status='submitted' and not a.results_pending
        and (session.id is null or a.id=session.part_a_attempt)
    ), exam_stats as (
      select a.exam,count(*) as attempts,round(avg(a.score*100.0/a.total)) as average_percent,
        round(max(a.score*100.0/a.total)) as best_percent
      from released_scores a where a.score is not null and a.total>0 group by a.exam
    ), reviews as (
      select r.status='released' and not a.results_pending as visible
      from attempts a join dm_private.drawing_reviews r on r.attempt_id=a.id
    )
    select jsonb_build_object(
      'activeAttempt',(select jsonb_build_object('id',a.id,'title',a.title,'deadline',a.deadline)
        from attempts a where a.status='active' and a.deadline>now() order by a.started_at desc limit 1),
      'completed',(select count(*) from attempts a where a.status='submitted'),
      'waitingForResults',(select count(*) from attempts a where a.results_pending),
      'objectiveAnswered',counts.answered,
      'objectiveAccuracy',round(counts.correct*100.0/nullif(counts.answered,0)),
      'recommendedTopic',(select jsonb_build_object('topic',t.topic,'answered',t.answered,'accuracy',round(t.correct*100.0/t.answered))
        from topics t order by t.correct::numeric/t.answered,t.answered desc,t.topic limit 1),
      'topics',(select coalesce(jsonb_agg(jsonb_build_object('topic',t.topic,'answered',t.answered,
        'correct',t.correct,'accuracy',round(t.correct*100.0/t.answered)) order by t.answered desc,t.topic),'[]') from topics t),
      'exams',(select coalesce(jsonb_agg(jsonb_build_object('exam',s.exam,'attempts',s.attempts,
        'averagePercent',s.average_percent,'bestPercent',s.best_percent) order by s.exam),'[]') from exam_stats s),
      'drawingReviews',(select jsonb_build_object('pending',count(*) filter(where not r.visible),
        'released',count(*) filter(where r.visible)) from reviews r)
    ) from counts
  );
end $$;
revoke all on function public.my_overview_analytics() from public,anon;
grant execute on function public.my_overview_analytics() to authenticated;

commit;
