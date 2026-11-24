-- Fictional full-marks source only. Every write rolls back.
\set ON_ERROR_STOP on
begin;

create function pg_temp.fm_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.fm_reject(record jsonb,expected text) returns void language plpgsql as $$
begin
  perform public.upsert_question_bank_runtime_batch(jsonb_build_array(record));
  raise exception 'FAIL: expected rejection';
exception when others then
  if sqlerrm='FAIL: expected rejection' or position(expected in sqlerrm)=0 then raise;end if;
end$$;

insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,source_commit)
select key,repeat(md5(key),2),exam,kind,'full-marks-fixture','owned',
  jsonb_build_object('prompt','Fictional '||key,'holds','[]'::jsonb,'assets','[]'::jsonb,
    'answer',jsonb_build_object('status','verified','raw',answer),
    'options',case when kind='NAT' then '[]'::jsonb else
      '[{"key":"A","text":"A"},{"key":"B","text":"B"},{"key":"C","text":"C"},{"key":"D","text":"D"}]'::jsonb end),
  repeat('d',40)
from (values ('fm-mcq','ceed','MCQ','FULL MARKS'),('fm-nat','uceed','NAT','FULL MARKS'),
  ('fm-forged','ceed','MCQ','A'),('fm-empty','ceed','MCQ',null)) fixture(key,exam,kind,answer);

create temporary table fm_records as
select b.external_key,jsonb_build_object('externalKey',b.external_key,'contentSha256',b.content_sha256,'runtime',
  jsonb_build_object('kind',lower(b.question_type),'prompt',b.payload->>'prompt',
    'context',jsonb_build_object('version','iitb-2027-v1','cycle',2027,'exam',b.exam),
    'options',case when b.question_type='NAT' then '[]'::jsonb else
      '[{"id":"A","label":"A"},{"id":"B","label":"B"},{"id":"C","label":"C"},{"id":"D","label":"D"}]'::jsonb end,
    'key',jsonb_build_object('kind','full_marks','sourceExternalKey',b.external_key),
    'marking',case when b.question_type='NAT' then '{"correct":4,"wrong":0}'::jsonb
      else '{"correct":3,"wrong":-0.5}'::jsonb end,
    'points',case when b.question_type='NAT' then 4 else 3 end,
    'negativePoints',case when b.question_type='NAT' then 0 else 0.5 end,
    'media','[]'::jsonb,'explanation','Fictional owner-reviewed full marks.')) as record
from dm_private.bank_questions b where b.external_key in('fm-mcq','fm-nat','fm-forged','fm-empty');
grant select on fm_records to service_role;

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.fm_assert(public.upsert_question_bank_runtime_batch(
  (select jsonb_agg(record) from fm_records where external_key in('fm-mcq','fm-nat')))=2,
  'exact canonical full-marks MCQ and NAT materialize');
reset role;
select pg_temp.fm_assert((select runtime_payload->'key'->>'kind'='full_marks' and objective_ready
  from dm_private.bank_questions where external_key='fm-nat'),'full marks stays an objective delivery');
set local role service_role;
select pg_temp.fm_reject((select record from fm_records where external_key='fm-forged'),
  'Invalid canonical runtime question');
select pg_temp.fm_reject((select record from fm_records where external_key='fm-empty'),
  'Invalid canonical runtime question');
select pg_temp.fm_reject(jsonb_set((select record from fm_records where external_key='fm-mcq'),
  '{runtime,key,accepted}','[{"exact":"1"}]'::jsonb), 'Invalid canonical runtime question');
select pg_temp.fm_reject(jsonb_set((select record from fm_records where external_key='fm-mcq'),
  '{runtime,options}','[]'::jsonb), 'Runtime options or key do not match canonical identifiers');
reset role;
select pg_temp.fm_assert((select marks=3 and outcome='full_marks' from
  dm_private.score_response('mcq','{"kind":"full_marks"}'::jsonb,null,
    '{"correct":3,"wrong":-0.5}'::jsonb)), 'unanswered full-marks item earns its historical marks');

rollback;
