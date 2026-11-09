begin;

-- Existing advisory entries have no context receipt and keep their old behavior.
alter table dm_private.drawing_ai_suggestions
  add column context_sha256 text check (context_sha256 ~ '^[0-9a-f]{64}$');
create unique index drawing_ai_advice_context_model
  on dm_private.drawing_ai_suggestions(review_id, context_sha256, model)
  where context_sha256 is not null;

create function dm_private.drawing_advice_object_receipt(p_bucket text, p_path text, p_mime text, p_size integer)
returns jsonb language plpgsql set search_path = pg_catalog as $$
declare
  receipt jsonb;
begin
  perform 1 from storage.buckets where id = p_bucket and public = false for share;
  if not found then raise exception 'Private drawing evidence bucket is unavailable' using errcode = '55000'; end if;
  -- Include the Storage object identity, version and content metadata. Access
  -- timestamps can change on a download without changing the object.
  select to_jsonb(o) - 'last_accessed_at' into receipt
  from storage.objects o where o.bucket_id = p_bucket and o.name = p_path
    and o.metadata->>'mimetype' = p_mime and o.metadata->>'size' = p_size::text
    and to_jsonb(o)->>'archived_at' is null
    and coalesce(to_jsonb(o)->>'is_delete_marker', 'false') = 'false'
  for share;
  if not found then raise exception 'Private drawing evidence is missing or mismatched' using errcode = '55000'; end if;
  return receipt;
end
$$;

create function dm_private.drawing_advice_context(p_review_id uuid)
returns jsonb language plpgsql set search_path = pg_catalog, dm_private set timezone = 'UTC' as $$
declare
  attempt dm_private.attempts;
  review dm_private.drawing_reviews;
  item dm_private.attempt_items;
  upload dm_private.drawing_uploads;
  canonical dm_private.bank_media_assets;
  rubric jsonb;
  empty_marks jsonb;
  rubric_dto jsonb;
  figure jsonb;
  figure_ordinal integer;
  extension text;
  receipt jsonb;
  receipts jsonb := '[]';
  pages jsonb := '[]';
  figures jsonb := '[]';
  payload jsonb;
begin
  -- Match upload, submission, and review claim lock order. Media receipts
  -- remain locked through the final context check and optional suggestion write.
  select a.* into attempt from dm_private.attempts a join dm_private.drawing_reviews r on r.attempt_id = a.id
    where r.id = p_review_id for update of a;
  if not found then raise exception 'Drawing review is unavailable' using errcode = '55000'; end if;
  select * into review from dm_private.drawing_reviews
    where id = p_review_id and attempt_id = attempt.id for update;
  if not found or review.status not in ('pending','assigned') or attempt.status <> 'submitted'
    or dm_private.drawing_upload_cutoff(attempt) > clock_timestamp() then
    raise exception 'Drawing review is not ready for advice' using errcode = '55000';
  end if;
  select * into item from dm_private.attempt_items
    where attempt_id = attempt.id and question_id = review.question_id and kind = 'drawing' for share;
  if not found or item.key#>>'{practiceContext,responseKind}' is distinct from 'drawing'
    or nullif(btrim(item.prompt), '') is null then
    raise exception 'An authored drawing snapshot is required' using errcode = '55000';
  end if;
  rubric := dm_private.frozen_drawing_rubric(item.key);
  if rubric is null or jsonb_array_length(rubric) not between 1 and 12 then
    raise exception 'A frozen authored drawing rubric is required' using errcode = '55000';
  end if;
  select jsonb_object_agg(criterion->>'label', 0) into empty_marks
  from jsonb_array_elements(rubric) criterion where jsonb_typeof(criterion->'label') = 'string';
  perform dm_private.validate_drawing_marks(empty_marks, 'Check frozen rubric', 0, item.points, rubric);
  select jsonb_agg(jsonb_build_object('label', criterion->'label', 'points', criterion->'points',
    'guidance', criterion->'guidance') order by position) into rubric_dto
  from jsonb_array_elements(rubric) with ordinality as criteria(criterion, position);

  for upload in select * from dm_private.drawing_uploads
    where attempt_id = attempt.id and question_id = review.question_id order by ordinal for share
  loop
    extension := case upload.mime_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' end;
    if upload.student_id <> attempt.user_id or extension is null
      or upload.storage_path !~ ('^drawings/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]' || extension || '$')
      or upload.pixel_width is null or upload.pixel_height is null or upload.image_orientation is null then
      raise exception 'Registered drawing page metadata is required' using errcode = '55000';
    end if;
    receipt := dm_private.drawing_advice_object_receipt('drawing-submissions', upload.storage_path, upload.mime_type, upload.byte_size);
    receipts := receipts || jsonb_build_array(jsonb_build_object('uploadId', upload.id, 'object', receipt));
    pages := pages || jsonb_build_array(jsonb_build_object(
      'ordinal', upload.ordinal, 'storagePath', upload.storage_path, 'mimeType', upload.mime_type,
      'byteSize', upload.byte_size, 'width', upload.pixel_width, 'height', upload.pixel_height, 'orientation', upload.image_orientation));
  end loop;
  if pages = '[]'::jsonb then raise exception 'At least one registered drawing page is required' using errcode = '55000'; end if;

  if jsonb_typeof(item.media) is distinct from 'array' or jsonb_array_length(item.media) > 10 then
    raise exception 'Frozen drawing figures are unavailable' using errcode = '55000';
  end if;
  for figure, figure_ordinal in
    select value, ordinality::integer from jsonb_array_elements(item.media) with ordinality
  loop
    select * into canonical from dm_private.bank_media_assets
    where sha256 = figure->>'sha256' and storage_path = figure->>'path'
      and width::text = figure->>'width' and height::text = figure->>'height' for share;
    if not found then raise exception 'Frozen drawing figures are not canonical PNGs' using errcode = '55000'; end if;
    receipt := dm_private.drawing_advice_object_receipt('paper-media', canonical.storage_path, 'image/png', canonical.byte_size);
    receipts := receipts || jsonb_build_array(jsonb_build_object('figureOrdinal', figure_ordinal, 'object', receipt));
    figures := figures || jsonb_build_array(jsonb_build_object(
      'ordinal', figure_ordinal, 'storagePath', canonical.storage_path, 'mimeType', 'image/png',
      'byteSize', canonical.byte_size, 'width', canonical.width, 'height', canonical.height, 'sha256', canonical.sha256));
  end loop;

  -- Take the environment lock after potential media waits and retain it until
  -- the caller finishes, so a launch cannot pass between check and insert.
  perform 1 from public.launch_settings
    where singleton and environment_mode = 'test' and not sales_enabled for share;
  if not found then raise exception 'Local drawing advice requires test mode with sales closed' using errcode = '42501'; end if;

  payload := jsonb_build_object('status','ready','reviewId',review.id,
    'rubricVersion', item.key#>>'{practiceContext,version}', 'prompt', item.prompt, 'maxScore', item.points,
    'rubric',rubric_dto,'pages',pages,'figures',figures);
  return payload || jsonb_build_object('contextSha256', encode(sha256(convert_to(
    jsonb_build_object('format','local-drawing-advice-v1','payload',payload,'reviewVersion',review.review_version,
      'reviewStatus',review.status,'reviewerId',review.reviewer_id,'attemptId',attempt.id,'questionId',review.question_id,
      'uploadCutoff',dm_private.drawing_upload_cutoff(attempt),'practiceContext',item.key->'practiceContext',
      'frozenFigures',item.media,'receipts',receipts)::text, 'UTF8')), 'hex'));
end
$$;

create function dm_private.check_drawing_advice_model(p_model_identity text)
returns void language plpgsql immutable set search_path = pg_catalog as $$
begin
  if p_model_identity is null or char_length(p_model_identity) > 120
    or p_model_identity collate "C" !~ '^[a-z0-9][a-z0-9._-]*(/[a-z0-9][a-z0-9._-]*)?:[a-z0-9][a-z0-9._-]*@[0-9a-f]{64}$'
    or split_part(split_part(p_model_identity, '@', 1), ':', 2) ~ '(^|[._-])cloud([._-]|$)' then
    raise exception 'Invalid local drawing model identity' using errcode = '22023';
  end if;
end
$$;

create function public.service_drawing_ai_job(p_review_id uuid, p_model_identity text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare
  job jsonb;
  suggestion_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform dm_private.check_drawing_advice_model(p_model_identity);
  job := dm_private.drawing_advice_context(p_review_id);
  select id into suggestion_id from dm_private.drawing_ai_suggestions
    where review_id = p_review_id and provider = 'ollama-local' and model = p_model_identity
      and context_sha256 = job->>'contextSha256';
  if found then return jsonb_build_object('status','existing','reviewId',p_review_id,'suggestionId',suggestion_id); end if;
  return job;
end
$$;

create function public.service_save_drawing_ai_advice(
  p_review_id uuid, p_context_sha256 text, p_model_identity text, p_criterion_marks jsonb,
  p_comments text, p_confidence numeric, p_evidence jsonb
)
returns uuid language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare
  job jsonb;
  suggestion_id uuid;
  proposed_score numeric;
  snippet jsonb;
  snippet_text text;
  whitespace constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform dm_private.check_drawing_advice_model(p_model_identity);
  if p_context_sha256 is null or p_context_sha256 collate "C" !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid drawing advice context digest' using errcode = '22023';
  end if;
  job := dm_private.drawing_advice_context(p_review_id);
  if p_context_sha256 is distinct from job->>'contextSha256' then
    raise exception 'Drawing advice context changed' using errcode = '40001';
  end if;
  select id into suggestion_id from dm_private.drawing_ai_suggestions
    where review_id = p_review_id and provider = 'ollama-local' and model = p_model_identity
      and context_sha256 = p_context_sha256;
  if found then return suggestion_id; end if;

  if jsonb_typeof(p_criterion_marks) = 'object' then
    select sum((value #>> '{}')::numeric) filter (where jsonb_typeof(value) = 'number') into proposed_score
      from jsonb_each(p_criterion_marks);
  end if;
  perform dm_private.validate_drawing_marks(p_criterion_marks, p_comments, proposed_score, (job->>'maxScore')::numeric, job->'rubric');
  if p_confidence is null or p_confidence not between 0 and 1 or jsonb_typeof(p_evidence) is distinct from 'array'
    or octet_length(p_evidence::text) > 8192 then
    raise exception 'Invalid local drawing advice evidence or confidence' using errcode = '22023';
  end if;
  if jsonb_array_length(p_evidence) > 12 then
    raise exception 'Too many local drawing advice evidence entries' using errcode = '22023';
  end if;
  for snippet in select value from jsonb_array_elements(p_evidence) loop
    snippet_text := snippet #>> '{}';
    if jsonb_typeof(snippet) <> 'string' or snippet_text <> btrim(snippet_text, whitespace)
      or char_length(snippet_text) not between 1 and 400
      or char_length(snippet_text) + (select count(*) from regexp_split_to_table(snippet_text, '') ch where ascii(ch) > 65535) > 400 then
      raise exception 'Invalid local drawing advice evidence entry' using errcode = '22023';
    end if;
  end loop;
  insert into dm_private.drawing_ai_suggestions(review_id, provider, model, rubric_version, criterion_marks,
    comments, proposed_score, confidence, evidence, context_sha256)
  values (p_review_id, 'ollama-local', p_model_identity, job->>'rubricVersion', p_criterion_marks,
    btrim(p_comments), proposed_score, p_confidence, p_evidence, p_context_sha256)
  returning id into suggestion_id;
  return suggestion_id;
end
$$;

revoke all on function dm_private.drawing_advice_object_receipt(text,text,text,integer),
  dm_private.drawing_advice_context(uuid), dm_private.check_drawing_advice_model(text) from public, anon, authenticated, service_role;
revoke all on function public.service_drawing_ai_job(uuid,text),
  public.service_save_drawing_ai_advice(uuid,text,text,jsonb,text,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.service_drawing_ai_job(uuid,text),
  public.service_save_drawing_ai_advice(uuid,text,text,jsonb,text,numeric,jsonb) to service_role;

commit;
