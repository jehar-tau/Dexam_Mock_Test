begin;

-- Use the ECMAScript whitespace set and UTF-16 sort order used by the compiler.
-- C collation keeps exact option identifiers case sensitive across databases.
create function dm_private.verified_choice_selection(
  p_kind text, p_branch text, p_ids text[], p_whitespace text
) returns jsonb
language plpgsql immutable set search_path = pg_catalog as $$
declare
  chosen text[];
begin
  if p_branch collate "C" = any(p_ids) then
    return jsonb_build_array(p_branch);
  end if;
  if p_kind = 'MCQ' then return null; end if;

  if p_branch collate "C" ~ '^[A-Za-z]+$'
    and not exists (select 1 from unnest(p_ids) id where id collate "C" !~ '^[A-Za-z]$') then
    chosen := regexp_split_to_array(p_branch, '');
  else
    chosen := regexp_split_to_array(p_branch collate "C", '[' || p_whitespace || ',;&/]+');
  end if;
  if cardinality(chosen) = 0
    or (select count(distinct id collate "C") from unnest(chosen) id) <> cardinality(chosen)
    or exists (select 1 from unnest(chosen) id where not (id collate "C" = any(p_ids))) then
    return null;
  end if;

  return (
    select jsonb_agg(id order by array(
      select code_unit
      from regexp_split_to_table(id, '') with ordinality as chars(ch, position)
      cross join lateral unnest(case when ascii(ch) <= 65535 then array[ascii(ch)] else
        array[55296 + (ascii(ch) - 65536) / 1024, 56320 + (ascii(ch) - 65536) % 1024] end)
        with ordinality as utf16(code_unit, position)
      order by chars.position, utf16.position
    ))
    from unnest(chosen) id
  );
end
$$;

create function dm_private.verified_choice_alternative_key(
  p_kind text, p_external_key text, p_payload jsonb
) returns jsonb
language plpgsql immutable set search_path = pg_catalog, dm_private as $$
declare
  whitespace constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
  raw text;
  branches text[];
  branch text;
  ids text[];
  selected jsonb;
  selections jsonb[] := '{}';
  alternatives jsonb := '[]';
begin
  if jsonb_typeof(p_payload->'answer'->'raw') is distinct from 'string'
    or p_payload->'answer'->>'status' = 'pending'
    or jsonb_typeof(p_payload->'options') is distinct from 'array' then
    return null;
  end if;
  raw := btrim(p_payload->'answer'->>'raw', whitespace);
  if char_length(raw) > 200 then return null; end if;
  branches := regexp_split_to_array(raw collate "C", '[' || whitespace || ']+[oO][rR][' || whitespace || ']+');
  if cardinality(branches) < 2
    or char_length(raw) + (select count(*) from regexp_split_to_table(raw, '') ch where ascii(ch) > 65535) > 200 then
    return null;
  end if;

  if exists (select 1 from jsonb_array_elements(p_payload->'options') option
    where jsonb_typeof(option->'key') is distinct from 'string' or btrim(option->>'key', whitespace) = '') then
    return null;
  end if;
  select array_agg(option->>'key') into ids from jsonb_array_elements(p_payload->'options') option;
  if cardinality(ids) is distinct from 4
    or (select count(distinct id collate "C") from unnest(ids) id) <> cardinality(ids)
    or dm_private.verified_choice_selection(p_kind, raw, ids, whitespace) is not null then
    return null;
  end if;

  foreach branch in array branches loop
    selected := dm_private.verified_choice_selection(p_kind, branch, ids, whitespace);
    if selected is null or selected = any(selections) then return null; end if;
    selections := array_append(selections, selected);
    alternatives := alternatives || jsonb_build_array(case when p_kind = 'MCQ' then selected->0 else selected end);
  end loop;
  return jsonb_build_object('kind', lower(p_kind), 'sourceExternalKey', p_external_key,
    case when p_kind = 'MCQ' then 'correct' else 'alternatives' end, alternatives);
end
$$;

revoke all on function dm_private.verified_choice_selection(text, text, text[], text),
  dm_private.verified_choice_alternative_key(text, text, jsonb) from public, anon, authenticated, service_role;

create or replace function dm_private.upsert_verified_exam_runtime_batch(p_records jsonb)
returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare r jsonb;v jsonb;q dm_private.bank_questions;a jsonb;m jsonb;correct numeric;wrong numeric;n integer:=0;drawing boolean;expected_key jsonb;
begin
 if auth.role()is distinct from'service_role'then raise exception'Forbidden';end if;
 if jsonb_typeof(p_records)is distinct from'array'or jsonb_array_length(p_records)not between 1 and 200 then raise exception'Invalid runtime batch';end if;
 for r in select value from jsonb_array_elements(p_records)loop
  if jsonb_typeof(r)is distinct from'object'or not r?'runtime'then raise exception'Explicit runtime decision required';end if;
  select*into q from dm_private.bank_questions where active and external_key=r->>'externalKey'and content_sha256=r->>'contentSha256'for update;
  if not found then raise exception'Runtime record does not match active canonical content';end if;
  v:=nullif(r->'runtime','null'::jsonb);drawing:=q.question_type='DESCRIPTIVE';
  if v is not null then
   if jsonb_typeof(v)is distinct from'object'or q.exam not in('uceed','ceed')or q.question_type not in('NAT','MCQ','MSQ','DESCRIPTIVE')or q.payload->'holds'is distinct from'[]'::jsonb or v->>'kind'is distinct from(case when drawing then'drawing'else lower(q.question_type)end)or v->>'prompt'is distinct from q.payload->>'prompt'or v->'key'->>'sourceExternalKey'is distinct from q.external_key or v->'key'->>'kind'is distinct from v->>'kind'then raise exception'Invalid canonical runtime question';end if;
   if v->'context'->>'version'is distinct from'iitb-2027-v1'or v->'context'->>'cycle'is distinct from'2027'or v->'context'->>'exam'is distinct from q.exam then raise exception'Verified scoring context required';end if;
   if drawing then
    correct:=case when q.exam='uceed'then 50 else 20 end;wrong:=0;
    if v->'context'->>'part'is distinct from'B'or(v->'context'->>'durationSeconds')::integer<>(case when q.exam='uceed'then 3600 else 7200 end)or v->'marking'->>'correct'is null or(v->'marking'->>'correct')::numeric<>correct or(v->'marking'->>'wrong')::numeric<>0 or coalesce((v->'marking'->>'humanReview')::boolean,false)is not true or(v->>'points')::numeric<>correct or(v->>'negativePoints')::numeric<>0 or v->'options'is distinct from'[]'::jsonb or v->'key'is distinct from jsonb_build_object('kind','drawing','sourceExternalKey',q.external_key)then raise exception'Part B runtime must require verified human review';end if;
   else
    correct:=case when q.question_type='MCQ'then 3 else 4 end;wrong:=case when q.question_type='NAT'then 0 when q.question_type='MSQ'then-1 when q.exam='uceed'then-0.71 else-0.5 end;
    if v->'marking'->>'correct'is null or(v->'marking'->>'correct')::numeric<>correct or v->'marking'->>'wrong'is null or(v->'marking'->>'wrong')::numeric<>wrong or(v->>'points')::numeric is distinct from correct or(v->>'negativePoints')::numeric is distinct from abs(wrong)or coalesce((v->'marking'->>'partial')::boolean,false)<>(q.question_type='MSQ')then raise exception'Runtime marking does not match verified context';end if;
    if q.question_type='NAT' and (jsonb_array_length(v->'options')<>0 or jsonb_typeof(v->'key'->'accepted') is distinct from 'array' or jsonb_array_length(v->'key'->'accepted')=0) then
     raise exception 'Incomplete runtime answer/options';
    end if;
    if q.question_type='NAT'then for a in select value from jsonb_array_elements(v->'key'->'accepted')loop if jsonb_typeof(a)is distinct from'object'or(a?'exact')=(a?'range')then raise exception'Invalid numeric answer';end if;if a?'exact'then if a->>'exact'is null or char_length(a->>'exact')>200 or a->>'exact'!~'^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$'then raise exception'Invalid exact numeric answer';end if;else if jsonb_typeof(a->'range')is distinct from'array'or jsonb_array_length(a->'range')<>2 or a->'range'->>0!~'^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$'or a->'range'->>1!~'^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$'or(a->'range'->>0)::numeric>(a->'range'->>1)::numeric then raise exception'Invalid numeric answer range';end if;end if;end loop;end if;
    if q.question_type in ('MCQ','MSQ') then
     if jsonb_array_length(v->'options') <> 4 or v->'options' is distinct from (
      select jsonb_agg(jsonb_build_object('id', option->>'key', 'label', coalesce(nullif(btrim(option->>'text'),''), option->>'key')))
      from jsonb_array_elements(q.payload->'options') option
     ) then raise exception 'Runtime options or key do not match canonical identifiers'; end if;

     expected_key := dm_private.verified_choice_alternative_key(q.question_type, q.external_key, q.payload);
     if expected_key is not null or v->'key' ? 'alternatives'
       or (q.question_type = 'MCQ' and v->'key'->'correct'->1 is not null) then
      if expected_key is null or v->'key' is distinct from expected_key then
       raise exception 'Runtime alternatives do not match the canonical answer';
      end if;
     else
      if jsonb_typeof(v->'key'->'correct') is distinct from 'array' or jsonb_array_length(v->'key'->'correct') = 0 then
       raise exception 'Incomplete runtime answer/options';
      end if;
      if exists (select 1 from jsonb_array_elements_text(v->'key'->'correct') chosen
       where not exists (select 1 from jsonb_array_elements(v->'options') option where option->>'id' = chosen))
       or (select count(distinct chosen) from jsonb_array_elements_text(v->'key'->'correct') chosen) <> jsonb_array_length(v->'key'->'correct') then
       raise exception 'Runtime options or key do not match canonical identifiers';
      end if;
     end if;
    end if;
   end if;
   if jsonb_typeof(v->'options')is distinct from'array'or jsonb_typeof(v->'key')is distinct from'object'or jsonb_typeof(v->'media')is distinct from'array'or jsonb_typeof(q.payload->'assets')is distinct from'array'then raise exception'Invalid runtime structure';end if;
   if jsonb_array_length(v->'media')<>jsonb_array_length(q.payload->'assets')or(drawing and jsonb_array_length(v->'media')=0)or(coalesce((q.payload->>'visualDependency')::boolean,false)and jsonb_array_length(v->'media')=0)then raise exception'Canonical figures must be resolved';end if;
   for a in select value from jsonb_array_elements(q.payload->'assets')loop if not exists(select 1 from dm_private.bank_media_assets b where b.sha256=a->>'sha256'and b.width=(a->>'width')::integer and b.height=(a->>'height')::integer and exists(select 1 from jsonb_array_elements(v->'media')image where image->>'path'=b.storage_path and image->>'sha256'=b.sha256 and(image->>'width')::integer=b.width and(image->>'height')::integer=b.height))then raise exception'Runtime figure is not verified canonical media';end if;end loop;
   for m in select value from jsonb_array_elements(v->'media')loop if not exists(select 1 from jsonb_array_elements(q.payload->'assets')asset where asset->>'sha256'=m->>'sha256')then raise exception'Unreferenced runtime figure';end if;end loop;
  end if;
  update dm_private.bank_questions set runtime_payload=v,objective_ready=(v is not null and not drawing)where external_key=q.external_key;n:=n+1;
 end loop;return n;
end$$;

commit;
