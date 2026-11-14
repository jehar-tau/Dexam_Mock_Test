\set ON_ERROR_STOP on
begin;

create function pg_temp.storage_assert(ok boolean, description text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', description; end if;
end $$;

create function pg_temp.assert_private_upload_denied(target_bucket text) returns void
language plpgsql as $$
begin
  insert into storage.objects(bucket_id, name) values (target_bucket, 'forbidden.png');
  raise exception 'Private upload bypassed the restrictive policy';
exception when insufficient_privilege then
  if position('row-level security' in sqlerrm) = 0 then raise; end if;
end $$;

select pg_temp.storage_assert((select count(*) = 4 from storage.buckets
  where id in ('paper-media', 'drawing-submissions', 'community-media', 'question-intake') and public is false),
  'all DMocks Storage buckets are private');
insert into storage.buckets(id,name,public) values ('other-test-bucket','other-test-bucket',false);
insert into storage.objects(bucket_id,name) values
 ('paper-media','fixture.png'), ('drawing-submissions','fixture.png'), ('community-media','fixture.png'),
 ('question-intake','fixture.png'), ('other-test-bucket','fixture.png');

grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
create policy fictional_broad_policy on storage.objects for all to anon, authenticated, service_role using (true) with check (true);
set local role anon;
select pg_temp.storage_assert((select array_agg(bucket_id) = array['other-test-bucket'] from storage.objects),
 'anonymous role cannot read DMocks objects even with another permissive policy');
select pg_temp.assert_private_upload_denied(bucket)
from unnest(array['paper-media', 'drawing-submissions', 'community-media', 'question-intake']) bucket;
reset role;

set local role authenticated;
select pg_temp.storage_assert((select array_agg(bucket_id) = array['other-test-bucket'] from storage.objects),
 'signed-in users cannot read DMocks objects even with another permissive policy');
select pg_temp.assert_private_upload_denied(bucket)
from unnest(array['paper-media', 'drawing-submissions', 'community-media', 'question-intake']) bucket;
with changed as (
  update storage.objects set name = 'forbidden-rename.png'
  where bucket_id <> 'other-test-bucket' returning 1
)
select pg_temp.storage_assert(not exists(select from changed), 'signed-in users cannot rename DMocks objects directly');
with changed as (
  delete from storage.objects where bucket_id <> 'other-test-bucket' returning 1
)
select pg_temp.storage_assert(not exists(select from changed), 'signed-in users cannot delete DMocks objects directly');
reset role;

set local role service_role;
select pg_temp.storage_assert((select count(*) = 5 from storage.objects), 'server role retains authorized Storage access');
with added as (
  insert into storage.objects(bucket_id, name)
  select bucket, 'server-fixture.png'
  from unnest(array['paper-media', 'drawing-submissions', 'community-media', 'question-intake']) bucket
  returning 1
)
select pg_temp.storage_assert((select count(*) = 4 from added), 'server role can upload to every private bucket');
reset role;
rollback;
\echo 'PASS: DMocks private Storage restricts direct access despite broad permissive policies.'
