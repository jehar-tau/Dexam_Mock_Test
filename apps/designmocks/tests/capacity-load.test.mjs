import assert from "node:assert/strict";
import test from "node:test";
import { runCapacityTest, validateCapacityPlan } from "../scripts/capacity-load.mjs";

const plan = (overrides = {}) => ({
  version: 1,
  target: "http://127.0.0.1:4191",
  sessions: 6,
  activeAttempts: 3,
  iterations: 2,
  thresholds: { maxErrorRate: 0, publicP95Ms: 2500, authenticatedP95Ms: 500 },
  scenarios: {
    browser: [{ name: "home", method: "GET", path: "/" }],
    activeAttempt: [{ name: "autosave", method: "POST", path: "/attempt/{attemptId}", headers: { authorization: "Bearer {accessToken}" }, body: { revision: "{revision}" } }],
  },
  ...overrides,
});

test("capacity plans reject production, credentials and invalid session mixes", () => {
  assert.throws(() => validateCapacityPlan(plan({ target: "https://dmocks.com" })), /Production/);
  assert.throws(() => validateCapacityPlan(plan({ target: "https://user:secret@staging.example" })), /credential-free/);
  assert.throws(() => validateCapacityPlan(plan({ activeAttempts: 7 })), /activeAttempts/);
});

test("capacity runner separates active attempts, interpolates fixtures and applies thresholds", async () => {
  const calls = [];
  const fixtures = Array.from({ length: 3 }, (_, index) => ({ attemptId: `attempt-${index}`, accessToken: `secret-${index}` }));
  const result = await runCapacityTest(plan(), { fixtures, fetchImpl: async (url, init) => {
    calls.push({ url: String(url), method: init.method, authorization: init.headers.authorization, body: init.body });
    return new Response(null, { status: 204 });
  } });
  assert.equal(result.summary.requests, 12);
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.passed, true);
  assert.equal(calls.filter(call => call.method === "POST").length, 6);
  assert.match(calls.find(call => call.method === "POST").url, /attempt\/attempt-0/);
  assert.equal(calls.find(call => call.method === "POST").authorization, "Bearer secret-0");
  assert.match(calls.find(call => call.method === "POST").body, /revision/);
  assert.doesNotMatch(JSON.stringify(result), /secret-0|attempt-0/);
});

test("remote execution requires an exact staging-origin acknowledgement and enough synthetic fixtures", async () => {
  const remote = plan({ target: "https://staging.example" });
  await assert.rejects(() => runCapacityTest(remote, { fixtures: Array(3), env: {}, fetchImpl: async () => new Response() }), /CAPACITY_ALLOW_STAGING_LOAD/);
  await assert.rejects(() => runCapacityTest(plan(), { fixtures: [] }), /synthetic active-attempt fixtures/);
});

test("capacity runner fails the gate when responses error", async () => {
  const result = await runCapacityTest(plan(), { fixtures: Array.from({ length: 3 }, (_, i) => ({ attemptId: i, accessToken: "fixture" })), fetchImpl: async () => new Response(null, { status: 503 }) });
  assert.equal(result.summary.passed, false);
  assert.equal(result.summary.errorRate, 1);
  assert.equal(result.failures.length, 12);
});
