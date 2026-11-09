import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { runOperationsMonitor } from "../scripts/operations-monitor.mjs";
import { runOperationsSweep } from "../scripts/operations-sweep.mjs";

const key = "sb_secret_original_fictional_service";
const alertToken = "original_fictional_receiver_token";
const base = { url: "https://fictional.supabase.co", allowOrigin: "https://fictional.supabase.co",
  environment: "staging", key, releaseSha: "a".repeat(40) };
const now = new Date("2026-11-09T01:25:00Z");
const aggregate = (overrides = {}) => ({
  scope: "paid-mvp-v1", monitorVersion: 1, apiProfileReady: true,
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
      assert.equal(options.headers.apikey, key);
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
  }, { now, fetchImpl: async () => Response.json(aggregate()) });
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
    url: "/rest/v1/rpc/admin_operational_health", apikey: key, auth: "Bearer " + key,
  })));
});

test("neither service nor receiver credentials can follow a real cross-origin redirect", async t => {
  let redirected = 0;
  const foreign = await listen(t, (_, response) => { redirected++; response.writeHead(200).end("{}"); });
  const redirector = await listen(t, (_, response) => response.writeHead(307, { Location: foreign + "/other" }).end());
  const config = { ...base, url: redirector, allowOrigin: redirector };
  await assert.rejects(runOperationsSweep(config), /Could not reach admin_operational_health/);
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
