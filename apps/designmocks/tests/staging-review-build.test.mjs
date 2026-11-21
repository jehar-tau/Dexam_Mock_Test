import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const app = fileURLToPath(new URL("../", import.meta.url));
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !key.startsWith("VITE_") && !key.startsWith("DMOCKS_") && key !== "NODE_ENV"));

for (const [name, mode, override, message] of [
  ["production mode, even with a staging deployment label", "production", { VITE_DEPLOYMENT_ENV: "staging" }, /requires a production-optimized staging build/],
  ["staging mode with a production deployment label", "staging", { VITE_DEPLOYMENT_ENV: "production" }, /requires a production-optimized staging build/],
  ["staging mode with development modules enabled", "staging", { NODE_ENV: "development" }, /requires a production-optimized staging build/],
  ["the provider-backed staging portal", "staging", { VITE_STAGING_PORTAL_ENABLED: "true" }, /without sign-in, backend, checkout or release configuration/],
  ["checkout enabled", "staging", { VITE_CHECKOUT_ENABLED: "true" }, /without sign-in, backend, checkout or release configuration/],
  ["a provider key supplied", "staging", { VITE_SUPABASE_ANON_KEY: "fictional-test-key" }, /without sign-in, backend, checkout or release configuration/],
]) {
  test(`hosted review rejects ${name}`, () => {
    const result = spawnSync(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--mode", mode], {
      cwd: app,
      encoding: "utf8",
      env: { ...environment, ...override, VITE_STAGING_REVIEW_PREVIEW: "true" },
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, message);
  });
}
