\set ON_ERROR_STOP on
\set editor '00000000-0000-4000-8000-000000000094'
\set student '00000000-0000-4000-8000-000000000095'
\set other_student '00000000-0000-4000-8000-000000000096'
begin;

create function pg_temp.lesson_assert(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
end $$;
create function pg_temp.lesson_reject(statement text,expected_error text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_error in sqlerrm)>0 then return; end if;
    raise;
  end;
  raise exception 'FAIL, expected error: %',expected_error;
end $$;

insert into auth.users(id) values (:'editor'),(:'student'),(:'other_student');
insert into dm_private.admins(user_id) values (:'editor');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'editor',true);
select public.admin_save_learning_draft(null,null,'directional-contrast','nid','visual-hierarchy',
  'Directional contrast','Use contrast to establish a clear reading order.',
  'First draft of an original fictional lesson.',1) as lesson_id \gset
select pg_temp.lesson_assert(public.admin_learning_lessons()->0->>'version'='1' and
  public.admin_learning_lessons()->0->>'published'='false','new lesson starts as a draft');

select set_config('request.jwt.claim.sub',:'student',true);
select pg_temp.lesson_assert(public.learning_catalog()='[]'::jsonb,'draft is absent from student catalogue');
select pg_temp.lesson_reject('select public.read_learning_lesson(''directional-contrast'')','Lesson not found');
select pg_temp.lesson_reject(format('select public.complete_learning_lesson(%L)',:'lesson_id'),'Lesson not found');
select pg_temp.lesson_reject('select public.admin_learning_lessons()','Admin access required');
select pg_temp.lesson_reject('select public.admin_save_learning_draft(null,null,''student-draft'',''nid'',''observation'',''Unauthorised draft'',''This is a synthetic summary.'',''This lesson should not be stored.'',1)','Admin access required');
select pg_temp.lesson_reject(format('select public.admin_set_learning_publication(%L,1,true,%L)',:'lesson_id','Unauthorised change'),'Admin access required');

select set_config('request.jwt.claim.sub',:'editor',true);
select pg_temp.lesson_assert(public.admin_save_learning_draft(:'lesson_id',1,'directional-contrast','nid','visual-hierarchy',
  'Directional contrast','Use contrast to establish a clear reading order.',
  'Edited original fictional lesson ready for publication.',1)=:'lesson_id','draft edit keeps lesson identity');
select pg_temp.lesson_reject(format('select public.admin_save_learning_draft(%L,1,''directional-contrast'',''nid'',''visual-hierarchy'',''Directional contrast'',''A stale browser tried to edit this.'',''A stale draft should never overwrite a saved one.'',1)',:'lesson_id'),'Lesson changed');
select pg_temp.lesson_reject(format('select public.admin_set_learning_publication(%L,2,true,%L)',:'lesson_id',' x '),'Give a reason');
select pg_temp.lesson_assert(public.admin_set_learning_publication(:'lesson_id',2,true,'  Synthetic original with publication consent.  '),'admin records evidence and publishes');
select pg_temp.lesson_assert(not public.admin_set_learning_publication(:'lesson_id',3,true,'Duplicate publication action'),'unchanged publication is idempotent');
select pg_temp.lesson_reject(format('select public.admin_save_learning_draft(%L,3,''directional-contrast'',''nid'',''visual-hierarchy'',''Directional contrast'',''An attempted published edit.'',''Published content must go through draft editing.'',1)',:'lesson_id'),'Withdraw the published lesson');

select set_config('request.jwt.claim.sub',:'student',true);
select pg_temp.lesson_assert(jsonb_array_length(public.learning_catalog())=1 and
  public.read_learning_lesson('directional-contrast')->>'body'='Edited original fictional lesson ready for publication.' and
  not (public.learning_catalog()->0 ?| array['body','reason','version']) and
  not (public.read_learning_lesson('directional-contrast') ?| array['reason','version','rightsConfirmed']),
  'published lesson text is visible and audit details remain private');
select public.complete_learning_lesson(:'lesson_id');
select public.complete_learning_lesson(:'lesson_id');
select pg_temp.lesson_assert(public.learning_catalog()->0->>'completed'='true','student completion is idempotent');
select set_config('request.jwt.claim.sub',:'other_student',true);
select pg_temp.lesson_assert(public.learning_catalog()->0->>'completed'='false','student progress is scoped to its owner');

select set_config('request.jwt.claim.sub',:'editor',true);
select pg_temp.lesson_reject(format('select public.admin_set_learning_publication(%L,2,false,%L)',:'lesson_id','Stale withdrawal'),'Lesson changed');
select pg_temp.lesson_assert(public.admin_set_learning_publication(:'lesson_id',3,false,'Withdraw while the editor updates the text.'),'admin withdraws published lesson');
select pg_temp.lesson_assert(public.admin_learning_lessons()->0->>'rightsConfirmed'='false','republishing needs a new rights confirmation');
select set_config('request.jwt.claim.sub',:'student',true);
select pg_temp.lesson_assert(public.learning_catalog()='[]'::jsonb and public.learning_progress()->>'total'='0','withdrawn lesson is excluded from Learn and progress');
select pg_temp.lesson_reject('select public.read_learning_lesson(''directional-contrast'')','Lesson not found');
select pg_temp.lesson_reject(format('select public.complete_learning_lesson(%L)',:'lesson_id'),'Lesson not found');

select set_config('request.jwt.claim.sub',:'editor',true);
select public.admin_save_learning_draft(:'lesson_id',4,'directional-contrast','nid','visual-hierarchy',
  'Directional contrast','Use contrast to establish a clear reading order.',
  'Revised and reviewed fictional lesson after withdrawal.',1);
select pg_temp.lesson_assert(public.admin_set_learning_publication(:'lesson_id',5,true,'Rights reconfirmed for the revised original lesson.'),'admin republishes a revised lesson');
select set_config('request.jwt.claim.sub',:'student',true);
select pg_temp.lesson_assert(public.read_learning_lesson('directional-contrast')->>'body'='Revised and reviewed fictional lesson after withdrawal.'
  and public.learning_catalog()->0->>'completed'='true','republishing keeps prior student completion');

select set_config('request.jwt.claim.sub',:'editor',true);
select public.admin_upsert_learning_lesson(:'lesson_id','directional-contrast','nid','visual-hierarchy',
  'Directional contrast','Use contrast to establish a clear reading order.',
  'Synthetic write by an existing administrator client.',1,true,true);
select pg_temp.lesson_assert(public.admin_learning_lessons()->0->>'version'='7','legacy writes invalidate versions in open forms');
reset role;
select pg_temp.lesson_assert((select count(*)=3 from dm_private.learning_publication_audit where lesson_id=:'lesson_id'),
  'only actual publication transitions from the editor are audited');
select pg_temp.lesson_assert(exists(select 1 from dm_private.learning_publication_audit where lesson_id=:'lesson_id' and version=3
  and actor_id=:'editor' and published and reason='Synthetic original with publication consent.'),'publish audit preserves evidence and actor');
select pg_temp.lesson_assert(exists(select 1 from dm_private.learning_publication_audit where lesson_id=:'lesson_id' and version=4
  and not published and reason='Withdraw while the editor updates the text.'),'withdraw audit preserves reason');
rollback;
\echo 'PASS: theory drafts, audited publication, withdrawal, version conflicts and preserved private student progress.'
