-- Owner's request, 28 Nov 2026: the student profile also records where the student is in
-- their studies, their state, and whether they agree to hear about DMocks and Design Exam
-- Academy courses and classes. Marketing permission is optional, never pre-set, and is
-- not accepted from a student who confirmed they are 16 or 17 (202611280199): India's
-- DPDP Act does not allow advertising targeted at children. Administrators can download
-- the contact details of students who gave permission.
begin;

alter table public.profiles
  add column if not exists study_stage text,
  add column if not exists home_state text,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists age_group text;
alter table public.profiles drop constraint if exists profiles_study_stage;
alter table public.profiles add constraint profiles_study_stage
  check (study_stage is null or study_stage in ('class_11', 'class_12', 'after_class_12', 'college', 'working'));
alter table public.profiles drop constraint if exists profiles_home_state;
alter table public.profiles add constraint profiles_home_state
  check (home_state is null or char_length(home_state) between 2 and 60);

create or replace function public.my_candidate_profile()
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce((select jsonb_build_object('displayName', display_name, 'phone', phone_e164, 'phoneVerified', phone_verified_at is not null,
    'appearingYear', appearing_year, 'city', city, 'exams', exams, 'completed', onboarding_completed_at is not null,
    'studyStage', study_stage, 'state', home_state, 'marketingConsent', marketing_consent_at is not null)
    from public.profiles where user_id = auth.uid()), '{}'::jsonb)
$$;

create or replace function public.save_candidate_profile(p_display_name text, p_phone text, p_appearing_year integer, p_city text,
  p_exams text[], p_study_stage text, p_state text, p_marketing_consent boolean)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare actor uuid := auth.uid(); stage text := btrim(p_study_stage); state text := btrim(p_state); minor boolean;
begin
  if actor is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if stage is null or stage not in ('class_11', 'class_12', 'after_class_12', 'college', 'working')
     or state is null or char_length(state) not between 2 and 60 or p_marketing_consent is null then
    raise exception 'Invalid candidate profile' using errcode = '22023';
  end if;
  -- The five original details keep their own checks, lock and phone rules.
  perform public.save_candidate_profile(p_display_name, p_phone, p_appearing_year, p_city, p_exams);
  select age_group = '16_17_guardian' into minor from public.profiles where user_id = actor;
  update public.profiles set study_stage = stage, home_state = state,
    marketing_consent_at = case when p_marketing_consent and not coalesce(minor, false)
      then coalesce(marketing_consent_at, clock_timestamp()) end
  where user_id = actor;
  return public.my_candidate_profile();
end $$;

-- Students who gave marketing permission, newest first, for an administrator's download.
create or replace function public.admin_student_contacts()
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('name', display_name, 'phone', phone_e164, 'exams', exams,
      'appearingYear', appearing_year, 'studyStage', study_stage, 'city', city, 'state', home_state,
      'permissionSince', marketing_consent_at) order by marketing_consent_at desc)
    from public.profiles where marketing_consent_at is not null and coalesce(age_group, '') <> '16_17_guardian'), '[]'::jsonb);
end $$;

revoke all on function public.save_candidate_profile(text, text, integer, text, text[], text, text, boolean), public.admin_student_contacts() from public, anon;
grant execute on function public.save_candidate_profile(text, text, integer, text, text[], text, text, boolean), public.admin_student_contacts() to authenticated;
revoke all on function public.my_candidate_profile() from public, anon;
grant execute on function public.my_candidate_profile() to authenticated;

commit;
