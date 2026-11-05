-- Keep fixed-paper keys, scores and derived correctness private until explicit event release.
-- Replacing functions preserves their existing execution grants.

create or replace function public.read_attempt(p_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare a dm_private.attempts; items jsonb; v_pending boolean; v_review_ends_at timestamptz;
begin
  select * into a from dm_private.attempts where id=p_id and user_id=auth.uid();
  if a.id is null then raise exception 'Attempt not found'; end if;
  select e.results_released_at is null,e.review_ends_at into v_pending,v_review_ends_at from dm_private.all_india_attempts ai join dm_private.all_india_events e on e.id=ai.event_id where ai.attempt_id=a.id;
  v_pending:=coalesce(v_pending,false) and a.status='submitted';
  select coalesce(jsonb_agg(jsonb_build_object('id',question_id,'ordinal',ordinal,'prompt',prompt,'options',options,'topic',topic,'answer',answer,'points',points,'negativePoints',negative_points,'marking',marking,'kind',kind,'media',media)
    || case when a.status='submitted' and not v_pending then jsonb_build_object('correctKey',key,'explanation',explanation,'outcome',(select outcome from dm_private.score_response(kind,key,answer,marking))) else '{}'::jsonb end order by ordinal),'[]') into items from dm_private.attempt_items where attempt_id=a.id;
  return jsonb_build_object('title',(select title from dm_private.papers where id=a.paper_id),'id',a.id,'status',a.status,'deadline',a.deadline,'serverNow',now(),'score',case when v_pending then null else a.score end,'total',case when v_pending then null else a.total end,'resultsPending',v_pending,'reviewEndsAt',v_review_ends_at,'questions',case when v_pending then '[]'::jsonb else items end);
end $$;

create or replace function public.submit_attempt(p_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare a dm_private.attempts;
begin
  select * into a from dm_private.attempts where id=p_id and user_id=auth.uid() for update;
  if a.id is null then raise exception 'Attempt not found'; end if;
  if a.status='active' then
    update dm_private.attempts set status='submitted',submitted_at=least(now(),a.deadline),
    score=(select coalesce(sum(g.marks),0) from dm_private.attempt_items i cross join lateral dm_private.score_response(i.kind,i.key,i.answer,i.marking) g where i.attempt_id=a.id),
    total=(select coalesce(sum(case when kind='drawing' or key->>'kind'='dropped' then 0 else (marking->>'correct')::numeric end),0) from dm_private.attempt_items where attempt_id=a.id) where id=a.id;
  end if;
  return public.read_attempt(a.id);
end $$;

create or replace function public.my_attempt_history() returns jsonb language sql stable security definer set search_path=pg_catalog,dm_private as $$
select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',p.title,'status',a.status,'score',case when e.id is not null and e.results_released_at is null then null else a.score end,'total',case when e.id is not null and e.results_released_at is null then null else a.total end,'resultsPending',a.status='submitted' and e.id is not null and e.results_released_at is null,'startedAt',a.started_at) order by a.started_at desc),'[]'::jsonb)
from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id left join dm_private.all_india_attempts ai on ai.attempt_id=a.id left join dm_private.all_india_events e on e.id=ai.event_id where a.user_id=auth.uid();
$$;

create or replace function public.my_overview_analytics() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Sign in required'; end if;
 return jsonb_build_object(
  'activeAttempt',(select jsonb_build_object('id',a.id,'title',p.title,'deadline',a.deadline) from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id where a.user_id=v_user and a.status='active' and a.deadline>now() order by a.started_at desc limit 1),
  'completed',(select count(*) from dm_private.attempts where user_id=v_user and status='submitted'),
  'topics',coalesce((select jsonb_agg(jsonb_build_object('topic',topic,'answered',answered,'correct',correct,'accuracy',case when answered=0 then 0 else round(correct*100.0/answered) end) order by answered desc,topic) from(select i.topic,count(*)filter(where i.answer is not null)answered,count(*)filter(where i.answer is not null and (select outcome from dm_private.score_response(i.kind,i.key,i.answer,i.marking)) in('correct','full_marks'))correct from dm_private.attempt_items i join dm_private.attempts a on a.id=i.attempt_id where a.user_id=v_user and a.status='submitted' and i.kind<>'drawing' and not exists(select 1 from dm_private.all_india_attempts ai join dm_private.all_india_events e on e.id=ai.event_id where ai.attempt_id=a.id and e.results_released_at is null) group by i.topic)t),'[]'::jsonb)
 );
end $$;

create or replace function public.admin_release_all_india_results(p_event_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_event dm_private.all_india_events;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  select * into v_event from dm_private.all_india_events where id=p_event_id for update;
  if v_event.id is null or v_event.results_released_at is not null then raise exception 'Event unavailable'; end if;
  if now()<v_event.review_ends_at then raise exception 'The review window has not ended'; end if;
  update dm_private.attempts a set status='submitted',submitted_at=least(now(),a.deadline),score=(select coalesce(sum(g.marks),0) from dm_private.attempt_items i cross join lateral dm_private.score_response(i.kind,i.key,i.answer,i.marking) g where i.attempt_id=a.id),total=(select coalesce(sum(case when kind='drawing' or key->>'kind'='dropped' then 0 else (marking->>'correct')::numeric end),0) from dm_private.attempt_items where attempt_id=a.id) where a.id in(select attempt_id from dm_private.all_india_attempts where event_id=p_event_id) and a.status='active';
  insert into dm_private.all_india_results(event_id,user_id,attempt_id,score,total,elapsed_seconds,rank,alias)
  select p_event_id,x.user_id,x.attempt_id,x.score,x.total,x.elapsed_seconds,rank() over(order by x.score desc,x.elapsed_seconds asc), 'Candidate-'||upper(substr(md5(x.user_id::text||p_event_id::text),1,6)) from (select ai.user_id,a.id attempt_id,a.score,a.total,greatest(0,extract(epoch from(least(coalesce(a.submitted_at,a.deadline),a.deadline)-a.started_at))::integer) elapsed_seconds from dm_private.all_india_attempts ai join dm_private.attempts a on a.id=ai.attempt_id where ai.event_id=p_event_id) x;
  update dm_private.all_india_events set results_released_at=now() where id=p_event_id;
end $$;
