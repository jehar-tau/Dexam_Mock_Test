begin;

create table dm_private.registration_pre_admissions (
  google_sub text primary key check (google_sub <> '' and google_sub = btrim(google_sub)),
  decision text not null check (decision in ('adult','guardian')),
  proof_ref uuid not null,
  consent_version text not null check (btrim(consent_version) <> ''),
  issued_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > issued_at),
  revoked_at timestamptz check (revoked_at >= issued_at)
);
alter table dm_private.registration_pre_admissions enable row level security;
revoke all on dm_private.registration_pre_admissions from public,anon,authenticated,service_role,supabase_auth_admin;
grant select on dm_private.registration_pre_admissions to supabase_auth_admin;
create policy auth_reads_pre_admissions on dm_private.registration_pre_admissions
  for select to supabase_auth_admin using (true);

create or replace function public.before_designmocks_user_created(event jsonb) returns jsonb
language plpgsql stable security invoker set search_path = pg_catalog,dm_private as $$
declare
  candidate jsonb := event->'user';
  claims jsonb := candidate->'user_metadata';
  address text := lower(btrim(candidate->>'email'));
  subject text := claims->>'sub';
  registration_mode text;
  checked_at timestamptz := statement_timestamp();
begin
  -- GoTrue sets app_metadata.provider and builds user_metadata from the Google
  -- identity for this pre-create hook. An email signup's metadata is untrusted.
  if candidate#>>'{app_metadata,provider}' is distinct from 'google'
    or coalesce(candidate->'is_anonymous','false'::jsonb) is distinct from 'false'::jsonb
    or claims->'email_verified' is distinct from 'true'::jsonb
    or jsonb_typeof(candidate->'email') is distinct from 'string'
    or jsonb_typeof(claims->'email') is distinct from 'string'
    or address = ''
    or lower(btrim(claims->>'email')) is distinct from address
    or jsonb_typeof(claims->'sub') is distinct from 'string'
    or subject = '' or subject <> btrim(subject) then
    return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Use a verified Google account to sign in to DesignMocks.'));
  end if;

  select mode into registration_mode from dm_private.registration_policy where id;
  if (registration_mode = 'open' or
      (registration_mode = 'testers' and exists(select 1 from dm_private.registration_testers where email = address)))
    and exists (
      select 1 from dm_private.registration_pre_admissions a
      where a.google_sub = subject and a.issued_at <= checked_at
        and a.expires_at > checked_at and a.revoked_at is null
    ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','DesignMocks registration is not open for this account.'));
end $$;

revoke all on function public.before_designmocks_user_created(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.before_designmocks_user_created(jsonb) to supabase_auth_admin;

commit;
