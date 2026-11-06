-- A rendering/scoring change requires a fresh review even if the canonical source is unchanged.
create or replace function dm_private.reset_bank_review_on_change() returns trigger language plpgsql set search_path='' as $$
begin
 if old.content_sha256 is distinct from new.content_sha256 then new.runtime_payload:=null;end if;
 if old.content_sha256 is distinct from new.content_sha256 or old.runtime_payload is distinct from new.runtime_payload then
  new.owner_approved:=false;new.rights_confirmed:=false;new.reviewed_by:=null;new.reviewed_at:=null;
 end if;
 return new;
end $$;

create or replace function public.upsert_question_bank_runtime_batch(p_records jsonb)
returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare r jsonb;v jsonb;q dm_private.bank_questions;a jsonb;m jsonb;correct numeric;wrong numeric;n integer:=0;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Forbidden';end if;
 if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 200 then raise exception 'Invalid runtime batch';end if;
 for r in select value from jsonb_array_elements(p_records) loop
  if jsonb_typeof(r) is distinct from 'object' or not r?'runtime' then raise exception 'Explicit runtime decision required';end if;
  select * into q from dm_private.bank_questions where active and external_key=r->>'externalKey' and content_sha256=r->>'contentSha256' for update;
  if not found then raise exception 'Runtime record does not match active canonical content';end if;
  v:=nullif(r->'runtime','null'::jsonb);
  if v is not null then
   if jsonb_typeof(v) is distinct from 'object' or q.exam not in ('uceed','ceed') or q.question_type not in ('NAT','MCQ','MSQ') or q.payload->'holds' is distinct from '[]'::jsonb or v->>'kind' is distinct from lower(q.question_type) or v->>'prompt' is distinct from q.payload->>'prompt' or v->'key'->>'sourceExternalKey' is distinct from q.external_key or v->'key'->>'kind' is distinct from v->>'kind' then raise exception 'Invalid canonical runtime question';end if;
   if v->'context'->>'version' is distinct from 'iitb-2027-v1' or v->'context'->>'cycle' is distinct from '2027' or v->'context'->>'exam' is distinct from q.exam then raise exception 'Verified scoring context required';end if;
   correct:=case when q.question_type='MCQ' then 3 else 4 end;
   wrong:=case when q.question_type='NAT' then 0 when q.question_type='MSQ' then -1 when q.exam='uceed' then -0.71 else -0.5 end;
   if v->'marking'->>'correct' is null or (v->'marking'->>'correct')::numeric<>correct or v->'marking'->>'wrong' is null or (v->'marking'->>'wrong')::numeric<>wrong or (v->>'points')::numeric is distinct from correct or (v->>'negativePoints')::numeric is distinct from abs(wrong) or coalesce((v->'marking'->>'partial')::boolean,false)<>(q.question_type='MSQ') then raise exception 'Runtime marking does not match verified context';end if;
   if jsonb_typeof(v->'options') is distinct from 'array' or jsonb_typeof(v->'key') is distinct from 'object' or jsonb_typeof(v->'media') is distinct from 'array' then raise exception 'Invalid runtime structure';end if;
   if (q.question_type='NAT' and (jsonb_array_length(v->'options')<>0 or jsonb_typeof(v->'key'->'accepted') is distinct from 'array' or jsonb_array_length(v->'key'->'accepted')=0)) or (q.question_type in ('MCQ','MSQ') and (jsonb_array_length(v->'options')<>4 or jsonb_typeof(v->'key'->'correct') is distinct from 'array' or jsonb_array_length(v->'key'->'correct')=0)) then raise exception 'Incomplete runtime answer/options';end if;
   if q.question_type='NAT' then
    for a in select value from jsonb_array_elements(v->'key'->'accepted') loop
     if jsonb_typeof(a) is distinct from 'object' or (a?'exact')=(a?'range') then raise exception 'Invalid numeric answer';end if;
     if a?'exact' then
      if a->>'exact' is null or char_length(a->>'exact')>200 or a->>'exact'!~'^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' then raise exception 'Invalid exact numeric answer';end if;
     else
      if jsonb_typeof(a->'range') is distinct from 'array' or jsonb_array_length(a->'range')<>2 or a->'range'->>0 is null or a->'range'->>1 is null or char_length(a->'range'->>0)>200 or char_length(a->'range'->>1)>200 or a->'range'->>0!~'^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' or a->'range'->>1!~'^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' or (a->'range'->>0)::numeric>(a->'range'->>1)::numeric then raise exception 'Invalid numeric answer range';end if;
     end if;
    end loop;
   end if;
   if q.question_type in ('MCQ','MSQ') then
    if v->'options' is distinct from (select jsonb_agg(jsonb_build_object('id',option->>'key','label',coalesce(nullif(btrim(option->>'text'),''),option->>'key'))) from jsonb_array_elements(q.payload->'options') option) or (q.question_type='MCQ' and jsonb_array_length(v->'key'->'correct')<>1) or exists(select 1 from jsonb_array_elements_text(v->'key'->'correct') chosen where not exists(select 1 from jsonb_array_elements(v->'options') option where option->>'id'=chosen)) or (select count(distinct chosen) from jsonb_array_elements_text(v->'key'->'correct') chosen)<>jsonb_array_length(v->'key'->'correct') then raise exception 'Runtime options or key do not match canonical identifiers';end if;
   end if;
   if jsonb_typeof(q.payload->'assets') is distinct from 'array' then raise exception 'Canonical asset manifest required';end if;
   if jsonb_array_length(v->'media')<>jsonb_array_length(q.payload->'assets') or (coalesce((q.payload->>'visualDependency')::boolean,false) and jsonb_array_length(v->'media')=0) then raise exception 'Canonical figures must be resolved';end if;
   for a in select value from jsonb_array_elements(q.payload->'assets') loop
    if not exists(select 1 from dm_private.bank_media_assets b where b.sha256=a->>'sha256' and b.width=(a->>'width')::integer and b.height=(a->>'height')::integer and exists(select 1 from jsonb_array_elements(v->'media') image where image->>'path'=b.storage_path and image->>'sha256'=b.sha256 and (image->>'width')::integer=b.width and (image->>'height')::integer=b.height)) then raise exception 'Runtime figure is not verified canonical media';end if;
   end loop;
   for m in select value from jsonb_array_elements(v->'media') loop
    if not exists(select 1 from jsonb_array_elements(q.payload->'assets') asset where asset->>'sha256'=m->>'sha256') then raise exception 'Unreferenced runtime figure';end if;
   end loop;
  end if;
  update dm_private.bank_questions set runtime_payload=v,objective_ready=(v is not null) where external_key=q.external_key;
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.upsert_question_bank_runtime_batch(jsonb) from public,anon,authenticated;
grant execute on function public.upsert_question_bank_runtime_batch(jsonb) to service_role;
