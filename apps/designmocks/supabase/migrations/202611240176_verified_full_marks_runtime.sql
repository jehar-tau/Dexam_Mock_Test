-- Accept full marks only when the current hold-free canonical answer explicitly says FULL MARKS.
-- Preserve physical NAT/MCQ/MSQ kind, fixed context, marking, options and verified media.
begin;

create or replace function dm_private.upsert_verified_exam_runtime_batch(p_records jsonb)
returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare r jsonb;v jsonb;q dm_private.bank_questions;a jsonb;m jsonb;correct numeric;wrong numeric;n integer:=0;drawing boolean;full_marks boolean;expected_key jsonb;
begin
 if auth.role()is distinct from'service_role'then raise exception'Forbidden';end if;
 if jsonb_typeof(p_records)is distinct from'array'or jsonb_array_length(p_records)not between 1 and 200 then raise exception'Invalid runtime batch';end if;
 for r in select value from jsonb_array_elements(p_records)loop
  if jsonb_typeof(r)is distinct from'object'or not r?'runtime'then raise exception'Explicit runtime decision required';end if;
  select*into q from dm_private.bank_questions where active and external_key=r->>'externalKey'and content_sha256=r->>'contentSha256'for update;
  if not found then raise exception'Runtime record does not match active canonical content';end if;
  v:=nullif(r->'runtime','null'::jsonb);drawing:=q.question_type='DESCRIPTIVE';full_marks:=v->'key'->>'kind'='full_marks';
  if v is not null then
   if jsonb_typeof(v)is distinct from'object'or q.exam not in('uceed','ceed')or q.question_type not in('NAT','MCQ','MSQ','DESCRIPTIVE')or q.payload->'holds'is distinct from'[]'::jsonb or v->>'kind'is distinct from(case when drawing then'drawing'else lower(q.question_type)end)or v->>'prompt'is distinct from q.payload->>'prompt'or v->'key'->>'sourceExternalKey'is distinct from q.external_key or (v->'key'->>'kind'is distinct from v->>'kind' and not coalesce((full_marks and upper(btrim(q.payload#>>'{answer,raw}'))='FULL MARKS' and v->'key'=jsonb_build_object('kind','full_marks','sourceExternalKey',q.external_key)),false))then raise exception'Invalid canonical runtime question';end if;
   if v->'context'->>'version'is distinct from'iitb-2027-v1'or v->'context'->>'cycle'is distinct from'2027'or v->'context'->>'exam'is distinct from q.exam then raise exception'Verified scoring context required';end if;
   if drawing then
    correct:=case when q.exam='uceed'then 50 else 20 end;wrong:=0;
    if v->'context'->>'part'is distinct from'B'or(v->'context'->>'durationSeconds')::integer<>(case when q.exam='uceed'then 3600 else 7200 end)or v->'marking'->>'correct'is null or(v->'marking'->>'correct')::numeric<>correct or(v->'marking'->>'wrong')::numeric<>0 or coalesce((v->'marking'->>'humanReview')::boolean,false)is not true or(v->>'points')::numeric<>correct or(v->>'negativePoints')::numeric<>0 or v->'options'is distinct from'[]'::jsonb or v->'key'is distinct from jsonb_build_object('kind','drawing','sourceExternalKey',q.external_key)then raise exception'Part B runtime must require verified human review';end if;
   else
    correct:=case when q.question_type='MCQ'then 3 else 4 end;wrong:=case when q.question_type='NAT'then 0 when q.question_type='MSQ'then-1 when q.exam='uceed'then-0.71 else-0.5 end;
    if v->'marking'->>'correct'is null or(v->'marking'->>'correct')::numeric<>correct or v->'marking'->>'wrong'is null or(v->'marking'->>'wrong')::numeric<>wrong or(v->>'points')::numeric is distinct from correct or(v->>'negativePoints')::numeric is distinct from abs(wrong)or coalesce((v->'marking'->>'partial')::boolean,false)<>(q.question_type='MSQ')then raise exception'Runtime marking does not match verified context';end if;
    if q.question_type='NAT' and (jsonb_array_length(v->'options')<>0 or (not full_marks and (jsonb_typeof(v->'key'->'accepted') is distinct from 'array' or jsonb_array_length(v->'key'->'accepted')=0))) then
     raise exception 'Incomplete runtime answer/options';
    end if;
    if q.question_type='NAT' and not full_marks then for a in select value from jsonb_array_elements(v->'key'->'accepted')loop if jsonb_typeof(a)is distinct from'object'or(a?'exact')=(a?'range')then raise exception'Invalid numeric answer';end if;if a?'exact'then if a->>'exact'is null or char_length(a->>'exact')>200 or a->>'exact'!~'^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$'then raise exception'Invalid exact numeric answer';end if;else if jsonb_typeof(a->'range')is distinct from'array'or jsonb_array_length(a->'range')<>2 or a->'range'->>0!~'^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$'or a->'range'->>1!~'^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$'or(a->'range'->>0)::numeric>(a->'range'->>1)::numeric then raise exception'Invalid numeric answer range';end if;end if;end loop;end if;
    if q.question_type in ('MCQ','MSQ') and full_marks then
     if jsonb_array_length(v->'options') <> 4 or v->'options' is distinct from (
      select jsonb_agg(jsonb_build_object('id', option->>'key', 'label', coalesce(nullif(btrim(option->>'text'),''), option->>'key')))
      from jsonb_array_elements(q.payload->'options') option
     ) then raise exception 'Runtime options or key do not match canonical identifiers'; end if;
    end if;
    if q.question_type in ('MCQ','MSQ') and not full_marks then
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
