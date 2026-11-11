\set ON_ERROR_STOP on
begin;

create function pg_temp.check_phone(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
end
$$;
create function pg_temp.id(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
create function pg_temp.phone(n int) returns text language sql immutable as $$
  select '+919000' || lpad(n::text, 6, '0')
$$;
create function pg_temp.start_phone(actor int, number int, id int, destination text default 'a', code text default 'b')
returns jsonb language sql as $$
  select public.prepare_candidate_phone_challenge(pg_temp.id(actor), pg_temp.phone(number), pg_temp.id(id),
    repeat(destination, 64), repeat(code, 64))
$$;
create function pg_temp.confirm_phone(actor int, number int, id int, code text default 'b')
returns text language sql as $$
  select public.confirm_candidate_phone_challenge(pg_temp.id(actor), pg_temp.phone(number), pg_temp.id(id), repeat(code, 64))->>'status'
$$;
create function pg_temp.holds_phone_lock(lock_key text) returns boolean language sql as $$
  select exists (
    select 1 from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid() and granted and objsubid = 1
      and classid::bigint = ((hashtextextended(lock_key, 0) >> 32) & 4294967295)
      and objid::bigint = (hashtextextended(lock_key, 0) & 4294967295)
  )
$$;

select pg_temp.check_phone(not has_function_privilege(role_name, 'public.prepare_candidate_phone_challenge(uuid,text,uuid,text,text)', 'execute')
  and not has_function_privilege(role_name, 'public.confirm_candidate_phone_challenge(uuid,text,uuid,text)', 'execute'), role_name || ' cannot execute challenge RPCs')
from unnest(array['anon','authenticated']) as role_name;
select pg_temp.check_phone(not has_table_privilege(role_name, 'dm_private.candidate_phone_challenges', 'SELECT, INSERT, UPDATE, DELETE'),
  role_name || ' cannot access challenge table')
from unnest(array['anon','authenticated','service_role']) as role_name;
set local role service_role;
select set_config('request.jwt.claim.role', 'authenticated', true);
do $$
begin
  begin
    perform public.prepare_candidate_phone_challenge(null,null,null,null,null);
    raise exception 'FAIL: missing prepare role guard';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.confirm_candidate_phone_challenge(null,null,null,null);
    raise exception 'FAIL: missing confirm role guard';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_app_meta_data)
select pg_temp.id(n), 'phone-' || n || '@example.invalid', case when n <> 3004 then clock_timestamp() end,
  n = 3005, jsonb_build_object('provider', case when n = 3006 then 'email' else 'google' end)
from generate_series(3001, 3011) as n;
insert into public.profiles(user_id,display_name,phone_e164,appearing_year,city,exams)
select pg_temp.id(n),'Fictional Candidate',pg_temp.phone(case when n in (3002, 3008, 3009) then 3001 else n end),
  2027,'Fictional City',array['uceed']
from generate_series(3001, 3010) as n;
insert into dm_private.registration_testers(email)
select email from auth.users where id between pg_temp.id(3001) and pg_temp.id(3011) and id <> pg_temp.id(3003);
update public.launch_settings set environment_mode='test', sales_enabled=false where singleton;
update dm_private.registration_policy set mode='closed' where id;
select set_config('request.jwt.claim.role', 'service_role', true);

select pg_temp.check_phone(pg_temp.start_phone(3001,3001,3101)->>'status' = 'unavailable', 'closed registration');
update dm_private.registration_policy set mode='open' where id;
select pg_temp.check_phone(pg_temp.start_phone(3001,3001,3101)->>'status' = 'unavailable', 'open registration cannot use test launch');
update dm_private.registration_policy set mode='testers' where id;
-- Simulate inconsistent operator settings without seeding the entire sales readiness catalogue.
alter table public.launch_settings disable trigger guard_sales_activation;
update public.launch_settings set sales_enabled=true where singleton;
alter table public.launch_settings enable trigger guard_sales_activation;
select pg_temp.check_phone(pg_temp.start_phone(3001,3001,3101)->>'status' = 'unavailable', 'testers cannot use open sales');
update public.launch_settings set sales_enabled=false where singleton;
select pg_temp.check_phone(pg_temp.start_phone(n,n,3101)->>'status' = 'unavailable', label)
from (values (3003,'tester missing'),(3004,'unconfirmed email'),(3005,'anonymous auth'),(3006,'non-Google auth'),(3011,'no saved profile')) as inputs(n,label);
select pg_temp.check_phone(pg_temp.start_phone(3001,3002,3101)->>'status' = 'unavailable', 'phone must match exactly');
select pg_temp.check_phone((select count(*) from dm_private.candidate_phone_challenges) = 0, 'ineligible starts reserve nothing');

set local role service_role;
select pg_temp.start_phone(3001,3001,3101) as first_start \gset
select pg_temp.check_phone(:'first_start'::jsonb->>'status' = 'created'
  and (:'first_start'::jsonb->>'expiresAt')::timestamptz - (:'first_start'::jsonb->>'retryAt')::timestamptz = interval '4 minutes',
  'first start returns expiry and cooldown');
select pg_temp.check_phone(pg_temp.start_phone(3001,3001,3101,'a','c') = jsonb_set(:'first_start'::jsonb,'{status}','"existing"'),
  'same ID does not replace digest, create quota, or extend expiry');
select pg_temp.check_phone(pg_temp.start_phone(3001,3001,3102) = jsonb_build_object('status','cooldown','retryAt',:'first_start'::jsonb->'retryAt'),
  'actor cooldown');
select pg_temp.check_phone(pg_temp.start_phone(3002,3001,3102) = jsonb_build_object('status','cooldown','retryAt',:'first_start'::jsonb->'retryAt'),
  'destination cooldown also covers a different actor');
select pg_temp.check_phone(pg_temp.confirm_phone(3002,3001,3101) = 'unavailable', 'another actor cannot confirm the challenge');
select pg_temp.check_phone(pg_temp.holds_phone_lock('dmocks-candidate-profile:' || pg_temp.id(3001)::text)
  and pg_temp.holds_phone_lock('dmocks-candidate-phone-destination:' || repeat('a',64)), 'profile and destination transaction locks');
reset role;
select pg_temp.check_phone((select count(*) = 1 and min(code_digest) = repeat('b',64) from dm_private.candidate_phone_challenges),
  'replay did not store replacement digest');

delete from dm_private.registration_testers where email='phone-3001@example.invalid';
select pg_temp.check_phone(pg_temp.start_phone(3001,3001,3101)->>'status' = 'unavailable'
  and pg_temp.confirm_phone(3001,3001,3101) = 'unavailable', 'removed tester cannot replay or confirm');
insert into dm_private.registration_testers(email) values ('phone-3001@example.invalid');
update auth.users set email_confirmed_at=null where id=pg_temp.id(3001);
select pg_temp.check_phone(pg_temp.confirm_phone(3001,3001,3101) = 'unavailable', 'confirmation rechecks Auth');
update auth.users set email_confirmed_at=clock_timestamp() where id=pg_temp.id(3001);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', pg_temp.id(3001)::text, true);
select public.save_candidate_profile('Edited Fictional Candidate',pg_temp.phone(3001),2027,'Fictional City',array['uceed']);
reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select pg_temp.check_phone(pg_temp.confirm_phone(3001,3001,3101,'c') = 'invalid', 'replacement digest is rejected');
select pg_temp.check_phone(pg_temp.confirm_phone(3001,3001,3101) = 'verified', 'original digest verifies after unrelated edit');
reset role;
select phone_verified_at as original_stamp from public.profiles where user_id=pg_temp.id(3001) \gset
select pg_temp.check_phone(pg_temp.confirm_phone(3001,3001,3101) = 'verified'
  and pg_temp.confirm_phone(3001,3001,3101,'c') = 'invalid', 'successful replay requires the original digest');
select pg_temp.check_phone((select phone_verified_at = :'original_stamp'::timestamptz
  and onboarding_completed_at = :'original_stamp'::timestamptz from public.profiles where user_id=pg_temp.id(3001)),
  'replay preserves both proof timestamps');
select pg_temp.check_phone(pg_temp.start_phone(3001,3001,3102)->>'status' = 'unavailable', 'verified phone cannot reserve');
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data)
values (pg_temp.id(3012),'phone-3012@example.invalid',clock_timestamp(),'{"provider":"google"}');
insert into public.profiles(user_id,display_name,phone_e164,appearing_year,city,exams)
values (pg_temp.id(3012),'Second Fictional Candidate',pg_temp.phone(3001),2027,'Fictional City',array['uceed']);
do $$
begin
  begin
    update public.profiles set phone_verified_at=clock_timestamp() where user_id=pg_temp.id(3012);
    raise exception 'FAIL: a second account verified an already verified number';
  exception when unique_violation then null;
  end;
end
$$;

update dm_private.candidate_phone_challenges set created_at=created_at-interval '61 seconds' where challenge_id=pg_temp.id(3101);
select pg_temp.check_phone(pg_temp.start_phone(3002,3001,3102)->>'status' = 'created', 'destination may be retried after cooldown');
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', pg_temp.id(3002)::text, true);
select public.save_candidate_profile('Fictional Candidate',pg_temp.phone(3002),2027,'Fictional City',array['uceed']);
select public.save_candidate_profile('Fictional Candidate',pg_temp.phone(3001),2027,'Fictional City',array['uceed']);
reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
select pg_temp.check_phone(pg_temp.confirm_phone(3002,3001,3102) = 'invalid', 'away then back cannot resurrect proof');
update dm_private.candidate_phone_challenges set created_at=created_at-interval '61 seconds' where challenge_id=pg_temp.id(3102);
select pg_temp.check_phone(pg_temp.start_phone(3002,3001,3103)->>'status' = 'created', 'another challenge can replace a changed-phone proof');
update dm_private.candidate_phone_challenges set created_at=created_at-interval '61 seconds' where challenge_id=pg_temp.id(3103);
select pg_temp.check_phone(pg_temp.start_phone(3002,3001,3104)->>'status' = 'created', 'resend replaces the preceding challenge');
select pg_temp.check_phone(pg_temp.confirm_phone(3002,3001,3103) = 'invalid', 'superseded proof is invalid');
do $$
begin
  for attempt in 1..5 loop
    perform pg_temp.check_phone(pg_temp.confirm_phone(3002,3001,3104,'c') = 'invalid', 'wrong attempt is rejected');
  end loop;
end
$$;
select pg_temp.check_phone((select wrong_attempts=5 from dm_private.candidate_phone_challenges where challenge_id=pg_temp.id(3104))
  and pg_temp.confirm_phone(3002,3001,3104) = 'invalid', 'five persisted failures block the correct code');
update dm_private.candidate_phone_challenges set created_at=created_at-interval '61 seconds' where challenge_id=pg_temp.id(3104);
select pg_temp.check_phone(pg_temp.start_phone(3008,3001,3105)->>'status' = 'created', 'fifth destination reservation across actors');
select pg_temp.start_phone(3009,3001,3106) as destination_limit \gset
select pg_temp.check_phone(:'destination_limit'::jsonb->>'status' = 'limit'
  and (:'destination_limit'::jsonb->>'retryAt')::timestamptz = (select min(created_at)+interval '24 hours' from dm_private.candidate_phone_challenges),
  'destination limit uses earliest reservation release across actors');
delete from auth.users where id=pg_temp.id(3008);
select pg_temp.check_phone(pg_temp.start_phone(3009,3001,3106)->>'status' = 'limit'
  and (select actor_id is null from dm_private.candidate_phone_challenges where challenge_id=pg_temp.id(3105)),
  'deleting an account removes its ID but keeps destination throttle');

update dm_private.candidate_phone_challenges set expires_at=clock_timestamp()-interval '1 second' where challenge_id=pg_temp.id(3104);
select pg_temp.check_phone(pg_temp.confirm_phone(3002,3001,3104) = 'expired', 'expired proof cannot verify');
update dm_private.candidate_phone_challenges set expires_at=clock_timestamp()-interval '25 hours',
  created_at=clock_timestamp()-interval '25 hours 5 minutes' where challenge_id=pg_temp.id(3101);
update dm_private.candidate_phone_challenges set created_at=created_at-interval '61 seconds' where challenge_id=pg_temp.id(3105);
select pg_temp.check_phone(pg_temp.start_phone(3009,3001,3106)->>'status' = 'created', 'rolling limit releases');
select pg_temp.check_phone(not exists (select 1 from dm_private.candidate_phone_challenges where challenge_id=pg_temp.id(3101)),
  'eligible start purges old expiry');

do $$
declare digests text[] := array['1','2','3','4','5','6'];
begin
  for reservation in 1..6 loop
    update public.profiles set phone_e164=pg_temp.phone(3200+reservation) where user_id=pg_temp.id(3010);
    perform pg_temp.check_phone(pg_temp.start_phone(3010,3200+reservation,3200+reservation,digests[reservation])->>'status' =
      case when reservation < 6 then 'created' else 'limit' end, 'actor quota survives changes to destination');
    update dm_private.candidate_phone_challenges set created_at=created_at-interval '61 seconds' where challenge_id=pg_temp.id(3200+reservation);
  end loop;
end
$$;

update dm_private.registration_policy set mode='open' where id;
update public.launch_settings set environment_mode='live' where singleton;
select pg_temp.check_phone(pg_temp.start_phone(3003,3003,3107,'d')->>'status' = 'created', 'open live launch admits Google account without tester row');
select pg_temp.check_phone(pg_temp.confirm_phone(3003,3003,3107) = 'verified', 'open live launch confirms an admitted challenge');

select 'PASS: candidate phone challenge access, admission, locks, quotas, invalidation, expiry and replay.';
rollback;
