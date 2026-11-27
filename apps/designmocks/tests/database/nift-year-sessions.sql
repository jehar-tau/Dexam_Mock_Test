\set ON_ERROR_STOP on
begin;
create function pg_temp.nift_year_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',message; end if; end $$;
create function pg_temp.nift_year_reject(command text,expected text) returns void language plpgsql as $$
begin begin execute command; exception when others then if sqlstate=expected then return; end if; raise; end; raise exception 'Expected %',expected; end $$;
\set student '00000000-0000-4000-8000-000000000391'
\set other '00000000-0000-4000-8000-000000000392'
\set paper '10000000-0000-4000-8000-000000000391'
\set version '10000000-0000-4000-8000-000000000392'
\set gat '20000000-0000-4000-8000-000000000391'
\set cat '20000000-0000-4000-8000-000000000392'
\set attempt '30000000-0000-4000-8000-000000000391'
\set natural '30000000-0000-4000-8000-000000000392'
\set sections '[{"plan":"objective","label":"GAT","durationSeconds":7200,"uploadGraceSeconds":0},{"startsAfter":"GAT","durationSeconds":10800,"questionKeys":["b1","b2","b3"]}]'
select pg_temp.nift_year_assert(dm_private.year_drawing_duration_ok(jsonb_build_object('exam','nift','timer','separate','durationSeconds',18000,
 'sections',:'sections'::jsonb,'items','[{"externalKey":"b1"},{"externalKey":"b2"},{"externalKey":"b3"}]'::jsonb,'drawingMarksTotal',100,'uploadGraceSeconds',600)),'private installer accepts NIFT plan');
select pg_temp.nift_year_assert(not has_function_privilege('anon','public.finish_nift_year_gat(uuid)','execute') and
 not has_function_privilege('authenticated','dm_private.submit_attempt_before_nift_sessions(uuid)','execute') and
 not has_function_privilege('authenticated','dm_private.read_attempt_before_nift_sessions(uuid)','execute'),'only guarded RPCs available');
insert into auth.users(id) values(:'student'),(:'other');
insert into dm_private.papers(id,title,exam,duration_seconds) values(:'paper','Fictional GAT','nift',7200),(:'version','Fictional CAT','nift',18000);
insert into dm_private.year_paper_releases(paper_id,exam,paper_year,source_paper_id,part_label,question_count,review_sha256)
 values(:'paper','nift',2023,'fictional-nift-gat','GAT',1,repeat('a',64));
insert into dm_private.year_drawing_versions(id,paper_id,objective_manifest,drawing_digest,duration_seconds,grace_seconds,marks,sections,active)
 values(:'version',:'paper',repeat('a',64),repeat('b',64),18000,600,100,:'sections',true);
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,points,topic) values
 (:'gat',:'paper',1,'Fictional GAT prompt','["A","B"]','mcq','{"correct":1,"wrong":0}',1,'topic'),
 (:'cat',:'version',1,'Fictional CAT prompt','[]','drawing','{"max":30}',30,'topic');
insert into dm_private.attempts(id,user_id,paper_id,started_at,deadline,year_drawing_version) values
 (:'attempt',:'student',:'paper',now(),now(),:'version'),(:'natural',:'student',:'paper',now()-interval '125 minutes',now(),:'version');
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,key,explanation)
select a.id,q.id,case q.kind when 'drawing' then 2 else 1 end,q.prompt,q.options,q.kind,q.marking,'[]',q.points,0,q.topic,
 case q.kind when 'drawing' then '{"kind":"drawing","drawing":{"maxImages":3}}'::jsonb else '{"value":"A"}'::jsonb end,'Fictional explanation'
from dm_private.questions q cross join dm_private.attempts a where a.id in (:'attempt',:'natural') and q.id in (:'cat',:'gat');
select pg_temp.nift_year_assert((select nift_gat_ends_at=started_at+interval '120 minutes' and deadline=nift_gat_ends_at+interval '180 minutes'
 and upload_deadline=deadline+interval '10 minutes' from dm_private.attempts where id=:'attempt'),'immutable start/current time');
set local role authenticated;
select set_config('request.jwt.claim.sub',:'student',true);
select public.read_attempt(:'attempt') as initial \gset
select pg_temp.nift_year_assert(:'initial'::jsonb#>>'{niftSession,phase}'='gat' and :'initial'::jsonb#>>'{questions,0,id}'=:'gat'
 and jsonb_array_length(:'initial'::jsonb->'questions')=1 and :'initial'::jsonb->'uploadDeadline'='null','GAT only, no upload time');
select pg_temp.nift_year_assert(not public.can_upload_drawing(:'attempt',:'cat',1),'cannot upload CAT photos during GAT');
select pg_temp.nift_year_reject(format('select public.submit_attempt(%L)',:'attempt'),'55000');
select set_config('request.jwt.claim.sub',:'other',true);
select pg_temp.nift_year_reject(format('select public.finish_nift_year_gat(%L)',:'attempt'),'42501');
select set_config('request.jwt.claim.sub',:'student',true);
select public.finish_nift_year_gat(:'attempt') as transitioned \gset
select pg_temp.nift_year_assert(:'transitioned'::jsonb#>>'{niftSession,phase}'='cat' and :'transitioned'::jsonb#>>'{questions,0,id}'=:'cat'
 and jsonb_array_length(:'transitioned'::jsonb->'questions')=1 and public.can_upload_drawing(:'attempt',:'cat',1),'CAT opens only after GAT is finished');
select pg_temp.nift_year_assert((public.finish_nift_year_gat(:'attempt')->>'deadline')=(:'transitioned'::jsonb->>'deadline'),'a repeated transition preserves CAT deadline');
select pg_temp.nift_year_assert((public.read_attempt(:'natural')#>>'{niftSession,phase}')='cat' and
 (public.read_attempt(:'natural')->>'deadline')::timestamptz < now()+interval '176 minutes','offline GAT expiry preserves elapsed CAT time');
reset role;
select pg_temp.nift_year_reject(format('update dm_private.attempt_items set answer=%L::jsonb,answer_revision=1 where attempt_id=%L and question_id=%L','"A"',:'attempt',:'gat'),'55000');
update dm_private.attempts set deadline=now()-interval '1 minute',upload_deadline=now()+interval '9 minutes' where id=:'natural';
set local role authenticated;
select pg_temp.nift_year_assert((public.read_attempt(:'natural')->>'status')='active' and public.can_upload_drawing(:'natural',:'cat',1),'CAT grace retains uploads');
select public.submit_attempt(:'attempt') as submitted \gset
select pg_temp.nift_year_assert(:'submitted'::jsonb->>'status'='submitted' and jsonb_array_length(:'submitted'::jsonb->'questions')=2 and not public.can_upload_drawing(:'attempt',:'cat',1),'completed review covers both sessions');
reset role;
update dm_private.attempts set upload_deadline=now()-interval '1 second' where id=:'natural';
set local role authenticated;
select public.read_attempt(:'natural') as expired \gset
select pg_temp.nift_year_assert(:'expired'::jsonb->>'status'='submitted' and not public.can_upload_drawing(:'natural',:'cat',1),'grace expiry finalizes');
rollback;
