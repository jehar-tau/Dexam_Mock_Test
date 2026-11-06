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
  'public.admin_export_question_draft(uuid,text,boolean,text)',
  'public.export_my_account_data()',
  'public.request_account_deletion()',
  'public.my_privacy_requests()',
  'public.cancel_my_privacy_request(uuid)',
  'public.admin_privacy_requests()',
  'public.admin_resolve_privacy_request(uuid,text,text)',
  'public.my_exam_mock_session(uuid)',
  'public.start_exam_mock_part_b(uuid)',
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
  ,'public.admin_promote_intake_candidate(uuid,jsonb)'
  ,'public.admin_reject_intake_candidate(uuid)'
  ,'public.admin_drawing_review_media_paths(uuid)'
  ,'public.admin_release_drawing_review(uuid)'
  ,'public.admin_set_paper_upload_grace(uuid,integer)'
  ,'public.finalize_my_expired_attempts()'
  ,'public.admin_operational_health()'
  ,'public.community_media_paths(text,uuid)'
 ] loop
  if has_function_privilege('anon',signature,'EXECUTE') then raise exception 'Anonymous execute unexpectedly granted: %',signature; end if;
  if not has_function_privilege('authenticated',signature,'EXECUTE') then raise exception 'Authenticated route grant missing: %',signature; end if;
 end loop;
 if not has_function_privilege('anon','public.public_all_india_top_ten()','EXECUTE') then raise exception 'Intentionally public alias-only ranking endpoint lost its grant'; end if;
 if has_function_privilege('authenticated','public.finalize_expired_attempts(integer)','EXECUTE') then raise exception 'Bulk finalizer must remain service-only'; end if;
 if not has_function_privilege('service_role','public.finalize_expired_attempts(integer)','EXECUTE') then raise exception 'Service bulk finalizer grant missing'; end if;
 if has_function_privilege('authenticated','public.record_drawing_ai_suggestion(uuid,text,text,text,jsonb,text,numeric,numeric,jsonb)','EXECUTE') then raise exception 'Drawing AI writer must remain service-only'; end if;
 if not has_function_privilege('service_role','public.record_drawing_ai_suggestion(uuid,text,text,text,jsonb,text,numeric,numeric,jsonb)','EXECUTE') then raise exception 'Drawing AI service writer grant missing'; end if;
 if has_function_privilege('authenticated','public.save_answer(uuid,uuid,jsonb)','EXECUTE') then raise exception 'Legacy unrevisioned answer writer must remain private'; end if;
 if not has_function_privilege('authenticated','public.save_answer_revision(uuid,uuid,jsonb,bigint)','EXECUTE') then raise exception 'Revisioned autosave grant missing'; end if;
 if has_function_privilege('authenticated','public.prune_attempt_rate_buckets(timestamptz)','EXECUTE') then raise exception 'Rate-bucket retention must remain service-only'; end if;
 if not has_function_privilege('service_role','public.prune_attempt_rate_buckets(timestamptz)','EXECUTE') then raise exception 'Rate-bucket service retention grant missing'; end if;
 if has_function_privilege('authenticated','public.claim_question_intake_asset(uuid)','EXECUTE') then raise exception 'Intake worker claim must remain service-only'; end if;
 if not has_function_privilege('service_role','public.complete_question_intake_asset(uuid,text,text,jsonb)','EXECUTE') then raise exception 'Intake completion service grant missing'; end if;
end $$;
\echo 'PASS: portal RPC anonymous/authenticated execution boundaries.'
