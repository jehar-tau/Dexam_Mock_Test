import { stagingEdgeDenied } from "../_shared/staging-edge-admission.mjs";
import { controlledMediaOrigin } from "../_shared/controlled-media-origin.mjs";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { DrawingLinksError, sameDrawingPages, signedDrawingPages } from "../_shared/drawing-links.mjs";
import { drawingRequestBody } from "../_shared/drawing-request.mjs";

Deno.serve(async (request) => {
  const origin = controlledMediaOrigin({
    requestedOrigin: request.headers.get("origin"), portalOrigin: Deno.env.get("PUBLIC_APP_ORIGIN"),
    checkoutOrigin: null, configuredPublicOrigin: Deno.env.get("DMOCKS_CONTROLLED_PUBLIC_ORIGIN"),
    stagingTesterRequired: Deno.env.get("DMOCKS_EDGE_REQUIRE_STAGING_TESTER"),
  });
  const headers = {
    "Access-Control-Allow-Origin": origin ?? "https://invalid.invalid",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!origin) return respond({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return respond({ error: "Review media is not connected" }, 503);
  const reviewer = createClient(url, anon, {
    global: { headers: { Authorization: request.headers.get("authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const stagingCheck = Deno.env.get("DMOCKS_EDGE_REQUIRE_STAGING_TESTER");
  const stagingDenied = () => stagingEdgeDenied(stagingCheck, reviewer, AbortSignal.any([request.signal, AbortSignal.timeout(10000)]));
  if (await stagingDenied()) return respond({ error: "Private staging requires an approved Google tester" }, 403);
  try {
    const { reviewId } = JSON.parse(new TextDecoder().decode(await drawingRequestBody(request, 4096)));
    if (typeof reviewId !== "string") return respond({ error: "Invalid review" }, 400);
    const result = await reviewer.rpc("admin_drawing_review_media_paths", { p_review_id: reviewId });
    if (result.error) return respond({ error: "Drawing pages are unavailable for this review." }, 403);
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const signed = await signedDrawingPages(admin.storage.from("drawing-submissions"), result.data);
    // Signing is asynchronous. Recheck assignment/revocation before releasing links.
    const current = await reviewer.rpc("admin_drawing_review_media_paths", { p_review_id: reviewId });
    if (current.error || !sameDrawingPages(result.data, current.data)) return respond({ error: "Drawing pages are unavailable for this review." }, 403);
    if (await stagingDenied()) return respond({ error: "Private staging requires an approved Google tester" }, 403);
    return respond(signed);
  } catch (error) {
    if (error instanceof DrawingLinksError) return respond({ error: error.message }, error.status);
    return respond({ error: "Invalid drawing review request" }, 400);
  }
});
