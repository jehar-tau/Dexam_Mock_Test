\set ON_ERROR_STOP on
begin;

create function pg_temp.image_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.image_reject(statement text,expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then if position(expected in sqlerrm)>0 then return; end if; raise;
  end;
  raise exception 'FAIL: expected %',expected;
end $$;

insert into auth.users(id) values('00000000-0000-4000-8000-000000000411'),('00000000-0000-4000-8000-000000000412');
insert into dm_private.papers(id,title,exam,duration_seconds,source_kind)
 values('10000000-0000-4000-8000-000000000411','Fictional image receipts','uceed',900,'catalogue');
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,points,topic)
 values('20000000-0000-4000-8000-000000000411','10000000-0000-4000-8000-000000000411',1,
 'Sketch a fictional original sign.','[]','drawing','{"correct":20,"wrong":0}',20,'drawing');
insert into dm_private.attempts(id,user_id,paper_id,deadline,upload_deadline)
 values('30000000-0000-4000-8000-000000000411','00000000-0000-4000-8000-000000000411',
 '10000000-0000-4000-8000-000000000411',now()+interval '15 minutes',now()+interval '30 minutes');
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,key,explanation)
 select '30000000-0000-4000-8000-000000000411',id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,
 '{"kind":"self_review"}','Fictional human assessment.' from dm_private.questions where id='20000000-0000-4000-8000-000000000411';

-- Storage-catalogue receipts only; actual bytes/decoding are exercised against real Edge/Storage.
insert into storage.objects(bucket_id,name,metadata) values
 ('drawing-submissions','drawings/40000000-0000-4000-8000-000000000411.png','{"mimetype":"image/png","size":121}'),
 ('drawing-submissions','drawings/40000000-0000-4000-8000-000000000412.jpg','{"mimetype":"image/jpeg","size":725}'),
 ('drawing-submissions','drawings/40000000-0000-4000-8000-000000000413.webp','{"mimetype":"image/webp","size":104}');

select pg_temp.image_assert(not has_function_privilege('anon','public.register_drawing_upload(uuid,uuid,uuid,text,integer,text,integer)','EXECUTE')
 and not has_function_privilege('authenticated','public.register_drawing_upload(uuid,uuid,uuid,text,integer,text,integer)','EXECUTE'),
 'only the validation service can register private objects');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.image_reject($q$select public.register_drawing_upload('00000000-0000-4000-8000-000000000412',
 '30000000-0000-4000-8000-000000000411','20000000-0000-4000-8000-000000000411',
 'drawings/40000000-0000-4000-8000-000000000411.png',1,'image/png',121)$q$,'Drawing attempt unavailable');
select pg_temp.image_reject($q$select public.register_drawing_upload('00000000-0000-4000-8000-000000000411',
 '30000000-0000-4000-8000-000000000411','20000000-0000-4000-8000-000000000411',
 'drawings/40000000-0000-4000-8000-000000000411.png',1,'image/png',309)$q$,'missing or mismatched');
select pg_temp.image_reject($q$select public.register_drawing_upload('00000000-0000-4000-8000-000000000411',
 '30000000-0000-4000-8000-000000000411','20000000-0000-4000-8000-000000000411',
 'drawings/40000000-0000-4000-8000-000000000411.png',1,'image/jpeg',121)$q$,'missing or mismatched');

select public.register_drawing_upload('00000000-0000-4000-8000-000000000411','30000000-0000-4000-8000-000000000411',
 '20000000-0000-4000-8000-000000000411','drawings/40000000-0000-4000-8000-000000000411.png',1,'image/png',121);
select public.register_drawing_upload('00000000-0000-4000-8000-000000000411','30000000-0000-4000-8000-000000000411',
 '20000000-0000-4000-8000-000000000411','drawings/40000000-0000-4000-8000-000000000412.jpg',2,'image/jpeg',725);
select public.register_drawing_upload('00000000-0000-4000-8000-000000000411','30000000-0000-4000-8000-000000000411',
 '20000000-0000-4000-8000-000000000411','drawings/40000000-0000-4000-8000-000000000413.webp',3,'image/webp',104);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000411',true);
select pg_temp.image_assert((select jsonb_agg((item->>'byteSize')::integer order by (item->>'ordinal')::integer)
 from jsonb_array_elements(public.my_drawing_uploads('30000000-0000-4000-8000-000000000411','20000000-0000-4000-8000-000000000411')) item)='[121,725,104]',
 'owned receipts use the sanitized object sizes rather than source metadata sizes');
select pg_temp.image_assert(not public.can_upload_drawing('30000000-0000-4000-8000-000000000411','20000000-0000-4000-8000-000000000411',2),
 'a saved position is unavailable to a retried upload');
select pg_temp.image_assert(public.can_upload_drawing('30000000-0000-4000-8000-000000000411','20000000-0000-4000-8000-000000000411',4),
 'normalization does not consume an extra page or change the upload clock');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000412',true);
select pg_temp.image_assert(public.my_drawing_uploads('30000000-0000-4000-8000-000000000411','20000000-0000-4000-8000-000000000411')='[]',
 'another account sees no page receipt');
select pg_temp.image_assert(not public.can_upload_drawing('30000000-0000-4000-8000-000000000411','20000000-0000-4000-8000-000000000411',4),
 'another account cannot supply an image for this attempt');
reset role;
update dm_private.attempts set started_at=now()-interval '1 hour',deadline=now()-interval '30 minutes',upload_deadline=now()-interval '15 minutes'
 where id='30000000-0000-4000-8000-000000000411';
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.image_reject($q$select public.register_drawing_upload('00000000-0000-4000-8000-000000000411',
 '30000000-0000-4000-8000-000000000411','20000000-0000-4000-8000-000000000411',
 'drawings/40000000-0000-4000-8000-000000000413.webp',4,'image/webp',104)$q$,'Upload window closed');
reset role;
select pg_temp.image_assert((select count(*)=3 from dm_private.drawing_uploads where attempt_id='30000000-0000-4000-8000-000000000411'),
 'rejected validation receipts create no additional page');
rollback;
\echo 'PASS: sanitized image receipts bind service, owner, actual Storage MIME/size and the fixed cutoff.'
