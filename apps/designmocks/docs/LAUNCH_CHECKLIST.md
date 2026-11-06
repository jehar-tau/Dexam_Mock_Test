# DesignMocks completion checklist

Owner instruction: keep working until the independent mock-test service is complete. Last reconciled: 6 November 2026. A checked item means verified completion, not merely code present. Never mark a provider integration complete on the basis of a login, quota error or unconfigured endpoint.

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
- [ ] Complete public Google branding verification and final public privacy/terms links before registration opens.

## Paper delivery and assessment

- [x] Located and audited the owner-selected canonical `origin/main:server/data/exports/dexam-bank-export.json`; the newer PRODUCT_EXECUTION_PLAN and QUESTION_BANK_AUDIT supersede the old workstation scan for source eligibility.
- [x] Implement the canonical-source importer and verify dry-run/eligibility/runtime fixtures; no real question content is in the app source or browser bundle.
- [x] Import the exact canonical hold-free set privately and verify full replay against the same completed run.
- [x] Upload and verify all canonical private images; accept actual authenticated browser delivery without public access.
- [ ] Complete runtime media conversion and exact paper/marking/section manifests before publication. The verified UCEED/CEED 2027 compiler dry-run now supports 1,502 objective questions; hosted write/replay and complete timed parts remain pending.
- [ ] Implement and verify paper-specific sections, timing, marking and locking against the reviewed blueprints; do not present the flat prototype as a complete official exam simulation.
- [ ] Verify image delivery, saved/resumed attempts, deadline enforcement and immutable submitted answers with representative reviewed papers.
- [ ] Finish useful section/topic reporting, explanations and practice recommendations. Drawing remains clearly separate from objective scores; do not promise human evaluation until that service is implemented and approved.
- [ ] Confirm content-rights/publication authorization before releasing paid official-paper practice. Human review is already confirmed; rights are a separate recorded launch prerequisite.

## Payments and access

- [ ] **Deferred by owner, 6 November:** resume Razorpay only when requested. Merchant onboarding is at website details; the exposed old Test pair must be replaced/deactivated before use.
- [ ] Configure separate Razorpay Test keys and a signed webhook in server secret storage.
- [ ] Test actual provider orders, cancellation, failed payment, captured payment, signatures, duplicate/retried/out-of-order events and exact annual access.
- [ ] Implement/test refund and access-revocation/reconciliation behaviour consistent with the approved purchase policy.
- [ ] Verify a customer cannot buy a second active pass, choose their own price, forge entitlement or access another account's attempts.

## Production readiness

- [ ] Draft concrete operator, privacy, purchase/refund, support and invoice information from verified academy details; obtain owner decisions where they define commercial policy.
- [ ] Implement agreed retention, deletion/support and younger-student handling before public registration.
- [ ] Complete unit/database/browser/provider acceptance checks, accessibility/mobile reflow and the real exam bank checks; resolve blocking findings.
- [ ] Prepare monitoring, recovery/backup and support/reconciliation runbooks appropriate to the selected hosting tier.
- [x] GitHub app source merged in the selected private repository; existing owner-private Sites target and custom-domain hosting path verified.
- [x] Owner-connected `dmocks.com` is active with HTTPS; verified through Sites domain state. No purchase was made by this continuation.
- [x] Custom-domain DNS/TLS and exact Google/Supabase callback allowlist configured.
- [ ] Align and accept the actual checkout/webhook origins after Test merchant setup.
- [ ] Present the finished service and real costs for final public/live-payment approval. Preserve the owner-private audience until that approval.
- [ ] Enable approved production registration/papers/payments, verify the public customer journey, and hand over the live URL, configuration inventory and operating instructions.

## Current verified state — 6 November 2026

This section supersedes older handoffs. Google is enabled and actual owner login works locally and on the owner-private `dmocks.com` Site. Registration remains tester-only (one approved owner), with sales disabled, zero orders/passes and zero released papers. Razorpay is deferred by the owner; do not request or install merchant keys until resumed.

The standalone hosted project has 23 applied migrations, including current main's intake/review-media schemas and `202611060101` canonical media registration. Schema installation does not establish acceptance of the new drawing/intake Edge Functions or human-review operations.

The canonical export has 4,521 records: 2,582 explicit empty-holds rows imported privately, 1,939 excluded. Full server-payload comparison and importer replay pass. All 2,085 referenced PNGs (273,263,304 bytes) are now privately uploaded, downloaded and hash-verified, with matching registered dimensions/size. All original PNGs also pass full Pillow decode. Source files remain outside the app and browser bundle. No rights/publication flags were approved.

The first upload stopped after 1,779 registrations and 1,781 objects. A bounded retry/resume verified previous metadata, registered the remaining 306 assets and reused two already uploaded objects. All 2,085 final objects and registrations match; replaying three verifies reuse without overwrites. No root cause is asserted for the original interrupted request. Public image retrieval returns 400, anonymous download returns 404 and browser Storage policies remain absent.

Actual owner-browser acceptance rendered a 1496 × 687 image through the existing authenticated attempt signer in an explicitly temporary, unpublished, unreviewed QA fixture. No answer was selected/submitted. The fixture was removed and hosted counts returned to zero attempts/papers. This proves private image delivery, not acceptance of a complete reviewed exam or commercial release.

There are still only 161 currently supported asset-free runtime conversions, all official/unlicensed. The 48 Dexam-original records have no supplied input-image assets; descriptive drawing questions need their proper response/review workflow rather than invented image requirements. Runtime image mapping, exact exam sections/marking, rights approval and representative reviewed-paper acceptance remain open.

Current checks: 26 JavaScript tests, four Python fixtures, production build/preview isolation, disposable PostgreSQL 17 suites across all 23 migrations, and 29 read-only hosted HTTP checks pass. Full current-branch GitHub browser/CI acceptance is required before merge. The managed Site currently contains source through PR #24; later merged app features require a separate deliberate owner-private publication.

Keep the goal active while meaningful independent work remains. An owner/provider dependency blocks that item only. Never request credentials or personal identity/payment details in chat, change Dexam services, or turn elapsed time into approval.

Evidence: `VERIFICATION.md`, `PROVIDER_SETUP.md`, `PRODUCT_DECISIONS.md`, `supabase/project.json`, ignored app `test-results/` and parent `output/visual-audit/`.
