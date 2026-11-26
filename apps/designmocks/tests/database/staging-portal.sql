\set ON_ERROR_STOP on
\set approved '00000000-0000-4000-8000-000000000098'
\set unknown '00000000-0000-4000-8000-000000000099'
\set unconfirmed '00000000-0000-4000-8000-000000000100'
\set wrong_provider '00000000-0000-4000-8000-000000000101'
\set anonymous '00000000-0000-4000-8000-000000000102'
begin;

create function pg_temp.staging_assert(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
end $$;

insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_app_meta_data,raw_user_meta_data) values
  (:'approved','Approved@Example.Invalid',now(),false,'{"provider":"google"}','{}'),
  (:'unknown','unknown@example.invalid',now(),false,'{"provider":"google"}','{}'),
  (:'unconfirmed','unconfirmed@example.invalid',null,false,'{"provider":"google"}','{}'),
  (:'wrong_provider','spoof@example.invalid',now(),false,'{"provider":"email"}','{"provider":"google"}'),
  (:'anonymous','anonymous@example.invalid',now(),true,'{"provider":"google"}','{}');
insert into dm_private.registration_testers(email) values
  ('approved@example.invalid'),('unconfirmed@example.invalid'),('spoof@example.invalid'),('anonymous@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'approved',true);
select pg_temp.staging_assert(not public.can_enter_staging_portal(),'closed registration rejects even a returning tester');

reset role;
update dm_private.registration_policy set mode='testers' where id;
set local role authenticated;
select pg_temp.staging_assert(public.can_enter_staging_portal(),'confirmed and allowlisted Google account can enter test mode');
select set_config('request.jwt.claim.sub',:'unknown',true);
select pg_temp.staging_assert(not public.can_enter_staging_portal(),'existing Google account outside the allowlist is denied');
select set_config('request.jwt.claim.sub',:'unconfirmed',true);
select pg_temp.staging_assert(not public.can_enter_staging_portal(),'unconfirmed email is denied');
select set_config('request.jwt.claim.sub',:'wrong_provider',true);
select pg_temp.staging_assert(not public.can_enter_staging_portal(),'user metadata cannot spoof the provider');
select set_config('request.jwt.claim.sub',:'anonymous',true);
select pg_temp.staging_assert(not public.can_enter_staging_portal(),'anonymous Auth account is denied');

reset role;
update dm_private.registration_policy set mode='open' where id;
set local role authenticated;
select set_config('request.jwt.claim.sub',:'approved',true);
select pg_temp.staging_assert(public.can_enter_staging_portal(),'open free sign-up admits a confirmed Google account');
select set_config('request.jwt.claim.sub',:'unknown',true);
select pg_temp.staging_assert(public.can_enter_staging_portal(),'open free sign-up admits a Google account outside the allowlist');
select set_config('request.jwt.claim.sub',:'unconfirmed',true);
select pg_temp.staging_assert(not public.can_enter_staging_portal(),'open free sign-up still denies an unconfirmed email');
select set_config('request.jwt.claim.sub',:'wrong_provider',true);
select pg_temp.staging_assert(not public.can_enter_staging_portal(),'open free sign-up still denies a non-Google provider');
select set_config('request.jwt.claim.sub',:'anonymous',true);
select pg_temp.staging_assert(not public.can_enter_staging_portal(),'open free sign-up still denies an anonymous account');
reset role;
alter table public.launch_settings disable trigger guard_sales_activation;
update public.launch_settings set sales_enabled=true where singleton;
alter table public.launch_settings enable trigger guard_sales_activation;
set local role authenticated;
select set_config('request.jwt.claim.sub',:'unknown',true);
select pg_temp.staging_assert(not public.can_enter_staging_portal(),'open sign-up on test never admits while sales are on');
reset role;
alter table public.launch_settings disable trigger guard_sales_activation;
update public.launch_settings set sales_enabled=false where singleton;
alter table public.launch_settings enable trigger guard_sales_activation;
update public.launch_settings set environment_mode='live' where singleton;
set local role authenticated;
select set_config('request.jwt.claim.sub',:'unknown',true);
select pg_temp.staging_assert(not public.can_enter_staging_portal(),'open sign-up never admits through this portal on a live backend');
reset role;
update public.launch_settings set environment_mode='test' where singleton;
set local role authenticated;
select set_config('request.jwt.claim.sub',:'approved',true);

reset role;
update dm_private.registration_policy set mode='testers' where id;
update public.launch_settings set environment_mode='live' where singleton;
set local role authenticated;
select pg_temp.staging_assert(not public.can_enter_staging_portal(),'live backend settings disable staging admission');

reset role;
update public.launch_settings set environment_mode='test' where singleton;
delete from dm_private.registration_testers where email='approved@example.invalid';
set local role authenticated;
select pg_temp.staging_assert(not public.can_enter_staging_portal(),'allowlist revocation denies an existing session');
rollback;
\echo 'PASS: portal admission requires a confirmed Google account (allowlisted in testers mode, any in open mode) and closed test sales.'
