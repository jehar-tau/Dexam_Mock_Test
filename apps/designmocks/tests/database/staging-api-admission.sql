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
insert into dm_private.admins(user_id) values
 ('00000000-0000-4000-8000-000000000190'),
 ('00000000-0000-4000-8000-000000000191');

create function pg_temp.assert_admin_staging_admission(expected boolean) returns void language plpgsql as $$
begin
  if public.is_dmocks_admin() is distinct from true
    or public.can_enter_staging_portal() is distinct from expected then
    raise exception 'Administrator role and staging admission must be checked independently';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000191',true);
select pg_temp.assert_admin_staging_admission(false);
select pg_temp.expect_staging_denied();
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000190',true);
select pg_temp.assert_admin_staging_admission(true);
select dm_staging_api.check_admission();

reset role;
delete from dm_private.registration_testers where email='approved-api@example.invalid';
set local role authenticated;
select pg_temp.assert_admin_staging_admission(false);
select pg_temp.expect_staging_denied();

reset role;
set local role anon;
select dm_staging_api.check_admission();

reset role;
set local role service_role;
select dm_staging_api.check_admission();
-- Real RPCs for a new Google account, a second account, and a later notice revision.
reset role;
update dm_private.registration_policy set mode='open' where id;
update public.launch_settings set policy_version=null where singleton;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000191',true);
select set_config('request.path','/rpc/free_signup_notice',true);
select dm_staging_api.check_admission();
do $$ begin
  if public.free_signup_notice() <> '{"required":true,"accepted":false,"version":null,"ageGroup":null}'::jsonb then
    raise exception 'Unexpected fresh notice state';
  end if;
end $$;
create function pg_temp.expect_notice_denied() returns void language plpgsql as $$
begin
  perform dm_staging_api.check_admission();
  raise exception 'Expected the unsigned student request to be rejected';
exception when insufficient_privilege then
  if sqlerrm <> 'Accept the current DMocks terms and privacy notice first' then raise; end if;
end $$;
select set_config('request.path','/rpc/start_free_year_paper',true);
select pg_temp.expect_notice_denied();

reset role;
update public.launch_settings set policy_version='dmocks-notices-v1-' || repeat('a',64) where singleton;
set local role authenticated;
select set_config('request.path','/rpc/accept_current_terms',true);
select dm_staging_api.check_admission();
select public.accept_current_terms('dmocks-notices-v1-' || repeat('a',64));
select set_config('request.path','/rpc/start_free_year_paper',true);
select dm_staging_api.check_admission();
do $$ begin
  if not (public.free_signup_notice()->>'accepted')::boolean then raise exception 'Acceptance was not retained'; end if;
  if public.free_signup_notice()->'ageGroup' <> 'null'::jsonb then raise exception 'An age group appeared without being chosen'; end if;
end $$;
-- A notice that admits 16- and 17-year-olds records the age group the student confirmed.
do $$ begin
  perform public.accept_current_terms('dmocks-notices-v1-' || repeat('a',64), 'under_16');
  raise exception 'An unknown age group was accepted';
exception when invalid_parameter_value then
  if sqlerrm <> 'Choose an age group' then raise; end if;
end $$;
do $$ begin
  perform public.accept_current_terms('dmocks-notices-v1-' || repeat('a',64), null);
  raise exception 'A missing age group was accepted';
exception when invalid_parameter_value then null;
end $$;
select public.accept_current_terms('dmocks-notices-v1-' || repeat('a',64), '16_17_guardian');
do $$ begin
  if public.free_signup_notice()->>'ageGroup' <> '16_17_guardian' or not (public.free_signup_notice()->>'accepted')::boolean then
    raise exception 'The guardian age group was not retained';
  end if;
end $$;
reset role;
update public.launch_settings set sales_enabled=true where singleton;
set local role authenticated;
do $$ begin
  if not (public.free_signup_notice()->>'required')::boolean then raise exception 'The notice stopped being required when sales opened'; end if;
end $$;
reset role;
update public.launch_settings set sales_enabled=false where singleton;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000190',true);
select pg_temp.expect_notice_denied();
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000191',true);
reset role;
update public.launch_settings set policy_version='dmocks-notices-v1-' || repeat('b',64) where singleton;
set local role authenticated;
select pg_temp.expect_notice_denied();
select set_config('request.path','/rpc/accept_current_terms',true);
select dm_staging_api.check_admission();
do $$ begin
  perform public.accept_current_terms('dmocks-notices-v1-' || repeat('a',64));
  raise exception 'Old notice was accepted';
exception when raise_exception then
  if sqlerrm <> 'Published terms are not ready' then raise; end if;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.free_signup_notice()','execute') then raise exception 'Anonymous notice receipt access'; end if;
  if has_function_privilege('anon','public.accept_current_terms(text,text)','execute') then raise exception 'Anonymous age-group acceptance'; end if;
end $$;
rollback;

select format('alter role authenticator in database %I reset pgrst.db_pre_request', current_database()) \gexec
drop schema dm_staging_api cascade;
update dm_private.registration_policy set mode='closed' where id;
\echo 'PASS: private staging Data API hook checks tester admission and exact-version free signup consent.'
