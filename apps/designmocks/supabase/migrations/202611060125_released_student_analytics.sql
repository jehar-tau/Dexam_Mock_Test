begin;

create function dm_private.student_attempt_visibility(p_user_id uuid)
returns table(
  id uuid,title text,exam text,status text,started_at timestamptz,deadline timestamptz,
  score numeric,total numeric,results_pending boolean
) language sql stable set search_path=pg_catalog,dm_private as $$
  select a.id,p.title,p.exam,a.status,a.started_at,a.deadline,a.score,a.total,
    a.status='submitted' and (
      (e.id is not null and e.results_released_at is null)
      or (p.source_kind in('exam','exam_part_b') and dm_private.exam_mock_results_pending(a.id))
    )
  from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id
  left join dm_private.all_india_attempts ai on ai.attempt_id=a.id
  left join dm_private.all_india_events e on e.id=ai.event_id
  where a.user_id=p_user_id
$$;

create function dm_private.released_objective_answers(p_user_id uuid)
returns table(topic text,correct boolean)
language sql stable set search_path=pg_catalog,dm_private as $$
  select i.topic,g.outcome in('correct','full_marks')
  from dm_private.student_attempt_visibility(p_user_id) a join dm_private.attempt_items i on i.attempt_id=a.id
  cross join lateral dm_private.score_response(i.kind,i.key,i.answer,i.marking) g
  where a.status='submitted' and not a.results_pending and i.kind in('mcq','msq','nat')
    and i.key->>'kind' is distinct from 'dropped'
    and i.answer not in('null'::jsonb,'[]'::jsonb) and btrim(i.answer#>>'{}')<>''
$$;

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
    ), exam_stats as (
      select a.exam,count(*) as attempts,round(avg(a.score*100.0/nullif(a.total,0))) as average_percent,
        round(max(a.score*100.0/nullif(a.total,0))) as best_percent
      from attempts a where a.status='submitted' and not a.results_pending and a.total>0 group by a.exam
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

create or replace function public.learning_progress()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare
  student uuid:=auth.uid();
  total integer;
  completed integer;
  recommendation jsonb;
begin
  if student is null then raise exception 'Sign in required'; end if;
  select count(*),count(p.lesson_id) into total,completed
  from dm_private.learning_lessons l
  left join dm_private.learning_progress p on p.lesson_id=l.id and p.user_id=student
  where l.published and l.rights_confirmed;

  with performance as (
    select lower(a.topic) as topic,count(*) as answered,count(*) filter(where a.correct) as correct
    from dm_private.released_objective_answers(student) a group by lower(a.topic)
  ), candidate as (
    select l.id,l.slug,l.exam,l.topic,l.title,coalesce(s.answered,0) as answered,
      round(s.correct*100.0/nullif(s.answered,0)) as accuracy
    from dm_private.learning_lessons l
    left join dm_private.learning_progress p on p.lesson_id=l.id and p.user_id=student
    left join performance s on s.topic=lower(l.topic)
    where l.published and l.rights_confirmed and p.lesson_id is null
    order by s.correct::numeric/nullif(s.answered,0) nulls last,l.exam,l.ordinal,l.id limit 1
  )
  select jsonb_build_object(
    'id',c.id,'slug',c.slug,'exam',c.exam,'topic',c.topic,'title',c.title,'answered',c.answered,'accuracy',c.accuracy,
    'reason',case when c.answered>0
      then 'Recommended from your '||c.accuracy||'% accuracy across '||c.answered||' answered '||c.topic||
        ' question'||case when c.answered=1 then '' else 's' end||'.'
      else 'Recommended as the next incomplete lesson in your learning path.' end
  ) into recommendation from candidate c;

  return jsonb_build_object('total',total,'completed',completed,
    'percent',coalesce(round(completed*100.0/nullif(total,0)),0),'recommendation',recommendation);
end $$;

revoke all on function dm_private.student_attempt_visibility(uuid),
  dm_private.released_objective_answers(uuid) from public,anon,authenticated;

commit;
