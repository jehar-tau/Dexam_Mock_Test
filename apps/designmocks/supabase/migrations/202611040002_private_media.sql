begin;
-- Server-only signing after attempt ownership checks. Never make this bucket public.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('paper-media','paper-media',false,10485760,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- No anon/authenticated policies: uploads and signing use the isolated service account.
commit;
