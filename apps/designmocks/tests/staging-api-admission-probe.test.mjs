import assert from "node:assert/strict";
import test from "node:test";
import project from "../supabase/project.json" with {type: "json"};
import {checkStagingApiAdmission} from "../scripts/check-staging-api-admission.mjs";

const origin = `https://${project.project_ref}.supabase.co`;
const ids = ["00000000-0000-4000-8000-000000000010", "00000000-0000-4000-8000-000000000011"];
const tokens = ids.map(sub => "header." + Buffer.from(JSON.stringify({sub, role: "authenticated"})).toString("base64url") + ".sig");
const response = (status, data) => Response.json(data, {status});
const denial = {code: "42501", message: "Private staging requires an approved Google tester"};
const googleIdentity = actor => ({id: ids[actor], email: "fictional@example.invalid", is_anonymous: false,
  app_metadata: {provider: "google"}, email_confirmed_at: "2026-01-01T00:00:00Z"});
function fixture(override = () => null) {
  return {
    origin, key: "sb_publishable_fictional", admitted: tokens[0], excluded: tokens[1],
    fetchImpl: async (url, options) => {
      assert.equal(options.redirect, "error");
      const path = url.slice(origin.length);
      const actor = tokens.indexOf(options.headers.Authorization?.slice(7));
      const forced = override(path, actor);
      if (forced) return forced;
      if (path === "/auth/v1/user") {
        assert.equal(options.method, "GET");
        return response(200, googleIdentity(actor));
      }
      assert.equal(options.method, "POST");
      assert.equal(options.body, "{}");
      if (actor === -1) return response(401, {code: "42501"});
      if (actor === 1) return response(403, denial);
      if (path.endsWith("/my_attempt_history")) return response(200, [{title: "Private fictional attempt title"}]);
      return response(200, path.endsWith("/can_enter_staging_portal"));
    },
  };
}

test("verifies valid distinct sessions, the staging hook, admitted RPC access and anonymous denial", async () => {
  const report = await checkStagingApiAdmission(fixture());
  assert.equal(report.passed, true);
  assert.deepEqual(report.checks.map(({status}) => status), [200, 200, 200, 403, 403, 401]);
  for (const secret of [...tokens, ...ids, "fictional@example.invalid", "Private fictional attempt title"]) {
    assert.ok(!JSON.stringify(report).includes(secret));
  }
});

test("a missing grant, bypass, or failed admitted control does not establish the staging hook", async () => {
  for (const failure of [
    fixture((path, actor) => actor === 1 && path.endsWith("my_attempt_history") && response(200, [])),
    fixture((path, actor) => actor === 1 && path.endsWith("is_dmocks_admin") && response(403, {code: "42501", message: "permission denied"})),
    fixture((path, actor) => actor === 0 && path.endsWith("is_dmocks_admin") && response(403, denial)),
    fixture((path, actor) => actor === 0 && path.endsWith("my_attempt_history") && response(403, denial)),
    fixture((path, actor) => actor === 0 && path.endsWith("my_attempt_history") && response(200, {invalid: true})),
    fixture((path, actor) => actor === 0 && path.endsWith("can_enter_staging_portal") && response(200, false)),
    fixture((path, actor) => actor === -1 && path.endsWith("can_enter_staging_portal") && response(404, {code: "PGRST202"})),
  ]) {
    assert.equal((await checkStagingApiAdmission(failure)).passed, false);
  }
});

test("rejects invalid sessions, duplicate users and credentials for another origin", async () => {
  await assert.rejects(checkStagingApiAdmission(fixture((path, actor) => actor === 1 && path === "/auth/v1/user" && response(401, {}))), /must be valid/);
  await assert.rejects(checkStagingApiAdmission({...fixture(), excluded: tokens[0]}), /different fictional/);
  await assert.rejects(checkStagingApiAdmission({...fixture(), origin: "https://example.invalid"}), /designated DMocks/);
  await assert.rejects(checkStagingApiAdmission({...fixture(), key: "sb_secret_fictional"}), /public DMocks/);
});


test("valid access tokens without confirmed Google identities cannot establish acceptance", async () => {
  for (const change of [{app_metadata: {provider: "email"}}, {email_confirmed_at: null}, {is_anonymous: true}]) {
    let rpcRequests = 0;
    await assert.rejects(checkStagingApiAdmission(fixture((path, actor) => {
      if (path.startsWith("/rest/")) rpcRequests++;
      if (actor === 1 && path === "/auth/v1/user") return response(200, {...googleIdentity(actor), ...change});
    })), /confirmed Google identities/);
    assert.equal(rpcRequests, 0);
  }
});

function portalFixture(override = () => null, admin = false) {
  const frontend = project.staging_frontend_origin;
  const expected = {
    "attempt-media": "Invalid attempt",
    "drawing-media": "Invalid drawing action",
    "drawing-review-media": "Invalid review",
    "community-media": "Invalid community target",
    "question-intake": admin ? "Intake asset id required" : "Admin access required",
    "bank-review-media": "A bank question and review version are required",
    "reported-question-media": "A reported question and current revision are required",
  };
  const rpcFixture = fixture((path, actor) => actor === 0 && path.endsWith("is_dmocks_admin") && response(200, admin));
  return {
    ...rpcFixture, portalEdge: true,
    fetchImpl: async (url, options) => {
      const path = url.slice(origin.length);
      if (!path.startsWith("/functions/v1/")) return rpcFixture.fetchImpl(url, options);
      const name = path.split("/").at(-1);
      const actor = tokens.indexOf(options.headers.Authorization?.slice(7));
      assert.ok(Object.hasOwn(expected, name) && actor !== -1);
      assert.equal(options.headers.Origin, frontend);
      assert.equal(options.headers["Content-Type"], "application/json");
      assert.equal(options.body, "{}");
      assert.equal(options.method, "POST");
      assert.equal(options.redirect, "error");
      const status = actor === 1 || name === "question-intake" && !admin ? 403 : 400;
      const body = {error: actor === 1 ? denial.message : expected[name]};
      const headers = {"access-control-allow-origin": frontend};
      return override(name, actor, body, headers) ?? Response.json(body, {status, headers});
    },
  };
}

test("checks admitted and excluded Google sessions at all seven portal Edge handlers without data or files", async () => {
  for (const admin of [false, true]) {
    const report = await checkStagingApiAdmission(portalFixture(undefined, admin));
    assert.equal(report.scope, "staging-postgrest-and-portal-edge-admission");
    assert.equal(report.passed, true);
    assert.equal(report.checks.length, 20);
    assert.equal(report.checks.find(row => row.check === "question-intake-admitted").status, admin ? 400 : 403);
    assert.equal(report.checks.filter(row => row.check.endsWith("-excluded") && row.status === 403).length, 7);
    for (const secret of [...tokens, ...ids, denial.message, "fictional@example.invalid"]) {
      assert.ok(!JSON.stringify(report).includes(secret));
    }
  }
});

test("rejects wrong-origin responses, missing deployments and Edge admission bypass or leaks", async () => {
  const report = await checkStagingApiAdmission(portalFixture((name, actor, body, headers) => {
    if (name === "attempt-media" && actor === 0) return Response.json(body, {status: 400, headers: {"access-control-allow-origin": "*"}});
    if (name === "drawing-media" && actor === 1) return Response.json({error: "Origin not allowed"}, {status: 403, headers});
    if (name === "community-media" && actor === 0) return response(404, {});
    if (name === "bank-review-media" && actor === 1) return Response.json({error: "Invalid input"}, {status: 400, headers});
    if (name === "reported-question-media" && actor === 1) return Response.json({...body, images: ["private-link"]}, {status: 403, headers});
  }));
  assert.equal(report.passed, false);
  assert.deepEqual(report.checks.filter(check => !check.passed).map(check => check.check), [
    "attempt-media-admitted", "drawing-media-excluded", "community-media-admitted", "bank-review-media-excluded", "reported-question-media-excluded",
  ]);
  assert.ok(!JSON.stringify(report).includes("private-link"));
});
