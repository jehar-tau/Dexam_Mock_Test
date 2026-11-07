\set ON_ERROR_STOP on
\set first '00000000-0000-4000-8000-000000000281'
\set second '00000000-0000-4000-8000-000000000282'
\set teacher '00000000-0000-4000-8000-000000000283'
begin;
create function pg_temp.export_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
create function pg_temp.export_reject(statement text,expected text) returns void language plpgsql as $$
begin begin execute statement;exception when others then if position(expected in sqlerrm)>0 then return;end if;raise;end;
raise exception 'FAIL, expected error: %',expected;end $$;

insert into auth.users(id) values(:'first'),(:'second'),(:'teacher');
insert into dm_private.drawing_reviewers(user_id,enabled,changed_at) values(:'teacher',true,now());
insert into public.profiles(user_id,display_name,phone_e164,phone_verified_at,appearing_year,city,exams,onboarding_completed_at) values
  (:'first','Fictional first export student','+919999999981',now(),2027,'Mumbai',array['uceed'],now()),
  (:'second','Fictional second export student','+919999999982',now(),2027,'Pune',array['ceed'],now());
insert into dm_private.orders(user_id,plan_id,amount,currency,mode,status) values(:'first','annual',119300,'INR','test','paid'),(:'second','annual',119300,'INR','test','paid');
insert into dm_private.passes(user_id,order_id,mode,starts_at,expires_at) select user_id,id,'test',now(),now()+interval '1 year' from dm_private.orders;
insert into dm_private.papers(id,title,exam,duration_seconds,source_kind) values
  ('10000000-0000-4000-8000-000000000281','Fictional export paper','uceed',900,'catalogue'),
  ('10000000-0000-4000-8000-000000000282','Fictional export drawings','uceed',900,'catalogue');
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed) values
  ('20000000-0000-4000-8000-000000000281','10000000-0000-4000-8000-000000000281',1,'Fictional export question','[{"id":"A","label":"First"},{"id":"B","label":"Second"}]','mcq','{"correct":4,"wrong":-1}','[]',4,1,'observation',true),
  ('20000000-0000-4000-8000-000000000282','10000000-0000-4000-8000-000000000282',1,'Fictional released drawing','[]','drawing','{"correct":20,"wrong":0}','[]',20,0,'drawing',true),
  ('20000000-0000-4000-8000-000000000283','10000000-0000-4000-8000-000000000282',2,'Fictional pending drawing','[]','drawing','{"correct":20,"wrong":0}','[]',20,0,'drawing',true);
insert into dm_private.answer_keys(question_id,key,explanation) select id,case when kind='drawing' then '{"kind":"drawing"}'::jsonb else '{"kind":"mcq","correct":["B"]}'::jsonb end,
  'Private grading explanation' from dm_private.questions;
insert into dm_private.attempts(id,user_id,paper_id,status,started_at,deadline,submitted_at,score,total) values
  ('30000000-0000-4000-8000-000000000281',:'first','10000000-0000-4000-8000-000000000281','active',now(),now()+interval '15 minutes',null,7,4),
  ('30000000-0000-4000-8000-000000000282',:'first','10000000-0000-4000-8000-000000000281','submitted',now()-interval '30 minutes',now()-interval '15 minutes',now()-interval '15 minutes',4,4),
  ('30000000-0000-4000-8000-000000000283',:'first','10000000-0000-4000-8000-000000000282','submitted',now()-interval '30 minutes',now()-interval '15 minutes',now()-interval '15 minutes',0,40),
  ('30000000-0000-4000-8000-000000000284',:'second','10000000-0000-4000-8000-000000000281','submitted',now()-interval '30 minutes',now()-interval '15 minutes',now()-interval '15 minutes',4,4);
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,key,explanation,answer)
  select a.id,q.id,q.ordinal,q.prompt,q.options,q.kind,q.marking,q.media,q.points,q.negative_points,q.topic,k.key,k.explanation,
    case when q.kind='drawing' then null::jsonb when a.user_id=:'first' then '"B"'::jsonb else '"A"'::jsonb end
  from dm_private.attempts a join dm_private.questions q on q.paper_id=a.paper_id join dm_private.answer_keys k on k.question_id=q.id;
insert into dm_private.drawing_reviews(attempt_id,question_id,reviewer_id,status,criterion_marks,comments,score,reviewed_at,released_at) values
  ('30000000-0000-4000-8000-000000000283','20000000-0000-4000-8000-000000000282',:'teacher','released','{"composition":15}','Released personal feedback',15,now()-interval '2 minutes',now()-interval '1 minute'),
  ('30000000-0000-4000-8000-000000000283','20000000-0000-4000-8000-000000000283',:'teacher','reviewed','{"composition":18}','Unreleased private teacher note',18,now()-interval '1 minute',null);
insert into dm_private.drawing_ai_suggestions(review_id,provider,model,rubric_version,criterion_marks,comments,proposed_score,confidence)
  select id,'fictional-provider','fictional-model','fixture-rubric','{"composition":19}','Private advisory evidence',19,0.9 from dm_private.drawing_reviews where status='released';
insert into dm_private.drawing_uploads(attempt_id,question_id,student_id,storage_path,ordinal,mime_type,byte_size) values
  ('30000000-0000-4000-8000-000000000283','20000000-0000-4000-8000-000000000282',:'first','drawings/export/private-source.png',1,'image/png',99);

set local role anon;
select pg_temp.export_reject('select public.export_my_account_data()','permission denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.export_reject('select public.export_my_account_data()','Sign in required');
select set_config('request.jwt.claim.sub',:'first',true);
select public.report_attempt_question('30000000-0000-4000-8000-000000000281','20000000-0000-4000-8000-000000000281','incorrect','First student report text');
select public.submit_bug_report('Fictional first support issue','Fictional first student support description.','/account');
select set_config('request.jwt.claim.sub',:'second',true);
select public.report_attempt_question('30000000-0000-4000-8000-000000000284','20000000-0000-4000-8000-000000000281','media','Second student report text');
select public.submit_bug_report('Fictional second support issue','Fictional second student support description.','/account');
reset role;
select content_version as private_version from dm_private.question_reports where reporter_id=:'first' \gset
set local role authenticated;
select set_config('request.jwt.claim.sub',:'first',true);
select public.export_my_account_data() as exported \gset
select pg_temp.export_assert(:'exported'::jsonb->>'schemaVersion'='2' and :'exported'::jsonb->>'accountId'=:'first'
  and :'exported'::jsonb->'profile'->>'user_id'=:'first','an export is owned and versioned');
select pg_temp.export_assert(jsonb_array_length(:'exported'::jsonb->'attempts')=3 and jsonb_array_length(:'exported'::jsonb->'access'->'orders')=1
  and jsonb_array_length(:'exported'::jsonb->'access'->'passes')=1 and jsonb_array_length(:'exported'::jsonb->'bugReports')=1,'existing owned attempts, access and support records remain available');
select pg_temp.export_assert((select item->'score'='null'::jsonb and item->'total'='null'::jsonb and item->'responses'->0->>'answer'='B'
  from jsonb_array_elements(:'exported'::jsonb->'attempts') item where item->>'id'='30000000-0000-4000-8000-000000000281'),
  'active answers are included while provisional marks are withheld');
select pg_temp.export_assert((select item->>'score'='4' from jsonb_array_elements(:'exported'::jsonb->'attempts') item where item->>'id'='30000000-0000-4000-8000-000000000282'),
  'ordinary released practice keeps its marks');
select pg_temp.export_assert(jsonb_array_length(:'exported'::jsonb->'questionReports')=1 and :'exported'::jsonb->'questionReports'->0->>'details'='First student report text'
  and not(:'exported'::jsonb->'questionReports'->0?'targetKey') and not(:'exported'::jsonb->'questionReports'->0?'contentVersion')
  and position(:'private_version' in :'exported')=0,'own report text is exported without private answer-dependent review identifiers');
select pg_temp.export_assert(jsonb_array_length(:'exported'::jsonb->'results'->'drawingReviews')=1
  and :'exported'::jsonb->'results'->'drawingReviews'->0->>'score'='15'
  and :'exported'::jsonb->'results'->'drawingReviews'->0->>'comments'='Released personal feedback', 'only released teacher feedback belongs in the personal export');
select pg_temp.export_assert(position('Unreleased private teacher note' in :'exported')=0 and position('Private advisory evidence' in :'exported')=0
  and position('Private grading explanation' in :'exported')=0 and position('drawings/export/private-source.png' in :'exported')=0
  and position('Second student report text' in :'exported')=0 and position('Fictional second support issue' in :'exported')=0,
  'private notes, model suggestions, answer keys, storage paths and other accounts are excluded');
select pg_temp.export_reject('select * from dm_private.question_reports','permission denied');
select pg_temp.export_reject('select dm_private.student_attempt_visibility(auth.uid())','permission denied');
select set_config('request.jwt.claim.sub',:'second',true);
select pg_temp.export_assert(public.export_my_account_data()->>'accountId'=:'second'
  and jsonb_array_length(public.export_my_account_data()->'attempts')=1 and public.export_my_account_data()->'questionReports'->0->>'details'='Second student report text'
  and public.export_my_account_data()->'results'->'drawingReviews'='[]'::jsonb,'a second session exports only its own records');
select set_config('request.jwt.claim.sub',:'teacher',true);
select pg_temp.export_assert(public.can_review_drawings() and public.export_my_account_data()->'attempts'='[]'::jsonb
  and public.export_my_account_data()->'questionReports'='[]'::jsonb and public.export_my_account_data()->'results'->'drawingReviews'='[]'::jsonb,
  'teacher identity does not grant student records through personal export');
reset role;
rollback;
\echo 'PASS: owned versioned exports, unpublished marks, safe own report text, released feedback and private review/identity boundaries.'
