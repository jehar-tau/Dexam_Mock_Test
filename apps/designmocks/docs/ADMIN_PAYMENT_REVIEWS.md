# Read-only payment reviews

The administrator desk has a separate Payment reviews section. Refresh explicitly loads at most ten flagged orders from the current Test/Live environment. Next uses the last order's creation time and internal reference. Refresh returns to the first page. A row can disappear after verified payment processing; pagination still accepts its exact current-mode cursor.

The queue includes recorded purchase/refund totals, status and the pass state belonging to that exact order. It does not attach a customer's replacement pass to an older order. It requires no support report. No provider identifiers, customer contact data, raw event payloads or credentials are returned. There are no refund, grant or review-clearing actions. Use REFUND_RECONCILIATION.md for the policy-dependent operator process.

Migration `202611230172_admin_payment_review.sql` adds the read-only RPC and partial index. The companion paid-MVP profile grants it only to authenticated callers; the function independently requires current administrator membership. Anonymous callers, students and revoked administrators cannot inspect the queue. The browser uses the existing verified staff boundary and rechecks authorization before presenting results.

Local validation: 883 JavaScript tests, build and preview isolation, explicit RPC manifest check, and six desktop/mobile browser journeys passed without retries. The browser checks keyboard activation, 320px reflow, both-theme WCAG checks, pagination, malformed response recovery and revocation clearing. The new SQL suite passed against PostgreSQL 17 both before and after the paid-MVP profile, covering authorization, current-mode isolation, matching-pass isolation, bounded pagination and unchanged orders.

The full database runner passed all migrations, SQL/profile suites and database concurrency checks, then stopped at `recovery-roundtrip.mjs`. That helper explicitly requires an owned Docker `postgres:17` service; Docker was unavailable locally. This is not a completed full database-runner result. Exact-head CI remains required. No hosted configuration, provider request, account admission, checkout or sales switch changed.
