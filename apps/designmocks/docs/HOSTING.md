# Hosting dmocks.com on GitHub Pages

dmocks.com is a static site: the files Vite builds in `dist/`, with one HTML file
per public route (`papers.html`, `papers/nid.html`…) and `404.html` for every
other path. The backend (sign-in, papers, attempts, figures) is the DMocks Test
Supabase project and does not move with the frontend.

Until 28 Nov 2026, Codex built the site and uploaded it to OpenAI Sites by hand.
`.github/workflows/dmocks-site.yml` now does the same job on GitHub:

1. A push to main runs "DesignMocks checks".
2. When the checks pass, "Publish dmocks.com" builds that exact commit with
   `scripts/build-public-site.mjs`.
3. It publishes the build on GitHub Pages.
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

## How dmocks.com reaches GitHub Pages (since 28 Nov 2026)

GitHub could not issue its own HTTPS certificate for dmocks.com (it stuck twice,
on 27 and 28 Nov), so Cloudflare's free plan sits in front of GitHub Pages:

- **Registrar:** GoDaddy. The nameservers point at Cloudflare
  (`plato.ns.cloudflare.com`, `rosalie.ns.cloudflare.com`).
- **DNS:** Cloudflare, in the owner's account. `dmocks.com` has two `A` records,
  `185.199.108.153` and `185.199.109.153` (GitHub Pages), both **proxied**.
- **HTTPS:** Cloudflare's Universal certificate serves visitors. SSL/TLS mode is
  **Full** (not Full strict), because GitHub answers Cloudflare with its
  `*.github.io` certificate. "Always Use HTTPS" is on. Leave "Enforce HTTPS"
  in GitHub Settings → Pages off.
- **www:** still GoDaddy forwarding (`A` records 15.197.225.128 and
  3.33.251.168, DNS only), a 302 to https://dmocks.com.
- **Kept from Sites:** the `_cf-custom-hostname` and `_openai-site-verification`
  TXT records. Delete them once Sites no longer lists dmocks.com.

**Checking which host answers:** a GitHub response carries an
`x-github-request-id` header, for example
`curl -sI https://dmocks.com/robots.txt | grep -i x-github`.

**Rolling the domain back to Sites:** in Cloudflare → DNS, set the two `A`
records back to `172.66.3.26` and `162.159.143.30` with the proxy **off** (DNS
only). Sites must still list dmocks.com as its custom domain for this to work.
While the records are proxied, the old Sites addresses answer "error 1034".

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
