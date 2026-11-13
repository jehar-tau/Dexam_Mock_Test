import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { createCandidatePhoneHandler } from "../supabase/functions/_shared/candidate-phone.mjs";

const actor = "00000000-0000-4000-8000-000000001551";
const id = "00000000-0000-4000-8000-000000001552";
const phone = "+919000001551";
const origin = "http://127.0.0.1:5175";
const sentAt = {
  expiresAt: "2026-11-09T17:55:00.000Z",
  retryAt: "2026-11-09T17:51:00.000Z",
};
const send = { action: "send", phone, challengeId: id };
const verify = code => ({ ...send, action: "verify", code });

function fixture({ registration = "google", rpc, providerFetch, admission = true, overrides = {} } = {}) {
  const settings = {
    PUBLIC_APP_ORIGIN: origin,
    SUPABASE_URL: "http://127.0.0.1:5555",
    SUPABASE_ANON_KEY: "fictional-anon-phone-key",
    SUPABASE_SERVICE_ROLE_KEY: "fictional-service-phone-key",
    DMOCKS_PHONE_SMS_PROVIDER: "msg91-flow",
    DMOCKS_PHONE_CHALLENGE_KEY: "ab".repeat(32),
    DMOCKS_MSG91_AUTHKEY: "fictional-authkey",
    DMOCKS_MSG91_FLOW_TEMPLATE: "fictional-template",
    ...overrides,
  };
  const auth = [], database = [], deliveries = [];
  let reservation = null;
  const handler = createCandidatePhoneHandler({
    readEnvironment: name => settings[name],
    providerFetch: async (url, request) => {
      const payload = JSON.parse(request.body);
      deliveries.push(payload);
      assert.equal(url, "https://control.msg91.com/api/v5/flow");
      assert.equal(request.redirect, "error");
      assert.equal(request.method, "POST");
      assert.equal(request.headers.authkey, settings.DMOCKS_MSG91_AUTHKEY);
      assert.equal(request.signal.aborted, false);
      return providerFetch ? providerFetch() : Response.json({ type: "success", message: "fictional-receipt" });
    },
    createClient: (url, key, options) => {
      assert.equal(url, settings.SUPABASE_URL);
      assert.equal(options.auth.persistSession, false);
      if (key === settings.SUPABASE_ANON_KEY) {
        return { auth: { getUser: async token => {
          auth.push(token);
          assert.equal(options.global.headers.Authorization, "Bearer " + token);
          if (token !== "fictional-user-token") return { error: { message: "private authentication diagnostic" } };
          return { data: { user: { id: actor, app_metadata: { provider: registration }, is_anonymous: false } } };
        } }, rpc: name => {
          assert.equal(name, "can_enter_staging_portal");
          return { abortSignal: () => Promise.resolve({ data: admission }) };
        } };
      }
      assert.equal(key, settings.SUPABASE_SERVICE_ROLE_KEY);
      return { rpc: async (name, args) => {
        database.push({ name, args });
        if (rpc) return rpc(name, args);
        if (name === "prepare_candidate_phone_challenge") {
          const status = reservation ? "existing" : "created";
          reservation ??= args;
          return { data: { status, ...sentAt } };
        }
        return { data: { status: args.p_code_digest === reservation?.p_code_digest ? "verified" : "invalid" } };
      } };
    },
  });
  return { handler, auth, database, deliveries, settings };
}

function request(body, { source = origin, token = "fictional-user-token", method = "POST" } = {}) {
  const headers = { Origin: source, "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  return new Request(origin + "/candidate-phone", {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("origin, configuration, identity and exact bounded request checks precede SMS and database dispatch", async () => {
  const closed = fixture({ overrides: { DMOCKS_PHONE_SMS_PROVIDER: undefined } });
  assert.equal((await closed.handler(request(send))).status, 503);
  assert.equal((await closed.handler(request(send, { source: "https://invalid.example" }))).status, 403);
  const preflight = await closed.handler(request(undefined, { method: "OPTIONS" }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
  assert.deepEqual(closed.auth, []);

  const f = fixture();
  assert.equal((await f.handler(request(send, { token: "" }))).status, 401);
  for (const malformed of [{ ...send, actor }, { ...send, phone: "919000001551" }, verify("01234x"),
    verify(123456), { ...send, challengeId: "x".repeat(1200) }]) {
    assert.equal((await f.handler(request(malformed))).status, 400);
  }
  assert.deepEqual(f.auth, []);
  const identity = await f.handler(request(send, { token: "unverified-token" }));
  assert.equal(identity.status, 401);
  assert.doesNotMatch(await identity.text(), /private authentication diagnostic/);
  assert.deepEqual(f.database, []);
  assert.deepEqual(f.deliveries, []);

  const nonGoogle = fixture({ registration: "phone" });
  assert.equal((await nonGoogle.handler(request(send))).status, 401);
  assert.deepEqual(nonGoogle.database, []);
  const noCredentials = fixture({ overrides: { DMOCKS_MSG91_AUTHKEY: undefined } });
  assert.equal((await noCredentials.handler(request(send))).status, 503);
  assert.deepEqual(noCredentials.database, []);
});

test("the service dispatches one templated code and binds its keyed proof to the verified account and saved phone", async () => {
  const f = fixture();
  const response = await f.handler(request(send));
  assert.deepEqual(await response.json(), { status: "sent", ...sentAt });
  assert.equal(response.headers.get("cache-control"), "no-store");
  const code = f.deliveries[0].recipients[0].OTP;
  assert.match(code, /^[0-9]{6}$/);
  assert.deepEqual(f.deliveries, [{ template_id: f.settings.DMOCKS_MSG91_FLOW_TEMPLATE,
    recipients: [{ mobiles: phone.slice(1), OTP: code }] }]);
  const hmac = fields => createHmac("sha256", Buffer.from(f.settings.DMOCKS_PHONE_CHALLENGE_KEY, "hex"))
    .update(JSON.stringify(fields)).digest("hex");
  const stored = f.database[0];
  assert.deepEqual(stored, { name: "prepare_candidate_phone_challenge", args: {
    p_user_id: actor, p_phone: phone, p_challenge_id: id,
    p_code_digest: hmac(["dmocks-phone-code-v1", actor, phone, id, code]),
    p_destination_digest: hmac(["dmocks-phone-destination-v1", phone]),
  } });
  const wrong = code === "000000" ? "000001" : "000000";
  assert.deepEqual(await (await f.handler(request(verify(wrong)))).json(), { status: "invalid" });
  delete f.settings.DMOCKS_MSG91_AUTHKEY;
  assert.deepEqual(await (await f.handler(request(verify(code)))).json(), { status: "verified" });
  assert.deepEqual(f.database.at(-1), { name: "confirm_candidate_phone_challenge", args: {
    p_user_id: actor, p_phone: phone, p_challenge_id: id, p_code_digest: stored.args.p_code_digest,
  } });
  assert.equal(f.deliveries.length, 1);
});

test("an uncertain provider reply preserves the reserved challenge without dispatching a second SMS", async () => {
  const f = fixture({ providerFetch: () => { throw new Error("private transport diagnostic"); } });
  assert.deepEqual(await (await f.handler(request(send))).json(), { status: "unconfirmed", ...sentAt });
  assert.deepEqual(await (await f.handler(request(send))).json(), { status: "unconfirmed", ...sentAt });
  const code = f.deliveries[0].recipients[0].OTP;
  assert.deepEqual(await (await f.handler(request(verify(code)))).json(), { status: "verified" });
  assert.equal(f.deliveries.length, 1);
});

test("ineligible profiles, cooldowns, quotas and incomplete server replies cannot dispatch SMS", async () => {
  for (const status of ["unavailable", "cooldown", "limit"]) {
    const f = fixture({ rpc: async () => ({ data: { status, retryAt: sentAt.retryAt, private: "private server field" } }) });
    const expected = status === "unavailable" ? { status } : { status, retryAt: sentAt.retryAt };
    assert.deepEqual(await (await f.handler(request(send))).json(), expected);
    assert.deepEqual(f.deliveries, []);
  }
  const f = fixture({ rpc: async () => ({ data: { status: "created", expiresAt: "invalid" } }) });
  const response = await f.handler(request(send));
  assert.equal(response.status, 503);
  assert.deepEqual(f.deliveries, []);
});

test("a provider error response is treated as delivery uncertainty even on HTTP success", async () => {
  const f = fixture({ providerFetch: () => Response.json({ type: "error", message: "private vendor diagnostic" }) });
  assert.deepEqual(await (await f.handler(request(send))).json(), { status: "unconfirmed", ...sentAt });
  assert.equal(f.deliveries.length, 1);
});

test("an unapproved staging account cannot reserve a phone challenge or send SMS", async () => {
  const f = fixture({ admission: false, overrides: { DMOCKS_EDGE_REQUIRE_STAGING_TESTER: "true" } });
  for (const body of [send, verify("123456")]) {
    assert.equal((await f.handler(request(body))).status, 403);
  }
  assert.equal(f.database.length, 0);
  assert.equal(f.deliveries.length, 0);
});
