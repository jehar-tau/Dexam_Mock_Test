\set ON_ERROR_STOP on
begin;
set local time zone 'UTC';

create function pg_temp.purchase_assert(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
end $$;

create function pg_temp.purchase_reject(statement text,expected_state text,expected_message text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate=expected_state and position(expected_message in sqlerrm)>0 then return; end if;
    raise;
  end;
  raise exception 'FAIL, expected %: %',expected_state,expected_message;
end $$;

insert into auth.users(id)
select md5('purchase-history-'||actor)::uuid from unnest(array['owner','other','empty']) as actors(actor);
insert into dm_private.orders(id,user_id,plan_id,amount,currency,mode,provider_order_id,created_at)
select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  md5('purchase-history-owner')::uuid,'annual',119300,'INR','test','order_history'||n,
  '2026-10-01 10:11:12.123456+00'::timestamptz
from generate_series(1,13) n;
insert into dm_private.orders(id,user_id,plan_id,amount,currency,mode,provider_order_id,created_at)
values
  ('10000000-0000-4000-8000-000000000014',md5('purchase-history-other')::uuid,
    'annual',119300,'INR','test','order_historyForeign','2026-10-01 10:11:12.123456+00'),
  ('10000000-0000-4000-8000-000000000015',md5('purchase-history-owner')::uuid,
    'annual',119300,'INR','live','order_historyLive','2026-10-01 10:11:12.123456+00');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',md5('purchase-history-owner')::uuid::text,true);
select public.my_purchase_page() as first_page \gset
select (:'first_page'::jsonb#>>'{nextCursor,createdAt}') as cursor_time,
  (:'first_page'::jsonb#>>'{nextCursor,reference}') as cursor_id \gset
select public.my_purchase_page(:'cursor_time',:'cursor_id') as second_page \gset
select pg_temp.purchase_assert(:'first_page'::jsonb->>'mode'='test'
  and (:'first_page'::jsonb)-array['mode','items','nextCursor']='{}'
  and (:'first_page'::jsonb->'nextCursor')-array['createdAt','reference']='{}'
  and (:'first_page'::jsonb#>'{items,0}')=jsonb_build_object(
    'reference','10000000-0000-4000-8000-000000000013','amountMinor',119300,'currency','INR',
    'status','pending','refundedMinor',0,'reviewRequired',false,'createdAt','2026-10-01T10:11:12.123456+00:00',
    'paidAt',null,'refundedAt',null)
  and :'cursor_time'='2026-10-01T10:11:12.123456+00:00'
  and :'cursor_id'='10000000-0000-4000-8000-000000000004'
  and :'second_page'::jsonb->'nextCursor'='null',
  'exact public-facing fields, pending status, and microsecond cursor are preserved with sales closed');
select pg_temp.purchase_assert((select array_agg(value->>'reference' order by ordinal)
  from jsonb_array_elements((:'first_page'::jsonb->'items')||(:'second_page'::jsonb->'items')) with ordinality i(value,ordinal))
  =(select array_agg('10000000-0000-4000-8000-'||lpad(n::text,12,'0') order by n desc) from generate_series(1,13)n),
  'owner and mode scope, tie order, and lookahead have no gaps or duplicates');
select pg_temp.purchase_assert(public.my_purchase_page(:'cursor_time','10000000-0000-4000-8000-000000000001')=
  '{"mode":"test","items":[],"nextCursor":null}'::jsonb,'an exact final-order cursor has an empty terminal page');
select pg_temp.purchase_reject('select public.my_purchase_page(null,''10000000-0000-4000-8000-000000000004'')',
  '22023','Invalid purchase history cursor');
select pg_temp.purchase_reject('select public.my_purchase_page(''2026-10-01T10:11:12.123456Z'')',
  '22023','Invalid purchase history cursor');
select pg_temp.purchase_reject('select public.my_purchase_page(''2026-10-01T10:11:12.123000Z'',''10000000-0000-4000-8000-000000000004'')',
  '22023','Invalid purchase history cursor');
select pg_temp.purchase_reject(format('select public.my_purchase_page(%L,%L)',:'cursor_time',id),
  '22023','Invalid purchase history cursor')
from unnest(array['10000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000015',
  '10000000-0000-4000-8000-000000000099']) as cursors(id);
select set_config('request.jwt.claim.sub',md5('purchase-history-other')::uuid::text,true);
select pg_temp.purchase_assert(jsonb_array_length(public.my_purchase_page()->'items')=1
  and public.my_purchase_page()#>>'{items,0,reference}'='10000000-0000-4000-8000-000000000014','switched actor sees only their own order');
select set_config('request.jwt.claim.sub',md5('purchase-history-empty')::uuid::text,true);
select pg_temp.purchase_assert(public.my_purchase_page()='{"mode":"test","items":[],"nextCursor":null}'::jsonb,'no orders yields an empty page');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.purchase_reject('select public.my_purchase_page()','42501','Sign in required');
select set_config('request.jwt.claim.sub',md5('purchase-history-owner')::uuid::text,true);
reset role;

set local role anon;
select pg_temp.purchase_reject('select public.my_purchase_page()','42501','permission denied');
reset role;
set local role service_role;
select pg_temp.purchase_reject('select public.my_purchase_page()','42501','permission denied');
select set_config('request.jwt.claim.role','service_role',true);
select public.fulfil_verified_payment('evt_historyPaid','order_history13','pay_history13',119300,'INR');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.purchase_assert((public.my_purchase_page()#>'{items,0}') @> '{"status":"paid","refundedMinor":0,"reviewRequired":false}'
  and public.my_purchase_page()#>'{items,0,paidAt}'<>'null' and public.my_purchase_page()#>'{items,0,refundedAt}'='null',
  'verified capture exposes paid state and paid time without provider identifiers');
reset role;

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.record_verified_refund('evt_historyPartial','order_history13','pay_history13','rfnd_historyPartial',119300,30000,30000,'INR');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.purchase_assert((public.my_purchase_page()#>'{items,0}') @> '{"status":"paid","refundedMinor":30000,"reviewRequired":true}'
  and public.my_purchase_page()#>'{items,0,refundedAt}'<>'null','processed partial refund reports amount, time and review requirement');
reset role;

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.record_verified_refund('evt_historyFull','order_history13','pay_history13','rfnd_historyRest',119300,89300,119300,'INR');
select public.record_verified_refund('evt_historyEarly','order_history11','pay_history11','rfnd_historyEarly',119300,119300,119300,'INR');
select public.fulfil_verified_payment('evt_historyLate','order_history11','pay_history11',119300,'INR');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.purchase_assert((public.my_purchase_page()#>'{items,0}') @> '{"status":"refunded","refundedMinor":119300,"reviewRequired":false}'
  and public.my_purchase_page()#>'{items,0,paidAt}'<>'null' and public.my_purchase_page()#>'{items,0,refundedAt}'<>'null'
  and public.my_pass()->>'revoked'='true','fully refunded history remains visible after pass withdrawal');
select pg_temp.purchase_assert((public.my_purchase_page()#>'{items,2}') @> '{"status":"refunded","refundedMinor":119300,"reviewRequired":false,"paidAt":null}'
  and public.my_purchase_page()#>'{items,2,refundedAt}'<>'null','refund before capture shows a refund without inventing a paid timestamp');
reset role;

update public.launch_settings set environment_mode='live' where singleton;
set local role authenticated;
select pg_temp.purchase_assert(public.my_purchase_page()->>'mode'='live'
  and jsonb_array_length(public.my_purchase_page()->'items')=1
  and public.my_purchase_page()#>>'{items,0,reference}'='10000000-0000-4000-8000-000000000015',
  'server mode switch immediately replaces test history with owned live history');
select pg_temp.purchase_reject(format('select public.my_purchase_page(%L,%L)',:'cursor_time',:'cursor_id'),
  '22023','Invalid purchase history cursor');
reset role;

rollback;
\echo 'PASS: private purchase history scopes actor and mode, preserves exact pagination and payment/refund state.'
