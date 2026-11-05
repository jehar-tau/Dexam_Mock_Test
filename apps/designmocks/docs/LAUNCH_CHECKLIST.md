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
- [x] Closed-by-default Google signup hook installed and configured; hosted transactional decision tests and role-grant assertions pass. Actual OAuth hook execution remains part of the pending sign-in test.
- [x] Read-only bank readiness scanner and four fixture tests; hashes capture the inspected source versions and concurrent JSON edits invalidate the scan.

- [x] Local, explicitly fictional inside-portal preview: dashboard, original sample links and example feedback report. Preview fixtures/routes are excluded from the production bundle.

## Google login — current priority

- [x] Web OAuth client `DesignMocks Web` created in `designmocks-auth-2026`; client inventory and “OAuth client created” confirmation verified on 5 November. Prepared origin/callback are recorded in provider setup; scope verification remains below.
- [x] Owner saved the Google client ID/secret directly in the separate Supabase provider. Public Auth settings now confirm Google enabled (5 November); credential validity at callback remains untested.
- [x] Verified basic identity scopes and server-controlled owner/tester access; actual Auth hook denial and owner Google callback pass.
- [x] Enabled labelled owner-only Google testing; the signup hook remains allowlisted and sales remain closed.
- [x] Local actual Google callback/PKCE, consent, reload persistence, SDK refresh, sign-out, returning-account reuse and cancellation verified.
- [x] Actual Google callback/PKCE, reload persistence, refresh and sign-out pass on the private `dmocks.com` publication.
- [x] Google app name/home page/authorized domain saved as DMocks / `dmocks.com`; Testing audience preserved.
- [ ] Complete public Google branding verification and final public privacy/terms links before registration opens.

## Paper delivery and assessment

- [x] Located and audited the owner-selected canonical `origin/main:server/data/exports/dexam-bank-export.json`; the newer PRODUCT_EXECUTION_PLAN and QUESTION_BANK_AUDIT supersede the old workstation scan for source eligibility.
- [ ] Build a controlled private import/dry-run pipeline; keep real question content and keys out of Git and the public browser bundle.
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

## Rules while work continues

### Latest verified handoff

After the owner reported saving Google credentials, both the public Auth settings and refreshed provider dashboard still show Google disabled. The Client IDs field contains `DesignMocks`, rather than an ID ending `.apps.googleusercontent.com`; Save is disabled. A credential-entry handoff is pending. The secret was not revealed or copied. Screenshot: parent `output/visual-audit/designmocks-google-still-disabled.png`.

The read-only bank scan found 4,796 machine-readable questions across 72 papers, versus 4,742 SQLite questions across 71 papers and 4,521 in the older platform export. There are 221 IDs only in SQLite and 275 only in the machine-readable file. These are separate evolving sources, not interchangeable exports. No real content was imported or published. The scanner's strict candidates require explanations, structural keys/options and recorded unflagged review; it reports zero fully ready candidates under that contract. This is a technical readiness result, not a claim that no human review occurred. Only 59 machine-readable items contain an explanation. Source reconciliation and exact paper manifests remain required.

Keep the goal active while meaningful independent work remains. When an owner credential, legal acceptance, purchase or provider review blocks one item, mark that dependency and continue the other items. Do not turn elapsed time into approval. Never request passwords, PAN/bank details or API secrets in chat. Do not deploy changes to the existing academy/Dexam services as part of this new app.

Evidence: `VERIFICATION.md`, `PROVIDER_SETUP.md`, `PRODUCT_DECISIONS.md`, `supabase/project.json` and the parent workspace's `output/visual-audit/`.

### 5 November: Google client created

Verified `DesignMocks Web` in the dedicated Google project and its creation confirmation. Supabase still shows the old app-name Client ID, Google disabled and Save disabled. Owner handoff now specifically requires copying the newly generated client ID and matching secret into the prepared Supabase Google panel, enabling the provider and saving. The secret was neither revealed nor copied.

### 5 November: Google provider enabled

After the owner completed credential entry, the hosted Auth settings report `external.google=true`. All 10 read-only hosted setup checks pass. Global registration remains disabled, the signup hook remains closed and the frontend portal remains disabled. This verifies provider activation, not successful OAuth login or callback secret validity. Controlled owner-only sign-in acceptance is still pending.

### 6 November: current authoritative state

Newer main-branch portal features are preserved; PR #20 question intake is a separate unfinished slice. The hosted backend still has only migrations 001–004, so merged local modules are not claimed as released. A canonical bank dry-run at `48ff649a7240e8b769735132ddb3b4d09e5dbbee` reports 4,521 total, 2,582 explicit empty-holds eligible, 1,939 held, 2,054 objective-ready and 161 currently supported asset-free runtime conversions. No hosted bank import/publication has occurred.

Google local acceptance now passes with exactly one owner Auth account and zero orders/passes. Registration mode is `testers`, with one allowlisted address; the global Auth signup switch is on solely because the restrictive hook must run for Google account creation. Public registration is not open. Cancellation, persistence, token refresh, sign-out and returning login are verified.

Razorpay integration was explicitly deferred by the owner on 6 November. A Test secret appeared in setup tool output and must be regenerated/deactivated before future use. No merchant key was committed or installed, and sales remain false. Do not keep requesting credentials or configuring payments while deferred. Older disabled-Google/PAN/domain-availability notes above are historical; PROVIDER_SETUP.md describes the current verified state.

### 6 November: hosted Google and event-release checks

The controlled-login frontend was published owner-private through the existing Site identity (source `82719b545456c564d9190e957c0027606f3c893a`). Actual `dmocks.com` OAuth/PKCE, reload, refresh and sign-out pass. Hosted SQL still confirms one Google-linked owner account, zero orders/passes, tester policy and sales disabled. Google branding settings now use DMocks and the owned domain; the consent chooser may continue displaying the Supabase callback host, and final public-policy/verification work remains.

A source review found submitted All India attempts exposing keys and derived correctness before explicit result release. A new migration masks attempt/history/analytics responses until release, and the UI shows a pending state. Focused database regression checks fail against the old reader and pass with the fix, including ordinary-practice feedback and fair deadline-capped ranking. This migration is not yet applied to the hosted backend; assessment modules remain unreleased.
