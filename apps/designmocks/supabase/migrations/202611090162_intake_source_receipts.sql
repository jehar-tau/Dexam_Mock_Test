begin;

alter table dm_private.question_intake_assets
  add column source_sha256 text check (source_sha256 ~ '^[a-f0-9]{64}$');

create function public.register_question_intake_source(
  p_uploaded_by uuid, p_original_name text, p_mime_type text, p_byte_size integer, p_source_sha256 text
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare
  suffix text := case p_mime_type
    when 'application/pdf' then 'pdf' when 'image/png' then 'png'
    when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' end;
  source_path text;
  object_present boolean;
  asset dm_private.question_intake_assets;
  reused boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_uploaded_by is null or p_original_name is null or suffix is null
    or (p_byte_size between 1 and 26214400) is not true
    or (p_source_sha256 ~ '^[a-f0-9]{64}$') is not true then
    raise exception 'Invalid private intake source' using errcode = '22023';
  end if;
  source_path := 'intake/' || p_uploaded_by::text || '/sources/' ||
    encode(sha256(convert_to(p_original_name, 'UTF8')), 'hex') || '-' || p_source_sha256 || '.' || suffix;
  perform pg_advisory_xact_lock(hashtextextended('dmocks-intake-source:' || source_path, 0));
  perform 1 from storage.objects where bucket_id = 'question-intake' and name = source_path
    and metadata->>'mimetype' = p_mime_type and metadata->>'size' = p_byte_size::text for key share;
  object_present := found;
  perform dm_private.lock_question_processing_admin(p_uploaded_by);
  if not object_present then raise exception 'Verified private source object required' using errcode = '22023'; end if;

  select * into asset from dm_private.question_intake_assets where storage_path = source_path;
  reused := found;
  if reused then
    if (asset.uploaded_by, asset.original_name, asset.mime_type, asset.byte_size, asset.source_sha256)
      is distinct from (p_uploaded_by, p_original_name, p_mime_type, p_byte_size, p_source_sha256) then
      raise exception 'Existing private source metadata differs' using errcode = '22023';
    end if;
  else
    insert into dm_private.question_intake_assets(storage_path, original_name, mime_type, byte_size, uploaded_by, source_sha256)
      values (source_path, p_original_name, p_mime_type, p_byte_size, p_uploaded_by, p_source_sha256)
      returning * into asset;
  end if;
  return jsonb_build_object('id', asset.id, 'name', asset.original_name, 'status', asset.status,
    'sourceSha256', asset.source_sha256, 'reused', reused);
end $$;

revoke all on function public.register_question_intake_source(uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.register_question_intake_source(uuid, text, text, integer, text) to service_role;

create or replace function public.admin_question_intake_source(p_asset_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, dm_private as $$
declare asset dm_private.question_intake_assets;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  select * into asset from dm_private.question_intake_assets where id = p_asset_id;
  if not found then raise exception 'Intake source unavailable'; end if;
  return jsonb_build_object('storagePath', asset.storage_path, 'mimeType', asset.mime_type, 'byteSize', asset.byte_size)
    || case when asset.source_sha256 is null then '{}'::jsonb else jsonb_build_object('sourceSha256', asset.source_sha256) end;
end $$;

create or replace function dm_private.claim_question_intake_asset(p_asset_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare asset dm_private.question_intake_assets;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into asset from dm_private.question_intake_assets where id = p_asset_id for update;
  if asset.id is null or asset.status not in ('uploaded', 'failed') then
    raise exception 'Intake asset is not available for extraction';
  end if;
  if asset.byte_size > 10485760 then raise exception 'Split files above 10 MB before extraction'; end if;
  delete from dm_private.question_intake_candidates where asset_id = asset.id and status = 'pending';
  update dm_private.question_intake_assets set status = 'extracting', extraction_error = null, updated_at = now() where id = asset.id;
  return jsonb_build_object('id', asset.id, 'storagePath', asset.storage_path, 'name', asset.original_name,
    'mimeType', asset.mime_type, 'byteSize', asset.byte_size)
    || case when asset.source_sha256 is null then '{}'::jsonb else jsonb_build_object('sourceSha256', asset.source_sha256) end;
end $$;

commit;
