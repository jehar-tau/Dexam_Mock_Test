\set ON_ERROR_STOP on
begin;

create function pg_temp.purchase_support_assert(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;

create function pg_temp.purchase_support_error(statement text, expected_state text, expected_detail text)
returns void language plpgsql as $$
declare detail text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics detail = pg_exception_detail;
    if sqlstate = expected_state and detail is not distinct from expected_detail then return; end if;
    raise;
  end;
  raise exception 'FAIL: expected error %/% for %', expected_state, expected_detail, statement;
end $$;

create function pg_temp.purchase_support_payment_state() returns jsonb language sql as $$
  select jsonb_build_object(
    'orders', (select jsonb_agg(o order by o.id) from dm_private.orders o),
    'passes', (select jsonb_agg(p order by p.user_id) from dm_private.passes p),
    'events', (select jsonb_agg(e order by e.event_id) from dm_private.payment_events e),
    'refunds', (select jsonb_agg(r order by r.refund_id) from dm_private.payment_refunds r)
  )
$$;

\set owner '00000000-0000-4000-8000-000000004701'
\set other '00000000-0000-4000-8000-000000004702'
\set staff '00000000-0000-4000-8000-000000004703'
\set owned_order '10000000-0000-4000-8000-000000004701'
\set other_order '10000000-0000-4000-8000-000000004702'
\set live_order '10000000-0000-4000-8000-000000004703'
\set missing_order '10000000-0000-4000-8000-000000004704'
\set linked_request '20000000-0000-4000-8000-000000004701'
\set old_request '20000000-0000-4000-8000-000000004702'
\set bad_request '20000000-0000-4000-8000-000000004703'
\set no_link_request '20000000-0000-4000-8000-000000004704'
\set report_title 'Original fictional purchase question'
\set report_description 'A fictional report about a purchase history entry.'
\set page '/account/purchases'

insert into auth.users(id) values (:'owner'), (:'other'), (:'staff');
insert into dm_private.admins(user_id) values (:'staff');
insert into dm_private.orders(id,user_id,plan_id,amount,currency,mode,provider_order_id)
  values (:'owned_order', :'owner','annual',119300,'INR','test','order_supportOwned'),
    (:'other_order', :'other','annual',119300,'INR','test','order_supportForeign'),
    (:'live_order', :'owner','annual',119300,'INR','live','order_supportLive');
set local role service_role;
set local request.jwt.claim.role = 'service_role';
select public.fulfil_verified_payment('evt_supportOwned','order_supportOwned','pay_supportOwned',119300,'INR');
select public.record_verified_refund('evt_supportPartial','order_supportOwned','pay_supportOwned',
  'rfnd_supportPartial',119300,30000,30000,'INR');
reset role;
select pg_temp.purchase_support_payment_state() as original_payment \gset

select pg_temp.purchase_support_assert(
  has_function_privilege('authenticated','public.submit_bug_report(text,text,text,uuid,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.submit_bug_report(text,text,text,uuid,uuid)','EXECUTE')
  and not has_function_privilege('service_role','public.submit_bug_report(text,text,text,uuid,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','dm_private.create_bug_report(text,text,text,uuid,uuid)','EXECUTE')
  and not has_table_privilege('authenticated','dm_private.bug_reports','SELECT'),
  'only authenticated callers receive the public overload and the link stays private');

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
select pg_temp.purchase_support_error(format('select public.submit_bug_report(%L,%L,%L,%L,%L)',
  :'report_title', :'report_description', :'page', :'linked_request', :'owned_order'), '42501', '');
select set_config('request.jwt.claim.sub', :'owner', true);
select pg_temp.purchase_support_error(format('select public.submit_bug_report(%L,%L,%L,%L,%L)',
  :'report_title', :'report_description', :'page', :'bad_request', id), '22023', 'purchase_order_unavailable')
from unnest(array[:'other_order', :'live_order', :'missing_order']) as orders(id);
select pg_temp.purchase_support_error(format('select public.submit_bug_report(%L,%L,%L,null,%L)',
  :'report_title', :'report_description', :'page', :'owned_order'), '22023', 'bug_report_invalid');

select public.submit_bug_report(:'report_title', :'report_description', :'page' || '?ignored=1', :'old_request') as old_report \gset
select pg_temp.purchase_support_assert(public.submit_bug_report(
  p_title => :'report_title', p_description => :'report_description', p_page_url => :'page' || '#ignored',
  p_request_id => :'old_request', p_purchase_order_id => null) = :'old_report'::uuid,
  'four-argument and five-argument null submissions share the canonical receipt');
select public.submit_bug_report(:'report_title', :'report_description', :'page', :'no_link_request', null) as no_link_report \gset
select pg_temp.purchase_support_assert(
  public.submit_bug_report(:'report_title', :'report_description', :'page', :'no_link_request') = :'no_link_report'::uuid,
  'four-argument submission can replay a receipt written through the five-argument null overload');
select public.submit_bug_report(:'report_title', :'report_description', :'page', :'bad_request', :'owned_order') as first_link \gset
select public.submit_bug_report(:'report_title', :'report_description', :'page') as original_report \gset
select public.submit_bug_report(
  p_title => :'report_title', p_description => :'report_description', p_page_url => :'page',
  p_request_id => :'linked_request', p_purchase_order_id => :'owned_order') as linked_report \gset

select pg_temp.purchase_support_assert(public.submit_bug_report(
  :'report_title', :'report_description', :'page', :'linked_request', :'owned_order') = :'linked_report'::uuid,
  'the same linked request replays after the shared quota is reached');
select pg_temp.purchase_support_error(format('select public.submit_bug_report(%L,%L,%L,%L,%L)',
  :'report_title', :'report_description', :'page', :'linked_request', id), '22023', 'bug_report_conflict')
from unnest(array[null, :'other_order']) as orders(id);
select pg_temp.purchase_support_error(format('select public.submit_bug_report(%L,%L,%L,%L,%L)',
  :'report_title', :'report_description', :'page', gen_random_uuid(), :'owned_order'), 'P0001', 'bug_report_limit');
select pg_temp.purchase_support_error(format('select public.submit_bug_report(%L,%L,%L)',
  :'report_title', :'report_description', :'page'), 'P0001', 'bug_report_limit');
select pg_temp.purchase_support_error('select public.admin_bug_report_page()', '42501', '');

select public.my_bug_report_page(null, 1) as first_page \gset
select pg_temp.purchase_support_assert(
  :'first_page'::jsonb#>>'{items,0,id}' = :'linked_report'
  and :'first_page'::jsonb#>'{items,0,purchase}' = jsonb_build_object('reference', :'owned_order', 'mode', 'test'),
  'owner sees exactly the internal reference and mode');
select pg_temp.purchase_support_assert(
  public.my_bug_report_page(:'first_page'::jsonb->'nextCursor', 1)#>>'{items,0,id}' = :'original_report'
  and public.my_bug_report_page(:'first_page'::jsonb->'nextCursor', 1)#>'{items,0,purchase}' = 'null'::jsonb,
  'owner continuation preserves a legacy report with a null association');

select set_config('request.jwt.claim.sub', :'other', true);
select pg_temp.purchase_support_assert(public.my_bug_report_page()->'items' = '[]'::jsonb,
  'another buyer sees no report or purchase association');
select set_config('request.jwt.claim.sub', :'staff', true);
select pg_temp.purchase_support_assert(public.admin_bug_report_page(null, 1)#>'{items,0,purchase}' = jsonb_build_object(
  'reference', :'owned_order', 'mode', 'test', 'status', 'paid',
  'amountMinor', 119300, 'currency', 'INR', 'refundedMinor', 30000, 'reviewRequired', true),
  'staff gets exactly the bounded purchase summary');
select public.admin_reply_bug_report(:'linked_report', 0, 'investigating', 'Fictional reply.', gen_random_uuid());
select pg_temp.purchase_support_assert(public.admin_bug_report_page(null, 1)#>>'{items,0,replyRevision}' = '1',
  'staff reply revision still works on linked reports');

reset role;
update dm_private.bug_reports set purchase_order_id = :'other_order' where id = :'first_link';
update public.launch_settings set environment_mode = 'live' where singleton;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner', true);
select pg_temp.purchase_support_assert(
  (select bool_and(item->'purchase' = 'null'::jsonb) from jsonb_array_elements(public.my_bug_report_page()->'items') item)
  and public.submit_bug_report(:'report_title', :'report_description', :'page', :'linked_request', :'owned_order') = :'linked_report'::uuid,
  'owner summaries hide inactive mode but an existing linked receipt still replays');
select set_config('request.jwt.claim.sub', :'staff', true);
select pg_temp.purchase_support_assert(
  (select bool_and(item->'purchase' = 'null'::jsonb) from jsonb_array_elements(public.admin_bug_report_page()->'items') item),
  'staff summaries hide inactive mode');
reset role;
update public.launch_settings set environment_mode = 'test' where singleton;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner', true);
select pg_temp.purchase_support_assert(
  (select item->'purchase' = 'null'::jsonb from jsonb_array_elements(public.my_bug_report_page()->'items') item
   where item->>'id' = :'first_link'),
  'owner summaries hide an inconsistent foreign order link even in the same mode');
select set_config('request.jwt.claim.sub', :'staff', true);
select pg_temp.purchase_support_assert(
  (select item->'purchase' = 'null'::jsonb from jsonb_array_elements(public.admin_bug_report_page()->'items') item
   where item->>'id' = :'first_link'),
  'staff summaries also hide an inconsistent foreign order link');
reset role;

select pg_temp.purchase_support_assert(pg_temp.purchase_support_payment_state() = :'original_payment'::jsonb,
  'submissions, reads, and staff replies preserve order, pass, event, and refund records');
select pg_temp.purchase_support_assert(
  (select count(*) = 5 from dm_private.bug_reports where reporter_id = :'owner')
  and (select count(*) = 4 from dm_private.bug_report_receipts where reporter_id = :'owner'),
  'invalid submissions never consume quota or reserve receipts and replay never creates duplicates');
rollback;
\echo 'PASS: purchase support ownership, mode, compatible receipts, shared quota, DTOs and payment nonmutation.'
