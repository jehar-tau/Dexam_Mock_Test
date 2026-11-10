\set ON_ERROR_STOP on
begin;

create function pg_temp.packet_assert(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
end $$;

create function pg_temp.packet_reject(statement text,expected_state text,expected_message text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate=expected_state and position(expected_message in sqlerrm)>0 then return; end if;
    raise;
  end;
  raise exception 'FAIL, expected %: %',expected_state,expected_message;
end $$;

insert into auth.users(id) values(md5('packet-operator')::uuid),(md5('packet-student')::uuid);
insert into dm_private.admins(user_id) values(md5('packet-operator')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',md5('packet-operator')::uuid::text,true);
select public.admin_create_question_draft('manual','Fictional export fixture',
  jsonb_build_object('prompt',E'Fictional café – नमस्ते\n"Line two"','type','MCQ',
    'provenance','{"exam":"uceed"}'::jsonb,'holds','["review"]'::jsonb)) as draft_id \gset
select public.admin_review_question_draft(:'draft_id','approved','Fictional approval for export');
select public.admin_export_question_draft(:'draft_id','fictional-packet',true,'Fictional owner confirmed rights')->>'id' as export_id \gset
reset role;

-- Model a valid legacy export and corrupted or incomplete saved artifacts
-- independently of the current writer, with self-consistent hashes where needed.
with fixtures(name,status) as (
  values('legacy','exported'),('no-holds','exported'),('with-holds','exported'),
    ('wrong-key','exported'),('wrong-hash','exported'),('still-approved','approved'),('array','exported')
)
insert into dm_private.question_drafts(id,created_by,source_type,source_name,payload,status)
select md5('packet-draft-'||name)::uuid,md5('packet-operator')::uuid,'manual',
  'Fictional historical source','{}',status from fixtures;

with fixtures(name,payload) as (
  values
    ('legacy','{"prompt":"Fictional earlier export","type":"MCQ","provenance":{"exam":"uceed"},"externalKey":"legacy","holds":[]}'::jsonb),
    ('no-holds','{"externalKey":"no-holds"}'),
    ('with-holds','{"externalKey":"with-holds","holds":["review"]}'),
    ('wrong-key','{"externalKey":"other-key","holds":[]}'),
    ('wrong-hash','{"externalKey":"wrong-hash","holds":[]}'),
    ('still-approved','{"externalKey":"still-approved","holds":[]}'),
    ('array','[{"externalKey":"array","holds":[]}]')
)
insert into dm_private.question_draft_exports(id,draft_id,external_key,content_sha256,payload,rights_note,exported_by)
select md5('packet-export-'||name)::uuid,md5('packet-draft-'||name)::uuid,name,
  case when name='wrong-hash' then repeat('0',64) else encode(sha256(convert_to(payload::text,'UTF8')),'hex') end,
  payload,'Fictional historical rights',md5('packet-operator')::uuid from fixtures;

select payload::text as expected_payload,content_sha256 as expected_sha,created_at as expected_created
from dm_private.question_draft_exports where id=:'export_id' \gset
select md5(jsonb_agg(jsonb_build_array(e.xmin::text,d.xmin::text,to_jsonb(e),to_jsonb(d)) order by e.id)::text) as snapshot
from dm_private.question_draft_exports e join dm_private.question_drafts d on d.id=e.draft_id \gset

set local role authenticated;
select pg_temp.packet_assert(public.admin_read_question_export(:'export_id')=jsonb_build_object(
  'format','dmocks-question-export-v1','artifactId',:'export_id'::uuid,'externalKey','fictional-packet',
  'contentSha256',:'expected_sha','payloadText',:'expected_payload','rightsNote','Fictional owner confirmed rights',
  'createdAt',:'expected_created'::timestamptz,'sourceType','manual','publicationState','git-review-required'
),'packet contains exactly the recorded operator handoff fields');
with packet as (select public.admin_read_question_export(:'export_id') as dto)
select pg_temp.packet_assert(encode(sha256(convert_to(dto->>'payloadText','UTF8')),'hex')=dto->>'contentSha256'
  and convert_to(dto->>'payloadText','UTF8')=convert_to(:'expected_payload','UTF8'),
  'the exact PostgreSQL text bytes, including Unicode and escapes, reproduce the recorded SHA') from packet;
select pg_temp.packet_assert(public.admin_read_question_export(md5('packet-export-legacy')::uuid)->>'externalKey'='legacy',
  'valid historical export remains available');
select pg_temp.packet_reject(format('select public.admin_read_question_export(%L)',md5('packet-export-'||name)::uuid),
  'P0001','Question export packet unavailable')
from unnest(array['no-holds','with-holds','wrong-key','wrong-hash','still-approved','array','missing']) as fixtures(name);
select pg_temp.packet_reject('select public.admin_read_question_export(null)','P0001','Question export packet unavailable');

select set_config('request.jwt.claim.sub',md5('packet-student')::uuid::text,true);
select pg_temp.packet_reject(format('select public.admin_read_question_export(%L)',:'export_id'),
  '42501','Admin access required');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.packet_reject(format('select public.admin_read_question_export(%L)',:'export_id'),
  '42501','Admin access required');
select set_config('request.jwt.claim.sub',md5('packet-operator')::uuid::text,true);
reset role;
set local role anon;
select pg_temp.packet_reject(format('select public.admin_read_question_export(%L)',:'export_id'),
  '42501','permission denied');
reset role;
set local role service_role;
select pg_temp.packet_reject(format('select public.admin_read_question_export(%L)',:'export_id'),
  '42501','permission denied');
reset role;

delete from dm_private.admins where user_id=md5('packet-operator')::uuid;
set local role authenticated;
select pg_temp.packet_reject(format('select public.admin_read_question_export(%L)',:'export_id'),
  '42501','Admin access required');
reset role;

select pg_temp.packet_assert(
  (select md5(jsonb_agg(jsonb_build_array(e.xmin::text,d.xmin::text,to_jsonb(e),to_jsonb(d)) order by e.id)::text)
    from dm_private.question_draft_exports e join dm_private.question_drafts d on d.id=e.draft_id)=:'snapshot',
  'reading never changes stored draft or export rows');
select pg_temp.packet_assert((select count(*) from dm_private.bank_questions where external_key='fictional-packet')=0,
  'the export never publishes to the canonical bank');

rollback;
\echo 'PASS: private question export packet preserves exact bytes and denies unauthorized or invalid reads.'
