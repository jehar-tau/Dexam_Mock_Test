begin;

create table dm_private.community_report_reviews(
 id bigint generated always as identity primary key,
 report_id uuid not null unique references dm_private.community_reports(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 resolution text not null check(resolution in('hide','dismiss')),
 note text not null check(char_length(trim(note)) between 8 and 1000),
 review_version text not null check(review_version ~ '^[0-9a-f]{64}$'),
 inspected_snapshot jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table dm_private.community_report_reviews enable row level security;
revoke all on dm_private.community_report_reviews from public,anon,authenticated,service_role;
create index community_moderation_target_idx on dm_private.community_moderation_log(target_type,target_id,id desc);

-- All API mutations use the established post-first order. Readers take a shared
-- fence; decisions take an exclusive fence before re-reading the report.
create function dm_private.lock_community_report(p_report_id uuid,p_write boolean)
returns void language plpgsql set search_path=pg_catalog,dm_private as $$
declare initial dm_private.community_reports; current_report dm_private.community_reports; parent_post_id uuid;
begin
 select * into initial from dm_private.community_reports where id=p_report_id;
 if not found then raise exception 'Community report unavailable' using errcode='42501',detail='community_review_unavailable'; end if;
 parent_post_id:=coalesce(initial.post_id,(select c.post_id from dm_private.community_comments c where c.id=initial.comment_id));
 if p_write then
  perform 1 from dm_private.community_posts p where p.id=parent_post_id for update;
 else
  perform 1 from dm_private.community_posts p where p.id=parent_post_id for share;
 end if;
 if not found then raise exception 'Community report unavailable' using errcode='42501',detail='community_review_unavailable'; end if;
 if p_write then
  perform 1 from dm_private.community_comments c where c.post_id=parent_post_id and
   (c.id=initial.comment_id or c.id=(select t.parent_id from dm_private.community_comments t where t.id=initial.comment_id)) order by c.id for update;
  select * into current_report from dm_private.community_reports where id=p_report_id for update;
 else
  perform 1 from dm_private.community_comments c where c.post_id=parent_post_id and
   (c.id=initial.comment_id or c.id=(select t.parent_id from dm_private.community_comments t where t.id=initial.comment_id)) order by c.id for share;
  select * into current_report from dm_private.community_reports where id=p_report_id for share;
 end if;
 if not found then raise exception 'Community report unavailable' using errcode='42501',detail='community_review_unavailable'; end if;
 if row(current_report.post_id,current_report.comment_id) is distinct from row(initial.post_id,initial.comment_id) then
  raise exception 'Community review changed' using errcode='40001',detail='community_review_changed';
 end if;
end $$;

create function dm_private.community_review_assets(p_kind text,p_target_id uuid)
returns jsonb language sql set search_path=pg_catalog,dm_private,storage as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'ordinal',a.ordinal,'path',a.storage_path,
  'mimeType',a.mime_type,'width',a.pixel_width,'height',a.pixel_height,'orientation',a.image_orientation,
  'sha256',a.image_sha256,'byteSize',a.byte_size,
  'object',case when o.id is not null then jsonb_build_object('id',o.id,'version',to_jsonb(o)->'version','metadata',o.metadata) end,
  'available',coalesce(o.id is not null and o.metadata->>'mimetype'=a.mime_type and
   case when o.metadata->>'size' ~ '^[0-9]{1,12}$' then (o.metadata->>'size')::numeric=a.byte_size else false end,false))
  order by a.ordinal,a.id),'[]')
 from dm_private.community_assets a left join storage.objects o on o.bucket_id='community-media' and o.name=a.storage_path
 where (p_kind='post' and a.post_id=p_target_id) or (p_kind='comment' and a.comment_id=p_target_id)
$$;

create function dm_private.community_review_content(p_kind text,p_row jsonb,p_post jsonb,p_assets jsonb)
returns jsonb language sql set search_path=pg_catalog as $$
 select case when p_row is not null then jsonb_build_object('id',p_row->'id','kind',p_kind,
  'title',case when p_kind='post' then p_row->'title' else 'null'::jsonb end,'body',p_row->'body','status',p_row->'status',
  'exam',p_post->'exam','topic',p_post->'topic','assets',coalesce((select jsonb_agg(item-array['path','sha256','byteSize','object'] order by (item->>'ordinal')::integer,item->>'id') from jsonb_array_elements(p_assets)item),'[]')) end
$$;

-- Deliberately volatile: after waiting for the post fence, use fresh state.
-- Asset INSERTs and object replacement/availability participate in this digest;
-- unrelated new replies and helpful votes do not change the inspected context.
create function dm_private.community_report_snapshot(p_report_id uuid)
returns jsonb language plpgsql set search_path=pg_catalog,dm_private set timezone='UTC' as $$
declare r dm_private.community_reports; p dm_private.community_posts; c dm_private.community_comments; parent dm_private.community_comments;
 post_json jsonb; post_assets jsonb; target_json jsonb; parent_json jsonb; groups jsonb; evidence jsonb; history jsonb; revision text; moderation_id bigint;
begin
 select * into r from dm_private.community_reports where id=p_report_id;
 if not found then raise exception 'Community report unavailable' using errcode='42501',detail='community_review_unavailable'; end if;
 if r.comment_id is not null then select * into c from dm_private.community_comments where id=r.comment_id; end if;
 select * into p from dm_private.community_posts where id=coalesce(r.post_id,c.post_id);
 if not found then raise exception 'Community report unavailable' using errcode='42501',detail='community_review_unavailable'; end if;
 if c.parent_id is not null then select * into parent from dm_private.community_comments where id=c.parent_id and post_id=p.id; end if;
 post_json:=to_jsonb(p)-'thread_revision';
 target_json:=case when r.post_id is not null then post_json else to_jsonb(c)-'helpful_count' end;
 parent_json:=case when parent.id is not null then to_jsonb(parent)-'helpful_count' end;
 post_assets:=dm_private.community_review_assets('post',p.id);
 groups:=jsonb_build_object('post',post_assets,
  'target',case when r.post_id is not null then post_assets else dm_private.community_review_assets('comment',r.comment_id) end,
  'parent',case when parent.id is not null then dm_private.community_review_assets('comment',parent.id) else '[]'::jsonb end);
 select coalesce(max(m.id),0) into moderation_id from dm_private.community_moderation_log m
  where (m.target_type='post' and m.target_id=p.id) or (m.target_type='comment' and m.target_id in(c.id,parent.id));
 evidence:=jsonb_build_object('report',to_jsonb(r),'post',post_json,'target',target_json,'parent',parent_json,'assets',groups,'moderation',moderation_id);
 revision:=encode(sha256(convert_to(evidence::text,'UTF8')),'hex');
 select coalesce(jsonb_agg(item order by happened desc,sort_id desc),'[]') into history from(
  select jsonb_build_object('id','moderation:'||m.id,'source','moderation','action',m.action,'note',m.note,'createdAt',m.created_at) item,m.created_at happened,m.id sort_id
   from dm_private.community_moderation_log m where (m.target_type='post' and m.target_id=p.id) or (m.target_type='comment' and m.target_id in(c.id,parent.id))
  union all
  select jsonb_build_object('id','review:'||v.id,'source','report','action',v.resolution,'note',v.note,'createdAt',v.created_at),v.created_at,v.id from dm_private.community_report_reviews v where v.report_id=r.id
  order by happened desc,sort_id desc limit 25
 ) events;
 return jsonb_build_object('id',r.id,'targetType',case when r.post_id is null then 'comment' else 'post' end,'targetId',coalesce(r.post_id,r.comment_id),
  'reason',r.reason,'details',r.details,'createdAt',r.created_at,'status',r.status,'resolution',r.resolution,'reviewVersion',revision,
  'canDismiss',r.status='open' and not exists(select 1 from jsonb_each(groups) g cross join lateral jsonb_array_elements(g.value) a where not(a->>'available')::boolean),
  'post',dm_private.community_review_content('post',post_json,post_json,groups->'post'),
  'target',dm_private.community_review_content(case when r.post_id is null then 'comment' else 'post' end,target_json,post_json,groups->'target'),
  'parent',dm_private.community_review_content('comment',parent_json,post_json,groups->'parent'),'history',history,'_groups',groups);
end $$;
revoke all on function dm_private.lock_community_report(uuid,boolean),dm_private.community_review_assets(text,uuid),
 dm_private.community_review_content(text,jsonb,jsonb,jsonb),dm_private.community_report_snapshot(uuid) from public,anon,authenticated,service_role;

create function public.admin_community_report(p_report_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare snapshot jsonb;
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_review_unavailable'; end if;
 perform dm_private.lock_community_report(p_report_id,false);
 snapshot:=dm_private.community_report_snapshot(p_report_id);
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_review_unavailable'; end if;
 return snapshot-'_groups';
end $$;

create function public.admin_community_report_media_paths(p_report_id uuid,p_expected_version text,p_context text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare snapshot jsonb; assets jsonb;
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_review_unavailable'; end if;
 if p_expected_version is null or p_expected_version !~ '^[0-9a-f]{64}$' or p_context is null or p_context not in('target','post','parent') then
  raise exception 'Invalid community review request' using errcode='22023',detail='community_review_invalid';
 end if;
 perform dm_private.lock_community_report(p_report_id,false);
 snapshot:=dm_private.community_report_snapshot(p_report_id);
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_review_unavailable'; end if;
 if snapshot->>'reviewVersion'<>p_expected_version then raise exception 'Community review changed' using errcode='40001',detail='community_review_changed'; end if;
 if snapshot->>'status'<>'open' then raise exception 'Community report unavailable' using errcode='42501',detail='community_review_unavailable'; end if;
 assets:=snapshot->'_groups'->p_context;
 if exists(select 1 from jsonb_array_elements(assets) a where not(a->>'available')::boolean) then
  raise exception 'A registered community image is unavailable' using errcode='22023',detail='community_review_incomplete';
 end if;
 return coalesce((select jsonb_agg(a-array['sha256','byteSize','object','available'] order by (a->>'ordinal')::integer,a->>'id') from jsonb_array_elements(assets)a),'[]');
end $$;

-- Old browser clients cannot bypass inspected-version checking.
create or replace function public.admin_resolve_community_report(p_report_id uuid,p_resolution text,p_note text default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_review_unavailable'; end if;
 raise exception 'Open the report review before resolving it' using errcode='22023',detail='community_review_required';
end $$;

create function public.admin_resolve_community_report(p_report_id uuid,p_expected_version text,p_resolution text,p_note text)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private,public,storage as $$
declare snapshot jsonb; groups jsonb; target_id uuid; kind text;
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_review_unavailable'; end if;
 if p_expected_version is null or p_expected_version !~ '^[0-9a-f]{64}$' or p_resolution is null or p_resolution not in('hide','dismiss')
  or p_note is null or char_length(trim(p_note)) not between 8 and 1000 then
  raise exception 'A current review and written reason are required' using errcode='22023',detail='community_review_invalid';
 end if;
 perform dm_private.lock_community_report(p_report_id,true);
 snapshot:=dm_private.community_report_snapshot(p_report_id);groups:=snapshot->'_groups';
 -- Hold existing registered objects through the decision, in the same order.
 perform 1 from storage.objects o where o.bucket_id='community-media' and o.name in(
  select a->>'path' from jsonb_each(groups) g cross join lateral jsonb_array_elements(g.value)a
 ) order by o.id for share;
 snapshot:=dm_private.community_report_snapshot(p_report_id);
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501',detail='community_review_unavailable'; end if;
 if snapshot->>'reviewVersion'<>p_expected_version then raise exception 'Community review changed' using errcode='40001',detail='community_review_changed'; end if;
 if snapshot->>'status'<>'open' then raise exception 'Community report unavailable' using errcode='42501',detail='community_review_unavailable'; end if;
 if p_resolution='dismiss' and not(snapshot->>'canDismiss')::boolean then
  raise exception 'Inspect all registered images before dismissing' using errcode='22023',detail='community_review_incomplete';
 end if;
 kind:=snapshot->>'targetType';target_id:=(snapshot->>'targetId')::uuid;
 if p_resolution='hide' then perform public.admin_moderate_community(kind,target_id,'hide',trim(p_note)); end if;
 update dm_private.community_reports set status='resolved',resolved_at=clock_timestamp(),resolved_by=auth.uid(),resolution=p_resolution where id=p_report_id;
 insert into dm_private.community_report_reviews(report_id,actor_id,resolution,note,review_version,inspected_snapshot)
 values(p_report_id,auth.uid(),p_resolution,trim(p_note),p_expected_version,snapshot-'_groups');
end $$;
revoke all on function public.admin_community_report(uuid),public.admin_community_report_media_paths(uuid,text,text),
 public.admin_resolve_community_report(uuid,text,text,text) from public,anon;
grant execute on function public.admin_community_report(uuid),public.admin_community_report_media_paths(uuid,text,text),
 public.admin_resolve_community_report(uuid,text,text,text) to authenticated;

commit;
