begin;

create or replace function public.save_answer_revision(p_attempt_id uuid,p_question_id uuid,p_answer jsonb,p_revision bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare
  attempt dm_private.attempts;
  item dm_private.attempt_items;
  received_at timestamptz;
begin
  if p_revision is null or p_revision not between 1 and 9007199254740991 then raise exception 'Invalid answer revision'; end if;
  select * into attempt from dm_private.attempts where id=p_attempt_id and user_id=auth.uid() for update;
  if not found or attempt.status<>'active' or attempt.deadline<=clock_timestamp() then raise exception 'Answer window closed'; end if;
  select * into item from dm_private.attempt_items where attempt_id=attempt.id and question_id=p_question_id for update;
  if not found then raise exception 'Question not in attempt'; end if;
  if p_revision<=item.answer_revision then
    return jsonb_build_object('accepted',false,'revision',item.answer_revision,'answer',item.answer,'serverNow',clock_timestamp());
  end if;
  perform dm_private.consume_attempt_rate(auth.uid(),'autosave',120,interval '1 minute');
  received_at:=clock_timestamp();
  if attempt.deadline<=received_at then raise exception 'Answer window closed'; end if;
  perform public.save_answer(p_attempt_id,p_question_id,p_answer);
  update dm_private.attempt_items set answer_revision=p_revision,answered_at=received_at
    where attempt_id=p_attempt_id and question_id=p_question_id;
  return jsonb_build_object('accepted',true,'revision',p_revision,'answer',p_answer,'serverNow',received_at);
end $$;

create or replace function dm_private.finalize_attempt(p_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  attempt dm_private.attempts;
  grace_seconds integer;
begin
  select * into attempt from dm_private.attempts where id=p_id for update;
  if not found or attempt.status<>'active' then return false; end if;
  select upload_grace_seconds into grace_seconds from dm_private.papers where id=attempt.paper_id;
  update dm_private.attempts set status='submitted',submitted_at=least(clock_timestamp(),attempt.deadline),
    upload_deadline=case when grace_seconds>0 and exists(select 1 from dm_private.attempt_items i
      where i.attempt_id=attempt.id and i.kind='drawing') then attempt.deadline+make_interval(secs=>grace_seconds) else attempt.upload_deadline end,
    score=(select coalesce(sum(g.marks),0) from dm_private.attempt_items i
      cross join lateral dm_private.score_response(i.kind,i.key,i.answer,i.marking) g where i.attempt_id=attempt.id),
    total=(select coalesce(sum(case when kind='drawing' or key->>'kind'='dropped' then 0 else (marking->>'correct')::numeric end),0)
      from dm_private.attempt_items where attempt_id=attempt.id)
    where id=attempt.id;
  return true;
end $$;

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
    )||case when attempt.status='submitted' and not exam_pending then jsonb_build_object(
      'correctKey',i.key,'explanation',i.explanation,'outcome',(select outcome from dm_private.score_response(i.kind,i.key,i.answer,i.marking))
    ) else '{}'::jsonb end||case when attempt.status='submitted' and i.kind='drawing' then jsonb_build_object(
      'drawingReview',case when r.status='released' then jsonb_build_object(
        'status','released','criteria',r.criterion_marks,'comments',r.comments,'score',r.score,'maxScore',i.points,'releasedAt',r.released_at
      ) when r.id is not null then '{"status":"pending"}'::jsonb else '{"status":"not_submitted"}'::jsonb end
    ) else '{}'::jsonb end order by i.ordinal),'[]') into questions
    from dm_private.attempt_items i left join dm_private.drawing_reviews r
      on r.attempt_id=i.attempt_id and r.question_id=i.question_id where i.attempt_id=p_id;
  end if;
  return jsonb_build_object(
    'title',(select title from dm_private.papers where id=attempt.paper_id),
    'id',attempt.id,'status',attempt.status,'deadline',attempt.deadline,'uploadDeadline',attempt.upload_deadline,
    'serverNow',clock_timestamp(),'reviewEndsAt',event.review_ends_at,'resultsPending',event_pending,'examResultsPending',exam_pending,
    'score',case when not(event_pending or exam_pending) then coalesce(standing.score,attempt.score) end,
    'total',case when not(event_pending or exam_pending) then coalesce(standing.total,attempt.total) end,
    'cohortResult',case when standing.attempt_id is not null then jsonb_build_object(
      'rank',standing.rank,'objectiveScore',attempt.score,'objectiveTotal',attempt.total,
      'drawingScore',standing.score-attempt.score,'drawingTotal',standing.total-attempt.total
    ) end,'questions',questions,'drawingUploadTasks',upload_tasks
  );
end $$;

commit;
