import { createClient } from "npm:@supabase/supabase-js@2.117.2";

Deno.serve(async (request) => {
  const origin = Deno.env.get("PUBLIC_APP_ORIGIN");
  const headers = { "Access-Control-Allow-Origin": origin ?? "https://invalid.invalid", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin" };
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!origin || request.headers.get("origin") !== origin) return respond({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return respond({ error: "Uploads are not connected" }, 503);
  const student = createClient(url, anon, { global: { headers: { Authorization: request.headers.get("authorization") ?? "" } }, auth: { persistSession: false } });
  const { data: { user } } = await student.auth.getUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const { action, id, attemptId, questionId } = await request.json();
      if (action === "list" && typeof attemptId === "string" && typeof questionId === "string") {
        const listed = await student.rpc("my_drawing_uploads", { p_attempt_id: attemptId, p_question_id: questionId });
        if (listed.error) throw listed.error;
        return respond({ items: listed.data });
      }
      if (action !== "remove" || typeof id !== "string") return respond({ error: "Invalid drawing action" }, 400);
      const removed = await student.rpc("remove_drawing_upload", { p_id: id });
      if (removed.error) throw removed.error;
      const deletion = await admin.storage.from("drawing-submissions").remove([removed.data]);
      if (deletion.error) throw deletion.error;
      return respond({ removed: id });
    }
    const form = await request.formData(), attempt = String(form.get("attemptId") ?? ""), question = String(form.get("questionId") ?? ""), ordinal = Number(form.get("ordinal")), file = form.get("file");
    if (!(file instanceof File) || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10485760 || file.size < 1 || !Number.isInteger(ordinal) || ordinal < 1 || ordinal > 5) return respond({ error: "Invalid drawing image" }, 400);
    const path = `drawings/${user.id}/${attempt}/${question}/${crypto.randomUUID()}.${file.type.split("/")[1].replace("jpeg", "jpg")}`;
    const uploaded = await admin.storage.from("drawing-submissions").upload(path, file, { contentType: file.type, upsert: false });
    if (uploaded.error) throw uploaded.error;
    const registered = await admin.rpc("register_drawing_upload", { p_attempt_id: attempt, p_question_id: question, p_storage_path: path, p_ordinal: ordinal, p_mime_type: file.type, p_byte_size: file.size });
    if (registered.error) { await admin.storage.from("drawing-submissions").remove([path]); throw registered.error; }
    return respond({ id: registered.data, ordinal });
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Drawing request failed" }, 400);
  }
});
