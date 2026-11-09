\set ON_ERROR_STOP on
begin;

create function pg_temp.ranking_assert(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
end $$;
create function pg_temp.ranking_reject(statement text,expected_state text,expected_message text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate=expected_state and position(expected_message in sqlerrm)>0 then return; end if;
    raise;
  end;
  raise exception 'FAIL, expected %: %',expected_state,expected_message;
end $$;

select set_config('test.ranking_event',md5('ranking-event')::uuid::text,true),
  set_config('test.ranking_legacy',md5('ranking-legacy')::uuid::text,true),
  set_config('test.ranking_admin',md5('ranking-operator')::uuid::text,true);
insert into auth.users(id,email_confirmed_at)
  select md5('ranking-candidate-'||n)::uuid,now() from generate_series(1,14)n;
insert into auth.users(id,email_confirmed_at) values(current_setting('test.ranking_admin')::uuid,now());
update auth.users set email_confirmed_at=null where id=md5('ranking-candidate-13')::uuid;
update auth.users set is_anonymous=true where id=md5('ranking-candidate-14')::uuid;
insert into dm_private.admins(user_id) values(current_setting('test.ranking_admin')::uuid);
insert into dm_private.papers(id,title,exam,duration_seconds,source_kind)
values(md5('ranking-paper')::uuid,'Fictional ranking paper','uceed',600,'all_india'),
      (md5('ranking-legacy-paper')::uuid,'Fictional older paper','uceed',600,'all_india');
insert into dm_private.all_india_events(id,exam,title,paper_id,starts_at,ends_at,review_ends_at,created_by)
values(current_setting('test.ranking_event')::uuid,'uceed','Fictional ranking cohort',md5('ranking-paper')::uuid,
  now()-interval '21 days',now()-interval '11 days',now()-interval '1 day',current_setting('test.ranking_admin')::uuid),
  (current_setting('test.ranking_legacy')::uuid,'uceed','Fictional older cohort',md5('ranking-legacy-paper')::uuid,
  now()-interval '30 days',now()-interval '20 days',now()-interval '10 days',current_setting('test.ranking_admin')::uuid);
with fixture(n,paper_id,event_id) as (
  select n,md5('ranking-paper')::uuid,current_setting('test.ranking_event')::uuid from generate_series(1,14)n where n<>12
  union all
  select 1,md5('ranking-legacy-paper')::uuid,current_setting('test.ranking_legacy')::uuid
), submitted as (
  insert into dm_private.attempts(id,user_id,paper_id,status,started_at,deadline,submitted_at,score,total)
  select md5(event_id::text||n)::uuid,md5('ranking-candidate-'||n)::uuid,paper_id,'submitted',
    now()-interval '12 days',now()-interval '12 days'+interval '10 minutes',
    now()-interval '12 days'+interval '2 minutes',case when n=1 then 19 when n in(13,14) then 18 else 10 end,20
  from fixture returning id,user_id,paper_id
)
insert into dm_private.all_india_attempts(event_id,user_id,attempt_id)
select e.id,a.user_id,a.id from submitted a join dm_private.all_india_events e on e.paper_id=a.paper_id;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',current_setting('test.ranking_admin'),true);
select public.admin_release_all_india_results(current_setting('test.ranking_legacy')::uuid);
select pg_temp.ranking_reject(
  'select public.admin_open_all_india_ranking_publication(current_setting(''test.ranking_event'')::uuid,''ranking-v1'',''Fixture owner decision 1'')',
  'P0001','released cohort');
select public.admin_release_all_india_results(current_setting('test.ranking_event')::uuid);
select pg_temp.ranking_reject(
  'select public.admin_open_all_india_ranking_publication(current_setting(''test.ranking_event'')::uuid,''ranking-v1'',''Fixture owner decision 1'')',
  'P0001','exact current policy');
reset role;
update public.launch_settings set policy_version='ranking-v1' where singleton;
select set_config('test.ranking_tie_inside',(select user_id::text from dm_private.all_india_results
  where event_id=current_setting('test.ranking_event')::uuid order by rank,alias,attempt_id offset 9 limit 1),true),
  set_config('test.ranking_tie_outside',(select user_id::text from dm_private.all_india_results
  where event_id=current_setting('test.ranking_event')::uuid order by rank,alias,attempt_id offset 10 limit 1),true);

set local role authenticated;
select pg_temp.ranking_reject(
  'select public.admin_open_all_india_ranking_publication(current_setting(''test.ranking_event'')::uuid,''ranking-v1'',''Fixture owner decision 1'')',
  'P0001','Privacy and child safety approvals');
select public.admin_set_launch_gate('privacy_terms',true,'Fixture privacy approval');
select pg_temp.ranking_reject(
  'select public.admin_open_all_india_ranking_publication(current_setting(''test.ranking_event'')::uuid,''ranking-v1'',''Fixture owner decision 1'')',
  'P0001','Privacy and child safety approvals');
select public.admin_set_launch_gate('child_safety',true,'Fixture child safety approval');
select pg_temp.ranking_reject(
  'select public.admin_open_all_india_ranking_publication(current_setting(''test.ranking_event'')::uuid,'' ranking-v1'',''Fixture owner decision 1'')',
  'P0001','exact current policy');

select set_config('request.jwt.claim.sub',md5('ranking-candidate-1')::uuid::text,true);
select pg_temp.ranking_assert((select bool_and(event->'result'->'sharing'='null'::jsonb and event->'result'->>'score'='19')
  from jsonb_array_elements(public.all_india_event_catalog()) event),'legacy and default-closed results stay private and keep marks');
select pg_temp.ranking_reject(
  'select public.admin_open_all_india_ranking_publication(current_setting(''test.ranking_event'')::uuid,''ranking-v1'',''Fixture owner decision 1'')',
  '42501','Admin access required');
reset role;
set local role anon;
select pg_temp.ranking_assert(public.public_all_india_top_ten()='[]','legacy and default-closed events are absent from the feed');
select pg_temp.ranking_reject('select public.set_all_india_result_sharing(null,null,0,true)','42501','permission denied');
select pg_temp.ranking_reject('select public.admin_open_all_india_ranking_publication(null,null,null)','42501','permission denied');
select pg_temp.ranking_reject('select public.admin_close_all_india_ranking_publication(null,null,null)','42501','permission denied');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.ranking_admin'),true);
select set_config('test.ranking_publication',public.admin_open_all_india_ranking_publication(
  current_setting('test.ranking_event')::uuid,'ranking-v1','Fixture owner decision 1')::text,true);
select pg_temp.ranking_assert(public.admin_open_all_india_ranking_publication(
  current_setting('test.ranking_event')::uuid,'ranking-v1','Fixture owner decision 1')::text=current_setting('test.ranking_publication'),
  'exact active operator retry returns the same publication ID');
select pg_temp.ranking_assert(public.public_all_india_top_ten()='[]','an open publication cannot imply candidate consent');
select pg_temp.ranking_reject(
  'select public.admin_open_all_india_ranking_publication(current_setting(''test.ranking_event'')::uuid,''ranking-v1'',''Fixture competing approval'')',
  'P0001','Close the existing ranking publication');
select set_config('request.jwt.claim.sub',md5('ranking-candidate-12')::uuid::text,true);
select pg_temp.ranking_assert(public.all_india_event_catalog()->0->'result'='null','the nonparticipant has no result');
select pg_temp.ranking_reject(
  'select public.set_all_india_result_sharing(current_setting(''test.ranking_event'')::uuid,current_setting(''test.ranking_publication'')::uuid,0,true)',
  '42501','Ranking sharing unavailable');
select set_config('request.jwt.claim.sub',md5('ranking-candidate-13')::uuid::text,true);
select pg_temp.ranking_assert(public.all_india_event_catalog()->0->'result'->'sharing'='null','unconfirmed account has no sharing control');
select pg_temp.ranking_reject(
  'select public.set_all_india_result_sharing(current_setting(''test.ranking_event'')::uuid,current_setting(''test.ranking_publication'')::uuid,0,true)',
  '42501','Confirmed account required');
select set_config('request.jwt.claim.sub',md5('ranking-candidate-14')::uuid::text,true);
select pg_temp.ranking_reject(
  'select public.set_all_india_result_sharing(current_setting(''test.ranking_event'')::uuid,current_setting(''test.ranking_publication'')::uuid,0,true)',
  '42501','Confirmed account required');
select set_config('request.jwt.claim.sub',current_setting('test.ranking_tie_outside'),true);
select pg_temp.ranking_assert(public.all_india_event_catalog()->0->'result'->>'rank'='4'
  and public.all_india_event_catalog()->0->'result'->'sharing'='null','a tie outside the true top ten still has a private rank');
select pg_temp.ranking_reject(
  'select public.set_all_india_result_sharing(current_setting(''test.ranking_event'')::uuid,current_setting(''test.ranking_publication'')::uuid,0,true)',
  '42501','Ranking sharing unavailable');
select set_config('request.jwt.claim.sub',current_setting('test.ranking_tie_inside'),true);
select pg_temp.ranking_assert(public.set_all_india_result_sharing(current_setting('test.ranking_event')::uuid,
  current_setting('test.ranking_publication')::uuid,0,true) @> '{"revision":1,"shared":true}', 'a tied row in the true top ten can consent');

select set_config('request.jwt.claim.sub',md5('ranking-candidate-1')::uuid::text,true);
select pg_temp.ranking_assert(public.all_india_event_catalog()->0->'result'->'sharing' @>
  jsonb_build_object('publicationId',current_setting('test.ranking_publication'),'revision',0,'shared',false),
  'another candidate cannot change the owner’s consent');
select pg_temp.ranking_reject(
  'select public.admin_close_all_india_ranking_publication(current_setting(''test.ranking_event'')::uuid,current_setting(''test.ranking_publication'')::uuid,''Fixture owner closure 1'')',
  '42501','Admin access required');
select pg_temp.ranking_assert(public.set_all_india_result_sharing(current_setting('test.ranking_event')::uuid,
  current_setting('test.ranking_publication')::uuid,0,true) @> '{"revision":1,"shared":true}', 'the owned result opts in');
select pg_temp.ranking_assert(public.set_all_india_result_sharing(current_setting('test.ranking_event')::uuid,
  current_setting('test.ranking_publication')::uuid,1,true)=public.all_india_event_catalog()->0->'result'->'sharing',
  'current identical choice does not increment the revision');

reset role;
set local role anon;
select pg_temp.ranking_assert(jsonb_array_length(public.public_all_india_top_ten())=1
  and public.public_all_india_top_ten()->0->'sharingVersion'='1'::jsonb
  and jsonb_array_length(public.public_all_india_top_ten()->0->'topTen')=2
  and public.public_all_india_top_ten()->0->'topTen'->0 @> '{"rank":1,"score":19,"total":20}'
  and public.public_all_india_top_ten()->0->'topTen'->1 @> '{"rank":4,"score":10,"total":20}'
  and (select bool_and(result->>'alias' ~ '^Candidate-[0-9A-F]{10}$'
    and result-array['alias','rank','score','total']='{}')
    from jsonb_array_elements(public.public_all_india_top_ten()->0->'topTen') result)
  and (public.public_all_india_top_ten()->0)-array['eventId','exam','title','releasedAt','sharingVersion','topTen']='{}',
  'anonymous sees only two true top-ten consents with original ranks, aliases, scores and no private fields');
reset role;

set local role authenticated;
select pg_temp.ranking_assert(public.set_all_india_result_sharing(current_setting('test.ranking_event')::uuid,
  current_setting('test.ranking_publication')::uuid,1,false) @> '{"revision":2,"shared":false}', 'withdrawal advances the revision');
select pg_temp.ranking_reject(
  'select public.set_all_india_result_sharing(current_setting(''test.ranking_event'')::uuid,current_setting(''test.ranking_publication'')::uuid,1,true)',
  '40001','Sharing choice changed');
select pg_temp.ranking_assert(jsonb_array_length(public.public_all_india_top_ten()->0->'topTen')=1
  and public.public_all_india_top_ten()->0->'topTen'->0->>'rank'='4'
  and public.all_india_event_catalog()->0->'result'->>'rank'='1','withdrawal hides only the public row and leaves the private rank');
select set_config('request.jwt.claim.sub',current_setting('test.ranking_admin'),true);
select public.admin_set_launch_gate('child_safety',false,'Fixture approval withdrawn');
select pg_temp.ranking_assert(public.public_all_india_top_ten()='[]','gate withdrawal disables an active publication');
select public.admin_set_launch_gate('child_safety',true,'Fixture child safety approval');
select pg_temp.ranking_assert(public.public_all_india_top_ten()='[]','reapproving the same evidence cannot revive prior consent');
select pg_temp.ranking_reject(
  'select public.admin_open_all_india_ranking_publication(current_setting(''test.ranking_event'')::uuid,''ranking-v1'',''Fixture owner decision 1'')',
  'P0001','Close the existing ranking publication');
select public.admin_close_all_india_ranking_publication(current_setting('test.ranking_event')::uuid,
  current_setting('test.ranking_publication')::uuid,'Fixture owner closure 1');
select pg_temp.ranking_reject(
  'select public.admin_open_all_india_ranking_publication(current_setting(''test.ranking_event'')::uuid,''ranking-v1'',''Fixture owner decision 1'')',
  'P0001','fresh publication approval reference');
select set_config('test.ranking_reopen',public.admin_open_all_india_ranking_publication(
  current_setting('test.ranking_event')::uuid,'ranking-v1','Fixture owner decision 2')::text,true);
select public.admin_close_all_india_ranking_publication(current_setting('test.ranking_event')::uuid,
  current_setting('test.ranking_publication')::uuid,'Fixture owner closure 1');
select pg_temp.ranking_assert(public.public_all_india_top_ten()='[]'
  and current_setting('test.ranking_reopen')<>current_setting('test.ranking_publication'),'reopening creates a new default-closed consent scope');
select set_config('request.jwt.claim.sub',current_setting('test.ranking_tie_inside'),true);
select pg_temp.ranking_reject(
  'select public.set_all_india_result_sharing(current_setting(''test.ranking_event'')::uuid,current_setting(''test.ranking_publication'')::uuid,1,true)',
  'P0001','Ranking sharing unavailable');
select pg_temp.ranking_assert(public.all_india_event_catalog()->0->'result'->'sharing' @>
  jsonb_build_object('publicationId',current_setting('test.ranking_reopen'),'revision',0,'shared',false),
  'a stale close does not change the new publication and prior consent is absent');
select public.set_all_india_result_sharing(current_setting('test.ranking_event')::uuid,current_setting('test.ranking_reopen')::uuid,0,true);

reset role;
select pg_temp.ranking_assert((select opened_by=closed_by and opened_by=current_setting('test.ranking_admin')::uuid
  and opened_at<=closed_at and environment_mode='test' and policy_version='ranking-v1'
  and open_evidence='Fixture owner decision 1' and close_evidence='Fixture owner closure 1'
  from dm_private.all_india_ranking_publications where id=current_setting('test.ranking_publication')::uuid),
  'operator, scope and evidence are recorded for both lifecycle actions');
update public.launch_settings set policy_version='ranking-v2' where singleton;
select pg_temp.ranking_assert(public.public_all_india_top_ten()='[]','policy version change disables publication');
update public.launch_settings set policy_version='ranking-v1' where singleton;
select pg_temp.ranking_assert(public.public_all_india_top_ten()='[]','restoring the policy does not revive publication');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.ranking_admin'),true);
select public.admin_close_all_india_ranking_publication(current_setting('test.ranking_event')::uuid,
  current_setting('test.ranking_reopen')::uuid,'Fixture owner closure 2');
select set_config('test.ranking_mode',public.admin_open_all_india_ranking_publication(
  current_setting('test.ranking_event')::uuid,'ranking-v1','Fixture owner decision 3')::text,true);
select set_config('request.jwt.claim.sub',current_setting('test.ranking_tie_inside'),true);
select public.set_all_india_result_sharing(current_setting('test.ranking_event')::uuid,current_setting('test.ranking_mode')::uuid,0,true);
reset role;
update public.launch_settings set environment_mode='live' where singleton;
select pg_temp.ranking_assert(public.public_all_india_top_ten()='[]','environment mode change disables publication');
update public.launch_settings set environment_mode='test' where singleton;
select pg_temp.ranking_assert(public.public_all_india_top_ten()='[]','restoring the environment mode does not revive publication');

select pg_temp.ranking_assert(not exists(
  select 1 from unnest(array['anon','authenticated','service_role']) as roles(role)
  cross join unnest(array['dm_private.all_india_ranking_publications','dm_private.all_india_ranking_consents']) as tables(name)
  where has_table_privilege(role,name,'SELECT,INSERT,UPDATE,DELETE')
), 'no client or service role has direct access to consent or publication records');

rollback;
\echo 'PASS: All India ranking requires fresh, scoped approval and revocable consent from an eligible confirmed owner.'
