import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { rasterMimeType } from "../_shared/raster.mjs";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const isId = (value: unknown): value is string => typeof value === "string" && uuid.test(value);

Deno.serve(async (request) => {
  const origin = Deno.env.get("PUBLIC_APP_ORIGIN");
  const headers = { "Access-Control-Allow-Origin": origin ?? "https://invalid.invalid", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin" };
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!origin || request.headers.get("origin") !== origin) return respond({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return respond({ error: "Uploads are not connected" }, 503);
  const student = createClient(url, anon, { global: { headers: { Authorization: request.headers.get("authorization") ?? "" } }, auth: { persistSession: false } });
  const { data: { user } } = await student.auth.getUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const bucket = admin.storage.from("drawing-submissions");
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const { action, id, attemptId, questionId } = await request.json();
      if (action === "list" && isId(attemptId) && isId(questionId)) {
        const listed = await student.rpc("my_drawing_uploads", { p_attempt_id: attemptId, p_question_id: questionId });
        if (listed.error) throw listed.error;
        return respond({ items: listed.data });
      }
      if (action !== "remove" || !isId(id)) return respond({ error: "Invalid drawing action" }, 400);
      const removed = await admin.rpc("remove_drawing_upload", { p_student_id: user.id, p_id: id });
      if (removed.error) throw removed.error;
      const deletion = await bucket.remove([removed.data]);
      if (deletion.error) console.error("Drawing storage deletion failed");
      return respond({ removed: id });
    }
    const form = await request.formData();
    const attemptId = form.get("attemptId"), questionId = form.get("questionId");
    const ordinal = Number(form.get("ordinal")), file = form.get("file");
    if (!isId(attemptId) || !isId(questionId) || !(file instanceof File) || file.size > 10485760 ||
      file.size < 1 || !Number.isInteger(ordinal) || ordinal < 1 || ordinal > 5) {
      return respond({ error: "Invalid drawing image or page number" }, 400);
    }
    const eligible = await student.rpc("can_upload_drawing", {
      p_attempt_id: attemptId, p_question_id: questionId, p_ordinal: ordinal,
    });
    if (eligible.error) throw eligible.error;
    if (!eligible.data) return respond({ error: "Drawing page unavailable" }, 403);
    const mime = rasterMimeType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
    if (!mime || mime !== file.type) return respond({ error: "Image content does not match its file type" }, 400);
    const extension = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
    const path = `drawings/${crypto.randomUUID()}.${extension}`;
    const uploaded = await bucket.upload(path, file, { contentType: mime, upsert: false });
    if (uploaded.error) throw uploaded.error;
    const registered = await admin.rpc("register_drawing_upload", {
      p_student_id: user.id, p_attempt_id: attemptId, p_question_id: questionId,
      p_storage_path: path, p_ordinal: ordinal, p_mime_type: mime, p_byte_size: file.size,
    });
    if (registered.error) {
      // An ambiguous network failure can occur after the database committed.
      if (registered.status >= 400 && registered.status < 500) {
        const cleanup = await bucket.remove([path]);
        if (cleanup.error) console.error("Rejected drawing storage cleanup failed");
      }
      throw registered.error;
    }
    return respond({ id: registered.data, ordinal });
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Drawing request failed" }, 400);
  }
});
