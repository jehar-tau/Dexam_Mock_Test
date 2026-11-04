begin;
create table public.designmocks_rls_probe(id integer);
do $$begin
 if not (select relrowsecurity from pg_class where oid='public.designmocks_rls_probe'::regclass) then raise exception 'Automatic RLS failed'; end if;
 if has_function_privilege('anon','public.rls_auto_enable()','execute') or has_function_privilege('authenticated','public.rls_auto_enable()','execute') then raise exception 'RLS helper is browser-executable'; end if;
end $$;
rollback;
select true as automatic_rls_preserved_and_helper_private;
