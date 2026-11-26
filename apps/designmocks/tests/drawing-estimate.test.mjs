import test from "node:test";
import assert from "node:assert/strict";
import { drawingEstimateView, formatMarks, graceClock } from "../src/drawing-estimate.mjs";

const criteria = [{ id: "idea", label: "Idea", max: 5 }, { id: "sketch", label: "Sketching", max: 5 }];

test("a ready estimate clamps each criterion, steps by half marks and totals on the client's own criteria", () => {
  const view = drawingEstimateView({ status: "ready", summary: "Good.", criteria: [
    { id: "idea", score: 7, reason: "Over the max" }, { id: "sketch", score: 2.3, reason: 3 }, { id: "ghost", score: 5 },
  ], flags: ["illegible", "made_up", "illegible"], total: 99 }, criteria);
  assert.equal(view.status, "ready");
  assert.deepEqual(view.criteria.map(row => [row.id, row.score, row.max, row.reason]), [["idea", 5, 5, "Over the max"], ["sketch", 2.5, 5, ""]]);
  assert.equal(view.total, 7.5);
  assert.equal(view.max, 10);
  assert.deepEqual(view.flags, ["illegible"]);
  assert.equal(view.zeroed, false);
});

test("blank, not-a-drawing and off-task flags set the total to zero", () => {
  for (const flag of ["blank", "not_a_drawing", "off_task"]) {
    const view = drawingEstimateView({ status: "ready", criteria: [{ id: "idea", score: 4 }], flags: [flag] }, criteria);
    assert.equal(view.total, 0, flag);
    assert.equal(view.zeroed, true);
  }
});

test("missing, negative and non-numeric scores show as zero", () => {
  const view = drawingEstimateView({ status: "ready", criteria: [{ id: "idea", score: -2 }, { id: "sketch", score: "4" }] }, criteria);
  assert.deepEqual(view.criteria.map(row => row.score), [0, 0]);
});

test("waiting, unavailable, not attempted and unknown states carry no marks except the zero for no photo", () => {
  assert.equal(drawingEstimateView(undefined, criteria), null);
  assert.equal(drawingEstimateView({ status: "evaluating" }, criteria).total, null);
  assert.equal(drawingEstimateView({ status: "unavailable", canReevaluate: true }, criteria).canReevaluate, true);
  assert.deepEqual(drawingEstimateView({ status: "not_attempted" }, criteria), { status: "not_attempted", total: 0, max: 10, criteria: [], flags: [], summary: "" });
  assert.equal(drawingEstimateView({ status: "graded-by-magic" }, criteria).status, "unavailable");
});

test("a staff override is clamped and shown beside the AI total", () => {
  const view = drawingEstimateView({ status: "ready", criteria: [{ id: "idea", score: 3 }], override: { score: 12.2, note: "Raised." } }, criteria);
  assert.deepEqual(view.override, { score: 10, note: "Raised." });
  assert.equal(view.total, 3);
});

test("marks and the grace clock format for students", () => {
  assert.equal(formatMarks(14), "14");
  assert.equal(formatMarks(13.5), "13.5");
  assert.equal(graceClock(582), "9:42");
  assert.equal(graceClock(59.2), "1:00");
  assert.equal(graceClock(-3), "0:00");
});
