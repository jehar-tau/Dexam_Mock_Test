alter table public.profiles
  add column display_name text,
  add column phone_e164 text,
  add column phone_verified_at timestamptz,
  add column appearing_year integer,
  add column city text,
  add column exams text[] not null default '{}',
  add column onboarding_completed_at timestamptz;

alter table public.profiles
  add constraint profile_name_valid check(display_name is null or char_length(display_name) between 2 and 100),
  add constraint profile_phone_valid check(phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  add constraint profile_year_valid check(appearing_year is null or appearing_year between 2026 and 2040),
  add constraint profile_city_valid check(city is null or char_length(city) between 2 and 120),
  add constraint profile_exams_valid check(exams <@ array['uceed','nid','nift','ceed']::text[]);

create or replace function public.my_candidate_profile()
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
  select coalesce((select jsonb_build_object('displayName',display_name,'phone',phone_e164,'phoneVerified',phone_verified_at is not null,'appearingYear',appearing_year,'city',city,'exams',exams,'completed',onboarding_completed_at is not null) from public.profiles where user_id=auth.uid()),'{}'::jsonb)
$$;

create or replace function public.save_candidate_profile(p_display_name text,p_phone text,p_appearing_year integer,p_city text,p_exams text[])
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_exams text[]; v_old_phone text; v_verified timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select array_agg(distinct lower(value) order by lower(value)) into v_exams from unnest(p_exams) value;
  if char_length(trim(p_display_name)) not between 2 and 100 or trim(p_phone) !~ '^\+[1-9][0-9]{7,14}$' or p_appearing_year not between 2026 and 2040 or char_length(trim(p_city)) not between 2 and 120 or coalesce(cardinality(v_exams),0)=0 or not (v_exams <@ array['uceed','nid','nift','ceed']::text[]) then raise exception 'Invalid candidate profile'; end if;
  select phone_e164,phone_verified_at into v_old_phone,v_verified from public.profiles where user_id=auth.uid();
  if v_old_phone is distinct from trim(p_phone) then v_verified := null; end if;
  insert into public.profiles(user_id,display_name,phone_e164,phone_verified_at,appearing_year,city,exams,onboarding_completed_at)
  values(auth.uid(),trim(p_display_name),trim(p_phone),v_verified,p_appearing_year,trim(p_city),v_exams,case when v_verified is not null then now() end)
  on conflict(user_id) do update set display_name=excluded.display_name,phone_e164=excluded.phone_e164,phone_verified_at=excluded.phone_verified_at,appearing_year=excluded.appearing_year,city=excluded.city,exams=excluded.exams,onboarding_completed_at=excluded.onboarding_completed_at;
  return public.my_candidate_profile();
end $$;

create or replace function public.verify_candidate_phone(p_user_id uuid,p_phone text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  update public.profiles set phone_verified_at=now(),onboarding_completed_at=now() where user_id=p_user_id and phone_e164=p_phone and display_name is not null and appearing_year is not null and city is not null and cardinality(exams)>0;
  if not found then raise exception 'Profile or phone mismatch'; end if;
end $$;

revoke all on function public.my_candidate_profile(),public.save_candidate_profile(text,text,integer,text,text[]),public.verify_candidate_phone(uuid,text) from public,anon;
grant execute on function public.my_candidate_profile(),public.save_candidate_profile(text,text,integer,text,text[]) to authenticated;
grant execute on function public.verify_candidate_phone(uuid,text) to service_role;
