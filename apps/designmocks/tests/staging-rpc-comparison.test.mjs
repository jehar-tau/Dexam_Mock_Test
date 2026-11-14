import assert from "node:assert/strict";
import test from "node:test";
import {compareStagingRpcs} from "../scripts/compare-staging-rpcs.mjs";

const rpc = (signature, grants = {}) => ({
  signature, anon: false, authenticated: false, service: false, auth_hook: false, ...grants,
});
const inventory = (...functions) => ({version: 1, functions});

test("compares effective role grants for exact overloads", () => {
  const publicRanking = rpc("public.public_all_india_top_ten()", {anon: true, authenticated: true});
  const browse = rpc("public.community_feed(text, text)", {authenticated: true});
  const consume = rpc("public.claim_question_intake_asset(uuid)", {service: true});
  const hook = rpc("public.before_designmocks_user_created(jsonb)", {auth_hook: true});
  const extra = rpc("public.community_feed()", {anon: true});
  const report = compareStagingRpcs(inventory(browse, consume, hook, publicRanking),
    inventory(extra, {...consume, authenticated: true}, {...publicRanking, anon: false}));
  assert.equal(report.matchesMigrationBaseline, false);
  assert.deepEqual(report.missingFunctions, [hook.signature, browse.signature]);
  assert.deepEqual(report.extraFunctions, [extra.signature]);
  assert.deepEqual(report.missingGrants, [
    {signature: hook.signature, role: "auth_hook"},
    {signature: browse.signature, role: "authenticated"},
    {signature: publicRanking.signature, role: "anon"},
  ]);
  assert.deepEqual(report.extraGrants, [
    {signature: consume.signature, role: "authenticated"},
    {signature: extra.signature, role: "anon"},
  ]);
  assert.equal(compareStagingRpcs(inventory(browse, publicRanking), inventory(publicRanking, browse)).matchesMigrationBaseline, true);
});

test("rejects incomplete or duplicate input", () => {
  const row = rpc("public.read_attempt(uuid)");
  for (const bad of [inventory(), inventory(row, row), inventory({signature: row.signature}), {version: 3, functions: [row]}]) {
    assert.throws(() => compareStagingRpcs(inventory(row), bad), /staging RPC/);
  }
});

test("definition fingerprints catch altered behavior with identical effective grants", () => {
  const signature = "public.read_attempt(uuid)";
  const source = {version: 2, functions: [rpc(signature, {authenticated: true, definition_sha256: "a".repeat(64)})]};
  const staging = structuredClone(source);
  staging.functions[0].definition_sha256 = "b".repeat(64);
  const report = compareStagingRpcs(source, staging);
  assert.equal(report.scope, "public-rpc-definitions-and-grants");
  assert.equal(report.matchesMigrationBaseline, false);
  assert.deepEqual(report.changedDefinitions, [signature]);
  assert.deepEqual(report.extraGrants, []);
  assert.deepEqual(report.missingGrants, []);
  assert.doesNotMatch(JSON.stringify(report), /[ab]{64}/);
  assert.throws(() => compareStagingRpcs(source, inventory(rpc(signature))), /same staging RPC inventory version/);
  staging.functions[0].definition_sha256 = null;
  assert.throws(() => compareStagingRpcs(source, staging), /staging RPC signature/);
});
