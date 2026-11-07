begin;

-- Ownership hints only control presentation; the slot reader and existing upload
-- registrar recheck the actor, parent status and immutable image positions.
create or replace function public.community_thread(p_post_id uuid,p_cursor jsonb,p_limit integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare target dm_private.community_posts; after_time timestamptz; after_id uuid; snapshot_at timestamptz:=statement_timestamp();
 version bigint; result jsonb; page jsonb; last_row dm_private.community_comments; has_more boolean;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid community page size' using errcode='22023'; end if;
 select * into target from dm_private.community_posts where id=p_post_id and status<>'hidden' for share;
 if not found then raise exception 'Post not found' using errcode='42501',detail='community_target_unavailable'; end if;
 if p_cursor is not null then
  begin
   if jsonb_typeof(p_cursor)<>'object' or (select count(*) from jsonb_object_keys(p_cursor))<>4
    or jsonb_typeof(p_cursor->'createdAt')<>'string' or jsonb_typeof(p_cursor->'id')<>'string'
    or jsonb_typeof(p_cursor->'snapshotAt')<>'string' or jsonb_typeof(p_cursor->'version')<>'number'
    or (p_cursor->>'version') !~ '^[1-9][0-9]*$' then raise exception 'Invalid cursor'; end if;
   after_time:=(p_cursor->>'createdAt')::timestamptz;after_id:=(p_cursor->>'id')::uuid;
   snapshot_at:=(p_cursor->>'snapshotAt')::timestamptz;version:=(p_cursor->>'version')::bigint;
   if after_time is null or after_id is null or snapshot_at is null or version is null or not isfinite(after_time) or not isfinite(snapshot_at)
    or snapshot_at>statement_timestamp() or after_time>snapshot_at then raise exception 'Invalid cursor'; end if;
  exception when others then raise exception 'Invalid community cursor' using errcode='22023'; end;
  if version<>target.thread_revision then raise exception 'Discussion changed. Refresh the discussion' using errcode='40001',detail='community_thread_changed'; end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'parentId',c.parent_id,'body',c.body,'helpful',c.helpful_count,
  'author',coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student'),'createdAt',c.created_at,'isMine',c.author_id=auth.uid(),
  'canAttach',c.author_id=auth.uid() and target.status='visible' and (select count(*) from dm_private.community_assets a where a.comment_id=c.id)<3,
  'canReply',target.status='visible','markedHelpful',exists(select 1 from dm_private.community_helpful h where h.user_id=auth.uid() and h.comment_id=c.id),
  'parentAvailable',parent.id is not null,'parentPreview',case when parent.id is not null then jsonb_build_object('author',coalesce(nullif(split_part(parent_profile.display_name,' ',1),''),'Student'),'body',left(parent.body,160)) end,
  'assetCount',(select count(*) from dm_private.community_assets a where a.comment_id=c.id)) order by c.created_at,c.id),'[]') into page
 from(select * from dm_private.community_comments where post_id=p_post_id and status='visible' and created_at<=snapshot_at
  and (after_time is null or (created_at,id)>(after_time,after_id)) order by created_at,id limit p_limit)c
 left join public.profiles pr on pr.user_id=c.author_id
 left join dm_private.community_comments parent on parent.id=c.parent_id and parent.post_id=p_post_id and parent.status='visible'
 left join public.profiles parent_profile on parent_profile.user_id=parent.author_id;
 select * into last_row from dm_private.community_comments where post_id=p_post_id and status='visible' and created_at<=snapshot_at
  and (after_time is null or (created_at,id)>(after_time,after_id)) order by created_at,id limit 1 offset p_limit-1;
 has_more:=found and exists(select 1 from dm_private.community_comments where post_id=p_post_id and status='visible' and created_at<=snapshot_at and (created_at,id)>(last_row.created_at,last_row.id));
 result:=jsonb_build_object('id',target.id,'title',target.title,'body',target.body,'exam',target.exam,'topic',target.topic,'status',target.status,'isMine',target.author_id=auth.uid(),
  'canAttach',target.author_id=auth.uid() and target.status='visible' and (select count(*) from dm_private.community_assets where post_id=p_post_id)<3,
  'assetCount',(select count(*) from dm_private.community_assets where post_id=p_post_id),'comments',page,'version',target.thread_revision,
  'nextCursor',case when has_more then jsonb_build_object('createdAt',last_row.created_at,'id',last_row.id,'snapshotAt',snapshot_at,'version',target.thread_revision) end);
 return result;
end $$;

create function public.community_attachment_slots(p_target_type text,p_target_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid(); parent_id uuid; target dm_private.community_posts; reply dm_private.community_comments; occupied jsonb;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501',detail='community_attachments_unavailable'; end if;
 if p_target_type is null or p_target_type not in('post','comment') or p_target_id is null then
  raise exception 'Invalid attachment target' using errcode='22023',detail='community_attachments_invalid';
 end if;
 parent_id:=case when p_target_type='post' then p_target_id else(select post_id from dm_private.community_comments where id=p_target_id) end;
 select * into target from dm_private.community_posts where id=parent_id for share;
 if not found or target.status<>'visible' then
  raise exception 'This upload target is unavailable' using errcode='42501',detail='community_attachments_unavailable';
 end if;
 if p_target_type='post' then
  if target.author_id<>actor then raise exception 'This upload target is unavailable' using errcode='42501',detail='community_attachments_unavailable'; end if;
 else
  select * into reply from dm_private.community_comments where id=p_target_id and post_id=target.id for share;
  if not found or reply.status<>'visible' or reply.author_id<>actor then
   raise exception 'This upload target is unavailable' using errcode='42501',detail='community_attachments_unavailable';
  end if;
 end if;
 select coalesce(jsonb_agg(ordinal order by ordinal),'[]') into occupied from dm_private.community_assets
  where (p_target_type='post' and post_id=p_target_id) or(p_target_type='comment' and comment_id=p_target_id);
 return jsonb_build_object('targetType',p_target_type,'targetId',p_target_id,'postId',target.id,'occupiedOrdinals',occupied,'maximum',3);
end $$;
revoke all on function public.community_attachment_slots(text,uuid) from public,anon,service_role;
grant execute on function public.community_attachment_slots(text,uuid) to authenticated;

commit;
