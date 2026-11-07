\set ON_ERROR_STOP on
\set editor '00000000-0000-4000-8000-000000000107'
\set student '00000000-0000-4000-8000-000000000108'
begin;

create function pg_temp.intake_assert(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
end $$;
create function pg_temp.intake_reject(statement text,expected_error text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if position(expected_error in sqlerrm)>0 then return; end if;
    raise;
  end;
  raise exception 'FAIL, expected error: %',expected_error;
end $$;
create function pg_temp.intake_payload(kind text,answer jsonb) returns jsonb language sql as $$
  select jsonb_build_object('type',kind,'prompt','Choose the clearest fictional wayfinding design.',
    'options',case when kind in('MCQ','MSQ') then
      '[{"id":"A","text":"A tiny label"},{"id":"B","text":"A legible symbol"},{"id":"C","text":"A hidden direction"},{"id":"D","text":"Unrelated marks"}]'::jsonb else '[]'::jsonb end,
    'answer',answer,'explanation','The rubric rewards legibility and a clear hierarchy.','topic','observation',
    'visualDependency',false,'assets','[]'::jsonb,'holds','[]'::jsonb,'licence','owner-authorized',
    'provenance','{"exam":" UCEED ","intake":{"assetId":"spoofed","pageNumber":99}}'::jsonb)
$$;
create function pg_temp.intake_visual() returns jsonb language sql as $$
  select pg_temp.intake_payload('MCQ','"B"')||jsonb_build_object('visualDependency',true,'assets',jsonb_build_array(
    jsonb_build_object('path','intake/'||repeat('a',64)||'.png','sha256',repeat('a',64),'width',1,'height',1)))
$$;

insert into auth.users(id) values(:'editor'),(:'student');
insert into dm_private.admins(user_id) values(:'editor');
select pg_temp.intake_assert(dm_private.canonical_intake_question(pg_temp.intake_payload('MSQ','["B","D"]'))
  #>>'{answer,raw}'='B, D','raw multiple-answer arrays become canonical notation');
select pg_temp.intake_assert(dm_private.canonical_intake_question(pg_temp.intake_payload('NAT','"-.50 to +.75"'))
  #>>'{answer,raw}'='-.50 to +.75','review preserves exact decimal bounds');
select pg_temp.intake_assert(dm_private.canonical_intake_question(pg_temp.intake_payload('DESCRIPTIVE','null'))
  ->'answer'='null'::jsonb,'drawing rubrics retain no objective answer');
select pg_temp.intake_reject($sql$select dm_private.canonical_intake_question(pg_temp.intake_payload('MCQ','"E"'))$sql$,'must match an option key');
select pg_temp.intake_reject($sql$select dm_private.canonical_intake_question(pg_temp.intake_payload('MSQ','["B","B"]'))$sql$,'distinct option keys');
select pg_temp.intake_reject($sql$select dm_private.canonical_intake_question(pg_temp.intake_payload('NAT','"4 to 2"'))$sql$,'ordered numeric range');
select pg_temp.intake_reject($sql$select dm_private.canonical_intake_question(pg_temp.intake_payload('MCQ','null'))$sql$,'verified answer');
select pg_temp.intake_reject($sql$select dm_private.canonical_intake_question(pg_temp.intake_payload('MCQ','"B"')-'visualDependency')$sql$,'whether the question requires figures');
select pg_temp.intake_reject($sql$select dm_private.canonical_intake_question(pg_temp.intake_payload('MCQ','"B"')||'{"visualDependency":true}')$sql$,'reviewed question figures');
select pg_temp.intake_reject($sql$select dm_private.canonical_intake_question(jsonb_set(pg_temp.intake_visual(),'{assets,0,path}','"../figure.png"'))$sql$,'prepared PNG figure metadata');

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.register_question_intake_asset('intake/fixture/source.pdf','fictional-source.pdf','application/pdf',1234,:'editor') as asset_id \gset
select public.register_question_intake_asset('intake/fixture/photo.png','fictional-photo.png','image/png',99,:'editor') as photo_id \gset
select public.register_question_intake_asset('intake/fixture/large.pdf','fictional-large.pdf','application/pdf',10485761,:'editor') as large_id \gset
select pg_temp.intake_reject(format('select public.claim_question_intake_asset(%L)',:'large_id'),'Split files above 10 MB');
select public.claim_question_intake_asset(:'asset_id');
select pg_temp.intake_reject(format($sql$select public.complete_question_intake_asset(%L,'fictional-model','invalid-response','[{"prompt":"Incomplete fixture"}]')$sql$,:'asset_id'),'Invalid extracted question');
select pg_temp.intake_assert(public.complete_question_intake_asset(:'asset_id','fictional-model','fixture-response',jsonb_build_array(
  pg_temp.intake_payload('MCQ','null')||'{"pageNumber":2,"confidence":0.8}',
  pg_temp.intake_payload('NAT','null')||'{"pageNumber":null,"confidence":null}'))=2,'model candidates retain missing source answers and unknown provenance');
reset role;

select pg_temp.intake_reject(format('select dm_private.require_intake_figures(%L,pg_temp.intake_visual()->''assets'')',:'asset_id'),'retain every reviewed figure');
insert into storage.objects(bucket_id,name,metadata) values('question-intake','figures/'||:'asset_id'||'/'||repeat('a',64)||'.png','{"mimetype":"image/png","size":99}');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.intake_reject(format('select public.register_question_intake_figure(%L,%L,1,1,99,%L)',:'asset_id',repeat('a',64),:'editor'),'permission denied');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.register_question_intake_figure(:'asset_id',repeat('a',64),1,1,99,:'editor');
select public.register_question_intake_figure(:'asset_id',repeat('a',64),1,1,99,:'editor');
select pg_temp.intake_reject(format('select public.register_question_intake_figure(%L,%L,2,1,99,%L)',:'asset_id',repeat('a',64),:'editor'),'metadata does not match');
reset role;

set local role anon;
select pg_temp.intake_reject(format('select public.admin_question_intake_source(%L)',:'asset_id'),'permission denied');
select pg_temp.intake_reject($sql$select dm_private.canonical_intake_question('{}')$sql$,'permission denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'student',true);
select pg_temp.intake_reject(format('select public.admin_question_intake_source(%L)',:'asset_id'),'Admin access required');
select pg_temp.intake_reject(format('select public.admin_question_intake_figure_source(%L,%L)',:'asset_id',repeat('a',64)),'Admin access required');
select pg_temp.intake_reject(format($sql$select public.admin_promote_intake_asset(%L,pg_temp.intake_payload('MCQ','"B"'))$sql$,:'photo_id'),'Admin access required');
select pg_temp.intake_reject('select public.admin_question_intake_assets()','Admin access required');
select set_config('request.jwt.claim.sub',:'editor',true);
select pg_temp.intake_assert(public.admin_question_intake_source(:'asset_id')->>'storagePath'='intake/fixture/source.pdf','admin resolves the exact registered private source');
select pg_temp.intake_assert(public.admin_question_intake_figure_source(:'asset_id',repeat('a',64))->>'mimeType'='image/png','admin can recover retained figures after a reload');
select pg_temp.intake_reject(format('select public.admin_promote_intake_asset(%L,pg_temp.intake_visual())',:'photo_id'),'retain every reviewed figure');
select pg_temp.intake_assert(not(public.admin_question_intake_assets()->0?'storagePath'),'list avoids exposing storage paths');
reset role;
select id as candidate_id from dm_private.question_intake_candidates where asset_id=:'asset_id' and ordinal=1 \gset
select id as rejected_id from dm_private.question_intake_candidates where asset_id=:'asset_id' and ordinal=2 \gset
set local role authenticated;
select public.admin_promote_intake_candidate(:'candidate_id',pg_temp.intake_payload('MCQ','"B"')) as draft_id \gset
select pg_temp.intake_assert(public.admin_promote_intake_candidate(:'candidate_id',pg_temp.intake_payload('MCQ','"B"'))=:'draft_id','promotion retry returns the same immutable correction');
select pg_temp.intake_reject(format($sql$select public.admin_promote_intake_candidate(%L,pg_temp.intake_payload('MCQ','"A"'))$sql$,:'candidate_id'),'different content');
select public.admin_reject_intake_candidate(:'rejected_id');
select public.admin_reject_intake_candidate(:'rejected_id');
reset role;
select pg_temp.intake_assert((select payload->'answer'='null'::jsonb from dm_private.question_intake_candidates where id=:'candidate_id'),
  'original extracted payload remains unchanged after a human correction');
select pg_temp.intake_assert((select payload#>>'{options,1,key}'='B' and payload#>>'{answer,status}'='pending'
  and payload->'holds'='["intake-human-review"]'::jsonb and payload->>'licence'='unknown'
  and payload#>>'{provenance,intake,assetId}'=:'asset_id' and payload#>>'{provenance,intake,pageNumber}'='2'
  from dm_private.question_drafts where id=:'draft_id'),'canonical draft retains trusted lineage, pending answer and hold');
select pg_temp.intake_assert((select status='reviewed' from dm_private.question_intake_assets where id=:'asset_id'),'asset closes after the last decision');

set local role authenticated;
select pg_temp.intake_reject(format($sql$select public.admin_export_question_draft(%L,'intake-fixture-original',true,'Owner approved this fictional example')$sql$,:'draft_id'),'Only an approved draft');
select public.admin_review_question_draft(:'draft_id','approved','Human checked the source answer and options');
select pg_temp.intake_reject(format($sql$select public.admin_export_question_draft(%L,'intake-fixture-original',false,'Owner approved this fictional example')$sql$,:'draft_id'),'Rights confirmation');
with result as (select public.admin_export_question_draft(:'draft_id','intake-fixture-original',true,'Owner approved this fictional example') as artifact)
select pg_temp.intake_assert(artifact->>'publicationState'='git-review-required' and artifact#>>'{payload,answer,status}'='human-reviewed'
  and artifact#>>'{payload,provenance,exam}'='uceed' and artifact#>>'{payload,provenance,intake,pageNumber}'='2'
  and artifact->'payload'->'holds'='[]'::jsonb,'review and rights create a canonical importable artifact') from result;
select public.admin_promote_intake_asset(:'photo_id',pg_temp.intake_payload('NAT','"2.000000000000000001"')) as manual_id \gset
select pg_temp.intake_assert(public.admin_promote_intake_asset(:'photo_id',pg_temp.intake_payload('NAT','"2.000000000000000001"'))=:'manual_id','manual transcription retry never duplicates a draft');
select public.admin_promote_intake_asset(:'photo_id',pg_temp.intake_payload('NAT','"3"')) as second_manual_id \gset
select pg_temp.intake_assert(:'manual_id'<>:'second_manual_id','one source supports multiple distinct manual questions');
reset role;
select pg_temp.intake_assert((select count(*)=2 from dm_private.question_intake_candidates where asset_id=:'photo_id' and status='promoted'),'manual source retains its complete question lineage');
select pg_temp.intake_assert(not exists(select 1 from dm_private.bank_questions where external_key='intake-fixture-original'),'artifact creation never bypasses the Git bank');

set local role authenticated;
select public.admin_promote_intake_asset(:'asset_id',pg_temp.intake_visual()) as visual_id \gset
select public.admin_review_question_draft(:'visual_id','approved','Human checked the fictional cropped figure and answer');
reset role;
delete from storage.objects where bucket_id='question-intake' and name='figures/'||:'asset_id'||'/'||repeat('a',64)||'.png';
set local role authenticated;
select pg_temp.intake_reject(format($sql$select public.admin_export_question_draft(%L,'intake-fixture-visual',true,'Owner approved the fictional cropped figure')$sql$,:'visual_id'),'retain every reviewed figure');
reset role;
insert into storage.objects(bucket_id,name,metadata) values('question-intake','figures/'||:'asset_id'||'/'||repeat('a',64)||'.png','{"mimetype":"image/png","size":99}');
set local role authenticated;
select pg_temp.intake_assert(public.admin_export_question_draft(:'visual_id','intake-fixture-visual',true,'Owner approved the fictional cropped figure')
  #>>'{payload,assets,0,sha256}'=repeat('a',64),'only retained reviewed figure metadata enters the Git artifact');
reset role;

-- An older raw draft can export after review with its valid canonical answer and option notation preserved.
insert into dm_private.question_drafts(created_by,source_type,payload,status)
  values(:'editor','pdf',pg_temp.intake_payload('MSQ','["B","D"]'),'approved') returning id as legacy_id \gset
insert into dm_private.question_drafts(created_by,source_type,payload,status)
  values(:'editor','photo','{"prompt":"Incomplete legacy question","holds":["intake-human-review"]}','approved') returning id as incomplete_id \gset
set local role authenticated;
select pg_temp.intake_assert(public.admin_export_question_draft(:'legacy_id','intake-fixture-legacy',true,'Owner approved this fictional legacy example')
  #>>'{payload,answer,raw}'='B, D','valid legacy raw answers export in canonical notation');
select pg_temp.intake_reject(format($sql$select public.admin_export_question_draft(%L,'intake-fixture-incomplete',true,'Owner approved this fictional example')$sql$,:'incomplete_id'),'Confirm the exam');
reset role;
rollback;
\echo 'PASS: private PDF/photo sources, canonical corrections, retry-safe manual intake, immutable provenance and rights-gated Git artifacts.'
