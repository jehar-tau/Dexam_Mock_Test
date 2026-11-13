import assert from "node:assert/strict";
import test from "node:test";
import {stagingEdgeDenied} from "../supabase/functions/_shared/staging-edge-admission.mjs";

test("staging media requires the exact confirmed tester response on each check", async () => {
  const signal = new AbortController().signal;
  const responses = [{data: true}, {data: false}, {data: null, error: {code: "42501"}}, {data: "true"}];
  const client = {rpc(name) {
    assert.equal(name, "can_enter_staging_portal");
    return {abortSignal(requestSignal) {
      assert.equal(requestSignal, signal);
      return Promise.resolve(responses.shift());
    }};
  }};
  for (const denied of [false, true, true, true]) {
    assert.equal(await stagingEdgeDenied("true", client, signal), denied);
  }
  assert.equal(responses.length, 0);
});

test("unchanged deployments skip the probe and bad configuration fails closed", async () => {
  const unused = {rpc: () => assert.fail("Unexpected RPC")};
  assert.equal(await stagingEdgeDenied(undefined, unused), false);
  assert.equal(await stagingEdgeDenied("false", unused), false);
  assert.equal(await stagingEdgeDenied("", unused), true);
  assert.equal(await stagingEdgeDenied("true", {rpc() { throw new Error("offline"); }}), true);
});
