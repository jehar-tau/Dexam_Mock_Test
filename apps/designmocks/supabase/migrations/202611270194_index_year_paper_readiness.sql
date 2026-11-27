-- Locate objective membership and possible hold identities without reading each question payload.
create index bank_year_paper_membership_idx on dm_private.bank_questions
  (exam,(payload#>>'{provenance,paperId}'),(payload#>>'{provenance,year}'))
  where active and question_type<>'DESCRIPTIVE' and payload->'holds'='[]'::jsonb;

create index year_answer_hold_identity_idx on dm_private.answer_keys
  ((coalesce(nullif(key->>'sourceExternalKey',''),'question:'||question_id::text)));

create or replace function dm_private.paper_quality_held(p_paper_id uuid) returns boolean
language sql stable set search_path=pg_catalog,dm_private as $$
  with identities as (
    select external_key as identity from dm_private.bank_local_holds
    union all
    select identity_key from dm_private.reported_question_queue where status in ('pending','retired')
  ), candidates as materialized (
    -- The full versioned hold check only needs questions with a matching identity.
    select q as question,k.key,k.explanation
    from identities h
    join dm_private.answer_keys k
      on coalesce(nullif(k.key->>'sourceExternalKey',''),'question:'||k.question_id::text)=h.identity
    join dm_private.questions q on q.id=k.question_id and q.paper_id=p_paper_id
  )
  select exists(select from candidates c where dm_private.question_is_held(
    to_jsonb(c.question)||jsonb_build_object('key',c.key,'explanation',c.explanation),(c.question).id))
$$;
