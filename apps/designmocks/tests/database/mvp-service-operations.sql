\set ON_ERROR_STOP on
begin;
\ir ../../supabase/launch/paid-mvp.sql
create function pg_temp.ops_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.ops_reject(statement text,label text)returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'FAIL, unexpectedly allowed: %',label;end$$;
insert into auth.users(id)values('00000000-0000-4000-8000-000000002011'),('00000000-0000-4000-8000-000000002012');
insert into dm_private.admins(user_id)values('00000000-0000-4000-8000-000000002011');
insert into dm_private.reported_question_queue(target_key,representative_question_id,identity_key,report_count,status)values
 ('original-operations-report','10000000-0000-4000-8000-000000002011','original-operations-question',5,'pending');
set local role anon;select pg_temp.ops_reject('select public.admin_operational_health()','anonymous health denied');
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002012',true);
select pg_temp.ops_reject('select public.admin_operational_health()','student health denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002011',true);
select pg_temp.ops_assert((public.admin_operational_health()->>'pendingQuestionReports')::integer=1,'current pending report is counted');
set local role service_role;select set_config('request.jwt.claim.role','service_role',true);select set_config('request.jwt.claim.sub','',true);
select pg_temp.ops_assert(public.admin_operational_health()->>'scope'='paid-mvp-v1','scheduler service can read aggregate MVP health');
select pg_temp.ops_assert((public.admin_operational_health()->>'pendingQuestionReports')::integer=1 and public.admin_operational_health()->>'status'='attention','operator and service see the same pending queue');
select pg_temp.ops_assert(not(public.admin_operational_health()?'failedAiDrafts')and not(public.admin_operational_health()?'openCommunityReports'),'deferred service counters omitted');
reset role;

-- Verify current and migrated captures, mismatched orders and inactive passes.
insert into auth.users(id)
select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid from generate_series(2013,2018) n;
insert into dm_private.orders(user_id,plan_id,amount,currency,mode,provider_order_id)
values ('00000000-0000-4000-8000-000000002012','annual',119300,'INR','test','order_monitorVerified');
insert into dm_private.orders(user_id,plan_id,amount,currency,mode,provider_order_id,status,payment_id,paid_at,payment_review_required)
select actor::uuid,'annual',119300,'INR','test','order_monitor'||kind,'paid','pay_monitor'||kind,now(),kind='Held'
from (values
  ('00000000-0000-4000-8000-000000002013','Legacy'),
  ('00000000-0000-4000-8000-000000002014','Held'),
  ('00000000-0000-4000-8000-000000002016','WrongActor'),
  ('00000000-0000-4000-8000-000000002017','Expired'),
  ('00000000-0000-4000-8000-000000002018','Missing')
) input(actor,kind);
insert into dm_private.payment_events(event_id,order_id,payment_id,outcome,request_hash)
select 'fictional-monitor-'||status_name, id, payment_id, status_name,
  case when status_name='received' then null else repeat('a',64) end
from dm_private.orders join (values
  ('order_monitorLegacy','received'), ('order_monitorHeld','held_for_review'), ('order_monitorWrongActor','granted')
) fixture(order_ref,status_name) on provider_order_id=order_ref;
insert into dm_private.passes(user_id,order_id,mode,starts_at,expires_at)
select case when provider_order_id='order_monitorWrongActor' then '00000000-0000-4000-8000-000000002015'::uuid else user_id end,
  id, mode, now()-interval'2 days', case when provider_order_id='order_monitorExpired' then now()-interval'1 day' else now()+interval'1 day' end
from dm_private.orders where provider_order_id in
  ('order_monitorLegacy','order_monitorHeld','order_monitorWrongActor','order_monitorExpired','order_monitorMissing');

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.fulfil_verified_payment('fictional-monitor-captured','order_monitorVerified','pay_monitorVerified',119300,'INR');
select public.record_verified_refund('fictional-monitor-partial','order_monitorVerified','pay_monitorVerified',
  'rfnd_monitorPartial',119300,1000,1000,'INR');
select public.admin_operational_health() as observed \gset
select pg_temp.ops_assert(
  :'observed'::jsonb->>'monitorVersion'='1' and :'observed'::jsonb->>'apiProfileReady'='true'
  and :'observed'::jsonb->>'unverifiedPasses'='3' and :'observed'::jsonb->>'paymentReviews'='2'
  and :'observed'::jsonb->>'status'='degraded'
  and position('monitorVerified' in :'observed')=0 and position('00000000-0000' in :'observed')=0,
  'only aggregate anomalies are returned and a valid partial refund stays separate from unverified access'
);
select public.record_verified_refund('fictional-monitor-full','order_monitorVerified','pay_monitorVerified',
  'rfnd_monitorRemainder',119300,118300,119300,'INR');
select pg_temp.ops_assert(public.admin_operational_health()->>'unverifiedPasses'='3'
  and public.admin_operational_health()->>'paymentReviews'='1','a fully revoked pass is excluded');
reset role;
grant execute on function public.admin_privacy_requests() to authenticated;
set local role service_role;
select pg_temp.ops_assert(public.admin_operational_health()->>'apiProfileReady'='false','permission drift is visible to the monitor');
reset role;
revoke execute on function public.admin_privacy_requests() from authenticated;
select pg_temp.ops_assert(dm_private.mvp_profile_permissions_valid(),'service access does not broaden client RPC grants');
select pg_temp.ops_assert(bool_and(
  has_function_privilege('service_role',signature,'EXECUTE')
  and not has_function_privilege('anon',signature,'EXECUTE')
  and not has_function_privilege('authenticated',signature,'EXECUTE')
 ),'bank transfer, materialization and unpublished preparation are server-only')
from unnest(array[
  'public.begin_question_bank_import(text,text,text,integer,integer,integer,integer)',
  'public.import_question_bank_batch(uuid,jsonb)','public.finish_question_bank_import(uuid)',
  'public.canonical_bank_media_manifest()','public.register_bank_media_assets(jsonb)',
  'public.upsert_question_bank_runtime_batch(jsonb)','public.upsert_nift_question_bank_runtime_batch(jsonb)',
  'public.nid_practice_runtime_plan(text,integer)','public.upsert_nid_practice_runtime_batch(jsonb)',
  'public.prepare_mvp_paper(jsonb)'
]) as bank(signature);
rollback;
\echo 'PASS: service/admin-only MVP health, aggregate entitlement anomalies, and browser API permission drift.'
\echo 'PASS: canonical bank transfer, materialization and unpublished preparation stay server-only.'
