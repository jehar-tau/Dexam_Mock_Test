# DMocks 50k-user architecture

> **8 November MVP freeze:** PRODUCT_EXECUTION_PLAN.md and LAUNCH_CHECKLIST.md override historical full-portal priorities and the old payment deferral. Existing proofs remain evidence for their exact source/environment, not permission to release deferred modules. Payment work is resumed; sales/registration/provider promotion remain closed until accepted. The 150-session exercise and advanced portal work are post-launch.

## Capacity target

The confirmed design target is 50,000 lifetime registered accounts, fewer than 100 concurrent signed-in users, and at most 50 concurrent active attempts during the initial launch. Capacity tests use 150 concurrent sessions to preserve headroom. Revisit the design if measured concurrency approaches 100 or monthly active users approach 40,000; 50,000 simultaneous attempts are explicitly out of scope.

## Environment isolation

| Environment | Frontend | Backend | Payments | Data |
| --- | --- | --- | --- | --- |
| Development | localhost | local disposable PostgreSQL/Supabase tooling | Razorpay test only | synthetic fixtures |
| Staging | separate non-public deployment | existing DMocks Supabase project | Razorpay test | synthetic/review fixtures |
| Production | `https://dmocks.com` | new Supabase Pro project | Razorpay live | reviewed licensed bank |

Never reuse project references, service-role keys, webhook secrets, OAuth clients, Storage buckets, or student records between environments. Production secrets belong only in provider secret stores. The browser receives only the public Supabase URL and anon key.

## Request path

Static frontend traffic is served at the edge. Authentication, PostgreSQL, row-level authorization, private Storage and Edge Functions are isolated in Supabase. Browser callbacks never grant paid access; only a signature-verified, idempotent Razorpay webhook can create an entitlement. Question answers are scored server-side and answer keys remain in the private schema.

## Scale controls

- Database indexes in migration `202611050005_scale_indexes.sql` cover dashboard history, active attempts, paper reads and checkout idempotency.
- Private media URLs are signed in one Storage batch per attempt instead of one network round trip per image.
- CDN caching is allowed only for versioned public assets. Account, payment, attempt and signed-media responses remain `no-store`.
- The database now enforces per-user attempt start 10/hour, accepted answer autosave 120/minute and first submission 10/hour. Stale autosave retries remain idempotent and do not consume the bucket; the unrevisioned answer writer is private. Apply the remaining per-IP edge limits for login 10/minute and checkout 5/10 minutes before those capabilities open.
- Set statement timeouts for authenticated requests, cap request bodies, and keep Edge Function timeouts below the payment provider retry window.
- Use connection pooling for application traffic. Reserve direct database connections for migrations and controlled operations.

## Reliability and recovery

- Daily database backups plus point-in-time recovery for production; run a quarterly restore drill into an isolated project.
- Payment webhook events are immutable and idempotent. Alert on retry growth, signature failures and fulfilment errors.
- Expired attempts finalize from the latest accepted answer revisions when the student next opens the portal. Production should additionally invoke the service-only `finalize_expired_attempts(500)` RPC once per minute until it returns zero; it is bounded and idempotent. Alert when an active attempt remains more than two minutes past its deadline. Do not expose the service credential to the browser.
- The runner keeps only the latest unsent answer per question in memory, retries it automatically after the browser reconnects and never writes answers to browser storage. Students may navigate while offline, but cannot submit early with waiting answers. At the fixed deadline, unsent in-memory intent is discarded and the server finalizes the last accepted revision; elapsed time is never restored.
- Add error tracking with environment and release tags, uptime checks for `/`, auth callback and a synthetic test-mode checkout, and database alerts for CPU, memory, connections, replication lag and storage.
- Define SLOs: 99.9% monthly availability, p95 page load under 2.5s in India, p95 authenticated API under 500ms excluding external payment calls, and zero unverified entitlements.
- Roll out migrations before frontend releases. Keep the previous frontend artifact deployable and use forward-compatible migrations; never roll back by deleting production data.

## Promotion gates

1. Pull request: unit, build, type, database invariant and dependency-audit checks.
2. Staging: migrations, synthetic seed, OAuth, private media, payment-test webhook, accessibility and browser smoke tests.
3. Load test: exercise 90 concurrent virtual sessions, including 45 active attempts, for the initial release. Use synthetic data. Repeat at 150 sessions if traffic approaches the initial concurrency target.
4. Production: manual release approval, reviewed migration plan, backup verification, secrets present and sales still disabled.
5. Enable registration gradually, then sales separately. Monitor for 30 minutes at each cohort size.

### Capacity test procedure

The checked-in `config/capacity-plan.example.json` exercises 90 concurrent sessions, including 45 active attempts. Copy it to ignored `test-results/` and set the approved staging Supabase API origin. Prepare 45 distinct, active, synthetic attempts with unsaved answers and create ignored `capacity-fixtures/fixtures.json` with `accessToken`, `attemptId`, `questionId` and `answer` for each. Start with fresh attempts for each run so autosave revision 1 is new.

Load the staging public API key as `CAPACITY_ANON_KEY` and set `CAPACITY_ALLOW_STAGING_LOAD` to the exact approved staging API origin.

```sh
npm run capacity:run -- --plan test-results/capacity-plan.json --fixtures capacity-fixtures/fixtures.json --execute
```

The run measures complete API responses. It checks that attempt reads return the expected active attempt with sealed keys and that each autosave acknowledges the requested revision. It rejects redirects and reports only aggregate latency/error data and request names/statuses. Verify persisted final revisions, clocks, access isolation and provider metrics before recording staging capacity. Measure frontend/CDN latency separately.

## Required provider work before launch

- Keep the existing DMocks Supabase project as staging. Create one new production project in a Pro organization before launch. Pro is selected for non-pausing production service and daily backups, not because 100 concurrent users require enterprise infrastructure. Size compute from staging load-test evidence rather than the lifetime account count.
- Create distinct Google OAuth clients for staging and production with exact callback URLs.
- Create distinct Razorpay test/live webhooks and secrets. Never route a test event to production.
- Configure `dmocks.com` production redirects and CORS only after the production project exists.
- Make the public deployment accessible only after legal pages, support ownership, incident contacts and deletion/export processes are ready.

## Cost-conscious growth path

Supabase Free currently includes 50,000 monthly active users, 500 MB of database data, 1 GB of file storage, 5 GB egress, 500,000 Edge Function invocations and 200 peak Realtime connections. Those quotas are enough for development and controlled staging, but Free projects can pause after low activity and have no automatic backups. Production therefore begins on Pro rather than waiting for traffic to force an emergency migration.

Start on the default Pro compute size. Upgrade only when monitoring or a repeatable load test shows sustained CPU, memory, connection or latency pressure. The first likely constraints for this product are database growth from attempt snapshots and media egress—not the number of registered Auth rows. Track monthly active users, database bytes per submitted attempt, Storage egress per attempt and Edge Function invocations per checkout.

Capacity review thresholds:

- 40,000 monthly active users: review Auth quota and the following quarter's forecast.
- 350 MB database data in staging or 6 GB in production: review retention and upgrade timing.
- 70 concurrent sessions or p95 authenticated API latency above 500 ms for 15 minutes: run the capacity test and inspect slow queries.
- 70% compute CPU, 70% connection utilization or 75% disk usage: investigate before scaling vertically.
- 70% of monthly egress or Edge Function quota: forecast end-of-cycle consumption and enable only deliberate overage.
