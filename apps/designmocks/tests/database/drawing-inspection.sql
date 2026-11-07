\set ON_ERROR_STOP on
begin;
create function pg_temp.inspection_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.inspection_reject(statement text,expected text) returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then if position(expected in sqlerrm)>0 then return; end if; raise;
 end;
 raise exception 'FAIL: expected %',expected;
end $$;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000461'),('00000000-0000-4000-8000-000000000462'),
 ('00000000-0000-4000-8000-000000000463'),('00000000-0000-4000-8000-000000000464');
insert into dm_private.admins(user_id) values('00000000-0000-4000-8000-000000000464');
insert into dm_private.papers(id,title,exam,duration_seconds,source_kind)
 values('10000000-0000-4000-8000-000000000461','Fictional inspection paper','uceed',900,'catalogue');
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,points,topic)
 values('20000000-0000-4000-8000-000000000461','10000000-0000-4000-8000-000000000461',1,
 'Draw an original fictional sign.','[]','drawing','{"correct":20,"wrong":0}',20,'drawing');
insert into dm_private.attempts(id,user_id,paper_id,deadline,upload_deadline)
 values('30000000-0000-4000-8000-000000000461','00000000-0000-4000-8000-000000000461','10000000-0000-4000-8000-000000000461',
 now()+interval '15 minutes',now()+interval '30 minutes');
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,key,explanation)
 select '30000000-0000-4000-8000-000000000461',id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,
 '{"kind":"self_review"}','Fictional teacher review.' from dm_private.questions where id='20000000-0000-4000-8000-000000000461';
insert into storage.objects(bucket_id,name,metadata) values
 ('drawing-submissions','drawings/40000000-0000-4000-8000-000000000461.png','{"mimetype":"image/png","size":121}'),
 ('drawing-submissions','drawings/40000000-0000-4000-8000-000000000462.jpg','{"mimetype":"image/jpeg","size":725}'),
 ('drawing-submissions','drawings/40000000-0000-4000-8000-000000000463.webp','{"mimetype":"image/webp","size":104}'),
 ('drawing-submissions','drawings/40000000-0000-4000-8000-000000000464.png','{"mimetype":"image/png","size":77}');

select pg_temp.inspection_assert(not has_function_privilege('anon','public.service_student_drawing_media_paths(uuid,uuid,uuid)','EXECUTE')
 and not has_function_privilege('authenticated','public.service_student_drawing_media_paths(uuid,uuid,uuid)','EXECUTE'), 'owner paths require the authenticated Edge service');
select pg_temp.inspection_assert(not has_function_privilege('authenticated','public.register_drawing_upload(uuid,uuid,uuid,text,integer,text,integer,integer,integer,integer)','EXECUTE'),
 'students cannot forge validated dimensions');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.inspection_reject($q$select public.register_drawing_upload('00000000-0000-4000-8000-000000000461','30000000-0000-4000-8000-000000000461',
 '20000000-0000-4000-8000-000000000461','drawings/40000000-0000-4000-8000-000000000461.png',1,'image/png',121,null,4,6)$q$,'Invalid drawing rendering metadata');
select pg_temp.inspection_reject($q$select public.register_drawing_upload('00000000-0000-4000-8000-000000000461','30000000-0000-4000-8000-000000000461',
 '20000000-0000-4000-8000-000000000461','drawings/40000000-0000-4000-8000-000000000461.png',1,'image/png',121,6001,4000,6)$q$,'Invalid drawing rendering metadata');
select pg_temp.inspection_reject($q$select public.register_drawing_upload('00000000-0000-4000-8000-000000000461','30000000-0000-4000-8000-000000000461',
 '20000000-0000-4000-8000-000000000461','drawings/40000000-0000-4000-8000-000000000461.png',1,'image/png',121,6,4,9)$q$,'Invalid drawing rendering metadata');
select public.register_drawing_upload('00000000-0000-4000-8000-000000000461','30000000-0000-4000-8000-000000000461','20000000-0000-4000-8000-000000000461',
 'drawings/40000000-0000-4000-8000-000000000461.png',1,'image/png',121,6,4,6);
select public.register_drawing_upload('00000000-0000-4000-8000-000000000461','30000000-0000-4000-8000-000000000461','20000000-0000-4000-8000-000000000461',
 'drawings/40000000-0000-4000-8000-000000000462.jpg',2,'image/jpeg',725,6,4,8);
select public.register_drawing_upload('00000000-0000-4000-8000-000000000461','30000000-0000-4000-8000-000000000461','20000000-0000-4000-8000-000000000461',
 'drawings/40000000-0000-4000-8000-000000000463.webp',3,'image/webp',104,6,4,2);
-- Legacy service calls remain possible; the missing metadata stays explicitly unknown.
select public.register_drawing_upload('00000000-0000-4000-8000-000000000461','30000000-0000-4000-8000-000000000461','20000000-0000-4000-8000-000000000461',
 'drawings/40000000-0000-4000-8000-000000000464.png',4,'image/png',77);
select pg_temp.inspection_assert((public.service_student_drawing_media_paths('00000000-0000-4000-8000-000000000461','30000000-0000-4000-8000-000000000461',
 '20000000-0000-4000-8000-000000000461')->0->>'orientation')='6','service returns decoder metadata bound to the owner');
select pg_temp.inspection_reject($q$select public.service_student_drawing_media_paths('00000000-0000-4000-8000-000000000462','30000000-0000-4000-8000-000000000461',
 '20000000-0000-4000-8000-000000000461')$q$,'Drawing pages unavailable');
reset role;
select pg_temp.inspection_reject($q$update dm_private.drawing_uploads set image_orientation=null where ordinal=1$q$,'drawing_render_metadata');
select set_config('test.inspection_frozen',(select jsonb_build_object('clock',row(deadline,upload_deadline),'items',
 (select jsonb_agg(to_jsonb(i)) from dm_private.attempt_items i where i.attempt_id=a.id))::text from dm_private.attempts a
 where a.id='30000000-0000-4000-8000-000000000461'),true);

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000461',true);
select pg_temp.inspection_assert(public.my_drawing_uploads('30000000-0000-4000-8000-000000000461','20000000-0000-4000-8000-000000000461')->3->'orientation'='null',
 'legacy receipts do not invent orientation');
select pg_temp.inspection_assert(not ((public.my_drawing_uploads('30000000-0000-4000-8000-000000000461','20000000-0000-4000-8000-000000000461')->0)?'storagePath'),
 'student receipt contains rendering properties without a Storage path');
select pg_temp.inspection_assert(exists(select 1 from jsonb_array_elements(public.export_my_account_data()->'drawingUploads') item
 where item->>'ordinal'='1' and item->>'width'='6' and item->>'orientation'='6'),'owned portable export retains rendering metadata');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000462',true);
select pg_temp.inspection_assert(public.my_drawing_uploads('30000000-0000-4000-8000-000000000461','20000000-0000-4000-8000-000000000461')='[]', 'foreign student has no receipts');
select pg_temp.inspection_assert(public.export_my_account_data()->'drawingUploads'='[]','foreign student has no exported drawing metadata');
reset role;
select pg_temp.inspection_assert((select jsonb_build_object('clock',row(deadline,upload_deadline),'items',
 (select jsonb_agg(to_jsonb(i)) from dm_private.attempt_items i where i.attempt_id=a.id))::text=current_setting('test.inspection_frozen') from dm_private.attempts a
 where a.id='30000000-0000-4000-8000-000000000461'),'inspection reads preserve the frozen clock and responses');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000464',true);
select public.admin_set_drawing_reviewer('00000000-0000-4000-8000-000000000463',true,'Fictional inspection teacher.');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000461',true);
select public.submit_attempt('30000000-0000-4000-8000-000000000461');
reset role;
select set_config('test.inspection_review',(select id::text from dm_private.drawing_reviews where attempt_id='30000000-0000-4000-8000-000000000461'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000463',true);
select pg_temp.inspection_reject('select public.admin_drawing_review_media_paths(current_setting(''test.inspection_review'')::uuid)','Review unavailable');
reset role;
update dm_private.attempts set started_at=now()-interval '1 hour',deadline=now()-interval '30 minutes',upload_deadline=now()-interval '15 minutes'
 where id='30000000-0000-4000-8000-000000000461';
set local role authenticated;
select pg_temp.inspection_reject('select public.admin_drawing_review_media_paths(current_setting(''test.inspection_review'')::uuid)','Claim the review');
select public.admin_claim_drawing_review(current_setting('test.inspection_review')::uuid);
select pg_temp.inspection_assert(public.admin_drawing_review_media_paths(current_setting('test.inspection_review')::uuid)->2->>'orientation'='2',
 'assigned teacher receives the identical private rendering receipt after the fixed cutoff');
select pg_temp.inspection_assert(not(public.admin_drawing_review_media_paths(current_setting('test.inspection_review')::uuid)::text like '%00000000-0000-4000-8000-000000000461%'),
 'anonymous page receipt contains no student account identifier');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000464',true);
select public.admin_set_drawing_reviewer('00000000-0000-4000-8000-000000000463',false,'Fictional inspection completed.');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000463',true);
select pg_temp.inspection_reject('select public.admin_drawing_review_media_paths(current_setting(''test.inspection_review'')::uuid)','Drawing reviewer access required');
reset role;
rollback;
\echo 'PASS: private drawing inspection receipts, legacy compatibility, export, fixed windows, reviewer assignment and revocation.'
