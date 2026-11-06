-- Original fixtures only. No real bank data; every change rolls back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.runtime_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.runtime_reject(statement text,label text) returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'FAIL, unexpectedly allowed: %',label;end$$;
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,source_commit)
values('runtime-original',repeat('a',64),'uceed','MCQ','fixture','dexam-original',jsonb_build_object('externalKey','runtime-original','prompt','Original geometry fixture','holds','[]'::jsonb,'options','[{"key":"A","text":"One"},{"key":"B","text":"Two"},{"key":"C","text":"Three"},{"key":"D","text":"Four"}]'::jsonb,'assets',jsonb_build_array(jsonb_build_object('sha256',repeat('b',64),'width',1,'height',1,'path','original/fixture.png')),'visualDependency',true),repeat('c',40));
insert into storage.objects(bucket_id,name,metadata)values('paper-media','papers/canonical/'||repeat('b',64)||'.png','{"mimetype":"image/png","size":68}');
select set_config('test.runtime_record',jsonb_build_array(jsonb_build_object('externalKey','runtime-original','contentSha256',repeat('a',64),'runtime',jsonb_build_object('context','{"version":"iitb-2027-v1","cycle":2027,"exam":"uceed"}'::jsonb,'prompt','Original geometry fixture','kind','mcq','options','[{"id":"A","label":"One"},{"id":"B","label":"Two"},{"id":"C","label":"Three"},{"id":"D","label":"Four"}]'::jsonb,'key','{"kind":"mcq","correct":["A"],"sourceExternalKey":"runtime-original"}'::jsonb,'media',jsonb_build_array(jsonb_build_object('path','papers/canonical/'||repeat('b',64)||'.png','sha256',repeat('b',64),'width',1,'height',1)),'marking','{"correct":3,"wrong":-0.71}'::jsonb,'points',3,'negativePoints',0.71,'topic','fixture','explanation','Original explanation')))::text,true);
set local role authenticated;
select pg_temp.runtime_reject('select public.upsert_question_bank_runtime_batch(current_setting(''test.runtime_record'')::jsonb)','student cannot materialize runtime');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.runtime_reject('select public.upsert_question_bank_runtime_batch(current_setting(''test.runtime_record'')::jsonb)','unregistered figure rejected');
select public.register_bank_media_assets(jsonb_build_array(jsonb_build_object('sha256',repeat('b',64),'storagePath','papers/canonical/'||repeat('b',64)||'.png','width',1,'height',1,'byteSize',68)));
select pg_temp.runtime_assert(public.upsert_question_bank_runtime_batch(current_setting('test.runtime_record')::jsonb)=1,'verified runtime accepted');
select pg_temp.runtime_reject('select public.upsert_question_bank_runtime_batch(jsonb_set(current_setting(''test.runtime_record'')::jsonb,''{0,runtime,marking,wrong}'',''0''))','implicit zero negative marking rejected');
select pg_temp.runtime_reject('select public.upsert_question_bank_runtime_batch(jsonb_set(current_setting(''test.runtime_record'')::jsonb,''{0,runtime,context,cycle}'',''2026''))','wrong cycle rejected');
select pg_temp.runtime_reject('select public.upsert_question_bank_runtime_batch(jsonb_set(current_setting(''test.runtime_record'')::jsonb,''{0,runtime,media,0,path}'',''"papers/other.png"''))','unverified path rejected');
select pg_temp.runtime_reject('select public.upsert_question_bank_runtime_batch(jsonb_set(current_setting(''test.runtime_record'')::jsonb,''{0,runtime,key,correct}'',''["Z"]''))','unknown option key rejected');
select pg_temp.runtime_reject('select public.upsert_question_bank_runtime_batch(jsonb_set(current_setting(''test.runtime_record'')::jsonb,''{0,runtime,options,0,label}'',''"Changed"''))','changed canonical option rejected');
reset role;
update dm_private.bank_questions set owner_approved=true,rights_confirmed=true where external_key='runtime-original';
set local role service_role;
select public.upsert_question_bank_runtime_batch(current_setting('test.runtime_record')::jsonb);
reset role;
select pg_temp.runtime_assert((select owner_approved and rights_confirmed from dm_private.bank_questions where external_key='runtime-original'),'identical runtime replay preserves prior approval');
set local role service_role;
select public.upsert_question_bank_runtime_batch(jsonb_set(current_setting('test.runtime_record')::jsonb,'{0,runtime,explanation}','"Revised explanation"'));
reset role;
select pg_temp.runtime_assert((select not owner_approved and not rights_confirmed and reviewed_by is null and reviewed_at is null from dm_private.bank_questions where external_key='runtime-original'),'runtime change invalidates approval without altering existing snapshots');
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,source_commit)
values('runtime-nat',repeat('d',64),'ceed','NAT','fixture','dexam-original','{"externalKey":"runtime-nat","prompt":"Original numeric fixture","holds":[],"assets":[],"options":[]}',repeat('c',40));
select set_config('test.nat_runtime',jsonb_build_array(jsonb_build_object('externalKey','runtime-nat','contentSha256',repeat('d',64),'runtime',jsonb_build_object('context','{"version":"iitb-2027-v1","cycle":2027,"exam":"ceed"}'::jsonb,'prompt','Original numeric fixture','kind','nat','options','[]'::jsonb,'key','{"kind":"nat","accepted":[{"range":["1.95","2.05"]}],"sourceExternalKey":"runtime-nat"}'::jsonb,'media','[]'::jsonb,'marking','{"correct":4,"wrong":0}'::jsonb,'points',4,'negativePoints',0)))::text,true);
set local role service_role;
select public.upsert_question_bank_runtime_batch(current_setting('test.nat_runtime')::jsonb);
select pg_temp.runtime_reject('select public.upsert_question_bank_runtime_batch(jsonb_set(current_setting(''test.nat_runtime'')::jsonb,''{0,runtime,key,accepted}'',''[{"range":["2.05","1.95"]}]''))','reversed numeric range rejected');
select pg_temp.runtime_reject('select public.upsert_question_bank_runtime_batch(jsonb_set(current_setting(''test.nat_runtime'')::jsonb,''{0,runtime,key,accepted}'',''[{"exact":"NaN"}]''))','non-finite numeric key rejected');
reset role;
-- Exhaust all non-empty correct sets and every response set for the verified MSQ ladder.
do $$declare correct_mask integer;chosen_mask integer;correct_ids jsonb;chosen_ids jsonb;expected numeric;actual numeric;chosen_count integer;begin
 for correct_mask in 1..15 loop
  select jsonb_agg(chr(65+i)) into correct_ids from generate_series(0,3)i where (correct_mask & (1<<i))<>0;
  for chosen_mask in 0..15 loop
   select coalesce(jsonb_agg(chr(65+i)),'[]'::jsonb),count(*) into chosen_ids,chosen_count from generate_series(0,3)i where (chosen_mask & (1<<i))<>0;
   expected:=case when chosen_mask=0 then 0 when chosen_mask=correct_mask then 4 when (chosen_mask & correct_mask)=chosen_mask then chosen_count else -1 end;
   select marks into actual from dm_private.score_response('msq',jsonb_build_object('kind','msq','correct',correct_ids),chosen_ids,'{"correct":4,"wrong":-1,"partial":true}');
   perform pg_temp.runtime_assert(actual=expected,'MSQ full/subset/incorrect/unanswered ladder');
  end loop;
 end loop;
end$$;
select pg_temp.runtime_assert((select marks=3 from dm_private.score_response('mcq','{"kind":"mcq","correct":["A"]}','"A"','{"correct":3,"wrong":-0.71}')),'UCEED correct points');
select pg_temp.runtime_assert((select marks=-0.71 from dm_private.score_response('mcq','{"kind":"mcq","correct":["A"]}','"B"','{"correct":3,"wrong":-0.71}')),'UCEED decimal penalty');
select pg_temp.runtime_assert((select marks=-0.5 from dm_private.score_response('mcq','{"kind":"mcq","correct":["A"]}','"B"','{"correct":3,"wrong":-0.5}')),'CEED decimal penalty');
select pg_temp.runtime_assert((select marks=4 from dm_private.score_response('nat','{"kind":"nat","accepted":[{"exact":"1.234567890123456789"}]}','"1.234567890123456789"','{"correct":4,"wrong":0}')),'exact decimal precision');
select pg_temp.runtime_assert((select marks=4 from dm_private.score_response('nat','{"kind":"nat","accepted":[{"range":["1.95","2.05"]}]}','"2.05"','{"correct":4,"wrong":0}')),'inclusive accepted range');
select pg_temp.runtime_assert((select marks=0 from dm_private.score_response('nat','{"kind":"nat","accepted":[{"range":["1.95","2.05"]}]}','"2.051"','{"correct":4,"wrong":0}')),'no invented tolerance');
rollback;
\echo 'PASS: verified runtime media/scoring, approval invalidation and exhaustive IIT MSQ ladder.'
