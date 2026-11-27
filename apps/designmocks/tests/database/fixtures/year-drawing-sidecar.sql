-- This runs inside the historical-paper preparation transaction, after release.
-- The first student already started the original objective-only paper.
insert into auth.users(id) values('00000000-0000-4000-8000-000000000385');
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,source_commit)
values('fictional-year-b1',repeat('b',64),'uceed','DESCRIPTIVE','drawing','owner-provided',
  '{"provenance":{"paperId":"uceed-2026"},"holds":[],"assets":[],"taskMarks":20,"prompt":"Draw two shapes.","explanation":"Look for a clear relationship between your two forms."}',repeat('c',40));
select set_config('test.sidecar',jsonb_build_object('sourcePaperId','uceed-2026','exam','uceed','year',2026,'supported',true,'timer','shared',
  'digest',repeat('1',64),'durationSeconds',10800,'uploadGraceSeconds',600,'drawingMarksTotal',20,
  'sections','[{"plan":"objective"},{"questionKeys":["fictional-year-b1"]}]'::jsonb,
  'items',jsonb_build_array(jsonb_build_object('externalKey','fictional-year-b1','contentSha256',repeat('b',64),
    'prompt','Draw two shapes.','explanation','Look for a clear relationship between your two forms.',
    'assets','[]'::jsonb,'marking','{"max":20}'::jsonb,
    'drawing','{"criteria":[{"id":"form","label":"Form","max":20}],"criteriaSource":"printed","instructions":[],"maxImages":2}'::jsonb)))::text,true);
select dm_private.install_year_drawing_sidecar(current_setting('test.sidecar')::jsonb,
  current_setting('test.year.receipt')::jsonb->>'manifestSha256');
select pg_temp.year_prepare_assert(not has_function_privilege('authenticated','dm_private.install_year_drawing_sidecar(jsonb,text)','execute'),
  'students cannot install drawing plans');
set local role authenticated;
select pg_temp.year_prepare_assert(public.start_free_year_paper(current_setting('test.year.paper')::uuid)::text=current_setting('test.year.attempt')
  and public.read_attempt(current_setting('test.year.attempt')::uuid)->'yearDrawing'='null'::jsonb,'existing attempt keeps original snapshot');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000385',true);
select set_config('test.drawingAttempt',public.start_free_year_paper(current_setting('test.year.paper')::uuid)::text,true);
select set_config('test.drawingResult',public.read_attempt(current_setting('test.drawingAttempt')::uuid)::text,true);
select pg_temp.year_prepare_assert(jsonb_array_length(current_setting('test.drawingResult')::jsonb->'questions')=58
  and current_setting('test.drawingResult')::jsonb#>>'{questions,57,drawing,criteria,0,id}'='form'
  and not (current_setting('test.drawingResult')::jsonb#>'{questions,57}') ? 'explanation','original criteria and hidden answer key during attempt');
reset role;
update dm_private.attempts set deadline=clock_timestamp()-interval '1 minute',upload_deadline=clock_timestamp()+interval '9 minutes'
where id=current_setting('test.drawingAttempt')::uuid;
set local role authenticated;
select pg_temp.year_prepare_assert(public.finalize_my_expired_attempts()=0 and public.read_attempt(current_setting('test.drawingAttempt')::uuid)->>'status'='active',
 'sweep and read preserve upload grace');
select pg_temp.year_prepare_assert(public.can_upload_drawing(current_setting('test.drawingAttempt')::uuid,
  (current_setting('test.drawingResult')::jsonb#>>'{questions,57,id}')::uuid,1),'student may upload in grace');
select set_config('test.submittedDrawing',public.submit_attempt(current_setting('test.drawingAttempt')::uuid)::text,true);
select pg_temp.year_prepare_assert(current_setting('test.submittedDrawing')::jsonb#>>'{questions,57,drawingEstimate,status}'='not_attempted'
  and current_setting('test.submittedDrawing')::jsonb#>>'{questions,57,explanation}' is not null
  and not public.can_upload_drawing(current_setting('test.drawingAttempt')::uuid,(current_setting('test.drawingResult')::jsonb#>>'{questions,57,id}')::uuid,1),
  'early submit ends upload window and shows no-photo review');
-- The deferred validator executes after the SECURITY DEFINER registration
-- returns. Force it to fire as the same service role that commits an Edge RPC.
select set_config('test.uploadAttempt',public.start_free_year_paper(current_setting('test.year.paper')::uuid)::text,true);
select set_config('test.uploadQuestion',public.read_attempt(current_setting('test.uploadAttempt')::uuid)#>>'{questions,57,id}',true);
reset role;
insert into storage.objects(bucket_id,name,metadata) values
  ('drawing-submissions','drawings/10000000-0000-4000-8000-000000000386.jpg','{"mimetype":"image/jpeg","size":"300"}');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.register_drawing_upload('00000000-0000-4000-8000-000000000385',current_setting('test.uploadAttempt')::uuid,
  current_setting('test.uploadQuestion')::uuid,'drawings/10000000-0000-4000-8000-000000000386.jpg',1,'image/jpeg',300,160,100,1);
set constraints all immediate;
set constraints all deferred;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.year_prepare_assert(jsonb_array_length(public.my_drawing_uploads(current_setting('test.uploadAttempt')::uuid,
  current_setting('test.uploadQuestion')::uuid))=1,'validated service-role upload survives the deferred commit check');
select public.submit_attempt(current_setting('test.uploadAttempt')::uuid) is not null;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003101',true);
do $$begin
  begin perform public.read_attempt(current_setting('test.drawingAttempt')::uuid); exception when others then
    if sqlerrm='Attempt not found' then return; end if; raise; end;
  raise exception 'A student read another student’s drawing result';
end$$;
reset role;
update dm_private.year_drawing_versions set active=false where paper_id=current_setting('test.year.paper')::uuid;
