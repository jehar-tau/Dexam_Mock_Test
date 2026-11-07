begin;

-- Legacy uploads have unknown rendering metadata. Never guess an old file's orientation.
alter table dm_private.drawing_uploads
 add column pixel_width integer,
 add column pixel_height integer,
 add column image_orientation smallint,
 add constraint drawing_render_metadata check(
   (pixel_width is null and pixel_height is null and image_orientation is null) or
   (pixel_width is not null and pixel_height is not null and image_orientation is not null
    and pixel_width between 1 and 12000 and pixel_height between 1 and 12000
    and pixel_width::bigint*pixel_height<=24000000 and image_orientation between 1 and 8)
 );

-- Keep the seven-argument service API for old tools. New validated uploads supply
-- the decoder's dimensions/orientation; registration retains every existing fence.
create function public.register_drawing_upload(
 p_student_id uuid,p_attempt_id uuid,p_question_id uuid,p_storage_path text,
 p_ordinal integer,p_mime_type text,p_byte_size integer,
 p_pixel_width integer,p_pixel_height integer,p_image_orientation integer
) returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare upload_id uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
 if p_pixel_width is null or p_pixel_height is null or p_image_orientation is null
  or p_pixel_width not between 1 and 12000 or p_pixel_height not between 1 and 12000
  or p_pixel_width::bigint*p_pixel_height>24000000 or p_image_orientation not between 1 and 8 then
  raise exception 'Invalid drawing rendering metadata';
 end if;
 upload_id:=public.register_drawing_upload(p_student_id,p_attempt_id,p_question_id,p_storage_path,p_ordinal,p_mime_type,p_byte_size);
 update dm_private.drawing_uploads set pixel_width=p_pixel_width,pixel_height=p_pixel_height,image_orientation=p_image_orientation
  where id=upload_id;
 return upload_id;
end $$;
revoke all on function public.register_drawing_upload(uuid,uuid,uuid,text,integer,text,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.register_drawing_upload(uuid,uuid,uuid,text,integer,text,integer,integer,integer,integer) to service_role;

create function public.service_student_drawing_media_paths(p_student_id uuid,p_attempt_id uuid,p_question_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
 if not exists(select 1 from dm_private.attempts a join dm_private.attempt_items i on i.attempt_id=a.id
  where a.id=p_attempt_id and a.user_id=p_student_id and i.question_id=p_question_id and i.kind='drawing') then
  raise exception 'Drawing pages unavailable';
 end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'ordinal',u.ordinal,'storagePath',u.storage_path,
  'mimeType',u.mime_type,'width',u.pixel_width,'height',u.pixel_height,'orientation',u.image_orientation) order by u.ordinal),'[]')
  from dm_private.drawing_uploads u where u.attempt_id=p_attempt_id and u.question_id=p_question_id and u.student_id=p_student_id);
end $$;
revoke all on function public.service_student_drawing_media_paths(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.service_student_drawing_media_paths(uuid,uuid,uuid) to service_role;

create or replace function public.my_drawing_uploads(p_attempt_id uuid,p_question_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,dm_private as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'ordinal',u.ordinal,'mimeType',u.mime_type,'byteSize',u.byte_size,
  'width',u.pixel_width,'height',u.pixel_height,'orientation',u.image_orientation) order by u.ordinal),'[]')
 from dm_private.drawing_uploads u join dm_private.attempts a on a.id=u.attempt_id
 where u.attempt_id=p_attempt_id and u.question_id=p_question_id and u.student_id=auth.uid() and a.user_id=auth.uid()
$$;

create or replace function public.admin_drawing_review_media_paths(p_review_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
declare review dm_private.drawing_reviews;
begin
 if not public.can_review_drawings() then raise exception 'Drawing reviewer access required' using errcode='42501'; end if;
 select r.* into review from dm_private.drawing_reviews r join dm_private.attempts a on a.id=r.attempt_id
  where r.id=p_review_id and a.user_id<>auth.uid() and a.status='submitted'
   and dm_private.drawing_upload_cutoff(a)<=statement_timestamp();
 if not found then raise exception 'Review unavailable'; end if;
 if review.status='pending' then raise exception 'Claim the review before opening student work'; end if;
 if review.status='assigned' and review.reviewer_id is distinct from auth.uid() then raise exception 'Review is assigned to another teacher'; end if;
 if not public.is_dmocks_admin() and (review.reviewer_id is distinct from auth.uid() or review.status='released') then raise exception 'Review unavailable'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'ordinal',u.ordinal,'storagePath',u.storage_path,
  'mimeType',u.mime_type,'width',u.pixel_width,'height',u.pixel_height,'orientation',u.image_orientation) order by u.ordinal),'[]')
  from dm_private.drawing_uploads u where u.attempt_id=review.attempt_id and u.question_id=review.question_id);
end $$;

-- Add owned rendering properties without changing the schema-2 result-release contract.
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
      'mimeType',mime_type,'byteSize',byte_size,'width',pixel_width,'height',pixel_height,'orientation',image_orientation,'createdAt',created_at) order by created_at,id) from dm_private.drawing_uploads where student_id=student),'[]')
  );
end $$;
revoke all on function public.export_my_account_data() from public,anon;
grant execute on function public.export_my_account_data() to authenticated;

commit;
