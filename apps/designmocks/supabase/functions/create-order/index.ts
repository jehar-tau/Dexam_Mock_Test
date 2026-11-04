import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { keyMatchesMode } from "../_shared/commerce.mjs";

Deno.serve(async (request) => {
  const origin = Deno.env.get("PUBLIC_APP_ORIGIN");
  const cors = {
    "Access-Control-Allow-Origin": origin ?? "https://invalid.invalid",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  if (!origin || request.headers.get("origin") !== origin)
    return json({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"),
    anon = Deno.env.get("SUPABASE_ANON_KEY"),
    service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const key = Deno.env.get("RAZORPAY_KEY_ID"),
    secret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!url || !anon || !service || !key || !secret)
    return json(
      { error: "Checkout is not active. No charge has been made." },
      503,
    );
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer \S+$/.test(authorization))
    return json({ error: "Sign in required" }, 401);
  const student = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: user, error: identityError } = await student.auth.getUser(
    authorization.slice(7),
  );
  if (identityError || !user.user)
    return json({ error: "Sign in required" }, 401);
  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (input?.plan !== "annual") return json({ error: "Unknown plan" }, 400);
  const { data: order, error } = await student.rpc("prepare_order");
  if (error || !order)
    return json(
      {
        error:
          "Annual access is not available for purchase. Check your account and the published terms.",
      },
      409,
    );
  if (!keyMatchesMode(key, order.mode))
    return json({ error: "Payment configuration is not ready." }, 503);
  try {
    let providerOrder = order.providerOrderId;
    if (!providerOrder) {
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(key + ":" + secret),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: order.amount,
          currency: order.currency,
          receipt: order.id,
          notes: { designmocks_order: order.id },
        }),
      });
      if (!response.ok) throw new Error("Provider unavailable");
      const provider = await response.json();
      if (
        provider.amount !== order.amount ||
        provider.currency !== order.currency ||
        !/^order_[A-Za-z0-9]+$/.test(provider.id)
      )
        throw new Error("Invalid provider order");
      const admin = createClient(url, service, {
        auth: { persistSession: false },
      });
      const { data: saved, error: attachError } = await admin.rpc(
        "attach_provider_order",
        { p_id: order.id, p_provider_id: provider.id },
      );
      if (attachError || !saved) throw new Error("Could not attach order");
      providerOrder = saved;
    }
    return json({
      orderId: providerOrder,
      keyId: key,
      amount: order.amount,
      currency: order.currency,
    });
  } catch {
    return json(
      {
        error:
          "Could not open checkout. No access has been granted; please try again.",
      },
      503,
    );
  }
});
