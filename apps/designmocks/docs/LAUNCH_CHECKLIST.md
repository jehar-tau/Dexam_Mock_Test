# DesignMocks completion checklist

Owner instruction: keep working until the independent mock-test service is complete. Last reconciled: 4 November 2026. A checked item means verified completion, not merely code present. Never mark a provider integration complete on the basis of a login, quota error or unconfigured endpoint.

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
- [ ] Verify Google scope configuration and controlled owner/tester access.
- [ ] Enable an owner-only test flow without opening customer signup or payments.
- [ ] Test actual Google callback/PKCE, login, refresh, sign-out, failed/cancelled login and account isolation.

## Paper delivery and assessment

- [ ] Locate the owner-reviewed source bank and inventory exams, question formats, media, answer keys and review/publication metadata. Do not copy student records or secrets.
- [ ] Build a controlled private import/dry-run pipeline; keep real question content and keys out of Git and the public browser bundle.
- [ ] Implement and verify paper-specific sections, timing, marking and locking against the reviewed blueprints; do not present the flat prototype as a complete official exam simulation.
- [ ] Verify image delivery, saved/resumed attempts, deadline enforcement and immutable submitted answers with representative reviewed papers.
- [ ] Finish useful section/topic reporting, explanations and practice recommendations. Drawing remains clearly separate from objective scores; do not promise human evaluation until that service is implemented and approved.
- [ ] Confirm content-rights/publication authorization before releasing paid official-paper practice. Human review is already confirmed; rights are a separate recorded launch prerequisite.

## Payments and access

- [ ] Owner completes Razorpay merchant onboarding directly in Razorpay (currently at business-PAN stage).
- [ ] Configure separate Razorpay Test keys and a signed webhook in server secret storage.
- [ ] Test actual provider orders, cancellation, failed payment, captured payment, signatures, duplicate/retried/out-of-order events and exact annual access.
- [ ] Implement/test refund and access-revocation/reconciliation behaviour consistent with the approved purchase policy.
- [ ] Verify a customer cannot buy a second active pass, choose their own price, forge entitlement or access another account's attempts.

## Production readiness

- [ ] Draft concrete operator, privacy, purchase/refund, support and invoice information from verified academy details; obtain owner decisions where they define commercial policy.
- [ ] Implement agreed retention, deletion/support and younger-student handling before public registration.
- [ ] Complete unit/database/browser/provider acceptance checks, accessibility/mobile reflow and the real exam bank checks; resolve blocking findings.
- [ ] Prepare monitoring, recovery/backup and support/reconciliation runbooks appropriate to the selected hosting tier.
- [ ] Set up the separate production source/deployment target and verify the custom-domain hosting path.
- [ ] Verify current domain availability/checkout price and prepare purchase; the owner must authorize/pay for registration. No domain is purchased yet.
- [ ] Connect DNS/TLS and exact production OAuth/webhook origins after domain ownership is established.
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
