import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createPaymentWebhookHandler } from "../supabase/functions/_shared/payment-webhook.mjs";

const origin = "http://127.0.0.1:63101";
const secret = "original-fictional-signature-fixture";
const payment = { id: "pay_originalFictional", order_id: "order_originalFictional",
  amount: 119300, currency: "INR", status: "captured" };
const capture = { event: "payment.captured", payload: { payment: { entity: payment } } };
const refund = { event: "refund.processed", payload: {
  payment: { entity: { ...payment, status: "refunded", captured: true, amount_refunded: 119300 } },
  refund: { entity: { id: "rfnd_originalFictional", payment_id: payment.id, amount: 119300,
    currency: "INR", status: "processed" } },
} };

function request(event, { signed = true } = {}) {
  const body = JSON.stringify(event);
  return new Request(origin + "/functions/v1/payment-webhook", {
    method: "POST", body, headers: {
      "x-razorpay-event-id": "fictional-original-event",
      "x-razorpay-signature": signed ? createHmac("sha256", secret).update(body).digest("hex") : "0".repeat(64),
    },
  });
}

function fixture({ configured = true, rpc = async () => ({ error: null }), sdkFetch } = {}) {
  const failures = [], calls = [];
  const settings = {
    RAZORPAY_WEBHOOK_SECRET: configured ? secret : undefined,
    SUPABASE_URL: origin,
    SUPABASE_SERVICE_ROLE_KEY: "fictional-original-service-key",
  };
  const handler = createPaymentWebhookHandler({
    readEnvironment: name => settings[name], sdkFetch, reportFailure: code => failures.push(code),
    createClient: (url, key, options) => {
      assert.equal(url, origin);
      assert.equal(key, settings.SUPABASE_SERVICE_ROLE_KEY);
      return { rpc: async (name, input) => {
        calls.push({ name, input });
        return rpc(name, input, options);
      } };
    },
  });
  return { handler, failures, calls };
}

test("missing configuration and unsigned captures produce fixed codes before database dispatch", async () => {
  const closed = fixture({ configured: false });
  assert.equal((await closed.handler(request(capture))).status, 503);
  assert.deepEqual(closed.failures, ["webhook_unconfigured"]);
  assert.deepEqual(closed.calls, []);
  const signedOnly = fixture();
  const denied = await signedOnly.handler(request(capture, { signed: false }));
  assert.equal(denied.status, 401);
  assert.equal(await denied.text(), "");
  assert.deepEqual(signedOnly.failures, ["webhook_signature_rejected"]);
  assert.deepEqual(signedOnly.calls, []);
});

test("a signed capture with an unconfirmed database response leaves a safe 503 and an exact retry", async () => {
  let attempts = 0;
  const f = fixture({ rpc: async () => {
    if (++attempts === 1) throw new Error("Private provider response and payment identities");
    return { error: null };
  } });
  const failed = await f.handler(request(capture));
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get("Cache-Control"), "no-store");
  assert.equal(await failed.text(), "");
  assert.equal((await f.handler(request(capture))).status, 200);
  assert.deepEqual(f.calls, Array.from({ length: 2 }, () => ({
    name: "fulfil_verified_payment", input: {
      p_event_id: "fictional-original-event", p_provider_order: payment.order_id,
      p_payment_id: payment.id, p_amount: 119300, p_currency: "INR",
    },
  })));
  assert.deepEqual(f.failures, ["webhook_capture_unconfirmed"]);
});

test("a failed signed refund reports the separate fixed code and never includes provider diagnostics", async () => {
  const f = fixture({ rpc: async () => ({ error: { message: "Private refund response" } }) });
  const result = await f.handler(request(refund));
  assert.equal(result.status, 503);
  assert.equal(await result.text(), "");
  assert.equal(f.calls[0].name, "record_verified_refund");
  assert.equal(f.calls[0].input.p_total_refunded, 119300);
  assert.deepEqual(f.failures, ["webhook_refund_unconfirmed"]);
});

test("a recognized capture uses bounded nonredirecting SDK fetch and signed unrelated events are quiet", async () => {
  const fetches = [];
  const f = fixture({
    sdkFetch: async (_, init) => { fetches.push(init); return Response.json(null); },
    rpc: async (_, __, options) => {
      await options.global.fetch(origin + "/rest/v1/rpc/fulfil_verified_payment");
      return { error: null };
    },
  });
  assert.equal((await f.handler(request({ event: "payment.authorized" }))).status, 200);
  assert.equal((await f.handler(request(capture))).status, 200);
  assert.equal(f.calls.length, 1);
  assert.equal(fetches[0].redirect, "error");
  assert.ok(fetches[0].signal instanceof AbortSignal);
  assert.deepEqual(f.failures, []);
});
