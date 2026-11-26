\set ON_ERROR_STOP on
\set first '00000000-0000-4000-8000-000000000351'
\set second '00000000-0000-4000-8000-000000000352'
\set legacy '00000000-0000-4000-8000-000000000353'
\set no_pass '00000000-0000-4000-8000-000000000354'
\set incomplete '00000000-0000-4000-8000-000000000355'
\set fresh '00000000-0000-4000-8000-000000000356'
\set peer '00000000-0000-4000-8000-000000000357'
begin;
\ir fixtures/release-bank-year.sql
create function pg_temp.practice_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
create function pg_temp.practice_reject(statement text,expected text) returns void language plpgsql as $$
begin begin execute statement;exception when others then if position(expected in sqlerrm)>0 then return;end if;raise;end;
raise exception 'FAIL, unexpectedly allowed: %',expected;end $$;
create function pg_temp.practice_runtime(p_key text,n integer) returns jsonb language sql as $$
 select jsonb_build_object('prompt','Fictional practice question '||n,'topic','observation',
  'kind',case n%3 when 0 then 'mcq' when 1 then 'msq' else 'nat' end,
  'options',case when n%3=2 then '[]'::jsonb else '[{"id":"A","label":"First"},{"id":"B","label":"Second"},{"id":"C","label":"Third"},{"id":"D","label":"Fourth"}]'::jsonb end,
  'marking',case n%3 when 0 then '{"correct":3,"wrong":-0.71}'::jsonb when 1 then '{"correct":4,"wrong":-1,"partial":true}'::jsonb else '{"correct":4,"wrong":0}'::jsonb end,
  'points',case when n%3=0 then 3 else 4 end,'negativePoints',case n%3 when 0 then 0.71 when 1 then 1 else 0 end,
  'media','[]'::jsonb,'explanation','Worked solution for fictional question '||n||'.',
  'key',jsonb_build_object('kind',case n%3 when 0 then 'mcq' when 1 then 'msq' else 'nat' end,'sourceExternalKey',p_key)||
    case n%3 when 0 then '{"correct":["A"]}'::jsonb when 1 then '{"correct":["A","B"]}'::jsonb else '{"accepted":[{"exact":"1"}]}'::jsonb end,
  'context','{"version":"iitb-2027-v1","exam":"uceed","cycle":2027}'::jsonb)
$$;
create function pg_temp.practice_seed(p_low integer,p_high integer) returns void language sql as $$
 insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,objective_ready,owner_approved,rights_confirmed,active,payload,runtime_payload,source_commit)
 select 'unseen-fixture-'||n,md5(n::text)||md5(n::text),'uceed',upper(r->>'kind'),'observation','owned',true,true,true,true,
  jsonb_build_object('holds','[]'::jsonb,'assets','[]'::jsonb,'prompt',r->>'prompt'),r,repeat('a',40)
 from generate_series(p_low,p_high)n cross join lateral(select pg_temp.practice_runtime('unseen-fixture-'||n,n)r)runtime
$$;
insert into auth.users(id)values(:'first'),(:'second'),(:'legacy'),(:'no_pass'),(:'incomplete');
insert into public.profiles(user_id,display_name,phone_e164,phone_verified_at,appearing_year,city,exams,onboarding_completed_at)
select id,'Fictional practice student','+91999951'||lpad((row_number() over(order by id))::text,2,'0'),case when id<>:'incomplete'::uuid then now()end,2027,'Mumbai',array['uceed'],
 case when id<>:'incomplete'::uuid then now()end from auth.users where id in(:'first',:'second',:'legacy',:'no_pass',:'incomplete');
with paid as(insert into dm_private.orders(user_id,plan_id,amount,currency,mode,status)
 select id,'annual',119300,'INR','test','paid' from auth.users where id in(:'first',:'second',:'legacy',:'incomplete')returning id,user_id)
insert into dm_private.passes(user_id,order_id,mode,starts_at,expires_at)select user_id,id,'test',now(),now()+interval '1 year'from paid;
select pg_temp.practice_seed(1,35);
select pg_temp.practice_assert(not dm_private.released_year_topic_question('unseen-fixture-1'),
  'unreleased bank rows cannot feed topic practice');
select pg_temp.practice_assert(not has_function_privilege('authenticated',
  'dm_private.released_year_topic_question(text)','EXECUTE'),
  'students cannot call private year-paper eligibility directly');
select pg_temp.release_bank_year(array(select 'unseen-fixture-'||n from generate_series(1,35)n),
  'uceed',2023,'unseen-uceed-2023');
-- Imported bank answers may offer just a letter. The released paper carries
-- the reviewed solution for each question.
update dm_private.bank_questions set runtime_payload=jsonb_set(runtime_payload,'{explanation}','"A"'::jsonb)
where external_key in (select 'unseen-fixture-'||n from generate_series(1,35)n);
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,objective_ready,owner_approved,rights_confirmed,active,payload,runtime_payload,source_commit)
select 'excluded-'||label,md5(label)||md5(label),case when label='exam' then 'ceed' else 'uceed' end,'MCQ',
 case when label='topic' then 'other-topic' else 'observation' end,'owned',label not in('drawing','runtime'),label<>'approval',label<>'rights',label<>'retired',
 '{"holds":[],"assets":[]}',case when label='runtime' then null when label='drawing' then pg_temp.practice_runtime('excluded-'||label,3)||'{"kind":"drawing"}'::jsonb
 else pg_temp.practice_runtime('excluded-'||label,3)end,repeat('b',40)
from unnest(array['approval','rights','retired','drawing','hold','exam','topic','runtime'])label;
select pg_temp.practice_reject('update dm_private.bank_questions set runtime_payload=pg_temp.practice_runtime(''excluded-runtime'',3)||''{"kind":"unsupported"}''::jsonb where external_key=''excluded-runtime''','bank_runtime_valid');
insert into dm_private.bank_local_holds(external_key,reason,created_by)values('excluded-hold','Fictional held source.',:'first');
update dm_private.bank_questions set active=true,owner_approved=true where external_key='excluded-hold';
create temporary table practice_prior(owner uuid,paper uuid,external_key text,question uuid,ordinal integer,legacy boolean)on commit drop;
insert into practice_prior
select owner,md5('prior-paper-'||owner::text)::uuid,'unseen-fixture-'||n,gen_random_uuid(),
 row_number()over(partition by owner order by n),owner=:'legacy'::uuid and n=35
from(values(:'first'::uuid,1,25),(:'second'::uuid,11,35),(:'legacy'::uuid,1,35))students(owner,low,high)
cross join lateral generate_series(low,high)n;
insert into dm_private.papers(id,title,exam,duration_seconds,source_kind,owner_user_id,reviewed,rights_confirmed)
select distinct paper,'Fictional prior exam','uceed',900,'catalogue',owner,true,true from practice_prior;
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
select prior.question,prior.paper,prior.ordinal,r->>'prompt',r->'options',r->>'kind',r->'marking',r->'media',
 (r->>'points')::numeric,(r->>'negativePoints')::numeric,'observation',true
from practice_prior prior join dm_private.bank_questions b on b.external_key=prior.external_key cross join lateral(select b.runtime_payload r)runtime;
insert into dm_private.answer_keys(question_id,key,explanation)
select prior.question,case when prior.legacy then (b.runtime_payload->'key')-'sourceExternalKey'else b.runtime_payload->'key'end,'Fictional prior explanation.'
from practice_prior prior join dm_private.bank_questions b on b.external_key=prior.external_key;
insert into dm_private.attempts(id,user_id,paper_id,status,started_at,deadline,submitted_at,score,total)
select md5('prior-attempt-'||p.owner_user_id::text)::uuid,p.owner_user_id,p.id,'submitted',now()-interval '1 hour',
 now()-interval '45 minutes',now()-interval '45 minutes',0,(select sum(points)from dm_private.questions where paper_id=p.id)
from dm_private.papers p where id in(select paper from practice_prior);
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,key,explanation)
select a.id,q.id,q.ordinal,q.prompt,q.options,q.kind,q.marking,q.media,q.points,q.negative_points,q.topic,k.key,k.explanation
from dm_private.attempts a join dm_private.questions q on q.paper_id=a.paper_id join dm_private.answer_keys k on k.question_id=q.id;
-- Acceptance seed ends here.
set local role anon;
select pg_temp.practice_reject('select public.start_topic_practice(''observation'',''uceed'',10,900)','permission denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.practice_reject('select public.start_topic_practice(''observation'',''uceed'',10,900)','Sign in required');
select set_config('request.jwt.claim.sub',:'no_pass',true);
select pg_temp.practice_assert(public.start_topic_practice('observation','uceed',10,900) is not null,'free practice starts without a pass once the profile is complete');
select set_config('request.jwt.claim.sub',:'incomplete',true);
select pg_temp.practice_reject('select public.start_topic_practice(''observation'',''uceed'',10,900)','Complete your verified profile first');
-- Exercise the real save path for a new Google account with no SMS proof.
reset role;
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
  (:'fresh','new@example.invalid',now(),'{"provider":"google"}'),
  (:'peer','peer@example.invalid',now(),'{"provider":"google"}');
update dm_private.registration_policy set mode='open' where id;
update dm_private.exam_mock_blueprints set enabled=true where exam='uceed';
set local role authenticated;
select set_config('request.jwt.claim.sub',:'fresh',true);
select pg_temp.practice_reject(
  $sql$select public.save_candidate_profile('New Student','bad-phone',2027,'Mumbai',array['uceed'])$sql$,
  'Invalid candidate profile');
select pg_temp.practice_reject($sql$select public.start_topic_practice('observation','uceed',10,900)$sql$,'Complete your verified profile first');
select public.save_candidate_profile('New Student','+919800000356',2027,'Mumbai',array['uceed']);
select public.start_topic_practice('observation','uceed',10,900) as saved_attempt \gset
select pg_temp.practice_assert(jsonb_array_length(public.read_attempt(:'saved_attempt')->'questions')=10,
  'admitted Google student saves a profile and starts free practice without SMS');
select pg_temp.practice_assert(public.my_candidate_profile() @> '{"phoneVerified":false,"completed":false}',
  'free practice does not claim verification or complete onboarding');
select pg_temp.practice_reject($sql$select public.start_exam_mock('uceed')$sql$,'Complete your verified profile first');
select set_config('request.jwt.claim.sub',:'peer',true);
select pg_temp.practice_reject($sql$select public.start_topic_practice('observation','uceed',10,900)$sql$,'Complete your verified profile first');
select pg_temp.practice_reject(format('select public.read_attempt(%L)',:'saved_attempt'),'Attempt not found');
reset role;
update dm_private.registration_policy set mode='testers' where id;
set local role authenticated;
select set_config('request.jwt.claim.sub',:'fresh',true);
select pg_temp.practice_reject($sql$select public.start_topic_practice('observation','uceed',10,900)$sql$,'Complete your verified profile first');
reset role;
select pg_temp.practice_assert(not exists(select 1 from dm_private.candidate_phone_challenges where actor_id=:'fresh'),
  'saving a profile and starting free practice require no SMS challenge');
set local role authenticated;
select set_config('request.jwt.claim.sub',:'first',true);
select pg_temp.practice_assert((select(value->>'questions')::integer=35 from jsonb_array_elements(public.topic_catalog())value
 where value->>'topic'='observation'and value->>'exam'='uceed'),'catalog counts match the eligible objective pool');
select pg_temp.practice_reject('select public.start_topic_practice(''observation'',''uceed'',null,900)','Invalid practice configuration');
select pg_temp.practice_reject('select public.start_topic_practice(''observation'',null,10,900)','Invalid practice configuration');
select pg_temp.practice_reject('select public.start_topic_practice(''observation'',''uceed'',10,null)','Invalid practice configuration');
select pg_temp.practice_reject('select public.start_topic_practice(null,''uceed'',10,900)','Invalid practice configuration');
select pg_temp.practice_reject('select public.start_topic_practice(''observation'',''uceed'',40,900)','Invalid practice configuration');
select pg_temp.practice_reject('select public.start_topic_practice(''observation'',''uceed'',10,60)','Invalid practice configuration');
select pg_temp.practice_reject('select public.start_topic_practice(''missing-topic'',''uceed'',10,900)','Not enough reviewed questions');
select set_config('test.practice_first',public.start_topic_practice('observation','uceed',10,900)::text,true);
select pg_temp.practice_assert((select jsonb_array_length(value->'questions')=10 and not exists(select 1 from jsonb_array_elements(value->'questions')q where q?'correctKey'or q?'explanation')
 from public.read_attempt(current_setting('test.practice_first')::uuid)value),'active practice contains ten frozen questions without keys');
select set_config('request.jwt.claim.sub',:'second',true);
select pg_temp.practice_reject('select public.read_attempt(current_setting(''test.practice_first'')::uuid)','Attempt not found');
select set_config('test.practice_peer',public.start_topic_practice('observation','uceed',10,900)::text,true);
reset role;
select pg_temp.practice_assert((select count(*)=10 and count(distinct key->>'sourceExternalKey')=10
 and min(split_part(key->>'sourceExternalKey','-',3)::integer)=26 and max(split_part(key->>'sourceExternalKey','-',3)::integer)=35
 from dm_private.attempt_items where attempt_id=current_setting('test.practice_first')::uuid),'first student gets all ten unseen questions');
select pg_temp.practice_assert((select count(*)=10 and min(split_part(key->>'sourceExternalKey','-',3)::integer)=1
 and max(split_part(key->>'sourceExternalKey','-',3)::integer)=10 from dm_private.attempt_items where attempt_id=current_setting('test.practice_peer')::uuid),
 'another student history cannot influence unseen selection');
select set_config('test.practice_deadline',(select deadline::text from dm_private.attempts where id=current_setting('test.practice_first')::uuid),true);
select set_config('test.practice_snapshot',(select jsonb_agg(jsonb_build_object('id',question_id,'prompt',prompt,'key',key,'points',points)order by ordinal)::text
 from dm_private.attempt_items where attempt_id=current_setting('test.practice_first')::uuid),true);
select pg_temp.practice_seed(36,40);
select pg_temp.release_bank_year(array(select 'unseen-fixture-'||n from generate_series(36,40)n),
  'uceed',2022,'unseen-uceed-2022');
set local role authenticated;
select set_config('request.jwt.claim.sub',:'first',true);
select set_config('test.practice_partial',public.start_topic_practice('observation','uceed',10,1800)::text,true);
select set_config('test.practice_repeat',public.start_topic_practice('observation','uceed',20,2700)::text,true);
select pg_temp.practice_reject('select public.start_topic_practice(''observation'',''uceed'',10,900)','Finish an active attempt');
reset role;
select pg_temp.practice_assert((select count(*)=10 and count(*)filter(where split_part(key->>'sourceExternalKey','-',3)::integer between 36 and 40)=5
 and count(distinct key->>'sourceExternalKey')=10 from dm_private.attempt_items where attempt_id=current_setting('test.practice_partial')::uuid),
 'a partially exhausted pool includes every unseen question before filling from prior deliveries');
select pg_temp.practice_assert((select count(*)=20 and count(distinct key->>'sourceExternalKey')=20
 from dm_private.attempt_items where attempt_id=current_setting('test.practice_repeat')::uuid),'a fully exhausted pool still supplies a duplicate-free randomized practice');
select pg_temp.practice_assert(not exists(select 1 from dm_private.attempt_items where attempt_id in(
 current_setting('test.practice_first')::uuid,current_setting('test.practice_peer')::uuid,current_setting('test.practice_partial')::uuid,current_setting('test.practice_repeat')::uuid)
 and(key->>'sourceExternalKey' like 'excluded-%' or kind not in('mcq','msq','nat'))),'ineligible, wrong-context and drawing rows remain excluded');
select pg_temp.practice_assert((select deadline-started_at=interval '15 minutes' from dm_private.attempts where id=current_setting('test.practice_first')::uuid)
 and(select deadline-started_at=interval '30 minutes' from dm_private.attempts where id=current_setting('test.practice_partial')::uuid)
 and(select deadline-started_at=interval '45 minutes' from dm_private.attempts where id=current_setting('test.practice_repeat')::uuid),'all three fixed timers are retained');
set local role authenticated;
do $$begin
 perform public.submit_attempt(current_setting('test.practice_first')::uuid);
 perform public.submit_attempt(current_setting('test.practice_partial')::uuid);
 perform public.submit_attempt(current_setting('test.practice_repeat')::uuid);
end $$;
select pg_temp.practice_assert((select count(*)=10 and bool_and(
  item->>'explanation'='Worked solution for fictional question '||
    substring(item->>'prompt' from '[0-9]+$')||'.')
  from jsonb_array_elements(public.read_attempt(current_setting('test.practice_first')::uuid)->'questions') item),
  'submitted practice returns each released paper solution for its matching question');
select set_config('test.practice_thirty',public.start_topic_practice('observation','uceed',30,900)::text,true);
select pg_temp.practice_assert(jsonb_array_length(public.read_attempt(current_setting('test.practice_thirty')::uuid)->'questions')=30,'thirty-question configuration remains supported');
select set_config('request.jwt.claim.sub',:'legacy',true);
select set_config('test.practice_legacy',public.start_topic_practice('observation','uceed',10,1800)::text,true);
select pg_temp.practice_reject('select * from dm_private.attempt_items','permission denied');
select pg_temp.practice_reject('select * from dm_private.bank_questions','permission denied');
reset role;
select pg_temp.practice_assert((select count(*)filter(where split_part(key->>'sourceExternalKey','-',3)::integer between 35 and 40)=6
 from dm_private.attempt_items where attempt_id=current_setting('test.practice_legacy')::uuid),'legacy snapshots without a source key do not invent a prior delivery identity');
update dm_private.bank_questions set active=false,runtime_payload=jsonb_set(runtime_payload,'{prompt}','"Revised fictional wording"')
 where external_key='unseen-fixture-26';
select pg_temp.practice_assert(not dm_private.released_year_topic_question('unseen-fixture-1'),
  'editing one source revokes its entire released year-paper practice pool');
select pg_temp.practice_assert((select deadline::text=current_setting('test.practice_deadline')from dm_private.attempts where id=current_setting('test.practice_first')::uuid)
 and(select jsonb_agg(jsonb_build_object('id',question_id,'prompt',prompt,'key',key,'points',points)order by ordinal)::text=current_setting('test.practice_snapshot')
 from dm_private.attempt_items where attempt_id=current_setting('test.practice_first')::uuid),'later bank edits do not change an existing snapshot or its clock');
rollback;
\echo 'PASS: owned unseen preference, partial/full fallback, legacy identities, exact counts/timers, access and quality gates, and frozen snapshots.'
