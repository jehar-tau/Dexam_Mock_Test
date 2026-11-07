# DesignMocks Agent Handoff

This file is the durable handoff between Codex, Claude Code, and future coding-agent sessions. Read it before making changes, then inspect the live repository state because this document may lag behind the working tree.

## Working directories

- Repository root: `/Users/snehalkumarshinde/Desktop/Projects/DesignMocks Codex/Dexam_Mock_Test`
- DesignMocks app: `/Users/snehalkumarshinde/Desktop/Projects/DesignMocks Codex/Dexam_Mock_Test/apps/designmocks`
- Start agents from the repository root so they can see repository-wide instructions, history, and changes.

## Goal

Continue building and validating the independent DesignMocks (`DMocks`) website and student portal described in `apps/designmocks/README.md`, while preserving its security, privacy, product, and launch constraints.

The approved product direction is an original Discovery-style experience using the paper/forest/orange palette, Figtree and Zilla Slab, geometric SVG artwork, readable typography, and complete light/dark modes. The approved offer is ₹1,193 for one year, paid once, with no automatic renewal.

Treat `apps/designmocks/README.md` and its linked launch, provider, verification, operations, and product-decision documents as the current source of truth for completed work and remaining launch gates. Do not infer that locally implemented functionality is production-approved.

## Mandatory constraints

Before editing, read:

1. `apps/designmocks/AGENTS.md`
2. `apps/designmocks/README.md`
3. The documentation relevant to the requested task

In particular:

- DesignMocks is separate from Dexam student accounts, fixtures, payment credentials, and private data.
- Keep public registration, real sales, and paid access fail-closed until the separately documented provider and server acceptance work is complete.
- Never grant paid access from browser storage or a Razorpay success callback. Only a verified server event may grant access.
- Razorpay integration is deferred; checkout must remain disabled until the owner explicitly resumes it.
- Do not expose or commit credentials, personal student data, the reviewed question bank, private images, generated runtime plans, or ignored environment files.
- Do not put service-role keys, Google client secrets, or Razorpay secrets in Vite variables, source code, shell arguments, chat, or this file.
- Do not blindly apply migrations or provider operations. Use the explicit standalone project and follow the provider documentation.
- Preserve unrelated existing changes and reference work outside public assets.

## Resume procedure

At the beginning of every Codex or Claude Code session:

1. Run `git status --short --branch` and inspect `git diff` plus `git diff --cached`.
2. Read recent commits with `git log -10 --oneline --decorate`.
3. Read this file, `apps/designmocks/AGENTS.md`, and `apps/designmocks/README.md`.
4. Identify the user's latest requested outcome. Do not invent a new launch scope from the general project description.
5. Inspect the implementation and relevant docs before changing code.
6. Preserve existing work, then implement and verify the requested outcome.
7. Update this file only when the durable goal, constraints, run instructions, or meaningful pending work changes.

Suggested agent prompt:

> Continue the DesignMocks work from the current repository state. Read `HANDOFF.md`, `apps/designmocks/AGENTS.md`, and `apps/designmocks/README.md`; inspect Git status, diffs, and recent commits; preserve existing changes; then pursue the latest requested outcome through implementation and appropriate verification. Keep registration, checkout, paid access, secrets, private data, provider promotion, and deployment fail-closed unless the owner explicitly authorizes the relevant step.

## Run and verify

From the repository root:

```bash
npm run designmocks:install
npm run designmocks:dev
```

The local website is at `http://127.0.0.1:4190/`; the development-only portal preview is at `http://127.0.0.1:4190/portal-preview`.

From `apps/designmocks`:

```bash
npm ci
npm run dev
npm run build
npm run check
```

`npm run test:database` needs an empty, disposable localhost PostgreSQL 17 in `DESIGNMOCKS_TEST_DATABASE_URL`. CI provides one; locally, a throwaway `postgres:17` Docker container works. Copy both `tests/` and the whole `supabase/` folder into it, because the suite also runs `supabase/tests/controlled_signup.sql`.

Choose verification proportional to the change. The complete `npm run check` includes unit, readiness, build, isolation, server-type, and Playwright checks and may take substantially longer than a focused check. Follow `apps/designmocks/README.md` for database, hosted-provider, accessibility, and private-media procedures; never point destructive or bootstrap checks at a real provider database.

## Current durable status

As of 7 November 2026:

- Sequential UCEED/CEED Part A → Part B sessions (PR #53), the combined exam report (#54) and audited launch-readiness gates (#55) are merged to `main`.
- NIFT 2027 B.Des. GAT (100 MCQ, 120 minutes, +1/−0.25) is merged in PR #56. Its blueprint stays unreleased. The NIFT CAT, B.F.Tech. Section B, other NIFT programmes and NID are not modelled.
- Any runtime write resets a bank question's `owner_approved` and `rights_confirmed` (`dm_private.reset_bank_review_on_change`), so freshly materialized questions need `admin_review_bank_question` again before a blueprint counts them.
- The app includes the public catalogue/offer experience, timed sample, protected workspace foundations, reporting/moderation/operations work, and server-side payment/provider foundations described in the README.
- Controlled Google login and the private canonical bank/image import have documented acceptance, but later local provider migrations and capabilities still require deliberate staging promotion and representative hosted acceptance.
- Public registration, the released portal, sales, and checkout remain closed.
- Razorpay remains explicitly deferred.
- Remaining launch work and owner decisions are tracked in the app documentation; read those files instead of treating this summary as exhaustive.

## Ending a session

Before switching agents or pausing for quota reset:

1. Leave the working tree in a coherent state; do not discard another agent's changes.
2. Run the most relevant verification available and record failures honestly.
3. Update the section below with the exact latest request, completed work, files changed, checks run, failures, and next action.
4. Prefer a normal commit when the work is complete and the user has requested or approved committing. Otherwise leave a clear diff for the next agent.

## Latest session checkpoint

- PR #56 merged the NIFT 2027 B.Des. GAT contract in `74a81fd`. Offline compilation produced 155 of 298 eligible NIFT records. Hosted materialization, replay, rights review and blueprint release are pending.
- PR #57 bound drawing uploads to the authenticated student and added versioned teacher claims, grading and audited overrides. PR #58 linked that workflow to fixed All India drawing windows and combined cohort results. Both merged after GitHub CI.
- PR #59 added a device journal for unsynced answers. The server revision wins conflicts and the original server deadline determines which answers count.
- PR #60 restricted Overview and Learn performance to released attempts. PR #61 restricted signed-in testers to the account flow in the controlled-login build. A fictional browser session exercises direct-route denial, refresh and sign-out.
- PR #62 added `/review/drawings` and audited administrator access controls. An isolated Supabase stack passed Auth, drawing upload and removal, private image signing, grading and access revocation using synthetic accounts.
- PR #63 added the Learn editor for private drafts, versioned edits, rights-confirmed publication and withdrawal. Students keep their completion when a withdrawn lesson is revised and republished.
- PR #64 added the private staging build with exact hostname, project and server tester admission. The read-only hosted inventory found 25 migrations, three active Edge Functions and the older missing AI schema migration `202611060006`. The provider dry run through `202611060128` listed 27 pending migrations. The existing private Site shares the preview and `dmocks.com` hostnames.
- AI drafting checks reference rights at request and completion. Its service records canonical held drafts. Human approval and a rights note create the Git review artifact. The real importer and UCEED compiler accepted the artifact in isolated Supabase with a fictional model response.
- PDF/photo intake now has structured corrections, manual transcription of several questions per source, authenticated original downloads and retained question-only PNG crops. Migration `202611060130` validates canonical answers and figures, preserves source lineage and review holds, and serializes per-source review/retry operations. Artifacts still enter the bank through a reviewed Git change. Synthetic isolated Supabase acceptance passed real Auth/Storage/Edge, concurrent figure uploads and review decisions, manual retry deduplication, and the actual importer/private-media/runtime-writer handoff. The extraction response was fictional. Its live model deployment and hosted acceptance are pending.
- Question extraction and AI drafting now have five-minute expiry, bounded service recovery, explicit admin retries and private processing tokens. Matching workers reject late completions and failures from an older retry. AI retries retain creator authorization and reference-rights checks. Synthetic Supabase acceptance passed real Auth/Edge source upload, HTTP overloads, the operations runner, concurrent held responses and legacy service compatibility. Migration `202611060131`, both model workers and the operations runner require a coordinated approved staging rollout.
- The complete `/admin` bank browser replaces the first-25 list with searchable pagination, exam/type/topic/status filters, full canonical questions and answers, compiled keys/marking and private figures. A written review checks an exact version covering source/runtime/review state/local holds; incomplete media cannot be approved. Migration `202611060132` and `bank-review-media` need promotion with the frontend. Isolated synthetic Supabase acceptance passed real Auth, the importer/compiler/runtime writer, private PNG signing and byte verification, both HTTP review overloads, stale/missing-object denial and administrator revocation. Students and drawing-only teachers cannot access the bank.
- Delivered-version reports now trigger a hold at five unique students and high priority at ten, with a twenty-per-hour account cap. Every new attempt path is fenced against the report threshold; fixed All India papers pause admission while existing snapshots/clocks/results remain unchanged. Admin review opens the full delivered snapshot and signed private figures, checks both case and bank versions, audits human actions and separates corrected-source release from fresh bank approval. Student receipts omit answer-dependent review identifiers. Migration `202611060133`, `reported-question-media` and the matching frontend require a coordinated staging rollout. Isolated Supabase acceptance passed a deliberately queued threshold/admission race, actual Auth/import/compiler/runtime writes, both resolver HTTP overloads, signed PNG bytes, corrected-source replay, new-version counts and access revocation.
- Account export schema 2 now withholds All India/combined-exam marks through their release boundary, preserves own answers/report text without private review hashes, and exports published cohort and Part B human scores plus released feedback. The browser verifies ownership/schema/release fields and aborts pending downloads on account changes or navigation. Migration `202611060134` requires the matching frontend. Isolated real Auth/PostgREST acceptance passed cohort publication, a full-count 57-question Part A with two drawing tasks, upload/partial-teacher-release holds, final 89/300 and 85/100 marks, cross-account denial and enabled-reviewer isolation. No hosted or payment state changed.
- Local evidence includes 94 JavaScript tests, four Python fixtures, 120 browser journeys, all eleven server-function type checks, zero production dependency findings and all 60 migrations with transactional suites on disposable PostgreSQL 17.
- The fresh read-only hosted ledger still has 25 applied versions. Comparison with the 60 current migration files leaves 35 pending, including the older AI schema gap. The current private Site shares the preview hostname and `dmocks.com`; a staging promotion still needs a deliberate provider and hosting decision.
- Overview exam percentages now use published cohort marks and count a complete Part A/Part B session once with its combined human-inclusive result. Negative/zero ordinary scores remain exact; cards render even without objective accuracy. Migration `202611060135` and the matching frontend require staging promotion. Disposable PostgreSQL regressions and desktop/mobile dashboard, WCAG and reflow journeys pass.
- Part B paper, recent history and export now use released human marks and the frozen drawing maximum through the private visibility query. Partial review marks/comments/criteria stay sealed through full-exam release, and the UI labels drawing results. Downloads reject inconsistent totals and part/report marks. Migration `202611060136` requires the matching frontend. Real isolated Auth/Storage/PostgREST acceptance passed a full 57-question session, early reviewer denial, partial/full teacher release, 85/100 and 89/300 results, role isolation and unchanged frozen data. The owned stack was removed; credential-free counts/source are in ignored `.dmocks-local-evidence/`.
- Next safe product slice: fulfil the execution plan preference for unseen questions in topic practice, with randomized fallback when needed. Preserve approval, paywall, quality holds, snapshot and deadline rules; inspect the latest generator before editing.
- Provider promotion needs a reviewed migration plan including the older gap, matching Edge Functions, a private staging artifact and synthetic acceptance. Content rights, owner theory export and deferred payments are tracked in the launch checklist.
