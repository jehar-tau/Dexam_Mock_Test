import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
import {openPrivateDMocksTransport} from "./private-bank-provider.mjs";
import project from "../supabase/project.json" with {type: "json"};

const buckets = ["paper-media", "drawing-submissions", "community-media", "question-intake"];
const denied = new Set([400, 401, 403, 404]);
const fixturePattern = /^dmocks-storage-probe\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;
function jwtRole(value) {
  try { return JSON.parse(Buffer.from(value.split(".")[1], "base64url")).role; }
  catch { return null; }
}

export async function checkPrivateStorage({origin, key, serviceKey, token, fixture, fetchImpl = fetch}) {
  const url = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.protocol === "http:";
  assert.ok(origin === url.origin && (local || origin === `https://${project.project_ref}.supabase.co`), "Use local or designated DMocks staging Storage");
  assert.match(fixture ?? "", fixturePattern, "Use an exact fictional Storage fixture path");
  assert.ok(jwtRole(key) === "anon" || /^sb_publishable_[\w-]+$/.test(key ?? ""), "Use a public API key");
  assert.ok(jwtRole(token) === "authenticated", "Use a synthetic signed-in account token");

  const service = openPrivateDMocksTransport({
    url: origin, allowOrigin: origin, serviceRoleKey: serviceKey,
    environment: local ? "development" : "staging",
  }, {fetchImpl, timeoutMs: 10000});

  async function head(path, authorization, request = fetchImpl) {
    try {
      const response = await request(origin + "/storage/v1/object/" + path, {
        method: "HEAD", redirect: "error", signal: AbortSignal.timeout(10000),
        headers: {apikey: key, ...(authorization ? {Authorization: "Bearer " + authorization} : {})},
      });
      await response.body?.cancel();
      return response.status;
    } catch {
      return null;
    }
  }

  const identity = await fetchImpl(origin + "/auth/v1/user", {
    method: "GET", redirect: "error", signal: AbortSignal.timeout(10000),
    headers: {apikey: key, Authorization: "Bearer " + token},
  });
  await identity.body?.cancel();
  assert.equal(identity.status, 200, "The synthetic account session must be valid");

  const results = await Promise.all(buckets.map(async bucket => {
    const object = `authenticated/${bucket}/${fixture}`;
    const verified = await head(object, null, service.fetch) === 200;
    if (!verified) return {bucket, verified, results: []};
    const results = await Promise.all([
      ["public-url", `public/${bucket}/${fixture}`],
      ["anonymous", `${bucket}/${fixture}`],
      ["signed-in", object, token],
    ].map(async ([access, path, authorization]) => {
      const status = await head(path, authorization);
      return {access, status, denied: denied.has(status)};
    }));
    const signing = await Promise.all([
      ["anonymous-signing", null],
      ["signed-in-signing", token],
    ].map(async ([access, authorization]) => {
      try {
        const response = await fetchImpl(origin + "/storage/v1/object/sign/" + bucket + "/" + fixture, {
          method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
          headers: {apikey: key, "Content-Type": "application/json",
            ...(authorization ? {Authorization: "Bearer " + authorization} : {})},
          body: JSON.stringify({expiresIn: 60}),
        });
        await response.body?.cancel();
        return {access, status: response.status, denied: denied.has(response.status)};
      } catch {
        return {access, status: null, denied: false};
      }
    }));
    return {bucket, verified, results: [...results, ...signing]};
  }));
  return {scope: "fictional-object-read-and-signing", passed: results.every(bucket => bucket.verified && bucket.results.every(result => result.denied)), results};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await checkPrivateStorage({origin: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_ANON_KEY,
      serviceKey: process.env.DMOCKS_SUPABASE_SERVICE_ROLE_KEY, token: process.env.DMOCKS_STORAGE_TEST_TOKEN, fixture: process.env.DMOCKS_STORAGE_TEST_FIXTURE});
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 2;
  } catch {
    console.error("Private Storage probe configuration is invalid.");
    process.exitCode = 1;
  }
}
