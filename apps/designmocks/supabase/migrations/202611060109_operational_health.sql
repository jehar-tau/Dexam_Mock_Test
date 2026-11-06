create or replace function public.admin_operational_health()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,dm_private as $$
declare v_stale integer;v_expired integer;v_failed integer;v_attention integer;v_stale_orders integer;
begin
  if auth.role()is distinct from'service_role'and not public.is_dmocks_admin()then raise exception'Admin access required';end if;
  select count(*)filter(where deadline<now()-interval'2 minutes'),count(*)filter(where deadline<=now())into v_stale,v_expired from dm_private.attempts where status='active';
  select(select count(*)from dm_private.question_intake_assets where status='failed')+(select count(*)from dm_private.ai_draft_requests where status='failed')into v_failed;
  select(select count(*)from dm_private.bug_reports where status in('open','investigating'))+
    (select count(*)from dm_private.community_reports where status='open')+
    (select count(*)from dm_private.reported_question_queue where status='pending')+
    (select count(*)from dm_private.drawing_reviews where status<>'released')into v_attention;
  select count(*)into v_stale_orders from dm_private.orders where status='pending'and created_at<now()-interval'15 minutes';
  return jsonb_build_object(
    'status',case when v_stale>0 or v_failed>0 or v_stale_orders>0 then'degraded'when v_attention>0 then'attention'else'healthy'end,
    'checkedAt',now(),
    'staleAttempts',v_stale,
    'expiredAttempts',v_expired,
    'openBugs',(select count(*)from dm_private.bug_reports where status in('open','investigating')),
    'pendingQuestionReports',(select count(*)from dm_private.reported_question_queue where status='pending'),
    'openCommunityReports',(select count(*)from dm_private.community_reports where status='open'),
    'pendingDrawingReviews',(select count(*)from dm_private.drawing_reviews where status<>'released'),
    'failedIntakeAssets',(select count(*)from dm_private.question_intake_assets where status='failed'),
    'failedAiDrafts',(select count(*)from dm_private.ai_draft_requests where status='failed'),
    'stalePendingOrders',v_stale_orders);
end$$;
revoke all on function public.admin_operational_health()from public,anon;
grant execute on function public.admin_operational_health()to authenticated,service_role;
