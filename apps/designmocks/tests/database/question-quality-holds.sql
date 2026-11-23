\set ON_ERROR_STOP on
\set editor '00000000-0000-4000-8000-000000000201'
\set teacher '00000000-0000-4000-8000-000000000202'
\set paper '10000000-0000-4000-8000-000000000201'
\set ai_paper '10000000-0000-4000-8000-000000000202'
\set rate_paper '10000000-0000-4000-8000-000000000203'
\set question '20000000-0000-4000-8000-000000000201'
\set event '40000000-0000-4000-8000-000000000201'
begin;
\ir fixtures/release-bank-year.sql
create function pg_temp.quality_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
create function pg_temp.quality_reject(statement text,expected_error text,expected_code text default null) returns void language plpgsql as $$
begin begin execute statement;exception when others then
  if (expected_code is null and position(expected_error in sqlerrm)>0)
    or (sqlstate=expected_code and sqlerrm=expected_error) then return;end if;
  raise;end;
  raise exception 'FAIL, expected error: %',expected_error;end $$;
create temp table quality_people as select n,('00000000-0000-4000-8000-'||lpad((210+n)::text,12,'0'))::uuid user_id,
  ('30000000-0000-4000-8000-'||lpad((210+n)::text,12,'0'))::uuid attempt_id from generate_series(1,12) n;
grant select on quality_people to authenticated;
insert into auth.users(id) values(:'editor'),(:'teacher');
insert into auth.users(id) select user_id from quality_people;
insert into dm_private.admins(user_id) values(:'editor');
insert into dm_private.drawing_reviewers(user_id,enabled,changed_at) values(:'teacher',true,now());
insert into public.profiles(user_id,display_name,phone_e164,phone_verified_at,appearing_year,city,exams,onboarding_completed_at)
  select user_id,'Fictional quality student '||n,'+919999990'||lpad(n::text,3,'0'),now(),2027,'Mumbai',array['uceed'],now() from quality_people;
insert into dm_private.orders(user_id,plan_id,amount,currency,mode,status) select user_id,'annual',119300,'INR','test','paid' from quality_people;
insert into dm_private.passes(user_id,order_id,mode,starts_at,expires_at) select user_id,id,'test',now(),now()+interval '1 year' from dm_private.orders;
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,active,owner_approved,rights_confirmed,payload,runtime_payload,source_commit)
select 'quality-fixture-'||n,repeat(md5(n::text),2),'uceed','MCQ','quality-topic','owned',true,true,true,
  jsonb_build_object('externalKey','quality-fixture-'||n,'holds','[]'::jsonb,'prompt','Fictional quality question '||n,
    'assets',case when n=1 then jsonb_build_array(jsonb_build_object('sha256',repeat('a',64),'width',1,'height',1)) else '[]'::jsonb end),
  jsonb_build_object('prompt','Fictional quality question '||n,'options','[{"id":"A","label":"First"},{"id":"B","label":"Second"}]'::jsonb,'kind','mcq',
    'marking','{"correct":3,"wrong":-0.71}'::jsonb,'points',3,'negativePoints',0.71,'key',jsonb_build_object('kind','mcq','correct',jsonb_build_array('B'),'sourceExternalKey','quality-fixture-'||n),
    'media',case when n=1 then jsonb_build_array(jsonb_build_object('path','papers/canonical/'||repeat('a',64)||'.png','sha256',repeat('a',64),'width',1,'height',1)) else '[]'::jsonb end,
    'explanation','A fictional explanation.'),repeat('a',40) from generate_series(1,10) n;
insert into dm_private.bank_media_assets(sha256,storage_path,width,height,byte_size) values(repeat('a',64),'papers/canonical/'||repeat('a',64)||'.png',1,1,99);
insert into storage.objects(bucket_id,name,metadata) values('paper-media','papers/canonical/'||repeat('a',64)||'.png','{"mimetype":"image/png","size":99}');
insert into dm_private.bank_import_runs(source_commit,source_path,source_sha256,schema_version,source_total,eligible_total,held_total,imported_count,status,completed_at)
  values(repeat('a',40),'server/data/exports/dexam-bank-export.json',repeat('b',64),1,10,10,0,10,'completed',now()) returning id as import_id \gset
insert into dm_private.bank_import_run_items(run_id,external_key,content_sha256) select :'import_id',external_key,content_sha256 from dm_private.bank_questions;
insert into dm_private.papers(id,title,exam,duration_seconds,published,reviewed,rights_confirmed,source_kind) values
  (:'paper','Fictional quality catalogue','uceed',900,true,true,true,'catalogue'),
  (:'ai_paper','Fictional identical All India paper','uceed',900,false,true,true,'all_india'),
  (:'rate_paper','Fictional report rate paper','uceed',900,true,true,true,'catalogue');
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
  select :'question',:'paper',1,runtime_payload->>'prompt',runtime_payload->'options','mcq',runtime_payload->'marking',runtime_payload->'media',3,0.71,'quality-topic',true
  from dm_private.bank_questions where external_key='quality-fixture-1';
insert into dm_private.answer_keys(question_id,key,explanation) select :'question',runtime_payload->'key',runtime_payload->>'explanation' from dm_private.bank_questions where external_key='quality-fixture-1';
insert into dm_private.questions(paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
  select :'ai_paper',1,prompt,options,kind,marking,media,points,negative_points,topic,reviewed from dm_private.questions where id=:'question' returning id as ai_question \gset
insert into dm_private.answer_keys(question_id,key,explanation) select :'ai_question',key,explanation from dm_private.answer_keys where question_id=:'question';
insert into dm_private.questions(paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
  select :'rate_paper',n,'Fictional rate question '||n,'[{"id":"A","label":"First"},{"id":"B","label":"Second"}]','mcq','{"correct":1,"wrong":0}','[]',1,0,'rate-fixture',true from generate_series(1,21) n;
insert into dm_private.answer_keys(question_id,key,explanation) select id,'{"kind":"mcq","correct":["B"]}','Fictional rate explanation' from dm_private.questions where paper_id=:'rate_paper';
insert into dm_private.attempts(id,user_id,paper_id,deadline) select attempt_id,user_id,:'paper',now()+interval '1 hour' from quality_people where n<=10;
insert into dm_private.attempts(id,user_id,paper_id,deadline) select attempt_id,user_id,:'rate_paper',now()+interval '1 hour' from quality_people where n=12;
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,key,explanation)
  select a.id,q.id,q.ordinal,q.prompt,q.options,q.kind,q.marking,q.media,q.points,q.negative_points,q.topic,k.key,k.explanation
  from dm_private.attempts a join dm_private.questions q on q.paper_id=a.paper_id join dm_private.answer_keys k on k.question_id=q.id;
insert into dm_private.all_india_events(id,exam,title,paper_id,starts_at,ends_at,review_ends_at,created_by)
  values(:'event','uceed','Fictional held All India event',:'ai_paper',now()-interval '1 hour',now()-interval '1 hour'+interval '10 days',now()-interval '1 hour'+interval '20 days',:'editor');
create temp table quality_original as select dm_private.question_quality_version(to_jsonb(i)) version,i.* from dm_private.attempt_items i
  where attempt_id=(select attempt_id from quality_people where n=1);

set local role anon;
select pg_temp.quality_reject('select public.admin_reported_question(''unavailable'',1)','permission denied');
select pg_temp.quality_reject('select public.admin_resolve_reported_question(''unavailable'',''retire'',''Fictional note'',1,null)','permission denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',(select user_id::text from quality_people where n=1),true);
select pg_temp.quality_reject(format('select public.report_attempt_question(%L,%L,%L,null)',(select attempt_id from quality_people where n=2),:'question','incorrect'),'not part of your attempt');
select pg_temp.quality_reject(format('select public.report_attempt_question(%L,%L,null,null)',(select attempt_id from quality_people where n=1),:'question'),'Invalid report reason');
select public.report_attempt_question((select attempt_id from quality_people where n=1),:'question','incorrect','Fictional issue') as first_receipt \gset
select pg_temp.quality_assert(:'first_receipt'::jsonb->>'reportCount'='1' and not(:'first_receipt'::jsonb?'targetKey')
  and not(:'first_receipt'::jsonb?'contentVersion'),'a student receipt counts the reporter without exposing an answer-dependent fingerprint');
select pg_temp.quality_assert(public.report_attempt_question((select attempt_id from quality_people where n=1),:'question','media','Another issue')->>'reportCount'='1','several reasons from one student cannot inflate the threshold');
select pg_temp.quality_reject(format('select public.report_attempt_question(%L,%L,%L,null)',(select attempt_id from quality_people where n=1),:'question','incorrect'),
  'You have already reported this issue for this question version','P0001');
do $$declare person record;begin for person in select * from quality_people where n between 2 and 4 loop
  perform set_config('request.jwt.claim.sub',person.user_id::text,true);
  perform public.report_attempt_question(person.attempt_id,'20000000-0000-4000-8000-000000000201','incomplete',null);
end loop;end $$;
reset role;
select pg_temp.quality_assert((select active and owner_approved from dm_private.bank_questions where external_key='quality-fixture-1'),'four unique reports leave the reviewed source eligible');
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from quality_people where n=5),true);
select public.report_attempt_question((select attempt_id from quality_people where n=5),:'question','duplicate',null);
reset role;
select target_key as case_key from dm_private.reported_question_queue where identity_key='quality-fixture-1' \gset
select pg_temp.quality_assert((select not active and not owner_approved from dm_private.bank_questions where external_key='quality-fixture-1')
  and(select report_count=5 and status='pending' and quarantines_bank from dm_private.reported_question_queue where target_key=:'case_key'), 'the fifth unique reporter atomically holds the source and delivered version');
update dm_private.bank_questions set active=true,owner_approved=true where external_key='quality-fixture-1';
select pg_temp.quality_assert((select not active and not owner_approved from dm_private.bank_questions where external_key='quality-fixture-1'),'import-style reactivation cannot clear a review hold');
select pg_temp.quality_assert(dm_private.paper_quality_held(:'paper') and dm_private.paper_quality_held(:'ai_paper'),'identical frozen clones share their delivered-version hold');
set local role authenticated;
do $$declare person record;begin for person in select * from quality_people where n between 6 and 10 loop
  perform set_config('request.jwt.claim.sub',person.user_id::text,true);
  perform public.report_attempt_question(person.attempt_id,'20000000-0000-4000-8000-000000000201','incorrect',null);
end loop;end $$;
select set_config('request.jwt.claim.sub',(select user_id::text from quality_people where n=11),true);
select pg_temp.quality_assert(public.available_papers()->0->>'qualityHeld'='true','catalogue exposes a held paper');
select pg_temp.quality_assert(public.all_india_event_catalog()->0->>'state'='paused','All India admissions pause without replacing any question');
select pg_temp.quality_reject(format('select public.start_attempt(%L)',:'paper'),'New starts are paused');
select pg_temp.quality_reject(format('select public.start_all_india_attempt(%L)',:'event'),'New starts are paused');
select pg_temp.quality_reject('select public.start_topic_practice(''quality-topic'',''uceed'',10,900)','Not enough reviewed questions');
select set_config('request.jwt.claim.sub',(select user_id::text from quality_people where n=1),true);
select pg_temp.quality_assert(public.start_attempt(:'paper')=(select attempt_id from quality_people where n=1),'an existing attempt resumes despite a new hold');
select public.save_answer_revision((select attempt_id from quality_people where n=1),:'question','"B"',1);
select public.submit_attempt((select attempt_id from quality_people where n=1));
select pg_temp.quality_reject(format('select public.admin_reported_question(%L,1)',:'case_key'),'Admin access required');
select set_config('request.jwt.claim.sub',:'teacher',true);
select pg_temp.quality_reject(format('select public.admin_reported_question_media_paths(%L,1)',:'case_key'),'Admin access required');
select set_config('request.jwt.claim.sub',:'editor',true);
select pg_temp.quality_assert(public.admin_reported_questions()->0->>'reportCount'='10' and public.admin_reported_questions()->0->>'priority'='high','ten unique students raise case priority');
select (public.admin_reported_questions()->0->>'revision')::bigint as case_revision \gset
select public.admin_reported_question(:'case_key',:'case_revision')->>'bankVersion' as bank_version \gset
select pg_temp.quality_assert(public.admin_reported_question(:'case_key',:'case_revision')->'snapshot'->'key'->'correct'='["B"]'::jsonb
  and not(public.admin_reported_question(:'case_key',:'case_revision')->'snapshot'?'answer'),'admin sees the delivered key and no student answer');
select pg_temp.quality_assert(public.admin_reported_question_media_paths(:'case_key',:'case_revision')->0->>'storagePath'='papers/canonical/'||repeat('a',64)||'.png','signing uses frozen, registered canonical figure paths');

-- A second request with the same actor and review version must recheck staff access.
reset role;
delete from dm_private.admins where user_id=:'editor';
set local role authenticated;
select pg_temp.quality_reject(format('select public.admin_reported_question_media_paths(%L,%s)',:'case_key',:'case_revision'),'Admin access required');
reset role;
insert into dm_private.admins(user_id) values(:'editor');
set local role authenticated;

select pg_temp.quality_reject(format('select public.admin_resolve_reported_question(%L,%L,%L,%s,%L)',:'case_key','dismiss','short',:'case_revision',:'bank_version'),'review reason');
reset role;
select pg_temp.quality_assert((select a.score=3 and a.deadline=o.deadline from dm_private.attempts a cross join(select deadline from dm_private.attempts where id=(select attempt_id from quality_people where n=2)) o where a.id=(select attempt_id from quality_people where n=1)),'holding the source changes neither submitted marking nor the original clock');
update storage.objects set metadata='{"mimetype":"image/jpeg","size":99}' where name='papers/canonical/'||repeat('a',64)||'.png';
set local role authenticated;
select pg_temp.quality_reject(format('select public.admin_resolve_reported_question(%L,%L,%L,%s,%L)',:'case_key','restore','Fictional review reason',:'case_revision',:'bank_version'),'private figures');
reset role;
update storage.objects set metadata='{"mimetype":"image/png","size":99}' where name='papers/canonical/'||repeat('a',64)||'.png';
set local role authenticated;
select public.admin_resolve_reported_question(:'case_key','dismiss','The reported version is complete and its key is correct.',:'case_revision',:'bank_version');
select pg_temp.quality_reject(format('select public.admin_resolve_reported_question(%L,%L,%L,%s,%L)',:'case_key','retire','Fictional review reason',:'case_revision',:'bank_version'),'Reports changed');
reset role;
select pg_temp.quality_assert((select active and not owner_approved and not rights_confirmed from dm_private.bank_questions where external_key='quality-fixture-1')
  and not dm_private.paper_quality_held(:'paper'),'dismissal restores current source eligibility with fresh approval required');
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from quality_people where n=1),true);
select pg_temp.quality_assert(public.report_attempt_question((select attempt_id from quality_people where n=1),:'question','other','Later report')->>'held'='false','new reasons cannot reopen a human-resolved case');
select set_config('request.jwt.claim.sub',:'editor',true);
select public.admin_resolve_reported_question(:'case_key','reopen','Reopen the version for a further human check.');
reset role;
select pg_temp.quality_assert(dm_private.paper_quality_held(:'paper') and(select not active from dm_private.bank_questions where external_key='quality-fixture-1'),'explicit reopening restores the hold');
set local role authenticated;
select public.admin_resolve_reported_question(:'case_key','retire','Retain this reported version for a complete human check.');
reset role;
select pg_temp.quality_assert((select report_target_key=:'case_key' from dm_private.bank_local_holds where external_key='quality-fixture-1'),'retirement records the exact case that owns the permanent hold');
set local role authenticated;
select public.admin_reported_question(:'case_key',(public.admin_reported_questions()->0->>'revision')::bigint)->>'bankVersion' as restore_bank_version \gset
select public.admin_resolve_reported_question(:'case_key','restore','The delivered question and its registered figures have been checked.',
  (public.admin_reported_questions()->0->>'revision')::bigint,:'restore_bank_version');
reset role;
select pg_temp.quality_assert(not dm_private.paper_quality_held(:'paper') and not exists(select 1 from dm_private.bank_local_holds where external_key='quality-fixture-1'),
  'explicit human restoration releases only the retirement owned by this case');
set local role authenticated;
select public.admin_resolve_reported_question(:'case_key','retire','Retire the same current version after further human inspection.');
reset role;
select pg_temp.quality_assert(dm_private.paper_quality_held(:'paper') and(select not active from dm_private.bank_questions where external_key='quality-fixture-1'),
  'retiring a previously resolved case rebinds the matching current source');
set local role authenticated;
select public.admin_resolve_reported_question(:'case_key','restore','The original frozen version has been checked again.');
reset role;
savepoint independent_retirement;
insert into dm_private.bank_local_holds(external_key,reason,created_by) values('quality-fixture-1','Independent human retirement',:'editor');
update dm_private.bank_questions set active=false,owner_approved=false where external_key='quality-fixture-1';
set local role authenticated;
select public.admin_resolve_reported_question(:'case_key','restore','Resolve this case while preserving the independent retirement.');
reset role;
select pg_temp.quality_assert((select reason='Independent human retirement' and report_target_key is null from dm_private.bank_local_holds where external_key='quality-fixture-1')
  and(select not active from dm_private.bank_questions where external_key='quality-fixture-1'),'restoring a case cannot clear an unrelated permanent hold');
rollback to savepoint independent_retirement;
set local role authenticated;
select public.admin_resolve_reported_question(:'case_key','reopen','Further source correction is required before new use.');
reset role;

-- A corrected source can enter fresh bank review while the old frozen version stays held.
update dm_private.bank_questions set content_sha256=repeat('d',64),payload=jsonb_set(payload,'{prompt}','"Corrected fictional source"') where external_key='quality-fixture-1';
update dm_private.bank_import_run_items set content_sha256=repeat('d',64) where run_id=:'import_id' and external_key='quality-fixture-1';
set local role authenticated;
select public.admin_reported_question(:'case_key',(public.admin_reported_questions()->0->>'revision')::bigint)->>'bankVersion' as corrected_bank_version \gset
select (public.admin_reported_questions()->0->>'revision')::bigint as corrected_case_revision \gset
select pg_temp.quality_reject(format('select public.admin_resolve_reported_question(%L,%L,%L,%s,%L)',:'case_key','fix','Corrected canonical source reviewed.',:'corrected_case_revision',:'bank_version'),'Bank content changed');
select public.admin_resolve_reported_question(:'case_key','fix','Corrected canonical source reviewed; old version stays held.',:'corrected_case_revision',:'corrected_bank_version');
reset role;
select pg_temp.quality_assert((select active and runtime_payload is null and not owner_approved and not rights_confirmed from dm_private.bank_questions where external_key='quality-fixture-1')
  and dm_private.paper_quality_held(:'paper'),'corrected source release keeps the old paper held and cannot approve itself');
update dm_private.bank_questions set runtime_payload=(select to_jsonb(o)-'version'-'attempt_id'-'question_id'-'ordinal'-'answer'-'revision' from quality_original o)
  ||'{"prompt":"Corrected fictional source","key":{"kind":"mcq","correct":["A"],"sourceExternalKey":"quality-fixture-1"},"points":3,"negativePoints":0.71}'::jsonb
  where external_key='quality-fixture-1';
select dm_private.bank_review_version(q) as corrected_approval_version from dm_private.bank_questions q where external_key='quality-fixture-1' \gset
set local role authenticated;
select public.admin_review_bank_question('quality-fixture-1',true,true,'Corrected original content and use rights reviewed.',:'corrected_approval_version');
reset role;
select pg_temp.release_bank_year(array(select 'quality-fixture-'||n from generate_series(1,10)n),
  'uceed',2023,'quality-uceed-2023');
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from quality_people where n=11),true);
select public.start_topic_practice('quality-topic','uceed',10,900) as corrected_attempt \gset
reset role;
select pg_temp.quality_assert((select count(*)=10 from dm_private.attempt_items where attempt_id=:'corrected_attempt')
  and(select key->'correct'='["B"]'::jsonb from quality_original)
  and(select key->'correct'='["B"]'::jsonb from dm_private.attempt_items where attempt_id=(select attempt_id from quality_people where n=1)),
  'fresh corrected practice uses new content while existing delivered answers remain frozen');

-- Accepted reports are rate audited; unrelated questions cannot bypass the per-user cap.
create temp table quality_rate_questions as select question_id from dm_private.attempt_items where attempt_id=(select attempt_id from quality_people where n=12) order by ordinal;
grant select on quality_rate_questions to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from quality_people where n=12),true);
do $$declare item record;begin for item in select * from quality_rate_questions limit 20 loop
  perform public.report_attempt_question((select attempt_id from quality_people where n=12),item.question_id,'other','Fictional rate fixture');
end loop;end $$;
select pg_temp.quality_reject(format('select public.report_attempt_question(%L,%L,%L,null)',(select attempt_id from quality_people where n=12),
  (select question_id from quality_rate_questions offset 20 limit 1),'other'),
  'Too many question reports. Please try again after the hourly window','P0001');
select pg_temp.quality_reject('select * from dm_private.question_review_events','permission denied');
reset role;
select pg_temp.quality_assert((select count(*)=20 from dm_private.question_reports where reporter_id=(select user_id from quality_people where n=12)),
  'rate limits keep a bounded, attributable successful-report history');
select pg_temp.quality_assert((select count(*)=9 from dm_private.question_review_events where target_key=:'case_key'),
  'threshold, dismissal, two reopenings, two retirements, two restorations and corrected-source release have immutable review events');
rollback;
\echo 'PASS: versioned unique reporters, threshold quarantine, all-start fencing, fixed papers/clocks, human decisions, corrected sources, private figures and report limits.'
