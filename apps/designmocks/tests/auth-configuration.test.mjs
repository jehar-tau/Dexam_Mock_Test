import test from "node:test";
import assert from "node:assert/strict";
import { resolveAuthConfiguration, authCallbackMessage } from "../src/authConfiguration.mjs";

const base = { deployment: "staging", url: "https://fixture-project.supabase.co", key: "sb_publishable_fictional_fixture" };
test("closed defaults do not instantiate authentication or paid access", () => {
  assert.deepEqual(resolveAuthConfiguration({ deployment: "production" }), { authReady: false, portalReady: false, testLoginMode: false });
});
test("controlled login works without accepting draft purchase terms", () => {
  assert.deepEqual(resolveAuthConfiguration({ ...base, testLoginEnabled: true }), { authReady: true, portalReady: false, testLoginMode: true });
});
test("test login cannot become a production release or coincide with paid portal release", () => {
  assert.throws(() => resolveAuthConfiguration({ ...base, deployment: "production", testLoginEnabled: true }));
  assert.throws(() => resolveAuthConfiguration({ ...base, mode: "production", deployment: "development", testLoginEnabled: true }));
  assert.throws(() => resolveAuthConfiguration({ ...base, portalEnabled: true, testLoginEnabled: true, termsVersion: "fixture" }));
  assert.throws(() => resolveAuthConfiguration({ ...base, portalEnabled: true }));
  assert.deepEqual(resolveAuthConfiguration({ ...base, portalEnabled: true, termsVersion: "fixture" }), { authReady: true, portalReady: true, testLoginMode: false });
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
