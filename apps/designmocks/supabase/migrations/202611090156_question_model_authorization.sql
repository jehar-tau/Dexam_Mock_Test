begin;

alter table dm_private.question_intake_assets
  add column extraction_actor_id uuid,
  add constraint intake_extraction_actor_requires_token
    check (extraction_actor_id is null or extraction_token is not null);
comment on column dm_private.question_intake_assets.extraction_actor_id is
  'Actor bound to the current extraction token. Pre-upgrade tokened claims have no provable actor and must expire or be failed by the exact token before a current administrator retries. Existing results remain intact.';

create function dm_private.lock_question_processing_admin(p_actor_id uuid)
returns void language plpgsql set search_path = pg_catalog, dm_private as $$
begin
  -- Lock the membership row after blocking job/reference fences. A concurrent
  -- revocation either commits before this check or waits for this transaction.
  perform 1 from dm_private.admins where user_id = p_actor_id for key share;
  if not found then raise exception 'Admin access required' using errcode = '42501'; end if;
end
$$;

create or replace function public.claim_question_intake_asset(p_asset_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare
  asset dm_private.question_intake_assets;
  result jsonb;
  token uuid;
  expires_at timestamptz;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into asset from dm_private.question_intake_assets where id = p_asset_id for update;
  if not found then raise exception 'Intake asset unavailable'; end if;
  if p_actor_id is not null then
    perform dm_private.lock_question_processing_admin(p_actor_id);
    token := gen_random_uuid();
  elsif asset.extraction_token is not null then
    raise exception 'A processing token is required';
  end if;

  if asset.status = 'extracting' and coalesce(asset.extraction_deadline, asset.updated_at + interval '5 minutes') <= clock_timestamp() then
    update dm_private.question_intake_assets set status = 'failed' where id = asset.id;
  end if;
  result := dm_private.claim_question_intake_asset(p_asset_id);
  expires_at := clock_timestamp() + interval '5 minutes';
  update dm_private.question_intake_assets set extraction_token = token, extraction_actor_id = p_actor_id,
    extraction_deadline = expires_at, extraction_attempts = extraction_attempts + 1, extraction_model = null,
    extraction_response_id = null, extraction_count = null, extraction_result_hash = null where id = asset.id;
  return result || jsonb_build_object('token', token, 'expiresAt', expires_at);
end
$$;

create function public.authorize_question_intake_provider(p_asset_id uuid, p_actor_id uuid, p_token uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare
  asset dm_private.question_intake_assets;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into asset from dm_private.question_intake_assets where id = p_asset_id for update;
  if not found or p_token is null or asset.extraction_token is distinct from p_token then
    raise exception 'Intake processing token is unavailable' using errcode = '40001';
  end if;
  if asset.extraction_actor_id is null then
    raise exception 'Intake claim predates actor binding. Retry extraction after recovery.' using errcode = '40001';
  end if;
  if asset.extraction_actor_id is distinct from p_actor_id then
    raise exception 'Intake claim does not belong to this administrator' using errcode = '42501';
  end if;
  perform dm_private.lock_question_processing_admin(p_actor_id);
  if asset.status <> 'extracting' or asset.extraction_deadline is null or asset.extraction_deadline <= clock_timestamp() then
    raise exception 'Intake processing expired or is no longer active' using errcode = '40001';
  end if;
  return true;
end
$$;

create or replace function public.complete_question_intake_asset(
  p_asset_id uuid, p_model text, p_response_id text, p_questions jsonb, p_token uuid
)
returns integer language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare
  asset dm_private.question_intake_assets;
  total integer;
  fingerprint text := encode(sha256(convert_to(p_questions::text, 'UTF8')), 'hex');
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into asset from dm_private.question_intake_assets where id = p_asset_id for update;
  if not found or asset.extraction_token is distinct from p_token then
    raise exception 'Intake processing token is unavailable' using errcode = '40001';
  end if;
  -- The old tokenless service overload has no claimant. Modern completion
  -- and its idempotent replay always require a bound administrator.
  if p_token is not null then
    if asset.extraction_actor_id is null then
      raise exception 'Intake claim predates actor binding. Retry extraction after recovery.' using errcode = '40001';
    end if;
    perform dm_private.lock_question_processing_admin(asset.extraction_actor_id);
  end if;
  if asset.status in ('extracted', 'reviewed') and asset.extraction_model = p_model and asset.extraction_response_id = p_response_id
    and asset.extraction_result_hash = fingerprint then return asset.extraction_count; end if;
  if asset.status <> 'extracting' or
    (case when p_token is null then coalesce(asset.extraction_deadline, asset.updated_at + interval '5 minutes')
      else asset.extraction_deadline end > clock_timestamp()) is not true then
    raise exception 'Intake processing expired or is no longer active' using errcode = '40001';
  end if;
  total := dm_private.complete_question_intake_asset(p_asset_id, p_model, p_response_id, p_questions);
  update dm_private.question_intake_assets set extraction_deadline = null, extraction_count = total,
    extraction_result_hash = fingerprint where id = asset.id;
  return total;
end
$$;

-- Match the existing approved reference projection for both callers.
create function dm_private.ai_draft_basis_dto(p_request dm_private.ai_draft_requests)
returns jsonb language plpgsql stable set search_path = pg_catalog, dm_private as $$
declare
  basis jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'externalKey', q.external_key, 'type', q.question_type, 'topic', q.topic,
    'difficulty', coalesce(q.payload->>'difficulty','unassessed'), 'prompt', left(q.payload->>'prompt',4000)
  ) order by array_position(p_request.basis_external_keys,q.external_key)), '[]') into basis
  from dm_private.ai_reference_questions(p_request.basis_external_keys) q;
  if jsonb_array_length(basis) <> cardinality(p_request.basis_external_keys) then
    raise exception 'A basis question is no longer cleared for AI drafting' using errcode = '40001';
  end if;
  return jsonb_build_object('requestId', p_request.id, 'exam', p_request.exam, 'topic', p_request.topic,
    'questionType', p_request.question_type, 'instruction', p_request.instruction, 'basis', basis);
end
$$;

create or replace function public.admin_ai_draft_basis(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, dm_private as $$
declare
  request dm_private.ai_draft_requests;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  select * into request from dm_private.ai_draft_requests where id = p_request_id and created_by = auth.uid() and status = 'running';
  if not found then raise exception 'AI draft request unavailable'; end if;
  return dm_private.ai_draft_basis_dto(request);
end
$$;

create function dm_private.lock_ai_draft_reference_rows(p_basis_external_keys text[])
returns void language plpgsql set search_path = pg_catalog, dm_private as $$
begin
  -- Do not filter on approval before the lock. Re-read eligibility after
  -- waiting on any in-flight bank review or import.
  perform 1 from dm_private.bank_questions
  where external_key = any(p_basis_external_keys) order by external_key for share;
end
$$;

create function public.read_ai_draft_provider_basis(p_request_id uuid, p_actor_id uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare
  request dm_private.ai_draft_requests;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into request from dm_private.ai_draft_requests where id = p_request_id for update;
  if not found or p_token is null then
    raise exception 'AI processing token is unavailable' using errcode = '40001';
  end if;
  if request.created_by is distinct from p_actor_id then
    raise exception 'AI draft request unavailable' using errcode = '42501';
  end if;
  if request.run_token is distinct from p_token then
    raise exception 'AI processing token is unavailable' using errcode = '40001';
  end if;
  if request.status = 'running' then
    perform dm_private.lock_ai_draft_reference_rows(request.basis_external_keys);
  end if;
  perform dm_private.lock_question_processing_admin(p_actor_id);
  if request.status <> 'running' or request.run_deadline is null or request.run_deadline <= clock_timestamp() then
    raise exception 'AI draft processing expired or is no longer active' using errcode = '40001';
  end if;
  return dm_private.ai_draft_basis_dto(request);
end
$$;

create or replace function public.claim_ai_draft_request(p_request_id uuid, p_actor_id uuid, p_retry boolean)
returns jsonb language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare
  request dm_private.ai_draft_requests;
  token uuid := gen_random_uuid();
  expires_at timestamptz;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into request from dm_private.ai_draft_requests where id = p_request_id for update;
  if not found or request.created_by is distinct from p_actor_id then
    raise exception 'AI draft request unavailable' using errcode = '42501';
  end if;
  perform dm_private.lock_ai_draft_reference_rows(request.basis_external_keys);
  perform dm_private.lock_question_processing_admin(p_actor_id);
  if p_retry is null then raise exception 'Choose a new request or a retry'; end if;
  if p_retry then
    if request.status <> 'failed' and not (request.status in ('queued','running')
      and coalesce(request.run_deadline, request.created_at + interval '5 minutes') <= clock_timestamp()) then
      raise exception 'AI draft is already processing or has completed';
    end if;
  elsif request.status not in ('queued','running') or request.run_token is not null then
    raise exception 'AI draft is already processing or has completed';
  end if;
  if (select count(*) from dm_private.ai_reference_questions(request.basis_external_keys)) <> cardinality(request.basis_external_keys) then
    raise exception 'A basis question is no longer cleared for AI drafting' using errcode = '40001';
  end if;
  expires_at := clock_timestamp() + interval '5 minutes';
  update dm_private.ai_draft_requests set status = 'running', run_token = token, run_deadline = expires_at,
    run_attempts = run_attempts + 1, error = null, model = null, response_id = null, completed_at = null where id = request.id;
  return jsonb_build_object('token', token, 'expiresAt', expires_at);
end
$$;

create or replace function public.complete_ai_draft_request(
  p_request_id uuid, p_model text, p_response_id text, p_payload jsonb, p_token uuid
)
returns uuid language plpgsql security definer set search_path = pg_catalog, dm_private as $$
declare
  request dm_private.ai_draft_requests;
  draft_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into request from dm_private.ai_draft_requests where id = p_request_id for update;
  if not found or request.run_token is distinct from p_token then
    raise exception 'AI processing token is unavailable' using errcode = '40001';
  end if;
  if request.status = 'running' then
    perform dm_private.lock_ai_draft_reference_rows(request.basis_external_keys);
  end if;
  perform dm_private.lock_question_processing_admin(request.created_by);
  if request.status = 'running' and
    (case when p_token is null then coalesce(request.run_deadline, request.created_at + interval '5 minutes')
      else request.run_deadline end > clock_timestamp()) is not true then
    raise exception 'AI draft processing expired' using errcode = '40001';
  end if;
  draft_id := dm_private.complete_ai_draft_request(p_request_id, p_model, p_response_id, p_payload);
  update dm_private.ai_draft_requests set run_deadline = null where id = request.id;
  return draft_id;
end
$$;

revoke all on function dm_private.lock_question_processing_admin(uuid),
  dm_private.ai_draft_basis_dto(dm_private.ai_draft_requests),
  dm_private.lock_ai_draft_reference_rows(text[]) from public, anon, authenticated, service_role;
revoke all on function public.authorize_question_intake_provider(uuid,uuid,uuid),
  public.read_ai_draft_provider_basis(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.authorize_question_intake_provider(uuid,uuid,uuid),
  public.read_ai_draft_provider_basis(uuid,uuid,uuid) to service_role;

commit;
