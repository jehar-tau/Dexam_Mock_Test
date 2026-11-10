import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { saveIntakeSource } from "../supabase/functions/_shared/intake-source.mjs";

const actorId = "00000000-0000-4000-8000-000000000181";
const name = "Fictional नकाशा.pdf";
const mimeType = "application/pdf";
const bytes = Buffer.from("%PDF-1.7\nFictional intake source A");
const hash = value => createHash("sha256").update(value).digest("hex");
const sourcePath = `intake/${actorId}/sources/${hash(name)}-${hash(bytes)}.pdf`;

function fixture() {
  const objects = new Map(), registrations = new Map(), calls = [];
  const state = { loseUpload: false, loseRegistration: false, roleDenied: false };
  const admin = {
    storage: { from(bucket) {
      assert.equal(bucket, "question-intake");
      return {
        async upload(path, data, options) {
          assert.deepEqual(options, { contentType: mimeType, upsert: false });
          if (objects.has(path)) return { error: { status: 409 } };
          objects.set(path, new Blob([data], { type: mimeType }));
          if (state.loseUpload) { state.loseUpload = false; throw new Error("Fictional Storage reply lost after commit"); }
          return { data: { path } };
        },
        async download(path) { return { data: objects.get(path) }; },
      };
    } },
    async rpc(method, input) {
      assert.equal(method, "register_question_intake_source");
      calls.push(input);
      if (state.roleDenied) return { error: { code: "42501" } };
      const key = JSON.stringify(input);
      let row = registrations.get(key);
      const reused = Boolean(row);
      if (!row) {
        row = { id: randomUUID(), name: input.p_original_name, status: "uploaded", sourceSha256: input.p_source_sha256 };
        registrations.set(key, row);
      }
      if (state.loseRegistration) { state.loseRegistration = false; throw new Error("Fictional registration reply lost after commit"); }
      return { data: { ...row, reused } };
    },
  };
  const save = patch => saveIntakeSource({ admin, actorId, name, mimeType, bytes, ...patch });
  return { save, objects, registrations, calls, state };
}

test("a lost registration reply retains bytes and the next exact upload confirms the same reviewed source", async () => {
  const fixtureState = fixture();
  fixtureState.state.loseRegistration = true;
  assert.equal((await fixtureState.save()).status, 503);
  assert.deepEqual([...fixtureState.objects.keys()], [sourcePath]);
  assert.deepEqual(Buffer.from(await fixtureState.objects.get(sourcePath).arrayBuffer()), bytes);
  assert.equal(fixtureState.registrations.size, 1);
  const row = [...fixtureState.registrations.values()][0];
  row.status = "reviewed";
  assert.deepEqual(await fixtureState.save(), {
    status: 200, body: { id: row.id, name, status: "reviewed", reused: true },
  });
  assert.equal(fixtureState.registrations.size, 1);
  assert.deepEqual(fixtureState.calls, [0, 1].map(() => ({
    p_uploaded_by: actorId, p_original_name: name, p_mime_type: mimeType,
    p_byte_size: bytes.length, p_source_sha256: hash(bytes),
  })));
});

test("an interrupted Storage reply verifies existing bytes before first registration", async () => {
  const fixtureState = fixture();
  fixtureState.state.loseUpload = true;
  const saved = await fixtureState.save();
  assert.equal(saved.status, 200);
  assert.equal(saved.body.reused, false);
  assert.equal(fixtureState.calls.length, 1);
  assert.equal(fixtureState.objects.size, 1);
});

test("same-length altered retained bytes cannot be overwritten or registered as the original file", async () => {
  const fixtureState = fixture();
  const altered = new Blob([Buffer.from("%PDF-1.7\nFictional intake source B")], { type: mimeType });
  assert.equal(altered.size, bytes.length);
  fixtureState.objects.set(sourcePath, altered);
  assert.equal((await fixtureState.save()).status, 409);
  assert.equal(fixtureState.calls.length, 0);
  assert.equal(fixtureState.objects.get(sourcePath), altered);
});

test("changed bytes under the same name register separately and revocation denies the receipt", async () => {
  const fixtureState = fixture();
  const original = await fixtureState.save();
  const changed = await fixtureState.save({ bytes: Buffer.from("%PDF-1.7\nFictional intake source B") });
  assert.notEqual(changed.body.id, original.body.id);
  assert.equal(fixtureState.objects.size, 2);
  fixtureState.state.roleDenied = true;
  assert.deepEqual(await fixtureState.save(), { status: 403, body: { error: "Admin access required" } });
  assert.equal(fixtureState.registrations.size, 2);
});
