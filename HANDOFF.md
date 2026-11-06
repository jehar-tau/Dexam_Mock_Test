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

Choose verification proportional to the change. The complete `npm run check` includes unit, readiness, build, isolation, server-type, and Playwright checks and may take substantially longer than a focused check. Follow `apps/designmocks/README.md` for database, hosted-provider, accessibility, and private-media procedures; never point destructive or bootstrap checks at a real provider database.

## Current durable status

As of 6 November 2026:

- Another Codex build was actively writing sequential exam-part changes when this handoff was introduced. Treat all pre-existing application changes as in-progress user work and inspect them before editing.
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

- Branch: `feature/dmocks-nift-2027-gat` (from `main` at `15c0722`, after PR #55). The sequential exam-part work referenced by the first handoff is merged (PR #53); combined report (#54) and launch readiness gates (#55) are merged too.
- Latest outcome pursued: verified NIFT 2027 B.Des. GAT exam mock context (100 MCQ, 120 minutes, +1/−0.25), checked on 6 November 2026 against the NIFTEE 2027 Information Bulletin (16 October 2026), printed pages 18–20, sections 3.4 and 3.7.
- Uncommitted changes: `apps/designmocks/scripts/question-runtime.mjs` (`niftee-2027-bdes-v1` rule), `scripts/materialize-bank-runtime.mjs` (routes NIFT records to the new RPC; plan version `verified-2027-v2`), `supabase/migrations/202611060121_verified_nift_bdes_gat.sql` (fixed NIFT blueprint and service-only `upsert_nift_question_bank_runtime_batch`; blueprint is not enabled), `src/ExamMocks.jsx` (preview fixture), `tests/database/verified-nift.sql`, `tests/database/portal-grants.sql`, `scripts/check-database.sh`, `tests/question-runtime.test.mjs`, `tests/e2e/launch-foundation.spec.js`, and docs (`README.md`, `docs/EXAM_RULES.md`, `docs/LAUNCH_CHECKLIST.md`).
- Checks passed: `npm test` (55/55), `npm run build`, `check-preview-isolation.mjs`, Playwright `exam-wise mocks` on chromium and mobile-chromium. Offline compile of `origin/main` canonical bank: 155 of 298 eligible NIFT records compile, all four-option, single-key, hold-free, figure-free (enough for 100).
- PR: https://github.com/jehar-tau/Dexam_Mock_Test/pull/56 (Auto-fix on). First CI run failed because the NIFT database test skipped the fresh review that runtime changes require; fixed in `17385a2`. `npm run test:database` then passed in full against a disposable `postgres:17` Docker container.
- Not run locally: the full `npm run check`, `test:server-types`, and the hosted `runtime:manifest`/`runtime:apply`.
- Next action: wait for PR #56 CI, then owner review and merge. Hosted materialization and releasing the NIFT blueprint need explicit owner authorization. The NIFT CAT and NID contexts remain unmodelled.
