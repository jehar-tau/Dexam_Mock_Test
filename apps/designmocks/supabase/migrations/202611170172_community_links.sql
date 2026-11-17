begin;

-- Community phase 3: links from the internet. Students save links privately
-- into their folders with their own note; a link reaches the public Links feed
-- only through a moderator, or at once from a site the administrator trusts.
-- Previews (title, site, description) are fetched by the community-link Edge
-- function and shared by everyone who saves the same address.

create table dm_private.community_links(
 id uuid primary key default gen_random_uuid(),
 url text not null unique check(char_length(url) between 10 and 2000 and url ~ '^https?://'),
 host text not null check(char_length(host) between 3 and 253 and host=lower(host)),
 status text not null check(status in('fetched','unavailable','skipped')),
 title text check(title is null or char_length(title) between 1 and 200),
 site text check(site is null or char_length(site) between 1 and 100),
 description text check(description is null or char_length(description) between 1 and 400),
 fetched_at timestamptz not null default clock_timestamp(),
 created_at timestamptz not null default clock_timestamp()
);
create table dm_private.community_link_requests(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp()
);
create index community_link_requests_user_idx on dm_private.community_link_requests(user_id,created_at desc);
create table dm_private.community_link_saves(
 user_id uuid not null references auth.users(id) on delete cascade,
 link_id uuid not null references dm_private.community_links(id) on delete cascade,
 folder_id uuid not null references dm_private.community_folders(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,link_id,folder_id)
);
create index community_link_saves_folder_idx on dm_private.community_link_saves(folder_id,created_at desc,link_id desc);
-- A member's private note on a saved post or link. Never shown to anyone else.
create table dm_private.community_notes(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid references dm_private.community_posts(id) on delete cascade,
 link_id uuid references dm_private.community_links(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 2000),
 updated_at timestamptz not null default clock_timestamp(),
 check((post_id is null)<>(link_id is null))
);
create unique index community_notes_post_idx on dm_private.community_notes(user_id,post_id) where post_id is not null;
create unique index community_notes_link_idx on dm_private.community_notes(user_id,link_id) where link_id is not null;
create table dm_private.community_trusted_hosts(
 host text primary key check(char_length(host) between 3 and 253 and host=lower(host)),
 added_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default clock_timestamp()
);

-- 1. Approved links become posts of a fourth kind, one post per link.
alter table dm_private.community_posts drop constraint community_posts_kind_check;
alter table dm_private.community_posts add constraint community_posts_kind_check check(kind in('discussion','article','work','link'));
alter table dm_private.community_posts add column link_id uuid references dm_private.community_links(id);
alter table dm_private.community_posts add constraint community_posts_link_check check((kind='link')=(link_id is not null));
create unique index community_posts_link_idx on dm_private.community_posts(link_id) where link_id is not null;
create index community_links_feed_idx on dm_private.community_posts(created_at desc,id desc) where kind='link' and status<>'hidden';

create table dm_private.community_link_suggestions(
 id uuid primary key default gen_random_uuid(),
 link_id uuid not null references dm_private.community_links(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 exam text not null check(exam in('uceed','nid','nift','ceed')),
 topic text not null check(char_length(topic) between 1 and 100),
 note text not null check(char_length(note) between 20 and 2000),
 status text not null default 'pending' check(status in('pending','approved','rejected')),
 post_id uuid references dm_private.community_posts(id) on delete set null,
 reason text check(reason is null or char_length(reason) between 8 and 1000),
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 created_at timestamptz not null default clock_timestamp()
);
create unique index community_link_suggestions_open_idx on dm_private.community_link_suggestions(user_id,link_id) where status='pending';
create index community_link_suggestions_queue_idx on dm_private.community_link_suggestions(created_at,id) where status='pending';
create index community_link_suggestions_user_idx on dm_private.community_link_suggestions(user_id,created_at desc);

alter table dm_private.community_links enable row level security;
alter table dm_private.community_link_requests enable row level security;
alter table dm_private.community_link_saves enable row level security;
alter table dm_private.community_notes enable row level security;
alter table dm_private.community_trusted_hosts enable row level security;
alter table dm_private.community_link_suggestions enable row level security;
revoke all on dm_private.community_links,dm_private.community_link_requests,dm_private.community_link_saves,dm_private.community_notes,
 dm_private.community_trusted_hosts,dm_private.community_link_suggestions from public,anon,authenticated,service_role;

-- 2. Helpers.
create function dm_private.community_link_json(l dm_private.community_links) returns jsonb
language sql stable set search_path=pg_catalog,dm_private set timezone='UTC' as $$
 select jsonb_build_object('id',l.id,'url',l.url,'host',l.host,'status',l.status,'title',l.title,'site',l.site,'description',l.description,'fetchedAt',l.fetched_at)
$$;
-- Generated from socialHosts in supabase/functions/_shared/community-link.mjs; a unit test compares them.
create function dm_private.community_social_host(p_host text) returns boolean
language sql immutable set search_path=pg_catalog as $$
 select exists(select 1 from unnest(array['instagram.com','facebook.com','fb.com','fb.watch','x.com','twitter.com','tiktok.com','snapchat.com','threads.net','wa.me','whatsapp.com','t.me','telegram.me','telegram.org','discord.gg','discord.com','linkedin.com','pinterest.com','reddit.com']::text[]) h where p_host=h or p_host like '%.'||h)
$$;
create function dm_private.community_trusted_host(p_host text) returns boolean
language sql stable set search_path=pg_catalog,dm_private as $$
 select exists(select 1 from dm_private.community_trusted_hosts t where p_host=t.host or p_host like '%.'||t.host)
$$;
create function dm_private.community_can_review_links(p_user uuid) returns boolean
language sql stable set search_path=pg_catalog,dm_private,public as $$
 select dm_private.community_is_moderator(p_user) or public.is_dmocks_admin()
$$;
revoke all on function dm_private.community_link_json(dm_private.community_links),dm_private.community_social_host(text),
 dm_private.community_trusted_host(text),dm_private.community_can_review_links(uuid) from public,anon,authenticated,service_role;

-- 3. Previews. The Edge function normalizes the address, asks for a cached
-- preview as the member, then (if none) reserves a fetch and records the result
-- with the service role.
create function public.community_link_lookup(p_url text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private set timezone='UTC' as $$
declare l dm_private.community_links;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into l from dm_private.community_links where url=p_url and fetched_at>clock_timestamp()-interval'7 days';
 return case when found then dm_private.community_link_json(l) end;
end $$;

create function public.service_begin_community_link_fetch(p_user_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
 if p_user_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('community-link-fetch:'||p_user_id::text,0));
 if(select count(*) from dm_private.community_link_requests where user_id=p_user_id and created_at>clock_timestamp()-interval'1 hour')>=30 then
  raise exception 'Too many link previews' using errcode='P0001',detail='community_link_limit';
 end if;
 insert into dm_private.community_link_requests(user_id) values(p_user_id);
end $$;

create function public.service_record_community_link(p_url text,p_host text,p_status text,p_title text,p_site text,p_description text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private set timezone='UTC' as $$
declare l dm_private.community_links;
begin
 insert into dm_private.community_links(url,host,status,title,site,description)
 values(p_url,lower(p_host),p_status,nullif(left(btrim(p_title),200),''),nullif(left(btrim(p_site),100),''),nullif(left(btrim(p_description),400),''))
 on conflict(url) do update set status=excluded.status,
  title=case when excluded.status='fetched' then excluded.title else dm_private.community_links.title end,
  site=coalesce(excluded.site,dm_private.community_links.site),
  description=case when excluded.status='fetched' then excluded.description else dm_private.community_links.description end,
  fetched_at=clock_timestamp()
 returning * into l;
 return dm_private.community_link_json(l);
end $$;

-- 4. Private saves and notes.
create function public.save_community_link(p_link_id uuid,p_folder_ids uuid[],p_note text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid(); v_ids uuid[]; v_note text:=btrim(coalesce(p_note,''));
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_link_id is null or p_folder_ids is null or cardinality(p_folder_ids)>50 or array_position(p_folder_ids,null) is not null or char_length(v_note)>2000 then
  raise exception 'Invalid link save' using errcode='22023',detail='community_invalid_input';
 end if;
 perform 1 from dm_private.community_links where id=p_link_id for key share;
 if not found then raise exception 'Link not found' using errcode='42501',detail='community_link_unavailable'; end if;
 select coalesce(array_agg(distinct x),'{}') into v_ids from unnest(p_folder_ids) x;
 perform pg_advisory_xact_lock(hashtextextended('community-folder:'||actor::text,0));
 if(select count(*) from dm_private.community_folders where user_id=actor and id=any(v_ids))<>cardinality(v_ids) then
  raise exception 'Folder not found' using errcode='42501',detail='community_folder_unavailable';
 end if;
 delete from dm_private.community_link_saves where user_id=actor and link_id=p_link_id and not(folder_id=any(v_ids));
 insert into dm_private.community_link_saves(user_id,link_id,folder_id) select actor,p_link_id,x from unnest(v_ids) x on conflict do nothing;
 if(select count(distinct link_id) from dm_private.community_link_saves where user_id=actor)>1000 then
  raise exception 'Too many saved links' using errcode='P0001',detail='community_save_limit';
 end if;
 if v_note='' then delete from dm_private.community_notes where user_id=actor and link_id=p_link_id;
 else
  insert into dm_private.community_notes(user_id,link_id,body) values(actor,p_link_id,v_note)
  on conflict(user_id,link_id) where link_id is not null do update set body=excluded.body,updated_at=clock_timestamp();
 end if;
 return jsonb_build_object('linkId',p_link_id,'folderIds',coalesce((select jsonb_agg(folder_id order by folder_id)
  from dm_private.community_link_saves where user_id=actor and link_id=p_link_id),'[]'::jsonb),'note',nullif(v_note,''));
end $$;

create function public.remove_community_link_save(p_link_id uuid,p_folder_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 delete from dm_private.community_link_saves where user_id=actor and link_id=p_link_id and folder_id=p_folder_id;
 return jsonb_build_object('removed',found);
end $$;

-- Folder contents: saved posts and saved links, newest save first.
create or replace function public.community_saved(p_folder_id uuid,p_cursor jsonb,p_limit integer)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare actor uuid:=auth.uid(); v_folder dm_private.community_folders; v_saved timestamptz; v_type text; v_id uuid;
 v_rows jsonb; v_more boolean; v_last jsonb; v_next jsonb:=null;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 25 then raise exception 'Invalid page size' using errcode='22023',detail='community_invalid_input'; end if;
 select * into v_folder from dm_private.community_folders where id=p_folder_id and user_id=actor;
 if not found then raise exception 'Folder not found' using errcode='42501',detail='community_folder_unavailable'; end if;
 if p_cursor is not null then
  begin
   if jsonb_typeof(p_cursor)<>'object' or(select count(*) from jsonb_object_keys(p_cursor))<>3
    or jsonb_typeof(p_cursor->'savedAt')<>'string' or jsonb_typeof(p_cursor->'id')<>'string' or p_cursor->>'type' not in('post','link')
    or char_length(p_cursor->>'savedAt')>40 then raise exception 'Invalid cursor'; end if;
   v_saved:=(p_cursor->>'savedAt')::timestamptz; v_id:=(p_cursor->>'id')::uuid; v_type:=p_cursor->>'type';
   if not isfinite(v_saved) then raise exception 'Invalid cursor'; end if;
  exception when others then
   raise exception 'Invalid saved cursor' using errcode='22023',detail='community_invalid_input';
  end;
 end if;
 with entries as(
  select 'post'::text type,s.post_id id,s.created_at from dm_private.community_saves s where s.folder_id=v_folder.id and s.user_id=actor
  union all
  select 'link'::text,s.link_id,s.created_at from dm_private.community_link_saves s where s.folder_id=v_folder.id and s.user_id=actor
 ), candidates as materialized(
  select * from entries e where p_cursor is null or(e.created_at,e.type,e.id)<(v_saved,v_type,v_id)
  order by e.created_at desc,e.type desc,e.id desc limit p_limit+1
 ), page as materialized(select * from candidates order by created_at desc,type desc,id desc limit p_limit)
 select coalesce(jsonb_agg(case
   when e.type='link' then jsonb_build_object('type','link','id',e.id,'savedAt',e.created_at,'link',dm_private.community_link_json(l),
    'note',(select n.body from dm_private.community_notes n where n.user_id=actor and n.link_id=e.id),
    'suggestion',(select jsonb_build_object('status',g.status,'postId',g.post_id,'reason',g.reason) from dm_private.community_link_suggestions g
      where g.user_id=actor and g.link_id=e.id order by g.created_at desc,g.id desc limit 1),
    'postId',(select lp.id from dm_private.community_posts lp where lp.link_id=e.id and lp.status<>'hidden'))
   when p.id is not null then jsonb_build_object('type','post','id',e.id,'postId',e.id,'savedAt',e.created_at,'available',true,'kind',p.kind,'exam',p.exam,'topic',p.topic,
    'title',p.title,'excerpt',dm_private.community_excerpt(p.body),'author',coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student'),
    'note',(select n.body from dm_private.community_notes n where n.user_id=actor and n.post_id=e.id))
   else jsonb_build_object('type','post','id',e.id,'postId',e.id,'savedAt',e.created_at,'available',false) end
  order by e.created_at desc,e.type desc,e.id desc),'[]'),
  (select count(*)>p_limit from candidates) into v_rows,v_more
 from page e
 left join dm_private.community_links l on e.type='link' and l.id=e.id
 left join dm_private.community_posts p on e.type='post' and p.id=e.id and p.status<>'hidden'
  and not exists(select 1 from dm_private.community_blocks b where b.blocker_id=actor and b.blocked_id=p.author_id)
 left join public.profiles pr on pr.user_id=p.author_id;
 if v_more then
  v_last:=v_rows->-1;
  v_next:=jsonb_build_object('savedAt',v_last->'savedAt','type',v_last->'type','id',v_last->'id');
 end if;
 return jsonb_build_object('folder',jsonb_build_object('id',v_folder.id,'name',v_folder.name),'items',v_rows,'nextCursor',v_next);
end $$;

-- 5. Suggestions and review.
create function dm_private.community_publish_link(p_suggestion_id uuid,p_reviewer uuid)
returns uuid language plpgsql set search_path=pg_catalog,dm_private as $$
declare g dm_private.community_link_suggestions; l dm_private.community_links; v_title text; result uuid;
begin
 select * into g from dm_private.community_link_suggestions where id=p_suggestion_id and status='pending' for update;
 if not found then raise exception 'Suggestion not found' using errcode='42501',detail='community_link_unavailable'; end if;
 select * into l from dm_private.community_links where id=g.link_id for key share;
 if exists(select 1 from dm_private.community_posts where link_id=l.id) then
  raise exception 'This link is already in the feed' using errcode='P0001',detail='community_link_posted';
 end if;
 v_title:=btrim(coalesce(l.title,l.site,l.host));
 if char_length(v_title)<8 then v_title:=v_title||' · '||l.host; end if;
 if char_length(v_title)<8 then v_title:='Link: '||v_title; end if;
 v_title:=left(v_title,160);
 perform 1 from auth.users where id=g.user_id for key share;
 perform 1 from dm_private.community_feed_state where singleton for update;
 insert into dm_private.community_posts(author_id,kind,exam,topic,title,body,link_id,created_at)
 values(g.user_id,'link',g.exam,g.topic,v_title,g.note,l.id,clock_timestamp()) returning id into result;
 update dm_private.community_link_suggestions set status='approved',post_id=result,reviewed_by=p_reviewer,reviewed_at=clock_timestamp() where id=g.id;
 return result;
end $$;
revoke all on function dm_private.community_publish_link(uuid,uuid) from public,anon,authenticated,service_role;

create function public.suggest_community_link(p_link_id uuid,p_exam text,p_topic text,p_note text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid(); l dm_private.community_links; g dm_private.community_link_suggestions; v_post uuid;
 v_exam text:=lower(btrim(p_exam)); v_topic text:=btrim(p_topic); v_note text:=btrim(p_note,E' \n\r\t');
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_link_id is null or v_exam is null or v_exam not in('uceed','nid','nift','ceed') or v_topic is null or char_length(v_topic) not between 1 and 100
  or v_note is null or char_length(v_note) not between 20 and 2000 then
  raise exception 'Invalid suggestion' using errcode='22023',detail='community_invalid_input';
 end if;
 if(dm_private.community_active_sanction(actor)).id is not null then
  raise exception 'Posting is paused for this account' using errcode='P0001',detail='community_sanctioned';
 end if;
 select * into l from dm_private.community_links where id=p_link_id;
 if not found or not exists(select 1 from dm_private.community_link_saves where user_id=actor and link_id=p_link_id) then
  raise exception 'Save the link first' using errcode='42501',detail='community_link_unavailable';
 end if;
 if dm_private.community_social_host(l.host) then
  raise exception 'Links to social or messaging sites stay private' using errcode='22023',detail='community_link_social';
 end if;
 perform dm_private.community_contact_check(v_topic||E'\n'||v_note);
 select id into v_post from dm_private.community_posts where link_id=l.id;
 if v_post is not null then raise exception 'This link is already in the feed' using errcode='P0001',detail='community_link_posted'; end if;
 perform pg_advisory_xact_lock(hashtextextended('community-link-suggest:'||actor::text,0));
 select * into g from dm_private.community_link_suggestions where user_id=actor and link_id=l.id and status='pending';
 if found then return jsonb_build_object('id',g.id,'status',g.status,'postId',null); end if;
 if(select count(*) from dm_private.community_link_suggestions where user_id=actor and created_at>clock_timestamp()-interval'24 hours')>=5 then
  raise exception 'Too many suggestions today' using errcode='P0001',detail='community_suggest_limit';
 end if;
 insert into dm_private.community_link_suggestions(link_id,user_id,exam,topic,note) values(l.id,actor,v_exam,v_topic,v_note) returning * into g;
 if dm_private.community_trusted_host(l.host) then
  v_post:=dm_private.community_publish_link(g.id,null);
  return jsonb_build_object('id',g.id,'status','approved','postId',v_post);
 end if;
 return jsonb_build_object('id',g.id,'status','pending','postId',null);
end $$;

create function public.community_link_review_queue()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not dm_private.community_can_review_links(actor) then
  raise exception 'Moderator access required' using errcode='42501',detail='community_moderator_required';
 end if;
 return jsonb_build_object('canTrust',public.is_dmocks_admin(),'items',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'link',dm_private.community_link_json(l),
  'author',coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student'),'isMine',g.user_id=actor,'exam',g.exam,'topic',g.topic,'note',g.note,'createdAt',g.created_at,
  'social',dm_private.community_social_host(l.host)) order by g.created_at,g.id)
  from(select * from dm_private.community_link_suggestions where status='pending' order by created_at,id limit 50)g
  join dm_private.community_links l on l.id=g.link_id left join public.profiles pr on pr.user_id=g.user_id),'[]'::jsonb));
end $$;

create function public.review_community_link_suggestion(p_id uuid,p_approve boolean,p_reason text,p_trust boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare actor uuid:=auth.uid(); g dm_private.community_link_suggestions; v_host text; v_post uuid; v_reason text:=nullif(btrim(p_reason),'');
begin
 if actor is null or not dm_private.community_can_review_links(actor) then
  raise exception 'Moderator access required' using errcode='42501',detail='community_moderator_required';
 end if;
 if p_id is null or p_approve is null or coalesce(p_trust,false) and not p_approve or(not p_approve and(v_reason is null or char_length(v_reason) not between 8 and 1000)) then
  raise exception 'Invalid review' using errcode='22023',detail='community_invalid_input';
 end if;
 if coalesce(p_trust,false) and not public.is_dmocks_admin() then
  raise exception 'Only an administrator trusts a site' using errcode='42501',detail='community_admin_required';
 end if;
 select * into g from dm_private.community_link_suggestions where id=p_id and status='pending' for update;
 if not found then raise exception 'Suggestion not found' using errcode='42501',detail='community_link_unavailable'; end if;
 if g.user_id=actor then raise exception 'You cannot review your own suggestion' using errcode='22023',detail='community_review_own'; end if;
 if not p_approve then
  update dm_private.community_link_suggestions set status='rejected',reason=v_reason,reviewed_by=actor,reviewed_at=clock_timestamp() where id=g.id;
  return jsonb_build_object('id',g.id,'status','rejected','postId',null);
 end if;
 select host into v_host from dm_private.community_links where id=g.link_id;
 if dm_private.community_social_host(v_host) then
  raise exception 'Links to social or messaging sites stay private' using errcode='22023',detail='community_link_social';
 end if;
 v_post:=dm_private.community_publish_link(g.id,actor);
 if coalesce(p_trust,false) then
  insert into dm_private.community_trusted_hosts(host,added_by) values(v_host,actor) on conflict do nothing;
 end if;
 return jsonb_build_object('id',g.id,'status','approved','postId',v_post);
end $$;

create function public.admin_community_trusted_hosts()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 return jsonb_build_object('hosts',coalesce((select jsonb_agg(jsonb_build_object('host',host,'createdAt',created_at) order by host) from dm_private.community_trusted_hosts),'[]'::jsonb));
end $$;

create function public.admin_set_community_trusted_host(p_host text,p_trusted boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare v_host text:=lower(btrim(p_host));
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_trusted is null or v_host is null or v_host !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' or char_length(v_host)>253 then
  raise exception 'Invalid site' using errcode='22023',detail='community_invalid_input';
 end if;
 if p_trusted and dm_private.community_social_host(v_host) then
  raise exception 'Social and messaging sites cannot be trusted' using errcode='22023',detail='community_link_social';
 end if;
 if p_trusted then insert into dm_private.community_trusted_hosts(host,added_by) values(v_host,auth.uid()) on conflict do nothing;
 else delete from dm_private.community_trusted_hosts where host=v_host; end if;
 return jsonb_build_object('host',v_host,'trusted',p_trusted);
end $$;

-- 6. Existing functions, re-created from migration 202611160171.
-- community_card and community_cards: link posts carry their preview, and a Links view.
create or replace function dm_private.community_card(p dm_private.community_posts,p_actor uuid) returns jsonb
language sql stable set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
 select jsonb_build_object('id',p.id,'kind',p.kind,'exam',p.exam,'topic',p.topic,'title',p.title,'excerpt',dm_private.community_excerpt(p.body),
  'author',coalesce(nullif(split_part((select pr.display_name from public.profiles pr where pr.user_id=p.author_id),' ',1),''),'Student'),
  'teacher',dm_private.community_is_teacher(p.author_id),'createdAt',p.created_at,'status',p.status,
  'comments',(select count(*) from dm_private.community_comments c where c.post_id=p.id and c.status='visible'),
  'likes',(select count(*) from dm_private.community_post_likes l where l.post_id=p.id),
  'liked',exists(select 1 from dm_private.community_post_likes l where l.post_id=p.id and l.user_id=p_actor),
  'saved',exists(select 1 from dm_private.community_saves s where s.post_id=p.id and s.user_id=p_actor),
  'isMine',p.author_id=p_actor,
  'answered',exists(select 1 from dm_private.community_comments ac where ac.id=p.accepted_comment_id and ac.status='visible'),
  'assetCount',(select count(*) from dm_private.community_assets a where a.post_id=p.id),
  'link',case when p.kind='link' then(select dm_private.community_link_json(l) from dm_private.community_links l where l.id=p.link_id) end,
  'words',coalesce(array_length(regexp_split_to_array(btrim(regexp_replace(p.body,'\s+',' ','g')),' '),1),0))
$$;

create or replace function public.community_cards(p_view text,p_exam text,p_cursor jsonb,p_limit integer)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare actor uuid:=auth.uid(); v_exam text:=nullif(lower(btrim(p_exam)),''); v_created timestamptz; v_id uuid;
 v_rows jsonb; v_more boolean; v_last jsonb; v_next jsonb:=null;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_view is null or p_view not in('work','unanswered','links') or p_limit is null or p_limit not between 1 and 25
  or(v_exam is not null and v_exam not in('uceed','nid','nift','ceed')) then
  raise exception 'Invalid list query' using errcode='22023',detail='community_invalid_input';
 end if;
 if p_cursor is not null then
  begin
   if jsonb_typeof(p_cursor)<>'object' or(select count(*) from jsonb_object_keys(p_cursor))<>2
    or jsonb_typeof(p_cursor->'createdAt')<>'string' or jsonb_typeof(p_cursor->'id')<>'string'
    or char_length(p_cursor->>'createdAt')>40 then raise exception 'Invalid cursor'; end if;
   v_created:=(p_cursor->>'createdAt')::timestamptz; v_id:=(p_cursor->>'id')::uuid;
   if not isfinite(v_created) then raise exception 'Invalid cursor'; end if;
  exception when others then
   raise exception 'Invalid list cursor' using errcode='22023',detail='community_invalid_input';
  end;
 end if;
 with candidates as materialized(
  select p.* from dm_private.community_posts p
  where(case when p_view='work' then p.kind='work' and p.status<>'hidden'
    when p_view='links' then p.kind='link' and p.status<>'hidden'
    else p.kind='discussion' and p.status='visible'
     and not exists(select 1 from dm_private.community_comments ac where ac.id=p.accepted_comment_id and ac.status='visible') end)
   and(v_exam is null or p.exam=v_exam)
   and not exists(select 1 from dm_private.community_blocks b where b.blocker_id=actor and b.blocked_id=p.author_id)
   and(p_cursor is null or(p.created_at,p.id)<(v_created,v_id))
  order by p.created_at desc,p.id desc limit p_limit+1
 ), page as materialized(select * from candidates order by created_at desc,id desc limit p_limit)
 select coalesce(jsonb_agg(dm_private.community_card(p,actor) order by p.created_at desc,p.id desc),'[]'),
  (select count(*)>p_limit from candidates) into v_rows,v_more from page pg join dm_private.community_posts p on p.id=pg.id;
 if v_more then
  v_last:=v_rows->-1;
  v_next:=jsonb_build_object('createdAt',v_last->'createdAt','id',v_last->'id');
 end if;
 return jsonb_build_object('cards',v_rows,'nextCursor',v_next,'view',p_view,'exam',v_exam);
end $$;

-- community_thread: a link post carries its preview.
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
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'parentId',c.parent_id,'body',case when blk.blocked_id is null then c.body else '' end,'helpful',c.helpful_count,'blocked',blk.blocked_id is not null,'teacher',dm_private.community_is_teacher(c.author_id),'accepted',c.id=target.accepted_comment_id,
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
 return result||jsonb_build_object('kind',target.kind,
  'link',case when target.kind='link' then(select dm_private.community_link_json(l) from dm_private.community_links l where l.id=target.link_id) end,'createdAt',target.created_at,
  'author',(select coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student') from (select 1) one left join public.profiles pr on pr.user_id=target.author_id),
  'likes',(select count(*) from dm_private.community_post_likes l where l.post_id=target.id),
  'liked',exists(select 1 from dm_private.community_post_likes l where l.post_id=target.id and l.user_id=auth.uid()),
  'teacher',dm_private.community_is_teacher(target.author_id),'editedAt',target.edited_at,
  'acceptedCommentId',(select ac.id from dm_private.community_comments ac where ac.id=target.accepted_comment_id and ac.status='visible'),
  'canAccept',target.author_id=auth.uid() and target.kind='discussion' and target.status='visible',
  'canEdit',target.author_id=auth.uid() and target.status='visible',
  'canHold',dm_private.community_is_moderator(auth.uid()) or public.is_dmocks_admin(),
  'canSanction',public.is_dmocks_admin(),
  'canFeature',target.kind in('article','work') and target.status='visible' and(dm_private.community_is_teacher(auth.uid()) or public.is_dmocks_admin()),
  'featured',exists(select 1 from dm_private.community_featured f where f.post_id=target.id),
  'folderIds',coalesce((select jsonb_agg(s.folder_id order by s.folder_id) from dm_private.community_saves s where s.user_id=auth.uid() and s.post_id=target.id),'[]'::jsonb));
end $$;

-- community_folders: counts saved links as well as posts.
create or replace function public.community_folders()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return jsonb_build_object('folders',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,
  'count',(select count(*) from dm_private.community_saves s where s.folder_id=f.id)+(select count(*) from dm_private.community_link_saves s where s.folder_id=f.id)) order by lower(f.name),f.id)
  from dm_private.community_folders f where f.user_id=actor),'[]'::jsonb));
end $$;

-- my_community_standing: whether the member is an administrator, to show review tools.
create or replace function public.my_community_standing()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private set timezone='UTC' as $$
declare actor uuid:=auth.uid(); s dm_private.community_sanctions;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 s:=dm_private.community_active_sanction(actor);
 return jsonb_build_object('admin',public.is_dmocks_admin(),'teacher',dm_private.community_is_teacher(actor),'moderator',dm_private.community_is_moderator(actor),
  'sanction',case when s.id is not null then jsonb_build_object('kind',s.kind,'until',s.until,'reason',s.reason) end);
end $$;

-- export_my_community_library: saved links, private notes and link suggestions.
create or replace function public.export_my_community_library()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return jsonb_build_object('schemaVersion',3,'exportedAt',now(),'accountId',actor,
  'likes',coalesce((select jsonb_agg(jsonb_build_object('postId',post_id,'createdAt',created_at) order by created_at,post_id)
   from dm_private.community_post_likes where user_id=actor),'[]'::jsonb),
  'folders',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'createdAt',f.created_at,
   'saves',coalesce((select jsonb_agg(jsonb_build_object('postId',s.post_id,'savedAt',s.created_at) order by s.created_at,s.post_id)
    from dm_private.community_saves s where s.folder_id=f.id and s.user_id=actor),'[]'::jsonb)) order by f.created_at,f.id)
   from dm_private.community_folders f where f.user_id=actor),'[]'::jsonb),
  'revisions',coalesce((select jsonb_agg(jsonb_build_object('postId',post_id,'title',title,'topic',topic,'body',body,'replacedAt',replaced_at) order by replaced_at,id)
   from dm_private.community_post_revisions where editor_id=actor),'[]'::jsonb),
  'sanctions',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'until',until,'reason',reason,'createdAt',created_at,'liftedAt',lifted_at) order by created_at,id)
   from dm_private.community_sanctions where user_id=actor),'[]'::jsonb),
  'links',coalesce((select jsonb_agg(jsonb_build_object('url',l.url,'title',l.title,'folderIds',(select jsonb_agg(s.folder_id order by s.folder_id)
    from dm_private.community_link_saves s where s.user_id=actor and s.link_id=l.id)) order by l.url)
   from dm_private.community_links l where exists(select 1 from dm_private.community_link_saves s where s.user_id=actor and s.link_id=l.id)),'[]'::jsonb),
  'notes',coalesce((select jsonb_agg(jsonb_build_object('postId',n.post_id,'linkId',n.link_id,'body',n.body,'updatedAt',n.updated_at) order by n.updated_at,n.id)
   from dm_private.community_notes n where n.user_id=actor),'[]'::jsonb),
  'linkSuggestions',coalesce((select jsonb_agg(jsonb_build_object('linkId',g.link_id,'exam',g.exam,'topic',g.topic,'note',g.note,'status',g.status,'reason',g.reason,'createdAt',g.created_at) order by g.created_at,g.id)
   from dm_private.community_link_suggestions g where g.user_id=actor),'[]'::jsonb),
  'drafts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'exam',exam,'topic',topic,'title',title,'body',body,'updatedAt',updated_at) order by updated_at,id)
   from dm_private.community_drafts where user_id=actor),'[]'::jsonb),
  'blocked',coalesce((select jsonb_agg(jsonb_build_object('author',coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student'),'createdAt',b.created_at) order by b.created_at,b.blocked_id)
   from dm_private.community_blocks b left join public.profiles pr on pr.user_id=b.blocked_id where b.blocker_id=actor),'[]'::jsonb));
end $$;

revoke all on function public.community_link_lookup(text),public.service_begin_community_link_fetch(uuid),
 public.service_record_community_link(text,text,text,text,text,text),public.save_community_link(uuid,uuid[],text),public.remove_community_link_save(uuid,uuid),
 public.suggest_community_link(uuid,text,text,text),public.community_link_review_queue(),public.review_community_link_suggestion(uuid,boolean,text,boolean),
 public.admin_community_trusted_hosts(),public.admin_set_community_trusted_host(text,boolean) from public,anon,authenticated;
grant execute on function public.community_link_lookup(text),public.save_community_link(uuid,uuid[],text),public.remove_community_link_save(uuid,uuid),
 public.suggest_community_link(uuid,text,text,text),public.community_link_review_queue(),public.review_community_link_suggestion(uuid,boolean,text,boolean),
 public.admin_community_trusted_hosts(),public.admin_set_community_trusted_host(text,boolean) to authenticated;
grant execute on function public.service_begin_community_link_fetch(uuid),public.service_record_community_link(text,text,text,text,text,text) to service_role;

commit;
