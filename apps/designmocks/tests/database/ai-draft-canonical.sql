\set ON_ERROR_STOP on
\set editor '00000000-0000-4000-8000-000000000104'
\set other_editor '00000000-0000-4000-8000-000000000105'
\set student '00000000-0000-4000-8000-000000000106'
begin;

create function pg_temp.ai_assert(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
end $$;
create function pg_temp.ai_reject(statement text,expected_error text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_error in sqlerrm)>0 then return; end if;
    raise;
  end;
  raise exception 'FAIL, expected error: %',expected_error;
end $$;
create function pg_temp.ai_payload(kind text,answer jsonb) returns jsonb language sql as $$
  select jsonb_build_object('type',kind,'prompt','Choose the clearest original wayfinding design.',
    'options',case when kind in('MCQ','MSQ') then
      '[{"id":"A","text":"Use a tiny label"},{"id":"B","text":"Use a legible symbol"},{"id":"C","text":"Hide the direction"},{"id":"D","text":"Repeat unrelated marks"}]'::jsonb else '[]'::jsonb end,
    'answer',answer,'explanation','The rubric rewards legibility and a clear hierarchy.',
    'topic','observation','difficulty','medium','estimatedSeconds',60,'visualDependency',false,
    'licence','original-ai-draft','sourceKind','generated','holds','["ai-generated-human-review"]'::jsonb,
    'provenance','{"basisExternalKeys":["ai-fixture-basis"],"generationNote":"Fictional design example"}'::jsonb)
$$;

insert into auth.users(id) values (:'editor'),(:'other_editor'),(:'student');
insert into dm_private.admins(user_id) values (:'editor'),(:'other_editor');
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,
  owner_approved,rights_confirmed,active,payload,source_commit)
values
  ('ai-fixture-basis',repeat('a',64),'uceed','MCQ','observation','owned',true,true,true,
    '{"holds":[],"prompt":"Fictional approved reference.","difficulty":"medium","answer":{"raw":"A"},"assets":["private-fixture"],"provenance":{"note":"private fixture"}}',repeat('b',40)),
  ('ai-fixture-rights-open',repeat('c',64),'uceed','MCQ','observation','unknown',true,false,true,'{"holds":[]}',repeat('b',40)),
  ('ai-fixture-retired',repeat('d',64),'uceed','MCQ','observation','owned',true,true,false,'{"holds":[]}',repeat('b',40));

select pg_temp.ai_assert(dm_private.canonical_ai_draft(pg_temp.ai_payload('MSQ','["B","D"]'),'uceed','observation','MSQ',array['ai-fixture-basis'])
  #>>'{answer,raw}'='B, D','MSQ arrays become canonical option-key notation');
select pg_temp.ai_assert(dm_private.canonical_ai_draft(pg_temp.ai_payload('NAT','"-.50 to +0.75"'),'ceed','observation','NAT',array['ai-fixture-basis'])
  #>>'{answer,raw}'='-.50 to +0.75','NAT ranges preserve exact source decimals');
select pg_temp.ai_assert(dm_private.canonical_ai_draft(pg_temp.ai_payload('DESCRIPTIVE','null'),'nid','observation','DESCRIPTIVE',array['ai-fixture-basis'])
  ->'answer'='null'::jsonb,'drawing drafts retain a separate rubric and no objective answer');
select pg_temp.ai_reject($sql$select dm_private.canonical_ai_draft(pg_temp.ai_payload('NAT','"4 to 2"'),'ceed','observation','NAT',array['ai-fixture-basis'])$sql$,'Invalid AI numeric answer');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'student',true);
select pg_temp.ai_reject($sql$select public.admin_create_ai_draft_request('uceed','observation','MCQ','Create an original fixture',array['ai-fixture-basis'])$sql$,'Admin access required');
select set_config('request.jwt.claim.sub',:'editor',true);
select pg_temp.ai_reject($sql$select public.admin_create_ai_draft_request('uceed','observation','MCQ','Create an original fixture',array['ai-fixture-rights-open'])$sql$,'hold-free and rights-approved');
select pg_temp.ai_reject($sql$select public.admin_create_ai_draft_request('uceed','observation','MCQ','Create an original fixture',array['ai-fixture-retired'])$sql$,'hold-free and rights-approved');
select pg_temp.ai_reject($sql$select public.admin_create_ai_draft_request('uceed','observation','MCQ','Create an original fixture',array['ai-fixture-basis','ai-fixture-basis'])$sql$,'distinct basis questions');
select public.admin_create_ai_draft_request('uceed','observation','MCQ','Create an original fixture',array['ai-fixture-basis']) as request_id \gset
select pg_temp.ai_assert(public.admin_ai_draft_basis(:'request_id')->'basis'->0 =
  '{"externalKey":"ai-fixture-basis","type":"MCQ","topic":"observation","difficulty":"medium","prompt":"Fictional approved reference."}'::jsonb,
  'model receives the approved reference prompt and calibration fields');
select set_config('request.jwt.claim.sub',:'other_editor',true);
select pg_temp.ai_reject(format('select public.admin_ai_draft_basis(%L)',:'request_id'),'AI draft request unavailable');
reset role;

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.ai_reject(format($sql$select public.complete_ai_draft_request(%L,'fictional-model','bad-response',
  pg_temp.ai_payload('MCQ','"E"'))$sql$,:'request_id'),'must match one option');
select pg_temp.ai_reject(format($sql$select public.complete_ai_draft_request(%L,'fictional-model','bad-response',
  pg_temp.ai_payload('MCQ','"B"')-'holds')$sql$,:'request_id'),'Unsafe AI draft payload');
select public.complete_ai_draft_request(:'request_id','fictional-model','valid-response',pg_temp.ai_payload('MCQ','"B"')) as draft_id \gset
select pg_temp.ai_assert(public.complete_ai_draft_request(:'request_id','fictional-model','valid-response',pg_temp.ai_payload('MCQ','"B"'))=:'draft_id',
  'retry of the same model response returns the saved draft');
reset role;
select pg_temp.ai_assert((select payload#>>'{provenance,exam}'='uceed' and payload#>>'{options,1,key}'='B'
  and payload#>>'{answer,status}'='pending' and payload->'holds'='["ai-generated-human-review"]'::jsonb
  from dm_private.question_drafts where id=:'draft_id'),'stored AI output is canonical and held for human review');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'editor',true);
select pg_temp.ai_reject(format('select public.admin_export_question_draft(%L,%L,true,%L)',:'draft_id','ai-fixture-original','Original prompt approved for use'),'Only an approved draft');
select public.admin_review_question_draft(:'draft_id','approved','Human checked all choices and the answer');
select pg_temp.ai_reject(format('select public.admin_export_question_draft(%L,%L,true,%L)',:'draft_id','ai-fixture-basis','Original prompt approved for use'),'already exists in the canonical bank');
select pg_temp.ai_reject(format('select public.admin_export_question_draft(%L,%L,false,%L)',:'draft_id','ai-fixture-original','Original prompt approved for use'),'Rights confirmation');
with result as (select public.admin_export_question_draft(:'draft_id','ai-fixture-original',true,'Original prompt approved for use') as artifact)
select pg_temp.ai_assert(artifact->>'publicationState'='git-review-required' and artifact->>'contentSha256'~'^[0-9a-f]{64}$'
  and artifact->'payload'->'holds'='[]'::jsonb and artifact#>>'{payload,answer,status}'='human-reviewed'
  and artifact#>>'{payload,answer,raw}'='B' and artifact#>>'{payload,provenance,exam}'='uceed'
  and artifact#>>'{payload,options,1,key}'='B','approved artifact can enter the canonical importer after Git review') from result;
select public.admin_create_ai_draft_request('uceed','observation','MCQ','Create an original fixture',array['ai-fixture-basis']) as revoked_request \gset
reset role;
select pg_temp.ai_assert(not exists(select 1 from dm_private.bank_questions where external_key='ai-fixture-original'),
  'artifact creation leaves the canonical bank untouched');

insert into dm_private.question_drafts(created_by,source_type,payload,status)
  values(:'editor','ai',pg_temp.ai_payload('MCQ','"B"'),'approved') returning id as legacy_draft \gset
insert into dm_private.ai_draft_requests(created_by,exam,topic,question_type,instruction,basis_external_keys,status,draft_id)
  values(:'editor','uceed','observation','MCQ','Legacy fictional request',array['ai-fixture-basis'],'succeeded',:'legacy_draft');
insert into dm_private.question_drafts(created_by,source_type,payload,status)
  values(:'editor','manual','{"prompt":"Fictional draft missing exam","type":"MCQ"}','approved') returning id as missing_exam \gset
update dm_private.bank_questions set rights_confirmed=false where external_key='ai-fixture-basis';

set local role authenticated;
select pg_temp.ai_reject(format('select public.admin_ai_draft_basis(%L)',:'revoked_request'),'no longer cleared for AI drafting');
select pg_temp.ai_reject(format('select public.admin_export_question_draft(%L,%L,true,%L)',:'missing_exam','ai-fixture-invalid','Original prompt approved for use'),'provenance.exam');
select pg_temp.ai_assert(public.admin_export_question_draft(:'legacy_draft','ai-fixture-legacy',true,'Original prompt approved for use')
  #>>'{payload,answer,status}'='human-reviewed','valid legacy raw AI drafts can still export through review');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.ai_reject(format($sql$select public.complete_ai_draft_request(%L,'fictional-model','new-response',
  pg_temp.ai_payload('MCQ','"B"'))$sql$,:'revoked_request'),'no longer cleared for AI drafting');
rollback;
\echo 'PASS: rights-cleared AI references, canonical response shape, human review and Git-gated export.'
