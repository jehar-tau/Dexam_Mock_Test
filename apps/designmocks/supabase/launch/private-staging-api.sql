-- Opt-in companion for the dedicated private staging project. Apply as one
-- transaction after the hosted backup and review. Keep out of the migration set.
begin;

do $$
begin
  if not exists (select from public.launch_settings
    where singleton and environment_mode = 'test' and not sales_enabled)
    or not exists (select from dm_private.registration_policy where id and mode = 'testers') then
    raise exception 'Private staging requires Test mode, tester registration and closed sales';
  end if;
  if exists (
    select from pg_db_role_setting s
    cross join lateral unnest(s.setconfig) as setting(value)
    where s.setrole in (0, 'authenticator'::regrole)
      and (s.setdatabase = 0 or s.setdatabase = (select oid from pg_database where datname = current_database()))
      and split_part(setting.value, '=', 1) = 'pgrst.db_pre_request'
      and setting.value <> 'pgrst.db_pre_request=dm_staging_api.check_admission'
  ) then
    raise exception 'Review the existing Data API pre-request hook before configuring private staging';
  end if;
end
$$;

create schema if not exists dm_staging_api;
revoke all on schema dm_staging_api from public, anon, authenticated, service_role;
grant usage on schema dm_staging_api to anon, authenticated, service_role;

create or replace function dm_staging_api.check_admission()
returns void
language plpgsql stable security invoker
set search_path = pg_catalog
as $$
begin
  if current_user <> 'authenticated' then return; end if;
  if public.can_enter_staging_portal() is not true then
    raise exception 'Private staging requires an approved Google tester' using errcode = '42501';
  end if;
end
$$;
revoke all on function dm_staging_api.check_admission() from public, anon, authenticated, service_role;
grant execute on function dm_staging_api.check_admission() to anon, authenticated, service_role;

do $$
begin
  execute format('alter role authenticator in database %I set pgrst.db_pre_request = %L',
    current_database(), 'dm_staging_api.check_admission');
end
$$;
notify pgrst, 'reload config';
commit;
