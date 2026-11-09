\set ON_ERROR_STOP on
\set student '00000000-0000-4000-8000-000000002551'
\set teacher '00000000-0000-4000-8000-000000002552'
\set other '00000000-0000-4000-8000-000000002553'
\set paper '10000000-0000-4000-8000-000000002551'
\set question '20000000-0000-4000-8000-000000002551'
\set attempt '30000000-0000-4000-8000-000000002551'
\set earlier '30000000-0000-4000-8000-000000002552'
\set review '40000000-0000-4000-8000-000000002551'
\set earlier_review '40000000-0000-4000-8000-000000002552'
\set long_label 'Explain the relationship between the principal design decision and the needs of the intended users'
begin;

create function pg_temp.rubric_assert(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
end $$;
create function pg_temp.rubric_reject(command text, expected text) returns void language plpgsql as $$
begin
  begin
    execute command;
  exception when others then
    if sqlstate=expected then return; end if;
    raise;
  end;
  raise exception 'FAIL: expected SQLSTATE %',expected;
end $$;

select jsonb_build_array(
  jsonb_build_object('label','Visual communication','points',8.25,'guidance','Credit clear visual communication and legible sketch hierarchy.'),
  jsonb_build_object('label',:'long_label','points',11.75,'guidance','Credit the original task requirements and observable evidence.')
)::text as rubric \gset
select jsonb_build_object('Visual communication',7.25,:'long_label',0)::text as valid_marks,
       jsonb_build_object('Visual communication',8.26,:'long_label',0)::text as over_limit \gset

insert into auth.users(id) values(:'student'),(:'teacher'),(:'other');
insert into dm_private.drawing_reviewers(user_id,enabled,changed_at) values(:'teacher',true,now()),(:'other',true,now());
insert into dm_private.papers(id,title,exam,duration_seconds) values(:'paper','Original authored practice fixture','nid',1200);
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,points,topic)
  values(:'question',:'paper',1,'Original fictional sketch task','[]','drawing','{"correct":20,"wrong":0}',20,'drawing');
insert into dm_private.attempts(id,user_id,paper_id,status,deadline,submitted_at,score,total) values
  (:'attempt',:'student',:'paper','submitted',now()-interval '1 hour',now()-interval '1 hour',0,20),
  (:'earlier',:'student',:'paper','submitted',now()-interval '2 hours',now()-interval '2 hours',0,20);
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,key,explanation)
  select a.id,q.id,q.ordinal,q.prompt,q.options,q.kind,q.marking,q.media,q.points,q.negative_points,q.topic,
    jsonb_build_object('kind','drawing','privateFixtureKey','Only the frozen rubric should be returned',
      'practiceContext',jsonb_build_object('version','nid-authored-practice-v1','scope','authored-practice',
        'exam','nid','responseKind','drawing','rubric',:'rubric'::jsonb)),
    'Original fictional task'
  from dm_private.attempts a join dm_private.questions q on q.paper_id=a.paper_id;
insert into dm_private.answer_keys(question_id,key,explanation)
  values(:'question','{"kind":"drawing","practiceContext":{"version":"nid-authored-practice-v1","rubric":[]}}','Later fictional authoring change');
insert into dm_private.drawing_reviews(id,attempt_id,question_id)
  values(:'review',:'attempt',:'question');
-- Represents an earlier saved grade from the free-form reviewer, before authored limits were enforced.
insert into dm_private.drawing_reviews(id,attempt_id,question_id,status,reviewer_id,review_version,criterion_marks,comments,score)
  values(:'earlier_review',:'earlier',:'question','reviewed',:'teacher',2,'{"Old free-form label":10}','Previously saved fictional grade',10);

set local role anon;
select pg_temp.rubric_reject('select public.my_drawing_review_page()','42501');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'student',true);
select pg_temp.rubric_reject('select public.my_drawing_review_page()','42501');
select set_config('request.jwt.claim.sub',:'teacher',true);
select pg_temp.rubric_assert(public.my_drawing_review_page()->'items'->0->>'rubric' is null,
  'available queue does not expose the authored rubric');
select public.admin_claim_drawing_review(:'review');
with card as (
  select item from jsonb_array_elements(public.my_drawing_review_page('mine')->'items') item
  where item->>'reviewId'=:'review'
)
select pg_temp.rubric_assert((select item->'rubric'=:'rubric'::jsonb and not (item ?| array['key','studentId','attemptId'])
    and item->>'score' is null from card),
  'claimed teacher sees the exact frozen rubric and no other key or grade');
select set_config('request.jwt.claim.sub',:'other',true);
select pg_temp.rubric_assert(public.my_drawing_review_page('mine')->'items'='[]'::jsonb,'other teacher cannot see either private assignment');
select set_config('request.jwt.claim.sub',:'teacher',true);
select pg_temp.rubric_reject(format('select public.admin_review_drawing(%L,1,%L,%L,8.26)',:'review',:'over_limit','Fixture over the individual limit'),'22023');
select pg_temp.rubric_reject(format('select public.admin_review_drawing(%L,1,%L,%L,7.25)',:'review','{"Visual communication":7.25}','Fixture with a missing criterion'),'22023');
select pg_temp.rubric_reject(format('select public.admin_release_drawing_review(%L,2)',:'earlier_review'),'22023');

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.rubric_reject(format('select public.record_drawing_ai_suggestion(%L,%L,%L,%L,%L,%L,8.26,0.8)',
  :'review','Fixture provider','Fixture model','fictional-v1',:'over_limit','Fixture advice above the criterion cap'),'22023');
select pg_temp.rubric_assert(public.record_drawing_ai_suggestion(:'review','Fixture provider','Fixture model','fictional-v1',
  :'valid_marks'::jsonb,'Fixture advice for human review',7.25,0.8) is not null,'valid advisory uses the frozen rubric');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'teacher',true);
select public.admin_review_drawing(:'review',1,:'valid_marks'::jsonb,'Independent fictional human feedback.',7.25);
select set_config('request.jwt.claim.sub',:'student',true);
select pg_temp.rubric_assert(public.read_attempt(:'attempt')->'questions'->0->'drawingReview'->>'score' is null,'unreleased grade stays private');
select set_config('request.jwt.claim.sub',:'teacher',true);
select public.admin_release_drawing_review(:'review',2);
select public.admin_review_drawing(:'earlier_review',2,:'valid_marks'::jsonb,'Corrected against the frozen rubric.',7.25,'Corrected older free-form criteria');
select public.admin_release_drawing_review(:'earlier_review',3);
select set_config('request.jwt.claim.sub',:'student',true);
select pg_temp.rubric_assert(public.read_attempt(:'attempt')->'questions'->0->'drawingReview'->'criteria'=:'valid_marks'::jsonb
  and public.read_attempt(:'earlier')->'questions'->0->'drawingReview'->>'score'='7.25',
  'only the human grade with the original criteria is released');
reset role;
select pg_temp.rubric_assert(dm_private.frozen_drawing_rubric(
  '{"kind":"drawing","practiceContext":{"scope":"authored-practice","version":"unknown"}}')='[]'::jsonb,
  'an unsupported authored snapshot cannot become a legacy free-form task');
select pg_temp.rubric_assert((select count(*)=1 from dm_private.drawing_ai_suggestions), 'invalid advice wrote nothing');
select pg_temp.rubric_assert((select count(*)=3 from dm_private.drawing_review_audit where review_id=:'review'),
  'failed review left the expected version and audit untouched');
rollback;
\echo 'PASS: frozen authored rubric, individual criterion limits, anonymous queue scopes and human release.'
