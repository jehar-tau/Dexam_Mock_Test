\set ON_ERROR_STOP on
\set editor '00000000-0000-4000-8000-000000004501'
\set student '00000000-0000-4000-8000-000000004502'
\set name 'Fictional café worksheet.pdf'
begin;

create function pg_temp.intake_receipt_assert(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;

create function pg_temp.intake_receipt_reject(statement text, label text, expected_state text default null)
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

select pg_temp.intake_receipt_assert(
  to_regprocedure('public.register_question_intake_source(uuid,text,text,integer,text)') is not null,
  'the service-only deterministic source registration RPC exists');

insert into auth.users(id) values (:'editor'), (:'student');
insert into dm_private.admins(user_id) values (:'editor');

select encode(sha256(convert_to('fictional source bytes one', 'UTF8')), 'hex') as first_sha,
  encode(sha256(convert_to('fictional source bytes two', 'UTF8')), 'hex') as second_sha,
  encode(sha256(convert_to(:'name', 'UTF8')), 'hex') as name_sha \gset
select 'intake/' || :'editor' || '/sources/' || :'name_sha' || '-' || :'first_sha' || '.pdf' as first_path,
  'intake/' || :'editor' || '/sources/' || :'name_sha' || '-' || :'second_sha' || '.pdf' as second_path,
  'intake/' || :'student' || '/sources/' || :'name_sha' || '-' || :'first_sha' || '.pdf' as student_path \gset
select format('select public.register_question_intake_source(%L,%L,%L,1234,%L)',
  :'editor', :'name', 'application/pdf', :'first_sha') as register_first,
  format('select public.register_question_intake_source(%L,%L,%L,1234,%L)',
  :'editor', :'name', 'application/pdf', :'second_sha') as register_second \gset

set local role anon;
select pg_temp.intake_receipt_reject(:'register_first', 'anonymous source registration', '42501');
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', :'editor', true);
select pg_temp.intake_receipt_reject(:'register_first', 'authenticated administrator cannot bypass the service-only RPC', '42501');
reset role;

insert into storage.objects(bucket_id,name,metadata)
values ('question-intake', :'student_path', '{"mimetype":"application/pdf","size":1234}');
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select pg_temp.intake_receipt_reject(
  format('select public.register_question_intake_source(%L,%L,%L,1234,%L)', :'student', :'name', 'application/pdf', :'first_sha'),
  'a service call still requires a current administrator', '42501');
select pg_temp.intake_receipt_reject(:'register_first', 'missing deterministic Storage object');
reset role;

insert into storage.objects(bucket_id,name,metadata)
values ('question-intake', :'first_path', '{"mimetype":"image/png","size":1234}');
set local role service_role;
select pg_temp.intake_receipt_reject(:'register_first', 'Storage MIME type mismatch');
reset role;
update storage.objects set metadata = '{"mimetype":"application/pdf","size":1235}'
where bucket_id = 'question-intake' and name = :'first_path';
set local role service_role;
select pg_temp.intake_receipt_reject(:'register_first', 'Storage size mismatch');
reset role;
select pg_temp.intake_receipt_assert(
  not exists (select 1 from dm_private.question_intake_assets where uploaded_by in (:'editor', :'student')),
  'invalid source registrations never create an intake row');

update storage.objects set metadata = '{"mimetype":"application/pdf","size":1234}'
where bucket_id = 'question-intake' and name = :'first_path';
set local role service_role;
select public.register_question_intake_source(
  p_uploaded_by => :'editor', p_original_name => :'name', p_mime_type => 'application/pdf',
  p_byte_size => 1234, p_source_sha256 => :'first_sha') as receipt \gset
select :'receipt'::jsonb->>'id' as first_id \gset
select pg_temp.intake_receipt_assert(:'receipt'::jsonb = jsonb_build_object(
  'id', :'first_id', 'name', :'name', 'status', 'uploaded', 'sourceSha256', :'first_sha', 'reused', false),
  'a new receipt returns the exact bounded DTO');
select pg_temp.intake_receipt_assert(
  public.register_question_intake_source(:'editor', :'name', 'application/pdf', 1234, :'first_sha') =
    (:'receipt'::jsonb || '{"reused":true}'),
  'an exact retry returns the same receipt id');
select pg_temp.intake_receipt_reject(:'register_second', 'same name and different digest requires its own Storage object');
reset role;

select pg_temp.intake_receipt_assert((select storage_path = :'first_path' and source_sha256 = :'first_sha'
  from dm_private.question_intake_assets where id = :'first_id'), 'the stored path binds the actor, UTF-8 name, digest and extension');
insert into storage.objects(bucket_id,name,metadata)
values ('question-intake', :'second_path', '{"mimetype":"application/pdf","size":1234}');
set local role service_role;
select public.register_question_intake_source(:'editor', :'name', 'application/pdf', 1234, :'second_sha') as second_receipt \gset
select pg_temp.intake_receipt_assert(
  :'second_receipt'::jsonb->>'id' <> :'first_id'
  and :'second_receipt'::jsonb @> jsonb_build_object('sourceSha256', :'second_sha', 'reused', false),
  'same name with different bytes creates a distinct registered source');

select public.claim_question_intake_asset(:'first_id', :'editor') as claim \gset
select pg_temp.intake_receipt_assert(
  :'claim'::jsonb @> jsonb_build_object('id', :'first_id', 'storagePath', :'first_path', 'sourceSha256', :'first_sha')
  and :'claim'::jsonb->>'token' is not null,
  'modern extraction claim includes the digest and retains the existing token');
reset role;
select to_jsonb(a) as claimed_row from dm_private.question_intake_assets a where id = :'first_id' \gset
set local role service_role;
select pg_temp.intake_receipt_assert(
  public.register_question_intake_source(:'editor', :'name', 'application/pdf', 1234, :'first_sha') =
    (:'receipt'::jsonb || '{"status":"extracting","reused":true}'),
  'registration replay reports the current status without resetting extraction');
reset role;
select pg_temp.intake_receipt_assert(
  (select to_jsonb(a) = :'claimed_row'::jsonb from dm_private.question_intake_assets a where id = :'first_id'),
  'registration replay preserves all existing row fields and extraction state');

-- Each allowed image MIME type maps to the designated canonical suffix.
with images(mime,suffix) as (values ('image/png','png'), ('image/jpeg','jpg'), ('image/webp','webp'))
insert into storage.objects(bucket_id,name,metadata)
select 'question-intake',
  'intake/' || :'editor' || '/sources/' ||
    encode(sha256(convert_to('Fictional image.' || suffix, 'UTF8')), 'hex') || '-' || :'first_sha' || '.' || suffix,
  jsonb_build_object('mimetype',mime,'size',1234)
from images;
set local role service_role;
select pg_temp.intake_receipt_assert(
  public.register_question_intake_source(:'editor', 'Fictional image.' || suffix, mime, 1234, :'first_sha')
    @> jsonb_build_object('sourceSha256', :'first_sha', 'reused', false),
  'a registered source resolves the canonical .' || suffix || ' object')
from (values ('image/png','png'), ('image/jpeg','jpg'), ('image/webp','webp')) images(mime,suffix);
select public.register_question_intake_asset(
  'intake/legacy/source.pdf', 'Fictional legacy source.pdf', 'application/pdf', 1234, :'editor') as legacy_id \gset
select pg_temp.intake_receipt_assert(
  not (public.claim_question_intake_asset(:'legacy_id', :'editor') ? 'sourceSha256'),
  'a legacy extraction claim keeps its previous shape');
reset role;
select pg_temp.intake_receipt_assert(
  (select source_sha256 is null from dm_private.question_intake_assets where id = :'legacy_id'),
  'legacy registration does not invent a source digest');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', :'editor', true);
select pg_temp.intake_receipt_assert(
  public.admin_question_intake_source(:'first_id') @>
    jsonb_build_object('storagePath', :'first_path', 'sourceSha256', :'first_sha'),
  'modern source download resolves the registered path and digest');
select public.admin_question_intake_source(:'legacy_id') as legacy_download \gset
select pg_temp.intake_receipt_assert(
  :'legacy_download'::jsonb->>'storagePath' = 'intake/legacy/source.pdf'
  and not (:'legacy_download'::jsonb ? 'sourceSha256'),
  'legacy source download remains readable without a source digest');
reset role;

rollback;
\echo 'PASS: deterministic private intake receipts, Storage metadata, current staff, exact replay and legacy compatibility.'
