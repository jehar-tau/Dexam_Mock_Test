-- Canonical media is content-addressed, private and independent of publication approval.
create table dm_private.bank_media_assets (
 sha256 text primary key check(sha256~'^[a-f0-9]{64}$'),
 storage_path text unique not null check(storage_path='papers/canonical/'||sha256||'.png'),
 width integer not null check(width between 1 and 8192),
 height integer not null check(height between 1 and 8192),
 byte_size integer not null check(byte_size between 45 and 10485760),
 verified_at timestamptz not null default now(),
 check(width::bigint*height<=16777216)
);
alter table dm_private.bank_media_assets enable row level security;
revoke all on dm_private.bank_media_assets from public,anon,authenticated;
create index bank_canonical_assets_idx on dm_private.bank_questions using gin((payload->'assets')) where active;

create or replace function public.register_bank_media_assets(p_records jsonb)
returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare r jsonb; n integer:=0;v_sha text;v_path text;v_width integer;v_height integer;v_size integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Forbidden';end if;
 if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 100 then raise exception 'Invalid canonical media batch';end if;
 if not exists(select 1 from storage.buckets where id='paper-media' and public=false and 'image/png'=any(allowed_mime_types)) then raise exception 'Private raster bucket required';end if;
 for r in select value from jsonb_array_elements(p_records) loop
  v_sha:=r->>'sha256';v_path:=r->>'storagePath';v_width:=(r->>'width')::integer;v_height:=(r->>'height')::integer;v_size:=(r->>'byteSize')::integer;
  if v_sha is null or v_sha!~'^[a-f0-9]{64}$' or v_path is distinct from 'papers/canonical/'||v_sha||'.png' or v_width is null or v_height is null or v_size is null or v_width not between 1 and 8192 or v_height not between 1 and 8192 or v_width::bigint*v_height>16777216 or v_size not between 45 and 10485760 then raise exception 'Invalid canonical image metadata';end if;
  if not exists(select 1 from dm_private.bank_questions q where q.active and q.payload->'holds'='[]'::jsonb and q.payload->'assets' @> jsonb_build_array(jsonb_build_object('sha256',v_sha,'width',v_width,'height',v_height))) then raise exception 'Image is not referenced by the active canonical bank';end if;
  if not exists(select 1 from storage.objects where bucket_id='paper-media' and name=v_path and metadata->>'mimetype'='image/png' and metadata->>'size'=v_size::text) then raise exception 'Verified private storage object is missing or mismatched';end if;
  insert into dm_private.bank_media_assets(sha256,storage_path,width,height,byte_size) values(v_sha,v_path,v_width,v_height,v_size)
  on conflict(sha256) do update set verified_at=now() where dm_private.bank_media_assets.storage_path=excluded.storage_path and dm_private.bank_media_assets.width=excluded.width and dm_private.bank_media_assets.height=excluded.height and dm_private.bank_media_assets.byte_size=excluded.byte_size;
  if not found then raise exception 'Existing canonical image metadata differs';end if;
  n:=n+1;
 end loop;
 return n;
end $$;

create or replace function public.canonical_bank_media_manifest()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Forbidden';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('sha256',sha256,'path',storage_path,'width',width,'height',height,'byteSize',byte_size) order by sha256),'[]'::jsonb) from dm_private.bank_media_assets);
end $$;
revoke all on function public.register_bank_media_assets(jsonb),public.canonical_bank_media_manifest() from public,anon,authenticated;
grant execute on function public.register_bank_media_assets(jsonb),public.canonical_bank_media_manifest() to service_role;
