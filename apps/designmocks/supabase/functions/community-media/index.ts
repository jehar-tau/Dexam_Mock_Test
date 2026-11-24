import { stagingEdgeDenied } from "../_shared/staging-edge-admission.mjs";
import { controlledMediaOrigin } from "../_shared/controlled-media-origin.mjs";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { validateRaster } from "../_shared/validate-raster.ts";
import { drawingRequestBody } from "../_shared/drawing-request.mjs";
import { sameDrawingPages, signedDrawingPages } from "../_shared/drawing-links.mjs";
import { COMMUNITY_FORM_MAX_BYTES, COMMUNITY_MAX_BYTES, CommunityMediaError, communityMediaFailure, communityTarget, validateCommunityImage } from "../_shared/community-image.mjs";
import { signedCommunityModeration, signedCommunityReview } from "../_shared/community-review.mjs";

let uploadBusy = false;
Deno.serve(async request => {
  const origin = controlledMediaOrigin({
    requestedOrigin: request.headers.get("origin"), portalOrigin: Deno.env.get("PUBLIC_APP_ORIGIN"),
    checkoutOrigin: null, configuredPublicOrigin: Deno.env.get("DMOCKS_CONTROLLED_PUBLIC_ORIGIN"),
    stagingTesterRequired: Deno.env.get("DMOCKS_EDGE_REQUIRE_STAGING_TESTER"),
  });
  const headers = { "Access-Control-Allow-Origin": origin ?? "https://invalid.invalid", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin" };
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!origin) return respond({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return respond({ error: "Community images are not connected" }, 503);
  const student = createClient(url, anon, { global: { headers: { Authorization: request.headers.get("authorization") ?? "" } }, auth: { persistSession: false } });
  const { data: { user } } = await student.auth.getUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  const stagingCheck = Deno.env.get("DMOCKS_EDGE_REQUIRE_STAGING_TESTER");
  const stagingDenied = () => stagingEdgeDenied(stagingCheck, student, AbortSignal.any([request.signal, AbortSignal.timeout(10000)]));
  const stagingRejected = () => respond({ error: "Private staging requires an approved Google tester" }, 403);
  if (await stagingDenied()) return stagingRejected();
  const admin = createClient(url, service, { auth: { persistSession: false } }), bucket = admin.storage.from("community-media");
  let reserved = false;
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.startsWith("application/json")) {
      const input = JSON.parse(new TextDecoder().decode(await drawingRequestBody(request, 4096)));
      if (input.action === "review") {
        const signed = await signedCommunityReview(input,
          (args: { p_report_id: string; p_expected_version: string; p_context: string }) => student.rpc("admin_community_report_media_paths", args), bucket);
        return await stagingDenied() ? stagingRejected() : respond(signed);
      }
      if (input.action === "moderate") {
        const signed = await signedCommunityModeration(input,
          (args: { p_target_type: string; p_target_id: string; p_expected_version: string; p_context: string }) => student.rpc("admin_community_moderation_media_paths", args), bucket);
        return await stagingDenied() ? stagingRejected() : respond(signed);
      }
      const { targetType, targetId } = input;
      if (!communityTarget(targetType, targetId)) throw new CommunityMediaError("Invalid community target", "invalid_target");
      const read = () => student.rpc("community_media_paths", { p_target_type: targetType, p_target_id: targetId });
      const paths = await read();
      if (paths.error) throw new CommunityMediaError("These community images are unavailable.", "target_unavailable", 403);
      const pages = (items: Array<{ path: string }>) => items.map(({ path, ...item }) => ({ ...item, storagePath: path }));
      const initial = pages(paths.data);
      if (initial.length > 3) throw new CommunityMediaError("These community images are unavailable.", "media_unavailable", 502);
      const signed = await signedDrawingPages(bucket, initial);
      const current = await read();
      if (current.error || !sameDrawingPages(initial, pages(current.data))) throw new CommunityMediaError("These community images are unavailable.", "target_unavailable", 403);
      if (await stagingDenied()) return stagingRejected();
      return respond({ media: signed.images, serverNow: signed.serverNow, expiresAt: signed.expiresAt });
    }
    if (!type.startsWith("multipart/form-data")) throw new CommunityMediaError("Invalid image request", "invalid_request");
    if (uploadBusy) throw new CommunityMediaError("Another image is being checked. Try the remaining images again.", "image_busy", 429);
    uploadBusy = reserved = true;
    const body = await drawingRequestBody(request, COMMUNITY_FORM_MAX_BYTES);
    const form = await new Request(request.url, { method: "POST", headers: { "Content-Type": type }, body }).formData();
    const targetType = String(form.get("targetType") ?? ""), targetId = String(form.get("targetId") ?? ""), ordinal = Number(form.get("ordinal")), file = form.get("file");
    if (!communityTarget(targetType, targetId) || !Number.isInteger(ordinal) || ordinal < 1 || ordinal > 3 || !(file instanceof File)) throw new CommunityMediaError("Invalid community image", "invalid_request");
    if (file.size < 1 || file.size > COMMUNITY_MAX_BYTES) throw new CommunityMediaError("Use images no larger than 5 MB each.", "image_size", 413);
    const context = await admin.rpc("service_community_upload_context", { p_user_id: user.id, p_target_type: targetType, p_target_id: targetId });
    if (context.error) throw new CommunityMediaError("This post or reply is unavailable for uploads.", "target_unavailable", 403);
    const checked = await validateCommunityImage(new Uint8Array(await file.arrayBuffer()), file.type, validateRaster);
    const extension = checked.mime === "image/jpeg" ? "jpg" : checked.mime.split("/")[1];
    const path = `community/${user.id}/${targetType}/${targetId.toLowerCase()}/${crypto.randomUUID()}.${extension}`;
    if (await stagingDenied()) return stagingRejected();
    const uploaded = await bucket.upload(path, checked.bytes, { contentType: checked.mime, cacheControl: "0", upsert: false });
    if (uploaded.error) throw uploaded.error;
    if (await stagingDenied()) {
      await bucket.remove([path]);
      return stagingRejected();
    }
    const registered = await admin.rpc("register_community_asset", {
      p_user_id: user.id, p_target_type: targetType, p_target_id: targetId, p_storage_path: path, p_ordinal: ordinal,
      p_mime_type: checked.mime, p_byte_size: checked.bytes.length, p_pixel_width: checked.width, p_pixel_height: checked.height,
      p_image_orientation: checked.orientation, p_image_sha256: checked.sha256,
    });
    if (registered.error) {
      const receipt = await admin.rpc("service_community_upload_receipt", { p_user_id: user.id, p_storage_path: path });
      if (!receipt.error && receipt.data) return respond({ id: receipt.data, ordinal });
      if (!receipt.error) await bucket.remove([path]);
      if (registered.error.code === "42501") throw new CommunityMediaError("This post or reply is unavailable for uploads.", "target_unavailable", 403);
      if (registered.error.code === "23505") throw new CommunityMediaError("This image position is already saved. Open the discussion to review it.", "slot_conflict", 409);
      throw registered.error;
    }
    if (registered.data.reused) await bucket.remove([path]);
    return respond({ id: registered.data.id, ordinal, reused: registered.data.reused });
  } catch (error) {
    const failure = communityMediaFailure(error);
    return respond({ error: failure.error, code: failure.code }, failure.status);
  } finally { if (reserved) uploadBusy = false; }
});
