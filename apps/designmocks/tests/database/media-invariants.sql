\set ON_ERROR_STOP on
begin;
do $$begin
  if not exists(select 1 from storage.buckets where id='paper-media' and not public and file_size_limit=10485760 and allowed_mime_types=array['image/png','image/jpeg','image/webp']) then raise exception 'Private media bucket configuration failed'; end if;
  if not exists(select 1 from storage.buckets where id='community-media' and not public and file_size_limit=5242880 and allowed_mime_types=array['image/png','image/jpeg','image/webp']) then raise exception 'Private community media bucket configuration failed'; end if;
end $$;
rollback;
\echo 'PASS: private raster-only media bucket configuration (catalogue stub)'
