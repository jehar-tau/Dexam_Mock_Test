import assert from "node:assert/strict";
import test from "node:test";
import project from "../supabase/project.json" with { type: "json" };
import { reviewStagingGoogleRedirect } from "../scripts/check-staging-google-redirect.mjs";

const callback = new URL("/account/callback", project.staging_frontend_origin).href;
const redirectPath = ["auth", "additional_redirect_urls"];
const googlePath = ["auth", "external", "google", "enabled"];

function config(redirects, googleEnabled = true) {
  return {
    dry_run: true,
    wrote: false,
    target: { kind: "linked", project_ref: project.project_ref },
    changes: [
      { path: redirectPath, remote: redirects },
      { path: googlePath, remote: googleEnabled },
      { path: ["unrelated", "settings"], remote: "a private configuration value" },
    ],
  };
}

test("the result contains only the readiness settings for the exact staging callback", () => {
  const result = reviewStagingGoogleRedirect(config([callback, "https://additional.invalid/"]));
  assert.deepEqual(result, { projectRef: project.project_ref, callback, googleEnabled: true, callbackAllowed: true, passed: true });
});

test("a public, wildcard, or similar path cannot replace the exact staging callback", () => {
  const result = reviewStagingGoogleRedirect(config([
    project.frontend_origin + "/account/callback", project.staging_frontend_origin + "/**", callback + "/",
  ]));
  assert.equal(result.googleEnabled, true);
  assert.equal(result.callbackAllowed, false);
  assert.equal(result.passed, false);
  assert.equal(reviewStagingGoogleRedirect(config([callback], false)).passed, false);
});

test("rejects an unverified report or malformed provider fields", () => {
  const report = config([callback]);
  assert.throws(() => reviewStagingGoogleRedirect({ ...report, wrote: true }), /read-only config/);
  assert.throws(() => reviewStagingGoogleRedirect({ ...report, dry_run: false }), /read-only config/);
  assert.throws(() => reviewStagingGoogleRedirect({ ...report, target: { ...report.target, project_ref: "foreign" } }), /reviewed staging project/);
  assert.throws(() => reviewStagingGoogleRedirect({ ...report, changes: [] }), /did not identify/);
  assert.throws(() => reviewStagingGoogleRedirect({ ...report, changes: [...report.changes, report.changes[0]] }), /did not identify/);
  assert.throws(() => reviewStagingGoogleRedirect(config([null])), /malformed/);
  assert.throws(() => reviewStagingGoogleRedirect(config([callback], "true")), /malformed/);
});
