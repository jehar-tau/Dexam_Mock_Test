import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { intakeFigureDescriptor, intakeReviewPayload, intakeReviewValues } from "../src/intake-review.js";
import { collectCanonicalMedia, verifyAssetBytes } from "../scripts/private-bank-media.mjs";
import { buildManifest, runtimeQuestion } from "../scripts/question-bank-import.mjs";
import { RULES_2027 } from "../scripts/question-runtime.mjs";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4+vEFAAWtAs+P9YeZAAAAAElFTkSuQmCC", "base64");

test("intake review reads raw and legacy canonical options without guessing source facts", () => {
  const raw = intakeReviewValues({ type: "MSQ", options: [{ id: "B", text: "Source option" }], answer: ["B", "D"] });
  assert.deepEqual(raw.options, [{ key: "B", text: "Source option" }]);
  assert.equal(raw.answer, "B, D");
  assert.equal(raw.exam, "");
  assert.equal(raw.visualDependency, "");
  assert.equal(intakeReviewValues({ answer: null }).answer, "");
  const legacy = intakeReviewValues({ options: [{ key: "X", text: "Reviewed option" }], answer: { raw: "X" }, provenance: { exam: "ceed" }, visualDependency: true });
  assert.equal(legacy.exam, "ceed");
  assert.equal(legacy.options[0].key, "X");
  assert.equal(legacy.answer, "X");
  assert.deepEqual(intakeReviewValues({ options: [null, { key: 1, text: {} }] }).options, [{ key: "", text: "" }, { key: "", text: "" }]);
});

test("review payloads retain a mandatory hold, pending answer and exact decimal notation", () => {
  const values = { ...intakeReviewValues(), exam: "uceed", type: "NAT", prompt: "  Count the visible tiles.  ", answer: " -.50 to +.75 ", visualDependency: "false", assets: [{ path: "old.png" }] };
  const held = intakeReviewPayload(values);
  assert.equal(held.prompt, "Count the visible tiles.");
  assert.deepEqual(held.answer, { raw: "-.50 to +.75", status: "pending" });
  assert.deepEqual(held.holds, ["intake-human-review"]);
  assert.deepEqual(held.assets, []);
  assert.deepEqual(held.options, []);
  assert.equal(buildManifest({ schemaVersion: 1, questions: [held] }).eligibleTotal, 0);
  assert.equal(runtimeQuestion({ ...held, holds: [] }, { rule: RULES_2027.uceed }), null);
  const reviewed = { ...held, externalKey: "intake-fixture-nat", holds: [], answer: { raw: held.answer.raw, status: "human-reviewed" } };
  assert.deepEqual(runtimeQuestion(buildManifest({ schemaVersion: 1, questions: [reviewed] }).records[0].payload, { rule: RULES_2027.uceed }).key.accepted, [{ range: ["-.50", "+.75"] }]);
  assert.equal(intakeReviewPayload({ ...values, type: "DESCRIPTIVE" }).answer, null);
});

test("prepared figure bytes and paths match the existing canonical private-media contract", async () => {
  const figure = await intakeFigureDescriptor(png, (...args) => webcrypto.subtle.digest(...args));
  const media = collectCanonicalMedia({ records: [{ payload: { holds: [], assets: [figure] } }] });
  assert.equal(figure.path, `intake/${figure.sha256}.png`);
  assert.equal(figure.width, 1);
  assert.equal(figure.height, 1);
  assert.deepEqual(verifyAssetBytes(media[0], png), png);
  await assert.rejects(() => intakeFigureDescriptor(png.subarray(0, -12)), /complete PNG/);
  const oversized = Buffer.from(png);
  oversized.writeUInt32BE(9000, 16);
  await assert.rejects(() => intakeFigureDescriptor(oversized), /8192 pixels/);
  await assert.rejects(() => intakeFigureDescriptor(Buffer.alloc(45)), /complete PNG/);
});
