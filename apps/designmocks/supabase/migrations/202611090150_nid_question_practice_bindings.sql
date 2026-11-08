-- Private, human-bound authored practice. Never an official NID rule or a paper
-- release. Existing fixed UCEED/CEED/NIFT contexts are unchanged.
create table dm_private.nid_question_bindings (
 id uuid primary key, external_key text not null references dm_private.bank_questions(external_key),
 content_sha256 text not null, source_version text not null,
 blueprint_id uuid not null, blueprint_revision integer not null, blueprint_sha256 text not null,
 section_ordinal integer not null check(section_ordinal between 1 and 8),
 note text not null check(char_length(btrim(note))between 20 and 2000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 foreign key(blueprint_id,blueprint_revision)references dm_private.nid_practice_blueprint_versions(blueprint_id,revision)
);
create table dm_private.nid_question_binding_heads (
 external_key text primary key references dm_private.bank_questions(external_key),binding_id uuid not null unique references dm_private.nid_question_bindings(id)
);
create table dm_private.nid_question_binding_requests (
 request_id uuid primary key,actor_id uuid not null references auth.users(id),external_key text not null,
 request_sha256 text not null,result jsonb not null,created_at timestamptz not null default clock_timestamp()
);
alter table dm_private.nid_question_bindings enable row level security;
alter table dm_private.nid_question_binding_heads enable row level security;
alter table dm_private.nid_question_binding_requests enable row level security;
revoke all on dm_private.nid_question_bindings,dm_private.nid_question_binding_heads,dm_private.nid_question_binding_requests from public,anon,authenticated,service_role;

create function dm_private.nid_source_version(q dm_private.bank_questions)returns text
language sql immutable set search_path=pg_catalog as $$
 select encode(sha256(convert_to(jsonb_build_object('key',q.external_key,'sha256',q.content_sha256,'payload',q.payload,
 'exam',q.exam,'type',q.question_type,'topic',q.topic,'licence',q.licence)::text,'UTF8')),'hex')
$$;
create function dm_private.nid_binding_state(q dm_private.bank_questions)returns jsonb
language sql stable set search_path=pg_catalog,dm_private as $$
 select jsonb_build_object('id',x.id,'externalKey',x.external_key,'contentSha256',x.content_sha256,'sourceVersion',x.source_version,
 'sectionOrdinal',x.section_ordinal,'note',x.note,'createdAt',x.created_at,
 'current',q.exam='nid'and q.active and q.payload->'holds'='[]'::jsonb
  and not exists(select 1 from dm_private.bank_local_holds where external_key=q.external_key)
  and q.content_sha256=x.content_sha256 and dm_private.nid_source_version(q)=x.source_version
  and b.current_revision=x.blueprint_revision and v.status='reviewed'and v.content_sha256=x.blueprint_sha256,
 'blueprint',jsonb_build_object('id',b.id,'revision',v.revision,'currentRevision',b.current_revision,'sha256',v.content_sha256,'status',v.status,'payload',v.payload))
 from dm_private.nid_question_binding_heads h join dm_private.nid_question_bindings x on x.id=h.binding_id
 join dm_private.nid_practice_blueprints b on b.id=x.blueprint_id
 join dm_private.nid_practice_blueprint_versions v on v.blueprint_id=x.blueprint_id and v.revision=x.blueprint_revision
 where h.external_key=q.external_key
$$;
create function dm_private.nid_trim(value text)returns text language sql immutable set search_path=pg_catalog as $$
 select regexp_replace(value,'^[[:space:]]+|[[:space:]]+$','','g')
$$;
create function dm_private.nid_answer_key(kind text,raw text,options jsonb)returns jsonb
language plpgsql immutable set search_path=pg_catalog,dm_private as $$
declare number_pattern text:='[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)';parts text[];chosen text[];ids text[];accepted jsonb:='[]';piece text;
begin
 if raw is null or raw=''then return null;end if;
 if kind='nat'then
  if char_length(raw)>200 then return null;end if;
  if raw~('^'||number_pattern||'$')then return jsonb_build_object('kind','nat','accepted',jsonb_build_array(jsonb_build_object('exact',raw)));end if;
  parts:=regexp_match(raw,'^('||number_pattern||')[[:space:]]*(?:to|–|-)[[:space:]]*('||number_pattern||')$','i');
  if parts is not null then
   if parts[1]::numeric>parts[2]::numeric then return null;end if;
   return jsonb_build_object('kind','nat','accepted',jsonb_build_array(jsonb_build_object('range',to_jsonb(parts))));
  end if;
  parts:=regexp_split_to_array(raw,'[[:space:]]+or[[:space:]]+','i');
  if cardinality(parts)<2 or(select count(distinct p)from unnest(parts)p)<>cardinality(parts)then return null;end if;
  foreach piece in array parts loop
   if piece!~('^'||number_pattern||'$')then return null;end if;
   accepted:=accepted||jsonb_build_array(jsonb_build_object('exact',piece));
  end loop;
  return jsonb_build_object('kind','nat','accepted',accepted);
 end if;
 select array_agg(o->>'id'order by n)into ids from jsonb_array_elements(options)with ordinality a(o,n);
 if kind='mcq'then
  if not raw=any(ids)then return null;end if;
  return jsonb_build_object('kind','mcq','correct',jsonb_build_array(raw));
 elsif kind='msq'then
  if raw=any(ids)then chosen:=array[raw];
  elsif raw~'^[A-Za-z]+$'and not exists(select 1 from unnest(ids)i where i!~'^[A-Za-z]$')then chosen:=regexp_split_to_array(raw,'');
  else chosen:=regexp_split_to_array(raw,'[[:space:],;&/]+');end if;
  if cardinality(chosen)=0 or(select count(distinct i)from unnest(chosen)i)<>cardinality(chosen)
   or exists(select 1 from unnest(chosen)i where not i=any(ids))then return null;end if;
  return jsonb_build_object('kind','msq','correct',(select jsonb_agg(i order by i collate "C")from unnest(chosen)i));
 end if;
 return null;
end$$;

create function dm_private.nid_practice_runtime(q dm_private.bank_questions,binding jsonb)returns jsonb
language plpgsql stable set search_path=pg_catalog,dm_private as $$
declare bp jsonb;section jsonb;kind text;human boolean;media jsonb:='[]';options jsonb:='[]';a jsonb;m dm_private.bank_media_assets;
 key jsonb;context jsonb;raw text;explanation text;ordinal integer:=0;labels text[]:='{}';label text;
begin
 if q.exam<>'nid'or lower(q.payload->'provenance'->>'exam')is distinct from'nid'or not q.active or q.payload->'holds'is distinct from'[]'::jsonb or q.payload->>'externalKey'is distinct from q.external_key
  or q.payload->>'type'is distinct from q.question_type or binding->'current'is distinct from'true'::jsonb
  or binding->>'externalKey'is distinct from q.external_key or exists(select 1 from dm_private.bank_local_holds where external_key=q.external_key)
  or jsonb_typeof(q.payload->'prompt')is distinct from'string'or dm_private.nid_trim(q.payload->>'prompt')=''
  or jsonb_typeof(q.payload->'assets')is distinct from'array'then return null;end if;
 bp:=binding->'blueprint'->'payload';
 if not dm_private.nid_practice_payload_valid(bp)then return null;end if;
 section:=bp->'sections'->((binding->>'sectionOrdinal')::integer-1);kind:=section->>'kind';human:=kind in('drawing','written');
 if kind is null or(human and q.question_type<>'DESCRIPTIVE')or(not human and lower(q.question_type)<>kind)then return null;end if;
 if q.payload?'visualDependency'and jsonb_typeof(q.payload->'visualDependency')not in('boolean','null')then return null;end if;
 if q.payload->'visualDependency'='true'::jsonb and jsonb_array_length(q.payload->'assets')=0 then return null;end if;
 for a in select value from jsonb_array_elements(q.payload->'assets')loop
  select *into m from dm_private.bank_media_assets where sha256=a->>'sha256'and width::text=a->>'width'and height::text=a->>'height'
   and storage_path='papers/canonical/'||(a->>'sha256')||'.png'and byte_size between 45 and 10485760;
  if m.sha256 is null or not exists(select 1 from storage.objects o where o.bucket_id='paper-media'and o.name=m.storage_path
   and o.metadata->>'mimetype'='image/png'and o.metadata->>'size'=m.byte_size::text)then return null;end if;
  ordinal:=ordinal+1;
  media:=media||jsonb_build_array(jsonb_build_object('path',m.storage_path,'alt','Question figure '||ordinal,'sha256',m.sha256,'width',m.width,'height',m.height));
 end loop;
 if human then kind:='drawing';key:=jsonb_build_object('kind','drawing');
 else
  if q.payload->'answer'->>'status'='pending'or jsonb_typeof(q.payload->'answer'->'raw')is distinct from'string'then return null;end if;
  raw:=dm_private.nid_trim(q.payload->'answer'->>'raw');
  if kind in('mcq','msq')then
   if jsonb_typeof(q.payload->'options')is distinct from'array'or jsonb_array_length(q.payload->'options')<2 then return null;end if;
   for a in select value from jsonb_array_elements(q.payload->'options')loop
    label:=a->>'key';
    if jsonb_typeof(a->'key')is distinct from'string'or dm_private.nid_trim(label)=''or label=any(labels)or(a?'asset'and a->'asset'<>'null'::jsonb)
     or(a?'text'and a->'text'<>'null'::jsonb and jsonb_typeof(a->'text')<>'string')then return null;end if;
    labels:=array_append(labels,label);
    if coalesce(dm_private.nid_trim(a->>'text'),'')=''and jsonb_array_length(media)=0 then return null;end if;
    options:=options||jsonb_build_array(jsonb_build_object('id',label,'label',coalesce(nullif(dm_private.nid_trim(a->>'text'),''),label)));
   end loop;
  end if;
  key:=dm_private.nid_answer_key(kind,raw,options);if key is null then return null;end if;
 end if;
 context:=jsonb_build_object('version','nid-authored-practice-v1','exam','nid','scope','authored-practice','blueprintId',binding->'blueprint'->>'id',
 'blueprintRevision',(binding->'blueprint'->>'revision')::integer,'blueprintSha256',binding->'blueprint'->>'sha256','bindingId',binding->>'id',
 'sectionOrdinal',(binding->>'sectionOrdinal')::integer,'sectionLabel',section->>'label','responseKind',section->>'kind',
 'durationSeconds',(bp->>'durationMinutes')::integer*60,'uploadGraceSeconds',(bp->>'uploadGraceMinutes')::integer*60,'rubric',section->'rubric');
 key:=key||jsonb_build_object('sourceExternalKey',q.external_key,'practiceContext',context);
 explanation:=case when jsonb_typeof(q.payload->'explanation')='string'and dm_private.nid_trim(q.payload->>'explanation')<>''then q.payload->>'explanation'
  when human then'Human review against the DMocks-authored practice rubric.'else'Answer key: '||raw end;
 return jsonb_build_object('prompt',q.payload->>'prompt','options',options,'kind',kind,
 'marking',jsonb_build_object('correct',(section->>'points')::numeric,'wrong',-(section->>'penalty')::numeric)||case when human then'{"humanReview":true}'::jsonb else'{}'::jsonb end,
 'media',media,'points',(section->>'points')::numeric,'negativePoints',(section->>'penalty')::numeric,'topic',coalesce(nullif(q.payload->>'topic',''),case when human then'drawing'else'unclassified'end),'key',key,'explanation',explanation,
 'context',context);
exception when invalid_text_representation or invalid_parameter_value or numeric_value_out_of_range then return null;
end$$;

-- A practice binding and the reviewed source context are part of the human
-- decision fence. Stored source versions exclude runtime/review flags so a
-- materialization or approval does not invalidate its own binding.
create or replace function dm_private.bank_review_version(question dm_private.bank_questions)returns text
language sql stable set search_path=pg_catalog,dm_private as $$
 select encode(sha256(convert_to((jsonb_build_object(
 'externalKey',question.external_key,'exam',question.exam,'type',question.question_type,'topic',question.topic,'licence',question.licence,
 'contentSha256',question.content_sha256,'payload',question.payload,'runtime',question.runtime_payload,'active',question.active,
 'approved',question.owner_approved,'rightsConfirmed',question.rights_confirmed,'reviewNote',question.review_note,'reviewedAt',extract(epoch from question.reviewed_at),
 'hold',(select jsonb_build_object('reason',h.reason,'createdAt',extract(epoch from h.created_at))from dm_private.bank_local_holds h where h.external_key=question.external_key))
 ||case when question.exam='nid'then jsonb_build_object('practiceBinding',dm_private.nid_binding_state(question))else'{}'::jsonb end
 )::text,'UTF8')),'hex')
$$;

create function dm_private.invalidate_nid_blueprint_bindings()returns trigger language plpgsql set search_path=pg_catalog,dm_private as $$
declare k text;
begin
 if old.current_revision=new.current_revision then return new;end if;
 for k in select h.external_key from dm_private.nid_question_binding_heads h join dm_private.nid_question_bindings x on x.id=h.binding_id where x.blueprint_id=new.id order by h.external_key loop
  perform pg_advisory_xact_lock(hashtextextended(k,151));
  -- Re-read after the fence: a concurrent rebind may have moved this question.
  if exists(select 1 from dm_private.nid_question_binding_heads h join dm_private.nid_question_bindings x on x.id=h.binding_id where h.external_key=k and x.blueprint_id=new.id)then
   update dm_private.bank_questions set runtime_payload=null,objective_ready=false,owner_approved=false,rights_confirmed=false,reviewed_by=null,reviewed_at=null where external_key=k;
  end if;
 end loop;return new;
end$$;
create trigger nid_blueprint_binding_invalidation after update of current_revision on dm_private.nid_practice_blueprints for each row execute function dm_private.invalidate_nid_blueprint_bindings();

create function dm_private.guard_nid_bank_source()returns trigger language plpgsql set search_path=pg_catalog,dm_private as $$
begin
 if(old.exam='nid'or new.exam='nid')and(new.exam<>'nid'or not new.active or dm_private.nid_source_version(old)is distinct from dm_private.nid_source_version(new))then
  new.runtime_payload:=null;new.objective_ready:=false;new.owner_approved:=false;new.rights_confirmed:=false;new.reviewed_by:=null;new.reviewed_at:=null;
 end if;return new;
end$$;
create trigger nid_bank_source_guard before update on dm_private.bank_questions for each row execute function dm_private.guard_nid_bank_source();

revoke all on function dm_private.nid_source_version(dm_private.bank_questions),dm_private.nid_binding_state(dm_private.bank_questions),dm_private.nid_trim(text),
 dm_private.nid_answer_key(text,text,jsonb),dm_private.nid_practice_runtime(dm_private.bank_questions,jsonb),
 dm_private.invalidate_nid_blueprint_bindings(),dm_private.guard_nid_bank_source()from public,anon,authenticated,service_role;

-- Authorize after the operation's blocking fences. The membership row lock
-- then serializes a final decision against revocation until this transaction ends.
create function dm_private.require_nid_admin()returns void
language plpgsql set search_path=pg_catalog,dm_private as $$
begin
 perform 1 from dm_private.admins where user_id=auth.uid()for key share;
 if not found then raise exception'Admin access required'using errcode='42501';end if;
end$$;
revoke all on function dm_private.require_nid_admin()from public,anon,authenticated,service_role;

create or replace function public.admin_save_nid_practice_blueprint(p_id uuid,p_expected_revision integer,p_payload jsonb,p_request_id uuid)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare b dm_private.nid_practice_blueprints;r dm_private.nid_practice_blueprint_requests;sha text;request_sha text;next_revision integer;result jsonb;
begin
 if not public.is_dmocks_admin()then raise exception'Admin access required'using errcode='42501';end if;
 if p_id is null or p_request_id is null or p_expected_revision is null or p_expected_revision not between 0 and 1000000 or not dm_private.nid_practice_payload_valid(p_payload)
  then raise exception'Invalid authored practice blueprint'using errcode='22023';end if;
 sha:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
 request_sha:=encode(sha256(convert_to(jsonb_build_object('operation','save','id',p_id,'expectedRevision',p_expected_revision,'payload',p_payload)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,149));
 select *into r from dm_private.nid_practice_blueprint_requests where request_id=p_request_id;
 if r.request_id is not null then
  perform dm_private.require_nid_admin();
  if r.actor_id<>auth.uid()or r.request_sha256<>request_sha then raise exception'Blueprint request conflicts with an earlier request'using errcode='40001';end if;
  return r.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,150));
 select *into b from dm_private.nid_practice_blueprints where id=p_id for update;
 if coalesce(b.current_revision,0)<>p_expected_revision then raise exception'Blueprint changed. Open the current revision before saving.'using errcode='40001';end if;
 next_revision:=p_expected_revision+1;
 if b.id is null then insert into dm_private.nid_practice_blueprints(id,current_revision,created_by)values(p_id,next_revision,auth.uid());
 else update dm_private.nid_practice_blueprints set current_revision=next_revision where id=p_id;end if;
 perform dm_private.require_nid_admin();
 insert into dm_private.nid_practice_blueprint_versions(blueprint_id,revision,payload,content_sha256,created_by)values(p_id,next_revision,p_payload,sha,auth.uid());
 result:=jsonb_build_object('id',p_id,'revision',next_revision,'sha256',sha,'status','draft');
 insert into dm_private.nid_practice_blueprint_requests(request_id,actor_id,blueprint_id,operation,request_sha256,result)values(p_request_id,auth.uid(),p_id,'save',request_sha,result);
 return result;
end$$;

create or replace function public.admin_review_nid_practice_blueprint(p_id uuid,p_expected_revision integer,p_expected_sha256 text,p_decision text,p_note text,p_request_id uuid)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare b dm_private.nid_practice_blueprints;v dm_private.nid_practice_blueprint_versions;r dm_private.nid_practice_blueprint_requests;request_sha text;result jsonb;
begin
 if not public.is_dmocks_admin()then raise exception'Admin access required'using errcode='42501';end if;
 if p_id is null or p_request_id is null or p_expected_revision is null or p_expected_sha256 is null or p_expected_sha256!~'^[a-f0-9]{64}$'
  or p_decision is null or p_decision not in('reviewed','rejected')or char_length(btrim(coalesce(p_note,'')))not between 20 and 2000 then raise exception'Exact revision and a review note are required'using errcode='22023';end if;
 request_sha:=encode(sha256(convert_to(jsonb_build_object('operation','review','id',p_id,'revision',p_expected_revision,'sha256',p_expected_sha256,'decision',p_decision,'note',btrim(p_note))::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,149));
 select *into r from dm_private.nid_practice_blueprint_requests where request_id=p_request_id;
 if r.request_id is not null then
  perform dm_private.require_nid_admin();
  if r.actor_id<>auth.uid()or r.request_sha256<>request_sha then raise exception'Blueprint request conflicts with an earlier request'using errcode='40001';end if;
  return r.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,150));
 select *into b from dm_private.nid_practice_blueprints where id=p_id for update;
 select *into v from dm_private.nid_practice_blueprint_versions where blueprint_id=p_id and revision=p_expected_revision for update;
 perform dm_private.require_nid_admin();
 if b.id is null or b.current_revision<>p_expected_revision or v.content_sha256 is distinct from p_expected_sha256 or v.status<>'draft'
  then raise exception'Blueprint changed. Open the current revision before reviewing.'using errcode='40001';end if;
 if not dm_private.nid_practice_payload_valid(v.payload)then raise exception'Invalid authored practice blueprint'using errcode='22023';end if;
 update dm_private.nid_practice_blueprint_versions set status=p_decision,review_note=btrim(p_note),reviewed_by=auth.uid(),reviewed_at=clock_timestamp()where blueprint_id=p_id and revision=p_expected_revision;
 result:=jsonb_build_object('id',p_id,'revision',p_expected_revision,'sha256',p_expected_sha256,'status',p_decision);
 insert into dm_private.nid_practice_blueprint_requests(request_id,actor_id,blueprint_id,operation,request_sha256,result)values(p_request_id,auth.uid(),p_id,'review',request_sha,result);
 return result;
end$$;
create function public.admin_bind_nid_question(p_external_key text,p_expected_version text,p_blueprint_id uuid,p_revision integer,p_blueprint_sha256 text,p_section_ordinal integer,p_note text,p_request_id uuid)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,dm_private as $$
declare q dm_private.bank_questions;b dm_private.nid_practice_blueprints;v dm_private.nid_practice_blueprint_versions;
 old_request dm_private.nid_question_binding_requests;request_sha text;binding jsonb;binding_id uuid:=gen_random_uuid();result jsonb;
begin
 if not public.is_dmocks_admin()then raise exception'Admin access required'using errcode='42501';end if;
 if p_external_key is null or p_expected_version is null or p_blueprint_id is null or p_revision is null or p_revision<1 or p_request_id is null
  or p_blueprint_sha256 is null or p_blueprint_sha256!~'^[a-f0-9]{64}$'or p_section_ordinal is null or p_section_ordinal not between 1 and 8
  or char_length(btrim(coalesce(p_note,'')))not between 20 and 2000 then raise exception'Exact source, reviewed practice revision, section and review note required'using errcode='22023';end if;
 request_sha:=encode(sha256(convert_to(jsonb_build_object('key',p_external_key,'version',p_expected_version,'blueprint',p_blueprint_id,
  'revision',p_revision,'sha256',p_blueprint_sha256,'section',p_section_ordinal,'note',btrim(p_note))::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,152));
 select *into old_request from dm_private.nid_question_binding_requests where request_id=p_request_id;
 if old_request.request_id is not null then
  perform dm_private.require_nid_admin();
  if old_request.actor_id<>auth.uid()or old_request.request_sha256<>request_sha then raise exception'Practice binding request conflicts with an earlier request'using errcode='40001';end if;
  return old_request.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_blueprint_id::text,150));
 select *into b from dm_private.nid_practice_blueprints where id=p_blueprint_id for share;
 select *into v from dm_private.nid_practice_blueprint_versions where blueprint_id=p_blueprint_id and revision=p_revision;
 if b.id is null or b.current_revision<>p_revision or v.status is distinct from'reviewed'or v.content_sha256 is distinct from p_blueprint_sha256
  then raise exception'Practice blueprint changed or is not reviewed'using errcode='40001';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_external_key,151));
 select *into q from dm_private.bank_questions where external_key=p_external_key for update;
 perform dm_private.require_nid_admin();
 if q.external_key is null or dm_private.bank_review_version(q)is distinct from p_expected_version then raise exception'Question changed. Refresh the bank and review it again.'using errcode='40001';end if;
 binding:=jsonb_build_object('id',binding_id,'externalKey',q.external_key,'current',true,'sectionOrdinal',p_section_ordinal,
  'blueprint',jsonb_build_object('id',b.id,'revision',v.revision,'currentRevision',b.current_revision,'sha256',v.content_sha256,'status',v.status,'payload',v.payload));
 if dm_private.nid_practice_runtime(q,binding)is null then raise exception'Question, answer or figures are incomplete for this practice section'using errcode='22023';end if;
 insert into dm_private.nid_question_bindings(id,external_key,content_sha256,source_version,blueprint_id,blueprint_revision,blueprint_sha256,section_ordinal,note,created_by)
  values(binding_id,q.external_key,q.content_sha256,dm_private.nid_source_version(q),b.id,v.revision,v.content_sha256,p_section_ordinal,btrim(p_note),auth.uid());
 insert into dm_private.nid_question_binding_heads(external_key,binding_id)values(q.external_key,binding_id)
  on conflict(external_key)do update set binding_id=excluded.binding_id;
 update dm_private.bank_questions set runtime_payload=null,objective_ready=false,owner_approved=false,rights_confirmed=false,reviewed_by=null,reviewed_at=null where external_key=q.external_key returning *into q;
 result:=jsonb_build_object('externalKey',q.external_key,'bindingId',binding_id,'reviewVersion',dm_private.bank_review_version(q),'status','bound');
 insert into dm_private.nid_question_binding_requests(request_id,actor_id,external_key,request_sha256,result)values(p_request_id,auth.uid(),q.external_key,request_sha,result);
 return result;
end$$;

create function public.admin_nid_question_binding(p_external_key text,p_expected_version text default null,p_request_id uuid default null)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
declare q dm_private.bank_questions;binding jsonb;expected jsonb;ack jsonb;history jsonb;
begin
 if not public.is_dmocks_admin()then raise exception'Admin access required'using errcode='42501';end if;
 select *into q from dm_private.bank_questions where external_key=p_external_key;
 if q.external_key is null then raise exception'Bank question unavailable';end if;
 if p_expected_version is not null and dm_private.bank_review_version(q)<>p_expected_version then raise exception'Question changed. Refresh the bank and review it again.'using errcode='40001';end if;
 binding:=dm_private.nid_binding_state(q);expected:=dm_private.nid_practice_runtime(q,binding);
 select result into ack from dm_private.nid_question_binding_requests where request_id=p_request_id and actor_id=auth.uid()and external_key=p_external_key;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'contentSha256',content_sha256,'blueprintId',blueprint_id,'blueprintRevision',blueprint_revision,
  'sectionOrdinal',section_ordinal,'note',note,'createdAt',created_at)order by created_at desc,id),'[]')into history
 from(select *from dm_private.nid_question_bindings where external_key=p_external_key order by created_at desc,id limit 10)recent;
 return jsonb_build_object('binding',binding,'canConvert',expected is not null,'materialized',expected is not null and q.runtime_payload is not distinct from expected,
  'reviewVersion',dm_private.bank_review_version(q),'requestResult',ack,'history',history);
end$$;

create function public.nid_practice_runtime_plan(p_after_key text default null,p_limit integer default 100)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare items jsonb;last_key text;
begin
 if auth.role()is distinct from'service_role'then raise exception'Forbidden';end if;
 if p_limit is null or p_limit not between 1 and 100 or char_length(p_after_key)>200 then raise exception'Invalid practice plan page'using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('externalKey',q.external_key,'contentSha256',q.content_sha256,'binding',dm_private.nid_binding_state(q),
  'runtime',dm_private.nid_practice_runtime(q,dm_private.nid_binding_state(q)))order by q.external_key),'[]'),max(q.external_key)into items,last_key
 from(select b.*from dm_private.bank_questions b join dm_private.nid_question_binding_heads h on h.external_key=b.external_key
  where b.exam='nid'and(p_after_key is null or b.external_key>p_after_key)order by b.external_key limit p_limit)q;
 return jsonb_build_object('items',items,'nextKey',case when exists(select 1 from dm_private.nid_question_binding_heads h join dm_private.bank_questions b on b.external_key=h.external_key where b.exam='nid'and h.external_key>last_key)then last_key end);
end$$;

create function public.upsert_nid_practice_runtime_batch(p_records jsonb)returns integer
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare r jsonb;q dm_private.bank_questions;binding jsonb;expected jsonb;runtime_value jsonb;n integer:=0;
begin
 if auth.role()is distinct from'service_role'then raise exception'Forbidden';end if;
 if jsonb_typeof(p_records)is distinct from'array'or jsonb_array_length(p_records)not between 1 and 100
  or exists(select 1 from jsonb_array_elements(p_records)x where jsonb_typeof(x)is distinct from'object'or not(x?&array['externalKey','contentSha256','bindingId','runtime'])
   or coalesce(x->>'contentSha256','')!~'^[a-f0-9]{64}$'or coalesce(x->>'bindingId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$')
  or(select count(distinct x->>'externalKey')from jsonb_array_elements(p_records)x)<>jsonb_array_length(p_records)then raise exception'Invalid authored practice batch'using errcode='22023';end if;
 -- Parent locks precede question locks, as in blueprint edits and human binds.
 perform 1 from dm_private.nid_practice_blueprints b where b.id in(select x.blueprint_id from dm_private.nid_question_bindings x
  join jsonb_array_elements(p_records)as rows(item)on x.id=(rows.item->>'bindingId')::uuid)order by b.id for share;
 for r in select value from jsonb_array_elements(p_records)order by value->>'externalKey'loop
  perform pg_advisory_xact_lock(hashtextextended(r->>'externalKey',151));
  select *into q from dm_private.bank_questions where external_key=r->>'externalKey'and content_sha256=r->>'contentSha256'for update;
  binding:=dm_private.nid_binding_state(q);
  if q.external_key is null or q.exam<>'nid'or binding->>'id'is distinct from r->>'bindingId'then raise exception'Practice binding or canonical source changed'using errcode='40001';end if;
  expected:=dm_private.nid_practice_runtime(q,binding);runtime_value:=nullif(r->'runtime','null'::jsonb);
  if runtime_value is distinct from expected then raise exception'Conversion does not match the current reviewed practice binding'using errcode='40001';end if;
  update dm_private.bank_questions set runtime_payload=runtime_value,objective_ready=runtime_value is not null and runtime_value->>'kind'<>'drawing'where external_key=q.external_key;
  n:=n+1;
 end loop;return n;
end$$;

-- Preserve an already materialized, still-current authored conversion during
-- the legacy full-bank null decision for NID. Never create one from that path.
alter function public.upsert_question_bank_runtime_batch(jsonb)set schema dm_private;
alter function dm_private.upsert_question_bank_runtime_batch(jsonb)rename to upsert_verified_exam_runtime_batch;
revoke all on function dm_private.upsert_verified_exam_runtime_batch(jsonb)from public,anon,authenticated,service_role;
create function public.upsert_question_bank_runtime_batch(p_records jsonb)returns integer
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare r jsonb;q dm_private.bank_questions;expected jsonb;n integer:=0;
begin
 if auth.role()is distinct from'service_role'then raise exception'Forbidden';end if;
 if jsonb_typeof(p_records)is distinct from'array'or jsonb_array_length(p_records)not between 1 and 200 then raise exception'Invalid runtime batch';end if;
 for r in select value from jsonb_array_elements(p_records)order by value->>'externalKey'loop
  select *into q from dm_private.bank_questions where external_key=r->>'externalKey';
  if q.exam='nid'then
   if jsonb_typeof(r)is distinct from'object'or not(r?'runtime')or r->'runtime'is distinct from'null'::jsonb then raise exception'Use the guarded authored practice materializer';end if;
   perform pg_advisory_xact_lock(hashtextextended(q.external_key,151));
   select *into q from dm_private.bank_questions where external_key=r->>'externalKey'and content_sha256=r->>'contentSha256'and active for update;
   if q.external_key is null then raise exception'Runtime record does not match active canonical content';end if;
   expected:=dm_private.nid_practice_runtime(q,dm_private.nid_binding_state(q));
   if expected is null or q.runtime_payload is distinct from expected then
    update dm_private.bank_questions set runtime_payload=null,objective_ready=false where external_key=q.external_key;
   end if;
   n:=n+1;
  else n:=n+dm_private.upsert_verified_exam_runtime_batch(jsonb_build_array(r));end if;
 end loop;return n;
end$$;

create or replace function public.admin_bank_question(p_external_key text,p_expected_version text)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,dm_private as $$
declare question dm_private.bank_questions;media jsonb;binding jsonb;expected jsonb;
begin
 if not public.is_dmocks_admin()then raise exception'Admin access required'using errcode='42501';end if;
 select *into question from dm_private.bank_questions where external_key=p_external_key;
 if not found then raise exception'Bank question unavailable';end if;
 if p_expected_version is null or dm_private.bank_review_version(question)<>p_expected_version then raise exception'Question changed. Refresh the bank and review it again.'using errcode='40001';end if;
 select coalesce(jsonb_agg(jsonb_build_object('ordinal',f.ordinal,'width',f.width,'height',f.height,'available',f.storage_path is not null)order by f.ordinal),'[]')into media from dm_private.bank_review_figures(question.external_key)f;
 binding:=dm_private.nid_binding_state(question);expected:=dm_private.nid_practice_runtime(question,binding);
 return jsonb_build_object('externalKey',question.external_key,'exam',question.exam,'type',question.question_type,'topic',question.topic,'licence',question.licence,
  'active',question.active,'approved',question.owner_approved,'rightsConfirmed',question.rights_confirmed,'reviewNote',question.review_note,'reviewVersion',dm_private.bank_review_version(question),
  'sourceCommit',question.source_commit,'contentSha256',question.content_sha256,'prompt',question.payload->>'prompt','options',coalesce(question.payload->'options','[]'),
  'answer',question.payload->'answer','explanation',question.payload->>'explanation','runtimeKey',question.runtime_payload->'key','marking',question.runtime_payload->'marking',
  'context',question.runtime_payload->'context','runtimeReady',question.runtime_payload is not null and(question.exam<>'nid'or expected is not null and question.runtime_payload=expected),
  'holdReason',(select reason from dm_private.bank_local_holds where external_key=question.external_key),'media',media,
  'nidPractice',case when question.exam='nid'then jsonb_build_object('binding',binding,'canConvert',expected is not null,'materialized',expected is not null and question.runtime_payload is not distinct from expected)end);
end$$;

create or replace function public.admin_review_bank_question(p_external_key text,p_approved boolean,p_rights_confirmed boolean,p_note text default null)returns void
language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare q dm_private.bank_questions;expected jsonb;
begin
 if not public.is_dmocks_admin()then raise exception'Admin access required'using errcode='42501';end if;
 if p_approved and not p_rights_confirmed then raise exception'Rights confirmation is required';end if;
 if p_approved then
  select *into q from dm_private.bank_questions where external_key=p_external_key for update;
  if q.exam='nid'then
   expected:=dm_private.nid_practice_runtime(q,dm_private.nid_binding_state(q));
   if expected is null or q.runtime_payload is distinct from expected then raise exception'Current authored practice conversion and review are required'using errcode='40001';end if;
  end if;
 end if;
 update dm_private.bank_questions set owner_approved=p_approved,rights_confirmed=(p_approved and p_rights_confirmed),review_note=nullif(trim(p_note),''),reviewed_by=auth.uid(),reviewed_at=now()
 where external_key=p_external_key and active and(not p_approved or runtime_payload is not null)returning *into q;
 if not found then raise exception'Runtime-ready bank question not found';end if;
 if q.exam='nid'then perform dm_private.require_nid_admin();end if;
 insert into dm_private.bank_question_reviews(external_key,reviewer_id,approved,rights_confirmed,note)values(p_external_key,auth.uid(),p_approved,(p_approved and p_rights_confirmed),nullif(trim(p_note),''));
end$$;

revoke all on function public.admin_bind_nid_question(text,text,uuid,integer,text,integer,text,uuid),public.admin_nid_question_binding(text,text,uuid)from public,anon,service_role;
grant execute on function public.admin_bind_nid_question(text,text,uuid,integer,text,integer,text,uuid),public.admin_nid_question_binding(text,text,uuid)to authenticated;
revoke all on function public.nid_practice_runtime_plan(text,integer),public.upsert_nid_practice_runtime_batch(jsonb),public.upsert_question_bank_runtime_batch(jsonb)from public,anon,authenticated;
grant execute on function public.nid_practice_runtime_plan(text,integer),public.upsert_nid_practice_runtime_batch(jsonb),public.upsert_question_bank_runtime_batch(jsonb)to service_role;
