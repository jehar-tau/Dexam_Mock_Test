import assert from "node:assert/strict";
import test from "node:test";
import {readdir} from "node:fs/promises";
import project from "../supabase/project.json" with {type: "json"};
import {probeStagingEdge} from "../scripts/staging-edge-readiness.mjs";

const url = `https://${project.project_ref}.supabase.co`;
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
  const result = await probeStagingEdge({url, fetchImpl: async (target, request) => {
    calls.push({target, ...request});
    return ready(request);
  }});
  assert.equal(result.passed, true);
  assert.deepEqual(result.results.map(({name}) => name), [
    "attempt-media", "drawing-media", "drawing-review-media", "community-media", "question-intake",
    "bank-review-media", "reported-question-media", "question-intake-extract", "ai-question-draft", "candidate-phone",
  ]);
  const directories = await readdir(new URL("../supabase/functions/", import.meta.url), {withFileTypes: true});
  const separateCommerceChecks = new Set(["create-order", "payment-webhook"]);
  const portalFunctions = directories.filter(entry => entry.isDirectory()
    && !entry.name.startsWith("_") && !separateCommerceChecks.has(entry.name)).map(entry => entry.name).sort();
  assert.deepEqual(result.results.map(({name}) => name).sort(), portalFunctions);
  assert.equal(calls.length, 2 * portalFunctions.length);
  assert.ok(calls.every(call => call.target.startsWith(url + "/functions/v1/") && call.method === "OPTIONS"
    && call.redirect === "error" && !call.body));
  for (const call of calls) {
    const headers = new Headers(call.headers);
    assert.equal(headers.has("apikey"), false);
    assert.equal(headers.has("authorization"), false);
    assert.equal(headers.get("Access-Control-Request-Headers"), "authorization,apikey,content-type,x-client-info");
  }
});

test("a broken route leaves the complete readiness report available", async () => {
  const report = await probeStagingEdge({url, fetchImpl: async (target, request) => {
    if (target.endsWith("/attempt-media")) return new Response(null, {status: 403});
    if (target.endsWith("/question-intake") || target.endsWith("/question-intake-extract")) return new Response("private gateway diagnostic", {status: 404});
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
    "endpoint-not-found", "invalid-staging-preflight", "ready", "endpoint-not-found", "ready", "ready",
  ]);
  assert.doesNotMatch(JSON.stringify(report), /private (gateway )?diagnostic/);
});

test("unexpected targets fail before any fetch", async () => {
  const fetchImpl = async () => assert.fail("Unexpected network request");
  await assert.rejects(probeStagingEdge({url: "https://dmocks.com", fetchImpl}), /approved DMocks staging/);
});

test("private portal scope reports provider-dependent failures while requiring all seven portal routes", async () => {
  const probe = async ({portalOnly, missingPortal = false}) => probeStagingEdge({url, portalOnly, fetchImpl: async (target, request) => {
    const name = target.split("/").at(-1);
    if (["question-intake-extract", "ai-question-draft", "candidate-phone"].includes(name)
      || (missingPortal && name === "question-intake")) return new Response(null, {status: 404});
    return ready(request);
  }});
  const full = await probe({portalOnly: false});
  assert.equal(full.passed, false);
  assert.equal(full.results.filter(row => row.required).length, 10);
  const portal = await probe({portalOnly: true});
  assert.equal(portal.passed, true);
  assert.equal(portal.results.filter(row => row.required).length, 7);
  assert.deepEqual(portal.results.filter(row => !row.required).map(row => row.result), Array(3).fill("endpoint-not-found"));
  assert.equal((await probe({portalOnly: true, missingPortal: true})).passed, false);
});
