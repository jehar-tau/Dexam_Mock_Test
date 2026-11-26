-- All source material, actors, and figure bytes here are fictional.
begin;
create function pg_temp.check_revision(ok boolean,msg text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL %',msg; end if;end $$;
create function pg_temp.deny_revision(cmd text,msg text) returns void language plpgsql as $$
begin begin execute cmd; exception when others then return; end; raise exception 'FAIL %',msg; end $$;
insert into auth.users(id) select ('00000000-0000-4000-8000-00000000900'||n)::uuid from generate_series(1,3) n;
insert into dm_private.admins(user_id) values('00000000-0000-4000-8000-000000009003');
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,source_commit)
values('fictional-revision',repeat('a',64),'ceed','NAT','design','original',
  '{"externalKey":"fictional-revision","type":"NAT","prompt":"Fictional previous prompt","holds":[],"assets":[],"provenance":{"exam":"ceed","year":2021,"paperId":"ceed-2021"}}',repeat('a',40));
create function pg_temp.stage_revision(base text,previous_hash text,new_hash text,figure boolean) returns text
language plpgsql as $$
declare raw jsonb; runtime jsonb; doc jsonb; media jsonb:='[]'; d text;
begin
  raw:=jsonb_build_object('externalKey','fictional-revision','type','NAT','prompt','Fictional prompt '||new_hash,'holds','[]'::jsonb,
    'assets',case when figure then jsonb_build_array(jsonb_build_object('path','ceed-2021/figures/fictional.png','sha256',repeat('f',64),'width',1,'height',1)) else '[]'::jsonb end,
    'answer',jsonb_build_object('status','reviewed','raw','2'),'provenance','{"exam":"ceed","year":2021,"paperId":"ceed-2021"}'::jsonb);
  if figure then media:=jsonb_build_array(jsonb_build_object('sha256',repeat('f',64),'storagePath','papers/canonical/'||repeat('f',64)||'.png','width',1,'height',1,'byteSize',67));end if;
  runtime:=jsonb_build_object('context','{"version":"iitb-2027-v1","cycle":2027,"exam":"ceed","part":"A"}'::jsonb,
    'prompt',raw->>'prompt','kind','nat','topic','design','marking','{"correct":4,"wrong":0,"partial":false}'::jsonb,
    'points',4,'negativePoints',0,'options','[]'::jsonb,'key','{"kind":"nat","accepted":[{"exact":"2"}],"sourceExternalKey":"fictional-revision"}'::jsonb,
    'media',case when figure then jsonb_build_array(jsonb_build_object('sha256',repeat('f',64),'path','papers/canonical/'||repeat('f',64)||'.png','width',1,'height',1)) else '[]'::jsonb end);
  doc:=jsonb_build_object('format','dmocks-year-revision-v1','sourceCommit',repeat('c',40),'paperId','10000000-0000-4000-8000-000000009001','planSha256',new_hash,
    'baseManifest',base,'media',media,'plan',jsonb_build_object('format','dmocks-free-year-paper-v1','exam','ceed','year',2021,'title','Fictional CEED revision',
    'durationSeconds',900,'sourcePaperId','ceed-2021','partLabel','Part A','markingReference','Fictional historical mark sheet',
    'questions',jsonb_build_array(jsonb_build_object('externalKey','fictional-revision','contentSha256',new_hash,'marking','{"correct":3,"wrong":0}'::jsonb,'explanation','Fictional worked solution for this exact version '||new_hash))),
    'items',jsonb_build_array(jsonb_build_object('id','20000000-0000-4000-8000-000000009001','previousContentSha256',previous_hash,
    'record',jsonb_build_object('externalKey','fictional-revision','contentSha256',new_hash,'exam','ceed','type','NAT','licence','original','topic','design','payload',raw),
    'runtime',runtime)));
  d:=encode(sha256(convert_to(doc::text,'UTF8')),'hex');insert into dm_private.year_paper_revisions(digest,document) values(d,doc);return d;
end $$;
select pg_temp.check_revision(not has_table_privilege('authenticated','dm_private.year_paper_revisions','select')
  and not has_function_privilege('anon','public.approve_year_paper_revision(text,text)','execute')
  and not has_function_privilege('authenticated','public.publish_year_paper_revision(text,text)','execute'),'private data and activation');
select pg_temp.stage_revision(null,repeat('a',64),repeat('b',64),false) as first_digest \gset
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.publish_year_paper_revision(:'first_digest',null) as first_manifest \gset
reset role;
select pg_temp.check_revision((select count(*)=0 from dm_private.year_paper_releases) and
  (select content_sha256=repeat('a',64) from dm_private.bank_questions where external_key='fictional-revision'),'rehearsal rolls back bank and initial release');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009001',true);
select pg_temp.deny_revision(format('select public.approve_year_paper_revision(%L,%L)',:'first_digest',:'first_manifest'),'student approval');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009003',true);
select pg_temp.deny_revision(format('select public.approve_year_paper_revision(%L,%L)',:'first_digest',repeat('e',64)),'wrong digest');
select public.approve_year_paper_revision(:'first_digest',:'first_manifest');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.publish_year_paper_revision(:'first_digest',:'first_manifest');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009001',true);
select public.start_free_year_paper('10000000-0000-4000-8000-000000009001') as active_id \gset
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009002',true);
select public.start_free_year_paper('10000000-0000-4000-8000-000000009001') as submitted_id \gset
select public.save_answer_revision(:'submitted_id','20000000-0000-4000-8000-000000009001','"2"',1);
select public.submit_attempt(:'submitted_id');
select public.read_attempt(:'submitted_id')::text as before_result \gset
reset role;
select pg_temp.stage_revision(:'first_manifest',repeat('b',64),repeat('c',64),true) as refresh_digest \gset
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.deny_revision(format('select public.publish_year_paper_revision(%L,null)',:'refresh_digest'),'missing crop aborts rehearsal');
reset role;
select pg_temp.check_revision(dm_private.year_paper_ready('10000000-0000-4000-8000-000000009001'),'failed rehearsal preserves live paper');
insert into storage.objects(bucket_id,name,metadata)values('paper-media','papers/canonical/'||repeat('f',64)||'.png','{"mimetype":"image/png","size":67}');
set local role service_role;
select public.publish_year_paper_revision(:'refresh_digest',null) as refresh_manifest \gset
select pg_temp.deny_revision(format('select public.publish_year_paper_revision(%L,%L)',:'refresh_digest',:'refresh_manifest'),'unapproved revision');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009003',true);
select public.approve_year_paper_revision(:'refresh_digest',:'refresh_manifest');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.publish_year_paper_revision(:'refresh_digest',:'refresh_manifest');
select public.publish_year_paper_revision(:'refresh_digest',:'refresh_manifest');
reset role;
select pg_temp.check_revision((select count(*)=1 from dm_private.year_paper_releases) and
  (select count(*)=2 from dm_private.bank_question_reviews where external_key='fictional-revision'),'exact retry, reviewer recorded once per version');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009002',true);
select pg_temp.check_revision((public.read_attempt(:'submitted_id')-'serverNow')=(:'before_result'::jsonb-'serverNow'),'submitted answer, original marks and explanation survive');
select public.start_free_year_paper('10000000-0000-4000-8000-000000009001') as new_id \gset
select pg_temp.check_revision(jsonb_array_length(public.read_attempt(:'new_id')#>'{questions,0,media}')=1,'new attempt shows diagram');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009001',true);
select pg_temp.check_revision(public.start_free_year_paper('10000000-0000-4000-8000-000000009001')=:'active_id'::uuid
  and public.read_attempt(:'active_id')#>'{questions,0,media}'='[]'::jsonb,'active attempt resumes old frozen version');
rollback;
\echo 'PASS: scoped paper revision rehearsal, approval, activation and frozen attempt history.'
