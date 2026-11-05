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

Discovery landing/catalogue/exam/annual-pass pages; light/dark mode; an original five-question timed sample with saved answers, flags, feedback and answer review; Google login integration; the protected account workspace and server-timed MCQ/MSQ/NAT attempts; private raster image signing; a server-created Razorpay order and signed payment webhook. Drawing currently means offline drawing and self-review, not uploads or human evaluation.

Real provider acceptance and reviewed-bank publication are incomplete. Actual Google OAuth/PKCE, cancellation, persistence, SDK refresh, sign-out and returning login pass locally against the standalone Supabase project. Registration is restricted by the server signup hook to one approved owner tester; public registration, the released portal and sales remain closed. The question-bank work in the repository root is not automatically loaded into or exposed by this website. The owner deferred Razorpay integration on 6 November; checkout must remain disabled until they resume it.

## Configuration and existing preview

Copy `.env.example` to `.env.local` and enter only the standalone project's **public** URL/anon key. Keep `VITE_PORTAL_ENABLED=false` and the terms version blank until launch acceptance. Never put Google client secrets, Supabase service-role keys or Razorpay secrets into Vite variables, source or chat.

For approved login acceptance only, set `VITE_TEST_LOGIN_ENABLED=true` with `VITE_DEPLOYMENT_ENV=development` locally or `staging` for a private hosted build. This mode does not accept draft purchase terms, expose the unfinished workspace or enable checkout. Production releases reject it. Both login switches default false; do not combine them. The server allowlist remains the actual registration boundary.

The separate Supabase project is `tiodqzvvujxvxssvjdis` (Mumbai). Four migrations are applied/tracked, three Edge Functions deployed, and the closed signup hook configured. Use an explicit project reference and app working directory for provider operations; never target the academy's staging/production project. Do not rerun migrations blindly against an existing database.

The existing owner-private Site is https://designmocks-studio.snehal1155.chatgpt.site (Site ID `appgprj_6aeac2a10f708191a6fd4160cec11651`). GitHub is now the source repository for the app. **A GitHub push does not automatically deploy this Site.** Its existing managed publication checkout remains separate; no Site token, Git metadata, hosting identity file, ignored environment file or runtime data was copied into this monorepo. To publish, deliberately synchronise only the app's source to that managed checkout and use the existing Site identity and private audience. Never publish the repository root/question bank as a Site archive. A different hosting provider should use `apps/designmocks` as its project root and `dist` as the output, only after an owner-approved deployment setup.

## Verification

```bash
npm run check
npm audit --omit=dev --audit-level=high
npx --yes deno@2.9.6 check supabase/functions/create-order/index.ts supabase/functions/payment-webhook/index.ts supabase/functions/attempt-media/index.ts
```

`check` runs unit tests, Python readiness fixtures, the production build, a bundle check excluding local preview/QA content and desktop/mobile browser journeys. Run it with both login switches false for the configuration-free CI fixture. The repository's DesignMocks workflow also checks server function types and the database using an isolated disposable PostgreSQL 17 service, without provider secrets.

For database verification, install `psql` and create an **empty disposable localhost PostgreSQL 17 database**. Set `DESIGNMOCKS_TEST_DATABASE_URL` for that database, then run `npm run test:database`. The script rejects remote hosts and non-empty databases, bootstraps mock Auth/Storage catalogues and applies all current migrations before exercising transactional invariants. This bootstrap must never run on an actual Supabase or student database. It does not simulate real OAuth, Storage SDK signing or merchant acceptance. The hosted project still has only migrations 001–004.

For local browser accessibility checks, open `/?audit=1`, expand Local accessibility QA and run the check. The panel is excluded from production. Mobile, dark mode, keyboard use and live provider acceptance still require their appropriate checks.

`test:e2e` installs the matching Chromium build and runs every desktop/mobile journey. On a minimal Linux host, install system libraries once with `npm run test:e2e:system-deps`. The GitHub Ubuntu image already supplies the native runtime libraries; downloading optional system fonts on every run previously exhausted the 15-minute job limit. Missing runtime dependencies still fail browser launch and the merge gate; no browser tests are skipped.

`DMOCKS_AUTH_STAGE=controlled npm run test:hosted-setup` checks the current controlled-login stage. Its default `closed` stage expects globally disabled registration. This read-only HTTP test needs ignored public client configuration and creates no users, orders or payments; the private allowlist and hook decisions require separate SQL/provider acceptance evidence.

## Launch status

See [launch checklist](docs/LAUNCH_CHECKLIST.md), [provider setup](docs/PROVIDER_SETUP.md), [verification evidence](docs/VERIFICATION.md) and [owner decisions](docs/PRODUCT_DECISIONS.md). Remaining work includes controlled Google callback acceptance, Razorpay onboarding/Test/live setup, source-bank reconciliation/import, complete paper timing/marking, approved policies, production operations and an approved domain/public launch. No real student data or new bank export is included in this app directory.
