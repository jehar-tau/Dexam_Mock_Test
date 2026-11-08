# DMocks paid MVP execution plan

Owner scope freeze: **8 November 2026**. This plan replaces the full-portal launch scope and the earlier deferral of payment work. Continue only work needed for the first safe paid customer journey. Do not add another portal slice to improve the completion percentage.

## Launch Now

1. The public DMocks site and original free five-question sample. Describe only released offerings; mark unsupported exam/programme routes coming later.
2. Controlled Google authentication, an independent DMocks account, minimal necessary account details, sign-out and account isolation. Public admission stays closed until the final notices and provider checks are accepted.
3. The **smallest explicitly approved paid assessment catalogue**. Begin with one complete, independently usable objective offering if its exact source rights, question types, section count, marking, clock, images and result/reconnect lifecycle are accepted. A Part A offering must be named Part A; it must not be sold as a complete two-part exam. UCEED/CEED objective runtime work supplies candidates; no first paper has been selected or rights-approved for sale by this scope freeze.
4. **₹1,193 INR for 12 calendar months, one payment, no automatic renewal**, covering the explicitly released catalogue. Do not promise a future catalogue size, all four exams, rankings, lessons, community or teacher/AI services.
5. Server-created Razorpay orders and a signed, duplicate-safe webhook that alone grants the entitlement. Preserve exact price/currency/order/account binding, duplicate-purchase protection and atomic entitlement writes. Add and verify refund/revocation basics before sale.
6. Owner-approved operator, privacy, terms, refund/cancellation, support/contact, tax/invoice and younger-student information. Draft notices are not final policies. Publish clear coverage and support expectations before purchase.
7. Minimal production error/payment alerting, actionable support, database/private-media backup and a restore check. Provision only the resources required for the initial 100–200 users and fewer than 100 concurrent sessions.
8. Promote the approved provider/source target, verify the real test-mode journey on **dmocks.com**, then obtain the explicit production switch decision. Keep registration, catalogue publication and payments as separate gates.

## Post-launch / disabled

- NID, NIFT and unsupported programme variants; any unaccepted section or full-exam claim.
- All India events, rankings, top-ten publication and associated drawing review.
- Community, Learn/theory import and topic-practice products beyond the first offering.
- PDF/photo/AI drafting and intake pipelines; model inference and AI drawing advice.
- Advanced teacher/drawing operations unless the chosen first paper strictly needs them. Prefer an objective first offering to avoid adding that dependency.
- Malware/scanner, resumable-transfer and advanced attachment work; the large 150-session capacity exercise; further analytics and portal refinement.

Already implemented code can remain in the repository behind disabled routes. Explicit nonproduction regression previews may exercise it; production must not expose or advertise it. The older detailed implementation plan is preserved in [POST_LAUNCH_ROADMAP.md](POST_LAUNCH_ROADMAP.md) as a backlog, not an execution queue.

## Current evidence and remaining estimate

Accepted source is PR **#97**, merge `02e79d74886355caf1a05157e88f2a9e83697371`. Its exact-head PR/main checks pass **283 JavaScript tests, four Python fixtures, 648 desktop/mobile journeys with no skips/retries, eleven server-function types and all 71 migrations/37 database suites**. The current hosted private Site is an older controlled-login publication; these source checks do not prove hosted promotion or a paid customer journey.

The active-exam branch is checkpointed at `d582a80` before the freeze. Broader drawing-inspector work is not merged or a launch dependency. Reuse only the account-bound objective attempt, strict answer receipts and outage recovery needed by the first paid offering; verify that subset in the MVP branch. Preserve failed probes and incomplete provider evidence without calling them acceptance.

**Planning estimate: about 60% of frozen-MVP launch readiness remains.** This measures accepted launch outcomes, including content, policies, payments and operations; most application foundations already exist. The following evidence-weighted estimate is deliberately conservative and is not a count of source files or tests.

| Frozen workstream | Weight | Accepted estimate | Remaining evidence |
| --- | ---: | ---: | --- |
| Public site and free sample | 10 | 8 | Finish scope/copy checks and public promotion |
| Controlled identity/account basics | 10 | 7 | Final notices, admission and approved hosted check |
| One exact rights-cleared paid offering | 20 | 7 | Select paper, approve rights/manifest, accept lifecycle/images/results |
| Secure purchase and entitlement | 20 | 10 | Fresh test configuration, real order/webhook journey, refund/revocation |
| Final policies/operator/invoice/support details | 15 | 2 | Owner decisions and final publication |
| Provider promotion and deployment | 15 | 5 | Approved target, backup, migration/function promotion and acceptance |
| Minimal monitoring/backups | 5 | 2 | Connected alerts and tested operational recovery |
| Final customer journey/release decision | 5 | 0 | Real test-mode journey on dmocks.com and explicit go-live |
| **Total** | **100** | **41** | **59 remaining; round to approximately 60%** |

The current rights-label audit at accepted main finds 2,582 eligible empty-holds records: 2,244 official-unlicensed, 48 dexam-original and 290 owner-provided. All non-official-labelled records are NID descriptive questions; no eligible objective bank record has an original/owner-provided label. The first objective paper therefore needs an explicit rights/reference decision or new cleared material. Do not silently sell an official-unlicensed record or reopen NID/drawing scope to avoid that review. The private metadata-only packet is recorded in VERIFICATION.md.

No policy, content-rights, merchant or production switch is treated as approved merely because code exists. Re-estimate only when the evidence changes. Deferred modules contribute neither progress nor remaining work to this estimate.

## Critical path and engineering order

1. **Freeze delivery claims and entry points.** Merge already finished, clean work only after checks. Keep unfinished nonessential work checkpointed; hide deferred modules and remove their public promises. Use the existing released-paper flow for the initial catalogue rather than completing another exam generator.
2. **Prepare one reviewable offering.** Build a private manifest with stable canonical keys/hashes from `main:server/data/exports/dexam-bank-export.json`, using only an explicitly present empty `holds` array. Record the exact rights decision, title/part, counts, marking, time and image inventory. Do not release a partial or unapproved paper.
3. **Finish critical assessment and commerce gaps.** Verify own-account reads/writes, fixed deadlines, device answer recovery and immutable results. Complete refund/revocation and required release controls. Preserve signed webhook replay protection, amount/currency binding and duplicate-purchase prevention.
4. **Prepare merchant/customer notices.** Make the coverage, operator/contact, refund/cancellation and invoice treatment concrete for owner approval. Payment work is authorized again; fresh credentials are entered privately when the configuration is ready. The previously exposed Test pair must be replaced/deactivated, never reused or repeated.
5. **Promote the approved environment.** Inspect a fresh hosted ledger before any migration; the historical comparison of 25 hosted versions against 71 source migrations is not current hosted-state evidence. Back up database and private media, validate recovery, then deploy the matching source/functions only to the approved target. The earlier staging-target question remains pending; do not repeat it or infer approval.
6. **Accept one real test-mode journey.** Google sign-in → the exact offer and notices → server-created ₹1,193 order → Razorpay test capture → signed webhook → one 12-month entitlement → first paper → reconnect/submit → result/review → receipt/support. Also exercise duplicate delivery/purchase denial and refund/revocation with the provider's supported test mechanisms. Fabricated SDK fixtures do not satisfy this gate.
7. **Owner go-live decision.** Confirm the paper/rights, policies/operator details, merchant readiness, monitoring/restore and real journey; switch public registration/catalogue/sales in the approved sequence. No live charge or production switch without that decision.

## Owner reviews/actions still required

- Select and approve the exact first paid paper/part and its content-rights evidence. Prior human review does not by itself clear sale/republication rights.
- Approve operator/contact/support details, refund and cancellation handling, tax/invoice treatment, privacy/retention and younger-student policy.
- Enter replacement Razorpay Test credentials and webhook secret privately; complete OTP/KYC/provider actions if the merchant requires them.
- Resolve the already pending deployment-target decision and approve the final production-impact switch after the concrete acceptance packet is ready.

Continue engineering that does not depend on these decisions. Do not invent a refund policy, sell unapproved content, purchase hosting or broaden the MVP to bypass a missing approval.
