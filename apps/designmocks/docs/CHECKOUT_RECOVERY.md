# Checkout recovery and minimal MVP operations

An upstream order can commit before its response reaches the server, or before the database attachment acknowledgement arrives. Retrying creation with the same unique receipt then leaves the older implementation stuck. It also checked the provider amount/currency/ID without verifying the echoed receipt and internal-order note. Two isolated before probes reproduce these failures without contacting a merchant.

## Bound receipt recovery

The exact Edge handler is shared by `create-order/index.ts` and the isolated integration harness. It verifies Origin, server configuration, the bearer actor and annual plan before `prepare_order()`. The server-prepared order must be exactly 119,300 INR minor units, a bounded UUID/provider ID and the configured Test/Live key mode. There is no arbitrary provider URL or client-supplied amount/account binding.

An unattached order first looks up its receipt. Only one exact receipt plus matching `notes.designmocks_order`, amount/currency and a created/attempted, wholly unpaid, nonpartial order can open checkout. A verified empty collection permits one POST. A failed/lost POST response performs one read-only receipt lookup; it never repeats POST within that request. Concurrent duplicate-receipt failures converge on the same verified provider order. An already attached ID is independently fetched and verified. A different saved database attachment is rejected rather than returned to the browser.

The [official Orders API](https://razorpay.com/docs/api/orders/create) requires a unique receipt; [receipt-filtered lookup](https://razorpay.com/docs/api/orders/fetch-all) supplies recovery. Because the filter can contain the supplied text, the implementation checks equality and the internal note itself. Missing, duplicate, ambiguous, malformed, mismatched, paid or partly paid responses fail closed. A paid API reply is not a signed capture and cannot grant a pass. The provider work is bounded to 12 seconds and the whole handler to 18 seconds; late work cannot dispatch another provider request or database attachment after its deadline. Errors expose fixed support/recovery copy, never provider bodies or keys.

If attachment committed but its reply was lost, the client stays unconfirmed until an explicit pass check and retry. The next request reuses the attached provider ID without another create. The signed webhook remains the only grant/revocation mechanism; twelve-calendar-month expiry, duplicate capture/refund review and replacement-pass isolation are unchanged. Read CHECKOUT_ACCEPTANCE.md and REFUND_RECONCILIATION.md.

## Corrected scheduler health boundary

The first MVP profile accidentally omitted the existing service-role branch in `admin_operational_health()` and counted question reports as `open`, although their schema status is `pending`. A failing-before database probe records the missing pending counter. The corrected profile restores service-or-admin authorization, counts actual pending rows and returns attention when support/question queues need review. Anonymous/student access remains denied and the 41-signature client allowlist is unchanged.

The default operations runner now verifies the `paid-mvp-v1` aggregate and service access before any mutation, finalizes only bounded expired-attempt batches, prunes old rate buckets and rereads aggregate health. It does not call deferred AI/intake recovery. Invalid/null/coerced counts or an old/malformed profile stop the runner. Output contains only six approved counters, scope/status/time and bounded sweep totals. It never prints user details or raw provider responses. The approved target and exact production acknowledgement remain required before a hosted run.

The companion profile remains outside the migration ledger: 88 migrations, then `supabase/launch/paid-mvp.sql` last in one transaction. Current profile SHA-256: `d86662261768dfe92c3687f31ab76c36096c0f6c1983a3a741b48402a3156482`. Apply only with public admission/sales/Test acceptance closed on the approved target. No hosted write is performed by this delivery.

## Operator facts and remaining policies

The owner supplied an Udyam certificate and `inquiry@designexam.com`. The public contact page and privacy/terms identify **DEXAM**, a proprietorship of **Manisha Balasaheb Shinde**, at **Office No. 101, Pallazo Condominium, Hadapsar Road, Hadapsar, Haveli, Pune, Maharashtra 411028, India**. The document records no GSTIN. The provided support email overrides its personal contact email. PAN, bank/IFSC details, personal contacts and the original certificate are absent from the public source/assets.

These facts do not invent a refund window, younger-student rule, tax add-on or final policy approval. Existing notices remain prelaunch drafts and the corresponding gates stay closed. Do not ask the owner to repeat the operator/address/email/GST inputs already supplied. Remaining policy review belongs with the complete application review; the earlier deployment-target question is still pending.

## Verification boundaries

Local checks pass **342 JavaScript tests, four Python fixtures, eleven server types, build/isolation, zero production audit findings, 358 desktop/mobile journeys with no skips/retries, and 72 migrations plus profile/44 database suites**. Seventeen focused order tests cover lost replies, exact binding, concurrency, paid/partial/malformed data, bounded cancellation and handler authorization; the minimal operations suite covers profile-first/no-deferred writes and private-output filtering. Contact/policy keyboard, both-theme WCAG and 320px checks pass.

Actual isolated Auth/PostgREST/SDK integration executes the exact source handler through a Node HTTP adapter. Only the Razorpay transport/widget are fictional. It proves a lost provider commit, a genuinely committed database-attachment acknowledgement loss, twelve concurrent preparations/attachments, mismatch/paid/expiry denial, current-account terms/pass reads and an actual service-only sweep with the correct pending-report count. Desktop/mobile UI proof verifies explicit recovery reuses the same order, a simulated callback grants nothing, only an actual signed fictional local Edge capture confirms access, foreign passes stay unchanged, sign-out clears the view and the admin counter matches the real pending row.

This is not a real Razorpay merchant, Google OAuth or hosted journey. Source merges do not configure fresh merchant credentials, publish the real bank, open sales/admission or approve the hosting target. Earlier successful core proofs and the corrected monitoring failure remain separately recorded. Exact-head PR/main CI and matching-tree acceptance still gate delivery.
