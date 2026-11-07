begin;

-- One owned export follows the same release boundary as student reports and analytics.
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
      'score',case when v.status='submitted' and not v.results_pending then case
        when ai.event_id is not null then cohort.score
        when p.source_kind='exam_part_b' then(select coalesce(sum(r.score),0) from dm_private.drawing_reviews r where r.attempt_id=a.id and r.status='released')
        else v.score end end,
      'total',case when v.status='submitted' and not v.results_pending then case when ai.event_id is not null then cohort.total else v.total end end,
      'resultsPending',v.results_pending,
      'responses',(select coalesce(jsonb_agg(jsonb_build_object('questionId',i.question_id,'ordinal',i.ordinal,'topic',i.topic,'kind',i.kind,'answer',i.answer)
        order by i.ordinal),'[]') from dm_private.attempt_items i where i.attempt_id=a.id)) order by v.started_at,a.id)
      from dm_private.student_attempt_visibility(student) v join dm_private.attempts a on a.id=v.id join dm_private.papers p on p.id=a.paper_id
      left join dm_private.all_india_attempts ai on ai.attempt_id=a.id
      left join dm_private.all_india_events event on event.id=ai.event_id
      left join dm_private.all_india_results cohort on cohort.attempt_id=a.id and cohort.user_id=student and event.results_released_at is not null),'[]'),
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
