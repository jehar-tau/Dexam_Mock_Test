-- Read-only catalogue assertions: anonymous role includes inherited PUBLIC grants.
\set ON_ERROR_STOP on
do $$
declare signature text;
begin
 foreach signature in array array[
  'public.is_dmocks_admin()',
  'public.submit_bug_report(text,text,text)',
  'public.my_bug_reports()',
  'public.admin_bug_report_page(jsonb,integer)',
  'public.admin_reply_bug_report(uuid,integer,text,text,uuid)',
  'public.admin_create_question_draft(text,text,jsonb)',
  'public.admin_question_drafts()',
  'public.admin_review_question_draft(uuid,text,text)',
  'public.admin_export_question_draft(uuid,text,boolean,text)',
 'public.admin_create_ai_draft_request(text,text,text,text,text[])',
 'public.admin_ai_draft_basis(uuid)',
  'public.export_my_account_data()',
  'public.request_account_deletion()',
  'public.my_privacy_requests()',
  'public.cancel_my_privacy_request(uuid)',
  'public.admin_privacy_request_page(jsonb,integer)',
  'public.admin_resolve_privacy_request(uuid,integer,text,text)',
  'public.my_exam_mock_session(uuid)',
  'public.start_exam_mock_part_b(uuid)',
  'public.my_exam_mock_report(uuid)',
  'public.admin_bank_questions(integer,integer)',
  'public.admin_search_bank_questions(text,text,text,text,text,integer,integer)',
  'public.admin_bank_question(text,text)',
  'public.admin_bank_review_media_paths(text,text)',
  'public.admin_reported_question(text,bigint)',
  'public.admin_reported_question_media_paths(text,bigint)',
  'public.admin_resolve_reported_question(text,text,text,bigint,text)',
  'public.admin_review_bank_question(text,boolean,boolean,text,text)',
  'public.my_candidate_profile()',
  'public.can_enter_staging_portal()',
  'public.topic_catalog()',
  'public.exam_mock_catalog()',
  'public.admin_exam_mock_blueprints()',
  'public.admin_all_india_events()',
  'public.admin_create_all_india_event(text,text,timestamptz,integer,integer,integer,integer)',
  'public.admin_release_all_india_results(uuid)',
  'public.all_india_event_catalog()',
  'public.admin_open_all_india_ranking_publication(uuid,text,text)',
  'public.admin_close_all_india_ranking_publication(uuid,uuid,text)',
  'public.set_all_india_result_sharing(uuid,uuid,integer,boolean)',
  'public.learning_catalog()',
  'public.learning_progress()',
  'public.admin_learning_lessons()',
  'public.read_learning_lesson(text)',
  'public.complete_learning_lesson(uuid)',
  'public.admin_save_learning_draft(uuid,integer,text,text,text,text,text,text,integer)',
  'public.admin_set_learning_publication(uuid,integer,boolean,text)',
  'public.community_feed(text,text)',
  'public.admin_drawing_queue()',
  'public.my_overview_analytics()'
  ,'public.admin_question_intake_assets()'
  ,'public.admin_promote_intake_asset(uuid,jsonb)'
  ,'public.admin_question_intake_source(uuid)'
  ,'public.admin_question_intake_figure_source(uuid,text)'
  ,'public.admin_promote_intake_candidate(uuid,jsonb)'
  ,'public.admin_reject_intake_candidate(uuid)'
  ,'public.admin_drawing_review_media_paths(uuid)'
  ,'public.admin_claim_drawing_review(uuid)'
  ,'public.admin_return_drawing_review(uuid,integer)'
  ,'public.admin_review_drawing(uuid,integer,jsonb,text,numeric,text)'
  ,'public.admin_release_drawing_review(uuid,integer)'
  ,'public.can_review_drawings()'
  ,'public.my_drawing_review_page(text,uuid)'
  ,'public.admin_drawing_reviewers()'
  ,'public.admin_set_drawing_reviewer(uuid,boolean,text)'
  ,'public.can_upload_drawing(uuid,uuid,integer)'
  ,'public.admin_set_paper_upload_grace(uuid,integer)'
  ,'public.finalize_my_expired_attempts()'
  ,'public.admin_operational_health()'
  ,'public.admin_launch_readiness()'
  ,'public.admin_set_launch_gate(text,boolean,text)'
  ,'public.community_media_paths(text,uuid)'
 ] loop
  if has_function_privilege('anon',signature,'EXECUTE') then raise exception 'Anonymous execute unexpectedly granted: %',signature; end if;
  if not has_function_privilege('authenticated',signature,'EXECUTE') then raise exception 'Authenticated route grant missing: %',signature; end if;
 end loop;
 if not has_function_privilege('anon','public.public_all_india_top_ten()','EXECUTE') then raise exception 'Intentionally public alias-only ranking endpoint lost its grant'; end if;
 if has_function_privilege('anon','public.complete_ai_draft_request(uuid,text,text,jsonb)','EXECUTE')
   or has_function_privilege('authenticated','public.complete_ai_draft_request(uuid,text,text,jsonb)','EXECUTE')
   or not has_function_privilege('service_role','public.complete_ai_draft_request(uuid,text,text,jsonb)','EXECUTE') then
  raise exception 'AI draft completion must remain service-only';
 end if;
 if has_table_privilege('authenticated','dm_private.learning_publication_audit','SELECT,INSERT,UPDATE,DELETE') then
  raise exception 'Learning publication evidence must remain private';
 end if;
 if has_table_privilege('authenticated','dm_private.drawing_reviewers','SELECT,INSERT,UPDATE,DELETE')
   or has_table_privilege('authenticated','dm_private.drawing_reviewer_audit','SELECT,INSERT,UPDATE,DELETE')
   or has_function_privilege('authenticated','dm_private.drawing_review_cards(text,uuid,integer,boolean)','EXECUTE')
   or has_function_privilege('authenticated','dm_private.lock_drawing_reviewer()','EXECUTE') then
  raise exception 'Reviewer roster, audit and queue helpers must remain private';
 end if;
 if has_function_privilege('authenticated','public.finalize_expired_attempts(integer)','EXECUTE') then raise exception 'Bulk finalizer must remain service-only'; end if;
 if not has_function_privilege('service_role','public.finalize_expired_attempts(integer)','EXECUTE') then raise exception 'Service bulk finalizer grant missing'; end if;
 if has_function_privilege('authenticated','public.record_drawing_ai_suggestion(uuid,text,text,text,jsonb,text,numeric,numeric,jsonb)','EXECUTE') then raise exception 'Drawing AI writer must remain service-only'; end if;
 if not has_function_privilege('service_role','public.record_drawing_ai_suggestion(uuid,text,text,text,jsonb,text,numeric,numeric,jsonb)','EXECUTE') then raise exception 'Drawing AI service writer grant missing'; end if;
 foreach signature in array array[
   'public.register_drawing_upload(uuid,uuid,uuid,text,integer,text,integer)',
   'public.remove_drawing_upload(uuid,uuid)'
 ] loop
  if has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE')
    or not has_function_privilege('service_role',signature,'EXECUTE') then
    raise exception 'Drawing media writer must remain service-only: %',signature;
  end if;
 end loop;
 if has_function_privilege('authenticated','public.upsert_nift_question_bank_runtime_batch(jsonb)','EXECUTE') then raise exception 'NIFT runtime writer must remain service-only'; end if;
 if not has_function_privilege('service_role','public.upsert_nift_question_bank_runtime_batch(jsonb)','EXECUTE') then raise exception 'NIFT runtime service writer grant missing'; end if;
 if has_function_privilege('authenticated','public.save_answer(uuid,uuid,jsonb)','EXECUTE') then raise exception 'Legacy unrevisioned answer writer must remain private'; end if;
 if not has_function_privilege('authenticated','public.save_answer_revision(uuid,uuid,jsonb,bigint)','EXECUTE') then raise exception 'Revisioned autosave grant missing'; end if;
 if has_function_privilege('authenticated','public.prune_attempt_rate_buckets(timestamptz)','EXECUTE') then raise exception 'Rate-bucket retention must remain service-only'; end if;
 if not has_function_privilege('service_role','public.prune_attempt_rate_buckets(timestamptz)','EXECUTE') then raise exception 'Rate-bucket service retention grant missing'; end if;
 if has_function_privilege('authenticated','public.claim_question_intake_asset(uuid)','EXECUTE') then raise exception 'Intake worker claim must remain service-only'; end if;
 if not has_function_privilege('service_role','public.complete_question_intake_asset(uuid,text,text,jsonb)','EXECUTE') then raise exception 'Intake completion service grant missing'; end if;
end $$;
\echo 'PASS: portal RPC anonymous/authenticated execution boundaries.'
