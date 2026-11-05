import test from "node:test";
import assert from "node:assert/strict";
import { buildManifest, objectiveReady, runtimeQuestion } from "../scripts/question-bank-import.mjs";

const question = (changes = {}) => ({ externalKey: "fixture-q1", type: "MCQ", prompt: "Which fixture is valid?", options: [{ key: "A", text: "One" }, { key: "B", text: "Two" }], answer: { raw: "A", status: "official-key" }, topic: "observation", licence: "owner-authorized", holds: [], provenance: { exam: "uceed" }, ...changes });
const bank = (questions) => ({ schemaVersion: 1, exportedAt: "2026-11-05T00:00:00Z", questions });

test("imports only records with an explicitly empty holds array", () => {
  const manifest = buildManifest(bank([question(), question({ externalKey: "held", holds: ["review"] })]));
  assert.equal(manifest.sourceTotal, 2);
  assert.equal(manifest.eligibleTotal, 1);
  assert.equal(manifest.heldTotal, 1);
  assert.equal(manifest.records[0].externalKey, "fixture-q1");
  assert.equal(manifest.records[0].payload.holds.length, 0);
});

test("fails closed for missing or malformed holds", () => {
  assert.throws(() => buildManifest(bank([question({ holds: undefined })])), /malformed holds/);
  assert.throws(() => buildManifest(bank([question({ holds: "" })])), /malformed holds/);
});

test("content hashes are deterministic across object key order", () => {
  const first = buildManifest(bank([question()])).records[0].contentSha256;
  const reversed = Object.fromEntries(Object.entries(question()).reverse());
  const second = buildManifest(bank([reversed])).records[0].contentSha256;
  assert.equal(first, second);
});

test("empty holds never bypass objective scoring requirements", () => {
  assert.equal(objectiveReady(question()), true);
  assert.equal(objectiveReady(question({ answer: { raw: null, status: "pending" } })), false);
  assert.equal(objectiveReady(question({ options: [] })), false);
  assert.equal(objectiveReady(question({ type: "DESCRIPTIVE", options: [], answer: null })), false);
});

test("runtime conversion is deterministic and excludes unresolved media", () => {
  assert.deepEqual(runtimeQuestion(question()).key, { kind: "mcq", correct: ["A"] });
  assert.equal(runtimeQuestion(question({ visualDependency: true, assets: [{ path: "missing.png" }] })), null);
  assert.equal(runtimeQuestion(question({ answer: { raw: "Z", status: "official-key" } })), null);
});
