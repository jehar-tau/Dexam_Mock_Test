# DesignMocks — owner decisions

4 November 2026:

- A separate website and revenue stream, with a different name from Dexam.
- Retain the approved Discovery paper/forest/orange styling, Figtree/Zilla Slab typography and original geometric illustrations.
- The owner selected **fully separate app, student accounts and payments**, rather than routing students into Dexam.
- The owner confirmed the papers have been human-reviewed. This is content-review confirmation, not a record of production import, exam-blueprint verification or content-rights clearance.
- **₹1,193 for one year**, plus **Google login and Razorpay**. Working interpretation stated in chat: a single annual pass covering the catalogue, one payment, no automatic renewal. No extra plan or invented discount is offered.
- **DesignMocks** is the provisional name. Registry checks found designmocks.in available on 4 November at 10:54 IST; it has not been purchased. designmocks.com is registered. See the task workspace's `output/mock-brand-domain-research.md` for alternatives/evidence.

## Isolation and availability

The application has its own Supabase configuration, account namespace, database migrations and Edge Functions. No Dexam environment file, account, private bank, merchant key or fixture data is imported. The first-look Site is owner-private. All content in its anonymous sample is original, example material and explicitly labelled.

Google OAuth code and Razorpay order/webhook integration are implemented, but live sign-in, merchant setup and content delivery require separate provider configuration. The UI and server both fail closed. `sales_enabled` defaults false. The server amount is 119300 paise (INR), and the browser cannot supply the purchase price or grant access. A server-verified captured payment creates a 12-month entitlement; webhook retries do not extend it.

## Public launch still needs

1. Confirm/register the chosen domain; no domain purchase is authorized merely by the availability request.
2. **Supabase setup complete:** independent Free project in Mumbai, all three migrations applied/tracked, all three functions deployed and 10 hosted setup checks passing. Google OAuth, provider acceptance and enabling the browser portal remain pending.
3. Configure the separate Razorpay merchant/app keys and signed webhook in test mode; perform real provider sandbox acceptance before any live switch. Keys belong in server secret storage.
4. Publish final operator/privacy/purchase terms, including the policy required for younger students, tax/invoice handling and refund handling. The existing test-series programme required content-rights clearance before selling official-paper practice; human review alone does not resolve that recorded prerequisite.
5. Import the reviewed bank through a controlled server-side export/import path, verify source rights and current exam blueprints, and release only complete papers. No real bank has been uploaded to this preview.
6. Verify the real bank’s format/blueprint mapping against the new MCQ/MSQ/NAT engine and private media delivery. Drawing currently uses paper and self-review notes; uploads/human evaluation are not included. Confirm their scope before offering an evaluation service. Production monitoring, reconciliation and support/refund operations still need provider acceptance.

The standalone store, pricing, original timed sample and report can be reviewed now. This owner-private version is not ready to advertise as an active paid test service.

## Academy attribution

The owner requested “DesignMocks by Design Exam Academy”, with the academy name in smaller type and occasional traffic links. The header and footer use that byline, linking to designexam.com. The footer and annual-pass sidebar point to the academy’s courses for mentor-led preparation. Accounts, paid access and the test service remain independent. No cross-site tracking or automatic redirect is added.

## Google setup progress

The owner accepted Google Cloud terms on 4 November 2026. The dedicated project `designmocks-auth-2026` now exists under the academy Google account; billing/free-trial activation was not performed. App registration is prepared in testing mode and is waiting for the owner’s required Google API Services User Data Policy acceptance. No Google OAuth client secret has been created, entered into source or sent in chat.

## GitHub source destination — 5 November 2026

The owner explicitly selected `https://github.com/jehar-tau/Dexam_Mock_Test.git` for the website source. Integrate under `apps/designmocks` alongside the existing question-bank studio, preserving its commands/content and all unfamiliar workstation changes. The repository is private. This approval is for source integration/publication, not public hosting, bank publication, production account changes or merchant activation. Google provider activation was subsequently verified; older prepared-registration notes above are historical. Actual OAuth acceptance is still pending.
