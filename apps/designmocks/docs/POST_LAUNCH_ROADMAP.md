# Deferred roadmap — scope frozen 8 November 2026

This historical full-portal plan is post-launch. It is not a launch checklist or permission to expand scope. The current PRODUCT_EXECUTION_PLAN.md takes precedence. Keep these modules disabled unless explicitly required by the approved first paper.

# DMocks product execution plan

Owner brief recorded: 5 November 2026
Planning horizon: staged delivery; no production sales or AI-final grading implied

## Outcome

DMocks becomes a Google-sign-in assessment platform for UCEED, CEED, NID DAT and NIFT with free discovery access and paid exam mocks, All India mocks and topic practice. It reuses the proven Dexam Exam app's assessment engine and adapts its student experience to the DMocks brand. The bank, scoring, timers, entitlements and review workflows remain server-authoritative. The only bank source is `main:server/data/exports/dexam-bank-export.json`; only records with an explicitly present, empty `holds` array are eligible.

## Product navigation

The desktop student portal uses one collapsible left sidebar and a mobile drawer:

1. **Overview** — next action, active attempt, performance, exam cards, upcoming All India mocks and personal results.
2. **Exam mocks** — UCEED, CEED, NID DAT and NIFT. Each start generates one exam-blueprint-compliant scramble from ready questions and snapshots it for that attempt.
3. **All India mocks** — a scheduled, identical paper for everyone, one attempt per account, registration/deadline state and published cohort results.
4. **Topic practice** — exam, topic, 10/20/30 questions and 15/30/45-minute options. Unseen questions are preferred.
5. **Learn** — theory documents, progress and later structured lessons. Initial content waits for the owner's Claude document export.
6. **Community** — question/solution posts, images, threaded discussion, reporting and moderation.
7. **Account** — profile, target exams, appearing year, city, verified phone, purchases, privacy/export/deletion and sign-out.

Reference reuse: Dexam's `StudentShell`, Overview, Mock Test, Practice, live-event pages and exam runner. Chess.com is a product-pattern reference only—do not copy its branding, text, assets or code.

## What to take from Chess.com

- **Learn:** a clear skill path, short lessons, completion state, recommended next lesson and practice immediately after theory.
- **Community:** topic/exam channels, useful contribution signals, trusted moderators, compact profiles and strong reporting controls.
- **Home loop:** one prominent “continue” action, daily/weekly progress and relevant upcoming events.
- **Post-attempt learning:** analysis that sends the student to the exact topic lesson or practice set.

Do not add streak pressure, public activity surveillance, open direct messaging or an engagement feed at launch. They increase moderation and child-safety risk without improving exam outcomes.

## Access model

Anonymous visitors see marketing, sample questions, public All India results and top-ten display names only with explicit ranking-consent rules. Google sign-in is free. Signed-in free users receive profile setup, Community, Learn (recommended full access initially), one or two explicitly labelled free mocks, and their own history. Paid annual access unlocks recurring exam mocks, All India mock participation and topic practice. Entitlements are created only by verified server-side payment events.

## Candidate profile

Collect the minimum necessary data after Google sign-in:

- display name;
- verified phone number;
- appearing year;
- city (coarse city, not precise location);
- one or more target exams: UCEED, CEED, NID DAT, NIFT;
- ranking display consent and policy acceptance.

Phone verification requires a provider, abuse limits, consent wording, recovery rules and retention limits. It is a launch dependency, not a browser-only field.

## Assessment rules

### Exam-wise mocks

- Generated from schema-valid questions imported from the authoritative `main` export with `holds.length === 0`, then accepted by the platform's licence/media/readiness gates, against a versioned exam blueprint.
- Questions may be scrambled per attempt; every generated attempt is snapshotted and immutable.
- Answer keys never reach the browser before result release.
- A user may start new paid mocks subject to entitlement and abuse limits.

### All India mocks

- One fixed, versioned paper per exam event; every candidate receives identical questions and marks.
- Registration opens before a published ten-day attempt window. The owner brief also mentions a ten-day checking/release period; treat attempt window and result-review window as separate configurable dates.
- One attempt per account, enforced by a unique server constraint, not the UI.
- The server clock continues during power or internet loss. Reconnecting resumes the same immutable attempt with only the real remaining time. The attempt never restarts and lost time is not restored automatically.
- The app journals unsynced valid answers on the device before sending them. Reopening the same active attempt restores pending answers and reconciles their revisions with the server. The server accepts no writes after the deadline.
- At the deadline, the server finalizes the latest accepted answers. This is fairer and safer than forcing a complete retake after an outage.
- Objective scoring is deterministic. Drawing grades remain sealed until the cohort is released. Objective-only cohorts rank by score, then elapsed exam time. Drawing cohorts rank by combined score and share rank on equal marks because every candidate has the full drawing and upload windows.
- The marketing site may show the top ten only under a disclosed public-ranking policy; the exam overview shows the signed-in candidate's rank and cohort statistics.

### Topic practice

- 10/20/30-question choices and 15/30/45-minute timers.
- Prefer unseen ready questions; exclude retired/review-held questions from new sets.
- Practice is paid, while a small sample can remain free.

## Drawing and image evaluation

- Support multiple raster uploads per drawing task, explicit ordering, replacement/removal before final submission, retryable resumable upload and an additional exam-specific 10–15 minute upload phase.
- Files are private, malware/type/size checked, stripped of unnecessary metadata and accessed through short-lived signed URLs.
- Local drawing validation now checks complete still PNG/JPEG/WebP content, strips unnecessary metadata and preserves compressed pixels, rendering colour data and orientation. Actual isolated Edge/Storage acceptance covers the 10 MiB/24MP bounds, account/reviewer isolation and the post-decode deadline fence. General malware scanning/quarantine, resumable transfer and hosted resource acceptance remain open.
- Private inspection now corrects orientation per browser/format and supports rotation, mirroring, zoom, actual size and contrasting paper. Student ownership, anonymous teacher assignment, expiry and post-sign revocation checks preserve the uploaded evidence and grading scope. Desktop/mobile and real isolated provider acceptance pass.
- AI produces rubric-linked suggestions and a proposed score with confidence and evidence. It must not be the final authority at launch.
- A teacher reviews anonymously, sees the AI proposal, enters criterion marks and comments, and may override with a required reason. Every change is audited.
- Supabase Edge Functions cannot host a useful large vision-language model. Recommended first implementation: a separately hosted managed multimodal API or dedicated inference service, with images disclosed/consented and retention controlled. Local/self-hosted vision evaluation is an R&D track requiring GPU cost, a labelled drawing set, calibration and bias testing.

## Question quality and reporting

- Signed-in students can report incomplete prompt, incorrect key, broken image/options, duplicate or other issues.
- One user gets one active report per question/version/reason; reports are rate-limited and abuse-audited.
- Reports never auto-delete a question. At a configurable threshold (start with five unique credible reporters), the question is held from **new** attempts and enters human review. Existing attempt snapshots and results remain reproducible.
- Ten reports raise priority, but no report count substitutes for review. Reviewer decisions are fix/new-version, restore, retire or dismiss reports.

## Community model

Use a Reddit-style topic/thread structure with Quora-style answer quality, not an unstructured chat:

- posts belong to an exam/topic and can contain a question, proposed solution and bounded images;
- threaded comments, accepted/helpful answer, votes limited by anti-abuse rules, edit history and reporting;
- no anonymous posting, no private messaging at launch, no public phone/city exposure;
- moderators can lock, hide, restore and sanction with an audit trail;
- official bank content cannot be copied into public Community posts before an assessment closes.

## Reuse matrix from the Exam app

| Requested capability | Existing reference | Action |
| --- | --- | --- |
| Unified left sidebar | D-059 `StudentShell` | Port styling/route model to DMocks |
| Exam-wise mixed mocks | D-062/F040 | Reuse blueprint and server generation rules |
| Topic practice | F046/F047 | Extend sizes to 10/20/30 and explicit timers |
| All India fixed paper | F050 | Extend scheduling to ten-day window and delayed release |
| Server timer/autosave | F042/F044 | Reuse immutable attempts and server deadlines |
| Free paper per exam | F039/F041 | Adapt to selected free allowance |
| Part B uploads | F043/F048 | Extend to ordered multi-image replacement |
| Teacher marking | F043/F048 | Add AI proposal and audited override |
| Overview analytics | F045/D-059 | Rebrand and add event/result cards |
| Learn content | Existing Dexam lessons | Import owner theory after content audit |
| Community | Not implemented | New moderated module |
| Question reports | Not implemented | New version-aware review queue |

## Delivery sequence

Every releasable slice must include focused unit coverage, database/authorization invariants when it changes server behavior, and Playwright end-to-end coverage on desktop and mobile for the visible user journey. `npm run check` is the merge gate; a feature is not complete while any applicable layer is missing or failing.

### Phase 0 — truth and foundations (active)

- [x] Record the product brief and reuse map.
- [x] Add reproducible local bank audit and a machine-readable source contract.
- [x] Inspect the latest remote `main` export: 4,521 total, 2,582 eligible by the owner-approved empty-holds rule and 1,939 excluded.
- [x] Add separated development/staging/production configuration, scale indexes and batched private-media signing.
- [x] Add an admin allow-list, human-reviewed question-draft queue, signed-in bug reporting and admin replies/statuses.
- [x] Complete structured PDF/photo corrections and manual transcription, retained private figure crops, retry-safe review decisions and canonical rights-gated exports. Verify with synthetic local Auth, Storage, concurrent requests, the real importer and verified runtime writer.
- [x] Add bounded recovery and health visibility for interrupted extraction and AI drafting, with five-minute expiry, private processing tokens and explicit administrator retries. Verify real local HTTP overloads, late workers and legacy callers.
- [x] Replace the first-25 bank list with searchable pagination and exam/type/topic/review filters. Open complete canonical wording, options, private figures, source/delivery answers and marking before a written, version-checked review. Verify admin-only signing, missing figures, stale decisions and desktop/mobile access.
- [x] Prove the new migrations and authorization rules on disposable PostgreSQL 17.
- [x] Add a service-role-only, idempotent canonical-bank importer that reads `origin/main`, imports only explicit empty-holds records and keeps objective readiness separate from import eligibility.
- [x] Export the current local Exam app import state and match all 4,521 current keys and hashes to the canonical export. Inspect the separate fixture-only staging environment. [Bank audit](QUESTION_BANK_AUDIT.md)
- [x] Implement the exact stable-key/SHA-256 reconciliation gate and privacy-safe deployed-snapshot contract. The independent Cloudboard export remains open.
- [ ] Obtain the Cloudboard/Claude source manifest; prove the 290 owner-provided items and any later pushes.
- [ ] Decide whether DMocks imports the proven Dexam modules or the products converge on one shared package/repository. Recommendation: extract and reuse the assessment domain rather than fork it.

Exit: zero unexplained bank differences and an approved migration/convergence design.

### Phase 1 — portal shell and identity

6 November provider evidence: Google is enabled and controlled local OAuth/PKCE, cancellation, persistence, refresh, sign-out and returning login pass. Only the owner tester is admitted by the server hook. This is not public registration or a hosted release of the later portal migrations. Razorpay is explicitly deferred by the owner; keep sales disabled while other implementation continues.

- [x] Build the server-backed Overview shell and responsive student navigation for exam mocks, All India mocks, topic practice, Learn and Community.
- [ ] Replace the locked module states as each server capability passes its release gate.
- [x] Add candidate onboarding for name, E.164 phone, appearing year, city and selected exams; phone remains explicitly unverified until a service-role OTP callback confirms the exact number.
- [ ] Enable the production Google provider and select an India OTP provider; both require owner-controlled hosted configuration and credentials.
- Implement free/paid route capabilities and exact empty/loading/error/locked states.

Exit: a free candidate can sign in, complete the non-phone profile, navigate, and see correct locks without accessing paid data.

### Phase 2 — assessment core

- [x] Implement immutable attempt snapshots, server deadlines, revisioned autosave, reconnect/reload recovery, scoring and result release. Provider acceptance of representative papers is tracked separately.
- [x] Ship paid topic-practice generation for 10/20/30 questions and 15/30/45-minute server timers, gated by canonical import, deterministic runtime conversion, explicit content/rights approval and verified profiles.
- [x] Prefer unseen objective questions using the caller's own delivery history, including active attempts. Fill exhausted pools from a randomized review set without duplicates. Verify paired accounts, legacy source identities, concurrent starts, eligibility, counts and unchanged snapshots/clocks.
- [x] Ship configurable exam-wise mock generation for UCEED, NID, NIFT and CEED with scrambled/frozen reviewed questions, server timers, verified profiles and an administrator-controlled 0–2 free-attempt allowance before the annual-pass gate.
- [x] Add versioned in-exam question reports with one report per student/issue/version, a 20-per-hour cap and a five-unique-student review hold. Ten students raise priority. All new attempt paths respect the hold, including identical All India papers; existing clocks, snapshots and results remain unchanged. Human decisions require a reason, the current case/bank versions and verified figures for restoration. Corrected canonical sources return to fresh bank review while old delivered versions stay held. General bug reporting and the admin reply workflow are complete.
- [x] Apply All India and combined-exam result holds to owned account exports. Retain saved answers and the student's own report text without review fingerprints. Export published cohort marks, combined results and released teacher feedback; verify ownership, schema and cancellation of downloads across account changes.
- [x] Calculate Overview exam averages from published cohort marks and complete sequential-exam results. Count Part A and Part B as one released test, preserve negative/zero marks and display percentages even without answered objective questions.
- [x] Use the same released Part B human marks and frozen maximum in the paper, recent history, combined report and private export. Keep partial teacher feedback private through full-exam release; label drawing results and reject inconsistent downloads.

Exit: load, authorization, disconnect/reconnect, deadline and scoring tests pass with no key leakage.

### Phase 3 — All India mocks

- [x] Add the admin event workflow with one fixed paper, a ten-day attempt window, a ten-day review window, paid/verified entry, one attempt per account and explicit result release.
- [x] Reproduce cohort ranks from the frozen scores and the applicable tie rule. Keep ranks hidden until release and publish generated aliases.
- [x] Support fixed drawing sections, a 10–15 minute upload window, and combined cohort scores gated on final human review. Keep the complete exam and upload allowance inside the ten-day attempt window.
- [x] Add public top-ten results to the main site and each candidate's released rank to the portal.

Exit: a synthetic cohort completes the same paper; ranks remain hidden until controlled release and reproduce from frozen scores.

### Phase 4 — drawing workflow

- [x] Implement ordered multi-image uploads, a fixed upload window, a scoped anonymous teacher queue, and audited reviewer access and grade overrides. Verify the workflows locally.
- [x] Verify student/teacher image inspection, all eight orientations across PNG/JPEG/WebP, original-size scrolling, keyboard/mobile controls, owned export metadata, account clearing and asynchronous signing revocation in isolated Supabase.
- [ ] Verify upload, retry, removal, private image signing and staff revocation with separate synthetic accounts in isolated staging.
- [ ] Run the AI-assist experiment after rubric, dataset, consent, cost and accuracy gates.

Exit: human-reviewed drawing results are reliable without AI; AI cannot publish or silently change a score.

### Phase 5 — Learn and Community

- [x] Verify the Learn editor for drafts, rights-confirmed publication, withdrawal and revisions. Keep student progress when a lesson is republished.
- [x] Preserve the lesson exam and exact topic when opening practice. Require a selection for shared/unready pools, preserve URL/history context and ignore late start responses after a context/account/navigation change; keep server access gates unchanged.
- [x] Verify complete Community raster validation, metadata removal, author-bound registration, identical retries, saved-text recovery and visibility checks after asynchronous signing. Accept actual local Auth/Storage/Edge and desktop/mobile post/reply images, expiry, moderation races, orientation and accessibility.
- [ ] Import and review the owner's theory documents, link the lessons to reviewed topic pools and verify the Learn workflow in staging.
- [x] Build the first interactive Learn programme (cube nets) with its generated-question engine, shared runner, development preview and browser coverage. Local-only progress for evaluation; server progress, further topics and the build order are tracked in [LEARN_INTERACTIVE_PLAN.md](LEARN_INTERACTIVE_PLAN.md).
- [x] Build moderated posts/comments/helpful-answer foundations and a report queue. Review full current target/parent/discussion content and private images before a reasoned, version-checked hide or dismissal.
- [x] Verify account-bound text request replay, nested reply controls, bounded snapshot/anchor reads, moderation invalidation and preserved view/focus during late writes.
- [x] Collect an explicit report reason and optional details for the exact discussion or reply. Preserve an uncertain request for identical retries, acknowledge existing reports without replacing their original notes, and keep the ten-per-hour server cap and moderation visibility fences.
- [x] Add exact exam/topic filters and bounded 25-row feed pages. Preserve timestamp/UUID snapshots through new insertions, invalidate pages after displayed-content changes, and fence late filter/write/image responses without losing drafts or thread state.
- [x] Community phase 1 behind the preview: long-form articles with drafts, likes and a Top order, private saved folders, a contact-details guard on every post and reply, blocking, and automatic hiding after three reports. Plan, decisions and state are in [community/README.md](community/README.md). Not released; later phases are listed there.
- [x] Community phase 2 behind the preview: accepted answers and an Unanswered list, work for feedback, teacher labels and a featured shelf, moderator holds, administrator pauses enforced on every write, editing with history for the administrator, and safety reports first. Not released; see [community/HANDOFF.md](community/HANDOFF.md).
- [x] Add images to owned saved posts/replies using fresh free positions, immutable selected-file/position retries, existing author/moderation checks and preserved text/original images. Verify real Auth/Edge/Storage and desktop/mobile lost-acknowledgement recovery.
- [x] Inspect current member question/solution rasters with the shared orientation, rotate/mirror, zoom and original-size controls. Bind the dialog to its exact image/URL, close on expiry or scope changes, and prevent delayed close events from affecting a newer selection.
- [x] Browse visible/hidden/locked discussions and their visible/hidden replies in bounded administrator pages. Inspect current context and private images, then record version-checked hide/restore/lock/unlock with written reasons, immutable evidence and account-bound replay. Keep report decisions independent and verify actual Auth/PostgREST/Edge/Storage plus desktop/mobile operation.
- [x] Clear the entire administrator desk after confirmed role loss or failed verification. Guard bulk refreshes, private function requests/downloads, account/history changes and explicit recovery; retain other work after an unavailable target with a verified administrator role. Unit, database and actual provider/desktop/mobile checks pass locally; exact-head CI gates delivery.
- [x] Independently audit and harden teacher-workspace account/history, pending page/media and denied-submission lifecycles. Verify the current reviewer role before mounting, clear the complete scope on role loss/failed verification, remove only a denied assignment/version while preserving other permitted drafts, and fence late queues/grades/signing across explicit view changes. Unit/database and actual provider desktop/mobile acceptance pass locally; exact-head CI gates delivery.
- [x] Harden private bug-report account/history lifecycles, saved acknowledgements and current staff replies. Verify current identity before private data; retain an immutable same-account retry receipt, serialize the shared five-per-hour quota, redact new URL context, page 25 owned reports with raw-microsecond snapshots, fence late work and audit replies with fresh roles after waits. Unit/database and actual Auth/PostgREST desktop/mobile proof pass locally; exact-head PR/main CI gates delivery.
- [x] Audit profile and initial Auth session account/history/late-completion lifecycles. Verify current identity before fields, freeze one save snapshot, require a read after uncertain acknowledgement, suppress overlaps and fence late initial sessions. Reject null input, serialize service verification with saves and read phone proof after row locks. Unit/database and actual provider desktop/mobile proof pass locally; exact-head CI gates delivery. Real OTP remains separate.
- [x] Harden account privacy reads/mutations for account/history changes, late replies/downloads, overlap guards and explicit recovery. Verify captured actors, strict DTOs, bounded deadlines and unknown-commit recovery without replay. Unit/database and actual Auth/PostgREST desktop/mobile proof pass locally; exact-head PR/main CI gates delivery. Reviewed requests preserve accounts and existing retention policy.
- [x] Harden Learn account/history/late-read and completion handling with verified pinned actors, strict coherent DTOs, deadlines, overlap suppression, saved-progress confirmation and explicit unknown-commit recovery without replay. Unit/database, full desktop/mobile and actual provider/SDK proof pass locally; exact-head PR/main CI gates delivery. Preserve free reading and exact exam/topic practice context.
- [x] Bind administrator/reviewer role checks, RPC and Edge dispatch to the verified captured actor before and after SDK notification. Preserve target/version-specific clearing, abort behavior and explicit recovery. Unit, desktop/mobile and actual Auth/PostgREST/Edge/Storage proof pass locally; exact-head CI gates delivery.
- [x] Bind Community RPCs, signing and multipart uploads to verified actors before/after SDK notification; clear account/history/late work with bounded deadlines and explicit recovery, while preserving other permitted drafts after target-specific denial. Unit, database, actual provider/SDK desktop/mobile and the complete local suite pass; exact-head PR/main delivery remains required.
- [x] Bind Overview finalization, history/pass/analytics/catalogue and paper starts to verified actors. Clear account/history snapshots, bound and validate reads, suppress overlaps, recheck identity before navigation and inspect saved state after uncertain starts without replay. Unit/database, actual provider/SDK and the complete 600-journey local suite pass; exact-head PR/main delivery remains required. Preserve fixed server clocks, released-score behavior and offline journals.
- [x] Bind exam/All India/topic catalogues and start requests to verified account/history scope. Validate current choices, bound reads/actions, suppress overlap, pin actors before/after notification, recheck identity before navigation and recover unknown commits through explicit owned-history reads without replay. Retain once-only events, existing free/paid/profile/quality gates and exact practice contexts. Unit/database, actual provider/SDK desktop/mobile and the complete 648-journey local suite pass; exact-head PR/main delivery remains required.
- [x] Verify the current attempt account before exposing successful RPC and media replies. Keep the original bearer on dispatch, reread the session after verification and count verification time against the fixed deadline. See [attempt reply checks](VERIFICATION.md#attempt-reply-identity-and-countdown--10-november-2026).
- [ ] Audit exact token-to-actor binding on remaining assessment/account requests before and after SDK account notification. Preserve existing scopes, offline answer journals, server clocks and target/version fences; add demonstrated regressions before changes. Learn and Community actor binding are verified locally as recorded above. A read-only audit on 11 November found only three unpinned private calls: the staging-admission and drawing-reviewer role probes now use `verifiedRoleCheck`, and an unused default drawing-media invoker and an unused admin `rpc` helper were removed. Every other client already uses the verified account services.
- [x] Page the administrator support queue and require the inspected revision for replies. PR #111 records the queue, concurrency and receipt checks. Student report creation and history retain their existing receipt contract.
- [ ] Complete attachment removal/replacement under an approved evidence-retention plan. Pending image selections survive only within the open page/session.

Exit: content rights, moderation coverage, reporting, retention and child-safety checks pass.

### Phase 6 — commerce and production

- Require complete exact-head PR/main browser outcomes with no failures, skips or retries. The JSON result gate now enforces that rule even when Playwright itself reports success after a diagnostic retry. Retain historical failed/retried runs; accept the prematurely merged Learn PR #93 only through complete corrective delivery and matching-tree main acceptance.
- Razorpay live configuration, production Supabase project, backups, monitoring, rate limits, support runbooks and 150-concurrent-session load test.
- Keep registration and sales as separate switches; launch cohorts gradually.

Exit: production readiness checklist approved, then registration, then payments, then ranked events.

## Decision gates

1. **Code ownership:** recommended—extract the mature Dexam assessment engine into a shared package and use DMocks as the branded product shell. Alternative—copy it once, which is faster initially but creates two security/scoring implementations.
2. **Free allowance:** choose one free mock total or one per exam. Recommendation: one per exam because it demonstrates exam fit without weakening the annual pass.
3. **Learn paywall:** recommendation—full Learn access at launch; charge for assessed practice and ranking. This improves trust and discovery.
4. **Public ranking identity:** choose consented real display name, generated alias, or private-only. Recommendation: generated alias by default with explicit opt-in to display name.
5. **Phone verification provider and budget:** compare India delivery, DLT requirements, abuse tools and per-OTP cost before implementation.
6. **AI drawing authority:** recommendation—advisory only until a labelled validation set proves criterion-level agreement and bias bounds.

## Immediate next actions

1. Review the standalone provider migration plan, including the earlier AI-schema gap and migrations through `202611060147`, and choose an independent staging deployment target before promotion.
2. Obtain the owner's Cloudboard/Claude question manifest and theory-document export. Reconcile supplied question snapshots with stable keys and content hashes through the documented read-only contract.
3. Complete the remaining reviewed exam blueprints, including NID and NIFT creative/programme-specific papers, with authoritative question counts, sections, timing and marking where published.
4. Run hosted acceptance for the admitted Google tester, representative full papers, drawings and teacher review, followed by synthetic staging capacity checks.
5. Obtain the pending source rights, model-processing/cost, phone-provider and public-policy decisions. Keep payments deferred until the owner resumes that work.
6. Audit exact actor binding and late-response lifecycles in Community and the remaining assessment/account clients, then bound/version general support administration and review privacy-operator status/version/audit handling. Preserve verified Learn/profile/privacy/Auth observer and staff token guards, explicit unknown-commit reads without replay, free theory and exact practice links, serialized service-only phone proof, support receipts/history and reply audits. Preserve teacher assignment-specific clearing, other permitted drafts, explicit recovery and grade/signing fences; administrator scopes; versioned Community moderation and independent report decisions; member inspection, follow-up images, bounded admission and private image fences. Define attachment removal/replacement with the retention policy; finish scanner/quarantine and resumable-transfer acceptance and representative hosted image limits on the approved staging target.
