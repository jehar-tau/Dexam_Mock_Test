import assert from "node:assert/strict";
import test from "node:test";
import { buildManifest, SOURCE_PATH } from "../scripts/question-bank-import.mjs";
import { contentSha256 } from "../scripts/reconcile-bank-state.mjs";
import { reconcileBankTarget } from "../scripts/reconcile-bank-target.mjs";

const sourceCommit = "a".repeat(40);
const canonical = {
  schemaVersion: 1,
  questions: [
    { externalKey: "one", prompt: "Private fixture prompt 1", type: "NAT", provenance: { exam: "uceed" }, holds: [] },
    { externalKey: "two", prompt: "Private fixture prompt 2", type: "NAT", provenance: { exam: "uceed" }, holds: [] },
    { externalKey: "held", prompt: "Private fixture prompt 3", type: "NAT", provenance: { exam: "uceed" }, holds: ["review"] },
  ],
};
const manifest = buildManifest(canonical, sourceCommit);
const record = (question, state, active, inCompletedRun = true) => ({
  externalKey: question.externalKey, contentSha256: contentSha256(question), state, active, inCompletedRun,
});
const completedRun = {
  sourceCommit: "b".repeat(40), sourcePath: SOURCE_PATH, sourceSha256: manifest.sourceSha256,
  schemaVersion: 1, sourceTotal: 3, eligibleTotal: 2, heldTotal: 1, importedCount: 2, itemsTotal: 2,
  completedAt: "2026-11-10T01:00:00Z",
};
const validSnapshot = () => ({
  schemaVersion: 1, latestCompletedRun: { ...completedRun }, importInProgress: false,
  records: [
    record(canonical.questions[0], "review", true),
    record(canonical.questions[1], "quarantined", false),
    { ...record(canonical.questions[2], "retired", false, false), contentSha256: "f".repeat(64) },
  ],
});

test("the target audit accepts exact canonical content at a different code commit and classifies local holds", () => {
  const report = reconcileBankTarget({ canonical, sourceCommit, snapshot: validSnapshot() });
  assert.equal(report.passed, true);
  assert.equal(report.sourceCommit, sourceCommit);
  assert.equal(report.latestCompletedRun.sourceCommit, completedRun.sourceCommit);
  assert.equal(report.latestCompletedRun.sourceSha256, report.sourceSha256);
  assert.deepEqual(report.stateCounts, { ready: 0, review: 1, quarantined: 1, retired: 1 });
  assert.equal(report.cloudboardTotal, null);
  assert.doesNotMatch(JSON.stringify(report), /Private fixture prompt/);
});

test("the target audit reports manifest drift and an in-progress import separately", () => {
  const snapshot = validSnapshot();
  snapshot.latestCompletedRun = { ...completedRun, sourceSha256: "e".repeat(64), itemsTotal: 3 };
  snapshot.importInProgress = true;
  const report = reconcileBankTarget({ canonical, sourceCommit, snapshot });
  assert.equal(report.passed, false);
  assert.deepEqual(report.importIssues, ["import-in-progress", "completed-source-mismatch", "completed-counts-mismatch"]);
  assert.ok(Object.values(report.issueCounts).every(count => count === 0));
});

test("the target audit fails an exact row outside the completed run and any active held source row", () => {
  const snapshot = validSnapshot();
  snapshot.records[0].inCompletedRun = false;
  snapshot.records[1].state = "retired";
  snapshot.records[2] = record(canonical.questions[2], "review", true, false);
  const report = reconcileBankTarget({ canonical, sourceCommit, snapshot });
  assert.equal(report.passed, false);
  assert.deepEqual(report.issues.missing, ["two"]);
  assert.deepEqual(report.issues.outsideCompletedImport, ["one"]);
  assert.deepEqual(report.issues.outsideCanonicalActive, ["held"]);
  assert.deepEqual(report.issues.unsafeReady, []);
});

test("the target audit requires a completed import even when the rows match", () => {
  const snapshot = { ...validSnapshot(), latestCompletedRun: null };
  const report = reconcileBankTarget({ canonical, sourceCommit, snapshot });
  assert.equal(report.passed, false);
  assert.deepEqual(report.importIssues, ["no-completed-import"]);
  assert.throws(() => reconcileBankTarget({
    canonical, sourceCommit, snapshot: { ...snapshot, importInProgress: null },
  }), /Invalid DMocks bank target snapshot/);
});
