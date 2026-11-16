# Community handoff: where the work stands

The live state of the Community build. Whoever is building updates this at
every checkpoint. Read it first, then [README.md](README.md).

**Last updated:** 16 November 2026. Plan written; waiting for the owner's
approval and answers to the open decisions before phase 1 is built.

## State

- Branch `feature/dmocks-community-phase1`, cut from `main` at `93bed60`.
- Phase 0 (moderated discussions) exists on `main` behind the post-launch
  preview. Nothing in phase 1 is built yet.
- Standing permission for Community: open pull requests, but ask the owner
  before merging.

## Next

1. Owner approves the plan and answers decisions 1 to 5 in
   [05-open-decisions.md](05-open-decisions.md). Record the answers there.
2. Build phase 1 in this order, committing at each step:
   1. `src/community-article.mjs` (Markdown subset, excerpt, contact check)
      and `src/community-library.js` (response validation) with unit tests.
   2. Migration `202611160170_community_articles.sql` and
      `tests/database/community-articles.sql`; add it to
      `scripts/check-database.sh`.
   3. Hub, editor, reader and saved pages; routes behind the existing gate.
   4. `tests/e2e/community-articles.spec.js`, added to the default
      Playwright scope.
   5. Account export covers the new tables.
3. Evaluate with the owner before phase 2.

## Phase 1 journeys that must pass (desktop Chromium and Pixel 7)

1. Write an article with a heading, a list and bold text; preview it; save
   it as a draft; reload; the draft is still there; publish it.
2. The article appears first under Articles, Latest; opening it shows the
   formatted text.
3. An article containing a phone number or a handle is refused with a
   message that says why; nothing is posted.
4. A second student likes the article; the count rises; liking again
   removes it; the author cannot like their own.
5. The second student saves the article into a new folder, sees it on the
   Saved page, renames the folder, removes the save.
6. The second student comments, using the existing threaded replies.
7. The second student blocks the author; the article leaves their feed;
   unblocking restores it.
8. Keyboard only: every control in journeys 1 to 5 is reachable and
   labelled; the accessibility audit reports no violations.
9. Production-mode build: every Community route shows "Coming later".

## How to verify

From `apps/designmocks/`:

```bash
npm test
npm run build
npm run test:e2e
```

CI is blocked, so run these by hand. If the Playwright ports (4399 to
4999, 4689) are in use by another session, run the suite in an isolated
copy with the ports remapped; never stop another session's servers.

Database tests need an empty, disposable local PostgreSQL 17 and
`DESIGNMOCKS_TEST_DATABASE_URL`; this machine has Docker but no local
`psql`, so run them in a throwaway container.

## Not verified yet

Nothing in phase 1 exists to verify. The phase 0 checks were recorded in
`docs/POST_LAUNCH_ROADMAP.md` and `docs/VERIFICATION.md`.
