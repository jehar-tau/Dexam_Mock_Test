-- Read-only catalogue assertions: anonymous role includes inherited PUBLIC grants.
\set ON_ERROR_STOP on
do $$
declare signature text;
begin
 foreach signature in array array[
  'public.is_dmocks_admin()',
  'public.submit_bug_report(text,text,text)',
  'public.my_bug_reports()',
  'public.admin_bug_reports()',
  'public.admin_reply_bug_report(uuid,text,text)',
  'public.admin_create_question_draft(text,text,jsonb)',
  'public.admin_question_drafts()',
  'public.admin_review_question_draft(uuid,text,text)',
  'public.admin_bank_questions(integer,integer)',
  'public.my_candidate_profile()',
  'public.topic_catalog()',
  'public.exam_mock_catalog()',
  'public.admin_exam_mock_blueprints()',
  'public.admin_all_india_events()',
  'public.all_india_event_catalog()',
  'public.learning_catalog()',
  'public.learning_progress()',
  'public.admin_learning_lessons()',
  'public.community_feed(text,text)',
  'public.admin_drawing_queue()',
  'public.my_overview_analytics()'
  ,'public.admin_question_intake_assets()'
  ,'public.admin_promote_intake_asset(uuid,jsonb)'
  ,'public.admin_drawing_review_media_paths(uuid)'
  ,'public.admin_release_drawing_review(uuid)'
  ,'public.admin_set_paper_upload_grace(uuid,integer)'
  ,'public.finalize_my_expired_attempts()'
  ,'public.admin_operational_health()'
 ] loop
  if has_function_privilege('anon',signature,'EXECUTE') then raise exception 'Anonymous execute unexpectedly granted: %',signature; end if;
  if not has_function_privilege('authenticated',signature,'EXECUTE') then raise exception 'Authenticated route grant missing: %',signature; end if;
 end loop;
 if not has_function_privilege('anon','public.public_all_india_top_ten()','EXECUTE') then raise exception 'Intentionally public alias-only ranking endpoint lost its grant'; end if;
 if has_function_privilege('authenticated','public.finalize_expired_attempts(integer)','EXECUTE') then raise exception 'Bulk finalizer must remain service-only'; end if;
 if not has_function_privilege('service_role','public.finalize_expired_attempts(integer)','EXECUTE') then raise exception 'Service bulk finalizer grant missing'; end if;
end $$;
\echo 'PASS: portal RPC anonymous/authenticated execution boundaries.'
