begin;

-- Community phase 5: the prep space. Private notes on any post, Learn
-- programmes saved alongside Community items, one overview of everything a
-- member has kept, and search across it. Everything here is private to the
-- member; nothing is shown to anyone else.

create table dm_private.community_learn_saves(
 user_id uuid not null references auth.users(id) on delete cascade,
 programme text not null check(programme ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(programme)<=60),
 title text not null check(char_length(title) between 1 and 120),
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,programme)
);
alter table dm_private.community_learn_saves enable row level security;
revoke all on dm_private.community_learn_saves from public,anon,authenticated,service_role;
create index community_notes_user_idx on dm_private.community_notes(user_id,updated_at desc);
create index community_posts_author_kind_idx on dm_private.community_posts(author_id,created_at desc);

-- A post the member may read: visible or locked, not from an author they blocked.
create function dm_private.community_readable_post(p_actor uuid,p_post_id uuid) returns dm_private.community_posts
language sql stable set search_path=pg_catalog,dm_private as $$
 select p from dm_private.community_posts p where p.id=p_post_id and p.status<>'hidden'
  and not exists(select 1 from dm_private.community_blocks b where b.blocker_id=p_actor and b.blocked_id=p.author_id)
$$;
-- Escapes LIKE wildcards in one search term.
create function dm_private.community_like_term(p_term text) returns text
language sql immutable set search_path=pg_catalog as $$
 select '%'||replace(replace(replace(p_term,'\','\\'),'%','\%'),'_','\_')||'%'
$$;
revoke all on function dm_private.community_readable_post(uuid,uuid),dm_private.community_like_term(text) from public,anon,authenticated,service_role;

-- 1. Private notes on posts.
create function public.community_my_note(p_post_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private set timezone='UTC' as $$
declare actor uuid:=auth.uid(); n dm_private.community_notes;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into n from dm_private.community_notes where user_id=actor and post_id=p_post_id;
 return jsonb_build_object('postId',p_post_id,'note',n.body,'updatedAt',n.updated_at);
end $$;

create function public.set_community_note(p_post_id uuid,p_body text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private set timezone='UTC' as $$
declare actor uuid:=auth.uid(); v_body text:=btrim(coalesce(p_body,''),E' \n\r\t'); n dm_private.community_notes;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if char_length(v_body)>2000 then raise exception 'Invalid note' using errcode='22023',detail='community_invalid_input'; end if;
 if v_body='' then
  delete from dm_private.community_notes where user_id=actor and post_id=p_post_id;
  return jsonb_build_object('postId',p_post_id,'note',null,'updatedAt',null);
 end if;
 if(dm_private.community_readable_post(actor,p_post_id)).id is null then
  raise exception 'Post not found' using errcode='42501',detail='community_target_unavailable';
 end if;
 if(select count(*) from dm_private.community_notes where user_id=actor)>=2000 and not exists(select 1 from dm_private.community_notes where user_id=actor and post_id=p_post_id) then
  raise exception 'Too many notes' using errcode='P0001',detail='community_note_limit';
 end if;
 insert into dm_private.community_notes(user_id,post_id,body) values(actor,p_post_id,v_body)
 on conflict(user_id,post_id) where post_id is not null do update set body=excluded.body,updated_at=clock_timestamp()
 returning * into n;
 return jsonb_build_object('postId',p_post_id,'note',n.body,'updatedAt',n.updated_at);
end $$;

-- 2. Learn programmes kept in the prep space. The slug and title come from the
-- app's programme list; the server only checks their shape.
create function public.set_learn_programme_saved(p_programme text,p_title text,p_saved boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid(); v_title text:=btrim(coalesce(p_title,''));
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_saved is null or p_programme is null or p_programme !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_programme)>60 or(p_saved and char_length(v_title) not between 1 and 120) then
  raise exception 'Invalid programme' using errcode='22023',detail='community_invalid_input';
 end if;
 if p_saved then
  if(select count(*) from dm_private.community_learn_saves where user_id=actor)>=200 then
   raise exception 'Too many saved programmes' using errcode='P0001',detail='community_save_limit';
  end if;
  insert into dm_private.community_learn_saves(user_id,programme,title) values(actor,p_programme,v_title)
  on conflict(user_id,programme) do update set title=excluded.title;
 else delete from dm_private.community_learn_saves where user_id=actor and programme=p_programme; end if;
 return jsonb_build_object('programme',p_programme,'saved',p_saved);
end $$;

create function public.learn_programme_saved(p_programme text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return jsonb_build_object('programme',p_programme,'saved',exists(select 1 from dm_private.community_learn_saves where user_id=actor and programme=p_programme));
end $$;

-- 3. The prep space overview.
create function public.community_prep()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return jsonb_build_object(
  'counts',jsonb_build_object(
   'folders',(select count(*) from dm_private.community_folders where user_id=actor),
   'savedPosts',(select count(distinct post_id) from dm_private.community_saves where user_id=actor),
   'savedLinks',(select count(distinct link_id) from dm_private.community_link_saves where user_id=actor),
   'notes',(select count(*) from dm_private.community_notes where user_id=actor),
   'posts',(select count(*) from dm_private.community_posts where author_id=actor and status<>'hidden'),
   'drafts',(select count(*) from dm_private.community_drafts where user_id=actor),
   'learn',(select count(*) from dm_private.community_learn_saves where user_id=actor)),
  'learn',coalesce((select jsonb_agg(jsonb_build_object('programme',programme,'title',title,'savedAt',created_at) order by created_at desc,programme)
   from dm_private.community_learn_saves where user_id=actor),'[]'::jsonb),
  'posts',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'kind',p.kind,'title',p.title,'status',p.status,'createdAt',p.created_at,
   'comments',(select count(*) from dm_private.community_comments c where c.post_id=p.id and c.status='visible'),
   'likes',(select count(*) from dm_private.community_post_likes l where l.post_id=p.id)) order by p.created_at desc,p.id)
   from(select * from dm_private.community_posts where author_id=actor and status<>'hidden' order by created_at desc,id limit 20)p),'[]'::jsonb),
  'drafts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'updatedAt',updated_at) order by updated_at desc,id)
   from dm_private.community_drafts where user_id=actor),'[]'::jsonb),
  'notes',coalesce((select jsonb_agg(item order by updated desc,key) from(
   select n.updated_at updated,n.id::text key,jsonb_build_object('type',case when n.post_id is not null then 'post' else 'link' end,
    'id',coalesce(n.post_id,n.link_id),'title',coalesce(p.title,l.title,l.host),'note',left(n.body,280),'updatedAt',n.updated_at,
    'url',l.url) item
   from dm_private.community_notes n
   left join dm_private.community_posts p on p.id=n.post_id and p.status<>'hidden'
    and not exists(select 1 from dm_private.community_blocks b where b.blocker_id=actor and b.blocked_id=p.author_id)
   left join dm_private.community_links l on l.id=n.link_id
   where n.user_id=actor and(p.id is not null or l.id is not null)
   order by n.updated_at desc,n.id limit 20)x),'[]'::jsonb));
end $$;

-- 4. Search across everything the member has kept or written. Every term must
-- appear somewhere in the item; at most thirty results.
create function public.community_prep_search(p_query text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare actor uuid:=auth.uid(); v_query text:=btrim(regexp_replace(coalesce(p_query,''),'\s+',' ','g')); v_terms text[];
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if char_length(v_query) not between 2 and 100 then raise exception 'Invalid search' using errcode='22023',detail='community_invalid_input'; end if;
 v_terms:=(select array_agg(dm_private.community_like_term(t)) from(select t from unnest(string_to_array(lower(v_query),' ')) t where t<>'' limit 6)x);
 return jsonb_build_object('query',v_query,'results',coalesce((select jsonb_agg(item order by rank,at desc) from(
  select * from(
   -- Saved posts, with the member's note.
   select 1 rank,max(s.created_at) at,jsonb_build_object('type','saved-post','id',p.id,'kind',p.kind,'title',p.title,'snippet',dm_private.community_excerpt(p.body),
    'note',(select n.body from dm_private.community_notes n where n.user_id=actor and n.post_id=p.id)) item
   from dm_private.community_saves s join dm_private.community_posts p on p.id=s.post_id and p.status<>'hidden'
   where s.user_id=actor and not exists(select 1 from dm_private.community_blocks b where b.blocker_id=actor and b.blocked_id=p.author_id)
    and(select bool_and(lower(concat_ws(' ',p.title,p.topic,p.body,(select n.body from dm_private.community_notes n where n.user_id=actor and n.post_id=p.id))) like t escape '\') from unnest(v_terms) t)
   group by p.id
   union all
   -- Saved links, with the member's note.
   select 1,max(s.created_at),jsonb_build_object('type','link','id',l.id,'title',coalesce(l.title,l.host),'snippet',coalesce(l.description,l.url),'url',l.url,
    'note',(select n.body from dm_private.community_notes n where n.user_id=actor and n.link_id=l.id))
   from dm_private.community_link_saves s join dm_private.community_links l on l.id=s.link_id
   where s.user_id=actor
    and(select bool_and(lower(concat_ws(' ',l.title,l.site,l.host,l.description,l.url,(select n.body from dm_private.community_notes n where n.user_id=actor and n.link_id=l.id))) like t escape '\') from unnest(v_terms) t)
   group by l.id
   union all
   -- The member's own posts.
   select 2,p.created_at,jsonb_build_object('type','my-post','id',p.id,'kind',p.kind,'title',p.title,'snippet',dm_private.community_excerpt(p.body),'note',null)
   from dm_private.community_posts p where p.author_id=actor and p.status<>'hidden'
    and(select bool_and(lower(concat_ws(' ',p.title,p.topic,p.body)) like t escape '\') from unnest(v_terms) t)
   union all
   -- Notes on posts the member has not saved.
   select 3,n.updated_at,jsonb_build_object('type','note','id',p.id,'kind',p.kind,'title',p.title,'snippet',left(n.body,280),'note',n.body)
   from dm_private.community_notes n join dm_private.community_posts p on p.id=n.post_id and p.status<>'hidden'
   where n.user_id=actor and p.author_id<>actor and not exists(select 1 from dm_private.community_saves s where s.user_id=actor and s.post_id=p.id)
    and not exists(select 1 from dm_private.community_blocks b where b.blocker_id=actor and b.blocked_id=p.author_id)
    and(select bool_and(lower(concat_ws(' ',p.title,n.body)) like t escape '\') from unnest(v_terms) t)
   union all
   -- Drafts.
   select 4,d.updated_at,jsonb_build_object('type','draft','id',d.id,'title',nullif(d.title,''),'snippet',left(d.body,280),'note',null)
   from dm_private.community_drafts d where d.user_id=actor
    and(select bool_and(lower(concat_ws(' ',d.title,d.topic,d.body)) like t escape '\') from unnest(v_terms) t)
   union all
   -- Saved Learn programmes.
   select 1,ls.created_at,jsonb_build_object('type','learn','id',ls.programme,'title',ls.title,'snippet',null,'note',null)
   from dm_private.community_learn_saves ls where ls.user_id=actor
    and(select bool_and(lower(concat_ws(' ',ls.title,replace(ls.programme,'-',' '))) like t escape '\') from unnest(v_terms) t)
  ) found order by rank,at desc limit 30) ranked),'[]'::jsonb));
end $$;

-- 5. export_my_community_library: saved Learn programmes.
create or replace function public.export_my_community_library()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return jsonb_build_object('schemaVersion',4,'exportedAt',now(),'accountId',actor,
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
  'learn',coalesce((select jsonb_agg(jsonb_build_object('programme',programme,'title',title,'savedAt',created_at) order by created_at,programme)
   from dm_private.community_learn_saves where user_id=actor),'[]'::jsonb),
  'drafts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'exam',exam,'topic',topic,'title',title,'body',body,'updatedAt',updated_at) order by updated_at,id)
   from dm_private.community_drafts where user_id=actor),'[]'::jsonb),
  'blocked',coalesce((select jsonb_agg(jsonb_build_object('author',coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student'),'createdAt',b.created_at) order by b.created_at,b.blocked_id)
   from dm_private.community_blocks b left join public.profiles pr on pr.user_id=b.blocked_id where b.blocker_id=actor),'[]'::jsonb));
end $$;

revoke all on function public.community_my_note(uuid),public.set_community_note(uuid,text),public.set_learn_programme_saved(text,text,boolean),
 public.learn_programme_saved(text),public.community_prep(),public.community_prep_search(text) from public,anon;
grant execute on function public.community_my_note(uuid),public.set_community_note(uuid,text),public.set_learn_programme_saved(text,text,boolean),
 public.learn_programme_saved(text),public.community_prep(),public.community_prep_search(text) to authenticated;

commit;
