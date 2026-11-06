import test from "node:test";
import assert from "node:assert/strict";
import { resolveAuthConfiguration, authCallbackMessage } from "../src/authConfiguration.mjs";

const base = { deployment: "staging", url: "https://fixture-project.supabase.co", key: "sb_publishable_fictional_fixture" };
const closed = { authReady: false, portalReady: false, testLoginMode: false, stagingPortalMode: false, checkoutReady: false };
test("closed defaults do not instantiate authentication or paid access", () => {
  assert.deepEqual(resolveAuthConfiguration({ deployment: "production" }), closed);
});
test("controlled login works without accepting draft purchase terms", () => {
  assert.deepEqual(resolveAuthConfiguration({ ...base, testLoginEnabled: true }), { ...closed, authReady: true, testLoginMode: true });
});
test("test login cannot become a production release or coincide with paid portal release", () => {
  assert.throws(() => resolveAuthConfiguration({ ...base, deployment: "production", testLoginEnabled: true }));
  assert.throws(() => resolveAuthConfiguration({ ...base, mode: "production", deployment: "development", testLoginEnabled: true }));
  assert.throws(() => resolveAuthConfiguration({ ...base, portalEnabled: true, testLoginEnabled: true, termsVersion: "fixture" }));
  assert.throws(() => resolveAuthConfiguration({ ...base, deployment: "production", portalEnabled: true }));
  assert.deepEqual(resolveAuthConfiguration({ ...base, deployment: "production", portalEnabled: true, termsVersion: "fixture" }), {
    ...closed, authReady: true, portalReady: true, checkoutReady: true,
  });
});
test("the private staging portal pins the build, browser origin and backend with checkout closed", () => {
  const stagingTarget = { url: base.url, origin: "https://approved-staging.example" };
  const input = { ...base, mode: "staging", origin: stagingTarget.origin, stagingTarget, stagingPortalEnabled: true };
  assert.deepEqual(resolveAuthConfiguration(input), { ...closed, authReady: true, portalReady: true, stagingPortalMode: true });
  for (const origin of ["https://dmocks.com", "https://approved-staging.example.invalid", "http://127.0.0.1:4190"]) {
    assert.deepEqual(resolveAuthConfiguration({ ...input, origin }), closed);
  }
  for (const replacement of [{ mode: "production" }, { deployment: "production" }, { deployment: "test" }, { url: "https://other-project.supabase.co" },
    { key: "sb_secret_fixture" }, { testLoginEnabled: true }, { portalEnabled: true }]) {
    assert.throws(() => resolveAuthConfiguration({ ...input, ...replacement }));
  }
  assert.throws(() => resolveAuthConfiguration({ ...base, portalEnabled: true, termsVersion: "fixture" }), /private staging/);
  assert.throws(() => resolveAuthConfiguration({ ...base, url: base.url.toUpperCase(), deployment: "production", portalEnabled: true,
    termsVersion: "fixture", stagingTarget }), /separate Supabase/);
});
test("browser authentication rejects server keys, invalid projects and missing configuration", () => {
  for (const replacement of [{key: "sb_secret_fictional"}, {key: ""}, {url: "https://invalid.example"}, {key: "invalid-client-key"}, {key: "a."+Buffer.from(JSON.stringify({role:"service_role"})).toString("base64url")+".c"}]) {
    assert.throws(() => resolveAuthConfiguration({ ...base, ...replacement, testLoginEnabled: true }));
  }
  const anon = "a."+Buffer.from(JSON.stringify({role:"anon"})).toString("base64url")+".c";
  assert.equal(resolveAuthConfiguration({ ...base, key: anon, testLoginEnabled: true }).authReady, true);
});
test("callback failure and cancellation display safe messages, never provider parameters", () => {
  assert.match(authCallbackMessage("?error=access_denied&error_description=private-value"), /cancelled/);
  assert.match(authCallbackMessage("", "#error=server_error&error_description=private-value"), /could not be completed/);
  assert.equal(authCallbackMessage("?code=private-value"), "");
  assert.ok(!authCallbackMessage("?error=other&error_description=private-value").includes("private-value"));
});
