create table dm_private.all_india_events (
  id uuid primary key default gen_random_uuid(),
  exam text not null check(exam in ('uceed','nid','nift','ceed')),
  title text not null check(char_length(title) between 5 and 140),
  paper_id uuid not null unique references dm_private.papers(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  review_ends_at timestamptz not null,
  results_released_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check(ends_at=starts_at+interval '10 days'),
  check(review_ends_at=ends_at+interval '10 days')
);
create table dm_private.all_india_attempts (
  event_id uuid not null references dm_private.all_india_events(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null unique references dm_private.attempts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(event_id,user_id)
);
create table dm_private.all_india_results (
  event_id uuid not null references dm_private.all_india_events(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null unique references dm_private.attempts(id),
  score numeric not null,total numeric not null,elapsed_seconds integer not null,
  rank integer not null check(rank>0),alias text not null,
  primary key(event_id,user_id)
);
alter table dm_private.all_india_events enable row level security;
alter table dm_private.all_india_attempts enable row level security;
alter table dm_private.all_india_results enable row level security;
revoke all on dm_private.all_india_events,dm_private.all_india_attempts,dm_private.all_india_results from anon,authenticated;

create or replace function public.admin_create_all_india_event(p_exam text,p_title text,p_starts_at timestamptz,p_question_count integer,p_duration_seconds integer)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_event uuid:=gen_random_uuid();v_paper uuid;v_question_id uuid;v_question record;v_ordinal integer:=0;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  if lower(p_exam) not in ('uceed','nid','nift','ceed') or char_length(trim(p_title)) not between 5 and 140 or p_starts_at<=now() or p_question_count not between 10 and 100 or p_duration_seconds not between 900 and 21600 then raise exception 'Invalid event configuration'; end if;
  if exists(select 1 from dm_private.all_india_events where exam=lower(p_exam) and tstzrange(starts_at,review_ends_at,'[]')&&tstzrange(p_starts_at,p_starts_at+interval '20 days','[]')) then raise exception 'An event already overlaps this review cycle'; end if;
  if (select count(*) from dm_private.bank_questions where exam=lower(p_exam) and active and owner_approved and rights_confirmed and runtime_payload is not null)<p_question_count then raise exception 'Not enough reviewed questions for this event'; end if;
  insert into dm_private.papers(title,exam,duration_seconds,published,reviewed,rights_confirmed,source_kind) values(trim(p_title),lower(p_exam),p_duration_seconds,false,true,true,'all_india') returning id into v_paper;
  for v_question in select * from dm_private.bank_questions where exam=lower(p_exam) and active and owner_approved and rights_confirmed and runtime_payload is not null order by md5(external_key||v_event::text) limit p_question_count loop
    v_ordinal:=v_ordinal+1;
    insert into dm_private.questions(paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed) values(v_paper,v_ordinal,v_question.runtime_payload->>'prompt',v_question.runtime_payload->'options',v_question.runtime_payload->>'kind',v_question.runtime_payload->'marking',v_question.runtime_payload->'media',(v_question.runtime_payload->>'points')::numeric,(v_question.runtime_payload->>'negativePoints')::numeric,v_question.topic,true) returning id into v_question_id;
    insert into dm_private.answer_keys(question_id,key,explanation) values(v_question_id,v_question.runtime_payload->'key',v_question.runtime_payload->>'explanation');
  end loop;
  insert into dm_private.all_india_events(id,exam,title,paper_id,starts_at,ends_at,review_ends_at,created_by) values(v_event,lower(p_exam),trim(p_title),v_paper,p_starts_at,p_starts_at+interval '10 days',p_starts_at+interval '20 days',auth.uid());
  return v_event;
end $$;

create or replace function public.admin_all_india_events()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'exam',e.exam,'title',e.title,'startsAt',e.starts_at,'endsAt',e.ends_at,'reviewEndsAt',e.review_ends_at,'resultsReleasedAt',e.results_released_at,'attempts',(select count(*) from dm_private.all_india_attempts a where a.event_id=e.id)) order by e.starts_at desc),'[]'::jsonb) from dm_private.all_india_events e);
end $$;

create or replace function public.all_india_event_catalog()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'exam',e.exam,'title',e.title,'startsAt',e.starts_at,'endsAt',e.ends_at,'reviewEndsAt',e.review_ends_at,'durationSeconds',p.duration_seconds,'state',case when e.results_released_at is not null then 'released' when now()<e.starts_at then 'scheduled' when now()<e.ends_at then 'open' else 'review' end,'attemptId',(select a.attempt_id from dm_private.all_india_attempts a where a.event_id=e.id and a.user_id=auth.uid()),'result',(select jsonb_build_object('score',r.score,'total',r.total,'rank',r.rank,'alias',r.alias) from dm_private.all_india_results r where r.event_id=e.id and r.user_id=auth.uid() and e.results_released_at is not null)) order by e.starts_at desc),'[]'::jsonb) from dm_private.all_india_events e join dm_private.papers p on p.id=e.paper_id where e.starts_at>now()-interval '90 days');
end $$;

create or replace function public.start_all_india_attempt(p_event_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_event dm_private.all_india_events;v_paper dm_private.papers;v_attempt uuid;v_mode text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_event_id::text,3));
  if exists(select 1 from dm_private.all_india_attempts where event_id=p_event_id and user_id=auth.uid()) then raise exception 'This All India mock can only be attempted once'; end if;
  select * into v_event from dm_private.all_india_events where id=p_event_id and now()>=starts_at and now()<ends_at and results_released_at is null;
  if v_event.id is null then raise exception 'This All India mock is not open'; end if;
  select * into v_paper from dm_private.papers where id=v_event.paper_id;
  select environment_mode into v_mode from public.launch_settings where singleton;
  if not exists(select 1 from dm_private.passes where user_id=auth.uid() and mode=v_mode and expires_at>now()) then raise exception 'An active pass is required'; end if;
  if not exists(select 1 from public.profiles where user_id=auth.uid() and onboarding_completed_at is not null) then raise exception 'Complete your verified profile first'; end if;
  insert into dm_private.attempts(user_id,paper_id,deadline) values(auth.uid(),v_paper.id,least(now()+make_interval(secs=>v_paper.duration_seconds),v_event.ends_at)) returning id into v_attempt;
  insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
  select v_attempt,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=v_paper.id;
  insert into dm_private.all_india_attempts(event_id,user_id,attempt_id) values(p_event_id,auth.uid(),v_attempt);
  return v_attempt;
end $$;

create or replace function public.admin_release_all_india_results(p_event_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_event dm_private.all_india_events;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  select * into v_event from dm_private.all_india_events where id=p_event_id for update;
  if v_event.id is null or v_event.results_released_at is not null then raise exception 'Event unavailable'; end if;
  if now()<v_event.review_ends_at then raise exception 'The review window has not ended'; end if;
  update dm_private.attempts a set status='submitted',submitted_at=now(),score=(select coalesce(sum(g.marks),0) from dm_private.attempt_items i cross join lateral dm_private.score_response(i.kind,i.key,i.answer,i.marking) g where i.attempt_id=a.id),total=(select coalesce(sum(case when kind='drawing' or key->>'kind'='dropped' then 0 else (marking->>'correct')::numeric end),0) from dm_private.attempt_items where attempt_id=a.id) where a.id in(select attempt_id from dm_private.all_india_attempts where event_id=p_event_id) and a.status='active';
  insert into dm_private.all_india_results(event_id,user_id,attempt_id,score,total,elapsed_seconds,rank,alias)
  select p_event_id,x.user_id,x.attempt_id,x.score,x.total,x.elapsed_seconds,rank() over(order by x.score desc,x.elapsed_seconds asc), 'Candidate-'||upper(substr(md5(x.user_id::text||p_event_id::text),1,6)) from (select ai.user_id,a.id attempt_id,a.score,a.total,greatest(0,extract(epoch from(coalesce(a.submitted_at,now())-a.started_at))::integer) elapsed_seconds from dm_private.all_india_attempts ai join dm_private.attempts a on a.id=ai.attempt_id where ai.event_id=p_event_id) x;
  update dm_private.all_india_events set results_released_at=now() where id=p_event_id;
end $$;

create or replace function public.public_all_india_top_ten()
returns jsonb language sql stable security definer set search_path=pg_catalog,dm_private as $$
select coalesce(jsonb_agg(event order by released_at desc),'[]'::jsonb) from (select e.results_released_at released_at,jsonb_build_object('eventId',e.id,'exam',e.exam,'title',e.title,'releasedAt',e.results_released_at,'topTen',(select coalesce(jsonb_agg(jsonb_build_object('rank',r.rank,'alias',r.alias,'score',r.score,'total',r.total) order by r.rank,r.elapsed_seconds),'[]'::jsonb) from dm_private.all_india_results r where r.event_id=e.id and r.rank<=10)) event from dm_private.all_india_events e where e.results_released_at is not null order by e.results_released_at desc limit 8) released;
$$;

revoke all on function public.admin_create_all_india_event(text,text,timestamptz,integer,integer),public.admin_all_india_events(),public.all_india_event_catalog(),public.start_all_india_attempt(uuid),public.admin_release_all_india_results(uuid) from public,anon;
grant execute on function public.admin_create_all_india_event(text,text,timestamptz,integer,integer),public.admin_all_india_events(),public.all_india_event_catalog(),public.start_all_india_attempt(uuid),public.admin_release_all_india_results(uuid) to authenticated;
grant execute on function public.public_all_india_top_ten() to anon,authenticated;
