begin;

create table dm_private.community_write_receipts(
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 operation text not null check(operation in('post','comment')),
 fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 target_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table dm_private.community_write_receipts enable row level security;
revoke all on dm_private.community_write_receipts from public,anon,authenticated,service_role;

-- Legacy callers keep their signatures, validation and the same hourly locks.
create or replace function public.create_community_post(p_exam text,p_topic text,p_title text,p_body text)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_exam is null or lower(trim(p_exam)) not in('uceed','nid','nift','ceed')
  or p_topic is null or char_length(trim(p_topic)) not between 1 and 100
  or p_title is null or char_length(trim(p_title)) not between 8 and 160
  or p_body is null or char_length(trim(p_body)) not between 20 and 5000 then
  raise exception 'Invalid community post' using errcode='22023',detail='community_invalid_input';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('community-post:'||auth.uid()::text,0));
 if(select count(*) from dm_private.community_posts where author_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then
  raise exception 'Too many community posts. Please try again later' using detail='community_post_limit';
 end if;
 insert into dm_private.community_posts(author_id,exam,topic,title,body) values(auth.uid(),lower(trim(p_exam)),trim(p_topic),trim(p_title),trim(p_body)) returning id into result;
 return result;
end $$;

create or replace function public.add_community_comment(p_post_id uuid,p_parent_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare result uuid; target dm_private.community_posts; parent dm_private.community_comments;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_body is null or char_length(trim(p_body)) not between 2 and 3000 then
  raise exception 'Invalid community reply' using errcode='22023',detail='community_invalid_input';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('community-comment:'||auth.uid()::text,0));
 if(select count(*) from dm_private.community_comments where author_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then
  raise exception 'Too many replies. Please try again later' using detail='community_reply_limit';
 end if;
 select * into target from dm_private.community_posts where id=p_post_id for update;
 if not found or target.status<>'visible' then raise exception 'Post is unavailable or locked' using errcode='42501',detail='community_target_unavailable'; end if;
 if p_parent_id is not null then
  select * into parent from dm_private.community_comments where id=p_parent_id for update;
  if not found or parent.post_id<>p_post_id or parent.status<>'visible' then
   raise exception 'Reply target not found' using errcode='42501',detail='community_target_unavailable';
  end if;
 end if;
 insert into dm_private.community_comments(post_id,parent_id,author_id,body,created_at) values(p_post_id,p_parent_id,auth.uid(),trim(p_body),clock_timestamp()) returning id into result;
 return result;
end $$;

create function dm_private.community_write_result(p_user_id uuid,p_operation text,p_id uuid,p_replayed boolean)
returns jsonb language plpgsql set search_path=pg_catalog,dm_private as $$
declare result jsonb;
begin
 if p_operation='post' then
  select jsonb_build_object('id',id,'postId',id,'parentId',null,'status',status,'postStatus',status,'canUpload',status='visible','replayed',p_replayed)
   into result from dm_private.community_posts where id=p_id and author_id=p_user_id;
 else
  select jsonb_build_object('id',c.id,'postId',c.post_id,'parentId',c.parent_id,'status',c.status,'postStatus',p.status,
   'canUpload',c.status='visible' and p.status='visible','replayed',p_replayed) into result
   from dm_private.community_comments c join dm_private.community_posts p on p.id=c.post_id where c.id=p_id and c.author_id=p_user_id;
 end if;
 if result is null then raise exception 'Saved community text is unavailable' using errcode='42501',detail='community_target_unavailable'; end if;
 return result;
end $$;
revoke all on function dm_private.community_write_result(uuid,text,uuid,boolean) from public,anon,authenticated,service_role;

create function public.create_community_post(p_exam text,p_topic text,p_title text,p_body text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare receipt dm_private.community_write_receipts; result uuid;
 fingerprint text;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'A request ID is required' using errcode='22023',detail='community_invalid_input'; end if;
 if p_exam is null or lower(trim(p_exam)) not in('uceed','nid','nift','ceed') or p_topic is null or char_length(trim(p_topic)) not between 1 and 100
  or p_title is null or char_length(trim(p_title)) not between 8 and 160 or p_body is null or char_length(trim(p_body)) not between 20 and 5000 then
  raise exception 'Invalid community post' using errcode='22023',detail='community_invalid_input'; end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array('post',lower(trim(p_exam)),trim(p_topic),trim(p_title),trim(p_body))::text,'UTF8')),'hex');

 perform pg_advisory_xact_lock(hashtextextended('community-write:'||auth.uid()::text||':'||p_request_id::text,0));
 select * into receipt from dm_private.community_write_receipts where user_id=auth.uid() and request_id=p_request_id;
 if found then
  if receipt.operation<>'post' or receipt.fingerprint<>fingerprint then raise exception 'This request belongs to different community text' using errcode='22023',detail='community_request_conflict'; end if;
  return dm_private.community_write_result(auth.uid(),'post',receipt.target_id,true);
 end if;
 result:=public.create_community_post(p_exam,p_topic,p_title,p_body);
 insert into dm_private.community_write_receipts(user_id,request_id,operation,fingerprint,target_id) values(auth.uid(),p_request_id,'post',fingerprint,result);
 return dm_private.community_write_result(auth.uid(),'post',result,false);
end $$;

create function public.add_community_comment(p_post_id uuid,p_parent_id uuid,p_body text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare receipt dm_private.community_write_receipts; result uuid;
 fingerprint text;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'A request ID is required' using errcode='22023',detail='community_invalid_input'; end if;
 if p_body is null or char_length(trim(p_body)) not between 2 and 3000 then raise exception 'Invalid community reply' using errcode='22023',detail='community_invalid_input'; end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array('comment',p_post_id,p_parent_id,trim(p_body))::text,'UTF8')),'hex');

 perform pg_advisory_xact_lock(hashtextextended('community-write:'||auth.uid()::text||':'||p_request_id::text,0));
 select * into receipt from dm_private.community_write_receipts where user_id=auth.uid() and request_id=p_request_id;
 if found then
  if receipt.operation<>'comment' or receipt.fingerprint<>fingerprint then raise exception 'This request belongs to different community text' using errcode='22023',detail='community_request_conflict'; end if;
  return dm_private.community_write_result(auth.uid(),'comment',receipt.target_id,true);
 end if;
 result:=public.add_community_comment(p_post_id,p_parent_id,p_body);
 insert into dm_private.community_write_receipts(user_id,request_id,operation,fingerprint,target_id) values(auth.uid(),p_request_id,'comment',fingerprint,result);
 return dm_private.community_write_result(auth.uid(),'comment',result,false);
end $$;
revoke all on function public.create_community_post(text,text,text,text,uuid),public.add_community_comment(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.create_community_post(text,text,text,text,uuid),public.add_community_comment(uuid,uuid,text,uuid) to authenticated;

-- Cursor versions change for redactions or edits, not new replies/helpful votes.
-- A first-page timestamp keeps later additions out of the same reading snapshot.
alter table dm_private.community_posts add column thread_revision bigint not null default 1 check(thread_revision>0);
create function dm_private.community_post_revision() returns trigger language plpgsql set search_path=pg_catalog,dm_private as $$
begin
 if row(new.title,new.body,new.exam,new.topic,new.status) is distinct from row(old.title,old.body,old.exam,old.topic,old.status) then
  new.thread_revision:=old.thread_revision+1;
 end if;
 return new;
end $$;
create trigger community_post_revision before update of title,body,exam,topic,status on dm_private.community_posts for each row execute function dm_private.community_post_revision();
create function dm_private.community_comment_revision() returns trigger language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
 if tg_op='DELETE' or row(new.body,new.parent_id,new.status) is distinct from row(old.body,old.parent_id,old.status) then
  update dm_private.community_posts set thread_revision=thread_revision+1 where id=old.post_id;
 end if;
 return null;
end $$;
create trigger community_comment_revision after delete or update of body,parent_id,status on dm_private.community_comments for each row execute function dm_private.community_comment_revision();
create function dm_private.community_asset_revision() returns trigger language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare target uuid;
begin
 if tg_op='DELETE' or row(new.storage_path,new.ordinal) is distinct from row(old.storage_path,old.ordinal) then
  target:=coalesce(old.post_id,(select post_id from dm_private.community_comments where id=old.comment_id));
  update dm_private.community_posts set thread_revision=thread_revision+1 where id=target;
 end if;
 return null;
end $$;
create trigger community_asset_revision after delete or update of storage_path,ordinal on dm_private.community_assets for each row execute function dm_private.community_asset_revision();
revoke all on function dm_private.community_post_revision(),dm_private.community_comment_revision(),dm_private.community_asset_revision() from public,anon,authenticated,service_role;

create or replace function public.admin_moderate_community(p_target_type text,p_target_id uuid,p_action text,p_note text default null)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare parent_id uuid;
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
 if p_target_type='post' and p_action in('hide','restore','lock','unlock') then
  update dm_private.community_posts set status=case p_action when 'hide' then 'hidden' when 'lock' then 'locked' else 'visible' end,updated_at=now() where id=p_target_id;
 elsif p_target_type='comment' and p_action in('hide','restore') then
  select post_id into parent_id from dm_private.community_comments where id=p_target_id;
  perform 1 from dm_private.community_posts where id=parent_id for update;
  update dm_private.community_comments set status=case p_action when 'hide' then 'hidden' else 'visible' end where id=p_target_id;
 else raise exception 'Invalid community moderation action'; end if;
 if not found then raise exception 'Community target not found'; end if;
 insert into dm_private.community_moderation_log(actor_id,target_type,target_id,action,note) values(auth.uid(),p_target_type,p_target_id,p_action,nullif(trim(p_note),''));
end $$;

create index community_comments_page_idx on dm_private.community_comments(post_id,created_at,id) where status='visible';
create function public.community_thread(p_post_id uuid,p_cursor jsonb,p_limit integer)
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
 result:=jsonb_build_object('id',target.id,'title',target.title,'body',target.body,'exam',target.exam,'topic',target.topic,'status',target.status,
  'assetCount',(select count(*) from dm_private.community_assets where post_id=p_post_id),'comments',page,'version',target.thread_revision,
  'nextCursor',case when has_more then jsonb_build_object('createdAt',last_row.created_at,'id',last_row.id,'snapshotAt',snapshot_at,'version',target.thread_revision) end);
 return result;
end $$;
revoke all on function public.community_thread(uuid,jsonb,integer) from public,anon;
grant execute on function public.community_thread(uuid,jsonb,integer) to authenticated;
create or replace function public.community_thread(p_post_id uuid)
returns jsonb language sql security definer set search_path=pg_catalog,public as $$
 select public.community_thread(p_post_id,null,25)
$$;

commit;
