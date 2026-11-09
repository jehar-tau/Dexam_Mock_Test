import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { verifyQuestionExportPacket } from "../src/question-export-packet.mjs";

const payload = { externalKey: "original-nid-practice-one", holds: [], prompt: "Sketch a wayfinding sign for पुणे.",
  type: "DESCRIPTIVE", provenance: { exam: "nid" } };
const makePacket = (payloadText = JSON.stringify(payload)) => ({
  format: "dmocks-question-export-v1", artifactId: "10000000-0000-4000-8000-000000000159",
  externalKey: payload.externalKey, contentSha256: createHash("sha256").update(payloadText).digest("hex"),
  payloadText, sourceType: "photo", rightsNote: "Fictional original example for review.",
  createdAt: "2026-11-10T00:00:00+00:00", publicationState: "git-review-required",
});

test("preserves the exact reviewed UTF-8 bytes and only the packet's intended fields", async () => {
  const exact = JSON.stringify({ ...payload, numericMetadata: 1 }, null, 2).replace(/"numericMetadata": 1/, '"numericMetadata": 1.00');
  const expected = makePacket(exact);
  const value = await verifyQuestionExportPacket({ ...expected, storagePath: "private/never-save-this" }, {
    artifactId: expected.artifactId, externalKey: expected.externalKey, contentSha256: expected.contentSha256,
  });
  assert.deepEqual(value.packet, expected);
  assert.deepEqual(value.payload, { ...payload, numericMetadata: 1 });
});

test("rejects tampering, a different approved artifact, and a changed digest", async () => {
  const packet = makePacket();
  for (const change of [{ payloadText: packet.payloadText + " " }, { contentSha256: "0".repeat(64) },
    { publicationState: "released" }, { artifactId: "20000000-0000-4000-8000-000000000159" }]) {
    await assert.rejects(verifyQuestionExportPacket({ ...packet, ...change }, { artifactId: packet.artifactId }), /verify this export packet/);
  }
  await assert.rejects(verifyQuestionExportPacket(packet, { contentSha256: "1".repeat(64) }), /verify this export packet/);
});

test("requires an explicit empty holds list and a canonical key matching the receipt", async () => {
  for (const changed of [{ ...payload, holds: undefined }, { ...payload, holds: ["human-review"] },
    { ...payload, holds: null }, { ...payload, externalKey: "different-original-key" }]) {
    await assert.rejects(verifyQuestionExportPacket(makePacket(JSON.stringify(changed))), /verify this export packet/);
  }
});

test("checks the UTF-8 byte limit before hashing a packet", async () => {
  const oversized = JSON.stringify({ ...payload, prompt: "界".repeat(180000) });
  assert.ok(oversized.length < 512 * 1024);
  await assert.rejects(verifyQuestionExportPacket(makePacket(oversized)), /verify this export packet/);
});
