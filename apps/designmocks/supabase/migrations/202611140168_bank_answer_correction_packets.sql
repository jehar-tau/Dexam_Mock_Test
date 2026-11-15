begin;

create function public.admin_prepare_bank_answer_correction(
  p_external_key text,
  p_expected_version text,
  p_answer text,
  p_review_note text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, dm_private
as $$
declare
  question dm_private.bank_questions;
  payload_text text;
begin
  if not public.is_dmocks_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into question from dm_private.bank_questions where external_key = p_external_key;
  if not found or not question.active or question.payload->'holds' is distinct from '[]'::jsonb then
    raise exception 'This question is unavailable for correction';
  end if;
  if dm_private.bank_review_version(question) is distinct from p_expected_version then
    raise exception 'Question changed. Refresh the bank and review it again.' using errcode = '40001';
  end if;
  if question.question_type not in ('MCQ', 'MSQ', 'NAT') then
    raise exception 'Choose a question with an objective answer';
  end if;

  p_answer := btrim(p_answer);
  p_review_note := btrim(p_review_note);
  if coalesce(char_length(p_answer), 0) not between 1 and 200
     or coalesce(char_length(p_review_note), 0) not between 10 and 1000 then
    raise exception 'Supply a proposed answer and a review note of 10 to 1000 characters';
  end if;
  if p_answer is not distinct from question.payload#>>'{answer,raw}' then
    raise exception 'Enter a changed answer';
  end if;

  payload_text := jsonb_set(question.payload, '{answer}',
    (case when jsonb_typeof(question.payload->'answer') = 'object' then question.payload->'answer' else '{}'::jsonb end)
      || jsonb_build_object('raw', p_answer, 'status', 'human-reviewed'))::text;

  return jsonb_build_object(
    'packet', jsonb_build_object(
      'format', 'dmocks-question-export-v1', 'artifactId', gen_random_uuid(),
      'externalKey', question.external_key, 'contentSha256', encode(sha256(convert_to(payload_text, 'UTF8')), 'hex'),
      'payloadText', payload_text, 'rightsNote', p_review_note, 'createdAt', statement_timestamp(),
      'sourceType', 'manual', 'publicationState', 'git-review-required'
    ),
    'replacesContentSha256', question.content_sha256,
    'sourceCommit', question.source_commit
  );
end;
$$;

revoke all on function public.admin_prepare_bank_answer_correction(text, text, text, text) from public, anon, service_role;
grant execute on function public.admin_prepare_bank_answer_correction(text, text, text, text) to authenticated;

commit;
