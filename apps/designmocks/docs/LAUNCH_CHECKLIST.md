# DesignMocks completion checklist

Owner instruction: keep working until the independent mock-test service is complete. Last reconciled: 7 November 2026. A checked item means verified completion, not merely code present. Never mark a provider integration complete on the basis of a login, quota error or unconfigured endpoint.

## Completed foundation

- [x] Separate DesignMocks source/application; approved Discovery styling and academy attribution/referral links.
- [x] Owner-private website preview deployed at https://designmocks-studio.snehal1155.chatgpt.site.
- [x] ₹1,193 annual pass, 12 calendar months, one payment, no automatic renewal.
- [x] Independent Free Supabase project in Mumbai (`tiodqzvvujxvxssvjdis`); Dexam accounts, databases and merchant credentials remain separate.
- [x] Database migrations 001–003 applied and tracked, private media bucket created, three backend functions deployed.
- [x] Server scoring/access/payment invariants pass on hosted Supabase; fictional test records roll back.
- [x] 10 read-only hosted setup checks pass; new registrations and sales remain closed.
- [x] Original timed experience sample and focused feedback, answer review, mobile/keyboard/theme/reflow checks.
- [x] Dedicated Google Cloud project `designmocks-auth-2026`; Google app registration saved after the owner's policy confirmation.
- [x] Closed-by-default Google signup hook installed and configured; hosted transactional decision tests and role-grant assertions pass. Actual owner OAuth hook execution and callback now pass.
- [x] Read-only bank readiness scanner and four fixture tests; hashes capture the inspected source versions and concurrent JSON edits invalidate the scan.

- [x] Local, explicitly fictional inside-portal preview: dashboard, original sample links and example feedback report. Preview fixtures/routes are excluded from the production bundle.

## Google login — current priority

- [x] Web OAuth client `DesignMocks Web` created in `designmocks-auth-2026`; client inventory and “OAuth client created” confirmation verified on 5 November. Prepared origin/callback are recorded in provider setup; scope verification remains below.
- [x] Owner saved the Google client ID/secret directly in the separate Supabase provider. Public Auth settings now confirm Google enabled (5 November); credential validity is confirmed by actual callback acceptance below.
- [x] Verified basic identity scopes and server-controlled owner/tester access; actual Auth hook denial and owner Google callback pass.
- [x] Enabled labelled owner-only Google testing; the signup hook remains allowlisted and sales remain closed.
- [x] Local actual Google callback/PKCE, consent, reload persistence, SDK refresh, sign-out, returning-account reuse and cancellation verified.
- [x] Actual Google callback/PKCE, reload persistence, refresh and sign-out pass on the private `dmocks.com` publication.
- [x] Google app name/home page/authorized domain saved as DMocks / `dmocks.com`; Testing audience preserved.
- [x] Desktop and mobile fixture sessions can refresh and sign out from the controlled account screen. Direct student, attempt and administrator routes stay closed in that build.
- [x] Verify a separate staging portal build with exact-origin and project guards, server-checked tester access, and closed checkout. Desktop and mobile tests exercise the built artifact.
- [ ] Promote the staging database and functions, then verify tester admission and a representative exam journey on the private deployment.
- [ ] Complete public Google branding verification and final public privacy/terms links before registration opens.

## Paper delivery and assessment

- [x] Located and audited the owner-selected canonical `origin/main:server/data/exports/dexam-bank-export.json`; the newer PRODUCT_EXECUTION_PLAN and QUESTION_BANK_AUDIT supersede the old workstation scan for source eligibility.
- [x] Implement the canonical-source importer and verify dry-run/eligibility/runtime fixtures; no real question content is in the app source or browser bundle.
- [x] Import the exact canonical hold-free set privately and verify full replay against the same completed run.
- [x] Upload and verify all canonical private images; accept actual authenticated browser delivery without public access.
- [x] Convert and verify UCEED/CEED objective questions with explicit 2027 marking/private images; hosted materialization, replay and exact full-record comparison pass for 1,502 converted questions.
- [x] Verify canonical import replay preserves independently compiled runtime decisions.
- [x] Verify the NIFT 2027 B.Des. GAT context, compile supported questions locally and verify the fixed count, clock and marking in PostgreSQL. The offline run compiled 155 of 298 eligible canonical NIFT records.
- [ ] Verify the NID programme-specific context. Complete hosted NIFT runtime materialization, replay and human review before releasing NIFT GAT.
- [ ] Complete exact paper/marking/section manifests and full timed-part delivery before publication.
- [ ] Implement and verify paper-specific sections, timing, marking and locking against the reviewed blueprints; do not present the flat prototype as a complete official exam simulation.
- [ ] Verify image delivery, saved/resumed attempts, deadline enforcement and immutable submitted answers with representative reviewed papers.
- [x] Finish useful objective question-type/topic reporting, answer explanations and deterministic weakest-topic practice recommendations. Drawing and dropped questions remain excluded from objective insights; unreleased All India feedback remains hidden.
- [x] Keep pending sequential exam and All India results out of Overview statistics and Learn recommendations. Show awaiting-release status separately.
- [x] Verify theory drafts, audited publication and withdrawal, and preserved student progress with local database tests and desktop/mobile browser fixtures.
- [x] Verify owner-bound drawing uploads, final-evidence claims, private image access, criterion totals and audited grade overrides locally. Desktop/mobile coverage includes the grading form and explicit feedback release.
- [x] Verify All India drawing uploads during the results hold, the final-review gate, and combined marks and ranks using a twelve-candidate synthetic cohort.
- [x] Verify the separate teacher queue, assigned-image access, grading, and audited reviewer grants and revocation with local database tests and desktop/mobile browser fixtures.
- [x] Verify local answer recovery across reload and reconnect, stale-revision reconciliation, and deadline finalization of the last server-accepted answers.
- [ ] Approve and deploy the separately implemented human drawing-review operation before promising that service publicly.
- [ ] Import reviewed theory material and verify the Learn lifecycle with synthetic accounts in hosted staging.
- [ ] Confirm content-rights/publication authorization before releasing paid official-paper practice. Human review is already confirmed; rights are a separate recorded launch prerequisite.
- [x] Implement private PDF/photo upload, single-worker extraction lifecycle, strict structured candidates, per-question correction/rejection and mandatory human-review holds. Provider deployment remains closed pending source rights, consent, retention, model and cost approval.
- [x] Verify structured corrections, manual transcription of multiple questions per file, retained private PNG figures, authenticated source/figure downloads and canonical intake exports. Synthetic local Supabase acceptance covers concurrent retries, the actual importer, private-media registration and verified runtime materialization.
- [x] Recover interrupted extraction and AI draft jobs with five-minute expiry, bounded service sweeps, explicit admin retries and private processing tokens. Verify late-worker rejection, creator/reference checks, legacy HTTP compatibility and preserved review holds using isolated Supabase and desktop/mobile journeys.
- [x] Verify rights-cleared AI references and human-reviewed canonical draft exports in PostgreSQL and desktop/mobile. A fictional model response passed the real importer and UCEED runtime compiler in isolated Supabase.
- [x] Review the complete imported bank through searchable, filtered pagination, full canonical questions/answers/marking and signed private figures. Require a written review and exact current version; deny incomplete media, stale decisions, students and drawing-only teachers. Isolated Supabase acceptance covers actual Auth, compiler/importer/runtime writes, HTTP overloads and private PNG delivery.
- [ ] Approve AI processing and verify real model output in staging before enabling the generation service.

## Payments and access

- [ ] **Deferred by owner, 6 November:** resume Razorpay only when requested. Merchant onboarding is at website details; the exposed old Test pair must be replaced/deactivated before use.
- [ ] Configure separate Razorpay Test keys and a signed webhook in server secret storage.
- [ ] Test actual provider orders, cancellation, failed payment, captured payment, signatures, duplicate/retried/out-of-order events and exact annual access.
- [ ] Implement/test refund and access-revocation/reconciliation behaviour consistent with the approved purchase policy.
- [ ] Verify a customer cannot buy a second active pass, choose their own price, forge entitlement or access another account's attempts.

## Production readiness

- [ ] Draft concrete operator, privacy, purchase/refund, support and invoice information from verified academy details; obtain owner decisions where they define commercial policy.
- [ ] Implement agreed retention, deletion/support and younger-student handling before public registration.
- [x] Implement authenticated self-service JSON data export plus idempotent, reversible account-deletion requests and an audited administrator handling queue. Actual deletion remains a separately verified operator action pending the retention policy.
- [x] Implement server-owned UCEED/CEED Part A → Part B sessions with fixed official clocks/task counts, single-start idempotency, cross-student denial and the existing 15-minute drawing-upload grace. Provider-backed human review remains a release gate.
- [x] Gate Part A marks/keys through the complete Part B upload/review lifecycle and release one combined server-calculated report with objective and drawing subtotals.
- [ ] Complete unit/database/browser/provider acceptance checks, accessibility/mobile reflow and the real exam bank checks; resolve blocking findings.
- [ ] Prepare monitoring, recovery/backup and support/reconciliation runbooks appropriate to the selected hosting tier.
- [x] Add a guarded, server-only operations sweep for bounded expired-attempt finalization, rate-bucket retention and privacy-safe health output. Scheduler installation, alert destination and backup policy remain hosting/owner decisions.
- [x] Add audited launch-gate attestations and a database sales-activation guard. Rights, policies, child safety, drawing operations, provider acceptance, backup/restore and capacity evidence must all be approved; the interface never enables sales by itself.
- [ ] Execute the guarded 150-session staging capacity plan with 75 synthetic active attempts; retain p95/error evidence and provider CPU/connection metrics. The harness and safety tests are implemented, but no external load run has been authorized or claimed.
- [x] GitHub app source merged in the selected private repository; existing owner-private Sites target and custom-domain hosting path verified.
- [x] Owner-connected `dmocks.com` is active with HTTPS; verified through Sites domain state. No purchase was made by this continuation.
- [x] Custom-domain DNS/TLS and exact Google/Supabase callback allowlist configured.
- [ ] Align and accept the actual checkout/webhook origins after Test merchant setup.
- [ ] Present the finished service and real costs for final public/live-payment approval. Preserve the owner-private audience until that approval.
- [ ] Enable approved production registration/papers/payments, verify the public customer journey, and hand over the live URL, configuration inventory and operating instructions.

## Current verified state — 7 November 2026

This section supersedes older handoffs. Google is enabled and actual owner login works locally and on the owner-private `dmocks.com` Site. Registration remains tester-only (one approved owner), with sales disabled, zero orders/passes and zero released papers. Razorpay is deferred by the owner; do not request or install merchant keys until resumed.

The standalone project has 25 applied migrations and three active functions as of the 7 November read-only check. Comparing that ledger with the 56 local migrations through `202611060132` leaves 31 pending. The earlier AI drafting migration `202611060006` is absent from the ledger, before already applied `202611060101` and `202611060102`. The matching staging migrations and functions need promotion before hosted acceptance. See the provider setup and operations runbook for the rollout.

The canonical export has 4,521 records: 2,582 explicit empty-holds rows imported privately, 1,939 excluded. Full server-payload comparison and importer replay pass. All 2,085 referenced PNGs (273,263,304 bytes) are now privately uploaded, downloaded and hash-verified, with matching registered dimensions/size. All original PNGs also pass full Pillow decode. Source files remain outside the app and browser bundle. No rights/publication flags were approved.

The first upload stopped after 1,779 registrations and 1,781 objects. A bounded retry/resume verified previous metadata, registered the remaining 306 assets and reused two already uploaded objects. All 2,085 final objects and registrations match; replaying three verifies reuse without overwrites. No root cause is asserted for the original interrupted request. Public image retrieval returns 400, anonymous download returns 404 and browser Storage policies remain absent.

Actual owner-browser acceptance rendered a 1496 × 687 image through the existing authenticated attempt signer in an explicitly temporary, unpublished, unreviewed QA fixture. No answer was selected/submitted. The fixture was removed and hosted counts returned to zero attempts/papers. This proves private image delivery, not acceptance of a complete reviewed exam or commercial release.

The verified 2027 UCEED/CEED compiler converts 1,502 objective questions with private images (830 UCEED, 672 CEED). Hosted materialization and replay verified every one of the 2,582 runtime decisions against the canonical content hash and compiled JSON. Repeating the original canonical import preserves the runtime records. The NIFT B.Des. GAT compiler and blueprint passed locally. NID and the remaining NIFT contexts need verified programme-specific rules. The 48 Dexam-original records have no supplied input-image assets. The bank still needs publication approval.

Current local checks passed 88 JavaScript tests, four Python fixtures, 96 desktop/mobile journeys, build and preview isolation, all ten server-function type checks, and all 56 migrations and suites on disposable PostgreSQL 17. The production dependency audit reports zero vulnerabilities. The managed Site was last verified with source through PR #24. Actual deployed-bank/Cloudboard reconciliation, provider-backed full-paper acceptance, staging capacity, extraction/drawing provider acceptance, rights, policies and public-launch approval remain open.

Keep the goal active while meaningful independent work remains. An owner/provider dependency blocks that item only. Never request credentials or personal identity/payment details in chat, change Dexam services, or turn elapsed time into approval.

Evidence: `VERIFICATION.md`, `PROVIDER_SETUP.md`, `PRODUCT_DECISIONS.md`, `supabase/project.json`, ignored app `test-results/` and parent `output/visual-audit/`.
