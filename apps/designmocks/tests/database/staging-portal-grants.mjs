import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {compareStagingRpcs} from "../../scripts/compare-staging-rpcs.mjs";

const database = process.env.DESIGNMOCKS_TEST_DATABASE_URL;
const hook = "supabase/launch/private-staging-api.sql";
const grants = "supabase/launch/private-staging-portal-grants.sql";
const paid = "supabase/launch/paid-mvp.sql";

function sql(...args) {
  const result = spawnSync("psql", [database, "-XqAt", "-v", "ON_ERROR_STOP=1", ...args], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function reject(message) {
  const result = spawnSync("psql", [database, "-XqAt", "-v", "ON_ERROR_STOP=1", "-f", grants], {encoding: "utf8"});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, message);
}

function inventory() {
  return JSON.parse(sql("-f", "supabase/audit/staging-rpc-inventory.sql"));
}

const baseline = inventory();
sql("-c", "update dm_private.registration_policy set mode='testers' where id");
reject(/Install and verify the private staging Data API hook first/);
assert.deepEqual(inventory(), baseline);

sql("-f", hook);
sql("-c", "update dm_private.registration_policy set mode='closed' where id");
reject(/requires tester-only registration/);
sql("-c", "update dm_private.registration_policy set mode='testers' where id");
const fixtureActor = "00000000-0000-4000-8000-000000000193";
sql("-c", `insert into auth.users(id,email) values ('${fixtureActor}','test-checkout-control@example.invalid');
  update dm_private.mvp_test_checkout_control
  set enabled=true, expires_at=now()+interval '1 hour', actor_id='${fixtureActor}', evidence='Fictional checkout fixture' where singleton`);
reject(/Close the merchant Test window/);
sql("-c", `update dm_private.mvp_test_checkout_control
  set enabled=false, expires_at=null, actor_id=null, evidence=null where singleton;
  delete from auth.users where id='${fixtureActor}'`);
assert.deepEqual(inventory(), baseline);

try {
  sql("-c", "grant execute on function public.public_all_india_top_ten() to anon");
  reject(/requires anonymous ranking access to be closed/);
  sql("-c", "revoke execute on function public.public_all_india_top_ten() from anon");
  sql("-f", grants);
  const restored = inventory();
  const delta = compareStagingRpcs(baseline, restored);
  for (const key of ["missingFunctions", "extraFunctions", "missingGrants", "changedDefinitions"]) {
    assert.deepEqual(delta[key], []);
  }
  assert.equal(delta.extraGrants.length, 50);
  assert.ok(delta.extraGrants.every(grant => grant.role === "authenticated"));
  for (const signature of [
    "public.community_feed(text, text, jsonb, integer)",
    "public.admin_question_intake_assets()",
    "public.can_review_drawings()",
    "public.admin_learning_lessons()",
  ]) {
    assert.ok(delta.extraGrants.some(grant => grant.signature === signature));
  }
  for (const signature of [
    "public.public_all_india_top_ten()",
    "public.admin_open_all_india_ranking_publication(uuid, text, text)",
    "public.admin_moderate_community(text, uuid, text, text)",
    "public.admin_review_bank_question(text, boolean, boolean, text)",
    "public.finalize_expired_attempts(integer)",
  ]) {
    const entry = restored.functions.find(row => row.signature === signature);
    assert.equal(entry.anon, false, signature);
    assert.equal(entry.authenticated, false, signature);
  }
  assert.equal(sql("-c", "select dm_private.mvp_profile_permissions_valid()"), "f");
  assert.equal(sql("-c", "select dm_private.mvp_test_checkout_allowed()"), "f");
  sql("-f", grants);
  assert.deepEqual(inventory(), restored);
} finally {
  sql("-f", paid);
  sql("-c", "alter role authenticator in database " + sql("-c", "select quote_ident(current_database())") + " reset pgrst.db_pre_request");
  sql("-c", "drop schema dm_staging_api cascade; update dm_private.registration_policy set mode='closed' where id");
}
assert.deepEqual(inventory(), baseline);
console.log("PASS: staging-only portal grants preserve commerce and private RPC boundaries.");
