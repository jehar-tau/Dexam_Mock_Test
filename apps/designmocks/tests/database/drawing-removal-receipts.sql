\set ON_ERROR_STOP on
\set student '00000000-0000-4000-8000-000000004601'
\set foreign_student '00000000-0000-4000-8000-000000004602'
\set paper '10000000-0000-4000-8000-000000004601'
\set question '20000000-0000-4000-8000-000000004601'
\set claimed_question '20000000-0000-4000-8000-000000004602'
\set attempt '30000000-0000-4000-8000-000000004601'
\set old_path 'drawings/40000000-0000-4000-8000-000000004601.png'
\set second_path 'drawings/40000000-0000-4000-8000-000000004602.png'
\set cutoff_path 'drawings/40000000-0000-4000-8000-000000004603.png'
\set claimed_path 'drawings/40000000-0000-4000-8000-000000004604.png'
\set replacement_path 'drawings/40000000-0000-4000-8000-000000004605.png'
\set wrong_path 'drawings/40000000-0000-4000-8000-000000004606.png'
begin;

create function pg_temp.removal_assert(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;

create function pg_temp.removal_reject(statement text, label text, expected_state text default null)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when undefined_function then
    raise;
  when others then
    if expected_state is null or sqlstate = expected_state then return; end if;
    raise;
  end;
  raise exception 'FAIL, unexpectedly allowed: %', label;
end $$;

insert into auth.users(id) values (:'student'), (:'foreign_student');
insert into dm_private.papers(id,title,exam,duration_seconds,source_kind)
values (:'paper','Fictional removal receipt paper','uceed',900,'catalogue');
insert into dm_private.questions(id,paper_id,ordinal,prompt,options,kind,marking,points,topic)
values (:'question',:'paper',1,'Draw a fictional sign.','[]','drawing','{"correct":20,"wrong":0}',20,'drawing'),
  (:'claimed_question',:'paper',2,'Draw a fictional chair.','[]','drawing','{"correct":20,"wrong":0}',20,'drawing');
insert into dm_private.attempts(id,user_id,paper_id,deadline,upload_deadline)
values (:'attempt',:'student',:'paper',now()+interval '15 minutes',now()+interval '30 minutes');
insert into dm_private.attempt_items(attempt_id,question_id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,key,explanation)
select :'attempt',id,ordinal,prompt,options,kind,marking,media,points,negative_points,topic,
  '{"kind":"self_review"}','Fictional teacher review.' from dm_private.questions where paper_id=:'paper';
insert into storage.objects(bucket_id,name,metadata)
select 'drawing-submissions', name, '{"mimetype":"image/png","size":121}'::jsonb
from unnest(array[:'old_path',:'second_path',:'cutoff_path',:'claimed_path',:'replacement_path']) paths(name);

set local role service_role;
set local request.jwt.claim.role = 'service_role';
select public.register_drawing_upload(:'student',:'attempt',:'question',:'old_path',1,'image/png',121,6,4,1) as old_id \gset
select public.register_drawing_upload(:'student',:'attempt',:'question',:'second_path',2,'image/png',121) as second_id \gset
select public.register_drawing_upload(:'student',:'attempt',:'question',:'cutoff_path',3,'image/png',121) as cutoff_id \gset
select public.register_drawing_upload(:'student',:'attempt',:'claimed_question',:'claimed_path',1,'image/png',121) as claimed_id \gset
reset role;
-- An assigned review with the upload window still open isolates the review fence
-- from the cutoff fence, which a normal claim checks before changing status.
insert into dm_private.drawing_reviews(attempt_id,question_id,reviewer_id,status)
values (:'attempt',:'claimed_question',:'foreign_student','assigned');

set local role service_role;
select pg_temp.removal_reject(format('select public.remove_drawing_upload(%L,%L)',:'foreign_student',:'old_id'),
  'another student cannot remove the original upload');
select pg_temp.removal_reject(format('select public.remove_drawing_upload(%L,%L)',:'student',:'claimed_id'),
  'an assigned review prevents first removal even while the window is open');

select public.remove_drawing_upload(:'student',:'old_id') as first_result \gset
select pg_temp.removal_assert(:'first_result' = :'old_path'
  and pg_get_function_result('public.remove_drawing_upload(uuid,uuid)'::regprocedure) = 'text',
  'legacy callers keep the same text Storage path result');
select public.remove_drawing_upload(:'student',:'second_id');
select public.register_drawing_upload(:'student',:'attempt',:'question',:'replacement_path',1,'image/png',121,8,6,2)
  as replacement_id \gset
reset role;
select pg_temp.removal_assert(
  not exists (select 1 from dm_private.drawing_uploads where id=:'old_id')
  and exists (select 1 from storage.objects where bucket_id='drawing-submissions' and name=:'old_path'),
  'logical removal frees the ordinal while Storage deletion remains pending');
select to_jsonb(u) as replacement_before from dm_private.drawing_uploads u where id=:'replacement_id' \gset

update dm_private.attempts set started_at=now()-interval '1 hour',
  deadline=now()-interval '30 minutes',upload_deadline=now()-interval '15 minutes' where id=:'attempt';
set local role service_role;
select pg_temp.removal_reject(format('select public.remove_drawing_upload(%L,%L)',:'student',:'cutoff_id'),
  'a first removal after the cutoff still fails');
select pg_temp.removal_assert(public.remove_drawing_upload(:'student',:'old_id') = :'old_path',
  'the owner can replay a committed removal after the original cutoff');
select pg_temp.removal_reject(format('select public.remove_drawing_upload(%L,%L)',:'foreign_student',:'old_id'),
  'another student cannot read the retained removal receipt');
reset role;
select pg_temp.removal_assert((select to_jsonb(u) = :'replacement_before'::jsonb
  from dm_private.drawing_uploads u where id=:'replacement_id'), 'replaying old removal leaves the replacement unchanged');
select pg_temp.removal_assert((select student_id=:'student' and storage_path=:'old_path'
  and removed_at is not null and deleted_at is null from dm_private.drawing_removal_receipts where upload_id=:'old_id'),
  'the private receipt retains the exact owner and pending path');

set local role anon;
select pg_temp.removal_reject('select public.service_pending_drawing_removals(1)', 'anonymous pending list', '42501');
select pg_temp.removal_reject(format('select public.service_confirm_drawing_removal(%L,%L)',:'old_id',:'old_path'),
  'anonymous cleanup confirmation', '42501');
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
select set_config('request.jwt.claim.sub',:'student',true);
select pg_temp.removal_reject(format('select public.remove_drawing_upload(%L,%L)',:'student',:'old_id'),
  'authenticated student cannot invoke the privileged removal RPC', '42501');
select pg_temp.removal_reject('select public.service_pending_drawing_removals(1)', 'authenticated pending list', '42501');
select pg_temp.removal_reject(format('select public.service_confirm_drawing_removal(%L,%L)',:'old_id',:'old_path'),
  'authenticated cleanup confirmation', '42501');
reset role;

set local role service_role;
set local request.jwt.claim.role = 'service_role';
select public.service_pending_drawing_removals(2) as pending \gset
select pg_temp.removal_assert(:'pending'::jsonb = jsonb_build_array(
  jsonb_build_object('id',:'old_id','storagePath',:'old_path'),
  jsonb_build_object('id',:'second_id','storagePath',:'second_path')),
  'pending list returns exact bounded id/path DTOs in removal order');
select pg_temp.removal_assert(public.service_pending_drawing_removals(1) = jsonb_build_array(:'pending'::jsonb->0),
  'a smaller limit bounds the same ordered list');
select pg_temp.removal_reject('select public.service_pending_drawing_removals(0)', 'zero limit', '22023');
select pg_temp.removal_reject('select public.service_pending_drawing_removals(51)', 'oversized limit', '22023');
select pg_temp.removal_assert(public.service_confirm_drawing_removal(:'old_id',:'old_path') is false,
  'confirmation is rejected while the exact Storage object remains');
reset role;

update public.launch_settings set environment_mode='live' where singleton;
set local role service_role;
select pg_temp.removal_reject('select public.service_pending_drawing_removals(1)', 'Live cleanup list', '42501');
reset role;
update public.launch_settings set environment_mode='test' where singleton;
alter table public.launch_settings disable trigger guard_sales_activation;
update public.launch_settings set sales_enabled=true where singleton;
alter table public.launch_settings enable trigger guard_sales_activation;
set local role service_role;
select pg_temp.removal_reject('select public.service_pending_drawing_removals(1)', 'open-sales cleanup list', '42501');
reset role;
update public.launch_settings set sales_enabled=false where singleton;

delete from storage.objects where bucket_id='drawing-submissions' and name=:'old_path';
set local role service_role;
select pg_temp.removal_assert(public.service_confirm_drawing_removal(:'replacement_id',:'old_path') is false
  and public.service_confirm_drawing_removal(:'old_id',:'wrong_path') is false,
  'wrong id and wrong path cannot confirm any pending receipt even when the named object is absent');
select pg_temp.removal_assert(public.service_confirm_drawing_removal(:'old_id',:'old_path') is true,
  'exact confirmation succeeds after verified absence');
select pg_temp.removal_assert(public.service_confirm_drawing_removal(:'old_id',:'old_path') is true,
  'the exact completed confirmation remains retryable');
select pg_temp.removal_assert(public.service_pending_drawing_removals(2) =
  jsonb_build_array(jsonb_build_object('id',:'second_id','storagePath',:'second_path')),
  'completed cleanup leaves only the other pending receipt');
select pg_temp.removal_assert(public.remove_drawing_upload(:'student',:'old_id') = :'old_path',
  'cleanup does not erase the replayable removal receipt');
reset role;
select pg_temp.removal_assert((select deleted_at is not null from dm_private.drawing_removal_receipts where upload_id=:'old_id')
  and exists (select 1 from storage.objects where bucket_id='drawing-submissions' and name=:'replacement_path')
  and (select to_jsonb(u) = :'replacement_before'::jsonb from dm_private.drawing_uploads u where id=:'replacement_id'),
  'confirmation marks only the exact receipt and leaves the replacement unchanged');

-- Test the retired path independently of cutoff and Storage validation.
update dm_private.attempts set deadline=now()+interval '15 minutes',upload_deadline=now()+interval '30 minutes' where id=:'attempt';
insert into storage.objects(bucket_id,name,metadata)
values ('drawing-submissions',:'old_path','{"mimetype":"image/png","size":121}');
set local role service_role;
select pg_temp.removal_reject(format('select public.register_drawing_upload(%L,%L,%L,%L,4,%L,121)',
  :'student',:'attempt',:'question',:'old_path','image/png'), 'a retired Storage path can never be registered again');
reset role;

rollback;
\echo 'PASS: drawing removal receipts, cutoff-safe owner retries, immutable replacements and guarded exact Storage cleanup.'
