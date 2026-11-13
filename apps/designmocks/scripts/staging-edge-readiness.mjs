import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";

const project = JSON.parse(await readFile(new URL("../supabase/project.json", import.meta.url), "utf8"));
const backend = `https://${project.project_ref}.supabase.co`;
const origin = project.staging_frontend_origin;
const foreign = "https://invalid.example";
const requestedHeaders = ["authorization", "apikey", "content-type", "x-client-info"];
const features = [
  ["attempt-media", "Assessment figures"],
  ["drawing-media", "Student drawing uploads"],
  ["drawing-review-media", "Teacher drawing review"],
  ["community-media", "Community attachments"],
  ["question-intake", "Question intake"],
  ["bank-review-media", "Question bank review"],
  ["reported-question-media", "Reported question review"],
];

function publicKey(key) {
  if (/^sb_publishable_[\w-]+$/.test(key ?? "")) return true;
  try {
    const token = key.split(".");
    const claims = JSON.parse(Buffer.from(token[1], "base64url"));
    return token.length === 3 && claims.role === "anon" && claims.ref === project.project_ref;
  } catch {
    return false;
  }
}

export async function probeStagingEdge({url, key, fetchImpl = fetch}) {
  assert.equal(url, backend, "Use the approved DMocks staging backend origin");
  assert.ok(publicKey(key), "Use the public DMocks staging API key");

  async function preflight(name, from) {
    try {
      const response = await fetchImpl(`${backend}/functions/v1/${name}`, {
        method: "OPTIONS",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          apikey: key,
          Origin: from,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": requestedHeaders.join(","),
        },
      });
      const tokens = header => (response.headers.get(header) ?? "").toLowerCase().split(",").map(value => value.trim());
      const observation = {
        status: response.status,
        approvedOrigin: response.headers.get("access-control-allow-origin") === origin,
        allowsForeignOrigin: [foreign, "*"].includes(response.headers.get("access-control-allow-origin")),
        allowsPost: tokens("access-control-allow-methods").includes("post"),
        requiredHeaders: requestedHeaders.every(header => tokens("access-control-allow-headers").includes(header)),
      };
      await response.body?.cancel();
      return observation;
    } catch {
      return {status: null};
    }
  }

  const results = await Promise.all(features.map(async ([name, feature]) => {
    const [approved, rejected] = await Promise.all([preflight(name, origin), preflight(name, foreign)]);
    let result = "ready";
    if (approved.status === 404) result = "endpoint-not-found";
    else if (approved.status === null || rejected.status === null) result = "request-failed";
    else if (approved.status === 403 && !approved.approvedOrigin) result = "staging-origin-rejected";
    else if (approved.status !== 204 || !approved.approvedOrigin || !approved.allowsPost || !approved.requiredHeaders) result = "invalid-staging-preflight";
    else if (rejected.status !== 403 || rejected.allowsForeignOrigin) result = "foreign-origin-not-denied";
    return {name, feature, result, stagingStatus: approved.status, foreignStatus: rejected.status};
  }));

  return {scope: "staging-edge-cors-only", passed: results.every(row => row.result === "ready"), results};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await probeStagingEdge({url: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_ANON_KEY});
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
