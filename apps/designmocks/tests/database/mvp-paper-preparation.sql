-- Fictional canonical content only. Run after the paid MVP profile is installed.
begin;
create function pg_temp.prepare_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.prepare_reject(plan jsonb,reason text) returns void language plpgsql as $$
begin
 begin perform public.prepare_mvp_paper(plan);
 exception when others then
  if sqlerrm is distinct from reason then raise exception 'Unexpected paper preparation error: %',sqlerrm;end if;
  return;
 end;
 raise exception 'Paper preparation unexpectedly succeeded: %',reason;
end$$;
\ir fixtures/mvp-objective-paper.sql
select pg_temp.seed_mvp_paper('uceed','10000000-0000-4000-8000-000000002101');
insert into auth.users(id)values('00000000-0000-4000-8000-000000002101'),('00000000-0000-4000-8000-000000002102');
insert into dm_private.admins(user_id)values('00000000-0000-4000-8000-000000002101');
insert into dm_private.bank_import_runs(id,source_commit,source_path,source_sha256,schema_version,source_total,eligible_total,held_total,imported_count,status)
values('30000000-0000-4000-8000-000000002101',repeat('a',40),'server/data/exports/dexam-bank-export.json',repeat('b',64),1,57,57,0,57,'completed');
insert into dm_private.bank_import_run_items(run_id,external_key,content_sha256)
select '30000000-0000-4000-8000-000000002101',external_key,content_sha256 from dm_private.bank_questions where external_key like 'mvp-original-%';
select set_config('test.prepare.path','papers/canonical/'||repeat('c',64)||'.png',true);
insert into dm_private.bank_media_assets(sha256,storage_path,width,height,byte_size)
values(repeat('c',64),current_setting('test.prepare.path'),1,1,68);
insert into storage.objects(bucket_id,name,metadata)
values('paper-media',current_setting('test.prepare.path'),'{"mimetype":"image/png","size":68}');
update dm_private.bank_questions set
 payload=jsonb_set(payload,'{assets}',jsonb_build_array(jsonb_build_object('sha256',repeat('c',64),'width',1,'height',1,'path','fictional.png'))),
 runtime_payload=jsonb_set(runtime_payload,'{media}',jsonb_build_array(jsonb_build_object('sha256',repeat('c',64),'width',1,'height',1,'path',current_setting('test.prepare.path'),'alt','Question figure 1')))
where external_key='mvp-original-1';
-- The updated fictional runtime requires the fixture's next review decision.
update dm_private.bank_questions set owner_approved=true,rights_confirmed=true where external_key='mvp-original-1';
select set_config('test.prepare.plan',jsonb_build_object(
 'packetSha256',repeat('d',64),'sourceSha256',repeat('b',64),'exam','uceed','title','UCEED Part A fictional prepared paper','durationSeconds',7200,
 'media',jsonb_build_array(jsonb_build_object('sha256',repeat('c',64),'width',1,'height',1,'path',current_setting('test.prepare.path'),'byteSize',68)),
 'questions',(select jsonb_agg(jsonb_build_object('externalKey',b.external_key,'contentSha256',b.content_sha256,'licence',b.licence,
  'payload',b.payload,'runtime',b.runtime_payload) order by q.ordinal) from dm_private.questions q
 join dm_private.bank_questions b on b.external_key='mvp-original-'||q.ordinal where q.paper_id='10000000-0000-4000-8000-000000002101')
)::text,true) is not null;
select pg_temp.prepare_assert(not has_function_privilege('anon','public.prepare_mvp_paper(jsonb)','EXECUTE')
 and not has_function_privilege('authenticated','public.prepare_mvp_paper(jsonb)','EXECUTE')
 and has_function_privilege('service_role','public.prepare_mvp_paper(jsonb)','EXECUTE')
 and not has_table_privilege('service_role','dm_private.mvp_prepared_papers','INSERT')
 and not has_table_privilege('authenticated','dm_private.mvp_prepared_papers','SELECT'),
 'only a server credential can prepare; private receipt rows cannot be accessed directly');

set local role service_role;select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.prepare_reject(jsonb_set(current_setting('test.prepare.plan')::jsonb,'{sourceSha256}',to_jsonb(repeat('f',64))),
 'Current reviewed canonical bank versions are required');
select pg_temp.prepare_reject(jsonb_set(current_setting('test.prepare.plan')::jsonb,'{questions,0,runtime,key,accepted,0,exact}','"999"'),
 'Current reviewed canonical bank versions are required');
select pg_temp.prepare_reject(jsonb_set(current_setting('test.prepare.plan')::jsonb,'{media}','[]'),
 'Verified private paper figures are required');
select pg_temp.prepare_reject(jsonb_set(current_setting('test.prepare.plan')::jsonb,'{media,0,byteSize}','69'),
 'Verified private paper figures are required');
with plan as(select current_setting('test.prepare.plan')::jsonb p)
select pg_temp.prepare_reject(jsonb_set(jsonb_set(p,'{questions,0}',p->'questions'->56),'{questions,56}',p->'questions'->0),
 'The paper no longer matches the reviewed Part A manifest') from plan;
reset role;
select pg_temp.prepare_assert((select count(*)=1 from dm_private.papers where title like '%fictional%') and
 not exists(select 1 from dm_private.mvp_prepared_papers),'failed preparations roll back every row');
update dm_private.registration_policy set mode='open' where id;
set local role service_role;
select pg_temp.prepare_reject(current_setting('test.prepare.plan')::jsonb,'Close public registration before preparing a paper');
reset role;
update dm_private.registration_policy set mode='testers' where id;
update dm_private.mvp_test_checkout_control set enabled=true,expires_at=clock_timestamp()+interval'1 hour',
 evidence='Fictional active Test window',actor_id='00000000-0000-4000-8000-000000002101' where singleton;
set local role service_role;
select pg_temp.prepare_reject(current_setting('test.prepare.plan')::jsonb,'The closed paid MVP profile is required');
reset role;
update dm_private.mvp_test_checkout_control set enabled=false,expires_at=null where singleton;
update dm_private.bank_questions set owner_approved=false where external_key='mvp-original-1';
set local role service_role;
select pg_temp.prepare_reject(current_setting('test.prepare.plan')::jsonb,'Current reviewed canonical bank versions are required');
reset role;
update dm_private.bank_questions set owner_approved=true where external_key='mvp-original-1';

set local role service_role;
select set_config('test.prepare.receipt',public.prepare_mvp_paper(current_setting('test.prepare.plan')::jsonb)::text,true);
with receipt as(select current_setting('test.prepare.receipt')::jsonb r)
select pg_temp.prepare_assert(r->'created'='true'::jsonb and r->>'questionCount'='57' and r->>'durationSeconds'='7200'
 and r->>'totalPoints'='200' and r->>'manifestSha256'~'^[a-f0-9]{64}$','frozen paper yields only its exact preparation receipt') from receipt;
select pg_temp.prepare_assert(public.prepare_mvp_paper(current_setting('test.prepare.plan')::jsonb)=
 jsonb_set(current_setting('test.prepare.receipt')::jsonb,'{created}','false'),'exact retry returns the same ID and hash');
select pg_temp.prepare_reject(jsonb_set(current_setting('test.prepare.plan')::jsonb,'{title}','"UCEED Part A another title"'),
 'The reviewed packet identity has changed');
reset role;
select set_config('test.prepare.paper',current_setting('test.prepare.receipt')::jsonb->>'paperId',true);
select pg_temp.prepare_assert((select count(*)=1 from dm_private.mvp_prepared_papers)
 and (select not published and not reviewed and not rights_confirmed from dm_private.papers where id=current_setting('test.prepare.paper')::uuid)
 and not exists(select 1 from dm_private.mvp_paid_releases)
 and not exists(select 1 from dm_private.mvp_release_audit),'preparation leaves paper and release approvals closed');
insert into dm_private.orders(id,user_id,plan_id,amount,currency,mode,provider_order_id)
values('20000000-0000-4000-8000-000000002102','00000000-0000-4000-8000-000000002102','annual',119300,'INR','test','order_mvpPrepFixture');
set local role service_role;
select public.fulfil_verified_payment('evt_mvpPrepFixture','order_mvpPrepFixture','pay_mvpPrepFixture',119300,'INR');
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002102',true);
select pg_temp.prepare_assert(public.available_papers()='[]'::jsonb,'student catalogue cannot see preparation even with a pass');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002101',true);
select pg_temp.prepare_assert((public.admin_mvp_paper_manifest(current_setting('test.prepare.paper')::uuid)->'eligible')='true'::jsonb
 and (public.admin_mvp_paper_manifest(current_setting('test.prepare.paper')::uuid)->'released')='false'::jsonb,
 'staff can inspect the exact unpublished manifest');
reset role;
update dm_private.papers set title='UCEED Part A changed after preparation' where id=current_setting('test.prepare.paper')::uuid;
select pg_temp.prepare_assert(dm_private.mvp_paper_manifest(current_setting('test.prepare.paper')::uuid) is null,'a changed prepared snapshot cannot acquire a new release hash');
update dm_private.papers set title='UCEED Part A fictional prepared paper' where id=current_setting('test.prepare.paper')::uuid;
update storage.buckets set public=true where id='paper-media';
select pg_temp.prepare_assert(dm_private.mvp_paper_manifest(current_setting('test.prepare.paper')::uuid) is null,'a public figure bucket invalidates the prepared manifest');
update storage.buckets set public=false where id='paper-media';
set local role authenticated;
select pg_temp.prepare_assert(public.admin_release_mvp_paper(current_setting('test.prepare.paper')::uuid,
 current_setting('test.prepare.receipt')::jsonb->>'manifestSha256','Fictional reviewed source and presentation approval')->>'questionCount'='57',
 'separate authenticated release still accepts the exact prepared manifest');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002102',true);
select pg_temp.prepare_assert(jsonb_array_length(public.available_papers())=1 and
 public.available_papers()->0->>'id'=current_setting('test.prepare.paper'),'only explicit release makes the prepared paper student-visible');
set local role service_role;select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.prepare_reject(current_setting('test.prepare.plan')::jsonb,'The prepared paper already has a release decision');
rollback;
\echo 'PASS: private paper preparation, exact canonical and media validation, idempotent retry and separate release.'
