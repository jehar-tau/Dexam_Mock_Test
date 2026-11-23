-- Fictional source and student. Every change is rolled back.
begin;
create function pg_temp.year_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.year_reject(statement text) returns void language plpgsql as $$
begin
  begin execute statement; exception when others then return; end;
  raise exception 'Unexpectedly accepted: %',statement;
end$$;
\ir fixtures/mvp-objective-paper.sql
select pg_temp.seed_mvp_paper('uceed','10000000-0000-4000-8000-000000003001');
insert into auth.users(id) values('00000000-0000-4000-8000-000000003001');
insert into auth.users(id) values('00000000-0000-4000-8000-000000003002');
update dm_private.bank_questions set
  payload=jsonb_set(payload,'{provenance}',jsonb_build_object('paperId','uceed-2026','year',2026))
  where external_key like 'mvp-original-%';
update dm_private.bank_questions set owner_approved=true,rights_confirmed=true where external_key like 'mvp-original-%';
update dm_private.papers set source_kind='year',published=true,reviewed=true,rights_confirmed=true
  where id='10000000-0000-4000-8000-000000003001';
select set_config('test.year.sha',dm_private.year_paper_manifest('10000000-0000-4000-8000-000000003001'),true);
select pg_temp.year_assert(not has_function_privilege('anon','public.register_free_year_paper(uuid,text,integer,text,text,integer,text)','EXECUTE')
  and not has_function_privilege('authenticated','public.register_free_year_paper(uuid,text,integer,text,text,integer,text)','EXECUTE')
  and has_function_privilege('service_role','public.register_free_year_paper(uuid,text,integer,text,text,integer,text)','EXECUTE')
  and not has_table_privilege('authenticated','dm_private.year_paper_releases','SELECT'),
  'release registry is private and service-only');
select pg_temp.year_assert(not has_function_privilege('anon','public.my_year_paper_attempts()','EXECUTE')
  and has_function_privilege('authenticated','public.my_year_paper_attempts()','EXECUTE'),
  'only signed-in students may read their own year-paper attempt summary');
select pg_temp.year_assert(public.free_year_paper_catalog()='[]'::jsonb,
  'published flag alone cannot list a free year paper');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003001',true);
select pg_temp.year_reject('select public.start_free_year_paper(''10000000-0000-4000-8000-000000003001'')');
select pg_temp.year_reject('select public.register_free_year_paper(''10000000-0000-4000-8000-000000003001'',''uceed'',2026,''uceed-2026'',''Part A'',57,repeat(''a'',64))');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.year_reject('select public.register_free_year_paper(''10000000-0000-4000-8000-000000003001'',''uceed'',2026,''uceed-2026'',''Part A'',56,repeat(''a'',64))');
select pg_temp.year_assert(public.register_free_year_paper('10000000-0000-4000-8000-000000003001',
  'uceed',2026,'uceed-2026','Part A',57,current_setting('test.year.sha'))->>'questionCount'='57',
  'exact reviewed source group can be registered');
select pg_temp.year_reject('select public.register_free_year_paper(''10000000-0000-4000-8000-000000003001'',''uceed'',2026,''uceed-2026'',''Part A'',57,repeat(''b'',64))');
reset role;
select pg_temp.year_assert(jsonb_array_length(public.free_year_paper_catalog())=1 and
  public.free_year_paper_catalog()->0->>'questionCount'='57',
  'only explicitly registered complete paper is publicly listed');
update dm_private.questions set marking='{"correct":99,"wrong":0}'::jsonb
  where paper_id='10000000-0000-4000-8000-000000003001' and ordinal=1;
select pg_temp.year_assert(public.free_year_paper_catalog()='[]'::jsonb,
  'a changed historical marking invalidates the exact review receipt');
update dm_private.questions q set marking=b.runtime_payload->'marking'
  from dm_private.answer_keys k join dm_private.bank_questions b on b.external_key=k.key->>'sourceExternalKey'
  where q.id=k.question_id and q.paper_id='10000000-0000-4000-8000-000000003001' and q.ordinal=1;
update storage.buckets set public=true where id='paper-media';
select pg_temp.year_assert(public.free_year_paper_catalog()='[]'::jsonb,
  'a public figure bucket closes the release');
update storage.buckets set public=false where id='paper-media';
select pg_temp.year_assert(jsonb_array_length(public.free_year_paper_catalog())=1,
  'the unchanged reviewed paper can reopen after storage is private');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003001',true);
select pg_temp.year_assert(public.available_papers()='[]'::jsonb,
  'free year paper is absent from paid mock catalogue');
select set_config('test.year.attempt',public.start_free_year_paper('10000000-0000-4000-8000-000000003001')::text,true);
select pg_temp.year_assert(public.start_free_year_paper('10000000-0000-4000-8000-000000003001')::text=current_setting('test.year.attempt')
  and (public.read_attempt(current_setting('test.year.attempt')::uuid)->'questions'->0 ? 'correctKey')=false
  and jsonb_array_length(public.read_attempt(current_setting('test.year.attempt')::uuid)->'questions')=57,
  'free retry resumes frozen attempt without exposing an answer');
select pg_temp.year_assert(jsonb_array_length(public.my_year_paper_attempts())=1
  and public.my_year_paper_attempts()->0->>'paperId'='10000000-0000-4000-8000-000000003001'
  and public.my_year_paper_attempts()->0->>'attemptId'=current_setting('test.year.attempt')
  and public.my_year_paper_attempts()->0->>'status'='active'
  and public.my_year_paper_attempts()->0->'score'='null'::jsonb,
  'the owner sees the saved paper without sealed answers or marks');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003002',true);
select pg_temp.year_assert(public.my_year_paper_attempts()='[]'::jsonb,
  'another student cannot read the owner paper');
select pg_temp.year_reject(format('select public.read_attempt(%L::uuid)',current_setting('test.year.attempt')));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003001',true);
select public.submit_attempt(current_setting('test.year.attempt')::uuid);
select pg_temp.year_assert(jsonb_array_length(public.my_year_paper_attempts())=1
  and public.my_year_paper_attempts()->0->>'status'='submitted'
  and (public.my_year_paper_attempts()->0->>'score')::numeric=0
  and (public.my_year_paper_attempts()->0->>'total')::numeric>0,
  'the owner receives the released scored attempt after submission');
select pg_temp.year_reject('select public.start_attempt(''10000000-0000-4000-8000-000000003001'')');
reset role;
-- A change in the current bank invalidates the release and blocks new starts.
update dm_private.bank_questions set owner_approved=false where external_key='mvp-original-1';
select pg_temp.year_assert(public.free_year_paper_catalog()='[]'::jsonb,'review revocation hides the paper');
set local role authenticated;
select pg_temp.year_reject('select public.start_free_year_paper(''10000000-0000-4000-8000-000000003001'')');
reset role;
rollback;
\echo 'PASS: free year paper release, completeness, paid separation, account starts and review revocation.'
