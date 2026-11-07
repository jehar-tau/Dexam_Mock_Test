\set ON_ERROR_STOP on
begin;
create function pg_temp.overview_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
create function pg_temp.overview_reject(statement text,expected text) returns void language plpgsql as $$
begin begin execute statement;exception when others then if position(expected in sqlerrm)>0 then return;end if;raise;end;
raise exception 'FAIL, expected error: %',expected;end $$;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000291'),('00000000-0000-4000-8000-000000000292');
insert into dm_private.papers(id,title,exam,duration_seconds,source_kind) values
  ('10000000-0000-4000-8000-000000000291','Fictional ordinary score fixtures','uceed',900,'catalogue'),
  ('10000000-0000-4000-8000-000000000292','Fictional other student paper','ceed',900,'catalogue');
insert into dm_private.attempts(user_id,paper_id,status,started_at,deadline,submitted_at,score,total) values
  ('00000000-0000-4000-8000-000000000291','10000000-0000-4000-8000-000000000291','submitted',now()-interval '1 hour',now()-interval '45 minutes',now()-interval '45 minutes',4,4),
  ('00000000-0000-4000-8000-000000000291','10000000-0000-4000-8000-000000000291','submitted',now()-interval '1 hour',now()-interval '45 minutes',now()-interval '45 minutes',-1,4),
  ('00000000-0000-4000-8000-000000000291','10000000-0000-4000-8000-000000000291','submitted',now()-interval '1 hour',now()-interval '45 minutes',now()-interval '45 minutes',0,4),
  ('00000000-0000-4000-8000-000000000291','10000000-0000-4000-8000-000000000291','submitted',now()-interval '1 hour',now()-interval '45 minutes',now()-interval '45 minutes',0,0),
  ('00000000-0000-4000-8000-000000000291','10000000-0000-4000-8000-000000000291','active',now(),now()+interval '15 minutes',null,99,100),
  ('00000000-0000-4000-8000-000000000292','10000000-0000-4000-8000-000000000292','submitted',now()-interval '1 hour',now()-interval '45 minutes',now()-interval '45 minutes',0,10);
set local role anon;
select pg_temp.overview_reject('select public.my_overview_analytics()','permission denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.overview_reject('select public.my_overview_analytics()','Sign in required');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000291',true);
select pg_temp.overview_assert(public.my_overview_analytics()->'exams'=
  '[{"exam":"uceed","attempts":3,"averagePercent":25,"bestPercent":100}]'::jsonb,
  'ordinary positive, negative and zero scores remain exact; active and zero-total rows do not enter averages');
select pg_temp.overview_assert(public.my_overview_analytics()->'objectiveAccuracy'='null'::jsonb,
  'an exam percentage does not invent objective accuracy when there are no answered items');
select pg_temp.overview_reject('select dm_private.student_attempt_visibility(auth.uid())','permission denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000292',true);
select pg_temp.overview_assert(public.my_overview_analytics()->'exams'=
  '[{"exam":"ceed","attempts":1,"averagePercent":0,"bestPercent":0}]'::jsonb,
  'another account gets only its own zero result, without the first account scores');
reset role;
rollback;
\echo 'PASS: released Overview percentages, ordinary negative/zero scores, zero-total exclusion, private helpers and account isolation.'
