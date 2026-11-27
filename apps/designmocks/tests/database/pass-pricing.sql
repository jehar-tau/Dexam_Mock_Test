-- Fictional accounts only. Annual and Duo prices, Duo invites and the free limits.
\set ON_ERROR_STOP on
begin;
\ir fixtures/release-bank-year.sql
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.rejects(statement text,expected_hint text,label text) returns void language plpgsql as $$
declare got text;
begin
  begin execute statement; exception when others then
    get stacked diagnostics got=pg_exception_hint;
    if expected_hint is not null and got is distinct from expected_hint then raise exception 'FAIL: % (hint %)',label,got; end if;
    return;
  end;
  raise exception 'FAIL: % was allowed',label;
end $$;
create function pg_temp.as_student(id uuid) returns void language sql as $$
  select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',id::text,true);
$$;
create function pg_temp.as_service() returns void language sql as $$
  select set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub','',true);
$$;

-- payer, friend, second friend, holder of an annual pass, email account, free student
insert into auth.users(id,raw_app_meta_data) values
  ('00000000-0000-4000-8000-00000000d001','{"provider":"google"}'),
  ('00000000-0000-4000-8000-00000000d002','{"provider":"google"}'),
  ('00000000-0000-4000-8000-00000000d003','{"provider":"google"}'),
  ('00000000-0000-4000-8000-00000000d004','{"provider":"google"}'),
  ('00000000-0000-4000-8000-00000000d005','{"provider":"email"}'),
  ('00000000-0000-4000-8000-00000000d006','{"provider":"google"}'),
  ('00000000-0000-4000-8000-00000000d007','{"provider":"google"}');

-- Prices ----------------------------------------------------------------------
select pg_temp.ok((select amount=128400 and duration_months=12 and seats=1 from public.plans where id='annual'),'annual pass is Rs 1,284 for 12 months');
select pg_temp.ok((select amount=214200 and duration_months=12 and seats=2 from public.plans where id='duo'),'Duo pass is Rs 2,142 for two students');
select pg_temp.rejects('update public.plans set amount=119300 where id=''annual''',null,'the old price cannot return');
select pg_temp.rejects('insert into public.plans values(''trio'',''Trio'',300000,''INR'',12,3)',null,'an unknown plan cannot be added');

alter table public.launch_settings disable trigger user;
update public.launch_settings set sales_enabled=true,policy_version='pass-pricing-test',environment_mode='test';
alter table public.launch_settings enable trigger user;
insert into public.profiles(user_id,terms_version,accepted_at)
  select id,'pass-pricing-test',now() from auth.users where id::text like '00000000-0000-4000-8000-00000000d00%'
  on conflict(user_id) do update set terms_version=excluded.terms_version,accepted_at=excluded.accepted_at;

select pg_temp.as_student('00000000-0000-4000-8000-00000000d001');
set local role authenticated;
select pg_temp.ok((public.prepare_plan_order('duo')->>'amount')::int=214200,'a Duo order is priced at 214200 paise');
select pg_temp.ok(public.prepare_plan_order('duo')->>'id'=public.prepare_plan_order('duo')->>'id','a pending Duo order is reused');
select pg_temp.ok((public.prepare_order()->>'amount')::int=128400,'the no-argument order buys the annual pass at 128400 paise');
select pg_temp.rejects('select public.prepare_plan_order(''lifetime'')',null,'an unknown plan cannot be ordered');
reset role;

-- Duo fulfilment ------------------------------------------------------------------
update dm_private.orders set provider_order_id='order_duoTest1'
  where user_id='00000000-0000-4000-8000-00000000d001' and plan_id='duo';
select pg_temp.as_service();
set local role service_role;
select public.fulfil_verified_payment('evt_duoCapture1','order_duoTest1','pay_duoTest1',214200,'INR');
select public.fulfil_verified_payment('evt_duoCapture1','order_duoTest1','pay_duoTest1',214200,'INR');
select public.fulfil_verified_payment('evt_duoCapture1b','order_duoTest1','pay_duoTest1',214200,'INR');
reset role;
select pg_temp.ok((select count(*)=1 from dm_private.duo_invites i join dm_private.orders o on o.id=i.order_id where o.provider_order_id='order_duoTest1'),'a captured Duo payment opens exactly one invite');
select pg_temp.ok((select i.expires_at=o.paid_at+interval '30 days' from dm_private.duo_invites i join dm_private.orders o on o.id=i.order_id where o.provider_order_id='order_duoTest1'),'the invite is valid for 30 days');
select pg_temp.ok(dm_private.has_active_pass('00000000-0000-4000-8000-00000000d001'),'the payer gets their own pass');

select pg_temp.as_student('00000000-0000-4000-8000-00000000d001');
set local role authenticated;
select pg_temp.ok(public.my_duo_invite()->>'status'='open' and length(public.my_duo_invite()->>'token')=64,'the payer reads an open invite link');
select pg_temp.ok(public.my_pass()->>'active'='true' and public.my_pass()->>'mode'='test','the payer reads an active pass with its mode');
create temp table invite_token on commit drop as select public.my_duo_invite()->>'token' as token;
grant select on invite_token to authenticated,service_role;
select pg_temp.rejects(format('select public.redeem_duo_invite(%L)',(select token from invite_token)),'dmocks_duo_payer','the payer cannot redeem their own invite');

select pg_temp.as_student('00000000-0000-4000-8000-00000000d005');
select pg_temp.rejects(format('select public.redeem_duo_invite(%L)',(select token from invite_token)),'dmocks_duo_google','only a Google account can claim');
select pg_temp.as_student('00000000-0000-4000-8000-00000000d002');
select pg_temp.rejects('select public.redeem_duo_invite(''nottoken'')','dmocks_duo_invalid','a malformed link is rejected');
select pg_temp.rejects(format('select public.redeem_duo_invite(%L)',repeat('a',64)),'dmocks_duo_invalid','an unknown link is rejected');
reset role;

-- An account that already holds a pass cannot take the friend's seat.
insert into dm_private.orders(id,user_id,plan_id,amount,currency,mode,provider_order_id)
  values('00000000-0000-4000-8000-00000000d104','00000000-0000-4000-8000-00000000d004','annual',128400,'INR','test','order_annualHolder');
select pg_temp.as_service();
set local role service_role;
select public.fulfil_verified_payment('evt_annualHolder','order_annualHolder','pay_annualHolder',128400,'INR');
reset role;
select pg_temp.ok((select count(*)=0 from dm_private.duo_invites i join dm_private.orders o on o.id=i.order_id where o.provider_order_id='order_annualHolder'),'an annual pass opens no invite');
select pg_temp.as_student('00000000-0000-4000-8000-00000000d004');
set local role authenticated;
select pg_temp.rejects(format('select public.redeem_duo_invite(%L)',(select token from invite_token)),'dmocks_duo_has_pass','an account with an active pass cannot redeem');

select pg_temp.as_student('00000000-0000-4000-8000-00000000d002');
select pg_temp.ok((public.redeem_duo_invite((select token from invite_token))->>'active')::boolean,'the friend claims the invite');
select pg_temp.ok(public.my_pass()->>'active'='true' and public.my_pass()->>'kind'='duo_invite','the friend has their own pass');
select pg_temp.as_student('00000000-0000-4000-8000-00000000d003');
select pg_temp.rejects(format('select public.redeem_duo_invite(%L)',(select token from invite_token)),'dmocks_duo_used','an invite can be redeemed once');
select pg_temp.as_student('00000000-0000-4000-8000-00000000d001');
select pg_temp.ok(public.my_duo_invite()->>'status'='redeemed' and public.my_duo_invite()->>'token' is null,'the payer sees the invite was used, without the link');
reset role;
select pg_temp.ok((select expires_at between now()+interval '12 months'-interval '1 minute' and clock_timestamp()+interval '12 months' and grant_kind='duo_invite'
  from dm_private.passes where user_id='00000000-0000-4000-8000-00000000d002'),'the friend pass lasts 12 months from the claim');

-- Expired invites ----------------------------------------------------------------
insert into dm_private.orders(id,user_id,plan_id,amount,currency,mode,provider_order_id)
  values('00000000-0000-4000-8000-00000000d106','00000000-0000-4000-8000-00000000d007','duo',214200,'INR','test','order_duoExpired');
select pg_temp.as_service();
set local role service_role;
select public.fulfil_verified_payment('evt_duoExpired','order_duoExpired','pay_duoExpired',214200,'INR');
reset role;
update dm_private.duo_invites set created_at=now()-interval '31 days',expires_at=now()-interval '1 day'
  where order_id='00000000-0000-4000-8000-00000000d106';
create temp table expired_token on commit drop as select token from dm_private.duo_invites where order_id='00000000-0000-4000-8000-00000000d106';
grant select on expired_token to authenticated;
select pg_temp.as_student('00000000-0000-4000-8000-00000000d003');
set local role authenticated;
select pg_temp.rejects(format('select public.redeem_duo_invite(%L)',(select token from expired_token)),
  'dmocks_duo_expired','an invite older than 30 days is rejected');
reset role;

-- A full refund ends both passes of the Duo order.
select pg_temp.as_service();
set local role service_role;
select public.record_verified_refund('evt_duoRefund','order_duoTest1','pay_duoTest1','rfnd_duoTest1',214200,214200,214200,'INR');
reset role;
select pg_temp.ok(not dm_private.has_active_pass('00000000-0000-4000-8000-00000000d001') and not dm_private.has_active_pass('00000000-0000-4000-8000-00000000d002'),
  'a full Duo refund revokes the payer and friend passes');
select pg_temp.ok(dm_private.has_active_pass('00000000-0000-4000-8000-00000000d004'),'the refund leaves other passes alone');

-- Worked solutions -----------------------------------------------------------------
insert into dm_private.papers(id,title,exam,duration_seconds,source_kind,owner_user_id) values
  ('00000000-0000-4000-8000-00000000d201','Seven question paper','uceed',600,'topic',null);
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,points,negative_points,topic,reviewed)
  select ('00000000-0000-4000-8000-00000000d3'||lpad(n::text,2,'0'))::uuid,'00000000-0000-4000-8000-00000000d201',n,'Question '||n,
    '[{"id":"A","label":"A"},{"id":"B","label":"B"}]','mcq','{"correct":4,"wrong":-1}',4,1,'observation',true
  from generate_series(1,7) n;
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,points,negative_points,topic,reviewed)
  values('00000000-0000-4000-8000-00000000d308','00000000-0000-4000-8000-00000000d201',8,'Draw a chair','[]','drawing','{"max":10}',10,0,'drawing',true);
insert into dm_private.attempts(id,user_id,paper_id,status,started_at,deadline,submitted_at,score,total) values
  ('00000000-0000-4000-8000-00000000d401','00000000-0000-4000-8000-00000000d006','00000000-0000-4000-8000-00000000d201','submitted',now()-interval '2 days',now()-interval '2 days'+interval '10 minutes',now()-interval '2 days',0,28),
  ('00000000-0000-4000-8000-00000000d402','00000000-0000-4000-8000-00000000d004','00000000-0000-4000-8000-00000000d201','submitted',now()-interval '2 days',now()-interval '2 days'+interval '10 minutes',now()-interval '2 days',0,28);
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,key,explanation,answer)
  select a.id,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,
    case when q.kind='drawing' then '{"kind":"drawing"}'::jsonb else '{"correct":["A"]}'::jsonb end,'Because A. Step '||q.ordinal,'"B"'::jsonb
  from dm_private.questions q cross join (values('00000000-0000-4000-8000-00000000d401'::uuid),('00000000-0000-4000-8000-00000000d402'::uuid)) a(id)
  where q.paper_id='00000000-0000-4000-8000-00000000d201';

select pg_temp.as_student('00000000-0000-4000-8000-00000000d006');
set local role authenticated;
create temp table free_read on commit drop as select public.read_attempt('00000000-0000-4000-8000-00000000d401') as body;
reset role;
select pg_temp.ok((select (body->>'lockedSolutions')::int=2 and body->>'passActive'='false' from free_read),'a free student has 2 of 7 objective solutions locked');
select pg_temp.ok((select count(*)=5 from free_read,jsonb_array_elements(body->'questions') q where q->>'kind'='mcq' and jsonb_typeof(q->'explanation')='string'),'the first 5 worked solutions stay open');
select pg_temp.ok((select bool_and((q->>'solutionLocked')::boolean and q->'explanation'='null'::jsonb and q->'correctKey' is not null)
  from free_read,jsonb_array_elements(body->'questions') with ordinality x(q,n) where n in(6,7)),'questions 6 and 7 keep the key and lose the worked solution');
select pg_temp.as_student('00000000-0000-4000-8000-00000000d004');
set local role authenticated;
select pg_temp.ok((public.read_attempt('00000000-0000-4000-8000-00000000d402')->>'lockedSolutions')::int=0,'a pass holder sees every worked solution');
reset role;

-- Topic practice -------------------------------------------------------------------
create function pg_temp.pass_runtime(p_key text,n integer) returns jsonb language sql as $$
  select jsonb_build_object('prompt','Fictional pass practice question '||n,'topic','observation','kind','mcq',
    'options','[{"id":"A","label":"First"},{"id":"B","label":"Second"}]'::jsonb,'marking','{"correct":3,"wrong":-1}'::jsonb,
    'points',3,'negativePoints',1,'media','[]'::jsonb,'explanation','Key for item '||n,
    'key',jsonb_build_object('kind','mcq','sourceExternalKey',p_key,'correct',jsonb_build_array('A')),
    'context','{"version":"iitb-2027-v1","exam":"uceed","cycle":2027}'::jsonb)
$$;
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,objective_ready,owner_approved,rights_confirmed,active,payload,runtime_payload,source_commit)
  select 'pass-fixture-'||n,md5('pass'||n)||md5('pass'||n),'uceed','MCQ','observation','owned',true,true,true,true,
    jsonb_build_object('holds','[]'::jsonb,'assets','[]'::jsonb,'prompt','Fictional pass practice question '||n),
    pg_temp.pass_runtime('pass-fixture-'||n,n),repeat('c',40)
  from generate_series(1,40) n;
select pg_temp.release_bank_year(array(select 'pass-fixture-'||n from generate_series(1,40) n),'uceed',2023,'pass-uceed-2023');
insert into public.profiles(user_id,display_name,phone_e164,phone_verified_at,appearing_year,city,exams,onboarding_completed_at)
  values('00000000-0000-4000-8000-00000000d006','Fictional free student','+919999520001',now(),2027,'Pune',array['uceed'],now()),
        ('00000000-0000-4000-8000-00000000d004','Fictional pass student','+919999520002',now(),2027,'Pune',array['uceed'],now())
  on conflict(user_id) do update set display_name=excluded.display_name,phone_e164=excluded.phone_e164,phone_verified_at=excluded.phone_verified_at,
    appearing_year=excluded.appearing_year,city=excluded.city,exams=excluded.exams,onboarding_completed_at=excluded.onboarding_completed_at;
select pg_temp.as_student('00000000-0000-4000-8000-00000000d006');
set local role authenticated;
select pg_temp.rejects('select public.start_topic_practice(''observation'',''uceed'',20,1800)','dmocks_free_practice_length','a free session has 10 questions');
select pg_temp.ok(public.start_topic_practice('observation','uceed',10,900) is not null,'a free student starts today''s 10-question session');
select pg_temp.rejects('select public.start_topic_practice(''observation'',''uceed'',10,900)','dmocks_free_daily_practice','a free student gets one topic session a day');
reset role;
select pg_temp.ok((select count(*)=1 from dm_private.attempts a join dm_private.papers p on p.id=a.paper_id
  where a.user_id='00000000-0000-4000-8000-00000000d006' and p.owner_user_id=a.user_id and p.source_kind='topic'),'a refused session leaves nothing behind');
update dm_private.attempts set started_at=now()-interval '1 day',deadline=now()-interval '1 day'+interval '15 minutes',status='submitted',submitted_at=now()-interval '1 day'
  where user_id='00000000-0000-4000-8000-00000000d006' and status='active';
select pg_temp.as_student('00000000-0000-4000-8000-00000000d006');
set local role authenticated;
select pg_temp.ok(public.start_topic_practice('observation','uceed',10,900) is not null,'yesterday''s session does not use up today''s');
select pg_temp.as_student('00000000-0000-4000-8000-00000000d004');
select pg_temp.ok(public.start_topic_practice('observation','uceed',20,1800) is not null and public.start_topic_practice('observation','uceed',10,900) is not null,
  'a pass holder starts longer and repeated sessions');
reset role;

-- Teacher drawing marking ----------------------------------------------------------
insert into dm_private.drawing_reviews(attempt_id,question_id)
  values('00000000-0000-4000-8000-00000000d401','00000000-0000-4000-8000-00000000d308') on conflict do nothing;
select pg_temp.ok((select count(*)=0 from dm_private.drawing_reviews where attempt_id='00000000-0000-4000-8000-00000000d401'),'a free student''s drawing is not queued for a teacher');
select pg_temp.ok((select reason='pass_required' from dm_private.drawing_review_holds where attempt_id='00000000-0000-4000-8000-00000000d401'),'the hold records that a pass is needed');
select pg_temp.as_student('00000000-0000-4000-8000-00000000d006');
set local role authenticated;
select pg_temp.ok((select q->'drawingReview'->>'status'='pass_required' from jsonb_array_elements(public.read_attempt('00000000-0000-4000-8000-00000000d401')->'questions') q where q->>'kind'='drawing'),
  'the result tells the student that teacher marking needs a pass');
select pg_temp.ok(public.my_drawing_marking_allowance()->>'remaining'='0','a free student has no teacher marking');
reset role;

insert into dm_private.papers(id,title,exam,duration_seconds,source_kind) values('00000000-0000-4000-8000-00000000d204','Drawing set','ceed',600,'exam_part_b');
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,points,negative_points,topic,reviewed)
  select ('00000000-0000-4000-8000-00000000d5'||lpad(n::text,2,'0'))::uuid,'00000000-0000-4000-8000-00000000d204',n,'Drawing '||n,'[]','drawing','{"max":10}',10,0,'drawing',true
  from generate_series(1,5) n;
insert into dm_private.attempts(id,user_id,paper_id,status,started_at,deadline,submitted_at) values
  ('00000000-0000-4000-8000-00000000d403','00000000-0000-4000-8000-00000000d004','00000000-0000-4000-8000-00000000d204','submitted',now(),now()+interval '10 minutes',now());
insert into dm_private.drawing_reviews(attempt_id,question_id)
  select '00000000-0000-4000-8000-00000000d403',id from dm_private.questions where paper_id='00000000-0000-4000-8000-00000000d204' order by ordinal;
select pg_temp.ok((select count(*)=4 from dm_private.drawing_reviews where attempt_id='00000000-0000-4000-8000-00000000d403'),'a pass holder gets 4 drawings marked a month');
select pg_temp.ok((select reason='monthly_limit' from dm_private.drawing_review_holds where attempt_id='00000000-0000-4000-8000-00000000d403'),'the fifth drawing waits for next month');
select pg_temp.as_student('00000000-0000-4000-8000-00000000d004');
set local role authenticated;
select pg_temp.ok(public.my_drawing_marking_allowance()->>'used'='4' and public.my_drawing_marking_allowance()->>'remaining'='0','the allowance shows 4 of 4 used');
reset role;

-- Theory lessons ---------------------------------------------------------------------
insert into dm_private.learning_lessons(slug,exam,topic,title,summary,body,ordinal,published,rights_confirmed,created_by) values
  ('pass-test-first','uceed','pass-test','First free lesson','The first lesson is free to read.',repeat('Body text. ',5),1,true,true,'00000000-0000-4000-8000-00000000d004'),
  ('pass-test-second','uceed','pass-test','Second pass lesson','The second lesson needs a pass.',repeat('Body text. ',5),2,true,true,'00000000-0000-4000-8000-00000000d004');
select pg_temp.as_student('00000000-0000-4000-8000-00000000d006');
set local role authenticated;
select pg_temp.ok(public.read_learning_lesson('pass-test-first')->>'slug'='pass-test-first','the first lesson of a topic is free');
select pg_temp.rejects('select public.read_learning_lesson(''pass-test-second'')','dmocks_pass_required','later lessons need a pass');
select pg_temp.ok((select bool_and((l->>'locked')::boolean=(l->>'slug'='pass-test-second')) from jsonb_array_elements(public.learning_catalog()) l where l->>'topic'='pass-test'),
  'the catalogue marks the locked lessons');
select pg_temp.as_student('00000000-0000-4000-8000-00000000d004');
select pg_temp.ok(public.read_learning_lesson('pass-test-second')->>'slug'='pass-test-second','a pass holder reads every lesson');
reset role;

-- Students cannot reach the private wrappers or tables.
set local role authenticated;
select pg_temp.rejects('select * from dm_private.duo_invites',null,'invites are private');
select pg_temp.rejects('select dm_private.has_active_pass(auth.uid())',null,'the pass helper is private');
select pg_temp.rejects('select dm_private.read_attempt_before_pass_split(gen_random_uuid())',null,'the unfiltered result is private');
select pg_temp.rejects('select public.fulfil_verified_payment(''evt_x'',''order_duoTest1'',''pay_duoTest1'',214200,''INR'')',null,'students cannot fulfil payments');
reset role;
set local role anon;
select pg_temp.rejects('select public.redeem_duo_invite(repeat(''a'',64))',null,'signed-out visitors cannot redeem');
reset role;
rollback;
\echo 'PASS: Rs 1,284 annual and Rs 2,142 Duo prices, one-time Duo invites, refunds, and server-side free limits.'
