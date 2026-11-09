import test from "node:test";
import assert from "node:assert/strict";
import { applyManifest, buildManifest, objectiveReady, runtimeQuestion } from "../scripts/question-bank-import.mjs";

import { RULES_2027 } from "../scripts/question-runtime.mjs";

const question = (changes = {}) => ({ externalKey: "fixture-q1", type: "MCQ", prompt: "Which fixture is valid?", options: [{ key: "A", text: "One" }, { key: "B", text: "Two" }, { key: "C", text: "Three" }, { key: "D", text: "Four" }], answer: { raw: "A", status: "official-key" }, topic: "observation", licence: "owner-authorized", holds: [], provenance: { exam: "uceed" }, ...changes });
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
  assert.deepEqual(runtimeQuestion(question(), {rule:RULES_2027.uceed}).key, { kind: "mcq", correct: ["A"], sourceExternalKey: "fixture-q1" });
  assert.equal(runtimeQuestion(question({ visualDependency: true, assets: [{ path: "missing.png" }] }),{rule:RULES_2027.uceed}), null);
  assert.equal(runtimeQuestion(question({ answer: { raw: "Z", status: "official-key" } }),{rule:RULES_2027.uceed}), null);
});

test("canonical import never overwrites a separately materialized runtime", async () => {
  const calls = [];
  const origin = "http://127.0.0.1:54321";
  const receipt = "10000000-0000-4000-8000-000000000001";
  const fetchImpl = async (url, request) => {
    const name = new URL(url).pathname.split("/").at(-1);
    calls.push([name, JSON.parse(request.body)]);
    if (name === "admin_operational_health") return Response.json({ scope: "paid-mvp-v1", monitorVersion: 1, apiProfileReady: true });
    if (name === "begin_question_bank_import") return Response.json(receipt);
    if (name === "finish_question_bank_import") return new Response(null, { status: 204 });
    return Response.json(1);
  };
  const config = { url: origin, allowOrigin: origin, environment: "development", serviceRoleKey: "sb_secret_fictional_only" };
  const result = await applyManifest(buildManifest(bank([question()])), config, fetchImpl);
  assert.equal(result, receipt);
  assert.deepEqual(calls.map(([name]) => name), ["admin_operational_health", "begin_question_bank_import", "import_question_bank_batch", "finish_question_bank_import"]);
  assert.deepEqual(calls[0][1], {});
  assert.equal(calls[2][1].p_records[0].runtime, null);
});
