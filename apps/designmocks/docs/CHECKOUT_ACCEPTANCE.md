# MVP checkout acceptance

The combined desktop and mobile rehearsal starts with empty purchase histories and exercises the order handler, signed capture, exact approved UCEED paper, reconnect, result, linked support and full refund on the current local schema. Both runs pass with fictional merchant transport and local provider services. Use the real hosted Test procedure below for merchant acceptance. [Combined rehearsal](VERIFICATION.md#combined-paid-paper-rehearsal--10-november-2026)

Current recovery/operator-readiness candidate: CHECKOUT_RECOVERY.md adds exact receipt/note/state verification, lost-reply recovery and bounded server work without changing webhook-only entitlement. It passes 342 units/358 strict desktop/mobile cases/44 database suites plus actual local source-handler/SDK proof with a fictional merchant transport. Contact facts are supplied; final policy and approved real-provider gates stay closed.

Accepted checkout PR #100 has strict exact-head PR/main and matching-tree acceptance (313 units/342 zero-retry desktop/mobile journeys). The companion release profile adds expected Test/Live key and pass-mode validation and the separate controlled merchant Test procedure in [MVP_DEPLOYMENT.md](MVP_DEPLOYMENT.md).

The paid MVP is ₹1,193 INR for exactly 12 calendar months, one payment with no automatic renewal, covering only the explicitly released catalogue. This runbook does not approve the first paper, policies, merchant configuration or a production switch. Public registration, publication and sales remain separate closed gates.

## Purchase behavior

- On the checkout-enabled account page, students review the current notices before Google sign-in. They confirm the purchase separately in checkout with their verified DMocks account.
- The purchase view verifies the current DMocks account before private pass reads. An existing active pass prevents another checkout. Consent belongs to this account/view and is cleared by account/history changes.
- Terms acceptance, order creation and pass confirmation use the verified captured actor's bearer. After the order/script replies, presentation checks the current cached session/token again. An earlier order cannot open under a new account.
- The server creates the order from its fixed annual plan. The client verifies the exact amount/currency and bounded provider identifiers before opening one owned widget. Simultaneous clicks are suppressed. The client never supplies a trusted entitlement, arbitrary amount or payer/account binding.
- Opening/reads have 20-second deadlines. A malformed, failed, lost or timed-out acknowledgement cannot open a late window. Leaving the view, sign-out or identity loss cancels pending work and closes its owned widget.
- A success callback starts sequential current-account server pass checks, bounded to 65 seconds and 20 reads. It never grants access. Dismissal, failure or uncertainty requires an explicit **Check my pass**; no automatic second purchase is made. Static error/status copy hides provider diagnostics.
- Only the signed server event grants/revokes a pass. REFUND_RECONCILIATION.md describes replay, duplicate purchase, partial review and matching-order full revocation. A callback, browser storage or customer-supplied payment ID is not entitlement proof.

The independent `VITE_CHECKOUT_ENABLED` switch remains false in normal/controlled/staging previews. The server sales flag is also closed. Tests opt in only on a fictional localhost acceptance surface; that is not permission to enable dmocks.com checkout.

## Evidence versus remaining acceptance

| Check | Current evidence | Still required |
| --- | --- | --- |
| Current account, terms/pass reads and late events | Unit + desktop/mobile E2E + actual isolated Auth/PostgREST/SDK | Approved promoted account/admission setup |
| Order response and window presentation | Fixed-price DTO checks, mocked Orders response and simulated widget | Fresh private merchant Test configuration and real Orders API/widget |
| Entitlement/replay/refund | Service authorization and signed fictional local Edge events, exact calendar pass, concurrency/refund proofs | Supported real provider Test capture/refund/redelivery journey |
| User experience | Keyboard, own-view disposal, both themes/WCAG and 320px in application UI | Real provider window, mobile/desktop return and hosted support/receipt journey |
| Policy/content and operation | Reviewable source/runbooks and closed switches | Final first-paper presentation/release, notices/operator/contact/refund/invoice/minor decisions, approved backup/promotion/alerts and go-live |

Do not describe local password-created fictional Auth actors as a Google sign-in journey, a simulated widget as merchant testing, source migrations as hosted changes, or a local signed fictional payment as money movement.

## Final real Test-mode journey on dmocks.com

The owner bank-use/provenance statement is already recorded. After final offering presentation/release, policies and deployment-target approval, privately configure replacement Test keys/server webhook secret and the approved matching functions/migrations. Deactivate the previously exposed Test pair. Keep credentials and OTP/KYC entry private; never put server secrets into Vite, Git, logs or chat. Do not enable public sale or initiate a live payment during testing.

Use the audited at-most-eight-hour Test window from MVP_DEPLOYMENT.md after its four content/policy decisions and Google tester allowlisting. Keep provider_acceptance false until this journey succeeds, server mode Test, public signup/Live sales false; close the window explicitly afterwards.

Verify Google sign-in and account/terms → exact offer and receipt/support information → one server-created fixed-price Razorpay order → real Test checkout/capture → signed webhook → one 12-month pass → selected paper/reconnect/submission/result. Confirm duplicate delivery/purchase behavior and real Test refund/revocation with the provider's supported mechanism. Repeat account-change, dismissal, delayed webhook and mobile/desktop return checks with the real window. Inspect support/invoice/refund outcomes and monitoring/restore evidence before the explicit final production decision.

Open **Purchase history** from Account after capture and after refund. Confirm the current environment, owned order reference, recorded amount and refund state against the matching server record. Select **Get help with this order** and send a private report. In the staff queue, verify the linked purchase's recorded payment and refund amounts, then send a reply. Confirm the reply and order reference in the payer's **Your reports** history. Test purchases require the Test build and the matching server mode.
