begin;

alter table dm_private.community_assets
 add column pixel_width integer,
 add column pixel_height integer,
 add column image_orientation smallint,
 add column image_sha256 text,
 add constraint community_render_metadata check(
  (pixel_width is null and pixel_height is null and image_orientation is null and image_sha256 is null) or
  (pixel_width is not null and pixel_height is not null and image_orientation is not null and image_sha256 is not null
   and pixel_width between 1 and 12000 and pixel_height between 1 and 12000
   and pixel_width::bigint*pixel_height<=24000000 and image_orientation between 1 and 8
   and image_sha256 ~ '^[0-9a-f]{64}$')
 );

-- Match the moderation lock order: parent post, then the reply. The registration
-- transaction rechecks these rows after decoding and Storage complete.
create function dm_private.lock_community_upload_target(p_user_id uuid,p_target_type text,p_target_id uuid)
returns void language plpgsql set search_path=pg_catalog,dm_private as $$
declare post dm_private.community_posts; reply dm_private.community_comments; parent_id uuid;
begin
 if p_user_id is null or p_target_id is null or p_target_type is null or p_target_type not in('post','comment') then
  raise exception 'Community target unavailable' using errcode='42501';
 end if;
 if p_target_type='post' then
  select * into post from dm_private.community_posts where id=p_target_id for update;
  if not found or post.author_id<>p_user_id or post.status<>'visible' then
   raise exception 'Community target unavailable' using errcode='42501';
  end if;
 else
  select post_id into parent_id from dm_private.community_comments where id=p_target_id;
  select * into post from dm_private.community_posts where id=parent_id for update;
  if not found or post.status<>'visible' then raise exception 'Community target unavailable' using errcode='42501'; end if;
  select * into reply from dm_private.community_comments where id=p_target_id for update;
  if not found or reply.post_id<>post.id or reply.author_id<>p_user_id or reply.status<>'visible' then
   raise exception 'Community target unavailable' using errcode='42501';
  end if;
 end if;
end $$;
revoke all on function dm_private.lock_community_upload_target(uuid,text,uuid) from public,anon,authenticated,service_role;

create function public.service_community_upload_context(p_user_id uuid,p_target_type text,p_target_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
 perform dm_private.lock_community_upload_target(p_user_id,p_target_type,p_target_id);
 return true;
end $$;
revoke all on function public.service_community_upload_context(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.service_community_upload_context(uuid,text,uuid) to service_role;

-- Preserve the established service signature and unknown legacy metadata.
create or replace function public.register_community_asset(p_user_id uuid,p_target_type text,p_target_id uuid,p_storage_path text,p_ordinal integer,p_mime_type text,p_byte_size integer)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare asset_id uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
 perform dm_private.lock_community_upload_target(p_user_id,p_target_type,p_target_id);
 insert into dm_private.community_assets(uploader_id,post_id,comment_id,storage_path,ordinal,mime_type,byte_size)
 values(p_user_id,case when p_target_type='post' then p_target_id end,case when p_target_type='comment' then p_target_id end,
  p_storage_path,p_ordinal,p_mime_type,p_byte_size) returning id into asset_id;
 return asset_id;
end $$;

create function public.register_community_asset(p_user_id uuid,p_target_type text,p_target_id uuid,p_storage_path text,p_ordinal integer,p_mime_type text,p_byte_size integer,
 p_pixel_width integer,p_pixel_height integer,p_image_orientation integer,p_image_sha256 text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare asset_id uuid; previous dm_private.community_assets; extension text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
 perform dm_private.lock_community_upload_target(p_user_id,p_target_type,p_target_id);
 if p_ordinal is null or p_ordinal not between 1 and 3 or p_byte_size is null or p_byte_size not between 1 and 5242880
  or p_pixel_width is null or p_pixel_height is null or p_image_orientation is null or p_image_sha256 is null
  or p_pixel_width not between 1 and 12000 or p_pixel_height not between 1 and 12000 or p_pixel_width::bigint*p_pixel_height>24000000
  or p_image_orientation not between 1 and 8 or p_image_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'Invalid community image'; end if;
 extension:=case p_mime_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' end;
 if extension is null or p_storage_path is null or p_storage_path !~
  ('^community/'||p_user_id::text||'/'||p_target_type||'/'||p_target_id::text||'/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.'||extension||'$') then
  raise exception 'Invalid community image path';
 end if;
 select * into previous from dm_private.community_assets where uploader_id=p_user_id and ordinal=p_ordinal
  and case when p_target_type='post' then post_id=p_target_id else comment_id=p_target_id end;
 if found then
  if previous.image_sha256 is distinct from p_image_sha256 or previous.mime_type<>p_mime_type or previous.byte_size<>p_byte_size
   or previous.pixel_width is distinct from p_pixel_width or previous.pixel_height is distinct from p_pixel_height
   or previous.image_orientation is distinct from p_image_orientation then raise exception 'Community image slot is already saved' using errcode='23505'; end if;
  if not exists(select 1 from storage.objects where bucket_id='community-media' and name=previous.storage_path
   and metadata->>'mimetype'=previous.mime_type and (metadata->>'size')::bigint=previous.byte_size) then
   raise exception 'Saved community image is unavailable';
  end if;
  return jsonb_build_object('id',previous.id,'reused',true);
 end if;
 if not exists(select 1 from storage.objects where bucket_id='community-media' and name=p_storage_path
  and metadata->>'mimetype'=p_mime_type and (metadata->>'size')::bigint=p_byte_size) then raise exception 'Community image object mismatch'; end if;
 asset_id:=public.register_community_asset(p_user_id,p_target_type,p_target_id,p_storage_path,p_ordinal,p_mime_type,p_byte_size);
 update dm_private.community_assets set pixel_width=p_pixel_width,pixel_height=p_pixel_height,image_orientation=p_image_orientation,image_sha256=p_image_sha256 where id=asset_id;
 return jsonb_build_object('id',asset_id,'reused',false);
end $$;
revoke all on function public.register_community_asset(uuid,text,uuid,text,integer,text,integer,integer,integer,integer,text) from public,anon,authenticated;
grant execute on function public.register_community_asset(uuid,text,uuid,text,integer,text,integer,integer,integer,integer,text) to service_role;

-- Ambiguous network responses must not delete an already registered object,
-- even if moderation changed while the response was in flight.
create function public.service_community_upload_receipt(p_user_id uuid,p_storage_path text)
returns uuid language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
 return(select id from dm_private.community_assets where uploader_id=p_user_id and storage_path=p_storage_path);
end $$;
revoke all on function public.service_community_upload_receipt(uuid,text) from public,anon,authenticated;
grant execute on function public.service_community_upload_receipt(uuid,text) to service_role;

create or replace function public.community_media_paths(p_target_type text,p_target_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_target_id is null or p_target_type is null or p_target_type not in('post','comment') then raise exception 'Invalid community target'; end if;
 if p_target_type='post' and not exists(select 1 from dm_private.community_posts where id=p_target_id and status<>'hidden') then raise exception 'Community post unavailable' using errcode='42501'; end if;
 if p_target_type='comment' and not exists(select 1 from dm_private.community_comments c join dm_private.community_posts p on p.id=c.post_id
  where c.id=p_target_id and c.status='visible' and p.status<>'hidden') then raise exception 'Community reply unavailable' using errcode='42501'; end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',id,'path',storage_path,'ordinal',ordinal,'mimeType',mime_type,
  'width',pixel_width,'height',pixel_height,'orientation',image_orientation) order by ordinal),'[]') from dm_private.community_assets
  where case when p_target_type='post' then post_id=p_target_id else comment_id=p_target_id end);
end $$;

commit;
