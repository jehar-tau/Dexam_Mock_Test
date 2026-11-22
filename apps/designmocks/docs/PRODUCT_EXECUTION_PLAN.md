# DMocks release execution plan

**Current deployment decision (23 November 2026):** After a PR passes its
exact-head checks, merge it, verify main CI, and publish the verified frontend
directly to dmocks.com. Do not require an owner-only staging promotion or build
out separate dev/staging/production environments before completing the
application. This supersedes the earlier staging-first frontend steps below;
paper release, registration, backend changes and sales retain their own gates.
See [Direct public release](DIRECT_PUBLIC_RELEASE.md).

Site version 10 is live from main `a8f8b9ccc4ec5a76816e1a94418c0a3faa6cd84a`.
An allowlisted Google session loaded the protected student pages on dmocks.com;
the catalogue shows year-wise sets in preparation and no All India event is
scheduled. Public signup and checkout remain closed. The next portal work
should build on this live controlled-test baseline and publish accepted code
through the direct release workflow.

## Current scope and release status (21 November 2026)

### Papers added to the student launch scope (22 November 2026)

The owner added a **Papers** section to the launch, alongside Overview, exam-wise mocks, All India mocks and topic practice. It must list year-wise source sets for UCEED, CEED, NIFT and NID from `server/data/exports/dexam-bank-export.json`, using only records with an empty `holds` array. Keep sample papers and multiple papers in the same year distinct. The owner chose free year-wise Papers; a student signs in to save a timed attempt but does not need a paid pass. The year-wise catalogue must not label a bank group as a released, playable paper until its content, image bytes, answers, marking and timer have been checked and a fixed attempt works end to end. The first catalogue UI is sourced from the bank and clearly marks unreleased sets as in preparation; the playable-paper path, results and explanations remain required before launch. Keep year-wise Papers separate from scrambled exam-wise mocks. The owner cites [Roughworks Papers](https://roughworks.in/papers) as an interaction reference, not as source content.

### Lean student-portal launch order

1. Merge the reviewed ingestion integration and keep the hold-free bank export current. A bank count is not a published-paper count.
2. Continue hosted acceptance of the controlled student portal on dmocks.com: fresh Google callback, profile, Overview, exam-wise mocks, topic practice, All India mocks, attempts, reconnect, results and authenticated media with approved accounts.
3. Complete Papers: prepare exact source-year groups with the correct historical marking scheme, verified media, reviewed answers and explanations; publish only those which pass a fixed timed attempt and answer-by-answer result. Use the private [year-paper preparation and release flow](YEAR_PAPER_RELEASE.md). The first catalogue UI is not the completion of this step.
4. Integrate Claude's Learn and Community changes after the owner pushes them, then test their student routes on dmocks.com behind controlled admission. Claude retains ownership of those modules and question-paper ingestion/corrections.
5. Complete a controlled Razorpay Test purchase, webhook, entitlement and refund journey. Publish final notices and open public admission, catalogue and sales through their separate release decisions.

The admin portal, teacher marking and AI drawing evaluation are outside this first website release. Keep their existing code isolated; they remain part of the longer roadmap. Public registration and sales stay closed while staging acceptance is underway.

- The owner retains the full student website roadmap.
- Claude owns Learn, Community, and question-paper ingestion and corrections.
- Codex owns the rest of the student-facing website, including test mode and identity and payment integration.
- The admin portal, teacher paper review, and AI drawing evaluation are deferred.

The encrypted staging backup and isolated restore passed privately, covering 2,085 storage objects. Hosted migrations 167–169 are still pending. Public signup and sales remain closed.

## Active ownership and execution order (14 November 2026)

The owner updated the division of work on 16 November 2026. **Claude develops Learn and Community. The owner pushes those changes. Codex integrates and verifies the owner-pushed changes and develops the rest of DMocks.** The existing Community code on main is the baseline for Claude. Use separate feature worktrees to preserve Claude's in-progress changes. The wider requirements in POST_LAUNCH_ROADMAP.md remain part of the goal; the paid MVP is the first release milestone, not completion of the whole application. Build and test unreleased modules privately without exposing them through the paid MVP profile.

Source inspected at resumption was `4c1dc6ae4d4d8e41a25926a6d382b127dd543b05` (PR #154). Its GitHub Actions run `43269084239` passed. This proves source CI, not hosted deployment or merchant acceptance. Read HANDOFF.md's owner decisions before requesting any approval.

Next execution order:

1. Reconcile the already-deployed staging state and recovery evidence before further rollout. The selected staging project is `tiodqzvvujxvxssvjdis`; a separate production project is required before go-live. A read-only dashboard inspection on 14 November lists all 90 source migration version IDs through `202611100166`. Do not reapply the historical 65-migration backlog. Migration bodies, profile, deployed function hashes and recovery evidence still need comparison. Backup/restore and dry run are authorized; additional hosted changes remain separately gated.
2. Reconcile and verify admitted Google identity, student/staff authorization, the exact approved UCEED paper, private media, reconnect and results against staging. The dashboard lists five deployed functions: attempt-media, create-order, drawing-media, drawing-review-media and payment-webhook. Anonymous rejection probes pass for the configured local origin `http://127.0.0.1:4190`, while an attempt-media request from `https://dmocks.com` returns 403 Origin not allowed. This is local-origin setup evidence, not hosted frontend or merchant acceptance. Use the existing private configuration in `~/dmocks-local/apps/designmocks/.env.local`; never copy its contents into Git or chat.
3. Complete the real Razorpay Test capture/webhook/refund journey with rotated Test secrets and the approved expiring window. Final notice publication, alert delivery and the separate public admission/catalogue/Live switches remain release work.
4. Continue the remaining portal, bank administration and assessment requirements from the full roadmap in isolated feature branches. Integrate and verify Learn and Community after the owner pushes them. Add feature-relevant unit, authorization and desktop/mobile coverage and merge after local checks and GitHub CI pass.

Approved decisions must not be asked again: adults only (18+); the approved eligibility sentence in HANDOFF.md; full change-of-mind refunds within seven calendar days before the first paid mock starts, initiated within two business days of approval; no GST, full listed price, Razorpay receipt as invoice until registration. Duplicate charges and service faults are handled separately. Approval of wording does not establish publication or hosted acceptance. The alert receiver and the owner's NID practice blueprint remain outstanding.

The sections below retain dated release evidence. Historical migration counts, compiler counts, estimates and candidate descriptions are not current rollout evidence. Use the current migration directory, fresh target ledger and source checks for deployment; use HANDOFF.md for subsequent accepted slices and owner decisions.

## Historical release checkpoint (9 November 2026)

On 9 November the owner approved public access to **Site version 6**, and the native Sites deployment succeeded. The public informational site and original five-question sample now serve at **dmocks.com**. The version 6 archive matched the build from accepted source `e457196519a5d87cf1bc63b5e72e1793db6dde68`. The [release checklist](LAUNCH_CHECKLIST.md#public-non-payment-release) records the eight signed-out desktop and mobile routes.

The public checks passed sample submission, result reload and all five explanations with zero provider requests. The policy notices visibly carry draft labels. Sign-in, account creation and checkout are disabled. The owner approved the exact first paper for the paid offering after hosted Test acceptance. Hosted backend promotion, merchant setup, hosted Test acceptance and final policy approval are separate release gates.

The owner resumed Razorpay integration. Razorpay Onboarding confirmed approved KYC and account activation. The Test-mode dashboard showed automatic capture with a 12-minute window. Controlled checkout still requires fresh Test credentials, a signed webhook on the approved backend and a real provider journey. Live sales remain closed. Student and administrator portal work continues through controlled staging.

The current source passed a real controlled Google callback, reload, refresh, local sign-out and returning-account sign-in. The private UCEED Part A review also shows the exact 57 questions and figures. Keep paper review separate from release. Full nonpayment staging uses the explicit staging build with the preview modules enabled and checkout closed. Use the full migration set on the approved private staging backend. The paid MVP companion restricts APIs used by Learn, Community, advanced practice and drawing review.

Before hosted staging, resolve the target role, capture and restore the approved target's backup, and promote the matching migrations and functions. The existing dashboard returned Healthy and the CA and PostgreSQL 17.11 clients passed local recovery verification. The last observed ledger has 25 of 76 migrations. Hosted staging requires migration `202611060128`, exact approved frontend and backend origins, and the server admission check for a confirmed allowlisted Google tester. Keep registration policy at `testers`, environment mode at `test`, and sales closed during that verification.

Public account admission has its own privacy, terms, younger-student and provider gates. The signup hook starts closed and admits Google accounts according to the server-owned policy. Keep the private Test checkout, public admission and Live sales on separate controls.

Owner rights clarification (8 November): Design Exam Academy confirms ownership or permission for all 2,582 hold-free canonical questions as original/adapted practice material, not verbatim protected official papers. Legacy labels remain as source history and no longer establish the collection-level rights conclusion. The PR #104 baseline supports 1,502 objective records; strict exact-literal NAT alternatives add seven (five UCEED/two CEED), making current compiler capability 1,509 objective records, 361 other supported conversions and 712 conversion/context blockers. The initial fixed offering remains unchanged. None is automatically hosted-ready or published. Exact-version approval still requires active, hold-free records and verified required media. Never mass-update flags directly.

The **8 November 2026** scope defines the first paid offering. The wider product plan remains in the execution backlog. Follow the [controlled Test deployment sequence](MVP_DEPLOYMENT.md) alongside the nonpayment staging and release checks above.

## Paid MVP requirements

1. The public DMocks site and original free five-question sample. Describe only released offerings; mark unsupported exam/programme routes coming later.
2. Controlled Google authentication, an independent DMocks account, minimal necessary account details, sign-out and account isolation. Registration is for adults (18 or older) only, by owner decision; the terms and privacy notice must state this. Public admission stays closed until the final notices and provider checks are accepted.
3. The **smallest explicitly approved paid assessment catalogue**. Begin with one complete, independently usable objective offering if its exact source rights, question types, section count, marking, clock, images and result/reconnect lifecycle are accepted. The owner approved the exact questions, figures and answer key for UCEED Part A Practice Mock 01 as the first paid offering after hosted Test acceptance. The underlying empty-holds bank remains student-recalled, adapted practice material with source labels preserved.
4. **₹1,193 INR for 12 calendar months, one payment, no automatic renewal**, covering the explicitly released catalogue. Do not promise a future catalogue size, all four exams, rankings, lessons, community or teacher/AI services.
5. Server-created Razorpay orders and a signed, duplicate-safe webhook that alone grants the entitlement. Preserve exact price/currency/order/account binding, duplicate-purchase protection and atomic entitlement writes. Add and verify refund/revocation basics before sale.
6. Owner-approved operator, privacy, terms, refund/cancellation, support/contact, tax/invoice and younger-student information. Draft notices are not final policies. Publish clear coverage and support expectations before purchase.
7. Minimal production error/payment alerting, actionable support, database/private-media backup and a restore check. Provision only the resources required for the initial 100–200 users and fewer than 100 concurrent sessions.
8. Promote the approved provider/source target, verify the real test-mode journey on **dmocks.com**, then obtain the explicit production switch decision. Keep registration, catalogue publication and payments as separate gates.

## Additional bank-usability instruction

The owner now explicitly resumes work on the original 1,080 records outside the documented objective boundary: preserve the admin student-view preview/checklist, verify NIFT materialization, provide per-record conversion diagnostics/correction queues and add verified NID blueprint/rubric support. This is an exception to the earlier conversion/NID/NIFT engineering deferral. Student publication remains independently gated by exact-version approval, correct answers/context and verified media. The private preview/checklist and diagnostics are accepted; see [the conversion evidence](BANK_CONVERSION.md) for seven newly supported objective records, 361 other supported conversions and 712 remaining blockers. Other deferred products remain disabled. Do not claim all 1,080 are ready or broaden the first paid catalogue automatically.

## Post-launch / disabled

- NID, NIFT and unsupported programme variants; any unaccepted section or full-exam claim.
- All India events, rankings, top-ten publication and associated drawing review.
- Community, Learn/theory import and topic-practice products beyond the first offering.
- PDF/photo/AI drafting and intake pipelines; model inference and AI drawing advice.
- Advanced teacher/drawing operations unless the chosen first paper strictly needs them. Prefer an objective first offering to avoid adding that dependency.
- Malware/scanner, resumable-transfer and advanced attachment work; the large 150-session capacity exercise; further analytics and portal refinement.

Already implemented code can remain in the repository behind disabled routes. Explicit nonproduction regression previews may exercise it; production must not expose or advertise it. The detailed implementation requirements are preserved in [POST_LAUNCH_ROADMAP.md](POST_LAUNCH_ROADMAP.md). The resumed full goal authorizes independent implementation, while this first paid release keeps those products disabled until their own acceptance.

## Current evidence and remaining estimate

The bank conversion checkpoint was PR **#108**, merge `28a8c854bc66d3bc73af91e37b33fccf1401ba83`, including the private authored NID editor through corrective #107. Exact PR/main workflows `42522831667` / `42524334979` pass **370 JavaScript tests, four Python fixtures, 424 selected desktop/mobile journeys without retries, eleven types, build/isolation, audit zero and 74 migrations/profile/47 database suites**. The original #106 main retry remains rejected; #108's superseded cancelled feature run is also preserved. Actual local provider fixtures are fictional and do not prove the real merchant/OAuth journey or hosted promotion.
Accepted #102 also covers lost provider/database replies, twelve concurrent orders, immutable receipt binding, service health/sweeps, desktop/mobile explicit recovery, signed fictional local Edge capture and the real admin pending-question counter. The merchant transport/widget and Google metadata are fictional. Read CHECKOUT_RECOVERY.md and MVP_DEPLOYMENT.md. PRs #103/#104 accept private bank placement/checklists, exact correction diagnostics and actual local NIFT materialization proof. Accepted #105 adds seven exact numeric-alternative conversions, with six browser precision cases and actual API/SDK scoring; every previously supported payload and the immutable first offering remain unchanged.

Accepted108 binds an inspected exact canonical NID question to a current reviewed authored section, then separately materializes a server-verified practice runtime. Changes invalidate dependent conversion/approval while frozen keys preserve the earlier rubric/context. The 47-signature companion profile (21 student/account and26 staff) includes the two new staff APIs; two conversion APIs are service-only. The permanent 15-case authenticated lock regression rejects role revocation committed while writes/replays wait. Actual fictional Auth/PostgREST/private Storage/Edge/SDK/operator desktop/mobile acceptance and canonical/first-paper parity pass. No real NID binding/approval/publication is automatic and the first UCEED offering is unchanged. See BANK_CONVERSION.md.

The next source candidate adds encrypted read-only database/private-byte recovery capture and verification. Local389-unit/424-journey checks and all74 migrations/profile/48 DB suites pass. The full isolated Supabase rehearsal restores110 recorded relations plus actual private file bytes/owner/metadata, with desktop/mobile SDK/portal paid/assessment/support checks while the source is offline. All fixtures are original and fictional. This does not clear the approved-target, offsite retention/scheduling, alert delivery or hosted recovery gates. See RECOVERY.md. Exact-head local/PR/main acceptance remains required for this candidate.
Use the operator, address, support and GST inputs supplied in the owner's certificate and inquiry@designexam.com. The source notices identify DEXAM, the proprietor and the business address. Personal contacts, PAN and banking data are held privately. The final notices (including the 18+ eligibility statement) and the refund wording still need review. The private first-paper rendering is complete.

The owner has resolved bank use: use all and only records whose `holds` is an explicitly empty list. The owner describes them as adapted student recollections. Preserve raw provenance/licence labels and record the owner's use/provenance statement; do not rewrite the source or claim independent verification. This resolves the earlier question about the 2,244 official-unlicensed / 48 dexam-original / 290 owner-provided labels. Do not repeat it. It does not itself publish a paper or enable payments.

The read-only media source is `~/Documents/Default Project/Dexam_Mock_Test/server/data/media/`. All **2,085 canonical assets referenced by eligible records** pass hashes, dimensions and bytes. The owner-approved private **UCEED Part A - Practice Mock 01** contains **57 questions, 57 verified figures, 120 minutes and 200 points**. The private manifest/rendering packet remains outside tracked/public source and every one of its runtime payloads is unchanged by numeric alternatives. Current compiler/local-media support is 835 objective UCEED records. The first offering requires hosted Test acceptance before the paid release.

Payment readiness on main `022ebfcdafed2f6ec763c13c8da0266a611168ca` passed 32 payment unit tests, 53 isolated database suites across 76 migrations and 56 simulated desktop and mobile checkout journeys with zero retries or skips. Merchant Test configuration and the real provider journey remain open.

**At the 8 November planning checkpoint, the estimate put paid MVP readiness at approximately 50%.** The table records the work and estimates as of that checkpoint.

| Frozen workstream | Weight | Accepted estimate | Evidence pending on 8 November |
| --- | ---: | ---: | --- |
| Public site and free sample | 10 | 8 | Final coverage/copy and public promotion |
| Controlled identity/account basics | 10 | 7 | Final notices, admission and approved hosted check |
| One exact owner-approved paid offering | 20 | 11 | Final private rendering/manifest, real target media and explicit release |
| Secure purchase and entitlement | 20 | 15 | Fresh merchant Test setup, real order/webhook/refund journey and final handling |
| Final policies/operator/invoice/support details | 15 | 2 | Owner decisions and publication |
| Provider promotion and deployment | 15 | 5 | Approved target, current inventory, matching rollout/acceptance |
| Minimal monitoring/backups | 5 | 2 | Connected alerts and restore proof |
| Final customer journey/release decision | 5 | 0 | Real Test journey on dmocks.com and explicit go-live |
| **Total** | **100** | **50** | **50 remaining** |

The separate optional drawing/inspector checkpoint at `d582a80` remains unmerged and incomplete. It is outside the first objective offering.

## Critical path and engineering order

1. **Freeze delivery claims and entry points.** Merge already finished, clean work only after checks. Keep unfinished nonessential work checkpointed; hide deferred modules and remove their public promises. Use the existing released-paper flow for the initial catalogue rather than completing another exam generator.
2. **Prepare one reviewable offering.** Build a private manifest with stable canonical keys/hashes from `main:server/data/exports/dexam-bank-export.json`, using only an explicitly present empty `holds` array. Record the existing owner bank-use/provenance statement, title/part, counts, marking, time and verified image inventory. Do not release a partial or unapproved paper.
3. **Finish critical assessment and commerce gaps.** Verify own-account reads/writes, fixed deadlines, device answer recovery and immutable results. Complete refund/revocation and required release controls. Preserve signed webhook replay protection, amount/currency binding and duplicate-purchase prevention.
4. **Prepare merchant/customer notices.** Make the coverage, operator/contact, refund/cancellation and invoice treatment concrete for owner approval. Payment work is authorized again; fresh credentials are entered privately when the configuration is ready. The previously exposed Test pair must be replaced/deactivated, never reused or repeated.
5. **Promote the approved environment.** Inspect a fresh hosted ledger before any migration; the historical comparison of 25 hosted versions against 74 candidate source migrations is not current hosted-state evidence. Back up database and private media, validate recovery, then deploy the matching source/functions only to the approved target. The earlier staging-target question remains pending; do not repeat it or infer approval.
6. **Accept one real test-mode journey.** Google sign-in → the exact offer and notices → server-created ₹1,193 order → Razorpay test capture → signed webhook → one 12-month entitlement → first paper → reconnect/submit → result/review → receipt/support. Also exercise duplicate delivery/purchase denial and refund/revocation with the provider's supported test mechanisms. Fabricated SDK fixtures do not satisfy this gate.
7. **Owner go-live decision.** Confirm the paper/rights, policies/operator details, merchant readiness, monitoring/restore and real journey; switch public registration/catalogue/sales in the approved sequence. No live charge or production switch without that decision.

## Owner reviews/actions still required

- Review the final customer notices, refund and cancellation terms, tax and invoice treatment, and privacy and retention terms. Confirm the 18+ eligibility statement in the notices. The operator, address, support and GST facts are already supplied.
- Replace the exposed Razorpay Test pair and enter the new pair and Test webhook secret privately on the approved backend. Handle further provider verification or OTP if the dashboard requests it.
- Resolve the already pending deployment-target decision and approve the final production-impact switch after the concrete acceptance packet is ready.

Continue engineering that does not depend on these decisions. Do not invent a refund policy, sell unapproved content, purchase hosting or broaden the MVP to bypass a missing approval.
