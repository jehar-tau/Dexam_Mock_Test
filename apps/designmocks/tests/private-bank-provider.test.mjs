import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { openPrivateBankProvider } from "../scripts/private-bank-provider.mjs";
import { applyManifest, buildManifest } from "../scripts/question-bank-import.mjs";
import project from "../supabase/project.json" with { type: "json" };

const health = { scope: "paid-mvp-v1", monitorVersion: 1, apiProfileReady: true };
const reference = "a".repeat(20);
const managedOrigin = `https://${reference}.supabase.co`;
const jwt = claims => `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
const hosted = { url: managedOrigin, allowOrigin: managedOrigin, environment: "staging",
  serviceRoleKey: jwt({ role: "service_role", ref: reference }) };
const local = origin => ({ url: origin, allowOrigin: origin, environment: "development",
  serviceRoleKey: "sb_secret_fictional_only" });
const fixture = buildManifest({ schemaVersion: 1, questions: [{
  externalKey: "fixture-private-q1", type: "NAT", prompt: "Original fictional transfer probe",
  provenance: { exam: "uceed" }, answer: { raw: "1", status: "reviewed" }, holds: [],
}] });

test("private bank transport validates the selected project, environment and credential before a request", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return Response.json(health); };
  for (const [changes, failure] of [
    [{ allowOrigin: "https://other.invalid" }, /exactly match/],
    [{ url: "https://fake.supabase.co.invalid", allowOrigin: "https://fake.supabase.co.invalid" }, /approved Supabase/],
    [{ url: "https://user@" + reference + ".supabase.co" }, /approved Supabase/],
    [{ url: managedOrigin + "/rest/v1" }, /approved Supabase/],
    [{ environment: "development" }, /Development requires loopback/],
    [{ environment: "production" }, /acknowledgement/],
    [{ serviceRoleKey: "sb_publishable_fake" }, /server-only/],
    [{ serviceRoleKey: jwt({ role: "service_role", ref: "b".repeat(20) }) }, /different provider project/],
    [{ ...local("http://127.0.0.1:54321"), serviceRoleKey: hosted.serviceRoleKey }, /different provider project/],
  ]) await assert.rejects(openPrivateBankProvider({ ...hosted, ...changes }, { fetchImpl }), failure);
  assert.equal(calls, 0);
  await openPrivateBankProvider({ ...hosted, environment: "production", productionAck: "USE_PRIVATE_BANK_ON_" + managedOrigin }, { fetchImpl });
  assert.equal(calls, 1);
});

test("operator tools refuse the designated staging project in production mode before any request", async () => {
  const stagingOrigin = `https://${project.project_ref}.supabase.co`;
  let calls = 0;
  const fetchImpl = async () => { calls++; return Response.json(health); };
  const config = {
    url: stagingOrigin, allowOrigin: stagingOrigin, serviceRoleKey: "sb_secret_fictional_staging",
  };
  await assert.rejects(openPrivateBankProvider({
    ...config, environment: "production", productionAck: "USE_PRIVATE_BANK_ON_" + stagingOrigin,
  }, { fetchImpl }), /separate Supabase project/);
  assert.equal(calls, 0);
  await openPrivateBankProvider({ ...config, environment: "staging" }, { fetchImpl });
  assert.equal(calls, 1);
});

test("preflight must verify the current DMocks profile before sending private rows", async () => {
  const config = local("http://127.0.0.1:54321");
  for (const reply of [
    () => Response.json({ ...health, apiProfileReady: false }),
    () => Response.json({ ...health, scope: "different-app" }),
    () => new Response("Private backend diagnostic", { status: 401 }),
  ]) {
    const calls = [];
    const fetchImpl = async (url, request) => {
      calls.push(new URL(url).pathname);
      assert.deepEqual(JSON.parse(request.body), {});
      return reply();
    };
    await assert.rejects(applyManifest(fixture, config, fetchImpl), error => !error.message.includes("Private backend diagnostic"));
    assert.deepEqual(calls, ["/rest/v1/rpc/admin_operational_health"]);
  }
});

test("an expanded single-project Test portal needs a separate read-only bank authorization audit", async () => {
  const origin = `https://${project.project_ref}.supabase.co`;
  const config = { url: origin, allowOrigin: origin, environment: 'staging',
    serviceRoleKey: 'sb_secret_fictional_staging', expandedStagingProfile: true,
    auditDatabaseUrl: 'postgresql://fictional:fictional@localhost/postgres',
    auditDatabaseCaFile: '/private/fictional-ca.pem' };
  const fetchImpl = async () => Response.json({ ...health, apiProfileReady: false, paymentMode: 'test' });
  const verified = { closedSettings: true, restrictedAdmission: true, testCheckoutClosed: true,
    profileDrift: true, bankServiceOnly: true };
  let audits = 0, closes = 0;
  const openDatabase = async (url, options) => {
    audits++;
    assert.equal(url, config.auditDatabaseUrl);
    assert.deepEqual(options, { localOnly: false, databaseCaFile: config.auditDatabaseCaFile });
    return { query: async sql => {
      assert.match(sql, /begin_question_bank_import/);
      assert.match(sql, /has_function_privilege\('anon'/);
      return JSON.stringify(verified);
    }, close: async () => { closes++; } };
  };
  await openPrivateBankProvider(config, { fetchImpl, openDatabase });
  assert.deepEqual([audits, closes], [1, 1]);
  for (const changes of [{ expandedStagingProfile: false }, { environment: 'production' },
    { url: managedOrigin, allowOrigin: managedOrigin }, { auditDatabaseCaFile: undefined }])
    await assert.rejects(openPrivateBankProvider({ ...config, ...changes }, { fetchImpl, openDatabase }));
  assert.deepEqual([audits, closes], [1, 1]);
  await assert.rejects(openPrivateBankProvider(config, {
    fetchImpl: async () => Response.json({ ...health, apiProfileReady: false, paymentMode: 'live' }), openDatabase,
  }));
  assert.deepEqual([audits, closes], [1, 1]);
  for (const key of Object.keys(verified)) {
    const denied = { ...verified, [key]: false };
    await assert.rejects(openPrivateBankProvider(config, { fetchImpl,
      openDatabase: async () => ({query: async () => JSON.stringify(denied), close: async () => { closes++; }}),
    }), /not safe for import/);
  }
  assert.equal(closes, 6);
  await assert.rejects(openPrivateBankProvider(config, {
    fetchImpl, openDatabase: async () => ({ query: async () => '{}', close: async () => { closes++; } }),
  }), /not safe for import/);
  assert.equal(closes, 7);
});

test("the SDK transport pins origin and headers for both opaque and legacy server keys", async () => {
  for (const [config, bearer] of [[hosted, "Bearer " + hosted.serviceRoleKey], [local("http://127.0.0.1:54321"), null]]) {
    const calls = [];
    const fetchImpl = async (input, init) => {
      calls.push(input);
      assert.equal(init.redirect, "error");
      assert.equal(init.headers.get("apikey"), config.serviceRoleKey);
      assert.equal(init.headers.get("authorization"), bearer);
      assert.ok(init.signal instanceof AbortSignal);
      return Response.json(health);
    };
    const provider = await openPrivateBankProvider(config, { fetchImpl });
    await provider.fetch(new Request(config.url + "/storage/v1/object/private.png", {
      headers: { authorization: "Bearer wrong-fixture", apikey: "wrong-fixture" },
    }), { redirect: "follow" });
    assert.throws(() => provider.fetch("https://wrong.invalid/object"), /approved origin/);
    assert.equal(calls.length, 2);
  }
});

test("redirects send neither private bank rows nor media to a second origin", async t => {
  const listen = async handler => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => new Promise(resolve => server.close(resolve)));
    return "http://127.0.0.1:" + server.address().port;
  };
  let otherCalls = 0;
  const other = await listen((request, response) => {
    request.resume();
    otherCalls++;
    response.end("null");
  });
  const attempted = [];
  const origin = await listen((request, response) => {
    request.resume();
    attempted.push(request.url);
    if (request.url.endsWith("/admin_operational_health")) return response.end(JSON.stringify(health));
    if (request.url.endsWith("/begin_question_bank_import")) return response.end('"10000000-0000-4000-8000-000000000001"');
    response.writeHead(307, { location: other + "/intercept" });
    response.end();
  });
  const config = local(origin);
  await assert.rejects(applyManifest(fixture, config), /import_question_bank_batch failed/);
  const provider = await openPrivateBankProvider(config);
  await assert.rejects(provider.fetch(origin + "/storage/v1/object/paper-media/fictional.png", {
    method: "POST", body: new Uint8Array([1, 2, 3]),
  }));
  assert.deepEqual(attempted, ["/rest/v1/rpc/admin_operational_health", "/rest/v1/rpc/begin_question_bank_import",
    "/rest/v1/rpc/import_question_bank_batch", "/rest/v1/rpc/admin_operational_health", "/storage/v1/object/paper-media/fictional.png"]);
  assert.equal(otherCalls, 0);
});
