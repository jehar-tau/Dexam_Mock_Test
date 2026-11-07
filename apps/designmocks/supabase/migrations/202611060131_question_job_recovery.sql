begin;

alter table dm_private.question_intake_assets
  add column extraction_token uuid,
  add column extraction_deadline timestamptz,
  add column extraction_attempts integer not null default 0 check(extraction_attempts>=0),
  add column extraction_count integer,
  add column extraction_result_hash text;
alter table dm_private.ai_draft_requests
  add column run_token uuid,
  add column run_deadline timestamptz,
  add column run_attempts integer not null default 0 check(run_attempts>=0);
create index intake_processing_deadline on dm_private.question_intake_assets(extraction_deadline,updated_at) where status='extracting';
create index ai_processing_deadline on dm_private.ai_draft_requests(run_deadline,created_at) where status in('queued','running');

-- Reuse the existing canonical validators behind both legacy and token-aware service entry points.
alter function public.claim_question_intake_asset(uuid) set schema dm_private;
alter function public.complete_question_intake_asset(uuid,text,text,jsonb) set schema dm_private;
alter function public.complete_ai_draft_request(uuid,text,text,jsonb) set schema dm_private;
revoke all on function dm_private.claim_question_intake_asset(uuid),dm_private.complete_question_intake_asset(uuid,text,text,jsonb),
  dm_private.complete_ai_draft_request(uuid,text,text,jsonb) from public,anon,authenticated,service_role;

create function public.claim_question_intake_asset(p_asset_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare asset dm_private.question_intake_assets; result jsonb; token uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into asset from dm_private.question_intake_assets where id=p_asset_id for update;
  if not found then raise exception 'Intake asset unavailable'; end if;
  if p_actor_id is not null and not exists(select 1 from dm_private.admins where user_id=p_actor_id) then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  if p_actor_id is null and asset.extraction_token is not null then raise exception 'A processing token is required'; end if;
  if asset.status='extracting' and coalesce(asset.extraction_deadline,asset.updated_at+interval '5 minutes')<=now() then
    update dm_private.question_intake_assets set status='failed' where id=asset.id;
  end if;
  result:=dm_private.claim_question_intake_asset(p_asset_id);
  if p_actor_id is not null then token:=gen_random_uuid(); end if;
  update dm_private.question_intake_assets set extraction_token=token,extraction_deadline=now()+interval '5 minutes',
    extraction_attempts=extraction_attempts+1,extraction_model=null,extraction_response_id=null,
    extraction_count=null,extraction_result_hash=null where id=asset.id;
  return result||jsonb_build_object('token',token,'expiresAt',now()+interval '5 minutes');
end $$;

create function public.claim_question_intake_asset(p_asset_id uuid)
returns jsonb language sql security definer set search_path=pg_catalog as $$
  select public.claim_question_intake_asset(p_asset_id,null::uuid)
$$;

create function public.complete_question_intake_asset(p_asset_id uuid,p_model text,p_response_id text,p_questions jsonb,p_token uuid)
returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare asset dm_private.question_intake_assets; total integer; fingerprint text:=encode(sha256(convert_to(p_questions::text,'UTF8')),'hex');
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into asset from dm_private.question_intake_assets where id=p_asset_id for update;
  if not found or asset.extraction_token is distinct from p_token then raise exception 'Intake processing token is unavailable'; end if;
  if asset.status in('extracted','reviewed') and asset.extraction_model=p_model and asset.extraction_response_id=p_response_id
    and asset.extraction_result_hash=fingerprint then return asset.extraction_count; end if;
  if asset.status<>'extracting' or coalesce(asset.extraction_deadline,asset.updated_at+interval '5 minutes')<=now() then
    raise exception 'Intake processing expired or is no longer active';
  end if;
  total:=dm_private.complete_question_intake_asset(p_asset_id,p_model,p_response_id,p_questions);
  update dm_private.question_intake_assets set extraction_deadline=null,extraction_count=total,extraction_result_hash=fingerprint where id=asset.id;
  return total;
end $$;

create function public.complete_question_intake_asset(p_asset_id uuid,p_model text,p_response_id text,p_questions jsonb)
returns integer language sql security definer set search_path=pg_catalog as $$
  select public.complete_question_intake_asset(p_asset_id,p_model,p_response_id,p_questions,null::uuid)
$$;

create function public.fail_question_intake_asset(p_asset_id uuid,p_model text,p_error text,p_token uuid)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare asset dm_private.question_intake_assets;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into asset from dm_private.question_intake_assets where id=p_asset_id for update;
  if not found or asset.extraction_token is distinct from p_token then raise exception 'Intake processing token is unavailable'; end if;
  if asset.status<>'extracting' then return; end if;
  update dm_private.question_intake_assets set status='failed',extraction_deadline=null,extraction_model=nullif(btrim(p_model),''),
    extraction_error=left(coalesce(nullif(btrim(p_error),''),'Extraction failed'),500),updated_at=now() where id=asset.id;
end $$;

create or replace function public.fail_question_intake_asset(p_asset_id uuid,p_model text,p_error text)
returns void language sql security definer set search_path=pg_catalog as $$
  select public.fail_question_intake_asset(p_asset_id,p_model,p_error,null::uuid)
$$;

create function public.claim_ai_draft_request(p_request_id uuid,p_actor_id uuid,p_retry boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare request dm_private.ai_draft_requests; token uuid:=gen_random_uuid();
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if not exists(select 1 from dm_private.admins where user_id=p_actor_id) then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into request from dm_private.ai_draft_requests where id=p_request_id for update;
  if not found or request.created_by<>p_actor_id then raise exception 'AI draft request unavailable' using errcode='42501'; end if;
  if p_retry is null then raise exception 'Choose a new request or a retry'; end if;
  if p_retry then
    if request.status<>'failed' and not(request.status in('queued','running')
      and coalesce(request.run_deadline,request.created_at+interval '5 minutes')<=now()) then
      raise exception 'AI draft is already processing or has completed';
    end if;
  elsif request.status not in('queued','running') or request.run_token is not null then
    raise exception 'AI draft is already processing or has completed';
  end if;
  if (select count(*) from dm_private.ai_reference_questions(request.basis_external_keys))<>cardinality(request.basis_external_keys) then
    raise exception 'A basis question is no longer cleared for AI drafting';
  end if;
  update dm_private.ai_draft_requests set status='running',run_token=token,run_deadline=now()+interval '5 minutes',
    run_attempts=run_attempts+1,error=null,model=null,response_id=null,completed_at=null where id=request.id;
  return jsonb_build_object('token',token,'expiresAt',now()+interval '5 minutes');
end $$;

create function public.complete_ai_draft_request(p_request_id uuid,p_model text,p_response_id text,p_payload jsonb,p_token uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare request dm_private.ai_draft_requests; draft_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into request from dm_private.ai_draft_requests where id=p_request_id for update;
  if not found or request.run_token is distinct from p_token then raise exception 'AI processing token is unavailable'; end if;
  if request.status='running' and coalesce(request.run_deadline,request.created_at+interval '5 minutes')<=now() then
    raise exception 'AI draft processing expired';
  end if;
  draft_id:=dm_private.complete_ai_draft_request(p_request_id,p_model,p_response_id,p_payload);
  update dm_private.ai_draft_requests set run_deadline=null where id=request.id;
  return draft_id;
end $$;

create function public.complete_ai_draft_request(p_request_id uuid,p_model text,p_response_id text,p_payload jsonb)
returns uuid language sql security definer set search_path=pg_catalog as $$
  select public.complete_ai_draft_request(p_request_id,p_model,p_response_id,p_payload,null::uuid)
$$;

create function public.fail_ai_draft_request(p_request_id uuid,p_model text,p_error text,p_token uuid)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare request dm_private.ai_draft_requests;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into request from dm_private.ai_draft_requests where id=p_request_id for update;
  if not found or request.run_token is distinct from p_token then raise exception 'AI processing token is unavailable'; end if;
  if request.status not in('queued','running') then return; end if;
  update dm_private.ai_draft_requests set status='failed',model=p_model,error=left(coalesce(nullif(btrim(p_error),''),'AI drafting failed'),1000),
    run_deadline=null,completed_at=now() where id=request.id;
end $$;

create or replace function public.fail_ai_draft_request(p_request_id uuid,p_model text,p_error text)
returns void language sql security definer set search_path=pg_catalog as $$
  select public.fail_ai_draft_request(p_request_id,p_model,p_error,null::uuid)
$$;

create function public.recover_expired_question_jobs(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare intake_count integer; ai_count integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_limit is null or p_limit not between 1 and 500 then raise exception 'Invalid recovery limit'; end if;
  with expired as (
    select id from dm_private.question_intake_assets where status='extracting'
      and coalesce(extraction_deadline,updated_at+interval '5 minutes')<=now()
    order by coalesce(extraction_deadline,updated_at+interval '5 minutes'),id limit p_limit for update skip locked
  ) update dm_private.question_intake_assets a set status='failed',extraction_deadline=null,
      extraction_error='Processing expired. Retry extraction when ready.',updated_at=now()
    from expired where a.id=expired.id;
  get diagnostics intake_count=row_count;
  with expired as (
    select id from dm_private.ai_draft_requests where status in('queued','running')
      and coalesce(run_deadline,created_at+interval '5 minutes')<=now()
    order by coalesce(run_deadline,created_at+interval '5 minutes'),id limit p_limit for update skip locked
  ) update dm_private.ai_draft_requests r set status='failed',run_deadline=null,
      error='Processing expired. Retry the draft when ready.',completed_at=now()
    from expired where r.id=expired.id;
  get diagnostics ai_count=row_count;
  return jsonb_build_object('intake',intake_count,'aiDrafts',ai_count);
end $$;

create or replace function public.admin_question_intake_assets()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  return(select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'name',a.original_name,'mimeType',a.mime_type,'byteSize',a.byte_size,'status',a.status,'model',a.extraction_model,
    'error',a.extraction_error,'createdAt',a.created_at,'attemptCount',a.extraction_attempts,'expiresAt',a.extraction_deadline,
    'retryAvailable',a.status='failed' or(a.status='extracting' and coalesce(a.extraction_deadline,a.updated_at+interval '5 minutes')<=now()),
    'candidates',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'ordinal',c.ordinal,'pageNumber',c.page_number,
      'confidence',c.confidence,'payload',c.payload,'status',c.status) order by c.ordinal),'[]')
      from dm_private.question_intake_candidates c where c.asset_id=a.id)
  ) order by a.created_at desc),'[]') from dm_private.question_intake_assets a);
end $$;

create or replace function public.admin_ai_draft_requests()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  return(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'exam',r.exam,'topic',r.topic,'questionType',r.question_type,
    'basisExternalKeys',r.basis_external_keys,'status',r.status,'model',r.model,'responseId',r.response_id,
    'error',r.error,'draftId',r.draft_id,'createdAt',r.created_at,'attemptCount',r.run_attempts,'expiresAt',r.run_deadline,
    'retryAvailable',r.created_by=auth.uid() and(r.status='failed' or(r.status in('queued','running')
      and coalesce(r.run_deadline,r.created_at+interval '5 minutes')<=now()))
  ) order by r.created_at desc),'[]') from dm_private.ai_draft_requests r);
end $$;

create or replace function public.admin_operational_health()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare stale integer; expired integer; failed integer; attention integer; stale_orders integer; intake integer; ai integer;
begin
  if auth.role() is distinct from 'service_role' and not public.is_dmocks_admin() then raise exception 'Admin access required'; end if;
  select count(*) filter(where deadline<now()-interval '2 minutes'),count(*) filter(where deadline<=now()) into stale,expired
    from dm_private.attempts where status='active';
  select count(*) into intake from dm_private.question_intake_assets where status='extracting'
    and coalesce(extraction_deadline,updated_at+interval '5 minutes')<=now();
  select count(*) into ai from dm_private.ai_draft_requests where status in('queued','running')
    and coalesce(run_deadline,created_at+interval '5 minutes')<=now();
  select(select count(*) from dm_private.question_intake_assets where status='failed')+
    (select count(*) from dm_private.ai_draft_requests where status='failed') into failed;
  select(select count(*) from dm_private.bug_reports where status in('open','investigating'))+
    (select count(*) from dm_private.community_reports where status='open')+
    (select count(*) from dm_private.reported_question_queue where status='pending')+
    (select count(*) from dm_private.drawing_reviews where status<>'released') into attention;
  select count(*) into stale_orders from dm_private.orders where status='pending' and created_at<now()-interval '15 minutes';
  return jsonb_build_object('status',case when stale+failed+stale_orders+intake+ai>0 then 'degraded' when attention>0 then 'attention' else 'healthy' end,
    'checkedAt',now(),'staleAttempts',stale,'expiredAttempts',expired,'expiredIntakeJobs',intake,'expiredAiDraftJobs',ai,
    'openBugs',(select count(*) from dm_private.bug_reports where status in('open','investigating')),
    'pendingQuestionReports',(select count(*) from dm_private.reported_question_queue where status='pending'),
    'openCommunityReports',(select count(*) from dm_private.community_reports where status='open'),
    'pendingDrawingReviews',(select count(*) from dm_private.drawing_reviews where status<>'released'),
    'failedIntakeAssets',(select count(*) from dm_private.question_intake_assets where status='failed'),
    'failedAiDrafts',(select count(*) from dm_private.ai_draft_requests where status='failed'),'stalePendingOrders',stale_orders);
end $$;

revoke all on function public.claim_question_intake_asset(uuid),public.claim_question_intake_asset(uuid,uuid),
  public.complete_question_intake_asset(uuid,text,text,jsonb),public.complete_question_intake_asset(uuid,text,text,jsonb,uuid),
  public.fail_question_intake_asset(uuid,text,text),public.fail_question_intake_asset(uuid,text,text,uuid),
  public.claim_ai_draft_request(uuid,uuid,boolean),public.complete_ai_draft_request(uuid,text,text,jsonb),
  public.complete_ai_draft_request(uuid,text,text,jsonb,uuid),public.fail_ai_draft_request(uuid,text,text),
  public.fail_ai_draft_request(uuid,text,text,uuid),public.recover_expired_question_jobs(integer) from public,anon,authenticated;
grant execute on function public.claim_question_intake_asset(uuid),public.claim_question_intake_asset(uuid,uuid),
  public.complete_question_intake_asset(uuid,text,text,jsonb),public.complete_question_intake_asset(uuid,text,text,jsonb,uuid),
  public.fail_question_intake_asset(uuid,text,text),public.fail_question_intake_asset(uuid,text,text,uuid),
  public.claim_ai_draft_request(uuid,uuid,boolean),public.complete_ai_draft_request(uuid,text,text,jsonb),
  public.complete_ai_draft_request(uuid,text,text,jsonb,uuid),public.fail_ai_draft_request(uuid,text,text),
  public.fail_ai_draft_request(uuid,text,text,uuid),public.recover_expired_question_jobs(integer) to service_role;

commit;
