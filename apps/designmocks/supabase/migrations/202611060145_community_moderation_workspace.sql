begin;

create table dm_private.community_moderation_actions(
 id bigint generated always as identity primary key,
 actor_id uuid not null references auth.users(id),
 request_id uuid not null,
 fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 target_type text not null check(target_type in('post','comment')),
 target_id uuid not null,
 action text not null check(action in('hide','restore','lock','unlock')),
 note text not null check(char_length(trim(note)) between 8 and 1000),
 review_version text not null check(review_version ~ '^[0-9a-f]{64}$'),
 inspected_snapshot jsonb not null check(jsonb_typeof(inspected_snapshot)='object'),
 receipt jsonb not null check(jsonb_typeof(receipt)='object'),
 created_at timestamptz not null default clock_timestamp(),
 unique(actor_id,request_id)
);
alter table dm_private.community_moderation_actions enable row level security;
revoke all on dm_private.community_moderation_actions from public,anon,authenticated,service_role;
create index community_admin_posts_idx on dm_private.community_posts(created_at desc,id desc);
create index community_admin_posts_filter_idx on dm_private.community_posts(status,exam,topic,created_at desc,id desc);
create index community_admin_comments_idx on dm_private.community_comments(post_id,status,created_at desc,id desc);

-- Every writer and private reader uses post -> selected/parent comments. Neither
-- path acquires the feed fence before a post lock. The private helpers are not RPCs.
create function dm_private.lock_community_moderation_target(p_kind text,p_id uuid,p_write boolean)
returns void language plpgsql set search_path=pg_catalog,dm_private as $$
declare v_post_id uuid; v_parent_id uuid; v_current_post uuid;
begin
 if p_kind is null or p_kind not in('post','comment') or p_id is null then
  raise exception 'Invalid moderation target' using errcode='22023',detail='community_moderation_invalid';
 end if;
 if p_kind='post' then v_post_id:=p_id;
 else select c.post_id into v_post_id from dm_private.community_comments c where c.id=p_id; end if;
 if p_write then perform 1 from dm_private.community_posts p where p.id=v_post_id for update;
 else perform 1 from dm_private.community_posts p where p.id=v_post_id for share; end if;
 if not found then raise exception 'Community content unavailable' using errcode='42501',detail='community_moderation_unavailable'; end if;
 if p_kind='comment' then
  select c.parent_id into v_parent_id from dm_private.community_comments c where c.id=p_id and c.post_id=v_post_id;
  if p_write then
   perform 1 from dm_private.community_comments c where c.post_id=v_post_id and c.id in(p_id,v_parent_id) order by c.id for update;
  else
   perform 1 from dm_private.community_comments c where c.post_id=v_post_id and c.id in(p_id,v_parent_id) order by c.id for share;
  end if;
  select c.post_id into v_current_post from dm_private.community_comments c where c.id=p_id;
  if v_current_post is distinct from v_post_id then
   raise exception 'Community content changed' using errcode='40001',detail='community_moderation_changed';
  end if;
 end if;
end $$;

create function dm_private.community_moderation_snapshot(p_kind text,p_id uuid)
returns jsonb language plpgsql set search_path=pg_catalog,dm_private set timezone='UTC' as $$
declare p dm_private.community_posts; c dm_private.community_comments; parent dm_private.community_comments;
 post_json jsonb; target_json jsonb; parent_json jsonb; groups jsonb; history jsonb; evidence jsonb; revision text; moderation_id bigint;
begin
 if p_kind='comment' then select * into c from dm_private.community_comments where id=p_id; end if;
 select * into p from dm_private.community_posts where id=case when p_kind='post' then p_id else c.post_id end;
 if not found or p_kind not in('post','comment') or(p_kind='comment' and c.id is null) then
  raise exception 'Community content unavailable' using errcode='42501',detail='community_moderation_unavailable';
 end if;
 if c.parent_id is not null then select * into parent from dm_private.community_comments where id=c.parent_id and post_id=p.id; end if;
 post_json:=to_jsonb(p)-'thread_revision';
 target_json:=case when p_kind='post' then post_json else to_jsonb(c)-'helpful_count' end;
 parent_json:=case when parent.id is not null then to_jsonb(parent)-'helpful_count' end;
 groups:=jsonb_build_object('post',dm_private.community_review_assets('post',p.id),
  'target',dm_private.community_review_assets(p_kind,p_id),
  'parent',case when parent.id is not null then dm_private.community_review_assets('comment',parent.id) else '[]'::jsonb end);
 select coalesce(max(m.id),0) into moderation_id from dm_private.community_moderation_log m
  where(m.target_type='post' and m.target_id=p.id)or(m.target_type='comment' and m.target_id in(c.id,parent.id));
 evidence:=jsonb_build_object('kind',p_kind,'id',p_id,'post',post_json,'target',target_json,'parent',parent_json,'assets',groups,'moderation',moderation_id);
 revision:=encode(sha256(convert_to(evidence::text,'UTF8')),'hex');
 select coalesce(jsonb_agg(item order by created_at desc,id desc),'[]') into history from(
  select m.id,m.created_at,jsonb_build_object('id','moderation:'||m.id,'action',m.action,'note',m.note,'createdAt',m.created_at) item
  from dm_private.community_moderation_log m
  where(m.target_type='post' and m.target_id=p.id)or(m.target_type='comment' and m.target_id in(c.id,parent.id))
  order by m.created_at desc,m.id desc limit 25
 ) h;
 return jsonb_build_object('targetType',p_kind,'targetId',p_id,'reviewVersion',revision,
  'canRestore',target_json->>'status'='hidden' and not exists(select 1 from jsonb_each(groups) g cross join lateral jsonb_array_elements(g.value)a where not(a->>'available')::boolean),
  'target',dm_private.community_review_content(p_kind,target_json,post_json,groups->'target'),
  'post',dm_private.community_review_content('post',post_json,post_json,groups->'post'),
  'parent',dm_private.community_review_content('comment',parent_json,post_json,groups->'parent'),'history',history,'_groups',groups);
end $$;

create function dm_private.apply_community_moderation(p_kind text,p_id uuid,p_action text,p_note text)
returns void language plpgsql set search_path=pg_catalog,dm_private,public as $$
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_moderation_unavailable'; end if;
 if p_note is null or char_length(trim(p_note)) not between 8 and 1000 or p_action is null
  or(p_kind='post' and p_action not in('hide','restore','lock','unlock'))or(p_kind='comment' and p_action not in('hide','restore')) then
  raise exception 'Invalid moderation action' using errcode='22023',detail='community_moderation_invalid';
 end if;
 perform dm_private.lock_community_moderation_target(p_kind,p_id,true);
 if p_kind='post' then
  update dm_private.community_posts set status=case p_action when 'hide' then 'hidden' when 'lock' then 'locked' else 'visible' end,updated_at=clock_timestamp() where id=p_id;
 else update dm_private.community_comments set status=case when p_action='hide' then 'hidden' else 'visible' end where id=p_id; end if;
 insert into dm_private.community_moderation_log(actor_id,target_type,target_id,action,note) values(auth.uid(),p_kind,p_id,p_action,trim(p_note));
 -- A status trigger or actor FK may have waited after the first role check.
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_moderation_unavailable'; end if;
end $$;
revoke all on function dm_private.lock_community_moderation_target(text,uuid,boolean),
 dm_private.community_moderation_snapshot(text,uuid),dm_private.apply_community_moderation(text,uuid,text,text) from public,anon,authenticated,service_role;

create function public.admin_review_community_content(p_target_type text,p_target_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare snapshot jsonb;
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_moderation_unavailable'; end if;
 perform dm_private.lock_community_moderation_target(p_target_type,p_target_id,false);
 snapshot:=dm_private.community_moderation_snapshot(p_target_type,p_target_id);
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_moderation_unavailable'; end if;
 return snapshot-'_groups';
end $$;

create function public.admin_community_moderation_media_paths(p_target_type text,p_target_id uuid,p_expected_version text,p_context text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare snapshot jsonb; assets jsonb;
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_moderation_unavailable'; end if;
 if p_expected_version is null or p_expected_version !~ '^[0-9a-f]{64}$' or p_context is null or p_context not in('target','post','parent') then
  raise exception 'Invalid moderation image request' using errcode='22023',detail='community_moderation_invalid'; end if;
 perform dm_private.lock_community_moderation_target(p_target_type,p_target_id,false);
 snapshot:=dm_private.community_moderation_snapshot(p_target_type,p_target_id);
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_moderation_unavailable'; end if;
 if snapshot->>'reviewVersion'<>p_expected_version then raise exception 'Community content changed' using errcode='40001',detail='community_moderation_changed'; end if;
 assets:=snapshot->'_groups'->p_context;
 if exists(select 1 from jsonb_array_elements(assets)a where not(a->>'available')::boolean) then
  raise exception 'A registered image is unavailable' using errcode='22023',detail='community_moderation_incomplete'; end if;
 return coalesce((select jsonb_agg(a-array['sha256','byteSize','object','available'] order by(a->>'ordinal')::integer,a->>'id') from jsonb_array_elements(assets)a),'[]');
end $$;

create function public.admin_moderate_community(p_target_type text,p_target_id uuid,p_action text,p_note text,p_expected_version text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public,storage set timezone='UTC' as $$
declare actor uuid:=auth.uid(); fingerprint text; old_action dm_private.community_moderation_actions;
 snapshot jsonb; groups jsonb; previous_status text; next_status text; result jsonb;
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_moderation_unavailable'; end if;
 if p_target_type is null or p_target_type not in('post','comment') or p_target_id is null or p_request_id is null
  or p_expected_version is null or p_expected_version !~ '^[0-9a-f]{64}$'
  or p_action is null or p_action not in('hide','restore','lock','unlock') or(p_target_type='comment' and p_action in('lock','unlock'))
  or p_note is null or char_length(trim(p_note)) not between 8 and 1000 then
  raise exception 'A current review and written reason are required' using errcode='22023',detail='community_moderation_invalid'; end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(p_target_type,p_target_id,p_action,trim(p_note),p_expected_version)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('community-moderation:'||actor::text||':'||p_request_id::text,0));
 -- Acquire the actor FK before any post/global fence, including receipt replays.
 perform 1 from auth.users where id=actor for key share;
 if not found or not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_moderation_unavailable'; end if;
 select * into old_action from dm_private.community_moderation_actions a where a.actor_id=actor and a.request_id=p_request_id;
 if found then
  if old_action.fingerprint<>fingerprint then raise exception 'This request belongs to a different action' using errcode='22023',detail='community_moderation_conflict'; end if;
  return old_action.receipt||jsonb_build_object('replayed',true);
 end if;
 perform dm_private.lock_community_moderation_target(p_target_type,p_target_id,true);
 snapshot:=dm_private.community_moderation_snapshot(p_target_type,p_target_id);groups:=snapshot->'_groups';
 perform 1 from storage.objects o where o.bucket_id='community-media' and o.name in(
  select a->>'path' from jsonb_each(groups)g cross join lateral jsonb_array_elements(g.value)a
 ) order by o.id for share;
 snapshot:=dm_private.community_moderation_snapshot(p_target_type,p_target_id);
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_moderation_unavailable'; end if;
 if snapshot->>'reviewVersion'<>p_expected_version then raise exception 'Community content changed' using errcode='40001',detail='community_moderation_changed'; end if;
 previous_status:=snapshot->'target'->>'status';
 if not((p_action='hide' and previous_status in('visible','locked'))or(p_action='restore' and previous_status='hidden')
  or(p_action='lock' and previous_status='visible')or(p_action='unlock' and previous_status='locked')) then
  raise exception 'Reopen the current content before choosing an action' using errcode='40001',detail='community_moderation_changed'; end if;
 if p_action='restore' and not(snapshot->>'canRestore')::boolean then
  raise exception 'Complete private images are required for restoration' using errcode='22023',detail='community_moderation_incomplete'; end if;
 next_status:=case p_action when 'hide' then 'hidden' when 'lock' then 'locked' else 'visible' end;
 perform dm_private.apply_community_moderation(p_target_type,p_target_id,p_action,trim(p_note));
 result:=jsonb_build_object('requestId',p_request_id,'targetType',p_target_type,'targetId',p_target_id,'action',p_action,
  'previousStatus',previous_status,'status',next_status,'createdAt',clock_timestamp());
 insert into dm_private.community_moderation_actions(actor_id,request_id,fingerprint,target_type,target_id,action,note,review_version,inspected_snapshot,receipt)
 values(actor,p_request_id,fingerprint,p_target_type,p_target_id,p_action,trim(p_note),p_expected_version,snapshot-'_groups',result);
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_moderation_unavailable'; end if;
 return result||jsonb_build_object('replayed',false);
end $$;

-- The former direct API must not bypass the inspected-version and receipt path.
create or replace function public.admin_moderate_community(p_target_type text,p_target_id uuid,p_action text,p_note text default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_moderation_unavailable'; end if;
 raise exception 'Open the content review before moderating' using errcode='22023',detail='community_moderation_required';
end $$;

-- Report resolution remains independent of general moderation. Its existing
-- inspected-report audit and missing-image containment rules are preserved.
create or replace function public.admin_resolve_community_report(p_report_id uuid,p_expected_version text,p_resolution text,p_note text)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private,public,storage as $$
declare snapshot jsonb; groups jsonb; target_id uuid; kind text;
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_review_unavailable'; end if;
 if p_expected_version is null or p_expected_version !~ '^[0-9a-f]{64}$' or p_resolution is null or p_resolution not in('hide','dismiss')
  or p_note is null or char_length(trim(p_note)) not between 8 and 1000 then
  raise exception 'A current review and written reason are required' using errcode='22023',detail='community_review_invalid'; end if;
 perform 1 from auth.users where id=auth.uid() for key share;
 if not found then raise exception 'Admin access required' using errcode='42501',detail='community_review_unavailable'; end if;
 perform dm_private.lock_community_report(p_report_id,true);
 snapshot:=dm_private.community_report_snapshot(p_report_id);groups:=snapshot->'_groups';
 perform 1 from storage.objects o where o.bucket_id='community-media' and o.name in(
  select a->>'path' from jsonb_each(groups)g cross join lateral jsonb_array_elements(g.value)a
 ) order by o.id for share;
 snapshot:=dm_private.community_report_snapshot(p_report_id);
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_review_unavailable'; end if;
 if snapshot->>'reviewVersion'<>p_expected_version then raise exception 'Community review changed' using errcode='40001',detail='community_review_changed'; end if;
 if snapshot->>'status'<>'open' then raise exception 'Community report unavailable' using errcode='42501',detail='community_review_unavailable'; end if;
 if p_resolution='dismiss' and not(snapshot->>'canDismiss')::boolean then
  raise exception 'Inspect all registered images before dismissing' using errcode='22023',detail='community_review_incomplete'; end if;
 kind:=snapshot->>'targetType';target_id:=(snapshot->>'targetId')::uuid;
 if p_resolution='hide' then perform dm_private.apply_community_moderation(kind,target_id,'hide',trim(p_note)); end if;
 update dm_private.community_reports set status='resolved',resolved_at=clock_timestamp(),resolved_by=auth.uid(),resolution=p_resolution where id=p_report_id;
 insert into dm_private.community_report_reviews(report_id,actor_id,resolution,note,review_version,inspected_snapshot)
 values(p_report_id,auth.uid(),p_resolution,trim(p_note),p_expected_version,snapshot-'_groups');
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_review_unavailable'; end if;
end $$;

create function public.admin_community_content_page(p_target_type text,p_post_id uuid,p_exam text,p_topic text,p_status text,p_cursor jsonb,p_limit integer)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,dm_private,public set timezone='UTC' as $$
declare v_exam text:=nullif(lower(trim(p_exam)),''); v_topic text:=nullif(trim(p_topic),''); v_status text:=nullif(trim(p_status),'');
 filters jsonb; v_revision bigint; v_version numeric; v_snapshot timestamptz; v_created timestamptz; v_id uuid; v_now timestamptz;
 post dm_private.community_posts; items jsonb; more boolean; last_item jsonb; next_cursor jsonb:=null;
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_moderation_unavailable'; end if;
 if p_target_type is null or p_target_type not in('post','comment') or p_limit is null or p_limit not between 1 and 25
  or(v_exam is not null and v_exam not in('uceed','nid','nift','ceed'))or char_length(v_topic)>100
  or(v_status is not null and v_status not in('visible','hidden','locked'))
  or(p_target_type='post' and p_post_id is not null)
  or(p_target_type='comment' and(p_post_id is null or v_exam is not null or v_topic is not null or v_status='locked')) then
  raise exception 'Invalid moderation filters or page size' using errcode='22023',detail='community_moderation_invalid'; end if;
 filters:=jsonb_build_object('targetType',p_target_type,'postId',p_post_id,'exam',v_exam,'topic',v_topic,'status',v_status);
 if p_cursor is not null then
  if jsonb_typeof(p_cursor)<>'object' then raise exception 'Invalid moderation cursor' using errcode='22023',detail='community_moderation_invalid'; end if;
  if octet_length(p_cursor::text)>2048 or(select count(*) from jsonb_object_keys(p_cursor))<>9
   or not(p_cursor ?& array['createdAt','id','snapshotAt','version','targetType','postId','exam','topic','status'])
   or jsonb_typeof(p_cursor->'createdAt')<>'string' or jsonb_typeof(p_cursor->'id')<>'string' or jsonb_typeof(p_cursor->'snapshotAt')<>'string'
   or jsonb_typeof(p_cursor->'version')<>'number' or char_length(p_cursor->>'id')<>36
   or char_length(p_cursor->>'createdAt') not between 20 and 40 or char_length(p_cursor->>'snapshotAt') not between 20 and 40
   or(p_cursor-array['createdAt','id','snapshotAt','version']) is distinct from filters then
   raise exception 'Invalid moderation cursor' using errcode='22023',detail='community_moderation_invalid'; end if;
  begin
   if(p_cursor->>'createdAt')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
    or(p_cursor->>'snapshotAt')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Invalid timestamp'; end if;
   v_created:=(p_cursor->>'createdAt')::timestamptz;v_snapshot:=(p_cursor->>'snapshotAt')::timestamptz;
   v_id:=(p_cursor->>'id')::uuid;v_version:=(p_cursor->>'version')::numeric;
   if not isfinite(v_created) or not isfinite(v_snapshot) or v_created>v_snapshot or v_version<>trunc(v_version) or v_version not between 1 and 9007199254740991 then raise exception 'Invalid cursor'; end if;
  exception when others then raise exception 'Invalid moderation cursor' using errcode='22023',detail='community_moderation_invalid'; end;
 end if;
 if p_target_type='post' then
  -- Drain creators without taking post locks in the reverse of moderation order.
  select revision into v_revision from dm_private.community_feed_state where singleton for share;
 else
  select * into post from dm_private.community_posts where id=p_post_id for share;
  if not found then raise exception 'Community content unavailable' using errcode='42501',detail='community_moderation_unavailable'; end if;
  v_revision:=post.thread_revision;
 end if;
 if v_revision is null or v_revision not between 1 and 9007199254740991 then raise exception 'Community content unavailable' using errcode='55000',detail='community_moderation_unavailable'; end if;
 v_now:=clock_timestamp();
 if p_cursor is null then v_snapshot:=v_now;
 elsif v_snapshot>v_now then raise exception 'Invalid moderation cursor' using errcode='22023',detail='community_moderation_invalid';
 elsif v_version<>v_revision then raise exception 'Community content changed' using errcode='40001',detail='community_moderation_changed'; end if;
 if p_target_type='post' then
  with candidates as materialized(
   select p.* from dm_private.community_posts p where p.created_at<=v_snapshot and(v_exam is null or p.exam=v_exam)and(v_topic is null or p.topic=v_topic)
    and(v_status is null or p.status=v_status)and(p_cursor is null or(p.created_at,p.id)<(v_created,v_id))order by p.created_at desc,p.id desc limit p_limit+1
  ),page as materialized(select * from candidates order by created_at desc,id desc limit p_limit)
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'kind','post','postId',p.id,'parentId',null,'exam',p.exam,'topic',p.topic,'title',p.title,'body',p.body,'status',p.status,'createdAt',p.created_at,
   'assetCount',(select count(*)from dm_private.community_assets a where a.post_id=p.id),'comments',(select count(*)from dm_private.community_comments c where c.post_id=p.id))order by p.created_at desc,p.id desc),'[]'),
   (select count(*)>p_limit from candidates) into items,more from page p;
 else
  with candidates as materialized(
   select c.* from dm_private.community_comments c where c.post_id=p_post_id and c.created_at<=v_snapshot and(v_status is null or c.status=v_status)
    and(p_cursor is null or(c.created_at,c.id)<(v_created,v_id))order by c.created_at desc,c.id desc limit p_limit+1
  ),page as materialized(select * from candidates order by created_at desc,id desc limit p_limit)
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'kind','comment','postId',c.post_id,'parentId',c.parent_id,'exam',post.exam,'topic',post.topic,'title',null,'body',c.body,'status',c.status,'createdAt',c.created_at,
   'assetCount',(select count(*)from dm_private.community_assets a where a.comment_id=c.id),'comments',null)order by c.created_at desc,c.id desc),'[]'),
   (select count(*)>p_limit from candidates) into items,more from page c;
 end if;
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_moderation_unavailable'; end if;
 if more then last_item:=items->-1;next_cursor:=filters||jsonb_build_object('createdAt',last_item->'createdAt','id',last_item->'id','snapshotAt',v_snapshot,'version',v_revision); end if;
 return jsonb_build_object('items',items,'nextCursor',next_cursor,'snapshotAt',v_snapshot,'version',v_revision,'filters',filters);
end $$;

revoke all on function public.admin_review_community_content(text,uuid),public.admin_community_moderation_media_paths(text,uuid,text,text),
 public.admin_moderate_community(text,uuid,text,text,text,uuid),public.admin_community_content_page(text,uuid,text,text,text,jsonb,integer) from public,anon,service_role;
grant execute on function public.admin_review_community_content(text,uuid),public.admin_community_moderation_media_paths(text,uuid,text,text),
 public.admin_moderate_community(text,uuid,text,text,text,uuid),public.admin_community_content_page(text,uuid,text,text,text,jsonb,integer) to authenticated;

commit;
