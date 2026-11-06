insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('community-media','community-media',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id)do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table dm_private.community_assets(
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references auth.users(id)on delete cascade,
  post_id uuid references dm_private.community_posts(id)on delete cascade,
  comment_id uuid references dm_private.community_comments(id)on delete cascade,
  storage_path text unique not null,
  ordinal integer not null check(ordinal between 1 and 3),
  mime_type text not null check(mime_type in('image/png','image/jpeg','image/webp')),
  byte_size integer not null check(byte_size between 1 and 5242880),
  created_at timestamptz not null default now(),
  check((post_id is null)<>(comment_id is null)),
  unique(post_id,ordinal),unique(comment_id,ordinal)
);
alter table dm_private.community_assets enable row level security;
revoke all on dm_private.community_assets from anon,authenticated;

create or replace function public.register_community_asset(p_user_id uuid,p_target_type text,p_target_id uuid,p_storage_path text,p_ordinal integer,p_mime_type text,p_byte_size integer)returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v uuid;
begin
  if auth.role()is distinct from'service_role'then raise exception'Forbidden';end if;
  if p_target_type='post'then
    if not exists(select 1 from dm_private.community_posts where id=p_target_id and author_id=p_user_id and status='visible')then raise exception'Community post unavailable';end if;
    insert into dm_private.community_assets(uploader_id,post_id,storage_path,ordinal,mime_type,byte_size)values(p_user_id,p_target_id,p_storage_path,p_ordinal,p_mime_type,p_byte_size)returning id into v;
  elsif p_target_type='comment'then
    if not exists(select 1 from dm_private.community_comments c join dm_private.community_posts p on p.id=c.post_id where c.id=p_target_id and c.author_id=p_user_id and c.status='visible'and p.status='visible')then raise exception'Community reply unavailable';end if;
    insert into dm_private.community_assets(uploader_id,comment_id,storage_path,ordinal,mime_type,byte_size)values(p_user_id,p_target_id,p_storage_path,p_ordinal,p_mime_type,p_byte_size)returning id into v;
  else raise exception'Invalid community target';end if;
  return v;
end$$;

create or replace function public.community_media_paths(p_target_type text,p_target_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if auth.uid()is null then raise exception'Sign in required';end if;
  if p_target_type='post'and not exists(select 1 from dm_private.community_posts where id=p_target_id and status<>'hidden')then raise exception'Community post unavailable';end if;
  if p_target_type='comment'and not exists(select 1 from dm_private.community_comments c join dm_private.community_posts p on p.id=c.post_id where c.id=p_target_id and c.status='visible'and p.status<>'hidden')then raise exception'Community reply unavailable';end if;
  if p_target_type not in('post','comment')then raise exception'Invalid community target';end if;
  return(select coalesce(jsonb_agg(jsonb_build_object('id',id,'path',storage_path,'ordinal',ordinal)order by ordinal),'[]')from dm_private.community_assets where case when p_target_type='post'then post_id=p_target_id else comment_id=p_target_id end);
end$$;

create or replace function public.community_feed(p_exam text default null,p_topic text default null)returns jsonb language sql stable security definer set search_path=pg_catalog,dm_private,public as $$
select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'exam',p.exam,'topic',p.topic,'title',p.title,'body',p.body,'status',p.status,'author',coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student'),'createdAt',p.created_at,'comments',(select count(*)from dm_private.community_comments c where c.post_id=p.id and c.status='visible'),'assetCount',(select count(*)from dm_private.community_assets a where a.post_id=p.id))order by p.created_at desc),'[]')from dm_private.community_posts p left join public.profiles pr on pr.user_id=p.author_id where auth.uid()is not null and p.status<>'hidden'and(p_exam is null or p.exam=p_exam)and(p_topic is null or p.topic=p_topic)
$$;

create or replace function public.community_thread(p_post_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public as $$
declare v jsonb;
begin
  if auth.uid()is null then raise exception'Sign in required';end if;
  select jsonb_build_object('id',p.id,'title',p.title,'body',p.body,'exam',p.exam,'topic',p.topic,'status',p.status,'assetCount',(select count(*)from dm_private.community_assets a where a.post_id=p.id),'comments',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'parentId',c.parent_id,'body',c.body,'helpful',c.helpful_count,'author',coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student'),'assetCount',(select count(*)from dm_private.community_assets a where a.comment_id=c.id))order by c.created_at)from dm_private.community_comments c left join public.profiles pr on pr.user_id=c.author_id where c.post_id=p.id and c.status='visible'),'[]'))into v from dm_private.community_posts p where p.id=p_post_id and p.status<>'hidden';
  if v is null then raise exception'Post not found';end if;return v;
end$$;

revoke all on function public.register_community_asset(uuid,text,uuid,text,integer,text,integer)from public,anon,authenticated;
grant execute on function public.register_community_asset(uuid,text,uuid,text,integer,text,integer)to service_role;
revoke all on function public.community_media_paths(text,uuid)from public,anon;
grant execute on function public.community_media_paths(text,uuid)to authenticated;
