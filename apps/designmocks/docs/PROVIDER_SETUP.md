# DMocks provider setup

Current evidence: 6 November 2026. The GitHub app is `jehar-tau/Dexam_Mock_Test/apps/designmocks`; its separate Supabase project is **DesignMocks**, `tiodqzvvujxvxssvjdis`, Mumbai. The existing academy/Dexam projects and merchant credentials are not used.

## Hosting and environment

The owner-connected custom domain **https://dmocks.com** has active DNS/provider validation and HTTPS. The existing Sites project remains `appgprj_6aeac2a10f708191a6fd4160cec11651`, owner-private with no external visitors. A GitHub push does not deploy that Site. Publish only app source through its separate managed checkout; never archive the bank repository root.

Supabase is on the existing Free organisation. No paid plan was enabled here. Production availability, backups, load limits and any paid upgrade still require a reviewed launch decision. Do not create another login/project just to get past a setup problem.

The hosted database currently has migrations 001–004, three Edge Functions and the private paper-media bucket. Later portal migrations on GitHub have not yet been applied to this hosted project. Local/CI implementation evidence does not establish hosted release readiness.

## Controlled Google acceptance

The owner created **DesignMocks Web** in Google Cloud project `designmocks-auth-2026` and entered the credentials directly in Supabase. Real Google sign-in has now passed from the local app: account selection, basic identity consent, Supabase callback, PKCE exchange, page-reload persistence, refresh-token rotation through the SDK, sign-out and returning-account sign-in. The returning login retains a single Auth account. Actual cancellation displays a safe retry message. No credential/session token was copied into source or logs by the app.

The server-owned `dm_private.registration_policy` is `testers`; exactly one approved business test account is in `registration_testers`. The global Auth signup switch must be on for Google to create that tester, but the wired before-user-created hook rejects non-Google, anonymous, missing-email and non-allowlisted creation. Public registration is still closed. A real Auth email/password signup probe returns the hook's 403 denial; transactional tests cover unknown Google addresses and the other policy modes. Anonymous student RPCs remain denied. The owner test account has no paid pass, accepted purchase policy or order.

Approved callback destinations are exact:

- `https://dmocks.com/account/callback`
- `https://designmocks-studio.snehal1155.chatgpt.site/account/callback` (retained preview)
- `http://127.0.0.1:4190/account/callback` (controlled local acceptance)

Google's provider redirect remains `https://tiodqzvvujxvxssvjdis.supabase.co/auth/v1/callback`. Do not substitute the app callback for it. The request uses `openid email profile`, without Gmail, Drive or other API access. Google branding still displays the Supabase host in the consent screen; complete the actual product branding/domain setup before public launch.

Frontend switches are separate:

- `VITE_TEST_LOGIN_ENABLED=true` permits the labelled controlled login screen only for development/staging/test deployments. It does not grant a paid entitlement or accept draft terms.
- `VITE_PORTAL_ENABLED=true` is reserved for a released portal with its published `VITE_TERMS_VERSION`. It cannot be combined with controlled login mode.
- Both default false. Browser configuration accepts public publishable/anon keys only. Service and merchant secrets remain server-only. A production release rejects controlled login; an explicitly staged build is required for the private hosted acceptance screen.

Use `DMOCKS_AUTH_STAGE=controlled npm run test:hosted-setup` to check the current setup stage. This read-only HTTP suite checks the switches/gates, not the private allowlist by itself. The allowlist and live hook are verified separately.

Reference: https://supabase.com/docs/guides/auth/social-sign-in/auth-google and https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook

## Razorpay — deferred by owner on 6 November

The owner explicitly asked to do Razorpay integration later. Do not continue merchant configuration, request replacement credentials or enable checkout until they resume this work. The incident-remediation requirement below remains outstanding for that future setup.

The separate merchant onboarding has reached website details and offers Test API keys. The setup modal displayed a Test secret in tool output on 6 November. Treat that old Test pair as compromised: the owner must regenerate it and deactivate the old pair before any use. It was not installed in the app or Supabase. Do not repeat it in chat, documentation or logs.

A Supabase **Edge Function Secrets** form was prepared for `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`, with no values entered by the agent. When integration resumes, the owner must paste and save replacements directly; browser credential-handling rules require owner entry. `RAZORPAY_WEBHOOK_SECRET` and actual Test webhook configuration remain additional setup steps; no webhook secret is configured yet.

The current server functions intentionally reject unconfigured checkout/webhook requests. `launch_settings.sales_enabled=false`, `environment_mode=test` and null purchase-policy version remain in force. `PUBLIC_APP_ORIGIN` is currently the old preview origin and must be deliberately aligned to the final checkout test origin when configuring payment acceptance. Do not enable live orders or change existing academy merchant settings.

Before live sales, test server-created ₹1,193 orders, matching Test keys, successful/failed/cancelled simulated payments, exact-body signed webhook delivery, amount/currency/order binding, retries and out-of-order events, annual expiry, duplicate-purchase prevention and approved refund/revocation/reconciliation handling. Browser success callbacks never grant access.

References: https://razorpay.com/docs/payments/dashboard/account-settings/api-keys and https://razorpay.com/docs/webhooks/validate-test

## Remaining release gates

Serve only the canonical main-branch empty-holds bank through the reviewed private import path. Reconcile runtime/media/key readiness and exact exam blueprints; do not equate import eligibility with paper publication. Apply and verify the merged portal backend before opening its modules. Phone verification, drawing review, moderation, theory material, operational limits and policy decisions remain tracked in PRODUCT_EXECUTION_PLAN.md.

Final operator/contact, younger-student, privacy, purchase/refund, tax/invoice, retention/deletion, backup and monitoring decisions are still needed. The owner must approve public registration and live payments after concrete acceptance evidence. Neither the private Site nor the owner Google login test is a public paid launch.
