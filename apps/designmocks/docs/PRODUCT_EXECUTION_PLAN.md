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
- Every answer change is written locally first and queued to an idempotent server autosave with a monotonic revision. Reconnect flushes pending changes. The server accepts no writes after the deadline.
- At the deadline, the server finalizes the latest accepted answers. This is fairer and safer than forcing a complete retake after an outage.
- Objective scoring is deterministic. Drawing results remain pending until review. Rank publishes only after review closes and ties follow a documented rule.
- The marketing site may show the top ten only under a disclosed public-ranking policy; the exam overview shows the signed-in candidate's rank and cohort statistics.

### Topic practice

- 10/20/30-question choices and 15/30/45-minute timers.
- Prefer unseen ready questions; exclude retired/review-held questions from new sets.
- Practice is paid, while a small sample can remain free.

## Drawing and image evaluation

- Support multiple raster uploads per drawing task, explicit ordering, replacement/removal before final submission, retryable resumable upload and an additional exam-specific 10–15 minute upload phase.
- Files are private, malware/type/size checked, stripped of unnecessary metadata and accessed through short-lived signed URLs.
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
- [x] Prove the new migrations and authorization rules on disposable PostgreSQL 17.
- [x] Add a service-role-only, idempotent canonical-bank importer that reads `origin/main`, imports only explicit empty-holds records and keeps objective readiness separate from import eligibility.
- [ ] Export current Exam-app import state and reconcile every external key/content hash.
- [ ] Obtain the Cloudboard/Claude source manifest; prove the 290 owner-provided items and any later pushes.
- [ ] Decide whether DMocks imports the proven Dexam modules or the products converge on one shared package/repository. Recommendation: extract and reuse the assessment domain rather than fork it.

Exit: zero unexplained bank differences and an approved migration/convergence design.

### Phase 1 — portal shell and identity

- [x] Build the server-backed Overview shell and responsive student navigation for exam mocks, All India mocks, topic practice, Learn and Community.
- [ ] Replace the locked module states as each server capability passes its release gate.
- [x] Add candidate onboarding for name, E.164 phone, appearing year, city and selected exams; phone remains explicitly unverified until a service-role OTP callback confirms the exact number.
- [ ] Enable the production Google provider and select an India OTP provider; both require owner-controlled hosted configuration and credentials.
- Implement free/paid route capabilities and exact empty/loading/error/locked states.

Exit: a free candidate can sign in, complete the non-phone profile, navigate, and see correct locks without accessing paid data.

### Phase 2 — assessment core

- Port immutable attempt snapshots, server deadlines, autosave revisions, scoring and results.
- [x] Ship paid topic-practice generation for 10/20/30 questions and 15/30/45-minute server timers, gated by canonical import, deterministic runtime conversion, explicit content/rights approval and verified profiles.
- [ ] Ship exam-wise mocks against reconciled ready content.
- Add in-exam question reporting and its reviewer queue before broad bank release. General bug reporting and the admin reply workflow are complete.

Exit: load, authorization, disconnect/reconnect, deadline and scoring tests pass with no key leakage.

### Phase 3 — All India mocks

- Admin event/paper workflow, fixed-paper pinning, registration/window/review/release phases, one-attempt constraint, cohort rank and tie rules.
- Public top-ten component with privacy policy and consent.

Exit: a synthetic cohort completes the same paper; ranks remain hidden until controlled release and reproduce from frozen scores.

### Phase 4 — drawing workflow

- Ordered multi-image uploads, upload window, retry/remove/replace, anonymous teacher queue and audited override.
- AI-assist experiment only after rubric, dataset, consent, cost and accuracy gates.

Exit: human-reviewed drawing results are reliable without AI; AI cannot publish or silently change a score.

### Phase 5 — Learn and Community

- Import and review the owner's theory documents; create learning paths and practice links.
- Build moderated posts/comments/helpful-answer workflow and operational moderation tools.

Exit: content rights, moderation coverage, reporting, retention and child-safety checks pass.

### Phase 6 — commerce and production

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

1. Capture the current Exam-app import-run export and execute the stable-key reconciliation.
2. Obtain the owner's Cloudboard/Claude manifest and theory-document export.
3. Approve the shared-engine recommendation or explicitly accept a fork.
4. Build Phase 1 navigation and Overview against fictional data while reconciliation proceeds.
