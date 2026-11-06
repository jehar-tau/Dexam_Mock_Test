begin;

alter table dm_private.drawing_reviews
  add column review_version integer not null default 0;

-- Without upload grace, an early submission closes the image set too.
create function dm_private.drawing_upload_cutoff(attempt dm_private.attempts)
returns timestamptz language sql immutable set search_path=pg_catalog as $$
  select coalesce(attempt.upload_deadline,attempt.submitted_at,attempt.deadline)
$$;

create function public.can_upload_drawing(p_attempt_id uuid,p_question_id uuid,p_ordinal integer)
returns boolean language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select p_ordinal between 1 and 5 and exists(
    select 1 from dm_private.attempts a
    join dm_private.attempt_items i on i.attempt_id=a.id
    where a.id=p_attempt_id and a.user_id=auth.uid() and i.question_id=p_question_id and i.kind='drawing'
      and dm_private.drawing_upload_cutoff(a)>statement_timestamp()
      and not exists(select 1 from dm_private.drawing_uploads u
        where u.attempt_id=a.id and u.question_id=i.question_id and u.ordinal=p_ordinal)
      and not exists(select 1 from dm_private.drawing_reviews r
        where r.attempt_id=a.id and r.question_id=i.question_id and r.status<>'pending')
  )
$$;

-- The old service RPC accepted an arbitrary attempt ID without an owner.
drop function public.register_drawing_upload(uuid,uuid,text,integer,text,integer);
create function public.register_drawing_upload(
  p_student_id uuid,p_attempt_id uuid,p_question_id uuid,p_storage_path text,
  p_ordinal integer,p_mime_type text,p_byte_size integer
) returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  attempt dm_private.attempts;
  upload_id uuid;
  extension text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into attempt from dm_private.attempts where id=p_attempt_id and user_id=p_student_id for update;
  if not found then raise exception 'Drawing attempt unavailable'; end if;
  if dm_private.drawing_upload_cutoff(attempt)<=clock_timestamp() then raise exception 'Upload window closed'; end if;
  if not exists(select 1 from dm_private.attempt_items
      where attempt_id=attempt.id and question_id=p_question_id and kind='drawing') then
    raise exception 'Drawing question unavailable';
  end if;
  if exists(select 1 from dm_private.drawing_reviews
      where attempt_id=attempt.id and question_id=p_question_id and status<>'pending') then
    raise exception 'Drawing review has started';
  end if;
  extension:=case p_mime_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' end;
  if extension is null or p_storage_path is null
    or p_storage_path !~ ('^drawings/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]'||extension||'$')
    or not exists(select 1 from storage.objects where bucket_id='drawing-submissions' and name=p_storage_path
      and metadata->>'mimetype'=p_mime_type and metadata->>'size'=p_byte_size::text) then
    raise exception 'Private drawing object is missing or mismatched';
  end if;
  insert into dm_private.drawing_uploads(attempt_id,question_id,student_id,storage_path,ordinal,mime_type,byte_size)
    values(attempt.id,p_question_id,p_student_id,p_storage_path,p_ordinal,p_mime_type,p_byte_size)
    returning id into upload_id;
  if attempt.status='submitted' then
    insert into dm_private.drawing_reviews(attempt_id,question_id)
      values(attempt.id,p_question_id) on conflict(attempt_id,question_id) do nothing;
  end if;
  return upload_id;
end $$;

drop function public.remove_drawing_upload(uuid);
create function public.remove_drawing_upload(p_student_id uuid,p_id uuid)
returns text language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  attempt dm_private.attempts;
  removed dm_private.drawing_uploads;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select a.* into attempt from dm_private.attempts a
    join dm_private.drawing_uploads u on u.attempt_id=a.id
    where u.id=p_id and u.student_id=p_student_id and a.user_id=p_student_id for update of a;
  if not found or dm_private.drawing_upload_cutoff(attempt)<=clock_timestamp() then
    raise exception 'Upload unavailable';
  end if;
  delete from dm_private.drawing_uploads u where u.id=p_id
    and not exists(select 1 from dm_private.drawing_reviews r
      where r.attempt_id=u.attempt_id and r.question_id=u.question_id and r.status<>'pending')
    returning * into removed;
  if not found then raise exception 'Upload unavailable'; end if;
  delete from dm_private.drawing_reviews r where r.attempt_id=removed.attempt_id
    and r.question_id=removed.question_id and r.status='pending'
    and not exists(select 1 from dm_private.drawing_uploads u
      where u.attempt_id=r.attempt_id and u.question_id=r.question_id);
  return removed.storage_path;
end $$;

create function public.admin_claim_drawing_review(p_review_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare
  review dm_private.drawing_reviews;
  attempt dm_private.attempts;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  -- Lock in the same order as image registration, removal and attempt submission.
  select a.* into attempt from dm_private.attempts a join dm_private.drawing_reviews r on r.attempt_id=a.id
    where r.id=p_review_id and a.user_id<>auth.uid() for update of a;
  if not found then raise exception 'Review unavailable'; end if;
  select * into review from dm_private.drawing_reviews where id=p_review_id for update;
  if not found then raise exception 'Review unavailable'; end if;
  if attempt.status<>'submitted' or dm_private.drawing_upload_cutoff(attempt)>clock_timestamp() then
    raise exception 'Student upload window is still open';
  end if;
  if review.status='assigned' and review.reviewer_id=auth.uid() then return; end if;
  if review.status<>'pending' then raise exception 'Review is already claimed or completed'; end if;
  update dm_private.drawing_reviews set status='assigned',reviewer_id=auth.uid(),review_version=review_version+1
    where id=review.id;
  insert into dm_private.drawing_review_audit(review_id,actor_id,action)
    values(review.id,auth.uid(),'claim');
end $$;

create function public.admin_return_drawing_review(p_review_id uuid,p_expected_version integer)
returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  update dm_private.drawing_reviews set status='pending',reviewer_id=null,review_version=review_version+1
    where id=p_review_id and status='assigned' and reviewer_id=auth.uid() and review_version=p_expected_version;
  if not found then raise exception 'Review assignment changed. Refresh the queue.'; end if;
  insert into dm_private.drawing_review_audit(review_id,actor_id,action)
    values(p_review_id,auth.uid(),'return');
end $$;

create or replace function public.admin_drawing_queue()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'reviewId',r.id,'version',r.review_version,'prompt',i.prompt,'status',r.status,
      'uploadCount',(select count(*) from dm_private.drawing_uploads u where u.attempt_id=r.attempt_id and u.question_id=r.question_id),
      'maxScore',i.points,'criteria',r.criterion_marks,'comments',r.comments,'score',r.score,
      'assignedToMe',coalesce(r.reviewer_id=auth.uid(),false),
      'canClaim',r.status='pending' and state.upload_closed,
      'canReview',state.can_review,
      'aiSuggestion',case when state.can_review then (select jsonb_build_object(
        'provider',s.provider,'model',s.model,'rubricVersion',s.rubric_version,
        'criteria',s.criterion_marks,'comments',s.comments,'proposedScore',s.proposed_score,
        'confidence',s.confidence,'evidence',s.evidence,'createdAt',s.created_at
      ) from dm_private.drawing_ai_suggestions s where s.review_id=r.id order by s.created_at desc,s.id desc limit 1) end
    ) order by case r.status when 'pending' then 1 when 'assigned' then 2 when 'reviewed' then 3 else 4 end,r.id),'[]')
    from dm_private.drawing_reviews r
    join dm_private.attempt_items i on i.attempt_id=r.attempt_id and i.question_id=r.question_id
    join dm_private.attempts a on a.id=r.attempt_id
    cross join lateral (
      select a.status='submitted' and dm_private.drawing_upload_cutoff(a)<=statement_timestamp() as upload_closed,
        a.status='submitted' and dm_private.drawing_upload_cutoff(a)<=statement_timestamp()
        and (r.status in('reviewed','released') or (r.status='assigned' and r.reviewer_id=auth.uid())) as can_review
    ) state
    where a.user_id<>auth.uid()
  );
end $$;

create or replace function public.admin_drawing_review_media_paths(p_review_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
declare review dm_private.drawing_reviews;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  select r.* into review from dm_private.drawing_reviews r join dm_private.attempts a on a.id=r.attempt_id
    where r.id=p_review_id and a.user_id<>auth.uid() and a.status='submitted'
      and dm_private.drawing_upload_cutoff(a)<=statement_timestamp();
  if not found then raise exception 'Review unavailable'; end if;
  if review.status='pending' then raise exception 'Claim the review before opening student work'; end if;
  if review.status='assigned' and review.reviewer_id is distinct from auth.uid() then
    raise exception 'Review is assigned to another teacher';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',u.id,'ordinal',u.ordinal,'storagePath',u.storage_path,'mimeType',u.mime_type
  ) order by u.ordinal),'[]') from dm_private.drawing_uploads u
    where u.attempt_id=review.attempt_id and u.question_id=review.question_id);
end $$;

create function dm_private.validate_drawing_marks(
  criteria jsonb,feedback text,score numeric,max_score numeric
) returns void language plpgsql immutable set search_path=pg_catalog as $$
begin
  if jsonb_typeof(criteria) is distinct from 'object' or criteria='{}'::jsonb then
    raise exception 'Provide between 1 and 12 scoring criteria';
  end if;
  if (select count(*) from jsonb_each(criteria))>12 or exists(
    select 1 from jsonb_each(criteria) e where char_length(btrim(e.key)) not between 2 and 80
      or jsonb_typeof(e.value)<>'number'
  ) or exists(select 1 from jsonb_each(criteria) e group by lower(btrim(e.key)) having count(*)>1) then
    raise exception 'Invalid review criteria';
  end if;
  if score is null or max_score is null or score<0 or score>max_score
    or exists(select 1 from jsonb_each_text(criteria) e where e.value::numeric<0 or scale(trim_scale(e.value::numeric))>2)
    or (select sum(e.value::numeric) from jsonb_each_text(criteria) e)<>score then
    raise exception 'Criterion marks must add up to a score within the task maximum';
  end if;
  if feedback is null or char_length(btrim(feedback)) not between 5 and 4000 then
    raise exception 'Feedback must be between 5 and 4,000 characters';
  end if;
end $$;

drop function public.admin_review_drawing(uuid,jsonb,text,numeric,text);
create function public.admin_review_drawing(
  p_review_id uuid,p_expected_version integer,p_criterion_marks jsonb,p_comments text,
  p_score numeric,p_override_reason text default null
) returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare
  review dm_private.drawing_reviews;
  max_score numeric;
  action text;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  select r.* into review from dm_private.drawing_reviews r join dm_private.attempts a on a.id=r.attempt_id
    where r.id=p_review_id and a.user_id<>auth.uid() and a.status='submitted'
      and dm_private.drawing_upload_cutoff(a)<=clock_timestamp() for update of r;
  if not found then raise exception 'Review unavailable'; end if;
  if p_expected_version is distinct from review.review_version then raise exception 'Review changed. Refresh the queue.'; end if;
  action:=case when review.status in('reviewed','released') then 'override' else 'review' end;
  if action='review' and (review.status<>'assigned' or review.reviewer_id is distinct from auth.uid()) then
    raise exception 'Claim this review before grading';
  end if;
  if action='override' and (p_override_reason is null or char_length(btrim(p_override_reason)) not between 5 and 1000) then
    raise exception 'An override reason of 5 to 1,000 characters is required';
  end if;
  select points into max_score from dm_private.attempt_items where attempt_id=review.attempt_id
    and question_id=review.question_id and kind='drawing';
  perform dm_private.validate_drawing_marks(p_criterion_marks,p_comments,p_score,max_score);
  update dm_private.drawing_reviews set reviewer_id=auth.uid(),status='reviewed',criterion_marks=p_criterion_marks,
    comments=btrim(p_comments),score=p_score,
    override_reason=case when action='override' then btrim(p_override_reason) end,
    reviewed_at=now(),released_at=null,review_version=review_version+1 where id=review.id;
  insert into dm_private.drawing_review_audit(review_id,actor_id,action,payload)
    values(review.id,auth.uid(),action,jsonb_build_object(
      'previous',jsonb_build_object('status',review.status,'criteria',review.criterion_marks,'comments',review.comments,'score',review.score),
      'current',jsonb_build_object('criteria',p_criterion_marks,'comments',btrim(p_comments),'score',p_score),
      'overrideReason',case when action='override' then btrim(p_override_reason) end
    ));
end $$;

drop function public.admin_release_drawing_review(uuid);
create function public.admin_release_drawing_review(p_review_id uuid,p_expected_version integer)
returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  update dm_private.drawing_reviews r set status='released',released_at=now(),review_version=r.review_version+1
    from dm_private.attempts a where r.id=p_review_id and a.id=r.attempt_id and a.user_id<>auth.uid()
      and a.status='submitted' and dm_private.drawing_upload_cutoff(a)<=clock_timestamp()
      and r.status='reviewed' and r.score is not null and r.comments is not null and r.review_version=p_expected_version;
  if not found then raise exception 'Review is not ready for release or has changed. Refresh the queue.'; end if;
  insert into dm_private.drawing_review_audit(review_id,actor_id,action)
    values(p_review_id,auth.uid(),'release');
end $$;

create or replace function public.record_drawing_ai_suggestion(
  p_review_id uuid,p_provider text,p_model text,p_rubric_version text,p_criterion_marks jsonb,
  p_comments text,p_proposed_score numeric,p_confidence numeric,p_evidence jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  suggestion_id uuid;
  max_score numeric;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  -- Any upload that acquired the attempt lock before cutoff must commit first.
  perform 1 from dm_private.attempts a join dm_private.drawing_reviews r on r.attempt_id=a.id
    where r.id=p_review_id for update of a;
  select i.points into max_score from dm_private.drawing_reviews r
    join dm_private.attempt_items i on i.attempt_id=r.attempt_id and i.question_id=r.question_id
    join dm_private.attempts a on a.id=r.attempt_id
    where r.id=p_review_id and r.status in('pending','assigned') and a.status='submitted'
      and dm_private.drawing_upload_cutoff(a)<=clock_timestamp() for update of r;
  if not found then raise exception 'Review evidence is not ready for advisory scoring'; end if;
  perform dm_private.validate_drawing_marks(p_criterion_marks,p_comments,p_proposed_score,max_score);
  if coalesce(char_length(btrim(p_provider)),0) not between 2 and 80
    or coalesce(char_length(btrim(p_model)),0) not between 2 and 120
    or coalesce(char_length(btrim(p_rubric_version)),0) not between 1 and 80 then
    raise exception 'Invalid model provenance';
  end if;
  if p_confidence is null or p_confidence not between 0 and 1 or jsonb_typeof(p_evidence) is distinct from 'array'
    or octet_length(p_evidence::text)>8192 then raise exception 'Invalid AI suggestion'; end if;
  insert into dm_private.drawing_ai_suggestions(review_id,provider,model,rubric_version,criterion_marks,comments,proposed_score,confidence,evidence)
    values(p_review_id,btrim(p_provider),btrim(p_model),btrim(p_rubric_version),p_criterion_marks,btrim(p_comments),p_proposed_score,p_confidence,p_evidence)
    returning id into suggestion_id;
  return suggestion_id;
end $$;

revoke all on function dm_private.drawing_upload_cutoff(dm_private.attempts),
  dm_private.validate_drawing_marks(jsonb,text,numeric,numeric) from public,anon,authenticated;
revoke all on function public.register_drawing_upload(uuid,uuid,uuid,text,integer,text,integer),
  public.remove_drawing_upload(uuid,uuid) from public,anon,authenticated;
grant execute on function public.register_drawing_upload(uuid,uuid,uuid,text,integer,text,integer),
  public.remove_drawing_upload(uuid,uuid) to service_role;
revoke all on function public.can_upload_drawing(uuid,uuid,integer),public.admin_claim_drawing_review(uuid),
  public.admin_return_drawing_review(uuid,integer),public.admin_review_drawing(uuid,integer,jsonb,text,numeric,text),
  public.admin_release_drawing_review(uuid,integer) from public,anon;
grant execute on function public.can_upload_drawing(uuid,uuid,integer),public.admin_claim_drawing_review(uuid),
  public.admin_return_drawing_review(uuid,integer),public.admin_review_drawing(uuid,integer,jsonb,text,numeric,text),
  public.admin_release_drawing_review(uuid,integer) to authenticated;

commit;
