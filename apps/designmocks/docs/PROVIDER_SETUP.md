# DesignMocks provider setup

The owner confirmed on 4 November 2026 that a new setup is needed. The independent **DesignMocks** Supabase project is now created and configured on the existing Free organization in Mumbai: `tiodqzvvujxvxssvjdis`. All three migrations are applied and tracked; `create-order`, `payment-webhook` and `attempt-media` are deployed. No paid subscription or domain purchase was made. Google OAuth and Razorpay merchant configuration remain pending.

## Supabase: keep the owner login, separate the project

Use the existing owner login. DesignMocks needs its **own project**, database, Auth user store, API keys and Storage bucket. A second personal login is unnecessary for isolation or cost savings.

Billing is organization-based. Start the setup in a separate **Free organization/project** if the owner's free-project allowance permits it. The official limit is two active Free projects across organizations where the user is an Owner or Administrator. A new login is not the cost-control mechanism. The dashboard confirmed the existing organization is **Free**. The owner created DesignMocks as its second project; **Dexam Staging** remains separate. Both projects share organization quotas, while databases, Auth users, keys and Storage are independent.

For a paid launch, compare an additional Micro project in an existing Pro organization (typically about US$10/month incremental compute) against a separate Pro organization (starts at US$25/month with one Micro project's compute credit). Taxes, extra compute and usage may add cost. Keep any paid upgrade an explicit owner decision. Free projects can pause after one week of inactivity; it is a setup option, not a promise of paid-exam availability.

Sources checked 4 November 2026:

- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/billing-on-supabase

The owner generated/stored the database password and created the new project in Mumbai. All three migrations were applied using the authenticated CLI Management API with the explicit DesignMocks project reference, then recorded in migration history. The existing Dexam project was not linked/reset/seeded. `launch_settings.sales_enabled=false`, test mode and a private `paper-media` bucket are verified.

## Google login

Create a distinct Web OAuth client for DesignMocks in the owner's Google Cloud setup. Complete its consent configuration, use the actual operator/contact information, and request only the basic identity scopes. Configure Google in the **new** Supabase project's Auth settings. Google's authorized callback is `https://<new-project-ref>.supabase.co/auth/v1/callback`.

The Supabase site URL is configured as `https://designmocks-studio.snehal1155.chatgpt.site`, with only its exact `/account/callback` URL allowed. New registrations and anonymous sign-in remain disabled during setup. Replace the origin and callback together when the final domain is ready. Use localhost only for development. Do not use broad production redirect wildcards. The frontend uses PKCE and records acceptance of the published policy version after authentication; checkout checks that version again on the server.

Reference: https://supabase.com/docs/guides/auth/social-sign-in/auth-google

## Razorpay

The owner must complete any required merchant onboarding/KYC. Use the separate DesignMocks merchant configuration and secret storage, not Dexam's keys. Start in Test mode. Set the new project's Edge Function secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `PUBLIC_APP_ORIGIN`. Do not send secrets in chat or commit them.

Deploy `create-order`, `payment-webhook`, `attempt-media` to the isolated project. The two student endpoints validate the bearer identity using Supabase Auth. The payment webhook validates the exact request body with HMAC-SHA256. Configure `payment.captured` for its webhook URL. The browser success handler only waits for verified access; it cannot create a pass.

Verify test-mode order creation, cancellation, incorrect signatures, retry delivery, exact ₹1,193 amount, one calendar year of access, duplicate-purchase protection and reconciliation. Refund/revocation, support and invoice operations need an agreed production procedure before selling. There is no recurring subscription.

References:

- https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps
- https://razorpay.com/docs/webhooks/validate-test

## Activate only after acceptance

The reviewed real bank is not in this repository or preview. Import it through a controlled server-side process, map marking schemes/sections and private image paths, confirm publication/rights flags and compare representative scored attempts to the human-reviewed keys. Drawing is currently offline self-review; do not offer uploads/human evaluation until that service exists.

Publish final operator, privacy, younger-student, purchase/refund and tax notices. Set the same published policy version in the database and browser. Configure the public URL/anon key in the frontend; keep the service key server-only. Enable the student portal, then validate the actual Google redirect and Razorpay Test flow. A live switch follows owner approval after those checks. Do not advertise this owner-private preview as an operating paid service.

## Current owner handoff

The owner accepted Google Cloud’s initial terms and the Google API Services User Data Policy. A dedicated project, **DesignMocks** (`designmocks-auth-2026`), is created under `designexam.com@gmail.com`, without enabling billing or a free trial. App registration was saved with the DesignMocks name, academy support/contact email and External audience in testing mode. The Web OAuth client form is prepared with the exact preview origin and callback. Its actual creation/credential pair has not been verified. After the owner reported saving credentials, refreshed Supabase UI and public Auth settings still show Google disabled. The Client IDs field contains the app name `DesignMocks`, which must be replaced with the Google-generated ID ending `.apps.googleusercontent.com`. The owner must enter its matching secret directly and save the enabled provider. No secret was revealed. The intended callback is `https://tiodqzvvujxvxssvjdis.supabase.co/auth/v1/callback`.

Migration 004 installs `before_designmocks_user_created` and server-owned registration policy/tester tables. The Auth hook is configured, with policy `closed` and global signup still disabled. It checks Auth-owned provider metadata, rejects non-Google/anonymous/missing-email requests, and supports a controlled allowlist before a later approved public launch. Browser roles cannot read/change the policy or invoke the hook. Transactional decision tests and Auth-role grant checks pass; the Management API cannot impersonate `supabase_auth_admin`, so actual hook execution is explicitly deferred to the real OAuth test. Reference: https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook

`PUBLIC_APP_ORIGIN` is set in the new project’s Edge Function secret store. Razorpay credentials are absent, so order creation and the webhook return a closed-setup response. The new public Supabase URL/anon key are stored only in ignored `.env.local`, with the browser portal still disabled. Service-role and merchant secrets are not in the source or browser.

Razorpay is still at the business-PAN onboarding stage in the owner’s tab. The owner must complete merchant onboarding directly in Razorpay. Identity/bank details and merchant secrets must not be sent in chat.

## 5 November verified update

The owner completed Google credential entry directly in Supabase. The correct independent project now reports Google enabled via its public Auth settings; 10/10 hosted setup checks pass. Credentials were not read into source/chat. Registration and the browser portal remain closed, so an actual owner-only OAuth callback test is still pending. Earlier disabled-provider observations above describe the preceding handoff, not the current saved state.
