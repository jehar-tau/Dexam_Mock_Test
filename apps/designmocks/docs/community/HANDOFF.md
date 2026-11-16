# Community handoff: where the work stands

The live state of the Community build. Whoever is building updates this at
every checkpoint. Read it first, then [README.md](README.md).

**Last updated:** 16 November 2026. Phase 1 is built behind the post-launch
preview. Next step is the owner's evaluation, then phase 2.

## State

- Branch `feature/dmocks-community-phase1`, pull request #263. Standing
  permission for Community: open pull requests, but ask the owner before
  merging.
- The owner approved the plan and decisions 1 to 5 on 16 November 2026
  (recorded in [05-open-decisions.md](05-open-decisions.md)).
- Community is still in `deferredModules`. Nothing here is released.

## What phase 1 added

| Area | Files |
|---|---|
| Article format, toolbar edits, contact guard | `src/community-article.mjs` |
| Response checks and failure sentences | `src/community-library.js` |
| Screens | `src/CommunityFrame.jsx`, `CommunityArticles.jsx`, `CommunityEditor.jsx`, `CommunityReader.jsx`, `CommunitySaved.jsx`, `CommunitySaveDialog.jsx`, `CommunityArticle.jsx` |
| Hooks into existing code | `CommunityController.jsx` (section links, `rpc` passed to the View, `loadFeed` option), `CommunityThread.jsx` (`embedded` mode, blocked-reply placeholder, `onBlock`), `Community.jsx` (recovery panels exported) |
| Server | `supabase/migrations/202611160170_community_articles.sql` |
| Tests | `tests/community-article.test.mjs`, `tests/community-library.test.mjs`, `tests/database/community-articles.sql`, `tests/e2e/community-articles.spec.js` |

Routes: `/dashboard/community/articles`, `/write`, `/post/:id`, `/saved`.
`/dashboard/community` is still the discussions page; ten existing browser
specs depend on it.

## Things the next builder must know

- **Contact patterns live in one place.** `CONTACT_PATTERNS` in
  `community-article.mjs` and the array in the migration must be identical;
  a unit test compares them. Use only syntax that means the same in
  JavaScript and PostgreSQL (no `\b`, no lookarounds). To change a pattern
  after this migration has been applied anywhere, add a new migration that
  re-creates `dm_private.community_contact_check` and point the unit test
  at it.
- **Three existing functions were re-created** in the migration
  (`community_feed`, `community_thread`, `report_community_content`) from
  their latest definitions with small additions. If one of them changes
  again, start from this migration's text.
- **Likes are counted on read.** There is no counter column, on purpose: a
  like must not touch the post row, because the moderation version and feed
  paging are derived from it.
- **The reading page is a `View` for `CommunityController`.** Comment
  writes, image upload and signing, retries and reporting are the existing
  code. The View opens its post in a microtask because the session creates
  its request scope in a parent effect.
- **Buttons that keep focus during a request use `aria-disabled`,** not
  `disabled`; a disabled button drops keyboard focus.
- **`export_my_account_data` was not touched** because it is part of the
  paid release. The new private data is exported by
  `export_my_community_library`; joining the two is a release step.
- **The administrator screens accept articles** (body limit raised to
  20,000 and the two new report reasons in the validators), but they still
  label everything "discussion". Wording for articles is phase 2 work.

## Phase 1 journeys (desktop Chromium and Pixel 7), all in `community-articles.spec.js`

1. Write with formatting, preview, save a draft, reload, continue the
   draft, publish, read; the article heads the feed.
2. Contact details refused in the browser and by the server; typed markup
   appears as text and never runs.
3. Like and unlike; Top follows likes; the author has no like button.
4. Save into a new folder; Saved page; rename; duplicate name refused;
   remove the save; delete the folder.
5. Comment; contact details refused in a reply; block from a reply
   (placeholder) and from an article (leaves the feed, cannot be opened);
   unblock from Saved.
6. Keyboard use, accessibility audit on all four pages and the save
   dialog, no horizontal scroll with a very long title.
7. The production-mode build shows "Coming later" on every new route and
   makes no Community request.

## How to verify

From `apps/designmocks/`:

```bash
npm test
npm run build
npm run test:e2e
```

CI is blocked, so run these by hand. The Playwright ports (4399 to 4999,
4689) belong to other work on this machine: run the suite in a copy of the
app with the ports remapped, and never stop another session's servers.

Database tests need an empty, disposable local PostgreSQL 17. This machine
has no `psql`; run `tests/database/bootstrap.sql`, every migration in
order, then the test files inside a throwaway `postgres:17` container.
Starting Colima also starts another project's containers; stop Colima
afterwards.

## Verified on 16 November 2026

See the pull request description for the exact counts of the last run.

## Not verified, and known gaps

- Nothing has run against a real Supabase project: Auth, PostgREST, Storage
  and the `community-media` function were stubbed in the browser journeys.
  Image upload from an article's page uses the existing path and was not
  re-tested for articles.
- `scripts/check-database.sh` was not run as a whole; the migrations and
  the Community, export, privacy, grants and invariants suites were run
  individually in a container.
- The contact guard cannot read text in images, digits written as words or
  a number split across replies.
- Safety reports are not yet listed first for the administrator.
- No published article can be edited or deleted by its author yet
  (decision 5: phase 2).
- "Top" is a single page of 25.

## Next

1. Owner evaluates phase 1 in the preview.
2. Phase 2 as in [01-product-scope.md](01-product-scope.md): questions with
   an accepted answer, work for feedback, teacher label and moderation,
   editing with history, sanctions, safety-first queue order.
