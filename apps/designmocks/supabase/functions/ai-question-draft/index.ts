import { JsonRequestError, readJsonObject } from "../_shared/request-json.mjs";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { runAiDraft } from "../_shared/ai-draft-run.mjs";

Deno.serve(async (request) => {
  const origin = Deno.env.get("PUBLIC_APP_ORIGIN");
  const headers = {
    "Access-Control-Allow-Origin": origin ?? "https://invalid.invalid",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!origin || request.headers.get("origin") !== origin) return respond({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_DRAFT_MODEL");
  if (!url || !anon || !service || !apiKey || !model) return respond({ error: "AI drafting is not configured" }, 503);

  const caller = createClient(url, anon, {
    global: { headers: { Authorization: request.headers.get("authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const worker = createClient(url, service, { auth: { persistSession: false } });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  try {
    const result = await runAiDraft({ caller, worker, actorId: user.id, input: await readJsonObject(request, 64 * 1024, "draft"), model, apiKey });
    return respond(result.body, result.status);
  } catch (error) {
    if (error instanceof JsonRequestError) return respond({ error: error.message }, error.status);
    return respond({ error: "Draft processing could not be confirmed. Refresh the queue before trying again." }, 400);
  }
});
