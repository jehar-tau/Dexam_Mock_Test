\set ON_ERROR_STOP on
begin;
\ir fixtures/release-bank-year.sql
\ir fixtures/released-parallel-questions.sql
create function pg_temp.nift_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception'FAIL: %',label;end if;end$$;
create function pg_temp.nift_reject(statement text,label text)returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception'FAIL, unexpectedly allowed: %',label;end$$;
insert into auth.users(id)values('00000000-0000-4000-8000-000000000101'),('00000000-0000-4000-8000-000000000102');insert into dm_private.admins(user_id)values('00000000-0000-4000-8000-000000000102');
insert into public.profiles(user_id,display_name,phone_e164,phone_verified_at,appearing_year,city,exams,onboarding_completed_at)values('00000000-0000-4000-8000-000000000101','NIFT Student','+919999999101',now(),2027,'Delhi',array['nift'],now());
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,objective_ready,owner_approved,rights_confirmed,active,payload,source_commit)
select 'nift-gat-'||n,md5(n::text)||md5(n::text),'nift','MCQ','nift-gat','owned',false,true,true,true,jsonb_build_object('externalKey','nift-gat-'||n,'prompt','Original NIFT GAT fixture '||n,'holds','[]'::jsonb,'assets','[]'::jsonb,'visualDependency',false,'options','[{"key":"1","text":"One"},{"key":"2","text":"Two"},{"key":"3","text":"Three"},{"key":"4","text":"Four"}]'::jsonb),repeat('e',40)from generate_series(1,100)n;
set local role service_role;select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.nift_reject('select public.upsert_nift_question_bank_runtime_batch(jsonb_build_array(jsonb_build_object(''externalKey'',''nift-gat-1'',''contentSha256'',md5(''1'')||md5(''1''),''runtime'',jsonb_build_object(''kind'',''mcq'',''prompt'',''Original NIFT GAT fixture 1'',''options'',''[{"id":"1","label":"One"},{"id":"2","label":"Two"},{"id":"3","label":"Three"},{"id":"4","label":"Four"}]''::jsonb,''marking'',''{"correct":1,"wrong":0}''::jsonb,''media'',''[]''::jsonb,''points'',1,''negativePoints'',0,''key'',''{"kind":"mcq","correct":["1"],"sourceExternalKey":"nift-gat-1"}''::jsonb,''context'',''{"version":"niftee-2027-bdes-v1","exam":"nift","programme":"bdes","cycle":2027}''::jsonb))))','wrong NIFT penalty is rejected');
select pg_temp.nift_assert(public.upsert_nift_question_bank_runtime_batch((select jsonb_agg(jsonb_build_object('externalKey','nift-gat-'||n,'contentSha256',md5(n::text)||md5(n::text),'runtime',jsonb_build_object('prompt','Original NIFT GAT fixture '||n,'options','[{"id":"1","label":"One"},{"id":"2","label":"Two"},{"id":"3","label":"Three"},{"id":"4","label":"Four"}]'::jsonb,'kind','mcq','marking','{"correct":1,"wrong":-0.25}'::jsonb,'media','[]'::jsonb,'points',1,'negativePoints',0.25,'topic','nift-gat','key',jsonb_build_object('kind','mcq','correct',jsonb_build_array('1'),'sourceExternalKey','nift-gat-'||n),'explanation','Original fixture explanation','context','{"version":"niftee-2027-bdes-v1","exam":"nift","programme":"bdes","cycle":2027}'::jsonb)))from generate_series(1,100)n))=100,'100 verified NIFT GAT questions materialize');
reset role;
select pg_temp.nift_assert((select count(*)=100 and bool_and(objective_ready)from dm_private.bank_questions where exam='nift'),'NIFT GAT runtime becomes objective-ready');
select pg_temp.nift_assert((select bool_and(not owner_approved and not rights_confirmed)from dm_private.bank_questions where exam='nift')and not dm_private.exam_blueprint_ready('nift',100,(select section_manifest from dm_private.exam_mock_blueprints where exam='nift')),'new NIFT runtime requires fresh review before release');
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);select public.admin_review_bank_question('nift-gat-'||n,true,true,'Original fixture rights confirmation')from generate_series(1,100)n;
reset role;
select pg_temp.nift_assert(not has_table_privilege('authenticated','dm_private.released_parallel_exam_questions','SELECT')
  and not has_table_privilege('service_role','dm_private.released_parallel_exam_questions','SELECT')
  and not has_table_privilege('anon','dm_private.released_parallel_exam_questions','SELECT'),
  'the eligible exam pool and answer payloads stay private');
select set_config('test.nift_year',pg_temp.release_bank_year(
  array(select 'nift-gat-'||n from generate_series(1,100)n),'nift',2023,'fictional-nift-gat')::text,true);
select pg_temp.register_parallel_clone('nift-gat-'||n,current_setting('test.nift_year')::uuid,'nift-parallel-'||n)
  from generate_series(1,100)n;
select pg_temp.nift_assert(not dm_private.exam_blueprint_ready('nift',100,
  (select section_manifest from dm_private.exam_mock_blueprints where exam='nift')),
  'approved originals and freshly registered parallels cannot fill the exam pool');

-- Model a blueprint that was already enabled before the new admission rule.
update dm_private.exam_mock_blueprints set enabled=true where exam='nift';
with paid as (
  insert into dm_private.orders(user_id,plan_id,amount,currency,mode,status)
  values('00000000-0000-4000-8000-000000000101','annual',119300,'INR','test','paid') returning id,user_id
)
insert into dm_private.passes(user_id,order_id,mode,starts_at,expires_at)
select user_id,id,'test',now(),now()+interval '1 year' from paid;
set local role authenticated;
select pg_temp.nift_reject('select public.admin_configure_exam_mock(''nift'',100,7200,1,true)',
  'admin cannot release the exam before All India');
select set_config('test.nift_event',public.admin_create_all_india_event(
  'nift','Fictional NIFT parallel event',now()+interval '1 hour',100,900)::text,true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.nift_assert(not(public.exam_mock_catalog()->2->>'ready')::boolean,'scheduled event is not exam-ready');
select pg_temp.nift_reject('select public.start_exam_mock(''nift'')','scheduled All India cannot supply exam questions');
reset role;
update dm_private.all_india_events set starts_at=now()-interval '1 day',ends_at=now()+interval '9 days',
  review_ends_at=now()+interval '19 days' where id=current_setting('test.nift_event')::uuid;
set local role authenticated;
select set_config('test.nift_event_attempt',public.start_all_india_attempt(current_setting('test.nift_event')::uuid)::text,true);
select public.submit_attempt(current_setting('test.nift_event_attempt')::uuid);
select pg_temp.nift_reject('select public.start_exam_mock(''nift'')','an attended event remains ineligible before results');
reset role;
update dm_private.all_india_events set starts_at=now()-interval '21 days',ends_at=now()-interval '11 days',
  review_ends_at=now()-interval '1 day' where id=current_setting('test.nift_event')::uuid;
update dm_private.attempts set deadline=now()-interval '11 days'
  where id=current_setting('test.nift_event_attempt')::uuid;
set local role authenticated;
select pg_temp.nift_reject('select public.admin_release_all_india_results(current_setting(''test.nift_event'')::uuid)',
  'student cannot release results');
select pg_temp.nift_reject('select public.start_exam_mock(''nift'')','review elapsed without release is insufficient');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
select public.admin_release_all_india_results(current_setting('test.nift_event')::uuid);
select pg_temp.nift_assert((public.admin_exam_mock_blueprints()->2->>'reviewedQuestions')::integer=100
  and (public.admin_exam_mock_blueprints()->2->>'ready')::boolean,
  'admin readiness counts eligible event questions and excludes the originals');
select public.admin_configure_exam_mock('nift',100,7200,1,true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.nift_assert((public.exam_mock_catalog()->2->>'ready')::boolean,'results release opens the exam mock');
reset role;
savepoint changed_runtime;
update dm_private.bank_questions set runtime_payload=jsonb_set(runtime_payload,'{prompt}','"Changed after event"')
  where external_key='nift-parallel-1';
update dm_private.bank_questions set owner_approved=true,rights_confirmed=true where external_key='nift-parallel-1';
select pg_temp.nift_assert(dm_private.parallel_question_ready('nift-parallel-1')
  and not exists(select 1 from dm_private.released_parallel_exam_questions where external_key='nift-parallel-1'),
  're-reviewed runtime still must match the frozen All India question');
rollback to changed_runtime;
set local role authenticated;
select set_config('test.nift_attempt',public.start_exam_mock('nift')::text,true);
reset role;
select pg_temp.nift_assert((select count(*)=100 and bool_and(kind='mcq')and bool_and(points=1)and bool_and(negative_points=0.25)from dm_private.attempt_items where attempt_id=current_setting('test.nift_attempt')::uuid),'NIFT GAT freezes exact question count and marking');
select pg_temp.nift_assert((select p.duration_seconds=7200 and p.title='NIFT 2027 B.Des. GAT mock'from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id where a.id=current_setting('test.nift_attempt')::uuid),'NIFT B.Des. GAT clock and label are fixed');
select pg_temp.nift_assert((select count(*)=100 and bool_and(key->>'sourceExternalKey' like 'nift-parallel-%')
  from dm_private.attempt_items where attempt_id=current_setting('test.nift_attempt')::uuid),
  'new snapshots contain only the released event parallels');
update dm_private.bank_questions set active=false where external_key='nift-parallel-1';
set local role authenticated;
select pg_temp.nift_assert(not(public.exam_mock_catalog()->2->>'ready')::boolean,
  'runtime withdrawal pauses subsequent starts without fallback');
select pg_temp.nift_reject('select public.start_exam_mock(''nift'')','revoked capacity blocks new attempts');
select pg_temp.nift_assert(jsonb_array_length(public.read_attempt(current_setting('test.nift_attempt')::uuid)->'questions')=100,
  'existing exam snapshot survives withdrawal');
reset role;
rollback;
\echo 'PASS: NIFT admits only released All India parallels and preserves fixed marking and snapshots.'
