begin;

-- Only the original attempt snapshot defines how an authored task is marked.
-- A missing or malformed authored rubric cannot fall back to free-form marks.
create function dm_private.frozen_drawing_rubric(p_key jsonb)
returns jsonb language sql immutable set search_path=pg_catalog as $$
  select case when p_key#>>'{practiceContext,scope}'='authored-practice'
      or p_key#>>'{practiceContext,version}'='nid-authored-practice-v1' then
    case when p_key#>>'{practiceContext,version}'='nid-authored-practice-v1'
      and p_key->>'kind'='drawing'
      and p_key#>>'{practiceContext,scope}'='authored-practice'
      and p_key#>>'{practiceContext,exam}'='nid'
      and p_key#>>'{practiceContext,responseKind}' in ('drawing','written')
      and jsonb_typeof(p_key#>'{practiceContext,rubric}')='array'
    then p_key#>'{practiceContext,rubric}' else '[]'::jsonb end
  end
$$;

create function dm_private.validate_drawing_marks(
  criteria jsonb,feedback text,score numeric,max_score numeric,rubric jsonb
) returns void language plpgsql immutable set search_path=pg_catalog as $$
declare
  criterion jsonb;
  label text;
  maximum numeric;
  rubric_total numeric:=0;
  labels text[]:='{}';
  label_limit integer:=case when rubric is null then 80 else 120 end;
begin
  if jsonb_typeof(criteria) is distinct from 'object' or criteria='{}'::jsonb then
    raise exception 'Provide between 1 and 12 scoring criteria';
  end if;
  if (select count(*) from jsonb_each(criteria))>12 or exists(
    select 1 from jsonb_each(criteria) e where char_length(btrim(e.key)) not between 2 and label_limit
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
  if rubric is null then return; end if;

  if jsonb_typeof(rubric) is distinct from 'array' or jsonb_array_length(rubric) not between 1 and 12 then
    raise exception 'The frozen practice rubric is unavailable' using errcode='22023';
  end if;
  for criterion in select value from jsonb_array_elements(rubric) loop
    label:=criterion->>'label';
    if jsonb_typeof(criterion->'label') is distinct from 'string' or char_length(label) not between 3 and 120
      or label<>btrim(label) or lower(label)=any(labels)
      or jsonb_typeof(criterion->'points') is distinct from 'number'
      or jsonb_typeof(criterion->'guidance') is distinct from 'string'
      or char_length(btrim(criterion->>'guidance')) not between 10 and 1000 then
      raise exception 'The frozen practice rubric is unavailable' using errcode='22023';
    end if;
    maximum:=(criterion->>'points')::numeric;
    if maximum not between 0.01 and 100 or scale(trim_scale(maximum))>2 then
      raise exception 'The frozen practice rubric is unavailable' using errcode='22023';
    end if;
    if not (criteria ? label) then
      raise exception 'Use every frozen criterion' using errcode='22023';
    end if;
    if (criteria->>label)::numeric>maximum then
      raise exception 'A mark exceeds its frozen criterion maximum' using errcode='22023';
    end if;
    labels:=array_append(labels,lower(label));
    rubric_total:=rubric_total+maximum;
  end loop;
  if rubric_total<>max_score then
    raise exception 'The frozen practice rubric is unavailable' using errcode='22023';
  end if;
  if cardinality(labels)<>(select count(*) from jsonb_each(criteria)) then
    raise exception 'Use every frozen criterion' using errcode='22023';
  end if;
end $$;

create or replace function dm_private.validate_drawing_marks(
  criteria jsonb,feedback text,score numeric,max_score numeric
) returns void language sql immutable set search_path=pg_catalog,dm_private as $$
  select dm_private.validate_drawing_marks(criteria,feedback,score,max_score,null::jsonb)
$$;

create or replace function dm_private.drawing_review_cards(p_scope text,p_after uuid,p_limit integer,p_admin boolean)
returns table(review_id uuid,review_status text,card jsonb)
language sql stable set search_path=pg_catalog,dm_private as $$
  with page as materialized (
    select r.*,i.prompt,i.points,e.title as cohort_title,e.results_released_at as cohort_released_at,
      state.upload_closed,state.can_open,
      case when state.can_open then dm_private.frozen_drawing_rubric(i.key) end as rubric
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
    'maxScore',r.points,'rubric',r.rubric,'criteria',case when p_admin or r.can_open then r.criterion_marks end,
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

create or replace function public.admin_review_drawing(
  p_review_id uuid,p_expected_version integer,p_criterion_marks jsonb,p_comments text,
  p_score numeric,p_override_reason text default null
) returns void language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare
  reviewer_is_admin boolean:=dm_private.lock_drawing_reviewer();
  review dm_private.drawing_reviews;
  max_score numeric;
  frozen_rubric jsonb;
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
  select i.points,dm_private.frozen_drawing_rubric(i.key) into max_score,frozen_rubric
    from dm_private.attempt_items i where i.attempt_id=review.attempt_id
      and i.question_id=review.question_id and i.kind='drawing';
  perform dm_private.validate_drawing_marks(p_criterion_marks,p_comments,p_score,max_score,frozen_rubric);
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
  released dm_private.drawing_reviews;
  max_score numeric;
  frozen_rubric jsonb;
begin
  update dm_private.drawing_reviews r set status='released',released_at=now(),review_version=r.review_version+1
    from dm_private.attempts a where r.id=p_review_id and a.id=r.attempt_id and a.user_id<>auth.uid()
      and a.status='submitted' and dm_private.drawing_upload_cutoff(a)<=clock_timestamp()
      and r.status='reviewed' and r.score is not null and r.comments is not null and r.review_version=p_expected_version
      and (reviewer_is_admin or r.reviewer_id=auth.uid())
    returning r.* into released;
  if not found then raise exception 'Review is not ready for release or has changed. Refresh the queue.'; end if;
  select i.points,dm_private.frozen_drawing_rubric(i.key) into max_score,frozen_rubric
    from dm_private.attempt_items i where i.attempt_id=released.attempt_id and i.question_id=released.question_id;
  if frozen_rubric is not null then
    perform dm_private.validate_drawing_marks(released.criterion_marks,released.comments,released.score,max_score,frozen_rubric);
  end if;
  insert into dm_private.drawing_review_audit(review_id,actor_id,action) values(p_review_id,auth.uid(),'release');
end $$;

create or replace function public.record_drawing_ai_suggestion(
  p_review_id uuid,p_provider text,p_model text,p_rubric_version text,p_criterion_marks jsonb,
  p_comments text,p_proposed_score numeric,p_confidence numeric,p_evidence jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  suggestion_id uuid;
  max_score numeric;
  frozen_rubric jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  -- Any upload that acquired the attempt lock before cutoff must commit first.
  perform 1 from dm_private.attempts a join dm_private.drawing_reviews r on r.attempt_id=a.id
    where r.id=p_review_id for update of a;
  select i.points,dm_private.frozen_drawing_rubric(i.key) into max_score,frozen_rubric
    from dm_private.drawing_reviews r
    join dm_private.attempt_items i on i.attempt_id=r.attempt_id and i.question_id=r.question_id
    join dm_private.attempts a on a.id=r.attempt_id
    where r.id=p_review_id and r.status in('pending','assigned') and a.status='submitted'
      and dm_private.drawing_upload_cutoff(a)<=clock_timestamp() for update of r;
  if not found then raise exception 'Review evidence is not ready for advisory scoring'; end if;
  perform dm_private.validate_drawing_marks(p_criterion_marks,p_comments,p_proposed_score,max_score,frozen_rubric);
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

revoke all on function dm_private.frozen_drawing_rubric(jsonb),
  dm_private.validate_drawing_marks(jsonb,text,numeric,numeric,jsonb) from public,anon,authenticated,service_role;

commit;
