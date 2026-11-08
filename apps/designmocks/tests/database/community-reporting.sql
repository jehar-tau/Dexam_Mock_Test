\set ON_ERROR_STOP on
begin;
create function pg_temp.current_moderate(kind text,id uuid,action text,note text) returns jsonb language sql as $$
 select public.admin_moderate_community(kind,id,action,note,public.admin_review_community_content(kind,id)->>'reviewVersion',gen_random_uuid())
$$;
create function pg_temp.reporting_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
create function pg_temp.reporting_reject(statement text,expected_state text,expected_detail text default null) returns void language plpgsql as $$
declare actual_state text; actual_detail text;
begin
 begin execute statement;
 exception when others then
  get stacked diagnostics actual_state=returned_sqlstate,actual_detail=pg_exception_detail;
  if actual_state=expected_state and (expected_detail is null or expected_detail=actual_detail) then return;end if;
  raise exception 'FAIL: expected state/detail % / %, received % / %',expected_state,expected_detail,actual_state,actual_detail;
 end;
 raise exception 'FAIL: report should be rejected';
end $$;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000781'),('00000000-0000-4000-8000-000000000782'),('00000000-0000-4000-8000-000000000783');
insert into dm_private.admins(user_id) values('00000000-0000-4000-8000-000000000783');
insert into dm_private.community_posts(id,author_id,exam,topic,title,body)
 select md5('reporting-post-'||g)::uuid,'00000000-0000-4000-8000-000000000781','uceed','fictional','Fictional reporting target '||g,'An original fictional discussion for reporting acceptance.' from generate_series(1,12)g;
insert into dm_private.community_comments(id,post_id,author_id,body)
 values('20000000-0000-4000-8000-000000000781',md5('reporting-post-1')::uuid,'00000000-0000-4000-8000-000000000781','An original fictional reported reply.');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000782',true);
select public.report_community_content(md5('reporting-post-1')::uuid,null,'spam','  An original fictional spam report.  ');
select public.report_community_content(md5('reporting-post-2')::uuid,null,'abuse',null);
select public.report_community_content(md5('reporting-post-3')::uuid,null,'copyright','A fictional permission concern.');
select public.report_community_content(md5('reporting-post-4')::uuid,null,'answer_leak','A fictional active-paper concern.');
select public.report_community_content(md5('reporting-post-5')::uuid,null,'other','   ');
select public.report_community_content(null,'20000000-0000-4000-8000-000000000781','other','An exact fictional reply report.');
select pg_temp.reporting_reject('select public.report_community_content(null,null,''spam'',null)','22023','community_report_invalid');
select pg_temp.reporting_reject('select public.report_community_content(md5(''reporting-post-6'')::uuid,''20000000-0000-4000-8000-000000000781'',''spam'',null)','22023','community_report_invalid');
select pg_temp.reporting_reject('select public.report_community_content(md5(''reporting-post-6'')::uuid,null,null,null)','22023','community_report_invalid');
select pg_temp.reporting_reject('select public.report_community_content(md5(''reporting-post-6'')::uuid,null,''invalid'',null)','22023','community_report_invalid');
select pg_temp.reporting_reject('select public.report_community_content(md5(''reporting-post-6'')::uuid,null,''other'',repeat(''x'',1001))','22023','community_report_invalid');
select pg_temp.reporting_reject('select public.report_community_content(md5(''reporting-post-1'')::uuid,null,''copyright'',''A changed report must not replace the first one.'')','23505','community_report_exists');
select public.report_community_content(md5('reporting-post-'||g)::uuid,null,'other',null) from generate_series(6,9)g;
select pg_temp.reporting_reject('select public.report_community_content(md5(''reporting-post-10'')::uuid,null,''other'',null)','P0001','community_report_limit');
select pg_temp.reporting_reject('select public.report_community_content(md5(''reporting-post-1'')::uuid,null,''spam'',''An original fictional spam report.'')','23505','community_report_exists');
reset role;
select pg_temp.reporting_assert((select count(*)=10 from dm_private.community_reports where reporter_id='00000000-0000-4000-8000-000000000782'),'new reports share the unchanged ten-per-hour cap');
select pg_temp.reporting_assert((select reason='spam' and details='An original fictional spam report.' from dm_private.community_reports where reporter_id='00000000-0000-4000-8000-000000000782' and post_id=md5('reporting-post-1')::uuid),'first reason/details remain unchanged after duplicate requests');
select pg_temp.reporting_assert((select details is null from dm_private.community_reports where reporter_id='00000000-0000-4000-8000-000000000782' and post_id=md5('reporting-post-5')::uuid),'blank details are stored as absent');
select pg_temp.reporting_assert((select comment_id='20000000-0000-4000-8000-000000000781' and post_id is null from dm_private.community_reports where comment_id='20000000-0000-4000-8000-000000000781'),'reply reporting does not silently flag its parent discussion');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000783',true);
select pg_temp.current_moderate('post',md5('reporting-post-1')::uuid,'hide','Fictional post hidden after report.');
select pg_temp.current_moderate('comment','20000000-0000-4000-8000-000000000781','hide','Fictional reply hidden after report.');
select pg_temp.current_moderate('post',md5('reporting-post-11')::uuid,'lock','Fictional readable locked discussion.');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000782',true);
select pg_temp.reporting_reject('select public.report_community_content(md5(''reporting-post-1'')::uuid,null,''spam'',null)','23505','community_report_exists');
select pg_temp.reporting_reject('select public.report_community_content(null,''20000000-0000-4000-8000-000000000781'',''other'',null)','23505','community_report_exists');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000781',true);
select pg_temp.reporting_reject('select public.report_community_content(md5(''reporting-post-1'')::uuid,null,''other'',null)','42501','community_report_unavailable');
select pg_temp.reporting_reject('select public.report_community_content(null,''20000000-0000-4000-8000-000000000781'',''other'',null)','42501','community_report_unavailable');
select pg_temp.reporting_reject('select public.report_community_content(md5(''reporting-post-missing'')::uuid,null,''other'',null)','42501','community_report_unavailable');
select public.report_community_content(md5('reporting-post-11')::uuid,null,'other','Locked content remains readable and reportable.');
select pg_temp.reporting_reject('select * from dm_private.community_reports','42501');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.reporting_reject('select public.report_community_content(md5(''reporting-post-12'')::uuid,null,''other'',null)','42501','community_report_sign_in');
reset role;
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
select pg_temp.reporting_reject('select public.report_community_content(md5(''reporting-post-12'')::uuid,null,''other'',null)','42501');
reset role;
rollback;
\echo 'PASS: reason/details target identity, ten-report quota, duplicate receipts before limits/visibility, unchanged original notes, hidden/locked scope and account isolation.'
