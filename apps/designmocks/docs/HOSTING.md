# Hosting dmocks.com on GitHub Pages

dmocks.com is a static site: the files Vite builds in `dist/`, with one HTML file
per public route (`papers.html`, `papers/nid.html`…) and `404.html` for every
other path. The backend (sign-in, papers, attempts, figures) is the DMocks Test
Supabase project and does not move with the frontend.

Until 27 Nov 2026, Codex built the site and uploaded it to OpenAI Sites by hand.
`.github/workflows/dmocks-site.yml` now does the same job on GitHub:

1. A push to main runs "DesignMocks checks".
2. When the checks pass, "Publish dmocks.com" builds that exact commit with
   `scripts/build-public-site.mjs`.
3. It publishes the build on GitHub Pages if that commit is still at the tip of main. An older CI run finishing later is skipped. A manual rollback can still publish its explicitly chosen ref.
4. It runs `scripts/check-live-site.mjs` against dmocks.com.

The build script makes the same 151 files, byte for byte, that Codex published
for main `bb33075`. It keeps checkout and sales closed and fails if a preview
route or `checkout.html` reaches the output. It also carries the last 14 days of
hashed scripts between deploys, so a page opened before a deploy keeps working.

## Settings the workflow reads

| Name | Kind | Value |
|---|---|---|
| `DMOCKS_PAGES_ENABLED` | variable | `true` turns publishing on |
| `DMOCKS_SUPABASE_PUBLISHABLE_KEY` | variable | the backend's public `sb_publishable_…` browser key (already in every visitor's browser) |
| `DMOCKS_PUBLISHED_NOTICES_JSON` | secret | the reviewed customer notice bundle (terms and privacy text) |
| `DMOCKS_RELEASED_STUDENT_MODULES` | variable, optional | defaults to `practice` |
| `DMOCKS_PAGES_LIVE` | variable | `true` once dmocks.com points at GitHub Pages; turns on the live check |

## Moving dmocks.com (one time)

1. **Turn on Pages.** In Settings → Pages, set Source to "GitHub Actions" and
   Custom domain to `dmocks.com`. Leave "Enforce HTTPS" for step 5.
2. **Add the settings.** Add the variables and the secret above, with
   `DMOCKS_PAGES_ENABLED=true`.
3. **Publish once.** Run Actions → "Publish dmocks.com" → Run workflow on
   `main`. The site is not reachable yet, because DNS still points at Sites.
4. **Switch DNS at GoDaddy** (the domaincontrol.com nameservers). Do this at a
   quiet hour.
   - Replace the two `A` records for `@` (172.66.3.26 and 162.159.143.30) with
     GitHub's four: `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and
     `185.199.111.153`.
   - Add `CNAME www → jehar-tau.github.io`.
5. **Turn on HTTPS.** Wait until Settings → Pages shows the DNS check as
   passed and the certificate as issued (usually minutes, at most about an
   hour). Then tick "Enforce HTTPS". Set `DMOCKS_PAGES_LIVE=true` and run
   `node scripts/check-live-site.mjs https://dmocks.com`.
6. **Sign in as a test student** and open a paper. Sign-in is unchanged
   because the domain is unchanged.
7. **Keep the last Sites version for a week** as the fallback. Then stop the
   Codex publishing automation and cancel Sites.

**Fallback during the move:** put the two old `A` records back at GoDaddy.

## Everyday publishing and rollback

- **Publishing:** merge to main. The site updates about 20–30 minutes later,
  after the checks and the build.
- **Rolling back:** Actions → "Publish dmocks.com" → Run workflow, with `ref`
  set to the last good main commit.
  The build tooling always comes from current main, so any earlier main commit
  can be rebuilt.
- **Uptime:** `.github/workflows/dmocks-uptime.yml` runs the live check every
  30 minutes once `DMOCKS_PAGES_LIVE=true`. GitHub emails the repository owner
  when a run fails.
- **Publishing without a code change** (for example, new notices): run the
  workflow on `main`.
- **Caching:** GitHub Pages caches each HTML page for up to 10 minutes, so a
  returning visitor can see the previous version that long.

## Not part of this move

These were also done by Codex and are separate from hosting:
- paper releases and database migrations on the Supabase project;
- Edge Function deploys;
- backups;
- the old self-hosted CI runner. CI already runs on GitHub's own runners when no
  runner is mapped.
