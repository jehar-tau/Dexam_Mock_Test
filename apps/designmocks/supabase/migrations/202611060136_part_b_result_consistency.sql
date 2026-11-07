begin;

-- Share owned released marks across the paper, history, export and analytics.
create or replace function dm_private.student_attempt_visibility(p_user_id uuid)
returns table(
  id uuid,title text,exam text,status text,started_at timestamptz,deadline timestamptz,
  score numeric,total numeric,results_pending boolean
) language sql stable set search_path=pg_catalog,dm_private as $$
  select a.id,p.title,p.exam,a.status,a.started_at,a.deadline,
    case when a.status='submitted' and not visibility.pending then
      case when event.id is not null then cohort.score
        when p.source_kind='exam_part_b' then drawing.score else a.score end end,
    case when a.status='submitted' and not visibility.pending then
      case when event.id is not null then cohort.total
        when p.source_kind='exam_part_b' then drawing.total else a.total end end,
    visibility.pending
  from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id
  left join dm_private.all_india_attempts ai on ai.attempt_id=a.id and ai.user_id=p_user_id
  left join dm_private.all_india_events event on event.id=ai.event_id
  left join dm_private.all_india_results cohort on cohort.event_id=event.id and cohort.attempt_id=a.id
    and cohort.user_id=p_user_id and event.results_released_at is not null
  left join lateral (
    select coalesce(sum(r.score),0) as score,coalesce(sum(i.points),0) as total
    from dm_private.attempt_items i left join dm_private.drawing_reviews r
      on r.attempt_id=i.attempt_id and r.question_id=i.question_id and r.status='released'
    where i.attempt_id=a.id and i.kind='drawing'
  ) drawing on p.source_kind='exam_part_b'
  cross join lateral (select a.status='submitted' and (
    (event.id is not null and event.results_released_at is null)
    or (p.source_kind in('exam','exam_part_b') and dm_private.exam_mock_results_pending(a.id))
  ) as pending) visibility
  where a.user_id=p_user_id
$$;
revoke all on function dm_private.student_attempt_visibility(uuid) from public,anon,authenticated;

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
    )||case when attempt.status='submitted' and not exam_pending then jsonb_build_object(
      'correctKey',i.key,'explanation',i.explanation,'outcome',(select outcome from dm_private.score_response(i.kind,i.key,i.answer,i.marking))
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

create or replace function public.my_attempt_history()
returns jsonb language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',v.id,'title',v.title,'status',v.status,'startedAt',v.started_at,'resultsPending',v.results_pending,
    'score',v.score,'total',v.total,
    'cohortRank',case when not v.results_pending then cohort.rank end
  ) order by v.started_at desc),'[]')
  from dm_private.student_attempt_visibility(auth.uid()) v
  left join dm_private.all_india_results cohort on cohort.attempt_id=v.id and cohort.user_id=auth.uid()
$$;
revoke all on function public.read_attempt(uuid),public.my_attempt_history() from public,anon;
grant execute on function public.read_attempt(uuid),public.my_attempt_history() to authenticated;

create or replace function public.export_my_account_data()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public as $$
declare student uuid:=auth.uid();
begin
  if student is null then raise exception 'Sign in required' using errcode='42501';end if;
  return jsonb_build_object(
    'schemaVersion',2,'exportedAt',now(),'accountId',student,
    'profile',(select to_jsonb(p) from public.profiles p where p.user_id=student),
    'access',jsonb_build_object(
      'orders',coalesce((select jsonb_agg(jsonb_build_object('id',id,'planId',plan_id,'amount',amount,'currency',currency,'mode',mode,
        'status',status,'createdAt',created_at,'paidAt',paid_at) order by created_at,id) from dm_private.orders where user_id=student),'[]'),
      'passes',coalesce((select jsonb_agg(jsonb_build_object('mode',mode,'startsAt',starts_at,'expiresAt',expires_at)) from dm_private.passes where user_id=student),'[]')),
    'attempts',coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'paper',v.title,'exam',v.exam,'status',v.status,'startedAt',v.started_at,'deadline',v.deadline,'submittedAt',a.submitted_at,
      'score',v.score,'total',v.total,
      'resultsPending',v.results_pending,
      'responses',(select coalesce(jsonb_agg(jsonb_build_object('questionId',i.question_id,'ordinal',i.ordinal,'topic',i.topic,'kind',i.kind,'answer',i.answer)
        order by i.ordinal),'[]') from dm_private.attempt_items i where i.attempt_id=a.id)) order by v.started_at,a.id)
      from dm_private.student_attempt_visibility(student) v join dm_private.attempts a on a.id=v.id),'[]'),
    'results',jsonb_build_object(
      'examMocks',coalesce((select jsonb_agg(public.my_exam_mock_report(s.part_a_attempt) order by s.created_at,s.id)
        from dm_private.exam_mock_sessions s where s.user_id=student),'[]'),
      'allIndia',coalesce((select jsonb_agg(jsonb_build_object('eventId',e.id,'attemptId',r.attempt_id,'exam',e.exam,'title',e.title,
        'releasedAt',e.results_released_at,'score',r.score,'total',r.total,'rank',r.rank,'alias',r.alias,
        'cohortSize',(select count(*) from dm_private.all_india_results cohort where cohort.event_id=e.id)) order by e.results_released_at,e.id)
        from dm_private.all_india_results r join dm_private.all_india_events e on e.id=r.event_id
        where r.user_id=student and e.results_released_at is not null),'[]'),
      'drawingReviews',coalesce((select jsonb_agg(jsonb_build_object('reviewId',r.id,'attemptId',r.attempt_id,'questionId',r.question_id,
        'score',r.score,'maxScore',i.points,'criteria',r.criterion_marks,'comments',r.comments,'releasedAt',r.released_at)
        order by r.released_at,r.id) from dm_private.student_attempt_visibility(student) v
        join dm_private.attempts a on a.id=v.id join dm_private.drawing_reviews r on r.attempt_id=v.id
        join dm_private.attempt_items i on i.attempt_id=r.attempt_id and i.question_id=r.question_id
        where v.status='submitted' and not v.results_pending and r.status='released' and i.kind='drawing'
          and now()>=coalesce(a.upload_deadline,a.deadline)),'[]')),
    'learningProgress',coalesce((select jsonb_agg(jsonb_build_object('lessonId',lesson_id,'completedAt',completed_at) order by completed_at,lesson_id)
      from dm_private.learning_progress where user_id=student),'[]'),
    'community',jsonb_build_object(
      'posts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'exam',exam,'topic',topic,'title',title,'body',body,'status',status,'createdAt',created_at)
        order by created_at,id) from dm_private.community_posts where author_id=student),'[]'),
      'comments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'postId',post_id,'parentId',parent_id,'body',body,'status',status,'createdAt',created_at)
        order by created_at,id) from dm_private.community_comments where author_id=student),'[]')),
    'bugReports',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'pageUrl',page_url,'status',status,
      'adminReply',admin_reply,'createdAt',created_at,'updatedAt',updated_at) order by created_at,id) from dm_private.bug_reports where reporter_id=student),'[]'),
    -- These are the student's own statements. Review fingerprints include answer data and stay private.
    'questionReports',coalesce((select jsonb_agg(jsonb_build_object('id',id,'attemptId',attempt_id,'questionId',question_id,'reason',reason,
      'details',details,'createdAt',created_at) order by created_at,id) from dm_private.question_reports where reporter_id=student),'[]'),
    'drawingUploads',coalesce((select jsonb_agg(jsonb_build_object('id',id,'attemptId',attempt_id,'questionId',question_id,'ordinal',ordinal,
      'mimeType',mime_type,'byteSize',byte_size,'createdAt',created_at) order by created_at,id) from dm_private.drawing_uploads where student_id=student),'[]')
  );
end $$;
revoke all on function public.export_my_account_data() from public,anon;
grant execute on function public.export_my_account_data() to authenticated;

commit;
