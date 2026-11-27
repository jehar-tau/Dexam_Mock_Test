# Pass pricing and the free allowance

Owner's go-to-market plan, 28 November 2026.

| | Free account | With a pass |
|---|---|---|
| Year-wise papers | Every released paper, with the answer key | The same |
| Worked solutions | The first 5 questions of each paper | Every question |
| Topic practice | One 10-question session a day (India time) | Unlimited, 10, 20 or 30 questions |
| Learn programmes | Foundations level | Exam standard, Exam hard, Mastery |
| Theory lessons | The first lesson of each topic | Every lesson |
| Teacher drawing marking | Not included | 4 drawings a month (India time) |

- **Annual pass:** ₹1,284 (128400 paise), 12 months, one payment.
- **Duo pass:** ₹2,142 (214200 paise). The payer's pass starts on the signed
  `payment.captured` webhook, which also opens a one-time invite link valid for
  30 days. A friend who signs in with Google through `/duo/<token>` gets their
  own 12-month pass from the moment they claim it. An invite works once, never
  for the payer, and never for an account that already has an active pass. A
  full refund of a Duo order ends both passes and any unused invite.
- All India mock drawings are always marked; they are part of the ranking and
  do not count towards the 4 a month.

## Where each rule lives

All limits except the Learn programme levels are enforced in
`supabase/migrations/202611280197_pass_pricing_and_free_limits.sql`:

- `read_attempt` removes worked solutions after question 5 for accounts
  without a pass (the answer key stays) and reports `lockedSolutions`.
- `start_topic_practice` refuses a second free session in a day, or a free
  session longer than 10 questions; the refused session is rolled back.
- A trigger on `drawing_reviews` keeps drawings from accounts without a pass,
  and a pass holder's fifth drawing in a month, out of the teacher queue and
  records why in `drawing_review_holds`.
- `read_learning_lesson` and `learning_catalog` lock theory lessons after the
  first of each topic.
- Learn programme levels are locked in the browser
  (`src/learn/programme-model.js`).

## Deploying to the live Supabase project

1. Apply migration `202611280197_pass_pricing_and_free_limits.sql`.
2. Deploy the `create-order` Edge Function (it now accepts `plan: "duo"`).
   `payment-webhook` does not change: Duo fulfilment happens in the database.
3. Checkout stays closed (`VITE_CHECKOUT_ENABLED=false`) until the owner sets
   live Razorpay keys.

Before checkout opens, the owner also needs to:

- review the new price wording in the published Terms (the notice text now
  names ₹1,284 and the Duo pass, so the notice version changes and must be
  republished with a matching `VITE_TERMS_VERSION`);
- if the paid MVP profile (`supabase/launch/paid-mvp.sql`) is ever applied, add
  `prepare_plan_order(text)`, `my_duo_invite()`, `redeem_duo_invite(text)` and
  `my_drawing_marking_allowance()` to its RPC manifest first. The profile is
  not applied to the open free backend today.
