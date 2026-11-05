-- Management API cannot impersonate supabase_auth_admin. Exercise decisions
-- transactionally as the migration role and separately assert hook-role grants.
begin;
do $$ begin
  if has_function_privilege('anon','public.before_designmocks_user_created(jsonb)','execute')
    or has_function_privilege('authenticated','public.before_designmocks_user_created(jsonb)','execute') then
    raise exception 'Browser roles must not invoke Auth hook';
  end if;
  if not has_function_privilege('supabase_auth_admin','public.before_designmocks_user_created(jsonb)','execute')
    or not has_schema_privilege('supabase_auth_admin','dm_private','usage')
    or not has_table_privilege('supabase_auth_admin','dm_private.registration_policy','select')
    or not has_table_privilege('supabase_auth_admin','dm_private.registration_testers','select') then
    raise exception 'Auth hook grants missing';
  end if;
end $$;
update dm_private.registration_policy set mode='closed';
insert into dm_private.registration_testers(email) values ('tester@example.invalid') on conflict do nothing;
do $$ begin
  if not (public.before_designmocks_user_created('{"user":{"email":"tester@example.invalid","app_metadata":{"provider":"google"}}}') ? 'error') then
    raise exception 'Closed mode admitted tester';
  end if;
end $$;
update dm_private.registration_policy set mode='testers';
do $$ begin
  if public.before_designmocks_user_created('{"user":{"email":" Tester@Example.Invalid ","app_metadata":{"provider":"google"}}}') <> '{}'::jsonb then
    raise exception 'Allowlisted Google tester rejected';
  end if;
  if not (public.before_designmocks_user_created('{"user":{"email":"other@example.invalid","app_metadata":{"provider":"google"}}}') ? 'error') then
    raise exception 'Unknown tester admitted';
  end if;
  if not (public.before_designmocks_user_created('{"user":{"email":"tester@example.invalid","app_metadata":{"provider":"email"},"user_metadata":{"provider":"google"}}}') ? 'error') then
    raise exception 'Email or spoofed provider admitted';
  end if;
  if not (public.before_designmocks_user_created('{"user":{"email":"tester@example.invalid","is_anonymous":true,"app_metadata":{"provider":"google"}}}') ? 'error') then
    raise exception 'Anonymous user admitted';
  end if;
end $$;
update dm_private.registration_policy set mode='open';
do $$ begin
  if public.before_designmocks_user_created('{"user":{"email":"other@example.invalid","app_metadata":{"provider":"google"}}}') <> '{}'::jsonb then
    raise exception 'Open mode Google user rejected';
  end if;
  if not (public.before_designmocks_user_created('{"user":{"app_metadata":{"provider":"google"}}}') ? 'error') then
    raise exception 'Missing email admitted';
  end if;
end $$;
rollback;
