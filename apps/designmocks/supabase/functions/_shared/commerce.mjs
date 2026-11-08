export async function validSignature(body, signature, secret) {
  if (!secret || !/^([a-f0-9]{64})$/i.test(signature ?? "")) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(body)),
  );
  const actual = Uint8Array.from(signature.match(/../g), (pair) =>
    parseInt(pair, 16),
  );
  let difference = 0;
  for (let i = 0; i < expected.length; i++)
    difference |= expected[i] ^ actual[i];
  return difference === 0;
}
export function capturedPayment(payload) {
  if (payload?.event !== "payment.captured") return null;
  const p = payload?.payload?.payment?.entity;
  if (
    p?.status !== "captured" ||
    p.currency !== "INR" ||
    !Number.isSafeInteger(p.amount) ||
    p.amount <= 0 ||
    !/^pay_[A-Za-z0-9]+$/.test(p.id ?? "") ||
    !/^order_[A-Za-z0-9]+$/.test(p.order_id ?? "")
  )
    throw new Error("Invalid captured payment");
  return {
    paymentId: p.id,
    orderId: p.order_id,
    amount: p.amount,
    currency: p.currency,
  };
}
export function keyMatchesMode(key, mode) {
  return Boolean(
    mode === "test"
      ? key?.startsWith("rzp_test_")
      : mode === "live"
        ? key?.startsWith("rzp_live_")
        : false,
  );
}

// Refund creation/failure is not proof that money was returned. An uncaptured
// auto-refund cannot revoke an entitlement purchased with another payment.
export function processedRefund(payload) {
  if (payload?.event !== "refund.processed") return null;
  const refund = payload?.payload?.refund?.entity;
  const payment = payload?.payload?.payment?.entity;
  if (payment?.captured === false) return null;
  if (!refund || !payment || refund.status !== "processed" || payment.captured !== true ||
      !["captured", "refunded"].includes(payment.status) || refund.currency !== "INR" || payment.currency !== "INR" ||
      !/^rfnd_[A-Za-z0-9]+$/.test(refund.id ?? "") || !/^pay_[A-Za-z0-9]+$/.test(payment.id ?? "") ||
      !/^order_[A-Za-z0-9]+$/.test(payment.order_id ?? "") || refund.payment_id !== payment.id ||
      !Number.isSafeInteger(payment.amount) || payment.amount <= 0 ||
      !Number.isSafeInteger(refund.amount) || refund.amount <= 0 || refund.amount > payment.amount ||
      !Number.isSafeInteger(payment.amount_refunded) || payment.amount_refunded < refund.amount || payment.amount_refunded > payment.amount)
    throw new Error("Invalid processed refund");
  return {refundId: refund.id, paymentId: payment.id, orderId: payment.order_id,
    paymentAmount: payment.amount, refundAmount: refund.amount, totalRefunded: payment.amount_refunded, currency: payment.currency};
}
