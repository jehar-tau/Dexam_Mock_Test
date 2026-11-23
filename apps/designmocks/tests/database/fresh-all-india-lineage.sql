-- Fictional paper-derived All India cohort. All data rolls back.
\set ON_ERROR_STOP on
begin;
\ir fixtures/release-bank-year.sql
\ir fixtures/released-parallel-questions.sql
create function pg_temp.fresh_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.fresh_reject(statement text,expected text) returns void language plpgsql as $$
begin begin execute statement;exception when others then
  if position(expected in sqlerrm)>0 then return;end if;raise;end;
  raise exception 'FAIL, unexpectedly accepted: %',expected;
end$$;
insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000003401'),
  ('00000000-0000-4000-8000-000000003402'),
  ('00000000-0000-4000-8000-000000003403');
insert into dm_private.admins(user_id) values('00000000-0000-4000-8000-000000003401');
insert into public.profiles(user_id,display_name,phone_e164,phone_verified_at,appearing_year,city,exams,onboarding_completed_at)
  select id,'Fictional parallel student','+9199992034'||right(id::text,2),now(),2027,'Pune',array['uceed'],now()
  from auth.users where id in('00000000-0000-4000-8000-000000003402',
    '00000000-0000-4000-8000-000000003403');
with paid as(insert into dm_private.orders(user_id,plan_id,amount,currency,mode,status)
  select user_id,'annual',119300,'INR','test','paid' from public.profiles
  where user_id in('00000000-0000-4000-8000-000000003402',
    '00000000-0000-4000-8000-000000003403') returning id,user_id)
insert into dm_private.passes(user_id,order_id,mode,starts_at,expires_at)
  select user_id,id,'test',now(),now()+interval '1 year' from paid;
select pg_temp.fresh_assert(to_regprocedure(
  'public.admin_create_all_india_event(text,text,timestamptz,integer,integer)') is null,
  'obsolete five-argument function cannot bypass the fresh pool');
select pg_temp.fresh_assert(not has_table_privilege('authenticated',
  'dm_private.parallel_question_routes','SELECT')
  and not has_function_privilege('authenticated','dm_private.parallel_question_ready(text)','EXECUTE')
  and not has_function_privilege('authenticated',
    'public.register_parallel_question(text,text,text,uuid,text)','EXECUTE'),
  'students cannot inspect or register private parallel routes');
select set_config('test.fresh_year',pg_temp.seed_released_parallel_questions(
  'uceed','{"mcq":10}'::jsonb,'fresh-cohort')::text,true);
select pg_temp.fresh_assert((select count(*)=10 from dm_private.parallel_question_routes
  where source_year_paper_id=current_setting('test.fresh_year')::uuid and all_india_event_id is null)
  and dm_private.year_paper_ready(current_setting('test.fresh_year')::uuid),
  'ten separately reviewed fresh derivatives link to one complete source paper');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003403',true);
select pg_temp.fresh_reject('select public.admin_create_all_india_event(''uceed'',''Fictional cohort'',now()+interval ''1 hour'',10,900)',
  'Admin access required');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003401',true);
select pg_temp.fresh_reject('select public.admin_create_all_india_event(''uceed'',''Fictional cohort'',now()+interval ''1 hour'',11,900)',
  'Not enough reviewed fresh parallel questions');
select pg_temp.fresh_reject('select public.admin_create_all_india_event(''uceed'',''Fictional cohort'',now()+interval ''1 hour'',10,900,1,900)',
  'Only objective All India events are available');
select set_config('test.fresh_event',public.admin_create_all_india_event(
  'uceed','Fictional cohort',now()+interval '1 hour',10,900)::text,true);
reset role;
select pg_temp.fresh_assert((select count(*)=10 and count(distinct all_india_event_id)=1
  from dm_private.parallel_question_routes where all_india_event_id=current_setting('test.fresh_event')::uuid)
  and dm_private.all_india_parallel_ready(current_setting('test.fresh_event')::uuid)
  and (select count(*)=10 from dm_private.questions q join dm_private.all_india_events e on e.paper_id=q.paper_id
    join dm_private.answer_keys k on k.question_id=q.id where e.id=current_setting('test.fresh_event')::uuid
      and k.key->>'sourceExternalKey' like 'fresh-cohort-parallel-%'),
  'event freezes exactly the reviewed parallel pool, never the year-paper originals');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003401',true);
select pg_temp.fresh_reject('select public.admin_create_all_india_event(''uceed'',''Another fictional cohort'',now()+interval ''21 days'',10,900)',
  'Not enough reviewed fresh parallel questions');
reset role;
update dm_private.all_india_events set starts_at=now()-interval '1 day',
  ends_at=now()+interval '9 days',review_ends_at=now()+interval '19 days'
  where id=current_setting('test.fresh_event')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003402',true);
select set_config('test.fresh_attempt',public.start_all_india_attempt(current_setting('test.fresh_event')::uuid)::text,true);
reset role;
select pg_temp.fresh_assert((select count(*)=10 from dm_private.attempt_items
  where attempt_id=current_setting('test.fresh_attempt')::uuid),
  'first student gets ten frozen event items');
savepoint missing_media;
insert into dm_private.bank_media_assets(sha256,storage_path,width,height,byte_size)
  values(repeat('c',64),'papers/canonical/'||repeat('c',64)||'.png',1,1,99);
insert into storage.objects(bucket_id,name,metadata)
  values('paper-media','papers/canonical/'||repeat('c',64)||'.png',
    '{"mimetype":"image/png","size":99}'::jsonb);
update dm_private.bank_questions set runtime_payload=jsonb_set(runtime_payload,'{media}',
  jsonb_build_array(jsonb_build_object('sha256',repeat('c',64),
    'path','papers/canonical/'||repeat('c',64)||'.png','width',1,'height',1)))
  where external_key='fresh-cohort-parallel-mcq-1';
update dm_private.bank_questions set owner_approved=true,rights_confirmed=true
  where external_key='fresh-cohort-parallel-mcq-1';
select pg_temp.fresh_assert(dm_private.parallel_question_ready('fresh-cohort-parallel-mcq-1'),
  'a registered figure is eligible while its exact private bytes exist');
delete from storage.objects where bucket_id='paper-media'
  and name='papers/canonical/'||repeat('c',64)||'.png';
select pg_temp.fresh_assert(not dm_private.parallel_question_ready('fresh-cohort-parallel-mcq-1'),
  'missing private figure bytes pause fresh-question admission');
rollback to savepoint missing_media;
savepoint generated_hold;
insert into dm_private.bank_local_holds(external_key,reason,created_by)
  values('fresh-cohort-parallel-mcq-1','Fictional source under human review',
    '00000000-0000-4000-8000-000000003401');
select pg_temp.fresh_assert(not dm_private.parallel_question_ready('fresh-cohort-parallel-mcq-1')
  and not dm_private.all_india_parallel_ready(current_setting('test.fresh_event')::uuid),
  'a generated-question quality hold pauses the cohort');
rollback to savepoint generated_hold;
savepoint source_invalid;
update dm_private.bank_questions set active=false where external_key='fresh-cohort-source-mcq-1';
select pg_temp.fresh_assert(not dm_private.all_india_parallel_ready(current_setting('test.fresh_event')::uuid),
  'withdrawal of the source year paper pauses the cohort');
rollback to savepoint source_invalid;
update dm_private.bank_questions set content_sha256=repeat('f',64)
  where external_key='fresh-cohort-parallel-mcq-1';
select pg_temp.fresh_assert(not dm_private.all_india_parallel_ready(current_setting('test.fresh_event')::uuid),
  'changed parallel content revokes the fixed event for new starts');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003403',true);
select pg_temp.fresh_assert(public.all_india_event_catalog()->0->>'state'='paused',
  'student catalogue identifies the newly paused cohort');
select pg_temp.fresh_reject('select public.start_all_india_attempt(current_setting(''test.fresh_event'')::uuid)',
  'paused for fresh-question review');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003402',true);
select pg_temp.fresh_assert(jsonb_array_length(public.read_attempt(current_setting('test.fresh_attempt')::uuid)->'questions')=10,
  'existing frozen attempt remains readable after source revocation');
reset role;
rollback;
\echo 'PASS: parallel source registration, fixed one-time cohort, no legacy fallback, revocation and frozen attempts.'
