# Frozen paid MVP deployment and controlled Test acceptance

Owner rights clarification (8 November): Design Exam Academy confirms ownership or permission for all 2,582 hold-free canonical questions as original/adapted practice material, not verbatim protected official papers. Legacy labels remain as source history and no longer establish the collection-level rights conclusion. The compiler now supports 1,509 objective questions (835 UCEED/674 CEED) before required materialization, verified media and exact-version audited approval. The other 1,073 are outside this MVP: 361 other supported conversions and 712 conversion/context blockers. Never mass-update flags directly. Private NID blueprint drafting/review is authorized bank work, not a new student offering.

This is a reviewable rollout procedure, not a deployment approval. The hosted target decision is already pending. Public registration, real content publication, checkout, Live sales and merchant credentials remain closed/unconfigured by this source change.

## Exact source and server profile

Use the migration ledger and the companion profile at `supabase/launch/paid-mvp.sql` from the same reviewed commit. Run `node scripts/check-mvp-profile.mjs` from the application directory to verify the 47-signature permission block against `supabase/launch/paid-mvp-rpcs.json` and record the profile SHA-256. Apply the companion profile after the reviewed migrations. The database checks exercise its release, Test, practice-design and operational boundaries.

Before rollout, check CI for the reviewed feature commit and the merged tree, including a browser run without skips or retries. Inspect the installed ledger on the approved standalone DMocks target. Use the pre-upgrade capture procedure for a database that predates the companion profile. Restore the database and private media on an isolated target, verify the captured baseline and rehearse the pending migrations there. [Private database and file recovery](RECOVERY.md)

With sales false, public registration closed or testers-only and any previous merchant Test window explicitly closed:

1. Apply the reviewed missing migrations to the approved target and deploy matching required functions (`create-order`, `payment-webhook`, `attempt-media`, and core account/support media where needed). Keep deferred model/intake/drawing products disabled.
2. Apply this companion profile **last**, in a single transaction. Run from `apps/designmocks` using an approved privately configured connection:

   ```sh
   psql "$DMOCKS_APPROVED_DATABASE_URL" --no-psqlrc --single-transaction --set ON_ERROR_STOP=1 --file supabase/launch/paid-mvp.sql
   ```

3. Verify `admin_launch_readiness()` through an authorized operator account. It must return `scope: paid-mvp-v1` and `apiProfileReady: true`; an old blueprint-ready reply is insufficient. The profile reloads the PostgREST schema. Reinspect its hash and ACLs after every future migration/function rollout; later grants can invalidate the profile and close new starts/orders.
4. Keep all admission/sales/frontend switches closed until the corresponding acceptance is completed. Reapplying the profile never enables Test, sales or public signup.

Every non-extension public application function defaults closed for PUBLIC/anon/authenticated. Exactly **47 authenticated signatures** remain: 21 student/account APIs and 26 staff APIs whose functions enforce the admin role. Six NID staff signatures only design/review private practice blueprints and bind/read exact questions; they cannot release questions or submit runtime payloads. Separate explicitly service-only APIs plan/materialize canonical NID practice bindings and cannot approve or publish them. Deferred learning/community/generator/All India/topic/drawing APIs, legacy unversioned answers and legacy support creation are denied. Explicit service-only workers and the Auth signup hook retain their existing restricted grants. Private release/Test/practice-design tables and helper functions are unavailable to browser/service table access.

## First offering and owner source statement

The owner approves use of the canonical empty-holds material and describes it as student-recalled, adapted practice questions. Preserve the raw payload, licence labels, source commit and content SHA; attach the owner statement as review evidence. This is owner-supplied provenance, not independent verification. Do not request the same bank-use decision again or describe the offering as an official past paper.

The sole canonical text source remains `main:server/data/exports/dexam-bank-export.json`, with 4,521 records and 2,582 explicitly empty-holds entries. The read-only image root supplied by the owner is `~/Documents/Default Project/Dexam_Mock_Test/server/data/media/`. Local validation accepts all 2,085 referenced eligible assets (273,263,304 bytes); copying an image filename without matching its hash/dimensions/bytes is insufficient.

The private first candidate is **UCEED Part A - Practice Mock 01**, 14 NAT + 15 MSQ + 28 MCQ, 57 verified images, 7,200 seconds and 200 points. Its private manifest/source/rendering evidence stays outside Git/public assets. No real question was published by preparing it. Existing CEED Part A support remains a candidate capability, not a promised released offering. NID/NIFT/Part B/All India remain deferred.

For a real release, import only eligible canonical records, verify/register every private figure, compile with the pinned exam context, and retain explicit bank review plus the owner provenance/use reference. `admin_mvp_paper_manifest(p_id)` returns eligibility and metadata/hashes to admins only. It checks exact current canonical prompt/options/key/explanation/marking/media, empty holds, approval, unique keys, fixed section order/counts/clock and present registered private storage objects. No draft, placeholder image or changed answer can inherit an older approval.

Use the frozen private packet and its separately reviewed SHA-256 to prepare the catalogue paper. Set `DMOCKS_MEDIA_ROOT` to the read-only canonical media root. The default command verifies current `origin/main`, recompiles every selected question, checks the actual figure bytes and returns only counts and hashes.

```sh
npm run paper:prepare -- --packet "$DMOCKS_REVIEWED_PAPER_PACKET" --expect "$DMOCKS_REVIEWED_PAPER_SHA256"
```

After target approval, the completed canonical import, media registration and audited per-question approval, repeat with `--apply`. Configure `DMOCKS_SUPABASE_URL`, the private `DMOCKS_SUPABASE_SERVICE_ROLE_KEY`, an exact `DMOCKS_PAPER_ALLOW_ORIGIN`, and `DMOCKS_PAPER_ENVIRONMENT` (`staging` or `production`). Production also requires `DMOCKS_PAPER_PRODUCTION_ACK=PREPARE_UNPUBLISHED_MVP_PAPER_ON_<exact origin>`. The target requires the paid MVP profile, closed registration and sales, and a closed merchant Test window. One server transaction copies the current reviewed bank snapshots into an unpublished paper and returns its ID and manifest SHA-256. An exact retry reuses the receipt while the paper is unpublished. A changed packet, canonical record, runtime or missing figure rejects the preparation. Use the returned paper ID for the independent admin manifest review.

After presentation/manifest review, call `admin_release_mvp_paper(p_id, p_expected_sha256, p_rights_reference)` with the exact current hash and durable owner reference. The function rechecks locked current records and records the actor/evidence. A later content/review/holds/media/permission change removes new-start eligibility. `admin_withdraw_mvp_paper(p_id, p_expected_sha256, p_note)` removes the current release without deleting frozen owned attempts, clocks or results. These calls are operator procedures; no automatic source import publishes papers.

Paper release, withdrawal, launch attestations and Test window changes check staff access again after waiting for their database locks. A rejected decision leaves the previous status and audit history intact. Test window opening checks the current prerequisite decisions and expiry after the wait.

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

The server checks current launch approvals when preparing a new Live order. Revoking a required approval blocks queued and subsequent order preparation. Reconcile orders already prepared under the prior approval through the existing payment procedure.

Use the health view and read-only monitor for stale attempts, order and payment reviews, unverified passes, support and question reports. Configure the approved alert receiver and payment Edge log filters as part of hosted acceptance. A duplicate or partial payment review requires operator reconciliation. See [Refund reconciliation](REFUND_RECONCILIATION.md) and [Operations runbook](OPERATIONS_RUNBOOK.md). Preserve service-only attempt recovery, private-media backups and a tested restore. Paid infrastructure and point-in-time recovery require a separate budget decision.

## Candidate evidence

Local checks: **342 JavaScript tests, four Python fixtures, eleven server types, build/isolation, zero production audit findings, 358 desktop/mobile journeys with no failures/skips/retries, 72 migrations plus profile/44 database suites**. Actual isolated Auth/PostgREST/Edge/Storage and SDK desktop/mobile checks cover default deny, current-hash releases, lock-wait withdrawal/change, concurrent fixed-paper starts, private figure signing, canonical result, withdrawal preservation and minimal operator tools. Controlled Test RPC checks cover authoritative tester metadata/allowlist, expiry/mode, no pass grant and missing-key 503 while the provider gate/Live sales remain false.

The Google metadata, questions, owner approvals, captures and refunds used for provider tests are fictional. The exact owned fixture `dmocks-mvp-release-e41b578a`, containers/volumes/keys/private logs/frontend are removed. Earlier baseline proof and corrected local harness INSERT/reinstall failures remain separately recorded. Hosted OAuth/merchant/cost/resource acceptance and the real customer journey are still outstanding.
