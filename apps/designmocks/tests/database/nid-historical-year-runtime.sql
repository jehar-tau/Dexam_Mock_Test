-- Fictional NID year plan and answer. All writes roll back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.nid_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.nid_reject(plan jsonb,record jsonb,expected text) returns void language plpgsql as $$
begin
 perform public.upsert_nid_year_runtime_batch(plan,jsonb_build_array(record));
 raise exception 'FAIL: expected rejection';
exception when others then
 if sqlerrm='FAIL: expected rejection' or position(expected in sqlerrm)=0 then raise;end if;
end$$;

insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,source_commit)
values('nid-year-fixture',repeat('a',64),'nid','MCQ','visual','owned',
 jsonb_build_object('prompt','Choose a fictional shape.','holds','[]'::jsonb,'assets','[]'::jsonb,
  'answer',jsonb_build_object('raw','B or C','status','independently-solved'),
  'provenance',jsonb_build_object('exam','nid','year',2019,'paperId','nid-bdes-2019'),
  'options','[{"key":"A","text":"A"},{"key":"B","text":"B"},{"key":"C","text":"C"},{"key":"D","text":"D"}]'::jsonb),repeat('d',40));

create temporary table nid_fixture as
select jsonb_build_object('format','dmocks-free-year-paper-v1','exam','nid','year',2019,
 'sourcePaperId','nid-bdes-2019','durationSeconds',3600,
 'markingReference','Historical NID 2019 printed instructions',
 'questions',jsonb_build_array(jsonb_build_object('externalKey','nid-year-fixture','contentSha256',repeat('a',64),
  'marking',jsonb_build_object('correct',2,'wrong',0),'explanation','Fictional worked explanation for test only.'))) plan,
 jsonb_build_object('externalKey','nid-year-fixture','contentSha256',repeat('a',64),'exam','nid',
  'runtime',jsonb_build_object('prompt','Choose a fictional shape.','kind','mcq',
   'options','[{"id":"A","label":"A"},{"id":"B","label":"B"},{"id":"C","label":"C"},{"id":"D","label":"D"}]'::jsonb,
   'marking',jsonb_build_object('correct',2,'wrong',0),'points',2,'negativePoints',0,
   'media','[]'::jsonb,'key',jsonb_build_object('kind','mcq','correct','["B","C"]'::jsonb,'sourceExternalKey','nid-year-fixture'),
   'explanation','Fictional worked explanation for test only.',
   'context',jsonb_build_object('version','nid-historical-year-v1','exam','nid','scope','historical-year-paper',
    'year',2019,'sourcePaperId','nid-bdes-2019','durationSeconds',3600,
    'markingReference','Historical NID 2019 printed instructions'))) record;
grant select on nid_fixture to service_role,authenticated;

select pg_temp.nid_assert(not has_function_privilege('anon','public.upsert_nid_year_runtime_batch(jsonb,jsonb)','EXECUTE')
 and not has_function_privilege('authenticated','public.upsert_nid_year_runtime_batch(jsonb,jsonb)','EXECUTE')
 and has_function_privilege('service_role','public.upsert_nid_year_runtime_batch(jsonb,jsonb)','EXECUTE'),
 'only service role may write NID year runtime');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.nid_assert(public.upsert_nid_year_runtime_batch((select plan from nid_fixture),
 jsonb_build_array((select record from nid_fixture)))=1,'exact historical runtime accepted');
select pg_temp.nid_reject((select plan from nid_fixture),
 jsonb_set((select record from nid_fixture),'{runtime,key,correct}','["A"]'::jsonb),
 'NID key does not match');
select pg_temp.nid_reject((select plan from nid_fixture),
 jsonb_set((select record from nid_fixture),'{runtime,marking,correct}','3'::jsonb),
 'NID runtime does not match');
select pg_temp.nid_reject((select plan from nid_fixture),
 jsonb_set((select record from nid_fixture),'{runtime,context,durationSeconds}','7200'::jsonb),
 'NID runtime does not match');
reset role;
select pg_temp.nid_assert((select objective_ready and runtime_payload->'key'->'correct'='["B","C"]'::jsonb
 from dm_private.bank_questions where external_key='nid-year-fixture'),'source key and objective readiness stored');
select pg_temp.nid_assert((select marks=2 from dm_private.score_response('mcq',
 '{"kind":"mcq","correct":["B","C"]}'::jsonb,'"C"'::jsonb,'{"correct":2,"wrong":0}'::jsonb)),
 'either stored NID answer earns full marks');
rollback;
