# DMocks provider setup

Current evidence: 7 November 2026. The GitHub app is `jehar-tau/Dexam_Mock_Test/apps/designmocks`; its separate Supabase project is **DesignMocks**, `tiodqzvvujxvxssvjdis`, Mumbai. The existing academy/Dexam projects and merchant credentials are not used.

## Hosting and environment

The owner-connected custom domain **https://dmocks.com** has active DNS/provider validation and HTTPS. The existing Sites project remains `appgprj_6aeac2a10f708191a6fd4160cec11651`, owner-private with no external visitors. A GitHub push does not deploy that Site. Publish only app source through its separate managed checkout; never archive the bank repository root.

Supabase is on the existing Free organisation. No paid plan was enabled here. Production availability, backups, load limits and any paid upgrade still require a reviewed launch decision. Do not create another login/project just to get past a setup problem.

The 7 November read-only inventory verified 25 applied migrations through `202611060102`, with `202611060006_ai_question_drafting.sql` missing from the earlier range. The active Edge Functions are `create-order`, `payment-webhook` and `attempt-media`. The stage admission RPC and later provider capabilities await promotion. The project has one confirmed allowlisted Google account, `test` mode, closed sales and zero orders, passes or published papers. The 2,582 privately imported canonical hold-free records await publication and rights approval.

AI-assisted question drafting is closed by default. Deploy `ai-question-draft` only after setting `OPENAI_API_KEY` and an explicitly approved `OPENAI_DRAFT_MODEL` in the Edge Function secret store. The browser never receives either value. Every request is audited, may reference only active rights-approved bank keys, and can create only a held `pending` draft; a human administrator must review it before any later export or bank promotion.

PDF/photo extraction is also closed by default. The local `question-intake-extract` worker requires `OPENAI_API_KEY` plus a separately approved `OPENAI_INTAKE_MODEL`; without both it returns 503 before claiming a file. When enabled, the private source file is sent to the configured model provider, so approve source rights, image-processing consent, retention and cost before deployment. Files above 10 MB must be split. Structured candidates are bounded to 100, retain page/confidence provenance, receive an immutable `intake-human-review` hold and can only enter the existing draft queue after an administrator corrects and promotes each candidate. Rejecting a candidate is audited; neither extraction nor promotion publishes it to the bank.

An administrator may turn an approved draft into an immutable canonical-review artifact only after supplying a stable external key and a written rights confirmation. The server validates the canonical prompt, type and `provenance.exam`, forces `holds` to an explicitly empty array, records a SHA-256 digest and prevents a draft or key from being exported twice. This artifact is deliberately labelled `git-review-required`: it does not write to the runtime bank. A reviewed change to `server/data/exports/dexam-bank-export.json` on `main` remains the only route into the canonical importer.

Drawing AI inference is not configured or deployed. The database accepts a rubric-linked suggestion only through the service role. Staff authorized to open that review can see the provider, model, rubric version, confidence and evidence. It cannot populate, release or change the human score. Do not connect a model until the owner approves image-processing consent, retention, cost, a labelled validation set and criterion-level accuracy/bias thresholds.

## Controlled Google acceptance

The owner created **DesignMocks Web** in Google Cloud project `designmocks-auth-2026` and entered the credentials directly in Supabase. Real Google sign-in has now passed from both the local app and the owner-private `dmocks.com` publication: account selection, basic identity consent, Supabase callback, PKCE exchange, page-reload persistence, refresh-token rotation through the SDK, sign-out and returning-account sign-in. The returning login retains a single Auth account. Actual cancellation displays a safe retry message. No credential/session token was copied into source or logs by the app.

The server-owned `dm_private.registration_policy` is `testers`; exactly one approved business test account is in `registration_testers`. The global Auth signup switch must be on for Google to create that tester, but the wired before-user-created hook rejects non-Google, anonymous, missing-email and non-allowlisted creation. Public registration is still closed. A real Auth email/password signup probe returns the hook's 403 denial; transactional tests cover unknown Google addresses and the other policy modes. Anonymous student RPCs remain denied. The owner test account has no paid pass, accepted purchase policy or order.

Approved callback destinations are exact:

- `https://dmocks.com/account/callback`
- `https://designmocks-studio.snehal1155.chatgpt.site/account/callback` (retained preview)
- `http://127.0.0.1:4190/account/callback` (controlled local acceptance)

Google's provider redirect remains `https://tiodqzvvujxvxssvjdis.supabase.co/auth/v1/callback`. Do not substitute the app callback for it. The request uses `openid email profile`, without Gmail, Drive or other API access. Google branding settings now save DMocks as the app name, `https://dmocks.com` as the home page and `dmocks.com` as an authorized domain, with the Testing audience preserved. The account chooser still identifies the Supabase callback host. Final public privacy/terms URLs, logo and any required verification remain public-launch work; do not attach draft notices as final policies.

Frontend switches are separate:

- `VITE_TEST_LOGIN_ENABLED=true` permits the controlled account screen for development/staging/test deployments. Direct portal, profile, report, teacher, admin and attempt links show a closed-workspace notice in that build. The Supabase signup hook and server authorization govern actual accounts and RPCs.
- `VITE_STAGING_PORTAL_ENABLED=true` opens the full workspace in an explicit `staging` build only on `staging_frontend_origin` and the designated DMocks Supabase project. It requires a confirmed Google account on the current allowlist, tester-only registration policy and test settings with sales closed. The browser checks admission before mounting protected routes. Account and data RPCs retain their own server authorization.
- `VITE_PORTAL_ENABLED=true` is reserved for a released portal with its published `VITE_TERMS_VERSION`. Production builds require a separate backend from the designated staging project.
- The three switches default false and are mutually exclusive. Browser configuration accepts public publishable/anon keys only. Service and merchant secrets belong in server secret stores.

Use `DMOCKS_AUTH_STAGE=controlled DMOCKS_BACKEND_STAGE=staging npm run test:hosted-setup` after promotion to check anonymous RPC denial, closed checkout and exact-origin media preflights. Use the default `foundation` backend stage to check the original endpoints. Verify the private allowlist and the real Google callback separately.

Review the pending migration ledger before applying changes. The earlier AI schema gap requires explicit inclusion in the reviewed plan, and model-backed functions require separate rights, consent and cost approval. Deploy the matching media and intake-upload functions for the staging origin before the browser acceptance run. Keep the `dmocks.com` deployment on its own approved artifact. The current private Site serves both names, so replacing its artifact requires a hosting decision even though staging sign-in is pinned to the preview hostname.

Reference: https://supabase.com/docs/guides/auth/social-sign-in/auth-google and https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook

## Razorpay — deferred by owner on 6 November

The owner explicitly asked to do Razorpay integration later. Do not continue merchant configuration, request replacement credentials or enable checkout until they resume this work. The incident-remediation requirement below remains outstanding for that future setup.

The separate merchant onboarding has reached website details and offers Test API keys. The setup modal displayed a Test secret in tool output on 6 November. Treat that old Test pair as compromised: the owner must regenerate it and deactivate the old pair before any use. It was not installed in the app or Supabase. Do not repeat it in chat, documentation or logs.

A Supabase **Edge Function Secrets** form was prepared for `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`, with no values entered by the agent. When integration resumes, the owner must paste and save replacements directly; browser credential-handling rules require owner entry. `RAZORPAY_WEBHOOK_SECRET` and actual Test webhook configuration remain additional setup steps; no webhook secret is configured yet.

The current server functions intentionally reject unconfigured checkout/webhook requests. `launch_settings.sales_enabled=false`, `environment_mode=test` and null purchase-policy version remain in force. `PUBLIC_APP_ORIGIN` is currently the old preview origin and must be deliberately aligned to the final checkout test origin when configuring payment acceptance. Do not enable live orders or change existing academy merchant settings.

Before live sales, test server-created ₹1,193 orders, matching Test keys, successful/failed/cancelled simulated payments, exact-body signed webhook delivery, amount/currency/order binding, retries and out-of-order events, annual expiry, duplicate-purchase prevention and approved refund/revocation/reconciliation handling. Browser success callbacks never grant access.

References: https://razorpay.com/docs/payments/dashboard/account-settings/api-keys and https://razorpay.com/docs/webhooks/validate-test

## Remaining release gates

Serve only the canonical main-branch empty-holds bank through the reviewed private import path. Reconcile runtime/media/key readiness and exact exam blueprints; do not equate import eligibility with paper publication. Complete provider/browser acceptance of the installed portal backend before opening its modules. Phone verification, drawing review, moderation, theory material, operational limits and policy decisions remain tracked in PRODUCT_EXECUTION_PLAN.md.

Final operator/contact, younger-student, privacy, purchase/refund, tax/invoice, retention/deletion, backup and monitoring decisions are still needed. The owner must approve public registration and live payments after concrete acceptance evidence. Neither the private Site nor the owner Google login test is a public paid launch.
