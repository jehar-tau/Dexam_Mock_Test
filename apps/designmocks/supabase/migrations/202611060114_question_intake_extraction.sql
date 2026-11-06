create table dm_private.question_intake_candidates(
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references dm_private.question_intake_assets(id)on delete cascade,
  ordinal integer not null check(ordinal>0),
  page_number integer check(page_number>0),
  confidence numeric check(confidence between 0 and 1),
  payload jsonb not null,
  status text not null default'pending'check(status in('pending','promoted','rejected')),
  draft_id uuid references dm_private.question_drafts(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  unique(asset_id,ordinal)
);
alter table dm_private.question_intake_candidates enable row level security;
revoke all on dm_private.question_intake_candidates from anon,authenticated;
alter table dm_private.question_intake_assets add column extraction_model text,add column extraction_response_id text,add column extraction_error text;

create or replace function public.claim_question_intake_asset(p_asset_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare a dm_private.question_intake_assets;
begin
  if auth.role()is distinct from'service_role'then raise exception'Forbidden';end if;
  select*into a from dm_private.question_intake_assets where id=p_asset_id for update;
  if a.id is null or a.status not in('uploaded','failed')then raise exception'Intake asset is not available for extraction';end if;
  if a.byte_size>10485760 then raise exception'Split files above 10 MB before extraction';end if;
  delete from dm_private.question_intake_candidates where asset_id=a.id and status='pending';
  update dm_private.question_intake_assets set status='extracting',extraction_error=null,updated_at=now()where id=a.id;
  return jsonb_build_object('id',a.id,'storagePath',a.storage_path,'name',a.original_name,'mimeType',a.mime_type,'byteSize',a.byte_size);
end$$;

create or replace function public.complete_question_intake_asset(p_asset_id uuid,p_model text,p_response_id text,p_questions jsonb)returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare q jsonb;v_ordinal integer;v_count integer:=0;
begin
  if auth.role()is distinct from'service_role'then raise exception'Forbidden';end if;
  if char_length(trim(p_model))not between 2 and 120 or char_length(trim(p_response_id))not between 2 and 200 or jsonb_typeof(p_questions)<>'array'or jsonb_array_length(p_questions)not between 1 and 100 then raise exception'Invalid extraction result';end if;
  if not exists(select 1 from dm_private.question_intake_assets where id=p_asset_id and status='extracting'for update)then raise exception'Intake extraction is not active';end if;
  for q,v_ordinal in select value,ordinality::integer from jsonb_array_elements(p_questions)with ordinality loop
    if jsonb_typeof(q)<>'object'or char_length(trim(q->>'prompt'))<3 or(q?'confidence'and((q->>'confidence')::numeric<0 or(q->>'confidence')::numeric>1))then raise exception'Invalid extracted question';end if;
    insert into dm_private.question_intake_candidates(asset_id,ordinal,page_number,confidence,payload)values(p_asset_id,v_ordinal,nullif(q->>'pageNumber','')::integer,nullif(q->>'confidence','')::numeric,(q-'pageNumber'-'confidence')||jsonb_build_object('holds',jsonb_build_array('intake-human-review')));
    v_count:=v_count+1;
  end loop;
  update dm_private.question_intake_assets set status='extracted',extraction_model=trim(p_model),extraction_response_id=trim(p_response_id),extraction_error=null,updated_at=now()where id=p_asset_id;
  return v_count;
end$$;

create or replace function public.fail_question_intake_asset(p_asset_id uuid,p_model text,p_error text)returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
  if auth.role()is distinct from'service_role'then raise exception'Forbidden';end if;
  update dm_private.question_intake_assets set status='failed',extraction_model=nullif(trim(p_model),''),extraction_error=left(coalesce(nullif(trim(p_error),''),'Extraction failed'),500),updated_at=now()where id=p_asset_id and status='extracting';
  if not found then raise exception'Intake extraction is not active';end if;
end$$;

create or replace function public.admin_question_intake_assets()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private,public as $$
begin
  if not public.is_dmocks_admin()then raise exception'Admin access required';end if;
  return(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.original_name,'mimeType',a.mime_type,'byteSize',a.byte_size,'status',a.status,'model',a.extraction_model,'error',a.extraction_error,'createdAt',a.created_at,'candidates',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'ordinal',c.ordinal,'pageNumber',c.page_number,'confidence',c.confidence,'payload',c.payload,'status',c.status)order by c.ordinal),'[]')from dm_private.question_intake_candidates c where c.asset_id=a.id))order by a.created_at desc),'[]')from dm_private.question_intake_assets a);
end$$;

create or replace function public.admin_promote_intake_candidate(p_candidate_id uuid,p_payload jsonb)returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare c dm_private.question_intake_candidates;v uuid;
begin
  if not public.is_dmocks_admin()then raise exception'Admin access required';end if;
  select*into c from dm_private.question_intake_candidates where id=p_candidate_id for update;
  if c.id is null or c.status<>'pending'then raise exception'Intake candidate unavailable';end if;
  if jsonb_typeof(p_payload)<>'object'or char_length(trim(p_payload->>'prompt'))<3 then raise exception'Extracted question payload is invalid';end if;
  p_payload:=(p_payload-'holds')||jsonb_build_object('holds',jsonb_build_array('intake-human-review'));
  insert into dm_private.question_drafts(source_type,source_name,payload,created_by)select case when a.mime_type='application/pdf'then'pdf'else'photo'end,a.original_name,p_payload,auth.uid()from dm_private.question_intake_assets a where a.id=c.asset_id returning id into v;
  update dm_private.question_intake_candidates set status='promoted',draft_id=v,reviewed_by=auth.uid(),reviewed_at=now()where id=c.id;
  if not exists(select 1 from dm_private.question_intake_candidates where asset_id=c.asset_id and status='pending')then update dm_private.question_intake_assets set status='reviewed',updated_at=now()where id=c.asset_id;end if;
  return v;
end$$;

create or replace function public.admin_reject_intake_candidate(p_candidate_id uuid)returns void language plpgsql security definer set search_path=pg_catalog,dm_private,public as $$
declare v_asset uuid;
begin
  if not public.is_dmocks_admin()then raise exception'Admin access required';end if;
  update dm_private.question_intake_candidates set status='rejected',reviewed_by=auth.uid(),reviewed_at=now()where id=p_candidate_id and status='pending'returning asset_id into v_asset;
  if v_asset is null then raise exception'Intake candidate unavailable';end if;
  if not exists(select 1 from dm_private.question_intake_candidates where asset_id=v_asset and status='pending')then update dm_private.question_intake_assets set status='reviewed',updated_at=now()where id=v_asset;end if;
end$$;

revoke all on function public.claim_question_intake_asset(uuid),public.complete_question_intake_asset(uuid,text,text,jsonb),public.fail_question_intake_asset(uuid,text,text)from public,anon,authenticated;
grant execute on function public.claim_question_intake_asset(uuid),public.complete_question_intake_asset(uuid,text,text,jsonb),public.fail_question_intake_asset(uuid,text,text)to service_role;
revoke all on function public.admin_promote_intake_candidate(uuid,jsonb),public.admin_reject_intake_candidate(uuid)from public,anon;
grant execute on function public.admin_promote_intake_candidate(uuid,jsonb),public.admin_reject_intake_candidate(uuid)to authenticated;
