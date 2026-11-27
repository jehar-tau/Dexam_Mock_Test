begin;
create temporary table gat_fixture(p jsonb,r jsonb,v jsonb);
insert into gat_fixture
select jsonb_build_object('format','dmocks-free-year-paper-v1','sourcePaperId','nift-2024-mdes-gat','year',2024,'exam','nift',
  'durationSeconds',5400,'markingReference','Historical fixture marking',
  'questions',jsonb_build_array(jsonb_build_object('externalKey','gat-fixture-q1','contentSha256',repeat('a',64),'marking',
    '{"correct":2,"wrong":-0.5}'::jsonb,'explanation','Fictional explanation for this answer.'))),
  jsonb_build_array(jsonb_build_object('externalKey','gat-fixture-q1','contentSha256',repeat('a',64),'exam','nift',
    'type','MCQ','topic','test','licence','owner-provided','objectiveReady',true,
    'payload',jsonb_build_object('type','MCQ','holds','[]'::jsonb,'externalKey','gat-fixture-q1','prompt','Example item',
      'answer','{"raw":"B","status":"official-key"}'::jsonb,'options',
      '[{"key":"A","text":"one"},{"key":"B","text":"two"},{"key":"C","text":"three"},{"key":"D","text":"four"}]'::jsonb,'assets','[]'::jsonb,
      'provenance',jsonb_build_object('exam','NIFT','paperId','nift-2024-mdes-gat','year',2024)))),
  jsonb_build_array(jsonb_build_object('externalKey','gat-fixture-q1','contentSha256',repeat('a',64),'exam','nift','runtime',
    jsonb_build_object('kind','mcq','prompt','Example item','explanation','Fictional explanation for this answer.','points',2,'negativePoints',0.5,
    'marking','{"correct":2,"wrong":-0.5}'::jsonb,'topic','test','media','[]'::jsonb,
    'key','{"kind":"mcq","correct":["B"],"sourceExternalKey":"gat-fixture-q1"}'::jsonb,'options',
    '[{"id":"A","label":"one"},{"id":"B","label":"two"},{"id":"C","label":"three"},{"id":"D","label":"four"}]'::jsonb,
    'context','{"version":"nift-historical-gat-v1","exam":"nift","programme":"mdes","year":2024,"scope":"historical-year-paper","sourcePaperId":"nift-2024-mdes-gat","durationSeconds":5400,"markingReference":"Historical fixture marking"}'::jsonb)));
grant select on gat_fixture to service_role;
do $$declare signature text:='public.upsert_nift_year_runtime_batch(jsonb,jsonb)';
begin if has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE')
  or not has_function_privilege('service_role',signature,'EXECUTE') then raise exception 'Wrong GAT runtime grants';end if;end$$;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
do $$declare f gat_fixture;begin
  select * into f from gat_fixture;
  perform public.stage_objective_year_sources(f.p,repeat('b',40),f.r);
  if public.upsert_nift_year_runtime_batch(f.p,f.v)<>1 then raise exception 'NIFT historical runtime was not staged';end if;
  begin perform public.upsert_nift_year_runtime_batch(f.p,jsonb_set(f.v,'{0,runtime,key,correct}','["A"]'));
    raise exception 'Incorrect option accepted' using errcode='XX001';exception when raise_exception then null;end;
  begin perform public.upsert_nift_year_runtime_batch(f.p,jsonb_set(f.v,'{0,runtime,context,programme}','"bdes"'));
    raise exception 'Different programme accepted' using errcode='XX001';exception when raise_exception then null;end;
end$$;
rollback;
