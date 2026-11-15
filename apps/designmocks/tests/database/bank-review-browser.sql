\set ON_ERROR_STOP on
\set editor '00000000-0000-4000-8000-000000000121'
\set student '00000000-0000-4000-8000-000000000122'
\set teacher '00000000-0000-4000-8000-000000000123'
begin;

create function pg_temp.bank_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.bank_reject(statement text,expected_error text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then if position(expected_error in sqlerrm)>0 then return; end if; raise; end;
  raise exception 'FAIL, expected error: %',expected_error;
end $$;

insert into auth.users(id) values(:'editor'),(:'student'),(:'teacher');
insert into dm_private.admins(user_id) values(:'editor');
insert into dm_private.drawing_reviewers(user_id,enabled,changed_at) values(:'teacher',true,now());
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,
  owner_approved,rights_confirmed,active,payload,runtime_payload,source_commit)
select 'bank-review-'||lpad(n::text,3,'0'),repeat(md5(n::text),2),case when n%2=0 then 'ceed' else 'uceed' end,
  'MCQ',case when n%2=0 then 'spatial' else 'observation' end,'owned',n<=10,n<=10,n<=61,
  jsonb_build_object('holds','[]'::jsonb,'prompt',case when n=26 then repeat('Fictional full wording. ',30)||'50%_literal' else 'Fictional question '||n end,
    'options','[{"key":"A","text":"Fictional first option"},{"key":"B","text":"Fictional second option"}]'::jsonb,
    'answer','{"raw":"B","status":"human-reviewed"}'::jsonb,'explanation','Fictional explanatory reasoning.',
    'visualDependency',n=26,'assets',case when n=26 then jsonb_build_array(jsonb_build_object('sha256',repeat('a',64),'width',1,'height',1)) else '[]'::jsonb end),
  case when n=61 then null else jsonb_build_object('kind','mcq','key',jsonb_build_object('kind','mcq','correct',jsonb_build_array('B')),
    'marking',jsonb_build_object('correct',3,'wrong',-0.71),'context',jsonb_build_object('exam','ceed','cycle',2027,'version','fictional-test')) end,
  repeat('b',40) from generate_series(1,62) n;
insert into dm_private.bank_media_assets(sha256,storage_path,width,height,byte_size)
  values(repeat('a',64),'papers/canonical/'||repeat('a',64)||'.png',1,1,99);
insert into storage.objects(bucket_id,name,metadata) values('paper-media','papers/canonical/'||repeat('a',64)||'.png','{"mimetype":"image/png","size":99}');
select dm_private.bank_review_version(q) as figure_version from dm_private.bank_questions q where external_key='bank-review-026' \gset
select dm_private.bank_review_version(q) as inactive_version from dm_private.bank_questions q where external_key='bank-review-062' \gset
select dm_private.bank_review_version(q) as unavailable_version from dm_private.bank_questions q where external_key='bank-review-061' \gset

set local role anon;
select pg_temp.bank_reject('select public.admin_search_bank_questions()','permission denied');
select pg_temp.bank_reject('select public.admin_bank_question(''bank-review-026'',''fake'')','permission denied');
select pg_temp.bank_reject('select public.admin_bank_review_media_paths(''bank-review-026'',''fake'')','permission denied');
select pg_temp.bank_reject('select public.admin_review_bank_question(''bank-review-026'',true,true,''Fictional note'',''fake'')','permission denied');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'student',true);
select pg_temp.bank_reject('select public.admin_search_bank_questions()','Admin access required');
select pg_temp.bank_reject('select public.admin_bank_question(''bank-review-026'',''fake'')','Admin access required');
select pg_temp.bank_reject('select public.admin_bank_review_media_paths(''bank-review-026'',''fake'')','Admin access required');
select pg_temp.bank_reject('select public.admin_review_bank_question(''bank-review-026'',true,true,''Fictional note'',''fake'')','Admin access required');
select pg_temp.bank_reject('select * from dm_private.bank_questions','permission denied');
select set_config('request.jwt.claim.sub',:'teacher',true);
select pg_temp.bank_reject('select public.admin_search_bank_questions()','Admin access required');
select pg_temp.bank_reject('select public.admin_bank_review_media_paths(''bank-review-026'',''fake'')','Admin access required');

select set_config('request.jwt.claim.sub',:'editor',true);
select pg_temp.bank_assert(public.admin_search_bank_questions()->>'total'='50'
  and jsonb_array_length(public.admin_search_bank_questions()->'items')=25
  and public.admin_search_bank_questions()->'items'->0->>'externalKey'='bank-review-011','default review queue starts with unapproved converted questions');
select pg_temp.bank_assert(public.admin_search_bank_questions(p_offset=>25)->'items'->0->>'externalKey'='bank-review-036'
  and public.admin_search_bank_questions(p_offset=>1000)->>'offset'='25','stable pagination reaches records beyond the first 25 and clamps a depleted page');
select pg_temp.bank_assert(public.admin_search_bank_questions()->'summary'='{"active":61,"available":60,"approved":10,"inactive":1}'::jsonb,'summary counts separate inactive and unconverted questions');
select pg_temp.bank_assert(public.admin_search_bank_questions(p_status=>'approved')->>'total'='10'
  and public.admin_search_bank_questions(p_status=>'unavailable')->>'total'='1'
  and public.admin_search_bank_questions(p_status=>'inactive')->>'total'='1'
  and public.admin_search_bank_questions(p_status=>'all',p_limit=>100)->>'total'='62','all review statuses are inspectable');
select pg_temp.bank_assert(public.admin_search_bank_questions(p_exam=>' CEED ',p_type=>'mcq',p_topic=>' spatial ')->>'total'='25'
  and public.admin_search_bank_questions(p_exam=>'uceed',p_topic=>'spatial')->>'total'='0','exam, type and exact topic filters combine');
select pg_temp.bank_assert(public.admin_search_bank_questions(p_search=>' 50%_literal ')->>'total'='1'
  and public.admin_search_bank_questions(p_search=>'50%_other')->>'total'='0'
  and public.admin_search_bank_questions(p_search=>'BANK-REVIEW-026')->>'total'='1','case-insensitive substring search treats wildcard characters literally');
select pg_temp.bank_assert(not(public.admin_search_bank_questions()->'items'->0?'answer')
  and not(public.admin_search_bank_questions()->'items'->0?'runtimeKey'),'listing excludes answer details');
select pg_temp.bank_reject('select public.admin_search_bank_questions(p_limit=>0)','Invalid bank filters');
select pg_temp.bank_reject('select public.admin_search_bank_questions(p_limit=>101)','Invalid bank filters');
select pg_temp.bank_reject('select public.admin_search_bank_questions(p_offset=>-1)','Invalid bank filters');
select pg_temp.bank_reject('select public.admin_search_bank_questions(p_status=>null)','Invalid bank filters');
select pg_temp.bank_reject('select public.admin_search_bank_questions(p_exam=>''unknown'')','Invalid bank filters');
select pg_temp.bank_reject('select public.admin_search_bank_questions(p_search=>repeat(''x'',201))','Invalid bank filters');

select pg_temp.bank_assert(char_length(public.admin_bank_question('bank-review-026',:'figure_version')->>'prompt')>500
  and public.admin_bank_question('bank-review-026',:'figure_version')->'options'->1->>'text'='Fictional second option'
  and public.admin_bank_question('bank-review-026',:'figure_version')->'answer'->>'raw'='B'
  and public.admin_bank_question('bank-review-026',:'figure_version')->'runtimeKey'->'correct'='["B"]'::jsonb
  and public.admin_bank_question('bank-review-026',:'figure_version')->'marking'->>'wrong'='-0.71','full review exposes canonical wording, source answer, delivery key and marking');
select pg_temp.bank_assert(public.admin_bank_question('bank-review-026',:'figure_version')->'media'->0->>'available'='true'
  and not(public.admin_bank_question('bank-review-026',:'figure_version')->'media'->0?'storagePath')
  and public.admin_bank_review_media_paths('bank-review-026',:'figure_version')->0->>'storagePath'='papers/canonical/'||repeat('a',64)||'.png',
  'private media paths are bound to registered canonical figures, separate from display metadata');

-- A second request with the same actor and review version must recheck staff access.
reset role;
delete from dm_private.admins where user_id=:'editor';
set local role authenticated;
select pg_temp.bank_reject(format('select public.admin_bank_review_media_paths(%L,%L)','bank-review-026',:'figure_version'),'Admin access required');
reset role;
insert into dm_private.admins(user_id) values(:'editor');
set local role authenticated;

select pg_temp.bank_reject(format('select public.admin_bank_question(%L,%L)','bank-review-025',:'figure_version'),'Question changed');
select pg_temp.bank_reject('select public.admin_bank_review_media_paths(''bank-review-026'',null)','Question changed');
select pg_temp.bank_reject(format('select public.admin_review_bank_question(%L,true,true,%L,%L)','bank-review-062','Fictional rights note',:'inactive_version'),'Inactive or held');
select pg_temp.bank_reject(format('select public.admin_review_bank_question(%L,true,true,%L,%L)','bank-review-061','Fictional rights note',:'unavailable_version'),'Runtime-ready');
select pg_temp.bank_reject(format('select public.admin_review_bank_question(%L,true,false,%L,%L)','bank-review-026','Fictional rights note',:'figure_version'),'Rights confirmation');
select pg_temp.bank_reject(format('select public.admin_review_bank_question(%L,true,true,%L,%L)','bank-review-026','short',:'figure_version'),'review note');
reset role;

-- Registered hashes alone are insufficient: the actual private object must still match.
update storage.objects set metadata='{"mimetype":"image/jpeg","size":99}' where name='papers/canonical/'||repeat('a',64)||'.png';
set local role authenticated;
select pg_temp.bank_reject(format('select public.admin_bank_review_media_paths(%L,%L)','bank-review-026',:'figure_version'),'verified private media');
select pg_temp.bank_reject(format('select public.admin_review_bank_question(%L,true,true,%L,%L)','bank-review-026','Fictional rights note',:'figure_version'),'verified private media');
reset role;
update storage.objects set metadata='{"mimetype":"image/png","size":100}' where name='papers/canonical/'||repeat('a',64)||'.png';
set local role authenticated;
select pg_temp.bank_reject(format('select public.admin_bank_review_media_paths(%L,%L)','bank-review-026',:'figure_version'),'verified private media');
reset role;
update storage.objects set metadata='{"mimetype":"image/png","size":99}' where name='papers/canonical/'||repeat('a',64)||'.png';

-- A compiled-key change must invalidate an open review even when the source hash is unchanged.
update dm_private.bank_questions set runtime_payload=jsonb_set(runtime_payload,'{key,correct}','["A"]') where external_key='bank-review-026';
set local role authenticated;
select pg_temp.bank_reject(format('select public.admin_bank_question(%L,%L)','bank-review-026',:'figure_version'),'Question changed');
select pg_temp.bank_reject(format('select public.admin_bank_review_media_paths(%L,%L)','bank-review-026',:'figure_version'),'Question changed');
select pg_temp.bank_reject(format('select public.admin_review_bank_question(%L,true,true,%L,%L)','bank-review-026','Fictional rights note',:'figure_version'),'Question changed');
reset role;
update dm_private.bank_questions set runtime_payload=jsonb_set(runtime_payload,'{key,correct}','["B"]') where external_key='bank-review-026';
update dm_private.bank_questions set payload=jsonb_set(payload,'{prompt}','"Changed fictional wording"') where external_key='bank-review-026';
set local role authenticated;
select pg_temp.bank_reject(format('select public.admin_review_bank_question(%L,true,true,%L,%L)','bank-review-026','Fictional rights note',:'figure_version'),'Question changed');
reset role;

-- Explicit visual dependency with absent or malformed assets cannot silently become text-only.
update dm_private.bank_questions set payload=jsonb_set(payload,'{assets}','null') where external_key='bank-review-026';
select dm_private.bank_review_version(q) as missing_version from dm_private.bank_questions q where external_key='bank-review-026' \gset
set local role authenticated;
select pg_temp.bank_assert(public.admin_bank_question('bank-review-026',:'missing_version')->'media'->0->>'available'='false','missing required figures are visible to the reviewer');
select pg_temp.bank_reject(format('select public.admin_review_bank_question(%L,true,true,%L,%L)','bank-review-026','Fictional rights note',:'missing_version'),'verified private media');
select public.admin_review_bank_question('bank-review-026',false,false,'Required figure needs correction.',:'missing_version');
reset role;
select pg_temp.bank_assert((select not owner_approved and not rights_confirmed from dm_private.bank_questions where external_key='bank-review-026'),
  'incomplete visual questions remain rejectable');
select dm_private.bank_review_version(q) as rejected_version from dm_private.bank_questions q where external_key='bank-review-026' \gset
select pg_temp.bank_assert(:'missing_version'<>:'rejected_version','review-state changes invalidate earlier decisions');

-- A report hold has its own version boundary and cannot be bypassed by the bank browser.
select dm_private.bank_review_version(q) as hold_before from dm_private.bank_questions q where external_key='bank-review-027' \gset
insert into dm_private.bank_local_holds(external_key,reason,created_by) values('bank-review-027','Fictional report hold',:'editor');
select dm_private.bank_review_version(q) as hold_after from dm_private.bank_questions q where external_key='bank-review-027' \gset
set local role authenticated;
select pg_temp.bank_reject(format('select public.admin_review_bank_question(%L,true,true,%L,%L)','bank-review-027','Fictional rights note',:'hold_before'),'Question changed');
select pg_temp.bank_reject(format('select public.admin_review_bank_question(%L,true,true,%L,%L)','bank-review-027','Fictional rights note',:'hold_after'),'Inactive or held');
reset role;

select dm_private.bank_review_version(q) as approve_version from dm_private.bank_questions q where external_key='bank-review-028' \gset
set local role authenticated;
select public.admin_review_bank_question('bank-review-028',true,true,'Fictional original content rights verified.',:'approve_version');
select pg_temp.bank_reject(format('select public.admin_review_bank_question(%L,true,true,%L,%L)','bank-review-028','Fictional rights note',:'approve_version'),'Question changed');
reset role;
select pg_temp.bank_assert((select owner_approved and rights_confirmed and reviewed_by=:'editor' from dm_private.bank_questions where external_key='bank-review-028')
  and(select count(*)=1 from dm_private.bank_question_reviews where external_key='bank-review-028' and reviewer_id=:'editor' and approved),
  'an exact reviewed version writes one approval and preserves the established audit trail');
select dm_private.bank_review_version(q) as utc_version from dm_private.bank_questions q where external_key='bank-review-028' \gset
set local timezone='Asia/Kolkata';
select pg_temp.bank_assert((select dm_private.bank_review_version(q)=:'utc_version' from dm_private.bank_questions q where external_key='bank-review-028'),
  'review digests do not depend on session timezone');
select pg_temp.bank_assert(not has_function_privilege('authenticated','dm_private.bank_review_figures(text)','EXECUTE')
  and not has_function_privilege('service_role','dm_private.bank_review_version(dm_private.bank_questions)','EXECUTE'),'internal helpers are not client APIs');
select dm_private.bank_review_version(q) as correction_version from dm_private.bank_questions q where external_key='bank-review-026' \gset
set local role anon;
select pg_temp.bank_reject('select public.admin_prepare_bank_answer_correction(''bank-review-026'',''fake'',''A'',''Verified review note'')','permission denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',:'student',true);
select pg_temp.bank_reject('select public.admin_prepare_bank_answer_correction(''bank-review-026'',''fake'',''A'',''Verified review note'')','Admin access required');
select set_config('request.jwt.claim.sub',:'editor',true);
select pg_temp.bank_reject('select public.admin_prepare_bank_answer_correction(''bank-review-026'',''stale'',''A'',''Verified review note'')','Question changed');
select public.admin_prepare_bank_answer_correction('bank-review-026',:'correction_version','A','Verified review note') as correction \gset
select pg_temp.bank_assert((:'correction'::jsonb#>>'{packet,payloadText}')::jsonb#>>'{answer,raw}'='A'
  and :'correction'::jsonb#>>'{packet,contentSha256}'=encode(sha256(convert_to(:'correction'::jsonb#>>'{packet,payloadText}','UTF8')),'hex'),
  'the correction is a digested answer-only review packet');
reset role;
select pg_temp.bank_assert((select payload#>>'{answer,raw}'='B' from dm_private.bank_questions where external_key='bank-review-026'),
  'preparing a correction preserves the canonical record');
rollback;
\echo 'PASS: complete bank pagination, filters, canonical figures, admin authorization, version fencing and audited review.'
