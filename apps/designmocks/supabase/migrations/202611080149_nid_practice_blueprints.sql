-- Authored practice design only. These records never feed exam_mock_blueprints,
-- canonical runtimes, answer keys, paper releases, entitlements or launch gates.
create table dm_private.nid_practice_blueprints (
 id uuid primary key, current_revision integer not null check(current_revision>0),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp()
);
create table dm_private.nid_practice_blueprint_versions (
 blueprint_id uuid not null references dm_private.nid_practice_blueprints(id), revision integer not null check(revision>0),
 payload jsonb not null, content_sha256 text not null check(content_sha256~'^[a-f0-9]{64}$'),
 status text not null default 'draft' check(status in('draft','reviewed','rejected')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp(),
 review_note text, reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 primary key(blueprint_id,revision),
 check((status='draft' and review_note is null and reviewed_by is null and reviewed_at is null)or
  (status<>'draft' and char_length(btrim(review_note))between 20 and 2000 and reviewed_by is not null and reviewed_at is not null))
);
create table dm_private.nid_practice_blueprint_requests (
 request_id uuid primary key, actor_id uuid not null references auth.users(id),
 blueprint_id uuid not null references dm_private.nid_practice_blueprints(id),
 operation text not null check(operation in('save','review')), request_sha256 text not null,
 result jsonb not null, created_at timestamptz not null default clock_timestamp()
);
alter table dm_private.nid_practice_blueprints enable row level security;
alter table dm_private.nid_practice_blueprint_versions enable row level security;
alter table dm_private.nid_practice_blueprint_requests enable row level security;
revoke all on dm_private.nid_practice_blueprints,dm_private.nid_practice_blueprint_versions,dm_private.nid_practice_blueprint_requests from public,anon,authenticated,service_role;

create function dm_private.nid_practice_payload_valid(p jsonb)returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
declare s jsonb;c jsonb;labels text[]:='{}';criteria text[];n integer:=0;human boolean:=false;rubric_points numeric;
begin
 if jsonb_typeof(p)is distinct from'object'or octet_length(p::text)>64000 or p->>'schemaVersion'is distinct from'nid-authored-practice-v1'
  or(select count(*)from jsonb_object_keys(p))<>6 or not(p?&array['schemaVersion','title','purpose','durationMinutes','uploadGraceMinutes','sections'])then return false;end if;
 if jsonb_typeof(p->'title')is distinct from'string'or char_length(p->>'title')not between 3 and 160 or p->>'title'<>btrim(p->>'title')
  or jsonb_typeof(p->'purpose')is distinct from'string'or char_length(p->>'purpose')not between 20 and 2000 or p->>'purpose'<>btrim(p->>'purpose')
  or jsonb_typeof(p->'durationMinutes')is distinct from'number'or(p->>'durationMinutes')!~'^[0-9]+$'or(p->>'durationMinutes')::numeric not between 1 and 360
  or jsonb_typeof(p->'uploadGraceMinutes')is distinct from'number'or(p->>'uploadGraceMinutes')not in('0','10','15')
  or jsonb_typeof(p->'sections')is distinct from'array'or jsonb_array_length(p->'sections')not between 1 and 8 then return false;end if;
 for s in select value from jsonb_array_elements(p->'sections')loop
  if jsonb_typeof(s)is distinct from'object'or(select count(*)from jsonb_object_keys(s))<>6 or not(s?&array['label','kind','count','points','penalty','rubric'])
   or jsonb_typeof(s->'label')is distinct from'string'or char_length(s->>'label')not between 3 and 120 or s->>'label'<>btrim(s->>'label')
   or lower(s->>'label')=any(labels)or s->>'kind'not in('mcq','msq','nat','drawing','written')or jsonb_typeof(s->'kind')is distinct from'string'
   or jsonb_typeof(s->'count')is distinct from'number'or(s->>'count')!~'^[0-9]+$'or(s->>'count')::numeric not between 1 and 100
   or jsonb_typeof(s->'points')is distinct from'number'or(s->>'points')!~'^[0-9]{1,3}(\.[0-9]{1,2})?$'or(s->>'points')::numeric not between 0.01 and 100
   or jsonb_typeof(s->'penalty')is distinct from'number'or(s->>'penalty')!~'^[0-9]{1,3}(\.[0-9]{1,2})?$'or(s->>'penalty')::numeric>(s->>'points')::numeric
   or jsonb_typeof(s->'rubric')is distinct from'array'then return false;end if;
  labels:=array_append(labels,lower(s->>'label'));n:=n+(s->>'count')::integer;
  if s->>'kind'in('drawing','written')then
   human:=true;criteria:='{}';rubric_points:=0;
   if(s->>'penalty')::numeric<>0 or jsonb_array_length(s->'rubric')not between 1 and 12 then return false;end if;
   for c in select value from jsonb_array_elements(s->'rubric')loop
    if jsonb_typeof(c)is distinct from'object'or(select count(*)from jsonb_object_keys(c))<>3 or not(c?&array['label','points','guidance'])
     or jsonb_typeof(c->'label')is distinct from'string'or char_length(c->>'label')not between 3 and 120 or c->>'label'<>btrim(c->>'label')or lower(c->>'label')=any(criteria)
     or jsonb_typeof(c->'guidance')is distinct from'string'or char_length(c->>'guidance')not between 10 and 1000 or c->>'guidance'<>btrim(c->>'guidance')
     or jsonb_typeof(c->'points')is distinct from'number'or(c->>'points')!~'^[0-9]{1,3}(\.[0-9]{1,2})?$'or(c->>'points')::numeric not between 0.01 and 100 then return false;end if;
    criteria:=array_append(criteria,lower(c->>'label'));rubric_points:=rubric_points+(c->>'points')::numeric;
   end loop;
   if rubric_points<>(s->>'points')::numeric then return false;end if;
  elsif jsonb_array_length(s->'rubric')<>0 then return false;end if;
 end loop;
 return n<=100 and case when human then(p->>'uploadGraceMinutes')in('10','15')else(p->>'uploadGraceMinutes')='0'end;
exception when invalid_parameter_value or invalid_text_representation or numeric_value_out_of_range then return false;
end$$;
revoke all on function dm_private.nid_practice_payload_valid(jsonb)from public,anon,authenticated,service_role;

create function public.admin_nid_practice_blueprints(p_offset integer default 0,p_limit integer default 25)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
declare total integer;off integer;
begin
 if not public.is_dmocks_admin()then raise exception'Admin access required'using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>1000000 or p_limit is null or p_limit not between 1 and 50 then raise exception'Invalid blueprint page'using errcode='22023';end if;
 select count(*)into total from dm_private.nid_practice_blueprints;
 off:=least(p_offset,((greatest(0,total-1))/p_limit)*p_limit);
 return jsonb_build_object('total',total,'offset',off,'limit',p_limit,'items',(select coalesce(jsonb_agg(item order by changed_at desc,id),'[]')from(
  select b.id,v.created_at changed_at,jsonb_build_object('id',b.id,'revision',v.revision,'sha256',v.content_sha256,'status',v.status,'title',v.payload->>'title','updatedAt',v.created_at)item
  from dm_private.nid_practice_blueprints b join dm_private.nid_practice_blueprint_versions v on v.blueprint_id=b.id and v.revision=b.current_revision
  order by v.created_at desc,b.id offset off limit p_limit)page));
end$$;

create function public.admin_nid_practice_blueprint(p_id uuid,p_revision integer default null,p_request_id uuid default null)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
declare b dm_private.nid_practice_blueprints;v dm_private.nid_practice_blueprint_versions;history jsonb;ack jsonb;
begin
 if not public.is_dmocks_admin()then raise exception'Admin access required'using errcode='42501';end if;
 if p_id is null or(p_revision is not null and p_revision<1)then raise exception'Invalid blueprint revision'using errcode='22023';end if;
 select *into b from dm_private.nid_practice_blueprints where id=p_id;
 select result into ack from dm_private.nid_practice_blueprint_requests where request_id=p_request_id and actor_id=auth.uid()and blueprint_id=p_id;
 if b.id is null then return jsonb_build_object('item',null,'versions','[]'::jsonb,'requestResult',ack);end if;
 select *into v from dm_private.nid_practice_blueprint_versions where blueprint_id=p_id and revision=coalesce(p_revision,b.current_revision);
 if v.blueprint_id is null then raise exception'Blueprint revision unavailable'using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('revision',revision,'sha256',content_sha256,'status',status,'createdAt',created_at)order by revision desc),'[]')into history
  from(select *from dm_private.nid_practice_blueprint_versions where blueprint_id=p_id order by revision desc limit 30)recent;
 return jsonb_build_object('item',jsonb_build_object('id',b.id,'revision',v.revision,'currentRevision',b.current_revision,'sha256',v.content_sha256,'payload',v.payload,'status',v.status,
  'createdAt',v.created_at,'reviewNote',v.review_note,'reviewedAt',v.reviewed_at),'versions',history,'requestResult',ack);
end$$;

create function public.admin_save_nid_practice_blueprint(p_id uuid,p_expected_revision integer,p_payload jsonb,p_request_id uuid)returns jsonb
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
  if r.actor_id<>auth.uid()or r.request_sha256<>request_sha then raise exception'Blueprint request conflicts with an earlier request'using errcode='40001';end if;
  return r.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,150));
 select *into b from dm_private.nid_practice_blueprints where id=p_id for update;
 if coalesce(b.current_revision,0)<>p_expected_revision then raise exception'Blueprint changed. Open the current revision before saving.'using errcode='40001';end if;
 next_revision:=p_expected_revision+1;
 if b.id is null then insert into dm_private.nid_practice_blueprints(id,current_revision,created_by)values(p_id,next_revision,auth.uid());
 else update dm_private.nid_practice_blueprints set current_revision=next_revision where id=p_id;end if;
 insert into dm_private.nid_practice_blueprint_versions(blueprint_id,revision,payload,content_sha256,created_by)values(p_id,next_revision,p_payload,sha,auth.uid());
 result:=jsonb_build_object('id',p_id,'revision',next_revision,'sha256',sha,'status','draft');
 insert into dm_private.nid_practice_blueprint_requests(request_id,actor_id,blueprint_id,operation,request_sha256,result)values(p_request_id,auth.uid(),p_id,'save',request_sha,result);
 return result;
end$$;

create function public.admin_review_nid_practice_blueprint(p_id uuid,p_expected_revision integer,p_expected_sha256 text,p_decision text,p_note text,p_request_id uuid)returns jsonb
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
  if r.actor_id<>auth.uid()or r.request_sha256<>request_sha then raise exception'Blueprint request conflicts with an earlier request'using errcode='40001';end if;
  return r.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,150));
 select *into b from dm_private.nid_practice_blueprints where id=p_id for update;
 select *into v from dm_private.nid_practice_blueprint_versions where blueprint_id=p_id and revision=p_expected_revision for update;
 if b.id is null or b.current_revision<>p_expected_revision or v.content_sha256 is distinct from p_expected_sha256 or v.status<>'draft'
  then raise exception'Blueprint changed. Open the current revision before reviewing.'using errcode='40001';end if;
 if not dm_private.nid_practice_payload_valid(v.payload)then raise exception'Invalid authored practice blueprint'using errcode='22023';end if;
 update dm_private.nid_practice_blueprint_versions set status=p_decision,review_note=btrim(p_note),reviewed_by=auth.uid(),reviewed_at=clock_timestamp()where blueprint_id=p_id and revision=p_expected_revision;
 result:=jsonb_build_object('id',p_id,'revision',p_expected_revision,'sha256',p_expected_sha256,'status',p_decision);
 insert into dm_private.nid_practice_blueprint_requests(request_id,actor_id,blueprint_id,operation,request_sha256,result)values(p_request_id,auth.uid(),p_id,'review',request_sha,result);
 return result;
end$$;
revoke all on function public.admin_nid_practice_blueprints(integer,integer),public.admin_nid_practice_blueprint(uuid,integer,uuid),public.admin_save_nid_practice_blueprint(uuid,integer,jsonb,uuid),public.admin_review_nid_practice_blueprint(uuid,integer,text,text,text,uuid)from public,anon,service_role;
grant execute on function public.admin_nid_practice_blueprints(integer,integer),public.admin_nid_practice_blueprint(uuid,integer,uuid),public.admin_save_nid_practice_blueprint(uuid,integer,jsonb,uuid),public.admin_review_nid_practice_blueprint(uuid,integer,text,text,text,uuid)to authenticated;
