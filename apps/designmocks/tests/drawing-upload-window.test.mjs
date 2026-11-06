import test from "node:test";
import assert from "node:assert/strict";
import { drawingUploadWindow } from "../src/drawing-upload-window.js";

const time = Date.parse("2026-11-07T13:00:00Z");
const deadline = new Date(time + 600_000).toISOString();

test("an embargoed All India result exposes only its server-provided upload tasks", () => {
  const drawing = { id: "drawing-task", prompt: "Draw an original fixture" };
  const attempt = {
    status: "submitted", resultsPending: true, uploadDeadline: deadline,
    drawingUploadTasks: [drawing], questions: [{ id: "sealed", kind: "drawing" }],
  };
  assert.deepEqual(drawingUploadWindow(attempt, time + 1500), { remainingSeconds: 599, tasks: [drawing] });
  assert.equal(drawingUploadWindow(attempt, time + 600_000), null);
  assert.equal(drawingUploadWindow({ ...attempt, drawingUploadTasks: [] }, time), null);
});

test("ordinary attempts show drawing tasks only in a valid submitted upload window", () => {
  const drawing = { id: "drawing-task", kind: "drawing" };
  const attempt = { status: "submitted", uploadDeadline: deadline, questions: [{ id: "question", kind: "mcq" }, drawing] };
  assert.deepEqual(drawingUploadWindow(attempt, time), { remainingSeconds: 600, tasks: [drawing] });
  assert.equal(drawingUploadWindow({ ...attempt, status: "active" }, time), null);
  assert.equal(drawingUploadWindow({ ...attempt, uploadDeadline: "invalid" }, time), null);
});
