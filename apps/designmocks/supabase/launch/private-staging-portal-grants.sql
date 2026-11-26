-- Opt-in companion for the reviewed private staging project. Run after the
-- Data API hook is installed and tested, with the encrypted backup available.
begin;

do $$
begin
  perform 1 from public.launch_settings
    where singleton and environment_mode = 'test' and not sales_enabled for share;
  if not found then raise exception 'Private portal requires Test mode and closed sales'; end if;

  perform 1 from dm_private.mvp_test_checkout_control where singleton and not enabled for share;
  if not found then raise exception 'Close the merchant Test window before restoring private portal grants'; end if;

  perform 1 from dm_private.registration_policy where id and mode = 'testers' for share;
  if not found then raise exception 'Private portal requires tester-only registration'; end if;

  if to_regprocedure('dm_staging_api.check_admission()') is null or not exists (
    select from pg_db_role_setting s
    where s.setrole = 'authenticator'::regrole
      and s.setdatabase = (select oid from pg_database where datname = current_database())
      and 'pgrst.db_pre_request=dm_staging_api.check_admission' = any(s.setconfig)
  ) then
    raise exception 'Install and verify the private staging Data API hook first';
  end if;

  if has_function_privilege('anon', 'public.public_all_india_top_ten()', 'execute') then
    raise exception 'Private staging requires anonymous ranking access to be closed';
  end if;
end
$$;

-- Browser and caller-scoped Edge RPCs used by the reviewed private portal.
-- Use exact signatures. In particular, keep legacy unversioned moderation
-- and bank review writes, public ranking publication and service RPCs closed.
grant execute on function
  public.add_community_comment(uuid, uuid, text, uuid),
  public.admin_ai_draft_requests(),
  public.admin_all_india_events(),
  public.admin_claim_drawing_review(uuid),
  public.admin_community_content_page(text, uuid, text, text, text, jsonb, integer),
  public.admin_community_moderation_media_paths(text, uuid, text, text),
  public.admin_community_report(uuid),
  public.admin_community_report_media_paths(uuid, text, text),
  public.admin_community_report_queue(),
  public.admin_configure_exam_mock(text, integer, integer, integer, boolean),
  public.admin_create_ai_draft_request(text, text, text, text, text[]),
  public.admin_create_all_india_event(text, text, timestamp with time zone, integer, integer, integer, integer),
  public.admin_create_question_draft(text, text, jsonb),
  public.admin_drawing_queue(),
  public.admin_drawing_review_media_paths(uuid),
  public.admin_drawing_reviewers(),
  public.admin_exam_mock_blueprints(),
  public.admin_export_question_draft(uuid, text, boolean, text),
  public.admin_learning_lessons(),
  public.admin_moderate_community(text, uuid, text, text, text, uuid),
  public.admin_prepare_bank_answer_correction(text, text, text, text),
  public.admin_promote_intake_asset(uuid, jsonb),
  public.admin_promote_intake_candidate(uuid, jsonb),
  public.admin_question_drafts(),
  public.admin_question_intake_assets(),
  public.admin_question_intake_figure_source(uuid, text),
  public.admin_question_intake_source(uuid),
  public.admin_read_question_export(uuid),
  public.admin_reject_intake_candidate(uuid),
  public.admin_release_all_india_results(uuid),
  public.admin_release_drawing_review(uuid, integer),
  public.admin_resolve_community_report(uuid, text, text, text),
  public.admin_return_drawing_review(uuid, integer),
  public.admin_review_community_content(text, uuid),
  public.admin_review_drawing(uuid, integer, jsonb, text, numeric, text),
  public.admin_review_question_draft(uuid, text, text),
  public.admin_save_learning_draft(uuid, integer, text, text, text, text, text, text, integer),
  public.admin_set_drawing_reviewer(uuid, boolean, text),
  public.admin_set_learning_publication(uuid, integer, boolean, text),
  public.all_india_event_catalog(),
  public.can_review_drawings(),
  public.can_upload_drawing(uuid, uuid, integer),
  public.community_attachment_slots(text, uuid),
  public.community_articles(text, text, jsonb, integer),
  public.community_blocked(),
  public.community_drafts(),
  public.community_feed(text, text, jsonb, integer),
  public.community_folders(),
  public.community_media_paths(text, uuid),
  public.community_reply_context(uuid, uuid, integer),
  public.community_saved(uuid, jsonb, integer),
  public.community_thread(uuid),
  public.community_thread(uuid, jsonb, integer),
  public.complete_learning_lesson(uuid),
  public.create_community_article(text, text, text, text, uuid, uuid),
  public.create_community_post(text, text, text, text, uuid),
  public.delete_community_draft(uuid),
  public.delete_community_folder(uuid),
  public.exam_mock_catalog(),
  public.export_my_community_library(),
  public.learning_catalog(),
  public.learning_progress(),
  public.mark_community_helpful(uuid),
  public.my_drawing_review_page(text, uuid),
  public.my_drawing_uploads(uuid, uuid),
  public.my_exam_mock_report(uuid),
  public.my_exam_mock_session(uuid),
  public.read_learning_lesson(text),
  public.remove_community_block(text),
  public.remove_community_save(uuid, uuid),
  public.report_community_content(uuid, uuid, text, text),
  public.save_community_draft(uuid, text, text, text, text),
  public.save_community_folder(uuid, text),
  public.set_community_block(uuid, uuid),
  public.set_community_like(uuid, boolean),
  public.set_community_saves(uuid, uuid[]),
  public.start_all_india_attempt(uuid),
  public.start_exam_mock(text),
  public.start_exam_mock_part_b(uuid),
  public.start_topic_practice(text, text, integer, integer),
  public.topic_catalog()
to authenticated;

-- The historic staging recovery baseline predates the free sign-up notice.
do $$ begin
  if to_regprocedure('public.free_signup_notice()') is not null then
    grant execute on function public.free_signup_notice() to authenticated;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
