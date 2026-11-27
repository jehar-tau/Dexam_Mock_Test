-- Preserve each historic GAT programme, clock and marks. The general B.Des
-- practice blueprint stays separate.
create function public.upsert_nift_year_runtime_batch(p_plan jsonb,p_records jsonb)
returns integer language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare source_id text:=p_plan->>'sourcePaperId';n integer:=0;r jsonb;q dm_private.bank_questions;
  item jsonb;v jsonb;ctx jsonb;expected_options jsonb;expected_key jsonb;raw text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden' using errcode='42501';end if;
  if p_plan->>'format' is distinct from 'dmocks-free-year-paper-v1' or p_plan->>'exam' is distinct from 'nift'
    or coalesce(source_id,'')!~'^nift-20[0-9]{2}-(bdes|mdes)-gat$' or split_part(source_id,'-',2) is distinct from p_plan->>'year'
    or coalesce((p_plan->>'durationSeconds')::integer,0) not between 60 and 21600
    or coalesce(length(btrim(p_plan->>'markingReference')),0) not between 8 and 2000
    or jsonb_typeof(p_plan->'questions') is distinct from 'array' or jsonb_typeof(p_records) is distinct from 'array'
    or jsonb_array_length(p_records) not between 1 and 100 then raise exception 'Historical NIFT GAT plan required';end if;
  if exists(select 1 from dm_private.year_paper_releases where exam='nift' and source_paper_id=source_id)
    or jsonb_array_length(p_plan->'questions')<>(select count(distinct x->>'externalKey') from jsonb_array_elements(p_plan->'questions') x)
    or jsonb_array_length(p_records)<>(select count(distinct x->>'externalKey') from jsonb_array_elements(p_records) x)
    or jsonb_array_length(p_plan->'questions')<>(select count(*) from dm_private.bank_questions b where b.active
      and b.exam='nift' and b.question_type<>'DESCRIPTIVE' and b.payload#>>'{provenance,paperId}'=source_id) then
    raise exception 'Historical NIFT GAT source is incomplete or released';end if;
  ctx:=jsonb_build_object('version','nift-historical-gat-v1','exam','nift','programme',split_part(source_id,'-',3),
    'year',(p_plan->>'year')::integer,'scope','historical-year-paper','sourcePaperId',source_id,
    'durationSeconds',(p_plan->>'durationSeconds')::integer,'markingReference',p_plan->>'markingReference');
  for r in select value from jsonb_array_elements(p_records) loop
    select * into q from dm_private.bank_questions where active and external_key=r->>'externalKey' and content_sha256=r->>'contentSha256' for update;
    select x into item from jsonb_array_elements(p_plan->'questions') x where x->>'externalKey'=r->>'externalKey';
    if q.external_key is null or item is null or q.exam<>'nift' or q.question_type<>'MCQ'
      or q.payload#>>'{provenance,paperId}' is distinct from source_id or q.payload#>>'{provenance,year}' is distinct from p_plan->>'year'
      or q.payload->'holds' is distinct from '[]'::jsonb or q.content_sha256 is distinct from item->>'contentSha256'
      or q.payload#>>'{answer,status}'='pending' then raise exception 'Historical NIFT source version differs';end if;
    v:=r->'runtime';raw:=btrim(q.payload#>>'{answer,raw}');
    select jsonb_agg(jsonb_build_object('id',o->>'key','label',coalesce(nullif(btrim(o->>'text'),''),o->>'key')) order by ord)
      into expected_options from jsonb_array_elements(q.payload->'options') with ordinality as options(o,ord);
    expected_key:=jsonb_build_object('kind','mcq','sourceExternalKey',q.external_key,'correct',jsonb_build_array(raw));
    if v->>'kind' is distinct from 'mcq' or v->>'prompt' is distinct from q.payload->>'prompt' or v->'context' is distinct from ctx
      or jsonb_array_length(expected_options) is distinct from 4 or v->'options' is distinct from expected_options or v->'key' is distinct from expected_key
      or not exists(select 1 from jsonb_array_elements(expected_options) o where o->>'id'=raw)
      or v->'marking' is distinct from item->'marking' or v->>'topic' is distinct from q.topic
      or coalesce((item#>>'{marking,correct}')::numeric,0) not between 0.000001 and 100
      or coalesce((item#>>'{marking,wrong}')::numeric,1) not between -100 and 0
      or v->'points' is distinct from item#>'{marking,correct}'
      or (v->>'negativePoints')::numeric is distinct from -(item#>>'{marking,wrong}')::numeric
      or v->>'explanation' is distinct from item->>'explanation' or coalesce(length(btrim(item->>'explanation')),0) not between 20 and 10000
      then raise exception 'Historical NIFT runtime differs from the stored key or plan';end if;
    if jsonb_typeof(q.payload->'assets') is distinct from 'array' or jsonb_typeof(v->'media') is distinct from 'array'
      or jsonb_array_length(v->'media')<>jsonb_array_length(q.payload->'assets')
      or exists(select 1 from jsonb_array_elements(q.payload->'assets') with ordinality as assets(a,ord)
        left join dm_private.bank_media_assets m on m.sha256=a->>'sha256'
        left join storage.objects s on s.bucket_id='paper-media' and s.name=m.storage_path
        where s.name is null or s.metadata->>'mimetype' is distinct from 'image/png' or s.metadata->>'size' is distinct from m.byte_size::text
          or m.width is distinct from (a->>'width')::integer or m.height is distinct from (a->>'height')::integer
          or v->'media'->(ord::integer-1)->>'path' is distinct from m.storage_path or v->'media'->(ord::integer-1)->>'sha256' is distinct from m.sha256
          or v->'media'->(ord::integer-1)->>'width' is distinct from m.width::text or v->'media'->(ord::integer-1)->>'height' is distinct from m.height::text)
      then raise exception 'Historical NIFT figure differs from verified media';end if;
    if q.runtime_payload is distinct from v then
      if q.owner_approved or q.rights_confirmed then raise exception 'Historical NIFT runtime is already reviewed';end if;
      update dm_private.bank_questions set runtime_payload=v,objective_ready=true where external_key=q.external_key;
    end if;
    n:=n+1;
  end loop;
  return n;
end$$;
revoke all on function public.upsert_nift_year_runtime_batch(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.upsert_nift_year_runtime_batch(jsonb,jsonb) to service_role;
