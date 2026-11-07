# DMocks

The independent DMocks website and student portal, inside `jehar-tau/Dexam_Mock_Test` at `apps/designmocks`. Approved offer: **₹1,193 for one year**, one payment, no automatic renewal. The owner-connected **https://dmocks.com** domain is active with HTTPS; hosting remains owner-private.

## Run locally

Use Node 24 (minimum 22.12) and Python 3.9 or newer. From the repository root:

```bash
npm run designmocks:install
npm run designmocks:dev
```

Open http://127.0.0.1:4190/ for the website or http://127.0.0.1:4190/portal-preview for the inside-portal preview. The latter is development-only, explicitly fictional and includes an example report. Its pass, marks and sample account do not grant real access. It is excluded from production builds.

From this app directory, use `npm ci`, `npm run dev`, `npm run check` or `npm run build`. Build output is `dist/`. `npm run preview` serves a production build on port 4191. The original root question-bank studio and commands are preserved.

## What is included

Discovery landing/catalogue/exam/annual-pass pages; light/dark mode; an original five-question timed sample with saved answers, flags, feedback and answer review; Google login integration; the protected account workspace and server-timed MCQ/MSQ/NAT attempts; private raster image signing; ordered drawing uploads with anonymous human review, full raster validation and unnecessary-metadata removal; private student/teacher drawing inspection with automatic orientation, rotate/mirror, zoom and original-size controls; private Community question/solution images with complete validation, metadata removal and attachment retries that preserve the saved discussion, account-bound text replay, bounded threaded replies and exam/topic-filtered feed pages, follow-up image additions with preserved text and reply drafts, student reports with reasons/details and duplicate-safe acknowledgement retries, administrator inspection of reported private images and version-checked report decisions; Learn with exact exam/topic practice links and explicit unavailable-pool choices; reporting, moderation and operational health; a searchable administrator bank review with complete wording, private figures, source/delivery answers and version-checked decisions; automatic question-version holds with audited human review and corrected-source release; a server-created Razorpay order and signed payment webhook.

Real provider acceptance and reviewed-bank publication are incomplete. Actual Google OAuth/PKCE, cancellation, persistence, SDK refresh, sign-out and returning login pass locally and on the private `dmocks.com` publication against the standalone Supabase project. Registration is restricted by the server signup hook to one approved owner tester; public registration, the released portal and sales remain closed. The question-bank work in the repository root is not automatically loaded into or exposed by this website. The owner deferred Razorpay integration on 6 November; checkout must remain disabled until they resume it.

## Configuration and existing preview

Copy `.env.example` to `.env.local` and enter only the standalone project's **public** URL/anon key. Keep `VITE_PORTAL_ENABLED=false` and the terms version blank until launch acceptance. Never put Google client secrets, Supabase service-role keys or Razorpay secrets into Vite variables, source or chat.

For approved login acceptance only, set `VITE_TEST_LOGIN_ENABLED=true` with `VITE_DEPLOYMENT_ENV=development` locally or `staging` for a private hosted build. This mode opens the controlled account screen for sign-in, refresh and sign-out. The server allowlist remains the registration boundary.

For the full private staging portal, build with `VITE_DEPLOYMENT_ENV=staging`, `VITE_STAGING_PORTAL_ENABLED=true` and `npm run build:staging`. Use the project and exact preview origin in `supabase/project.json`. The backend must have migration `202611060128_private_staging_portal.sql` and admit only confirmed Google testers while sales are closed. The browser builds for controlled login, private staging and public release are mutually exclusive. Private staging opens the portal after the server check and keeps purchase terms and checkout closed. See [provider setup](docs/PROVIDER_SETUP.md) for the rollout checks.

The separate Supabase project is `tiodqzvvujxvxssvjdis` (Mumbai). The restrictive signup hook is configured. Later source migrations and Edge Functions remain local until a deliberate staging promotion; source presence is not hosted acceptance. The canonical hold-free bank is privately imported and remains unapproved; private canonical image delivery is accepted. Use an explicit project reference and app working directory for provider operations; never target the academy's staging/production project. Do not rerun migrations blindly against an existing database.

The existing owner-private Site is https://designmocks-studio.snehal1155.chatgpt.site (Site ID `appgprj_6aeac2a10f708191a6fd4160cec11651`). GitHub is now the source repository for the app. **A GitHub push does not automatically deploy this Site.** Its existing managed publication checkout remains separate; no Site token, Git metadata, hosting identity file, ignored environment file or runtime data was copied into this monorepo. To publish, deliberately synchronise only the app's source to that managed checkout and use the existing Site identity and private audience. Never publish the repository root/question bank as a Site archive. A different hosting provider should use `apps/designmocks` as its project root and `dist` as the output, only after an owner-approved deployment setup.

## Verification

```bash
npm run check
npm audit --omit=dev --audit-level=high
npx --yes deno@2.9.6 check supabase/functions/*/index.ts
```

`check` runs unit tests, Python readiness fixtures, the production build, a bundle check excluding local preview/QA content and desktop/mobile browser journeys. Run it with both login switches false for the configuration-free CI fixture. The repository's DesignMocks workflow also checks server function types and the database using an isolated disposable PostgreSQL 17 service, without provider secrets.

For database verification, install `psql` and create an **empty disposable localhost PostgreSQL 17 database**. Set `DESIGNMOCKS_TEST_DATABASE_URL` for that database, then run `npm run test:database`. The script rejects remote hosts and non-empty databases, bootstraps mock Auth/Storage catalogues and applies all current migrations before exercising transactional invariants. This bootstrap must never run on an actual Supabase or student database. It does not simulate real OAuth, Storage SDK signing or merchant acceptance. The hosted project was last verified at 25 migrations and requires deliberate staging promotion before later capabilities can be accepted.

For local browser accessibility checks, open `/?audit=1`, expand Local accessibility QA and run the check. The panel is excluded from production. Mobile, dark mode, keyboard use and live provider acceptance still require their appropriate checks.

`test:e2e` installs the matching Chromium build and runs every desktop/mobile journey. CI uses two workers: the earlier 198-journey run took 8.3 minutes with the runner's one-worker default, leaving little room in the 15-minute job as coverage grows. Retries, all journeys and the merge gate remain enabled. On a minimal Linux host, install system libraries once with `npm run test:e2e:system-deps`. The GitHub Ubuntu image already supplies the native runtime libraries; downloading optional system fonts on every run previously exhausted the 15-minute job limit. Missing runtime dependencies still fail browser launch and the merge gate; no browser tests are skipped.

`DMOCKS_AUTH_STAGE=controlled DMOCKS_BACKEND_STAGE=portal npm run test:hosted-setup` checks the current controlled-login and installed-portal stage. Its default `closed` stage expects globally disabled registration. The default `foundation` backend stage checks only the original endpoints. This read-only HTTP test needs ignored public client configuration and creates no users, orders or payments; the private allowlist and hook decisions require separate SQL/provider acceptance evidence.

Set `DMOCKS_BACKEND_STAGE=staging` and `DMOCKS_AUTH_STAGE=controlled` to check the staging RPC boundaries and exact-origin Edge preflights after promotion. Playwright serves the staging artifact locally and intercepts the provider requests for desktop and mobile.

## Launch status

See [launch checklist](docs/LAUNCH_CHECKLIST.md), [provider setup](docs/PROVIDER_SETUP.md), [verification evidence](docs/VERIFICATION.md), [operations runbook](docs/OPERATIONS_RUNBOOK.md) and [owner decisions](docs/PRODUCT_DECISIONS.md). Controlled Google login and canonical private bank/image imports pass. Verified UCEED/CEED parts, NIFT B.Des. GAT, drawing upload/review, Community, Learn and operational controls are implemented locally; provider promotion and representative hosted acceptance remain separate gates. Remaining work includes NID and the remaining NIFT contexts, drawing/AI provider acceptance, approved policies, production infrastructure and final public-launch approval. Razorpay is deferred by the owner; checkout stays disabled.

## Private canonical image import

`npm run media:manifest` verifies the hold-free export's referenced PNGs against a read-only `DMOCKS_MEDIA_ROOT`: confined paths/symlinks, SHA-256, file type, dimensions and size. It prints counts/digests, never image contents. The images belong outside this app and must never be copied into `public/` or the Site archive.

`npm run media:import` additionally needs the standalone `DMOCKS_SUPABASE_URL` and a server-only `DMOCKS_SUPABASE_SERVICE_ROLE_KEY` in the operator process environment. Never put that key in a Vite variable, source, shell argument or chat. The pipeline uses immutable `papers/canonical/<sha256>.png` objects in the existing private bucket, verifies each authenticated download, then registers metadata through a service-only RPC. Retries verify and reuse matching objects; they do not overwrite unknown files. Registration requires a matching active canonical reference and Storage metadata. It does not approve rights, convert a question for delivery, grant a pass or release a paper.

The canonical-domain API origin is `https://dmocks.com`. The hosted smoke checks use that exact origin; purchases remain closed while Razorpay is deferred.

## Verified question materialization

Canonical ingestion now only imports the exact source records. It does **not** overwrite independently compiled runtime questions. `runtimeReadyTotal` in `bank:manifest` is therefore zero; the separate runtime plan measures actual supported delivery.

`runtime:manifest` reads the service-only verified media catalogue and compiles a deterministic private plan; `runtime:apply` explicitly writes it through the service-only RPC. Both need the same standalone operator environment as the image importer. Never set server credentials in a `VITE_` variable or commit a generated plan containing keys/questions. CLI summaries include counts/digests only. An interrupted apply can be replayed; changed runtime content invalidates approval, while an identical replay preserves it.

The first verified target context is UCEED/CEED **2027 Part A**, based on the current official brochures. Source questions can be older; the target mock's marking context is recorded explicitly. MCQ penalties differ by exam; MSQ uses the verified partial-credit ladder. Numeric strings/ranges preserve source precision, with no invented tolerance. Unresolved figures, malformed notation and unsupported disciplines stay unavailable. NIFT 2027 B.Des. GAT now has its own verified context (100 MCQ, 120 minutes, +1/−0.25); the CAT and other NIFT programmes are not modelled. NID scoring and drawing require their own verified context. Sequential UCEED/CEED Part A and Part B sessions and combined reports are implemented locally; full hosted paper acceptance remains pending. See `docs/EXAM_RULES.md`.

The real provider materialization and complete replay pass: 1,502 privately converted questions, exact comparison of all 2,582 runtime decisions, no approvals and zero released papers. Replaying the original completed canonical import preserves every runtime decision. Sequential Part A/Part B timing is implemented locally; combined reporting, reviewed content and hosted acceptance remain separate release gates.
