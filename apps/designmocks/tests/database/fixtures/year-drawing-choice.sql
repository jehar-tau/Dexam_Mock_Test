-- Fictional elective tasks share one mark allowance. One has its own A/B choice.
insert into dm_private.bank_questions(external_key,content_sha256,exam,question_type,topic,licence,payload,source_commit)
select 'fictional-year-b2',repeat('c',64),exam,question_type,topic,licence,payload,source_commit from dm_private.bank_questions where external_key='fictional-year-b1';
select set_config('test.choiceDoc', (current_setting('test.sidecar')::jsonb || jsonb_build_object(
  'digest',repeat('4',64),'sections','[{"chooseOne":true,"label":"Select one design","questionKeys":["fictional-year-b1","fictional-year-b2"]}]'::jsonb,
  'items',jsonb_build_array(current_setting('test.sidecar')::jsonb#>'{items,0}',
    jsonb_set(current_setting('test.sidecar')::jsonb#>'{items,0}' || jsonb_build_object('externalKey','fictional-year-b2','contentSha256',repeat('c',64)),
      '{drawing,alternatives}','[{"id":"A","label":"First design"},{"id":"B","label":"Second design"}]'))))::text,true);
select dm_private.install_year_drawing_sidecar(current_setting('test.choiceDoc')::jsonb,
 current_setting('test.year.receipt')::jsonb->>'manifestSha256');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000385',true);
select set_config('test.choiceAttempt',public.start_free_year_paper(current_setting('test.year.paper')::uuid)::text,true);
select set_config('test.choiceRead',public.read_attempt(current_setting('test.choiceAttempt')::uuid)::text,true);
select set_config('test.electiveA',current_setting('test.choiceRead')::jsonb#>>'{questions,57,id}',true);
select set_config('test.electiveB',current_setting('test.choiceRead')::jsonb#>>'{questions,58,id}',true);
select pg_temp.year_prepare_assert(not public.can_upload_drawing(current_setting('test.choiceAttempt')::uuid,current_setting('test.electiveA')::uuid,1)
 and not public.can_upload_drawing(current_setting('test.choiceAttempt')::uuid,current_setting('test.electiveB')::uuid,1),'unselected tasks refuse images');
select public.choose_year_drawing_task(current_setting('test.choiceAttempt')::uuid,current_setting('test.electiveA')::uuid);
select pg_temp.year_prepare_assert(public.can_upload_drawing(current_setting('test.choiceAttempt')::uuid,current_setting('test.electiveA')::uuid,1),'chosen task allows upload');
do $$begin begin perform public.choose_year_drawing_task(current_setting('test.choiceAttempt')::uuid,current_setting('test.electiveB')::uuid,'C');
exception when others then if sqlerrm='Select a printed alternative' then return; end if; raise; end;raise exception 'Unexpected alternative accepted';end$$;
select public.choose_year_drawing_task(current_setting('test.choiceAttempt')::uuid,current_setting('test.electiveB')::uuid,'B');
select pg_temp.year_prepare_assert(not public.can_upload_drawing(current_setting('test.choiceAttempt')::uuid,current_setting('test.electiveA')::uuid,1)
 and public.can_upload_drawing(current_setting('test.choiceAttempt')::uuid,current_setting('test.electiveB')::uuid,1)
 and public.read_attempt(current_setting('test.choiceAttempt')::uuid)#>>'{questions,58,drawingChoice,alternative}'='B','changing tasks preserves one ballot and authored alternative');
reset role;
select pg_temp.year_prepare_assert(dm_private.year_drawing_alternative(current_setting('test.choiceAttempt')::uuid,current_setting('test.electiveB')::uuid)='"B"'::jsonb,'worker receives the chosen alternative');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003101',true);
do $$begin begin perform public.choose_year_drawing_task(current_setting('test.choiceAttempt')::uuid,current_setting('test.electiveA')::uuid);
exception when others then if sqlerrm='Drawing choice is closed' then return; end if; raise; end;raise exception 'Other student edited a ballot';end$$;
reset role;
update dm_private.year_drawing_versions set active=false where paper_id=current_setting('test.year.paper')::uuid;
