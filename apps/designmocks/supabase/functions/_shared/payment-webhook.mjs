import { capturedPayment, processedRefund, validSignature } from "./commerce.mjs";
import { reportCommerceFailure } from "./commerce-operations.mjs";

const limit = 262144;

export function createPaymentWebhookHandler({
  createClient, readEnvironment, sdkFetch = globalThis.fetch, reportFailure = reportCommerceFailure,
}) {
  return async request => {
    const reply = status => new Response(null, { status, headers: { "Cache-Control": "no-store" } });
    if (request.method !== "POST") return reply(405);
    const secret = readEnvironment("RAZORPAY_WEBHOOK_SECRET"),
      url = readEnvironment("SUPABASE_URL"),
      service = readEnvironment("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret || !url || !service) {
      reportFailure("webhook_unconfigured");
      return reply(503);
    }
    if (Number(request.headers.get("content-length") ?? 0) > limit) return reply(413);
    const reader = request.body?.getReader();
    if (!reader) return reply(400);
    const chunks = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > limit) {
          await reader.cancel();
          return reply(413);
        }
        chunks.push(value);
      }
    } catch {
      return reply(400);
    }
    const bytes = new Uint8Array(length);
    let position = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, position);
      position += chunk.length;
    }
    let body;
    try {
      body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return reply(400);
    }
    if (!(await validSignature(body, request.headers.get("x-razorpay-signature"), secret))) {
      reportFailure("webhook_signature_rejected");
      return reply(401);
    }

    let payment, refund;
    try {
      const payload = JSON.parse(body);
      payment = capturedPayment(payload);
      refund = processedRefund(payload);
    } catch {
      return reply(400);
    }
    if (!payment && !refund) return reply(200);
    const supplied = request.headers.get("x-razorpay-event-id");
    const eventId = supplied ?? Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body))),
      byte => byte.toString(16).padStart(2, "0"),
    ).join("");
    if (!eventId || eventId.length > 200) return reply(400);
    try {
      const admin = createClient(url, service, {
        auth: { persistSession: false },
        global: { fetch: (input, init = {}) => {
          const timeout = AbortSignal.timeout(15000);
          const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
          return sdkFetch(input, { ...init, signal, redirect: "error" });
        } },
      });
      const { error } = payment ? await admin.rpc("fulfil_verified_payment", {
        p_event_id: eventId,
        p_provider_order: payment.orderId,
        p_payment_id: payment.paymentId,
        p_amount: payment.amount,
        p_currency: payment.currency,
      }) : await admin.rpc("record_verified_refund", {
        p_event_id: eventId,
        p_provider_order: refund.orderId,
        p_payment_id: refund.paymentId,
        p_refund_id: refund.refundId,
        p_payment_amount: refund.paymentAmount,
        p_refund_amount: refund.refundAmount,
        p_total_refunded: refund.totalRefunded,
        p_currency: refund.currency,
      });
      if (!error) return reply(200);
    } catch {
      // Payment identities and provider diagnostics stay with the provider and database.
    }
    reportFailure(payment ? "webhook_capture_unconfirmed" : "webhook_refund_unconfirmed");
    return reply(503);
  };
}
