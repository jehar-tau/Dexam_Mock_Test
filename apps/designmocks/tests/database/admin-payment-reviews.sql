\set ON_ERROR_STOP on
begin;
create function pg_temp.review_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.review_denied(statement text) returns void language plpgsql as $$begin begin execute statement;exception when insufficient_privilege then return;end;raise exception 'FAIL: expected authorization denial';end$$;
insert into auth.users(id) values(md5('payment-review-admin')::uuid),(md5('payment-review-student')::uuid);
insert into dm_private.admins(user_id) values(md5('payment-review-admin')::uuid);
insert into dm_private.orders(id,user_id,plan_id,amount,currency,mode,status,payment_review_required,refunded_amount,created_at)
select md5('payment-review-'||n)::uuid,md5('payment-review-student')::uuid,'annual',119300,'INR','test','paid',true,30000,'2026-01-01'::timestamptz+n*interval '1 second' from generate_series(1,12)n;
insert into dm_private.orders(id,user_id,plan_id,amount,currency,mode,payment_review_required)
values(md5('review-live')::uuid,md5('payment-review-student')::uuid,'annual',119300,'INR','live',true),
(md5('review-unflagged')::uuid,md5('payment-review-student')::uuid,'annual',119300,'INR','test',false);
insert into dm_private.passes(user_id,order_id,mode,starts_at,expires_at) values(md5('payment-review-student')::uuid,md5('payment-review-12')::uuid,'test',now(),now()+interval '1 year');
select md5(string_agg(o::text,',' order by id)) as before_state from dm_private.orders o \gset
select pg_temp.review_assert(not has_function_privilege('service_role','public.admin_payment_review_page(timestamptz,uuid)','EXECUTE'),'service role has no review API grant');
set local role anon;
select pg_temp.review_denied('select public.admin_payment_review_page()');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',md5('payment-review-student')::uuid::text,true);
select pg_temp.review_denied('select public.admin_payment_review_page()');
select set_config('request.jwt.claim.sub',md5('payment-review-admin')::uuid::text,true);
select public.admin_payment_review_page() as first_page \gset
select pg_temp.review_assert(jsonb_array_length(:'first_page'::jsonb->'items')=10,'bounded page without a support report');
select pg_temp.review_assert(:'first_page'::jsonb->>'mode'='test' and not exists(select 1 from jsonb_array_elements(:'first_page'::jsonb->'items')i where i->>'refundedMinor'<>'30000' or i->>'passState' not in ('none','active')),'only current-mode flagged orders and matching pass facts');
select pg_temp.review_assert((:'first_page'::jsonb->'items'->0->>'passState')='active' and (:'first_page'::jsonb->'items'->1->>'passState')='none','replacement or unrelated pass never attaches to another order');
select pg_temp.review_assert(jsonb_array_length(public.admin_payment_review_page((:'first_page'::jsonb->'nextCursor'->>'createdAt')::timestamptz,(:'first_page'::jsonb->'nextCursor'->>'reference')::uuid)->'items')=2,'stable second page');
reset role;
select pg_temp.review_assert(md5(string_agg(o::text,',' order by id))=:'before_state','inspection never mutates orders') from dm_private.orders o;
delete from dm_private.admins where user_id=md5('payment-review-admin')::uuid;
set local role authenticated;
select pg_temp.review_denied('select public.admin_payment_review_page()');
reset role;
rollback;
\echo 'PASS: payment review authorization, revocation, mode separation, bounded pagination and read-only orders.'
