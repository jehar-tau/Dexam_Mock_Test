\set ON_ERROR_STOP on
begin;

create function pg_temp.fixed_assert(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
end $$;
create function pg_temp.fixed_reject(statement text,expected_error text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_error in sqlerrm)>0 then return; end if;
    raise;
  end;
  raise exception 'FAIL, expected error: %',expected_error;
end $$;

-- Fictional accounts: an admin and four free students with completed profiles; no passes.
insert into auth.users(id,email_confirmed_at) select md5('fixed-student-'||n)::uuid,now() from generate_series(1,4)n;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000196');
insert into dm_private.admins(user_id) values('00000000-0000-4000-8000-000000000196');
insert into public.profiles(user_id,display_name,phone_e164,phone_verified_at,appearing_year,city,exams,onboarding_completed_at)
  select md5('fixed-student-'||n)::uuid,'Fictional student '||n,'+9199800000'||lpad(n::text,2,'0'),
    now(),2027,'Pune',array['nid'],now() from generate_series(1,4)n;

-- One registered private figure, as the operator upload leaves it.
insert into dm_private.bank_media_assets(sha256,storage_path,width,height,byte_size)
  values(repeat('e',64),'papers/canonical/'||repeat('e',64)||'.png',640,480,2048);
insert into storage.buckets(id,name,public) values('paper-media','paper-media',false) on conflict do nothing;
insert into storage.objects(bucket_id,name,metadata)
  values('paper-media','papers/canonical/'||repeat('e',64)||'.png','{"mimetype":"image/png","size":"2048"}');

create temporary table fixed_plan(plan jsonb) on commit drop;
grant select on fixed_plan to authenticated,service_role;
insert into fixed_plan values('{
  "format":"dmocks-all-india-paper-v1","paperKey":"nid-bdes-aim-9","exam":"nid",
  "title":"Fictional NID All India Mock","durationSeconds":10800,"uploadGraceSeconds":600,"totalMarks":24,
  "markingReference":"Fictional pattern for a database test.",
  "questions":[
    {"externalKey":"nid-bdes-aim-9-q1","number":1,"contentSha256":"1111111111111111111111111111111111111111111111111111111111111111",
     "questionType":"MCQ","topic":"visual-reasoning",
     "payload":{"holds":[],"sourceKind":"original","licence":"dmocks-original","provenance":{"kind":"all-india-mock","paperId":"nid-bdes-aim-9"}},
     "runtime":{"kind":"mcq","prompt":"Fictional original choice question","options":[{"id":"A","label":"First"},{"id":"B","label":"Second"}],
       "marking":{"correct":4,"wrong":-1},"media":[{"path":"papers/canonical/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png",
       "alt":"Question figure 1","sha256":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","width":640,"height":480}],
       "points":4,"negativePoints":1,"key":{"kind":"mcq","correct":["A"],"sourceExternalKey":"nid-bdes-aim-9-q1"},
       "explanation":"Fictional worked explanation for the first option."}},
    {"externalKey":"nid-bdes-aim-9-b1","number":1,"contentSha256":"2222222222222222222222222222222222222222222222222222222222222222",
     "questionType":"DESCRIPTIVE","topic":"drawing",
     "payload":{"holds":[],"sourceKind":"original","licence":"dmocks-original","provenance":{"kind":"all-india-mock","paperId":"nid-bdes-aim-9"}},
     "runtime":{"kind":"drawing","prompt":"Draw a fictional original lamp","options":[],"marking":{"correct":20,"wrong":0,"humanReview":true},
       "media":[],"points":20,"negativePoints":0,"key":{"kind":"drawing","sourceExternalKey":"nid-bdes-aim-9-b1"},
       "explanation":"Marked by a teacher on idea, drawing and clarity."}}
  ]}');

-- Staging is service-only and exact.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000196',true);
select pg_temp.fixed_reject('select public.stage_all_india_paper((select plan from fixed_plan),repeat(''a'',64))','permission denied for function stage_all_india_paper');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.fixed_reject($q$select public.stage_all_india_paper((select jsonb_set(plan,'{questions,0,payload,sourceKind}','"official"') from fixed_plan),repeat('a',64))$q$,
  'Invalid All India question 1');
select pg_temp.fixed_reject($q$select public.stage_all_india_paper((select jsonb_set(plan,'{questions,0,runtime,key,correct}','["C"]') from fixed_plan),repeat('a',64))$q$,
  'Invalid All India answer key 1');
select pg_temp.fixed_reject($q$select public.stage_all_india_paper((select jsonb_set(plan,'{uploadGraceSeconds}','0') from fixed_plan),repeat('a',64))$q$,
  'Invalid All India upload window');
select pg_temp.fixed_reject($q$select public.stage_all_india_paper((select jsonb_set(plan,'{totalMarks}','30') from fixed_plan),repeat('a',64))$q$,
  'plan total does not match');
select pg_temp.fixed_reject($q$select public.stage_all_india_paper((select jsonb_set(plan,'{questions,0,runtime,media,0,sha256}','"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"') from fixed_plan),repeat('a',64))$q$,
  'not a registered private image');
select set_config('test.staged',public.stage_all_india_paper((select plan from fixed_plan),repeat('a',64))::text,true);
select pg_temp.fixed_assert((current_setting('test.staged')::jsonb->>'objectiveCount')::integer=1
  and (current_setting('test.staged')::jsonb->>'drawingCount')::integer=1
  and (current_setting('test.staged')::jsonb->>'totalMarks')::numeric=24
  and not (current_setting('test.staged')::jsonb->>'reused')::boolean,'the plan stages one fixed paper');
select pg_temp.fixed_assert((public.stage_all_india_paper((select plan from fixed_plan),repeat('a',64))->>'reused')::boolean
  and public.stage_all_india_paper((select plan from fixed_plan),repeat('a',64))->>'manifestSha256'=current_setting('test.staged')::jsonb->>'manifestSha256',
  'an exact retry returns the same staged paper');
select pg_temp.fixed_reject('select public.stage_all_india_paper((select plan from fixed_plan),repeat(''b'',64))','already staged with a different plan');
reset role;

-- Hidden everywhere else: inactive bank rows, unpublished paper, no practice or year-paper listing.
select pg_temp.fixed_assert((select count(*)=2 and bool_and(not active and owner_approved and rights_confirmed and licence='dmocks-original'
  and payload#>>'{provenance,kind}'='all-india-mock' and payload->>'sourceKind'='original')
  from dm_private.bank_questions where external_key like 'nid-bdes-aim-9-%'),'bank rows are original, owner approved and inactive');
select pg_temp.fixed_assert((select not published and source_kind='all_india' and upload_grace_seconds=600 and duration_seconds=10800
  from dm_private.papers where id=(current_setting('test.staged')::jsonb->>'paperId')::uuid),'the fixed paper is unpublished with its own timer');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',md5('fixed-student-1')::uuid::text,true);
select pg_temp.fixed_assert(public.topic_catalog()::text not like '%visual-reasoning%','topic practice cannot see the staged questions');
select pg_temp.fixed_assert(public.free_year_paper_catalog()::text not like '%Fictional NID All India%','Papers cannot see the staged paper');
select pg_temp.fixed_assert(public.all_india_event_catalog()='[]'::jsonb,'an unscheduled paper is not an event');
select pg_temp.fixed_reject('select public.admin_all_india_papers()','Admin access required');
select pg_temp.fixed_reject($q$select public.admin_schedule_all_india_paper('nid-bdes-aim-9','Fictional event',now()+interval '1 day',now()+interval '4 days',now()+interval '8 days',2,'free')$q$,
  'Admin access required');

-- Admin schedules a three-day window with two seats, free entry.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000196',true);
select pg_temp.fixed_assert(public.admin_all_india_papers()->0->>'paperKey'='nid-bdes-aim-9'
  and public.admin_all_india_papers()->0->'eventId'='null'::jsonb,'admin sees the staged paper');
select pg_temp.fixed_reject($q$select public.admin_schedule_all_india_paper('nid-bdes-aim-8','Fictional event',now()+interval '1 day',now()+interval '4 days',now()+interval '8 days',2,'free')$q$,
  'Stage this All India paper first');
select pg_temp.fixed_reject($q$select public.admin_schedule_all_india_paper('nid-bdes-aim-9','Fictional event',now()+interval '1 day',now()+interval '1 day 2 hours',now()+interval '8 days',2,'free')$q$,
  'must allow a full attempt');
select pg_temp.fixed_reject($q$select public.admin_schedule_all_india_paper('nid-bdes-aim-9','Fictional event',now()+interval '1 day',now()+interval '4 days',now()+interval '3 days',2,'free')$q$,
  'Results must follow the window');
select set_config('test.event',public.admin_schedule_all_india_paper('nid-bdes-aim-9','Fictional NID All India Mock',
  now()+interval '1 day',now()+interval '4 days',now()+interval '8 days',2,'free')::text,true);
select pg_temp.fixed_reject($q$select public.admin_schedule_all_india_paper('nid-bdes-aim-9','Fictional event again',now()+interval '20 days',now()+interval '23 days',now()+interval '25 days',2,'free')$q$,
  'already scheduled');
select pg_temp.fixed_assert((select (value->>'seatCap')::integer=2 and (value->>'seatsTaken')::integer=0 and value->>'entry'='free'
  and (value->>'paperReady')::boolean from jsonb_array_elements(public.admin_all_india_events()) value
  where value->>'id'=current_setting('test.event')),'admin sees seats and readiness');
reset role;

-- Signed-out visitors see the schedule and seats left, never questions.
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.fixed_assert((select jsonb_array_length(u)=1 and (u->0->>'seatsLeft')::integer=2 and (u->0->>'seatCap')::integer=2
  and u->0->>'entry'='free' and (u->0->>'durationSeconds')::integer=10800 and u::text not like '%Fictional original%'
  from public.public_all_india_upcoming() u),'the public schedule shows seats left and no content');
select pg_temp.fixed_reject('select public.all_india_event_catalog()','permission denied');
reset role;

-- Seats are first come, first served; free accounts need no pass.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',md5('fixed-student-1')::uuid::text,true);
select pg_temp.fixed_assert((select value->>'state'='scheduled' and not (value->>'registered')::boolean and (value->>'seatsLeft')::integer=2
  and not (value->>'qualityHeld')::boolean from jsonb_array_elements(public.all_india_event_catalog()) value),'the student sees a scheduled event');
select pg_temp.fixed_reject('select public.start_all_india_attempt(current_setting(''test.event'')::uuid)','no full attempt window');
select pg_temp.fixed_assert((public.register_all_india_event(current_setting('test.event')::uuid)->>'seatsLeft')::integer=1,'first student takes a seat');
select pg_temp.fixed_assert((public.register_all_india_event(current_setting('test.event')::uuid)->>'seatsLeft')::integer=1,'registering twice keeps one seat');
select set_config('request.jwt.claim.sub',md5('fixed-student-2')::uuid::text,true);
select pg_temp.fixed_assert((public.register_all_india_event(current_setting('test.event')::uuid)->>'seatsLeft')::integer=0,'second student takes the last seat');
select set_config('request.jwt.claim.sub',md5('fixed-student-3')::uuid::text,true);
select pg_temp.fixed_reject('select public.register_all_india_event(current_setting(''test.event'')::uuid)','All seats for this All India mock are taken');
select pg_temp.fixed_assert((public.all_india_event_catalog()->0->>'seatsLeft')::integer=0,'a full event shows no seats left');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000196',true);
select pg_temp.fixed_reject('select public.admin_set_all_india_seat_cap(current_setting(''test.event'')::uuid,1)','cannot be below the seats already taken');
select pg_temp.fixed_assert((public.admin_set_all_india_seat_cap(current_setting('test.event')::uuid,3)->>'seatCap')::integer=3,'admin can add a seat');
reset role;

-- The window opens.
update dm_private.all_india_events set starts_at=now()-interval '1 hour' where id=current_setting('test.event')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',md5('fixed-student-1')::uuid::text,true);
select pg_temp.fixed_assert(public.all_india_event_catalog()->0->>'state'='open','the window is open');
select set_config('test.attempt1',public.start_all_india_attempt(current_setting('test.event')::uuid)::text,true);
select pg_temp.fixed_reject('select public.start_all_india_attempt(current_setting(''test.event'')::uuid)','only be attempted once');
select set_config('request.jwt.claim.sub',md5('fixed-student-3')::uuid::text,true);
select set_config('test.attempt3',public.start_all_india_attempt(current_setting('test.event')::uuid)::text,true);
select set_config('request.jwt.claim.sub',md5('fixed-student-4')::uuid::text,true);
select pg_temp.fixed_reject('select public.start_all_india_attempt(current_setting(''test.event'')::uuid)','All seats for this All India mock are taken');
reset role;
select pg_temp.fixed_assert((select bool_and(deadline-started_at=interval '3 hours') and count(*)=2 from dm_private.attempts
  where id in(current_setting('test.attempt1')::uuid,current_setting('test.attempt3')::uuid)),'each student gets the paper''s own three-hour timer');
select pg_temp.fixed_assert((select count(*)=4 and count(distinct question_id)=2 from dm_private.attempt_items
  where attempt_id in(current_setting('test.attempt1')::uuid,current_setting('test.attempt3')::uuid)),'both students sit the same fixed paper');
select pg_temp.fixed_assert(dm_private.all_india_seats_taken(current_setting('test.event')::uuid)=3,'a start takes a seat');

-- Answer and submit; results stay sealed until release.
select set_config('test.mcq',(select id::text from dm_private.questions where paper_id=(current_setting('test.staged')::jsonb->>'paperId')::uuid and kind='mcq'),true);
select set_config('test.drawing',(select id::text from dm_private.questions where paper_id=(current_setting('test.staged')::jsonb->>'paperId')::uuid and kind='drawing'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub',md5('fixed-student-1')::uuid::text,true);
select public.save_answer_revision(current_setting('test.attempt1')::uuid,
  current_setting('test.mcq')::uuid,'"A"'::jsonb,1);
select pg_temp.fixed_assert(public.submit_attempt(current_setting('test.attempt1')::uuid)->'questions'='[]'::jsonb,'submitted keys stay sealed');
select pg_temp.fixed_assert((select a->'score'='null'::jsonb and (a->>'resultsPending')::boolean and jsonb_array_length(a->'drawingUploadTasks')=1
  from public.read_attempt(current_setting('test.attempt1')::uuid) a),'the drawing upload task opens after submission');
select set_config('request.jwt.claim.sub',md5('fixed-student-3')::uuid::text,true);
select public.save_answer_revision(current_setting('test.attempt3')::uuid,
  current_setting('test.mcq')::uuid,'"B"'::jsonb,1);
select public.submit_attempt(current_setting('test.attempt3')::uuid);
reset role;

-- Student 1 uploads a drawing; ranks wait for the teacher's mark.
insert into storage.objects(bucket_id,name,metadata)
  values('drawing-submissions','drawings/31000000-0000-4000-8000-000000000196.png','{"mimetype":"image/png","size":1024}');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.register_drawing_upload(md5('fixed-student-1')::uuid,current_setting('test.attempt1')::uuid,
  current_setting('test.drawing')::uuid,
  'drawings/31000000-0000-4000-8000-000000000196.png',1,'image/png',1024);
reset role;
select set_config('test.review',(select r.id::text from dm_private.drawing_reviews r where r.attempt_id=current_setting('test.attempt1')::uuid),true);
update dm_private.all_india_events set starts_at=now()-interval '5 days',ends_at=now()-interval '2 days',review_ends_at=now()-interval '1 minute'
  where id=current_setting('test.event')::uuid;
update dm_private.attempts set started_at=now()-interval '4 days',deadline=now()-interval '4 days'+interval '3 hours',
  submitted_at=now()-interval '4 days'+interval '2 hours',upload_deadline=now()-interval '4 days'+interval '3 hours 10 minutes'
  where id in(current_setting('test.attempt1')::uuid,current_setting('test.attempt3')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000196',true);
select pg_temp.fixed_reject('select public.admin_release_all_india_results(current_setting(''test.event'')::uuid)','Finalize every submitted drawing review');
select public.admin_claim_drawing_review(current_setting('test.review')::uuid);
select public.admin_review_drawing(current_setting('test.review')::uuid,1,'{"idea":8,"drawing":6}','Clear idea, steady lines.',14);
select public.admin_release_drawing_review(current_setting('test.review')::uuid,2);
select public.admin_release_all_india_results(current_setting('test.event')::uuid);
select set_config('request.jwt.claim.sub',md5('fixed-student-1')::uuid::text,true);
select pg_temp.fixed_assert((select value->>'state'='released' and (value->'result'->>'rank')::integer=1
  and (value->'result'->>'score')::numeric=18 and (value->'result'->>'total')::numeric=24 and (value->'result'->>'cohortSize')::integer=2
  from jsonb_array_elements(public.all_india_event_catalog()) value),'objective plus teacher marks rank student 1 first');
select set_config('request.jwt.claim.sub',md5('fixed-student-3')::uuid::text,true);
select pg_temp.fixed_assert((select (value->'result'->>'rank')::integer=2 and (value->'result'->>'score')::numeric=-1
  from jsonb_array_elements(public.all_india_event_catalog()) value),'a wrong answer and no drawing ranks second');
reset role;
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
select pg_temp.fixed_assert(public.public_all_india_upcoming()='[]'::jsonb,'a released event leaves the public schedule');
reset role;
rollback;
\echo 'PASS: private All India papers stage hidden, run a capped free three-day event, and rank with teacher marks.'
