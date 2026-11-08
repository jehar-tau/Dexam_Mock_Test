\set ON_ERROR_STOP on
begin;
create function pg_temp.profile_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.profile_reject(statement text,code text)returns void language plpgsql as $$
declare actual text;begin begin execute statement;exception when others then get stacked diagnostics actual=returned_sqlstate;if actual=code then return;end if;raise exception 'FAIL: profile expected %, received %',code,actual;end;raise exception 'FAIL: expected rejected profile input';end$$;
insert into auth.users(id)values('00000000-0000-4000-8000-000000001211'),('00000000-0000-4000-8000-000000001212');
select pg_temp.profile_assert(not has_function_privilege('anon','public.my_candidate_profile()','execute')and not has_function_privilege('anon','public.save_candidate_profile(text,text,integer,text,text[])','execute'),'anonymous profile access denied');
select pg_temp.profile_assert(not has_function_privilege('authenticated','public.verify_candidate_phone(uuid,text)','execute')and not has_table_privilege('authenticated','public.profiles','update'),'browser cannot verify or directly change profile');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001211',true);
select public.save_candidate_profile('  Original Fictional Profile  ',' +919000001211 ',2027,' Fictional Pune ',array['UCEED','nift','uceed'])as saved\gset
select pg_temp.profile_assert(:'saved'::jsonb->>'displayName'='Original Fictional Profile'and :'saved'::jsonb->'exams'='["nift","uceed"]'::jsonb and :'saved'::jsonb->>'phoneVerified'='false'and :'saved'::jsonb->>'completed'='false','normalization grants no verification or completion');
select pg_temp.profile_reject('select public.save_candidate_profile(null,''+919000001211'',2027,''Fictional Pune'',array[''uceed''])','22023');
select pg_temp.profile_reject('select public.save_candidate_profile(''Original Fictional Profile'',null,2027,''Fictional Pune'',array[''uceed''])','22023');
select pg_temp.profile_reject('select public.save_candidate_profile(''Original Fictional Profile'',''+919000001211'',null,''Fictional Pune'',array[''uceed''])','22023');
select pg_temp.profile_reject('select public.save_candidate_profile(''Original Fictional Profile'',''+919000001211'',2027,null,array[''uceed''])','22023');
select pg_temp.profile_reject('select public.save_candidate_profile(''Original Fictional Profile'',''+919000001211'',2027,''Fictional Pune'',null)','22023');
select pg_temp.profile_reject('select public.save_candidate_profile(''Original Fictional Profile'',''+919000001211'',2027,''Fictional Pune'',array[''uceed'',null])','22023');
select pg_temp.profile_reject('select public.save_candidate_profile(''Original Fictional Profile'',''+919000001211'',2027,''Fictional Pune'',array[''unavailable''])','22023');
select pg_temp.profile_assert(public.my_candidate_profile()=:'saved'::jsonb,'rejections preserve prior profile');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001212',true);
select pg_temp.profile_assert(public.my_candidate_profile()='{}'::jsonb,'another account cannot see this profile');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.verify_candidate_phone('00000000-0000-4000-8000-000000001211','+919000001211');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001211',true);
select public.save_candidate_profile('Original Fictional Profile','+919000001211',2028,'Another Fictional City',array['ceed'])as same_phone\gset
select pg_temp.profile_assert(:'same_phone'::jsonb->>'phoneVerified'='true'and :'same_phone'::jsonb->>'completed'='true','same phone preserves existing verification');
select public.save_candidate_profile('Original Fictional Profile','+919000001213',2028,'Another Fictional City',array['ceed'])as changed_phone\gset
select pg_temp.profile_assert(:'changed_phone'::jsonb->>'phoneVerified'='false'and :'changed_phone'::jsonb->>'completed'='false','changed phone clears verification and completion');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.profile_reject('select public.verify_candidate_phone(''00000000-0000-4000-8000-000000001211'',''+919000001211'')','22023');
reset role;
select pg_temp.profile_assert((select phone_verified_at is null and onboarding_completed_at is null from public.profiles where user_id='00000000-0000-4000-8000-000000001211'),'stale phone proof cannot complete a changed profile');
select 'PASS: strict candidate input, own profile isolation, service-only verification and changed-phone clearing.';
rollback;
