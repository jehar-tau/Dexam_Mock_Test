# Community handoff: where the work stands

The live state of the Community build. Whoever is building updates this at
every checkpoint. Read it first, then [README.md](README.md).

**Last updated:** 17 November 2026. Phases 1 and 2 are built behind the
post-launch preview. Next step is the owner's evaluation of phase 2, then
phase 3 (link import).

## State

- Phase 1: branch `feature/dmocks-community-phase1`, pull request #263.
- Phase 2: branch `feature/dmocks-community-phase2`, stacked on phase 1,
  with its own pull request. Merge #263 first.
- Both branches include `main` as of 17 November 2026 (merged cleanly).
- Standing permission for Community: open pull requests, but ask the owner
  before merging.
- The owner approved the plan and decisions 1 to 5 on 16 November 2026 and
  said to start phase 2 on 17 November. Decision 6 (teachers) was built to
  its recommendation and still needs the owner's confirmation.
- Community is still in `deferredModules`. Nothing here is released.

## What each phase added

| Phase | Server | Screens | Tests |
|---|---|---|---|
| 1 | `202611160170_community_articles.sql` | `CommunityFrame`, `CommunityArticles`, `CommunityEditor`, `CommunityReader`, `CommunitySaved`, `CommunitySaveDialog`, `CommunityArticle` | `community-article.test.mjs`, `community-library.test.mjs`, `database/community-articles.sql`, `e2e/community-articles.spec.js` |
| 2 | `202611160171_community_feedback.sql` | `CommunityCards` (Work, Unanswered, shared card), `CommunityWorkForm`, `CommunityStaffDialog`, `CommunityStaff` (admin page), reader rewritten | additions to both unit files, `database/community-feedback.sql`, `e2e/community-feedback.spec.js`, shared `e2e/community-library-fixture.js` |

Routes: `/dashboard/community` (discussions), `/articles`, `/unanswered`,
`/work`, `/work/new`, `/write`, `/post/:id`, `/saved`, all under
`/dashboard/community` and all behind the existing gate. The roles and
pauses panel is on `/admin` under Community moderation.

## Things the next builder must know

- **Generated migrations.** Both Community migrations were generated: the
  re-created functions are copied from their latest definitions with small
  marked additions. If one of them changes again, start from the newest
  migration's text. Phase 2 re-created `community_feed`,
  `community_thread`, `community_articles`, `export_my_community_library`
  and `admin_community_report_queue`.
- **Contact patterns live in one place.** `CONTACT_PATTERNS` in
  `community-article.mjs` and the array in migration 170 must be
  identical; a unit test compares them. Use only syntax that means the same
  in JavaScript and PostgreSQL (no `\b`, no lookarounds). To change one
  after the migration has been applied anywhere, add a migration that
  re-creates `dm_private.community_contact_check` and point the test at it.
- **Guards are triggers.** The contact guard and the pause check run as
  triggers on `community_posts` and `community_comments`, so every writer,
  old or new, is covered.
- **Likes are counted on read.** No counter column, on purpose: a like must
  not touch the post row, because the moderation version and feed paging
  are derived from it.
- **The reading page is a `View` for `CommunityController`.** Comment
  writes, image upload and signing, retries and reporting are the existing
  code. The session's `rpc` is now memoised; child effects may depend on it.
- **After a reply, the thread shows that reply and what follows it** (the
  existing reply-context read). Teacher-first ordering on work posts
  applies to the replies loaded.
- **Edits use the thread version.** `edit_community_post` refuses a stale
  version with `community_thread_changed`; the reader reloads after a save.
- **Stable functions and writes.** In SQL tests, a `stable` read in the
  same statement as a write cannot see that write. Use two statements.
- **Buttons that keep focus during a request use `aria-disabled`,** not
  `disabled`; a disabled button drops keyboard focus.
- **`export_my_account_data` was not touched** because it is part of the
  paid release. The Community library export is separate until release.
- **Browser fixture.** `e2e/community-library-fixture.js` models every
  Community function in memory. Switching accounts mid-test replaces the
  stored session in place (see `signIn`) instead of visiting `/account`.

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

## Verified

17 November 2026, on the phase 2 branch with `main` merged in:

- `npm test`: 845 of 845. `npm run build`, `scripts/check-mvp-profile.mjs`
  and `scripts/check-preview-isolation.mjs` pass.
- Playwright default scope, in a port-remapped copy: 906 of 906, no
  retries. The specs that open `/admin` and every Community spec, full
  scope: 244 of 244.
- PostgreSQL 17 in a container: all 95 migrations apply;
  `community-feedback.sql`, `community-articles.sql`, the seven earlier
  Community suites, `private-account-export.sql`,
  `account-privacy-lifecycle.sql`, `portal-grants.sql` and `invariants.sql`
  pass.
- A final CSS line (left-aligning the feedback template button) went in
  after the browser runs; only the build was rerun.

## Not verified, and known gaps

- Nothing has run against a real Supabase project: Auth, PostgREST, Storage
  and the `community-media` function were stubbed in the browser journeys.
  Image upload on article and work pages uses the existing path and was
  not re-tested for them.
- `scripts/check-database.sh` was not run as a whole; the migrations and
  the Community, export, privacy, grants and invariants suites were run
  individually in a container.
- Work posts allow three images, not the six in the plan.
- A new member's first post is not held for review (decision 4).
- The contact guard cannot read text in images, digits written as words or
  a number split across replies.
- The administrator's existing report and content screens still call every
  post a "discussion".
- "Top" is a single page of 25.

## Next

1. Owner evaluates phase 2 in the preview, and confirms decision 6.
2. Phase 3 as in [01-product-scope.md](01-product-scope.md): link import
   and private link saves. Decision 7 (link policy) is needed first.
