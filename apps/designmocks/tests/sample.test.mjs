import test from "node:test";
import assert from "node:assert/strict";
import {
  sampleQuestions,
  sampleReport,
  restoreSample,
} from "../src/sample.mjs";
test("sample feedback distinguishes correct, incorrect and unanswered items", () => {
  const allCorrect = Object.fromEntries(
    sampleQuestions.map((q) => [q.id, q.answer]),
  );
  assert.equal(sampleReport(allCorrect).correct, 5);
  assert.deepEqual(sampleReport(allCorrect).focus, []);
  const partial = {
    [sampleQuestions[0].id]: sampleQuestions[0].answer,
    [sampleQuestions[1].id]: 0,
  };
  const report = sampleReport(partial);
  assert.equal(report.correct, 1);
  assert.equal(report.answered, 2);
  assert.equal(report.focus.length, 3);
  assert.equal(sampleReport().answered, 0);
  assert.equal(sampleReport().correct, 0);
  assert.equal(sampleReport({ rotation: "2" }).correct, 0);
});
test("every sample item provides a concrete exercise and an explanation", () => {
  assert.equal(new Set(sampleQuestions.map((q) => q.id)).size, 5);
  for (const q of sampleQuestions) {
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3);
    assert.ok(q.practice.length > 40);
    assert.ok(q.explanation.length > 40);
  }
});

test("restores only valid device samples and discards unknown answer ids", () => {
  const state = {
    status: "active",
    startedAt: 1000,
    deadline: 361000,
    answers: { rotation: 2, contrast: "1", unknown: 0 },
    flagged: ["rotation", "rotation", "unknown"],
  };
  const restored = restoreSample(JSON.stringify(state));
  assert.deepEqual(restored.answers, { rotation: 2 });
  assert.deepEqual(restored.flagged, ["rotation"]);
  for (const raw of [
    null,
    "{",
    "[]",
    '"hello"',
    JSON.stringify({ ...state, flagged: null }),
    JSON.stringify({ ...state, deadline: 0 }),
  ])
    assert.equal(restoreSample(raw), null);
});
