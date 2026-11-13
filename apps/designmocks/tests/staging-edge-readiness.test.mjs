import assert from "node:assert/strict";
import test from "node:test";
import project from "../supabase/project.json" with {type: "json"};
import {probeStagingEdge} from "../scripts/staging-edge-readiness.mjs";

const url = `https://${project.project_ref}.supabase.co`;
const key = "sb_publishable_fixture_only";
const origin = project.staging_frontend_origin;
function ready(request) {
  const approved = request.headers.Origin === origin;
  return new Response(null, {
    status: approved ? 204 : 403,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, apikey, Content-Type, x-client-info",
    },
  });
}

test("staging CORS checks every private route using OPTIONS and denies the foreign origin", async () => {
  const calls = [];
  const result = await probeStagingEdge({url, key, fetchImpl: async (target, request) => {
    calls.push({target, ...request});
    return ready(request);
  }});
  assert.equal(result.passed, true);
  assert.equal(result.results.length, 7);
  assert.equal(calls.length, 14);
  assert.ok(calls.every(call => call.target.startsWith(url + "/functions/v1/") && call.method === "OPTIONS"
    && call.redirect === "error" && !call.body && !call.headers.Authorization));
  assert.doesNotMatch(JSON.stringify(result), /fixture_only/);
});

test("a broken route leaves the complete readiness report available", async () => {
  const report = await probeStagingEdge({url, key, fetchImpl: async (target, request) => {
    if (target.endsWith("/attempt-media")) return new Response(null, {status: 403});
    if (target.endsWith("/question-intake")) return new Response("private gateway diagnostic", {status: 404});
    if (target.endsWith("/drawing-media")) throw new Error("private diagnostic");
    if (target.endsWith("/bank-review-media")) return new Response(null, {status: 204, headers: {"Access-Control-Allow-Origin": origin}});
    if (target.endsWith("/community-media") && request.headers.Origin !== origin) {
      return new Response(null, {status: 403, headers: {"Access-Control-Allow-Origin": "*"}});
    }
    return ready(request);
  }});
  assert.equal(report.passed, false);
  assert.deepEqual(report.results.map(row => row.result), [
    "staging-origin-rejected", "request-failed", "ready", "foreign-origin-not-denied",
    "endpoint-not-found", "invalid-staging-preflight", "ready",
  ]);
  assert.doesNotMatch(JSON.stringify(report), /private (gateway )?diagnostic/);
});

test("unexpected targets and non-public credentials fail before any fetch", async () => {
  const fetchImpl = async () => assert.fail("Unexpected network request");
  await assert.rejects(probeStagingEdge({url: "https://dmocks.com", key, fetchImpl}), /approved DMocks staging/);
  await assert.rejects(probeStagingEdge({url, key: "sb_secret_fixture", fetchImpl}), /public DMocks staging/);
});
