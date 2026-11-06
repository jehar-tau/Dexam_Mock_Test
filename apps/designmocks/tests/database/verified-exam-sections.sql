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
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select pg_temp.section_reject('select public.admin_configure_exam_mock(''uceed'',57,7200,1,true)','student cannot release verified mock');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000072',true);
select pg_temp.section_reject('select public.admin_configure_exam_mock(''uceed'',56,7200,1,true)','verified count cannot be changed');
select pg_temp.section_reject('select public.admin_configure_exam_mock(''uceed'',57,3600,1,true)','verified clock cannot be changed');
select pg_temp.section_assert((public.admin_exam_mock_blueprints()->0->'sectionCounts'->>'mcq')::integer=26 and(public.admin_exam_mock_blueprints()->0->>'durationSeconds')::integer=3600,'CEED verified Part A manifest is fixed');
select public.admin_configure_exam_mock('uceed',57,7200,1,true);
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
select public.submit_attempt(current_setting('test.section_attempt')::uuid);
select pg_temp.section_reject('select public.save_answer_revision(current_setting(''test.section_attempt'')::uuid,current_setting(''test.section_question'')::uuid,''"1"'',1)','submitted snapshot rejects later answers');
select pg_temp.section_reject('select public.start_exam_mock(''uceed'')','free allowance is enforced after one attempt');
rollback;
\echo 'PASS: verified UCEED Part A counts, clock, order, reconnect and submission locking.'
