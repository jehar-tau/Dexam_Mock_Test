\set ON_ERROR_STOP on
begin;
\ir fixtures/release-bank-year.sql
\ir fixtures/released-parallel-questions.sql
\ir fixtures/released-exam-blueprint.sql
create function pg_temp.launch_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception'FAIL: %',label;end if;end$$;
create function pg_temp.launch_reject(statement text,label text)returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception'FAIL, unexpectedly allowed: %',label;end$$;
insert into auth.users(id)values('00000000-0000-4000-8000-000000000091'),('00000000-0000-4000-8000-000000000092');insert into dm_private.admins(user_id)values('00000000-0000-4000-8000-000000000091');
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
select pg_temp.launch_reject('select public.admin_launch_readiness()','student cannot read operator gates');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
select pg_temp.launch_assert(not(public.admin_launch_readiness()->>'readyForSales')::boolean,'launch defaults closed');
select pg_temp.launch_reject('select public.admin_set_launch_gate(''content_rights'',true,''short'')','approval requires evidence');
select public.admin_set_launch_gate('content_rights',true,'Fictional reviewed evidence');
reset role;
select pg_temp.launch_assert((select approved and actor_id='00000000-0000-4000-8000-000000000091'from dm_private.launch_gate_attestations where gate='content_rights'),'approval records actor');
select pg_temp.launch_assert((select count(*)=1 from dm_private.launch_gate_audit where gate='content_rights'),'approval appends audit');
select pg_temp.launch_reject('update public.launch_settings set sales_enabled=true where singleton','database refuses premature sales activation');
select pg_temp.seed_released_exam_blueprint('00000000-0000-4000-8000-000000000091','launch-readiness-nift');
update dm_private.launch_gate_attestations set approved=true,evidence='Fictional complete evidence';update public.launch_settings set policy_version='fictional-v1';
update public.launch_settings set sales_enabled=true where singleton;
select pg_temp.launch_assert((select sales_enabled from public.launch_settings where singleton),'guard allows activation only after every database gate passes');
update auth.users set email='staging-fixture@example.invalid',email_confirmed_at=now(),raw_app_meta_data='{"provider":"google"}'
  where id='00000000-0000-4000-8000-000000000091';
insert into dm_private.registration_testers(email) values ('staging-fixture@example.invalid');
update dm_private.registration_policy set mode='testers' where id;
set local role authenticated;
select pg_temp.launch_assert(not public.can_enter_staging_portal(),'enabled sales disable staging admission');
rollback;
\echo 'PASS: launch gates are admin-only, evidenced, audited and sales remain fail-closed.'
