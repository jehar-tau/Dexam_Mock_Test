import { stagingEdgeDenied } from "../_shared/staging-edge-admission.mjs";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

type Figure = { ordinal: number; width: number; height: number; storagePath: string };

Deno.serve(async request => {
  const origin = Deno.env.get("PUBLIC_APP_ORIGIN");
  const headers = {
    "Access-Control-Allow-Origin": origin ?? "https://invalid.invalid",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json",
    "Cache-Control": "no-store", Vary: "Origin",
  };
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!origin || request.headers.get("origin") !== origin) return respond({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return respond({ error: "Bank review images are not connected" }, 503);
  const reviewer = createClient(url, anon, { global: { headers: { Authorization: request.headers.get("authorization") ?? "" } }, auth: { persistSession: false } });
  const stagingCheck = Deno.env.get("DMOCKS_EDGE_REQUIRE_STAGING_TESTER");
  const stagingDenied = () => stagingEdgeDenied(stagingCheck, reviewer, AbortSignal.any([request.signal, AbortSignal.timeout(10000)]));
  if (await stagingDenied()) return respond({ error: "Private staging requires an approved Google tester" }, 403);
  try {
    const { externalKey, reviewVersion } = await request.json();
    if (typeof externalKey !== "string" || typeof reviewVersion !== "string") return respond({ error: "A bank question and review version are required" }, 400);
    const readPaths = () => reviewer.rpc("admin_bank_review_media_paths", { p_external_key: externalKey, p_expected_version: reviewVersion });
    const paths = await readPaths();
    if (paths.error) return respond({ error: "Question figures are unavailable. Refresh the bank and review it again." }, paths.error.code === "42501" ? 403 : 409);
    const figures: Figure[] = paths.data;
    if (!figures.length) return respond({ images: [] });
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const signed = await admin.storage.from("paper-media").createSignedUrls(figures.map(figure => figure.storagePath), 300);
    if (signed.error) return respond({ error: "Private figures could not be opened. Try again." }, 502);
    const links = new Map(signed.data.filter(entry => !entry.error && entry.signedUrl).map(entry => [entry.path, entry.signedUrl]));
    if (figures.some(figure => !links.has(figure.storagePath))) return respond({ error: "A private figure could not be opened. Try again." }, 502);
    if (await stagingDenied()) return respond({ error: "Private staging requires an approved Google tester" }, 403);
    const currentPaths = await readPaths();
    const identity = (rows: Figure[]) => rows.map(figure => [figure.ordinal, figure.storagePath, figure.width, figure.height]);
    if (currentPaths.error || !Array.isArray(currentPaths.data)
      || JSON.stringify(identity(currentPaths.data)) !== JSON.stringify(identity(figures))) {
      return respond({ error: "Question figures are unavailable. Refresh the bank and review it again." }, currentPaths.error?.code === "42501" ? 403 : 409);
    }
    return respond({ images: figures.map(({ ordinal, width, height, storagePath }) => ({ ordinal, width, height, url: links.get(storagePath) })) });
  } catch {
    return respond({ error: "Invalid bank review image request" }, 400);
  }
});
