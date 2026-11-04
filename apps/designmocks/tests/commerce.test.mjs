import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  validSignature,
  capturedPayment,
  keyMatchesMode,
} from "../supabase/functions/_shared/commerce.mjs";
const body = JSON.stringify({
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        id: "pay_example123",
        order_id: "order_example123",
        amount: 119300,
        currency: "INR",
        status: "captured",
      },
    },
  },
});
const secret = "fictional-test-secret-only";
test("authenticates the exact webhook body and rejects tampering, truncation and another secret", async () => {
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(await validSignature(body, signature, secret), true);
  assert.equal(await validSignature(body + " ", signature, secret), false);
  assert.equal(
    await validSignature(body, signature, "another-fictional-secret"),
    false,
  );
  assert.equal(await validSignature(body, signature.slice(1), secret), false);
  assert.equal(await validSignature(body, "z".repeat(64), secret), false);
  assert.equal(await validSignature(body, null, secret), false);
});
test("only a captured INR payment is a fulfilment candidate", () => {
  assert.deepEqual(capturedPayment(JSON.parse(body)), {
    paymentId: "pay_example123",
    orderId: "order_example123",
    amount: 119300,
    currency: "INR",
  });
  assert.equal(capturedPayment({ event: "payment.authorized" }), null);
  assert.equal(capturedPayment({ event: "order.paid" }), null);
  for (const replacement of [
    { status: "authorized" },
    { currency: "USD" },
    { amount: -1 },
    { amount: 1.5 },
    { id: "untrusted" },
    { order_id: "unknown" },
  ]) {
    const input = JSON.parse(body);
    Object.assign(input.payload.payment.entity, replacement);
    assert.throws(() => capturedPayment(input));
  }
});
test("does not allow a test key to activate a live payment mode", () => {
  assert.equal(keyMatchesMode("rzp_test_fictional", "test"), true);
  assert.equal(keyMatchesMode("rzp_test_fictional", "live"), false);
  assert.equal(keyMatchesMode("rzp_live_fictional", "test"), false);
  assert.equal(keyMatchesMode("rzp_live_fictional", "live"), true);
  assert.equal(keyMatchesMode(undefined, "live"), false);
});
