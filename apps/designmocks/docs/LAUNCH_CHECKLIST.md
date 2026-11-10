# DMocks release checklist

[PRODUCT_EXECUTION_PLAN.md](PRODUCT_EXECUTION_PLAN.md) is authoritative. The informational site and free sample have their own release path. Controlled Razorpay Test integration and student and administrator staging continue in parallel.

## Public non-payment release

- [x] Verify the signed-out landing page and free sample on desktop and mobile. Sample completion, result reload and all five explanations passed with zero provider requests.
- [x] Save the candidate as Site version 6. The upload matched all 17 files in the verified archive. The private save receipt is `.dmocks-local-evidence/site-public-release-2026-11-09/native-site-save-progress.json`.
- [x] Verify the saved version 6 archive and confirm the Site was owner-only before the public audience change.
- [x] Record the owner’s explicit “Publish version 6 publicly” decision and the successful native Sites deployment on 9 November 2026. Verify eight signed-out direct routes on dmocks.com on desktop and mobile (`/`, `/account`, `/plans`, `/contact`, `/privacy`, `/terms`, `/sample` and `/sample/result`). The private release receipt is `.dmocks-local-evidence/site-public-release-2026-11-09/public-release-proof.json`.
- [x] Verify visible draft labels on the public notices and confirm the static build keeps sign-in, account creation, real paper publication and checkout closed.

## Non-payment portal verification (separate from Site publication)

- [x] Verify real controlled Google sign-in, reload, refresh, sign-out and returning-account sign-in on the current local build.
- [x] Prepare the exact 57-question UCEED paper for private review on desktop and mobile.
- [ ] Verify the full student and staff workspace using the staging build, the complete migration set and approved exact origins. Enable the staging preview modules and keep checkout closed.
- [ ] Verify confirmed Google identity against the server tester allowlist while registration policy is `testers`, environment mode is `test`, sales are closed, and `can_enter_staging_portal()` allows access. Public registration has its own approval.
- [ ] Resolve the hosted target role and capture and restore the approved target's backup. The project dashboard returned Healthy and the CA and native clients passed local verification. The observed ledger has 25 of 76 migrations, including a pending staging admission migration `202611060128_private_staging_portal.sql`.
- [ ] After approved target recovery and matching migration/function promotion, rerun the exact-origin staging admission, protected-route, account isolation and server authorization checks. Keep the public informational Site independent of this work.

## Controlled Razorpay Test and paid MVP

Run checkout inside the approved, expiring Test window after the requirements below pass. Public account admission and Live sales stay closed until their own acceptance.

- [x] Independent DMocks identity/store/brand and active HTTPS domain; private Google callback/PKCE, reload/refresh, sign-out, returning account and cancellation acceptance exist.
- [x] Verify Razorpay Onboarding confirms approved KYC and account activation. Verify automatic capture in the Razorpay Test dashboard with a 12-minute capture window.
- [x] Public-site/free-sample source and local/CI verification exist. PR #98 is accepted on main with 294 selected zero-retry MVP desktop/mobile journeys.
- [x] Hide/mark deferred modules and remove unverified public catalogue/service promises; desktop/mobile and production override checks pass. Checkout has a separate, closed switch.
- [x] Record owner approval of empty-holds canonical material as adapted student recollections, preserving source labels. Verify all 2,085 referenced canonical figures against the local read-only source.
- [x] Rehearse the exact private UCEED Part A offering on a disposable backend with desktop and mobile. Verify its 57 figures, attempt isolation, offline answer recovery, fixed clock, scoring and immutable results. [Rehearsal evidence](VERIFICATION.md#exact-first-uceed-part-a-rehearsal--9-november-2026)
- [x] Record owner approval of the exact 57 questions, figures and answer key for UCEED Part A Practice Mock 01 (120 minutes, 200 points) for the first paid offering after hosted Test acceptance. The private receipt is `.dmocks-local-evidence/first-uceed-paper-2026-11-08/presentation-audit/owner-first-paper-approval.json`.
- [ ] Repeat the offering's attempt, isolation, recovery and result checks on the approved hosted Test target with the admitted Google tester. Label the offering Part A.
- [x] Server-created order, fixed INR amount, signed captured-payment webhook, duplicate-safe fulfilment and server-only entitlement foundations are implemented/tested locally.
- [ ] Finish and verify refund/revocation basics, duplicate-purchase prevention and cross-account/order/amount/currency failures on the final MVP schema.
  PR #99 source/strict PR/main acceptance passes 300 units, 296 browser journeys, 72 migrations/40 database suites, signed fictional Edge events and actual desktop/mobile SDK checks. Full refunds revoke only their order's pass; partial/duplicate purchases require review. Real provider acceptance/final policy remains required before checking the launch gate. See REFUND_RECONCILIATION.md.
- [x] Deliver current-account checkout: PR #100 exact-head PR/main acceptance passes 313 units, 342 zero-retry browser journeys and actual SDK terms/pass checks. Order/window simulation is not real merchant acceptance. See CHECKOUT_ACCEPTANCE.md.
- [x] Verify payment readiness on main `022ebfcdafed2f6ec763c13c8da0266a611168ca` with 32 payment unit tests, 53 isolated database suites across 76 migrations and 56 simulated desktop and mobile checkout journeys with zero retries or skips. Merchant Test configuration and real provider acceptance remain open.
- [ ] Apply the reviewed 48-signature companion MVP deployment profile last on the approved target. Verify the current commit, profile hash, migration ledger and first-attempt CI before rollout. [MVP deployment](MVP_DEPLOYMENT.md)
- [x] Verify encrypted recovery locally for both the current MVP profile and the historical 25-version model. Restore the historical archive before applying the 49 pending migrations and the companion profile in isolation. [Private database and file recovery](RECOVERY.md)
- [ ] Validate recovery for the approved target with a fresh ledger, separate key custody, an offsite copy, recovery objectives and operator scheduling.
- [ ] Configure an expiring controlled Test window only after final content/policy decisions and verified Google tester allowlisting. Keep provider acceptance false until the real journey succeeds, public registration/sales closed and mode Test. Close the window explicitly before Live promotion.
- [ ] Replace/deactivate the previously exposed Razorpay Test pair, enter fresh server secrets privately and configure the correct signed webhook. Never place secrets in Vite, Git, logs or chat.
- [ ] Verify configured checkout CORS, anonymous rejection and unsigned webhook rejection on the approved target using the read-only commerce probe. Then verify actual Test capture, delivery and refund separately.
- [ ] Approve and publish final operator, support and contact, privacy, purchase, refund and cancellation, and tax and invoice details. Review retention and deletion handling.
- [ ] Implement and verify parent or legal guardian consent before creating under-18 student accounts. Verify approved and denied admissions on the controlled staging target before enabling this path.
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

- dmocks.com serves public Site version 6 with the informational pages and original free sample. The release involved only Site deployment and audience changes.
- Hosted backend promotion, final notices, first-paper release, public signup, real Test acceptance and Live sales each have separate gates. Model calls remain disabled.
- The staging-target question is already pending; avoid duplicate requests.
- Never treat human question review as content-rights approval, draft policies as final policies, local fixture payments as a real provider journey, or source migrations as applied hosted migrations.
