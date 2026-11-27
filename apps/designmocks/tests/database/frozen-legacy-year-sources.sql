-- Fictional old mock and new paper share a source key. Exercise student RPCs
-- before and after source staging. No prepared or published paper is changed.
begin;
create function pg_temp.assert_frozen(ok boolean,why text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL %',why;end if;end $$;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000190');
insert into dm_private.papers(id,exam,title,duration_seconds,source_kind,published,reviewed,rights_confirmed)
values('10000000-0000-4000-8000-000000000190','ceed','Archived exam fixture',3600,'exam',false,true,true);
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,source_commit,active)
values('historic-ce-fixture',repeat('b',64),'ceed','NAT','test','owner-provided',
 '{"externalKey":"historic-ce-fixture","type":"NAT","holds":[],"provenance":{"exam":"CEED","paperId":"ceed-fixture-old","year":2017}}',repeat('d',40),false);
insert into dm_private.bank_media_assets(sha256,storage_path,width,height,byte_size)
values(repeat('a',64),'papers/canonical/'||repeat('a',64)||'.png',1,1,67);
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,points,negative_points,topic,media,reviewed)
values('20000000-0000-4000-8000-000000000190','10000000-0000-4000-8000-000000000190',1,'Old drawing count','[]','nat',
  '{"correct":2,"wrong":0}',2,0,'test',jsonb_build_array(jsonb_build_object('path','papers/canonical/'||repeat('a',64)||'.png','sha256',repeat('a',64),'width',1,'height',1)),true);
insert into dm_private.answer_keys(question_id,key,explanation) values('20000000-0000-4000-8000-000000000190',
  '{"kind":"nat","accepted":[{"exact":"2"}],"sourceExternalKey":"historic-ce-fixture"}','Old worked explanation and original diagram.');
insert into dm_private.attempts(id,paper_id,user_id,deadline,status,score,total,submitted_at)
values('30000000-0000-4000-8000-000000000190','10000000-0000-4000-8000-000000000190','00000000-0000-4000-8000-000000000190',now(),'submitted',2,2,now());
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,key,explanation,answer)
select '30000000-0000-4000-8000-000000000190',q.id,q.ordinal,q.prompt,q.options,q.kind,q.marking,q.media,q.points,q.negative_points,q.topic,k.key,k.explanation,'"2"'::jsonb
from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id where q.id='20000000-0000-4000-8000-000000000190';
insert into dm_private.papers(id,exam,title,duration_seconds,source_kind)
values('10000000-0000-4000-8000-000000000191','ceed','Old drawing fixture',600,'exam_part_b');
insert into dm_private.attempts(id,paper_id,user_id,deadline,status,score,total,submitted_at)
values('30000000-0000-4000-8000-000000000191','10000000-0000-4000-8000-000000000191','00000000-0000-4000-8000-000000000190',now()-interval '1 hour','submitted',0,0,now());
update dm_private.attempts set started_at=now()-interval '2 hours' where id='30000000-0000-4000-8000-000000000191';
update dm_private.exam_mock_sessions set part_b_attempt='30000000-0000-4000-8000-000000000191' where part_a_attempt='30000000-0000-4000-8000-000000000190';
create temporary table frozen_fixture(plan jsonb,records jsonb);
insert into frozen_fixture select jsonb_build_object('format','dmocks-free-year-paper-v1','exam','ceed','year',2017,
  'sourcePaperId','ceed-fixture-old','questions',jsonb_build_array(jsonb_build_object('externalKey','historic-ce-fixture','contentSha256',repeat('c',64)))),
  jsonb_build_array(jsonb_build_object('externalKey','historic-ce-fixture','exam','ceed','type','NAT','topic','test','licence','owner-provided',
  'contentSha256',repeat('c',64),'payload','{"externalKey":"historic-ce-fixture","prompt":"New question","type":"NAT","holds":[],"provenance":{"exam":"CEED","paperId":"ceed-fixture-old","year":2017}}'::jsonb));
grant select on frozen_fixture to service_role;
create function pg_temp.stage_source() returns integer language sql as $$
  select public.stage_objective_year_sources(plan,repeat('e',40),records) from frozen_fixture
$$;
create function pg_temp.expect_protected() returns void language plpgsql as $$
begin begin perform pg_temp.stage_source();exception when raise_exception then
 if sqlerrm='Retired source is bound to a published paper or an unfrozen attempt' then return;end if;raise;end;
 raise exception 'Expected the archived binding to block the source change';end$$;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000190',true);
select (public.read_attempt('30000000-0000-4000-8000-000000000190')-'serverNow')::text as prior_view,
       public.my_attempt_history()::text as prior_history,public.my_overview_analytics()::text as prior_overview,
       public.my_exam_mock_report('30000000-0000-4000-8000-000000000190')::text as prior_combined \gset
select pg_temp.assert_frozen(:'prior_view'::jsonb#>>'{questions,0,explanation}'='Old worked explanation and original diagram.'
 and (:'prior_view'::jsonb#>>'{questions,0,awarded}')::numeric=2,'student review reads the old explanation and awarded marks');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.expect_protected(); -- old image metadata is missing
reset role;
insert into storage.objects(bucket_id,name,metadata) values('paper-media','papers/canonical/'||repeat('a',64)||'.png','{"mimetype":"image/png","size":67}');
update dm_private.attempts set status='active' where id='30000000-0000-4000-8000-000000000190';
set local role service_role;select pg_temp.expect_protected();reset role;
update dm_private.attempts set status='submitted' where id='30000000-0000-4000-8000-000000000190';
update dm_private.papers set published=true where id='10000000-0000-4000-8000-000000000190';
set local role service_role;select pg_temp.expect_protected();reset role;
update dm_private.papers set published=false where id='10000000-0000-4000-8000-000000000190';
set local role service_role;select pg_temp.assert_frozen(pg_temp.stage_source()=1,'exact source staged');reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.assert_frozen((public.read_attempt('30000000-0000-4000-8000-000000000190')-'serverNow')=:'prior_view'::jsonb
 and public.my_exam_mock_report('30000000-0000-4000-8000-000000000190')=:'prior_combined'::jsonb
 and public.my_attempt_history()=:'prior_history'::jsonb and public.my_overview_analytics()=:'prior_overview'::jsonb,'old student view, keys, explanations, figure, scores, history and overview are stable');
reset role;
select pg_temp.assert_frozen(not has_function_privilege('anon','dm_private.unpublished_exam_attempts_frozen(uuid,uuid)','EXECUTE')
 and not has_function_privilege('authenticated','dm_private.unpublished_exam_attempts_frozen(uuid,uuid)','EXECUTE'),
 'snapshot check is private');
rollback;
