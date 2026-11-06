-- Fictional original PNG metadata and storage objects only; all writes roll back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.media_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.media_reject(statement text,label text) returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'FAIL, unexpectedly allowed: %',label;end$$;
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,source_commit)
values('media-fixture',repeat('a',64),'uceed','MCQ','fixture','owner-provided',jsonb_build_object('externalKey','media-fixture','holds','[]'::jsonb,'assets',jsonb_build_array(jsonb_build_object('sha256',repeat('b',64),'path','fixture/page.png','width',1,'height',1))),repeat('c',40));
set local role anon;
select pg_temp.media_reject('select public.canonical_bank_media_manifest()','anonymous private manifest');
select pg_temp.media_reject('select * from dm_private.bank_media_assets','anonymous media catalogue');
reset role;
set local role authenticated;
select pg_temp.media_reject('select public.canonical_bank_media_manifest()','student private manifest');
select pg_temp.media_reject('select public.register_bank_media_assets(''[]'')','student media registration');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('test.media_record',jsonb_build_array(jsonb_build_object('sha256',repeat('b',64),'storagePath','papers/canonical/'||repeat('b',64)||'.png','width',1,'height',1,'byteSize',68))::text,true);
select pg_temp.media_reject('select public.register_bank_media_assets(current_setting(''test.media_record'')::jsonb)','missing object cannot register');
reset role;
insert into storage.objects(bucket_id,name,metadata)values('paper-media','papers/canonical/'||repeat('b',64)||'.png','{"mimetype":"image/png","size":68}');
set local role service_role;
select pg_temp.media_assert(public.register_bank_media_assets(current_setting('test.media_record')::jsonb)=1,'verified canonical object registered');
select pg_temp.media_assert(public.register_bank_media_assets(current_setting('test.media_record')::jsonb)=1,'registration retry succeeds');
select pg_temp.media_assert(jsonb_array_length(public.canonical_bank_media_manifest())=1,'retry does not duplicate asset');
select pg_temp.media_reject('select public.register_bank_media_assets(jsonb_set(current_setting(''test.media_record'')::jsonb,''{0,sha256}'',to_jsonb(repeat(''d'',64))))','unreferenced hash rejected');
select pg_temp.media_reject('select public.register_bank_media_assets(jsonb_set(current_setting(''test.media_record'')::jsonb,''{0,storagePath}'',''"papers/other.png"''))','incorrect object path rejected');
select pg_temp.media_reject('select public.register_bank_media_assets(jsonb_set(current_setting(''test.media_record'')::jsonb,''{0,width}'',''2''))','incorrect canonical dimensions rejected');
select pg_temp.media_reject('select public.register_bank_media_assets(jsonb_set(current_setting(''test.media_record'')::jsonb,''{0,byteSize}'',''69''))','storage metadata mismatch rejected');
reset role;
select pg_temp.media_assert((select not owner_approved and not rights_confirmed and runtime_payload is null from dm_private.bank_questions where external_key='media-fixture'),'media does not approve or publish a question');
update dm_private.bank_questions set active=false where external_key='media-fixture';
set local role service_role;
select pg_temp.media_reject('select public.register_bank_media_assets(current_setting(''test.media_record'')::jsonb)','inactive canonical asset rejected');
reset role;
rollback;
\echo 'PASS: private canonical media references, storage binding and role boundaries.'
