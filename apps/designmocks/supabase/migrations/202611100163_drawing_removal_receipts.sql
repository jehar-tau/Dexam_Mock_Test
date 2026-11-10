begin;

create table dm_private.drawing_removal_receipts (
  upload_id uuid primary key,
  student_id uuid not null,
  storage_path text not null unique,
  removed_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
alter table dm_private.drawing_removal_receipts enable row level security;
revoke all on dm_private.drawing_removal_receipts from public, anon, authenticated, service_role;
create index drawing_removals_pending on dm_private.drawing_removal_receipts(removed_at, upload_id)
  where deleted_at is null;

create function dm_private.guard_retired_drawing_path()
returns trigger language plpgsql security definer set search_path = pg_catalog, dm_private as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('dmocks-drawing-path:' || new.storage_path, 0));
  if exists (select 1 from dm_private.drawing_removal_receipts where storage_path = new.storage_path) then
    raise exception 'Drawing storage path has been retired' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function dm_private.guard_retired_drawing_path() from public, anon, authenticated, service_role;
create trigger drawing_upload_path_not_retired before insert or update of storage_path
  on dm_private.drawing_uploads for each row execute function dm_private.guard_retired_drawing_path();

-- Keep the original service signature for existing callers. The receipt and
-- removal commit together, so a lost reply never loses the cleanup target.
create or replace function public.remove_drawing_upload(p_student_id uuid, p_id uuid)
returns text language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare
  attempt dm_private.attempts;
  removed dm_private.drawing_uploads;
  prior_path text;
  target_path text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  select storage_path into prior_path from dm_private.drawing_removal_receipts
    where upload_id = p_id and student_id = p_student_id;
  if found then return prior_path; end if;

  select a.* into attempt from dm_private.attempts a
    join dm_private.drawing_uploads u on u.attempt_id = a.id
    where u.id = p_id and u.student_id = p_student_id and a.user_id = p_student_id for update of a;
  select storage_path into prior_path from dm_private.drawing_removal_receipts
    where upload_id = p_id and student_id = p_student_id;
  if found then return prior_path; end if;
  if attempt.id is null then raise exception 'Upload unavailable'; end if;

  select storage_path into target_path from dm_private.drawing_uploads where id = p_id and student_id = p_student_id;
  if not found then raise exception 'Upload unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dmocks-drawing-path:' || target_path, 0));
  if dm_private.drawing_upload_cutoff(attempt) <= clock_timestamp() then raise exception 'Upload unavailable'; end if;

  delete from dm_private.drawing_uploads u where u.id = p_id and u.storage_path = target_path
    and not exists (select 1 from dm_private.drawing_reviews r
      where r.attempt_id = u.attempt_id and r.question_id = u.question_id and r.status <> 'pending')
    returning * into removed;
  if not found then raise exception 'Upload unavailable'; end if;
  insert into dm_private.drawing_removal_receipts(upload_id, student_id, storage_path)
    values (removed.id, removed.student_id, removed.storage_path);
  delete from dm_private.drawing_reviews r where r.attempt_id = removed.attempt_id
    and r.question_id = removed.question_id and r.status = 'pending'
    and not exists (select 1 from dm_private.drawing_uploads u
      where u.attempt_id = r.attempt_id and u.question_id = r.question_id);
  return removed.storage_path;
end $$;

create function public.service_confirm_drawing_removal(p_id uuid, p_storage_path text)
returns boolean language plpgsql security definer set search_path = pg_catalog, dm_private as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  update dm_private.drawing_removal_receipts set deleted_at = coalesce(deleted_at, clock_timestamp())
    where upload_id = p_id and storage_path = p_storage_path
      and not exists (select 1 from storage.objects where bucket_id = 'drawing-submissions' and name = p_storage_path)
      and not exists (select 1 from dm_private.drawing_uploads where storage_path = p_storage_path);
  return found;
end $$;

create function public.service_pending_drawing_removals(p_limit integer default 25)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, dm_private as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.launch_settings where singleton and environment_mode = 'test' and not sales_enabled) then
    raise exception 'Drawing cleanup requires a closed Test environment' using errcode = '42501';
  end if;
  if (p_limit between 1 and 50) is not true then raise exception 'Invalid drawing cleanup limit' using errcode = '22023'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', upload_id, 'storagePath', storage_path)
    order by removed_at, upload_id), '[]'::jsonb) from (
      select upload_id, storage_path, removed_at from dm_private.drawing_removal_receipts
      where deleted_at is null order by removed_at, upload_id limit p_limit
    ) pending);
end $$;

revoke all on function public.service_confirm_drawing_removal(uuid, text), public.service_pending_drawing_removals(integer)
  from public, anon, authenticated;
grant execute on function public.service_confirm_drawing_removal(uuid, text), public.service_pending_drawing_removals(integer)
  to service_role;

commit;
