import assert from "node:assert/strict";
import test from "node:test";
import {drawingPageReceipt, planDrawingPages} from "../src/drawing-upload.js";

test("a batch keeps the selected order while filling only available drawing positions", () => {
  const files = ["first", "second", "third"];
  assert.deepEqual(planDrawingPages(files, [{ordinal: 2}, {ordinal: 4}]).pages, [
    {file: "first", ordinal: 1}, {file: "second", ordinal: 3}, {file: "third", ordinal: 5},
  ]);
});

test("an oversized batch returns no upload plan", () => {
  assert.deepEqual(planDrawingPages(["first", "excess"], [1, 2, 3, 4].map(ordinal => ({ordinal}))), {
    error: "Only one image slot is available. Select one image.",
  });
  assert.deepEqual(planDrawingPages(Array(6).fill("file"), []), {
    error: "Only 5 image slots are available. Select fewer images.",
  });
});

test("only a confirmed ID and exact position acknowledge a drawing upload", () => {
  assert.equal(drawingPageReceipt({id: "saved", ordinal: 2}, 2), "saved");
  for (const receipt of [null, {ordinal: 2}, {id: "saved", ordinal: 1}]) {
    assert.throws(() => drawingPageReceipt(receipt, 2), /Unconfirmed/);
  }
});
