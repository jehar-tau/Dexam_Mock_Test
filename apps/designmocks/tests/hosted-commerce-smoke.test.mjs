import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import project from "../supabase/project.json" with { type: "json" };

const base = `https://${project.project_ref}.supabase.co`;
const script = fileURLToPath(new URL("../scripts/check-hosted-setup.mjs", import.meta.url));
const orderModule = new URL("../supabase/functions/_shared/create-order.mjs", import.meta.url);
const webhookModule = new URL("../supabase/functions/_shared/payment-webhook.mjs", import.meta.url);

function runSmoke(stage, fixture, { staging = false } = {}) {
  const folder = mkdtempSync(join(tmpdir(), "dmocks-commerce-smoke-"));
  const preload = `
    import assert from "node:assert/strict";
    import { createOrderHandler } from ${JSON.stringify(orderModule.href)};
    import { createPaymentWebhookHandler } from ${JSON.stringify(webhookModule.href)};
    const fixture = ${JSON.stringify(fixture)};
    const environment = { PUBLIC_APP_ORIGIN: ${JSON.stringify(staging || fixture === "separate-checkout" ? project.staging_frontend_origin : project.frontend_origin)} };
    if (fixture === "separate-checkout") environment.DMOCKS_CHECKOUT_ORIGIN = ${JSON.stringify(project.frontend_origin)};
    if (fixture !== "unconfigured") {
      for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
        "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"]) environment[name] = "fictional";
    }
    const dependencies = {
      readEnvironment: key => environment[key],
      createClient: () => assert.fail("rejection probes must never create a database client"),
      reportFailure: () => {},
    };
    const order = createOrderHandler(dependencies);
    const webhook = createPaymentWebhookHandler(dependencies);
    globalThis.fetch = async (input, init) => {
      const url = new URL(input);
      assert.equal(url.origin, ${JSON.stringify(base)});
      assert.equal(init.redirect, "error");
      const request = new Request(input, init);
      const browserPreflight = request.method === "OPTIONS";
      assert.equal(request.headers.get("apikey"), browserPreflight ? null : "sb_publishable_fictional");
      assert.equal(request.headers.get("authorization"), null);
      if (browserPreflight) {
        assert.equal(request.headers.get("content-type"), null);
        assert.equal(request.headers.get("access-control-request-headers"), "authorization,apikey,content-type,x-client-info");
      }
      if (url.pathname === "/functions/v1/create-order") {
        if (fixture === "missing-checkout-allow-headers" && browserPreflight)
          return new Response(null, {status: 204, headers: {
            "Access-Control-Allow-Origin": environment.PUBLIC_APP_ORIGIN,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type",
          }});
        if (fixture === "gateway" && request.method === "POST" &&
          request.headers.get("origin") === environment.PUBLIC_APP_ORIGIN)
          return Response.json({ message: "Missing authorization header" }, {
            status: 401, headers: { "Access-Control-Allow-Origin": environment.PUBLIC_APP_ORIGIN },
          });
        return order(request);
      }
      if (url.pathname === "/functions/v1/payment-webhook") {
        assert.equal(request.headers.get("x-razorpay-signature"), null);
        assert.deepEqual(await request.clone().json(),
          process.env.DMOCKS_COMMERCE_STAGE === "configured" ? { event: "smoke.invalid" } : {});
        return webhook(request);
      }
      if (url.pathname === "/rest/v1/plans") return Response.json([{ id: "annual", amount: 119300, currency: "INR", duration_months: 12 }]);
      if (fixture === "public-ranking" && url.pathname === "/rest/v1/rpc/public_all_india_top_ten") return Response.json([]);
      if (url.pathname.startsWith("/rest/v1/rpc/")) return Response.json({ code: "42501" }, { status: 401 });
      if (url.pathname === "/auth/v1/settings") return Response.json({ disable_signup: !${staging}, external: { google: ${staging} } });
      if (${staging} && request.method === "OPTIONS" && url.pathname.startsWith("/functions/v1/")) {
        const approved = request.headers.get("origin") === environment.PUBLIC_APP_ORIGIN;
        return new Response(null, { status: approved ? 204 : 403, headers: {
          "Access-Control-Allow-Origin": environment.PUBLIC_APP_ORIGIN,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
        } });
      }
      if (url.pathname === "/functions/v1/attempt-media") {
        if (fixture === "media-transport-error") throw new Error("fictional private upstream diagnostic");
        if (fixture === "staging-origin-rejected") return Response.json({ error: "Origin not allowed" }, { status: 403 });
        const origin = fixture === "wrong-media-origin" ? ${JSON.stringify(project.staging_frontend_origin)} : request.headers.get("origin");
        const body = fixture === "media-gateway" ? {message: "Missing authorization header"} : {error: "Sign in required"};
        return Response.json(body, { status: 401, headers: { "Access-Control-Allow-Origin": origin } });
      }
      assert.fail("unexpected probe " + url.pathname);
    };
  `;
  try {
    const result = spawnSync(process.execPath, ["--import", "data:text/javascript," + encodeURIComponent(preload), script], {
      cwd: folder, encoding: "utf8",
      env: {
        VITE_SUPABASE_URL: base, VITE_SUPABASE_ANON_KEY: "sb_publishable_fictional",
        ...(stage ? { DMOCKS_COMMERCE_STAGE: stage } : {}),
        ...(staging ? { DMOCKS_BACKEND_STAGE: "staging", DMOCKS_AUTH_STAGE: "controlled" } : {}),
      },
    });
    if (![0, 2].includes(result.status)) return result;
    const name = stage === "configured" ? "hosted-configured-commerce-smoke.json" : staging ? "hosted-staging-smoke.json" : "hosted-smoke.json";
    return { ...result, checks: JSON.parse(readFileSync(join(folder, "test-results", name), "utf8")) };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

test("default hosted smoke retains the unconfigured 503 checks", () => {
  const result = runSmoke(undefined, "unconfigured");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.checks.filter(check => check.status === 503).map(check => check.check),
    ["create-order setup/identity gate", "payment-webhook setup/identity gate"]);
});

test("configured smoke uses actual handlers and reports rejection-only scope", () => {
  const result = runSmoke("configured", "configured");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.checks.slice(-4).map(check => check.status), [204, 401, 401, 403]);
  assert.match(JSON.parse(result.stdout).commerceScope, /provider acceptance are unverified/);
});

test("configured smoke rejects unconfigured handlers and generic gateway denials", () => {
  for (const fixture of ["unconfigured", "gateway"]) {
    const result = runSmoke("configured", fixture);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.checks.find(row => row.check === "configured checkout handler rejects anonymous requests").passed, false);
  }
});

test("configured commerce smoke accepts the checkout origin with a different portal origin", () => {
  const result = runSmoke("configured", "separate-checkout");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.checks.slice(-4).map(check => check.status), [204, 401, 401, 403]);
});

test("configured commerce smoke requires the assessment handler to accept the checkout origin", () => {
  for (const fixture of ["wrong-media-origin", "media-gateway", "staging-origin-rejected"]) {
    const result = runSmoke("configured", fixture);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.checks.find(row => row.check === "attempt-media setup/identity gate").passed, false);
    assert.ok(result.checks.slice(-4).every(row => row.passed));
  }
});

test("configured commerce records transport failure and continues without exposing diagnostics", () => {
  const result = runSmoke("configured", "media-transport-error");
  assert.equal(result.status, 2, result.stderr);
  assert.deepEqual(result.checks.find(row => row.check === "attempt-media setup/identity gate"), {
    check: "attempt-media setup/identity gate", status: null, passed: false,
  });
  assert.ok(result.checks.slice(-4).every(row => row.passed));
  assert.doesNotMatch(result.stdout + result.stderr, /fictional private upstream diagnostic/);
});

test("staging verifies portal preflights even when commerce credentials are present", () => {
  const result = runSmoke(undefined, "configured", { staging: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.checks.filter(check => check.check.endsWith("accepts the staging origin")).length, 10);
  for (const name of ["question-intake-extract", "ai-question-draft", "candidate-phone"]) {
    assert.ok(result.checks.some(check => check.check === name + " accepts the staging origin" && check.passed));
  }
  assert.equal(result.checks.some(check => check.check.startsWith("payment-webhook")), false);
  assert.ok(result.checks.some(check => check.check === "unapproved checkout origin denied"));
  assert.ok(result.checks.some(check => check.check === "staging anonymous ranking denied"));
});

test("private staging smoke rejects an exposed anonymous ranking endpoint", () => {
  const result = runSmoke(undefined, "public-ranking", { staging: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must keep anonymous ranking access closed/);
});

test("staging records an origin failure and still checks the remaining Edge routes", () => {
  const result = runSmoke(undefined, "staging-origin-rejected", { staging: true });
  assert.equal(result.status, 2, result.stderr);
  assert.deepEqual(result.checks.find(row => row.check === "attempt-media setup/identity gate"), {
    check: "attempt-media setup/identity gate", status: 403, passed: false,
  });
  assert.equal(result.checks.filter(row => row.check.endsWith("accepts the staging origin")).length, 10);
});

test("staging and configured commerce probes require separate runs", () => {
  const result = runSmoke("configured", "configured", { staging: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Run the configured commerce probe separately/);
});

test("configured smoke rejects a checkout preflight missing browser request headers", () => {
  const result = runSmoke("configured", "missing-checkout-allow-headers");
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.checks.find(row => row.check === "approved checkout preflight").passed, false);
  assert.ok(result.checks.slice(-3).every(row => row.passed));
});
