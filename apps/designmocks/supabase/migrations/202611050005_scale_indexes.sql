-- Query paths required for a 50k-account launch. Apply independently to staging
-- and production; never point both environments at the same Supabase project.
begin;

create index if not exists orders_user_pending_idx
  on dm_private.orders (user_id, mode, created_at desc)
  where status = 'pending';
create index if not exists orders_provider_order_idx
  on dm_private.orders (provider_order_id)
  where provider_order_id is not null;
create index if not exists passes_active_idx
  on dm_private.passes (user_id, mode, expires_at desc);
create index if not exists attempts_user_history_idx
  on dm_private.attempts (user_id, started_at desc);
create index if not exists attempts_active_deadline_idx
  on dm_private.attempts (deadline)
  where status = 'active';
create index if not exists questions_paper_ordinal_idx
  on dm_private.questions (paper_id, ordinal);
create index if not exists attempt_items_attempt_ordinal_idx
  on dm_private.attempt_items (attempt_id, ordinal);

commit;
