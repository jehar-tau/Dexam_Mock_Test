\set ON_ERROR_STOP on
begin;

create function pg_temp.drawing_assert(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
end $$;
create function pg_temp.drawing_reject(statement text,expected_error text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_error in sqlerrm)>0 then return; end if;
    raise;
  end;
  raise exception 'FAIL, expected error: %',expected_error;
end $$;

insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000081'),('00000000-0000-4000-8000-000000000082'),
  ('00000000-0000-4000-8000-000000000083');
insert into dm_private.admins(user_id) values
  ('00000000-0000-4000-8000-000000000081'),('00000000-0000-4000-8000-000000000082'),
  ('00000000-0000-4000-8000-000000000083');
insert into dm_private.papers(id,title,exam,duration_seconds,source_kind)
  values('10000000-0000-4000-8000-000000000081','Original drawing review fixture','uceed',900,'catalogue');
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,reviewed)
  values('20000000-0000-4000-8000-000000000081','10000000-0000-4000-8000-000000000081',
    1,'Create an original wayfinding sketch','[]','drawing','{"correct":20,"wrong":0}','[]',20,0,'drawing',true);
insert into dm_private.answer_keys(question_id,key,explanation)
  values('20000000-0000-4000-8000-000000000081','{"kind":"self_review"}','Human review is separate.');
\ir fixtures/active-pass.sql
select pg_temp.grant_test_pass('00000000-0000-4000-8000-000000000081');
insert into dm_private.attempts(id,user_id,paper_id,deadline,upload_deadline)
  values('30000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000081',
    '10000000-0000-4000-8000-000000000081',now()+interval '15 minutes',now()+interval '25 minutes');
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,key,explanation)
  select '30000000-0000-4000-8000-000000000081',q.id,q.ordinal,q.prompt,q.options,q.kind,q.marking,q.media,
    q.points,q.negative_points,q.topic,k.key,k.explanation from dm_private.questions q join dm_private.answer_keys k on k.question_id=q.id;
insert into dm_private.drawing_uploads(attempt_id,question_id,student_id,storage_path,ordinal,mime_type,byte_size)
  values('30000000-0000-4000-8000-000000000081','20000000-0000-4000-8000-000000000081',
    '00000000-0000-4000-8000-000000000081','drawings/lifecycle/previous-format-page.png',1,'image/png',1024);

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000081',true);
select public.submit_attempt('30000000-0000-4000-8000-000000000081');
select pg_temp.drawing_assert(public.read_attempt('30000000-0000-4000-8000-000000000081')->'questions'->0->'drawingReview'->>'status'='pending',
  'submitted upload automatically enters review');
select pg_temp.drawing_assert(public.admin_drawing_queue()='[]'::jsonb,'an administrator cannot see their own submission as a teacher');
reset role;
select set_config('test.lifecycle_review',(select id::text from dm_private.drawing_reviews),true);

set local role authenticated;
select pg_temp.drawing_reject('select public.admin_claim_drawing_review(current_setting(''test.lifecycle_review'')::uuid)','Review unavailable');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000082',true);
select pg_temp.drawing_assert(jsonb_array_length(public.admin_drawing_queue())=1 and not(public.admin_drawing_queue()->0->>'canClaim')::boolean,
  'administrator sees the queue but must wait for uploads to close');
select pg_temp.drawing_assert(not((public.admin_drawing_queue()->0)?|array['attemptId','studentId','questionId']),'queue omits identifying IDs');
select pg_temp.drawing_reject('select public.admin_claim_drawing_review(current_setting(''test.lifecycle_review'')::uuid)','Student upload window is still open');
select pg_temp.drawing_reject('select public.admin_drawing_review_media_paths(current_setting(''test.lifecycle_review'')::uuid)','Review unavailable');
reset role;
-- This paper now models an early submission without grace. The remaining exam time does not keep uploads open.
update dm_private.attempts set upload_deadline=null where id='30000000-0000-4000-8000-000000000081';

set local role authenticated;
select pg_temp.drawing_reject('select public.admin_drawing_review_media_paths(current_setting(''test.lifecycle_review'')::uuid)','Claim the review');
select pg_temp.drawing_reject('select public.admin_review_drawing(current_setting(''test.lifecycle_review'')::uuid,0,''{"composition":8,"clarity":7}'',''Before claiming.'',15)','Claim this review');
select public.admin_claim_drawing_review(current_setting('test.lifecycle_review')::uuid);
select public.admin_claim_drawing_review(current_setting('test.lifecycle_review')::uuid);
select pg_temp.drawing_assert((public.admin_drawing_queue()->0->>'version')::integer=1 and (public.admin_drawing_queue()->0->>'canReview')::boolean,
  'claim is idempotent for the assigned teacher');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000083',true);
select pg_temp.drawing_reject('select public.admin_claim_drawing_review(current_setting(''test.lifecycle_review'')::uuid)','already claimed');
select pg_temp.drawing_reject('select public.admin_drawing_review_media_paths(current_setting(''test.lifecycle_review'')::uuid)','assigned to another teacher');
select pg_temp.drawing_reject('select public.admin_return_drawing_review(current_setting(''test.lifecycle_review'')::uuid,1)','Review assignment changed');
select pg_temp.drawing_reject('select public.admin_review_drawing(current_setting(''test.lifecycle_review'')::uuid,1,''{"composition":8,"clarity":7}'',''Concurrent overwrite.'',15)','Claim this review');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000082',true);
select pg_temp.drawing_assert(jsonb_array_length(public.admin_drawing_review_media_paths(current_setting('test.lifecycle_review')::uuid))=1,
  'assigned teacher can inspect an existing page');
select public.admin_return_drawing_review(current_setting('test.lifecycle_review')::uuid,1);
select pg_temp.drawing_reject('select public.admin_drawing_review_media_paths(current_setting(''test.lifecycle_review'')::uuid)','Claim the review');
select public.admin_claim_drawing_review(current_setting('test.lifecycle_review')::uuid);
select pg_temp.drawing_reject('select public.admin_review_drawing(current_setting(''test.lifecycle_review'')::uuid,1,''{"composition":8,"clarity":7}'',''Stale grade draft.'',15)','Review changed');
select pg_temp.drawing_reject('select public.admin_review_drawing(current_setting(''test.lifecycle_review'')::uuid,3,''{"composition":21}'',''Too high.'',21)','within the task maximum');
select pg_temp.drawing_reject('select public.admin_review_drawing(current_setting(''test.lifecycle_review'')::uuid,3,''{"composition":8,"clarity":7}'',''Mismatched total.'',14)','Criterion marks must add up');
select pg_temp.drawing_reject('select public.admin_review_drawing(current_setting(''test.lifecycle_review'')::uuid,3,null,''Missing criteria.'',15)','scoring criteria');
select pg_temp.drawing_reject('select public.admin_review_drawing(current_setting(''test.lifecycle_review'')::uuid,3,''{"composition":15}'',null,15)','Feedback');
select public.admin_review_drawing(current_setting('test.lifecycle_review')::uuid,3,'{"composition":8,"clarity":7}',
  'Clear structure; strengthen contrast.',15);

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000081',true);
select pg_temp.drawing_assert(public.read_attempt('30000000-0000-4000-8000-000000000081')->'questions'->0->'drawingReview'='{"status":"pending"}',
  'teacher draft and marks remain private before release');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000082',true);
select pg_temp.drawing_reject('select public.admin_release_drawing_review(current_setting(''test.lifecycle_review'')::uuid,3)','has changed');
select public.admin_release_drawing_review(current_setting('test.lifecycle_review')::uuid,4);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000081',true);
select pg_temp.drawing_assert((public.read_attempt('30000000-0000-4000-8000-000000000081')->'questions'->0->'drawingReview'->>'score')::numeric=15,
  'student sees the released score');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000083',true);
select pg_temp.drawing_reject('select public.admin_review_drawing(current_setting(''test.lifecycle_review'')::uuid,5,''{"composition":9,"clarity":7}'',''Changed review.'',16)','override reason');
select public.admin_review_drawing(current_setting('test.lifecycle_review')::uuid,5,'{"composition":9,"clarity":7}',
  'Changed after moderation.',16,'Second reviewer correction');
select pg_temp.drawing_reject('select public.admin_review_drawing(current_setting(''test.lifecycle_review'')::uuid,5,''{"composition":8,"clarity":7}'',''Competing override.'',15,''Would otherwise be valid'')','Review changed');
select pg_temp.drawing_assert((public.admin_drawing_queue()->0->>'status')='reviewed','override requires a fresh explicit release');
reset role;
select pg_temp.drawing_assert((select array_agg(action order by id)=array['claim','return','claim','review','release','override']
  from dm_private.drawing_review_audit),'claim, return, review, release and override are audited once');
select pg_temp.drawing_assert((select payload->'previous'->>'score'='15' and payload->'current'->>'score'='16'
  and payload->>'overrideReason'='Second reviewer correction' from dm_private.drawing_review_audit where action='override'),
  'override audit captures previous and current grades and rationale');

rollback;
\echo 'PASS: drawing claim, anonymous media, bounded grading, release privacy and versioned overrides.'
