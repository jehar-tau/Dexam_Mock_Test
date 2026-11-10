# Payment and refund reconciliation

This is the MVP technical runbook, **not a final customer refund/cancellation policy**. Checkout, public admission and hosted changes remain closed. The owner must approve refund eligibility, timing, support, invoice/tax adjustments and operational handling before sale. There is no app endpoint that initiates a provider refund or grants access from a browser callback.

## Verified event handling

The Edge webhook verifies the exact received bytes with the server-only HMAC secret before decoding the payload. If the provider event ID is absent, the webhook uses a SHA-256 digest of those same bytes. Only `payment.captured` or a valid captured-payment `refund.processed` event reaches service-only database functions. Refund creation/failure is not completion; uncaptured auto-refunds do not revoke another purchase. Event IDs bind to the exact order, payment, event kind, refund identity and money context. A separate refund-ID receipt prevents double-counting when the provider uses a new event ID.

Orders stay fixed at ₹1,193 / 119,300 INR minor units. Actual paid grants start after the per-account lock wait and end exactly 12 calendar months later. Duplicate events never extend a grant. Order mode must match the server environment; amount, currency and payment/order identity must match the recorded purchase.

| Verified condition | Persisted effect | Customer access / operator action |
| --- | --- | --- |
| First valid captured purchase | Paid order and one matching annual pass | New paid starts allowed while that pass is active |
| Repeat capture for the same paid/refunded order | Bound audit receipt, no replacement grant | Never extend or revive access |
| Another captured order while a pass is active | Paid order marked `payment_review_required` | Keep the current pass unchanged; reconcile the duplicate charge with the provider |
| Processed partial refund on a granted order | Monotonic cumulative amount and review flag | Preserve the existing grant pending operator/policy review; no invented proration |
| Partial refund arrives before capture delivery | Record refund; later capture is held for review | Do not create an unchecked pass |
| Processed cumulative refund equals the purchase amount | Refunded order and matching pass's `revoked_at` | Deny new paid starts; do not erase the customer's prior attempts/results |
| Old order's refund after a legitimate replacement purchase | Old order receipt only | Never revoke, replace or extend the new order's pass |
| Unknown/mismatched order, money, mode, payment, event or refund identity | Reject transaction; no partial receipt/grant | Investigate from provider IDs and application state without logging payloads/secrets |

Capture, refund, checkout preparation and paid starts use the same account lock ordering. Access and the real clock are checked after waiting; a queued start cannot use an expired or committed-revoked pass. Existing owned attempts keep their frozen questions, deadlines and results. Final eligibility to continue an already-started attempt is a policy boundary to confirm before live sale; this slice does not remove past data or reset clocks.

## Minimal operator workflow before live use

1. Verify the purchase, captured payment, refund ID/status and amount in the correct merchant Test/Live environment. A customer message or checkout callback is not payment/refund proof. Use only authorized private provider/database access; never paste keys, raw payloads, tokens or personal data into chat/logs.
2. Inspect the matching private order, bound event outcome, `payment_refunds`, and pass `order_id`. Keep partial-refund/duplicate-order review visible to the operator. `prepare_order` blocks another checkout while an order in the current environment needs payment review.
3. For a completed full refund, confirm cumulative amount equals the recorded purchase and that only its matching pass is revoked. Confirm `my_pass` is inactive and a new paid start is denied. A different legitimate replacement pass must remain active. Never rewrite immutable receipts to force a replay or manually extend a grant.
4. Resolve partial refunds or duplicate captures under the owner-approved policy and provider evidence. This source deliberately supplies no broad manual-grant/refund UI. An authorized, auditable reconciliation procedure and support response must be reviewed before opening sales. No automatic partial-refund proration or duplicate-charge refund is implied.
5. If delivery fails, preserve the private diagnostic and validate the provider's signed redelivery after correcting configuration. Replays must reuse their business identity and remain idempotent. Do not grant based on browser storage, an unsigned request or an uncertain callback.

## Acceptance and promotion

Migration `202611080148_mvp_payment_refunds.sql`, the updated `payment-webhook`, exact-head CI and matching main tree must be accepted before provider promotion. Use a fresh hosted ledger and approved backup/promotion target; the 88 source migrations do not mean 88 hosted migrations. Register capture and processed-refund event handling with replacement server-only Test credentials/secret when privately configured.

Local acceptance covers unit payload validation; anonymous/student denials; event/order/payment/mode and refund-ID binding; replay/out-of-order/cumulative amounts; concurrent capture/refund delivery; twelve parallel duplicate captures; real lock-wait expiry/revocation; exact calendar duration; replacement-pass isolation; preserved owned results; real SDK desktop/mobile refresh/account change/sign-out; and both-theme WCAG/320px. These use fictional events against isolated local Auth/PostgREST/Edge, not a real Razorpay order or refund. The real Test-mode journey on dmocks.com, final policy/support/invoice treatment and explicit production switch remain required.
