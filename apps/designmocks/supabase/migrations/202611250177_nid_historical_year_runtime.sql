-- NID year papers use their own printed historical clock and marks. No 2027
-- NID blueprint or second-best-option partial credit is inferred here.
create function public.upsert_nid_year_runtime_batch(p_plan jsonb,p_records jsonb)
returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare r jsonb;item jsonb;v jsonb;q dm_private.bank_questions;raw text;expected_key jsonb;n integer:=0;a jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Forbidden';end if;
 if p_plan->>'format' is distinct from 'dmocks-free-year-paper-v1' or p_plan->>'exam' is distinct from 'nid'
   or jsonb_typeof(p_plan->'questions') is distinct from 'array' or jsonb_typeof(p_records) is distinct from 'array'
   or jsonb_array_length(p_records) not between 1 and 100
   or (p_plan->>'year')::integer not between 2000 and 2100
   or (p_plan->>'durationSeconds')::integer not between 60 and 21600
   or char_length(btrim(p_plan->>'markingReference'))<8 then
   raise exception 'Validated NID historical plan required';end if;
 if (select count(*) from dm_private.bank_questions b where b.active and b.exam='nid'
     and b.question_type<>'DESCRIPTIVE' and b.payload->'holds'='[]'::jsonb
     and b.payload#>>'{provenance,paperId}'=p_plan->>'sourcePaperId'
     and b.payload#>>'{provenance,year}'=p_plan->>'year')<>jsonb_array_length(p_plan->'questions')
   or (select count(distinct x->>'externalKey') from jsonb_array_elements(p_plan->'questions') x)
      <>jsonb_array_length(p_plan->'questions') then
   raise exception 'NID plan does not cover the exact objective source group';end if;
 for r in select value from jsonb_array_elements(p_records) loop
   select x into item from jsonb_array_elements(p_plan->'questions') x
     where x->>'externalKey'=r->>'externalKey';
   select * into q from dm_private.bank_questions
     where active and external_key=r->>'externalKey' and content_sha256=r->>'contentSha256' for update;
   if q.external_key is null or item is null or item->>'contentSha256' is distinct from q.content_sha256
     or q.exam<>'nid' or q.question_type<>'MCQ'
     or q.payload->'holds' is distinct from '[]'::jsonb
     or q.payload#>>'{provenance,paperId}' is distinct from p_plan->>'sourcePaperId'
     or q.payload#>>'{provenance,year}' is distinct from p_plan->>'year' then
     raise exception 'NID source version or approval is not ready';end if;
   v:=r->'runtime';raw:=btrim(q.payload#>>'{answer,raw}');
   if raw is null or raw='' or q.payload#>>'{answer,status}'='pending'
     or jsonb_typeof(v) is distinct from 'object' or v->>'kind' is distinct from 'mcq'
     or v->>'prompt' is distinct from q.payload->>'prompt'
     or v->>'explanation' is distinct from item->>'explanation'
     or char_length(btrim(v->>'explanation'))<20
     or v->'marking' is distinct from item->'marking'
     or v->'marking' ? 'partial'
     or (v->>'points')::numeric is distinct from (item->'marking'->>'correct')::numeric
     or (v->>'negativePoints')::numeric is distinct from abs((item->'marking'->>'wrong')::numeric)
     or (item->'marking'->>'correct')::numeric not between 0.000001 and 100
     or (item->'marking'->>'wrong')::numeric not between -100 and 0
     or v->'context'->>'version' is distinct from 'nid-historical-year-v1'
     or v->'context'->>'scope' is distinct from 'historical-year-paper'
     or v->'context'->>'exam' is distinct from 'nid'
     or v->'context'->>'year' is distinct from p_plan->>'year'
     or v->'context'->>'sourcePaperId' is distinct from p_plan->>'sourcePaperId'
     or v->'context'->>'durationSeconds' is distinct from p_plan->>'durationSeconds'
     or v->'context'->>'markingReference' is distinct from p_plan->>'markingReference'
     or v->'key'->>'sourceExternalKey' is distinct from q.external_key then
     raise exception 'NID runtime does not match the historical plan';end if;
   if jsonb_typeof(q.payload->'options') is distinct from 'array' or jsonb_array_length(q.payload->'options')<>4
     or v->'options' is distinct from (select jsonb_agg(jsonb_build_object('id',o.value->>'key',
       'label',coalesce(nullif(btrim(o.value->>'text'),''),o.value->>'key')) order by o.ordinality)
       from jsonb_array_elements(q.payload->'options') with ordinality o) then
     raise exception 'NID options do not match the source';end if;
   expected_key:=case when upper(raw)='FULL MARKS' then
     jsonb_build_object('kind','full_marks','sourceExternalKey',q.external_key)
     else jsonb_build_object('kind','mcq','sourceExternalKey',q.external_key,
       'correct',to_jsonb(regexp_split_to_array(raw,'[[:space:]]+[oO][rR][[:space:]]+'))) end;
   if v->'key' is distinct from expected_key or
     (expected_key->>'kind'='mcq' and (jsonb_array_length(expected_key->'correct') not between 1 and 4
       or exists(select 1 from jsonb_array_elements_text(expected_key->'correct') chosen
         where not exists(select 1 from jsonb_array_elements(v->'options') option where option->>'id'=chosen)))) then
     raise exception 'NID key does not match the stored answer';end if;
   if jsonb_typeof(q.payload->'assets') is distinct from 'array'
     or jsonb_typeof(v->'media') is distinct from 'array'
     or jsonb_array_length(v->'media')<>jsonb_array_length(q.payload->'assets') then
     raise exception 'NID figures are incomplete';end if;
   for a in select value from jsonb_array_elements(q.payload->'assets') loop
     if not exists(select 1 from dm_private.bank_media_assets m
       join storage.objects stored on stored.bucket_id='paper-media' and stored.name=m.storage_path
       where m.sha256=a->>'sha256' and m.width=(a->>'width')::integer
         and m.height=(a->>'height')::integer and stored.metadata->>'mimetype'='image/png'
         and stored.metadata->>'size'=m.byte_size::text
         and exists(select 1 from jsonb_array_elements(v->'media') image
           where image->>'sha256'=m.sha256 and image->>'path'=m.storage_path
             and (image->>'width')::integer=m.width and (image->>'height')::integer=m.height)) then
       raise exception 'NID figure is not verified private media';end if;
   end loop;
   update dm_private.bank_questions set runtime_payload=v,objective_ready=true where external_key=q.external_key;
   n:=n+1;
 end loop;
 return n;
end$$;
revoke all on function public.upsert_nid_year_runtime_batch(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.upsert_nid_year_runtime_batch(jsonb,jsonb) to service_role;
