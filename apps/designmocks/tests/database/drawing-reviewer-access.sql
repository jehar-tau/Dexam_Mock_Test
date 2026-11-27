\set ON_ERROR_STOP on
\set admin '00000000-0000-4000-8000-000000000090'
\set student '00000000-0000-4000-8000-000000000091'
\set teacher '00000000-0000-4000-8000-000000000092'
\set other_teacher '00000000-0000-4000-8000-000000000093'
\set paper '10000000-0000-4000-8000-000000000090'
\set student_attempt '30000000-0000-4000-8000-000000000091'
\set teacher_attempt '30000000-0000-4000-8000-000000000092'
\set upload_open_attempt '30000000-0000-4000-8000-000000000093'
\set released_review '40000000-0000-4000-8000-000000000001'
\set ungraded_review '40000000-0000-4000-8000-000000000002'
\set saved_review '40000000-0000-4000-8000-000000000003'
\set own_review '40000000-0000-4000-8000-000000000024'
\set upload_open_review '40000000-0000-4000-8000-000000000025'
begin;

create function pg_temp.reviewer_assert(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
end $$;
create function pg_temp.reviewer_reject(statement text,expected_error text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_error in sqlerrm)>0 then return; end if;
    raise;
  end;
  raise exception 'FAIL, expected error: %',expected_error;
end $$;

insert into auth.users(id) values (:'admin'),(:'student'),(:'teacher'),(:'other_teacher');
insert into dm_private.admins(user_id) values (:'admin');
insert into dm_private.papers(id,title,exam,duration_seconds,source_kind)
  values(:'paper','Synthetic drawing reviewer fixture','uceed',900,'catalogue');
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,points,topic)
  select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,:'paper',n,
    'Original drawing prompt '||n,'[]','drawing','{"correct":20,"wrong":0}',20,'drawing'
  from generate_series(1,23) n;
insert into dm_private.attempts(id,user_id,paper_id,status,deadline,submitted_at,upload_deadline,score,total) values
  (:'student_attempt',:'student',:'paper','submitted',now()-interval '1 hour',now()-interval '1 hour',null,0,0),
  (:'teacher_attempt',:'teacher',:'paper','submitted',now()-interval '1 hour',now()-interval '1 hour',null,0,0),
  (:'upload_open_attempt',:'student',:'paper','submitted',now(),now(),now()+interval '15 minutes',0,0);
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,key,explanation)
  select a.id,q.id,q.ordinal,q.prompt,q.options,q.kind,q.marking,q.media,q.points,q.negative_points,q.topic,
    '{"kind":"self_review"}','Synthetic drawing fixture.'
  from dm_private.attempts a join dm_private.questions q on q.paper_id=a.paper_id
  where a.id=:'student_attempt' or q.ordinal=1;
insert into dm_private.drawing_uploads(attempt_id,question_id,student_id,storage_path,ordinal,mime_type,byte_size)
  select i.attempt_id,i.question_id,a.user_id,'drawings/reviewer-fixture/'||i.attempt_id||'/'||i.ordinal||'.png',1,'image/png',1024
  from dm_private.attempt_items i join dm_private.attempts a on a.id=i.attempt_id;
-- Queue paging needs more than a month's marking allowance; the allowance has its own test.
alter table dm_private.drawing_reviews disable trigger drawing_reviews_pass_gate;
insert into dm_private.drawing_reviews(id,attempt_id,question_id)
  select ('40000000-0000-4000-8000-'||lpad(i.ordinal::text,12,'0'))::uuid,i.attempt_id,i.question_id
  from dm_private.attempt_items i where i.attempt_id=:'student_attempt'
  union all select :'own_review'::uuid,i.attempt_id,i.question_id from dm_private.attempt_items i where i.attempt_id=:'teacher_attempt'
  union all select :'upload_open_review'::uuid,i.attempt_id,i.question_id from dm_private.attempt_items i where i.attempt_id=:'upload_open_attempt';
alter table dm_private.drawing_reviews enable trigger drawing_reviews_pass_gate;

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.reviewer_assert(public.record_drawing_ai_suggestion(:'released_review','Fixture provider','Fixture model','fixture-v1',
  '{"Composition":8.25,"Contrast":5.75}','Synthetic advisory for assigned reviewer.',14,0.8,'["Check contrast"]') is not null,
  'service can record criterion advice for closed evidence');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'student',true);
select pg_temp.reviewer_assert(not public.can_review_drawings(),'ordinary student has no reviewer access');
select pg_temp.reviewer_reject('select public.my_drawing_review_page()','Drawing reviewer access required');
select pg_temp.reviewer_reject(format('select public.admin_claim_drawing_review(%L)',:'own_review'),'Drawing reviewer access required');
select pg_temp.reviewer_reject(format('select public.admin_set_drawing_reviewer(%L,true,%L)',:'student','Self assignment'),'Admin access required');

select set_config('request.jwt.claim.sub',:'admin',true);
select pg_temp.reviewer_assert(public.can_review_drawings(),'administrator retains drawing access');
select pg_temp.reviewer_reject(format('select public.admin_set_drawing_reviewer(%L,true,%L)',:'teacher','   x  '),'Give a reason');
select pg_temp.reviewer_reject(format('select public.admin_set_drawing_reviewer(%L,true,%L)',:'paper','Unknown account'),'Existing account required');
select pg_temp.reviewer_reject(format('select public.admin_set_drawing_reviewer(%L,true,%L)',:'admin','Duplicate admin role'),'already has administrator review access');
select pg_temp.reviewer_assert(public.admin_set_drawing_reviewer(:'teacher',true,'Teacher training completed'),'grant reviewer access');
select pg_temp.reviewer_assert(not public.admin_set_drawing_reviewer(:'teacher',true,'Retried grant'),'repeat grant is idempotent');
select pg_temp.reviewer_assert(public.admin_set_drawing_reviewer(:'other_teacher',true,'Second fixture reviewer'),'grant another reviewer');
select pg_temp.reviewer_assert(jsonb_array_length(public.admin_drawing_reviewers())=2,'admin sees the reviewer roster');

select set_config('request.jwt.claim.sub',:'teacher',true);
select pg_temp.reviewer_assert(public.can_review_drawings() and not public.is_dmocks_admin(),'reviewer role grants only drawing review');
select pg_temp.reviewer_reject('select public.admin_drawing_reviewers()','Admin access required');
select pg_temp.reviewer_reject('select public.admin_drawing_queue()','Admin access required');
select pg_temp.reviewer_reject('select public.admin_operational_health()','Admin access required');
select pg_temp.reviewer_reject('select public.admin_bank_questions(1,0)','Admin access required');
select pg_temp.reviewer_reject(format('select public.admin_release_all_india_results(%L)',:'paper'),'Admin access required');
select pg_temp.reviewer_reject('select public.my_drawing_review_page(''all'')','Unknown drawing review queue');
with first as (select public.my_drawing_review_page() as result),
  second as (select public.my_drawing_review_page('available',(result->>'nextCursor')::uuid) as result from first)
select pg_temp.reviewer_assert(jsonb_array_length(first.result->'items')=20 and jsonb_array_length(second.result->'items')=3
  and first.result->>'nextCursor'=first.result->'items'->19->>'reviewId'
  and second.result->>'nextCursor' is null
  and first.result->>'nextCursor'<second.result->'items'->0->>'reviewId',
  'keyset pages exclude self and open upload windows') from first,second;
select pg_temp.reviewer_assert(not((public.my_drawing_review_page()->'items'->0)?|array['attemptId','studentId','questionId','storagePath'])
  and public.my_drawing_review_page()->'items'->0->>'score' is null
  and public.my_drawing_review_page()->'items'->0->>'aiSuggestion' is null,'claimable queue omits private fields and advisory');
select pg_temp.reviewer_reject(format('select public.admin_claim_drawing_review(%L)',:'own_review'),'Review unavailable');
select pg_temp.reviewer_reject(format('select public.admin_claim_drawing_review(%L)',:'upload_open_review'),'Student upload window is still open');
select pg_temp.reviewer_reject(format('select public.admin_drawing_review_media_paths(%L)',:'released_review'),'Claim the review');
select public.admin_claim_drawing_review(:'released_review');
select public.admin_claim_drawing_review(:'ungraded_review');
select public.admin_claim_drawing_review(:'saved_review');
select pg_temp.reviewer_assert(jsonb_array_length(public.my_drawing_review_page('mine')->'items')=3,'claims appear only in my reviews');
select pg_temp.reviewer_assert((select card->'aiSuggestion'->'criteria'='{"Composition":8.25,"Contrast":5.75}'::jsonb
  and card->'aiSuggestion'->>'proposedScore'='14' and card->>'score' is null
  from jsonb_array_elements(public.my_drawing_review_page('mine')->'items') card where card->>'reviewId'=:'released_review'),
  'assigned reviewer sees exact criterion advice and an unset human grade');
select pg_temp.reviewer_assert(jsonb_array_length(public.admin_drawing_review_media_paths(:'released_review'))=1,'assigned reviewer can access private page');
select public.admin_review_drawing(:'released_review',1,'{"Clarity":15}','The visual hierarchy is clear.',15);
select public.admin_review_drawing(:'saved_review',1,'{"Clarity":14}','Feedback saved before revocation.',14);

select set_config('request.jwt.claim.sub',:'other_teacher',true);
select pg_temp.reviewer_assert(public.my_drawing_review_page('mine')->'items'='[]'::jsonb,'other reviewer cannot list assignments or saved marks');
select pg_temp.reviewer_reject(format('select public.admin_drawing_review_media_paths(%L)',:'saved_review'),'Review unavailable');
select pg_temp.reviewer_reject(format('select public.admin_review_drawing(%L,2,%L,%L,16,%L)',
  :'saved_review','{"Clarity":16}','Attempted overwrite.','Other reviewer'),'Review unavailable');
select pg_temp.reviewer_reject(format('select public.admin_release_drawing_review(%L,2)',:'saved_review'),'Review is not ready');
select pg_temp.reviewer_reject(format('select public.admin_return_drawing_review(%L,1)',:'ungraded_review'),'Review assignment changed');

select set_config('request.jwt.claim.sub',:'teacher',true);
select public.admin_release_drawing_review(:'released_review',2);
select pg_temp.reviewer_reject(format('select public.admin_review_drawing(%L,3,%L,%L,16,%L)',
  :'released_review','{"Clarity":16}','Attempted correction.','Review correction'),'Only an administrator');
select pg_temp.reviewer_reject(format('select public.admin_drawing_review_media_paths(%L)',:'released_review'),'Review unavailable');

select set_config('request.jwt.claim.sub',:'admin',true);
select pg_temp.reviewer_assert(public.admin_set_drawing_reviewer(:'teacher',false,'  End of reviewer assignment.  '),'revoke reviewer access');
select pg_temp.reviewer_assert(not public.admin_set_drawing_reviewer(:'teacher',false,'Retried revocation'),'repeat revoke is idempotent');
select pg_temp.reviewer_assert(jsonb_array_length(public.admin_drawing_reviewers())=1,'revocation updates the active roster');
select public.admin_release_drawing_review(:'saved_review',2);
select public.admin_review_drawing(:'released_review',3,'{"Clarity":16}','Administrator corrected the marks.',16,'Verified rubric correction');
select public.admin_release_drawing_review(:'released_review',4);

select set_config('request.jwt.claim.sub',:'teacher',true);
select pg_temp.reviewer_assert(not public.can_review_drawings(),'existing session loses access immediately');
select pg_temp.reviewer_reject('select public.my_drawing_review_page(''mine'')','Drawing reviewer access required');
select pg_temp.reviewer_reject(format('select public.admin_drawing_review_media_paths(%L)',:'saved_review'),'Drawing reviewer access required');
select pg_temp.reviewer_reject(format('select public.admin_claim_drawing_review(%L)',:'ungraded_review'),'Drawing reviewer access required');

select set_config('request.jwt.claim.sub',:'other_teacher',true);
select pg_temp.reviewer_assert(public.my_drawing_review_page()->'items'->0->>'reviewId'=:'ungraded_review'
  and public.my_drawing_review_page()->'items'->0->>'version'='2','revocation requeues only the ungraded claim at a newer version');
select public.admin_claim_drawing_review(:'ungraded_review');

select set_config('request.jwt.claim.sub',:'student',true);
select pg_temp.reviewer_assert(public.read_attempt(:'student_attempt')->'questions'->0->'drawingReview'->>'score'='16'
  and public.read_attempt(:'student_attempt')->'questions'->2->'drawingReview'->>'score'='14','student receives finalized and corrected grades');
select pg_temp.reviewer_assert(not (public.read_attempt(:'student_attempt')->'questions'->0 ? 'aiSuggestion')
  and public.read_attempt(:'student_attempt')->'questions'->0->'drawingReview'->'criteria'='{"Clarity":16}'::jsonb,
  'student results expose the human criteria only');

reset role;
select pg_temp.reviewer_assert((select count(*)=3 from dm_private.drawing_reviewer_audit),'only actual role changes are audited');
select pg_temp.reviewer_assert(exists(select 1 from dm_private.drawing_reviewer_audit where user_id=:'teacher' and actor_id=:'admin'
  and not enabled and reason='End of reviewer assignment.'),'revoke audit preserves actor and reason');
select pg_temp.reviewer_assert(exists(select 1 from dm_private.drawing_review_audit where review_id=:'ungraded_review'
  and actor_id=:'admin' and action='reviewer_access_revoked' and payload->>'reviewerId'=:'teacher'),'reassignment is audited');
rollback;
\echo 'PASS: drawing reviewer grants, queue scopes, private pages, final grades and audited revocation.'
