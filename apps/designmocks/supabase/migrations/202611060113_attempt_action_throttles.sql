create table dm_private.attempt_rate_buckets(
  user_id uuid not null references auth.users(id)on delete cascade,
  action text not null check(action in('autosave','submit')),
  window_start timestamptz not null,
  action_count integer not null check(action_count>0),
  primary key(user_id,action,window_start)
);
alter table dm_private.attempt_rate_buckets enable row level security;
revoke all on dm_private.attempt_rate_buckets from anon,authenticated;

create or replace function dm_private.consume_attempt_rate(p_user uuid,p_action text,p_limit integer,p_window interval)returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_start timestamptz;v_count integer;
begin
  if p_user is null or p_action not in('autosave','submit')or p_limit<1 or p_window<=interval'0 seconds'then raise exception'Invalid attempt rate rule';end if;
  v_start:=date_bin(p_window,clock_timestamp(),timestamptz'2000-01-01');
  insert into dm_private.attempt_rate_buckets(user_id,action,window_start,action_count)values(p_user,p_action,v_start,1)
  on conflict(user_id,action,window_start)do update set action_count=dm_private.attempt_rate_buckets.action_count+1 where dm_private.attempt_rate_buckets.action_count<p_limit
  returning action_count into v_count;
  if v_count is null then raise exception'Too many attempt actions. Please retry after the rate window';end if;
end$$;
revoke all on function dm_private.consume_attempt_rate(uuid,text,integer,interval)from public,anon,authenticated;

create or replace function dm_private.limit_attempt_starts()returns trigger language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('attempt-start:'||new.user_id::text,0));
  if(select count(*)from dm_private.attempts where user_id=new.user_id and started_at>now()-interval'1 hour')>=10 then raise exception'Too many attempts started. Please try again later';end if;
  return new;
end$$;
create trigger limit_attempt_starts before insert on dm_private.attempts for each row execute function dm_private.limit_attempt_starts();

create or replace function public.save_answer_revision(p_attempt_id uuid,p_question_id uuid,p_answer jsonb,p_revision bigint)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare a dm_private.attempts;i dm_private.attempt_items;
begin
  select*into a from dm_private.attempts where id=p_attempt_id and user_id=auth.uid()for update;
  if a.id is null or a.status<>'active'or a.deadline<=now()then raise exception'Answer window closed';end if;
  select*into i from dm_private.attempt_items where attempt_id=a.id and question_id=p_question_id for update;
  if i.question_id is null then raise exception'Question not in attempt';end if;
  if p_revision<=i.answer_revision then return jsonb_build_object('accepted',false,'revision',i.answer_revision);end if;
  perform dm_private.consume_attempt_rate(auth.uid(),'autosave',120,interval'1 minute');
  perform public.save_answer(p_attempt_id,p_question_id,p_answer);
  update dm_private.attempt_items set answer_revision=p_revision,answered_at=now()where attempt_id=p_attempt_id and question_id=p_question_id;
  return jsonb_build_object('accepted',true,'revision',p_revision,'serverNow',now());
end$$;
revoke all on function public.save_answer(uuid,uuid,jsonb)from public,anon,authenticated;
revoke all on function public.save_answer_revision(uuid,uuid,jsonb,bigint)from public,anon;
grant execute on function public.save_answer_revision(uuid,uuid,jsonb,bigint)to authenticated;

create or replace function public.submit_attempt(p_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_finalized boolean;
begin
  if not exists(select 1 from dm_private.attempts where id=p_id and user_id=auth.uid())then raise exception'Attempt not found';end if;
  v_finalized:=dm_private.finalize_attempt(p_id);
  if v_finalized then perform dm_private.consume_attempt_rate(auth.uid(),'submit',10,interval'1 hour');end if;
  return public.read_attempt(p_id);
end$$;

create or replace function public.prune_attempt_rate_buckets(p_before timestamptz default now()-interval'2 days')returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_count integer;
begin
  if auth.role()is distinct from'service_role'then raise exception'Forbidden';end if;
  if p_before>now()-interval'1 hour'then raise exception'Unsafe retention boundary';end if;
  delete from dm_private.attempt_rate_buckets where window_start<p_before;
  get diagnostics v_count=row_count;
  return v_count;
end$$;
revoke all on function public.prune_attempt_rate_buckets(timestamptz)from public,anon,authenticated;
grant execute on function public.prune_attempt_rate_buckets(timestamptz)to service_role;
