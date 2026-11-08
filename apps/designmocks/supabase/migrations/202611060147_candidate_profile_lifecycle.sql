begin;
create or replace function public.save_candidate_profile(p_display_name text,p_phone text,p_appearing_year integer,p_city text,p_exams text[])
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid:=auth.uid(); name text:=btrim(p_display_name); phone text:=btrim(p_phone); city text:=btrim(p_city);
 exams text[]; old_phone text; verified_at timestamptz; completed_at timestamptz;
begin
 if actor is null then raise exception 'Sign in required'using errcode='42501';end if;
 select array_agg(distinct lower(value)order by lower(value))into exams from unnest(p_exams)value;
 if name is null or char_length(name)not between 2 and 100 or phone is null or phone!~'^\+[1-9][0-9]{7,14}$'
  or p_appearing_year is null or p_appearing_year not between 2026 and 2040 or city is null or char_length(city)not between 2 and 120
  or coalesce(cardinality(exams),0)=0 or array_position(exams,null)is not null or not(exams<@array['uceed','nid','nift','ceed']::text[])then
  raise exception 'Invalid candidate profile'using errcode='22023';
 end if;
 perform 1 from auth.users where id=actor for key share;
 if not found then raise exception 'Sign in required'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('dmocks-candidate-profile:'||actor::text,0));
 -- Read verification only after the profile lock. A queued save must not reuse
 -- an earlier phone proof or erase a proof committed while it was waiting.
 select phone_e164,phone_verified_at,onboarding_completed_at into old_phone,verified_at,completed_at from public.profiles where user_id=actor for update;
 if old_phone is distinct from phone then verified_at:=null;end if;
 completed_at:=case when verified_at is not null then coalesce(completed_at,clock_timestamp())end;
 insert into public.profiles(user_id,display_name,phone_e164,phone_verified_at,appearing_year,city,exams,onboarding_completed_at)
 values(actor,name,phone,verified_at,p_appearing_year,city,exams,completed_at)
 on conflict(user_id)do update set display_name=excluded.display_name,phone_e164=excluded.phone_e164,phone_verified_at=excluded.phone_verified_at,
  appearing_year=excluded.appearing_year,city=excluded.city,exams=excluded.exams,onboarding_completed_at=excluded.onboarding_completed_at;
 return public.my_candidate_profile();
end$$;

create or replace function public.verify_candidate_phone(p_user_id uuid,p_phone text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare stamp timestamptz;
begin
 if auth.role()is distinct from'service_role'then raise exception 'Forbidden'using errcode='42501';end if;
 perform 1 from auth.users where id=p_user_id for key share;
 if not found then raise exception 'Profile or phone mismatch'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('dmocks-candidate-profile:'||p_user_id::text,0));
 stamp:=clock_timestamp();
 update public.profiles set phone_verified_at=stamp,onboarding_completed_at=stamp
 where user_id=p_user_id and phone_e164=p_phone and display_name is not null and appearing_year is not null and city is not null and cardinality(exams)>0;
 if not found then raise exception 'Profile or phone mismatch'using errcode='22023';end if;
end$$;
revoke all on function public.save_candidate_profile(text,text,integer,text,text[])from public,anon;
grant execute on function public.save_candidate_profile(text,text,integer,text,text[])to authenticated;
revoke all on function public.verify_candidate_phone(uuid,text)from public,anon,authenticated;
grant execute on function public.verify_candidate_phone(uuid,text)to service_role;
-- Actual Supabase defaults may grant table writes even when no write policy
-- admits a row. Keep profile changes behind the validating procedures as well.
revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
commit;
