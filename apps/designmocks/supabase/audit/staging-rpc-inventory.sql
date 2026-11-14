-- Run against a disposable database with only the source migrations, then
-- against the designated staging database. This query reads the catalogue.
with application_functions as (
  select format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)) as signature,
    encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex') as definition_sha256,
    has_function_privilege('anon', p.oid, 'execute') as anon,
    has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
    has_function_privilege('service_role', p.oid, 'execute') as service,
    has_function_privilege('supabase_auth_admin', p.oid, 'execute') as auth_hook
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and not exists (
      select from pg_depend d
      where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
    )
)
select jsonb_build_object(
  'version', 2,
  'functions', coalesce(jsonb_agg(to_jsonb(f) order by f.signature collate "C"), '[]')
) as rpc_inventory
from application_functions f;
