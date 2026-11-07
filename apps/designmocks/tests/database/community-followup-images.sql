\set ON_ERROR_STOP on
begin;
create function pg_temp.followup_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
create function pg_temp.followup_reject(statement text,expected_state text,expected_detail text default null) returns void language plpgsql as $$
declare actual_state text; actual_detail text;
begin
 begin execute statement;
 exception when others then
  get stacked diagnostics actual_state=returned_sqlstate,actual_detail=pg_exception_detail;
  if actual_state=expected_state and(expected_detail is null or actual_detail=expected_detail) then return;end if;
  raise exception 'FAIL: expected % / %, received % / %',expected_state,expected_detail,actual_state,actual_detail;
 end;
 raise exception 'FAIL: follow-up operation should be rejected';
end $$;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000811'),('00000000-0000-4000-8000-000000000812'),('00000000-0000-4000-8000-000000000813');
insert into dm_private.admins(user_id) values('00000000-0000-4000-8000-000000000813');
insert into dm_private.community_posts(id,author_id,exam,topic,title,body,status) values
 ('10000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000811','uceed','fictional','Original fictional own post','An original fictional post for follow-up image acceptance.','visible'),
 ('10000000-0000-4000-8000-000000000812','00000000-0000-4000-8000-000000000812','uceed','fictional','Original fictional other post','An original fictional other post for follow-up acceptance.','visible'),
 ('10000000-0000-4000-8000-000000000813','00000000-0000-4000-8000-000000000811','uceed','fictional','Original fictional locked post','An original fictional locked post for follow-up acceptance.','locked'),
 ('10000000-0000-4000-8000-000000000814','00000000-0000-4000-8000-000000000811','uceed','fictional','Original fictional hidden post','An original fictional hidden post for follow-up acceptance.','hidden');
insert into dm_private.community_comments(id,post_id,author_id,body,status) values
 ('20000000-0000-4000-8000-000000000811','10000000-0000-4000-8000-000000000812','00000000-0000-4000-8000-000000000811','An original fictional owned reply in another discussion.','visible'),
 ('20000000-0000-4000-8000-000000000812','10000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000812','An original fictional foreign reply in an owned discussion.','visible'),
 ('20000000-0000-4000-8000-000000000813','10000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000811','An original fictional hidden owned reply.','hidden'),
 ('20000000-0000-4000-8000-000000000814','10000000-0000-4000-8000-000000000813','00000000-0000-4000-8000-000000000811','An original fictional owned reply in a locked discussion.','visible');
insert into dm_private.community_assets(uploader_id,post_id,comment_id,storage_path,ordinal,mime_type,byte_size) values
 ('00000000-0000-4000-8000-000000000811','10000000-0000-4000-8000-000000000811',null,'fictional-followup-post-1.png',1,'image/png',10),
 ('00000000-0000-4000-8000-000000000811','10000000-0000-4000-8000-000000000811',null,'fictional-followup-post-3.png',3,'image/png',10),
 ('00000000-0000-4000-8000-000000000811',null,'20000000-0000-4000-8000-000000000811','fictional-followup-reply-2.png',2,'image/png',10);
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000811',true);
select pg_temp.followup_assert(public.community_attachment_slots('post','10000000-0000-4000-8000-000000000811')=
 '{"targetType":"post","targetId":"10000000-0000-4000-8000-000000000811","postId":"10000000-0000-4000-8000-000000000811","occupiedOrdinals":[1,3],"maximum":3}'::jsonb,'post scope has exact identity/occupied positions and no private paths');
select pg_temp.followup_assert(public.community_attachment_slots('comment','20000000-0000-4000-8000-000000000811')->'occupiedOrdinals'='[2]'::jsonb,'own reply works under another author post');
select pg_temp.followup_assert((public.community_thread('10000000-0000-4000-8000-000000000811')->>'isMine')::boolean and(public.community_thread('10000000-0000-4000-8000-000000000811')->>'canAttach')::boolean,'owned post hints permit a free image position');
select pg_temp.followup_assert(not(public.community_thread('10000000-0000-4000-8000-000000000812')->>'isMine')::boolean and not(public.community_thread('10000000-0000-4000-8000-000000000812')->>'canAttach')::boolean,'foreign post hints deny upload presentation');
select pg_temp.followup_assert((public.community_thread('10000000-0000-4000-8000-000000000812')->'comments'->0->>'canAttach')::boolean,'owned reply hint is independent of post authorship');
select pg_temp.followup_assert(not(public.community_thread('10000000-0000-4000-8000-000000000811')->'comments'->0->>'canAttach')::boolean,'post ownership does not grant uploads to another author reply');
select pg_temp.followup_reject('select public.community_attachment_slots(''post'',''10000000-0000-4000-8000-000000000812'')','42501','community_attachments_unavailable');
select pg_temp.followup_reject('select public.community_attachment_slots(''comment'',''20000000-0000-4000-8000-000000000812'')','42501','community_attachments_unavailable');
select pg_temp.followup_reject('select public.community_attachment_slots(''comment'',''20000000-0000-4000-8000-000000000813'')','42501','community_attachments_unavailable');
select pg_temp.followup_reject('select public.community_attachment_slots(''post'',''10000000-0000-4000-8000-000000000813'')','42501','community_attachments_unavailable');
select pg_temp.followup_reject('select public.community_attachment_slots(''post'',''10000000-0000-4000-8000-000000000814'')','42501','community_attachments_unavailable');
select pg_temp.followup_reject('select public.community_attachment_slots(''comment'',''20000000-0000-4000-8000-000000000814'')','42501','community_attachments_unavailable');
select pg_temp.followup_reject('select public.community_attachment_slots(''post'',''10000000-0000-4000-8000-000000000899'')','42501','community_attachments_unavailable');
select pg_temp.followup_reject('select public.community_attachment_slots(''all'',''10000000-0000-4000-8000-000000000811'')','22023','community_attachments_invalid');
select pg_temp.followup_reject('select public.community_attachment_slots(null,''10000000-0000-4000-8000-000000000811'')','22023','community_attachments_invalid');
select pg_temp.followup_reject('select public.community_attachment_slots(''post'',null)','22023','community_attachments_invalid');
reset role;
insert into dm_private.community_assets(uploader_id,post_id,storage_path,ordinal,mime_type,byte_size)
 values('00000000-0000-4000-8000-000000000811','10000000-0000-4000-8000-000000000811','fictional-followup-post-2.png',2,'image/png',10);
set local role authenticated;
select pg_temp.followup_assert(not(public.community_thread('10000000-0000-4000-8000-000000000811')->>'canAttach')::boolean,'full owned target does not offer another upload');
select pg_temp.followup_assert(public.community_attachment_slots('post','10000000-0000-4000-8000-000000000811')->'occupiedOrdinals'='[1,2,3]'::jsonb,'missing physical objects still reserve their immutable registered positions');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000813',true);
select pg_temp.followup_reject('select public.community_attachment_slots(''post'',''10000000-0000-4000-8000-000000000811'')','42501','community_attachments_unavailable');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.followup_reject('select public.community_attachment_slots(''post'',''10000000-0000-4000-8000-000000000811'')','42501','community_attachments_unavailable');
reset role;
set local role anon;
select pg_temp.followup_reject('select public.community_attachment_slots(''post'',''10000000-0000-4000-8000-000000000811'')','42501');
reset role;
set local role service_role;
select pg_temp.followup_reject('select public.community_attachment_slots(''post'',''10000000-0000-4000-8000-000000000811'')','42501');
reset role;
rollback;
\echo 'PASS: owned follow-up inventory, exact post/reply binding, free/full/legacy positions, presentation hints and hidden/locked/foreign/anonymous denial.'
