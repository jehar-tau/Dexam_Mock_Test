import { createClient } from "npm:@supabase/supabase-js@2.117.2";
// Private bank images are signed only after ownership is checked by read_attempt.
Deno.serve(async (request) => {
  const origin = Deno.env.get("PUBLIC_APP_ORIGIN");
  const headers = {
    "Access-Control-Allow-Origin": origin ?? "https://invalid.invalid",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (!origin || request.headers.get("origin") !== origin)
    return reply({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return reply({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"),
    anon = Deno.env.get("SUPABASE_ANON_KEY"),
    service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service)
    return reply({ error: "Media is not connected" }, 503);
  const authorization = request.headers.get("authorization") ?? "";
  const student = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: identity, error: identityError } = await student.auth.getUser();
  if (identityError || !identity.user)
    return reply({ error: "Sign in required" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return reply({ error: "Invalid request" }, 400);
  }
  if (!/^[a-f0-9-]{36}$/i.test(body?.attemptId ?? ""))
    return reply({ error: "Invalid attempt" }, 400);
  const { data: attempt, error } = await student.rpc("read_attempt", {
    p_id: body.attemptId,
  });
  if (error || !attempt) return reply({ error: "Attempt unavailable" }, 404);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const mediaTtl = Math.min(
    21900,
    Math.max(
      7200,
      Math.ceil((new Date(attempt.deadline).getTime() - Date.now()) / 1000) +
        300,
    ),
  );
  const media: Record<string, unknown[]> = Object.create(null);
  try {
    const paths: string[] = [];
    const owners: string[] = [];
    for (const item of attempt.questions) {
      media[item.id] = [];
      for (const image of item.media ?? []) {
        // Asset import allows raster files only. No external tracking URLs or SVG scripts.
        if (
          typeof image.path !== "string" ||
          image.path.includes("..") ||
          !/^papers\/[a-zA-Z0-9_/-]+\.(png|jpe?g|webp)$/i.test(image.path)
        )
          throw new Error("Invalid bank media");
        paths.push(image.path);
        owners.push(item.id);
      }
    }
    if (paths.length) {
      const { data, error } = await admin.storage
        .from("paper-media")
        .createSignedUrls(paths, mediaTtl);
      if (error || !data || data.length !== paths.length)
        throw new Error("Media unavailable");
      data.forEach((signed, index) => {
        if (!signed.signedUrl) throw new Error("Media unavailable");
        media[owners[index]].push({ url: signed.signedUrl });
      });
    }
    return reply({ media });
  } catch {
    return reply(
      {
        error: "Question images could not be loaded. Please contact the team.",
      },
      503,
    );
  }
});
