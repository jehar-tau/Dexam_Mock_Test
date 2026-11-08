import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { validSignature, capturedPayment, processedRefund } from "../_shared/commerce.mjs";
Deno.serve(async (request) => {
  const reply = (status: number) =>
    new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "POST") return reply(405);
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET"),
    url = Deno.env.get("SUPABASE_URL"),
    service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !url || !service) return reply(503);
  if (Number(request.headers.get("content-length") ?? 0) > 262144)
    return reply(413);
  const reader = request.body?.getReader();
  if (!reader) return reply(400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 262144) {
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
  let body: string;
  try {
    body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return reply(400);
  }
  if (
    !(await validSignature(
      body,
      request.headers.get("x-razorpay-signature"),
      secret,
    ))
  )
    return reply(401);
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
  const eventId =
    supplied ??
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)),
      ),
      (n) => n.toString(16).padStart(2, "0"),
    ).join("");
  if (!eventId || eventId.length > 200) return reply(400);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { error } = payment ? await admin.rpc("fulfil_verified_payment", {
    p_event_id: eventId,
    p_provider_order: payment.orderId,
    p_payment_id: payment.paymentId,
    p_amount: payment.amount,
    p_currency: payment.currency,
  }) : await admin.rpc("record_verified_refund", {
    p_event_id: eventId,
    p_provider_order: refund!.orderId,
    p_payment_id: refund!.paymentId,
    p_refund_id: refund!.refundId,
    p_payment_amount: refund!.paymentAmount,
    p_refund_amount: refund!.refundAmount,
    p_total_refunded: refund!.totalRefunded,
    p_currency: refund!.currency,
  });
  return reply(error ? 503 : 200);
});
