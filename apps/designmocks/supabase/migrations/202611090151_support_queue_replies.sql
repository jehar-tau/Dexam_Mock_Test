begin;

alter table dm_private.bug_reports
  add column reply_revision integer not null default 0 check (reply_revision >= 0);
create index bug_reports_staff_page on dm_private.bug_reports(created_at desc, id desc);

alter table dm_private.bug_report_updates
  add column request_id uuid,
  add column base_revision integer,
  add constraint bug_report_update_request_revision check (
    (request_id is null and base_revision is null)
    or (request_id is not null and base_revision is not null and base_revision >= 0)
  );
create unique index bug_report_update_request
  on dm_private.bug_report_updates(actor_id, request_id) where request_id is not null;

create function dm_private.lock_support_staff()
returns void language plpgsql security definer set search_path = pg_catalog, dm_private as $$
begin
  perform 1 from dm_private.admins where user_id = auth.uid() for key share;
  if not found then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
end
$$;
revoke all on function dm_private.lock_support_staff() from public, anon, authenticated, service_role;

create function public.admin_bug_report_page(p_cursor jsonb default null, p_limit integer default 25)
returns jsonb language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare
  actor uuid := auth.uid();
  after_at timestamptz;
  after_id uuid;
  items jsonb;
  last_at timestamptz;
  last_id uuid;
  has_more boolean;
begin
  perform dm_private.lock_support_staff();
  if p_limit is null or p_limit not between 1 and 25 then
    raise exception 'Invalid support page' using errcode = '22023';
  end if;
  if p_cursor is not null then
    if jsonb_typeof(p_cursor) is distinct from 'object' then
      raise exception 'Invalid support cursor' using errcode = '22023';
    end if;
    if p_cursor - array['staffId', 'createdAt', 'id'] <> '{}'::jsonb
      or p_cursor->>'staffId' is distinct from actor::text
      or jsonb_typeof(p_cursor->'createdAt') is distinct from 'string'
      or jsonb_typeof(p_cursor->'id') is distinct from 'string'
      or (p_cursor->>'createdAt') !~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$'
      or (p_cursor->>'id') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
      raise exception 'Invalid support cursor' using errcode = '22023';
    end if;
    begin
      after_at := (p_cursor->>'createdAt')::timestamptz;
      after_id := (p_cursor->>'id')::uuid;
    exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
      raise exception 'Invalid support cursor' using errcode = '22023';
    end;
  end if;

  with page as (
    select * from dm_private.bug_reports
    where after_id is null or (created_at, id) < (after_at, after_id)
    order by created_at desc, id desc
    limit p_limit + 1
  ), visible as (
    select * from page order by created_at desc, id desc limit p_limit
  ), last_row as (
    select created_at, id from visible order by created_at, id limit 1
  )
  select coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'title', title, 'description', description,
      'status', status, 'adminReply', admin_reply, 'replyRevision', reply_revision,
      'createdAt', to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    ) order by created_at desc, id desc) from visible), '[]'::jsonb),
    (select created_at from last_row), (select id from last_row), (select count(*) > p_limit from page)
  into items, last_at, last_id, has_more;

  return jsonb_build_object('items', items, 'nextCursor', case when has_more then jsonb_build_object(
    'staffId', actor, 'id', last_id, 'createdAt', to_char(last_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  ) else null end);
end
$$;

create function public.admin_reply_bug_report(
  p_id uuid, p_expected_revision integer, p_status text, p_reply text, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare
  actor uuid := auth.uid();
  report dm_private.bug_reports;
  receipt dm_private.bug_report_updates;
  reply_text text := nullif(btrim(p_reply), '');
  stamp timestamptz;
begin
  if not public.is_dmocks_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_id is null or p_expected_revision is null or p_expected_revision < 0 or p_request_id is null
    or p_status is null or p_status not in ('open', 'investigating', 'fixed', 'closed') then
    raise exception 'Invalid support reply' using errcode = '22023';
  end if;
  perform 1 from auth.users where id = actor for key share;
  if not found then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('dmocks-support-reply:' || actor::text || ':' || p_request_id::text, 0));
  select * into receipt from dm_private.bug_report_updates
    where actor_id = actor and request_id = p_request_id;
  if found then
    perform dm_private.lock_support_staff();
    if receipt.report_id <> p_id or receipt.base_revision <> p_expected_revision
      or receipt.status <> p_status or receipt.reply is distinct from reply_text then
      raise exception 'Support reply request changed' using errcode = '22023', detail = 'support_request_conflict';
    end if;
    return jsonb_build_object('reportId', p_id, 'requestId', p_request_id, 'replyRevision', receipt.base_revision + 1,
      'status', receipt.status, 'adminReply', receipt.reply);
  end if;

  select * into report from dm_private.bug_reports where id = p_id for update;
  perform dm_private.lock_support_staff();
  if report.id is null then
    raise exception 'Report not found' using errcode = '22023';
  end if;
  if report.reply_revision <> p_expected_revision then
    raise exception 'Support report changed' using errcode = '40001', detail = 'support_revision_conflict';
  end if;
  stamp := clock_timestamp();
  update dm_private.bug_reports
    set status = p_status, admin_reply = reply_text, replied_by = actor, replied_at = stamp,
      updated_at = stamp, reply_revision = p_expected_revision + 1
    where id = p_id;
  insert into dm_private.bug_report_updates(report_id, actor_id, previous_status, status, reply, created_at, request_id, base_revision)
    values (p_id, actor, report.status, p_status, reply_text, stamp, p_request_id, p_expected_revision);
  perform dm_private.lock_support_staff();
  return jsonb_build_object('reportId', p_id, 'requestId', p_request_id, 'replyRevision', p_expected_revision + 1,
    'status', p_status, 'adminReply', reply_text);
end
$$;

revoke all on function public.admin_bug_reports(), public.admin_reply_bug_report(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_bug_report_page(jsonb, integer),
  public.admin_reply_bug_report(uuid, integer, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_bug_report_page(jsonb, integer),
  public.admin_reply_bug_report(uuid, integer, text, text, uuid) to authenticated;

commit;
