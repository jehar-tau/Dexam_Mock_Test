\set ON_ERROR_STOP on
begin;
\ir ../../supabase/launch/paid-mvp.sql
create function pg_temp.bind_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception'FAIL: %',label;end if;end$$;
create function pg_temp.bind_reject(statement text,expected_state text)returns void language plpgsql as $$begin
 begin execute statement;exception when others then if sqlstate=expected_state then return;end if;raise;end;
 raise exception'FAIL: expected SQLSTATE %',expected_state;
end$$;
insert into auth.users(id)values('00000000-0000-4000-8000-000000002251'),('00000000-0000-4000-8000-000000002252'),('00000000-0000-4000-8000-000000002253'),('00000000-0000-4000-8000-000000002254');
insert into dm_private.admins(user_id)values('00000000-0000-4000-8000-000000002251'),('00000000-0000-4000-8000-000000002252');
insert into dm_private.drawing_reviewers(user_id,enabled,changed_at)values('00000000-0000-4000-8000-000000002254',true,now());
select set_config('test.bind.payload','{"schemaVersion":"nid-authored-practice-v1","title":"Original fictional mixed practice","purpose":"An explicitly authored fictional practice scheme, never an official NID format.","durationMinutes":37,"uploadGraceMinutes":15,"sections":[{"label":"Observation","kind":"mcq","count":1,"points":2.5,"penalty":0.25,"rubric":[]},{"label":"Exact sets","kind":"msq","count":1,"points":4,"penalty":1,"rubric":[]},{"label":"Exact numbers","kind":"nat","count":1,"points":7,"penalty":0,"rubric":[]},{"label":"Visual practice","kind":"drawing","count":1,"points":0.3,"penalty":0,"rubric":[{"label":"Observation","points":0.1,"guidance":"Credit explicitly observed fictional spatial relationships."},{"label":"Communication","points":0.2,"guidance":"Credit clear fictional visual communication."}]},{"label":"Written practice","kind":"written","count":1,"points":10,"penalty":0,"rubric":[{"label":"Reasoning","points":10,"guidance":"Credit the explicitly explained original fictional reasoning."}]}]}',true);
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,source_commit)
select 'nid-binding-'||kind,repeat('a',64),'nid',case when kind in('drawing','written')then'DESCRIPTIVE'else upper(kind)end,'observation','owned',
 jsonb_build_object('externalKey','nid-binding-'||kind,'provenance',jsonb_build_object('exam','nid'),'type',case when kind in('drawing','written')then'DESCRIPTIVE'else upper(kind)end,
 'prompt','Original fictional '||kind||' practice task.','topic','observation','holds','[]'::jsonb,'assets','[]'::jsonb,'visualDependency',false,
 'options',case when kind in('mcq','msq')then'[{"key":"A","text":"Original first option"},{"key":"B","text":"Original second option"},{"key":"C","text":"Original third option"}]'::jsonb else'[]'::jsonb end,
 'answer',case when kind in('drawing','written')then'null'::jsonb else jsonb_build_object('status','human-reviewed','raw',case kind when'mcq'then'B'when'msq'then'BA'else'1.000000000000000001 or 1.000000000000000002'end)end),repeat('b',40)
from unnest(array['mcq','msq','nat','drawing','written'])kind;

set local role anon;
select pg_temp.bind_reject('select public.admin_nid_question_binding(''nid-binding-mcq'')','42501');
select pg_temp.bind_reject('select public.nid_practice_runtime_plan()','42501');
reset role;
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002253',true);
select pg_temp.bind_reject('select public.admin_nid_question_binding(''nid-binding-mcq'')','42501');
select pg_temp.bind_reject('select public.admin_bind_nid_question(''nid-binding-mcq'',null,gen_random_uuid(),1,repeat(''b'',64),1,''An original fictional practice fit review.'',gen_random_uuid())','42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002254',true);
select pg_temp.bind_reject('select public.admin_nid_question_binding(''nid-binding-mcq'')','42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002251',true);
select pg_temp.bind_reject('select *from dm_private.nid_question_binding_heads','42501');
select pg_temp.bind_reject('select public.nid_practice_runtime_plan()','42501');
select pg_temp.bind_reject('select public.upsert_nid_practice_runtime_batch(''[]'')','42501');
select set_config('test.bind.saved',public.admin_save_nid_practice_blueprint('10000000-0000-4000-8000-000000002251',0,current_setting('test.bind.payload')::jsonb,'20000000-0000-4000-8000-000000002251')::text,true);
select set_config('test.bind.sourceVersion',(select public.admin_search_bank_questions('nid',null,'all',null,'nid-binding-mcq')->'items'->0->>'reviewVersion'),true);
select pg_temp.bind_reject('select public.admin_bind_nid_question(''nid-binding-mcq'',current_setting(''test.bind.sourceVersion''),''10000000-0000-4000-8000-000000002251'',1,current_setting(''test.bind.saved'')::jsonb->>''sha256'',1,''An original fictional practice fit review.'',''30000000-0000-4000-8000-000000002251'')','40001');
select public.admin_review_nid_practice_blueprint('10000000-0000-4000-8000-000000002251',1,current_setting('test.bind.saved')::jsonb->>'sha256','reviewed','An original fictional authored practice scheme and rubrics reviewed.','40000000-0000-4000-8000-000000002251');
select pg_temp.bind_reject('select public.admin_bind_nid_question(''nid-binding-mcq'',current_setting(''test.bind.sourceVersion''),''10000000-0000-4000-8000-000000002251'',1,current_setting(''test.bind.saved'')::jsonb->>''sha256'',4,''An original fictional incompatible section review.'',gen_random_uuid())','22023');
reset role;
do $$declare original jsonb;bad jsonb;version text;begin
 select payload into original from dm_private.bank_questions where external_key='nid-binding-mcq';
 for bad in select value from jsonb_array_elements(jsonb_build_array(jsonb_set(original,'{answer,status}','"pending"'),jsonb_set(original,'{answer,raw}','null'),
  jsonb_set(original,'{options,0,key}','"B"'),jsonb_set(original,'{visualDependency}','true'),jsonb_set(original,'{assets}','[{"sha256":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","width":1,"height":1}]')))loop
  update dm_private.bank_questions set payload=bad where external_key='nid-binding-mcq';
  select dm_private.bank_review_version(q)into version from dm_private.bank_questions q where external_key='nid-binding-mcq';
  perform pg_temp.bind_reject(format('select public.admin_bind_nid_question(%L,%L,%L::uuid,1,%L,1,%L,gen_random_uuid())','nid-binding-mcq',version,'10000000-0000-4000-8000-000000002251',current_setting('test.bind.saved')::jsonb->>'sha256','Original fictional incomplete-source fit review.'),'22023');
 end loop;
 update dm_private.bank_questions set payload=original where external_key='nid-binding-mcq';
end$$;
set local role authenticated;
select set_config('test.bind.result',public.admin_bind_nid_question('nid-binding-mcq',current_setting('test.bind.sourceVersion'),'10000000-0000-4000-8000-000000002251',1,current_setting('test.bind.saved')::jsonb->>'sha256',1,'Original fictional task fits this authored observation section.','30000000-0000-4000-8000-000000002251')::text,true);
select pg_temp.bind_assert(public.admin_bind_nid_question('nid-binding-mcq',current_setting('test.bind.sourceVersion'),'10000000-0000-4000-8000-000000002251',1,current_setting('test.bind.saved')::jsonb->>'sha256',1,'Original fictional task fits this authored observation section.','30000000-0000-4000-8000-000000002251')=current_setting('test.bind.result')::jsonb,'exact committed bind replay does not create another history row');
select pg_temp.bind_assert(public.admin_nid_question_binding('nid-binding-mcq',null,'30000000-0000-4000-8000-000000002251')->'requestResult'=current_setting('test.bind.result')::jsonb,'read-only lost reply recovery');
select pg_temp.bind_assert(public.admin_nid_question_binding('nid-binding-mcq')->'canConvert'='true'::jsonb and public.admin_nid_question_binding('nid-binding-mcq')->'materialized'='false'::jsonb,'binding alone does not materialize or approve');
select pg_temp.bind_reject('select public.admin_review_bank_question(''nid-binding-mcq'',true,true,''Original fictional question review.'',current_setting(''test.bind.result'')::jsonb->>''reviewVersion'')','40001');
select pg_temp.bind_reject('select public.admin_bind_nid_question(''nid-binding-mcq'',current_setting(''test.bind.sourceVersion''),''10000000-0000-4000-8000-000000002251'',1,current_setting(''test.bind.saved'')::jsonb->>''sha256'',1,''An original fictional stale fit review.'',gen_random_uuid())','40001');

do $$declare kind text;section_n integer:=1;k text;version text;begin
 foreach kind in array array['mcq','msq','nat','drawing','written']loop
  k:='nid-binding-'||kind;
  if kind<>'mcq'then
   version:=public.admin_search_bank_questions('nid',null,'all',null,k)->'items'->0->>'reviewVersion';
   perform public.admin_bind_nid_question(k,version,'10000000-0000-4000-8000-000000002251',1,current_setting('test.bind.saved')::jsonb->>'sha256',section_n,'Original fictional task and response fit reviewed against this authored section.',gen_random_uuid());
  end if;section_n:=section_n+1;
 end loop;
end$$;
reset role;
select pg_temp.bind_assert((select count(*)=5 from dm_private.nid_question_bindings),'five exact bindings; no duplicate history from replay');
select pg_temp.bind_assert(not exists(select 1 from dm_private.bank_questions where exam='nid'and(runtime_payload is not null or owner_approved or rights_confirmed)),'no implicit materialization/approval');
set local role service_role;select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.bind_reject('select public.admin_nid_question_binding(''nid-binding-mcq'')','42501');
select pg_temp.bind_reject('select *from dm_private.nid_question_bindings','42501');
select set_config('test.bind.plan',public.nid_practice_runtime_plan()::text,true);
select pg_temp.bind_assert(jsonb_array_length(current_setting('test.bind.plan')::jsonb->'items')=5,'service-only complete bounded plan');
select pg_temp.bind_assert(jsonb_array_length(public.nid_practice_runtime_plan(null,2)->'items')=2 and public.nid_practice_runtime_plan(null,2)->>'nextKey'='nid-binding-mcq','bounded lexical cursor');
select pg_temp.bind_reject('select public.nid_practice_runtime_plan(null,101)','22023');
select set_config('test.bind.records',(select jsonb_agg(jsonb_build_object('externalKey',x->>'externalKey','contentSha256',x->>'contentSha256','bindingId',x->'binding'->>'id','runtime',x->'runtime'))::text from jsonb_array_elements(current_setting('test.bind.plan')::jsonb->'items')x),true);
select pg_temp.bind_assert(public.upsert_nid_practice_runtime_batch(current_setting('test.bind.records')::jsonb)=5,'guarded service materialization');
select pg_temp.bind_assert(public.upsert_nid_practice_runtime_batch(current_setting('test.bind.records')::jsonb)=5,'exact conversion replay');
select pg_temp.bind_reject('select public.upsert_nid_practice_runtime_batch(jsonb_set(current_setting(''test.bind.records'')::jsonb,''{0,runtime,points}'',''99''))','40001');
select pg_temp.bind_reject('select public.upsert_nid_practice_runtime_batch(jsonb_set(current_setting(''test.bind.records'')::jsonb,''{0,bindingId}'',to_jsonb(gen_random_uuid())))','40001');
select pg_temp.bind_reject('select public.upsert_question_bank_runtime_batch(current_setting(''test.bind.records'')::jsonb)','P0001');
reset role;
select pg_temp.bind_assert((select runtime_payload->'key'->'correct'='["B"]'::jsonb and jsonb_array_length(runtime_payload->'options')=3 and runtime_payload->'points'='2.5'::jsonb and runtime_payload->'negativePoints'='0.25'::jsonb from dm_private.bank_questions where external_key='nid-binding-mcq'),'three canonical choices and authored marking preserved');
select pg_temp.bind_assert((select runtime_payload->'key'->'correct'='["A","B"]'::jsonb and not(runtime_payload->'marking'?'partial')from dm_private.bank_questions where external_key='nid-binding-msq'),'exact-set practice never inherits IIT partial credit');
select pg_temp.bind_assert((select runtime_payload->'key'->'accepted'='[{"exact":"1.000000000000000001"},{"exact":"1.000000000000000002"}]'::jsonb from dm_private.bank_questions where external_key='nid-binding-nat'),'two exact adjacent decimal strings');
select pg_temp.bind_assert((select runtime_payload->'context'->'rubric'->0->>'points'='0.1'and runtime_payload->'context'->>'durationSeconds'='2220'and runtime_payload->'context'->>'uploadGraceSeconds'='900'and runtime_payload->'media'='[]'::jsonb from dm_private.bank_questions where external_key='nid-binding-drawing'),'authored rubric/clock and a text-only drawing task without a borrowed figure requirement');
select pg_temp.bind_assert((select runtime_payload->'context'->>'responseKind'='written'from dm_private.bank_questions where external_key='nid-binding-written'),'written pages remain an explicit authored response kind');
select pg_temp.bind_assert(not exists(select 1 from dm_private.bank_questions where exam='nid'and(owner_approved or rights_confirmed)),'conversion alone never approves');

set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002251',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002253',true);
select pg_temp.bind_reject('select public.admin_nid_question_binding(''nid-binding-mcq'',null,''30000000-0000-4000-8000-000000002251'')','42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002251',true);
select public.admin_review_bank_question('nid-binding-mcq',true,true,'Original fictional source, answer and authored practice context reviewed.',public.admin_nid_question_binding('nid-binding-mcq')->>'reviewVersion');
reset role;
-- Original unpublished fixture snapshots only, created by the test operator.
-- No student start/release/payment API is invoked or broadened for NID.
insert into dm_private.papers(id,title,exam,duration_seconds)values('90000000-0000-4000-8000-000000002251','Original fictional frozen practice fixture','nid',2220);
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
select case external_key when'nid-binding-mcq'then'91000000-0000-4000-8000-000000002251'::uuid else'91000000-0000-4000-8000-000000002252'::uuid end,
 '90000000-0000-4000-8000-000000002251',case external_key when'nid-binding-mcq'then 1 else 2 end,runtime_payload->>'prompt',runtime_payload->'options',runtime_payload->>'kind',runtime_payload->'marking',runtime_payload->'media',
 (runtime_payload->>'points')::numeric,(runtime_payload->>'negativePoints')::numeric,topic,true from dm_private.bank_questions where external_key in('nid-binding-mcq','nid-binding-drawing');
insert into dm_private.answer_keys(question_id,key,explanation)
select q.id,b.runtime_payload->'key',b.runtime_payload->>'explanation'from dm_private.questions q join dm_private.bank_questions b on b.external_key=case q.ordinal when 1 then'nid-binding-mcq'else'nid-binding-drawing'end where q.paper_id='90000000-0000-4000-8000-000000002251';
insert into dm_private.attempts(id,user_id,paper_id,status,deadline,submitted_at,score,total)values('92000000-0000-4000-8000-000000002253','00000000-0000-4000-8000-000000002253','90000000-0000-4000-8000-000000002251','submitted',now()+interval'37 minutes',now(),0,2.8);
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,key,explanation)
select '92000000-0000-4000-8000-000000002253',q.id,q.ordinal,q.prompt,q.options,q.kind,q.marking,q.media,q.points,q.negative_points,q.topic,k.key,k.explanation
 from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.paper_id='90000000-0000-4000-8000-000000002251';
select set_config('test.bind.frozen',(select md5(jsonb_build_object('paper',(select to_jsonb(p)from dm_private.papers p where id='90000000-0000-4000-8000-000000002251'),
 'questions',(select jsonb_agg(to_jsonb(q)order by ordinal)from dm_private.questions q where paper_id='90000000-0000-4000-8000-000000002251'),
 'attempt',(select to_jsonb(a)from dm_private.attempts a where id='92000000-0000-4000-8000-000000002253'),
 'items',(select jsonb_agg(to_jsonb(i)order by ordinal)from dm_private.attempt_items i where attempt_id='92000000-0000-4000-8000-000000002253'))::text)),true);
set local role service_role;select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.bind_assert(public.upsert_question_bank_runtime_batch('[{"externalKey":"nid-binding-mcq","contentSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","runtime":null}]')=1,'legacy full-bank null replay preserves an exact current practice conversion');
reset role;
select pg_temp.bind_assert((select runtime_payload is not null and owner_approved and rights_confirmed from dm_private.bank_questions where external_key='nid-binding-mcq'),'legacy replay preserves the exact human approval');
-- A changed source with even an erroneously unchanged declared hash invalidates.
update dm_private.bank_questions set payload=jsonb_set(payload,'{prompt}','"Changed original fictional prompt."')where external_key='nid-binding-mcq';
select pg_temp.bind_assert((select runtime_payload is null and not owner_approved and not rights_confirmed from dm_private.bank_questions where external_key='nid-binding-mcq'),'source fingerprint resets conversion and approval');
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002252',true);
select pg_temp.bind_assert(public.admin_nid_question_binding('nid-binding-mcq',null,'30000000-0000-4000-8000-000000002251')->'requestResult'='null'::jsonb,'another admin cannot recover the actor-bound request');
select pg_temp.bind_reject('select public.admin_bind_nid_question(''nid-binding-mcq'',current_setting(''test.bind.sourceVersion''),''10000000-0000-4000-8000-000000002251'',1,current_setting(''test.bind.saved'')::jsonb->>''sha256'',1,''Original fictional task fits this authored observation section.'',''30000000-0000-4000-8000-000000002251'')','40001');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002251',true);
select pg_temp.bind_assert(public.admin_nid_question_binding('nid-binding-mcq')->'binding'->'current'='false'::jsonb,'old binding is explicitly stale after a source change');
select set_config('test.bind.writtenVersion',public.admin_nid_question_binding('nid-binding-written')->>'reviewVersion',true);
select public.admin_save_nid_practice_blueprint('10000000-0000-4000-8000-000000002251',1,jsonb_set(current_setting('test.bind.payload')::jsonb,'{durationMinutes}','38'),gen_random_uuid());
reset role;
select pg_temp.bind_assert(not exists(select 1 from dm_private.bank_questions where exam='nid'and(runtime_payload is not null or owner_approved or rights_confirmed)),'editing a bound design invalidates every dependent current conversion and approval');
select pg_temp.bind_assert((select count(*)=5 from dm_private.nid_question_bindings),'invalidation preserves immutable binding history');
set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.bind_assert(public.admin_nid_practice_blueprint('10000000-0000-4000-8000-000000002251',1)->'item'->>'status'='reviewed','the old blueprint review remains historical');
select pg_temp.bind_reject('select public.admin_review_bank_question(''nid-binding-written'',true,true,''An original fictional stale question review.'',current_setting(''test.bind.writtenVersion''))','40001');
select pg_temp.bind_reject('select public.admin_review_bank_question(''nid-binding-written'',true,true,''An original fictional unconverted review.'',public.admin_nid_question_binding(''nid-binding-written'')->>''reviewVersion'')','40001');
reset role;
delete from dm_private.admins where user_id='00000000-0000-4000-8000-000000002251';
set local role authenticated;
select pg_temp.bind_reject('select public.admin_nid_question_binding(''nid-binding-mcq'')','42501');
select pg_temp.bind_reject('select public.admin_bind_nid_question(''nid-binding-mcq'',current_setting(''test.bind.sourceVersion''),''10000000-0000-4000-8000-000000002251'',1,current_setting(''test.bind.saved'')::jsonb->>''sha256'',1,''Original fictional task fits this authored observation section.'',''30000000-0000-4000-8000-000000002251'')','42501');
reset role;
select pg_temp.bind_assert(dm_private.mvp_profile_permissions_valid(),'47-signature default-deny MVP profile remains exact');
select pg_temp.bind_assert(current_setting('test.bind.frozen')=(select md5(jsonb_build_object('paper',(select to_jsonb(p)from dm_private.papers p where id='90000000-0000-4000-8000-000000002251'),
 'questions',(select jsonb_agg(to_jsonb(q)order by ordinal)from dm_private.questions q where paper_id='90000000-0000-4000-8000-000000002251'),
 'attempt',(select to_jsonb(a)from dm_private.attempts a where id='92000000-0000-4000-8000-000000002253'),
 'items',(select jsonb_agg(to_jsonb(i)order by ordinal)from dm_private.attempt_items i where attempt_id='92000000-0000-4000-8000-000000002253'))::text)),'source/design invalidation preserves all frozen paper, response, key, rubric and clock snapshots');
select pg_temp.bind_assert((select key->'practiceContext'->'rubric'->0->>'points'='0.1'and key->'practiceContext'->>'blueprintRevision'='1'from dm_private.attempt_items where attempt_id='92000000-0000-4000-8000-000000002253'and ordinal=2),'the old authored rubric is frozen in the existing key snapshot path');
select pg_temp.bind_assert((select count(*)=1 and bool_and(not published)from dm_private.papers where exam='nid')and(select count(*)=1 from dm_private.attempts)and not exists(select 1 from dm_private.passes)and(select not sales_enabled from public.launch_settings where singleton),'only the explicit unpublished fixture exists; no publication, entitlement or launch switch');
rollback;
