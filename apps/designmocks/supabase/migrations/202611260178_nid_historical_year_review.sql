-- NID year papers carry a plan-scoped historical runtime (migration 177), not
-- the authored practice runtime. Owner review of such a question checks that
-- the installed runtime is that exact historical runtime for this question and
-- paper, and records the owner's attestation. Authored practice rules, admin
-- access, the review log and every other exam are unchanged.
create or replace function public.admin_review_bank_question(p_external_key text,p_approved boolean,p_rights_confirmed boolean,p_note text default null)returns void
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare q dm_private.bank_questions;expected jsonb;historical boolean:=false;
begin
 if not public.is_dmocks_admin()then raise exception'Admin access required'using errcode='42501';end if;
 if p_approved and not p_rights_confirmed then raise exception'Rights confirmation is required';end if;
 if p_approved then
  select *into q from dm_private.bank_questions where external_key=p_external_key for update;
  if q.exam='nid'then
   historical:=coalesce(q.objective_ready and q.question_type='MCQ'
     and q.payload->'holds'='[]'::jsonb
     and q.runtime_payload->>'kind'='mcq'
     and q.runtime_payload->'context'->>'version'='nid-historical-year-v1'
     and q.runtime_payload->'context'->>'scope'='historical-year-paper'
     and q.runtime_payload->'context'->>'exam'='nid'
     and q.runtime_payload->'context'->>'sourcePaperId'=q.payload#>>'{provenance,paperId}'
     and q.runtime_payload->'context'->>'year'=q.payload#>>'{provenance,year}'
     and q.runtime_payload#>>'{key,sourceExternalKey}'=q.external_key
     and q.runtime_payload->>'prompt'=q.payload->>'prompt',false);
   if historical then
    if coalesce(char_length(btrim(p_note)),0)<20 then
     raise exception'Historical NID approval needs the owner attestation in the review note'using errcode='22023';end if;
   else
    expected:=dm_private.nid_practice_runtime(q,dm_private.nid_binding_state(q));
    if expected is null or q.runtime_payload is distinct from expected then raise exception'Current authored practice conversion and review are required'using errcode='40001';end if;
   end if;
  end if;
 end if;
 update dm_private.bank_questions set owner_approved=p_approved,rights_confirmed=(p_approved and p_rights_confirmed),review_note=nullif(trim(p_note),''),reviewed_by=auth.uid(),reviewed_at=now()
 where external_key=p_external_key and active and(not p_approved or runtime_payload is not null)returning *into q;
 if not found then raise exception'Runtime-ready bank question not found';end if;
 if q.exam='nid'then perform dm_private.require_nid_admin();end if;
 insert into dm_private.bank_question_reviews(external_key,reviewer_id,approved,rights_confirmed,note)values(p_external_key,auth.uid(),p_approved,(p_approved and p_rights_confirmed),nullif(trim(p_note),''));
end$$;
