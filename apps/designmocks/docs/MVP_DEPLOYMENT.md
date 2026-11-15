# Frozen paid MVP deployment and controlled Test acceptance

Owner rights clarification (8 November): Design Exam Academy confirms ownership or permission for all 2,582 hold-free canonical questions as original/adapted practice material, not verbatim protected official papers. Legacy labels remain as source history and no longer establish the collection-level rights conclusion. The compiler now supports 1,509 objective questions (835 UCEED/674 CEED) before required materialization, verified media and exact-version audited approval. The other 1,073 are outside this MVP: 361 other supported conversions and 712 conversion/context blockers. Never mass-update flags directly. Private NID blueprint drafting/review is authorized bank work, not a new student offering.

This is a reviewable rollout procedure, not a deployment approval. The owner selected `tiodqzvvujxvxssvjdis` as private staging on 10 November; production requires a separate project. Backup/restore and migration dry run are authorized, but hosted promotion still needs its own approval (HANDOFF.md). Public registration, real content publication, checkout, Live sales and merchant credentials remain closed/unconfigured by this source change.

## Exact source and server profile

Use the migration ledger and the companion profile at `supabase/launch/paid-mvp.sql` from the same reviewed commit. Run `node scripts/check-mvp-profile.mjs` from the application directory to verify the 49-signature permission block against `supabase/launch/paid-mvp-rpcs.json` and record the profile SHA-256. Apply the companion profile after the reviewed migrations. The database checks exercise its release, Test, purchases and support, practice-design and operational boundaries.

Before preparing backend commands, run `node scripts/release-source-preflight.mjs --commit <reviewed-full-commit> --tree <reviewed-full-tree>` from this directory. Get both 40-character IDs from the independently reviewed source record. Do not derive expected values from the checkout being checked. The preflight requires the exact `HEAD` and tree, a clean tracked and untracked checkout, and no ignored or untracked files under `supabase/`. It compares every backend file with its Git blob and rejects unusual file modes or symlinked backend directories. It prints stable SHA-256 hashes and counts for migrations, Edge Functions and shared code, project/config files, the paid MVP profile, and its RPC grant inventory. Exact PR/main CI, approved target, and frontend artifact checks remain separate. A pass identifies source inputs only and does not authorize credentials, backup, apply, or deployment.

Before rollout, check CI for the reviewed feature commit and the merged tree, including a browser run without skips or retries. Inspect the installed ledger on the approved standalone DMocks target. Verify the ordered Supabase dry run against the fresh ledger and the exact reviewed checkout with `scripts/release-migration-plan.mjs`. Use the pre-upgrade capture procedure for a database that predates the companion profile. Restore the database and private media on an isolated target, verify the captured baseline and rehearse the pending migrations there. [Migration dry run](PROVIDER_SETUP.md#verify-the-migration-dry-run), [Private database and file recovery](RECOVERY.md)

With sales false, public registration closed or testers-only and any previous merchant Test window explicitly closed:

1. Apply the reviewed missing migrations to the approved target and deploy matching required functions (`create-order`, `payment-webhook`, `attempt-media`, and core account/support media where needed). Keep deferred model/intake/drawing products disabled.
2. Apply this companion profile **last**, in a single transaction. Run from `apps/designmocks` using an approved privately configured connection:

   ```sh
   psql "$DMOCKS_APPROVED_DATABASE_URL" --no-psqlrc --single-transaction --set ON_ERROR_STOP=1 --file supabase/launch/paid-mvp.sql
   ```

3. Verify `admin_launch_readiness()` through an authorized operator account. It must return `scope: paid-mvp-v1` and `apiProfileReady: true`; an old blueprint-ready reply is insufficient. The profile reloads the PostgREST schema. Reinspect its hash and ACLs after every future migration/function rollout; later grants can invalidate the profile and close new starts/orders.
4. Keep all admission/sales/frontend switches closed until the corresponding acceptance is completed. Reapplying the profile never enables Test, sales or public signup.

Every non-extension public application function defaults closed for PUBLIC/anon/authenticated. The profile enables **49 authenticated signatures** across 23 student/account APIs and 26 staff APIs. Staff functions enforce the admin role. Six NID staff signatures cover private practice blueprint design and review and exact question bindings. Separate service-only APIs plan and materialize canonical NID practice bindings. Deferred learning, Community, exam generators, All India, topic practice and drawing APIs are closed. Legacy unversioned answers and legacy support creation are denied. Explicit service-only workers and the Auth signup hook have restricted grants. Private release, Test and practice-design tables and helpers require their authorized entry points.

Migration `202611090160` adds the owned purchase history read. Apply it before the updated companion. If the earlier 47-signature profile is already installed, the migration preserves its validity. The updated profile opens the new read.

Migration `202611090161` adds the order-linked support submission and the private history fields. Apply it before the 49-signature companion and the matching frontend. An installed 48-signature profile remains valid until the companion enables the new overload. Earlier general report requests keep their original signature and receipt.

Migrations `202611090162` and `202611100163` add service-only intake-source and drawing-removal APIs that the profile leaves closed to browser roles; migration `202611100166` also permits service-only Live drawing cleanup; the matching `npm run drawing:cleanup` command requires the exact production acknowledgement described in HANDOFF.md. Migration `202611100164` added a guardian pre-admission requirement to the Auth before-user-created hook and `202611100165` removes it again because registration is adults only (18+, owner decision of 10 November): the hook keeps the verified-Google-identity checks, the registration mode and the tester allowlist, and the pre-admission table is dropped. An allowlisted verified Google tester can therefore register without any extra operator record. The ordered plan for the 25-version historical ledger is 65 pending migrations, from `202611060006` through `202611100166`, followed by the companion profile. The migration plan verifier lists migrations only; the profile step, its hash and the function deployment remain manual steps in the order above.

Migration `202611100166` makes a verified phone number usable by one account only (it stops if duplicates already exist) and lets the service-only drawing-removal list run in any launch mode. `npm run drawing:cleanup` now accepts a production target only with the exact `PURGE_REMOVED_DRAWINGS_ON_<origin>` acknowledgement.

Deploy only the functions the MVP needs. `candidate-phone` (and its `DMOCKS_PHONE_*`/`DMOCKS_MSG91_*` secrets), `ai-question-draft`, `question-intake`, `question-intake-extract`, `drawing-media`, `drawing-review-media` and `community-media` belong to deferred products. `supabase/config.toml` sets `verify_jwt = false` for `create-order`, `payment-webhook`, `candidate-phone`, `attempt-media`, `bank-review-media`, `reported-question-media`, `drawing-media`, `drawing-review-media` and `community-media`; the three AI and intake workers keep the default gateway JWT check. Use the exact reviewed checkout origin in `DMOCKS_CHECKOUT_ORIGIN` when the project also serves the private portal at `PUBLIC_APP_ORIGIN`. The checkout and webhook require `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`; the platform supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.

## First offering and owner source statement

The owner approves use of the canonical empty-holds material and describes it as student-recalled, adapted practice questions. Preserve the raw payload, licence labels, source commit and content SHA; attach the owner statement as review evidence. This is owner-supplied provenance, not independent verification. Do not request the same bank-use decision again or describe the offering as an official past paper.

The sole canonical text source remains `main:server/data/exports/dexam-bank-export.json`, with 4,521 records and 2,582 explicitly empty-holds entries. The read-only image root supplied by the owner is `~/Documents/Default Project/Dexam_Mock_Test/server/data/media/`. Local validation accepts all 2,085 referenced eligible assets (273,263,304 bytes); copying an image filename without matching its hash/dimensions/bytes is insufficient.

The private first candidate is **UCEED Part A - Practice Mock 01**, 14 NAT + 15 MSQ + 28 MCQ, 57 verified images, 7,200 seconds and 200 points. Its private manifest/source/rendering evidence stays outside Git/public assets. No real question was published by preparing it. Existing CEED Part A support remains a candidate capability, not a promised released offering. NID/NIFT/Part B/All India remain deferred.

For a real release, import only eligible canonical records, verify/register every private figure, compile with the pinned exam context, and retain explicit bank review plus the owner provenance/use reference. `admin_mvp_paper_manifest(p_id)` returns eligibility and metadata/hashes to admins only. It checks exact current canonical prompt/options/key/explanation/marking/media, empty holds, approval, unique keys, fixed section order/counts/clock and present registered private storage objects. No draft, placeholder image or changed answer can inherit an older approval.

### Select the private bank target

Set `DMOCKS_SUPABASE_URL` and the private `DMOCKS_SUPABASE_SERVICE_ROLE_KEY` for the approved project. Set `DMOCKS_BANK_ALLOW_ORIGIN` to the exact independently approved API origin and `DMOCKS_BANK_ENVIRONMENT` to `development`, `staging` or `production`. Development requires loopback. Production requires a managed Supabase origin and `DMOCKS_BANK_PRODUCTION_ACK=USE_PRIVATE_BANK_ON_<exact origin>`. The commands check the current DMocks paid MVP profile before sending questions, files or runtime plans. Authenticated requests stay on the approved origin and refuse redirects. A legacy service-role JWT must match the managed project reference. An opaque secret key uses the API key header. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)

Run the canonical text import after the approved target has the matching migrations and profile. For bank-wide staging, follow the text import with media registration and runtime materialization. Set `DMOCKS_MEDIA_ROOT` to the read-only media directory. The bank and media manifest commands remain available for offline inspection.

After the text import, verify its completed receipt and exact current question hashes with the [read-only bank target audit](QUESTION_BANK_AUDIT.md#read-only-dmocks-target-audit). Record the report with the reviewed source and target before proceeding to content preparation.

```sh
npm run bank:import
npm run media:import
npm run runtime:apply
```

### Prepare the reviewed paper

Use the frozen private packet and its separately reviewed SHA-256 to prepare the catalogue paper. Set `DMOCKS_MEDIA_ROOT` to the read-only canonical media root. The default command verifies current `origin/main`, recompiles every selected question, checks the actual figure bytes and returns only counts and hashes.

```sh
npm run paper:prepare -- --packet "$DMOCKS_REVIEWED_PAPER_PACKET" --expect "$DMOCKS_REVIEWED_PAPER_SHA256"
```

To stage the exact first paper's inputs on the approved Test target after canonical text import, add `--sync-inputs` to that command. Set `DMOCKS_SUPABASE_URL`, `DMOCKS_SUPABASE_SERVICE_ROLE_KEY`, `DMOCKS_PAPER_ALLOW_ORIGIN` and `DMOCKS_PAPER_ENVIRONMENT` for that target. A managed production target also requires `DMOCKS_PAPER_PRODUCTION_ACK=USE_PRIVATE_BANK_ON_<exact-origin>` for this bank operation.

The command checks Test mode and closed sales before transferring the packet's figures and again before recording its runtime. It verifies the bytes in private Storage and reports counts for uploaded figures, reused figures and recorded questions. A retry verifies existing bytes before reuse. Staff review and paper preparation follow as separate steps.

After target approval, the completed canonical import, media registration and audited per-question approval, repeat with `--apply`. Configure `DMOCKS_SUPABASE_URL`, the private `DMOCKS_SUPABASE_SERVICE_ROLE_KEY`, an exact `DMOCKS_PAPER_ALLOW_ORIGIN`, and `DMOCKS_PAPER_ENVIRONMENT` (`staging` or `production`). Production also requires `DMOCKS_PAPER_PRODUCTION_ACK=PREPARE_UNPUBLISHED_MVP_PAPER_ON_<exact origin>`. The target requires the paid MVP profile, closed registration and sales, and a closed merchant Test window. One server transaction copies the current reviewed bank snapshots into an unpublished paper and returns its ID and manifest SHA-256. An exact retry reuses the receipt while the paper is unpublished. A changed packet, canonical record, runtime or missing figure rejects the preparation. Use the returned paper ID for the independent admin manifest review.

After presentation/manifest review, call `admin_release_mvp_paper(p_id, p_expected_sha256, p_rights_reference)` with the exact current hash and durable owner reference. The function rechecks locked current records and records the actor/evidence. A later content/review/holds/media/permission change removes new-start eligibility. `admin_withdraw_mvp_paper(p_id, p_expected_sha256, p_note)` removes the current release without deleting frozen owned attempts, clocks or results. These calls are operator procedures; no automatic source import publishes papers.

Paper release, withdrawal, launch attestations and Test window changes check staff access again after waiting for their database locks. A rejected decision leaves the previous status and audit history intact. Test window opening checks the current prerequisite decisions and expiry after the wait.

### Verify an already stored paper's figures

Add `--verify-storage` to the reviewed packet command. Use the exact approved Supabase origin and server-only credential described above. A production check requires `DMOCKS_PAPER_PRODUCTION_ACK=VERIFY_PRIVATE_PAPER_MEDIA_ON_<exact-origin>`. This mode reads the private bucket and every exact packet figure, then verifies its byte length, digest and PNG dimensions against the reviewed packet. It reports aggregate counts and sends no write or registration requests. Run it independently of `--sync-inputs` and `--apply`. A passing result establishes the stored figure bytes at the time of the check. Verify student-scoped signing and rendered delivery separately.

## Controlled merchant Test journey without opening Live sales

The real merchant Test journey must precede the provider-acceptance gate. Use a separate, audited and expiring Test window; never falsely approve that gate to make checkout reachable.

### Match the approved customer notices

The operator details in Contact, Terms and Privacy come from the supplied business record and support address. Provide the separately approved public notice text as a JSON file with `schemaVersion: 1` and `scope: "release"`. Include the following paragraph fields.

| Page | Required fields |
| --- | --- |
| `terms` | `coverage`, `refunds`, `invoices` |
| `privacy` | `information`, `processors`, `retention`, `youngerStudents` |

Set `DMOCKS_PUBLISHED_NOTICES_FILE` in the approved frontend build environment. Run `node scripts/published-notices.mjs "$DMOCKS_PUBLISHED_NOTICES_FILE"` to calculate the version from the reviewed paragraphs, the fixed annual offer and the operator details. Use that exact version for `VITE_TERMS_VERSION` and the approved server `launch_settings.policy_version`. The browser displays the same revision on both notices and sends it with consent. A missing bundle or a version mismatch keeps checkout closed. Synthetic notices are restricted to the explicit local test server.

The server checks the published revision after waiting for any profile write and holds that revision while recording consent. A superseded form stays closed until the customer reloads and reviews the current notices. Existing accepted versions remain on the profile until the customer accepts a current revision.

The direct `/refunds` page displays the same cancellation text and revision as `/terms`. Checkout links to this page and the released-paper catalogue before consent. Use the reviewed policy links and approved sample invoice for the merchant website review. [Razorpay website review requirements](https://razorpay.com/docs/payments/dashboard/account-settings/business-website-details)

Required before opening the window:

- Matching reviewed source/profile/current offering, final published policy version, and approved `content_rights`, `privacy_terms`, `refund_policy` and `child_safety` decisions with evidence.
- Server `environment_mode = test`, `sales_enabled = false`, registration policy `testers`, authoritative verified Google accounts in the private tester allowlist. A password account or unallowlisted Google account is denied.
- Fresh replacement Razorpay **Test** key/secret and signed webhook secret stored only in the server secret store; prior exposed Test credentials deactivated. Correct domain/origin, OAuth callback and webhook configured on the approved target. No secrets in Vite/Git/logs/chat.

Once the functions and secrets are in place, run `DMOCKS_AUTH_STAGE=controlled DMOCKS_COMMERCE_STAGE=configured npm run test:hosted-setup` with the approved project's public configuration and the default `foundation` backend checks. Verify that the checkout handler allows the exact approved origin's preflight, rejects anonymous and foreign-origin requests, and that the webhook rejects an unsigned body. This probe uses no merchant credentials and performs no checkout or refund. Verify the key mode, real event delivery and account entitlement in the Test journey below.

### Package the Test checkout frontend

Run the packager from `apps/designmocks` in a clean reviewed worktree. Supply the designated project's public browser key through `DMOCKS_CHECKOUT_PUBLISHABLE_KEY`, the reviewed customer notice file as an absolute path, and its independently reviewed compiled version. The build uses the verified Git archive and the locked offline npm cache.

```sh
npm run checkout:package -- --commit "$DMOCKS_REVIEWED_COMMIT" --tree "$DMOCKS_REVIEWED_TREE" \
  --frontend-origin "$DMOCKS_REVIEWED_CHECKOUT_ORIGIN" --provider-origin "$DMOCKS_REVIEWED_PROVIDER_ORIGIN" \
  --notices "$DMOCKS_PUBLISHED_NOTICES_FILE" --expect-notice-version "$DMOCKS_REVIEWED_NOTICE_VERSION" \
  --output "$DMOCKS_PRIVATE_CHECKOUT_ARTIFACT"
npm run checkout:verify -- --artifact "$DMOCKS_PRIVATE_CHECKOUT_ARTIFACT" --expect "$DMOCKS_REVIEWED_ARTIFACT_SHA256"
```

The manifest binds the Test portal, paid MVP backend profile, exact origins, notice version, source and site files. The browser opens sign-in and checkout only on the reviewed checkout origin. The packager disables the expanded preview modules, controlled-login preview, private staging portal and phone verification. The staging workspace has its own nonpayment artifact and verifier.

After the hosting and rollout decision, deploy only the verified `site/` directory to the restricted acceptance audience at the reviewed origin. The server must still be in Test mode with public registration and Live sales closed, a matching policy version and an expiring Test window for the allowlisted payer.

An authenticated admin calls `admin_set_mvp_test_checkout(true, p_expires_at, p_evidence)`. Expiry must be future and at most eight hours away; evidence is required. The admin need not be the payer. The payer still accepts the published terms under its verified current account. Enable the separate frontend checkout only on the explicitly approved private acceptance surface; normal/controlled/staging previews remain false by default. Nonproduction checkout displays the Test notice and accepts only `rzp_test_` orders and Test-mode server passes.

`prepare_order()` then permits only the verified allowlisted Test payer, with exact annual price 119,300 INR minor units, same pending order reuse, no current pass/review conflict and no callback grant. An expired window denies even reuse of an earlier pending order. It cannot authorize a Live order. Missing merchant credentials return 503 without opening a window or granting access. Keep `provider_acceptance`, backups/capacity evidence and Live sales false until their actual checks pass.

On dmocks.com, verify real Google sign-in, published terms/offer, real Orders API/window, Test capture, signed webhook, one 12-calendar-month pass, the exact paper, reconnect/submission/result, support/receipt and supported Test refund/redelivery cases. Record sanitized provider event IDs and release/hash evidence, not secrets or payment bodies. Local password-created actors with fictional Google metadata, simulated widgets and signed fictional webhooks do not satisfy this gate.

Close explicitly with `admin_set_mvp_test_checkout(false, null, p_evidence)` after acceptance or incident, then disable the private frontend checkout surface. Expiry blocks access but is not a substitute for closure: even an expired enabled flag prevents Live sales promotion. The enable/close decisions are immutable audit entries.

## Live release and operations

All seven relevant gates remain required: content rights, privacy/terms, refund policy, child safety, provider acceptance, backups/restore and capacity/operations. `drawing_operations` is excluded for this objective MVP. Readiness also requires the current exact offering, valid API profile, published policy, server Live mode and an explicitly closed Test window. A historic green blueprint or owner bank-use assertion alone never makes it ready.

Only after the final owner production-impact decision configure the separate Live merchant setup, production frontend expected mode, public admission and sales in the reviewed sequence. The activation trigger rejects Test mode/open Test windows/missing gates. The client rejects a Test key/pass on the production checkout path. There is no auto-renewal.

Production sign-in and checkout open only at the configured apex origin, `https://dmocks.com`. Link to the apex from the public `www` alias and register `https://dmocks.com/account/callback` for the production portal.

After provisioning the separate production backend, run the read-only production smoke from `apps/designmocks`. Supply the reviewed production Supabase origin independently as `DMOCKS_PRODUCTION_PROVIDER_ORIGIN`, and point `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at that same project with its public browser key. The command rejects the staging project and skips local dotenv fallback. With registrations still globally closed and the payment handlers configured, run:

```sh
DMOCKS_AUTH_STAGE=closed DMOCKS_BACKEND_STAGE=foundation DMOCKS_COMMERCE_STAGE=configured \
  npm run test:hosted-setup -- --production
```

The receipt in `test-results/hosted-production-configured-smoke.json` records the production backend, the apex origin, and each anonymous check. The `unconfigured` commerce stage expects the setup gates before payment secrets are installed and writes its own receipt. For controlled Google acceptance, select `DMOCKS_AUTH_STAGE=controlled` and verify tester allowlisting separately. The smoke verifies rejection paths with a public key. The real signed-in and merchant acceptance steps still apply.

The server checks current launch approvals when preparing a new Live order. Revoking a required approval blocks queued and subsequent order preparation. Reconcile orders already prepared under the prior approval through the existing payment procedure.

Use the health view and read-only monitor for stale attempts, order and payment reviews, unverified passes, support and question reports. Configure the approved alert receiver and payment Edge log filters as part of hosted acceptance. A duplicate or partial payment review requires operator reconciliation. See [Refund reconciliation](REFUND_RECONCILIATION.md) and [Operations runbook](OPERATIONS_RUNBOOK.md). Preserve service-only attempt recovery, private-media backups and a tested restore. Paid infrastructure and point-in-time recovery require a separate budget decision.

## Candidate evidence

Local checks: **342 JavaScript tests, four Python fixtures, eleven server types, build/isolation, zero production audit findings, 358 desktop/mobile journeys with no failures/skips/retries, 72 migrations plus profile/44 database suites (historical, measured on the 72-migration source)**. Actual isolated Auth/PostgREST/Edge/Storage and SDK desktop/mobile checks cover default deny, current-hash releases, lock-wait withdrawal/change, concurrent fixed-paper starts, private figure signing, canonical result, withdrawal preservation and minimal operator tools. Controlled Test RPC checks cover authoritative tester metadata/allowlist, expiry/mode, no pass grant and missing-key 503 while the provider gate/Live sales remain false.

The Google metadata, questions, owner approvals, captures and refunds used for provider tests are fictional. The exact owned fixture `dmocks-mvp-release-e41b578a`, containers/volumes/keys/private logs/frontend are removed. Earlier baseline proof and corrected local harness INSERT/reinstall failures remain separately recorded. Hosted OAuth/merchant/cost/resource acceptance and the real customer journey are still outstanding.
