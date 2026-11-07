import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { extractIntakeAsset } from "../_shared/intake-extract.mjs";

Deno.serve(async request => {
  const origin = Deno.env.get("PUBLIC_APP_ORIGIN");
  const headers = {
    "Access-Control-Allow-Origin": origin ?? "https://invalid.invalid",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin",
  };
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!origin || request.headers.get("origin") !== origin) return respond({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("OPENAI_API_KEY"), model = Deno.env.get("OPENAI_INTAKE_MODEL");
  if (!url || !anon || !service || !apiKey || !model) return respond({ error: "Question extraction is not configured" }, 503);
  const student = createClient(url, anon, {
    global: { headers: { Authorization: request.headers.get("authorization") ?? "" } }, auth: { persistSession: false },
  });
  const { data: { user } } = await student.auth.getUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  const { data: isAdmin, error: roleError } = await student.rpc("is_dmocks_admin");
  if (roleError || !isAdmin) return respond({ error: "Admin access required" }, 403);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  try {
    const { assetId } = await request.json();
    if (typeof assetId !== "string") return respond({ error: "Asset id required" }, 400);
    const result = await extractIntakeAsset({ admin, actorId: user.id, assetId, model, apiKey });
    return respond(result.body, result.status);
  } catch {
    return respond({ error: "Private extraction request failed. Refresh the intake list before retrying." }, 400);
  }
});
