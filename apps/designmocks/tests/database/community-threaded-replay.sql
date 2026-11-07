\set ON_ERROR_STOP on
begin;
create function pg_temp.thread_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
create function pg_temp.thread_reject(statement text,expected text) returns void language plpgsql as $$
begin begin execute statement;exception when others then if position(expected in sqlerrm)>0 then return;end if;raise;end;raise exception 'FAIL: expected %',expected;end $$;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000601'),('00000000-0000-4000-8000-000000000602'),('00000000-0000-4000-8000-000000000603');
insert into dm_private.admins(user_id) values('00000000-0000-4000-8000-000000000603');
create function pg_temp.thread_post(key uuid) returns jsonb language sql as $$
 select public.create_community_post('uceed','fictional','Fictional stable community discussion','An original fictional question for replay acceptance.',key)
$$;
create function pg_temp.thread_reply(key uuid,body text,parent uuid default null) returns jsonb language sql as $$
 select public.add_community_comment(current_setting('test.thread_post')::uuid,parent,body,key)
$$;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000601',true);
select set_config('test.thread_post',(pg_temp.thread_post('30000000-0000-4000-8000-000000000601')->>'id'),true);
select pg_temp.thread_assert((pg_temp.thread_post('30000000-0000-4000-8000-000000000601')->>'replayed')::boolean,'same post key returns a replay receipt');
select pg_temp.thread_assert(public.create_community_post(' UCEED ',' fictional ',' Fictional stable community discussion ',' An original fictional question for replay acceptance. ','30000000-0000-4000-8000-000000000601')->>'id'=current_setting('test.thread_post'),'normalized input has the same request identity');
select pg_temp.thread_reject('select public.create_community_post(''uceed'',''fictional'',''Different fictional title'',''An original fictional question for replay acceptance.'',''30000000-0000-4000-8000-000000000601'')','different community text');
select pg_temp.thread_reject('select pg_temp.thread_reply(''30000000-0000-4000-8000-000000000601'',''Different operation with the same key.'')','different community text');
select pg_temp.thread_reject('select pg_temp.thread_post(null)','request ID');
select pg_temp.thread_reject('select public.create_community_post(''uceed'','''',''Valid title here'',''A sufficiently detailed fictional question.'',''30000000-0000-4000-8000-000000000609'')','Invalid community post');
select pg_temp.thread_reject('select * from dm_private.community_write_receipts','permission denied');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000602',true);
select set_config('test.thread_other_post',pg_temp.thread_post('30000000-0000-4000-8000-000000000601')->>'id',true);
select pg_temp.thread_assert(current_setting('test.thread_other_post')<>current_setting('test.thread_post'),'another account cannot inherit the original request receipt');
select set_config('test.thread_root',pg_temp.thread_reply('30000000-0000-4000-8000-000000000602','An original fictional root reply.')->>'id',true);
select pg_temp.thread_assert(pg_temp.thread_reply('30000000-0000-4000-8000-000000000602','An original fictional root reply.')->>'id'=current_setting('test.thread_root'),'reply retry returns the same comment');
select pg_temp.thread_reject('select public.add_community_comment(current_setting(''test.thread_other_post'')::uuid,current_setting(''test.thread_root'')::uuid,''A cross-post reply.'',''30000000-0000-4000-8000-000000000610'')','Reply target not found');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000601',true);
select set_config('test.thread_child',pg_temp.thread_reply('30000000-0000-4000-8000-000000000603','An original fictional nested reply.',current_setting('test.thread_root')::uuid)->>'id',true);
select pg_temp.thread_reject('select pg_temp.thread_reply(''30000000-0000-4000-8000-000000000603'',''An original fictional nested reply.'',null)','different community text');
select pg_temp.thread_assert((public.community_thread(current_setting('test.thread_post')::uuid)->'comments'->0->>'parentId') is null,'root parent remains explicit');
select pg_temp.thread_assert((select (item->>'isMine')::boolean from jsonb_array_elements(public.community_thread(current_setting('test.thread_post')::uuid)->'comments') item where item->>'id'=current_setting('test.thread_child')),'own-reply identity is server supplied');
select public.mark_community_helpful(current_setting('test.thread_root')::uuid);
select public.mark_community_helpful(current_setting('test.thread_root')::uuid);
select pg_temp.thread_assert((select item->>'helpful'='1' and (item->>'markedHelpful')::boolean from jsonb_array_elements(public.community_thread(current_setting('test.thread_post')::uuid)->'comments') item where item->>'id'=current_setting('test.thread_root')),'helpful is unique per reader');
reset role;
select pg_temp.thread_assert((select count(*)=1 from dm_private.community_posts where author_id='00000000-0000-4000-8000-000000000601'),'only one post was inserted');
select pg_temp.thread_assert((select count(*)=2 from dm_private.community_comments),'only two reply requests were inserted');
select pg_temp.thread_assert((select thread_revision=1 from dm_private.community_posts where id=current_setting('test.thread_post')::uuid),'new replies and helpful votes do not invalidate reading cursors');
insert into dm_private.community_comments(id,post_id,author_id,body,created_at)
 select md5('thread-page-'||g)::uuid,current_setting('test.thread_post')::uuid,'00000000-0000-4000-8000-000000000602','Original fictional page reply '||g,statement_timestamp()-interval '10 minutes'+(g/3)*interval '1 millisecond' from generate_series(1,28)g;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000601',true);
select set_config('test.thread_first_page',public.community_thread(current_setting('test.thread_post')::uuid)::text,true);
select set_config('test.thread_cursor',(current_setting('test.thread_first_page')::jsonb->'nextCursor')::text,true);
select pg_temp.thread_assert(jsonb_array_length(current_setting('test.thread_first_page')::jsonb->'comments')=25,'legacy reader defaults to a bounded first page');
select set_config('test.thread_late',pg_temp.thread_reply('30000000-0000-4000-8000-000000000611','A late reply after the reading snapshot.')->>'id',true);
select set_config('test.thread_second_page',public.community_thread(current_setting('test.thread_post')::uuid,current_setting('test.thread_cursor')::jsonb,25)::text,true);
select pg_temp.thread_assert(jsonb_array_length(current_setting('test.thread_second_page')::jsonb->'comments')=5,'new replies stay outside the existing timestamp snapshot');
select pg_temp.thread_assert(current_setting('test.thread_second_page')::jsonb->'nextCursor'='null','last page has no next cursor');
select pg_temp.thread_assert((select count(distinct item->>'id')=30 from jsonb_array_elements((current_setting('test.thread_first_page')::jsonb->'comments')||(current_setting('test.thread_second_page')::jsonb->'comments'))item),'keyset pages contain each original reply once');
select pg_temp.thread_reject('select public.community_thread(current_setting(''test.thread_post'')::uuid,null,51)','Invalid community page size');
select pg_temp.thread_reject('select public.community_thread(current_setting(''test.thread_post'')::uuid,''{}'',25)','Invalid community cursor');
select pg_temp.thread_reject('select public.community_thread(current_setting(''test.thread_post'')::uuid,jsonb_set(current_setting(''test.thread_cursor'')::jsonb,''{version}'',''1.5''),25)','Invalid community cursor');

-- Anchored reads use the same bounded reader, ordering, version fence and role scope.
select set_config('test.thread_anchor',public.community_reply_context(current_setting('test.thread_post')::uuid,(current_setting('test.thread_first_page')::jsonb->'comments'->0->>'id')::uuid,1)::text,true);
select pg_temp.thread_assert(not(current_setting('test.thread_anchor')::jsonb->>'hasEarlier')::boolean and jsonb_array_length(current_setting('test.thread_anchor')::jsonb->'comments')=1,'the first anchor does not claim a gap and obeys a one-row limit');
select pg_temp.thread_assert(current_setting('test.thread_anchor')::jsonb->>'anchorId'=current_setting('test.thread_first_page')::jsonb->'comments'->0->>'id','anchor identity is explicit');
select pg_temp.thread_assert(current_setting('test.thread_first_page')::jsonb->'comments'->0->>'createdAt'=current_setting('test.thread_first_page')::jsonb->'comments'->1->>'createdAt','fixture includes tied timestamps');
select pg_temp.thread_assert(public.community_reply_context(current_setting('test.thread_post')::uuid,(current_setting('test.thread_first_page')::jsonb->'comments'->1->>'id')::uuid,1)->'comments'->0->>'id'=current_setting('test.thread_first_page')::jsonb->'comments'->1->>'id','a tied timestamp anchor is disambiguated by UUID');
select pg_temp.thread_assert((public.community_reply_context(current_setting('test.thread_post')::uuid,(current_setting('test.thread_first_page')::jsonb->'comments'->24->>'id')::uuid,25)->>'hasEarlier')::boolean,'a later anchor explicitly identifies skipped earlier replies');
select pg_temp.thread_assert(jsonb_array_length(public.community_reply_context(current_setting('test.thread_post')::uuid,current_setting('test.thread_late')::uuid,25)->'comments')=1,'a newly confirmed last reply is visible even outside a prior snapshot');
select pg_temp.thread_assert(public.community_thread(current_setting('test.thread_post')::uuid,current_setting('test.thread_anchor')::jsonb->'nextCursor',1)->'comments'->0->>'id'=current_setting('test.thread_first_page')::jsonb->'comments'->1->>'id','anchor continuation uses the normal keyset contract');
select pg_temp.thread_reject('select public.community_reply_context(current_setting(''test.thread_post'')::uuid,current_setting(''test.thread_root'')::uuid,26)','Invalid community page size');
select pg_temp.thread_reject('select public.community_reply_context(current_setting(''test.thread_post'')::uuid,current_setting(''test.thread_root'')::uuid,null)','Invalid community page size');
select pg_temp.thread_reject('select public.community_reply_context(current_setting(''test.thread_other_post'')::uuid,current_setting(''test.thread_root'')::uuid,1)','Reply target not found');
select pg_temp.thread_reject('select public.community_reply_context(current_setting(''test.thread_post'')::uuid,''30000000-0000-4000-8000-000000000699'',1)','Reply target not found');

-- Hit the same limits using the legacy signatures; confirmed request replays still work.
select public.create_community_post('uceed','fictional','Fictional limit post '||g,'An original fictional rate-limit discussion.') from generate_series(1,4)g;
select pg_temp.thread_assert(pg_temp.thread_post('30000000-0000-4000-8000-000000000601')->>'id'=current_setting('test.thread_post'),'post replay is safe after the hourly quota is full');
select pg_temp.thread_reject('select pg_temp.thread_post(''30000000-0000-4000-8000-000000000612'')','Too many community posts');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000602',true);
select pg_temp.thread_reply('30000000-0000-4000-8000-000000000613','The thirtieth fictional reply.');
select pg_temp.thread_assert(pg_temp.thread_reply('30000000-0000-4000-8000-000000000602','An original fictional root reply.')->>'id'=current_setting('test.thread_root'),'reply replay is safe after the hourly quota is full');
select pg_temp.thread_reject('select pg_temp.thread_reply(''30000000-0000-4000-8000-000000000614'',''An over-limit fictional reply.'')','Too many replies');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000603',true);
select public.admin_moderate_community('comment',current_setting('test.thread_root')::uuid,'hide','Fictional parent redaction.');
select pg_temp.thread_reject('select public.community_thread(current_setting(''test.thread_post'')::uuid,current_setting(''test.thread_cursor'')::jsonb,25)','Discussion changed');
select pg_temp.thread_reject('select public.community_reply_context(current_setting(''test.thread_post'')::uuid,current_setting(''test.thread_root'')::uuid,1)','Reply target not found');
select pg_temp.thread_assert((select item->'parentPreview'='null' and not(item->>'parentAvailable')::boolean from jsonb_array_elements(public.community_thread(current_setting('test.thread_post')::uuid,null,50)->'comments') item where item->>'id'=current_setting('test.thread_child')),'visible children retain a tombstone without the hidden parent content');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000601',true);
select pg_temp.thread_reject('select pg_temp.thread_reply(''30000000-0000-4000-8000-000000000615'',''A reply to a hidden parent.'',current_setting(''test.thread_root'')::uuid)','Reply target not found');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000603',true);
select public.admin_moderate_community('post',current_setting('test.thread_post')::uuid,'lock','Fictional locked discussion.');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000601',true);
select pg_temp.thread_assert(not(pg_temp.thread_post('30000000-0000-4000-8000-000000000601')->>'canUpload')::boolean,'a replay does not reopen a locked post');
select pg_temp.thread_reject('select pg_temp.thread_reply(''30000000-0000-4000-8000-000000000616'',''A reply to a locked post.'')','unavailable or locked');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000603',true);
select public.admin_moderate_community('post',current_setting('test.thread_post')::uuid,'hide','Fictional hidden discussion.');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000601',true);
select pg_temp.thread_assert(pg_temp.thread_post('30000000-0000-4000-8000-000000000601')->>'status'='hidden','owner receipt preserves hidden status without publishing content');
select pg_temp.thread_reject('select public.community_thread(current_setting(''test.thread_post'')::uuid)','Post not found');
select pg_temp.thread_reject('select public.community_reply_context(current_setting(''test.thread_post'')::uuid,current_setting(''test.thread_child'')::uuid,1)','Post not found');
reset role;
select pg_temp.thread_assert((select count(*)=2 from dm_private.community_write_receipts where request_id='30000000-0000-4000-8000-000000000601'),'receipts are scoped to the account');
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.thread_reject('select pg_temp.thread_post(''30000000-0000-4000-8000-000000000620'')','permission denied');
select pg_temp.thread_reject('select public.community_thread(current_setting(''test.thread_post'')::uuid,null,25)','permission denied');
select pg_temp.thread_reject('select public.community_reply_context(current_setting(''test.thread_post'')::uuid,current_setting(''test.thread_child'')::uuid,1)','permission denied');
reset role;
rollback;
\echo 'PASS: account-bound text replay, exact request context, legacy quotas, nested replies, bounded snapshot/anchor cursors, redaction invalidation and role isolation.'
