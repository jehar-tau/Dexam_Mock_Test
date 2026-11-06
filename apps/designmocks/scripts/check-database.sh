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
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/all-india-release.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/all-india-drawings.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/portal-grants.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/bank-import-finalization.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/canonical-media.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/verified-runtime.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/verified-exam-sections.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/verified-nift.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/launch-readiness.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/drawing-review-lifecycle.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/drawing-reviewer-access.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/learning-lesson-editor.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/staging-portal.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/ai-draft-canonical.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f tests/database/media-invariants.sql
psql "$test_db_url" -X -v ON_ERROR_STOP=1 -f supabase/tests/controlled_signup.sql
echo 'PASS: disposable database migrations, access/scoring/payment/media and signup decisions.'
