# Verification

## Current private bank acceptance — 6 November 2026

The exact canonical main export at `5e04ea6b5bcbdf344b601d0092ad316ff0e34555` is privately imported: 2,582 eligible rows, 1,939 excluded, 161 current asset-free runtime conversions, zero publication/rights approvals. Source SHA-256 is `dd7702650b6e8ffeb348d0b558ecdd2bfbc1e565f2a392536518a3cebc8962be`. The provider ledger records completed run `9b12d4cf-b0a0-4fc5-bd64-15068739134b`, with expected/recorded/membership counts all 2,582. A complete importer replay returns the same run. No question payload, key or service credential was printed or added to the app source/browser bundle.

Supabase rejected the prior unqualified finalizer update with HTTP 400 / SQLSTATE 21000 (safe-update WHERE requirement). Migration `202611060003` updates only rows with changed active states; the service-only boundary is preserved. The focused suite fails with the old finalizer and passes with the fix, proving changed-row behavior, retired-row handling, retry idempotence and rejection of incomplete runs. All 20 migrations and the existing/release/grant/finalization/media/signup suites pass in isolated PostgreSQL 17. Provider completion and replay also pass; the hosted ledger now has 20 migrations.

A read-only local media inventory found all 2,085 referenced PNGs under the original workstation media root. Each matches the canonical digest and dimensions; total 273,263,304 bytes, with no missing/unsafe/mismatched files. This is local-source evidence only, not Storage upload/signing or browser delivery acceptance. The 161 current runtime candidates all carry official/unlicensed labels; no question is approved or released. Source marking/section/media fidelity and usage-rights clearance remain publication gates.

## Portal installation and grants — 6 November 2026 (before bank import)

All 19 current source migrations are applied/tracked in the separate DMocks project. The portal batch used the exact four-migration baseline and closed-test/empty-commerce/assessment guards, and retained the existing owner Google account. Source PR #21 passes 26 browser journeys; PR #22 passes 28 journeys and the All India release regression before merge. No Dexam project was changed.

The new portal-grant catalogue suite fails against the original inherited PUBLIC grant and passes with the narrow hardening migration. All 19 migrations and existing/release/grant/media/signup suites pass in isolated PostgreSQL 17; hosted catalogue assertions also pass. `DMOCKS_AUTH_STAGE=controlled DMOCKS_BACKEND_STAGE=portal npm run test:hosted-setup` passes 27/27 read-only HTTP checks after the grant transaction commits. An initial overlapping smoke request reached the previous grant state and was rejected by the verifier; only the post-commit rerun is counted as passed.

The hosted state remains one owner Google account, zero orders/passes/questions, tester-only signup and sales false. Bank import, actual student paper delivery, phone verification, drawing, moderation, operations and public-launch acceptance remain incomplete. Database installation does not prove these flows work end to end. Razorpay remains deferred by the owner.

## Controlled Google acceptance — 6 November 2026 (before portal installation)

CI infrastructure note: run `42090968253` timed out during optional system-font downloads from the Ubuntu mirror, before browser journeys ran. Its successful unit/build steps do not constitute a passed merge gate. The regular browser command now installs matching Chromium without repeating optional system-package installation; minimal Linux environments have an explicit one-time system-dependency command. All desktop/mobile tests remain mandatory in the rerun.

This section supersedes historical provider/status notes below. Source baseline: `48ff649a7240e8b769735132ddb3b4d09e5dbbee` plus the controlled-login feature diff. Newer main-branch portal features are preserved. Hosted Supabase still has migrations 001–004; local migrations 005–017 are not described as hosted/released.

- Actual Google acceptance through the local app passes: business account selection, basic `openid email profile` consent, cancellation, Supabase callback and PKCE exchange, page reload, explicit SDK session refresh, local sign-out and returning login. Callback codes are removed by the SDK; no tokens are included in evidence. The same real callback/PKCE, reload, refresh and sign-out checks also pass on the owner-private `dmocks.com` publication.
- Hosted SQL confirms one Google-linked owner account, zero orders and zero passes. The server policy is `testers` with exactly one approved address. The global signup switch is enabled solely so this restrictive hook can admit Google testers. Public registration is closed.
- A real Auth email/password fixture request is rejected by the live hook with 403. Transactional decision/grant tests pass for closed, tester, unknown Google, anonymous, missing-email and non-Google cases. A real second Google account was not used; unknown-address evidence is transactional.
- `DMOCKS_AUTH_STAGE=controlled npm run test:hosted-setup`: 10/10 read-only checks pass. This suite does not itself inspect the private allowlist or prove merchant acceptance.
- 20 JavaScript unit tests and 4 Python readiness fixtures pass. Default-disabled production build passes; local preview/audit markers are absent. Production dependencies report zero audit vulnerabilities.
- All 17 current migrations plus access/payment/scoring/media/signup invariants pass in an owned, network-isolated disposable PostgreSQL 17 container. This is database evidence, not a claim of actual OAuth/payment/Storage-provider simulation or complete coverage of every portal module.
- Manual application-scoped axe checks on the signed-in account at 1728px in light and dark themes report zero WCAG A/AA violations, no incomplete checks and no overflow. Initial whole-document findings were two unrelated injected extension widgets; the development panel now explicitly scopes `#root`. Mobile and automated browser evidence are recorded separately when complete.
- Parent-workspace screenshots: `output/visual-audit/dmocks-google-session-verified.png`. No real bank was imported or published by these login checks.

Payments remain unconfigured and sales disabled. The owner deferred Razorpay on 6 November. The old exposed Test key pair must be replaced/deactivated before future use; no merchant secret was committed or installed. Final policy, hosted portal migration, private bank delivery, operating readiness and public-launch approval gates remain open.

## Historical evidence — 4 November 2026

This evidence applies to the independent DesignMocks preview. It is not inherited from the existing Dexam platform.

- `npm test`: **6 passing tests**. Covers exact-body webhook HMAC verification/tampering, captured-payment shape and currency checks, payment key environment separation, sample grading/feedback and malformed device-storage recovery.
- `npm run build`: passes. Development-only axe audit code is excluded from the production bundle.
- `deno check`: passes for `create-order`, `payment-webhook` and `attempt-media` using Deno 2.9.6.
- `npm audit`: installation reports **0 vulnerabilities**; production dependency audit also reports 0.
- The initial two SQL migrations applied successfully in a newly created database inside an owned, network-isolated disposable PostgreSQL 17 container. No existing Supabase database/container was mutated.
- Database invariants pass: anonymous/service-only access restrictions; profile/terms/sales gates; server price; pending-order reuse; provider attachment compare-and-set; exact amount/currency; one 12-month pass after webhook retries; duplicate active purchase; paper/question release gates; key/explanation withholding before submission; cross-student read/write/submission denial; resume; immutable snapshot/key; MCQ/MSQ partial/NAT-range scoring; drawing/dropped denominator handling; submit idempotence; deadline enforcement; alternative/full-marks/unanswered keys.
- Storage migration checked against a minimal compatible bucket-catalogue stub. It enforces a private raster-only bucket. Real Supabase Storage signing/RLS acceptance remains pending.
- **27 recorded axe runs**, across actual viewport widths 320, 390, 935 and 1440 and 13 routes, found **0 WCAG A/AA violations and 0 horizontal-overflow cases**. These are representative route/theme/viewport combinations, not every permutation. Manual checks covered the mobile menu, Escape/focus restoration, catalogue filter, light/dark themes, Google disabled state, correct pricing, submit confirmation/cancellation, saved report after reload, and question-heading focus.
- Browser sample: all five correct gives 5/5; a partial attempt with one incorrect, one correct and three unanswered gives 1/5 and focuses practice on spatial thinking, pattern recognition and hierarchy. Answer review remains optional.
- Manual audit resolved a dark decorative-label contrast problem, the large desktop headline wrap, joined words on mobile line breaks, timer semantics and sample question focus. Earlier automatic incomplete checks for a decorative label/menu glyph were manually inspected; the final home and active sample audits have no incomplete checks.
- Source contains no real bank, student data or provider credentials. Academy referrals are plain links with no cross-site analytics added.

Browser evidence is in the parent workspace’s `output/visual-audit/designmocks-axe.json` and `designmocks-academy-byline.png`.

## Acceptance still required

The independent Supabase project is now configured; the new Google client and Razorpay merchant setup still need configuration. Real OAuth, provider payments, signed webhook delivery, authenticated media signing and the account-backed browser runner have not been tested end to end against those providers. The live portal and paid checkout remain disabled. Full exam section/timing/marking fidelity must be checked against the reviewed imported bank before a paper is sold. Drawing uploads/human evaluation are not included. Final operator/purchase/privacy/refund notices are pending.

## Latest checklist work — 4 November 2026

- `npm test`: 6/6 passing; `npm run build` passes after these source changes. No frontend interaction code changed in this increment, so prior browser evidence remains applicable to that UI.
- `python3 -m unittest discover -s tests -p '*_test.py'`: 4/4 passing bank-readiness fixtures, including review flags, missing options, numeric/letter mismatch, non-finite/range keys and drawing separation.
- The read-only readiness scan records SHA-256 hashes and metadata only in ignored `test-results/bank-readiness.json`. It executes no bank-owned scripts, writes no source state and imports no real questions. It identifies divergent SQLite/machine-readable/export sources; see the launch checklist for counts. It is not a publication approval or an end-to-end paper test.
- Migration `202611040004` applied and tracked; closed signup hook configured via explicit project reference. `supabase/tests/controlled_signup.sql` passes transactionally. Initial role-impersonation test was rejected by the Management API; the revised suite honestly checks decision behaviour as the migration role and verifies explicit Auth-role grants. Real Auth-role hook execution remains pending.
- Re-ran 10/10 hosted setup HTTP checks: registration remains closed, Google remains disabled and payment endpoints retain unconfigured setup gates. Google credentials have not been verified despite the owner-reported save.

## Hosted Supabase acceptance — 4 November 2026

- Verified new project **DesignMocks**, `tiodqzvvujxvxssvjdis`, `ap-south-1`, PostgreSQL 17.11. Empty project confirmed before migration. Existing Dexam Staging was not changed.
- Applied all three migrations; registered versions `202611040001`, `202611040002` and `202611040003` as applied in the standard Supabase migration ledger.
- Ran the full transactional invariants suite on the real hosted database, using fictional IDs/questions and an empty-project guard. It passes. The fixture now names the `auth.users(id)` column explicitly, matching the real Supabase schema. All fixture writes rolled back.
- Confirmed final counts: **0 Auth users, 0 orders, 0 attempts, 0 questions**. Sales disabled, environment `test`, media bucket private.
- Deployed all three Edge Functions, set only the approved preview origin and configured exact Auth site/callback URLs. Registrations remain closed.
- `npm run test:hosted-setup`: **10/10 passing read-only HTTP checks**, including correct public plan, permission-denied anonymous RPCs (401), disabled registration, anonymous media denial (401), unconfigured payment gates (503) and unapproved-origin rejection (403).
- No Razorpay merchant secret or Google client secret is configured. A 503 setup gate is not a successful payment-provider integration test.

- Supabase security advisors flagged browser execution of the platform-generated `rls_auto_enable` event helper. Migration 003 revokes that execution from public/anon/authenticated; a transactional create-table probe confirms automatic RLS still works. The nine remaining authenticated security-definer warnings describe intentionally callable student RPCs; ownership, access, grading and publication gates were reviewed and exercised by the hosted invariants suite. They are not an assertion that all production security concerns are resolved.

## 5 November Google activation check

Re-ran `npm run test:hosted-setup`: 10/10 passing. The result now records `googleEnabled=true` in ignored `test-results/hosted-smoke.json`. Registrations remain closed. This is provider configuration evidence only; no real OAuth callback/session test has yet passed.

## Student portal inside preview — 5 November

Added `/portal-preview` and `/portal-preview/report` to the local development server only, using fictional account/pass/paper/history data and the live dashboard's shared presentation component. Sample buttons open the original five-question sample. This is a visual review surface, not a signed-in account, paid entitlement, released bank or provider acceptance result. The normal `/dashboard` still shows its sign-in gate.

`npm test` passes 6/6; production build passes and a bundle scan confirms the preview fixture names, component and report route are absent. Four axe runs cover the workspace at 935/390px in light mode and the report at 390px light/935px dark: zero violations and no overflow. Mobile runs retain the known decorative menu-glyph contrast incomplete result, which is not a detected violation. Route navigation to the example report and original sample was verified. Evidence: parent `output/visual-audit/designmocks-portal-preview-axe.json`. The preview is local-only; no deployed provider, registration, sales or account permissions changed.

## GitHub integration — 5 November 2026

Source copied into `jehar-tau/Dexam_Mock_Test/apps/designmocks` on an isolated worktree from current `origin/main`, without touching the existing dirty bank workstation. Root `serve`, `backend` and `check` remain unchanged; app commands are added with explicit prefixes. Original root data validation passes. No `.env.local`, credentials, runtime/official bank export, `.git`, Site hosting identity or build output was copied.

`npm run check`: 6 JavaScript tests, 4 Python readiness fixture tests, production build and preview/QA bundle-isolation check pass. Production dependency audit reports zero vulnerabilities. Deno 2.9.6 type-checks all three functions. All four migrations plus payment/access/scoring/media/signup invariants pass in an owned network-isolated disposable PostgreSQL 17 container; the added bootstrap Auth-admin role is a test-only stub. Remote hosts and non-empty databases are rejected by the database runner. This does not add provider end-to-end acceptance evidence. GitHub CI runs the same app/type/database checks with no production secrets.

## All India result-release regression — 6 November 2026

A submitted fixed-paper attempt previously exposed its answer keys, explanation, score and topic correctness before the event's explicit review release. The new `202611060001` migration withholds these from attempt reads/submission responses, history and overview analytics. A waiting result view replaces misleading immediate feedback. Ordinary practice retains immediate feedback. Late/offline submission timestamps and tie-break elapsed time are capped at the server deadline.

All 18 source migrations apply in isolated PostgreSQL 17. The existing database suites plus the dedicated release suite pass; running that suite against the original attempt reader fails at the pending-submission assertion, confirming it detects the regression. Two fictional students with the same duration tie even when one never submits before administrator release. The suite rolls back all fixtures. No hosted migration or real bank was changed.

20 unit tests, production build and preview/QA exclusion pass. Manual axe/reflow checks on the shared pending-result component at 390px light/dark and 1440px dark find no violations or overflow. The known decorative mobile-menu glyph produces one contrast incomplete result and is visibly legible; desktop has no incomplete checks. The local fictional preview is excluded from production. Browser CI remains required before merge. Parent evidence: `output/visual-audit/dmocks-pending-release-axe.json`, `dmocks-pending-release-desktop.png`, and `dmocks-hosted-google-verified.png`.
