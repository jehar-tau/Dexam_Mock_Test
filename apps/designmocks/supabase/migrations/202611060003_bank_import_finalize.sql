-- Supabase safe-update protection requires a WHERE clause.
-- Preserve unchanged canonical rows and their audit/review state.
-- CREATE OR REPLACE retains the service-role-only execution grant.
create or replace function public.finish_question_bank_import(p_run_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,dm_private as $$
declare v_run dm_private.bank_import_runs;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_run from dm_private.bank_import_runs where id=p_run_id for update;
  if v_run.id is null then raise exception 'Import run unavailable'; end if;
  if v_run.status='completed' then return; end if;
  if v_run.imported_count <> v_run.eligible_total then raise exception 'Import count mismatch'; end if;
  update dm_private.bank_questions q
  set active=exists(select 1 from dm_private.bank_import_run_items i where i.run_id=p_run_id and i.external_key=q.external_key)
  where q.active is distinct from exists(select 1 from dm_private.bank_import_run_items i where i.run_id=p_run_id and i.external_key=q.external_key);
  update dm_private.bank_import_runs set status='completed',completed_at=coalesce(completed_at,now()) where id=p_run_id;
end $$;
