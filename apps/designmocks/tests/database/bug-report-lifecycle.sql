\set ON_ERROR_STOP on
begin;
create function pg_temp.bug_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.bug_reject(statement text,state text,detail text default null)returns void language plpgsql as $$
declare actual_state text;actual_detail text;
begin
 begin execute statement;
 exception when others then
  get stacked diagnostics actual_state=returned_sqlstate,actual_detail=pg_exception_detail;
  if actual_state=state and(detail is null or actual_detail=detail)then return;end if;
  raise exception 'FAIL: expected % / %, received % / %',state,detail,actual_state,actual_detail;
 end;
 raise exception 'FAIL: expected rejected support action';
end$$;
insert into auth.users(id)values('00000000-0000-4000-8000-000000001101'),('00000000-0000-4000-8000-000000001102'),('00000000-0000-4000-8000-000000001103');
insert into dm_private.admins(user_id)values('00000000-0000-4000-8000-000000001103');
select pg_temp.bug_assert(not has_function_privilege('anon','public.submit_bug_report(text,text,text,uuid)','execute')and not has_function_privilege('anon','public.my_bug_report_page(jsonb,integer)','execute'),'anonymous report functions denied');
select pg_temp.bug_assert(not has_function_privilege('authenticated','dm_private.create_bug_report(text,text,text,uuid)','execute'),'private creator denied');
select pg_temp.bug_assert(not has_table_privilege('authenticated','dm_private.bug_report_receipts','select')and not has_table_privilege('authenticated','dm_private.bug_report_updates','select'),'private request and staff history denied');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001101',true);
select public.submit_bug_report('  Original fictional support title  ','  An original fictional support description.  ','https://fictional-user:fictional-secret@dmocks.com/report?private=first#private','10000000-0000-4000-8000-000000001101')as first_report\gset
select pg_temp.bug_assert(public.submit_bug_report('Original fictional support title','An original fictional support description.','https://dmocks.com/report?private=second','10000000-0000-4000-8000-000000001101')=:'first_report'::uuid,'normalized replay reuses the same report and redacted source');
select pg_temp.bug_reject('select public.submit_bug_report(''A changed support title'',''An original fictional support description.'',''https://dmocks.com/report'',''10000000-0000-4000-8000-000000001101'')','22023','bug_report_conflict');
select pg_temp.bug_reject('select public.submit_bug_report(''Valid title'',''A complete description.'',null,null)','22023','bug_report_invalid');
select pg_temp.bug_reject('select public.submit_bug_report(null,''A complete description.'',null,gen_random_uuid())','22023','bug_report_invalid');
select pg_temp.bug_reject('select public.submit_bug_report(''Valid title'',''short'',null,gen_random_uuid())','22023','bug_report_invalid');
select pg_temp.bug_reject('select public.submit_bug_report(repeat(''x'',141),''A complete description.'',null,gen_random_uuid())','22023','bug_report_invalid');
select pg_temp.bug_reject('select public.submit_bug_report(''Valid title'',repeat(''x'',5001),null,gen_random_uuid())','22023','bug_report_invalid');
select public.submit_bug_report('Original fictional legacy report','An original fictional legacy description.','/account?private=secret#private');
select public.submit_bug_report('Original fictional report '||g,'A complete original fictional report description.',null,md5('bug-lifecycle-request-'||g)::uuid)from generate_series(1,3)g;
select pg_temp.bug_reject('select public.submit_bug_report(''An excess support title'',''A complete original fictional description.'',null,gen_random_uuid())','P0001','bug_report_limit');
select pg_temp.bug_assert(public.submit_bug_report('Original fictional support title','An original fictional support description.','https://dmocks.com/report','10000000-0000-4000-8000-000000001101')=:'first_report'::uuid,'replay precedes the five-report quota');
reset role;
select pg_temp.bug_assert((select count(*)=5 from dm_private.bug_reports where reporter_id='00000000-0000-4000-8000-000000001101'),'new and legacy signatures share one quota');
select pg_temp.bug_assert((select page_url='https://dmocks.com/report'from dm_private.bug_reports where id=:'first_report'),'query and fragment never retained');
select pg_temp.bug_assert((select page_url='/account'from dm_private.bug_reports where title='Original fictional legacy report'),'legacy contexts are also redacted');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001102',true);
select public.submit_bug_report('Original fictional support title','An original fictional support description.','https://dmocks.com/report','10000000-0000-4000-8000-000000001101')as other_report\gset
select pg_temp.bug_assert(:'first_report'::uuid<>:'other_report'::uuid,'another account cannot borrow a receipt');
select pg_temp.bug_reject(format('select public.admin_reply_bug_report(%L,''fixed'',''A fictional team reply.'')',:'first_report'),'42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001103',true);
select public.admin_reply_bug_report(:'first_report','fixed','A complete original fictional team reply.');
reset role;
select pg_temp.bug_assert((select count(*)=1 from dm_private.bug_report_updates where report_id=:'first_report'and actor_id='00000000-0000-4000-8000-000000001103'and previous_status='open'and status='fixed'),'staff reply retains its actor and prior status');
select updated_at::text as updated from dm_private.bug_reports where id=:'first_report'\gset
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001101',true);
select public.submit_bug_report('Original fictional support title','An original fictional support description.','https://dmocks.com/report','10000000-0000-4000-8000-000000001101');
reset role;
select pg_temp.bug_assert((select status='fixed'and admin_reply='A complete original fictional team reply.'and updated_at=:'updated'::timestamptz from dm_private.bug_reports where id=:'first_report'),'receipt replay never reopens or edits a replied report');
insert into dm_private.bug_reports(id,reporter_id,title,description,created_at,updated_at)
 select md5('bug-history-'||g)::uuid,'00000000-0000-4000-8000-000000001101','Original fictional history '||g,'A complete original fictional history description.',
 '2026-01-01T12:00:00.123456Z'::timestamptz+(g%3)*interval'1 microsecond','2026-01-01T12:00:00.123456Z'::timestamptz from generate_series(1,31)g;
set local role authenticated;
select public.my_bug_report_page()as page_one\gset
select public.my_bug_report_page(:'page_one'::jsonb->'nextCursor')as page_two\gset
select pg_temp.bug_assert(jsonb_array_length(:'page_one'::jsonb->'items')=25 and jsonb_array_length(:'page_two'::jsonb->'items')=11 and :'page_two'::jsonb->'nextCursor'='null'::jsonb,'all own reports traverse bounded pages');
select pg_temp.bug_assert((select count(distinct row->>'id')=36 from jsonb_array_elements((:'page_one'::jsonb->'items')||(:'page_two'::jsonb->'items'))row),'tied microseconds and UUIDs lose or duplicate no reports');
select pg_temp.bug_assert(:'page_one'::jsonb#>>'{nextCursor,createdAt}'~'\.\d{6}Z$','cursor retains raw microseconds');
select pg_temp.bug_reject('select public.my_bug_report_page(null,null)','22023');
select pg_temp.bug_reject('select public.my_bug_report_page(null,26)','22023');
select pg_temp.bug_reject('select public.my_bug_report_page(''[]'')','22023');
select pg_temp.bug_reject('select public.my_bug_report_page(''{}'')','22023');
select pg_temp.bug_reject(format('select public.my_bug_report_page(%L::jsonb)',jsonb_set(:'page_one'::jsonb->'nextCursor','{createdAt}','"invalid"')),'22023');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001102',true);
select pg_temp.bug_assert(jsonb_array_length(public.my_bug_report_page()->'items')=1,'another account sees only its own report');
select pg_temp.bug_reject(format('select public.my_bug_report_page(%L::jsonb)',:'page_one'::jsonb->'nextCursor'),'22023');
reset role;
update dm_private.bug_reports set created_at=clock_timestamp()-interval'2 hours'where reporter_id='00000000-0000-4000-8000-000000001101'and created_at>clock_timestamp()-interval'1 hour';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001101',true);
select public.submit_bug_report('Original fictional newer report','A complete original fictional newer description.',null,gen_random_uuid())as newer_report\gset
select pg_temp.bug_assert(not exists(select 1 from jsonb_array_elements(public.my_bug_report_page(:'page_one'::jsonb->'nextCursor')->'items')row where row->>'id'=:'newer_report'),'later creations cannot enter an older reading snapshot');
select pg_temp.bug_assert(public.my_bug_report_page()#>>'{items,0,id}'=:'newer_report','fresh refresh includes the new report');
select public.export_my_account_data()as own_export\gset
select pg_temp.bug_assert(:'own_export'::jsonb#>>'{bugReports,0,id}'is not null and position('input_hash'in :'own_export')=0 and position('10000000-0000-4000-8000-000000001101'in :'own_export')=0,'owned export excludes private receipt fingerprints and keys');
reset role;
create function pg_temp.revoke_bug_admin()returns trigger language plpgsql as $$begin delete from dm_private.admins where user_id=auth.uid();return new;end$$;
create trigger test_bug_admin_revoke before insert on dm_private.bug_report_updates for each row execute function pg_temp.revoke_bug_admin();
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001103',true);
select pg_temp.bug_reject(format('select public.admin_reply_bug_report(%L,''closed'',''A late reply must roll back.'')',:'first_report'),'42501');
reset role;
select pg_temp.bug_assert((select status='fixed'and admin_reply='A complete original fictional team reply.'from dm_private.bug_reports where id=:'first_report')and(select count(*)=1 from dm_private.bug_report_updates where report_id=:'first_report'),'final role check rolls back both reply and staff history');
select 'PASS: account-bound support receipts, shared quota, bounded microsecond history, private roles, redacted contexts and audited staff reply.';
rollback;
