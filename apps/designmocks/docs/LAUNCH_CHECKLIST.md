# DMocks release checklist

[PRODUCT_EXECUTION_PLAN.md](PRODUCT_EXECUTION_PLAN.md) is authoritative. The owner moved payments to a later phase; the immediate tranche is the public informational Site and original free sample, with account/auth, paper publication, checkout and hosted backend changes closed.

## Public non-payment release

- [x] Prepare and independently verify the signed-out informational/free-sample static candidate for desktop and mobile; sample completion, reload and all five explanations pass with zero provider requests. Archive bytes match the Site checkout build; see `.dmocks-local-evidence/site-public-release-2026-11-09/publication-candidate.json`.
- [x] Save the archive-backed candidate as Site version 6, matching all 17 uploaded files to the tested archive; version 6 is not deployed and the live audience remains owner-only. Receipt: `.dmocks-local-evidence/site-public-release-2026-11-09/native-site-save-progress.json`.
- [ ] Recheck live Site source and version 5 owner-only audience; verify version 6 against the native archive receipt before deployment.
- [ ] Obtain a separate public-audience decision before deploying the saved Site version. If authorized, verify signed-out direct routes on dmocks.com. Restore owner-only access if checks fail. No public-audience authorization has been given.
- [x] Keep account creation, paid-paper publication and checkout closed in the saved static build. The informational site and free sample do not require payment acceptance or a backend migration.

## Non-payment portal verification (separate from Site publication)

- [ ] To exercise the full student workspace, use an explicit staging build and approved exact frontend/backend origin. `VITE_TEST_LOGIN_ENABLED` alone provides a controlled sign-in screen but leaves workspace routes closed.
- [ ] Verify confirmed Google identity against the server tester allowlist while registration policy is `testers`, environment mode is `test`, sales are disabled, and `can_enter_staging_portal()` allows access. Keep public registration closed; the signup hook defaults to closed and public admission requires its own approval.
- [ ] Resolve the hosted target-role mismatch and approve the exact target. The project dashboard returned Healthy, and CA/native backup tooling passed local verification, but no real hosted backup has been captured. The observed ledger has 25/76 migrations; 51 remain, including required staging admission migration `202611060128_private_staging_portal.sql`.
- [ ] After approved target recovery and matching migration/function promotion, rerun the exact-origin staging admission, protected-route, account isolation and server authorization checks. Keep the public informational Site independent of this work.

## Later owner-led paid MVP

Payment and sales remain closed until that later phase's acceptance. Public account admission is a separate gate; the controlled tester policy for private non-payment portal verification remains as described above. Historical full-portal completion does not substitute for those gates.

- [x] Independent DMocks identity/store/brand and active HTTPS domain; private Google callback/PKCE, reload/refresh, sign-out, returning account and cancellation acceptance exist.
- [x] Public-site/free-sample source and local/CI verification exist. PR #98 is accepted on main with 294 selected zero-retry MVP desktop/mobile journeys.
- [x] Hide/mark deferred modules and remove unverified public catalogue/service promises; desktop/mobile and production override checks pass. Checkout has a separate, closed switch.
- [x] Record owner approval of empty-holds canonical material as adapted student recollections, preserving source labels. Verify all 2,085 referenced canonical figures against the local read-only source.
- [ ] Complete final presentation/release acceptance of the private 57-question/57-image UCEED Part A candidate (120 minutes, 200 points); do not publish it or replace source provenance automatically.
- [ ] Accept that offering's own-account attempt/read/write isolation, fixed timer, answer/reconnect recovery, immutable submission and useful released result. Label a Part A offering accurately.
- [x] Server-created order, fixed INR amount, signed captured-payment webhook, duplicate-safe fulfilment and server-only entitlement foundations are implemented/tested locally.
- [ ] Finish and verify refund/revocation basics, duplicate-purchase prevention and cross-account/order/amount/currency failures on the final MVP schema.
  PR #99 source/strict PR/main acceptance passes 300 units, 296 browser journeys, 72 migrations/40 database suites, signed fictional Edge events and actual desktop/mobile SDK checks. Full refunds revoke only their order's pass; partial/duplicate purchases require review. Real provider acceptance/final policy remains required before checking the launch gate. See REFUND_RECONCILIATION.md.
- [x] Deliver current-account checkout: PR #100 exact-head PR/main acceptance passes 313 units, 342 zero-retry browser journeys and actual SDK terms/pass checks. Order/window simulation is not real merchant acceptance. See CHECKOUT_ACCEPTANCE.md.
- [ ] Apply the reviewed 47-signature companion MVP deployment profile last on the approved target. Verify the current commit, profile hash, migration ledger and first-attempt CI before rollout. [MVP deployment](MVP_DEPLOYMENT.md)
- [x] Verify encrypted recovery locally for both the current MVP profile and the historical 25-version model. Restore the historical archive before applying the 49 pending migrations and the companion profile in isolation. [Private database and file recovery](RECOVERY.md)
- [ ] Validate recovery for the approved target with a fresh ledger, separate key custody, an offsite copy, recovery objectives and operator scheduling.
- [ ] Configure an expiring controlled Test window only after final content/policy decisions and verified Google tester allowlisting. Keep provider acceptance false until the real journey succeeds, public registration/sales closed and mode Test. Close the window explicitly before Live promotion.
- [ ] Replace/deactivate the previously exposed Razorpay Test pair, enter fresh server secrets privately and configure the correct signed webhook. Never place secrets in Vite, Git, logs or chat.
- [ ] Approve/publish final operator, support/contact, privacy, purchase terms, refund/cancellation and tax/invoice details; resolve younger-student policy and retention/deletion handling.
- [ ] Choose the approved provider/deployment target. Inspect the current hosted ledger; validate database plus private-media backup/restore and promote only matching tested source/functions.
- [ ] Connect the operations monitor and payment Edge error signals to the approved alert receiver. Verify delivery, support and incident actions. Keep initial capacity checks proportional to fewer than 100 concurrent users. [Operations runbook](OPERATIONS_RUNBOOK.md)
- [ ] Complete one real Razorpay test-mode customer journey on dmocks.com, including Google sign-in, purchase/webhook, one annual pass, the exact paper, reconnect, submission/result, receipt/support and refund/revocation acceptance.
- [ ] Record the explicit final go-live decision; enable public registration, the verified catalogue and sales through their separate switches. A client callback never grants access.

- [x] Extract supplied operator/proprietor/address and support email for source notices; exclude the private certificate, PAN, banking and personal contacts. Final policy gates remain separate.
- [x] Accept receipt-recovery/service-health/minimal-operations source through PR #102 and subsequent strict PR/main checks. Real hosted/provider acceptance remains separate. See CHECKOUT_RECOVERY.md.
- [x] Accept private bank placement/checklists and correction diagnostics through PRs #103/#104; local NIFT materialization is verified, with no real approvals/publication. Exact numeric alternatives are accepted through #105. The private NID editor is accepted through corrective #107; binding/conversion is accepted through #108 and recorded in BANK_CONVERSION.md.

## Post-launch — no launch blocker

NID/unsupported programmes; All India events/rankings/top-ten; Community; Learn/theory; extra topic-practice products; AI drafting/intake/inference; AI drawing advice; advanced drawing/teacher operations; scanner/resumable transfers; 150-session capacity work; further portal/analytics expansion. Keep these disabled unless the chosen first paper strictly requires one. Do not count this backlog in the remaining MVP percentage.

## Current boundaries

- dmocks.com remains owner-private on an older controlled-login publication until the public-audience step above is separately approved and verified. No hosted write or promotion is implied by source merges.
- Public signup, real content publication and checkout are closed. Model calls remain disabled.
- The staging-target question is already pending; avoid duplicate requests.
- Never treat human question review as content-rights approval, draft policies as final policies, local fixture payments as a real provider journey, or source migrations as applied hosted migrations.
