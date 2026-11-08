-- The recovered provider ID may only be attached by the trusted handler's
-- service identity. Attachment is immutable and cannot itself grant a pass.
\set ON_ERROR_STOP on
begin;
\ir ../../supabase/launch/paid-mvp.sql
create function pg_temp.order_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.order_reject(statement text,label text)returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'FAIL, unexpectedly allowed: %',label;end$$;
insert into auth.users(id)values('00000000-0000-4000-8000-000000002001'),('00000000-0000-4000-8000-000000002002');
insert into dm_private.orders(id,user_id,plan_id,amount,currency,mode)values
 ('10000000-0000-4000-8000-000000002001','00000000-0000-4000-8000-000000002001','annual',119300,'INR','test'),
 ('10000000-0000-4000-8000-000000002002','00000000-0000-4000-8000-000000002002','annual',119300,'INR','test');
set local role anon;
select pg_temp.order_reject('select public.attach_provider_order(''10000000-0000-4000-8000-000000002001'',''order_recoveryFixture'')','anonymous attachment denied');
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002001',true);
select pg_temp.order_reject('select public.attach_provider_order(''10000000-0000-4000-8000-000000002001'',''order_recoveryFixture'')','payer cannot self-attach');
select pg_temp.order_reject('select public.attach_provider_order(''10000000-0000-4000-8000-000000002002'',''order_recoveryFixture'')','student cannot attach another account');
set local role service_role;select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.order_assert(public.attach_provider_order('10000000-0000-4000-8000-000000002001','order_recoveryFixture')='order_recoveryFixture','service attaches verified receipt');
select pg_temp.order_assert(public.attach_provider_order('10000000-0000-4000-8000-000000002001','order_recoveryFixture')='order_recoveryFixture','same attachment survives a lost acknowledgement');
select pg_temp.order_assert(public.attach_provider_order('10000000-0000-4000-8000-000000002001','order_unrelatedFixture')='order_recoveryFixture','a different ID cannot overwrite the first attachment; handler must reject the mismatch');
select pg_temp.order_reject('select public.attach_provider_order(''10000000-0000-4000-8000-000000002002'',''order_recoveryFixture'')','provider ID cannot bind another account/order');
select pg_temp.order_reject('select public.attach_provider_order(''10000000-0000-4000-8000-000000002002'',''order_/invalid'')','unsafe provider identifier denied');
reset role;
select pg_temp.order_assert((select count(*)=0 from dm_private.passes where user_id in('00000000-0000-4000-8000-000000002001','00000000-0000-4000-8000-000000002002')),'attachment is not a verified capture and grants no entitlement');
select pg_temp.order_assert((select provider_order_id is null from dm_private.orders where id='10000000-0000-4000-8000-000000002002'),'foreign order stays unbound');
rollback;
\echo 'PASS: recovered provider order service authorization, immutable replay, exact attachment boundary, cross-order uniqueness and no callback entitlement.'
