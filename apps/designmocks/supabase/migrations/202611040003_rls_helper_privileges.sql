begin;
-- Supabase's automatic-RLS helper is an event trigger, not a student RPC.
-- Keep its trigger operation while removing browser-role execution.
do $$begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public,anon,authenticated;
  end if;
end $$;
commit;
