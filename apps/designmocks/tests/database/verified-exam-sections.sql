\set ON_ERROR_STOP on
begin;
create function pg_temp.section_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception'FAIL: %',label;end if;end$$;
create function pg_temp.section_reject(statement text,label text)returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception'FAIL, unexpectedly allowed: %',label;end$$;
insert into auth.users(id)values('00000000-0000-4000-8000-000000000071'),('00000000-0000-4000-8000-000000000072');
insert into dm_private.admins(user_id)values('00000000-0000-4000-8000-000000000072');
insert into public.profiles(user_id,display_name,phone_e164,phone_verified_at,appearing_year,city,exams,onboarding_completed_at)values('00000000-0000-4000-8000-000000000071','Section Student','+919999999971',now(),2027,'Mumbai',array['uceed'],now());
with manifest(kind,required_count,correct,wrong)as(values('nat',14,4::numeric,0::numeric),('msq',15,4,-1),('mcq',28,3,-0.71)),generated as(select kind,correct,wrong,row_number()over()ordinal from manifest cross join lateral generate_series(1,required_count))
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,objective_ready,owner_approved,rights_confirmed,active,payload,runtime_payload,source_commit)
select 'uceed-section-'||kind||'-'||ordinal,md5(kind||ordinal)||md5(kind||ordinal),'uceed',upper(kind),'verified-section','owned',true,true,true,true,jsonb_build_object('externalKey','uceed-section-'||kind||'-'||ordinal,'prompt','Original verified section fixture '||kind||' '||ordinal,'holds','[]'::jsonb,'assets','[]'::jsonb),jsonb_build_object('prompt','Original verified section fixture '||kind||' '||ordinal,'options',case when kind='nat'then'[]'::jsonb else'[{"id":"A","label":"A"},{"id":"B","label":"B"},{"id":"C","label":"C"},{"id":"D","label":"D"}]'::jsonb end,'kind',kind,'marking',jsonb_build_object('correct',correct,'wrong',wrong)||case when kind='msq'then'{"partial":true}'::jsonb else'{}'::jsonb end,'media','[]'::jsonb,'points',correct,'negativePoints',abs(wrong),'topic','verified-section','key',case when kind='nat'then jsonb_build_object('kind','nat','accepted','[{"exact":"1"}]'::jsonb,'sourceExternalKey','uceed-section-'||kind||'-'||ordinal)else jsonb_build_object('kind',kind,'correct',case when kind='msq'then'["A","B"]'::jsonb else'["A"]'::jsonb end,'sourceExternalKey','uceed-section-'||kind||'-'||ordinal)end,'explanation','Original fixture explanation','context','{"version":"iitb-2027-v1","exam":"uceed","cycle":2027}'::jsonb),repeat('a',40)from generated;
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,objective_ready,owner_approved,rights_confirmed,active,payload,runtime_payload,source_commit)
select 'uceed-part-b-'||ordinal,repeat(ordinal::text,64),'uceed','DESCRIPTIVE','verified-drawing','owned',false,true,true,true,jsonb_build_object('externalKey','uceed-part-b-'||ordinal,'prompt','Original drawing task '||ordinal,'holds','[]'::jsonb,'assets','[]'::jsonb),jsonb_build_object('prompt','Original drawing task '||ordinal,'options','[]'::jsonb,'kind','drawing','marking','{"humanReview":true}'::jsonb,'media',jsonb_build_array(jsonb_build_object('assetKey','uceed-part-b-'||ordinal||'-prompt')),'points',50,'negativePoints',0,'topic','verified-drawing','key',jsonb_build_object('kind','drawing','sourceExternalKey','uceed-part-b-'||ordinal),'explanation','','context','{"version":"iitb-2027-v1","exam":"uceed","cycle":2027,"section":"Part B"}'::jsonb),repeat('b',40)from generate_series(1,2)ordinal;
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select pg_temp.section_reject('select public.admin_configure_exam_mock(''uceed'',57,7200,1,true)','student cannot release verified mock');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000072',true);
select pg_temp.section_reject('select public.admin_configure_exam_mock(''uceed'',56,7200,1,true)','verified count cannot be changed');
select pg_temp.section_reject('select public.admin_configure_exam_mock(''uceed'',57,3600,1,true)','verified clock cannot be changed');
select pg_temp.section_assert((public.admin_exam_mock_blueprints()->0->'sectionCounts'->>'mcq')::integer=26 and(public.admin_exam_mock_blueprints()->0->>'durationSeconds')::integer=3600,'CEED verified Part A manifest is fixed');
select public.admin_configure_exam_mock('uceed',57,7200,1,true);
select public.admin_upsert_learning_lesson(null,'verified-section-theory','uceed','verified-section',
  'Fictional section theory','A fictional lesson summary.','An original test lesson body for release verification.',1,true,true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select pg_temp.section_assert((public.exam_mock_catalog()->3->>'sectionLabel')='Part A','catalog declares verified section');
select set_config('test.section_attempt',public.start_exam_mock('uceed')::text,true);
reset role;select set_config('test.section_question',(select question_id::text from dm_private.attempt_items where attempt_id=current_setting('test.section_attempt')::uuid order by ordinal limit 1),true);
select pg_temp.section_assert((select count(*)=57 and count(*)filter(where kind='nat')=14 and count(*)filter(where kind='msq')=15 and count(*)filter(where kind='mcq')=28 from dm_private.attempt_items where attempt_id=current_setting('test.section_attempt')::uuid),'frozen snapshot has exact section counts');
select pg_temp.section_assert((select bool_and(kind='nat')from dm_private.attempt_items where attempt_id=current_setting('test.section_attempt')::uuid and ordinal between 1 and 14),'NAT section is first');
select pg_temp.section_assert((select bool_and(kind='msq')from dm_private.attempt_items where attempt_id=current_setting('test.section_attempt')::uuid and ordinal between 15 and 29),'MSQ section is second');
select pg_temp.section_assert((select bool_and(kind='mcq')from dm_private.attempt_items where attempt_id=current_setting('test.section_attempt')::uuid and ordinal between 30 and 57),'MCQ section is third');
select pg_temp.section_assert((select duration_seconds=7200 and title='UCEED 2027 Part A mock'from dm_private.papers p join dm_private.attempts a on a.paper_id=p.id where a.id=current_setting('test.section_attempt')::uuid),'verified clock and title are frozen');
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select pg_temp.section_assert(public.read_attempt(current_setting('test.section_attempt')::uuid)->'questions'=public.read_attempt(current_setting('test.section_attempt')::uuid)->'questions','reconnect reads the same immutable snapshot');
select public.save_answer_revision(current_setting('test.section_attempt')::uuid,current_setting('test.section_question')::uuid,'"1"',1);
select public.submit_attempt(current_setting('test.section_attempt')::uuid);
select pg_temp.section_assert((select o->'objectiveAccuracy'='null'::jsonb and o->'exams'='[]'::jsonb and o->'topics'='[]'::jsonb
  and (o->>'waitingForResults')::integer=1 from public.my_overview_analytics() o),
  'overview withholds Part A correctness and percentage before full release');
select pg_temp.section_assert((public.learning_progress()->'recommendation'->>'answered')::integer=0,
  'Learn uses its default recommendation while Part A is sealed');
select pg_temp.section_assert((public.my_attempt_history()->0->>'resultsPending')::boolean
  and public.my_attempt_history()->0->'score'='null'::jsonb,'history withholds Part A marks while the exam is sealed');
select pg_temp.section_reject('select public.start_exam_mock_part_b(current_setting(''test.section_attempt'')::uuid)','Part B cannot start before the fixed Part A clock ends');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000072',true);
select pg_temp.section_reject('select public.start_exam_mock_part_b(current_setting(''test.section_attempt'')::uuid)','another user cannot open the student session');
reset role;
update dm_private.attempts set deadline=now()-interval '1 second' where id=current_setting('test.section_attempt')::uuid;
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select pg_temp.section_assert(public.my_exam_mock_session(current_setting('test.section_attempt')::uuid)->>'partBState'='ready','submitted Part A becomes ready at its fixed deadline');
select pg_temp.section_assert((public.my_exam_mock_session(current_setting('test.section_attempt')::uuid)->>'partBTaskCount')::integer=2 and(public.my_exam_mock_session(current_setting('test.section_attempt')::uuid)->>'partBDurationSeconds')::integer=3600,'official UCEED Part B count and clock are exposed');
select set_config('test.part_b_attempt',public.start_exam_mock_part_b(current_setting('test.section_attempt')::uuid)::text,true);
select pg_temp.section_assert(public.start_exam_mock_part_b(current_setting('test.section_attempt')::uuid)=current_setting('test.part_b_attempt')::uuid,'Part B start retry is idempotent');
reset role;
select pg_temp.section_assert((select count(*)=2 and bool_and(kind='drawing')and sum(points)=100 from dm_private.attempt_items where attempt_id=current_setting('test.part_b_attempt')::uuid),'Part B freezes exactly two reviewed drawing tasks');
select pg_temp.section_assert((select p.source_kind='exam_part_b'and p.duration_seconds=3600 and p.upload_grace_seconds=900 and b.deadline=a.deadline+interval '3600 seconds'from dm_private.attempts b join dm_private.papers p on p.id=b.paper_id join dm_private.exam_mock_sessions s on s.part_b_attempt=b.id join dm_private.attempts a on a.id=s.part_a_attempt where b.id=current_setting('test.part_b_attempt')::uuid),'Part B keeps the official fixed clock and upload grace');
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select public.submit_attempt(current_setting('test.part_b_attempt')::uuid);
select pg_temp.section_assert((public.my_exam_mock_report(current_setting('test.part_b_attempt')::uuid)->>'resultsPending')::boolean,'combined result waits through the fixed upload window');
select pg_temp.section_assert((select bool_and(value->'score'='null'::jsonb and value->'total'='null'::jsonb and(value->>'resultsPending')::boolean)
  from jsonb_array_elements(public.export_my_account_data()->'attempts'))
  and public.export_my_account_data()->'results'->'examMocks'->0->'combinedScore'='null'::jsonb,'export respects the full combined-exam upload/review hold');
select pg_temp.section_assert(public.read_attempt(current_setting('test.section_attempt')::uuid)->'score'='null'::jsonb and not((public.read_attempt(current_setting('test.section_attempt')::uuid)->'questions'->0)?'correctKey'),'Part A marks and keys stay private until the full exam is complete');
reset role;update dm_private.attempts set upload_deadline=now()-interval '1 second'where id=current_setting('test.part_b_attempt')::uuid;
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select pg_temp.section_assert(not(public.my_exam_mock_report(current_setting('test.part_b_attempt')::uuid)->>'resultsPending')::boolean and(public.my_exam_mock_report(current_setting('test.part_b_attempt')::uuid)->>'combinedTotal')::numeric=300,'combined report releases objective and drawing totals after review/upload gates');
select pg_temp.section_assert(public.export_my_account_data()->'results'->'examMocks'->0=public.my_exam_mock_report(current_setting('test.section_attempt')::uuid),
  'the exported combined result matches the released student report');
reset role;
insert into dm_private.drawing_reviews(attempt_id,question_id,reviewer_id,status,criterion_marks,comments,score,reviewed_at,released_at)
select i.attempt_id,i.question_id,'00000000-0000-4000-8000-000000000072','released',
  jsonb_build_object('composition',case when i.ordinal=1 then 45 else 40 end),'Fictional released grade.',
  case when i.ordinal=1 then 45 else 40 end,now(),now()
from dm_private.attempt_items i where i.attempt_id=current_setting('test.part_b_attempt')::uuid;
set local role authenticated;
select pg_temp.section_assert((public.my_exam_mock_report(current_setting('test.section_attempt')::uuid)->>'combinedScore')::numeric=89,
  'released combined fixture is 89/300');
select pg_temp.section_assert((select(value->>'averagePercent')::integer=30 and(value->>'bestPercent')::integer=30
  and(value->>'attempts')::integer=1 from jsonb_array_elements(public.my_overview_analytics()->'exams')value where value->>'exam'='uceed'),
  'combined Overview counts one complete 89/300 assessment');
select pg_temp.section_assert((select (o->>'objectiveAccuracy')::integer=100 and (o->>'objectiveAnswered')::integer=1
  and (o->>'waitingForResults')::integer=0 from public.my_overview_analytics() o),
  'overview incorporates Part A only after full release');
select pg_temp.section_assert((public.learning_progress()->'recommendation'->>'answered')::integer=1
  and (public.learning_progress()->'recommendation'->>'accuracy')::integer=100,'Learn incorporates released topic performance');
select pg_temp.section_reject('select public.save_answer_revision(current_setting(''test.section_attempt'')::uuid,current_setting(''test.section_question'')::uuid,''"1"'',1)','submitted snapshot rejects later answers');
select pg_temp.section_reject('select public.start_exam_mock(''uceed'')','free allowance is enforced after one attempt');
rollback;
\echo 'PASS: verified UCEED Part A and fixed sequential Part B counts, clocks, authorization and idempotency.'
