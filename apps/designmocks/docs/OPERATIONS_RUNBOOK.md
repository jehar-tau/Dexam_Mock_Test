# DMocks operations runbook

This runbook applies separately to staging and production. Never paste service keys, student answers, drawing images, phone numbers or payment payloads into tickets or chat. Public registration and sales remain closed until the launch checklist and owner approvals are complete.

## Frozen objective MVP profile

Apply the reviewed companion profile last, as described in MVP_DEPLOYMENT.md. Its health view reports stale/expired attempts, stale pending orders, payment reviews, open bugs and question reports. Deferred AI/intake/drawing counters and the large 150-session exercise are not initial launch gates. A nonzero payment-review count requires operator reconciliation under REFUND_RECONCILIATION.md; never automatically repeat the charge or invent a partial-refund proration. An incident closes the audited merchant Test window explicitly in addition to closing sales/admission as applicable.

## Health and alerting

Read `admin_operational_health()` with a service identity or verified administrator. The MVP health view reports the current queues, permission profile and active passes without a matching captured-payment receipt. Payment order and pass counts use the server's current Test or Live mode. The authenticated admin portal shows the mode beside its aggregate counts.

| Severity | Trigger | First response |
| --- | --- | --- |
| P1 | unverified entitlement, cross-account access, public private-media URL, database unavailable | close registration and sales; preserve logs; page owner and operator |
| P2 | stale attempts > 0 for two checks, payment reviews/stale orders, webhook verification failures, API p95 > 500 ms for 15 minutes | stop the affected worker/release; run the bounded recovery step; investigate |
| P3 | support/moderation/review queues above the staffing threshold | assign the queue; do not change student results automatically |

Apply the matching paid companion profile before running `npm run operations:monitor` from the private scheduler. Use the Supabase variables below and set `DMOCKS_OPERATIONS_RELEASE_SHA` to the full verified Git commit. The monitor reads health. Unavailable health, payment-mode mismatch, permission drift and unverified passes are P1. Stale orders, payments needing review and attempts past the stale threshold are P2.

Staging expects Test mode and production expects Live. Set `DMOCKS_OPERATIONS_EXPECT_PAYMENT_MODE=test` explicitly for an approved controlled Test window on the production target. Production monitoring also requires `DMOCKS_OPERATIONS_PRODUCTION_ACK=CHECK_PAID_MVP_HEALTH_ON_<exact origin>`. A mode mismatch reports a P1 finding with the expected and observed modes and omits the target's queues.

An approved alert receiver can use `DMOCKS_OPERATIONS_ALERT_URL`, `DMOCKS_OPERATIONS_ALERT_ALLOW_ORIGIN` and a separate `DMOCKS_OPERATIONS_ALERT_TOKEN`. It accepts a bearer-authenticated JSON POST and acknowledges with a 2xx status. Deduplicate the supplied `Idempotency-Key` for the same target, payment mode, release and set of findings within each 15-minute window. The monitor sends the Supabase credential only to the approved Supabase project origin and refuses redirects. Exit `0` means no urgent finding, `2` means a finding was reported, and `1` means configuration or delivery failed.

Use a new UUID for an explicit delivery check on the approved receiver.

```sh
npm run operations:monitor -- --verify-delivery "$DMOCKS_OPERATIONS_CHECK_ID"
```

The receiver records the `dmocks-operations-alert-verification-v1` message as a test and acknowledges it with a 2xx status. The message carries the verification ID, environment, payment mode, release and UTC time. A retry with the same ID and target uses the same idempotency key. The command requires verified health with no P1 or P2 findings and exits 1 if the check is blocked or delivery fails. Confirm the verification ID in the receiver before recording hosted acceptance.

Route payment Edge logs by the structured `dmocks_commerce_failure` event. The codes are `checkout_unconfirmed`, `webhook_unconfigured`, `webhook_signature_rejected`, `webhook_capture_unconfirmed` and `webhook_refund_unconfirmed`. These events carry the code alone. Verify that the approved environment delivers both an aggregate alert and the expected webhook error signal before accepting monitoring for launch.

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

Use the operator-only capture/verify commands and isolated restoration procedure in [RECOVERY.md](RECOVERY.md). It includes encrypted database and actual private-object bytes, with a consistency check before a bundle is ready. Never treat a database-only dump or an empty-schema test as private-media recovery.

Before a production migration, accept backup/key custody, an offsite copy, the approved recovery target and a real restore. Paid backup/PITR services need a budget decision. Retest quarterly and after significant schema/storage changes in a new isolated target without OAuth, email, merchant or public DNS connections. Verify original clocks, answers, payment receipts, RLS and private files; remove the target afterward. Frontend rollback uses the prior immutable artifact; do not drop columns or customer data as a rollback shortcut.

## Payment reconciliation

Payment engineering is resumed. Sales stay closed until the approved real Test journey and final release decision. When enabled, reconcile captured provider payments to exactly one paid order and one entitlement. A browser callback is never evidence of payment. Investigate stale pending orders without granting access; refund/revocation actions require the approved commercial policy and an auditable operator action.

## Scheduled recovery and retention

The default MVP runner verifies service health first, drains bounded expired attempts, prunes old rate buckets and rereads health. It reports whether its batch budget was reached. It performs no AI/intake recovery or deferred product mutation; old full-portal scheduling advice below is historical. An old/unverified profile or malformed count exits before further work. See CHECKOUT_RECOVERY.md.

Run `npm run operations:sweep` from a private scheduler every minute with `DMOCKS_SUPABASE_URL`, `DMOCKS_SUPABASE_SERVICE_ROLE_KEY`, `DMOCKS_OPERATIONS_ALLOW_ORIGIN` (the exact Supabase origin) and `DMOCKS_OPERATIONS_ENVIRONMENT=staging|production`. Keep the service credential in the scheduler secret store. The runner verifies the current profile and payment mode before writing. Production also requires `DMOCKS_OPERATIONS_PRODUCTION_ACK=FINALIZE_EXPIRED_ATTEMPTS_ON_<exact origin>`. Pause the schedule during a planned Test-to-Live switch and restart with the expected Live mode.

Each invocation drains at most ten batches of 500 expired attempts, prunes rate buckets older than two days and prints one aggregate JSON health record. Exit `0` means healthy or attention, `2` means degraded and `1` means configuration or RPC failure. Inspect the named RPC before resuming a failing schedule. The approved environment and scheduler configuration are part of hosted acceptance.

Question processing has a five-minute server expiry. `recover_expired_question_jobs(100)` is service-only and marks expired work failed with a retry message. It handles older interrupted rows using their original start/update time, skips locked rows and leaves current workers running. Failed and expired counters stay visible to the operator until the work is resolved.

After the staging operations schedule is approved, run `node scripts/recover-question-jobs.mjs` with the same private operations environment variables and `DMOCKS_OPERATIONS_ENVIRONMENT=staging`. This command verifies the designated project and Test mode before calling the service-only recovery RPC once. It reports counts for both queues and whether either reached the 100-job limit. It works with the private portal grants. The paid MVP sweep does not invoke the question-job worker.

In the admin portal, select **Refresh queues** to reload processing status. **Retry extraction** can reclaim a failed or expired source. The creator of an AI request can select **Retry draft** after failure or expiry. Each retry rechecks administrator access, and AI drafting rechecks reference rights before inference. A retry starts only after the administrator selects it. Source candidates and generated drafts retain their review holds.

Every new processing attempt receives a private token. Completion and failure calls carry that same token, so a late worker cannot replace or fail a newer attempt. Completion acknowledgements can be retried without duplicating candidates or drafts. Deploy migration `202611060131_question_job_recovery.sql`, both model workers and the updated operations runner together during the approved staging rollout. The original service argument sets remain supported for unleased legacy jobs. New jobs require the token-aware workers.

## Support and moderation

- Bug replies, question retirement, community moderation and drawing-score overrides are performed only through their audited admin workflows.
- Report counts prioritize human review. A human decision governs changes to the bank.

Under **Reported questions**, five unique students hold a delivered question version from new attempts; ten raise its priority. Several reasons from one student count once toward the threshold, and an account can submit twenty reports per hour. Open the frozen question, answer and private figures before resolving a case. Restore and dismissal require verified figures and an 8–1000-character reason. The current case revision and bank digest protect every decision from concurrent reports or source changes. New reports on a resolved version update its counts without automatically reopening it. Existing attempts continue with their original questions and clocks.

For a correction, review the source change on canonical `main`, import it, then use **Release corrected source for review**. This keeps the old version held, returns the current source to runtime materialization and separate content/rights review, and preserves unrelated retirements. A source omitted from the latest completed import stays inactive. An affected All India paper pauses new admissions as a whole; do not replace its questions or change existing scores as a report-resolution shortcut. Promote migration `202611060133_question_quality_holds.sql`, `reported-question-media` and the matching frontend together, then repeat the synthetic admission/race and reviewer-authorization checks on approved staging.

### Deferred drawing review (post-launch reference)

An administrator grants access under **Admin review → Drawing reviewer access** using an existing DMocks Auth account ID and a reason. The reviewer opens **Review drawings** from Account and claims an anonymous submission from **Available drawings** after uploads close. Under **My reviews**, the reviewer can return an ungraded claim or open the private pages, enter criterion marks, save feedback and finalize the review.

An administrator records a reason when revoking access. Revocation returns ungraded claims to the queue and preserves saved grades for administrators to finish. New queue reads, image-signing requests and grading actions are denied after revocation. Previously signed image links expire after five minutes. Administrators handle corrections to released individual feedback through the audited override and explicit release controls.

Stage migrations `202611060122_drawing_review_claims.sql`, `202611060123_all_india_drawing_results.sql`, `202611060126_drawing_reviewer_access.sql` and `202611100163_drawing_removal_receipts.sql` with the drawing media functions and matching UI. Test with separate synthetic student, reviewer and administrator accounts. Verify upload ownership, signed-page expiry and refresh, reviewer isolation, revocation with an existing session and a grade correction. Uploads verify complete PNG/JPEG/WebP decoding, unnecessary-metadata removal and Storage binding. General scanning/quarantine, resumable transfer and representative hosted resource acceptance remain open.

An accepted removal frees the page slot and records the private file in the same transaction. When Storage has not confirmed deletion, the student sees that file cleanup is pending. The same removal receipt can finish cleanup after the cutoff. New removals and replacement pages still use the original deadline.

On the approved Test target with sales closed, set `DMOCKS_SUPABASE_URL`, `DMOCKS_SUPABASE_SERVICE_ROLE_KEY`, `DMOCKS_DRAWING_CLEANUP_ALLOW_ORIGIN` to the exact provider origin and `DMOCKS_DRAWING_CLEANUP_ENVIRONMENT` to `development` for loopback or `staging` for the approved private target. An apply on staging also requires `DMOCKS_DRAWING_CLEANUP_STAGING_ACK=PURGE_REMOVED_DRAWINGS_ON_<exact origin>`.

```sh
npm run drawing:cleanup -- --limit 25
npm run drawing:cleanup -- --limit 25 --apply
```

The first command reports a bounded count of recorded removals. The second attempts the private deletions and confirms each against the exact receipt and Storage catalogue. Exit `2` means the selected batch still has pending work. Retry the bounded batch after Storage recovers. The command prints aggregate counts and leaves the existing paid MVP scheduler separate.

For All India events, choose the objective and drawing counts and the drawing upload allowance when scheduling the paper. The last start reserves the whole exam and upload window. Use **Finalize grade for cohort release** on each submitted drawing and publish after the ten-day review period. Missing drawing pages earn zero for that task. Published grades and standings are frozen.
- Drawing feedback is private until explicit release. Any later score change requires a reason and a new release.
- Export/deletion, minors, retention, refund and public incident-notice requests require the approved policy before action.

### All India result sharing

Students see their released rank and marks in the portal. Sharing on the public site requires a separate event approval and the eligible student's explicit choice. The public list uses the existing first ten positions and tie order. It shows the generated event alias, rank and marks for students who choose to share. A withdrawn or unshared position stays vacant.

On approved staging, use fictional participants and reviewed fixture notices. After cohort release, a verified administrator calls `admin_open_all_india_ranking_publication(p_event_id, p_policy_version, p_evidence)` with the current policy revision and the event's approval reference. Record the returned publication ID. The database requires current privacy and child-safety attestations. Applying the migration leaves existing cohorts private. The paid MVP companion profile excludes the public feed and the sharing controls.

Eligible students use **Share on public results** or **Stop public sharing** on the released event card. If a save cannot be confirmed, use **Refresh All India mocks** to inspect the saved choice. Confirm the public feed and the student's private rank after withdrawal.

To close publication, call `admin_close_all_india_ranking_publication(p_event_id, p_publication_id, p_evidence)` with the exact publication ID and closure reference. A changed mode, policy revision or relevant attestation makes the old publication inactive. Close it before opening a fresh approval, which starts with fresh student choices. Promote migration `202611090158` with the matching frontend. Production publication requires the owner's separate decision on public ranking identity and consent.

### Theory lessons

In **Admin review → Theory lessons**, save a draft and review its text before publishing. When publishing, record the source and permission to use the lesson. To revise a published lesson, withdraw it with a reason, edit the draft and record the rights again when republishing. Learn hides withdrawn lessons and restores existing student completion when the same lesson is republished.

Stage `202611060127_learning_lesson_editor.sql` with the matching portal. Verify draft visibility, publication, withdrawal and progress with separate synthetic administrator and student accounts before importing the owner's theory material. The new editor records each publication or withdrawal in a private audit. Earlier administrator clients retain their existing rights-confirmation control.

### Community report review

Members open **Report discussion** or **Report**, select one of the five reasons and optionally describe the issue. Nothing is submitted until **Send report**. An uncertain acknowledgement freezes that exact reason/details for **Retry report**; closing cannot undo an already saved report. An existing-report acknowledgement confirms the earlier account/target record without replacing its notes. New reports are capped at ten per hour; readable locked content remains reportable and hidden content rejects new reports. Account changes, navigation and explicit Close/Escape abort or ignore pending browser outcomes.

In **Admin review → Community moderation**, choose **Review report**. Inspect the current reported item, immediate parent and discussion; content may have changed since the report was sent. Open and view every available private attachment. The inspector supports rotation, mirroring, zoom and original size. Hidden context remains available only to administrators within this report review.

Record a written reason before choosing **Hide content** or **Dismiss report**. A stale review clears its evidence and requires reopening with a fresh reason; it is never automatically resubmitted. Missing or unreadable images prevent dismissal, while hiding is available for containment. Only the selected report is resolved; other reporters stay in the queue. Closing, account changes, denied access and expiry clear private galleries. Decisions retain an administrator-only inspected snapshot and reason. The legacy immediate-resolution API is closed.

Stage migration `202611060141`, the matching `community-media` bundle and frontend together. Confirm image registration, actual object availability, hidden-context permissions, queued access revocation and competing decisions with fictional accounts. Existing signed links remain capabilities until their five-minute expiry. This local workflow does not approve content publication, retention policy or public registration.

Stage migration `202611060142` with the member reporting controls. Verify exact reason/details, unchanged duplicate receipts before quota/visibility checks, concurrent single insertion and queued moderation denial. Reports continue to require a human decision; this member workflow does not automatically hide Community content.

Community discussions use exact exam/topic filters and 25-row snapshot pages. **Load more discussions** preserves the current draft and returns focus to the first new discussion. A content/status/order revision clears accumulated pages before reloading; a temporary continuation failure keeps its cursor for retry. New posts appear on a fresh filter application/refresh and do not enter an older reading snapshot. Filter changes cancel prior reads and prevent late text/image completions from restoring an earlier selection.

Stage migration `202611060143` with the member frontend. Keep the reader free of post/comment row locks. New post creation must take its author/Auth fences and the exclusive feed-admission row before assigning its clock. Do not add bulk post changes or physical Auth-user deletion without the lock-order work documented in provider setup; current account deletion remains a request. These source changes leave hosted registration and sales closed.

Authors can choose **Add discussion images** or **Add reply images** on an owned visible item with capacity. The browser checks a fresh author-bound inventory before uploading into free positions. Existing text and images remain unchanged. A partial/lost acknowledgement retains the exact selected files and position plan in **Saved post images** or **Saved reply images**; **Retry** continues that plan, while **Finish … without remaining images** keeps confirmed images and stops the remaining selection. A competing image cannot be overwritten; refresh the discussion and make a new explicit selection if needed. Same-thread gallery refresh preserves loaded replies, their continuation and an unsent reply draft while the revision is unchanged. A changed revision reloads current content; signing denial clears private galleries. Changing account/page clears retained files, and later discussion/filter choices prevent old completions from reopening a prior view. Promote migration `202611060144` with the member frontend. Members can open **Inspect question attachment** or **Inspect solution attachment** to rotate, mirror, zoom, fit or view original size using the current signed image. Inspection does not request a new link or alter the upload. Refreshed URLs, expiry and account/navigation changes close the dialog; known denial clears private views and restores discussion/feed focus. Removal/replacement of evidence stays outside this addition workflow.

### General Community moderation

Choose **Browse Community content** in the administrator desk. Exact exam/topic/status filters and **Load more moderation discussions** read pages of up to 25, including hidden content. **Browse replies** includes hidden replies; **Back to discussions** restores the discussion filters. Open **Review discussion** or **Review reply** for complete current text, parent/discussion context and private images. A reply review can open its discussion or immediate parent for a separate current decision.

Enter a moderation reason before **Hide**, **Restore**, **Lock** or **Unlock**. Locking keeps the discussion readable while preventing new replies/uploads. Restoration requires complete registered images and successful display; restoring a discussion also makes its visible replies readable again. Stale context clears the inspected version and requires explicit reopening. Hiding or locking can contain content while unavailable images are checked. General moderation leaves each report open until a separate report review resolves it.

An unconfirmed action retains the exact target, inspected version, request ID and reason. **Retry moderation action** confirms that same request; it cannot apply an earlier action again after another action supersedes it. **Stop retrying and refresh** opens current status/history without sending a new action. Closing cannot undo an action already received by the server. Private images clear on expiry, changed selection/account/history and denied access. Status changes keep original text, clocks and registered files intact; physical removal/replacement awaits the retention policy.

Promote migration `202611060145`, the matching `community-media` helper and frontend together after their predecessors. The old direct moderator is closed; operator clients must use the inspected six-argument API with an account-bound request ID. Post page readers must stay free of post/comment locks. General actions acquire the actor FK before post/comment, existing object and feed-revision fences, then recheck roles after waits. The staging smoke script includes anonymous denial for the new read/image/action RPCs. Keep registration and sales closed.

The whole administrator desk now rechecks access after a permission denial and on focus, page/visibility restoration and each visible minute. A confirmed loss or failed ten-second verification clears private panels, images, drafts and selected files. **Check administrator access** starts a fresh check and reloads current data; it never resends an earlier action. **Recheck administrator access** verifies an open desk manually. An unavailable item can produce the same permission status as role loss, so a successful role recheck preserves other permitted panels and unsent work. Account/history/navigation changes cancel the old scope, and later bulk responses cannot overwrite a newer refresh. The separately accepted teacher lifecycle uses its own reviewer role: assignment/version denial removes that review and invalidates older queue reads while preserving other permitted drafts; whole-role loss clears the entire workspace. Every explicit queue choice fences old grades/signing. Promote the matching frontend after its migrations/functions and repeat these role, account and delayed-response cases on the approved staging target.

## Student support reports

Promote migration `202611060146` and the matching report frontend together after their predecessors. The new browser requires the four-argument creator and bounded page API; missing endpoints show a temporary-unavailability message and never fall back to an unconfirmed legacy submission. Older three-argument creators remain compatible and share the serialized five-per-hour limit. No historical report contents are rewritten. Receipts and new staff audit entries have no browser table grants.

**Retry report** confirms the exact earlier request after a missing acknowledgement. It cannot create a second report, reopen it or replace a later team reply. **Stop retrying and refresh** abandons the local retry and refreshes history; the earlier report may already be saved. Do not start a duplicate while checking an uncertain submission. Refresh and load-more controls preserve the current draft; pages retain the raw UTC microseconds and owner-bound cursor. A refresh starts a new snapshot. New source context contains origin/path only; the API also strips query, fragment and HTTP userinfo. Written support descriptions remain student-provided text.

Current account verification precedes private history. Account/history/sign-out changes, known authorization denial and failed/timed-out verification clear the complete support scope and pending drafts. **Check report access** opens a fresh check without replaying any action. Unknown creation results retain an immutable receipt for explicit retry; known quota/validation rejection retains editable details. Each read/action has a twenty-second limit, and no provider diagnostics are shown.

In **Admin review → Bug reports**, find the report, set its status and save a team reply. The queue shows 25 reports per page. The reporter sees the current status and reply in **Your reports**. If another staff member has saved a change, **Refresh report** loads their response for review before another save. If a save could not be confirmed, **Retry same reply** resends the original request and returns its existing receipt when it already committed.

For payment issues, the customer can select **Get help with this order** in Purchase history. The linked purchase in the staff queue shows its application reference, recorded payment and refund amounts, and any review flag for the current environment. Verify provider evidence before following the [payment reconciliation procedure](REFUND_RECONCILIATION.md). Migration `202611090161` and the matching frontend are required for order links. The paid MVP also requires its updated companion profile.

The database saves the new revision and its private audit row together. Staff access is checked after lock waits, including when returning an existing receipt. Install the support migration and matching companion profile with the frontend release. Earlier admin clients must reload to use the new support endpoints. Repeat the competing reply, queued revocation, lost acknowledgement and desktop/mobile checks on the approved staging target.

## Candidate profile and session recovery

Learn now uses the current-account boundary as well. **Check Learn access** creates a fresh scope and clears previous theory/progress; it never replays completion. **Refresh lessons** replaces catalogue/progress with validated current responses. **Reload lesson** checks the current body/publication and saved completion state after an uncertain result. Read/action deadlines are twenty seconds, including unresponsive identity promises. Completion is acknowledged only after reading the server flag; unknown replies disable another completion until inspection. Withdrawn theory clears from the reader. Free reading, existing lesson-level history and exact exam/topic practice context remain unchanged. No new migration or backend signature is required; repeat representative publication, account, identity, lost-response and withdrawal journeys on the approved staging target.

Account privacy uses the same current-identity boundary and pins every request/export to the verified actor. **Check privacy access** starts a fresh private scope after account, history, sign-out or verification loss. **Refresh privacy requests** clears an uncertain change after a valid read. Failed or malformed reads disable changes, and exports still require strict account and release validation. Reads and actions expire after twenty seconds even when the identity provider is unresponsive. Inspect the current state before another change after an unknown acknowledgement.

Staff review privacy requests in pages of 25. A decision requires the current reviewed revision and an operator note. After a competing decision or an uncertain save, **Refresh request** loads the current status and note for review. The account owner sees the status and note for their latest closed or declined request. The staff action records the outcome of the separate account-deletion process. Apply the privacy review migration and matching companion profile with the frontend release. Repeat paging, role revocation, competing writes and lost acknowledgements on the approved staging target. Retention and deletion policy require the owner's approval.

Promote migration `202611060147` after its predecessors and repeat the profile acceptance on the approved staging target with this frontend. Existing API signatures remain compatible. Profile writes reject null/invalid details, serialize with service-only verification and read phone proof after the profile lock. Same-phone updates preserve verification, completion time and purchase terms; changing the number clears verification/completion. Stale phone proof cannot complete a changed profile. Direct browser table writes and all browser verification calls are denied, including administrators. No historical profile values are rewritten.

The page verifies current identity before private fields. Account/history/sign-out changes and failed or timed-out verification clear drafts and pending work. **Check profile access** creates a fresh scope without resending a save. A pending save disables its fields. Unknown acknowledgements freeze the draft; **Reload profile** explicitly replaces it with current saved values and allows inspection before another save. A reload can abandon a request already received by the server; it does not undo that request. No save is automatically repeated. Provider diagnostics and malformed response contents remain hidden.

The shared Auth observer cannot replace a newer sign-in/sign-out with an older initial session. Its initial read has a ten-second limit; late cached data cannot reopen a timed-out read, while a fresh Auth event can update it. Refresh the page to retry initial session loading. Current-identity verification remains independent of cached session data. Local service verification tests use fictional phone proof and do not accept a real OTP integration; the owner phone-provider decision and real acceptance remain pending.

Profile and support requests capture and verify the exact session token for their expected actor, then pin its Authorization header through dispatch. A token change before the SDK notifies the page clears the scope without sending the earlier draft as another user. A change after verification cannot redirect the in-flight request. Repeat both races with real synthetic Auth sessions on approved staging. Abort/supersession remains a request cancellation, and must not invalidate an otherwise current account. Audit the remaining private clients for the same binding before launch.

Administrator/reviewer role checks and all scoped RPC/Edge actions now use the same verified-token dispatch. In particular, private source downloads, teacher grading and assigned-image signing must keep the intended actor when the SDK's storage token changes after verification. A mismatch before dispatch clears private panels/files/images/drafts and requires explicit recovery. Per-request Authorization replaces earlier casing without changing content type or other options. Target/version denial still checks the original actor's role and preserves other permitted work. Verify both token timing cases, actual audit actor IDs, source-byte hashes and unchanged attempts/uploads on approved staging. Remaining Community/Learn/assessment/account clients still need their binding audit.

## Release checklist

Before promotion: green GitHub CI, disposable PostgreSQL 17 suites, staging migrations, synthetic desktop/mobile journey, private-media denial checks, backup evidence and aggregate health with no degraded counters. Keep registration and sales disabled during deployment. Enable them only by separate owner-approved production decisions.

The administrator launch-readiness panel records evidence for content rights, privacy/terms, refund policy, child safety, drawing operations, provider acceptance, backup/restore and capacity acceptance. Approvals are audited and reversible. The database refuses a disabled-to-enabled sales transition unless every gate is approved, a policy version exists and at least one enabled exam blueprint passes its verified manifest. Recording all gates still does not activate sales or public registration.
