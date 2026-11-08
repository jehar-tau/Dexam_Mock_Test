-- Fictional signed-event reconciliation only. No provider refund is initiated.
\set ON_ERROR_STOP on
begin;
create function pg_temp.refund_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.refund_reject(statement text)returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'FAIL: unexpectedly allowed refund action';end$$;
insert into auth.users(id)select md5('mvp-refund-user-'||n)::uuid from generate_series(1,4)n;
insert into dm_private.orders(id,user_id,plan_id,amount,currency,mode,provider_order_id)
select md5('mvp-refund-order-'||n)::uuid,md5('mvp-refund-user-'||n)::uuid,'annual',119300,'INR','test','order_mvpRefund'||n from generate_series(1,4)n;
set local role anon;
select pg_temp.refund_reject('select public.record_verified_refund(''evt_anon'',''order_mvpRefund1'',''pay_mvpRefund1'',''rfnd_mvpRefund1'',119300,119300,119300,''INR'')');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',md5('mvp-refund-user-1')::uuid::text,true);
select pg_temp.refund_reject('select public.record_verified_refund(''evt_student'',''order_mvpRefund1'',''pay_mvpRefund1'',''rfnd_mvpRefund1'',119300,119300,119300,''INR'')');
select pg_temp.refund_reject('select *from dm_private.payment_refunds');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.fulfil_verified_payment('evt_mvpCapture1','order_mvpRefund1','pay_mvpRefund1',119300,'INR');
select public.fulfil_verified_payment('evt_mvpCapture2','order_mvpRefund2','pay_mvpRefund2',119300,'INR');
select pg_temp.refund_reject('select public.record_verified_refund(''evt_badAmount'',''order_mvpRefund1'',''pay_mvpRefund1'',''rfnd_badAmount'',1193,1193,1193,''INR'')');
select pg_temp.refund_reject('select public.record_verified_refund(''evt_badPayment'',''order_mvpRefund1'',''pay_wrong'',''rfnd_badPayment'',119300,119300,119300,''INR'')');
select pg_temp.refund_reject('select public.record_verified_refund(''evt_badCurrency'',''order_mvpRefund1'',''pay_mvpRefund1'',''rfnd_badCurrency'',119300,119300,119300,''USD'')');
select public.record_verified_refund('evt_mvpPartial1','order_mvpRefund1','pay_mvpRefund1','rfnd_mvpPart1',119300,30000,30000,'INR');
select public.record_verified_refund('evt_mvpPartial1','order_mvpRefund1','pay_mvpRefund1','rfnd_mvpPart1',119300,30000,30000,'INR');
select public.record_verified_refund('evt_mvpPartialAgain','order_mvpRefund1','pay_mvpRefund1','rfnd_mvpPart1',119300,30000,30000,'INR');
reset role;
select pg_temp.refund_assert((select refunded_amount=30000 and status='paid'and payment_review_required from dm_private.orders where provider_order_id='order_mvpRefund1')and(select revoked_at is null from dm_private.passes where user_id=md5('mvp-refund-user-1')::uuid),'partial receipt is recorded once and preserves the existing grant for operator review');
set local role service_role;
select public.record_verified_refund('evt_mvpFull1','order_mvpRefund1','pay_mvpRefund1','rfnd_mvpRest1',119300,89300,119300,'INR');
select public.record_verified_refund('evt_mvpFullAgain','order_mvpRefund1','pay_mvpRefund1','rfnd_mvpRest1',119300,89300,119300,'INR');
-- A late old partial snapshot and a late capture cannot revive a refunded pass.
select public.record_verified_refund('evt_mvpLatePartial','order_mvpRefund1','pay_mvpRefund1','rfnd_mvpPart1',119300,30000,30000,'INR');
select public.fulfil_verified_payment('evt_mvpLateCapture','order_mvpRefund1','pay_mvpRefund1',119300,'INR');
select pg_temp.refund_reject('select public.record_verified_refund(''evt_mvpFull1'',''order_mvpRefund2'',''pay_mvpRefund2'',''rfnd_mvpForeign'',119300,119300,119300,''INR'')');
select pg_temp.refund_reject('select public.record_verified_refund(''evt_mvpForeignRefund'',''order_mvpRefund2'',''pay_mvpRefund2'',''rfnd_mvpRest1'',119300,89300,119300,''INR'')');
select pg_temp.refund_reject('select public.record_verified_refund(''evt_mvpPartial1'',''order_mvpRefund1'',''pay_mvpRefund1'',''rfnd_mvpPart1'',119300,30001,30001,''INR'')');
select pg_temp.refund_reject('select public.record_verified_refund(''evt_mvpExcess'',''order_mvpRefund1'',''pay_mvpRefund1'',''rfnd_mvpExcess'',119300,1,119300,''INR'')');
reset role;
select pg_temp.refund_assert((select status='refunded'and refunded_amount=119300 and not payment_review_required from dm_private.orders where provider_order_id='order_mvpRefund1')and(select revoked_at is not null from dm_private.passes where user_id=md5('mvp-refund-user-1')::uuid),'a processed full total revokes only its original entitlement and never regresses');
select pg_temp.refund_assert((select count(*)from dm_private.payment_refunds where order_id=md5('mvp-refund-order-1')::uuid)=2,'refund business receipts do not duplicate across event IDs');
select pg_temp.refund_assert((select revoked_at is null and expires_at>clock_timestamp()from dm_private.passes where user_id=md5('mvp-refund-user-2')::uuid),'foreign event/refund attempts do not revoke another account');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',md5('mvp-refund-user-1')::uuid::text,true);
select pg_temp.refund_assert(public.my_pass()->>'active'='false'and public.my_pass()->>'revoked'='true','the student reads an inactive revoked entitlement');
select pg_temp.refund_reject('select public.start_attempt(gen_random_uuid())');
reset role;
insert into dm_private.orders(id,user_id,plan_id,amount,currency,mode,provider_order_id)values
 ('10000000-0000-4000-8000-000000001809',md5('mvp-refund-user-1')::uuid,'annual',119300,'INR','test','order_mvpReplacement');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.fulfil_verified_payment('evt_mvpReplacement','order_mvpReplacement','pay_mvpReplacement',119300,'INR');
select public.record_verified_refund('evt_mvpOldRefundAfterNewPass','order_mvpRefund1','pay_mvpRefund1','rfnd_mvpRest1',119300,89300,119300,'INR');
reset role;
select pg_temp.refund_assert((select order_id='10000000-0000-4000-8000-000000001809'and revoked_at is null and expires_at=starts_at+interval'12 months'from dm_private.passes where user_id=md5('mvp-refund-user-1')::uuid),'a late old-order refund cannot revoke or extend the replacement purchase');
-- A refund may arrive before the capture delivery, despite actual capture at the provider.
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.record_verified_refund('evt_mvpBeforeCapture','order_mvpRefund3','pay_mvpRefund3','rfnd_mvpBefore',119300,119300,119300,'INR');
select public.fulfil_verified_payment('evt_mvpCaptureAfterRefund','order_mvpRefund3','pay_mvpRefund3',119300,'INR');
select public.record_verified_refund('evt_mvpPartialBefore','order_mvpRefund4','pay_mvpRefund4','rfnd_mvpPartialBefore',119300,10000,10000,'INR');
select public.fulfil_verified_payment('evt_mvpPartialCapture','order_mvpRefund4','pay_mvpRefund4',119300,'INR');
reset role;
select pg_temp.refund_assert((select count(*)from dm_private.passes where user_id in(md5('mvp-refund-user-3')::uuid,md5('mvp-refund-user-4')::uuid))=0,'out-of-order full refund cannot grant and ambiguous partial capture waits for review');
select pg_temp.refund_assert((select payment_review_required from dm_private.orders where provider_order_id='order_mvpRefund4'),'an unfulfilled partial-refund order is surfaced for manual reconciliation');
rollback;
\echo 'PASS: service-only processed refunds, exact money/actor/event binding, monotonic replay, full revocation and out-of-order capture safety.'
