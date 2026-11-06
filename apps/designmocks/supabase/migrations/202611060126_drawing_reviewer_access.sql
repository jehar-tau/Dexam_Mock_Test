begin;

create table dm_private.drawing_reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null,
  changed_at timestamptz not null
);

create table dm_private.drawing_reviewer_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  actor_id uuid not null,
  enabled boolean not null,
  reason text not null check(char_length(reason) between 5 and 400),
  changed_at timestamptz not null
);

alter table dm_private.drawing_reviewers enable row level security;
alter table dm_private.drawing_reviewer_audit enable row level security;
revoke all on dm_private.drawing_reviewers,dm_private.drawing_reviewer_audit from public,anon,authenticated;

create index drawing_reviews_assignee_status_idx on dm_private.drawing_reviews(reviewer_id,status,id)
  where status in('assigned','reviewed');
create index drawing_reviews_pending_idx on dm_private.drawing_reviews(id) where status='pending';

create function public.can_review_drawings()
returns boolean language sql stable security definer set search_path=pg_catalog,public,dm_private as $$
  select public.is_dmocks_admin() or exists(
    select 1 from dm_private.drawing_reviewers where user_id=auth.uid() and enabled
  )
$$;

create function public.admin_drawing_reviewers()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('userId',user_id,'grantedAt',changed_at) order by changed_at desc,user_id),'[]')
    from dm_private.drawing_reviewers where enabled
  );
end $$;

create function public.admin_set_drawing_reviewer(p_user_id uuid,p_enabled boolean,p_reason text)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare
  v_changed_at timestamptz:=clock_timestamp();
  v_reason text:=btrim(p_reason);
  target_is_admin boolean;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_enabled is null or v_reason is null or char_length(v_reason) not between 5 and 400 then
    raise exception 'Give a reason between 5 and 400 characters';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Existing account required'; end if;
  select exists(select 1 from dm_private.admins where user_id=p_user_id) into target_is_admin;
  if p_enabled then
    if target_is_admin then raise exception 'This account already has administrator review access'; end if;
    insert into dm_private.drawing_reviewers as membership(user_id,enabled,changed_at)
      values(p_user_id,true,v_changed_at)
      on conflict(user_id) do update set enabled=true,changed_at=excluded.changed_at where not membership.enabled;
  else
    update dm_private.drawing_reviewers set enabled=false,changed_at=v_changed_at
      where user_id=p_user_id and enabled;
  end if;
  if not found then return false; end if;

  insert into dm_private.drawing_reviewer_audit(user_id,actor_id,enabled,reason,changed_at)
    values(p_user_id,auth.uid(),p_enabled,v_reason,v_changed_at);
  if not p_enabled and not target_is_admin then
    with returned as (
      update dm_private.drawing_reviews r set status='pending',reviewer_id=null,review_version=r.review_version+1
      where r.reviewer_id=p_user_id and r.status='assigned' and not exists(
        select 1 from dm_private.all_india_attempts ai join dm_private.all_india_events e on e.id=ai.event_id
        where ai.attempt_id=r.attempt_id and e.results_released_at is not null
      )
      returning r.id
    )
    insert into dm_private.drawing_review_audit(review_id,actor_id,action,payload)
      select id,auth.uid(),'reviewer_access_revoked',jsonb_build_object('reviewerId',p_user_id,'reason',v_reason) from returned;
  end if;
  return true;
end $$;

-- A grading mutation holds the role row before it touches an attempt or review.
-- Revocation uses the same order so it also returns any claim made in flight.
create function dm_private.lock_drawing_reviewer()
returns boolean language plpgsql set search_path=pg_catalog,public,dm_private as $$
begin
  if public.is_dmocks_admin() then return true; end if;
  perform 1 from dm_private.drawing_reviewers where user_id=auth.uid() and enabled for share;
  if not found then raise exception 'Drawing reviewer access required' using errcode='42501'; end if;
  return false;
end $$;

create function dm_private.drawing_review_cards(p_scope text,p_after uuid,p_limit integer,p_admin boolean)
returns table(review_id uuid,review_status text,card jsonb)
language sql stable set search_path=pg_catalog,dm_private as $$
  with page as materialized (
    select r.*,i.prompt,i.points,e.title as cohort_title,e.results_released_at as cohort_released_at,
      state.upload_closed,state.can_open
    from dm_private.drawing_reviews r
    join dm_private.attempt_items i on i.attempt_id=r.attempt_id and i.question_id=r.question_id
    join dm_private.attempts a on a.id=r.attempt_id
    left join dm_private.all_india_attempts ai on ai.attempt_id=a.id
    left join dm_private.all_india_events e on e.id=ai.event_id
    cross join lateral (
      select a.status='submitted' and dm_private.drawing_upload_cutoff(a)<=statement_timestamp() as upload_closed,
        a.status='submitted' and dm_private.drawing_upload_cutoff(a)<=statement_timestamp() and (
          (r.status in('assigned','reviewed') and r.reviewer_id=auth.uid())
          or (p_admin and r.status in('reviewed','released'))
        ) as can_open
    ) state
    where a.user_id<>auth.uid() and (p_after is null or r.id>p_after) and (
      (p_scope='all' and p_admin)
      or (p_scope='available' and r.status='pending' and state.upload_closed and e.results_released_at is null)
      or (p_scope='mine' and r.status in('assigned','reviewed') and r.reviewer_id=auth.uid() and e.results_released_at is null)
    )
    order by case when p_scope='all' then case r.status when 'pending' then 1 when 'assigned' then 2 when 'reviewed' then 3 else 4 end end,r.id
    limit p_limit
  )
  select r.id,r.status,jsonb_build_object(
    'reviewId',r.id,'version',r.review_version,'prompt',r.prompt,'status',r.status,
    'uploadCount',(select count(*) from dm_private.drawing_uploads u where u.attempt_id=r.attempt_id and u.question_id=r.question_id),
    'maxScore',r.points,'criteria',case when p_admin or r.can_open then r.criterion_marks end,
    'comments',case when p_admin or r.can_open then r.comments end,'score',case when p_admin or r.can_open then r.score end,
    'assignedToMe',coalesce(r.reviewer_id=auth.uid(),false),
    'canClaim',r.status='pending' and r.upload_closed and r.cohort_released_at is null,
    'canReview',coalesce(r.can_open,false),'cohortTitle',r.cohort_title,'cohortFrozen',r.cohort_released_at is not null,
    'aiSuggestion',case when r.can_open then (select jsonb_build_object(
      'provider',s.provider,'model',s.model,'rubricVersion',s.rubric_version,
      'criteria',s.criterion_marks,'comments',s.comments,'proposedScore',s.proposed_score,
      'confidence',s.confidence,'evidence',s.evidence,'createdAt',s.created_at
    ) from dm_private.drawing_ai_suggestions s where s.review_id=r.id order by s.created_at desc,s.id desc limit 1) end
  )
  from page r
$$;

create or replace function public.admin_drawing_queue()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  return (
    select coalesce(jsonb_agg(card order by case review_status when 'pending' then 1 when 'assigned' then 2 when 'reviewed' then 3 else 4 end,review_id),'[]')
    from dm_private.drawing_review_cards('all',null,null,true)
  );
end $$;

create function public.my_drawing_review_page(p_scope text default 'available',p_after uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
begin
  if not public.can_review_drawings() then raise exception 'Drawing reviewer access required' using errcode='42501'; end if;
  if p_scope is null or p_scope not in('available','mine') then raise exception 'Unknown drawing review queue'; end if;
  return (
    with cards as materialized (select * from dm_private.drawing_review_cards(p_scope,p_after,21,false)),
    page as materialized (select * from cards order by review_id limit 20)
    select jsonb_build_object(
      'items',coalesce(jsonb_agg(card order by review_id),'[]'),
      'nextCursor',case when (select count(*) from cards)>20 then (select review_id from page order by review_id desc limit 1) end
    ) from page
  );
end $$;

create or replace function public.admin_claim_drawing_review(p_review_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare
  review dm_private.drawing_reviews;
  attempt dm_private.attempts;
begin
  perform dm_private.lock_drawing_reviewer();
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
  insert into dm_private.drawing_review_audit(review_id,actor_id,action) values(review.id,auth.uid(),'claim');
end $$;

create or replace function public.admin_return_drawing_review(p_review_id uuid,p_expected_version integer)
returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
begin
  perform dm_private.lock_drawing_reviewer();
  update dm_private.drawing_reviews set status='pending',reviewer_id=null,review_version=review_version+1
    where id=p_review_id and status='assigned' and reviewer_id=auth.uid() and review_version=p_expected_version;
  if not found then raise exception 'Review assignment changed. Refresh the queue.'; end if;
  insert into dm_private.drawing_review_audit(review_id,actor_id,action) values(p_review_id,auth.uid(),'return');
end $$;

create or replace function public.admin_drawing_review_media_paths(p_review_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
declare
  review dm_private.drawing_reviews;
begin
  if not public.can_review_drawings() then raise exception 'Drawing reviewer access required' using errcode='42501'; end if;
  select r.* into review from dm_private.drawing_reviews r join dm_private.attempts a on a.id=r.attempt_id
    where r.id=p_review_id and a.user_id<>auth.uid() and a.status='submitted'
      and dm_private.drawing_upload_cutoff(a)<=statement_timestamp();
  if not found then raise exception 'Review unavailable'; end if;
  if review.status='pending' then raise exception 'Claim the review before opening student work'; end if;
  if review.status='assigned' and review.reviewer_id is distinct from auth.uid() then
    raise exception 'Review is assigned to another teacher';
  end if;
  if not public.is_dmocks_admin() and (review.reviewer_id is distinct from auth.uid() or review.status='released') then
    raise exception 'Review unavailable';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',u.id,'ordinal',u.ordinal,'storagePath',u.storage_path,'mimeType',u.mime_type
  ) order by u.ordinal),'[]') from dm_private.drawing_uploads u
    where u.attempt_id=review.attempt_id and u.question_id=review.question_id);
end $$;

create or replace function public.admin_review_drawing(
  p_review_id uuid,p_expected_version integer,p_criterion_marks jsonb,p_comments text,
  p_score numeric,p_override_reason text default null
) returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare
  reviewer_is_admin boolean:=dm_private.lock_drawing_reviewer();
  review dm_private.drawing_reviews;
  max_score numeric;
  action text;
begin
  select r.* into review from dm_private.drawing_reviews r join dm_private.attempts a on a.id=r.attempt_id
    where r.id=p_review_id and a.user_id<>auth.uid() and a.status='submitted'
      and dm_private.drawing_upload_cutoff(a)<=clock_timestamp() for update of r;
  if not found then raise exception 'Review unavailable'; end if;
  if not reviewer_is_admin and review.reviewer_id is distinct from auth.uid() then raise exception 'Review unavailable'; end if;
  if not reviewer_is_admin and review.status='released' then raise exception 'Only an administrator can revise a released grade'; end if;
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

create or replace function public.admin_release_drawing_review(p_review_id uuid,p_expected_version integer)
returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare
  reviewer_is_admin boolean:=dm_private.lock_drawing_reviewer();
begin
  update dm_private.drawing_reviews r set status='released',released_at=now(),review_version=r.review_version+1
    from dm_private.attempts a where r.id=p_review_id and a.id=r.attempt_id and a.user_id<>auth.uid()
      and a.status='submitted' and dm_private.drawing_upload_cutoff(a)<=clock_timestamp()
      and r.status='reviewed' and r.score is not null and r.comments is not null and r.review_version=p_expected_version
      and (reviewer_is_admin or r.reviewer_id=auth.uid());
  if not found then raise exception 'Review is not ready for release or has changed. Refresh the queue.'; end if;
  insert into dm_private.drawing_review_audit(review_id,actor_id,action) values(p_review_id,auth.uid(),'release');
end $$;

revoke all on function dm_private.lock_drawing_reviewer(),dm_private.drawing_review_cards(text,uuid,integer,boolean)
  from public,anon,authenticated;
revoke all on function public.can_review_drawings(),public.admin_drawing_reviewers(),
  public.admin_set_drawing_reviewer(uuid,boolean,text),public.my_drawing_review_page(text,uuid) from public,anon;
grant execute on function public.can_review_drawings(),public.admin_drawing_reviewers(),
  public.admin_set_drawing_reviewer(uuid,boolean,text),public.my_drawing_review_page(text,uuid) to authenticated;

commit;
