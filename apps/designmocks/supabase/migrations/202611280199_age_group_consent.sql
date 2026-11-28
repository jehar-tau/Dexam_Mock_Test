-- Owner's decision, 28 Nov 2026: DMocks is for students aged 16 or older; a student under 18
-- needs a parent or guardian's agreement. The sign-up records which the student confirmed,
-- with the notice version they accepted. The site asks for an age group only once the
-- published notice allows under-18s (see src/age-consent.js).
--
-- Apply this BEFORE activating a notice whose eligibility text names an age under 18.
begin;

alter table public.profiles add column if not exists age_group text;
alter table public.profiles drop constraint if exists profiles_age_group;
alter table public.profiles add constraint profiles_age_group
  check (age_group is null or age_group in ('18_plus', '16_17_guardian'));

create or replace function public.accept_current_terms(p_version text, p_age_group text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare active_version text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_age_group is null or p_age_group not in ('18_plus', '16_17_guardian') then
    raise exception 'Choose an age group' using errcode = '22023';
  end if;
  select policy_version into active_version from public.launch_settings where singleton;
  if active_version is null or p_version is distinct from active_version then raise exception 'Published terms are not ready'; end if;
  insert into public.profiles(user_id, terms_version, accepted_at, age_group) values(auth.uid(), p_version, now(), p_age_group)
  on conflict(user_id) do update set terms_version = excluded.terms_version, accepted_at = excluded.accepted_at,
    age_group = excluded.age_group;
end $$;
revoke all on function public.accept_current_terms(text, text) from public, anon;
grant execute on function public.accept_current_terms(text, text) to authenticated;

-- The receipt now also tells the student which age group they confirmed. Acceptance stays
-- required once sales open, so a student who joins on or after sales day also confirms
-- their age group and accepts the paid notice before using the portal, in Test or Live mode.
create or replace function public.free_signup_notice() returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object(
    'required', registration.mode = 'open',
    'version', launch.policy_version,
    'accepted', coalesce(profile.accepted_at is not null and
      launch.policy_version ~ '^dmocks-notices-v1-[0-9a-f]{64}$' and profile.terms_version = launch.policy_version, false),
    'ageGroup', profile.age_group
  )
  from dm_private.registration_policy registration
  cross join public.launch_settings launch
  left join public.profiles profile on profile.user_id = auth.uid()
  where registration.id and launch.singleton and auth.uid() is not null
$$;
revoke all on function public.free_signup_notice() from public, anon;
grant execute on function public.free_signup_notice() to authenticated;

commit;
