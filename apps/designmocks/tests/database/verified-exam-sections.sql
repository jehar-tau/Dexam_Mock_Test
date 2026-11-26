\set ON_ERROR_STOP on
begin;
\ir fixtures/release-bank-year.sql
\ir fixtures/released-parallel-questions.sql
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
select set_config('test.section_year',pg_temp.release_bank_year(
  array(select external_key from dm_private.bank_questions where topic='verified-section'),
  'uceed',2023,'fictional-complete-uceed')::text,true);
select pg_temp.register_parallel_clone(external_key,current_setting('test.section_year')::uuid,'parallel-'||external_key)
  from dm_private.bank_questions where topic='verified-section';
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select pg_temp.section_reject('select public.admin_configure_exam_mock(''uceed'',57,7200,1,true)','student cannot release verified mock');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000072',true);
select pg_temp.section_reject('select public.admin_configure_exam_mock(''uceed'',56,7200,1,true)','verified count cannot be changed');
select pg_temp.section_reject('select public.admin_configure_exam_mock(''uceed'',57,3600,1,true)','verified clock cannot be changed');
select pg_temp.section_assert((public.admin_exam_mock_blueprints()->0->'sectionCounts'->>'mcq')::integer=26 and(public.admin_exam_mock_blueprints()->0->>'durationSeconds')::integer=3600,'CEED verified Part A manifest is fixed');
select set_config('test.section_event',public.admin_create_all_india_event(
  'uceed','Fictional verified sections',now()+interval '1 hour',57,900)::text,true);
reset role;
update dm_private.all_india_events set starts_at=now()-interval '21 days',ends_at=now()-interval '11 days',
  review_ends_at=now()-interval '1 day' where id=current_setting('test.section_event')::uuid;
set local role authenticated;
select public.admin_release_all_india_results(current_setting('test.section_event')::uuid);
select pg_temp.section_assert((public.admin_exam_mock_blueprints()->3->>'reviewedQuestions')::integer=57,
  'UCEED has a complete fresh objective pool before the Part B readiness decision');
select pg_temp.section_reject('select public.admin_configure_exam_mock(''uceed'',57,7200,1,true)','admin cannot use old Part B tasks');
select pg_temp.section_reject('select public.admin_configure_exam_mock(''ceed'',44,3600,1,true)','CEED also requires a released Part B pool');
reset role;
update dm_private.exam_mock_blueprints set enabled=true where exam in('uceed','ceed');
set local role authenticated;
select public.admin_upsert_learning_lesson(null,'verified-section-theory','uceed','verified-section',
  'Fictional section theory','A fictional lesson summary.','An original test lesson body for release verification.',1,true,true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select pg_temp.section_assert((public.exam_mock_catalog()->3->>'sectionLabel')='Part A','catalog declares verified section');
select pg_temp.section_assert(not(public.exam_mock_catalog()->3->>'ready')::boolean
  and not(public.exam_mock_catalog()->0->>'ready')::boolean,'both mixed exams remain unready with pre-existing release settings');
select pg_temp.section_reject('select public.start_exam_mock(''uceed'')','UCEED cannot start from legacy bank');
select pg_temp.section_reject('select public.start_exam_mock(''ceed'')','CEED cannot start from legacy bank');
reset role;
select pg_temp.section_assert(not exists(select 1 from dm_private.attempts),'rejected mixed exams leave no attempt');

-- Materialize the snapshots an earlier version could have created.
create function pg_temp.historical_exam_attempt(
  p_source text,p_title text,p_topic text,p_duration integer,p_upload_grace integer,p_deadline timestamptz
) returns uuid language plpgsql as $$
declare
  student constant uuid := '00000000-0000-4000-8000-000000000071';
  paper uuid; attempt uuid;
begin
  insert into dm_private.papers(title,exam,duration_seconds,upload_grace_seconds,published,reviewed,
    rights_confirmed,owner_user_id,source_kind)
    values(p_title,'uceed',p_duration,p_upload_grace,false,true,true,student,p_source)
    returning id into paper;
  insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
    select md5(paper::text||external_key)::uuid,paper,
      row_number() over(order by case runtime_payload->>'kind' when 'nat' then 1 when 'msq' then 2 else 3 end,external_key),
      runtime_payload->>'prompt',runtime_payload->'options',runtime_payload->>'kind',
      runtime_payload->'marking',runtime_payload->'media',(runtime_payload->>'points')::numeric,
      (runtime_payload->>'negativePoints')::numeric,topic,true
    from dm_private.bank_questions where topic=p_topic and external_key not like 'parallel-%';
  insert into dm_private.answer_keys(question_id,key,explanation)
    select md5(paper::text||external_key)::uuid,runtime_payload->'key',runtime_payload->>'explanation'
    from dm_private.bank_questions where topic=p_topic and external_key not like 'parallel-%';
  insert into dm_private.attempts(user_id,paper_id,deadline) values(student,paper,p_deadline) returning id into attempt;
  insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
    select attempt,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation
    from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=paper;
  return attempt;
end $$;
select set_config('test.section_attempt',
  pg_temp.historical_exam_attempt('exam','UCEED 2027 Part A mock','verified-section',7200,0,now()+interval '2 hours')::text,true);
select set_config('test.section_question',(select question_id::text from dm_private.attempt_items where attempt_id=current_setting('test.section_attempt')::uuid order by ordinal limit 1),true);
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
select pg_temp.section_reject('select public.start_exam_mock_part_b(current_setting(''test.section_attempt'')::uuid)','fresh Part B tasks are unavailable before the fixed Part A clock ends');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000072',true);
select pg_temp.section_reject('select public.start_exam_mock_part_b(current_setting(''test.section_attempt'')::uuid)','another user cannot open the student session');
reset role;
update dm_private.attempts set deadline=now()-interval '1 second' where id=current_setting('test.section_attempt')::uuid;
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select pg_temp.section_assert(public.my_exam_mock_session(current_setting('test.section_attempt')::uuid)->>'partBState'='unavailable','legacy Part A can no longer generate old tasks at its fixed deadline');
select pg_temp.section_assert((public.my_exam_mock_session(current_setting('test.section_attempt')::uuid)->>'partBTaskCount')::integer=2 and(public.my_exam_mock_session(current_setting('test.section_attempt')::uuid)->>'partBDurationSeconds')::integer=3600,'official UCEED Part B count and clock are exposed');
select pg_temp.section_reject('select public.start_exam_mock_part_b(current_setting(''test.section_attempt'')::uuid)','legacy drawing tasks cannot be generated in the Part B window');
reset role;
select pg_temp.section_assert(not exists(select 1 from dm_private.papers where source_kind='exam_part_b'),'blocked Part B leaves no paper');
select set_config('test.part_b_attempt',
  pg_temp.historical_exam_attempt('exam_part_b','UCEED 2027 Part B mock','verified-drawing',3600,900,now()+interval '3599 seconds')::text,true);
update dm_private.exam_mock_sessions set part_b_attempt=current_setting('test.part_b_attempt')::uuid
where part_a_attempt=current_setting('test.section_attempt')::uuid;
set local role authenticated;
select pg_temp.section_assert(public.my_exam_mock_session(current_setting('test.section_attempt')::uuid)->>'partBState'='started','previously frozen Part B remains resumable');
select pg_temp.section_assert(public.start_exam_mock_part_b(current_setting('test.section_attempt')::uuid)=current_setting('test.part_b_attempt')::uuid,'Part B start retry is idempotent');
reset role;
select pg_temp.section_assert((select count(*)=2 and bool_and(kind='drawing')and sum(points)=100 from dm_private.attempt_items where attempt_id=current_setting('test.part_b_attempt')::uuid),'historical Part B retains its two frozen drawing tasks');
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
select pg_temp.section_assert((public.read_attempt(current_setting('test.part_b_attempt')::uuid)->>'score')::numeric=0
  and(public.read_attempt(current_setting('test.part_b_attempt')::uuid)->>'total')::numeric=100
  and public.read_attempt(current_setting('test.part_b_attempt')::uuid)->>'scoreKind'='drawing',
  'missing drawings receive zero marks against the frozen Part B maximum after the upload window');
reset role;
insert into dm_private.drawing_uploads(attempt_id,question_id,student_id,storage_path,ordinal,mime_type,byte_size)
select i.attempt_id,i.question_id,'00000000-0000-4000-8000-000000000071','drawings/part-b-private-'||i.ordinal||'.png',1,'image/png',99
from dm_private.attempt_items i where i.attempt_id=current_setting('test.part_b_attempt')::uuid;
insert into dm_private.drawing_reviews(attempt_id,question_id)
select i.attempt_id,i.question_id from dm_private.attempt_items i where i.attempt_id=current_setting('test.part_b_attempt')::uuid;
select r.id as first_review from dm_private.drawing_reviews r join dm_private.attempt_items i
  on i.attempt_id=r.attempt_id and i.question_id=r.question_id where i.attempt_id=current_setting('test.part_b_attempt')::uuid and i.ordinal=1 \gset
select r.id as second_review from dm_private.drawing_reviews r join dm_private.attempt_items i
  on i.attempt_id=r.attempt_id and i.question_id=r.question_id where i.attempt_id=current_setting('test.part_b_attempt')::uuid and i.ordinal=2 \gset
insert into dm_private.drawing_ai_suggestions(review_id,provider,model,rubric_version,criterion_marks,comments,proposed_score,confidence)
values(:'first_review','fictional-provider','fictional-model','fixture-rubric','{"composition":49}','Private Part B AI advisory',49,0.9);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000072',true);
select public.admin_claim_drawing_review(:'first_review'::uuid);
select public.admin_review_drawing(:'first_review'::uuid,1,'{"composition":45}','Fictional first released feedback.',45);
select public.admin_release_drawing_review(:'first_review'::uuid,2);
select public.admin_claim_drawing_review(:'second_review'::uuid);
select public.admin_review_drawing(:'second_review'::uuid,1,'{"composition":40}','Fictional second released feedback.',40);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select pg_temp.section_assert((public.my_exam_mock_report(current_setting('test.part_b_attempt')::uuid)->>'resultsPending')::boolean,
  'a partial teacher release keeps the full combined exam pending');
select pg_temp.section_assert((public.read_attempt(current_setting('test.part_b_attempt')::uuid)->>'examResultsPending')::boolean
  and public.read_attempt(current_setting('test.part_b_attempt')::uuid)->'score'='null'::jsonb
  and public.read_attempt(current_setting('test.part_b_attempt')::uuid)->'total'='null'::jsonb
  and not exists(select 1 from jsonb_array_elements(public.read_attempt(current_setting('test.part_b_attempt')::uuid)->'questions')value
    where value ?| array['correctKey','awarded'] or value->'drawingReview'->>'status'='released'
      or value->'drawingReview'?|array['score','criteria','comments','releasedAt']),
  'Part B feedback and scalar marks stay sealed until every submitted review is released');
select pg_temp.section_assert((select bool_and(value->'score'='null'::jsonb and value->'total'='null'::jsonb)
    from jsonb_array_elements(public.my_attempt_history())value)
  and (select bool_and(value->'score'='null'::jsonb and value->'total'='null'::jsonb)
    from jsonb_array_elements(public.export_my_account_data()->'attempts')value)
  and public.export_my_account_data()->'results'->'drawingReviews'='[]'::jsonb,
  'history and account exports keep the partial combined result private');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000072',true);
select public.admin_release_drawing_review(:'second_review'::uuid,2);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select pg_temp.section_assert((public.my_exam_mock_report(current_setting('test.section_attempt')::uuid)->>'combinedScore')::numeric=89,
  'released combined fixture is 89/300');
select pg_temp.section_assert((public.read_attempt(current_setting('test.part_b_attempt')::uuid)->>'score')::numeric=85
  and(public.read_attempt(current_setting('test.part_b_attempt')::uuid)->>'total')::numeric=100
  and(public.read_attempt(current_setting('test.part_b_attempt')::uuid)->'questions'->0->'drawingReview'->>'score')::numeric=45,
  'the released Part B paper uses human marks and the frozen full maximum');
select pg_temp.section_assert((select(value->>'score')::numeric=85 and(value->>'total')::numeric=100
    from jsonb_array_elements(public.my_attempt_history())value where value->>'id'=current_setting('test.part_b_attempt'))
  and(select(value->>'score')::numeric=85 and(value->>'total')::numeric=100
    from jsonb_array_elements(public.export_my_account_data()->'attempts')value where value->>'id'=current_setting('test.part_b_attempt')),
  'Part B history and account export agree with the released human grade');
select pg_temp.section_assert(position('Private Part B AI advisory' in public.read_attempt(current_setting('test.part_b_attempt')::uuid)::text)=0
  and position('Private Part B AI advisory' in public.export_my_account_data()::text)=0
  and position('drawings/part-b-private-' in public.export_my_account_data()::text)=0,
  'released student results exclude model advice and private Storage paths');
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
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000072',true);
select pg_temp.section_reject('select public.read_attempt(current_setting(''test.part_b_attempt'')::uuid)','another account cannot read Part B results');
select pg_temp.section_assert(public.my_attempt_history()='[]'::jsonb and public.export_my_account_data()->'attempts'='[]'::jsonb,
  'administrator identity does not expose student results through personal history or export');
select pg_temp.section_reject('select dm_private.student_attempt_visibility(auth.uid())','student visibility helper remains private');
reset role;
select pg_temp.section_assert((select score=0 and total=0 from dm_private.attempts where id=current_setting('test.part_b_attempt')::uuid),
  'human grading does not overwrite stored objective marks or frozen attempt data');
rollback;
\echo 'PASS: mixed mocks fail closed, and historical UCEED sections retain snapshots, grades and authorization.'
