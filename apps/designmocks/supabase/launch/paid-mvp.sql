-- Apply AFTER the accepted migrations/functions, in one transaction, only to an
-- approved DMocks target with registration/sales closed. This is a deployment
-- profile, not permission to publish real content or open sales.
do $$begin
 if exists(select 1 from public.launch_settings where sales_enabled)then raise exception 'Close sales before applying the MVP profile';end if;
 if exists(select 1 from dm_private.registration_policy where mode='open')then raise exception 'Close public registration before applying the MVP profile';end if;
end$$;
create table if not exists dm_private.mvp_rpc_allowlist(
 signature text primary key,category text not null check(category in('student','staff'))
);
alter table dm_private.mvp_rpc_allowlist enable row level security;
revoke all on dm_private.mvp_rpc_allowlist from public,anon,authenticated,service_role;

create table if not exists dm_private.mvp_paid_releases(
 paper_id uuid primary key references dm_private.papers(id),manifest_sha256 text not null check(manifest_sha256~'^[a-f0-9]{64}$'),
 manifest jsonb not null,rights_reference text not null check(char_length(btrim(rights_reference))between 8 and 2000),
 actor_id uuid not null references auth.users(id),approved_at timestamptz not null default clock_timestamp(),withdrawn_at timestamptz
);
create table if not exists dm_private.mvp_release_audit(
 id bigint generated always as identity primary key,paper_id uuid not null references dm_private.papers(id),
 manifest_sha256 text not null,action text not null check(action in('release','withdraw')),evidence text not null,
 actor_id uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp()
);
alter table dm_private.mvp_paid_releases enable row level security;
alter table dm_private.mvp_release_audit enable row level security;
revoke all on dm_private.mvp_paid_releases,dm_private.mvp_release_audit from public,anon,authenticated,service_role;

create table if not exists dm_private.mvp_prepared_papers(
 packet_sha256 text primary key check(packet_sha256~'^[a-f0-9]{64}$'),
 request_sha256 text not null check(request_sha256~'^[a-f0-9]{64}$'),
 paper_id uuid not null unique references dm_private.papers(id),
 manifest_sha256 text not null check(manifest_sha256~'^[a-f0-9]{64}$'),
 prepared_at timestamptz not null default clock_timestamp()
);
alter table dm_private.mvp_prepared_papers enable row level security;
revoke all on dm_private.mvp_prepared_papers from public,anon,authenticated,service_role;

create table if not exists dm_private.mvp_test_checkout_control(
 singleton boolean primary key default true check(singleton),enabled boolean not null default false,expires_at timestamptz,
 evidence text,actor_id uuid references auth.users(id),updated_at timestamptz not null default clock_timestamp(),
 check(not enabled or(expires_at is not null and actor_id is not null and char_length(btrim(evidence))>=8))
);
insert into dm_private.mvp_test_checkout_control(singleton)values(true)on conflict(singleton)do nothing;
create table if not exists dm_private.mvp_test_checkout_audit(
 id bigint generated always as identity primary key,enabled boolean not null,expires_at timestamptz,evidence text not null,
 actor_id uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp()
);
alter table dm_private.mvp_test_checkout_control enable row level security;
alter table dm_private.mvp_test_checkout_audit enable row level security;
revoke all on dm_private.mvp_test_checkout_control,dm_private.mvp_test_checkout_audit from public,anon,authenticated,service_role;
do $$begin
 if exists(select 1 from dm_private.mvp_test_checkout_control where enabled)then raise exception 'Close the merchant Test window before applying the MVP profile';end if;
end$$;

create or replace function dm_private.mvp_lock_paper(p_id uuid)returns void
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
 perform 1 from dm_private.papers where id=p_id for share;
 perform 1 from dm_private.questions where paper_id=p_id order by id for share;
 perform 1 from dm_private.answer_keys k join dm_private.questions q on q.id=k.question_id where q.paper_id=p_id order by k.question_id for share of k;
 perform 1 from dm_private.bank_questions b where b.external_key in(select k.key->>'sourceExternalKey'from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=p_id)order by b.external_key for share;
 perform 1 from dm_private.mvp_paid_releases where paper_id=p_id for share;
end$$;

-- VOLATILE is intentional: callers may have waited on locks and must inspect
-- current canonical review/rights/holds, not the statement's earlier snapshot.
create or replace function dm_private.mvp_paper_manifest(p_id uuid)returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,dm_private as $$
declare p dm_private.papers;q record;b dm_private.bank_questions;n integer:=0;body jsonb:='[]';items jsonb:='[]';seen text[]:='{}';kind_counts jsonb:='{}';total numeric:=0;v_sha text;
begin
 select *into p from dm_private.papers where id=p_id;
 if p.id is null or p.source_kind<>'catalogue'or p.owner_user_id is not null or p.exam not in('uceed','ceed')
  or p.duration_seconds<>(case when p.exam='uceed'then 7200 else 3600 end)
  or p.title!~*'part[[:space:]]+a' or char_length(btrim(p.title))not between 2 and 180 then return null;end if;
 for q in select x.*,k.key,k.explanation from dm_private.questions x left join dm_private.answer_keys k on k.question_id=x.id where x.paper_id=p.id order by x.ordinal loop
  n:=n+1;
  if n>200 or q.ordinal<>n or not q.reviewed or q.kind not in('nat','msq','mcq')or q.key is null then return null;end if;
  if q.kind<>(case when n<=(case when p.exam='uceed'then 14 else 8 end)then'nat'
   when n<=(case when p.exam='uceed'then 29 else 18 end)then'msq'else'mcq'end)then return null;end if;
  select *into b from dm_private.bank_questions where external_key=q.key->>'sourceExternalKey';
  if b.external_key is null or b.external_key=any(seen)or not b.active or not b.owner_approved or not b.rights_confirmed or not b.objective_ready
   or b.exam<>p.exam or b.question_type<>upper(q.kind)or b.payload->'holds'is distinct from '[]'::jsonb or b.runtime_payload is null then return null;end if;
  if b.runtime_payload->'context'->>'version'is distinct from 'iitb-2027-v1'or b.runtime_payload->'context'->>'cycle'is distinct from '2027'
   or b.runtime_payload->'context'->>'exam'is distinct from p.exam or q.points<>(case when q.kind='mcq'then 3 else 4 end)
   or q.negative_points<>(case when q.kind='nat'then 0 when q.kind='msq'then 1 when p.exam='uceed'then 0.71 else 0.5 end)then return null;end if;
  if q.prompt is distinct from b.runtime_payload->>'prompt'or q.options is distinct from b.runtime_payload->'options'
   or q.kind is distinct from b.runtime_payload->>'kind'or q.marking is distinct from b.runtime_payload->'marking'
   or q.media is distinct from b.runtime_payload->'media'or to_jsonb(q.points)is distinct from b.runtime_payload->'points'
   or to_jsonb(q.negative_points)is distinct from b.runtime_payload->'negativePoints'or q.topic is distinct from b.runtime_payload->>'topic'
   or q.key is distinct from b.runtime_payload->'key'or q.explanation is distinct from b.runtime_payload->>'explanation'then return null;end if;
  if jsonb_typeof(q.media)is distinct from 'array'or jsonb_typeof(b.payload->'assets')is distinct from 'array'
   or jsonb_array_length(q.media)<>jsonb_array_length(b.payload->'assets')or(coalesce((b.payload->>'visualDependency')::boolean,false)and jsonb_array_length(q.media)=0)
   or (jsonb_array_length(q.media)>0 and not exists(select 1 from storage.buckets where id='paper-media' and not public))
   or exists(select 1 from jsonb_array_elements(b.payload->'assets')a where not exists(select 1 from jsonb_array_elements(q.media)m where m->>'sha256'=a->>'sha256'and m->>'width'=a->>'width'and m->>'height'=a->>'height'))
   or exists(select 1 from jsonb_array_elements(q.media)m
   where not exists(select 1 from dm_private.bank_media_assets a join storage.objects o on o.bucket_id='paper-media'and o.name=a.storage_path
    where a.storage_path=m->>'path'and a.sha256=m->>'sha256'and a.width=(m->>'width')::integer and a.height=(m->>'height')::integer
     and o.metadata->>'mimetype'in('image/png','image/jpeg','image/webp')and(o.metadata->>'size')::bigint=a.byte_size))then return null;end if;
  seen:=array_append(seen,b.external_key);total:=total+q.points;
  kind_counts:=jsonb_set(kind_counts,array[q.kind],to_jsonb(coalesce((kind_counts->>q.kind)::integer,0)+1));
  items:=items||jsonb_build_array(jsonb_build_object('ordinal',n,'externalKey',b.external_key,'contentSha256',b.content_sha256,'kind',q.kind,'points',q.points,'negativePoints',q.negative_points,'imageCount',jsonb_array_length(q.media),'sourceCommit',b.source_commit,'sourceLicenceLabel',b.licence));
  body:=body||jsonb_build_array(jsonb_build_object('question',to_jsonb(q),'externalKey',b.external_key,'contentSha256',b.content_sha256));
 end loop;
 if n<>(case when p.exam='uceed'then 57 else 44 end)or kind_counts<>(case when p.exam='uceed'then'{"nat":14,"msq":15,"mcq":28}'::jsonb else'{"nat":8,"msq":10,"mcq":26}'::jsonb end)then return null;end if;
 v_sha:=encode(sha256(convert_to(jsonb_build_object('paperId',p.id,'title',p.title,'exam',p.exam,'durationSeconds',p.duration_seconds,'questions',body)::text,'UTF8')),'hex');
 if exists(select 1 from dm_private.mvp_prepared_papers where paper_id=p_id and manifest_sha256<>v_sha)then return null;end if;
 return jsonb_build_object('paperId',p.id,'title',p.title,'exam',p.exam,'part','A','contextVersion','iitb-2027-v1','durationSeconds',p.duration_seconds,'questionCount',n,'kinds',kind_counts,'totalPoints',total,'items',items,'sha256',v_sha,'scope','paid-mvp-v1');
exception when invalid_text_representation or numeric_value_out_of_range then return null;
end$$;

create or replace function dm_private.mvp_release_is_current(p_id uuid)returns boolean
language plpgsql volatile security definer set search_path=pg_catalog,dm_private as $$
declare fingerprint text;
begin
 if not exists(select 1 from dm_private.papers where id=p_id and published and reviewed and rights_confirmed)then return false;end if;
 fingerprint:=dm_private.mvp_paper_manifest(p_id)->>'sha256';
 return coalesce(exists(select 1 from dm_private.mvp_paid_releases where paper_id=p_id and withdrawn_at is null and manifest_sha256=fingerprint),false);
end$$;

create or replace function public.admin_mvp_paper_manifest(p_id uuid)returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public,dm_private as $$
declare manifest jsonb;
begin
 if not public.is_dmocks_admin()then raise exception 'Admin access required';end if;
 manifest:=dm_private.mvp_paper_manifest(p_id);
 return jsonb_build_object('eligible',manifest is not null,'manifest',manifest,'released',dm_private.mvp_release_is_current(p_id));
end$$;

-- Operator service only. Copy current reviewed bank rows in one transaction.
-- Publication is still a separate administrator decision against the frozen hash.
create or replace function public.prepare_mvp_paper(p_plan jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare
 packet text:=p_plan->>'packetSha256';source_sha text:=p_plan->>'sourceSha256';
 exam_name text:=p_plan->>'exam';paper_title text:=p_plan->>'title';
 selection jsonb:=p_plan->'questions';figures jsonb:=p_plan->'media';
 duration integer;expected_count integer;request_sha text;prepared dm_private.mvp_prepared_papers;
 paper_id uuid;question_id uuid;manifest jsonb;item record;created boolean;
begin
 if auth.role() is distinct from 'service_role' then
  raise exception 'Paper preparation requires a server credential' using errcode='42501';
 end if;
 if jsonb_typeof(p_plan) is distinct from 'object' or octet_length(p_plan::text)>4194304
  or packet is null or packet!~'^[a-f0-9]{64}$' or source_sha is null or source_sha!~'^[a-f0-9]{64}$'
  or exam_name is null or exam_name not in('uceed','ceed')
  or paper_title is null or char_length(btrim(paper_title)) not between 2 and 180
  or paper_title!~*'part[[:space:]]+a'
  or jsonb_typeof(selection) is distinct from 'array' or jsonb_typeof(figures) is distinct from 'array' then
  raise exception 'A complete reviewed Part A packet is required' using errcode='22023';
 end if;
 duration:=case when exam_name='uceed' then 7200 else 3600 end;
 expected_count:=case when exam_name='uceed' then 57 else 44 end;
 if p_plan->'durationSeconds' is distinct from to_jsonb(duration) or jsonb_array_length(selection)<>expected_count
  or (select count(distinct q->>'externalKey') from jsonb_array_elements(selection) q)<>expected_count then
  raise exception 'The reviewed Part A counts, order and clock are required' using errcode='22023';
 end if;

 perform 1 from public.launch_settings where singleton and not sales_enabled for share;
 if not found then raise exception 'Close sales before preparing a paper';end if;
 perform 1 from dm_private.registration_policy where id and mode<>'open' for share;
 if not found then raise exception 'Close public registration before preparing a paper';end if;
 perform 1 from dm_private.mvp_test_checkout_control where singleton and not enabled for share;
 if not found or not dm_private.mvp_profile_permissions_valid() then
  raise exception 'The closed paid MVP profile is required';
 end if;

 request_sha:=encode(sha256(convert_to(p_plan::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('mvp-prepared-paper:'||packet,0));
 select * into prepared from dm_private.mvp_prepared_papers where packet_sha256=packet;
 created:=not found;
 if not created then
  if prepared.request_sha256<>request_sha then raise exception 'The reviewed packet identity has changed';end if;
  paper_id:=prepared.paper_id;
  perform dm_private.mvp_lock_paper(paper_id);
  if exists(select 1 from dm_private.papers p where p.id=paper_id and p.published) then
   raise exception 'The prepared paper already has a release decision';
  end if;
 end if;

 perform 1 from dm_private.bank_questions b where b.external_key in (
  select q->>'externalKey' from jsonb_array_elements(selection) q
 ) order by b.external_key for share;
 if exists(
  select 1 from jsonb_array_elements(selection) q where not exists(
   select 1 from dm_private.bank_questions b join dm_private.bank_import_run_items i
     on i.external_key=b.external_key and i.content_sha256=b.content_sha256
   join dm_private.bank_import_runs r on r.id=i.run_id and r.source_commit=b.source_commit
   where b.external_key=q->>'externalKey' and b.content_sha256=q->>'contentSha256'
    and b.licence=q->>'licence' and b.exam=exam_name and b.payload=q->'payload'
    and b.runtime_payload=q->'runtime' and b.runtime_payload->'key'->>'sourceExternalKey'=b.external_key
    and b.active and b.owner_approved and b.rights_confirmed and b.objective_ready and b.payload->'holds'='[]'::jsonb
    and r.status='completed' and r.imported_count=r.eligible_total and r.source_sha256=source_sha
    and r.schema_version=1 and r.source_path='server/data/exports/dexam-bank-export.json'
  )
 ) then raise exception 'Current reviewed canonical bank versions are required';end if;
 if not exists(select 1 from storage.buckets where id='paper-media' and not public)
  or (select count(distinct m->>'sha256') from jsonb_array_elements(figures) m)<>jsonb_array_length(figures)
  or exists(
   select 1 from jsonb_array_elements(figures) m where not exists(
    select 1 from dm_private.bank_media_assets a join storage.objects o on o.bucket_id='paper-media' and o.name=a.storage_path
    where a.storage_path=m->>'path' and a.sha256=m->>'sha256' and a.width::text=m->>'width' and a.height::text=m->>'height'
     and a.byte_size::text=m->>'byteSize' and o.metadata->>'size'=m->>'byteSize' and o.metadata->>'mimetype'='image/png'
   )
  ) or exists(
   select 1 from jsonb_array_elements(selection) q cross join lateral jsonb_array_elements(q->'runtime'->'media') m
   where not exists(select 1 from jsonb_array_elements(figures) f where f->>'sha256'=m->>'sha256' and f->>'path'=m->>'path')
  ) then raise exception 'Verified private paper figures are required';end if;

 if created then
  insert into dm_private.papers(title,exam,duration_seconds) values(paper_title,exam_name,duration) returning id into paper_id;
  for item in
   select q.ordinal,b.runtime_payload as runtime from jsonb_array_elements(selection) with ordinality q(value,ordinal)
   join dm_private.bank_questions b on b.external_key=q.value->>'externalKey' order by q.ordinal
  loop
   insert into dm_private.questions(paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
   values(paper_id,item.ordinal,item.runtime->>'prompt',item.runtime->'options',item.runtime->>'kind',item.runtime->'marking',
    item.runtime->'media',(item.runtime->>'points')::numeric,(item.runtime->>'negativePoints')::numeric,item.runtime->>'topic',true)
   returning id into question_id;
   insert into dm_private.answer_keys(question_id,key,explanation)
   values(question_id,item.runtime->'key',item.runtime->>'explanation');
  end loop;
 end if;
 manifest:=dm_private.mvp_paper_manifest(paper_id);
 if manifest is null or dm_private.paper_quality_held(paper_id) then
  raise exception 'The paper no longer matches the reviewed Part A manifest';
 end if;
 if created then
  insert into dm_private.mvp_prepared_papers(packet_sha256,request_sha256,paper_id,manifest_sha256)
  values(packet,request_sha,paper_id,manifest->>'sha256');
 end if;
 return jsonb_build_object('paperId',paper_id,'packetSha256',packet,'manifestSha256',manifest->>'sha256',
  'created',created,'questionCount',manifest->'questionCount','durationSeconds',duration,'totalPoints',manifest->'totalPoints');
end$$;
revoke all on function public.prepare_mvp_paper(jsonb) from public,anon,authenticated;
grant execute on function public.prepare_mvp_paper(jsonb) to service_role;

-- Lock the actor before target rows. Verify current membership after any
-- target waits so a role revocation can finish before a queued decision.
create or replace function dm_private.require_mvp_operator_identity()returns uuid
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid := auth.uid();
begin
 if not public.is_dmocks_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 perform 1 from auth.users where id=actor for key share;
 if not found then raise exception 'Admin access required' using errcode='42501';end if;
 return actor;
end$$;

create or replace function public.admin_release_mvp_paper(p_id uuid,p_expected_sha256 text,p_rights_reference text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare manifest jsonb;actor uuid := dm_private.require_mvp_operator_identity();
begin
 if p_expected_sha256 is null or p_expected_sha256!~'^[a-f0-9]{64}$'or char_length(btrim(coalesce(p_rights_reference,'')))not between 8 and 2000 then raise exception 'Exact manifest and rights reference required';end if;
 perform 1 from dm_private.papers where id=p_id for update;perform dm_private.mvp_lock_paper(p_id);
 perform dm_private.lock_support_staff();
 manifest:=dm_private.mvp_paper_manifest(p_id);
 if manifest is null or manifest->>'sha256'<>p_expected_sha256 or dm_private.paper_quality_held(p_id)then raise exception 'Paper review is incomplete or has changed';end if;
 insert into dm_private.mvp_paid_releases(paper_id,manifest_sha256,manifest,rights_reference,actor_id)
 values(p_id,p_expected_sha256,manifest,btrim(p_rights_reference),actor)on conflict(paper_id)do update
 set manifest_sha256=excluded.manifest_sha256,manifest=excluded.manifest,rights_reference=excluded.rights_reference,actor_id=excluded.actor_id,approved_at=clock_timestamp(),withdrawn_at=null;
 update dm_private.papers set published=true,reviewed=true,rights_confirmed=true where id=p_id;
 insert into dm_private.mvp_release_audit(paper_id,manifest_sha256,action,evidence,actor_id)values(p_id,p_expected_sha256,'release',btrim(p_rights_reference),actor);
 perform dm_private.lock_support_staff();
 return manifest;
end$$;

create or replace function public.admin_withdraw_mvp_paper(p_id uuid,p_expected_sha256 text,p_note text)returns void
language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare actor uuid := dm_private.require_mvp_operator_identity();
begin
 if char_length(btrim(coalesce(p_note,'')))not between 8 and 2000 then raise exception 'Withdrawal evidence required';end if;
 perform 1 from dm_private.papers where id=p_id for update;
 perform 1 from dm_private.mvp_paid_releases where paper_id=p_id for update;
 perform dm_private.lock_support_staff();
 update dm_private.mvp_paid_releases set withdrawn_at=coalesce(withdrawn_at,clock_timestamp())where paper_id=p_id and manifest_sha256=p_expected_sha256;
 if not found then raise exception 'The release decision has changed';end if;
 insert into dm_private.mvp_release_audit(paper_id,manifest_sha256,action,evidence,actor_id)values(p_id,p_expected_sha256,'withdraw',btrim(p_note),actor);
 perform dm_private.lock_support_staff();
end$$;

create or replace function dm_private.mvp_profile_permissions_valid()returns boolean
language sql volatile security definer set search_path=pg_catalog,dm_private as $$
 select not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.prokind='f'
  and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
  and((has_function_privilege('anon',p.oid,'EXECUTE') is distinct from (p.oid='public.free_year_paper_catalog()'::regprocedure))
   or has_function_privilege('authenticated',p.oid,'EXECUTE')is distinct from exists(select 1 from dm_private.mvp_rpc_allowlist a where to_regprocedure(a.signature)=p.oid)))
 and not exists(select 1 from dm_private.mvp_rpc_allowlist where to_regprocedure(signature)is null)
$$;

-- Checkout takes settings, Test control (when applicable), then current gate
-- rows in a fixed order. Gate review writes take only their own gate row.
create or replace function dm_private.mvp_lock_checkout_gates(p_test boolean)returns void
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
 if p_test then perform 1 from dm_private.registration_policy where id for share;end if;
 perform 1 from dm_private.launch_gate_attestations
  where gate<>'drawing_operations' and (not p_test or gate in('content_rights','privacy_terms','refund_policy','child_safety'))
  order by gate for share;
end$$;

create or replace function dm_private.mvp_live_gates_approved()returns boolean
language sql volatile security definer set search_path=pg_catalog,dm_private as $$
 select count(*)=7 from dm_private.launch_gate_attestations
 where gate<>'drawing_operations' and approved and char_length(btrim(evidence))>=8
$$;

create or replace function public.admin_set_launch_gate(p_gate text,p_approved boolean,p_evidence text)returns void
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare actor uuid := dm_private.require_mvp_operator_identity();note text := nullif(btrim(p_evidence),'');
begin
 if p_approved is null or (p_approved and coalesce(char_length(note),0)<8) then
  raise exception 'Evidence note is required' using errcode='22023';
 end if;
 perform 1 from dm_private.launch_gate_attestations where gate=p_gate for update;
 perform dm_private.lock_support_staff();
 update dm_private.launch_gate_attestations set approved=p_approved,evidence=note,actor_id=actor,
  updated_at=clock_timestamp() where gate=p_gate;
 if not found then raise exception 'Unknown launch gate' using errcode='22023';end if;
 insert into dm_private.launch_gate_audit(gate,approved,evidence,actor_id)values(p_gate,p_approved,note,actor);
 perform dm_private.lock_support_staff();
end$$;

create or replace function dm_private.mvp_test_checkout_setup_ready()returns boolean
language sql volatile security definer set search_path=pg_catalog,public,dm_private as $$
 select exists(select 1 from public.launch_settings where singleton and environment_mode='test'and not sales_enabled and policy_version is not null)
 and exists(select 1 from dm_private.registration_policy where id and mode='testers')
 and(select count(*)from dm_private.launch_gate_attestations where gate in('content_rights','privacy_terms','refund_policy','child_safety')
   and approved and char_length(btrim(evidence))>=8)=4
 and dm_private.mvp_profile_permissions_valid()
 and exists(select 1 from dm_private.mvp_paid_releases r where dm_private.mvp_release_is_current(r.paper_id)and not dm_private.paper_quality_held(r.paper_id))
$$;

create or replace function dm_private.mvp_test_checkout_allowed()returns boolean
language sql volatile security definer set search_path=pg_catalog,public,dm_private as $$
 select dm_private.mvp_test_checkout_setup_ready()and public.can_enter_staging_portal()
 and exists(select 1 from dm_private.mvp_test_checkout_control where singleton and enabled and expires_at>clock_timestamp())
$$;

create or replace function public.admin_set_mvp_test_checkout(p_enabled boolean,p_expires_at timestamptz,p_evidence text)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare stamp timestamptz;actor uuid := dm_private.require_mvp_operator_identity();
begin
 if p_enabled is null or char_length(btrim(coalesce(p_evidence,'')))not between 8 and 2000 then raise exception 'Reviewed Test acceptance evidence required';end if;
 perform 1 from public.launch_settings where singleton for share;
 perform 1 from dm_private.mvp_test_checkout_control where singleton for update;
 if p_enabled then perform dm_private.mvp_lock_checkout_gates(true);end if;
 perform dm_private.lock_support_staff();
 stamp:=clock_timestamp();
 if p_enabled then
  if p_expires_at is null or p_expires_at<=stamp or p_expires_at>stamp+interval'8 hours'then raise exception 'Test acceptance must expire within eight hours';end if;
  if not dm_private.mvp_test_checkout_setup_ready()then raise exception 'Complete controlled Test setup and policy/content reviews first';end if;
 end if;
 update dm_private.mvp_test_checkout_control set enabled=p_enabled,expires_at=case when p_enabled then p_expires_at else null end,
 evidence=btrim(p_evidence),actor_id=actor,updated_at=stamp where singleton;
 insert into dm_private.mvp_test_checkout_audit(enabled,expires_at,evidence,actor_id)values(p_enabled,case when p_enabled then p_expires_at else null end,btrim(p_evidence),actor);
 perform dm_private.lock_support_staff();
 return jsonb_build_object('enabled',p_enabled,'expiresAt',case when p_enabled then p_expires_at else null end);
end$$;

-- Generated permission manifest and entry-point replacements follow. Keep this
-- profile last in the reviewed deployment transaction; CI exercises it separately
-- from historical post-launch schema regressions.

-- BEGIN RPC MANIFEST
delete from dm_private.mvp_rpc_allowlist;
insert into dm_private.mvp_rpc_allowlist(signature,category)values
 ('public.accept_current_terms(text)','student'),
 ('public.admin_bank_question(text,text)','staff'),
 ('public.admin_bank_review_media_paths(text,text)','staff'),
 ('public.admin_bind_nid_question(text,text,uuid,integer,text,integer,text,uuid)','staff'),
 ('public.admin_bug_report_page(jsonb,integer)','staff'),
 ('public.admin_launch_readiness()','staff'),
 ('public.admin_mvp_paper_manifest(uuid)','staff'),
 ('public.admin_nid_practice_blueprint(uuid,integer,uuid)','staff'),
 ('public.admin_nid_practice_blueprints(integer,integer)','staff'),
 ('public.admin_nid_question_binding(text,text,uuid)','staff'),
 ('public.admin_operational_health()','staff'),
 ('public.admin_privacy_request_page(jsonb,integer)','staff'),
 ('public.admin_release_mvp_paper(uuid,text,text)','staff'),
 ('public.admin_reply_bug_report(uuid,integer,text,text,uuid)','staff'),
 ('public.admin_reported_question(text,bigint)','staff'),
 ('public.admin_reported_question_media_paths(text,bigint)','staff'),
 ('public.admin_reported_questions()','staff'),
 ('public.admin_resolve_privacy_request(uuid,integer,text,text)','staff'),
 ('public.admin_resolve_reported_question(text,text,text,bigint,text)','staff'),
 ('public.admin_review_bank_question(text,boolean,boolean,text,text)','staff'),
 ('public.admin_review_nid_practice_blueprint(uuid,integer,text,text,text,uuid)','staff'),
 ('public.admin_save_nid_practice_blueprint(uuid,integer,jsonb,uuid)','staff'),
 ('public.admin_search_bank_questions(text,text,text,text,text,integer,integer)','staff'),
 ('public.admin_set_launch_gate(text,boolean,text)','staff'),
 ('public.admin_set_mvp_test_checkout(boolean,timestamp with time zone,text)','staff'),
 ('public.admin_withdraw_mvp_paper(uuid,text,text)','staff'),
 ('public.available_papers()','student'),
 ('public.can_enter_staging_portal()','student'),
 ('public.cancel_my_privacy_request(uuid)','student'),
 ('public.export_my_account_data()','student'),
 ('public.finalize_my_expired_attempts()','student'),
 ('public.free_year_paper_catalog()','student'),
 ('public.is_dmocks_admin()','staff'),
 ('public.my_attempt_history()','student'),
 ('public.my_bug_report_page(jsonb,integer)','student'),
 ('public.my_candidate_profile()','student'),
 ('public.my_overview_analytics()','student'),
 ('public.my_pass()','student'),
 ('public.my_privacy_requests()','student'),
 ('public.my_purchase_page(timestamp with time zone,uuid)','student'),
 ('public.my_year_paper_attempts()','student'),
 ('public.prepare_order()','student'),
 ('public.read_attempt(uuid)','student'),
 ('public.report_attempt_question(uuid,uuid,text,text)','student'),
 ('public.request_account_deletion()','student'),
 ('public.save_answer_revision(uuid,uuid,jsonb,bigint)','student'),
 ('public.save_candidate_profile(text,text,integer,text,text[])','student'),
 ('public.start_attempt(uuid)','student'),
 ('public.start_free_year_paper(uuid)','student'),
 ('public.submit_attempt(uuid)','student'),
 ('public.submit_bug_report(text,text,text,uuid)','student'),
 ('public.submit_bug_report(text,text,text,uuid,uuid)','student');
-- END RPC MANIFEST

create or replace function public.accept_current_terms(p_version text)returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid:=auth.uid();active_version text;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501';end if;
 perform 1 from auth.users where id=actor for key share;
 if not found then raise exception 'Sign in required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 -- Read the policy after waiting on the profile, then hold it through the write.
 perform 1 from public.profiles where user_id=actor for no key update;
 select policy_version into active_version from public.launch_settings where singleton for share;
 if active_version is null or p_version is distinct from active_version then
  raise exception 'Published terms are not ready' using errcode='22023';
 end if;
 insert into public.profiles(user_id,terms_version,accepted_at)values(actor,active_version,clock_timestamp())
 on conflict(user_id)do update set terms_version=excluded.terms_version,accepted_at=excluded.accepted_at;
end$$;

create or replace function public.prepare_order()returns jsonb language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare settings public.launch_settings;plan public.plans;existing dm_private.orders;
begin
 if auth.uid()is null then raise exception 'Sign in required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select *into settings from public.launch_settings where singleton for share;
 if settings.policy_version is null then raise exception 'Paid access is not open';end if;
 if settings.sales_enabled then
  perform dm_private.mvp_lock_checkout_gates(false);
  if settings.environment_mode<>'live' or exists(select 1 from dm_private.mvp_test_checkout_control where enabled)
   or not dm_private.mvp_live_gates_approved() then raise exception 'Paid access is not open';end if;
 else
  perform 1 from dm_private.mvp_test_checkout_control where singleton for share;
  perform dm_private.mvp_lock_checkout_gates(true);
  if not dm_private.mvp_test_checkout_allowed() then raise exception 'Paid access is not open';end if;
 end if;
 if not dm_private.mvp_profile_permissions_valid()or not exists(select 1 from dm_private.mvp_paid_releases r where dm_private.mvp_release_is_current(r.paper_id)and not dm_private.paper_quality_held(r.paper_id))then raise exception 'The paid catalogue is not ready';end if;
 if not exists(select 1 from public.profiles where user_id=auth.uid()and terms_version=settings.policy_version and accepted_at is not null)then raise exception 'Accept current terms first';end if;
 if exists(select 1 from dm_private.passes where user_id=auth.uid()and mode=settings.environment_mode and revoked_at is null and expires_at>clock_timestamp())then raise exception 'Your annual pass is already active';end if;
 if exists(select 1 from dm_private.orders where user_id=auth.uid()and mode=settings.environment_mode and payment_review_required)then raise exception 'This payment needs team review before another checkout';end if;
 select *into plan from public.plans where id='annual';
 select *into existing from dm_private.orders where user_id=auth.uid()and status='pending'and mode=settings.environment_mode order by created_at desc limit 1;
 if existing.id is null then
  insert into dm_private.orders(user_id,plan_id,amount,currency,mode)values(auth.uid(),plan.id,plan.amount,plan.currency,settings.environment_mode)returning *into existing;
 end if;
 if existing.payment_review_required then raise exception 'This payment needs team review before another checkout';end if;
 return jsonb_build_object('id',existing.id,'amount',existing.amount,'currency',existing.currency,'mode',existing.mode,'providerOrderId',existing.provider_order_id);
end$$;

create or replace function public.start_attempt(p_paper_id uuid)returns uuid language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare p dm_private.papers;attempt_id uuid;settings_mode text;stamp timestamptz;
begin
 if auth.uid()is null then raise exception 'Sign in required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if not dm_private.mvp_profile_permissions_valid()then raise exception 'MVP API release controls require review';end if;
 perform dm_private.mvp_lock_paper(p_paper_id);
 if not dm_private.mvp_release_is_current(p_paper_id)then raise exception 'Paper is not released';end if;
 select environment_mode into settings_mode from public.launch_settings where singleton;
 if not exists(select 1 from dm_private.passes where user_id=auth.uid()and mode=settings_mode and revoked_at is null and expires_at>clock_timestamp())then raise exception 'An active pass is required';end if;
 select *into p from dm_private.papers where id=p_paper_id and published and reviewed and rights_confirmed;
 if p.id is null then raise exception 'Paper is not released';end if;
 if not exists(select 1 from dm_private.questions where paper_id=p.id)or exists(select 1 from dm_private.questions q left join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=p.id and(not q.reviewed or k.question_id is null or(q.kind in('mcq','msq')and jsonb_array_length(q.options)<2)))then raise exception 'Paper review is incomplete';end if;
 select id into attempt_id from dm_private.attempts where user_id=auth.uid()and paper_id=p.id and status='active'and deadline>clock_timestamp()order by started_at desc limit 1;
 if attempt_id is not null then return attempt_id;end if;
 stamp:=clock_timestamp();
 insert into dm_private.attempts(user_id,paper_id,started_at,deadline)values(auth.uid(),p.id,stamp,stamp+make_interval(secs=>p.duration_seconds))returning id into attempt_id;
 insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,points,negative_points,topic,kind,marking,media,key,explanation)
 select attempt_id,q.id,q.ordinal,q.prompt,q.options,q.points,q.negative_points,q.topic,q.kind,q.marking,q.media,k.key,k.explanation
 from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id=p.id;
 return attempt_id;
end$$;

create or replace function public.available_papers()returns jsonb language sql volatile security definer set search_path=pg_catalog,dm_private as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'exam',p.exam,'durationSeconds',p.duration_seconds,'qualityHeld',dm_private.paper_quality_held(p.id))order by p.title,p.id),'[]')
 from dm_private.papers p where auth.uid()is not null and dm_private.mvp_release_is_current(p.id)
$$;

create or replace function public.my_pass()returns jsonb language sql volatile security definer set search_path=pg_catalog,public,dm_private as $$
 select jsonb_build_object('active',coalesce(p.revoked_at is null and p.expires_at>clock_timestamp()and p.mode=s.environment_mode,false),
 'expiresAt',p.expires_at,'revoked',p.revoked_at is not null,'mode',s.environment_mode)
 from public.launch_settings s left join dm_private.passes p on p.user_id=auth.uid()where s.singleton
$$;

create or replace function public.admin_launch_readiness()returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public,dm_private as $$
declare v_sales boolean;v_policy text;v_mode text;v_offering boolean;v_gates jsonb;v_all boolean;v_permissions boolean;v_test dm_private.mvp_test_checkout_control;
begin
 if not public.is_dmocks_admin()then raise exception 'Admin access required';end if;
 select sales_enabled,policy_version,environment_mode into v_sales,v_policy,v_mode from public.launch_settings where singleton;
 select *into v_test from dm_private.mvp_test_checkout_control where singleton;
 select coalesce(bool_and(approved and coalesce(char_length(btrim(evidence)),0)>=8),false)and count(*)=7,
 jsonb_agg(jsonb_build_object('gate',gate,'approved',approved,'evidence',evidence,'updatedAt',updated_at)order by gate)
 into v_all,v_gates from dm_private.launch_gate_attestations where gate<>'drawing_operations';
 select exists(select 1 from dm_private.mvp_paid_releases r where dm_private.mvp_release_is_current(r.paper_id)and not dm_private.paper_quality_held(r.paper_id))into v_offering;
 v_permissions:=dm_private.mvp_profile_permissions_valid();
 return jsonb_build_object('scope','paid-mvp-v1','salesEnabled',v_sales,'environmentMode',v_mode,'testCheckoutEnabled',v_test.enabled,'testCheckoutExpiresAt',v_test.expires_at,
 'policyPublished',v_policy is not null,'paperBlueprintReady',v_offering,'offeringReady',v_offering,
 'apiProfileReady',v_permissions,'allAttestationsApproved',v_all,'readyForSales',v_mode='live'and not v_test.enabled and v_policy is not null and v_offering and v_permissions and v_all,'gates',v_gates);
end$$;

create or replace function dm_private.guard_sales_activation()returns trigger
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
begin
 if new.sales_enabled and not old.sales_enabled then
  if new.environment_mode<>'live'then raise exception 'Use controlled merchant Test acceptance while live sales stay closed';end if;
  if exists(select 1 from dm_private.mvp_test_checkout_control where enabled)then raise exception 'Close merchant Test acceptance before enabling live sales';end if;
  if new.policy_version is null then raise exception 'Cannot enable sales without a published policy version';end if;
  if not dm_private.mvp_profile_permissions_valid()then raise exception 'MVP API release controls require review';end if;
  perform dm_private.mvp_lock_checkout_gates(false);
  if not dm_private.mvp_live_gates_approved() then raise exception 'Cannot enable sales while MVP launch gates are open';end if;
  if not exists(select 1 from dm_private.mvp_paid_releases r where dm_private.mvp_release_is_current(r.paper_id)and not dm_private.paper_quality_held(r.paper_id))then raise exception 'Cannot enable sales without an approved paid offering';end if;
 end if;return new;
end$$;

create or replace function public.admin_operational_health()returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public,dm_private as $$
declare
 stamp timestamptz := clock_timestamp();
 profile_ready boolean;
 payment_mode text;
 stale integer;
 expired integer;
 pending integer;
 reviews integer;
 bugs integer;
 questions integer;
 unverified integer;
begin
 if auth.role() is distinct from 'service_role' and not public.is_dmocks_admin() then
  raise exception 'Admin access required';
 end if;
 select environment_mode into payment_mode from public.launch_settings where singleton;
 if payment_mode is null then
  raise exception 'Payment mode unavailable' using errcode = '55000';
 end if;
 profile_ready := dm_private.mvp_profile_permissions_valid();
 select count(*) filter (where deadline < stamp - interval '5 minutes'), count(*) filter (where deadline < stamp)
   into stale, expired from dm_private.attempts where status = 'active';
 select count(*) filter (where status = 'pending' and created_at < stamp - interval '30 minutes'),
   count(*) filter (where payment_review_required)
   into pending, reviews from dm_private.orders where mode = payment_mode;
 select count(*) into bugs from dm_private.bug_reports where status in ('open','investigating');
 select count(*) into questions from dm_private.reported_question_queue where status = 'pending';
 -- Historic capture receipts predate request hashes and the granted outcome.
 -- Their migrated order and payment binding remains sufficient for this check.
 select count(*) into unverified from dm_private.passes p
 where p.mode = payment_mode and p.revoked_at is null and p.expires_at > stamp
   and not exists (
     select 1 from dm_private.orders o join dm_private.payment_events e on e.order_id = o.id
     where o.id = p.order_id and o.user_id = p.user_id and o.mode = p.mode and o.status = 'paid'
       and o.provider_order_id is not null and o.paid_at is not null and o.refunded_amount < o.amount
       and e.payment_id = o.payment_id and e.event_type = 'payment.captured'
       and ((e.outcome = 'granted' and e.request_hash is not null)
         or (e.outcome = 'received' and e.request_hash is null))
   );
 return jsonb_build_object(
   'scope','paid-mvp-v1', 'monitorVersion',1, 'apiProfileReady',profile_ready, 'checkedAt',stamp,
   'paymentMode',payment_mode,
   'status',case when not profile_ready or unverified > 0 or stale > 0 or pending > 0 or reviews > 0 then 'degraded'
     when bugs > 0 or questions > 0 then 'attention' else 'healthy' end,
   'staleAttempts',stale, 'expiredAttempts',expired, 'stalePendingOrders',pending, 'paymentReviews',reviews,
   'openBugs',bugs, 'pendingQuestionReports',questions, 'unverifiedPasses',unverified
 );
end$$;

-- Deny every application RPC by default. Auth hooks retain their explicit
-- supabase_auth_admin grants; service-only workers retain their explicit grants.
-- Extension functions are not application RPCs and are left unchanged.
do $$declare f record;a record;begin
 for f in select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.prokind='f'
  and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')loop
  execute 'revoke all on function '||f.signature||' from public,anon,authenticated';
 end loop;
 for a in select signature from dm_private.mvp_rpc_allowlist loop
  if to_regprocedure(a.signature)is null then raise exception 'MVP RPC manifest does not match this schema';end if;
  execute 'grant execute on function '||a.signature||' to authenticated';
 end loop;
 grant execute on function public.free_year_paper_catalog() to anon;
end$$;
revoke all on function dm_private.mvp_lock_paper(uuid),dm_private.mvp_paper_manifest(uuid),dm_private.mvp_release_is_current(uuid),dm_private.mvp_profile_permissions_valid(),dm_private.mvp_test_checkout_setup_ready(),dm_private.mvp_test_checkout_allowed()from public,anon,authenticated,service_role;
revoke all on function dm_private.require_mvp_operator_identity(),dm_private.mvp_lock_checkout_gates(boolean),dm_private.mvp_live_gates_approved()
 from public,anon,authenticated,service_role;
do $$begin
 if not dm_private.mvp_profile_permissions_valid()then raise exception 'MVP RPC permissions failed verification';end if;
end$$;
notify pgrst,'reload schema';
