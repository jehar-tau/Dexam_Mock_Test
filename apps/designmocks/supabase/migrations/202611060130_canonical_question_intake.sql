begin;

create table dm_private.question_intake_figures (
  asset_id uuid not null references dm_private.question_intake_assets(id),
  sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
  storage_path text unique not null,
  width integer not null check(width between 1 and 8192),
  height integer not null check(height between 1 and 8192),
  byte_size integer not null check(byte_size between 45 and 10485760),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  verified_at timestamptz not null default now(),
  primary key(asset_id,sha256),
  check(width::bigint*height<=16777216),
  check(storage_path='figures/'||asset_id::text||'/'||sha256||'.png')
);
alter table dm_private.question_intake_figures enable row level security;
revoke all on dm_private.question_intake_figures from public,anon,authenticated;

create function public.register_question_intake_figure(p_asset_id uuid,p_sha256 text,p_width integer,p_height integer,p_byte_size integer,p_uploaded_by uuid)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_path text:='figures/'||p_asset_id::text||'/'||p_sha256||'.png';
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if not exists(select 1 from dm_private.admins where user_id=p_uploaded_by)
    or not exists(select 1 from dm_private.question_intake_assets where id=p_asset_id) then raise exception 'Admin intake source required'; end if;
  if not exists(select 1 from storage.objects where bucket_id='question-intake' and name=v_path
    and metadata->>'mimetype'='image/png' and metadata->>'size'=p_byte_size::text) then
    raise exception 'Verified private figure object required';
  end if;
  insert into dm_private.question_intake_figures(asset_id,sha256,storage_path,width,height,byte_size,uploaded_by)
    values(p_asset_id,p_sha256,v_path,p_width,p_height,p_byte_size,p_uploaded_by)
    on conflict(asset_id,sha256) do update set verified_at=now()
    where question_intake_figures.width=excluded.width and question_intake_figures.height=excluded.height
      and question_intake_figures.byte_size=excluded.byte_size;
  if not found then raise exception 'Existing figure metadata does not match'; end if;
end $$;

create function dm_private.require_intake_figures(p_asset_id uuid,p_assets jsonb)
returns void language plpgsql stable set search_path=pg_catalog,dm_private as $$
declare figure jsonb;
begin
  for figure in select value from jsonb_array_elements(p_assets) loop
    if not exists(select 1 from dm_private.question_intake_figures f join storage.objects o
      on o.bucket_id='question-intake' and o.name=f.storage_path
      where f.asset_id=p_asset_id and f.sha256=figure->>'sha256'
        and f.width=(figure->>'width')::integer and f.height=(figure->>'height')::integer
        and o.metadata->>'mimetype'='image/png' and o.metadata->>'size'=f.byte_size::text)
      and not exists(select 1 from dm_private.bank_media_assets f join storage.objects o
        on o.bucket_id='paper-media' and o.name=f.storage_path
        where f.sha256=figure->>'sha256' and f.width=(figure->>'width')::integer and f.height=(figure->>'height')::integer
          and o.metadata->>'mimetype'='image/png' and o.metadata->>'size'=f.byte_size::text) then
      raise exception 'Upload and retain every reviewed figure before promotion or export';
    end if;
  end loop;
end $$;

create function public.admin_question_intake_figure_source(p_asset_id uuid,p_sha256 text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare figure dm_private.question_intake_figures;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into figure from dm_private.question_intake_figures where asset_id=p_asset_id and sha256=p_sha256;
  if not found then raise exception 'Intake figure unavailable'; end if;
  return jsonb_build_object('storagePath',figure.storage_path,'mimeType','image/png','byteSize',figure.byte_size);
end $$;

create or replace function public.complete_question_intake_asset(p_asset_id uuid,p_model text,p_response_id text,p_questions jsonb)
returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare question jsonb; ordinal integer; total integer:=0;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if coalesce(char_length(btrim(p_model)),0) not between 2 and 120
    or coalesce(char_length(btrim(p_response_id)),0) not between 2 and 200
    or jsonb_typeof(p_questions) is distinct from 'array' then raise exception 'Invalid extraction result'; end if;
  if jsonb_array_length(p_questions) not between 1 and 100 then raise exception 'Invalid extraction result'; end if;
  if not exists(select 1 from dm_private.question_intake_assets where id=p_asset_id and status='extracting' for update) then
    raise exception 'Intake extraction is not active';
  end if;
  for question,ordinal in select value,ordinality::integer from jsonb_array_elements(p_questions) with ordinality loop
    if jsonb_typeof(question) is distinct from 'object'
      or jsonb_typeof(question->'prompt') is distinct from 'string'
      or coalesce(char_length(btrim(question->>'prompt')),0) not between 3 and 8000
      or coalesce(question->>'type','') not in('MCQ','MSQ','NAT','DESCRIPTIVE')
      or jsonb_typeof(question->'options') is distinct from 'array'
      or jsonb_typeof(question->'explanation') is distinct from 'string'
      or char_length(question->>'explanation')>8000
      or jsonb_typeof(question->'topic') is distinct from 'string' or char_length(question->>'topic')>120
      or not (question?'answer') then raise exception 'Invalid extracted question'; end if;
    if jsonb_array_length(question->'options')>8 or exists(
      select 1 from jsonb_array_elements(question->'options') item where jsonb_typeof(item->'id') is distinct from 'string'
        or char_length(item->>'id')>32 or jsonb_typeof(item->'text') is distinct from 'string' or char_length(item->>'text')>2000
    ) then raise exception 'Invalid extracted question options'; end if;
    if jsonb_typeof(question->'answer') not in('null','string','array')
      or (jsonb_typeof(question->'answer')='string' and char_length(question->>'answer')>200)
      or (question?'visualDependency' and jsonb_typeof(question->'visualDependency') not in('null','boolean')) then
      raise exception 'Invalid extracted question answer or figure requirement';
    end if;
    if jsonb_typeof(question->'answer')='array' then
      if jsonb_array_length(question->'answer')>8 or exists(select 1 from jsonb_array_elements(question->'answer') key
        where jsonb_typeof(key)<>'string' or char_length(key#>>'{}')>32) then raise exception 'Invalid extracted question answer'; end if;
    end if;
    if nullif(question->>'pageNumber','')::integer not between 1 and 10000
      or nullif(question->>'confidence','')::numeric not between 0 and 1 then raise exception 'Invalid extraction provenance'; end if;
    insert into dm_private.question_intake_candidates(asset_id,ordinal,page_number,confidence,payload)
      values(p_asset_id,ordinal,nullif(question->>'pageNumber','')::integer,nullif(question->>'confidence','')::numeric,
        (question-'pageNumber'-'confidence'-'holds')||jsonb_build_object('holds','["intake-human-review"]'::jsonb));
    total:=total+1;
  end loop;
  update dm_private.question_intake_assets set status='extracted',extraction_model=btrim(p_model),extraction_response_id=btrim(p_response_id),
    extraction_error=null,updated_at=now() where id=p_asset_id;
  return total;
end $$;

-- This validator prepares bank content. Publication and runtime materialization remain separate reviews.
create function dm_private.canonical_intake_question(p_payload jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog as $$
declare
  exam text:=lower(btrim(p_payload#>>'{provenance,exam}'));
  kind text:=p_payload->>'type';
  prompt text:=btrim(p_payload->>'prompt');
  options jsonb:='[]';
  assets jsonb:=coalesce(p_payload->'assets','[]');
  option_keys text[];
  selected text[];
  item jsonb;
  raw_answer text;
  bounds text[];
  decimal_pattern constant text:='[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)';
begin
  if jsonb_typeof(p_payload) is distinct from 'object'
    or coalesce(exam,'') not in('uceed','nid','nift','ceed')
    or coalesce(kind,'') not in('MCQ','MSQ','NAT','DESCRIPTIVE')
    or jsonb_typeof(p_payload->'prompt') is distinct from 'string'
    or coalesce(char_length(prompt),0) not between 3 and 8000 then
    raise exception 'Confirm the exam, question type and complete wording';
  end if;
  if coalesce(char_length(p_payload->>'topic'),0)>120
    or coalesce(char_length(p_payload->>'explanation'),0)>8000
    or (p_payload?'topic' and jsonb_typeof(p_payload->'topic') is distinct from 'string')
    or (p_payload?'explanation' and jsonb_typeof(p_payload->'explanation') is distinct from 'string') then
    raise exception 'Invalid question topic or explanation';
  end if;
  if jsonb_typeof(p_payload->'visualDependency') is distinct from 'boolean' then
    raise exception 'Confirm whether the question requires figures';
  end if;
  if jsonb_typeof(assets) is distinct from 'array' then raise exception 'Invalid question figures'; end if;
  if jsonb_array_length(assets)>8 or (p_payload->'visualDependency'='true'::jsonb and jsonb_array_length(assets)=0) then
    raise exception 'Attach up to eight reviewed question figures when required';
  end if;
  for item in select value from jsonb_array_elements(assets) loop
    if coalesce(item->>'sha256','') !~ '^[a-f0-9]{64}$'
      or coalesce(item->>'path','') !~ '^[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_.-]+)*[.]png$'
      or position('..' in item->>'path')>0
      or jsonb_typeof(item->'width') is distinct from 'number'
      or jsonb_typeof(item->'height') is distinct from 'number' then
      raise exception 'Use prepared PNG figure metadata';
    end if;
    if (item->>'width')::numeric not between 1 and 8192 or (item->>'height')::numeric not between 1 and 8192
      or (item->>'width')::numeric<>trunc((item->>'width')::numeric)
      or (item->>'height')::numeric<>trunc((item->>'height')::numeric)
      or (item->>'width')::numeric*(item->>'height')::numeric>16777216 then
      raise exception 'Invalid PNG figure dimensions';
    end if;
  end loop;
  if (select count(distinct a->>'sha256') from jsonb_array_elements(assets) a)<>jsonb_array_length(assets) then
    raise exception 'Choose each question figure once';
  end if;
  -- Keep the canonical source path as metadata. The operator verifies actual bytes before private media import.
  select coalesce(jsonb_agg(jsonb_build_object('role','question','path',a->>'path','sha256',a->>'sha256',
    'width',(a->>'width')::integer,'height',(a->>'height')::integer) order by n),'[]') into assets
    from jsonb_array_elements(assets) with ordinality as x(a,n);

  if jsonb_typeof(p_payload->'options') is distinct from 'array' then raise exception 'Review the question options'; end if;
  if kind in('MCQ','MSQ') then
    if jsonb_array_length(p_payload->'options') not between 2 and 8 then raise exception 'Choice questions need two to eight options'; end if;
    for item in select value from jsonb_array_elements(p_payload->'options') loop
      if jsonb_typeof(coalesce(item->'key',item->'id')) is distinct from 'string'
        or coalesce(btrim(coalesce(item->>'key',item->>'id')),'') !~ '^[A-Za-z0-9_-]{1,32}$'
        or jsonb_typeof(item->'text') is distinct from 'string'
        or coalesce(char_length(btrim(item->>'text')),0) not between 1 and 2000
        or coalesce(item->'asset','null')<>'null'::jsonb then
        raise exception 'Review each option key and text, using the attached figures for visual choices';
      end if;
    end loop;
    select array_agg(btrim(coalesce(a->>'key',a->>'id')) order by n),
      jsonb_agg(jsonb_build_object('key',btrim(coalesce(a->>'key',a->>'id')),'text',btrim(a->>'text'),'asset',null) order by n)
      into option_keys,options from jsonb_array_elements(p_payload->'options') with ordinality as x(a,n);
    if (select count(distinct key) from unnest(option_keys) key)<>cardinality(option_keys) then
      raise exception 'Option keys must be distinct';
    end if;
  elsif jsonb_array_length(p_payload->'options')<>0 then raise exception 'This question type has no answer options';
  end if;

  if jsonb_typeof(p_payload->'answer')='object' then
    if jsonb_typeof(p_payload#>'{answer,raw}') is distinct from 'string' then raise exception 'Enter the verified answer'; end if;
    raw_answer:=btrim(p_payload#>>'{answer,raw}');
  elsif jsonb_typeof(p_payload->'answer')='string' then raw_answer:=btrim(p_payload->>'answer');
  elsif kind='MSQ' and jsonb_typeof(p_payload->'answer')='array' then
    if exists(select 1 from jsonb_array_elements(p_payload->'answer') a where jsonb_typeof(a)<>'string') then
      raise exception 'Multiple-choice answers must be option keys';
    end if;
    select string_agg(btrim(a),', ' order by n) into raw_answer
      from jsonb_array_elements_text(p_payload->'answer') with ordinality as x(a,n);
  elsif kind<>'DESCRIPTIVE' then raise exception 'Enter the verified answer';
  end if;
  if kind<>'DESCRIPTIVE' and coalesce(char_length(raw_answer),0) not between 1 and 200 then
    raise exception 'Enter the verified answer';
  end if;
  if kind='MCQ' and not coalesce(raw_answer=any(option_keys),false) then
    raise exception 'Single-choice answer must match an option key';
  elsif kind='MSQ' then
    if raw_answer=any(option_keys) then selected:=array[raw_answer];
    elsif raw_answer~'^[A-Za-z]+$' and not exists(select 1 from unnest(option_keys) key where key!~'^[A-Za-z]$') then
      selected:=regexp_split_to_array(raw_answer,'');
    else selected:=regexp_split_to_array(raw_answer,'[[:space:],;&/]+'); end if;
    if not (selected<@option_keys) or (select count(distinct key) from unnest(selected) key)<>cardinality(selected) then
      raise exception 'Multiple-choice answers must be distinct option keys';
    end if;
    raw_answer:=array_to_string(selected,', ');
  elsif kind='NAT' and raw_answer !~ ('^'||decimal_pattern||'$') then
    bounds:=regexp_match(raw_answer,'^('||decimal_pattern||')[[:space:]]*(?:to|–|-)[[:space:]]*('||decimal_pattern||')$','i');
    if bounds is null or bounds[1]::numeric>bounds[2]::numeric then raise exception 'Enter an exact decimal or ordered numeric range'; end if;
  elsif kind='DESCRIPTIVE' then
    if p_payload->'answer' is distinct from 'null'::jsonb or coalesce(char_length(btrim(p_payload->>'explanation')),0)<5 then
      raise exception 'Drawing and written questions need a review rubric and no objective answer';
    end if;
  end if;
  return jsonb_build_object('type',kind,'prompt',prompt,'topic',btrim(coalesce(p_payload->>'topic','')),
    'options',options,'answer',case when kind='DESCRIPTIVE' then 'null'::jsonb else jsonb_build_object('raw',raw_answer,'status','pending') end,
    'explanation',btrim(coalesce(p_payload->>'explanation','')),'assets',assets,'visualDependency',p_payload->'visualDependency',
    'sourceKind','intake','licence','unknown','holds','["intake-human-review"]'::jsonb,'provenance',jsonb_build_object('exam',exam));
end $$;

create function public.admin_question_intake_source(p_asset_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare asset dm_private.question_intake_assets;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into asset from dm_private.question_intake_assets where id=p_asset_id;
  if not found then raise exception 'Intake source unavailable'; end if;
  return jsonb_build_object('storagePath',asset.storage_path,'mimeType',asset.mime_type,'byteSize',asset.byte_size);
end $$;

create or replace function public.admin_promote_intake_candidate(p_candidate_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare candidate dm_private.question_intake_candidates; asset dm_private.question_intake_assets; v_payload jsonb; v_draft_id uuid;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  -- Asset-first locking also serializes promotions and rejections of different questions in one paper.
  select a.* into asset from dm_private.question_intake_assets a
    join dm_private.question_intake_candidates c on c.asset_id=a.id where c.id=p_candidate_id for update of a;
  select * into candidate from dm_private.question_intake_candidates where id=p_candidate_id for update;
  if candidate.id is null or candidate.status='rejected' or asset.status='extracting' then raise exception 'Intake candidate unavailable'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_payload->'prompt') is distinct from 'string'
    or coalesce(char_length(btrim(p_payload->>'prompt')),0) not between 3 and 8000 then raise exception 'Extracted question payload is invalid'; end if;
  if p_payload#>>'{provenance,exam}' is not null then
    v_payload:=dm_private.canonical_intake_question(p_payload);
    perform dm_private.require_intake_figures(asset.id,v_payload->'assets');
  else v_payload:=(p_payload-'holds'-'provenance')||jsonb_build_object('holds','["intake-human-review"]'::jsonb,'provenance','{}'::jsonb); end if;
  -- Legacy incomplete corrections remain private drafts. Export always requires canonical validation.
  v_payload:=jsonb_set(v_payload,'{provenance}',v_payload->'provenance'||jsonb_build_object('intake',jsonb_build_object(
    'assetId',asset.id,'candidateId',candidate.id,'pageNumber',candidate.page_number,'confidence',candidate.confidence)));
  if candidate.status='promoted' then
    if exists(select 1 from dm_private.question_drafts d where d.id=candidate.draft_id and d.payload=v_payload) then return candidate.draft_id; end if;
    raise exception 'Candidate was already promoted with different content';
  end if;
  insert into dm_private.question_drafts(source_type,source_name,payload,created_by)
    values(case when asset.mime_type='application/pdf' then 'pdf' else 'photo' end,asset.original_name,v_payload,auth.uid()) returning id into v_draft_id;
  update dm_private.question_intake_candidates set status='promoted',draft_id=v_draft_id,reviewed_by=auth.uid(),reviewed_at=now() where id=candidate.id;
  if not exists(select 1 from dm_private.question_intake_candidates where asset_id=asset.id and status='pending') then
    update dm_private.question_intake_assets set status='reviewed',updated_at=now() where id=asset.id;
  end if;
  return v_draft_id;
end $$;

create or replace function public.admin_promote_intake_asset(p_asset_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare asset dm_private.question_intake_assets; candidate_id uuid; v_payload jsonb; page integer;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into asset from dm_private.question_intake_assets where id=p_asset_id for update;
  if not found or asset.status='extracting' then raise exception 'Intake asset unavailable'; end if;
  if p_payload#>>'{provenance,exam}' is not null then perform dm_private.canonical_intake_question(p_payload); end if;
  page:=nullif(p_payload->>'pageNumber','')::integer;
  if page is not null and page not between 1 and 10000 then raise exception 'Invalid source page'; end if;
  v_payload:=(p_payload-'holds'-'pageNumber')||jsonb_build_object('holds','["intake-human-review"]'::jsonb);
  select id into candidate_id from dm_private.question_intake_candidates where asset_id=asset.id
    and page_number is not distinct from page and confidence is null and payload=v_payload;
  if candidate_id is null then
    insert into dm_private.question_intake_candidates(asset_id,ordinal,page_number,payload)
      select asset.id,coalesce(max(c.ordinal),0)+1,page,v_payload from dm_private.question_intake_candidates c where c.asset_id=asset.id
      returning id into candidate_id;
  end if;
  return public.admin_promote_intake_candidate(candidate_id,p_payload);
end $$;

create or replace function public.admin_reject_intake_candidate(p_candidate_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_asset_id uuid; candidate dm_private.question_intake_candidates;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select a.id into v_asset_id from dm_private.question_intake_assets a
    join dm_private.question_intake_candidates c on c.asset_id=a.id where c.id=p_candidate_id for update of a;
  select * into candidate from dm_private.question_intake_candidates where id=p_candidate_id for update;
  if candidate.status='rejected' then return; end if;
  if candidate.id is null or candidate.status<>'pending' then raise exception 'Intake candidate unavailable'; end if;
  update dm_private.question_intake_candidates set status='rejected',reviewed_by=auth.uid(),reviewed_at=now() where id=candidate.id;
  if not exists(select 1 from dm_private.question_intake_candidates where asset_id=v_asset_id and status='pending') then
    update dm_private.question_intake_assets set status='reviewed',updated_at=now() where id=v_asset_id;
  end if;
end $$;

create or replace function public.admin_export_question_draft(p_draft_id uuid,p_external_key text,p_rights_confirmed boolean,p_rights_note text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  draft dm_private.question_drafts; ai_request dm_private.ai_draft_requests;
  candidate dm_private.question_intake_candidates;
  payload jsonb; exam text; artifact dm_private.question_draft_exports;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_rights_confirmed is distinct from true then raise exception 'Rights confirmation is required'; end if;
  p_external_key:=lower(btrim(p_external_key)); p_rights_note:=btrim(p_rights_note);
  if coalesce(p_external_key,'') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'External key must be lowercase words separated by hyphens'; end if;
  if coalesce(char_length(p_rights_note),0) not between 10 and 1000 then raise exception 'Rights note must be 10 to 1000 characters'; end if;
  select * into draft from dm_private.question_drafts where id=p_draft_id for update;
  if not found or draft.status<>'approved' then raise exception 'Only an approved draft can be exported'; end if;
  if exists(select 1 from dm_private.bank_questions where external_key=p_external_key) then raise exception 'External key already exists in the canonical bank'; end if;
  payload:=draft.payload;
  if draft.source_type='ai' then
    select * into ai_request from dm_private.ai_draft_requests where draft_id=draft.id and status='succeeded';
    if found then
      if payload#>>'{provenance,exam}' is null then
        payload:=dm_private.canonical_ai_draft(payload,ai_request.exam,ai_request.topic,ai_request.question_type,ai_request.basis_external_keys);
      end if;
      if ai_request.question_type<>'DESCRIPTIVE' then payload:=jsonb_set(payload,'{answer,status}','"human-reviewed"'::jsonb); end if;
    end if;
  elsif draft.source_type in('pdf','photo') then
    payload:=dm_private.canonical_intake_question(payload);
    select * into candidate from dm_private.question_intake_candidates where draft_id=draft.id and status='promoted';
    perform dm_private.require_intake_figures(candidate.asset_id,payload->'assets');
    if candidate.id is not null then
      payload:=jsonb_set(payload,'{provenance,intake}',jsonb_build_object('assetId',candidate.asset_id,'candidateId',candidate.id,
        'pageNumber',candidate.page_number,'confidence',candidate.confidence));
    end if;
    if payload->>'type'<>'DESCRIPTIVE' then payload:=jsonb_set(payload,'{answer,status}','"human-reviewed"'::jsonb); end if;
  end if;
  exam:=lower(btrim(coalesce(payload#>>'{provenance,exam}','')));
  if jsonb_typeof(payload) is distinct from 'object' or coalesce(char_length(btrim(payload->>'prompt')),0)<3
    or coalesce(payload->>'type','') not in('MCQ','MSQ','NAT','DESCRIPTIVE') or exam not in('uceed','nid','nift','ceed') then
    raise exception 'Draft is missing canonical prompt, type, or provenance.exam';
  end if;
  payload:=jsonb_set(payload,'{provenance,exam}',to_jsonb(exam));
  payload:=(payload-'externalKey'-'holds')||jsonb_build_object('externalKey',p_external_key,'holds','[]'::jsonb);
  insert into dm_private.question_draft_exports(draft_id,external_key,content_sha256,payload,rights_note,exported_by)
    values(draft.id,p_external_key,encode(sha256(convert_to(payload::text,'UTF8')),'hex'),payload,p_rights_note,auth.uid()) returning * into artifact;
  update dm_private.question_drafts set status='exported' where id=draft.id;
  return jsonb_build_object('id',artifact.id,'externalKey',artifact.external_key,'contentSha256',artifact.content_sha256,
    'payload',artifact.payload,'rightsNote',artifact.rights_note,'createdAt',artifact.created_at,'publicationState','git-review-required');
exception when unique_violation then raise exception 'External key or draft has already been exported';
end $$;

revoke all on function dm_private.canonical_intake_question(jsonb) from public,anon,authenticated;
revoke all on function dm_private.require_intake_figures(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.register_question_intake_figure(uuid,text,integer,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.register_question_intake_figure(uuid,text,integer,integer,integer,uuid) to service_role;
revoke all on function public.admin_question_intake_figure_source(uuid,text) from public,anon;
grant execute on function public.admin_question_intake_figure_source(uuid,text) to authenticated;
revoke all on function public.admin_question_intake_source(uuid) from public,anon;
grant execute on function public.admin_question_intake_source(uuid) to authenticated;

commit;
