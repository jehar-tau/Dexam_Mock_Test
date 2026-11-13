import { JsonRequestError } from "../_shared/request-json.mjs";
import { IntakeRequestError, isIntakeAssetId, readIntakeJson, readIntakeUpload } from "../_shared/intake-request.mjs";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { intakeFigureDescriptor, intakeFileMatches } from "../_shared/intake-file.mjs";
import { intakeSourceDigest, saveIntakeSource } from "../_shared/intake-source.mjs";

Deno.serve(async request => {
  const origin = Deno.env.get("PUBLIC_APP_ORIGIN");
  const headers = {
    "Access-Control-Allow-Origin": origin ?? "https://invalid.invalid",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!origin || request.headers.get("origin") !== origin) return respond({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return respond({ error: "Intake is not connected" }, 503);
  const student = createClient(url, anon, {
    global: { headers: { Authorization: request.headers.get("authorization") ?? "" } }, auth: { persistSession: false },
  });
  const { data: { user } } = await student.auth.getUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  const { data: isAdmin, error: roleError } = await student.rpc("is_dmocks_admin");
  if (roleError || !isAdmin) return respond({ error: "Admin access required" }, 403);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const { assetId, figureSha } = await readIntakeJson(request);
      if (!isIntakeAssetId(assetId)) return respond({ error: "Intake asset id required" }, 400);
      if (figureSha != null && (typeof figureSha !== "string" || !/^[a-f0-9]{64}$/.test(figureSha))) return respond({ error: "Invalid figure digest" }, 400);
      const source = figureSha ? await student.rpc("admin_question_intake_figure_source", { p_asset_id: assetId, p_sha256: figureSha })
        : await student.rpc("admin_question_intake_source", { p_asset_id: assetId });
      if (source.error) return respond({ error: "Intake source unavailable" }, 403);
      const { data: file, error } = await admin.storage.from("question-intake").download(source.data.storagePath);
      if (error || !file) return respond({ error: "Private source download failed. Try again." }, 502);
      if (file.size !== source.data.byteSize || !intakeFileMatches(new Uint8Array(await file.slice(0, 12).arrayBuffer()), source.data.mimeType)) {
        return respond({ error: "Private source does not match its registered file" }, 409);
      }
      if (source.data.sourceSha256 != null && await intakeSourceDigest(await file.arrayBuffer()) !== source.data.sourceSha256) {
        return respond({ error: "Private source does not match its registered file" }, 409);
      }
      if (figureSha) {
        const figure = await intakeFigureDescriptor(new Uint8Array(await file.arrayBuffer()), crypto.subtle.digest.bind(crypto.subtle));
        if (figure.sha256 !== figureSha) return respond({ error: "Retained figure does not match its digest" }, 409);
      }
      return new Response(file, { headers: { ...headers, "Content-Type": "application/octet-stream", "Content-Disposition": "attachment" } });
    }
    const { file, assetId } = await readIntakeUpload(request);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!intakeFileMatches(bytes, file.type)) return respond({ error: "File content does not match its PDF or image type" }, 400);
    if (assetId !== null) {
      const source = await student.rpc("admin_question_intake_source", { p_asset_id: assetId });
      if (source.error) return respond({ error: "Intake source unavailable" }, 403);
      const figure = await intakeFigureDescriptor(bytes, crypto.subtle.digest.bind(crypto.subtle));
      const path = `figures/${assetId}/${figure.sha256}.png`;
      const uploaded = await admin.storage.from("question-intake").upload(path, bytes, { contentType: "image/png", upsert: false });
      if (uploaded.error) {
        const existing = await admin.storage.from("question-intake").download(path);
        if (existing.error || !existing.data) throw new Error("Private figure upload failed");
        const verified = await intakeFigureDescriptor(new Uint8Array(await existing.data.arrayBuffer()), crypto.subtle.digest.bind(crypto.subtle));
        if (verified.sha256 !== figure.sha256) throw new Error("Retained figure digest mismatch");
      }
      const saved = await admin.rpc("register_question_intake_figure", {
        p_asset_id: assetId, p_sha256: figure.sha256, p_width: figure.width, p_height: figure.height, p_byte_size: file.size, p_uploaded_by: user.id,
      });
      if (saved.error) throw saved.error;
      return respond({ asset: figure });
    }
    const saved = await saveIntakeSource({ admin, actorId: user.id, name: file.name, mimeType: file.type, bytes });
    return respond(saved.body, saved.status);
  } catch (error) {
    if (error instanceof IntakeRequestError || error instanceof JsonRequestError) return respond({ error: error.message }, error.status);
    return respond({ error: "Private intake request failed. Refresh the intake list before trying again." }, 400);
  }
});
