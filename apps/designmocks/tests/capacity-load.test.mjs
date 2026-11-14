import assert from "node:assert/strict";
import test from "node:test";
import project from "../supabase/project.json" with {type: "json"};
import example from "../config/capacity-plan.example.json" with {type: "json"};
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
  const origin = "https://" + project.project_ref + ".supabase.co";
  const remote = plan({ target: origin });
  await assert.rejects(() => runCapacityTest(remote, { fixtures: Array(3), env: {}, fetchImpl: async () => new Response() }), /CAPACITY_ALLOW_STAGING_LOAD/);
  for (const target of ["http://" + new URL(origin).hostname, "https://other-project.supabase.co"]) {
    await assert.rejects(runCapacityTest(plan({target, activeAttempts: 0}), {
      env: {CAPACITY_ALLOW_STAGING_LOAD: target},
      fetchImpl: async () => assert.fail("An unrelated or insecure host cannot receive requests"),
    }), /designated DMocks staging API/);
  }
  const allowed = await runCapacityTest(plan({target: origin, activeAttempts: 0}), {
    env: {CAPACITY_ALLOW_STAGING_LOAD: origin},
    fetchImpl: async url => { assert.equal(url.origin, origin); return new Response(null, {status: 200}); },
  });
  assert.equal(allowed.summary.passed, true);
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
  const attempt = {id: "attempt-a", status: "active", deadline: "2026-11-14T12:00:00Z", questions: [{}]};
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

test("capacity acceptance verifies each saved answer through an independent active-attempt read", async () => {
  const source = plan({sessions: 1, activeAttempts: 1, iterations: 5});
  source.scenarios.activeAttempt[0].check = "persisted-revision";
  const fixture = {attemptId: "attempt-a", questionId: "question-a", answer: ["B", "D"], accessToken: "private-token"};
  let revision = 0;
  const result = await runCapacityTest(source, {
    fixtures: [fixture],
    fetchImpl: async () => {
      revision++;
      const question = {id: fixture.questionId, answerRevision: revision, answer: fixture.answer};
      if (revision === 2) question.answer = ["B"];
      if (revision === 3) question.answerRevision--;
      if (revision === 4) question.explanation = "Private explanation";
      if (revision === 5) question.id = "foreign-question";
      return Response.json({id: fixture.attemptId, status: "active", deadline: "2026-11-14T12:00:00Z", questions: [question]});
    },
  });
  assert.equal(result.summary.requests, 5);
  assert.equal(result.summary.errors, 4);
  assert.equal(result.summary.passed, false);
  assert.doesNotMatch(JSON.stringify(result), /private-token|Private explanation|question-a|foreign-question/);
});

test("the persistence plan rejects reused synthetic attempts or accounts before dispatch", async () => {
  const source = plan({sessions: 2, activeAttempts: 2});
  source.scenarios.activeAttempt[0].check = "persisted-revision";
  for (const fixtures of [
    [{attemptId: "a", accessToken: "x"}, {attemptId: "a", accessToken: "y"}],
    [{attemptId: "a", accessToken: "x"}, {attemptId: "b", accessToken: "x"}],
  ]) {
    await assert.rejects(runCapacityTest(source, {
      fixtures: fixtures.map(fixture => ({ ...fixture, questionId: "q", answer: "A" })),
      fetchImpl: async () => assert.fail("Repeated fixture must fail before dispatch"),
    }), /require distinct synthetic attempts and access tokens/);
  }
});

test("the persistence plan requires an explicit question and answer", async () => {
  const source = plan({sessions: 1, activeAttempts: 1});
  source.scenarios.activeAttempt[0].check = "persisted-revision";
  await assert.rejects(runCapacityTest(source, {
    fixtures: [{attemptId: "a", accessToken: "x", questionId: "q"}],
    fetchImpl: async () => assert.fail("Incomplete fixture must fail before dispatch"),
  }), /require a synthetic question ID and answer/);
});


test("a changed or missing attempt deadline fails the readback without appearing in the report", async () => {
  const source = plan({sessions: 1, activeAttempts: 1, iterations: 3});
  source.thresholds.maxErrorRate = 1;
  source.scenarios.activeAttempt[0].check = "persisted-revision";
  const fixture = {attemptId: "attempt-a", questionId: "question-a", answer: "A", accessToken: "private-token"};
  const deadlines = ["2026-11-14T12:00:00Z", "2026-11-14T12:01:00Z", null];
  let revision = 0;
  const {summary, failures} = await runCapacityTest(source, {fixtures: [fixture], fetchImpl: async () =>
    Response.json({id: fixture.attemptId, status: "active", deadline: deadlines[revision],
      questions: [{id: fixture.questionId, answer: fixture.answer, answerRevision: ++revision}]}),
  });
  assert.equal(summary.errors, 2);
  assert.equal(summary.responseCheckFailures, 2);
  assert.equal(summary.passed, false);
  assert.doesNotMatch(JSON.stringify(failures), /2026-11-14|attempt-a/);
});

test("transient provider failures remain subject to the configured error budget", async () => {
  const source = plan({sessions: 1, activeAttempts: 0, iterations: 2});
  source.thresholds.maxErrorRate = 0.5;
  const statuses = [503, 200];
  const {summary} = await runCapacityTest(source, {
    fetchImpl: async () => new Response(null, {status: statuses.shift()}),
  });
  assert.equal(summary.errorRate, 0.5);
  assert.equal(summary.responseCheckFailures, 0);
  assert.equal(summary.passed, true);
});

test("the example capacity plan rejects invalid public catalogue responses even under the error budget", async () => {
  const source = {...example, target: "http://127.0.0.1:4191", sessions: 1, activeAttempts: 0, iterations: 6,
    thresholds: {...example.thresholds, maxErrorRate: 1}};
  const annual = {id: "annual", amount: 119300, currency: "INR", duration_months: 12};
  const responses = [
    Response.json([annual]),
    Response.json([]),
    Response.json([{...annual, currency: "USD"}]),
    Response.json([{...annual, amount: 1193}]),
    Response.json([annual, annual]),
    new Response("<html>Unexpected page</html>"),
  ];
  const {summary, failures} = await runCapacityTest(source, {
    env: {CAPACITY_ANON_KEY: "fixture-key"},
    fetchImpl: async () => responses.shift(),
  });
  assert.equal(summary.requests, 6);
  assert.equal(summary.responseCheckFailures, 5);
  assert.equal(summary.passed, false);
  assert.ok(failures.every(failure => failure.name === "public-plans" && failure.error === "ResponseCheckFailed"));
});
