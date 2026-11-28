\set ON_ERROR_STOP on
-- Study stage, state and optional marketing permission (202611280200).
begin;
create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', label; end if; end $$;
create function pg_temp.reject(statement text, code text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement; exception when others then get stacked diagnostics actual = returned_sqlstate; if actual = code then return; end if;
    raise exception 'FAIL: expected %, received % for %', code, actual, statement; end;
  raise exception 'FAIL: expected rejection for %', statement;
end $$;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000002001'), ('00000000-0000-4000-8000-000000002002'), ('00000000-0000-4000-8000-000000002003');
insert into dm_private.admins(user_id) values ('00000000-0000-4000-8000-000000002003');
select pg_temp.check(not has_function_privilege('anon', 'public.save_candidate_profile(text,text,integer,text,text[],text,text,boolean)', 'execute')
  and not has_function_privilege('anon', 'public.admin_student_contacts()', 'execute'), 'anonymous access denied');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002001', true);
select public.save_candidate_profile('Fictional Adult Student', '+919000002001', 2027, 'Pune', array['uceed'], 'class_12', 'Maharashtra', true) as saved \gset
select pg_temp.check(:'saved'::jsonb->>'studyStage' = 'class_12' and :'saved'::jsonb->>'state' = 'Maharashtra'
  and (:'saved'::jsonb->>'marketingConsent')::boolean and :'saved'::jsonb->>'displayName' = 'Fictional Adult Student', 'details and permission saved');
select pg_temp.reject($$select public.save_candidate_profile('Fictional Adult Student', '+919000002001', 2027, 'Pune', array['uceed'], 'class_9', 'Maharashtra', false)$$, '22023');
select pg_temp.reject($$select public.save_candidate_profile('Fictional Adult Student', '+919000002001', 2027, 'Pune', array['uceed'], 'class_12', null, false)$$, '22023');
select pg_temp.reject($$select public.save_candidate_profile('Fictional Adult Student', '+919000002001', 2027, 'Pune', array['uceed'], 'class_12', 'Maharashtra', null)$$, '22023');
select pg_temp.reject($$select public.save_candidate_profile('F', '+919000002001', 2027, 'Pune', array['uceed'], 'class_12', 'Maharashtra', false)$$, '22023');
select pg_temp.reject('select public.admin_student_contacts()', '42501');
-- Withdrawing permission clears it.
select public.save_candidate_profile('Fictional Adult Student', '+919000002001', 2027, 'Pune', array['uceed'], 'class_12', 'Maharashtra', false) as withdrawn \gset
select pg_temp.check(not (:'withdrawn'::jsonb->>'marketingConsent')::boolean, 'permission withdrawn');
select public.save_candidate_profile('Fictional Adult Student', '+919000002001', 2027, 'Pune', array['uceed'], 'class_12', 'Maharashtra', true);

-- A student who confirmed they are 16 or 17 is never recorded as giving marketing permission.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002002', true);
reset role;
insert into public.profiles(user_id, age_group) values ('00000000-0000-4000-8000-000000002002', '16_17_guardian');
set local role authenticated;
select public.save_candidate_profile('Fictional Younger Student', '+919000002002', 2028, 'Nagpur', array['nid'], 'class_11', 'Maharashtra', true) as younger \gset
select pg_temp.check(not (:'younger'::jsonb->>'marketingConsent')::boolean and :'younger'::jsonb->>'studyStage' = 'class_11', 'no marketing permission under 18');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002003', true);
select public.admin_student_contacts() as contacts \gset
select pg_temp.check(jsonb_array_length(:'contacts'::jsonb) = 1 and :'contacts'::jsonb->0->>'phone' = '+919000002001'
  and :'contacts'::jsonb->0->>'city' = 'Pune' and :'contacts'::jsonb->0->>'state' = 'Maharashtra', 'only students with permission are listed');
rollback;
\echo 'PASS: student profile details, optional marketing permission and the administrator contact list.'
