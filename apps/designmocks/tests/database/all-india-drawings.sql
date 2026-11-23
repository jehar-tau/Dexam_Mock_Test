\set ON_ERROR_STOP on
begin;

create function pg_temp.cohort_assert(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
end $$;
create function pg_temp.cohort_reject(statement text,expected_error text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_error in sqlerrm)>0 then return; end if;
    raise;
  end;
  raise exception 'FAIL, expected error: %',expected_error;
end $$;

insert into auth.users(id) select md5('cohort-candidate-'||n)::uuid from generate_series(1,13)n;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000093');
insert into dm_private.admins(user_id) values('00000000-0000-4000-8000-000000000093');
insert into public.profiles(user_id,display_name,phone_e164,phone_verified_at,appearing_year,city,exams,onboarding_completed_at)
  select md5('cohort-candidate-'||n)::uuid,'Fictional candidate '||n,'+9199900000'||lpad(n::text,2,'0'),
    now(),2027,'Pune',array['uceed'],now() from generate_series(1,13)n;
insert into dm_private.orders(user_id,plan_id,amount,currency,mode,status)
  select user_id,'annual',119300,'INR','test','paid' from public.profiles;
insert into dm_private.passes(user_id,order_id,mode,starts_at,expires_at)
  select user_id,id,'test',now(),now()+interval '1 year' from dm_private.orders;

insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,objective_ready,
  owner_approved,rights_confirmed,active,payload,runtime_payload,source_commit)
values(
  'cohort-objective',repeat('a',64),'uceed','MCQ','fixture','owned',true,true,true,true,'{"holds":[]}',
  '{"kind":"mcq","prompt":"Original cohort objective","options":[{"id":"A","label":"A"},{"id":"B","label":"B"}],
  "marking":{"correct":4,"wrong":-1},"media":[],"points":4,"negativePoints":1,
  "key":{"kind":"mcq","correct":["A"]},"explanation":"Fictional key explanation"}',repeat('d',40)
),(
  'cohort-drawing',repeat('b',64),'uceed','DESCRIPTIVE','fixture','owned',false,true,true,true,'{"holds":[]}',
  '{"kind":"drawing","prompt":"Draw an original reading light","options":[],"marking":{"correct":20,"wrong":0,"humanReview":true},
  "media":[],"points":20,"negativePoints":0,"key":{"kind":"drawing"},"explanation":"Human review"}',repeat('d',40)
),(
  'cohort-unreviewed-drawing',repeat('c',64),'uceed','DESCRIPTIVE','fixture','owned',false,false,false,true,'{"holds":[]}',
  '{"kind":"drawing","prompt":"Unreviewed drawing","options":[],"marking":{"correct":20,"wrong":0,"humanReview":true},
  "media":[],"points":20,"negativePoints":0,"key":{"kind":"drawing"},"explanation":"Human review"}',repeat('d',40)
);
select pg_temp.cohort_reject(
  'update dm_private.bank_questions set payload=''{"holds":["review"]}'' where external_key=''cohort-unreviewed-drawing''',
  'bank_questions_payload_check');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',md5('cohort-candidate-1')::uuid::text,true);
select pg_temp.cohort_reject(
  'select public.admin_create_all_india_event(''uceed'',''Fictional cohort'',now()+interval ''1 hour'',10,900,0,600)',
  'Admin access required');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000093',true);
select pg_temp.cohort_reject(
  'select public.admin_create_all_india_event(''uceed'',''Fictional cohort'',now()+interval ''1 hour'',10,900,1,600)',
  'Only objective All India events are available');
reset role;
-- Existing drawing grading remains covered by a historical fixed-paper fixture;
-- new event creation intentionally offers objective questions only.
insert into dm_private.papers(title,exam,duration_seconds,published,reviewed,rights_confirmed,source_kind,upload_grace_seconds)
  values('Fictional historical cohort','uceed',900,false,true,true,'all_india',600)
  returning id as cohort_paper \gset
insert into dm_private.questions(paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
  select :'cohort_paper',case when external_key='cohort-objective' then 1 else 2 end,
    runtime_payload->>'prompt',runtime_payload->'options',runtime_payload->>'kind',runtime_payload->'marking',
    runtime_payload->'media',(runtime_payload->>'points')::numeric,(runtime_payload->>'negativePoints')::numeric,
    topic,true from dm_private.bank_questions where external_key in('cohort-objective','cohort-drawing');
insert into dm_private.answer_keys(question_id,key,explanation)
  select q.id,b.runtime_payload->'key',b.runtime_payload->>'explanation'
  from dm_private.questions q join dm_private.bank_questions b on b.runtime_payload->>'prompt'=q.prompt
  where q.paper_id=:'cohort_paper';
insert into dm_private.all_india_events(exam,title,paper_id,starts_at,ends_at,review_ends_at,created_by)
  values('uceed','Fictional historical cohort',:'cohort_paper',now()+interval '1 hour',
    now()+interval '10 days 1 hour',now()+interval '20 days 1 hour','00000000-0000-4000-8000-000000000093')
  returning id as cohort_event \gset
select set_config('test.cohort_event',:'cohort_event',true);
select set_config('test.cohort_paper',:'cohort_paper',true);
select set_config('test.cohort_objective',
  (select id::text from dm_private.questions where paper_id=:'cohort_paper' and kind='mcq'),true);
select set_config('test.cohort_drawing',
  (select id::text from dm_private.questions where paper_id=:'cohort_paper' and kind='drawing'),true);
select pg_temp.cohort_assert((select count(*)=2 and count(*) filter(where kind='drawing' and ordinal=2)=1
  from dm_private.questions where paper_id=current_setting('test.cohort_paper')::uuid),'one identical paper with a frozen drawing section');
set local role authenticated;
select pg_temp.cohort_reject('select public.admin_set_paper_upload_grace(current_setting(''test.cohort_paper'')::uuid,900)',
  'frozen at scheduling');
reset role;
update dm_private.all_india_events set starts_at=now()-interval '1 day',ends_at=now()+interval '9 days',review_ends_at=now()+interval '19 days'
  where id=current_setting('test.cohort_event')::uuid;

-- Historical drawing cohort snapshots are inserted as a test fixture. New All
-- India admissions now require reviewed parallel objective questions.
insert into dm_private.attempts(id,user_id,paper_id,started_at,deadline)
  select md5('cohort-attempt-'||n)::uuid,md5('cohort-candidate-'||n)::uuid,
    current_setting('test.cohort_paper')::uuid,now(),now()+interval '15 minutes'
    from generate_series(1,12)n;
insert into dm_private.all_india_attempts(event_id,user_id,attempt_id)
  select current_setting('test.cohort_event')::uuid,
    md5('cohort-candidate-'||n)::uuid,md5('cohort-attempt-'||n)::uuid
    from generate_series(1,12)n;
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,key,explanation)
  select a.id,q.id,q.ordinal,q.prompt,q.options,q.kind,q.marking,q.media,q.points,q.negative_points,q.topic,k.key,k.explanation
  from dm_private.attempts a join dm_private.questions q on q.paper_id=a.paper_id
  join dm_private.answer_keys k on k.question_id=q.id
  where a.paper_id=current_setting('test.cohort_paper')::uuid;
select set_config('test.cohort_attempt',md5('cohort-attempt-1')::uuid::text,true);
set local role authenticated;
do $$
begin
  for candidate in 1..12 loop
    perform set_config('request.jwt.claim.sub',md5('cohort-candidate-'||candidate)::uuid::text,true);
    perform public.save_answer_revision(md5('cohort-attempt-'||candidate)::uuid,
      current_setting('test.cohort_objective')::uuid,
      to_jsonb(case when candidate=1 then 'B'::text else 'A'::text end),1);
  end loop;
end $$;
select set_config('request.jwt.claim.sub',md5('cohort-candidate-1')::uuid::text,true);
select pg_temp.cohort_reject('select public.start_all_india_attempt(current_setting(''test.cohort_event'')::uuid)','only be attempted once');
select pg_temp.cohort_assert(public.submit_attempt(current_setting('test.cohort_attempt')::uuid)->'questions'='[]'::jsonb,
  'submitted cohort questions and keys remain sealed');
select pg_temp.cohort_assert((select a->'score'='null'::jsonb and a->'cohortResult'='null'::jsonb
  and (a->>'uploadDeadline')::timestamptz=(a->>'deadline')::timestamptz+interval '10 minutes'
  and jsonb_array_length(a->'drawingUploadTasks')=1
  and a->'drawingUploadTasks'->0->>'id'=current_setting('test.cohort_drawing')
  and not((a->'drawingUploadTasks'->0)?|array['correctKey','explanation','outcome','drawingReview'])
  from public.read_attempt(current_setting('test.cohort_attempt')::uuid)a),'reopening an embargoed attempt exposes only the fixed drawing upload task');
reset role;
select pg_temp.cohort_assert((select count(*)=24 and count(distinct question_id)=2
  from dm_private.attempt_items where attempt_id in(select attempt_id from dm_private.all_india_attempts)),
  'twelve candidate snapshots use the same two question IDs');
select pg_temp.cohort_assert((select bool_and(deadline-started_at=interval '15 minutes') from dm_private.attempts),
  'every candidate receives the full exam clock');

insert into storage.objects(bucket_id,name,metadata)
  values('drawing-submissions','drawings/31000000-0000-4000-8000-000000000093.png','{"mimetype":"image/png","size":1024}');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.register_drawing_upload(md5('cohort-candidate-1')::uuid,
  current_setting('test.cohort_attempt')::uuid,current_setting('test.cohort_drawing')::uuid,
  'drawings/31000000-0000-4000-8000-000000000093.png',1,'image/png',1024);
reset role;
select set_config('test.cohort_review',(select id::text from dm_private.drawing_reviews),true);

update dm_private.all_india_events set starts_at=now()-interval '10 days'+interval '5 minutes',
  ends_at=now()+interval '5 minutes',review_ends_at=now()+interval '10 days 5 minutes';
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',md5('cohort-candidate-13')::uuid::text,true);
select pg_temp.cohort_assert(public.all_india_event_catalog()->0->>'state'='paused','legacy drawing cohort admits no new students');
select pg_temp.cohort_reject('select public.start_all_india_attempt(current_setting(''test.cohort_event'')::uuid)','paused for fresh-question review');
reset role;
update dm_private.all_india_events set starts_at=now()-interval '21 days',ends_at=now()-interval '11 days',review_ends_at=now()-interval '1 day';
update dm_private.attempts set started_at=now()-interval '11 days 35 minutes',deadline=now()-interval '11 days 20 minutes',
  upload_deadline=case when status='submitted' then now()-interval '11 days 10 minutes' end,
  submitted_at=case when status='submitted' then now()-interval '11 days 34 minutes' end;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000093',true);
select pg_temp.cohort_assert((public.admin_all_india_events()->0->>'pendingDrawingReviews')::integer=1
  and not(public.admin_all_india_events()->0->>'canRelease')::boolean,'review status reports the blocking drawing');
select pg_temp.cohort_reject('select public.admin_release_all_india_results(current_setting(''test.cohort_event'')::uuid)','Finalize every submitted drawing review');
select public.admin_claim_drawing_review(current_setting('test.cohort_review')::uuid);
select public.admin_review_drawing(current_setting('test.cohort_review')::uuid,1,'{"composition":17}',
  'Effective use of space.',17);
select pg_temp.cohort_reject('select public.admin_release_all_india_results(current_setting(''test.cohort_event'')::uuid)','Finalize every submitted drawing review');
select public.admin_release_drawing_review(current_setting('test.cohort_review')::uuid,2);
select pg_temp.cohort_assert((public.admin_all_india_events()->0->>'canRelease')::boolean,'all submitted drawings are finalized');
select set_config('request.jwt.claim.sub',md5('cohort-candidate-1')::uuid::text,true);
select pg_temp.cohort_assert((select a->'questions'='[]'::jsonb and a->'drawingUploadTasks'='[]'::jsonb and a->'score'='null'::jsonb
  from public.read_attempt(current_setting('test.cohort_attempt')::uuid)a),'closed uploads and finalized grades remain sealed');
select pg_temp.cohort_assert(public.all_india_event_catalog()->0->'result'='null'::jsonb
  and public.public_all_india_top_ten()='[]'::jsonb,'personal and public rankings wait for cohort release');
select pg_temp.cohort_assert(public.my_overview_analytics()->'drawingReviews'='{"pending":1,"released":0}'::jsonb,
  'Overview keeps a finalized cohort drawing pending until publication');
select pg_temp.cohort_assert(public.my_overview_analytics()->'exams'='[]'::jsonb,
  'unpublished cohort marks do not contribute exam percentages');
select pg_temp.cohort_assert(public.export_my_account_data()->'results'->'drawingReviews'='[]'::jsonb
  and public.export_my_account_data()->'results'->'allIndia'='[]'::jsonb,'a finalized teacher grade stays out of export until cohort publication');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000093',true);
select public.admin_release_all_india_results(current_setting('test.cohort_event')::uuid);
select pg_temp.cohort_reject(
  'select public.admin_review_drawing(current_setting(''test.cohort_review'')::uuid,3,''{"composition":18}'',''Changed after release.'',18,''Reconsidered marks'')',
  'Published All India grades are frozen');
select pg_temp.cohort_assert((public.admin_drawing_queue()->0->>'cohortFrozen')::boolean,'published drawing review is marked frozen in the queue');
select set_config('request.jwt.claim.sub',md5('cohort-candidate-1')::uuid::text,true);
select pg_temp.cohort_assert((select (a->>'score')::numeric=16 and (a->>'total')::numeric=24
  and (a->'cohortResult'->>'rank')::integer=1 and (a->'cohortResult'->>'drawingScore')::numeric=17
  and a->'questions'->1->'drawingReview'->>'comments'='Effective use of space.'
  from public.read_attempt(current_setting('test.cohort_attempt')::uuid)a),'result uses objective plus drawing marks and releases feedback together');
select pg_temp.cohort_assert((public.all_india_event_catalog()->0->'result'->>'cohortSize')::integer=12
  and (public.my_attempt_history()->0->>'cohortRank')::integer=1
  and (public.my_attempt_history()->0->>'score')::numeric=16,'overview and event catalogue show the same personal standings');
select pg_temp.cohort_assert(public.my_overview_analytics()->'drawingReviews'='{"pending":0,"released":1}'::jsonb,
  'Overview counts a published drawing result as released');
select pg_temp.cohort_assert((select(value->>'averagePercent')::integer=67 and(value->>'bestPercent')::integer=67
  and(value->>'attempts')::integer=1 from jsonb_array_elements(public.my_overview_analytics()->'exams')value where value->>'exam'='uceed'),
  'published mixed cohort Overview percentage must be 67');
select pg_temp.cohort_assert((select (value->>'score')::numeric=16 and(value->>'total')::numeric=24 from jsonb_array_elements(public.export_my_account_data()->'attempts')
  where value->>'id'=current_setting('test.cohort_attempt'))
  and(public.export_my_account_data()->'results'->'allIndia'->0->>'score')::numeric=16
  and(public.export_my_account_data()->'results'->'drawingReviews'->0->>'score')::numeric=17,
  'exported attempt, cohort standings and released drawing feedback use the published marks');
reset role;
select pg_temp.cohort_assert((select bool_and(elapsed_seconds=900 and total=24) and count(*) filter(where rank=2 and score=4)=11
  from dm_private.all_india_results),'drawing ties ignore early submission speed and missing drawing pages score zero');
set local role anon;
select pg_temp.cohort_assert(public.public_all_india_top_ten()='[]'::jsonb,
  'released mixed cohort standings stay private without publication approval and consent');
rollback;
\echo 'PASS: mixed All India snapshots, fixed upload grace, sealed drawing review and reproducible combined ranks.'
