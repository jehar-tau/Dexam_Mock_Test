-- Fictional source and runtime fixtures only. All changes roll back.
\set ON_ERROR_STOP on
begin;

create function pg_temp.alt_assert(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
end
$$;
create function pg_temp.alt_reject(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if position(expected in sqlerrm) = 0 then raise; end if;
    return;
  end;
  raise exception 'FAIL: expected rejection containing %', expected;
end
$$;

select pg_temp.alt_assert(
  has_function_privilege('service_role', 'public.upsert_question_bank_runtime_batch(jsonb)', 'execute')
  and not has_function_privilege(role_name, 'dm_private.upsert_verified_exam_runtime_batch(jsonb)', 'execute')
  and not has_function_privilege(role_name, 'dm_private.verified_choice_alternative_key(text,text,jsonb)', 'execute'),
  'private materialization functions inaccessible to ' || role_name)
from unnest(array['anon','authenticated','service_role']) role_name;
select pg_temp.alt_assert(not has_function_privilege(role_name, 'public.upsert_question_bank_runtime_batch(jsonb)', 'execute'),
  'materializer inaccessible to ' || role_name) from unnest(array['anon','authenticated']) role_name;

create temporary table alternative_fixtures (
  external_key text primary key,
  question_type text,
  raw_answer text,
  option_ids text[],
  key_value jsonb,
  exam text default 'uceed'
);
insert into alternative_fixtures(external_key, question_type, raw_answer, option_ids, key_value, exam) values
  ('explicit-mcq','MCQ',U&'\FEFFB\00A0oR\0009A\3000',array['A','B','C','D'],'{"correct":["B","A"]}','uceed'),
  ('explicit-msq','MSQ','DC or B, A',array['A','B','C','D'],'{"alternatives":[["C","D"],["A","B"]]}','uceed'),
  ('explicit-nat','NAT','1.000000000000000001 or 2.25 to 2.5',null,
    '{"accepted":[{"exact":"1.000000000000000001"},{"range":["2.25","2.5"]}]}','uceed'),
  ('literal-mcq','MCQ','A or B',array['A','B','A or B','D'],'{"correct":["A or B"]}','uceed'),
  ('literal-msq','MSQ','A or B',array['A','B','or','D'],'{"correct":["A","B","or"]}','uceed'),
  ('utf16-msq','MSQ',U&'\E000 & \+01F600 or Z',array[U&'\E000',U&'\+01F600','X','Z'],
    jsonb_build_object('alternatives', jsonb_build_array(jsonb_build_array(U&'\+01F600',U&'\E000'),jsonb_build_array('Z'))),'ceed'),
  ('exact-token-msq','MSQ','AB or A / B',array['A','B','AB','D'],'{"alternatives":[["AB"],["A","B"]]}','ceed'),
  ('limit-mcq','MCQ',repeat(U&'\+01F600',98)||' or B',array[repeat(U&'\+01F600',98),'B','C','D'],
    jsonb_build_object('correct',jsonb_build_array(repeat(U&'\+01F600',98),'B')),'ceed'),
  ('wrong-exam','MCQ','B or A',array['A','B','C','D'],'{"correct":["B","A"]}','nid');
insert into alternative_fixtures(external_key,question_type,raw_answer,option_ids,key_value)
select 'explicit-legacy-'||n, 'MCQ', 'A', array['A','B','C','D'], '{"correct":["A"]}'
from generate_series(1,5) n;

insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,source_commit)
select external_key,repeat(md5(external_key),2),exam,question_type,'verified-alternative-fixture','owned',
  jsonb_build_object('prompt','Fictional answer fixture '||external_key,'holds','[]'::jsonb,'assets','[]'::jsonb,
    'answer',jsonb_build_object('status','verified','raw',raw_answer),
    'options',coalesce((select jsonb_agg(jsonb_build_object('key',id,'text',id) order by position)
      from unnest(option_ids) with ordinality as ids(id, position)), '[]'::jsonb)),repeat('d',40)
from alternative_fixtures;

create temporary table alternative_records as
select f.external_key, jsonb_build_object('externalKey',f.external_key,'contentSha256',q.content_sha256,'runtime',
  jsonb_build_object('kind',lower(f.question_type),'prompt',q.payload->>'prompt','context',jsonb_build_object('version','iitb-2027-v1','cycle',2027,'exam',f.exam),
    'options',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',id) order by position)
      from unnest(option_ids) with ordinality as ids(id, position)), '[]'::jsonb),
    'key',jsonb_build_object('kind',lower(f.question_type),'sourceExternalKey',f.external_key)||f.key_value,
    'marking',jsonb_build_object('correct',m.correct,'wrong',m.wrong)||case when f.question_type='MSQ' then '{"partial":true}'::jsonb else '{}'::jsonb end,
    'points',m.correct,'negativePoints',abs(m.wrong),'media','[]'::jsonb,'explanation','Fictional fixture explanation')) as record
from alternative_fixtures f join dm_private.bank_questions q using (external_key)
cross join lateral (select case when f.question_type='MCQ' then 3 else 4 end as correct,
  case when f.question_type='NAT' then 0 when f.question_type='MSQ' then -1 when f.exam='ceed' then -0.5 else -0.71 end as wrong) m;

select set_config('test.alt_mcq',record::text,true) from alternative_records where external_key='explicit-mcq';
select set_config('test.alt_msq',record::text,true) from alternative_records where external_key='explicit-msq';
select set_config('test.alt_nid',record::text,true) from alternative_records where external_key='wrong-exam';
select set_config('test.alt_limit',record::text,true) from alternative_records where external_key='limit-mcq';
select set_config('test.alt_batch',jsonb_agg(record)::text,true) from alternative_records where external_key not in ('wrong-exam','limit-mcq');

set local role authenticated;
select pg_temp.alt_reject('select public.upsert_question_bank_runtime_batch(current_setting(''test.alt_batch'')::jsonb)', 'permission denied');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.alt_reject('select public.upsert_question_bank_runtime_batch(current_setting(''test.alt_batch'')::jsonb)', 'Forbidden');
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.alt_reject('select public.upsert_question_bank_runtime_batch(jsonb_build_array(current_setting(''test.alt_nid'')::jsonb))',
  'guarded authored practice materializer');
select pg_temp.alt_reject('select public.upsert_question_bank_runtime_batch(jsonb_build_array(current_setting(''test.alt_limit'')::jsonb))',
  'do not match the canonical answer');
select pg_temp.alt_assert(public.upsert_question_bank_runtime_batch(current_setting('test.alt_batch')::jsonb)=12,
  'valid alternatives, literal precedence, UTF-16 ordering, and legacy choices materialize together');

create function pg_temp.reject_alternative(p_record jsonb, p_replacement jsonb) returns void language plpgsql as $$
begin
  perform pg_temp.alt_reject(format('select public.upsert_question_bank_runtime_batch(%L::jsonb)',
    jsonb_build_array(jsonb_set(p_record,'{runtime,key}',((p_record #> '{runtime,key}') - array['correct','alternatives'])||p_replacement))),
    'do not match the canonical answer');
end
$$;

select pg_temp.reject_alternative(current_setting('test.alt_mcq')::jsonb, forged)
from unnest(array['{"correct":["B"]}','{"correct":["A","B"]}','{"correct":["B","C"]}',
  '{"correct":["B","B"]}','{"correct":["B","a"]}','{"correct":["B",1]}',
  '{"correct":["B","A"],"alternatives":[["A"],["B"]]}']::jsonb[]) forged;
select pg_temp.reject_alternative(current_setting('test.alt_msq')::jsonb, forged)
from unnest(array['{"correct":["A","B"]}','{"alternatives":[["C","D"]]}',
  '{"alternatives":[["D","C"],["A","B"]]}','{"alternatives":[["C","D"],["D","C"]]}',
  '{"alternatives":[["A","B","C","D"],["A"]]}','{"alternatives":["CD","AB"]}',
  '{"alternatives":[["C","C"],["A","B"]]}','{"alternatives":[["C","D"],["A","Z"]]}',
  '{"alternatives":[["C","D"],["A","B"]],"correct":["A","B"]}']::jsonb[]) forged;
reset role;

-- Even a plausible supplied key is rejected when the source branches are not complete unique sets.
select pg_temp.alt_assert(dm_private.verified_choice_alternative_key('MSQ',external_key,
  jsonb_set(payload,'{answer,raw}',to_jsonb(invalid))) is null, 'malformed, duplicate, or unknown branch')
from dm_private.bank_questions cross join unnest(array['AB or BA','AB or CC','AB or ZX','AB or ,C','AB or CD/','AB or CD or AB']) invalid
where external_key='explicit-msq';

-- Grade the stored keys. Subsets use the existing best qualifying set, and a
-- union of two alternatives does not become an additional correct response.
select pg_temp.alt_assert(s.marks = expected and s.outcome = expected_outcome, label)
from (values
  ('explicit-mcq','"A"'::jsonb,3::numeric,'correct','second MCQ branch scores once'),
  ('explicit-mcq','"C"',-0.71,'wrong','unlisted MCQ choice keeps the UCEED penalty'),
  ('explicit-msq','["B","A"]',4,'correct','unordered response matches second MSQ set'),
  ('explicit-msq','["D"]',1,'partial','partial credit within first set'),
  ('explicit-msq','["A","D"]',-1,'wrong','cross-set selection does not earn partial credit'),
  ('explicit-msq','["A","B","C","D"]',-1,'wrong','combining complete sets is wrong'),
  ('explicit-msq','[]',0,'unanswered','blank MSQ is unchanged'),
  ('explicit-nat','"1.000000000000000001"',4,'correct','exact NAT alternative retains precision'),
  ('explicit-nat','"1.000000000000000002"',0,'wrong','no tolerance around NAT exact alternative'),
  ('explicit-nat','"2.25"',4,'correct','range includes low endpoint'),
  ('explicit-nat','"2.5"',4,'correct','range includes high endpoint'),
  ('explicit-nat','"2.5001"',0,'wrong','range does not add tolerance')
) cases(external_key,response,expected,expected_outcome,label)
join dm_private.bank_questions q using(external_key)
cross join lateral dm_private.score_response(q.runtime_payload->>'kind',q.runtime_payload->'key',response,q.runtime_payload->'marking') s;

insert into auth.users(id) values ('00000000-0000-4000-8000-000000007155');
insert into public.profiles(user_id,onboarding_completed_at) values ('00000000-0000-4000-8000-000000007155',now());
with paid as (
  insert into dm_private.orders(user_id,plan_id,amount,currency,mode,status)
  values ('00000000-0000-4000-8000-000000007155','annual',119300,'INR','test','paid') returning user_id,id
)
insert into dm_private.passes(user_id,order_id,mode,starts_at,expires_at)
select user_id,id,'test',now(),now()+interval '1 day' from paid;
update dm_private.bank_questions set owner_approved=true,rights_confirmed=true,reviewed_at=now()
where runtime_payload is not null and topic='verified-alternative-fixture';

set local role service_role;
select public.upsert_question_bank_runtime_batch(current_setting('test.alt_batch')::jsonb);
reset role;
select pg_temp.alt_assert((select count(*)=12 from dm_private.bank_questions
  where topic='verified-alternative-fixture' and owner_approved and rights_confirmed and reviewed_at is not null),
  'identical materialization replay preserves approval');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000007155',true);
select set_config('test.alt_attempt',public.start_topic_practice('verified-alternative-fixture','uceed',10,900)::text,true);
select pg_temp.alt_assert(not exists (select 1 from jsonb_array_elements(public.read_attempt(current_setting('test.alt_attempt')::uuid)->'questions') q
  where q ? 'correctKey' or q ? 'key'),'unsubmitted attempt does not reveal alternative keys');
reset role;
select set_config('test.alt_ids',jsonb_object_agg(key->>'sourceExternalKey',question_id)::text,true)
from dm_private.attempt_items where attempt_id=current_setting('test.alt_attempt')::uuid;

-- Change the source through the versioned row. Old requests cannot replay, and
-- a valid materialization of the changed key requires a new review.
update dm_private.bank_questions set content_sha256=repeat('e',64),
  payload=jsonb_set(payload,'{answer,raw}','"B or C"') where external_key='explicit-mcq';
select pg_temp.alt_assert((select runtime_payload is null and not owner_approved and not rights_confirmed and reviewed_at is null
  from dm_private.bank_questions where external_key='explicit-mcq'),'changed canonical answer clears runtime and approval');

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.alt_reject('select public.upsert_question_bank_runtime_batch(jsonb_build_array(current_setting(''test.alt_mcq'')::jsonb))',
  'does not match active canonical content');
select pg_temp.alt_reject('select public.upsert_question_bank_runtime_batch(jsonb_build_array(
  jsonb_set(current_setting(''test.alt_mcq'')::jsonb,''{contentSha256}'',to_jsonb(repeat(''e'',64)))))',
  'do not match the canonical answer');
select public.upsert_question_bank_runtime_batch(jsonb_build_array(jsonb_set(
  jsonb_set(current_setting('test.alt_mcq')::jsonb,'{contentSha256}',to_jsonb(repeat('e',64))),
  '{runtime,key,correct}','["B","C"]')));
reset role;
select pg_temp.alt_assert((select not owner_approved and not rights_confirmed and runtime_payload->'key'->'correct'='["B","C"]'::jsonb
  from dm_private.bank_questions where external_key='explicit-mcq'),'changed answer materializes but awaits approval');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select public.save_answer_revision(current_setting('test.alt_attempt')::uuid,(current_setting('test.alt_ids')::jsonb->>'explicit-mcq')::uuid,'"A"',1);
select public.save_answer_revision(current_setting('test.alt_attempt')::uuid,(current_setting('test.alt_ids')::jsonb->>'explicit-msq')::uuid,'["A","B"]',1);
select public.save_answer_revision(current_setting('test.alt_attempt')::uuid,(current_setting('test.alt_ids')::jsonb->>'explicit-nat')::uuid,'"2.5"',1);
select public.submit_attempt(current_setting('test.alt_attempt')::uuid);
select pg_temp.alt_assert((public.read_attempt(current_setting('test.alt_attempt')::uuid)->>'score')::numeric=11,
  'submitted practice grades all three alternatives using its frozen snapshot after a canonical edit');
reset role;

rollback;
\echo 'PASS: verified explicit alternatives, canonical rejection, authorization, frozen scores and replay.'
