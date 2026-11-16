begin;

-- Community phase 1: articles, likes, saved folders, drafts, blocking and the
-- contact-details guard. See apps/designmocks/docs/community/02-data-model.md.
-- Existing discussions keep their contracts; three existing functions are
-- re-created with the additions marked below.

-- 1. Articles are a second kind of post in the same table, so comments,
-- images, reporting and moderation apply to them unchanged.
alter table dm_private.community_posts add column kind text not null default 'discussion' check(kind in('discussion','article'));
alter table dm_private.community_posts drop constraint community_posts_body_check;
alter table dm_private.community_posts add constraint community_posts_body_check
 check(case kind when 'article' then char_length(body) between 200 and 20000 else char_length(body) between 20 and 5000 end);
create index community_articles_idx on dm_private.community_posts(created_at desc,id desc) where kind='article' and status<>'hidden';
create index community_articles_exam_idx on dm_private.community_posts(exam,created_at desc,id desc) where kind='article' and status<>'hidden';
create index community_articles_author_idx on dm_private.community_posts(author_id,created_at desc) where kind='article';

create table dm_private.community_post_likes(
 user_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid not null references dm_private.community_posts(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,post_id)
);
create index community_post_likes_post_idx on dm_private.community_post_likes(post_id,created_at desc);
create index community_post_likes_rate_idx on dm_private.community_post_likes(user_id,created_at desc);

create table dm_private.community_folders(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 60 and name=btrim(name)),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create unique index community_folders_name_idx on dm_private.community_folders(user_id,lower(name));

create table dm_private.community_saves(
 user_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid not null references dm_private.community_posts(id) on delete cascade,
 folder_id uuid not null references dm_private.community_folders(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,post_id,folder_id)
);
create index community_saves_folder_idx on dm_private.community_saves(folder_id,created_at desc,post_id desc);

create table dm_private.community_drafts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 exam text check(exam is null or exam in('uceed','nid','nift','ceed')),
 topic text not null default '' check(char_length(topic)<=100),
 title text not null default '' check(char_length(title)<=160),
 body text not null default '' check(char_length(body)<=20000),
 updated_at timestamptz not null default clock_timestamp()
);
create index community_drafts_user_idx on dm_private.community_drafts(user_id,updated_at desc);

create table dm_private.community_blocks(
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp(),
 primary key(blocker_id,blocked_id),
 check(blocker_id<>blocked_id)
);

alter table dm_private.community_post_likes enable row level security;
alter table dm_private.community_folders enable row level security;
alter table dm_private.community_saves enable row level security;
alter table dm_private.community_drafts enable row level security;
alter table dm_private.community_blocks enable row level security;
revoke all on dm_private.community_post_likes,dm_private.community_folders,dm_private.community_saves,
 dm_private.community_drafts,dm_private.community_blocks from public,anon,authenticated,service_role;

-- 2. Contact-details guard. The pattern list is generated from
-- src/community-article.mjs (CONTACT_PATTERNS); tests/community-article.test.mjs
-- fails if the two differ. Triggers apply it to every post, article and reply,
-- whichever function writes them.
create function dm_private.community_contact_check(p_text text) returns void
language plpgsql immutable set search_path=pg_catalog as $$
declare pattern text;
begin
 foreach pattern in array array[
  $p$[a-z0-9._%+-]+(@|\s*\(at\)\s*|\s*\[at\]\s*)[a-z0-9-]+(\.|\s*\(dot\)\s*|\s*\[dot\]\s*)[a-z]{2,}$p$,
  $p$(\d[\s().+-]{0,2}){9}\d$p$,
  $p$(^|[^a-z0-9_.])@[a-z0-9_.]{3,}$p$,
  $p$(^|[^a-z])(dm|ping|text|message|msg|add|follow|contact|whatsapp|telegram)\s+me($|[^a-z])$p$,
  $p$(^|[^a-z])my\s+(insta|instagram|whatsapp|telegram|snapchat|discord)($|[^a-z])$p$,
  $p$(^|[^a-z])(insta|instagram|whatsapp|telegram|snapchat|discord)\s*(id|handle|number|group|username)($|[^a-z])$p$,
  $p$(^|[^a-z0-9])(wa\.me|t\.me|telegram\.me|chat\.whatsapp\.com|discord\.gg|discord\.com/invite|instagram\.com/|facebook\.com/|fb\.com/|snapchat\.com/)$p$
 ] loop
  if p_text ~* pattern then
   raise exception 'Contact details are not allowed in Community' using errcode='22023',detail='community_contact_details';
  end if;
 end loop;
end $$;
create function dm_private.community_contact_guard() returns trigger
language plpgsql set search_path=pg_catalog,dm_private as $$
begin
 if tg_table_name='community_posts' then perform dm_private.community_contact_check(new.topic||E'\n'||new.title||E'\n'||new.body);
 else perform dm_private.community_contact_check(new.body); end if;
 return new;
end $$;
revoke all on function dm_private.community_contact_check(text),dm_private.community_contact_guard() from public,anon,authenticated,service_role;
create trigger community_post_contact before insert or update of topic,title,body on dm_private.community_posts
 for each row execute function dm_private.community_contact_guard();
create trigger community_comment_contact before insert or update of body on dm_private.community_comments
 for each row execute function dm_private.community_contact_guard();

create function dm_private.community_excerpt(p_body text) returns text
language sql immutable set search_path=pg_catalog as $$
 with plain as(select btrim(regexp_replace(regexp_replace(p_body,'(\*\*|\*|^\s*#{2,3}\s+|^\s*>\s?|^\s*-{3,}\s*$|^\s*-\s+)','','gn'),'\s+',' ','g')) t)
 select case when char_length(t)<=400 then t else rtrim(left(t,399))||'…' end from plain
$$;
revoke all on function dm_private.community_excerpt(text) from public,anon,authenticated,service_role;

-- 3. Publishing. Same receipt contract and lock order as create_community_post:
-- request lock, author lock, author key share, feed fence, insert.
create function public.create_community_article(p_exam text,p_topic text,p_title text,p_body text,p_request_id uuid,p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare actor uuid:=auth.uid(); receipt dm_private.community_write_receipts; result uuid; fingerprint text;
 v_exam text:=lower(btrim(p_exam)); v_topic text:=btrim(p_topic); v_title text:=btrim(p_title);
 v_body text:=btrim(p_body,E' \n\r\t');
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_request_id is null or v_exam is null or v_exam not in('uceed','nid','nift','ceed')
  or v_topic is null or char_length(v_topic) not between 1 and 100
  or v_title is null or char_length(v_title) not between 8 and 160
  or v_body is null or char_length(v_body) not between 200 and 20000 then
  raise exception 'Invalid community article' using errcode='22023',detail='community_invalid_input';
 end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array('article',v_exam,v_topic,v_title,v_body)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('community-write:'||actor::text||':'||p_request_id::text,0));
 select * into receipt from dm_private.community_write_receipts where user_id=actor and request_id=p_request_id;
 if found then
  if receipt.operation<>'post' or receipt.fingerprint<>fingerprint then
   raise exception 'This request belongs to different community text' using errcode='22023',detail='community_request_conflict';
  end if;
  return dm_private.community_write_result(actor,'post',receipt.target_id,true);
 end if;
 perform dm_private.community_contact_check(v_topic||E'\n'||v_title||E'\n'||v_body);
 perform pg_advisory_xact_lock(hashtextextended('community-post:'||actor::text,0));
 if(select count(*) from dm_private.community_posts where author_id=actor and kind='article' and created_at>clock_timestamp()-interval'24 hours')>=3 then
  raise exception 'Too many articles today' using errcode='P0001',detail='community_article_limit';
 end if;
 perform 1 from auth.users where id=actor for key share;
 if not found then raise exception 'Sign in required' using errcode='42501'; end if;
 perform 1 from dm_private.community_feed_state where singleton for update;
 insert into dm_private.community_posts(author_id,kind,exam,topic,title,body,created_at)
 values(actor,'article',v_exam,v_topic,v_title,v_body,clock_timestamp()) returning id into result;
 insert into dm_private.community_write_receipts(user_id,request_id,operation,fingerprint,target_id) values(actor,p_request_id,'post',fingerprint,result);
 if p_draft_id is not null then delete from dm_private.community_drafts where id=p_draft_id and user_id=actor; end if;
 return dm_private.community_write_result(actor,'post',result,false);
end $$;

-- 4. Article feed. "latest" pages by (created_at,id); "top" is one page ordered
-- by likes received in the last 30 days.
create function public.community_articles(p_exam text,p_sort text,p_cursor jsonb,p_limit integer)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare actor uuid:=auth.uid(); v_exam text:=nullif(lower(btrim(p_exam)),''); v_created timestamptz; v_id uuid;
 v_rows jsonb; v_more boolean:=false; v_last jsonb; v_next jsonb:=null;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_sort is null or p_sort not in('latest','top') or p_limit is null or p_limit not between 1 and 25
  or(v_exam is not null and v_exam not in('uceed','nid','nift','ceed')) or(p_cursor is not null and p_sort<>'latest') then
  raise exception 'Invalid article query' using errcode='22023',detail='community_invalid_input';
 end if;
 if p_cursor is not null then
  begin
   if jsonb_typeof(p_cursor)<>'object' or(select count(*) from jsonb_object_keys(p_cursor))<>2
    or jsonb_typeof(p_cursor->'createdAt')<>'string' or jsonb_typeof(p_cursor->'id')<>'string'
    or char_length(p_cursor->>'createdAt')>40 then raise exception 'Invalid cursor'; end if;
   v_created:=(p_cursor->>'createdAt')::timestamptz; v_id:=(p_cursor->>'id')::uuid;
   if not isfinite(v_created) then raise exception 'Invalid cursor'; end if;
  exception when others then
   raise exception 'Invalid article cursor' using errcode='22023',detail='community_invalid_input';
  end;
 end if;
 with candidates as materialized(
  select p.*,(select count(*) from dm_private.community_post_likes l where l.post_id=p.id and l.created_at>now()-interval'30 days') recent
  from dm_private.community_posts p
  where p.kind='article' and p.status<>'hidden' and(v_exam is null or p.exam=v_exam)
   and not exists(select 1 from dm_private.community_blocks b where b.blocker_id=actor and b.blocked_id=p.author_id)
   and(p_cursor is null or(p.created_at,p.id)<(v_created,v_id))
  order by case when p_sort='top' then (select count(*) from dm_private.community_post_likes l where l.post_id=p.id and l.created_at>now()-interval'30 days') end desc nulls last,
   p.created_at desc,p.id desc
  limit p_limit+1
 ), page as materialized(select * from candidates order by case when p_sort='top' then recent end desc nulls last,created_at desc,id desc limit p_limit)
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'exam',p.exam,'topic',p.topic,'title',p.title,'excerpt',dm_private.community_excerpt(p.body),
  'author',coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student'),'createdAt',p.created_at,'status',p.status,
  'comments',(select count(*) from dm_private.community_comments c where c.post_id=p.id and c.status='visible'),
  'likes',(select count(*) from dm_private.community_post_likes l where l.post_id=p.id),
  'liked',exists(select 1 from dm_private.community_post_likes l where l.post_id=p.id and l.user_id=actor),
  'saved',exists(select 1 from dm_private.community_saves s where s.post_id=p.id and s.user_id=actor),
  'isMine',p.author_id=actor,
  'words',coalesce(array_length(regexp_split_to_array(btrim(regexp_replace(p.body,'\s+',' ','g')),' '),1),0))
  order by case when p_sort='top' then p.recent end desc nulls last,p.created_at desc,p.id desc),'[]'),
  (select count(*)>p_limit from candidates) into v_rows,v_more
 from page p left join public.profiles pr on pr.user_id=p.author_id;
 if v_more and p_sort='latest' then
  v_last:=v_rows->-1;
  v_next:=jsonb_build_object('createdAt',v_last->'createdAt','id',v_last->'id');
 end if;
 return jsonb_build_object('articles',v_rows,'nextCursor',v_next,'sort',p_sort,'exam',v_exam);
end $$;

-- 5. Likes. The count is derived, so a like never touches the post row, its
-- revision or the feed fence.
create function public.set_community_like(p_post_id uuid,p_liked boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid(); target dm_private.community_posts;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_post_id is null or p_liked is null then raise exception 'Invalid like' using errcode='22023',detail='community_invalid_input'; end if;
 select * into target from dm_private.community_posts where id=p_post_id and status<>'hidden';
 if not found or exists(select 1 from dm_private.community_blocks b where b.blocker_id=actor and b.blocked_id=target.author_id) then
  raise exception 'Post not found' using errcode='42501',detail='community_target_unavailable';
 end if;
 if target.author_id=actor then raise exception 'You cannot like your own post' using errcode='22023',detail='community_like_own'; end if;
 perform pg_advisory_xact_lock(hashtextextended('community-like:'||actor::text,0));
 if p_liked then
  if not exists(select 1 from dm_private.community_post_likes where user_id=actor and post_id=p_post_id) then
   if(select count(*) from dm_private.community_post_likes where user_id=actor and created_at>clock_timestamp()-interval'1 hour')>=120 then
    raise exception 'Too many likes. Please try again later' using errcode='P0001',detail='community_like_limit';
   end if;
   insert into dm_private.community_post_likes(user_id,post_id) values(actor,p_post_id) on conflict do nothing;
  end if;
 else
  delete from dm_private.community_post_likes where user_id=actor and post_id=p_post_id;
 end if;
 return jsonb_build_object('postId',p_post_id,'liked',p_liked,'likes',(select count(*) from dm_private.community_post_likes where post_id=p_post_id));
end $$;

-- 6. Folders and saves. Private to their owner.
create function public.community_folders()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return jsonb_build_object('folders',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,
  'count',(select count(*) from dm_private.community_saves s where s.folder_id=f.id)) order by lower(f.name),f.id)
  from dm_private.community_folders f where f.user_id=actor),'[]'::jsonb));
end $$;

create function public.save_community_folder(p_folder_id uuid,p_name text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid(); v_name text:=btrim(regexp_replace(coalesce(p_name,''),'\s+',' ','g')); v_id uuid;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if char_length(v_name) not between 1 and 60 then raise exception 'Invalid folder name' using errcode='22023',detail='community_invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended('community-folder:'||actor::text,0));
 begin
  if p_folder_id is null then
   if(select count(*) from dm_private.community_folders where user_id=actor)>=50 then
    raise exception 'Too many folders' using errcode='P0001',detail='community_folder_limit';
   end if;
   perform 1 from auth.users where id=actor for key share;
   if not found then raise exception 'Sign in required' using errcode='42501'; end if;
   insert into dm_private.community_folders(user_id,name) values(actor,v_name) returning id into v_id;
  else
   update dm_private.community_folders set name=v_name,updated_at=clock_timestamp() where id=p_folder_id and user_id=actor returning id into v_id;
   if not found then raise exception 'Folder not found' using errcode='42501',detail='community_folder_unavailable'; end if;
  end if;
 exception when unique_violation then
  raise exception 'A folder with this name exists' using errcode='23505',detail='community_folder_exists';
 end;
 return jsonb_build_object('id',v_id,'name',v_name,'count',(select count(*) from dm_private.community_saves where folder_id=v_id));
end $$;

create function public.delete_community_folder(p_folder_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('community-folder:'||actor::text,0));
 delete from dm_private.community_folders where id=p_folder_id and user_id=actor;
 if not found then raise exception 'Folder not found' using errcode='42501',detail='community_folder_unavailable'; end if;
 return jsonb_build_object('id',p_folder_id);
end $$;

-- Sets exactly which of the reader's folders hold this post.
create function public.set_community_saves(p_post_id uuid,p_folder_ids uuid[])
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid(); target dm_private.community_posts; v_ids uuid[];
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_post_id is null or p_folder_ids is null or cardinality(p_folder_ids)>50 or array_position(p_folder_ids,null) is not null then
  raise exception 'Invalid save' using errcode='22023',detail='community_invalid_input';
 end if;
 select coalesce(array_agg(distinct x),'{}') into v_ids from unnest(p_folder_ids) x;
 perform pg_advisory_xact_lock(hashtextextended('community-folder:'||actor::text,0));
 if(select count(*) from dm_private.community_folders where user_id=actor and id=any(v_ids))<>cardinality(v_ids) then
  raise exception 'Folder not found' using errcode='42501',detail='community_folder_unavailable';
 end if;
 delete from dm_private.community_saves where user_id=actor and post_id=p_post_id and not(folder_id=any(v_ids));
 if exists(select 1 from unnest(v_ids) x where not exists(select 1 from dm_private.community_saves s where s.user_id=actor and s.post_id=p_post_id and s.folder_id=x)) then
  -- New saves need a readable post; removing a save of a hidden post is always allowed.
  select * into target from dm_private.community_posts where id=p_post_id and status<>'hidden' for key share;
  if not found or exists(select 1 from dm_private.community_blocks b where b.blocker_id=actor and b.blocked_id=target.author_id) then
   raise exception 'Post not found' using errcode='42501',detail='community_target_unavailable';
  end if;
  insert into dm_private.community_saves(user_id,post_id,folder_id) select actor,p_post_id,x from unnest(v_ids) x on conflict do nothing;
  if(select count(*) from dm_private.community_saves where user_id=actor)>1000 then
   raise exception 'Too many saved posts' using errcode='P0001',detail='community_save_limit';
  end if;
 end if;
 return jsonb_build_object('postId',p_post_id,'folderIds',coalesce((select jsonb_agg(folder_id order by folder_id)
  from dm_private.community_saves where user_id=actor and post_id=p_post_id),'[]'::jsonb));
end $$;

create function public.community_saved(p_folder_id uuid,p_cursor jsonb,p_limit integer)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare actor uuid:=auth.uid(); v_folder dm_private.community_folders; v_saved timestamptz; v_post uuid;
 v_rows jsonb; v_more boolean; v_last jsonb; v_next jsonb:=null;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 25 then raise exception 'Invalid page size' using errcode='22023',detail='community_invalid_input'; end if;
 select * into v_folder from dm_private.community_folders where id=p_folder_id and user_id=actor;
 if not found then raise exception 'Folder not found' using errcode='42501',detail='community_folder_unavailable'; end if;
 if p_cursor is not null then
  begin
   if jsonb_typeof(p_cursor)<>'object' or(select count(*) from jsonb_object_keys(p_cursor))<>2
    or jsonb_typeof(p_cursor->'savedAt')<>'string' or jsonb_typeof(p_cursor->'postId')<>'string'
    or char_length(p_cursor->>'savedAt')>40 then raise exception 'Invalid cursor'; end if;
   v_saved:=(p_cursor->>'savedAt')::timestamptz; v_post:=(p_cursor->>'postId')::uuid;
   if not isfinite(v_saved) then raise exception 'Invalid cursor'; end if;
  exception when others then
   raise exception 'Invalid saved cursor' using errcode='22023',detail='community_invalid_input';
  end;
 end if;
 with candidates as materialized(
  select s.post_id,s.created_at from dm_private.community_saves s
  where s.folder_id=v_folder.id and s.user_id=actor and(p_cursor is null or(s.created_at,s.post_id)<(v_saved,v_post))
  order by s.created_at desc,s.post_id desc limit p_limit+1
 ), page as materialized(select * from candidates order by created_at desc,post_id desc limit p_limit)
 select coalesce(jsonb_agg(case when p.id is not null then
   jsonb_build_object('postId',s.post_id,'savedAt',s.created_at,'available',true,'kind',p.kind,'exam',p.exam,'topic',p.topic,'title',p.title,
    'excerpt',dm_private.community_excerpt(p.body),'author',coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student'))
  else jsonb_build_object('postId',s.post_id,'savedAt',s.created_at,'available',false) end order by s.created_at desc,s.post_id desc),'[]'),
  (select count(*)>p_limit from candidates) into v_rows,v_more
 from page s
 left join dm_private.community_posts p on p.id=s.post_id and p.status<>'hidden'
  and not exists(select 1 from dm_private.community_blocks b where b.blocker_id=actor and b.blocked_id=p.author_id)
 left join public.profiles pr on pr.user_id=p.author_id;
 if v_more then
  v_last:=v_rows->-1;
  v_next:=jsonb_build_object('savedAt',v_last->'savedAt','postId',v_last->'postId');
 end if;
 return jsonb_build_object('folder',jsonb_build_object('id',v_folder.id,'name',v_folder.name),'items',v_rows,'nextCursor',v_next);
end $$;

-- 7. Drafts. Private; never read by a feed, a thread or moderation. The contact
-- guard runs when a draft is published, not while it is being written.
create function public.community_drafts()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private set timezone='UTC' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return jsonb_build_object('drafts',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'exam',d.exam,'topic',d.topic,'title',d.title,'body',d.body,
  'updatedAt',d.updated_at) order by d.updated_at desc,d.id) from dm_private.community_drafts d where d.user_id=actor),'[]'::jsonb));
end $$;

create function public.save_community_draft(p_draft_id uuid,p_exam text,p_topic text,p_title text,p_body text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private set timezone='UTC' as $$
declare actor uuid:=auth.uid(); v_exam text:=nullif(lower(btrim(p_exam)),''); v_topic text:=btrim(coalesce(p_topic,''));
 v_title text:=btrim(coalesce(p_title,'')); v_body text:=coalesce(p_body,''); v_id uuid; v_time timestamptz;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if(v_exam is not null and v_exam not in('uceed','nid','nift','ceed')) or char_length(v_topic)>100 or char_length(v_title)>160 or char_length(v_body)>20000 then
  raise exception 'Invalid draft' using errcode='22023',detail='community_invalid_input';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('community-draft:'||actor::text,0));
 if p_draft_id is null then
  if(select count(*) from dm_private.community_drafts where user_id=actor)>=10 then
   raise exception 'Too many drafts' using errcode='P0001',detail='community_draft_limit';
  end if;
  perform 1 from auth.users where id=actor for key share;
  if not found then raise exception 'Sign in required' using errcode='42501'; end if;
  insert into dm_private.community_drafts(user_id,exam,topic,title,body) values(actor,v_exam,v_topic,v_title,v_body) returning id,updated_at into v_id,v_time;
 else
  update dm_private.community_drafts set exam=v_exam,topic=v_topic,title=v_title,body=v_body,updated_at=clock_timestamp()
   where id=p_draft_id and user_id=actor returning id,updated_at into v_id,v_time;
  if not found then raise exception 'Draft not found' using errcode='42501',detail='community_draft_unavailable'; end if;
 end if;
 return jsonb_build_object('id',v_id,'updatedAt',v_time);
end $$;

create function public.delete_community_draft(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 delete from dm_private.community_drafts where id=p_draft_id and user_id=actor;
 if not found then raise exception 'Draft not found' using errcode='42501',detail='community_draft_unavailable'; end if;
 return jsonb_build_object('id',p_draft_id);
end $$;

-- 8. Blocking. The author's id never leaves the server: a block names a post or
-- reply, and the list returns an opaque handle for unblocking.
create function public.set_community_block(p_post_id uuid,p_comment_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid(); v_author uuid;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if(p_post_id is null)=(p_comment_id is null) then raise exception 'Choose one target' using errcode='22023',detail='community_invalid_input'; end if;
 if p_post_id is not null then select author_id into v_author from dm_private.community_posts where id=p_post_id and status<>'hidden';
 else select c.author_id into v_author from dm_private.community_comments c join dm_private.community_posts p on p.id=c.post_id
  where c.id=p_comment_id and c.status='visible' and p.status<>'hidden'; end if;
 if v_author is null then raise exception 'Content not found' using errcode='42501',detail='community_target_unavailable'; end if;
 if v_author=actor then raise exception 'You cannot block yourself' using errcode='22023',detail='community_block_self'; end if;
 perform pg_advisory_xact_lock(hashtextextended('community-block:'||actor::text,0));
 if not exists(select 1 from dm_private.community_blocks where blocker_id=actor and blocked_id=v_author) then
  if(select count(*) from dm_private.community_blocks where blocker_id=actor)>=200 then
   raise exception 'Too many blocked authors' using errcode='P0001',detail='community_block_limit';
  end if;
  insert into dm_private.community_blocks(blocker_id,blocked_id) values(actor,v_author) on conflict do nothing;
 end if;
 return jsonb_build_object('blocked',true);
end $$;

create function dm_private.community_block_handle(p_blocker uuid,p_blocked uuid) returns text
language sql immutable set search_path=pg_catalog as $$
 select encode(sha256(convert_to('community-block:'||p_blocker::text||':'||p_blocked::text,'UTF8')),'hex')
$$;
revoke all on function dm_private.community_block_handle(uuid,uuid) from public,anon,authenticated,service_role;

create function public.community_blocked()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return jsonb_build_object('blocked',coalesce((select jsonb_agg(jsonb_build_object('handle',dm_private.community_block_handle(b.blocker_id,b.blocked_id),
  'author',coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student'),'createdAt',b.created_at) order by b.created_at desc,b.blocked_id)
  from dm_private.community_blocks b left join public.profiles pr on pr.user_id=b.blocked_id where b.blocker_id=actor),'[]'::jsonb));
end $$;

create function public.remove_community_block(p_handle text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_handle is null or p_handle !~ '^[0-9a-f]{64}$' then raise exception 'Invalid block' using errcode='22023',detail='community_invalid_input'; end if;
 delete from dm_private.community_blocks b where b.blocker_id=actor and dm_private.community_block_handle(b.blocker_id,b.blocked_id)=p_handle;
 return jsonb_build_object('removed',found);
end $$;

-- 9. Existing functions, re-created from their latest definitions.
-- community_feed: discussions only; authors the reader blocked are left out.
create or replace function public.community_feed(p_exam text,p_topic text,p_cursor jsonb,p_limit integer)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare v_exam text:=nullif(lower(trim(p_exam)),''); v_topic text:=nullif(trim(p_topic),'');
 v_revision bigint; v_snapshot timestamptz; v_created timestamptz; v_id uuid; v_version numeric;
 v_posts jsonb; v_more boolean; v_last jsonb; v_next jsonb:=null; v_now timestamptz;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if (v_exam is not null and v_exam not in('uceed','nid','nift','ceed')) or char_length(v_topic)>100
  or p_limit is null or p_limit not between 1 and 25 then
  raise exception 'Invalid discussion filters or page size' using errcode='22023',detail='community_feed_invalid';
 end if;
 if p_cursor is not null then
  if jsonb_typeof(p_cursor)<>'object' then
   raise exception 'Invalid discussion cursor' using errcode='22023',detail='community_feed_invalid';
  end if;
  if octet_length(p_cursor::text)>2048 or (select count(*) from jsonb_object_keys(p_cursor))<>6 or not(p_cursor ?& array['createdAt','id','snapshotAt','version','exam','topic'])
   or jsonb_typeof(p_cursor->'createdAt')<>'string' or jsonb_typeof(p_cursor->'id')<>'string'
   or jsonb_typeof(p_cursor->'snapshotAt')<>'string' or jsonb_typeof(p_cursor->'version')<>'number'
   or jsonb_typeof(p_cursor->'exam') not in('string','null') or jsonb_typeof(p_cursor->'topic') not in('string','null')
   or char_length(p_cursor->>'id')<>36 or char_length(p_cursor->>'createdAt') not between 20 and 40
   or char_length(p_cursor->>'snapshotAt') not between 20 and 40
   or p_cursor->>'exam' is distinct from v_exam or p_cursor->>'topic' is distinct from v_topic then
   raise exception 'Invalid discussion cursor' using errcode='22023',detail='community_feed_invalid';
  end if;
  begin
   v_created:=(p_cursor->>'createdAt')::timestamptz; v_snapshot:=(p_cursor->>'snapshotAt')::timestamptz;
   v_id:=(p_cursor->>'id')::uuid; v_version:=(p_cursor->>'version')::numeric;
   if not isfinite(v_created) or not isfinite(v_snapshot) or v_created>v_snapshot
    or v_version<>trunc(v_version) or v_version not between 1 and 9007199254740991 then raise exception 'Invalid cursor'; end if;
  exception when others then
   raise exception 'Invalid discussion cursor' using errcode='22023',detail='community_feed_invalid';
  end;
 end if;
 select revision into v_revision from dm_private.community_feed_state where singleton for share;
 if not found then raise exception 'Discussions are unavailable' using errcode='55000',detail='community_feed_unavailable'; end if;
 v_now:=clock_timestamp();
 if p_cursor is null then v_snapshot:=v_now;
 elsif v_snapshot>v_now then
  raise exception 'Invalid discussion cursor' using errcode='22023',detail='community_feed_invalid';
 elsif v_version<>v_revision then
  raise exception 'Discussions changed. Reload the latest page' using errcode='40001',detail='community_feed_changed';
 end if;
 -- A separate VOLATILE statement sees writers drained by the fence. No row lock
 -- can invert a moderator's post -> feed-state order.
 with candidates as materialized(
  select p.* from dm_private.community_posts p where p.status<>'hidden' and p.kind='discussion' and p.created_at<=v_snapshot
   and not exists(select 1 from dm_private.community_blocks b where b.blocker_id=auth.uid() and b.blocked_id=p.author_id)
   and(v_exam is null or p.exam=v_exam) and(v_topic is null or p.topic=v_topic)
   and(p_cursor is null or (p.created_at,p.id)<(v_created,v_id))
   order by p.created_at desc,p.id desc limit p_limit+1
 ), page as materialized(select * from candidates order by created_at desc,id desc limit p_limit)
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'exam',p.exam,'topic',p.topic,'title',p.title,'body',p.body,'status',p.status,
  'author',coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student'),'createdAt',p.created_at,
  'comments',(select count(*) from dm_private.community_comments c where c.post_id=p.id and c.status='visible'),
  'assetCount',(select count(*) from dm_private.community_assets a where a.post_id=p.id)) order by p.created_at desc,p.id desc),'[]'),
  (select count(*)>p_limit from candidates) into v_posts,v_more from page p left join public.profiles pr on pr.user_id=p.author_id;
 if v_more then
  v_last:=v_posts->-1;
  v_next:=jsonb_build_object('createdAt',v_last->'createdAt','id',v_last->'id','snapshotAt',v_snapshot,'version',v_revision,'exam',v_exam,'topic',v_topic);
 end if;
 return jsonb_build_object('posts',v_posts,'nextCursor',v_next,'snapshotAt',v_snapshot,'version',v_revision,'filters',jsonb_build_object('exam',v_exam,'topic',v_topic));
end $$;

-- community_thread: a blocked author's post is unavailable and their replies
-- are returned as empty placeholders; the header gains the reading-page fields.
create or replace function public.community_thread(p_post_id uuid,p_cursor jsonb,p_limit integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare target dm_private.community_posts; after_time timestamptz; after_id uuid; snapshot_at timestamptz:=statement_timestamp();
 version bigint; result jsonb; page jsonb; last_row dm_private.community_comments; has_more boolean;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid community page size' using errcode='22023'; end if;
 select * into target from dm_private.community_posts where id=p_post_id and status<>'hidden' for share;
 if not found or exists(select 1 from dm_private.community_blocks b where b.blocker_id=auth.uid() and b.blocked_id=target.author_id) then
  raise exception 'Post not found' using errcode='42501',detail='community_target_unavailable'; end if;
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
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'parentId',c.parent_id,'body',case when blk.blocked_id is null then c.body else '' end,'helpful',c.helpful_count,'blocked',blk.blocked_id is not null,
  'author',case when blk.blocked_id is null then coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student') else 'Blocked author' end,'createdAt',c.created_at,'isMine',c.author_id=auth.uid(),
  'canAttach',c.author_id=auth.uid() and target.status='visible' and (select count(*) from dm_private.community_assets a where a.comment_id=c.id)<3,
  'canReply',target.status='visible','markedHelpful',exists(select 1 from dm_private.community_helpful h where h.user_id=auth.uid() and h.comment_id=c.id),
  'parentAvailable',parent.id is not null,'parentPreview',case when parent.id is not null then jsonb_build_object('author',case when pblk.blocked_id is null then coalesce(nullif(split_part(parent_profile.display_name,' ',1),''),'Student') else 'Blocked author' end,'body',case when pblk.blocked_id is null then left(parent.body,160) else '' end) end,
  'assetCount',case when blk.blocked_id is null then (select count(*) from dm_private.community_assets a where a.comment_id=c.id) else 0 end) order by c.created_at,c.id),'[]') into page
 from(select * from dm_private.community_comments where post_id=p_post_id and status='visible' and created_at<=snapshot_at
  and (after_time is null or (created_at,id)>(after_time,after_id)) order by created_at,id limit p_limit)c
 left join public.profiles pr on pr.user_id=c.author_id
 left join dm_private.community_comments parent on parent.id=c.parent_id and parent.post_id=p_post_id and parent.status='visible'
 left join public.profiles parent_profile on parent_profile.user_id=parent.author_id
 left join dm_private.community_blocks blk on blk.blocker_id=auth.uid() and blk.blocked_id=c.author_id
 left join dm_private.community_blocks pblk on pblk.blocker_id=auth.uid() and pblk.blocked_id=parent.author_id;
 select * into last_row from dm_private.community_comments where post_id=p_post_id and status='visible' and created_at<=snapshot_at
  and (after_time is null or (created_at,id)>(after_time,after_id)) order by created_at,id limit 1 offset p_limit-1;
 has_more:=found and exists(select 1 from dm_private.community_comments where post_id=p_post_id and status='visible' and created_at<=snapshot_at and (created_at,id)>(last_row.created_at,last_row.id));
 result:=jsonb_build_object('id',target.id,'title',target.title,'body',target.body,'exam',target.exam,'topic',target.topic,'status',target.status,'isMine',target.author_id=auth.uid(),
  'canAttach',target.author_id=auth.uid() and target.status='visible' and (select count(*) from dm_private.community_assets where post_id=p_post_id)<3,
  'assetCount',(select count(*) from dm_private.community_assets where post_id=p_post_id),'comments',page,'version',target.thread_revision,
  'nextCursor',case when has_more then jsonb_build_object('createdAt',last_row.created_at,'id',last_row.id,'snapshotAt',snapshot_at,'version',target.thread_revision) end);
 -- Reading-page fields. Likes and saves never change the thread revision.
 return result||jsonb_build_object('kind',target.kind,'createdAt',target.created_at,
  'author',(select coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student') from (select 1) one left join public.profiles pr on pr.user_id=target.author_id),
  'likes',(select count(*) from dm_private.community_post_likes l where l.post_id=target.id),
  'liked',exists(select 1 from dm_private.community_post_likes l where l.post_id=target.id and l.user_id=auth.uid()),
  'folderIds',coalesce((select jsonb_agg(s.folder_id order by s.folder_id) from dm_private.community_saves s where s.user_id=auth.uid() and s.post_id=target.id),'[]'::jsonb));
end $$;

-- report_community_content: two more reasons, and automatic hiding after three
-- independent reports. The automatic entry has no actor.
alter table dm_private.community_reports drop constraint community_reports_reason_check;
alter table dm_private.community_reports add constraint community_reports_reason_check
 check(reason in('spam','abuse','copyright','answer_leak','personal_details','safety','other'));
alter table dm_private.community_moderation_log alter column actor_id drop not null;
-- Wall-clock log times, so reports made before a restore are ordered before it
-- even when the restore ran in a longer transaction.
alter table dm_private.community_moderation_log alter column created_at set default clock_timestamp();
create or replace function public.report_community_content(p_post_id uuid,p_comment_id uuid,p_reason text,p_details text default null)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid(); parent_post_id uuid; target dm_private.community_posts; restored_at timestamptz; v_kind text; v_id uuid;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501',detail='community_report_sign_in'; end if;
 if (p_post_id is null)=(p_comment_id is null) or p_reason is null or p_reason not in('spam','abuse','copyright','answer_leak','personal_details','safety','other')
  or char_length(coalesce(p_details,''))>1000 then
  raise exception 'Invalid community report' using errcode='22023',detail='community_report_invalid';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('community-report:'||actor::text,0));
 if exists(select 1 from dm_private.community_reports where reporter_id=actor and
  ((p_post_id is not null and post_id=p_post_id) or (p_comment_id is not null and comment_id=p_comment_id))) then
  raise exception 'This account has already reported this content' using errcode='23505',detail='community_report_exists';
 end if;
 if(select count(*) from dm_private.community_reports where reporter_id=actor and created_at>clock_timestamp()-interval'1 hour')>=10 then
  raise exception 'Too many reports. Please try again later' using errcode='P0001',detail='community_report_limit';
 end if;
 parent_post_id:=coalesce(p_post_id,(select post_id from dm_private.community_comments where id=p_comment_id));
 select * into target from dm_private.community_posts where id=parent_post_id and status<>'hidden' for update;
 if not found then raise exception 'Community content is unavailable' using errcode='42501',detail='community_report_unavailable'; end if;
 if p_comment_id is not null then
  perform 1 from dm_private.community_comments where id=p_comment_id and post_id=target.id and status='visible' for update;
  if not found then raise exception 'Community content is unavailable' using errcode='42501',detail='community_report_unavailable'; end if;
 end if;
 insert into dm_private.community_reports(reporter_id,post_id,comment_id,reason,details,created_at)
 values(actor,p_post_id,p_comment_id,p_reason,nullif(trim(p_details),''),clock_timestamp());
 -- Three different accounts hide the target until an administrator reviews it.
 -- Reports made before the latest restore do not count again.
 v_kind:=case when p_post_id is not null then 'post' else 'comment' end; v_id:=coalesce(p_post_id,p_comment_id);
 select coalesce(max(m.created_at),'-infinity') into restored_at from dm_private.community_moderation_log m
  where m.target_type=v_kind and m.target_id=v_id and m.action='restore';
 if(select count(*) from dm_private.community_reports r where r.created_at>restored_at and
   ((p_post_id is not null and r.post_id=p_post_id) or (p_comment_id is not null and r.comment_id=p_comment_id)))>=3 then
  if v_kind='post' then update dm_private.community_posts set status='hidden',updated_at=clock_timestamp() where id=v_id;
  else update dm_private.community_comments set status='hidden' where id=v_id; end if;
  insert into dm_private.community_moderation_log(actor_id,target_type,target_id,action,note)
  values(null,v_kind,v_id,'hide','Automatic: hidden after three independent reports, pending review.');
 end if;
end $$;

revoke all on function public.create_community_article(text,text,text,text,uuid,uuid),public.community_articles(text,text,jsonb,integer),
 public.set_community_like(uuid,boolean),public.community_folders(),public.save_community_folder(uuid,text),public.delete_community_folder(uuid),
 public.set_community_saves(uuid,uuid[]),public.community_saved(uuid,jsonb,integer),public.community_drafts(),
 public.save_community_draft(uuid,text,text,text,text),public.delete_community_draft(uuid),public.set_community_block(uuid,uuid),
 public.community_blocked(),public.remove_community_block(text) from public,anon;
grant execute on function public.create_community_article(text,text,text,text,uuid,uuid),public.community_articles(text,text,jsonb,integer),
 public.set_community_like(uuid,boolean),public.community_folders(),public.save_community_folder(uuid,text),public.delete_community_folder(uuid),
 public.set_community_saves(uuid,uuid[]),public.community_saved(uuid,jsonb,integer),public.community_drafts(),
 public.save_community_draft(uuid,text,text,text,text),public.delete_community_draft(uuid),public.set_community_block(uuid,uuid),
 public.community_blocked(),public.remove_community_block(text) to authenticated;

commit;
