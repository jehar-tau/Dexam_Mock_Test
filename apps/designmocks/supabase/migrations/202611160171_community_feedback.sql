begin;

-- Community phase 2: accepted answers, work for feedback, teacher and moderator
-- roles, a moderator hold, editing with history, sanctions, a featured shelf and
-- safety-first report order. See apps/designmocks/docs/community/02-data-model.md.

-- 1. Posts: a third kind, an accepted answer and an edit time.
alter table dm_private.community_posts drop constraint community_posts_kind_check;
alter table dm_private.community_posts add constraint community_posts_kind_check check(kind in('discussion','article','work'));
alter table dm_private.community_posts drop constraint community_posts_body_check;
alter table dm_private.community_posts add constraint community_posts_body_check
 check(case kind when 'article' then char_length(body) between 200 and 20000 when 'work' then char_length(body) between 40 and 5000
  else char_length(body) between 20 and 5000 end);
alter table dm_private.community_posts
 add column accepted_comment_id uuid references dm_private.community_comments(id) on delete set null,
 add column edited_at timestamptz;
create index community_work_idx on dm_private.community_posts(created_at desc,id desc) where kind='work' and status<>'hidden';
create index community_unanswered_idx on dm_private.community_posts(created_at desc,id desc) where kind='discussion' and status='visible' and accepted_comment_id is null;

create table dm_private.community_roles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 teacher boolean not null default false,
 moderator boolean not null default false,
 granted_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default clock_timestamp(),
 check(teacher or not moderator)
);
create table dm_private.community_post_revisions(
 id bigint generated always as identity primary key,
 post_id uuid not null references dm_private.community_posts(id) on delete cascade,
 editor_id uuid not null references auth.users(id) on delete cascade,
 topic text not null,title text not null,body text not null,
 replaced_at timestamptz not null default clock_timestamp()
);
create index community_post_revisions_post_idx on dm_private.community_post_revisions(post_id,replaced_at desc,id desc);
create index community_post_revisions_editor_idx on dm_private.community_post_revisions(editor_id,replaced_at desc);
create table dm_private.community_sanctions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in('mute','ban')),
 until timestamptz,
 reason text not null check(char_length(btrim(reason)) between 8 and 1000),
 actor_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default clock_timestamp(),
 lifted_at timestamptz,
 lifted_by uuid references auth.users(id) on delete set null,
 check((kind='mute')=(until is not null))
);
create index community_sanctions_user_idx on dm_private.community_sanctions(user_id,created_at desc);
create table dm_private.community_featured(
 post_id uuid primary key references dm_private.community_posts(id) on delete cascade,
 featured_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default clock_timestamp()
);
alter table dm_private.community_roles enable row level security;
alter table dm_private.community_post_revisions enable row level security;
alter table dm_private.community_sanctions enable row level security;
alter table dm_private.community_featured enable row level security;
revoke all on dm_private.community_roles,dm_private.community_post_revisions,dm_private.community_sanctions,dm_private.community_featured
 from public,anon,authenticated,service_role;

-- 2. Private helpers.
create function dm_private.community_is_teacher(p_user uuid) returns boolean
language sql stable set search_path=pg_catalog,dm_private as $$
 select exists(select 1 from dm_private.community_roles r where r.user_id=p_user and r.teacher)
$$;
create function dm_private.community_is_moderator(p_user uuid) returns boolean
language sql stable set search_path=pg_catalog,dm_private as $$
 select exists(select 1 from dm_private.community_roles r where r.user_id=p_user and r.moderator)
$$;
create function dm_private.community_active_sanction(p_user uuid) returns dm_private.community_sanctions
language sql stable set search_path=pg_catalog,dm_private as $$
 select s from dm_private.community_sanctions s where s.user_id=p_user and s.lifted_at is null and(s.until is null or s.until>clock_timestamp())
 order by s.created_at desc limit 1
$$;
-- Muted and banned accounts cannot post, reply or edit, whichever function writes.
create function dm_private.community_standing_guard() returns trigger
language plpgsql set search_path=pg_catalog,dm_private as $$
begin
 if(dm_private.community_active_sanction(new.author_id)).id is not null then
  raise exception 'Posting is paused for this account' using errcode='P0001',detail='community_sanctioned';
 end if;
 return new;
end $$;
create trigger community_post_standing before insert or update of topic,title,body on dm_private.community_posts
 for each row execute function dm_private.community_standing_guard();
create trigger community_comment_standing before insert on dm_private.community_comments
 for each row execute function dm_private.community_standing_guard();

create function dm_private.community_card(p dm_private.community_posts,p_actor uuid) returns jsonb
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
  'words',coalesce(array_length(regexp_split_to_array(btrim(regexp_replace(p.body,'\s+',' ','g')),' '),1),0))
$$;
revoke all on function dm_private.community_is_teacher(uuid),dm_private.community_is_moderator(uuid),dm_private.community_active_sanction(uuid),
 dm_private.community_standing_guard(),dm_private.community_card(dm_private.community_posts,uuid) from public,anon,authenticated,service_role;

-- 3. Work for feedback. The two prompts become headed sections of the body.
create function public.create_community_work(p_exam text,p_topic text,p_title text,p_intent text,p_request text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare actor uuid:=auth.uid(); receipt dm_private.community_write_receipts; result uuid; fingerprint text;
 v_exam text:=lower(btrim(p_exam)); v_topic text:=btrim(p_topic); v_title text:=btrim(p_title);
 v_intent text:=btrim(p_intent,E' \n\r\t'); v_request text:=btrim(p_request,E' \n\r\t'); v_body text;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_request_id is null or v_exam is null or v_exam not in('uceed','nid','nift','ceed')
  or v_topic is null or char_length(v_topic) not between 1 and 100
  or v_title is null or char_length(v_title) not between 8 and 160
  or v_intent is null or char_length(v_intent) not between 20 and 2000
  or v_request is null or char_length(v_request) not between 20 and 2000 then
  raise exception 'Invalid work post' using errcode='22023',detail='community_invalid_input';
 end if;
 v_body:=E'## What I was trying to do\n\n'||v_intent||E'\n\n## What I want feedback on\n\n'||v_request;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array('work',v_exam,v_topic,v_title,v_body)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('community-write:'||actor::text||':'||p_request_id::text,0));
 select * into receipt from dm_private.community_write_receipts where user_id=actor and request_id=p_request_id;
 if found then
  if receipt.operation<>'post' or receipt.fingerprint<>fingerprint then
   raise exception 'This request belongs to different community text' using errcode='22023',detail='community_request_conflict';
  end if;
  return dm_private.community_write_result(actor,'post',receipt.target_id,true);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('community-post:'||actor::text,0));
 if(select count(*) from dm_private.community_posts where author_id=actor and kind='work' and created_at>clock_timestamp()-interval'24 hours')>=5 then
  raise exception 'Too many work posts today' using errcode='P0001',detail='community_work_limit';
 end if;
 perform 1 from auth.users where id=actor for key share;
 if not found then raise exception 'Sign in required' using errcode='42501'; end if;
 perform 1 from dm_private.community_feed_state where singleton for update;
 insert into dm_private.community_posts(author_id,kind,exam,topic,title,body,created_at)
 values(actor,'work',v_exam,v_topic,v_title,v_body,clock_timestamp()) returning id into result;
 insert into dm_private.community_write_receipts(user_id,request_id,operation,fingerprint,target_id) values(actor,p_request_id,'post',fingerprint,result);
 return dm_private.community_write_result(actor,'post',result,false);
end $$;

-- 4. Lists that link to the reading page: work, and discussions with no accepted answer.
create function public.community_cards(p_view text,p_exam text,p_cursor jsonb,p_limit integer)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare actor uuid:=auth.uid(); v_exam text:=nullif(lower(btrim(p_exam)),''); v_created timestamptz; v_id uuid;
 v_rows jsonb; v_more boolean; v_last jsonb; v_next jsonb:=null;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_view is null or p_view not in('work','unanswered') or p_limit is null or p_limit not between 1 and 25
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

-- 5. Accepted answer: the asker picks one visible reply from someone else, or clears it.
create function public.accept_community_answer(p_post_id uuid,p_comment_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid:=auth.uid(); target dm_private.community_posts;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into target from dm_private.community_posts where id=p_post_id and status='visible' and kind='discussion' and author_id=actor for update;
 if not found then raise exception 'Question not found' using errcode='42501',detail='community_target_unavailable'; end if;
 if p_comment_id is not null then
  perform 1 from dm_private.community_comments where id=p_comment_id and post_id=target.id and status='visible' and author_id<>actor for share;
  if not found then raise exception 'Reply not found' using errcode='42501',detail='community_target_unavailable'; end if;
 end if;
 update dm_private.community_posts set accepted_comment_id=p_comment_id where id=target.id;
 return jsonb_build_object('postId',target.id,'acceptedCommentId',p_comment_id);
end $$;

-- 6. Editing. The replaced text is kept for administrators; the contact guard and
-- the standing guard run again through their triggers.
create function public.edit_community_post(p_post_id uuid,p_topic text,p_title text,p_body text,p_version bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private set timezone='UTC' as $$
declare actor uuid:=auth.uid(); target dm_private.community_posts; v_topic text:=btrim(p_topic); v_title text:=btrim(p_title);
 v_body text:=btrim(p_body,E' \n\r\t'); v_min integer; v_max integer; v_time timestamptz:=clock_timestamp(); v_version bigint;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into target from dm_private.community_posts where id=p_post_id and author_id=actor and status='visible' for update;
 if not found then raise exception 'Post not found' using errcode='42501',detail='community_target_unavailable'; end if;
 if p_version is null or p_version<>target.thread_revision then
  raise exception 'This post changed. Reload it before editing' using errcode='40001',detail='community_thread_changed';
 end if;
 v_min:=case target.kind when 'article' then 200 when 'work' then 40 else 20 end;
 v_max:=case target.kind when 'article' then 20000 else 5000 end;
 if v_topic is null or char_length(v_topic) not between 1 and 100 or v_title is null or char_length(v_title) not between 8 and 160
  or v_body is null or char_length(v_body) not between v_min and v_max then
  raise exception 'Invalid community post' using errcode='22023',detail='community_invalid_input';
 end if;
 if row(v_topic,v_title,v_body) is not distinct from row(target.topic,target.title,target.body) then
  return jsonb_build_object('id',target.id,'version',target.thread_revision,'editedAt',target.edited_at,'changed',false);
 end if;
 if(select count(*) from dm_private.community_post_revisions where editor_id=actor and replaced_at>v_time-interval'24 hours')>=20 then
  raise exception 'Too many edits today' using errcode='P0001',detail='community_edit_limit';
 end if;
 insert into dm_private.community_post_revisions(post_id,editor_id,topic,title,body,replaced_at) values(target.id,actor,target.topic,target.title,target.body,v_time);
 update dm_private.community_posts set topic=v_topic,title=v_title,body=v_body,edited_at=v_time,updated_at=v_time where id=target.id
  returning thread_revision into v_version;
 return jsonb_build_object('id',target.id,'version',v_version,'editedAt',v_time,'changed',true);
end $$;

create function public.admin_community_post_revisions(p_post_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 return jsonb_build_object('postId',p_post_id,
  'current',(select jsonb_build_object('title',p.title,'topic',p.topic,'body',p.body,'kind',p.kind,'status',p.status,'editedAt',p.edited_at) from dm_private.community_posts p where p.id=p_post_id),
  'revisions',coalesce((select jsonb_agg(jsonb_build_object('title',r.title,'topic',r.topic,'body',r.body,'replacedAt',r.replaced_at) order by r.replaced_at desc,r.id desc)
   from(select * from dm_private.community_post_revisions where post_id=p_post_id order by replaced_at desc,id desc limit 50)r),'[]'::jsonb));
end $$;

-- 7. Roles, granted only by an administrator.
create function public.admin_community_roles()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 return jsonb_build_object('roles',coalesce((select jsonb_agg(jsonb_build_object('email',u.email,'name',coalesce(pr.display_name,''),
  'teacher',r.teacher,'moderator',r.moderator,'updatedAt',r.updated_at) order by lower(u.email))
  from dm_private.community_roles r join auth.users u on u.id=r.user_id left join public.profiles pr on pr.user_id=r.user_id),'[]'::jsonb));
end $$;

create function public.admin_set_community_role(p_email text,p_teacher boolean,p_moderator boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare v_user uuid; v_email text:=lower(btrim(p_email));
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if v_email is null or v_email='' or p_teacher is null or p_moderator is null or(p_moderator and not p_teacher) then
  raise exception 'Invalid role' using errcode='22023',detail='community_invalid_input';
 end if;
 select id into v_user from auth.users where lower(email)=v_email;
 if v_user is null then raise exception 'No account with this email' using errcode='P0001',detail='community_role_unknown'; end if;
 if not p_teacher then delete from dm_private.community_roles where user_id=v_user;
 else
  insert into dm_private.community_roles(user_id,teacher,moderator,granted_by) values(v_user,true,p_moderator,auth.uid())
  on conflict(user_id) do update set teacher=true,moderator=excluded.moderator,granted_by=excluded.granted_by,updated_at=clock_timestamp();
 end if;
 return jsonb_build_object('email',v_email,'teacher',p_teacher,'moderator',p_moderator);
end $$;

-- What a member needs to know about their own standing.
create function public.my_community_standing()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private set timezone='UTC' as $$
declare actor uuid:=auth.uid(); s dm_private.community_sanctions;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 s:=dm_private.community_active_sanction(actor);
 return jsonb_build_object('teacher',dm_private.community_is_teacher(actor),'moderator',dm_private.community_is_moderator(actor),
  'sanction',case when s.id is not null then jsonb_build_object('kind',s.kind,'until',s.until,'reason',s.reason) end);
end $$;

-- 8. Moderator hold: hide now, pending an administrator's review. Never restores.
create function public.moderator_hold_community(p_target_type text,p_target_id uuid,p_note text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare actor uuid:=auth.uid(); v_author uuid; v_status text; v_note text:=btrim(p_note);
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if not(dm_private.community_is_moderator(actor) or public.is_dmocks_admin()) then
  raise exception 'Moderator access required' using errcode='42501',detail='community_moderator_required';
 end if;
 if p_target_type is null or p_target_type not in('post','comment') or p_target_id is null or v_note is null or char_length(v_note) not between 8 and 1000 then
  raise exception 'Invalid hold' using errcode='22023',detail='community_invalid_input';
 end if;
 if(select count(*) from dm_private.community_moderation_log where actor_id=actor and created_at>clock_timestamp()-interval'1 hour')>=30 then
  raise exception 'Too many holds. Please try again later' using errcode='P0001',detail='community_hold_limit';
 end if;
 perform dm_private.lock_community_moderation_target(p_target_type,p_target_id,true);
 if p_target_type='post' then select author_id,status into v_author,v_status from dm_private.community_posts where id=p_target_id;
 else select author_id,status into v_author,v_status from dm_private.community_comments where id=p_target_id; end if;
 if v_author is null or v_status='hidden' then raise exception 'Content not found' using errcode='42501',detail='community_target_unavailable'; end if;
 if v_author=actor then raise exception 'You cannot hold your own content' using errcode='22023',detail='community_hold_own'; end if;
 if p_target_type='post' then update dm_private.community_posts set status='hidden',updated_at=clock_timestamp() where id=p_target_id;
 else update dm_private.community_comments set status='hidden' where id=p_target_id; end if;
 insert into dm_private.community_moderation_log(actor_id,target_type,target_id,action,note)
 values(actor,p_target_type,p_target_id,'hide','Moderator hold, pending review: '||v_note);
 return jsonb_build_object('targetType',p_target_type,'targetId',p_target_id,'status','hidden');
end $$;

-- 9. Sanctions, by an administrator, against the author of a post or reply.
create function public.admin_community_sanction(p_target_type text,p_target_id uuid,p_kind text,p_days integer,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare v_user uuid; v_until timestamptz; v_id uuid; v_reason text:=btrim(p_reason);
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_target_type is null or p_target_type not in('post','comment') or p_target_id is null or p_kind is null or p_kind not in('mute','ban')
  or(p_kind='mute' and(p_days is null or p_days not between 1 and 365)) or v_reason is null or char_length(v_reason) not between 8 and 1000 then
  raise exception 'Invalid sanction' using errcode='22023',detail='community_invalid_input';
 end if;
 if p_target_type='post' then select author_id into v_user from dm_private.community_posts where id=p_target_id;
 else select author_id into v_user from dm_private.community_comments where id=p_target_id; end if;
 if v_user is null then raise exception 'Content not found' using errcode='42501',detail='community_target_unavailable'; end if;
 if v_user=auth.uid() then raise exception 'You cannot sanction yourself' using errcode='22023',detail='community_invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended('community-sanction:'||v_user::text,0));
 if p_kind='mute' then v_until:=clock_timestamp()+make_interval(days=>p_days); end if;
 update dm_private.community_sanctions set lifted_at=clock_timestamp(),lifted_by=auth.uid()
  where user_id=v_user and lifted_at is null and(until is null or until>clock_timestamp());
 insert into dm_private.community_sanctions(user_id,kind,until,reason,actor_id) values(v_user,p_kind,v_until,v_reason,auth.uid()) returning id into v_id;
 return jsonb_build_object('id',v_id,'kind',p_kind,'until',v_until);
end $$;

create function public.admin_community_sanctions()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 return jsonb_build_object('sanctions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'email',u.email,'name',coalesce(pr.display_name,''),
  'kind',s.kind,'until',s.until,'reason',s.reason,'createdAt',s.created_at) order by s.created_at desc,s.id)
  from dm_private.community_sanctions s join auth.users u on u.id=s.user_id left join public.profiles pr on pr.user_id=s.user_id
  where s.lifted_at is null and(s.until is null or s.until>clock_timestamp())),'[]'::jsonb));
end $$;

create function public.admin_lift_community_sanction(p_sanction_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 update dm_private.community_sanctions set lifted_at=clock_timestamp(),lifted_by=auth.uid() where id=p_sanction_id and lifted_at is null;
 return jsonb_build_object('lifted',found);
end $$;

-- 10. Featured shelf, chosen by teachers or an administrator. At most ten.
create function public.set_community_featured(p_post_id uuid,p_featured boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if not(dm_private.community_is_teacher(actor) or public.is_dmocks_admin()) then
  raise exception 'Teacher access required' using errcode='42501',detail='community_teacher_required';
 end if;
 if p_post_id is null or p_featured is null then raise exception 'Invalid feature' using errcode='22023',detail='community_invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended('community-featured',0));
 if p_featured then
  perform 1 from dm_private.community_posts where id=p_post_id and status='visible' and kind in('article','work') for key share;
  if not found then raise exception 'Post not found' using errcode='42501',detail='community_target_unavailable'; end if;
  if not exists(select 1 from dm_private.community_featured where post_id=p_post_id) then
   if(select count(*) from dm_private.community_featured f join dm_private.community_posts p on p.id=f.post_id where p.status='visible')>=10 then
    raise exception 'The featured shelf is full' using errcode='P0001',detail='community_featured_limit';
   end if;
   insert into dm_private.community_featured(post_id,featured_by) values(p_post_id,actor) on conflict do nothing;
  end if;
 else delete from dm_private.community_featured where post_id=p_post_id; end if;
 return jsonb_build_object('postId',p_post_id,'featured',p_featured);
end $$;

create function public.community_featured_list()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return jsonb_build_object('cards',coalesce((select jsonb_agg(dm_private.community_card(p,actor) order by f.created_at desc,p.id)
  from dm_private.community_featured f join dm_private.community_posts p on p.id=f.post_id
  where p.status='visible' and not exists(select 1 from dm_private.community_blocks b where b.blocker_id=actor and b.blocked_id=p.author_id)),'[]'::jsonb));
end $$;

-- 11. Existing functions, re-created from migration 202611160170.
-- community_feed: each discussion says whether it has an accepted answer and
-- whether a teacher wrote it.
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
  'author',coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student'),'createdAt',p.created_at,'teacher',dm_private.community_is_teacher(p.author_id),
  'answered',exists(select 1 from dm_private.community_comments ac where ac.id=p.accepted_comment_id and ac.status='visible'),
  'comments',(select count(*) from dm_private.community_comments c where c.post_id=p.id and c.status='visible'),
  'assetCount',(select count(*) from dm_private.community_assets a where a.post_id=p.id)) order by p.created_at desc,p.id desc),'[]'),
  (select count(*)>p_limit from candidates) into v_posts,v_more from page p left join public.profiles pr on pr.user_id=p.author_id;
 if v_more then
  v_last:=v_posts->-1;
  v_next:=jsonb_build_object('createdAt',v_last->'createdAt','id',v_last->'id','snapshotAt',v_snapshot,'version',v_revision,'exam',v_exam,'topic',v_topic);
 end if;
 return jsonb_build_object('posts',v_posts,'nextCursor',v_next,'snapshotAt',v_snapshot,'version',v_revision,'filters',jsonb_build_object('exam',v_exam,'topic',v_topic));
end $$;

-- community_thread: teacher labels, the accepted answer, and what the reader may do.
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
 return result||jsonb_build_object('kind',target.kind,'createdAt',target.created_at,
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

-- community_articles: a teacher label on each card.
create or replace function public.community_articles(p_exam text,p_sort text,p_cursor jsonb,p_limit integer)
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
  'author',coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student'),'createdAt',p.created_at,'status',p.status,'teacher',dm_private.community_is_teacher(p.author_id),
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

-- export_my_community_library: the member's own replaced text and sanctions.
create or replace function public.export_my_community_library()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return jsonb_build_object('schemaVersion',2,'exportedAt',now(),'accountId',actor,
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
  'drafts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'exam',exam,'topic',topic,'title',title,'body',body,'updatedAt',updated_at) order by updated_at,id)
   from dm_private.community_drafts where user_id=actor),'[]'::jsonb),
  'blocked',coalesce((select jsonb_agg(jsonb_build_object('author',coalesce(nullif(split_part(pr.display_name,' ',1),''),'Student'),'createdAt',b.created_at) order by b.created_at,b.blocked_id)
   from dm_private.community_blocks b left join public.profiles pr on pr.user_id=b.blocked_id where b.blocker_id=actor),'[]'::jsonb));
end $$;

-- admin_community_report_queue: safety reports first, then oldest first.
create or replace function public.admin_community_report_queue() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  return(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'targetType',case when r.post_id is null then'comment'else'post'end,'targetId',coalesce(r.post_id,r.comment_id),'reason',r.reason,'details',r.details,'createdAt',r.created_at,'content',coalesce(p.title||E'\n'||p.body,c.body),'contentStatus',coalesce(p.status,c.status)) order by(r.reason='safety') desc,r.created_at),'[]') from dm_private.community_reports r left join dm_private.community_posts p on p.id=r.post_id left join dm_private.community_comments c on c.id=r.comment_id where r.status='open');
end $$;

revoke all on function public.create_community_work(text,text,text,text,text,uuid),public.community_cards(text,text,jsonb,integer),
 public.accept_community_answer(uuid,uuid),public.edit_community_post(uuid,text,text,text,bigint),public.admin_community_post_revisions(uuid),
 public.admin_community_roles(),public.admin_set_community_role(text,boolean,boolean),public.my_community_standing(),
 public.moderator_hold_community(text,uuid,text),public.admin_community_sanction(text,uuid,text,integer,text),public.admin_community_sanctions(),
 public.admin_lift_community_sanction(uuid),public.set_community_featured(uuid,boolean),public.community_featured_list() from public,anon;
grant execute on function public.create_community_work(text,text,text,text,text,uuid),public.community_cards(text,text,jsonb,integer),
 public.accept_community_answer(uuid,uuid),public.edit_community_post(uuid,text,text,text,bigint),public.admin_community_post_revisions(uuid),
 public.admin_community_roles(),public.admin_set_community_role(text,boolean,boolean),public.my_community_standing(),
 public.moderator_hold_community(text,uuid,text),public.admin_community_sanction(text,uuid,text,integer,text),public.admin_community_sanctions(),
 public.admin_lift_community_sanction(uuid),public.set_community_featured(uuid,boolean),public.community_featured_list() to authenticated;

commit;
