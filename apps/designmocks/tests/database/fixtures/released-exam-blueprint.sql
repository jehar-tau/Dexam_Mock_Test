-- Include released-parallel-questions.sql first. Fill the legacy launch
-- readiness guard via the same objective exam pool as a real release.
create function pg_temp.seed_released_exam_blueprint(p_admin uuid,p_label text)
returns void language plpgsql as $$
declare
  event uuid;
  prior_subject text := coalesce(current_setting('request.jwt.claim.sub',true),'');
begin
  perform pg_temp.seed_released_parallel_questions('nift','{"mcq":100}',p_label);
  perform set_config('request.jwt.claim.sub',p_admin::text,true);
  event:=public.admin_create_all_india_event('nift','Fictional NIFT release fixture',now()+interval '1 hour',100,900);
  update dm_private.all_india_events set starts_at=now()-interval '21 days',ends_at=now()-interval '11 days',
    review_ends_at=now()-interval '1 day' where id=event;
  perform public.admin_release_all_india_results(event);
  perform public.admin_configure_exam_mock('nift',100,7200,1,true);
  perform set_config('request.jwt.claim.sub',prior_subject,true);
end $$;
