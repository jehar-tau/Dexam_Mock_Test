-- Closed by default. A server-owned allowlist permits controlled Google testing
-- without treating the Google consent screen's Testing label as an access gate.
create table dm_private.registration_policy (
  id boolean primary key default true check (id),
  mode text not null default 'closed' check (mode in ('closed','testers','open'))
);
insert into dm_private.registration_policy(id) values (true);
create table dm_private.registration_testers (
  email text primary key check (email = lower(trim(email)) and position('@' in email)>1)
);
alter table dm_private.registration_policy enable row level security;
alter table dm_private.registration_testers enable row level security;
revoke all on dm_private.registration_policy,dm_private.registration_testers from public,anon,authenticated;
grant usage on schema dm_private to supabase_auth_admin;
grant select on dm_private.registration_policy,dm_private.registration_testers to supabase_auth_admin;
create policy auth_reads_registration_policy on dm_private.registration_policy for select to supabase_auth_admin using (true);
create policy auth_reads_registration_testers on dm_private.registration_testers for select to supabase_auth_admin using (true);

create function public.before_designmocks_user_created(event jsonb) returns jsonb
language plpgsql stable security invoker set search_path = public,pg_temp as $$
declare registration_mode text; address text;
begin
  -- Provider is supplied by Auth, never a user_metadata claim.
  if coalesce(event->'user'->'app_metadata'->>'provider','') <> 'google'
    or coalesce(event->'user'->>'is_anonymous','false') <> 'false' then
    return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Use Google to sign in to DesignMocks.'));
  end if;
  address := lower(trim(coalesce(event->'user'->>'email','')));
  select mode into registration_mode from dm_private.registration_policy where id;
  if address <> '' and (registration_mode = 'open' or
    (registration_mode = 'testers' and exists(select 1 from dm_private.registration_testers where email=address))) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','DesignMocks registration is not open yet.'));
end;
$$;
revoke all on function public.before_designmocks_user_created(jsonb) from public,anon,authenticated;
grant execute on function public.before_designmocks_user_created(jsonb) to supabase_auth_admin;
