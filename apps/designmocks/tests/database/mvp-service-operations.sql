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
select pg_temp.ops_assert(dm_private.mvp_profile_permissions_valid(),'service access does not broaden client RPC grants');
rollback;
\echo 'PASS: service/admin-only MVP health, real pending-question status, aggregate-only queues, and unchanged browser API closure.'
