\set ON_ERROR_STOP on
begin;
\ir ../../supabase/launch/paid-mvp.sql
create function pg_temp.nid_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception'FAIL: %',label;end if;end$$;
create function pg_temp.nid_reject(statement text,expected_state text)returns void language plpgsql as $$begin
 begin execute statement;exception when others then if sqlstate=expected_state then return;end if;raise;end;
 raise exception'FAIL: expected SQLSTATE %',expected_state;
end$$;
insert into auth.users(id)values('00000000-0000-4000-8000-000000002151'),('00000000-0000-4000-8000-000000002152'),('00000000-0000-4000-8000-000000002153');
insert into dm_private.admins(user_id)values('00000000-0000-4000-8000-000000002151');
insert into dm_private.drawing_reviewers(user_id,enabled,changed_at)values('00000000-0000-4000-8000-000000002153',true,now());
select set_config('test.nid.payload','{"schemaVersion":"nid-authored-practice-v1","title":"Fictional observation practice","purpose":"An original fictional private practice design for review.","durationMinutes":23,"uploadGraceMinutes":0,"sections":[{"label":"Observation","kind":"mcq","count":3,"points":2.5,"penalty":0.25,"rubric":[]}]}',true);
select set_config('test.nid.manual','{"schemaVersion":"nid-authored-practice-v1","title":"Fictional drawing practice","purpose":"An original fictional uploaded drawing exercise for review.","durationMinutes":41,"uploadGraceMinutes":10,"sections":[{"label":"Drawing communication","kind":"drawing","count":2,"points":0.3,"penalty":0,"rubric":[{"label":"Observation","points":0.1,"guidance":"Credit the clearly observed spatial relationships."},{"label":"Communication","points":0.2,"guidance":"Credit the legible visual explanation of the proposed solution."}]}]}',true);
select set_config('test.nid.initial',jsonb_build_object('bank',(select count(*)from dm_private.bank_questions),'papers',(select count(*)from dm_private.papers),'attempts',(select count(*)from dm_private.attempts),'examBlueprints',(select jsonb_agg(to_jsonb(b)order by exam)from dm_private.exam_mock_blueprints b),'settings',(select to_jsonb(s)from public.launch_settings s where singleton))::text,true);

set local role anon;
select pg_temp.nid_reject('select public.admin_nid_practice_blueprints()','42501');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002152',true);
select pg_temp.nid_reject('select public.admin_nid_practice_blueprints()','42501');
select pg_temp.nid_reject('select public.admin_nid_practice_blueprint(''10000000-0000-4000-8000-000000002151'')','42501');
select pg_temp.nid_reject('select public.admin_save_nid_practice_blueprint(''10000000-0000-4000-8000-000000002151'',0,current_setting(''test.nid.payload'')::jsonb,''20000000-0000-4000-8000-000000002151'')','42501');
select pg_temp.nid_reject('select public.admin_review_nid_practice_blueprint(''10000000-0000-4000-8000-000000002151'',1,repeat(''a'',64),''reviewed'',''An original fictional practice review.'',''30000000-0000-4000-8000-000000002151'')','42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002153',true);
select pg_temp.nid_reject('select public.admin_nid_practice_blueprints()','42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002151',true);
select pg_temp.nid_reject('select *from dm_private.nid_practice_blueprints','42501');
select pg_temp.nid_reject('select *from dm_private.nid_practice_blueprint_versions','42501');
select pg_temp.nid_reject('select *from dm_private.nid_practice_blueprint_requests','42501');
select pg_temp.nid_reject('select dm_private.nid_practice_payload_valid(current_setting(''test.nid.payload'')::jsonb)','42501');
select pg_temp.nid_assert((public.admin_nid_practice_blueprints()->>'total')::integer=0,'empty private context list');
select pg_temp.nid_reject('select public.admin_nid_practice_blueprints(-1,10)','22023');
select pg_temp.nid_reject('select public.admin_nid_practice_blueprints(0,51)','22023');
select pg_temp.nid_assert(public.admin_nid_practice_blueprint('10000000-0000-4000-8000-000000002151')->'item'='null'::jsonb,'missing new ID is explicit');
select set_config('test.nid.saved',public.admin_save_nid_practice_blueprint('10000000-0000-4000-8000-000000002151',0,current_setting('test.nid.payload')::jsonb,'20000000-0000-4000-8000-000000002151')::text,true);
select pg_temp.nid_assert(public.admin_save_nid_practice_blueprint('10000000-0000-4000-8000-000000002151',0,current_setting('test.nid.payload')::jsonb,'20000000-0000-4000-8000-000000002151')=current_setting('test.nid.saved')::jsonb,'exact committed save replay does not create a second revision');
select pg_temp.nid_assert(public.admin_nid_practice_blueprint('10000000-0000-4000-8000-000000002151',null,'20000000-0000-4000-8000-000000002151')->'requestResult'=current_setting('test.nid.saved')::jsonb,'lost acknowledgement can be read without replay');
select pg_temp.nid_assert(public.admin_nid_practice_blueprint('10000000-0000-4000-8000-000000002151')->'item'->'payload'=current_setting('test.nid.payload')::jsonb,'authored marks and clock stored exactly');
select pg_temp.nid_reject('select public.admin_save_nid_practice_blueprint(''10000000-0000-4000-8000-000000002151'',0,current_setting(''test.nid.manual'')::jsonb,''20000000-0000-4000-8000-000000002151'')','40001');
select pg_temp.nid_reject('select public.admin_save_nid_practice_blueprint(''10000000-0000-4000-8000-000000002151'',0,current_setting(''test.nid.payload'')::jsonb,gen_random_uuid())','40001');
select pg_temp.nid_reject('select public.admin_review_nid_practice_blueprint(''10000000-0000-4000-8000-000000002151'',1,repeat(''a'',64),''reviewed'',''An original fictional practice review.'',gen_random_uuid())','40001');
select pg_temp.nid_reject('select public.admin_review_nid_practice_blueprint(''10000000-0000-4000-8000-000000002151'',1,current_setting(''test.nid.saved'')::jsonb->>''sha256'',''approved'',''An original fictional practice review.'',gen_random_uuid())','22023');
select pg_temp.nid_reject('select public.admin_review_nid_practice_blueprint(''10000000-0000-4000-8000-000000002151'',1,current_setting(''test.nid.saved'')::jsonb->>''sha256'',''reviewed'',''short'',gen_random_uuid())','22023');
select set_config('test.nid.reviewed',public.admin_review_nid_practice_blueprint('10000000-0000-4000-8000-000000002151',1,current_setting('test.nid.saved')::jsonb->>'sha256','reviewed','Original fictional authored practice design reviewed; not official NID criteria.','30000000-0000-4000-8000-000000002151')::text,true);
select pg_temp.nid_assert(public.admin_review_nid_practice_blueprint('10000000-0000-4000-8000-000000002151',1,current_setting('test.nid.saved')::jsonb->>'sha256','reviewed','Original fictional authored practice design reviewed; not official NID criteria.','30000000-0000-4000-8000-000000002151')=current_setting('test.nid.reviewed')::jsonb,'review acknowledgement replay is exact');
select pg_temp.nid_reject('select public.admin_review_nid_practice_blueprint(''10000000-0000-4000-8000-000000002151'',1,current_setting(''test.nid.saved'')::jsonb->>''sha256'',''rejected'',''An original fictional practice rejection.'',gen_random_uuid())','40001');
select set_config('test.nid.saved2',public.admin_save_nid_practice_blueprint('10000000-0000-4000-8000-000000002151',1,current_setting('test.nid.manual')::jsonb,'20000000-0000-4000-8000-000000002154')::text,true);
select pg_temp.nid_assert(public.admin_nid_practice_blueprint('10000000-0000-4000-8000-000000002151')->'item'->>'status'='draft','editing a reviewed design invalidates its review');
select pg_temp.nid_assert(public.admin_nid_practice_blueprint('10000000-0000-4000-8000-000000002151',1)->'item'->>'status'='reviewed'and public.admin_nid_practice_blueprint('10000000-0000-4000-8000-000000002151',1)->'item'->'payload'=current_setting('test.nid.payload')::jsonb,'prior authored content and exact review remain immutable');
select pg_temp.nid_reject('select public.admin_review_nid_practice_blueprint(''10000000-0000-4000-8000-000000002151'',1,current_setting(''test.nid.saved'')::jsonb->>''sha256'',''reviewed'',''A stale original fictional practice review.'',gen_random_uuid())','40001');
select pg_temp.nid_assert(public.admin_review_nid_practice_blueprint('10000000-0000-4000-8000-000000002151',2,current_setting('test.nid.saved2')::jsonb->>'sha256','rejected','Original fictional rubric needs a task-specific human correction.','30000000-0000-4000-8000-000000002154')->>'status'='rejected','rejection preserved separately from question review');
select pg_temp.nid_assert(public.admin_nid_practice_blueprint('10000000-0000-4000-8000-000000002151')->'item'->'payload'->'sections'->0->'rubric'->1->>'points'='0.2','rubric decimals never rounded');

do $$declare p jsonb;bad jsonb;begin
 p:=current_setting('test.nid.payload')::jsonb;
 for bad in select value from jsonb_array_elements(jsonb_build_array('null'::jsonb,'[]'::jsonb,p||'{"official":true}',p-'purpose',jsonb_set(p,'{durationMinutes}','null'),jsonb_set(p,'{durationMinutes}','1.5'),jsonb_set(p,'{durationMinutes}','361'),jsonb_set(p,'{uploadGraceMinutes}','10'),jsonb_set(p,'{sections,0,count}','101'),jsonb_set(p,'{sections,0,points}','0'),jsonb_set(p,'{sections,0,points}','1.001'),jsonb_set(p,'{sections,0,penalty}','-1'),jsonb_set(p,'{sections,0,penalty}','3'),jsonb_set(p,'{sections,0,kind}','"unknown"'),jsonb_set(p,'{sections,0,points}','"2.5"'),jsonb_set(p,'{sections,0,rubric}','null'),jsonb_set(p,'{sections}',jsonb_build_array(p->'sections'->0,p->'sections'->0))))loop
  perform pg_temp.nid_reject(format('select public.admin_save_nid_practice_blueprint(gen_random_uuid(),0,%L::jsonb,gen_random_uuid())',bad::text),'22023');
 end loop;
 p:=current_setting('test.nid.manual')::jsonb;
 for bad in select value from jsonb_array_elements(jsonb_build_array(jsonb_set(p,'{uploadGraceMinutes}','0'),jsonb_set(p,'{sections,0,penalty}','0.1'),jsonb_set(p,'{sections,0,rubric}','[]'),jsonb_set(p,'{sections,0,rubric,0,points}','0.11'),jsonb_set(p,'{sections,0,rubric,0,guidance}','"short"'),jsonb_set(p,'{sections,0,rubric,0,label}','"Communication"'),jsonb_set(p,'{sections,0,rubric,0,points}','-0.1')))loop
  perform pg_temp.nid_reject(format('select public.admin_save_nid_practice_blueprint(gen_random_uuid(),0,%L::jsonb,gen_random_uuid())',bad::text),'22023');
 end loop;
 -- Authored numeric/set/written variants are design records, not runtime rules.
 for p in select jsonb_set(current_setting('test.nid.payload')::jsonb,'{sections,0,kind}',to_jsonb(kind))from unnest(array['msq','nat'])kind loop
  perform public.admin_save_nid_practice_blueprint(gen_random_uuid(),0,p,gen_random_uuid());
 end loop;
 perform public.admin_save_nid_practice_blueprint(gen_random_uuid(),0,jsonb_set(current_setting('test.nid.manual')::jsonb,'{sections,0,kind}','"written"'),gen_random_uuid());
 for n in 1..9 loop perform public.admin_save_nid_practice_blueprint(gen_random_uuid(),0,current_setting('test.nid.payload')::jsonb,gen_random_uuid());end loop;
end$$;
select pg_temp.nid_assert(public.admin_nid_practice_blueprints(999,10)->>'offset'='10'and jsonb_array_length(public.admin_nid_practice_blueprints(999,10)->'items')=3,'bounded paging clamps an outdated page');

reset role;
insert into dm_private.admins(user_id)values('00000000-0000-4000-8000-000000002152');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002152',true);
select pg_temp.nid_assert(public.admin_nid_practice_blueprint('10000000-0000-4000-8000-000000002151',null,'20000000-0000-4000-8000-000000002151')->'requestResult'='null'::jsonb,'another administrator cannot recover an actor-bound acknowledgement');
select pg_temp.nid_reject('select public.admin_save_nid_practice_blueprint(''10000000-0000-4000-8000-000000002151'',0,current_setting(''test.nid.payload'')::jsonb,''20000000-0000-4000-8000-000000002151'')','40001');
reset role;
delete from dm_private.admins where user_id='00000000-0000-4000-8000-000000002151';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002151',true);
select pg_temp.nid_reject('select public.admin_nid_practice_blueprints()','42501');
select pg_temp.nid_reject('select public.admin_save_nid_practice_blueprint(''10000000-0000-4000-8000-000000002151'',0,current_setting(''test.nid.payload'')::jsonb,''20000000-0000-4000-8000-000000002151'')','42501');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.nid_reject('select public.admin_nid_practice_blueprints()','42501');
select pg_temp.nid_reject('select *from dm_private.nid_practice_blueprint_versions','42501');
reset role;
select pg_temp.nid_assert(current_setting('test.nid.initial')::jsonb=jsonb_build_object('bank',(select count(*)from dm_private.bank_questions),'papers',(select count(*)from dm_private.papers),'attempts',(select count(*)from dm_private.attempts),'examBlueprints',(select jsonb_agg(to_jsonb(b)order by exam)from dm_private.exam_mock_blueprints b),'settings',(select to_jsonb(s)from public.launch_settings s where singleton)),'private drafting never changes canonical conversion, paper/exam runtime, attempts, launch settings or releases');
select pg_temp.nid_assert(dm_private.mvp_profile_permissions_valid(),'staff-only additions preserve exact MVP default-deny RPC permissions');
rollback;
