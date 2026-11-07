import test from "node:test";
import assert from "node:assert/strict";
import { downloadAccountExport, validateAccountExport } from "../src/account-export.js";

const owner = "fictional-export-owner";
const pending = () => ({ schemaVersion: 2, exportedAt: "2026-11-07T07:00:00Z", accountId: owner, profile: { user_id: owner },
  attempts: [{ id: "held-attempt", status: "submitted", resultsPending: true, score: null, total: null,
    responses: [{ questionId: "question", ordinal: 1, topic: "observation", kind: "mcq", answer: "B" }] }],
  questionReports: [{ id: "report", attemptId: "held-attempt", questionId: "question", reason: "incorrect", details: "My own report text.", createdAt: "2026-11-07T06:30:00Z" }],
  results: { examMocks: [{ sessionId: "session", partAAttemptId: "held-attempt", partBAttemptId: null, resultsPending: true, objectiveScore: null, objectiveTotal: null,
    drawingScore: null, drawingTotal: null, combinedScore: null, combinedTotal: null }], allIndia: [], drawingReviews: [] } });

test("an owned export retains the student's answers and report text while marks remain held", () => {
  const data = pending();
  assert.equal(validateAccountExport(data, owner), data);
  assert.equal(data.attempts[0].responses[0].answer, "B");
  assert.equal(data.questionReports[0].details, "My own report text.");
  data.attempts[0] = { ...data.attempts[0], resultsPending: false, score: -0.71, total: 3 };
  data.results.examMocks = [];
  assert.equal(validateAccountExport(data, owner), data);
  data.results.allIndia = [{ attemptId: "held-attempt", score: -0.71, total: 3, releasedAt: "2026-11-07T06:50:00Z" }];
  assert.equal(validateAccountExport(data, owner), data);
});

test("legacy, mis-scoped, held-score and private-review responses cannot create an export file", () => {
  const variants = [
    data => { data.schemaVersion = 1; }, data => { data.accountId = "other"; }, data => { data.profile.user_id = "other"; },
    data => { data.attempts[0].score = 3; }, data => { data.attempts[0].total = 3; },
    data => { data.attempts[0].responses[0].correctKey = { correct: ["B"] }; },
    data => { data.questionReports[0].targetKey = "answer-dependent-review-identifier"; },
    data => { data.questionReports[0].contentVersion = "private-hash"; },
    data => { data.results.examMocks[0].drawingScore = 45; },
    data => { data.results.allIndia.push({ score: 75, releasedAt: null }); },
    data => { data.results.allIndia.push({ attemptId: "held-attempt", score: 75, total: 100, releasedAt: "2026-11-07T06:50:00Z" }); },
    data => { data.results.allIndia.push({ attemptId: "unknown-attempt", score: 75, total: 100, releasedAt: "2026-11-07T06:50:00Z" }); },
    data => { data.results.examMocks[0].partAAttemptId = "unknown-attempt"; },
    data => { data.results.drawingReviews.push({ score: 40, releasedAt: "invalid" }); },
    data => { data.results.drawingReviews.push({ attemptId: "held-attempt", questionId: "question", score: 40, maxScore: 50, releasedAt: "2026-11-07T06:50:00Z" }); },
    data => { data.internalReview = {}; },
  ];
  for (const mutate of variants) {
    const data = pending();mutate(data);
    let created = false;
    assert.throws(() => downloadAccountExport(data, owner, {}, { createObjectURL() { created = true; } }), /could not be verified/);
    assert.equal(created, false);
  }
  const active = pending();active.attempts[0] = { ...active.attempts[0], status: "active", resultsPending: false, score: 0 };
  assert.throws(() => validateAccountExport(active, owner), /could not be verified/);
});

test("released Part B export marks agree with the combined report and frozen total", () => {
  const data = pending();
  data.attempts[0] = { ...data.attempts[0], resultsPending: false, score: 4, total: 200 };
  data.attempts.push({ id: "drawing-part", status: "submitted", resultsPending: false, score: 85, total: 100,
    responses: [{ questionId: "drawing-one", ordinal: 1, kind: "drawing", answer: null }] });
  data.results.examMocks[0] = { ...data.results.examMocks[0], partBAttemptId: "drawing-part", resultsPending: false,
    objectiveScore: 4, objectiveTotal: 200, drawingScore: 85, drawingTotal: 100, combinedScore: 89, combinedTotal: 300 };
  assert.equal(validateAccountExport(data, owner), data);
  for (const mutate of [
    value => { value.attempts[1].total = 0; }, value => { value.attempts[1].total = -1; },
    value => { value.attempts[1].score = 0; }, value => { value.results.examMocks[0].drawingTotal = 0; },
    value => { value.results.examMocks[0].objectiveScore = 5; }, value => { value.attempts[1].resultsPending = true; },
  ]) {
    const invalid = structuredClone(data);mutate(invalid);
    let created = false;
    assert.throws(() => downloadAccountExport(invalid, owner, {}, { createObjectURL() { created = true; } }), /could not be verified/);
    assert.equal(created, false);
  }
});

test("downloads preserve the verified JSON, use a private blob URL and revoke it after success or failure", async () => {
  for (const fail of [false, true]) {
    const data = pending();let blob, clicked = false;const revoked = [];
    const anchor = { click() { clicked = true;if (fail) throw new Error("Fictional download failure"); } };
    const documentRef = { createElement(tag) { assert.equal(tag, "a");return anchor; } };
    const urlApi = { createObjectURL(value) { blob = value;return "blob:fixture-private"; }, revokeObjectURL(value) { revoked.push(value); } };
    if (fail) assert.throws(() => downloadAccountExport(data, owner, documentRef, urlApi), /Fictional download failure/);
    else downloadAccountExport(data, owner, documentRef, urlApi);
    assert.equal(clicked, true);
    assert.equal(anchor.href, "blob:fixture-private");
    assert.match(anchor.download, /^dmocks-account-export-\d{4}-\d{2}-\d{2}\.json$/);
    assert.equal(blob.type, "application/json");
    assert.deepEqual(JSON.parse(await blob.text()), data);
    assert.deepEqual(revoked, ["blob:fixture-private"]);
  }
});
