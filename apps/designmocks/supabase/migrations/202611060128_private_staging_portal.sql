begin;

-- Returning accounts must still qualify for private staging after signup.
create function public.can_enter_staging_portal()
returns boolean language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select exists (
    select 1
    from auth.users u
    join dm_private.registration_testers t on t.email=lower(btrim(u.email))
    cross join dm_private.registration_policy registration
    cross join public.launch_settings launch
    where u.id=auth.uid() and u.email_confirmed_at is not null and not u.is_anonymous
      and u.raw_app_meta_data->>'provider'='google'
      and registration.id and registration.mode='testers'
      and launch.singleton and launch.environment_mode='test' and not launch.sales_enabled
  )
$$;

revoke all on function public.can_enter_staging_portal() from public,anon;
grant execute on function public.can_enter_staging_portal() to authenticated;

commit;
