-- Expose the existing per-question grade only when the student can see the result.
create or replace function public.read_attempt(p_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  attempt dm_private.attempts;
  event dm_private.all_india_events;
  standing dm_private.all_india_results;
  questions jsonb:='[]';
  upload_tasks jsonb:='[]';
  event_pending boolean;
  exam_pending boolean;
  visible_score numeric;
  visible_total numeric;
begin
  select * into attempt from dm_private.attempts where id=p_id and user_id=auth.uid();
  if not found then raise exception 'Attempt not found'; end if;
  if attempt.status='active' and attempt.deadline<=clock_timestamp() then
    perform dm_private.finalize_attempt(attempt.id);
    select * into attempt from dm_private.attempts where id=p_id;
  end if;
  select e.* into event from dm_private.all_india_attempts ai
    join dm_private.all_india_events e on e.id=ai.event_id where ai.attempt_id=p_id;
  event_pending:=attempt.status='submitted' and event.id is not null and event.results_released_at is null;
  exam_pending:=attempt.status='submitted' and dm_private.exam_mock_results_pending(p_id);
  if event.results_released_at is not null then
    select * into standing from dm_private.all_india_results where attempt_id=p_id;
  end if;
  if event_pending then
    if attempt.upload_deadline>clock_timestamp() then
      select coalesce(jsonb_agg(jsonb_build_object('id',i.question_id,'ordinal',i.ordinal,'prompt',i.prompt) order by i.ordinal),'[]')
        into upload_tasks from dm_private.attempt_items i where i.attempt_id=p_id and i.kind='drawing';
    end if;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',i.question_id,'ordinal',i.ordinal,'prompt',i.prompt,'options',i.options,'topic',i.topic,'answer',i.answer,
      'answerRevision',i.answer_revision,
      'points',i.points,'negativePoints',i.negative_points,'marking',i.marking,'kind',i.kind,'media',i.media
    )||case when attempt.status='submitted' and not exam_pending then (
      select jsonb_build_object('correctKey',i.key,'explanation',i.explanation,'outcome',grade.outcome,'awarded',grade.marks)
      from dm_private.score_response(i.kind,i.key,i.answer,i.marking) grade
    ) else '{}'::jsonb end||case when attempt.status='submitted' and i.kind='drawing' then jsonb_build_object(
      'drawingReview',case when r.status='released' and not exam_pending then jsonb_build_object(
        'status','released','criteria',r.criterion_marks,'comments',r.comments,'score',r.score,'maxScore',i.points,'releasedAt',r.released_at
      ) when r.id is not null then '{"status":"pending"}'::jsonb else '{"status":"not_submitted"}'::jsonb end
    ) else '{}'::jsonb end order by i.ordinal),'[]') into questions
    from dm_private.attempt_items i left join dm_private.drawing_reviews r
      on r.attempt_id=i.attempt_id and r.question_id=i.question_id where i.attempt_id=p_id;
  end if;
  select v.score,v.total into visible_score,visible_total
    from dm_private.student_attempt_visibility(auth.uid()) v where v.id=p_id;
  return jsonb_build_object(
    'title',(select title from dm_private.papers where id=attempt.paper_id),
    'id',attempt.id,'status',attempt.status,'deadline',attempt.deadline,'uploadDeadline',attempt.upload_deadline,
    'serverNow',clock_timestamp(),'reviewEndsAt',event.review_ends_at,'resultsPending',event_pending,'examResultsPending',exam_pending,
    'score',case when not(event_pending or exam_pending) then visible_score end,
    'total',case when not(event_pending or exam_pending) then visible_total end,
    'scoreKind',case when event.id is not null then 'all_india'
      when (select p.source_kind='exam_part_b' from dm_private.papers p where p.id=attempt.paper_id) then 'drawing'
      else 'objective' end,
    'cohortResult',case when standing.attempt_id is not null then jsonb_build_object(
      'rank',standing.rank,'objectiveScore',attempt.score,'objectiveTotal',attempt.total,
      'drawingScore',standing.score-attempt.score,'drawingTotal',standing.total-attempt.total
    ) end,'questions',questions,'drawingUploadTasks',upload_tasks
  );
end $$;
