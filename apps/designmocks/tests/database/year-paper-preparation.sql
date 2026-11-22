-- Fictional source-only preparation and separate exact-paper release.
begin;
create function pg_temp.year_prepare_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.year_prepare_reject(plan jsonb) returns void language plpgsql as $$
begin
  begin perform public.prepare_free_year_paper(plan);exception when others then return;end;
  raise exception 'Unexpectedly prepared a changed or incomplete year paper';
end$$;
create function pg_temp.year_prepare_reject_reason(plan jsonb,reason text) returns void language plpgsql as $$
begin
  begin perform public.prepare_free_year_paper(plan);
  exception when others then
    if sqlerrm is distinct from reason then raise exception 'Unexpected preparation error: %',sqlerrm;end if;
    return;
  end;
  raise exception 'Unexpectedly accepted incomplete historic count';
end$$;
\ir fixtures/mvp-objective-paper.sql
select pg_temp.seed_mvp_paper('uceed','10000000-0000-4000-8000-000000003101');
delete from dm_private.answer_keys where question_id in
  (select id from dm_private.questions where paper_id='10000000-0000-4000-8000-000000003101');
delete from dm_private.questions where paper_id='10000000-0000-4000-8000-000000003101';
delete from dm_private.papers where id='10000000-0000-4000-8000-000000003101';
insert into auth.users(id) values('00000000-0000-4000-8000-000000003101');
update dm_private.bank_questions set payload=jsonb_set(payload,'{provenance}',
  jsonb_build_object('exam','uceed','paperId','uceed-2026','year',2026))
  where external_key like 'mvp-original-%';
update dm_private.bank_questions set owner_approved=true,rights_confirmed=true
  where external_key like 'mvp-original-%';
select set_config('test.year.plan',jsonb_build_object(
  'format','dmocks-free-year-paper-v1','markingReference','Fictional historic paper instructions',
  'exam','uceed','year',2026,'sourcePaperId','uceed-2026','partLabel','Part A',
  'title','Fictional UCEED 2026 Part A','durationSeconds',7200,
  'questions',(select jsonb_agg(jsonb_build_object('externalKey',external_key,
    'contentSha256',content_sha256,'marking',case when external_key='mvp-original-1'
      then '{"correct":2,"wrong":0}'::jsonb else runtime_payload->'marking' end,
    'explanation','Historical worked reasoning for fictional '||external_key)
    order by substring(external_key from '[0-9]+$')::integer)
    from dm_private.bank_questions where external_key like 'mvp-original-%')
)::text,true);
select pg_temp.year_prepare_assert(not has_function_privilege('anon','public.prepare_free_year_paper(jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','public.prepare_free_year_paper(jsonb)','EXECUTE')
  and has_function_privilege('service_role','public.prepare_free_year_paper(jsonb)','EXECUTE')
  and not has_table_privilege('authenticated','dm_private.year_paper_preparations','SELECT'),
  'preparation is private and service-only');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003101',true);
select pg_temp.year_prepare_reject(current_setting('test.year.plan')::jsonb);
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.year_prepare_reject(jsonb_set(current_setting('test.year.plan')::jsonb,
  '{questions}',(current_setting('test.year.plan')::jsonb->'questions')-56));
select pg_temp.year_prepare_reject_reason(jsonb_set(jsonb_set(current_setting('test.year.plan')::jsonb,
  '{year}','2025'::jsonb),'{questions}',(current_setting('test.year.plan')::jsonb->'questions')-56),
  'The full 57-question UCEED Part A is required');
select pg_temp.year_prepare_reject(jsonb_set(current_setting('test.year.plan')::jsonb,
  '{questions,0,contentSha256}',to_jsonb(repeat('f',64))));
select pg_temp.year_prepare_reject(jsonb_set(current_setting('test.year.plan')::jsonb,
  '{questions,0,explanation}',to_jsonb('No'::text)));
select set_config('test.year.receipt',public.prepare_free_year_paper(current_setting('test.year.plan')::jsonb)::text,true);
select pg_temp.year_prepare_assert(current_setting('test.year.receipt')::jsonb->'created'='true'::jsonb
  and current_setting('test.year.receipt')::jsonb->>'questionCount'='57'
  and public.prepare_free_year_paper(current_setting('test.year.plan')::jsonb)->'created'='false'::jsonb,
  'exact preparation creates one draft and retry returns its receipt');
reset role;
select set_config('test.year.paper',current_setting('test.year.receipt')::jsonb->>'paperId',true);
select pg_temp.year_prepare_assert(public.free_year_paper_catalog()='[]'::jsonb
  and public.available_papers()='[]'::jsonb,
  'prepared paper is hidden from free and paid catalogues');
set local role service_role;
select pg_temp.year_prepare_assert(public.register_free_year_paper(
  current_setting('test.year.paper')::uuid,'uceed',2026,'uceed-2026','Part A',57,
  current_setting('test.year.receipt')::jsonb->>'manifestSha256')->>'paperId'=current_setting('test.year.paper'),
  'review of the exact prepared manifest releases the free paper');
reset role;
select pg_temp.year_prepare_assert(jsonb_array_length(public.free_year_paper_catalog())=1,
  'the reviewed historical paper becomes visible for free');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003101',true);
select set_config('test.year.attempt',public.start_free_year_paper(current_setting('test.year.paper')::uuid)::text,true);
reset role;
insert into dm_private.papers(id,title,exam,duration_seconds) values
  ('10000000-0000-4000-8000-000000003102','Fictional other paper 1','uceed',900),
  ('10000000-0000-4000-8000-000000003103','Fictional other paper 2','uceed',900);
insert into dm_private.attempts(user_id,paper_id,deadline) values
  ('00000000-0000-4000-8000-000000003101','10000000-0000-4000-8000-000000003102',clock_timestamp()+interval'15 minutes'),
  ('00000000-0000-4000-8000-000000003101','10000000-0000-4000-8000-000000003103',clock_timestamp()+interval'15 minutes');
set local role authenticated;
select pg_temp.year_prepare_assert(public.start_free_year_paper(current_setting('test.year.paper')::uuid)::text
  =current_setting('test.year.attempt'),'resume succeeds even at the three-active-attempt limit');
select pg_temp.year_prepare_assert(public.submit_attempt(current_setting('test.year.attempt')::uuid)->>'total'='198'
  and public.read_attempt(current_setting('test.year.attempt')::uuid)->'questions'->0->>'explanation'
    ='Historical worked reasoning for fictional mvp-original-1',
  'historic marking and worked solution appear only in the submitted result');
reset role;
rollback;
\echo 'PASS: source-complete private year-paper preparation, exact retry, historic marking, worked answers and separate free release.'
