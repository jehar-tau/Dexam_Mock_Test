# Community handoff: where the work stands

The live state of the Community build. Whoever is building updates this at
every checkpoint. Read it first, then [README.md](README.md).

**Last updated:** 17 November 2026. Phases 1 to 3 are built behind the
post-launch preview. The owner asked to continue through every remaining
phase: phase 4 (browser extension), phase 5 (prep space) and the Learn
audio track are next, each as its own stacked pull request.

## State

- Phase 1: branch `feature/dmocks-community-phase1`, pull request #263.
- Phase 2: branch `feature/dmocks-community-phase2`, pull request #266,
  stacked on phase 1. Merge #263 first.
- Phase 3: branch `feature/dmocks-community-phase3`, pull request #267.
- Phase 4: branch `feature/dmocks-community-phase4`, pull request #268.
- Phase 5: branch `feature/dmocks-community-phase5`, stacked on phase 4.
- Both branches include `main` as of 17 November 2026 (merged cleanly).
- Standing permission for Community: open pull requests, but ask the owner
  before merging.
- The owner approved the plan and decisions 1 to 5 on 16 November 2026,
  said to start phase 2 on 17 November, confirmed decision 6 (teachers) as
  built, and asked for every remaining phase to be built.
- Community is still in `deferredModules`. Nothing here is released.

## What each phase added

| Phase | Server | Screens | Tests |
|---|---|---|---|
| 1 | `202611160170_community_articles.sql` | `CommunityFrame`, `CommunityArticles`, `CommunityEditor`, `CommunityReader`, `CommunitySaved`, `CommunitySaveDialog`, `CommunityArticle` | `community-article.test.mjs`, `community-library.test.mjs`, `database/community-articles.sql`, `e2e/community-articles.spec.js` |
| 3 | `202611170172_community_links.sql`; `_shared/community-link.mjs`; `link` action in `community-media` | `CommunityLinks` (preview, save form, saved link, suggest form), `CommunityLinkReview`, Links view in `CommunityCards`, link posts in the reader | `community-link.test.mjs`, additions to `community-library.test.mjs`, `database/community-links.sql`, `edge/community-link-preview.test.mjs`, `e2e/community-links.spec.js` |
| 4 | `202611170173_community_extension.sql` | `extension/` (popup, core), `scripts/build-extension.mjs`, `CommunityExtension` on Saved, Get preview on saved links | `community-extension.test.mjs`, `database/community-extension.sql`, `e2e/community-extension.spec.js` |
| 5 | `202611170174_community_prep.sql` | `CommunityPrep` (My prep), `CommunityNotePanel` on post pages, `CommunityLearnSave` on Learn programme pages (preview only, not on staging) | additions to `community-library.test.mjs`, `database/community-prep.sql`, `e2e/community-prep.spec.js` |
| 2 | `202611160171_community_feedback.sql` | `CommunityCards` (Work, Unanswered, shared card), `CommunityWorkForm`, `CommunityStaffDialog`, `CommunityStaff` (admin page), reader rewritten | additions to both unit files, `database/community-feedback.sql`, `e2e/community-feedback.spec.js`, shared `e2e/community-library-fixture.js` |

Routes: `/dashboard/community` (discussions), `/articles`, `/unanswered`,
`/work`, `/work/new`, `/links`, `/review`, `/prep`, `/write`, `/post/:id`, `/saved`, all under
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
- **No new server function.** Adding a directory under
  `supabase/functions` changes counts that the staging readiness, hosted
  commerce and admission tests check. Link previews are therefore a `link`
  action of `community-media`. The extension in phase 4 must follow the
  same rule or update those tests deliberately.
- **Edge tests import handlers by a computed path.** A fixed path pulls the
  handler into Deno's up-front type check, which needs Node type
  definitions this project does not install.
- **Social-site list lives in one place.** `socialHosts` in
  `_shared/community-link.mjs` and the array in migration 172 must match;
  a unit test compares them.
- **Public-key functions.** The two `extension_*` functions are the only
  Community functions granted to the public key. The paid release profile
  revokes them; the database script's grant comparison checks that.
- **Extension popup tests** serve `extension/` from a stand-in origin with a
  minimal `chrome.*` (see `installExtension` in the fixture). Copying to
  the clipboard takes window focus from the test page, so that journey
  checks the popup's active element instead of `toBeFocused`.
- **Staging portal.** The private staging portal runs with the preview on
  but its backend has no Community migrations. Anything Community adds to
  a page outside Community (like Save to my prep on Learn) must be hidden
  when `stagingPortalMode` is on; `staging-portal.spec.js` refuses
  unexpected requests and caught this.
- **Export version checks** in the database tests require "at least" the
  version that phase added, so later phases can extend the export.
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

17 November 2026, on the phase 5 branch:

- `npm test`: 870 of 870. `npm run build`, `scripts/check-mvp-profile.mjs`
  and `scripts/check-preview-isolation.mjs` pass.
- Playwright default scope, in a port-remapped copy: 930 of 930, no
  retries. Every Community spec, the Learn specs and the admin access
  spec, full scope: 448 of 448 (run before the staging-portal fix, which
  only hides a Learn button on staging; the prep and staging specs then
  passed 96 of 96 over three repeats).
- PostgreSQL 17 in a container: all 98 migrations apply; the five phase
  test files, the seven earlier Community suites, export, privacy, grants
  and invariants pass; the paid release profile and grant comparison pass.

## Not verified, and known gaps

- Nothing has run against a real Supabase project: Auth, PostgREST, Storage
  and the `community-media` function were stubbed in the browser journeys.
  No link preview has fetched a real web page; whether the hosted runtime
  offers `Deno.resolveDns` (the private-address DNS check) is unverified.
  Image upload on article and work pages uses the existing path and was
  not re-tested for them.
- `scripts/check-database.sh` was not run as a whole; the migrations and
  the Community, export, privacy, grants and invariants suites were run
  individually in a container.
- Work posts allow three images, not the six in the plan.
- The extension has not been loaded into a real Chrome; its popup was
  tested in Chromium from a stand-in origin with a stand-in `chrome.*`.
- A new member's first post is not held for review (decision 4).
- The contact guard cannot read text in images, digits written as words or
  a number split across replies.
- The administrator's existing report and content screens still call every
  post a "discussion".
- "Top" is a single page of 25.

## Next

1. Owner evaluates phase 2 in the preview, and confirms decision 6.
2. Owner confirms decision 7 (link policy), built to its recommendation,
   and decides on publishing the extension (decision 8).
3. Learn audio track, then folder ordering if the owner wants it.
