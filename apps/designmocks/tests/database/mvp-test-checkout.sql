-- A controlled merchant Test journey must not require falsely attesting that
-- the provider journey already passed. No live sale, public signup or money.
\set ON_ERROR_STOP on
begin;
\ir ../../supabase/launch/paid-mvp.sql
\ir fixtures/mvp-objective-paper.sql
create function pg_temp.test_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.test_reject(statement text,label text)returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'FAIL, unexpectedly allowed: %',label;end$$;
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,is_anonymous)values
 ('00000000-0000-4000-8000-000000001981','operator-mvp@example.invalid',clock_timestamp(),'{"provider":"google"}',false),
 ('00000000-0000-4000-8000-000000001982','approved-mvp@example.invalid',clock_timestamp(),'{"provider":"google"}',false),
 ('00000000-0000-4000-8000-000000001983','unapproved-mvp@example.invalid',clock_timestamp(),'{"provider":"google"}',false),
 ('00000000-0000-4000-8000-000000001984','email-mvp@example.invalid',clock_timestamp(),'{"provider":"email"}',false);
insert into dm_private.admins(user_id)values('00000000-0000-4000-8000-000000001981');
insert into dm_private.registration_testers(email)values('approved-mvp@example.invalid'),('email-mvp@example.invalid');
select pg_temp.seed_mvp_paper('uceed','10000000-0000-4000-8000-000000001981');
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001982',true);
select pg_temp.test_reject('select public.admin_set_mvp_test_checkout(true,clock_timestamp()+interval''1 hour'',''Fictional approval'')','student cannot open acceptance');
select pg_temp.test_reject('select *from dm_private.mvp_test_checkout_control','private Test control is not exposed');
select pg_temp.test_reject('select public.prepare_order()','Test checkout defaults closed');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001981',true);
select pg_temp.test_reject('select public.admin_set_mvp_test_checkout(true,clock_timestamp()+interval''1 hour'',''Fictional approval'')','owner cannot bypass missing content/policy/admission setup');
select set_config('test.acceptance.sha',public.admin_mvp_paper_manifest('10000000-0000-4000-8000-000000001981')->'manifest'->>'sha256',true);
select public.admin_release_mvp_paper('10000000-0000-4000-8000-000000001981',current_setting('test.acceptance.sha'),'Fictional owner approval of original practice material');
reset role;
select set_config('test.acceptance.notices','dmocks-notices-v1-'||repeat('a',64),true);
update public.launch_settings set policy_version=current_setting('test.acceptance.notices');
update dm_private.registration_policy set mode='testers'where id;
update dm_private.launch_gate_attestations set approved=true,evidence='Fictional reviewed final policies/content'where gate in('content_rights','privacy_terms','refund_policy','child_safety');
set local role authenticated;
select pg_temp.test_reject('select public.admin_set_mvp_test_checkout(true,clock_timestamp()-interval''1 minute'',''Fictional approval'')','past expiration rejected');
select pg_temp.test_reject('select public.admin_set_mvp_test_checkout(true,clock_timestamp()+interval''9 hours'',''Fictional approval'')','unbounded merchant acceptance rejected');
select pg_temp.test_reject('select public.admin_set_mvp_test_checkout(true,clock_timestamp()+interval''1 hour'',''short'')','owner evidence required');
select public.admin_set_mvp_test_checkout(true,clock_timestamp()+interval'1 hour','Fictional approved private merchant Test journey');
select pg_temp.test_assert(public.admin_launch_readiness()->>'testCheckoutEnabled'='true'and public.admin_launch_readiness()->>'readyForSales'='false','Test acceptance remains distinct from Live readiness');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001982',true);
select pg_temp.test_reject(
 format('select public.accept_current_terms(%L)','dmocks-notices-v1-'||repeat('b',64)),
 'a different notice revision cannot be accepted');
select pg_temp.test_reject('select public.prepare_order()','no order before accepting the published notice revision');
select public.accept_current_terms(current_setting('test.acceptance.notices'));
select pg_temp.test_assert((select terms_version=current_setting('test.acceptance.notices') and accepted_at is not null
 from public.profiles where user_id=auth.uid()),'the recorded consent identifies the exact published notice revision');
select pg_temp.test_assert(public.can_enter_staging_portal(),'verified Google allowlisted tester is eligible');
select set_config('test.acceptance.order',public.prepare_order()->>'id',true);
select pg_temp.test_assert(public.prepare_order()->>'id'=current_setting('test.acceptance.order')and public.prepare_order()->>'mode'='test'and public.prepare_order()->>'amount'='119300','idempotent fixed-price Test order uses its own server mode');
select pg_temp.test_assert(public.my_pass()->>'mode'='test'and public.my_pass()->>'active'='false','opening Test checkout grants no pass');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001983',true);select public.accept_current_terms(current_setting('test.acceptance.notices'));
select pg_temp.test_reject('select public.prepare_order()','unallowlisted Google account denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001984',true);select public.accept_current_terms(current_setting('test.acceptance.notices'));
select pg_temp.test_reject('select public.prepare_order()','allowlisted password account is not a verified Google tester');
reset role;
select pg_temp.test_assert((select not sales_enabled from public.launch_settings)and(select mode='testers'from dm_private.registration_policy)and(select not approved from dm_private.launch_gate_attestations where gate='provider_acceptance'),'provider, public admission and Live sales were never falsely approved');
update dm_private.mvp_test_checkout_control set expires_at=clock_timestamp()-interval'1 second';
set local role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001982',true);
select pg_temp.test_reject('select public.prepare_order()','expired acceptance blocks even reuse of a pending Test order');
reset role;
update dm_private.mvp_test_checkout_control set expires_at=clock_timestamp()+interval'1 hour';
update public.launch_settings set environment_mode='live';
set local role authenticated;
select pg_temp.test_reject('select public.prepare_order()','Test acceptance never authorizes a Live order');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001981',true);
select public.admin_set_mvp_test_checkout(false,null,'Fictional acceptance closed before Live promotion');
reset role;
select pg_temp.test_assert((select count(*)=2 from dm_private.mvp_test_checkout_audit),'bounded enable and explicit closure are audited once each');
select pg_temp.test_reject('update public.launch_settings set sales_enabled=true','closing Test acceptance does not bypass remaining Live gates');
update public.launch_settings set environment_mode='test';
select pg_temp.test_assert((select not enabled and expires_at is null from dm_private.mvp_test_checkout_control),'Test control is closed after acceptance');
rollback;
\echo 'PASS: expiring owner-only merchant Test acceptance, verified Google allowlist, exact Test orders, mode/expiry/policy boundaries and closed Live/public admission.'
