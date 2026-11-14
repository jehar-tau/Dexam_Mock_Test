import assert from "node:assert/strict";
import test from "node:test";
import project from "../supabase/project.json" with {type: "json"};
import {checkStagingApiAdmission} from "../scripts/check-staging-api-admission.mjs";

const origin = `https://${project.project_ref}.supabase.co`;
const ids = ["00000000-0000-4000-8000-000000000010", "00000000-0000-4000-8000-000000000011"];
const tokens = ids.map(sub => "header." + Buffer.from(JSON.stringify({sub, role: "authenticated"})).toString("base64url") + ".sig");
const response = (status, data) => Response.json(data, {status});
const denial = {code: "42501", message: "Private staging requires an approved Google tester"};
function fixture(override = () => null) {
  return {
    origin, key: "sb_publishable_fictional", admitted: tokens[0], excluded: tokens[1],
    fetchImpl: async (url, options) => {
      assert.equal(options.redirect, "error");
      const path = url.slice(origin.length);
      const actor = tokens.indexOf(options.headers.Authorization?.slice(7));
      const forced = override(path, actor);
      if (forced) return forced;
      if (path === "/auth/v1/user") {
        assert.equal(options.method, "GET");
        return response(200, {id: ids[actor], email: "fictional@example.invalid"});
      }
      assert.equal(options.method, "POST");
      assert.equal(options.body, "{}");
      if (actor === -1) return response(401, {code: "42501"});
      if (actor === 1) return response(403, denial);
      return response(200, path.endsWith("/can_enter_staging_portal"));
    },
  };
}

test("verifies valid distinct sessions, the staging hook, admitted RPC access and anonymous denial", async () => {
  const report = await checkStagingApiAdmission(fixture());
  assert.equal(report.passed, true);
  assert.deepEqual(report.checks.map(({status}) => status), [200, 200, 403, 403, 401]);
  for (const secret of [...tokens, ...ids, "fictional@example.invalid"]) {
    assert.ok(!JSON.stringify(report).includes(secret));
  }
});

test("a missing grant, bypass, or failed admitted control does not establish the staging hook", async () => {
  for (const failure of [
    fixture((path, actor) => actor === 1 && path.endsWith("my_attempt_history") && response(200, [])),
    fixture((path, actor) => actor === 1 && path.endsWith("is_dmocks_admin") && response(403, {code: "42501", message: "permission denied"})),
    fixture((path, actor) => actor === 0 && path.endsWith("is_dmocks_admin") && response(403, denial)),
    fixture((path, actor) => actor === 0 && path.endsWith("can_enter_staging_portal") && response(200, false)),
    fixture((path, actor) => actor === -1 && path.endsWith("can_enter_staging_portal") && response(404, {code: "PGRST202"})),
  ]) {
    assert.equal((await checkStagingApiAdmission(failure)).passed, false);
  }
});

test("rejects invalid sessions, duplicate users and credentials for another origin", async () => {
  await assert.rejects(checkStagingApiAdmission(fixture((path, actor) => actor === 1 && path === "/auth/v1/user" && response(401, {}))), /must be valid/);
  await assert.rejects(checkStagingApiAdmission({...fixture(), excluded: tokens[0]}), /different fictional/);
  await assert.rejects(checkStagingApiAdmission({...fixture(), origin: "https://example.invalid"}), /designated DMocks/);
  await assert.rejects(checkStagingApiAdmission({...fixture(), key: "sb_secret_fictional"}), /public DMocks/);
});
