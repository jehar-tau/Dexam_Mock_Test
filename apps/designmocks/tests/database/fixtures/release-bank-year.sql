-- Fictional acceptance helper. Include inside a transaction after seeding
-- reviewed runtime bank rows. It does not grant student access by itself.
create function pg_temp.release_bank_year(p_keys text[],p_exam text,p_year integer,p_source text)
returns uuid language plpgsql as $$
declare v_paper uuid:=gen_random_uuid();v_count integer;
begin
  select count(*) into v_count from dm_private.bank_questions b
    where b.external_key=any(p_keys) and b.exam=p_exam and b.active
      and b.owner_approved and b.rights_confirmed and b.runtime_payload is not null;
  if v_count<>cardinality(p_keys) then raise exception 'Incomplete fictional year fixture';end if;
  update dm_private.bank_questions b set payload=jsonb_set(b.payload,'{provenance}',
    jsonb_build_object('exam',p_exam,'paperId',p_source,'year',p_year))
    where b.external_key=any(p_keys);
  insert into dm_private.papers(id,title,exam,duration_seconds,published,reviewed,rights_confirmed,source_kind)
    values(v_paper,'Fictional '||upper(p_exam)||' '||p_year,p_exam,3600,true,true,true,'year');
  insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
  select md5('year-fixture-question-'||v_paper::text||b.external_key)::uuid,
    v_paper,row_number()over(order by b.external_key),b.runtime_payload->>'prompt',
    b.runtime_payload->'options',b.runtime_payload->>'kind',b.runtime_payload->'marking',
    b.runtime_payload->'media',(b.runtime_payload->>'points')::numeric,
    (b.runtime_payload->>'negativePoints')::numeric,b.topic,true
  from dm_private.bank_questions b where b.external_key=any(p_keys);
  insert into dm_private.answer_keys(question_id,key,explanation)
  select md5('year-fixture-question-'||v_paper::text||b.external_key)::uuid,
    b.runtime_payload->'key',case when char_length(btrim(b.runtime_payload->>'explanation'))<20
      then (b.runtime_payload->>'explanation')||' for fictional source.'
      else b.runtime_payload->>'explanation' end
  from dm_private.bank_questions b where b.external_key=any(p_keys);
  insert into dm_private.year_paper_releases(paper_id,exam,paper_year,source_paper_id,part_label,question_count,review_sha256)
    values(v_paper,p_exam,p_year,p_source,'Part A',v_count,dm_private.year_paper_manifest(v_paper));
  if not dm_private.year_paper_ready(v_paper) then raise exception 'Fictional year fixture failed release';end if;
  return v_paper;
end $$;
