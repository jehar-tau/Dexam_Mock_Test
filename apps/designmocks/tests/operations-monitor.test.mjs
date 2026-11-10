import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { runOperationsMonitor } from "../scripts/operations-monitor.mjs";
import { runOperationsSweep } from "../scripts/operations-sweep.mjs";

const key = "sb_secret_original_fictional_service";
const alertToken = "original_fictional_receiver_token";
const origin = `https://${"a".repeat(20)}.supabase.co`;
const base = { url: origin, allowOrigin: origin,
  environment: "staging", key, releaseSha: "a".repeat(40) };
const now = new Date("2026-11-09T01:25:00Z");
const verificationId = "00000000-0000-4000-8000-000000001131";
const receiverSettings = { alertUrl: "https://receiver.example.test/alerts", alertAllowOrigin: "https://receiver.example.test", alertToken };
const aggregate = (overrides = {}) => ({
  scope: "paid-mvp-v1", monitorVersion: 1, apiProfileReady: true, paymentMode: "test",
  checkedAt: "2026-11-09T01:25:00.123456Z", status: "healthy",
  staleAttempts: 0, expiredAttempts: 0, stalePendingOrders: 0, paymentReviews: 0,
  openBugs: 0, pendingQuestionReports: 0, unverifiedPasses: 0, ...overrides,
});

async function listen(t, handler) {
  const server = createServer(handler).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return "http://127.0.0.1:" + server.address().port;
}

test("monitor reads only the exact verified aggregate and keeps healthy and attention checks quiet", async () => {
  for (const status of ["healthy", "attention"]) {
    const calls = [];
    const value = aggregate({ status, openBugs: status === "attention" ? 1 : 0, privatePayload: "must stay private" });
    const report = await runOperationsMonitor({
      ...base, alertUrl: "https://receiver.example.test/alerts", alertAllowOrigin: "https://receiver.example.test", alertToken,
    }, { now, fetchImpl: async (url, options) => {
      calls.push(url);
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.get("apikey"), key);
      assert.equal(options.headers.has("authorization"), false);
      return Response.json(value);
    } });
    assert.deepEqual(calls, [base.url + "/rest/v1/rpc/admin_operational_health"]);
    assert.equal(report.status, status);
    assert.deepEqual(report.findings, []);
    assert.equal(report.delivery, "not_needed");
    assert.equal(report.queues.openBugs, value.openBugs);
    assert.doesNotMatch(JSON.stringify(report), /must stay private|original_fictional/);
  }
});

test("unavailable or malformed health yields a fixed critical finding without provider details", async () => {
  const responses = [
    Response.json({ message: "private credential or database details" }, { status: 503 }),
    new Response("private malformed payload"),
    Response.json(aggregate({ monitorVersion: undefined })),
    Response.json(aggregate({ apiProfileReady: "true" })),
    Response.json(aggregate({ paymentMode: undefined })),
    Response.json(aggregate({ unverifiedPasses: -1 })),
  ];
  for (const response of responses) {
    const result = await runOperationsMonitor(base, { now, fetchImpl: async () => response });
    assert.deepEqual(result.findings, [{ code: "health_unavailable", severity: "P1" }]);
    assert.equal(result.status, "unavailable");
    assert.equal(result.queues, null);
    assert.equal(result.delivery, "unconfigured");
    assert.doesNotMatch(JSON.stringify(result), /private|credential/);
  }
});

test("production requires the exact read-only acknowledgement and alert delivery uses a separate approved origin", async () => {
  const alert = { alertUrl: "https://receiver.example.test/alerts", alertAllowOrigin: "https://receiver.example.test", alertToken };
  const fetchImpl = async () => { throw new Error("Invalid configuration reached a network request"); };
  for (const patch of [
    { environment: "production", productionAck: "FINALIZE_EXPIRED_ATTEMPTS_ON_" + base.url },
    { releaseSha: "short" }, { ...alert, alertAllowOrigin: "https://other.example.test" },
    { ...alert, alertToken: key }, { ...alert, alertUrl: alert.alertUrl + "?secret=example" },
    { ...alert, alertUrl: base.url + "/rest", alertAllowOrigin: base.url },
    { ...alert, alertUrl: "http://receiver.example.test/alerts", alertAllowOrigin: "http://receiver.example.test" },
    { alertUrl: alert.alertUrl },
  ]) await assert.rejects(runOperationsMonitor({ ...base, ...patch }, { fetchImpl }));

  const report = await runOperationsMonitor({
    ...base, environment: "production", productionAck: "CHECK_PAID_MVP_HEALTH_ON_" + base.url,
  }, { now, fetchImpl: async () => Response.json(aggregate({ paymentMode: "live" })) });
  assert.equal(report.environment, "production");
  assert.equal(report.status, "healthy");
});

test("the loopback receiver gets an authenticated aggregate alert and stable incident key without the service key", async t => {
  const requests = [], alerts = [];
  const database = await listen(t, (request, response) => {
    requests.push({ url: request.url, apikey: request.headers.apikey, auth: request.headers.authorization });
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(aggregate({
      status: "degraded", apiProfileReady: false, unverifiedPasses: 1, paymentReviews: 2, stalePendingOrders: 3,
      privateData: "fictional account id",
    })));
  });
  const receiver = await listen(t, async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    alerts.push({ body: JSON.parse(body), headers: request.headers });
    response.writeHead(202).end("fictional private receipt");
  });
  const config = { ...base, url: database, allowOrigin: database, alertUrl: receiver + "/alerts", alertAllowOrigin: receiver, alertToken };
  const first = await runOperationsMonitor(config, { now });
  const second = await runOperationsMonitor(config, { now: new Date(now.getTime() + 60_000) });
  assert.equal(first.delivery, "accepted");
  assert.equal(second.delivery, "accepted");
  assert.equal(alerts.length, 2);
  assert.equal(alerts[0].headers["idempotency-key"], alerts[1].headers["idempotency-key"]);
  assert.match(alerts[0].headers["idempotency-key"], /^[0-9a-f]{64}$/);
  assert.equal(alerts[0].headers.authorization, "Bearer " + alertToken);
  assert.equal(alerts[0].headers.apikey, undefined);
  assert.deepEqual(alerts[0].body.findings, [
    { code: "api_permissions_invalid", severity: "P1" },
    { code: "unverified_active_passes", severity: "P1", count: 1 },
    { code: "payments_need_review", severity: "P2", count: 2 },
    { code: "stale_orders", severity: "P2", count: 3 },
  ]);
  assert.doesNotMatch(JSON.stringify(alerts[0].body), /fictional account|private receipt|fictional_service|receiver_token/);
  assert.deepEqual(requests, Array.from({ length: 2 }, () => ({
    url: "/rest/v1/rpc/admin_operational_health", apikey: key, auth: undefined,
  })));
});

test("neither service nor receiver credentials can follow a real cross-origin redirect", async t => {
  let redirected = 0;
  const foreign = await listen(t, (_, response) => { redirected++; response.writeHead(200).end("{}"); });
  const redirector = await listen(t, (_, response) => response.writeHead(307, { Location: foreign + "/other" }).end());
  const config = { ...base, url: redirector, allowOrigin: redirector };
  await assert.rejects(runOperationsSweep(config), /admin_operational_health failed/);
  assert.equal((await runOperationsMonitor(config, { now })).status, "unavailable");
  const database = await listen(t, (_, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(aggregate({ unverifiedPasses: 1 })));
  });
  const report = await runOperationsMonitor({
    ...base, url: database, allowOrigin: database,
    alertUrl: redirector + "/alerts", alertAllowOrigin: redirector, alertToken,
  }, { now });
  assert.equal(report.delivery, "failed");
  assert.equal(redirected, 0);
});

test("Live health cannot disclose its queues to a staging monitor or complete a delivery check", async () => {
  const delivered = [];
  const fetchImpl = async (url, options) => {
    if (url.startsWith(base.url)) return Response.json(aggregate({ paymentMode: "live", paymentReviews: 91 }));
    delivered.push(JSON.parse(options.body));
    return new Response(null, { status: 202 });
  };
  const config = { ...base, ...receiverSettings };
  const verification = await runOperationsMonitor(config, { now, fetchImpl, verificationId });
  assert.equal(verification.delivery, "blocked");
  assert.equal(delivered.length, 0);
  const incident = await runOperationsMonitor(config, { now, fetchImpl });
  assert.deepEqual(incident.findings, [{ code: "payment_mode_mismatch", severity: "P1" }]);
  assert.equal(incident.paymentMode, "live");
  assert.equal(incident.expectedPaymentMode, "test");
  assert.equal(incident.queues, null);
  const { delivery, ...payload } = incident;
  assert.equal(delivery, "accepted");
  assert.deepEqual(delivered, [payload]);
});

test("a production target in Test mode requires an explicit Test expectation", async () => {
  const config = { ...base, environment: "production", productionAck: "CHECK_PAID_MVP_HEALTH_ON_" + base.url };
  const options = { now, fetchImpl: async () => Response.json(aggregate()) };
  const liveExpected = await runOperationsMonitor(config, options);
  const testExpected = await runOperationsMonitor({ ...config, expectedPaymentMode: "test" }, options);
  assert.equal(liveExpected.findings[0].code, "payment_mode_mismatch");
  assert.equal(testExpected.status, "healthy");
  assert.equal(testExpected.paymentMode, "test");
  assert.equal(testExpected.delivery, "not_needed");
});

test("verification messages are separate from findings, stable on retry and fail on receiver rejection", async () => {
  const delivered = [];
  let status = 202;
  const fetchImpl = async (url, options) => {
    if (url.startsWith(base.url)) return Response.json(aggregate({ privateData: "not for receiver" }));
    delivered.push({ headers: options.headers, body: JSON.parse(options.body) });
    return new Response(null, { status });
  };
  const config = { ...base, ...receiverSettings };
  for (const time of [now, new Date(now.getTime() + 16 * 60_000)]) {
    const result = await runOperationsMonitor(config, { now: time, fetchImpl, verificationId });
    assert.equal(result.delivery, "accepted");
    assert.equal(result.verificationId, verificationId);
    assert.deepEqual(result.findings, []);
  }
  assert.equal(delivered[0].headers["idempotency-key"], delivered[1].headers["idempotency-key"]);
  assert.deepEqual(delivered[0].body, { schema: "dmocks-operations-alert-verification-v1", environment: "staging",
    paymentMode: "test", releaseSha: base.releaseSha, checkedAt: now.toISOString(), verificationId });
  assert.equal(delivered[0].headers.authorization, "Bearer " + alertToken);
  assert.equal(delivered[0].headers.apikey, undefined);
  status = 503;
  assert.equal((await runOperationsMonitor(config, { now, fetchImpl, verificationId })).delivery, "failed");
  const blocked = await runOperationsMonitor(config, {
    now, verificationId, fetchImpl: async url => {
      assert.ok(url.startsWith(base.url));
      return Response.json(aggregate({ paymentReviews: 1 }));
    },
  });
  assert.equal(blocked.delivery, "blocked");
  assert.equal(delivered.length, 3);
  await assert.rejects(runOperationsMonitor(config, { now, fetchImpl, verificationId: "malformed" }), /UUID/);
  await assert.rejects(runOperationsMonitor(base, { now, fetchImpl, verificationId }), /approved alert receiver/);
});

test("the delivery command runs through a symlink and reports receiver acceptance", async t => {
  const delivered = [];
  const database = await listen(t, (_, response) => response.end(JSON.stringify(aggregate())));
  const receiver = await listen(t, (request, response) => {
    delivered.push(request.headers.authorization);
    request.resume();
    response.writeHead(202).end();
  });
  const directory = await mkdtemp(join(tmpdir(), "dmocks-operations-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const command = join(directory, "monitor.mjs");
  await symlink(fileURLToPath(new URL("../scripts/operations-monitor.mjs", import.meta.url)), command);
  const { stdout } = await promisify(execFile)(process.execPath, [command, "--verify-delivery", verificationId], {
    env: {
      ...process.env,
      DMOCKS_SUPABASE_URL: database, DMOCKS_OPERATIONS_ALLOW_ORIGIN: database, DMOCKS_SUPABASE_SERVICE_ROLE_KEY: key,
      DMOCKS_OPERATIONS_ENVIRONMENT: "staging", DMOCKS_OPERATIONS_EXPECT_PAYMENT_MODE: "test",
      DMOCKS_OPERATIONS_RELEASE_SHA: base.releaseSha, DMOCKS_OPERATIONS_ALERT_URL: receiver + "/alerts",
      DMOCKS_OPERATIONS_ALERT_ALLOW_ORIGIN: receiver, DMOCKS_OPERATIONS_ALERT_TOKEN: alertToken,
    },
    timeout: 10000,
  });
  assert.equal(JSON.parse(stdout).delivery, "accepted");
  assert.deepEqual(delivered, ["Bearer " + alertToken]);
});
