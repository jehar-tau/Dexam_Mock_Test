begin;

alter table dm_private.account_privacy_requests
  add column review_revision integer not null default 0 check (review_revision >= 0);
create index account_privacy_staff_page on dm_private.account_privacy_requests(created_at desc, id desc);

create function public.admin_privacy_request_page(p_cursor jsonb default null, p_limit integer default 25)
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
    raise exception 'Invalid privacy request page' using errcode = '22023';
  end if;
  if p_cursor is not null then
    if jsonb_typeof(p_cursor) is distinct from 'object' then
      raise exception 'Invalid privacy request cursor' using errcode = '22023';
    end if;
    if p_cursor - array['queue', 'staffId', 'createdAt', 'id'] <> '{}'::jsonb
      or p_cursor->>'queue' is distinct from 'privacy'
      or p_cursor->>'staffId' is distinct from actor::text
      or jsonb_typeof(p_cursor->'createdAt') is distinct from 'string'
      or jsonb_typeof(p_cursor->'id') is distinct from 'string'
      or (p_cursor->>'createdAt') !~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$'
      or (p_cursor->>'id') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
      raise exception 'Invalid privacy request cursor' using errcode = '22023';
    end if;
    begin
      after_at := (p_cursor->>'createdAt')::timestamptz;
      after_id := (p_cursor->>'id')::uuid;
    exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
      raise exception 'Invalid privacy request cursor' using errcode = '22023';
    end;
  end if;

  with page as (
    select * from dm_private.account_privacy_requests
    where after_id is null or (created_at, id) < (after_at, after_id)
    order by created_at desc, id desc limit p_limit + 1
  ), visible as (
    select * from page order by created_at desc, id desc limit p_limit
  ), last_row as (
    select created_at, id from visible order by created_at, id limit 1
  )
  select coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'userId', user_id, 'type', request_type, 'status', status,
      'adminNote', admin_note, 'reviewRevision', review_revision,
      'createdAt', to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    ) order by created_at desc, id desc) from visible), '[]'::jsonb),
    (select created_at from last_row), (select id from last_row), (select count(*) > p_limit from page)
  into items, last_at, last_id, has_more;

  return jsonb_build_object('items', items, 'nextCursor', case when has_more then jsonb_build_object(
    'queue', 'privacy', 'staffId', actor, 'id', last_id,
    'createdAt', to_char(last_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  ) else null end);
end
$$;

create function public.admin_resolve_privacy_request(
  p_id uuid, p_expected_revision integer, p_status text, p_note text
) returns jsonb language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare
  actor uuid := auth.uid();
  request dm_private.account_privacy_requests;
  note text := nullif(regexp_replace(p_note, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  stamp timestamptz;
begin
  if not public.is_dmocks_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_id is null or p_expected_revision is null or p_expected_revision < 0
    or p_status is null or p_status not in ('in_progress', 'closed', 'declined')
    or note is null or char_length(note) not between 10 and 2000 then
    raise exception 'Invalid privacy request decision' using errcode = '22023';
  end if;
  perform 1 from auth.users where id = actor for key share;
  if not found then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  select * into request from dm_private.account_privacy_requests where id = p_id for update;
  perform dm_private.lock_support_staff();
  if request.id is null then
    raise exception 'Privacy request not found' using errcode = '22023';
  end if;
  if request.review_revision <> p_expected_revision or request.status not in ('open', 'in_progress') then
    raise exception 'Privacy request changed' using errcode = '40001', detail = 'privacy_review_conflict';
  end if;

  stamp := clock_timestamp();
  update dm_private.account_privacy_requests
    set status = p_status, admin_note = note, handled_by = actor, handled_at = stamp,
      updated_at = stamp, review_revision = p_expected_revision + 1
    where id = p_id;
  perform dm_private.lock_support_staff();
  return jsonb_build_object('requestId', p_id, 'reviewRevision', p_expected_revision + 1,
    'status', p_status, 'adminNote', note);
end
$$;

revoke all on function public.admin_privacy_requests(), public.admin_resolve_privacy_request(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_privacy_request_page(jsonb, integer),
  public.admin_resolve_privacy_request(uuid, integer, text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_privacy_request_page(jsonb, integer),
  public.admin_resolve_privacy_request(uuid, integer, text, text) to authenticated;

commit;
