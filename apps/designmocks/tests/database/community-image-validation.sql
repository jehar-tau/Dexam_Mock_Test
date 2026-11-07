\set ON_ERROR_STOP on
begin;
create function pg_temp.community_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.community_reject(statement text,expected text) returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then if position(expected in sqlerrm)>0 then return; end if; raise;
 end;
 raise exception 'FAIL: expected %',expected;
end $$;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000501'),('00000000-0000-4000-8000-000000000502'),('00000000-0000-4000-8000-000000000503');
insert into dm_private.admins(user_id) values('00000000-0000-4000-8000-000000000503');
insert into dm_private.community_posts(id,author_id,exam,topic,title,body) values
 ('10000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000501','uceed','fictional','Fictional image discussion','An original fictional discussion for private image acceptance.');
insert into dm_private.community_comments(id,post_id,author_id,body) values
 ('20000000-0000-4000-8000-000000000501','10000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000502','A fictional solution.');
create function pg_temp.community_path(kind text,tid uuid,n integer) returns text language sql immutable as $$
 select 'community/'||case when kind='post' then '00000000-0000-4000-8000-000000000501' else '00000000-0000-4000-8000-000000000502' end||'/'||kind||'/'||tid::text||'/'||md5('community-fixture-'||n)::uuid::text||'.png'
$$;
insert into storage.objects(bucket_id,name,metadata) values
 ('community-media',pg_temp.community_path('post','10000000-0000-4000-8000-000000000501',1),'{"mimetype":"image/png","size":111}'),
 ('community-media',pg_temp.community_path('post','10000000-0000-4000-8000-000000000501',2),'{"mimetype":"image/png","size":99}'),
 ('community-media',pg_temp.community_path('comment','20000000-0000-4000-8000-000000000501',1),'{"mimetype":"image/png","size":111}');
create function pg_temp.community_register(kind text,tid uuid,n integer,digest text default repeat('a',64)) returns jsonb language sql as $$
 select public.register_community_asset(case when kind='post' then '00000000-0000-4000-8000-000000000501' else '00000000-0000-4000-8000-000000000502' end::uuid,
 kind,tid,pg_temp.community_path(kind,tid,n),n,'image/png',111,6,4,6,digest)
$$;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
select pg_temp.community_reject('select public.service_community_upload_context(auth.uid(),''post'',''10000000-0000-4000-8000-000000000501'')','permission denied');
select pg_temp.community_reject('select pg_temp.community_register(''post'',''10000000-0000-4000-8000-000000000501'',1)','permission denied');
select pg_temp.community_reject('select public.service_community_upload_receipt(auth.uid(),''any'')','permission denied');
select pg_temp.community_reject('select * from dm_private.community_assets','permission denied');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.community_assert(public.service_community_upload_context('00000000-0000-4000-8000-000000000501','post','10000000-0000-4000-8000-000000000501'),'owner may upload');
select pg_temp.community_reject('select public.service_community_upload_context(''00000000-0000-4000-8000-000000000502'',''post'',''10000000-0000-4000-8000-000000000501'')','unavailable');
select pg_temp.community_reject('select public.service_community_upload_context(''00000000-0000-4000-8000-000000000503'',''post'',''10000000-0000-4000-8000-000000000501'')','unavailable');
select pg_temp.community_assert((pg_temp.community_register('post','10000000-0000-4000-8000-000000000501',1)->>'reused')::boolean=false,'first complete image registered');
select pg_temp.community_assert((pg_temp.community_register('post','10000000-0000-4000-8000-000000000501',1)->>'reused')::boolean=true,'identical sanitized retry reuses the original receipt');
select pg_temp.community_reject('select pg_temp.community_register(''post'',''10000000-0000-4000-8000-000000000501'',1,repeat(''b'',64))','already saved');
select pg_temp.community_reject('select pg_temp.community_register(''post'',''10000000-0000-4000-8000-000000000501'',2)','object mismatch');
select pg_temp.community_reject('select pg_temp.community_register(''post'',''10000000-0000-4000-8000-000000000501'',4)','Invalid community image');
select pg_temp.community_reject('select public.register_community_asset(''00000000-0000-4000-8000-000000000501'',''post'',''10000000-0000-4000-8000-000000000501'',''foreign.png'',2,''image/png'',111,6,4,6,repeat(''a'',64))','Invalid community image path');
select pg_temp.community_reject('select public.register_community_asset(''00000000-0000-4000-8000-000000000501'',''post'',''10000000-0000-4000-8000-000000000501'',''x'',2,''image/png'',5242881,6,4,6,repeat(''a'',64))','Invalid community image');
select pg_temp.community_reject('select public.register_community_asset(''00000000-0000-4000-8000-000000000501'',''post'',''10000000-0000-4000-8000-000000000501'',''x'',2,''image/png'',111,12000,2001,6,repeat(''a'',64))','Invalid community image');
select pg_temp.community_register('comment','20000000-0000-4000-8000-000000000501',1);
select public.register_community_asset('00000000-0000-4000-8000-000000000501','post','10000000-0000-4000-8000-000000000501','community/legacy-fixture.png',3,'image/png',111);
reset role;
select pg_temp.community_assert((select count(*)=3 from dm_private.community_assets),'retry creates no second asset');
select pg_temp.community_assert((select pixel_width is null and image_sha256 is null from dm_private.community_assets where ordinal=3),'legacy metadata remains unknown');
select pg_temp.community_reject('update dm_private.community_assets set pixel_width=1 where ordinal=3','community_render_metadata');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000502',true);
select pg_temp.community_assert(public.community_media_paths('post','10000000-0000-4000-8000-000000000501')->0->>'orientation'='6','another signed-in member sees visible post media');
select pg_temp.community_assert(public.community_media_paths('comment','20000000-0000-4000-8000-000000000501')->0->>'width'='6','reply render metadata returned');
select pg_temp.community_assert(not(public.community_media_paths('post','10000000-0000-4000-8000-000000000501')->0 ? 'image_sha256'),'sanitized content hash stays internal');
select pg_temp.community_reject('select public.community_media_paths(null,null)','Invalid community target');
reset role;
update dm_private.community_posts set status='locked' where id='10000000-0000-4000-8000-000000000501';
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.community_reject('select public.service_community_upload_context(''00000000-0000-4000-8000-000000000501'',''post'',''10000000-0000-4000-8000-000000000501'')','unavailable');
select pg_temp.community_reject('select pg_temp.community_register(''comment'',''20000000-0000-4000-8000-000000000501'',1)','unavailable');
select pg_temp.community_reject('select public.register_community_asset(''00000000-0000-4000-8000-000000000501'',''post'',''10000000-0000-4000-8000-000000000501'',''legacy-bypass.png'',2,''image/png'',111)','unavailable');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.community_assert(jsonb_array_length(public.community_media_paths('post','10000000-0000-4000-8000-000000000501'))=2,'locked post remains readable');
reset role;
update dm_private.community_posts set status='hidden' where id='10000000-0000-4000-8000-000000000501';
set local role authenticated;
select pg_temp.community_reject('select public.community_media_paths(''post'',''10000000-0000-4000-8000-000000000501'')','unavailable');
select pg_temp.community_reject('select public.community_media_paths(''comment'',''20000000-0000-4000-8000-000000000501'')','unavailable');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.community_assert(public.service_community_upload_receipt('00000000-0000-4000-8000-000000000501',pg_temp.community_path('post','10000000-0000-4000-8000-000000000501',1)) is not null,'ambiguous registered receipt survives later moderation');
select pg_temp.community_assert(public.service_community_upload_receipt('00000000-0000-4000-8000-000000000502',pg_temp.community_path('post','10000000-0000-4000-8000-000000000501',1)) is null,'receipt remains owner-bound');
reset role;
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.community_reject('select public.community_media_paths(''post'',''10000000-0000-4000-8000-000000000501'')','permission denied');
reset role;
rollback;
\echo 'PASS: Community validated metadata, object binding, idempotent receipts, owner/role isolation, legacy compatibility and moderation fences.'
