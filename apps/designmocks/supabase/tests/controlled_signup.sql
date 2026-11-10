\set ON_ERROR_STOP on
begin;

create function pg_temp.signup_event(subject text, address text, claims jsonb default '{}'::jsonb)
returns jsonb language sql as $$
  select jsonb_build_object('user', jsonb_build_object(
    'email', address, 'app_metadata', '{"provider":"google"}'::jsonb, 'is_anonymous', false,
    'user_metadata', jsonb_build_object('sub', subject, 'email', address, 'email_verified', true) || claims
  ));
$$;

create function pg_temp.signup_expect(event jsonb, admitted boolean, label text)
returns void language plpgsql as $$
declare result jsonb := public.before_designmocks_user_created(event);
begin
  if (case when admitted then result = '{}'::jsonb else result#>>'{error,http_code}' = '403' end)
    is distinct from true then
    raise exception 'Unexpected signup decision: %', label;
  end if;
end $$;

do $$begin
  if exists (
    select 1 from unnest(array['anon','authenticated','service_role']) roles(role)
    where has_function_privilege(role,'public.before_designmocks_user_created(jsonb)','execute')
      or has_table_privilege(role,'dm_private.registration_pre_admissions','select,insert,update,delete')
  ) then
    raise exception 'Application roles must not invoke the Auth hook or access pre-admission records';
  end if;
  if not has_function_privilege('supabase_auth_admin','public.before_designmocks_user_created(jsonb)','execute')
    or not has_schema_privilege('supabase_auth_admin','dm_private','usage')
    or not has_table_privilege('supabase_auth_admin','dm_private.registration_policy','select')
    or not has_table_privilege('supabase_auth_admin','dm_private.registration_testers','select')
    or not has_table_privilege('supabase_auth_admin','dm_private.registration_pre_admissions','select')
    or has_table_privilege('supabase_auth_admin','dm_private.registration_pre_admissions','insert,update,delete') then
    raise exception 'Auth hook must read policy and decisions without writing decisions';
  end if;
  if exists (select 1 from dm_private.registration_pre_admissions) then
    raise exception 'Migration must leave pre-admission records empty';
  end if;
end $$;

update dm_private.registration_policy set mode='closed';
insert into dm_private.registration_testers(email) values ('tester@example.invalid');
insert into dm_private.registration_pre_admissions(google_sub,decision,proof_ref,consent_version,issued_at,expires_at,revoked_at)
select subject,decision,gen_random_uuid(),'fictional-consent-v1',issued,expires,revoked
from (values
  ('fictional-adult','adult',now()-interval '1 hour',now()+interval '1 hour',null::timestamptz),
  ('fictional-guardian','guardian',now()-interval '1 hour',now()+interval '1 hour',null),
  ('fictional-expired','adult',now()-interval '2 hours',now()-interval '1 hour',null),
  ('fictional-future','guardian',now()+interval '1 hour',now()+interval '2 hours',null),
  ('fictional-revoked','guardian',now()-interval '2 hours',now()+interval '1 hour',now()-interval '1 hour')
) fixture(subject,decision,issued,expires,revoked);

set local role supabase_auth_admin;
select pg_temp.signup_expect(pg_temp.signup_event('fictional-adult','tester@example.invalid'),false,'closed mode denies a verified tester with a valid record');
reset role;
update dm_private.registration_policy set mode='testers';
set local role supabase_auth_admin;
select pg_temp.signup_expect(pg_temp.signup_event('fictional-adult',' Tester@Example.Invalid ','{"email":"tester@example.invalid"}'),
  true,'adult verification and normalized matching email are accepted');
select pg_temp.signup_expect(pg_temp.signup_event('fictional-guardian','tester@example.invalid'),true,'valid guardian verification is accepted');
select pg_temp.signup_expect(pg_temp.signup_event('fictional-guardian','other@example.invalid'),false,'valid record cannot bypass tester allowlist');
select pg_temp.signup_expect(pg_temp.signup_event(subject,'tester@example.invalid'),false,'invalid admission record: ' || subject)
from unnest(array['fictional-unlisted','fictional-expired','fictional-future','fictional-revoked','FICTIONAL-ADULT']) subjects(subject);
select pg_temp.signup_expect(pg_temp.signup_event('fictional-adult','tester@example.invalid',claims),false,'malformed provider claims')
from (values
  ('{"email_verified":"true"}'::jsonb), ('{"email_verified":false}'), ('{"email_verified":null}'),
  ('{"email":"other@example.invalid"}'), ('{"email":null}'), ('{"sub":null}'), ('{"sub":""}'),
  ('{"sub":"   "}'), ('{"sub":123}'), ('{"sub":" fictional-adult "}')
) cases(claims);
select pg_temp.signup_expect(pg_temp.signup_event('fictional-adult',null),false,'missing top-level email');
select pg_temp.signup_expect(pg_temp.signup_event('fictional-adult','tester@example.invalid') #- '{user,user_metadata,email_verified}',
  false,'missing provider verification claim');
select pg_temp.signup_expect(jsonb_set(
  pg_temp.signup_event('fictional-adult','tester@example.invalid','{"provider":"google"}'),
  '{user,app_metadata,provider}','"email"'),false,'user metadata cannot turn an email signup into Google');
select pg_temp.signup_expect(jsonb_set(pg_temp.signup_event('fictional-adult','tester@example.invalid'),
  '{user,is_anonymous}','true'),false,'anonymous user is denied');
reset role;

update dm_private.registration_policy set mode='open';
set local role supabase_auth_admin;
select pg_temp.signup_expect(pg_temp.signup_event('fictional-guardian','other@example.invalid'),true,'open mode still accepts a valid pre-admission');
select pg_temp.signup_expect(pg_temp.signup_event('fictional-unlisted','other@example.invalid'),false,'open mode still requires a pre-admission');
reset role;

rollback;
\echo 'PASS: Auth-only Google signup requires a current adult or guardian pre-admission decision.'
