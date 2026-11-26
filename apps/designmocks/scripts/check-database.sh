#!/usr/bin/env bash
set -euo pipefail

# This bootstrap is exclusively for an empty, disposable local PostgreSQL 17.
test_db_url="${DESIGNMOCKS_TEST_DATABASE_URL:?Set DESIGNMOCKS_TEST_DATABASE_URL to an empty disposable localhost PostgreSQL database}"
node --input-type=module -e '
  const u = new URL(process.env.DESIGNMOCKS_TEST_DATABASE_URL);
  if (!["postgres:","postgresql:"].includes(u.protocol) || !["localhost","127.0.0.1","[::1]"].includes(u.hostname)) {
    throw new Error("Database bootstrap permits localhost only; never a hosted/student database");
  }
'
existing_tables="$(psql "$test_db_url" -X -A -t -v ON_ERROR_STOP=1 -c "select count(*) from pg_tables where schemaname not in ('pg_catalog','information_schema')")"
if [[ "$existing_tables" != "0" ]]; then
  echo 'Refusing to bootstrap a non-empty database.' >&2
  exit 1
fi
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/bootstrap.sql
for migration in supabase/migrations/*.sql; do
  psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f "$migration"
done
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/invariants.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/fresh-all-india-lineage.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/all-india-release.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/all-india-drawings.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/all-india-ranking-consent.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/portal-grants.sql
rpc_inventory="$(mktemp -d)"
trap 'unlink "$rpc_inventory/source.json"; if [[ -f "$rpc_inventory/paid.json" ]]; then unlink "$rpc_inventory/paid.json"; fi; rmdir "$rpc_inventory"' EXIT
psql "$test_db_url" -X -qAt -v ON_ERROR_STOP=1 -f supabase/audit/staging-rpc-inventory.sql > "$rpc_inventory/source.json"
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/bank-import-finalization.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/canonical-media.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/verified-runtime.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/verified-answer-alternatives.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/verified-full-marks-runtime.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/nid-historical-year-runtime.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/verified-exam-sections.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/verified-nift.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/launch-readiness.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/drawing-review-lifecycle.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/drawing-image-registration.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/drawing-inspection.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/drawing-removal-receipts.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/community-image-validation.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/community-threaded-replay.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/community-report-review.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/community-reporting.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/community-feed.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/community-followup-images.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/community-moderation-workspace.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/community-articles.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/bug-report-lifecycle.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/support-queue-replies.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/profile-lifecycle.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/candidate-phone-challenges.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/account-privacy-lifecycle.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/privacy-request-review.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/learn-lifecycle.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/attempt-identity-lifecycle.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/payment-event-bindings.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/payment-refunds.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/purchase-history.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/purchase-support-reports.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/drawing-reviewer-access.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/frozen-drawing-rubric.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/local-drawing-advice-jobs.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/learning-lesson-editor.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/staging-portal.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/staging-api-admission.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/ai-draft-canonical.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/intake-canonical.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/intake-source-receipts.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/question-export-packet.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/question-job-recovery.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/bank-review-browser.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/question-quality-holds.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/private-account-export.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/released-overview-scores.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/unseen-topic-practice.sql
node tests/database/generated-attempt-limit.mjs
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/media-invariants.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/private-storage-boundary.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f supabase/tests/controlled_signup.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/mvp-release-profile.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/mvp-test-checkout.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/order-recovery.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/mvp-service-operations.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/nid-practice-blueprints.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/nid-question-bindings.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f supabase/launch/paid-mvp.sql
psql "$test_db_url" -X -qAt -v ON_ERROR_STOP=1 -f supabase/audit/staging-rpc-inventory.sql > "$rpc_inventory/paid.json"
node tests/database/staging-rpc-comparison.mjs "$rpc_inventory/source.json" "$rpc_inventory/paid.json"
node tests/database/staging-portal-grants.mjs
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/mvp-paper-preparation.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/free-year-papers.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/year-paper-preparation.sql
node tests/database/nid-write-revocation.mjs
node tests/database/staff-write-concurrency.mjs
node tests/database/bank-target-reconciliation.mjs
node tests/database/question-model-authorization-concurrency.mjs
node tests/database/recovery-roundtrip.mjs
node tests/database/recovery-roundtrip.mjs --pre-upgrade
node tests/database/recovery-roundtrip.mjs --current-staging
echo 'PASS: disposable database migrations, access/scoring/payment/media and signup decisions.'
