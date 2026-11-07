begin;

create function dm_private.bank_review_version(question dm_private.bank_questions)
returns text language sql stable set search_path=pg_catalog,dm_private as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'externalKey',question.external_key,'exam',question.exam,'type',question.question_type,'topic',question.topic,'licence',question.licence,
    'contentSha256',question.content_sha256,'payload',question.payload,'runtime',question.runtime_payload,
    'active',question.active,'approved',question.owner_approved,'rightsConfirmed',question.rights_confirmed,
    'reviewNote',question.review_note,'reviewedAt',extract(epoch from question.reviewed_at),
    'hold',(select jsonb_build_object('reason',h.reason,'createdAt',extract(epoch from h.created_at))
      from dm_private.bank_local_holds h where h.external_key=question.external_key)
  )::text,'UTF8')),'hex')
$$;

create function dm_private.bank_review_rows(p_exam text,p_type text,p_status text,p_topic text,p_search text)
returns setof dm_private.bank_questions language sql stable set search_path=pg_catalog,dm_private as $$
  select q.* from dm_private.bank_questions q
  where (p_exam is null or q.exam=p_exam) and(p_type is null or q.question_type=p_type)
    and(p_topic is null or q.topic=p_topic)
    and(p_search is null or position(lower(p_search) in lower(q.external_key||' '||q.topic||' '||coalesce(q.payload->>'prompt','')))>0)
    and case p_status
      when 'pending' then q.active and q.runtime_payload is not null and not(q.owner_approved and q.rights_confirmed)
      when 'approved' then q.active and q.owner_approved and q.rights_confirmed
      when 'unavailable' then q.active and q.runtime_payload is null
      when 'inactive' then not q.active
      else true end
$$;

create function dm_private.bank_review_figures(p_external_key text)
returns table(ordinal integer,sha256 text,width integer,height integer,storage_path text)
language sql stable set search_path=pg_catalog,dm_private as $$
  select x.ordinality::integer,x.asset->>'sha256',b.width,b.height,
    case when exists(select 1 from storage.objects o where o.bucket_id='paper-media' and o.name=b.storage_path
      and o.metadata->>'mimetype'='image/png' and o.metadata->>'size'=b.byte_size::text) then b.storage_path end
  from dm_private.bank_questions q
  cross join lateral jsonb_array_elements(case when jsonb_typeof(q.payload->'assets')='array' then q.payload->'assets' else '[]'::jsonb end)
    with ordinality as x(asset,ordinality)
  left join dm_private.bank_media_assets b on b.sha256=x.asset->>'sha256'
    and b.width::text=x.asset->>'width' and b.height::text=x.asset->>'height'
  where q.external_key=p_external_key
  union all
  select 1,null::text,null::integer,null::integer,null::text from dm_private.bank_questions q
  where q.external_key=p_external_key and q.payload->'visualDependency'='true'::jsonb
    and jsonb_array_length(case when jsonb_typeof(q.payload->'assets')='array' then q.payload->'assets' else '[]'::jsonb end)=0
  order by 1
$$;

create function public.admin_search_bank_questions(
  p_exam text default null,p_type text default null,p_status text default 'pending',p_topic text default null,
  p_search text default null,p_limit integer default 25,p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare total integer; page_offset integer; items jsonb; topics jsonb; summary jsonb;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  p_exam:=nullif(lower(btrim(p_exam)),''); p_type:=nullif(upper(btrim(p_type)),'');
  p_topic:=nullif(btrim(p_topic),''); p_search:=nullif(btrim(p_search),'');
  if (p_exam is not null and p_exam not in('uceed','nid','nift','ceed'))
    or(p_type is not null and p_type not in('MCQ','MSQ','NAT','DESCRIPTIVE'))
    or coalesce(p_status,'') not in('pending','approved','unavailable','inactive','all')
    or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset<0
    or char_length(p_topic)>120 or char_length(p_search)>200 then
    raise exception 'Invalid bank filters or page' using errcode='22023';
  end if;
  select count(*) into total from dm_private.bank_review_rows(p_exam,p_type,p_status,p_topic,p_search);
  page_offset:=least(p_offset,(greatest(total-1,0)/p_limit)*p_limit);
  select coalesce(jsonb_agg(jsonb_build_object('externalKey',q.external_key,'exam',q.exam,'type',q.question_type,'topic',q.topic,
    'licence',q.licence,'runtimeReady',q.runtime_payload is not null,'active',q.active,'approved',q.owner_approved,
    'rightsConfirmed',q.rights_confirmed,'reviewNote',q.review_note,'prompt',left(q.payload->>'prompt',500),
    'reviewVersion',dm_private.bank_review_version(q)) order by q.external_key),'[]') into items
  from(select * from dm_private.bank_review_rows(p_exam,p_type,p_status,p_topic,p_search)
    order by external_key limit p_limit offset page_offset) q;
  select coalesce(jsonb_agg(topic order by topic),'[]') into topics from(
    select distinct topic from dm_private.bank_questions where active and(p_exam is null or exam=p_exam)
  ) t;
  select jsonb_build_object('active',count(*) filter(where active),'available',count(*) filter(where active and runtime_payload is not null),
    'approved',count(*) filter(where active and owner_approved and rights_confirmed),'inactive',count(*) filter(where not active)) into summary
    from dm_private.bank_questions;
  return jsonb_build_object('items',items,'total',total,'offset',page_offset,'limit',p_limit,'topics',topics,'summary',summary);
end $$;

create function public.admin_bank_question(p_external_key text,p_expected_version text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare question dm_private.bank_questions; media jsonb;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into question from dm_private.bank_questions where external_key=p_external_key;
  if not found then raise exception 'Bank question unavailable'; end if;
  if p_expected_version is null or dm_private.bank_review_version(question)<>p_expected_version then
    raise exception 'Question changed. Refresh the bank and review it again.' using errcode='40001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('ordinal',f.ordinal,'width',f.width,'height',f.height,'available',f.storage_path is not null)
    order by f.ordinal),'[]') into media from dm_private.bank_review_figures(question.external_key) f;
  return jsonb_build_object('externalKey',question.external_key,'exam',question.exam,'type',question.question_type,'topic',question.topic,
    'licence',question.licence,'active',question.active,'approved',question.owner_approved,'rightsConfirmed',question.rights_confirmed,
    'reviewNote',question.review_note,'reviewVersion',dm_private.bank_review_version(question),'sourceCommit',question.source_commit,
    'contentSha256',question.content_sha256,'prompt',question.payload->>'prompt','options',coalesce(question.payload->'options','[]'),
    'answer',question.payload->'answer','explanation',question.payload->>'explanation','runtimeKey',question.runtime_payload->'key',
    'marking',question.runtime_payload->'marking','context',question.runtime_payload->'context','runtimeReady',question.runtime_payload is not null,
    'holdReason',(select reason from dm_private.bank_local_holds where external_key=question.external_key),'media',media);
end $$;

create function public.admin_bank_review_media_paths(p_external_key text,p_expected_version text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare question dm_private.bank_questions; result jsonb;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into question from dm_private.bank_questions where external_key=p_external_key;
  if not found then raise exception 'Bank question unavailable'; end if;
  if p_expected_version is null or dm_private.bank_review_version(question)<>p_expected_version then
    raise exception 'Question changed. Refresh the bank and review it again.' using errcode='40001';
  end if;
  if exists(select 1 from dm_private.bank_review_figures(question.external_key) where storage_path is null) then
    raise exception 'Question figures need a verified private media import';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('ordinal',f.ordinal,'width',f.width,'height',f.height,'storagePath',f.storage_path)
    order by f.ordinal),'[]') into result from dm_private.bank_review_figures(question.external_key) f;
  return result;
end $$;

create function public.admin_review_bank_question(
  p_external_key text,p_approved boolean,p_rights_confirmed boolean,p_note text,p_expected_version text
) returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare question dm_private.bank_questions;
begin
  if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into question from dm_private.bank_questions where external_key=p_external_key for update;
  if not found then raise exception 'Bank question unavailable'; end if;
  if p_expected_version is null or dm_private.bank_review_version(question)<>p_expected_version then
    raise exception 'Question changed. Refresh the bank and review it again.' using errcode='40001';
  end if;
  if not question.active or exists(select 1 from dm_private.bank_local_holds where external_key=question.external_key) then
    raise exception 'Inactive or held questions require the existing report and import review workflow';
  end if;
  if p_approved is null or p_rights_confirmed is null or coalesce(char_length(btrim(p_note)),0) not between 8 and 1000 then
    raise exception 'Enter a review note of 8 to 1000 characters';
  end if;
  if p_approved and exists(select 1 from dm_private.bank_review_figures(question.external_key) where storage_path is null) then
    raise exception 'Question figures need a verified private media import';
  end if;
  perform public.admin_review_bank_question(p_external_key,p_approved,p_rights_confirmed,btrim(p_note));
end $$;

revoke all on function dm_private.bank_review_version(dm_private.bank_questions),dm_private.bank_review_rows(text,text,text,text,text),
  dm_private.bank_review_figures(text) from public,anon,authenticated,service_role;
revoke all on function public.admin_search_bank_questions(text,text,text,text,text,integer,integer),public.admin_bank_question(text,text),
  public.admin_bank_review_media_paths(text,text),public.admin_review_bank_question(text,boolean,boolean,text,text) from public,anon;
grant execute on function public.admin_search_bank_questions(text,text,text,text,text,integer,integer),public.admin_bank_question(text,text),
  public.admin_bank_review_media_paths(text,text),public.admin_review_bank_question(text,boolean,boolean,text,text) to authenticated;

commit;
