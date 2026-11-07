begin;

-- Shared readers take no post/comment locks. New posts drain this fence before
-- assigning their insertion clock; updates retain the existing post-first order.
create table dm_private.community_feed_state(
 singleton boolean primary key default true check(singleton),
 revision bigint not null default 1 check(revision between 1 and 9007199254740991)
);
insert into dm_private.community_feed_state(singleton) values(true);
alter table dm_private.community_feed_state enable row level security;
revoke all on dm_private.community_feed_state from public,anon,authenticated,service_role;

create function dm_private.invalidate_community_feed() returns trigger language plpgsql security definer
set search_path=pg_catalog,dm_private as $$
begin
 if tg_op='DELETE' then
  update dm_private.community_feed_state set revision=revision+1 where singleton;
  return old;
 end if;
 if row(new.title,new.body,new.exam,new.topic,new.status,new.created_at) is distinct from
    row(old.title,old.body,old.exam,old.topic,old.status,old.created_at) then
  update dm_private.community_feed_state set revision=revision+1 where singleton;
 end if;
 return new;
end $$;
revoke all on function dm_private.invalidate_community_feed() from public,anon,authenticated,service_role;
create trigger community_feed_invalidation after update or delete on dm_private.community_posts
 for each row execute function dm_private.invalidate_community_feed();
create index community_feed_snapshot_idx on dm_private.community_posts(created_at desc,id desc) where status<>'hidden';
create index community_feed_filter_idx on dm_private.community_posts(exam,topic,created_at desc,id desc) where status<>'hidden';
create index community_feed_topic_idx on dm_private.community_posts(topic,created_at desc,id desc) where status<>'hidden';

create or replace function public.create_community_post(p_exam text,p_topic text,p_title text,p_body text)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare result uuid; actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_exam is null or lower(trim(p_exam)) not in('uceed','nid','nift','ceed')
  or p_topic is null or char_length(trim(p_topic)) not between 1 and 100
  or p_title is null or char_length(trim(p_title)) not between 8 and 160
  or p_body is null or char_length(trim(p_body)) not between 20 and 5000 then
  raise exception 'Invalid community post' using errcode='22023',detail='community_invalid_input';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('community-post:'||actor::text,0));
 if(select count(*) from dm_private.community_posts where author_id=actor and created_at>clock_timestamp()-interval'1 hour')>=5 then
  raise exception 'Too many community posts. Please try again later' using detail='community_post_limit';
 end if;
 -- Acquire the creator FK before the global fence. Auth deletion is not an app
 -- operation; future deletion/bulk writers must also respect the operator plan.
 perform 1 from auth.users where id=actor for key share;
 if not found then raise exception 'Sign in required' using errcode='42501'; end if;
 perform 1 from dm_private.community_feed_state where singleton for update;
 insert into dm_private.community_posts(author_id,exam,topic,title,body,created_at)
 values(actor,lower(trim(p_exam)),trim(p_topic),trim(p_title),trim(p_body),clock_timestamp()) returning id into result;
 return result;
end $$;

create function public.community_feed(p_exam text,p_topic text,p_cursor jsonb,p_limit integer)
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
  select p.* from dm_private.community_posts p where p.status<>'hidden' and p.created_at<=v_snapshot
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

-- Existing clients remain compatible but cannot read the whole feed at once.
create or replace function public.community_feed(p_exam text default null,p_topic text default null)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public as $$
begin return public.community_feed(p_exam,p_topic,null,25)->'posts'; end $$;
revoke all on function public.community_feed(text,text,jsonb,integer),public.community_feed(text,text),public.create_community_post(text,text,text,text) from public,anon;
grant execute on function public.community_feed(text,text,jsonb,integer),public.community_feed(text,text),public.create_community_post(text,text,text,text) to authenticated;

commit;
