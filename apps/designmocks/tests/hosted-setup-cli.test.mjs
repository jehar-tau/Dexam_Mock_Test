import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import project from "../supabase/project.json" with { type: "json" };

test("hosted setup requires every core endpoint in portal mode and every endpoint by default", async t => {
  const directory = await mkdtemp(join(tmpdir(), "dmocks-hosted-setup-fixture-"));
  t.after(() => rm(directory, { recursive: true }));
  const provider = join(directory, "provider.mjs");
  await writeFile(provider, `
    const origin = ${JSON.stringify(project.staging_frontend_origin)};
    const optional = new Set(["question-intake-extract", "ai-question-draft", "candidate-phone"]);
    globalThis.fetch = async (target, request) => {
      const pathname = new URL(target).pathname;
      if (pathname === "/rest/v1/plans") {
        return Response.json([{ id: "annual", amount: 119300, currency: "INR", duration_months: 12 }]);
      }
      if (pathname === "/auth/v1/settings") {
        return Response.json({ disable_signup: false, external: { google: process.env.FIXTURE_GOOGLE !== "disabled" } });
      }
      if (pathname.startsWith("/rest/v1/rpc/")) {
        if (pathname.endsWith("/my_attempt_history") && process.env.FIXTURE_ANONYMOUS_HISTORY === "allowed") {
          return Response.json([]);
        }
        return Response.json({ code: "42501" }, { status: 403 });
      }
      const name = pathname.split("/").at(-1);
      if (name === "create-order") return Response.json({ error: "Origin not allowed" }, { status: 403 });
      if (request.method === "POST" && name === "attempt-media") {
        return Response.json({ error: "Sign in required" }, {
          status: 401, headers: { "Access-Control-Allow-Origin": origin },
        });
      }
      if (request.method !== "OPTIONS") throw Error("Unexpected fictional provider request");
      if (optional.has(name) || name === process.env.FIXTURE_MISSING_CORE) {
        return new Response(null, { status: 404 });
      }
      return new Response(null, {
        status: request.headers.Origin === origin ? 204 : 403,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, apikey, Content-Type, x-client-info",
        },
      });
    };
  `);
  const script = fileURLToPath(new URL("../scripts/check-hosted-setup.mjs", import.meta.url));
  for (const scenario of [
    { args: ["--portal-only"], missing: "", status: 0, optional: 3 },
    { args: [], missing: "", status: 2, optional: 0 },
    { args: ["--portal-only"], missing: "question-intake", status: 2, optional: 3 },
    { args: ["--portal-only"], google: "disabled", status: 1 },
    { args: ["--portal-only"], anonymousHistory: "allowed", status: 1 },
  ]) {
    const result = spawnSync(process.execPath, ["--import", provider, script, ...scenario.args], {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        VITE_SUPABASE_URL: `https://${project.project_ref}.supabase.co`,
        VITE_SUPABASE_ANON_KEY: "sb_publishable_fixture_only",
        DMOCKS_BACKEND_STAGE: "staging",
        DMOCKS_AUTH_STAGE: "controlled",
        DMOCKS_COMMERCE_STAGE: "unconfigured",
        FIXTURE_MISSING_CORE: scenario.missing ?? "",
        FIXTURE_GOOGLE: scenario.google ?? "enabled",
        FIXTURE_ANONYMOUS_HISTORY: scenario.anonymousHistory ?? "denied",
      },
    });
    assert.equal(result.status, scenario.status, result.stderr);
    if (scenario.status === 1) {
      assert.match(result.stderr, /AssertionError/);
      assert.equal(result.stdout, "");
      continue;
    }
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.passed, scenario.status === 0);
    const report = JSON.parse(await readFile(join(directory, "test-results/hosted-staging-smoke.json"), "utf8"));
    assert.equal(report.filter(check => check.required === false && !check.passed).length, scenario.optional);
    assert.ok(report.some(check => check.check === "anonymous my_attempt_history denied" && check.passed));
    if (scenario.missing) {
      assert.ok(report.some(check => check.check === "question-intake accepts the staging origin" && check.required && !check.passed));
    }
  }
});
