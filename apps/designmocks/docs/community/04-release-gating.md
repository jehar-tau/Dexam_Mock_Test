# 4. Release gating

## How it is gated today

- `src/launch-scope.mjs` lists Community in `deferredModules`. In a
  production build `/dashboard/community` shows the "Coming later" page.
- The real screens render only when `postLaunchPreview` is true: the
  deployment is `development`, `staging` or `test` **and**
  `VITE_POST_LAUNCH_PREVIEW=true`.
- Community is absent from `launchNavigation`, so the sidebar does not link
  to it in the released build.
- No Community function is in `supabase/launch/paid-mvp-rpcs.json`. The
  paid release applies every migration and then the companion profile
  `supabase/launch/paid-mvp.sql`, which leaves only the listed functions
  callable, so the released backend refuses Community calls even if a
  client made them.

Learn was released on 16 November 2026 by moving it into
`releasedModules`. Learn's programmes run in the browser. Community does
not: it needs its migrations, its server function for images and people to
moderate it. Its release is therefore a larger step than Learn's.

## What stays behind the flag

Everything in this plan, in every phase, until the owner releases it:

- every route under `/dashboard/community`, including the new article,
  write, reading and saved pages;
- the administrator's moderation screens;
- all Community migrations and functions on any hosted project;
- the `community-preview` fixtures, which exist only in development builds.

Each phase's Playwright file adds one assertion that the production-mode
build still shows "Coming later" for its new routes, and
`scripts/check-mvp-profile.mjs` and `check-preview-isolation.mjs` keep
passing unchanged.

## Releasing Community (not part of phase 1)

When the owner decides to release, the change is small in code and large
in checks. In one pull request:

1. Add `community:'Community'` to `releasedModules`, remove it from
   `deferredModules`, add the navigation entry.
2. Route `/dashboard/community/*` on `releasedModules`, not on
   `postLaunchPreview`.
3. Add the Community functions to the release function list
   (`paid-mvp-rpcs.json` and the manifest block in `paid-mvp.sql`).

Before that pull request merges:

- [ ] Open decisions 1 to 4 and 6 in document 5 are answered and recorded
      in `docs/PRODUCT_DECISIONS.md`.
- [ ] At least one teacher account and the administrator's own account are
      given their Community roles on the target project.
- [ ] Database tests for every Community migration pass on PostgreSQL 17.
- [ ] Migrations and the `community-media` function are promoted to
      staging and the staging journeys pass, including image upload.
- [ ] A named moderator, a review rhythm and a safety-report procedure
      exist (document 3).
- [ ] The published terms and privacy notice cover Community content,
      reporting, moderation and retention.
- [ ] `export_my_account_data` includes the Community library
      (`export_my_community_library`), and deletion is verified.
- [ ] The Community rules panel is approved by the owner.
- [ ] If the extension is released too: add `extension_community_folders`
      and `extension_save_community_link` to the release profile with
      public-key access, publish the extension (document 7) and update the
      privacy notice.
- [ ] Unit tests, build and the full Playwright suite pass on the exact
      commit.

Merging to `main` does not deploy `dmocks.com`; the site is published from
the owner's separate Sites project. Releasing Community therefore also
needs the owner to publish.
