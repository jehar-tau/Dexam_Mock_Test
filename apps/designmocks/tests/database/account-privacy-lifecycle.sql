\set ON_ERROR_STOP on
\set first '00000000-0000-4000-8000-000000001301'
\set second '00000000-0000-4000-8000-000000001302'
\set admin '00000000-0000-4000-8000-000000001303'
begin;
create function pg_temp.privacy_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.privacy_reject(statement text,expected text)returns void language plpgsql as $$begin begin execute statement;exception when others then if position(expected in sqlerrm)>0 then return;end if;raise;end;raise exception 'FAIL, expected error: %',expected;end$$;
insert into auth.users(id)values(:'first'),(:'second'),(:'admin');
insert into public.profiles(user_id,display_name,terms_version,accepted_at)values(:'first','Fictional first privacy student','fictional-privacy-terms',now()),(:'second','Fictional second privacy student','fictional-privacy-terms',now());
insert into dm_private.admins(user_id)values(:'admin');
select md5(jsonb_agg(to_jsonb(p)order by user_id)::text)as profile_digest from public.profiles p\gset
set local role anon;
select pg_temp.privacy_reject('select public.my_privacy_requests()','permission denied');
select pg_temp.privacy_reject('select public.request_account_deletion()','permission denied');
select pg_temp.privacy_reject('select public.cancel_my_privacy_request(gen_random_uuid())','permission denied');
select pg_temp.privacy_reject('select public.export_my_account_data()','permission denied');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.privacy_reject('select public.request_account_deletion()','Sign in required');
select pg_temp.privacy_assert(public.my_privacy_requests()='[]'::jsonb,'a missing actor cannot read request history');
select set_config('request.jwt.claim.sub',:'first',true);
select public.request_account_deletion()as first_request\gset
select pg_temp.privacy_assert(public.request_account_deletion()=:'first_request'::uuid,'an active own request is idempotent');
select pg_temp.privacy_assert(public.my_privacy_requests()->0->>'id'=:'first_request' and public.my_privacy_requests()->0->>'status'='open','the current actor sees its own open request');
select pg_temp.privacy_reject('select * from dm_private.account_privacy_requests','permission denied');
select pg_temp.privacy_reject('update dm_private.account_privacy_requests set status=''cancelled''','permission denied');
select pg_temp.privacy_reject('select public.admin_privacy_requests()','Admin access required');
select set_config('request.jwt.claim.sub',:'second',true);
select pg_temp.privacy_assert(public.my_privacy_requests()='[]'::jsonb,'another actor cannot read the first request');
select pg_temp.privacy_reject('select public.cancel_my_privacy_request('''||:'first_request'||''')','Open request not found');
select public.request_account_deletion()as second_request\gset
select pg_temp.privacy_assert(:'second_request'<>:'first_request','different actors have independent request identities');
select set_config('request.jwt.claim.sub',:'admin',true);
select public.admin_resolve_privacy_request(:'first_request','in_progress','Fictional private first-account review note.');
select set_config('request.jwt.claim.sub',:'first',true);
select pg_temp.privacy_assert(public.request_account_deletion()=:'first_request'::uuid and public.my_privacy_requests()->0->>'status'='in_progress' and public.my_privacy_requests()->0->>'adminNote'='Fictional private first-account review note.','an in-progress request and its own review note are preserved');
select pg_temp.privacy_reject('select public.cancel_my_privacy_request('''||:'first_request'||''')','Open request not found');
select set_config('request.jwt.claim.sub',:'second',true);
select pg_temp.privacy_assert(jsonb_array_length(public.my_privacy_requests())=1 and public.my_privacy_requests()->0->>'id'=:'second_request' and position('private first-account' in public.my_privacy_requests()::text)=0,'operator notes remain isolated to their request owner');
select public.cancel_my_privacy_request(:'second_request');
select pg_temp.privacy_assert(public.my_privacy_requests()->0->>'status'='cancelled','the open own request can be cancelled');
select pg_temp.privacy_reject('select public.cancel_my_privacy_request('''||:'second_request'||''')','Open request not found');
select public.request_account_deletion()as replacement\gset
select pg_temp.privacy_assert(:'replacement'<>:'second_request' and jsonb_array_length(public.my_privacy_requests())=2,'a new reviewed request does not erase cancelled history');
select set_config('request.jwt.claim.sub',:'admin',true);
select public.admin_resolve_privacy_request(:'first_request','closed','Fictional request review closed without deleting any account.');
select set_config('request.jwt.claim.sub',:'first',true);
select pg_temp.privacy_assert(public.my_privacy_requests()->0->>'status'='closed','the user can read its reviewed closed state');
reset role;
select pg_temp.privacy_assert((select md5(jsonb_agg(to_jsonb(p)order by user_id)::text)from public.profiles p)=:'profile_digest' and(select count(*)from auth.users where id in(:'first',:'second',:'admin'))=3,'requests and review states never delete accounts or alter profiles/terms');
rollback;
\echo 'PASS: private reviewed deletion requests, roles, ownership, cancellation states and unchanged account/profile evidence.'
