-- Dedicated fixed-paper release fixtures. Disposable database only; all writes roll back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.release_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.release_reject(statement text,label text) returns void language plpgsql as $$
begin begin execute statement; exception when others then return; end; raise exception 'FAIL, unexpectedly allowed: %',label; end $$;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000041'),('00000000-0000-4000-8000-000000000042'),('00000000-0000-4000-8000-000000000043');
insert into dm_private.admins(user_id) values('00000000-0000-4000-8000-000000000043');
insert into dm_private.papers(id,title,exam,duration_seconds,source_kind) values('10000000-0000-4000-8000-000000000041','Sealed release fixture','uceed',900,'all_india'),('10000000-0000-4000-8000-000000000042','Ordinary practice fixture','uceed',900,'catalogue');
insert into dm_private.all_india_events(id,exam,title,paper_id,starts_at,ends_at,review_ends_at,created_by) values('30000000-0000-4000-8000-000000000041','uceed','Sealed release fixture','10000000-0000-4000-8000-000000000041',now()-interval '21 days',now()-interval '11 days',now()-interval '1 day','00000000-0000-4000-8000-000000000043');
insert into dm_private.attempts(id,user_id,paper_id,started_at,deadline) values
('40000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000041','10000000-0000-4000-8000-000000000041',now()-interval '20 minutes',now()-interval '5 minutes'),
('40000000-0000-4000-8000-000000000042','00000000-0000-4000-8000-000000000042','10000000-0000-4000-8000-000000000041',now()-interval '20 minutes',now()-interval '5 minutes'),
('40000000-0000-4000-8000-000000000043','00000000-0000-4000-8000-000000000041','10000000-0000-4000-8000-000000000042',now()-interval '20 minutes',now()-interval '5 minutes');
insert into dm_private.all_india_attempts(event_id,user_id,attempt_id) values
('30000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000041','40000000-0000-4000-8000-000000000041'),
('30000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000042','40000000-0000-4000-8000-000000000042');
-- Original fixture questions live only in this rolled-back transaction.
insert into dm_private.questions(paper_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,reviewed)
select id,1,'Original release fixture','[{"id":"A","label":"A"},{"id":"B","label":"B"}]',4,1,case when source_kind='all_india' then 'sealed-topic' else 'ordinary-topic' end,'mcq','{"correct":4,"wrong":-1}','[]',true from dm_private.papers;
insert into dm_private.answer_keys(question_id,key,explanation) select id,'{"kind":"mcq","correct":["B"]}','Private fixture explanation' from dm_private.questions;
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation,answer)
select a.id,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation,'"B"'::jsonb from dm_private.attempts a join dm_private.questions q on q.paper_id=a.paper_id join dm_private.answer_keys k on k.question_id=q.id;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000041',true);
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.release_reject('select public.admin_release_all_india_results(''30000000-0000-4000-8000-000000000041'')','student cannot release event results');
select pg_temp.release_reject('select public.read_attempt(''40000000-0000-4000-8000-000000000042'')','pending attempt remains private to its owner');
select pg_temp.release_assert((public.submit_attempt('40000000-0000-4000-8000-000000000041')->>'resultsPending')::boolean,'submission declares pending release');
select pg_temp.release_assert(public.read_attempt('40000000-0000-4000-8000-000000000041')->'score'='null'::jsonb,'pending score withheld');
select pg_temp.release_assert(public.read_attempt('40000000-0000-4000-8000-000000000041')->'total'='null'::jsonb,'pending total withheld');
select pg_temp.release_assert(public.read_attempt('40000000-0000-4000-8000-000000000041')->'questions'='[]'::jsonb,'pending keys explanations and correctness withheld');
select pg_temp.release_assert((select value->'score'='null'::jsonb and (value->>'resultsPending')::boolean from jsonb_array_elements(public.my_attempt_history()) where value->>'id'='40000000-0000-4000-8000-000000000041'),'history does not leak pending marks');
select pg_temp.release_assert(not exists(select 1 from jsonb_array_elements(public.my_overview_analytics()->'topics') where value->>'topic'='sealed-topic'),'overview does not leak pending correctness');
select pg_temp.release_assert(public.public_all_india_top_ten()='[]'::jsonb,'rank withheld before explicit release despite elapsed review window');
select pg_temp.release_assert(public.submit_attempt('40000000-0000-4000-8000-000000000043')->'questions'->0 ? 'correctKey','ordinary practice still releases feedback immediately');
reset role;
select pg_temp.release_assert((select submitted_at=deadline from dm_private.attempts where id='40000000-0000-4000-8000-000000000041'),'late client submission time capped at server deadline');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000043',true);
select public.admin_release_all_india_results('30000000-0000-4000-8000-000000000041');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000041',true);
select pg_temp.release_assert(not (public.read_attempt('40000000-0000-4000-8000-000000000041')->>'resultsPending')::boolean,'released result no longer pending');
select pg_temp.release_assert((public.read_attempt('40000000-0000-4000-8000-000000000041')->>'score')::numeric=4,'released score visible');
select pg_temp.release_assert((select (value->>'score')::numeric=4 and not (value->>'resultsPending')::boolean from jsonb_array_elements(public.my_attempt_history()) where value->>'id'='40000000-0000-4000-8000-000000000041'),'history releases marks with the event');
select pg_temp.release_assert(public.read_attempt('40000000-0000-4000-8000-000000000041')->'questions'->0->>'explanation'='Private fixture explanation','keys and explanation available after explicit release');
select pg_temp.release_assert(exists(select 1 from jsonb_array_elements(public.my_overview_analytics()->'topics') where value->>'topic'='sealed-topic' and (value->>'correct')::integer=1),'released correctness participates in analytics');
reset role;
select pg_temp.release_assert((select bool_and(elapsed_seconds=900 and rank=1) and count(*)=2 from dm_private.all_india_results),'same-duration late and offline submissions tie fairly');
select pg_temp.release_assert((select submitted_at=deadline and status='submitted' from dm_private.attempts where id='40000000-0000-4000-8000-000000000042'),'offline attempt finalized at its server deadline');
rollback;
\echo 'PASS: All India result embargo, ordinary feedback and deadline-based ranking.'
