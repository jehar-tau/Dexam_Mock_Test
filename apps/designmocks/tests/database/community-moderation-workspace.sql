\set ON_ERROR_STOP on
begin;
create function pg_temp.mod_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
create function pg_temp.mod_reject(statement text,expected_state text,expected_detail text default null) returns void language plpgsql as $$
declare actual_state text;actual_detail text;
begin
 begin execute statement;
 exception when others then
  get stacked diagnostics actual_state=returned_sqlstate,actual_detail=pg_exception_detail;
  if actual_state=expected_state and(expected_detail is null or actual_detail=expected_detail)then return;end if;
  raise exception 'FAIL: expected % / %, received % / %',expected_state,expected_detail,actual_state,actual_detail;
 end;
 raise exception 'FAIL: unexpectedly allowed request';
end $$;
create function pg_temp.mod_now(kind text,id uuid,action text,note text default 'A complete fictional human moderation reason.') returns jsonb language sql as $$
 select public.admin_moderate_community(kind,id,action,note,public.admin_review_community_content(kind,id)->>'reviewVersion',gen_random_uuid())
$$;
insert into auth.users(id)values('00000000-0000-4000-8000-000000000951'),('00000000-0000-4000-8000-000000000952'),
 ('00000000-0000-4000-8000-000000000953'),('00000000-0000-4000-8000-000000000954'),('00000000-0000-4000-8000-000000000955');
insert into dm_private.admins(user_id)values('00000000-0000-4000-8000-000000000953'),('00000000-0000-4000-8000-000000000954');
insert into dm_private.drawing_reviewers(user_id,enabled,changed_at)values('00000000-0000-4000-8000-000000000955',true,now());
insert into dm_private.community_posts(id,author_id,exam,topic,title,body)values
 ('10000000-0000-4000-8000-000000000951','00000000-0000-4000-8000-000000000951','uceed','observation','Original fictional moderation discussion','A complete original fictional discussion for moderation acceptance.');
insert into dm_private.community_posts(id,author_id,exam,topic,title,body,status,created_at)
 select md5('moderation-post-'||g)::uuid,'00000000-0000-4000-8000-000000000951','uceed','paging','Original fictional paging discussion '||g,
 'A complete original fictional paging discussion for bounded browsing.',case when g%3=0 then 'hidden' when g%3=1 then 'locked' else 'visible' end,
 '2026-01-01T12:00:00.123456Z'::timestamptz+(g%3)*interval '1 microsecond' from generate_series(1,58)g;
insert into dm_private.community_comments(id,post_id,parent_id,author_id,body,status,created_at)values
 ('20000000-0000-4000-8000-000000000950','10000000-0000-4000-8000-000000000951',null,'00000000-0000-4000-8000-000000000952','Original fictional immediate parent.','hidden','2026-01-01T12:00:00.123456Z'),
 ('20000000-0000-4000-8000-000000000951','10000000-0000-4000-8000-000000000951','20000000-0000-4000-8000-000000000950','00000000-0000-4000-8000-000000000951','Original fictional selected reply.','visible','2026-01-01T12:00:00.123456Z');
insert into dm_private.community_comments(id,post_id,author_id,body,status,created_at)
 select md5('moderation-comment-'||g)::uuid,'10000000-0000-4000-8000-000000000951','00000000-0000-4000-8000-000000000952',
 'Original fictional paging reply '||g,case when g%3=0 then 'hidden' else 'visible' end,
 '2026-01-01T12:00:00.123456Z'::timestamptz+(g%3)*interval '1 microsecond' from generate_series(1,60)g;
insert into dm_private.community_assets(id,uploader_id,post_id,comment_id,storage_path,ordinal,mime_type,byte_size,pixel_width,pixel_height,image_orientation,image_sha256)values
 ('40000000-0000-4000-8000-000000000951','00000000-0000-4000-8000-000000000951','10000000-0000-4000-8000-000000000951',null,'community/moderation-post.png',1,'image/png',101,10,12,1,repeat('a',64)),
 ('40000000-0000-4000-8000-000000000950','00000000-0000-4000-8000-000000000952',null,'20000000-0000-4000-8000-000000000950','community/moderation-parent.jpg',1,'image/jpeg',102,null,null,null,null),
 ('40000000-0000-4000-8000-000000000952','00000000-0000-4000-8000-000000000951',null,'20000000-0000-4000-8000-000000000951','community/moderation-reply.webp',1,'image/webp',103,12,10,6,repeat('b',64));
insert into storage.objects(bucket_id,name,metadata)select 'community-media',storage_path,jsonb_build_object('mimetype',mime_type,'size',byte_size,'eTag','original')from dm_private.community_assets;
insert into dm_private.community_reports(id,reporter_id,post_id,reason,details)values
 ('30000000-0000-4000-8000-000000000951','00000000-0000-4000-8000-000000000952','10000000-0000-4000-8000-000000000951','other','A fictional independent open report.');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000951',true);
select pg_temp.mod_reject('select public.admin_community_content_page(''post'',null,null,null,null,null,25)','42501','community_moderation_unavailable');
select pg_temp.mod_reject('select public.admin_review_community_content(''post'',''10000000-0000-4000-8000-000000000951'')','42501','community_moderation_unavailable');
select pg_temp.mod_reject('select public.admin_community_moderation_media_paths(''post'',''10000000-0000-4000-8000-000000000951'',repeat(''a'',64),''target'')','42501','community_moderation_unavailable');
select pg_temp.mod_reject('select public.admin_moderate_community(''post'',''10000000-0000-4000-8000-000000000951'',''hide'',''A fictional reason'',repeat(''a'',64),gen_random_uuid())','42501','community_moderation_unavailable');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000955',true);
select pg_temp.mod_reject('select public.admin_review_community_content(''comment'',''20000000-0000-4000-8000-000000000951'')','42501','community_moderation_unavailable');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000953',true);
select pg_temp.mod_reject('select public.admin_moderate_community(''post'',''10000000-0000-4000-8000-000000000951'',''hide'',''Old direct API bypass'')','22023','community_moderation_required');
select pg_temp.mod_reject('select * from dm_private.community_moderation_actions','42501');
select pg_temp.mod_reject('select dm_private.community_moderation_snapshot(''post'',''10000000-0000-4000-8000-000000000951'')','42501');
select pg_temp.mod_reject('select dm_private.apply_community_moderation(''post'',''10000000-0000-4000-8000-000000000951'',''hide'',''Private helper bypass'')','42501');

-- Bounded pages include hidden content, exact filters and raw microseconds.
select set_config('test.mod_page1',public.admin_community_content_page('post',null,'UCEED',' paging ',null,null,25)::text,true);
select pg_temp.mod_assert(jsonb_array_length(current_setting('test.mod_page1')::jsonb->'items')=25,'first moderation page is bounded');
select pg_temp.mod_assert((current_setting('test.mod_page1')::jsonb->'nextCursor'->>'createdAt')like '%.12345%','cursor preserves raw microseconds');
select pg_temp.mod_assert(current_setting('test.mod_page1')::jsonb->'filters'->>'exam'='uceed'and current_setting('test.mod_page1')::jsonb->'filters'->>'topic'='paging','filters use exact normalized context');
select pg_temp.mod_assert(not(current_setting('test.mod_page1')::jsonb->'items'->0?'author_id')and not(current_setting('test.mod_page1')::jsonb->'items'->0?'assets'),'summaries do not expose account bindings or private images');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000951',true);
select set_config('test.mod_late_post',public.create_community_post('uceed','paging','A later fictional paging discussion','A later original fictional discussion stays outside this existing snapshot.')::text,true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000953',true);
select set_config('test.mod_page2',public.admin_community_content_page('post',null,'uceed','paging',null,current_setting('test.mod_page1')::jsonb->'nextCursor',25)::text,true);
select set_config('test.mod_page3',public.admin_community_content_page('post',null,'uceed','paging',null,current_setting('test.mod_page2')::jsonb->'nextCursor',25)::text,true);
select pg_temp.mod_assert(jsonb_array_length(current_setting('test.mod_page2')::jsonb->'items')=25 and jsonb_array_length(current_setting('test.mod_page3')::jsonb->'items')=8 and current_setting('test.mod_page3')::jsonb->'nextCursor'='null','all 58 discussions can be traversed without an unbounded response');
select pg_temp.mod_assert((select count(distinct item->>'id')=58 and bool_and(item->>'id'<>current_setting('test.mod_late_post'))from jsonb_array_elements((current_setting('test.mod_page1')::jsonb->'items')||(current_setting('test.mod_page2')::jsonb->'items')||(current_setting('test.mod_page3')::jsonb->'items'))item),'UUID tie breaks and snapshot exclude new posts');
select pg_temp.mod_assert((select bool_and(item->>'status'='hidden')from jsonb_array_elements(public.admin_community_content_page('post',null,'uceed','paging','hidden',null,25)->'items')item),'hidden filter returns hidden discussions');
select pg_temp.mod_reject('select public.admin_community_content_page(''post'',null,''ceed'',''paging'',null,current_setting(''test.mod_page1'')::jsonb->''nextCursor'',25)','22023','community_moderation_invalid');
select pg_temp.mod_reject('select public.admin_community_content_page(''post'',null,null,null,null,null,26)','22023','community_moderation_invalid');
select pg_temp.mod_reject('select public.admin_community_content_page(''post'',null,null,null,null,null,null)','22023','community_moderation_invalid');
select pg_temp.mod_reject('select public.admin_community_content_page(''comment'',null,null,null,null,null,25)','22023','community_moderation_invalid');
select pg_temp.mod_reject('select public.admin_community_content_page(''post'',null,''uceed'',''paging'',null,(current_setting(''test.mod_page1'')::jsonb->''nextCursor'')||''{"extra":true}'',25)','22023','community_moderation_invalid');
select pg_temp.mod_reject('select public.admin_community_content_page(''post'',null,''uceed'',''paging'',null,jsonb_set(current_setting(''test.mod_page1'')::jsonb->''nextCursor'',''{version}'',''1.5''),25)','22023','community_moderation_invalid');
select pg_temp.mod_reject('select public.admin_community_content_page(''post'',null,''uceed'',''paging'',null,jsonb_set(current_setting(''test.mod_page1'')::jsonb->''nextCursor'',''{snapshotAt}'',''"infinity"''),25)','22023','community_moderation_invalid');

select set_config('test.mod_replies1',public.admin_community_content_page('comment','10000000-0000-4000-8000-000000000951',null,null,null,null,25)::text,true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000951',true);
select set_config('test.mod_late_reply',public.add_community_comment('10000000-0000-4000-8000-000000000951',null,'A later original fictional reply.')::text,true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000953',true);
select set_config('test.mod_replies2',public.admin_community_content_page('comment','10000000-0000-4000-8000-000000000951',null,null,null,current_setting('test.mod_replies1')::jsonb->'nextCursor',25)::text,true);
select set_config('test.mod_replies3',public.admin_community_content_page('comment','10000000-0000-4000-8000-000000000951',null,null,null,current_setting('test.mod_replies2')::jsonb->'nextCursor',25)::text,true);
select pg_temp.mod_assert((select count(distinct item->>'id')=62 and bool_and(item->>'id'<>current_setting('test.mod_late_reply'))from jsonb_array_elements((current_setting('test.mod_replies1')::jsonb->'items')||(current_setting('test.mod_replies2')::jsonb->'items')||(current_setting('test.mod_replies3')::jsonb->'items'))item),'reply browse includes hidden replies with bounded immutable pages');
select pg_temp.mod_reject('select public.admin_community_content_page(''comment'',''10000000-0000-4000-8000-000000000951'',''uceed'',null,null,null,25)','22023','community_moderation_invalid');
select pg_temp.mod_reject('select public.admin_community_content_page(''comment'',''10000000-0000-4000-8000-000000000951'',null,null,''locked'',null,25)','22023','community_moderation_invalid');

-- Review all current context, with neither paths nor private account bindings.
select set_config('test.mod_view',public.admin_review_community_content('comment','20000000-0000-4000-8000-000000000951')::text,true);
select pg_temp.mod_assert(current_setting('test.mod_view')::jsonb->'parent'->>'status'='hidden' and current_setting('test.mod_view')::jsonb->'parent'->>'body'='Original fictional immediate parent.','hidden immediate parent is present for human inspection');
select pg_temp.mod_assert(not(current_setting('test.mod_view')::jsonb?'_groups')and position('community/moderation-' in current_setting('test.mod_view'))=0 and position('author_id' in current_setting('test.mod_view'))=0,'review DTO strips storage paths and account bindings');
select pg_temp.mod_assert(public.admin_community_moderation_media_paths('comment','20000000-0000-4000-8000-000000000951',current_setting('test.mod_view')::jsonb->>'reviewVersion','parent')->0->'orientation'='null','legacy metadata is preserved for private parent signing');
set local timezone='Asia/Kolkata';
select pg_temp.mod_assert(public.admin_review_community_content('comment','20000000-0000-4000-8000-000000000951')->>'reviewVersion'=current_setting('test.mod_view')::jsonb->>'reviewVersion','review digest is UTC stable');
set local timezone='UTC';

select set_config('test.mod_post_view',public.admin_review_community_content('post','10000000-0000-4000-8000-000000000951')::text,true);
select set_config('test.mod_report_view',public.admin_community_report('30000000-0000-4000-8000-000000000951')::text,true);
select set_config('test.mod_locked',public.admin_moderate_community('post','10000000-0000-4000-8000-000000000951','lock','  Lock the original fictional discussion.  ',current_setting('test.mod_post_view')::jsonb->>'reviewVersion','50000000-0000-4000-8000-000000000951')::text,true);
select pg_temp.mod_assert(current_setting('test.mod_locked')::jsonb->>'previousStatus'='visible' and current_setting('test.mod_locked')::jsonb->>'status'='locked' and not(current_setting('test.mod_locked')::jsonb->>'replayed')::boolean,'action returns an exact committed status receipt');
select pg_temp.mod_assert(public.admin_community_report('30000000-0000-4000-8000-000000000951')->>'status'='open','general moderation does not resolve reports');
select pg_temp.mod_reject('select public.admin_resolve_community_report(''30000000-0000-4000-8000-000000000951'',current_setting(''test.mod_report_view'')::jsonb->>''reviewVersion'',''dismiss'',''Original fictional report reason.'')','40001','community_review_changed');
select pg_temp.mod_reject('select public.admin_community_content_page(''post'',null,''uceed'',''paging'',null,current_setting(''test.mod_page1'')::jsonb->''nextCursor'',25)','40001','community_moderation_changed');
select pg_temp.mod_reject('select public.admin_community_content_page(''comment'',''10000000-0000-4000-8000-000000000951'',null,null,null,current_setting(''test.mod_replies1'')::jsonb->''nextCursor'',25)','40001','community_moderation_changed');
select pg_temp.mod_reject('select pg_temp.mod_now(''post'',''10000000-0000-4000-8000-000000000951'',''lock'')','40001','community_moderation_changed');
select pg_temp.mod_reject('select pg_temp.mod_now(''post'',''10000000-0000-4000-8000-000000000951'',''restore'')','40001','community_moderation_changed');
select pg_temp.mod_reject('select pg_temp.mod_now(''comment'',''20000000-0000-4000-8000-000000000951'',''lock'')','22023','community_moderation_invalid');
select pg_temp.mod_reject('select public.admin_moderate_community(''post'',''10000000-0000-4000-8000-000000000951'',''lock'',''Different fictional reason'',current_setting(''test.mod_post_view'')::jsonb->>''reviewVersion'',''50000000-0000-4000-8000-000000000951'')','22023','community_moderation_conflict');
select pg_temp.mod_now('post','10000000-0000-4000-8000-000000000951','unlock');
select set_config('test.mod_replayed',public.admin_moderate_community('post','10000000-0000-4000-8000-000000000951','lock','Lock the original fictional discussion.',current_setting('test.mod_post_view')::jsonb->>'reviewVersion','50000000-0000-4000-8000-000000000951')::text,true);
select pg_temp.mod_assert((current_setting('test.mod_replayed')::jsonb-'replayed')=(current_setting('test.mod_locked')::jsonb-'replayed')and(current_setting('test.mod_replayed')::jsonb->>'replayed')::boolean,'lost acknowledgement replays the immutable receipt');
select pg_temp.mod_assert(public.admin_review_community_content('post','10000000-0000-4000-8000-000000000951')->'target'->>'status'='visible','old receipt never reapplies a superseded action');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000954',true);
select pg_temp.mod_reject('select public.admin_moderate_community(''post'',''10000000-0000-4000-8000-000000000951'',''lock'',''Lock the original fictional discussion.'',current_setting(''test.mod_post_view'')::jsonb->>''reviewVersion'',''50000000-0000-4000-8000-000000000951'')','40001','community_moderation_changed');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000953',true);
reset role;
select pg_temp.mod_assert((select count(*)=2 from dm_private.community_moderation_actions),'replay, rejected and other-admin requests add no action evidence');
set local role authenticated;

-- Newly registered or replaced objects invalidate the exact selected context.
select set_config('test.mod_view',public.admin_review_community_content('comment','20000000-0000-4000-8000-000000000951')::text,true);
reset role;
insert into dm_private.community_assets(id,uploader_id,post_id,storage_path,ordinal,mime_type,byte_size)values
 ('40000000-0000-4000-8000-000000000953','00000000-0000-4000-8000-000000000951','10000000-0000-4000-8000-000000000951','community/moderation-added.png',2,'image/png',104);
set local role authenticated;
select pg_temp.mod_reject('select public.admin_community_moderation_media_paths(''comment'',''20000000-0000-4000-8000-000000000951'',current_setting(''test.mod_view'')::jsonb->>''reviewVersion'',''target'')','40001','community_moderation_changed');
select pg_temp.mod_now('comment','20000000-0000-4000-8000-000000000951','hide');
select pg_temp.mod_assert(not(public.admin_review_community_content('comment','20000000-0000-4000-8000-000000000951')->>'canRestore')::boolean,'missing discussion context prevents reply restoration');
select pg_temp.mod_reject('select pg_temp.mod_now(''comment'',''20000000-0000-4000-8000-000000000951'',''restore'')','22023','community_moderation_incomplete');
reset role;
insert into storage.objects(bucket_id,name,metadata)values('community-media','community/moderation-added.png','{"mimetype":"image/png","size":104}');
set local role authenticated;
select set_config('test.mod_view',public.admin_review_community_content('comment','20000000-0000-4000-8000-000000000951')::text,true);
reset role;
update storage.objects set metadata=metadata||'{"eTag":"replacement"}' where name='community/moderation-parent.jpg';
set local role authenticated;
select pg_temp.mod_reject('select public.admin_moderate_community(''comment'',''20000000-0000-4000-8000-000000000951'',''restore'',''A fictional stale image decision.'',current_setting(''test.mod_view'')::jsonb->>''reviewVersion'',gen_random_uuid())','40001','community_moderation_changed');
select pg_temp.mod_now('comment','20000000-0000-4000-8000-000000000951','restore');
select pg_temp.mod_now('post','10000000-0000-4000-8000-000000000951','hide');
select pg_temp.mod_now('post','10000000-0000-4000-8000-000000000951','restore');
select public.admin_resolve_community_report('30000000-0000-4000-8000-000000000951',public.admin_community_report('30000000-0000-4000-8000-000000000951')->>'reviewVersion','dismiss','An independent fictional report decision after inspecting current content.');
reset role;
select pg_temp.mod_assert((select count(*)=6 from dm_private.community_moderation_actions),'each accepted general action records one immutable evidence row');
select pg_temp.mod_assert((select count(*)=1 from dm_private.community_report_reviews),'independent report resolution retains its own evidence');
select pg_temp.mod_assert((select bool_and(inspected_snapshot->>'reviewVersion'=review_version and inspected_snapshot->'target'->>'id'=target_id::text and inspected_snapshot->'target'->>'status'=receipt->>'previousStatus' and not(inspected_snapshot?'_groups') and position('community/moderation-' in inspected_snapshot::text)=0)from dm_private.community_moderation_actions),'action evidence binds the exact inspected version and old status without private paths');
select pg_temp.mod_assert((select count(*)=4 from dm_private.community_assets)and(select count(*)=4 from storage.objects where bucket_id='community-media'),'all original and added assets remain registered and stored');
select pg_temp.mod_assert((select not sales_enabled and environment_mode='test' from public.launch_settings),'moderation never enables commerce');

delete from dm_private.admins where user_id='00000000-0000-4000-8000-000000000953';
set local role authenticated;
select pg_temp.mod_reject('select public.admin_moderate_community(''post'',''10000000-0000-4000-8000-000000000951'',''lock'',''Lock the original fictional discussion.'',current_setting(''test.mod_post_view'')::jsonb->>''reviewVersion'',''50000000-0000-4000-8000-000000000951'')','42501','community_moderation_unavailable');
reset role;
set local role service_role;
select pg_temp.mod_reject('select public.admin_review_community_content(''post'',''10000000-0000-4000-8000-000000000951'')','42501');
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.mod_reject('select public.admin_community_content_page(''post'',null,null,null,null,null,25)','42501');
select pg_temp.mod_reject('select public.admin_review_community_content(''comment'',''20000000-0000-4000-8000-000000000951'')','42501');
reset role;
rollback;
\echo 'PASS: bounded private moderation pages, exact context/media versions, role isolation, closed legacy path, immutable action replay/evidence, strict transitions and independent report resolution.'
