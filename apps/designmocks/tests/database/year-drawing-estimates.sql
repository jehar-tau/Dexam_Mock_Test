\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_score(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',message; end if; end $$;
create function pg_temp.reject_score(command text, expected text) returns void language plpgsql as $$
begin
  begin execute command; exception when others then if sqlstate=expected then return; end if; raise; end;
  raise exception 'Expected % for %', expected, command;
end $$;
\set owner '00000000-0000-4000-8000-000000002587'
\set other '00000000-0000-4000-8000-000000002588'
\set paper '10000000-0000-4000-8000-000000002587'
\set task '20000000-0000-4000-8000-000000002587'
\set empty_task '20000000-0000-4000-8000-000000002588'
\set attempt '30000000-0000-4000-8000-000000002587'
\set path 'drawings/50000000-0000-4000-8000-000000002587.jpg'
select 'qwen2.5vl:3b@'||repeat('a',64) as gate,'qwen2.5vl:7b@'||repeat('b',64) as scorer,repeat('c',64) as calibration \gset
select pg_temp.assert_score(
  not has_function_privilege(role_name,'public.service_claim_year_drawing(text,text,text)','execute')
  and not has_function_privilege(role_name,'public.service_year_drawing_context(uuid)','execute')
  and not has_function_privilege(role_name,'public.service_finish_year_drawing(uuid,text,jsonb)','execute')
  and not has_function_privilege(role_name,'dm_private.year_drawing_estimate(uuid,uuid)','execute')
  and not has_table_privilege(role_name,'dm_private.year_drawing_jobs','select'), role_name||' cannot read jobs or save model outputs')
from unnest(array['anon','authenticated']) role_name;
select pg_temp.assert_score(not has_function_privilege('anon','public.reevaluate_year_drawing(uuid,uuid)','execute'), 'sign-in required');
insert into auth.users(id) values(:'owner'),(:'other');
insert into dm_private.papers(id,title,exam,duration_seconds) values(:'paper','Fictional year drawing fixture','ceed',10800);
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,points,topic)
values (:'task',:'paper',1,'Fictional task','[]','drawing','{"correct":5,"wrong":0}',5,'drawing'),
       (:'empty_task',:'paper',2,'Fictional unanswered task','[]','drawing','{"correct":5,"wrong":0}',5,'drawing');
insert into dm_private.attempts(id,user_id,paper_id,deadline) values(:'attempt',:'owner',:'paper',now()+interval '1 hour');
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,key,explanation)
select :'attempt',id,ordinal,prompt,options,kind,marking,'[]',points,0,topic,
  '{"drawing":{"maxImages":3,"criteria":[{"id":"line","label":"Line","max":5}],"instructions":[]}}','Fictional explanation'
from dm_private.questions where paper_id=:'paper';
insert into storage.objects(bucket_id,name,metadata) values('drawing-submissions',:'path','{"mimetype":"image/jpeg","size":108}');
insert into dm_private.drawing_uploads(attempt_id,question_id,student_id,storage_path,ordinal,mime_type,byte_size,pixel_width,pixel_height,image_orientation)
values (:'attempt',:'task',:'owner',:'path',1,'image/jpeg',108,80,40,1);
select pg_temp.assert_score(dm_private.year_drawing_estimate(:'attempt',:'task') is null,'active attempts have no estimate');
update dm_private.attempts set status='submitted',submitted_at=now(),score=0,total=5 where id=:'attempt';
select pg_temp.assert_score(dm_private.year_drawing_estimate(:'attempt',:'task')->>'status'='awaiting_teacher','uncalibrated idle default');
select pg_temp.assert_score(dm_private.year_drawing_estimate(:'attempt',:'empty_task')->>'status'='not_attempted','no photo scores zero');
select pg_temp.assert_score((select count(*)=1 from dm_private.year_drawing_jobs where attempt_id=:'attempt'),'only photographed task queued');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.service_claim_year_drawing(:'gate',null,null) as lease \gset
select public.service_year_drawing_context(:'lease')->>'contextSha256' as context \gset
select pg_temp.assert_score(public.service_claim_year_drawing(:'gate',null,null) is null,'one lease only');
select pg_temp.reject_score(format('select public.service_finish_year_drawing(%L,%L,%L)',:'lease',:'context',
  '{"status":"ready","criteria":[{"id":"line","score":5,"reason":"Fictional."}],"flags":[],"summary":"Fixture."}'),'22023');
select pg_temp.assert_score(public.service_finish_year_drawing(:'lease',:'context','{"status":"awaiting_teacher","flags":["not_a_drawing"],"total":205}'),'gatekeeper-only result');
reset role;
select pg_temp.assert_score(dm_private.year_drawing_estimate(:'attempt',:'task') =
  '{"flags":[],"status":"awaiting_teacher","canReevaluate":false}'::jsonb,'an uncalibrated negative judgment never reaches the student');
select pg_temp.assert_score((select result->'flags' from dm_private.year_drawing_jobs where attempt_id=:'attempt' and question_id=:'task')='["not_a_drawing"]','operator evidence remains private');
set local role service_role;
select pg_temp.assert_score(public.service_claim_year_drawing(:'gate',:'scorer',:'calibration') is null,'register calibrated pair subsequently');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',:'other',true);
select pg_temp.reject_score(format('select public.reevaluate_year_drawing(%L,%L)',:'attempt',:'task'),'42501');
select set_config('request.jwt.claim.sub',:'owner',true);
select pg_temp.assert_score(public.reevaluate_year_drawing(:'attempt',:'task')->>'status'='evaluating','owner can retry one time');
select pg_temp.reject_score(format('select public.reevaluate_year_drawing(%L,%L)',:'attempt',:'task'),'55000');
reset role;
set local role service_role;
select public.service_claim_year_drawing(:'gate',:'scorer',:'calibration') as lease \gset
select public.service_year_drawing_context(:'lease')->>'contextSha256' as context \gset
select pg_temp.reject_score(format('select public.service_finish_year_drawing(%L,%L,%L)',:'lease',repeat('e',64),
  '{"status":"ready","flags":[]}'),'40001');
select pg_temp.assert_score(public.service_finish_year_drawing(:'lease',:'context',
  '{"status":"ready","criteria":[{"id":"line","score":50,"reason":"Fictional."}],"flags":["illegible"],"summary":"Fixture.","total":200}'),'stored validated grade');
select pg_temp.assert_score(not public.service_finish_year_drawing(:'lease',null,'{"status":"unavailable","flags":[]}'),'stale lease ignored');
reset role;
select pg_temp.assert_score((dm_private.year_drawing_estimate(:'attempt',:'task')->>'total')::numeric=5
  and (dm_private.year_drawing_estimate(:'attempt',:'task')->>'canReevaluate')::boolean=false,'server clamps score and never trusts suggested total');
set local role service_role;
select public.service_claim_year_drawing(:'gate',:'scorer',null);
reset role;
select pg_temp.assert_score(not dm_private.year_drawing_estimate(:'attempt',:'task') ? 'total'
  and dm_private.year_drawing_estimate(:'attempt',:'task')->'flags'='[]','model recalibration hides stale scores and labels');
-- An elective may be unselected under the historical-paper rules; verify the runtime hook is honored.
create or replace function dm_private.year_drawing_task_selected(p_attempt_id uuid,p_question_id uuid) returns boolean
language sql stable set search_path=pg_catalog as $$ select false $$;
select pg_temp.assert_score(dm_private.year_drawing_estimate(:'attempt',:'task') is null,'unselected elective has no result card');
delete from dm_private.year_drawing_jobs where attempt_id=:'attempt';
update dm_private.attempts set status='active',submitted_at=null where id=:'attempt';
update dm_private.attempts set status='submitted',submitted_at=now() where id=:'attempt';
select pg_temp.assert_score(not exists(select from dm_private.year_drawing_jobs where attempt_id=:'attempt'),'unselected elective has no worker job');
rollback;
