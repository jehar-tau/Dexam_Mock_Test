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
  assert.deepEqual(result.requests.map(({kind, name, count, errors}) => ({kind, name, count, errors})), [
    {kind: "browser", name: "home", count: 6, errors: 0},
    {kind: "activeAttempt", name: "autosave", count: 6, errors: 0},
  ]);
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

test("response checks distinguish accepted autosaves from successful HTTP responses with stale revisions", async () => {
  const source = plan({sessions: 1, activeAttempts: 1});
  source.scenarios.activeAttempt[0].check = "accepted-revision";
  const options = {
    fixtures: [{attemptId: "attempt-a", accessToken: "private-token"}],
    fetchImpl: async (_url, init) => {
      assert.equal(init.redirect, "error");
      const {revision} = JSON.parse(init.body);
      return Response.json({accepted: revision === 1, revision: 1, privateAnswer: "private-payload"});
    },
  };
  const result = await runCapacityTest(source, options);
  assert.equal(result.summary.requests, 2);
  assert.equal(result.summary.errors, 1);
  assert.equal(result.summary.passed, false);
  assert.deepEqual(result.failures, [{kind: "activeAttempt", name: "autosave", status: 200, error: "ResponseCheckFailed"}]);
  assert.doesNotMatch(JSON.stringify(result), /private-token|private-payload|attempt-a/);
});

test("checked reads reject another attempt, an exposed key, and a malformed JSON body", async () => {
  const source = plan({sessions: 1, activeAttempts: 1, iterations: 4});
  source.scenarios.activeAttempt[0].check = "active-attempt";
  const attempt = {id: "attempt-a", status: "active", questions: [{}]};
  const responses = [
    Response.json(attempt),
    Response.json({...attempt, id: "foreign"}),
    Response.json({...attempt, questions: [{correctKey: "secret"}]}),
    new Response("<html>Unexpected redirect target</html>"),
  ];
  const result = await runCapacityTest(source, {
    fixtures: [{attemptId: attempt.id, accessToken: "private-token"}],
    fetchImpl: async () => responses.shift(),
  });
  assert.equal(result.summary.errors, 3);
  assert.equal(result.summary.passed, false);
});

test("a response that fails while streaming counts once, and an origin escape fails before any request", async () => {
  const result = await runCapacityTest(plan({sessions: 1, activeAttempts: 0, iterations: 1}), {
    fetchImpl: async () => new Response(new ReadableStream({
      start(controller) { controller.error(new Error("private body error")); },
    })),
  });
  assert.equal(result.summary.requests, 1);
  assert.equal(result.summary.errors, 1);
  assert.doesNotMatch(JSON.stringify(result), /private body error/);

  const source = plan();
  source.scenarios.activeAttempt[0].path = "/{attemptId}";
  const fixtures = [{attemptId: "/outside.example", accessToken: "private-token"}];
  await assert.rejects(runCapacityTest({...source, activeAttempts: 1}, {
    fixtures,
    fetchImpl: async () => assert.fail("A bad fixture must fail before any request"),
  }), /escaped the target origin/);
});
