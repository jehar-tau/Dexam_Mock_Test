\set ON_ERROR_STOP on
begin;

create function pg_temp.support_assert(value boolean, message text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'support assertion failed: %', message; end if;
end
$$;
create function pg_temp.support_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected then return; end if;
    raise;
  end;
  raise exception 'expected support error %', expected;
end
$$;

\set reporter '00000000-0000-4000-8000-000000003101'
\set first '00000000-0000-4000-8000-000000003102'
\set second '00000000-0000-4000-8000-000000003103'
\set report '10000000-0000-4000-8000-000000000030'
\set request '40000000-0000-4000-8000-000000003103'

insert into auth.users(id) values (:'reporter'), (:'first'), (:'second');
insert into dm_private.admins(user_id) values (:'first'), (:'second');
insert into dm_private.bug_reports(id, reporter_id, title, description, created_at)
select ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, :'reporter',
  'Original fictional report ' || n, 'Original report for bounded support review.', now()
from generate_series(1, 30) n;
update dm_private.bug_reports set status = 'investigating', admin_reply = 'Legacy fictional reply',
  replied_by = :'first', replied_at = now() where id = :'report';
insert into dm_private.bug_report_updates(report_id, actor_id, previous_status, status, reply)
values (:'report', :'first', 'open', 'investigating', 'Legacy fictional reply');

select pg_temp.support_assert(
  not has_function_privilege('anon', 'public.admin_bug_report_page(jsonb,integer)', 'execute')
  and not has_function_privilege('service_role', 'public.admin_reply_bug_report(uuid,integer,text,text,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.admin_bug_reports()', 'execute')
  and not has_function_privilege('authenticated', 'public.admin_reply_bug_report(uuid,text,text)', 'execute'),
  'only the authorized page and revisioned write are available'
);
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
select set_config('request.jwt.claim.sub', :'first', true);
select public.admin_bug_report_page() as first_page \gset
select pg_temp.support_assert(
  jsonb_array_length(:'first_page'::jsonb->'items') = 25
  and :'first_page'::jsonb#>>'{items,0,id}' = :'report'
  and :'first_page'::jsonb#>>'{items,0,replyRevision}' = '0'
  and :'first_page'::jsonb#>>'{items,0,adminReply}' = 'Legacy fictional reply',
  'first page is bounded and opens legacy text at its initial revision'
);
select public.admin_bug_report_page(:'first_page'::jsonb->'nextCursor') as second_page \gset
select pg_temp.support_assert(
  jsonb_array_length(:'second_page'::jsonb->'items') = 5
  and :'second_page'::jsonb->'nextCursor' = 'null'::jsonb
  and not exists (
    select 1 from jsonb_array_elements(:'first_page'::jsonb->'items') first
    join jsonb_array_elements(:'second_page'::jsonb->'items') second on first->>'id' = second->>'id'
  ), 'timestamp ties do not duplicate or skip reports between pages'
);
select pg_temp.support_error('select public.admin_bug_report_page(null, 26)', '22023');
select pg_temp.support_error('select public.admin_bug_report_page(''[]'')', '22023');
select pg_temp.support_error(format('select public.admin_bug_report_page(%L::jsonb)',
  jsonb_set(:'first_page'::jsonb->'nextCursor', '{createdAt}', '"2026-99-01T00:00:00.000000Z"')), '22023');

select set_config('request.jwt.claim.sub', :'second', true);
select pg_temp.support_error(format('select public.admin_bug_report_page(%L::jsonb)',
  :'first_page'::jsonb->'nextCursor'), '22023');
select public.admin_reply_bug_report(:'report', 0, 'fixed', '  Current fictional fix.  ', :'request') as saved \gset
select pg_temp.support_assert(
  :'saved'::jsonb = jsonb_build_object('reportId', :'report'::uuid, 'requestId', :'request'::uuid, 'replyRevision', 1,
    'status', 'fixed', 'adminReply', 'Current fictional fix.'),
  'current reviewed revision saves with a bound receipt'
);

select set_config('request.jwt.claim.sub', :'first', true);
select pg_temp.support_error(format('select public.admin_reply_bug_report(%L,0,''open'',''Older reply'',%L)',
  :'report', :'request'), '40001');
select pg_temp.support_assert(
  public.admin_bug_report_page()#>>'{items,0,adminReply}' = 'Current fictional fix.',
  'stale staff reply preserves the newer text and status'
);
select set_config('request.jwt.claim.sub', :'second', true);
select pg_temp.support_assert(
  public.admin_reply_bug_report(:'report', 0, 'fixed', 'Current fictional fix.', :'request') = :'saved'::jsonb,
  'exact retry returns the same receipt after an unknown response'
);
select pg_temp.support_error(format('select public.admin_reply_bug_report(%L,0,''closed'',''Changed reply'',%L)',
  :'report', :'request'), '22023');

select set_config('request.jwt.claim.sub', :'first', true);
select pg_temp.support_assert(
  public.admin_reply_bug_report(:'report', 1, 'closed', 'Follow-up on the current fix.', :'request')->>'replyRevision' = '2',
  'a new reviewed revision and another actor can use a fresh command'
);
select set_config('request.jwt.claim.sub', :'second', true);
select pg_temp.support_assert(
  public.admin_reply_bug_report(:'report', 0, 'fixed', 'Current fictional fix.', :'request') = :'saved'::jsonb,
  'old receipt replay preserves later committed status'
);

select set_config('request.jwt.claim.sub', :'reporter', true);
select pg_temp.support_error('select public.admin_bug_report_page()', '42501');
select pg_temp.support_error(format('select public.admin_reply_bug_report(%L,2,''open'',''Student reply'',%L)',
  :'report', :'request'), '42501');
select pg_temp.support_assert(
  public.my_bug_report_page()#>>'{items,0,status}' = 'closed'
  and public.my_bug_report_page()#>>'{items,0,adminReply}' = 'Follow-up on the current fix.',
  'the reporter can read the current team response'
);

reset role;
select pg_temp.support_assert(
  (select count(*) from dm_private.bug_report_updates where report_id = :'report') = 3
  and (select count(*) from dm_private.bug_report_updates where report_id = :'report' and request_id is null) = 1,
  'original history stays intact and retries create no extra audit rows'
);
rollback;
