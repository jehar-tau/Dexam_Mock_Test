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
- The drawing-review slice binds upload and removal to the authenticated student, closes the evidence before a teacher can claim it, and uses revision checks for grading and release. The administrator form totals criterion marks, and overrides are audited and require explicit re-release.
- Local evidence includes 59 JavaScript tests, four Python fixtures, 54 browser journeys, scoped desktop/mobile accessibility checks, the server-function type check, and all 46 migrations with transactional suites on disposable PostgreSQL 17.
- Next assessment dependency: connect the closed drawing upload and grading workflow to All India results. Provider deployment and acceptance still require the matching migration, drawing media functions and UI in an isolated staging environment.
