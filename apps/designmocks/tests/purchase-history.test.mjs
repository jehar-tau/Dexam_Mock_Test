import assert from "node:assert/strict";
import test from "node:test";
import { appendPurchasePage, purchaseAmount, purchaseSupportContext, validatePurchasePage } from "../src/purchase-history.js";

const row = (number, changes = {}) => ({
  reference: `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
  amountMinor: 119300, currency: "INR", status: "paid", refundedMinor: 2550, reviewRequired: true,
  createdAt: "2026-11-10T09:30:00.123456+00:00", paidAt: "2026-11-10T10:00:00+00:00",
  refundedAt: "2026-11-10T10:30:00+00:00", ...changes,
});
const fixture = (items = [row(1)], nextCursor = null) => ({ mode: "test", items, nextCursor });

test("projects exact owned payment fields and formats rupees and paise", () => {
  const value = row(1, { providerOrderId: "order_fictionalPrivate", customerId: "fictional-private" });
  assert.deepEqual(validatePurchasePage(fixture([value]), "test"), fixture([row(1)]));
  assert.equal(purchaseAmount(119300), "₹1,193.00");
  assert.equal(purchaseAmount(2550), "₹25.50");
  assert.equal(purchaseAmount(1), "₹0.01");
});

test("keeps the exact microsecond cursor and appends older results once", () => {
  const items = Array.from({ length: 10 }, (_, i) => row(20 - i));
  const { createdAt, reference } = items.at(-1);
  const page = validatePurchasePage(fixture(items, { createdAt, reference }), "test");
  assert.deepEqual(page.nextCursor, { createdAt, reference });
  assert.throws(() => validatePurchasePage(fixture(items, { createdAt: new Date(createdAt).toISOString(), reference }), "test"));
  const older = validatePurchasePage(fixture([row(1)]), "test");
  assert.deepEqual(appendPurchasePage(page, older), fixture([...items, row(1)]));
  assert.throws(() => appendPurchasePage(page, fixture([items[0]])));
});

test("handles historical rows and refunds recorded before capture", () => {
  const pending = row(3, { status: "pending", paidAt: null, refundedAt: null, refundedMinor: 0, reviewRequired: false });
  const refunded = row(2, { status: "refunded", paidAt: null, refundedMinor: 119300, reviewRequired: false });
  const historical = row(1, { paidAt: null, refundedAt: null, refundedMinor: 0, reviewRequired: false });
  assert.deepEqual(validatePurchasePage(fixture([pending, refunded, historical]), "test"), fixture([pending, refunded, historical]));
  assert.deepEqual(validatePurchasePage(fixture([]), "test"), fixture([]));
});

test("rejects wrong-mode, malformed, inconsistent and repeated purchase replies", () => {
  assert.throws(() => validatePurchasePage({ ...fixture(), mode: "live" }, "test"), { code: "purchase_mode_changed" });
  for (const change of [{ reference: "../foreign" }, { currency: "USD" }, { amountMinor: 0 }, { refundedMinor: 119301 },
    { paidAt: "not-a-date" }, { status: "confirmed" }, { reviewRequired: "true" }]) {
    assert.throws(() => validatePurchasePage(fixture([row(1, change)]), "test"), /load your purchases/);
  }
  assert.throws(() => validatePurchasePage(fixture([row(1), row(1)]), "test"));
  assert.throws(() => validatePurchasePage(fixture([row(1)], { reference: row(1).reference, createdAt: row(1).createdAt }), "test"));
});

test("order help carries a reference only for the same account and payment mode", () => {
  const actorId = row(2).reference;
  const link = { actorId, mode: "test", reference: row(1).reference };
  const state = { purchaseSupport: link };
  assert.deepEqual(purchaseSupportContext(state, actorId, "test"), { reference: link.reference, mode: "test" });
  assert.equal(purchaseSupportContext(state, row(3).reference, "test"), null);
  assert.equal(purchaseSupportContext(state, null, "test"), null);
  assert.equal(purchaseSupportContext(state, actorId, "live"), null);
  assert.equal(purchaseSupportContext({ purchaseSupport: { ...link, reference: "invalid" } }, actorId, "test"), null);
});
