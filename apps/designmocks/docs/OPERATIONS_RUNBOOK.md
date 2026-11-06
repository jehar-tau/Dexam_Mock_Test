# DMocks operations runbook

This runbook applies separately to staging and production. Never paste service keys, student answers, drawing images, phone numbers or payment payloads into tickets or chat. Public registration and sales remain closed until the launch checklist and owner approvals are complete.

## Health and alerting

Poll the service-only `admin_operational_health()` RPC every minute and record only its aggregate response. The same aggregate appears in the authenticated admin portal. Alert thresholds:

| Severity | Trigger | First response |
| --- | --- | --- |
| P1 | unverified entitlement, cross-account access, public private-media URL, database unavailable | close registration and sales; preserve logs; page owner and operator |
| P2 | stale attempts > 0 for two checks, failed intake/AI jobs > 0, webhook verification failures, API p95 > 500 ms for 15 minutes | stop the affected worker/release; run the bounded recovery step; investigate |
| P3 | support/moderation/review queues above the staffing threshold | assign the queue; do not change student results automatically |

Run `finalize_expired_attempts(500)` with the service identity once per minute until it returns zero. A browser or authenticated student must never receive the service credential. A nonzero stale-attempt count after two sweeps is P2.

Run `prune_attempt_rate_buckets()` with the service identity once daily. It retains the current two days by default and refuses a boundary newer than one hour. Rate-limit rows contain only user IDs, action names, fixed window timestamps and counts—never answers. A sudden rise in rejected autosaves should be investigated as a client retry loop; do not raise the limit without capacity evidence.

## Incident sequence

1. Record environment, release SHA, UTC start time, aggregate health counters and affected route/provider. Do not record sensitive request bodies.
2. Contain the affected capability. Registration, paper publication and sales have separate switches; do not disable unrelated read-only study access unless required.
3. Preserve database/Edge logs and provider event IDs. Do not delete or edit immutable payment, drawing-review or moderation audit rows.
4. Recover with an idempotent operation: expired-attempt sweep, provider webhook retry, or redeploy of the last known frontend artifact. Never repair scores or entitlements directly in a table.
5. Verify with a synthetic account in the affected environment, then monitor for 30 minutes.
6. Document cause, affected records, recovery evidence and a prevention action. Notify affected users only with owner-approved wording.

## Backup and restore

- Production requires Supabase Pro daily backups and point-in-time recovery. Confirm the latest backup before every production migration.
- Quarterly, restore into a new isolated project with no OAuth, email, payment or public DNS connections. Verify migration ledger, row counts, RLS, private buckets, attempt reads, scoring and aggregate health.
- Destroy the isolated restore after evidence is retained. Never restore production data into development or staging.
- Frontend rollback uses the previous immutable deployment artifact. Database migrations remain forward-compatible; do not roll back by dropping columns or deleting student data.

## Payment reconciliation

Payments stay closed until the owner resumes Razorpay work. When enabled, reconcile captured provider payments to exactly one paid order and one entitlement. A browser callback is never evidence of payment. Investigate stale pending orders without granting access; refund/revocation actions require the approved commercial policy and an auditable operator action.

## Scheduled attempt and retention sweep

Run `npm run operations:sweep` from a private scheduler every minute with `DMOCKS_SUPABASE_URL`, `DMOCKS_SUPABASE_SERVICE_ROLE_KEY`, `DMOCKS_OPERATIONS_ALLOW_ORIGIN` (the exact Supabase origin) and `DMOCKS_OPERATIONS_ENVIRONMENT=staging|production`. The service credential must remain in the scheduler secret store. Production additionally requires `DMOCKS_OPERATIONS_PRODUCTION_ACK=FINALIZE_EXPIRED_ATTEMPTS_ON_<exact origin>`; the runner refuses a production host in staging mode.

Each invocation drains at most ten batches of 500 expired attempts, prunes only rate buckets older than two days, then prints one privacy-safe JSON health record. Exit `0` means healthy/attention, `2` means degraded and must alert the operator, and `1` means configuration or RPC failure. Never retry an exit-1 loop without inspecting the named failed RPC; the underlying database operations are bounded and idempotent, but a bad credential or target should not be hammered. Deployment of this schedule is a production-state decision and remains separate from source readiness.

## Support and moderation

- Bug replies, question retirement, community moderation and drawing-score overrides are performed only through their audited admin workflows.
- Report counts prioritize human review; they never auto-delete a question or change a result.
- Drawing feedback is private until explicit release. Any later score change requires a reason and a new release.
- Export/deletion, minors, retention, refund and public incident-notice requests require the approved policy before action.

## Release checklist

Before promotion: green GitHub CI, disposable PostgreSQL 17 suites, staging migrations, synthetic desktop/mobile journey, private-media denial checks, backup evidence and aggregate health with no degraded counters. Keep registration and sales disabled during deployment. Enable them only by separate owner-approved production decisions.
