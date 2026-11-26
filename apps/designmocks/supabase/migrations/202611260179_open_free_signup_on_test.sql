-- Owner decision, 26 Nov 2026: open free student sign-up for the 27 Nov launch
-- while sales stay off, on the existing DMocks Test backend (the separate live
-- project is deferred). With registration 'open', any confirmed, non-anonymous
-- Google account may enter the controlled student portal, but only while the
-- backend is in test mode with sales disabled. Admin, staff, checkout and phone
-- verification rules are unchanged; 'testers' mode keeps the allowlist.
create or replace function public.can_enter_staging_portal()
returns boolean language sql stable security definer set search_path=pg_catalog,dm_private as $$
  select exists (
    select 1
    from auth.users u
    cross join dm_private.registration_policy registration
    cross join public.launch_settings launch
    where u.id=auth.uid() and u.email_confirmed_at is not null and not u.is_anonymous
      and u.raw_app_meta_data->>'provider'='google'
      and registration.id and launch.singleton and launch.environment_mode='test' and not launch.sales_enabled
      and (registration.mode='open'
        or (registration.mode='testers'
          and exists(select 1 from dm_private.registration_testers t where t.email=lower(btrim(u.email)))))
  )
$$;
revoke all on function public.can_enter_staging_portal() from public,anon;
grant execute on function public.can_enter_staging_portal() to authenticated;
