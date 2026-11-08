\set ON_ERROR_STOP on
begin;
create function pg_temp.current_moderate(kind text,id uuid,action text,note text) returns jsonb language sql as $$
 select public.admin_moderate_community(kind,id,action,note,public.admin_review_community_content(kind,id)->>'reviewVersion',gen_random_uuid())
$$;
create function pg_temp.review_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
create function pg_temp.review_reject(statement text,expected_state text,expected_detail text default null) returns void language plpgsql as $$
declare actual_state text;actual_detail text;
begin
 begin execute statement;
 exception when others then
  get stacked diagnostics actual_state=returned_sqlstate,actual_detail=pg_exception_detail;
  if actual_state=expected_state and (expected_detail is null or actual_detail=expected_detail) then return; end if;
  raise exception 'FAIL: expected state/detail % / %, received % / %',expected_state,expected_detail,actual_state,actual_detail;
 end;
 raise exception 'FAIL: request should have been rejected';
end $$;

insert into auth.users(id) values('00000000-0000-4000-8000-000000000711'),('00000000-0000-4000-8000-000000000712'),
 ('00000000-0000-4000-8000-000000000713'),('00000000-0000-4000-8000-000000000714');
insert into dm_private.admins(user_id) values('00000000-0000-4000-8000-000000000713');
insert into dm_private.drawing_reviewers(user_id,enabled,changed_at) values('00000000-0000-4000-8000-000000000714',true,now());
insert into dm_private.community_posts(id,author_id,exam,topic,title,body) values
 ('10000000-0000-4000-8000-000000000711','00000000-0000-4000-8000-000000000711','uceed','fictional','Original fictional review discussion','A fictional discussion whose images and context are inspected.'),
 ('10000000-0000-4000-8000-000000000712','00000000-0000-4000-8000-000000000712','ceed','fictional','Another fictional review discussion','Another fictional discussion excluded from this report context.');
insert into dm_private.community_comments(id,post_id,parent_id,author_id,body) values
 ('20000000-0000-4000-8000-000000000711','10000000-0000-4000-8000-000000000711',null,'00000000-0000-4000-8000-000000000712','An original fictional parent method.'),
 ('20000000-0000-4000-8000-000000000712','10000000-0000-4000-8000-000000000711','20000000-0000-4000-8000-000000000711','00000000-0000-4000-8000-000000000711','The original fictional reported nested reply.');
insert into dm_private.community_reports(id,reporter_id,post_id,comment_id,reason,details) values
 ('30000000-0000-4000-8000-000000000711','00000000-0000-4000-8000-000000000712',null,'20000000-0000-4000-8000-000000000712','abuse','A fictional report requiring full context.'),
 ('30000000-0000-4000-8000-000000000712','00000000-0000-4000-8000-000000000712','10000000-0000-4000-8000-000000000711',null,'spam',null),
 ('30000000-0000-4000-8000-000000000713','00000000-0000-4000-8000-000000000714',null,'20000000-0000-4000-8000-000000000712','other','Another reporter remains queued.');
insert into dm_private.community_assets(id,uploader_id,post_id,comment_id,storage_path,ordinal,mime_type,byte_size,pixel_width,pixel_height,image_orientation,image_sha256) values
 ('40000000-0000-4000-8000-000000000711','00000000-0000-4000-8000-000000000711','10000000-0000-4000-8000-000000000711',null,'community/fictional-post.png',1,'image/png',11,2,3,1,repeat('a',64)),
 ('40000000-0000-4000-8000-000000000712','00000000-0000-4000-8000-000000000712',null,'20000000-0000-4000-8000-000000000711','community/fictional-parent.jpg',1,'image/jpeg',12,null,null,null,null),
 ('40000000-0000-4000-8000-000000000713','00000000-0000-4000-8000-000000000711',null,'20000000-0000-4000-8000-000000000712','community/fictional-target.webp',1,'image/webp',13,3,2,6,repeat('b',64));
insert into storage.objects(bucket_id,name,metadata)
 select 'community-media',storage_path,jsonb_build_object('mimetype',mime_type,'size',byte_size,'eTag','original') from dm_private.community_assets;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000711',true);
select pg_temp.review_reject('select public.admin_community_report(''30000000-0000-4000-8000-000000000711'')','42501','community_review_unavailable');
select pg_temp.review_reject('select public.admin_community_report_media_paths(''30000000-0000-4000-8000-000000000711'',repeat(''a'',64),''target'')','42501','community_review_unavailable');
select pg_temp.review_reject('select public.admin_resolve_community_report(''30000000-0000-4000-8000-000000000711'',repeat(''a'',64),''hide'',''Fictional reason'')','42501','community_review_unavailable');
select pg_temp.review_reject('select * from dm_private.community_report_reviews','42501');
select pg_temp.review_reject('select dm_private.community_report_snapshot(''30000000-0000-4000-8000-000000000711'')','42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000712',true);
select pg_temp.review_reject('select public.admin_community_report(''30000000-0000-4000-8000-000000000711'')','42501','community_review_unavailable');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000714',true);
select pg_temp.review_reject('select public.admin_community_report(''30000000-0000-4000-8000-000000000711'')','42501','community_review_unavailable');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000713',true);
select set_config('test.review',public.admin_community_report('30000000-0000-4000-8000-000000000711')::text,true);
set local timezone='Asia/Kolkata';
select pg_temp.review_assert(public.admin_community_report('30000000-0000-4000-8000-000000000711')->>'reviewVersion'=current_setting('test.review')::jsonb->>'reviewVersion','identical content keeps its review version across session time zones');
set local timezone='UTC';
select pg_temp.review_assert((current_setting('test.review')::jsonb->>'canDismiss')::boolean,'complete registered context permits inspected dismissal');
select pg_temp.review_assert(current_setting('test.review')::jsonb->'target'->>'body'='The original fictional reported nested reply.' and current_setting('test.review')::jsonb->'parent'->>'body'='An original fictional parent method.','reader includes full target and immediate parent');
select pg_temp.review_assert(current_setting('test.review')::jsonb->'post'->>'id'='10000000-0000-4000-8000-000000000711','reader binds the parent discussion');
select pg_temp.review_assert(not(current_setting('test.review')::jsonb?'_groups') and position('community/fictional' in current_setting('test.review'))=0 and position('reporter_id' in current_setting('test.review'))=0 and position('author_id' in current_setting('test.review'))=0,'browser DTO contains no private paths or account bindings');
select pg_temp.review_assert(public.admin_community_report_media_paths('30000000-0000-4000-8000-000000000711',current_setting('test.review')::jsonb->>'reviewVersion','target')->0->>'path'='community/fictional-target.webp','paths bind the reported image group');
select pg_temp.review_assert(public.admin_community_report_media_paths('30000000-0000-4000-8000-000000000711',current_setting('test.review')::jsonb->>'reviewVersion','parent')->0->'orientation'='null','legacy image metadata stays unknown');
select pg_temp.review_reject('select public.admin_community_report_media_paths(''30000000-0000-4000-8000-000000000711'',current_setting(''test.review'')::jsonb->>''reviewVersion'',''path'')','22023','community_review_invalid');
select pg_temp.review_reject('select public.admin_resolve_community_report(''30000000-0000-4000-8000-000000000711'',''hide'',''Legacy bypass'')','22023','community_review_required');
select pg_temp.review_reject('select public.admin_resolve_community_report(''30000000-0000-4000-8000-000000000711'',current_setting(''test.review'')::jsonb->>''reviewVersion'',''hide'',''   '')','22023','community_review_invalid');
select pg_temp.review_reject('select public.admin_resolve_community_report(''30000000-0000-4000-8000-000000000711'',null,''hide'',''A fictional reason'')','22023','community_review_invalid');

-- Helpful totals and unrelated new replies do not make inspected evidence stale.
reset role;
update dm_private.community_comments set helpful_count=helpful_count+1 where id='20000000-0000-4000-8000-000000000712';
insert into dm_private.community_comments(post_id,author_id,body) values('10000000-0000-4000-8000-000000000711','00000000-0000-4000-8000-000000000714','An unrelated new fictional reply.');
set local role authenticated;
select pg_temp.review_assert(public.admin_community_report('30000000-0000-4000-8000-000000000711')->>'reviewVersion'=current_setting('test.review')::jsonb->>'reviewVersion','unrelated activity preserves the inspected version');
select pg_temp.current_moderate('comment','20000000-0000-4000-8000-000000000711','hide','Fictional parent containment');
select pg_temp.review_reject('select public.admin_community_report_media_paths(''30000000-0000-4000-8000-000000000711'',current_setting(''test.review'')::jsonb->>''reviewVersion'',''target'')','40001','community_review_changed');
select set_config('test.review',public.admin_community_report('30000000-0000-4000-8000-000000000711')::text,true);
select pg_temp.review_assert(current_setting('test.review')::jsonb->'parent'->>'status'='hidden' and current_setting('test.review')::jsonb->'parent'->>'body'='An original fictional parent method.','administrator sees hidden immediate context');
select pg_temp.review_assert(jsonb_array_length(public.admin_community_report_media_paths('30000000-0000-4000-8000-000000000711',current_setting('test.review')::jsonb->>'reviewVersion','parent'))=1,'administrator can inspect hidden context images');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000711',true);
select pg_temp.review_reject('select public.community_media_paths(''comment'',''20000000-0000-4000-8000-000000000711'')','42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000713',true);

-- INSERT is not a thread_revision event; it must still invalidate this review.
reset role;
select set_config('test.thread_revision',(select thread_revision::text from dm_private.community_posts where id='10000000-0000-4000-8000-000000000711'),true);
insert into dm_private.community_assets(id,uploader_id,comment_id,storage_path,ordinal,mime_type,byte_size)
 values('40000000-0000-4000-8000-000000000714','00000000-0000-4000-8000-000000000711','20000000-0000-4000-8000-000000000712','community/new-fictional-target.png',2,'image/png',14);
select pg_temp.review_assert((select thread_revision::text=current_setting('test.thread_revision') from dm_private.community_posts where id='10000000-0000-4000-8000-000000000711'),'fixture proves attachment insertion leaves the reading revision unchanged');
set local role authenticated;
select pg_temp.review_reject('select public.admin_resolve_community_report(''30000000-0000-4000-8000-000000000711'',current_setting(''test.review'')::jsonb->>''reviewVersion'',''hide'',''Fictional stale decision'')','40001','community_review_changed');
select set_config('test.review',public.admin_community_report('30000000-0000-4000-8000-000000000711')::text,true);
select pg_temp.review_assert(not(current_setting('test.review')::jsonb->>'canDismiss')::boolean,'missing registered images prohibit dismissal');
select pg_temp.review_reject('select public.admin_community_report_media_paths(''30000000-0000-4000-8000-000000000711'',current_setting(''test.review'')::jsonb->>''reviewVersion'',''target'')','22023','community_review_incomplete');
select pg_temp.review_reject('select public.admin_resolve_community_report(''30000000-0000-4000-8000-000000000711'',current_setting(''test.review'')::jsonb->>''reviewVersion'',''dismiss'',''Fictional incomplete dismissal'')','22023','community_review_incomplete');
reset role;
insert into storage.objects(bucket_id,name,metadata) values('community-media','community/new-fictional-target.png','{"mimetype":"image/png","size":14,"eTag":"first"}');
set local role authenticated;
select pg_temp.review_reject('select public.admin_community_report_media_paths(''30000000-0000-4000-8000-000000000711'',current_setting(''test.review'')::jsonb->>''reviewVersion'',''target'')','40001','community_review_changed');
select set_config('test.review',public.admin_community_report('30000000-0000-4000-8000-000000000711')::text,true);
reset role;
update storage.objects set metadata=jsonb_set(metadata,'{eTag}','"replaced-same-size"') where name='community/new-fictional-target.png';
set local role authenticated;
select pg_temp.review_reject('select public.admin_resolve_community_report(''30000000-0000-4000-8000-000000000711'',current_setting(''test.review'')::jsonb->>''reviewVersion'',''dismiss'',''Fictional replaced evidence'')','40001','community_review_changed');
reset role;
delete from storage.objects where name='community/new-fictional-target.png';
set local role authenticated;
select set_config('test.review',public.admin_community_report('30000000-0000-4000-8000-000000000711')::text,true);
select public.admin_resolve_community_report('30000000-0000-4000-8000-000000000711',current_setting('test.review')::jsonb->>'reviewVersion','hide','Contain this fictional reply while its image is unavailable.');
select pg_temp.review_assert(public.admin_community_report('30000000-0000-4000-8000-000000000711')->>'status'='resolved','a current hide can contain missing evidence');
select pg_temp.review_assert(public.admin_community_report('30000000-0000-4000-8000-000000000713')->>'status'='open','another reporter remains independently queued');
select pg_temp.review_reject('select public.admin_resolve_community_report(''30000000-0000-4000-8000-000000000711'',current_setting(''test.review'')::jsonb->>''reviewVersion'',''hide'',''Fictional duplicate resolution'')','40001','community_review_changed');
select set_config('test.post_review',public.admin_community_report('30000000-0000-4000-8000-000000000712')::text,true);
select public.admin_resolve_community_report('30000000-0000-4000-8000-000000000712',current_setting('test.post_review')::jsonb->>'reviewVersion','dismiss','The original fictional post is acceptable after inspection.');
reset role;
select pg_temp.review_assert((select count(*)=2 from dm_private.community_report_reviews),'each successful report resolution creates exactly one immutable audit');
select pg_temp.review_assert((select inspected_snapshot->>'reviewVersion'=review_version and inspected_snapshot->'target'->>'body'='The original fictional reported nested reply.' and not(inspected_snapshot?'_groups') from dm_private.community_report_reviews where report_id='30000000-0000-4000-8000-000000000711'),'audit retains inspected content/version without private paths');
select pg_temp.review_assert((select status='hidden' from dm_private.community_comments where id='20000000-0000-4000-8000-000000000712') and (select status='visible' from dm_private.community_posts where id='10000000-0000-4000-8000-000000000711'),'hide affects only the reported target; dismissal preserves the post');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','anon',true);
select pg_temp.review_reject('select public.admin_community_report(''30000000-0000-4000-8000-000000000711'')','42501');
select pg_temp.review_reject('select public.admin_community_report_media_paths(''30000000-0000-4000-8000-000000000711'',repeat(''a'',64),''target'')','42501');
select pg_temp.review_reject('select public.admin_resolve_community_report(''30000000-0000-4000-8000-000000000711'',repeat(''a'',64),''hide'',''Fictional anonymous decision'')','42501');
reset role;
rollback;
\echo 'PASS: inspected Community context/images, role isolation, legacy closure, asset/object version fences, missing-image containment, per-report resolution and private audit.'
