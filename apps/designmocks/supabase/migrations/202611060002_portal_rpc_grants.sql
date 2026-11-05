-- New functions inherit PostgreSQL's PUBLIC execute privilege unless revoked.
-- These portal/admin endpoints are authenticated only, including read helpers.
revoke all on function
 public.is_dmocks_admin(),
 public.submit_bug_report(text,text,text),
 public.my_bug_reports(),
 public.admin_bug_reports(),
 public.admin_reply_bug_report(uuid,text,text),
 public.admin_create_question_draft(text,text,jsonb),
 public.admin_question_drafts(),
 public.admin_review_question_draft(uuid,text,text)
from public,anon;
-- Retain the explicit student/admin route boundary; each admin body also checks
-- the server-owned admin allowlist before reading or writing private records.
grant execute on function
 public.is_dmocks_admin(),
 public.submit_bug_report(text,text,text),
 public.my_bug_reports(),
 public.admin_bug_reports(),
 public.admin_reply_bug_report(uuid,text,text),
 public.admin_create_question_draft(text,text,jsonb),
 public.admin_question_drafts(),
 public.admin_review_question_draft(uuid,text,text)
to authenticated;
