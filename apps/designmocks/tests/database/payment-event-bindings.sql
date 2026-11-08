\set ON_ERROR_STOP on
begin;
create function pg_temp.payment_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.payment_reject(statement text)returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'FAIL: expected rejected payment binding';end$$;
insert into auth.users(id)values('00000000-0000-4000-8000-000000001801'),('00000000-0000-4000-8000-000000001802');
insert into dm_private.orders(id,user_id,plan_id,amount,currency,mode,provider_order_id)values
 ('10000000-0000-4000-8000-000000001801','00000000-0000-4000-8000-000000001801','annual',119300,'INR','test','order_mvpBindingA'),
 ('10000000-0000-4000-8000-000000001802','00000000-0000-4000-8000-000000001802','annual',119300,'INR','test','order_mvpBindingB'),
 ('10000000-0000-4000-8000-000000001803','00000000-0000-4000-8000-000000001801','annual',119300,'INR','test','order_mvpBindingC');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.fulfil_verified_payment('evt_mvpBindingA','order_mvpBindingA','pay_mvpBindingA',119300,'INR');
select pg_temp.payment_reject('select public.fulfil_verified_payment(''evt_mvpBindingA'',''order_mvpBindingB'',''pay_mvpBindingB'',119300,''INR'')');
select pg_temp.payment_reject('select public.fulfil_verified_payment(''evt_mvpBindingOther'',''order_mvpBindingA'',''pay_mvpBindingOther'',119300,''INR'')');
select public.fulfil_verified_payment('evt_mvpBindingAgain','order_mvpBindingA','pay_mvpBindingA',119300,'INR');
reset role;
select expires_at::text as first_expiry from dm_private.passes where user_id='00000000-0000-4000-8000-000000001801'\gset
set local role service_role;
select public.fulfil_verified_payment('evt_mvpBindingC','order_mvpBindingC','pay_mvpBindingC',119300,'INR');
reset role;
select pg_temp.payment_assert((select order_id='10000000-0000-4000-8000-000000001801'and expires_at::text=:'first_expiry'from dm_private.passes where user_id='00000000-0000-4000-8000-000000001801'),'another paid order cannot replace or extend the current pass');
select pg_temp.payment_assert((select payment_review_required from dm_private.orders where id='10000000-0000-4000-8000-000000001803'),'a second actual capture requires operator reconciliation');
update public.launch_settings set environment_mode='live';
set local role service_role;
select pg_temp.payment_reject('select public.fulfil_verified_payment(''evt_mvpBindingMode'',''order_mvpBindingB'',''pay_mvpBindingB'',119300,''INR'')');
reset role;
select pg_temp.payment_assert((select count(*)from dm_private.passes where user_id='00000000-0000-4000-8000-000000001802')=0,'a mode mismatch never grants the other actor');
rollback;
\echo 'PASS: captured event/order/payment/mode binding, no duplicate entitlement extension and explicit reconciliation.'
