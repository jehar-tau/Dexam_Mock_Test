\set ON_ERROR_STOP on

update dm_private.registration_policy set mode='testers' where id;
\ir ../../supabase/launch/private-staging-api.sql
begin;

create function pg_temp.expect_staging_denied() returns void language plpgsql as $$
begin
  perform dm_staging_api.check_admission();
  raise exception 'Expected the authenticated Data API request to be rejected';
exception when insufficient_privilege then
  if sqlerrm <> 'Private staging requires an approved Google tester' then raise; end if;
end $$;

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000190','approved-api@example.invalid',now(),'{"provider":"google"}'),
 ('00000000-0000-4000-8000-000000000191','returning-api@example.invalid',now(),'{"provider":"google"}');
insert into dm_private.registration_testers(email) values ('approved-api@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000191',true);
select pg_temp.expect_staging_denied();
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000190',true);
select dm_staging_api.check_admission();

reset role;
delete from dm_private.registration_testers where email='approved-api@example.invalid';
set local role authenticated;
select pg_temp.expect_staging_denied();

reset role;
set local role anon;
select dm_staging_api.check_admission();

reset role;
set local role service_role;
select dm_staging_api.check_admission();
rollback;

select format('alter role authenticator in database %I reset pgrst.db_pre_request', current_database()) \gexec
drop schema dm_staging_api cascade;
update dm_private.registration_policy set mode='closed' where id;
\echo 'PASS: private staging Data API hook checks the current tester allowlist.'
