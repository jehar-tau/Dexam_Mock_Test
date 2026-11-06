import { createClient } from "npm:@supabase/supabase-js@2.117.2";

type Page = { id: string; ordinal: number; storagePath: string };

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
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return respond({ error: "Review media is not connected" }, 503);
  const reviewer = createClient(url, anon, {
    global: { headers: { Authorization: request.headers.get("authorization") ?? "" } },
    auth: { persistSession: false },
  });
  try {
    const { reviewId } = await request.json();
    if (typeof reviewId !== "string") return respond({ error: "Invalid review" }, 400);
    const result = await reviewer.rpc("admin_drawing_review_media_paths", { p_review_id: reviewId });
    if (result.error) return respond({ error: "Drawing pages are unavailable for this review." }, 403);
    const pages: Page[] = result.data;
    if (!pages.length) return respond({ images: [] });
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const signed = await admin.storage.from("drawing-submissions").createSignedUrls(pages.map((page) => page.storagePath), 300);
    if (signed.error) return respond({ error: "Drawing pages could not be opened. Try again." }, 502);
    const links = new Map(signed.data.filter((entry) => !entry.error && entry.signedUrl)
      .map((entry) => [entry.path, entry.signedUrl]));
    if (pages.some((page) => !links.has(page.storagePath))) {
      return respond({ error: "A drawing page could not be opened. Try again." }, 502);
    }
    return respond({ images: pages.map(({ id, ordinal, storagePath }) => ({ id, ordinal, url: links.get(storagePath) })) });
  } catch {
    return respond({ error: "Invalid drawing review request" }, 400);
  }
});
