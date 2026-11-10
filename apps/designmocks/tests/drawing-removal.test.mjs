import assert from "node:assert/strict";
import test from "node:test";
import { runDrawingRemovalCleanup } from "../scripts/drawing-removal-cleanup.mjs";
import { finishDrawingRemoval } from "../supabase/functions/_shared/drawing-removal.mjs";

const first = { id: "00000000-0000-4000-8000-000000000501", storagePath: "drawings/fictional-removed-page.png" };
const second = { id: "00000000-0000-4000-8000-000000000502", storagePath: "drawings/fictional-removed-page.webp" };
const origin = "http://127.0.0.1:6543";
const local = { url: origin, allowOrigin: origin, environment: "development", serviceRoleKey: "sb_secret_fictional_drawing_cleanup" };

function fixture() {
  const objects = new Set([first.storagePath, second.storagePath, "drawings/fictional-replacement.png"]);
  const pending = new Map([first, second].map(row => [row.id, row]));
  const calls = [];
  const state = { interrupted: new Set(), fail: new Set() };
  async function fetchImpl(input, options) {
    const url = new URL(input), body = JSON.parse(options.body);
    assert.equal(url.origin, origin);
    assert.equal(options.redirect, "error");
    calls.push({ method: options.method, path: url.pathname, body });
    if (url.pathname === "/rest/v1/rpc/service_pending_drawing_removals") {
      return Response.json([...pending.values()].slice(0, body.p_limit));
    }
    if (url.pathname === "/storage/v1/object/drawing-submissions") {
      assert.equal(options.method, "DELETE");
      assert.equal(body.prefixes.length, 1);
      const [path] = body.prefixes;
      if (state.fail.has(path)) return new Response(null, { status: 503 });
      objects.delete(path);
      if (state.interrupted.has(path)) throw new Error("Synthetic deletion reply lost after commit");
      return Response.json([]);
    }
    assert.equal(url.pathname, "/rest/v1/rpc/service_confirm_drawing_removal");
    const row = pending.get(body.p_id);
    const removed = row?.storagePath === body.p_storage_path && !objects.has(body.p_storage_path);
    if (removed) pending.delete(body.p_id);
    return Response.json(removed);
  }
  return { objects, pending, calls, state, fetchImpl };
}

test("a missing Storage reply is verified independently, and invalid paths never reach the provider", async () => {
  const calls = [];
  const remove = async path => { calls.push(["remove", path]); throw new Error("Synthetic lost reply"); };
  const confirm = async (id, path) => { calls.push(["confirm", id, path]); return true; };
  assert.equal(await finishDrawingRemoval({ ...first, remove, confirm }), true);
  assert.deepEqual(calls, [["remove", first.storagePath], ["confirm", first.id, first.storagePath]]);
  assert.equal(await finishDrawingRemoval({ ...first, storagePath: "drawings/../replacement.png", remove, confirm }), false);
  assert.equal(calls.length, 2);
  assert.equal(await finishDrawingRemoval({ ...first, remove: async () => {}, confirm: async () => null }), false);
});

test("the default cleanup only reads its bounded batch", async () => {
  const localState = fixture();
  assert.deepEqual(await runDrawingRemovalCleanup(local, { fetchImpl: localState.fetchImpl, limit: 1 }),
    { mode: "dry-run", selected: 1, confirmed: 0, pending: 1, limitReached: true });
  assert.deepEqual(localState.calls, [{ method: "POST", path: "/rest/v1/rpc/service_pending_drawing_removals", body: { p_limit: 1 } }]);
  assert.equal(localState.objects.size, 3);
});

test("cleanup confirms only absent removed objects and leaves failures available for a later sweep", async () => {
  const localState = fixture();
  localState.state.interrupted.add(first.storagePath);
  localState.state.fail.add(second.storagePath);
  assert.deepEqual(await runDrawingRemovalCleanup(local, { fetchImpl: localState.fetchImpl, apply: true }),
    { mode: "cleanup", selected: 2, confirmed: 1, pending: 1, limitReached: false });
  assert.deepEqual([...localState.pending.keys()], [second.id]);
  localState.state.fail.clear();
  assert.deepEqual(await runDrawingRemovalCleanup(local, { fetchImpl: localState.fetchImpl, apply: true }),
    { mode: "cleanup", selected: 1, confirmed: 1, pending: 0, limitReached: false });
  assert.deepEqual([...localState.objects], ["drawings/fictional-replacement.png"]);
});

test("cleanup validates the entire batch and target before any Storage request", async () => {
  const localState = fixture();
  for (const rows of [[first, first], [first, { ...second, storagePath: "other/private.png" }]]) {
    const seen = [];
    await assert.rejects(runDrawingRemovalCleanup(local, { apply: true, fetchImpl: url => {
      seen.push(url);
      return Response.json(rows);
    } }), /batch could not be verified/);
    assert.deepEqual(seen, [origin + "/rest/v1/rpc/service_pending_drawing_removals"]);
  }
  for (const config of [{ ...local, environment: "production" }, { ...local, environment: "staging" }]) {
    await assert.rejects(runDrawingRemovalCleanup(config, { fetchImpl: localState.fetchImpl, apply: true }));
  }
  await assert.rejects(runDrawingRemovalCleanup(local, { fetchImpl: localState.fetchImpl, limit: 51 }), /limit/);
  assert.deepEqual(localState.calls, []);
});
