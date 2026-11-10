\set ON_ERROR_STOP on
\set student '00000000-0000-4000-8000-000000002571'
\set teacher '00000000-0000-4000-8000-000000002572'
\set paper '10000000-0000-4000-8000-000000002571'
\set question '20000000-0000-4000-8000-000000002571'
\set attempt '30000000-0000-4000-8000-000000002571'
\set review '40000000-0000-4000-8000-000000002571'
\set first_path 'drawings/50000000-0000-4000-8000-000000002571.png'
\set second_path 'drawings/50000000-0000-4000-8000-000000002572.jpg'
begin;

create function pg_temp.advice_assert(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
end $$;
create function pg_temp.advice_reject(command text, expected text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when others then
    if sqlstate=expected then return; end if;
    raise;
  end;
  raise exception 'FAIL: expected SQLSTATE %',expected;
end $$;
create function pg_temp.save_advice(
  review_id uuid, context text, model text, marks jsonb default '{"Visual communication":7.25,"Originality":6}',
  evidence jsonb default '["Clear silhouette in the submitted sketch."]'
) returns uuid language sql as $$
  select public.service_save_drawing_ai_advice(review_id,context,model,marks,'Fictional local review advice.',0.8,evidence)
$$;

select 'example/qwen:vision@'||repeat('a',64) as model,'example/qwen:vision@'||repeat('b',64) as second_model,
  repeat('c',64) as first_sha,repeat('d',64) as second_sha \gset
select pg_temp.advice_assert(
  not has_function_privilege(role_name,'public.service_drawing_ai_job(uuid,text)','execute')
  and not has_function_privilege(role_name,'public.service_save_drawing_ai_advice(uuid,text,text,jsonb,text,numeric,jsonb)','execute'),
  role_name||' has no drawing worker access')
from unnest(array['anon','authenticated']) role_name;
select pg_temp.advice_assert(
  has_function_privilege('service_role','public.service_drawing_ai_job(uuid,text)','execute')
  and has_function_privilege('service_role','public.service_save_drawing_ai_advice(uuid,text,text,jsonb,text,numeric,jsonb)','execute')
  and not has_function_privilege('service_role','dm_private.drawing_advice_context(uuid)','execute')
  and not has_function_privilege('service_role','dm_private.drawing_advice_object_receipt(text,text,text,integer)','execute'),
  'service role may use the public worker entry points only');

insert into auth.users(id) values (:'student'),(:'teacher');
insert into dm_private.drawing_reviewers(user_id,enabled,changed_at) values (:'teacher',true,now());
insert into dm_private.papers(id,title,exam,duration_seconds) values (:'paper','Fictional authored drawing fixture','nid',1200);
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,points,topic)
values (:'question',:'paper',1,'Current paper prompt is irrelevant to the frozen attempt.','[]','drawing','{"correct":20,"wrong":0}',20,'drawing');
insert into dm_private.attempts(id,user_id,paper_id,status,deadline,submitted_at,score,total)
values (:'attempt',:'student',:'paper','submitted',now()-interval '1 hour',now()-interval '1 hour',0,20);
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,key,explanation)
select :'attempt',id,ordinal,'Fictional frozen sketch prompt.',options,kind,marking,
  jsonb_build_array(
    jsonb_build_object('sha256',:'second_sha','path','papers/canonical/'||:'second_sha'||'.png','width',40,'height',60),
    jsonb_build_object('sha256',:'first_sha','path','papers/canonical/'||:'first_sha'||'.png','width',30,'height',20)),
  points,negative_points,topic,
  '{"kind":"drawing","privateFixtureKey":"Do not return the attempt key","practiceContext":{
    "version":"nid-authored-practice-v1","scope":"authored-practice","exam":"nid","responseKind":"drawing",
    "rubric":[{"label":"Visual communication","points":8.25,"guidance":"Credit clarity of the visual hierarchy.","privateField":"Not in the worker projection"},
      {"label":"Originality","points":11.75,"guidance":"Credit the originality of the visual decision."}]}}'::jsonb,
  'Fictional frozen task' from dm_private.questions where id=:'question';
insert into dm_private.drawing_reviews(id,attempt_id,question_id) values (:'review',:'attempt',:'question');
insert into dm_private.bank_media_assets(sha256,storage_path,width,height,byte_size) values
  (:'first_sha','papers/canonical/'||:'first_sha'||'.png',30,20,81),
  (:'second_sha','papers/canonical/'||:'second_sha'||'.png',40,60,91);
insert into storage.objects(bucket_id,name,metadata) values
  ('drawing-submissions',:'first_path','{"mimetype":"image/png","size":108,"eTag":"fixture-page-original"}'),
  ('drawing-submissions',:'second_path','{"mimetype":"image/jpeg","size":115,"eTag":"fixture-page-second"}'),
  ('paper-media','papers/canonical/'||:'first_sha'||'.png','{"mimetype":"image/png","size":81,"eTag":"fixture-first"}'),
  ('paper-media','papers/canonical/'||:'second_sha'||'.png','{"mimetype":"image/png","size":91,"eTag":"fixture-second"}');
insert into dm_private.drawing_uploads(attempt_id,question_id,student_id,storage_path,ordinal,mime_type,byte_size,
  pixel_width,pixel_height,image_orientation) values
  (:'attempt',:'question',:'student',:'second_path',2,'image/jpeg',115,900,1200,6),
  (:'attempt',:'question',:'student',:'first_path',1,'image/png',108,640,480,1);

set local role service_role;
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.advice_reject(format('select public.service_drawing_ai_job(%L,%L)',:'review',:'model'),'42501');
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.advice_reject(format('select public.service_drawing_ai_job(%L,%L)',:'review','example/qwen:vision-cloud@'||repeat('a',64)),'22023');
select pg_temp.advice_reject(format('select public.service_drawing_ai_job(%L,%L)',:'review','missing-digest'),'22023');
select public.service_drawing_ai_job(:'review',:'model') as ready \gset
select pg_temp.advice_assert(:'ready'::jsonb->>'status'='ready' and :'ready'::jsonb->>'reviewId'=:'review'
  and :'ready'::jsonb->>'prompt'='Fictional frozen sketch prompt.' and :'ready'::jsonb->>'maxScore'='20'
  and :'ready'::jsonb->>'rubricVersion'='nid-authored-practice-v1' and :'ready'::jsonb->>'contextSha256' ~ '^[0-9a-f]{64}$'
  and :'ready'::jsonb->'rubric'->0='{"label":"Visual communication","points":8.25,"guidance":"Credit clarity of the visual hierarchy."}'::jsonb
  and :'ready'::jsonb->'pages'->0=jsonb_build_object('ordinal',1,'storagePath',:'first_path','mimeType','image/png',
    'byteSize',108,'width',640,'height',480,'orientation',1)
  and :'ready'::jsonb->'pages'->1->>'orientation'='6'
  and :'ready'::jsonb->'figures'->0=jsonb_build_object('ordinal',1,'storagePath','papers/canonical/'||:'second_sha'||'.png',
    'mimeType','image/png','byteSize',91,'width',40,'height',60,'sha256',:'second_sha')
  and :'ready'::jsonb->'figures'->1->>'sha256'=:'first_sha'
  and not (:'ready'::jsonb ?| array['attemptId','studentId','reviewerId','key','receipts']),
  'worker receives only ordered frozen rubric and media descriptors with an opaque digest');
select :'ready'::jsonb->>'contextSha256' as context \gset

select pg_temp.advice_reject(format('select pg_temp.save_advice(%L,%L,%L,%L)',:'review',:'context',:'model',
  '{"Visual communication":8.26,"Originality":6}'),'22023');
select pg_temp.advice_reject(format('select pg_temp.save_advice(%L,%L,%L,%L)',:'review',:'context',:'model',
  '{"Visual communication":7.25}'),'22023');
select pg_temp.advice_reject(format('select pg_temp.save_advice(%L,%L,%L,%L,%L)',:'review',:'context',:'model',
  '{"Visual communication":7.25,"Originality":6}','[{"page":1}]'),'22023');
select pg_temp.advice_reject(format('select pg_temp.save_advice(%L,%L,%L,%L,%L)',:'review',:'context',:'model',
  '{"Visual communication":7.25,"Originality":6}','["  Padded evidence"]'),'22023');
select pg_temp.save_advice(:'review',:'context',:'model') as suggestion \gset
select pg_temp.advice_assert(public.service_drawing_ai_job(:'review',:'model') =
  jsonb_build_object('status','existing','reviewId',:'review','suggestionId',:'suggestion')
  and pg_temp.save_advice(:'review',:'context',:'model','{"Visual communication":1,"Originality":0}')=:'suggestion'::uuid
  and public.service_drawing_ai_job(:'review',:'second_model')->>'status'='ready',
  'an exact context and model replays its UUID and another model remains a separate job');
reset role;
select pg_temp.advice_assert((select provider='ollama-local' and proposed_score=13.25 and context_sha256=:'context'
  and rubric_version='nid-authored-practice-v1' and criterion_marks='{"Visual communication":7.25,"Originality":6}'::jsonb
  from dm_private.drawing_ai_suggestions where id=:'suggestion')
  and (select status='pending' and review_version=0 and score is null and criterion_marks is null from dm_private.drawing_reviews where id=:'review')
  and not exists(select 1 from dm_private.drawing_review_audit where review_id=:'review'),
  'database sums advisory marks without mutating the human review or audit trail');

update storage.objects set metadata=jsonb_set(metadata,'{eTag}','"fixture-page-replaced"') where name=:'first_path';
set local role service_role;
select pg_temp.advice_reject(format('select pg_temp.save_advice(%L,%L,%L)',:'review',:'context',:'model'),'40001');
select public.service_drawing_ai_job(:'review',:'model')->>'contextSha256' as replaced_page_context \gset
reset role;
update storage.objects set metadata=jsonb_set(metadata,'{eTag}','"fixture-figure-replaced"') where name='papers/canonical/'||:'second_sha'||'.png';
set local role service_role;
select pg_temp.advice_reject(format('select pg_temp.save_advice(%L,%L,%L)',:'review',:'replaced_page_context',:'model'),'40001');
select public.service_drawing_ai_job(:'review',:'model')->>'contextSha256' as replaced_figure_context \gset
reset role;
update dm_private.attempt_items set key=jsonb_set(key,'{practiceContext,rubric,0,guidance}','"Changed fictional frozen rubric guidance."')
  where attempt_id=:'attempt' and question_id=:'question';
set local role service_role;
select pg_temp.advice_reject(format('select pg_temp.save_advice(%L,%L,%L)',:'review',:'replaced_figure_context',:'model'),'40001');
select public.service_drawing_ai_job(:'review',:'model')->>'contextSha256' as changed_rubric_context \gset
reset role;

update dm_private.drawing_uploads set pixel_width=null,pixel_height=null,image_orientation=null where storage_path=:'first_path';
set local role service_role;
select pg_temp.advice_reject(format('select public.service_drawing_ai_job(%L,%L)',:'review',:'model'),'55000');
reset role;
update dm_private.drawing_uploads set pixel_width=640,pixel_height=480,image_orientation=1 where storage_path=:'first_path';
update storage.objects set metadata=jsonb_set(metadata,'{size}','109') where name=:'first_path';
set local role service_role;
select pg_temp.advice_reject(format('select public.service_drawing_ai_job(%L,%L)',:'review',:'model'),'55000');
reset role;
update storage.objects set metadata=jsonb_set(metadata,'{size}','108') where name=:'first_path';
update public.launch_settings set environment_mode='live' where singleton;
set local role service_role;
select pg_temp.advice_reject(format('select public.service_drawing_ai_job(%L,%L)',:'review',:'model'),'42501');
select pg_temp.advice_reject(format('select pg_temp.save_advice(%L,%L,%L)',:'review',:'changed_rubric_context',:'model'),'42501');
reset role;
update public.launch_settings set environment_mode='test' where singleton;
-- Deliberately simulate sales activation without staging the unrelated launch gates.
alter table public.launch_settings disable trigger guard_sales_activation;
update public.launch_settings set sales_enabled=true where singleton;
alter table public.launch_settings enable trigger guard_sales_activation;
set local role service_role;
select pg_temp.advice_reject(format('select public.service_drawing_ai_job(%L,%L)',:'review',:'model'),'42501');
reset role;
update public.launch_settings set sales_enabled=false where singleton;
update dm_private.attempts set upload_deadline=clock_timestamp()+interval '10 minutes' where id=:'attempt';
set local role service_role;
select pg_temp.advice_reject(format('select public.service_drawing_ai_job(%L,%L)',:'review',:'model'),'55000');
reset role;
update dm_private.attempts set upload_deadline=null where id=:'attempt';

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'teacher',true);
select public.admin_claim_drawing_review(:'review');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.advice_reject(format('select pg_temp.save_advice(%L,%L,%L)',:'review',:'changed_rubric_context',:'model'),'40001');
select public.service_drawing_ai_job(:'review',:'model')->>'contextSha256' as assigned_context \gset
select public.record_drawing_ai_suggestion(:'review','Fictional legacy provider','legacy model','fictional-v1',
  '{"Visual communication":1,"Originality":2}','Fictional compatible legacy advice',3,0.5);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'teacher',true);
select public.admin_review_drawing(:'review',1,'{"Visual communication":8,"Originality":9}','Independent fictional human grade.',17);
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.advice_reject(format('select pg_temp.save_advice(%L,%L,%L)',:'review',:'assigned_context',:'model'),'55000');
reset role;
select pg_temp.advice_assert((select status='reviewed' and score=17 and released_at is null from dm_private.drawing_reviews where id=:'review')
  and (select count(*)=2 and count(*) filter(where context_sha256 is null)=1 from dm_private.drawing_ai_suggestions where review_id=:'review'),
  'existing legacy suggestions coexist and the human score remains independent and unreleased');
rollback;
\echo 'PASS: local drawing advice authorization, frozen files and rubric, replay, and human review separation.'
