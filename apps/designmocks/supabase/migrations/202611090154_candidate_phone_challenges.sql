begin;

create table dm_private.candidate_phone_challenges (
  challenge_id uuid primary key,
  -- Keep the short destination rate history after account deletion without the actor.
  actor_id uuid references auth.users(id) on delete set null,
  destination_digest text not null check (destination_digest ~ '^[0-9a-f]{64}$'),
  code_digest text not null check (code_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  invalidated_at timestamptz,
  verified_at timestamptz,
  wrong_attempts integer not null default 0 check (wrong_attempts between 0 and 5)
);
alter table dm_private.candidate_phone_challenges enable row level security;
revoke all on dm_private.candidate_phone_challenges from public, anon, authenticated, service_role;

create index candidate_phone_challenges_actor_time
  on dm_private.candidate_phone_challenges (actor_id, created_at desc);
create index candidate_phone_challenges_destination_time
  on dm_private.candidate_phone_challenges (destination_digest, created_at desc);
create index candidate_phone_challenges_expiry
  on dm_private.candidate_phone_challenges (expires_at);

create function dm_private.candidate_phone_admitted(p_user_id uuid)
returns boolean language sql stable set search_path = pg_catalog as $$
  select exists (
    select 1 from auth.users u
    cross join dm_private.registration_policy registration
    cross join public.launch_settings launch
    where u.id = p_user_id
      and u.email_confirmed_at is not null
      and not u.is_anonymous
      and u.raw_app_meta_data->>'provider' = 'google'
      and nullif(btrim(u.email), '') is not null
      and registration.id and launch.singleton
      and (
        (registration.mode = 'open' and launch.environment_mode = 'live')
        or (registration.mode = 'testers' and launch.environment_mode = 'test' and not launch.sales_enabled
          and exists (select 1 from dm_private.registration_testers t where t.email = lower(btrim(u.email))))
      )
  )
$$;
revoke all on function dm_private.candidate_phone_admitted(uuid) from public, anon, authenticated, service_role;

create function dm_private.invalidate_candidate_phone_challenges()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  update dm_private.candidate_phone_challenges
  set invalidated_at = clock_timestamp()
  where actor_id = old.user_id and invalidated_at is null and expires_at > clock_timestamp();
  return null;
end
$$;
revoke all on function dm_private.invalidate_candidate_phone_challenges() from public, anon, authenticated, service_role;

create trigger invalidate_candidate_phone_challenges_on_change
after update of phone_e164 on public.profiles
for each row when (old.phone_e164 is distinct from new.phone_e164)
execute function dm_private.invalidate_candidate_phone_challenges();

create function public.prepare_candidate_phone_challenge(
  p_user_id uuid, p_phone text, p_challenge_id uuid, p_destination_digest text, p_code_digest text
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  profile public.profiles%rowtype;
  challenge dm_private.candidate_phone_challenges%rowtype;
  stamp timestamptz;
  actor_latest timestamptz;
  destination_latest timestamptz;
  actor_fifth timestamptz;
  destination_fifth timestamptz;
  cooldown_until timestamptz;
  limit_until timestamptz;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_user_id is null or p_challenge_id is null or p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$'
    or p_destination_digest is null or p_destination_digest !~ '^[0-9a-f]{64}$'
    or p_code_digest is null or p_code_digest !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  -- Follow the profile save and verification lock order. Only reservations need the destination lock.
  perform 1 from auth.users where id = p_user_id for key share;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  perform pg_advisory_xact_lock(hashtextextended('dmocks-candidate-profile:' || p_user_id::text, 0));
  select * into profile from public.profiles where user_id = p_user_id for update;
  if profile.phone_e164 is distinct from p_phone or profile.phone_verified_at is not null
    or profile.display_name is null or profile.appearing_year is null or profile.city is null
    or coalesce(cardinality(profile.exams), 0) = 0 then
    return jsonb_build_object('status', 'unavailable');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('dmocks-candidate-phone-destination:' || p_destination_digest, 0));
  -- Serialize an ID even if two requests supply it for different actors and destinations.
  perform pg_advisory_xact_lock(hashtextextended('dmocks-candidate-phone-id:' || p_challenge_id::text, 0));
  -- Check current admission and time after any wait, including a reservation by another actor.
  if not dm_private.candidate_phone_admitted(p_user_id) then
    return jsonb_build_object('status', 'unavailable');
  end if;
  stamp := clock_timestamp();

  select * into challenge from dm_private.candidate_phone_challenges where challenge_id = p_challenge_id;
  if found then
    if challenge.actor_id = p_user_id and challenge.destination_digest = p_destination_digest
      and challenge.invalidated_at is null and challenge.expires_at > stamp and challenge.wrong_attempts < 5 then
      return jsonb_build_object('status', 'existing', 'expiresAt', challenge.expires_at,
        'retryAt', challenge.created_at + interval '60 seconds');
    end if;
    return jsonb_build_object('status', 'unavailable');
  end if;

  select created_at into actor_latest from dm_private.candidate_phone_challenges
  where actor_id = p_user_id and created_at > stamp - interval '60 seconds'
  order by created_at desc limit 1;
  select created_at into destination_latest from dm_private.candidate_phone_challenges
  where destination_digest = p_destination_digest and created_at > stamp - interval '60 seconds'
  order by created_at desc limit 1;
  cooldown_until := greatest(actor_latest, destination_latest) + interval '60 seconds';

  select created_at into actor_fifth from dm_private.candidate_phone_challenges
  where actor_id = p_user_id and created_at > stamp - interval '24 hours'
  order by created_at desc limit 1 offset 4;
  select created_at into destination_fifth from dm_private.candidate_phone_challenges
  where destination_digest = p_destination_digest and created_at > stamp - interval '24 hours'
  order by created_at desc limit 1 offset 4;
  limit_until := greatest(actor_fifth, destination_fifth) + interval '24 hours';

  if limit_until is not null then
    return jsonb_build_object('status', 'limit', 'retryAt', greatest(limit_until, cooldown_until));
  end if;
  if cooldown_until is not null then
    return jsonb_build_object('status', 'cooldown', 'retryAt', cooldown_until);
  end if;

  -- Skip locked rows so cleanup never waits on another profile or account deletion.
  with stale as (
    select challenge_id from dm_private.candidate_phone_challenges
    where expires_at < stamp - interval '24 hours'
    order by expires_at limit 64 for update skip locked
  )
  delete from dm_private.candidate_phone_challenges c using stale
  where c.challenge_id = stale.challenge_id;

  insert into dm_private.candidate_phone_challenges (challenge_id, actor_id, destination_digest, code_digest, created_at, expires_at)
  values (p_challenge_id, p_user_id, p_destination_digest, p_code_digest, stamp, stamp + interval '5 minutes')
  on conflict (challenge_id) do nothing;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;

  update dm_private.candidate_phone_challenges
  set invalidated_at = stamp
  where actor_id = p_user_id and challenge_id <> p_challenge_id
    and invalidated_at is null and expires_at > stamp;
  return jsonb_build_object('status', 'created', 'expiresAt', stamp + interval '5 minutes',
    'retryAt', stamp + interval '60 seconds');
end
$$;

create function public.confirm_candidate_phone_challenge(
  p_user_id uuid, p_phone text, p_challenge_id uuid, p_code_digest text
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  profile public.profiles%rowtype;
  challenge dm_private.candidate_phone_challenges%rowtype;
  stamp timestamptz;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_user_id is null or p_challenge_id is null or p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$'
    or p_code_digest is null or p_code_digest !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  perform 1 from auth.users where id = p_user_id for key share;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  perform pg_advisory_xact_lock(hashtextextended('dmocks-candidate-profile:' || p_user_id::text, 0));
  select * into profile from public.profiles where user_id = p_user_id for update;
  if profile.phone_e164 is distinct from p_phone or profile.display_name is null
    or profile.appearing_year is null or profile.city is null or coalesce(cardinality(profile.exams), 0) = 0 then
    return jsonb_build_object('status', 'unavailable');
  end if;
  select * into challenge from dm_private.candidate_phone_challenges
  where challenge_id = p_challenge_id and actor_id = p_user_id for update;
  if not found or not dm_private.candidate_phone_admitted(p_user_id) then
    return jsonb_build_object('status', 'unavailable');
  end if;
  stamp := clock_timestamp();

  if challenge.invalidated_at is not null then return jsonb_build_object('status', 'invalid'); end if;
  if challenge.expires_at <= stamp then return jsonb_build_object('status', 'expired'); end if;
  if challenge.verified_at is not null then
    if profile.phone_verified_at = challenge.verified_at and profile.onboarding_completed_at = challenge.verified_at
      and challenge.code_digest = p_code_digest then return jsonb_build_object('status', 'verified'); end if;
    return jsonb_build_object('status', 'invalid');
  end if;
  if profile.phone_verified_at is not null then return jsonb_build_object('status', 'unavailable'); end if;
  if challenge.wrong_attempts >= 5 then return jsonb_build_object('status', 'invalid'); end if;
  if challenge.code_digest <> p_code_digest then
    update dm_private.candidate_phone_challenges
    set wrong_attempts = wrong_attempts + 1 where challenge_id = p_challenge_id;
    return jsonb_build_object('status', 'invalid');
  end if;

  -- Same transition as verify_candidate_phone, using the identical timestamp for the replay check.
  update public.profiles set phone_verified_at = stamp, onboarding_completed_at = stamp
  where user_id = p_user_id;
  update dm_private.candidate_phone_challenges set verified_at = stamp where challenge_id = p_challenge_id;
  return jsonb_build_object('status', 'verified');
end
$$;

revoke all on function public.prepare_candidate_phone_challenge(uuid, text, uuid, text, text),
  public.confirm_candidate_phone_challenge(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.prepare_candidate_phone_challenge(uuid, text, uuid, text, text),
  public.confirm_candidate_phone_challenge(uuid, text, uuid, text) to service_role;

commit;
