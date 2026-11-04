-- Fictional accounts and bank only. Every change rolls back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.reject(statement text, label text) returns void language plpgsql as $$
begin
  begin execute statement; exception when others then return; end;
  raise exception 'FAIL, unexpectedly allowed: %',label;
end $$;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
set local role anon;
select pg_temp.assert_true((select amount from public.plans)=119300,'public server price');
select pg_temp.reject('select public.prepare_order()','anonymous checkout');
select pg_temp.reject('select * from dm_private.answer_keys','anonymous keys');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.reject('select * from dm_private.orders','student order-table access');
select pg_temp.reject('select public.prepare_order()','off-sale checkout');
select pg_temp.reject('select public.accept_current_terms(''v1'')','unpublished terms');
select pg_temp.reject('select public.attach_provider_order(gen_random_uuid(),''order_123'')','student provider attachment');
select pg_temp.reject('select public.fulfil_verified_payment(''fake'',''order_123'',''pay_123'',119300,''INR'')','student fulfilment');
reset role;
update public.launch_settings set sales_enabled=true,policy_version='v1';
set local role authenticated;
select pg_temp.reject('select public.prepare_order()','unaccepted terms');
select public.accept_current_terms('v1');
select set_config('test.order_id',public.prepare_order()->>'id',true);
select pg_temp.assert_true(public.prepare_order()->>'id'=current_setting('test.order_id'),'pending checkout reuse');
select pg_temp.assert_true((public.prepare_order()->>'amount')::int=119300,'authoritative amount');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.attach_provider_order(current_setting('test.order_id')::uuid,'order_fictional123');
select pg_temp.assert_true(public.attach_provider_order(current_setting('test.order_id')::uuid,'order_second123')='order_fictional123','attachment compare and set');
select pg_temp.reject('select public.fulfil_verified_payment(''evt_bad'',''order_fictional123'',''pay_fictional123'',1193,''INR'')','wrong amount');
select pg_temp.reject('select public.fulfil_verified_payment(''evt_bad'',''order_fictional123'',''pay_fictional123'',119300,''USD'')','wrong currency');
select public.fulfil_verified_payment('evt_1','order_fictional123','pay_fictional123',119300,'INR');
select public.fulfil_verified_payment('evt_1','order_fictional123','pay_fictional123',119300,'INR');
select public.fulfil_verified_payment('evt_2','order_fictional123','pay_fictional123',119300,'INR');
reset role;
select pg_temp.assert_true((select count(*)=1 and min(expires_at)=now()+interval '12 months' from dm_private.passes),'one calendar-year pass after retries');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.assert_true((public.my_pass()->>'active')::boolean,'purchased pass active');
select pg_temp.reject('select public.prepare_order()','duplicate active purchase');
reset role;
insert into dm_private.papers(id,title,exam,duration_seconds) values('10000000-0000-4000-8000-000000000001','Fictional QA paper','uceed',600);
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,points,topic,kind,marking,reviewed) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',1,'Fictional MCQ','[{"id":"A","label":"A"},{"id":"B","label":"B"}]',4,'Spatial','mcq','{"correct":4,"wrong":-1}',true),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',2,'Fictional MSQ','[{"id":"A","label":"A"},{"id":"B","label":"B"},{"id":"C","label":"C"}]',4,'Spatial','msq','{"correct":4,"wrong":-1,"partial":true}',true),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',3,'Fictional NAT','[]',4,'Observation','nat','{"correct":4,"wrong":0}',true),
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001',4,'Fictional drawing','[]',20,'Drawing','drawing','{"correct":20,"wrong":0}',true),
('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001',5,'Fictional dropped','[{"id":"A","label":"A"},{"id":"B","label":"B"}]',4,'Observation','mcq','{"correct":4,"wrong":-1}',true);
insert into dm_private.answer_keys values
('20000000-0000-4000-8000-000000000001','{"kind":"mcq","correct":["B"]}','Fictional explanation'),
('20000000-0000-4000-8000-000000000002','{"kind":"msq","correct":["A","C"]}','Fictional explanation'),
('20000000-0000-4000-8000-000000000003','{"kind":"nat","accepted":[{"range":[3.1,3.2]}]}','Fictional explanation'),
('20000000-0000-4000-8000-000000000004','{"kind":"self_review"}','Compare your drawing with the published rubric.'),
('20000000-0000-4000-8000-000000000005','{"kind":"dropped"}','Excluded.');
set local role authenticated;
select pg_temp.assert_true(public.available_papers()='[]'::jsonb,'unreleased catalogue hidden');
select pg_temp.reject('select public.start_attempt(''10000000-0000-4000-8000-000000000001'')','unreleased paper');
reset role;
update dm_private.papers set published=true,reviewed=true,rights_confirmed=true;
update dm_private.questions set reviewed=false where ordinal=1;
set local role authenticated;
select pg_temp.reject('select public.start_attempt(''10000000-0000-4000-8000-000000000001'')','incomplete question review');
reset role;
update dm_private.questions set reviewed=true;
set local role authenticated;
select set_config('test.attempt_id',public.start_attempt('10000000-0000-4000-8000-000000000001')::text,true);
select pg_temp.assert_true(public.start_attempt('10000000-0000-4000-8000-000000000001')::text=current_setting('test.attempt_id'),'resume same active attempt');
select pg_temp.assert_true(not ((public.read_attempt(current_setting('test.attempt_id')::uuid)->'questions'->0) ? 'correctKey'),'key hidden before submission');
select pg_temp.assert_true(not ((public.read_attempt(current_setting('test.attempt_id')::uuid)->'questions'->0) ? 'explanation'),'explanation hidden before submission');
select pg_temp.reject('select * from dm_private.answer_keys','student keys inaccessible');
select pg_temp.reject('select public.save_answer(current_setting(''test.attempt_id'')::uuid,''20000000-0000-4000-8000-000000000001'',''"Z"'')','invalid MCQ option');
select public.save_answer(current_setting('test.attempt_id')::uuid,'20000000-0000-4000-8000-000000000001','"B"');
select public.save_answer(current_setting('test.attempt_id')::uuid,'20000000-0000-4000-8000-000000000002','["A"]');
select public.save_answer(current_setting('test.attempt_id')::uuid,'20000000-0000-4000-8000-000000000003','"3.15"');
select public.save_answer(current_setting('test.attempt_id')::uuid,'20000000-0000-4000-8000-000000000004','"A fictional self-review note."');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select pg_temp.reject('select public.read_attempt(current_setting(''test.attempt_id'')::uuid)','other student attempt read');
select pg_temp.reject('select public.submit_attempt(current_setting(''test.attempt_id'')::uuid)','other student submission');
select pg_temp.reject('select public.save_answer(current_setting(''test.attempt_id'')::uuid,''20000000-0000-4000-8000-000000000001'',''"A"'')','other student save');
select pg_temp.reject('select public.start_attempt(''10000000-0000-4000-8000-000000000001'')','unpaid test start');
select pg_temp.assert_true(public.my_attempt_history()='[]'::jsonb,'history isolated');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
reset role;
update dm_private.answer_keys set key='{"kind":"mcq","correct":["A"]}' where question_id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.assert_true((public.submit_attempt(current_setting('test.attempt_id')::uuid)->>'score')::numeric=9,'MCQ snapshot + partial MSQ + NAT grading');
select pg_temp.assert_true((public.submit_attempt(current_setting('test.attempt_id')::uuid)->>'total')::numeric=12,'drawing and dropped excluded from objective denominator');
select pg_temp.assert_true((public.read_attempt(current_setting('test.attempt_id')::uuid)->'questions'->0) ? 'correctKey','submitted answer review available');
select pg_temp.reject('select public.save_answer(current_setting(''test.attempt_id'')::uuid,''20000000-0000-4000-8000-000000000001'',''"A"'')','submitted answers immutable');
select set_config('test.expired_attempt',public.start_attempt('10000000-0000-4000-8000-000000000001')::text,true);
reset role;
update dm_private.attempts set deadline=now()-interval '1 second' where id=current_setting('test.expired_attempt')::uuid;
set local role authenticated;
select pg_temp.reject('select public.save_answer(current_setting(''test.expired_attempt'')::uuid,''20000000-0000-4000-8000-000000000001'',''"A"'')','deadline enforced at server');
reset role;
select pg_temp.assert_true((select marks=4 and outcome='correct' from dm_private.score_response('msq','{"kind":"msq","alternatives":[["A","B"],["C"]]}','["C"]','{"correct":4,"wrong":-1,"partial":true}')),'alternative MSQ key');
select pg_temp.assert_true((select marks=-1 from dm_private.score_response('msq','{"kind":"msq","correct":["A","B"]}','["A","C"]','{"correct":4,"wrong":-1,"partial":true}')),'MSQ wrong selection penalty');
select pg_temp.assert_true((select marks=4 from dm_private.score_response('mcq','{"kind":"full_marks"}',null,'{"correct":4,"wrong":-1}')),'full marks key');
select pg_temp.assert_true((select marks=0 and outcome='unanswered' from dm_private.score_response('nat','{"kind":"nat","accepted":[{"exact":3}]}','null','{"correct":4,"wrong":0}')),'unanswered NAT');
rollback;
\echo 'PASS: commerce, RLS, ownership, deadlines, grading and retry invariants'
