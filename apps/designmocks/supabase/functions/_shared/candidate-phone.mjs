import { stagingEdgeDenied } from "./staging-edge-admission.mjs";
import { drawingRequestBody as readLimitedBody } from "./drawing-request.mjs";

const phonePattern = /^\+[1-9][0-9]{7,14}$/;
const uuidPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const codePattern = /^[0-9]{6}$/;
const msg91Endpoint = "https://control.msg91.com/api/v5/flow";
const encoder = new TextEncoder();

async function jsonBody(message, bytes) {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await readLimitedBody(message, bytes)));
}

function validInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      typeof body.phone !== "string" || !phonePattern.test(body.phone) ||
      typeof body.challengeId !== "string" || !uuidPattern.test(body.challengeId)) return false;
  if (body.action === "send") return Object.keys(body).length === 3;
  return body.action === "verify" && Object.keys(body).length === 4 &&
    typeof body.code === "string" && codePattern.test(body.code);
}

function issueCode() {
  const entropy = new Uint32Array(1);
  // Reject the short tail so each six-digit value has the same probability.
  do crypto.getRandomValues(entropy); while (entropy[0] >= 4_294_000_000);
  return String(entropy[0] % 1_000_000).padStart(6, "0");
}

async function digest(key, fields) {
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify(fields))));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function normalizedTime(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

async function sendCode({ phone, code, apiKey, template, fetcher, signal }) {
  const response = await fetcher(msg91Endpoint, {
    method: "POST",
    headers: { authkey: apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ template_id: template, recipients: [{ mobiles: phone.slice(1), OTP: code }] }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    redirect: "error",
  });
  return response.ok && (await jsonBody(response, 4096))?.type === "success";
}

export function createCandidatePhoneHandler({ createClient, readEnvironment, sdkFetch = globalThis.fetch,
  providerFetch = globalThis.fetch }) {
  return async request => {
    const origin = readEnvironment("PUBLIC_APP_ORIGIN");
    const headers = {
      "Access-Control-Allow-Origin": origin ?? "https://invalid.invalid",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    const reply = (data, status = 200) => Response.json(data, { status, headers });
    const unavailable = () => reply({ error: "Phone verification is unavailable." }, 503);
    if (!origin || request.headers.get("origin") !== origin) return reply({ error: "Origin not allowed" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);

    const provider = readEnvironment("DMOCKS_PHONE_SMS_PROVIDER");
    const keyHex = readEnvironment("DMOCKS_PHONE_CHALLENGE_KEY");
    const url = readEnvironment("SUPABASE_URL");
    const anon = readEnvironment("SUPABASE_ANON_KEY");
    const service = readEnvironment("SUPABASE_SERVICE_ROLE_KEY");
    if (provider !== "msg91-flow" || !/^[a-f0-9]{64}$/.test(keyHex ?? "") || !url || !anon || !service) {
      return unavailable();
    }
    const authorization = request.headers.get("authorization") ?? "";
    if (!/^Bearer \S+$/.test(authorization)) return reply({ error: "Sign in required" }, 401);
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
      return reply({ error: "Invalid request" }, 400);
    }
    let body;
    try { body = await jsonBody(request, 1024); }
    catch { return reply({ error: "Invalid request" }, 400); }
    if (!validInput(body)) return reply({ error: "Invalid request" }, 400);

    const apiKey = readEnvironment("DMOCKS_MSG91_AUTHKEY");
    const template = readEnvironment("DMOCKS_MSG91_FLOW_TEMPLATE");
    if (body.action === "send" && (!/^[A-Za-z0-9_-]{8,160}$/.test(apiKey ?? "") ||
        !/^[A-Za-z0-9_-]{8,80}$/.test(template ?? ""))) return unavailable();
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15000)]);
    const boundedFetch = (input, init = {}) => sdkFetch(input, {
      ...init,
      signal: init.signal ? AbortSignal.any([init.signal, signal]) : signal,
      redirect: "error",
    });
    try {
      const student = createClient(url, anon, {
        global: { headers: { Authorization: authorization }, fetch: boundedFetch },
        auth: { persistSession: false },
      });
      const { data: auth, error: identityError } = await student.auth.getUser(authorization.slice(7));
      signal.throwIfAborted();
      const user = auth?.user;
      if (identityError || !uuidPattern.test(user?.id ?? "") ||
          user.app_metadata?.provider !== "google" || user.is_anonymous === true) {
        return reply({ error: "Sign in with Google to verify your phone." }, 401);
      }
      if (await stagingEdgeDenied(readEnvironment("DMOCKS_EDGE_REQUIRE_STAGING_TESTER"), student, signal)) {
        return reply({ error: "Private staging requires an approved Google tester" }, 403);
      }
      const key = await crypto.subtle.importKey("raw", Uint8Array.from(keyHex.match(/../g), hex => parseInt(hex, 16)),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const id = body.challengeId.toLowerCase();
      const actor = user.id.toLowerCase();
      const code = body.action === "send" ? issueCode() : body.code;
      const input = {
        p_user_id: actor, p_phone: body.phone, p_challenge_id: id,
        p_code_digest: await digest(key, ["dmocks-phone-code-v1", actor, body.phone, id, code]),
      };
      signal.throwIfAborted();
      const admin = createClient(url, service, { global: { fetch: boundedFetch }, auth: { persistSession: false } });
      if (body.action === "verify") {
        const { data, error } = await admin.rpc("confirm_candidate_phone_challenge", input);
        if (error || !["verified", "invalid", "expired", "unavailable"].includes(data?.status)) return unavailable();
        return reply({ status: data.status });
      }
      const { data, error } = await admin.rpc("prepare_candidate_phone_challenge", {
        ...input, p_destination_digest: await digest(key, ["dmocks-phone-destination-v1", body.phone]),
      });
      if (error) return unavailable();
      if (data?.status === "unavailable") return reply({ status: "unavailable" });
      const retryAt = normalizedTime(data?.retryAt);
      if (["cooldown", "limit"].includes(data?.status) && retryAt) return reply({ status: data.status, retryAt });
      const expiresAt = normalizedTime(data?.expiresAt);
      if (!["created", "existing"].includes(data?.status) || !expiresAt || !retryAt) return unavailable();
      let sent = false;
      if (data.status === "created") {
        try {
          signal.throwIfAborted();
          sent = await sendCode({ phone: body.phone, code, apiKey, template, fetcher: providerFetch, signal });
        } catch {
          // A reserved challenge can still be confirmed if delivery succeeded before a lost reply.
        }
      }
      return reply({ status: sent ? "sent" : "unconfirmed", expiresAt, retryAt });
    } catch {
      // Provider and database diagnostics can include private destinations or credentials.
      return unavailable();
    }
  };
}
