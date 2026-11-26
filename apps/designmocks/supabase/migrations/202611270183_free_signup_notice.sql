-- A free student accepts the version displayed on the site using accept_current_terms.
-- The receipt is scoped to the authenticated account and survives a new browser session.
create function public.free_signup_notice() returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object(
    'required', registration.mode = 'open' and launch.environment_mode = 'test' and not launch.sales_enabled,
    'version', launch.policy_version,
    'accepted', coalesce(profile.accepted_at is not null and
      launch.policy_version ~ '^dmocks-notices-v1-[0-9a-f]{64}$' and profile.terms_version = launch.policy_version, false)
  )
  from dm_private.registration_policy registration
  cross join public.launch_settings launch
  left join public.profiles profile on profile.user_id = auth.uid()
  where registration.id and launch.singleton and auth.uid() is not null
$$;
revoke all on function public.free_signup_notice() from public, anon;
grant execute on function public.free_signup_notice() to authenticated;
