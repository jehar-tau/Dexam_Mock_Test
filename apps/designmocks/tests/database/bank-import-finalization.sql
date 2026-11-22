-- Original metadata-only fixtures; every write rolls back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.bank_assert(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.bank_reject(statement text,label text) returns void language plpgsql as $$ begin begin execute statement;exception when others then return;end;raise exception 'FAIL, unexpectedly allowed: %',label;end$$;
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,source_commit)
values('finalize-retired',repeat('c',64),'uceed','MCQ','fixture','owner-provided','{"externalKey":"finalize-retired","holds":[]}',repeat('b',40));
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('test.finalize_run',public.begin_question_bank_import(repeat('a',40),'server/data/exports/dexam-bank-export.json',repeat('b',64),1,3,2,1)::text,true);
select public.import_question_bank_batch(current_setting('test.finalize_run')::uuid,'[{"externalKey":"finalize-current-one","contentSha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","exam":"uceed","type":"MCQ","topic":"fixture","licence":"owner-provided","objectiveReady":false,"payload":{"externalKey":"finalize-current-one","holds":[]}},{"externalKey":"finalize-current-two","contentSha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","exam":"uceed","type":"MCQ","topic":"fixture","licence":"owner-provided","objectiveReady":false,"payload":{"externalKey":"finalize-current-two","holds":[]}}]');
reset role;
create temporary table finalized_row_updates(external_key text);
create function pg_temp.track_bank_update() returns trigger language plpgsql as $$begin insert into finalized_row_updates values(new.external_key);return new;end$$;
create trigger track_bank_update before update on dm_private.bank_questions for each row execute function pg_temp.track_bank_update();
set local role service_role;
select public.finish_question_bank_import(current_setting('test.finalize_run')::uuid);
reset role;
select pg_temp.bank_assert((select count(*)=1 and min(external_key)='finalize-retired' from finalized_row_updates),'finalization only touches changed active states');
select pg_temp.bank_assert((select count(*)=2 from dm_private.bank_questions where active),'only current-run members stay active');
select pg_temp.bank_assert((select status='completed' and imported_count=eligible_total and completed_at is not null from dm_private.bank_import_runs where id=current_setting('test.finalize_run')::uuid),'complete import recorded exactly');
select pg_temp.bank_assert((select bool_and(
  has_function_privilege('service_role',signature,'EXECUTE')
  and not has_function_privilege('anon',signature,'EXECUTE')
  and not has_function_privilege('authenticated',signature,'EXECUTE'))
  from unnest(array[
    'public.begin_question_bank_import(text,text,text,integer,integer,integer,integer)',
    'public.import_question_bank_batch(uuid,jsonb)',
    'public.finish_question_bank_import(uuid)']) signature),'all bank import steps stay service-role only');
set local role service_role;
select public.finish_question_bank_import(current_setting('test.finalize_run')::uuid);
select set_config('test.incomplete_run',public.begin_question_bank_import(repeat('d',40),'server/data/exports/dexam-bank-export.json',repeat('e',64),1,2,2,0)::text,true);
select pg_temp.bank_reject('select public.finish_question_bank_import(current_setting(''test.incomplete_run'')::uuid)','incomplete import cannot finalize');
reset role;
select pg_temp.bank_assert((select count(*)=1 from finalized_row_updates),'retry and failed completion do not rewrite canonical rows');
select pg_temp.bank_assert((select count(*)=2 from dm_private.bank_questions where active),'failed completion does not retire the active pool');
rollback;
\echo 'PASS: changed-row finalization, retired records, retries and incomplete-import safety.'
