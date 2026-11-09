\set ON_ERROR_STOP on
\set editor '00000000-0000-4000-8000-000000000112'
\set other_editor '00000000-0000-4000-8000-000000000113'
\set student '00000000-0000-4000-8000-000000000114'
begin;

create function pg_temp.job_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.job_reject(statement text,expected_error text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if position(expected_error in sqlerrm)>0 then return; end if;
    raise;
  end;
  raise exception 'FAIL, expected error: %',expected_error;
end $$;
create function pg_temp.job_questions() returns jsonb language sql as $$
  select '[{"pageNumber":1,"confidence":0.8,"type":"MCQ","prompt":"Fictional recovered source question","options":[],"answer":null,"explanation":"","topic":"observation","visualDependency":null}]'::jsonb
$$;
create function pg_temp.job_draft() returns jsonb language sql as $$
  select '{"type":"MCQ","prompt":"Choose the clearest fictional wayfinding design.","options":[{"id":"A","text":"Small text"},{"id":"B","text":"A clear symbol"},{"id":"C","text":"A hidden arrow"},{"id":"D","text":"Unrelated shapes"}],"answer":"B","explanation":"Clear symbols aid navigation.","topic":"observation","difficulty":"medium","estimatedSeconds":60,"visualDependency":false,"licence":"original-ai-draft","sourceKind":"generated","holds":["ai-generated-human-review"],"provenance":{"basisExternalKeys":["job-fixture-basis"],"generationNote":"Fictional recovery fixture"}}'::jsonb
$$;

insert into auth.users(id) values(:'editor'),(:'other_editor'),(:'student');
insert into dm_private.admins(user_id) values(:'editor'),(:'other_editor');
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,owner_approved,rights_confirmed,active,payload,source_commit)
  values('job-fixture-basis',repeat('a',64),'uceed','MCQ','observation','owned',true,true,true,
    '{"holds":[],"prompt":"Fictional approved reference"}',repeat('a',40));

do $$
declare signature text;
begin
  foreach signature in array array[
    'public.claim_question_intake_asset(uuid,uuid)','public.complete_question_intake_asset(uuid,text,text,jsonb,uuid)',
    'public.fail_question_intake_asset(uuid,text,text,uuid)','public.claim_ai_draft_request(uuid,uuid,boolean)',
    'public.complete_ai_draft_request(uuid,text,text,jsonb,uuid)','public.fail_ai_draft_request(uuid,text,text,uuid)',
    'public.recover_expired_question_jobs(integer)'
  ] loop
    if has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE')
      or not has_function_privilege('service_role',signature,'EXECUTE') then raise exception 'Service grant violation: %',signature; end if;
  end loop;
  if has_function_privilege('service_role','dm_private.complete_ai_draft_request(uuid,text,text,jsonb)','EXECUTE')
    or has_function_privilege('service_role','dm_private.complete_question_intake_asset(uuid,text,text,jsonb)','EXECUTE') then
    raise exception 'Private completion bypass exposed';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'editor',true);
select public.admin_create_ai_draft_request('uceed','observation','MCQ','Create an original fictional recovery question',array['job-fixture-basis']) as request_id \gset
select public.admin_create_ai_draft_request('uceed','observation','MCQ','Create another original fictional question',array['job-fixture-basis']) as active_ai_id \gset
reset role;

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.register_question_intake_asset('intake/recovery/fictional.pdf','fictional.pdf','application/pdf',1234,:'editor') as asset_id \gset
select public.register_question_intake_asset('intake/recovery/active.pdf','active.pdf','application/pdf',1234,:'editor') as active_asset_id \gset
select public.claim_question_intake_asset(:'asset_id',:'editor')->>'token' as old_intake_token \gset
select public.claim_question_intake_asset(:'active_asset_id',:'editor')->>'token' as active_intake_token \gset
select public.claim_ai_draft_request(:'request_id',:'editor',false)->>'token' as old_ai_token \gset
select public.claim_ai_draft_request(:'active_ai_id',:'editor',false)->>'token' as active_ai_token \gset
select pg_temp.job_reject(format('select public.claim_question_intake_asset(%L,%L)',:'asset_id',:'editor'),'not available for extraction');
select pg_temp.job_reject(format('select public.claim_question_intake_asset(%L)',:'asset_id'),'processing token is required');
select pg_temp.job_reject(format('select public.claim_ai_draft_request(%L,%L,true)',:'request_id',:'editor'),'already processing');
select pg_temp.job_reject(format('select public.claim_ai_draft_request(%L,%L,true)',:'request_id',:'other_editor'),'request unavailable');
select pg_temp.job_reject(format('select public.claim_question_intake_asset(%L,%L)',:'asset_id',:'student'),'Admin access required');
select pg_temp.job_reject(format('select public.complete_question_intake_asset(%L,%L,%L,pg_temp.job_questions())',:'asset_id','fictional-model','old-response'),'token is unavailable');
select pg_temp.job_reject(format('select public.fail_ai_draft_request(%L,%L,%L)',:'request_id','fictional-model','legacy failure'),'token is unavailable');
reset role;

-- Simulate interrupted workers and old rows without tokens. Keep current workers untouched.
update dm_private.question_intake_assets set extraction_deadline=now()-interval '1 minute' where id=:'asset_id';
update dm_private.ai_draft_requests set run_deadline=now()-interval '1 minute' where id=:'request_id';
insert into dm_private.question_intake_assets(storage_path,original_name,mime_type,byte_size,status,uploaded_by,updated_at)
  values('intake/recovery/legacy.pdf','legacy.pdf','application/pdf',1234,'extracting',:'editor',now()-interval '10 minutes');
insert into dm_private.ai_draft_requests(created_by,exam,topic,question_type,instruction,basis_external_keys,status,created_at)
  values(:'editor','uceed','observation','MCQ','Legacy interrupted fictional request',array['job-fixture-basis'],'running',now()-interval '10 minutes');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.job_assert(public.admin_operational_health()->>'expiredIntakeJobs'='2' and public.admin_operational_health()->>'expiredAiDraftJobs'='2',
  'health detects interrupted workers and legacy jobs');
select pg_temp.job_reject(format('select public.complete_question_intake_asset(%L,%L,%L,pg_temp.job_questions(),%L)',:'asset_id','fictional-model','expired-response',:'old_intake_token'),'expired');
select pg_temp.job_reject(format('select public.complete_ai_draft_request(%L,%L,%L,pg_temp.job_draft(),%L)',:'request_id','fictional-model','expired-response',:'old_ai_token'),'expired');
select pg_temp.job_reject('select public.recover_expired_question_jobs(0)','Invalid recovery limit');
select pg_temp.job_reject('select public.recover_expired_question_jobs(501)','Invalid recovery limit');
select pg_temp.job_assert(public.recover_expired_question_jobs(1)='{"intake":1,"aiDrafts":1}'::jsonb,'recovery is bounded per kind');
select pg_temp.job_assert(public.recover_expired_question_jobs(1)='{"intake":1,"aiDrafts":1}'::jsonb,'the next bounded sweep drains the remaining expired jobs');
select pg_temp.job_assert(public.recover_expired_question_jobs(1)='{"intake":0,"aiDrafts":0}'::jsonb,'recovery retries are idempotent');
reset role;
select pg_temp.job_assert((select status='extracting' from dm_private.question_intake_assets where id=:'active_asset_id')
  and(select status='running' from dm_private.ai_draft_requests where id=:'active_ai_id'),'unexpired workers survive recovery');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'editor',true);
select pg_temp.job_assert((select item->>'retryAvailable'='true' and not(item?'run_token') and not(item?'token')
  from jsonb_array_elements(public.admin_ai_draft_requests()) item where item->>'id'=:'request_id'),'the creator sees retry availability without its worker token');
select set_config('request.jwt.claim.sub',:'other_editor',true);
select pg_temp.job_assert((select item->>'retryAvailable'='false' from jsonb_array_elements(public.admin_ai_draft_requests()) item
  where item->>'id'=:'request_id'),'other administrators retain the existing creator boundary for retrying drafts');
select set_config('request.jwt.claim.sub',:'student',true);
select pg_temp.job_reject('select public.admin_operational_health()','Admin access required');
select pg_temp.job_reject('select public.recover_expired_question_jobs(1)','permission denied');
reset role;

update dm_private.bank_questions set rights_confirmed=false where external_key='job-fixture-basis';
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.job_reject(format('select public.claim_ai_draft_request(%L,%L,true)',:'request_id',:'editor'),'no longer cleared');
reset role;
update dm_private.bank_questions set rights_confirmed=true where external_key='job-fixture-basis';
set local role service_role;
select public.claim_question_intake_asset(:'asset_id',:'editor')->>'token' as new_intake_token \gset
select public.claim_ai_draft_request(:'request_id',:'editor',true)->>'token' as new_ai_token \gset
select pg_temp.job_assert(:'new_intake_token'<>:'old_intake_token' and :'new_ai_token'<>:'old_ai_token','retries receive fresh tokens');
select pg_temp.job_reject(format('select public.complete_question_intake_asset(%L,%L,%L,pg_temp.job_questions(),%L)',:'asset_id','fictional-model','stale-response',:'old_intake_token'),'token is unavailable');
select pg_temp.job_reject(format('select public.fail_question_intake_asset(%L,%L,%L,%L)',:'asset_id','fictional-model','stale failure',:'old_intake_token'),'token is unavailable');
select pg_temp.job_reject(format('select public.complete_ai_draft_request(%L,%L,%L,pg_temp.job_draft(),%L)',:'request_id','fictional-model','stale-response',:'old_ai_token'),'token is unavailable');
select pg_temp.job_reject(format('select public.fail_ai_draft_request(%L,%L,%L,%L)',:'request_id','fictional-model','stale failure',:'old_ai_token'),'token is unavailable');
select pg_temp.job_assert(public.complete_question_intake_asset(:'asset_id','fictional-model','new-intake-response',pg_temp.job_questions(),:'new_intake_token')=1,'the current extraction token saves its candidates');
select pg_temp.job_assert(public.complete_question_intake_asset(:'asset_id','fictional-model','new-intake-response',pg_temp.job_questions(),:'new_intake_token')=1,'lost completion acknowledgements can retry without duplicate candidates');
select public.complete_ai_draft_request(:'request_id','fictional-model','new-ai-response',pg_temp.job_draft(),:'new_ai_token') as draft_id \gset
select pg_temp.job_assert(public.complete_ai_draft_request(:'request_id','fictional-model','new-ai-response',pg_temp.job_draft(),:'new_ai_token')=:'draft_id','lost AI acknowledgements return the saved draft');
select public.fail_question_intake_asset(:'asset_id','fictional-model','late failure',:'new_intake_token');
select public.fail_ai_draft_request(:'request_id','fictional-model','late failure',:'new_ai_token');
reset role;
select pg_temp.job_assert((select count(*)=1 from dm_private.question_intake_candidates where asset_id=:'asset_id'),'recovery does not duplicate extraction candidates');
select pg_temp.job_assert((select extraction_attempts=2 and status='extracted' from dm_private.question_intake_assets where id=:'asset_id'),
  'current extraction remains complete after late error handling');
select pg_temp.job_assert((select run_attempts=2 and status='succeeded' from dm_private.ai_draft_requests where id=:'request_id')
  and(select payload->'holds'='["ai-generated-human-review"]'::jsonb and status='pending' from dm_private.question_drafts where id=:'draft_id'),
  'a recovered draft preserves human review and cannot publish itself');

-- An administrator may retry an expired extraction before the next scheduler tick.
update dm_private.question_intake_assets set extraction_deadline=now()-interval '1 second' where id=:'active_asset_id';
set local role service_role;
select pg_temp.job_assert(public.claim_question_intake_asset(:'active_asset_id',:'editor')->>'token'<>:'active_intake_token',
  'explicit recovery does not depend on the next scheduler invocation');
reset role;

-- Provider calls are service-only and never expose private helpers.
do $$
declare signature text;
begin
  foreach signature in array array[
    'public.authorize_question_intake_provider(uuid,uuid,uuid)',
    'public.read_ai_draft_provider_basis(uuid,uuid,uuid)'
  ] loop
    if has_function_privilege('anon',signature,'EXECUTE')
      or has_function_privilege('authenticated',signature,'EXECUTE')
      or not has_function_privilege('service_role',signature,'EXECUTE') then
      raise exception 'Provider grant violation: %',signature;
    end if;
  end loop;
  if has_function_privilege('service_role','dm_private.lock_question_processing_admin(uuid)','EXECUTE')
    or has_function_privilege('service_role','dm_private.ai_draft_basis_dto(dm_private.ai_draft_requests)','EXECUTE') then
    raise exception 'Private provider bypass exposed';
  end if;
end $$;
create function pg_temp.job_reject_code(statement text, expected_code text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate = expected_code then return; end if;
    raise;
  end;
  raise exception 'FAIL, expected SQLSTATE: %',expected_code;
end $$;

select extraction_token as provider_intake_token from dm_private.question_intake_assets where id=:'active_asset_id' \gset
select pg_temp.job_assert((select extraction_actor_id=:'editor'::uuid from dm_private.question_intake_assets where id=:'active_asset_id'),
  'the intake token is bound to its claimant');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'editor',true);
select public.admin_ai_draft_basis(:'active_ai_id')::text as browser_basis \gset
select pg_temp.job_reject_code(format('select public.read_ai_draft_provider_basis(%L,%L,%L)',
  :'active_ai_id',:'editor',:'active_ai_token'),'42501');
reset role;
set local role service_role;
select pg_temp.job_reject_code(format('select public.authorize_question_intake_provider(%L,%L,%L)',
  :'active_asset_id',:'editor',:'provider_intake_token'),'42501');
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.job_assert(public.authorize_question_intake_provider(:'active_asset_id',:'editor',:'provider_intake_token'),
  'current intake claimant and token can use the provider');
select pg_temp.job_assert(public.read_ai_draft_provider_basis(:'active_ai_id',:'editor',:'active_ai_token')=:'browser_basis'::jsonb,
  'the service receives exactly the existing sanitized basis DTO');
select pg_temp.job_assert((public.read_ai_draft_provider_basis(:'active_ai_id',:'editor',:'active_ai_token')->'basis'->0)
  = '{"externalKey":"job-fixture-basis","type":"MCQ","topic":"observation","difficulty":"unassessed","prompt":"Fictional approved reference"}'::jsonb,
  'the basis projection excludes full source, answers and rights metadata');
select pg_temp.job_reject_code(format('select public.authorize_question_intake_provider(%L,%L,%L)',
  :'active_asset_id',:'other_editor',:'provider_intake_token'),'42501');
select pg_temp.job_reject_code(format('select public.read_ai_draft_provider_basis(%L,%L,%L)',
  :'active_ai_id',:'other_editor',:'active_ai_token'),'42501');
select pg_temp.job_reject_code(format('select public.authorize_question_intake_provider(%L,%L,%L)',
  :'active_asset_id',:'editor',:'active_intake_token'),'40001');
select pg_temp.job_reject_code(format('select public.read_ai_draft_provider_basis(%L,%L,null)',
  :'active_ai_id',:'editor'),'40001');
reset role;

update dm_private.bank_questions set rights_confirmed=false where external_key='job-fixture-basis';
set local role service_role;
select pg_temp.job_reject_code(format('select public.read_ai_draft_provider_basis(%L,%L,%L)',
  :'active_ai_id',:'editor',:'active_ai_token'),'40001');
reset role;
update dm_private.bank_questions set rights_confirmed=true where external_key='job-fixture-basis';

delete from dm_private.admins where user_id=:'editor';
set local role service_role;
select pg_temp.job_reject_code(format('select public.authorize_question_intake_provider(%L,%L,%L)',
  :'active_asset_id',:'editor',:'provider_intake_token'),'42501');
select pg_temp.job_reject_code(format('select public.read_ai_draft_provider_basis(%L,%L,%L)',
  :'active_ai_id',:'editor',:'active_ai_token'),'42501');
select pg_temp.job_reject_code(format('select public.complete_question_intake_asset(%L,%L,%L,pg_temp.job_questions(),%L)',
  :'active_asset_id','fictional-model','revoked-active',:'provider_intake_token'),'42501');
select pg_temp.job_reject_code(format('select public.complete_question_intake_asset(%L,%L,%L,pg_temp.job_questions(),%L)',
  :'asset_id','fictional-model','new-intake-response',:'new_intake_token'),'42501');
select pg_temp.job_reject_code(format('select public.complete_ai_draft_request(%L,%L,%L,pg_temp.job_draft(),%L)',
  :'active_ai_id','fictional-model','revoked-active',:'active_ai_token'),'42501');
select pg_temp.job_reject_code(format('select public.complete_ai_draft_request(%L,%L,%L,pg_temp.job_draft(),%L)',
  :'request_id','fictional-model','new-ai-response',:'new_ai_token'),'42501');
select public.fail_question_intake_asset(:'active_asset_id','fictional-model','Revoked during processing',:'provider_intake_token');
select public.fail_ai_draft_request(:'active_ai_id','fictional-model','Revoked during processing',:'active_ai_token');
reset role;
select pg_temp.job_assert((select status='failed' from dm_private.question_intake_assets where id=:'active_asset_id')
  and (select status='failed' from dm_private.ai_draft_requests where id=:'active_ai_id')
  and (select status='extracted' from dm_private.question_intake_assets where id=:'asset_id')
  and (select status='succeeded' from dm_private.ai_draft_requests where id=:'request_id'),
  'matching-token cleanup remains available and completed results are preserved');
insert into dm_private.admins(user_id) values(:'editor');

-- Pre-upgrade tokened intake rows have no trustworthy actor. Both active
-- claims and completed results fail closed for provider/completion access.
insert into dm_private.question_intake_assets(storage_path,original_name,mime_type,byte_size,status,uploaded_by,
  extraction_token,extraction_deadline)
values('intake/recovery/unbound.pdf','unbound.pdf','application/pdf',1234,'extracting',:'editor',
  gen_random_uuid(),clock_timestamp()+interval '5 minutes') returning id as unbound_id,extraction_token as unbound_token \gset
set local role service_role;
select pg_temp.job_reject_code(format('select public.authorize_question_intake_provider(%L,%L,%L)',
  :'unbound_id',:'editor',:'unbound_token'),'40001');
select pg_temp.job_reject_code(format('select public.complete_question_intake_asset(%L,%L,%L,pg_temp.job_questions(),%L)',
  :'unbound_id','fictional-model','unbound-result',:'unbound_token'),'40001');
select public.fail_question_intake_asset(:'unbound_id','fictional-model','Unbound legacy token',:'unbound_token');
select public.claim_question_intake_asset(:'unbound_id',:'editor')->>'token' as bound_retry_token \gset
select pg_temp.job_assert(:'bound_retry_token'<>:'unbound_token' and public.authorize_question_intake_provider(:'unbound_id',:'editor',:'bound_retry_token'),
  'cleanup followed by a current-admin retry binds a fresh token');
select public.register_question_intake_asset('intake/recovery/tokenless.pdf','tokenless.pdf','application/pdf',1234,:'editor') as tokenless_id \gset
select pg_temp.job_assert(public.claim_question_intake_asset(:'tokenless_id')->'token'='null'::jsonb,'old service claim overload remains tokenless');
select pg_temp.job_assert(public.complete_question_intake_asset(:'tokenless_id','fictional-model','legacy-tokenless',pg_temp.job_questions())=1,
  'old service intake completion remains compatible');
reset role;
rollback;
\echo 'PASS: expired question jobs, bounded recovery, legacy compatibility, token fencing, creator authorization and mandatory review.'
