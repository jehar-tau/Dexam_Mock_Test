-- Fictional NID year question: owner review of an installed historical runtime. All writes roll back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.r_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.r_reject(statement text,expected text) returns void language plpgsql as $$
begin
 execute statement;
 raise exception 'FAIL: expected rejection';
exception when others then
 if sqlerrm='FAIL: expected rejection' or position(expected in sqlerrm)=0 then raise;end if;
end$$;
insert into auth.users(id)values('00000000-0000-4000-8000-000000002281'),('00000000-0000-4000-8000-000000002282');
insert into dm_private.admins(user_id)values('00000000-0000-4000-8000-000000002281');
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
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.r_assert(public.upsert_nid_year_runtime_batch((select plan from nid_fixture),
 jsonb_build_array((select record from nid_fixture)))=1,'historical runtime installed');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002282',true);
select pg_temp.r_reject($$select public.admin_review_bank_question('nid-year-fixture',true,true,'Owner attested the NID 2019 paper on 26 Nov 2026.')$$,'Admin access required');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002281',true);
select pg_temp.r_reject($$select public.admin_review_bank_question('nid-year-fixture',true,true,'Approved.')$$,'owner attestation');
select pg_temp.r_reject($$select public.admin_review_bank_question('nid-year-fixture',true,false,'Owner attested the NID 2019 paper on 26 Nov 2026.')$$,'Rights confirmation');
select public.admin_review_bank_question('nid-year-fixture',true,true,'Owner attested the NID 2019 paper on 26 Nov 2026.');
reset role;
select pg_temp.r_assert((select owner_approved and rights_confirmed and reviewed_by='00000000-0000-4000-8000-000000002281'
 from dm_private.bank_questions where external_key='nid-year-fixture'),'historical NID question approved');
select pg_temp.r_assert((select count(*)=1 from dm_private.bank_question_reviews where external_key='nid-year-fixture'
 and approved and note like 'Owner attested%'),'attestation recorded in the review log');

-- A runtime that is not this question's historical runtime still needs authored practice review.
update dm_private.bank_questions set owner_approved=false,rights_confirmed=false,
 runtime_payload=jsonb_set(runtime_payload,'{context,sourcePaperId}','"nid-bdes-2018"') where external_key='nid-year-fixture';
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002281',true);
select pg_temp.r_reject($$select public.admin_review_bank_question('nid-year-fixture',true,true,'Owner attested the NID 2019 paper on 26 Nov 2026.')$$,'Current authored practice');
reset role;
update dm_private.bank_questions set runtime_payload=jsonb_set(runtime_payload,'{context,scope}','"authored-practice"') where external_key='nid-year-fixture';
update dm_private.bank_questions set runtime_payload=jsonb_set(runtime_payload,'{context,sourcePaperId}','"nid-bdes-2019"') where external_key='nid-year-fixture';
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002281',true);
select pg_temp.r_reject($$select public.admin_review_bank_question('nid-year-fixture',true,true,'Owner attested the NID 2019 paper on 26 Nov 2026.')$$,'Current authored practice');
-- Withdrawing approval still works without a runtime check.
select public.admin_review_bank_question('nid-year-fixture',false,false,'Withdrawn while the paper is corrected.');
reset role;
select pg_temp.r_assert((select not owner_approved from dm_private.bank_questions where external_key='nid-year-fixture'),'approval withdrawn');
rollback;
