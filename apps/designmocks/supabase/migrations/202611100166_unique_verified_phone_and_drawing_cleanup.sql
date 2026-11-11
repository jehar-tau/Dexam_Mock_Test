-- A verified phone number belongs to one account, and retired drawing paths can be listed for cleanup in any launch mode.
begin;

do $$
begin
  if exists (select 1 from public.profiles where phone_verified_at is not null group by phone_e164 having count(*) > 1) then
    raise exception 'Resolve duplicate verified phone numbers before applying this migration' using errcode = '23505';
  end if;
end $$;

create unique index profiles_verified_phone_unique on public.profiles (phone_e164) where phone_verified_at is not null;

create or replace function public.confirm_candidate_phone_challenge(
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
  begin
    update public.profiles set phone_verified_at = stamp, onboarding_completed_at = stamp
    where user_id = p_user_id;
  exception when unique_violation then
    -- Another account already verified this number.
    return jsonb_build_object('status', 'unavailable');
  end;
  update dm_private.candidate_phone_challenges set verified_at = stamp where challenge_id = p_challenge_id;
  return jsonb_build_object('status', 'verified');
end
$$;

create or replace function public.service_pending_drawing_removals(p_limit integer default 25)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, dm_private as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  if (p_limit between 1 and 50) is not true then raise exception 'Invalid drawing cleanup limit' using errcode = '22023'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', upload_id, 'storagePath', storage_path)
    order by removed_at, upload_id), '[]'::jsonb) from (
      select upload_id, storage_path, removed_at from dm_private.drawing_removal_receipts
      where deleted_at is null order by removed_at, upload_id limit p_limit
    ) pending);
end $$;

commit;
