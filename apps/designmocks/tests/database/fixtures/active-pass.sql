-- Fictional paid annual pass for a fixture student. Teacher drawing marking
-- and unlimited practice need an active pass (pass pricing, 28 Nov 2026).
create function pg_temp.grant_test_pass(student uuid) returns void language sql as $$
  with paid as (
    insert into dm_private.orders(user_id,plan_id,amount,currency,mode,status,paid_at)
      select student,'annual',128400,'INR',s.environment_mode,'paid',now() from public.launch_settings s where s.singleton
      returning id,user_id,mode)
  insert into dm_private.passes(user_id,order_id,mode,starts_at,expires_at)
    select user_id,id,mode,now(),now()+interval '12 months' from paid
$$;
