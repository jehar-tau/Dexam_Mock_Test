create or replace function dm_private.finalize_attempt(p_id uuid)returns boolean language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare a dm_private.attempts;v_grace integer;
begin
  select*into a from dm_private.attempts where id=p_id for update;
  if a.id is null or a.status<>'active'then return false;end if;
  select upload_grace_seconds into v_grace from dm_private.papers where id=a.paper_id;
  update dm_private.attempts set status='submitted',submitted_at=least(now(),a.deadline),
    upload_deadline=case when v_grace>0 and exists(select 1 from dm_private.attempt_items i where i.attempt_id=a.id and i.kind='drawing')then a.deadline+make_interval(secs=>v_grace)else a.upload_deadline end,
    score=(select coalesce(sum(g.marks),0)from dm_private.attempt_items i cross join lateral dm_private.score_response(i.kind,i.key,i.answer,i.marking)g where i.attempt_id=a.id),
    total=(select coalesce(sum(case when kind='drawing'or key->>'kind'='dropped'then 0 else(marking->>'correct')::numeric end),0)from dm_private.attempt_items where attempt_id=a.id)
  where id=a.id;
  return true;
end$$;
revoke all on function dm_private.finalize_attempt(uuid)from public,anon,authenticated;

create or replace function public.submit_attempt(p_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
  if not exists(select 1 from dm_private.attempts where id=p_id and user_id=auth.uid())then raise exception'Attempt not found';end if;
  perform dm_private.finalize_attempt(p_id);
  return public.read_attempt(p_id);
end$$;

create or replace function public.finalize_my_expired_attempts()returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_id uuid;v_count integer:=0;
begin
  if auth.uid()is null then raise exception'Sign in required';end if;
  for v_id in select id from dm_private.attempts where user_id=auth.uid()and status='active'and deadline<=now()order by deadline limit 100
  loop if dm_private.finalize_attempt(v_id)then v_count:=v_count+1;end if;end loop;
  return v_count;
end$$;

create or replace function public.finalize_expired_attempts(p_limit integer default 500)returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_id uuid;v_count integer:=0;
begin
  if auth.role()is distinct from'service_role'then raise exception'Forbidden';end if;
  if p_limit not between 1 and 2000 then raise exception'Invalid batch size';end if;
  for v_id in select id from dm_private.attempts where status='active'and deadline<=now()order by deadline limit p_limit
  loop if dm_private.finalize_attempt(v_id)then v_count:=v_count+1;end if;end loop;
  return v_count;
end$$;

create or replace function public.read_attempt(p_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare a dm_private.attempts;items jsonb;v_pending boolean;v_review_ends_at timestamptz;
begin
  select*into a from dm_private.attempts where id=p_id and user_id=auth.uid();if a.id is null then raise exception'Attempt not found';end if;
  if a.status='active'and a.deadline<=now()then perform dm_private.finalize_attempt(a.id);select*into a from dm_private.attempts where id=a.id;end if;
  select e.results_released_at is null,e.review_ends_at into v_pending,v_review_ends_at from dm_private.all_india_attempts ai join dm_private.all_india_events e on e.id=ai.event_id where ai.attempt_id=a.id;
  v_pending:=coalesce(v_pending,false)and a.status='submitted';
  select coalesce(jsonb_agg(jsonb_build_object('id',i.question_id,'ordinal',i.ordinal,'prompt',i.prompt,'options',i.options,'topic',i.topic,'answer',i.answer,'points',i.points,'negativePoints',i.negative_points,'marking',i.marking,'kind',i.kind,'media',i.media)||case when a.status='submitted'and not v_pending then jsonb_build_object('correctKey',i.key,'explanation',i.explanation,'outcome',(select outcome from dm_private.score_response(i.kind,i.key,i.answer,i.marking)))else'{}'::jsonb end||case when a.status='submitted'and i.kind='drawing'then jsonb_build_object('drawingReview',coalesce((select case when r.status='released'then jsonb_build_object('status','released','criteria',r.criterion_marks,'comments',r.comments,'score',r.score,'maxScore',i.points,'releasedAt',r.released_at)else jsonb_build_object('status','pending')end from dm_private.drawing_reviews r where r.attempt_id=i.attempt_id and r.question_id=i.question_id),jsonb_build_object('status','not_submitted')))else'{}'::jsonb end order by i.ordinal),'[]')into items from dm_private.attempt_items i where i.attempt_id=a.id;
  return jsonb_build_object('title',(select title from dm_private.papers where id=a.paper_id),'id',a.id,'status',a.status,'deadline',a.deadline,'uploadDeadline',a.upload_deadline,'serverNow',now(),'score',case when v_pending then null else a.score end,'total',case when v_pending then null else a.total end,'resultsPending',v_pending,'reviewEndsAt',v_review_ends_at,'questions',case when v_pending then'[]'::jsonb else items end);
end$$;

revoke all on function public.finalize_my_expired_attempts(),public.finalize_expired_attempts(integer)from public,anon;
grant execute on function public.finalize_my_expired_attempts()to authenticated;
grant execute on function public.finalize_expired_attempts(integer)to service_role;
