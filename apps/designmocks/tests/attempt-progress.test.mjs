import test from "node:test";
import assert from "node:assert/strict";
import { isQuestionAnswered, drawingCountStatus } from "../src/attempt-progress.mjs";

test("a drawing with several saved pages is one answer; removing the last page clears it", () => {
  const item = { id: "task", kind: "drawing" };
  for (const n of [1, 2, 5]) assert.equal(isQuestionAnswered(item, null, { task: n }), true);
  assert.equal(isQuestionAnswered(item, null, { task: 0 }), false);
  assert.equal(isQuestionAnswered(item, "A description", { task: 0 }), true);
  assert.equal(isQuestionAnswered({ ...item, kind: "nat" }, null, { task: 2 }), false);
  assert.equal(isQuestionAnswered({ ...item, kind: "nat" }, 0, {}), true);
});
test("unknown drawing inventories stay distinct from a confirmed zero", () => {
  const questions = [{id:"drawing",kind:"drawing"}, {id:"objective",kind:"nat"}];
  assert.equal(drawingCountStatus(questions, {}), "Checking saved drawing pages…");
  assert.equal(drawingCountStatus(questions, {drawing:null}), "Saved drawing totals are unavailable.");
  assert.equal(drawingCountStatus(questions, {drawing:0}), "");
});
