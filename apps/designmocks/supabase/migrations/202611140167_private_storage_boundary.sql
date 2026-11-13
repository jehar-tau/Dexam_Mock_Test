begin;

-- All four buckets are accessed through authorized server operations. A
-- restrictive policy keeps a later permissive policy from exposing their rows.
update storage.buckets
set public = false
where id in ('paper-media', 'drawing-submissions', 'community-media', 'question-intake')
  and public is distinct from false;

do $$
begin
  if (select count(*) from storage.buckets
      where id in ('paper-media', 'drawing-submissions', 'community-media', 'question-intake')
        and public is false) <> 4
    or not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass)
  then
    raise exception 'DMocks requires four private buckets and Storage object row security';
  end if;
end
$$;

create policy dmocks_private_objects_require_server
on storage.objects as restrictive
for all to anon, authenticated
using (bucket_id not in ('paper-media', 'drawing-submissions', 'community-media', 'question-intake'))
with check (bucket_id not in ('paper-media', 'drawing-submissions', 'community-media', 'question-intake'));

commit;
