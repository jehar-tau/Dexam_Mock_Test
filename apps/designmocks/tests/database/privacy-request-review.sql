\set ON_ERROR_STOP on
begin;

create function pg_temp.review_assert(value boolean, message text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'Privacy review assertion failed: %', message; end if;
end
$$;
create function pg_temp.review_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected then return; end if;
    raise;
  end;
  raise exception 'Expected privacy review error %', expected;
end
$$;

\set owner '00000000-0000-4000-8000-000000003201'
\set first '00000000-0000-4000-8000-000000003202'
\set second '00000000-0000-4000-8000-000000003203'
\set request '30000000-0000-4000-8000-000000000030'
\set cancelled '30000000-0000-4000-8000-000000000029'

insert into auth.users(id) values (:'owner'), (:'first'), (:'second');
insert into dm_private.admins(user_id) values (:'first'), (:'second');
insert into dm_private.account_privacy_requests(id, user_id, request_type, status)
select ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, :'owner',
  'account_deletion', case when n = 30 then 'open' else 'cancelled' end
from generate_series(1, 30) n;

select pg_temp.review_assert(
  not has_function_privilege('anon', 'public.admin_privacy_request_page(jsonb,integer)', 'execute')
  and not has_function_privilege('service_role', 'public.admin_resolve_privacy_request(uuid,integer,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.admin_privacy_requests()', 'execute')
  and not has_function_privilege('authenticated', 'public.admin_resolve_privacy_request(uuid,text,text)', 'execute'),
  'the legacy queue and unconditional write are unavailable'
);
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
select set_config('request.jwt.claim.sub', :'first', true);
select public.admin_privacy_request_page() as first_page \gset
select public.admin_privacy_request_page(:'first_page'::jsonb->'nextCursor') as second_page \gset
select pg_temp.review_assert(
  jsonb_array_length(:'first_page'::jsonb->'items') = 25 and jsonb_array_length(:'second_page'::jsonb->'items') = 5
  and :'first_page'::jsonb#>>'{items,0,id}' = :'request' and :'first_page'::jsonb#>>'{items,0,reviewRevision}' = '0'
  and :'second_page'::jsonb->'nextCursor' = 'null'::jsonb
  and not exists (
    select 1 from jsonb_array_elements(:'first_page'::jsonb->'items') a
    join jsonb_array_elements(:'second_page'::jsonb->'items') b on a->>'id' = b->>'id'
  ), 'the staff queue is bounded and handles tied timestamps'
);
select pg_temp.review_error('select public.admin_privacy_request_page(null, 26)', '22023');
select pg_temp.review_error(format('select public.admin_privacy_request_page(%L::jsonb)',
  (:'first_page'::jsonb->'nextCursor') - 'queue'), '22023');
select pg_temp.review_error(format('select public.admin_resolve_privacy_request(%L,0,''closed'',null)', :'request'), '22023');
select pg_temp.review_error(format('select public.admin_resolve_privacy_request(%L,0,''closed'',%L)', :'request', repeat(E'\t', 20)), '22023');

select set_config('request.jwt.claim.sub', :'second', true);
select pg_temp.review_error(format('select public.admin_privacy_request_page(%L::jsonb)', :'first_page'::jsonb->'nextCursor'), '22023');
select public.admin_resolve_privacy_request(:'request', 0, 'in_progress', '  Original fictional current review.  ') as current \gset
select pg_temp.review_assert(
  :'current'::jsonb = jsonb_build_object('requestId', :'request'::uuid, 'reviewRevision', 1,
    'status', 'in_progress', 'adminNote', 'Original fictional current review.'), 'the update acknowledges the inspected revision'
);
select set_config('request.jwt.claim.sub', :'first', true);
select pg_temp.review_error(format('select public.admin_resolve_privacy_request(%L,0,''closed'',''Original fictional stale decision.'')', :'request'), '40001');
select pg_temp.review_error(format('select public.admin_resolve_privacy_request(%L,0,''closed'',''Original fictional cancelled decision.'')', :'cancelled'), '40001');
select pg_temp.review_assert(public.admin_privacy_request_page()#>>'{items,0,adminNote}' = 'Original fictional current review.',
  'a stale review preserves the newer note');
select public.admin_resolve_privacy_request(:'request', 1, 'closed', 'Original fictional decision after fresh review.');
select pg_temp.review_error(format('select public.admin_resolve_privacy_request(%L,1,''closed'',''Original fictional decision after fresh review.'')', :'request'), '40001');

select set_config('request.jwt.claim.sub', :'owner', true);
select pg_temp.review_error('select public.admin_privacy_request_page()', '42501');
select pg_temp.review_error(format('select public.admin_resolve_privacy_request(%L,2,''closed'',''Fictional student decision.'')', :'request'), '42501');
select pg_temp.review_assert(exists (
  select 1 from jsonb_array_elements(public.my_privacy_requests()) row
  where row->>'id' = :'request' and row->>'status' = 'closed' and row->>'adminNote' = 'Original fictional decision after fresh review.'
), 'the owner sees the recorded decision');
reset role;
select pg_temp.review_assert((select count(*) from auth.users where id in (:'owner', :'first', :'second')) = 3,
  'recording a status preserves accounts');
rollback;
