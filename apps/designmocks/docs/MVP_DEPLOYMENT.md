# Frozen paid MVP deployment and controlled Test acceptance

Owner rights clarification (8 November): Design Exam Academy confirms ownership or permission for all 2,582 hold-free canonical questions as original/adapted practice material, not verbatim protected official papers. Legacy labels remain as source history and no longer establish the collection-level rights conclusion. Only the documented 1,502 runtime-ready objective questions (830 UCEED/672 CEED), if active/hold-free with verified required media, may enter exact-version audited approval. The other 1,080 remain technically unavailable for this MVP. Never mass-update flags directly.

This is a reviewable rollout procedure, not a deployment approval. The hosted target decision is already pending. Public registration, real content publication, checkout, Live sales and merchant credentials remain closed/unconfigured by this source change.

## Exact source and server profile

The accepted parent is PR #101. The current candidate also accepts receipt recovery and corrects scheduled service health; read CHECKOUT_RECOVERY.md. This candidate has **72 historical migrations plus one explicit companion profile** at `supabase/launch/paid-mvp.sql`; the profile is not migration 73. Its SHA-256 is `b4829e1f1faefdaf6dd0592c07fe66c61ee9524327a31b12e909bc6fe021077f`. `npm run check` verifies the SQL permission block against `supabase/launch/paid-mvp-rpcs.json`. The database check applies the profile after historical suites and separately exercises its release and Test boundaries.

Before rollout, accept exact-head feature CI and matching-tree main CI with zero skipped/retried browser cases. Inspect a fresh inventory on the approved standalone DMocks target and preserve database/private-media backups with restore evidence. The historical 25 hosted migrations versus 72 source versions is not a current hosted inventory. Do not point disposable `tests/database/bootstrap.sql` at a hosted database.

With sales false, public registration closed or testers-only and any previous merchant Test window explicitly closed:

1. Apply the reviewed missing migrations to the approved target and deploy matching required functions (`create-order`, `payment-webhook`, `attempt-media`, and core account/support media where needed). Keep deferred model/intake/drawing products disabled.
2. Apply this companion profile **last**, in a single transaction. Run from `apps/designmocks` using an approved privately configured connection:

   ```sh
   psql "$DMOCKS_APPROVED_DATABASE_URL" --no-psqlrc --single-transaction --set ON_ERROR_STOP=1 --file supabase/launch/paid-mvp.sql
   ```

3. Verify `admin_launch_readiness()` through an authorized operator account. It must return `scope: paid-mvp-v1` and `apiProfileReady: true`; an old blueprint-ready reply is insufficient. The profile reloads the PostgREST schema. Reinspect its hash and ACLs after every future migration/function rollout; later grants can invalidate the profile and close new starts/orders.
4. Keep all admission/sales/frontend switches closed until the corresponding acceptance is completed. Reapplying the profile never enables Test, sales or public signup.

Every non-extension public application function defaults closed for PUBLIC/anon/authenticated. Exactly **41 authenticated signatures** remain: 21 student/account APIs and 20 staff APIs whose functions enforce the admin role. Deferred learning/community/generator/All India/topic/drawing APIs, legacy unversioned answers and legacy support creation are denied. Explicit service-only workers and the Auth signup hook retain their existing restricted grants. Private release/Test tables and helper functions are unavailable to browser/service table access.

## First offering and owner source statement

The owner approves use of the canonical empty-holds material and describes it as student-recalled, adapted practice questions. Preserve the raw payload, licence labels, source commit and content SHA; attach the owner statement as review evidence. This is owner-supplied provenance, not independent verification. Do not request the same bank-use decision again or describe the offering as an official past paper.

The sole canonical text source remains `main:server/data/exports/dexam-bank-export.json`, with 4,521 records and 2,582 explicitly empty-holds entries. The read-only image root supplied by the owner is `~/Documents/Default Project/Dexam_Mock_Test/server/data/media/`. Local validation accepts all 2,085 referenced eligible assets (273,263,304 bytes); copying an image filename without matching its hash/dimensions/bytes is insufficient.

The private first candidate is **UCEED Part A - Practice Mock 01**, 14 NAT + 15 MSQ + 28 MCQ, 57 verified images, 7,200 seconds and 200 points. Its private manifest/source/rendering evidence stays outside Git/public assets. No real question was published by preparing it. Existing CEED Part A support remains a candidate capability, not a promised released offering. NID/NIFT/Part B/All India remain deferred.

For a real release, import only eligible canonical records, verify/register every private figure, compile with the pinned exam context, and retain explicit bank review plus the owner provenance/use reference. `admin_mvp_paper_manifest(p_id)` returns eligibility and metadata/hashes to admins only. It checks exact current canonical prompt/options/key/explanation/marking/media, empty holds, approval, unique keys, fixed section order/counts/clock and present registered private storage objects. No draft, placeholder image or changed answer can inherit an older approval.

After presentation/manifest review, call `admin_release_mvp_paper(p_id, p_expected_sha256, p_rights_reference)` with the exact current hash and durable owner reference. The function rechecks locked current records and records the actor/evidence. A later content/review/holds/media/permission change removes new-start eligibility. `admin_withdraw_mvp_paper(p_id, p_expected_sha256, p_note)` removes the current release without deleting frozen owned attempts, clocks or results. These calls are operator procedures; no automatic source import publishes papers.

## Controlled merchant Test journey without opening Live sales

The real merchant Test journey must precede the provider-acceptance gate. Use a separate, audited and expiring Test window; never falsely approve that gate to make checkout reachable.

Required before opening the window:

- Matching reviewed source/profile/current offering, final published policy version, and approved `content_rights`, `privacy_terms`, `refund_policy` and `child_safety` decisions with evidence.
- Server `environment_mode = test`, `sales_enabled = false`, registration policy `testers`, authoritative verified Google accounts in the private tester allowlist. A password account or unallowlisted Google account is denied.
- Fresh replacement Razorpay **Test** key/secret and signed webhook secret stored only in the server secret store; prior exposed Test credentials deactivated. Correct domain/origin, OAuth callback and webhook configured on the approved target. No secrets in Vite/Git/logs/chat.

An authenticated admin calls `admin_set_mvp_test_checkout(true, p_expires_at, p_evidence)`. Expiry must be future and at most eight hours away; evidence is required. The admin need not be the payer. The payer still accepts the published terms under its verified current account. Enable the separate frontend checkout only on the explicitly approved private acceptance surface; normal/controlled/staging previews remain false by default. Nonproduction checkout displays the Test notice and accepts only `rzp_test_` orders and Test-mode server passes.

`prepare_order()` then permits only the verified allowlisted Test payer, with exact annual price 119,300 INR minor units, same pending order reuse, no current pass/review conflict and no callback grant. An expired window denies even reuse of an earlier pending order. It cannot authorize a Live order. Missing merchant credentials return 503 without opening a window or granting access. Keep `provider_acceptance`, backups/capacity evidence and Live sales false until their actual checks pass.

On dmocks.com, verify real Google sign-in, published terms/offer, real Orders API/window, Test capture, signed webhook, one 12-calendar-month pass, the exact paper, reconnect/submission/result, support/receipt and supported Test refund/redelivery cases. Record sanitized provider event IDs and release/hash evidence, not secrets or payment bodies. Local password-created actors with fictional Google metadata, simulated widgets and signed fictional webhooks do not satisfy this gate.

Close explicitly with `admin_set_mvp_test_checkout(false, null, p_evidence)` after acceptance or incident, then disable the private frontend checkout surface. Expiry blocks access but is not a substitute for closure: even an expired enabled flag prevents Live sales promotion. The enable/close decisions are immutable audit entries.

## Live release and operations

All seven relevant gates remain required: content rights, privacy/terms, refund policy, child safety, provider acceptance, backups/restore and capacity/operations. `drawing_operations` is excluded for this objective MVP. Readiness also requires the current exact offering, valid API profile, published policy, server Live mode and an explicitly closed Test window. A historic green blueprint or owner bank-use assertion alone never makes it ready.

Only after the final owner production-impact decision configure the separate Live merchant setup, production frontend expected mode, public admission and sales in the reviewed sequence. The activation trigger rejects Test mode/open Test windows/missing gates. The client rejects a Test key/pass on the production checkout path. There is no auto-renewal.

Use the minimal health view for stale/expired attempts, pending payment orders, payment reviews, open bugs and question reports. A duplicate/partial payment review requires operator handling, not an automated second charge or invented refund policy. See REFUND_RECONCILIATION.md and OPERATIONS_RUNBOOK.md. Preserve service-only expired-attempt recovery, private-media backups and a tested restore. Paid infrastructure/PITR is a separate owner budget decision; do not provision it automatically or demand the deferred 150-session exercise.

## Candidate evidence

Local checks: **342 JavaScript tests, four Python fixtures, eleven server types, build/isolation, zero production audit findings, 358 desktop/mobile journeys with no failures/skips/retries, 72 migrations plus profile/44 database suites**. Actual isolated Auth/PostgREST/Edge/Storage and SDK desktop/mobile checks cover default deny, current-hash releases, lock-wait withdrawal/change, concurrent fixed-paper starts, private figure signing, canonical result, withdrawal preservation and minimal operator tools. Controlled Test RPC checks cover authoritative tester metadata/allowlist, expiry/mode, no pass grant and missing-key 503 while the provider gate/Live sales remain false.

The Google metadata, questions, owner approvals, captures and refunds used for provider tests are fictional. The exact owned fixture `dmocks-mvp-release-e41b578a`, containers/volumes/keys/private logs/frontend are removed. Earlier baseline proof and corrected local harness INSERT/reinstall failures remain separately recorded. Hosted OAuth/merchant/cost/resource acceptance and the real customer journey are still outstanding.
