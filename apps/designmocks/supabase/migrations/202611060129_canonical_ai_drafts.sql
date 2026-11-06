begin;

create function dm_private.ai_reference_questions(p_keys text[])
returns setof dm_private.bank_questions language sql stable set search_path=pg_catalog,dm_private as $$
  select q.* from dm_private.bank_questions q where q.external_key=any(p_keys)
    and q.active and q.owner_approved and q.rights_confirmed and q.payload->'holds'='[]'::jsonb
$$;

create or replace function public.admin_create_ai_draft_request(
  p_exam text,p_topic text,p_question_type text,p_instruction text,p_basis_external_keys text[]
) returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare request_id uuid;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if coalesce(cardinality(p_basis_external_keys),0) not between 1 and 10
    or (select count(distinct key) from unnest(p_basis_external_keys) key)<>cardinality(p_basis_external_keys) then
    raise exception 'Choose 1 to 10 distinct basis questions';
  end if;
  if (select count(*) from dm_private.ai_reference_questions(p_basis_external_keys))<>cardinality(p_basis_external_keys) then
    raise exception 'Every basis question must be active, hold-free and rights-approved';
  end if;
  if coalesce(char_length(btrim(p_topic)),0) not between 2 and 120 then raise exception 'Enter a topic of 2 to 120 characters'; end if;
  insert into dm_private.ai_draft_requests(created_by,exam,topic,question_type,instruction,basis_external_keys,status)
    values(auth.uid(),p_exam,btrim(p_topic),p_question_type,btrim(p_instruction),p_basis_external_keys,'running')
    returning id into request_id;
  return request_id;
end $$;

create or replace function public.admin_ai_draft_basis(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare
  request dm_private.ai_draft_requests;
  basis jsonb;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into request from dm_private.ai_draft_requests where id=p_request_id and created_by=auth.uid() and status='running';
  if not found then raise exception 'AI draft request unavailable'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'externalKey',q.external_key,'type',q.question_type,'topic',q.topic,
    'difficulty',coalesce(q.payload->>'difficulty','unassessed'),'prompt',left(q.payload->>'prompt',4000)
  ) order by array_position(request.basis_external_keys,q.external_key)),'[]') into basis
  from dm_private.ai_reference_questions(request.basis_external_keys) q;
  if jsonb_array_length(basis)<>cardinality(request.basis_external_keys) then
    raise exception 'A basis question is no longer cleared for AI drafting';
  end if;
  return jsonb_build_object('requestId',request.id,'exam',request.exam,'topic',request.topic,
    'questionType',request.question_type,'instruction',request.instruction,'basis',basis);
end $$;

-- Normalize the model response while keeping its answer and publication hold pending human review.
create function dm_private.canonical_ai_draft(
  p_payload jsonb,p_exam text,p_topic text,p_type text,p_basis_keys text[]
) returns jsonb language plpgsql immutable set search_path=pg_catalog as $$
declare
  prompt text:=btrim(p_payload->>'prompt');
  explanation text:=btrim(p_payload->>'explanation');
  options jsonb:='[]';
  option_keys text[];
  selected text[];
  raw_answer text:=btrim(p_payload->>'answer');
  answer jsonb;
  seconds numeric;
  bounds text[];
  decimal_pattern constant text:='[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)';
begin
  if jsonb_typeof(p_payload) is distinct from 'object'
    or p_payload->>'type' is distinct from p_type or p_payload->>'topic' is distinct from p_topic
    or p_payload->'holds' is distinct from '["ai-generated-human-review"]'::jsonb
    or p_payload->>'licence' is distinct from 'original-ai-draft'
    or p_payload->>'sourceKind' is distinct from 'generated'
    or p_payload#>'{provenance,basisExternalKeys}' is distinct from to_jsonb(p_basis_keys)
    or p_payload->'visualDependency' is distinct from 'false'::jsonb
    or jsonb_typeof(p_payload->'prompt') is distinct from 'string'
    or jsonb_typeof(p_payload->'explanation') is distinct from 'string'
    or coalesce(char_length(prompt),0) not between 10 and 4000
    or coalesce(char_length(explanation),0) not between 5 and 4000
    or coalesce(p_payload->>'difficulty','') not in('easy','medium','hard','unassessed')
    or jsonb_typeof(p_payload->'estimatedSeconds') is distinct from 'number'
    or jsonb_typeof(p_payload->'options') is distinct from 'array' then
    raise exception 'Unsafe AI draft payload';
  end if;
  seconds:=(p_payload->>'estimatedSeconds')::numeric;
  if seconds not between 1 and 21600 or seconds<>trunc(seconds) then raise exception 'Invalid AI draft estimate'; end if;

  if p_type in('MCQ','MSQ') then
    if jsonb_array_length(p_payload->'options')<>4 or exists(
      select 1 from jsonb_array_elements(p_payload->'options') item
      where jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'text') is distinct from 'string'
        or coalesce(btrim(item->>'id'),'') !~ '^[A-Za-z0-9_-]{1,32}$'
        or coalesce(char_length(btrim(item->>'text')),0) not between 1 and 1000
    ) then raise exception 'AI choice drafts require four labelled options'; end if;
    select array_agg(btrim(item->>'id') order by n),
      jsonb_agg(jsonb_build_object('key',btrim(item->>'id'),'text',btrim(item->>'text'),'asset',null) order by n)
      into option_keys,options from jsonb_array_elements(p_payload->'options') with ordinality as x(item,n);
    if (select count(distinct key) from unnest(option_keys) key)<>4 then raise exception 'AI draft option keys must be distinct'; end if;
    if p_type='MCQ' then
      if jsonb_typeof(p_payload->'answer') is distinct from 'string' or not coalesce(raw_answer=any(option_keys),false) then
        raise exception 'AI single-choice answer must match one option';
      end if;
    else
      if jsonb_typeof(p_payload->'answer')='array' then
        if exists(select 1 from jsonb_array_elements(p_payload->'answer') item where jsonb_typeof(item)<>'string') then
          raise exception 'AI multiple-choice answers must be option keys';
        end if;
        select array_agg(btrim(key) order by n) into selected
          from jsonb_array_elements_text(p_payload->'answer') with ordinality as x(key,n);
      elsif jsonb_typeof(p_payload->'answer')='string' then
        if raw_answer=any(option_keys) then selected:=array[raw_answer];
        elsif raw_answer~'^[A-Za-z]+$' and not exists(select 1 from unnest(option_keys) key where key!~'^[A-Za-z]$') then
          selected:=regexp_split_to_array(raw_answer,'');
        else selected:=regexp_split_to_array(raw_answer,'[[:space:],;&/]+'); end if;
      end if;
      if coalesce(cardinality(selected),0) not between 1 and 4 or not (selected<@option_keys)
        or (select count(distinct key) from unnest(selected) key)<>cardinality(selected) then
        raise exception 'AI multiple-choice answers must be distinct option keys';
      end if;
      raw_answer:=array_to_string(selected,', ');
    end if;
  elsif p_type='NAT' then
    if jsonb_array_length(p_payload->'options')<>0 or jsonb_typeof(p_payload->'answer') is distinct from 'string'
      or coalesce(char_length(raw_answer),0) not between 1 and 200 then raise exception 'Invalid AI numeric answer'; end if;
    if raw_answer !~ ('^'||decimal_pattern||'$') then
      bounds:=regexp_match(raw_answer,'^('||decimal_pattern||')[[:space:]]*(?:to|–|-)[[:space:]]*('||decimal_pattern||')$','i');
      if bounds is null or bounds[1]::numeric>bounds[2]::numeric then raise exception 'Invalid AI numeric answer'; end if;
    end if;
  elsif jsonb_array_length(p_payload->'options')<>0 or p_payload->'answer' is distinct from 'null'::jsonb then
    raise exception 'AI drawing drafts require a prompt and rubric with no objective answer';
  end if;
  if p_type<>'DESCRIPTIVE' then answer:=jsonb_build_object('raw',raw_answer,'status','pending'); end if;

  return jsonb_build_object('type',p_type,'prompt',prompt,'options',options,'assets','[]'::jsonb,
    'answer',answer,'explanation',explanation,'topic',p_topic,'difficulty',p_payload->>'difficulty',
    'estimatedSeconds',seconds::integer,'visualDependency',false,'licence','original-ai-draft','sourceKind','generated',
    'holds','["ai-generated-human-review"]'::jsonb,'provenance',jsonb_build_object(
      'exam',p_exam,'basisExternalKeys',p_basis_keys,'generationNote',left(p_payload#>>'{provenance,generationNote}',1000)));
end $$;

create or replace function public.complete_ai_draft_request(p_request_id uuid,p_model text,p_response_id text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  request dm_private.ai_draft_requests;
  v_draft_id uuid;
  v_payload jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into request from dm_private.ai_draft_requests where id=p_request_id for update;
  if not found then raise exception 'AI draft request unavailable'; end if;
  if request.status='succeeded' and request.model=p_model and request.response_id=p_response_id then return request.draft_id; end if;
  if request.status<>'running' then raise exception 'AI draft request unavailable'; end if;
  if (select count(*) from dm_private.ai_reference_questions(request.basis_external_keys))<>cardinality(request.basis_external_keys) then
    raise exception 'A basis question is no longer cleared for AI drafting';
  end if;
  if coalesce(char_length(btrim(p_model)),0) not between 1 and 200
    or coalesce(char_length(btrim(p_response_id)),0) not between 1 and 200 then raise exception 'AI response metadata is missing'; end if;
  v_payload:=dm_private.canonical_ai_draft(p_payload,request.exam,request.topic,request.question_type,request.basis_external_keys);
  insert into dm_private.question_drafts(created_by,source_type,source_name,payload)
    values(request.created_by,'ai','AI request '||request.id,v_payload) returning id into v_draft_id;
  update dm_private.ai_draft_requests set status='succeeded',model=p_model,response_id=p_response_id,
    draft_id=v_draft_id,completed_at=now() where id=request.id;
  return v_draft_id;
end $$;

create or replace function public.admin_export_question_draft(p_draft_id uuid,p_external_key text,p_rights_confirmed boolean,p_rights_note text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
  draft dm_private.question_drafts;
  ai_request dm_private.ai_draft_requests;
  payload jsonb;
  exam text;
  artifact dm_private.question_draft_exports;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_rights_confirmed is distinct from true then raise exception 'Rights confirmation is required'; end if;
  p_external_key:=lower(btrim(p_external_key));
  p_rights_note:=btrim(p_rights_note);
  if coalesce(p_external_key,'') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'External key must be lowercase words separated by hyphens'; end if;
  if coalesce(char_length(p_rights_note),0) not between 10 and 1000 then raise exception 'Rights note must be 10 to 1000 characters'; end if;
  select * into draft from dm_private.question_drafts where id=p_draft_id for update;
  if not found or draft.status<>'approved' then raise exception 'Only an approved draft can be exported'; end if;
  if exists(select 1 from dm_private.bank_questions where external_key=p_external_key) then
    raise exception 'External key already exists in the canonical bank';
  end if;
  payload:=draft.payload;
  if draft.source_type='ai' then
    select * into ai_request from dm_private.ai_draft_requests where draft_id=draft.id and status='succeeded';
    if found then
      if payload#>>'{provenance,exam}' is null then
        payload:=dm_private.canonical_ai_draft(payload,ai_request.exam,ai_request.topic,ai_request.question_type,ai_request.basis_external_keys);
      end if;
      if ai_request.question_type<>'DESCRIPTIVE' then
        payload:=jsonb_set(payload,'{answer,status}','"human-reviewed"'::jsonb);
      end if;
    end if;
  end if;
  exam:=lower(btrim(coalesce(payload#>>'{provenance,exam}','')));
  if jsonb_typeof(payload) is distinct from 'object' or coalesce(char_length(btrim(payload->>'prompt')),0)<3
    or coalesce(payload->>'type','') not in('MCQ','MSQ','NAT','DESCRIPTIVE')
    or exam not in('uceed','nid','nift','ceed') then
    raise exception 'Draft is missing canonical prompt, type, or provenance.exam';
  end if;
  payload:=jsonb_set(payload,'{provenance,exam}',to_jsonb(exam));
  payload:=(payload-'externalKey'-'holds')||jsonb_build_object('externalKey',p_external_key,'holds','[]'::jsonb);
  insert into dm_private.question_draft_exports(draft_id,external_key,content_sha256,payload,rights_note,exported_by)
    values(draft.id,p_external_key,encode(sha256(convert_to(payload::text,'UTF8')),'hex'),payload,p_rights_note,auth.uid())
    returning * into artifact;
  update dm_private.question_drafts set status='exported' where id=draft.id;
  return jsonb_build_object('id',artifact.id,'externalKey',artifact.external_key,'contentSha256',artifact.content_sha256,
    'payload',artifact.payload,'rightsNote',artifact.rights_note,'createdAt',artifact.created_at,'publicationState','git-review-required');
exception when unique_violation then
  raise exception 'External key or draft has already been exported';
end $$;

revoke all on function dm_private.ai_reference_questions(text[]),
  dm_private.canonical_ai_draft(jsonb,text,text,text,text[]) from public,anon,authenticated;

commit;
