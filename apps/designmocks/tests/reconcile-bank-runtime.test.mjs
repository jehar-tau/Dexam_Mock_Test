import assert from "node:assert/strict";
import test from "node:test";
import { reconcileBankRuntime } from "../scripts/reconcile-bank-runtime.mjs";

const hash = "a".repeat(64);
const changedHash = "b".repeat(64);
const makeRecord = (externalKey, exam = "uceed") => ({ externalKey, exam });
const makeEvidence = (externalKey, runtimeSha256, objectiveReady, exam = "uceed", authoredStatus = null) => ({
  externalKey, exam, runtimeSha256, objectiveReady, authoredStatus,
});

test("runtime audit distinguishes missing, unexpected and changed payloads and flags", () => {
  const records = ["match", "flag", "missing", "unexpected", "changed", "unavailable", "omitted", "held"]
    .map(key => makeRecord(key));
  const target = records.map(row => ({ ...row, active: true, state: row.externalKey === "held" ? "quarantined" : "review" }));
  const expected = new Map(records.map(({ externalKey }) => {
    const available = !["unexpected", "unavailable"].includes(externalKey);
    return [externalKey, { sha256: available ? hash : null, objectiveReady: available }];
  }));
  const audit = reconcileBankRuntime({ records }, target, expected, [
    makeEvidence("match", hash, true),
    makeEvidence("flag", hash, false),
    makeEvidence("missing", null, false),
    makeEvidence("unexpected", hash, true),
    makeEvidence("changed", changedHash, true),
    makeEvidence("unavailable", null, false),
  ]);
  assert.equal(audit.passed, false);
  assert.deepEqual(audit.counts, { matched: 1, unavailable: 1, unbound: 0 });
  assert.deepEqual(audit.issues, {
    missingEvidence: ["omitted"], missing: ["missing"], unexpected: ["unexpected"], mismatch: ["changed", "flag"],
  });
  assert.doesNotMatch(JSON.stringify(audit), new RegExp(hash));
});

test("NID runtime comparison uses the current authored binding and rejects duplicate evidence", () => {
  const records = ["matched", "unbound", "mismatch"].map(key => makeRecord(key, "nid"));
  const target = records.map(row => ({ ...row, active: true, state: "review" }));
  const evidence = [
    makeEvidence("matched", hash, true, "nid", "matched"),
    makeEvidence("unbound", null, false, "nid", "unbound"),
    makeEvidence("mismatch", changedHash, true, "nid", "mismatch"),
  ];
  const run = rows => reconcileBankRuntime({ records }, target, new Map(), rows);
  const audit = run(evidence);
  assert.deepEqual(audit.counts, { matched: 1, unavailable: 0, unbound: 1 });
  assert.deepEqual(audit.issues.mismatch, ["mismatch"]);
  assert.throws(() => run([...evidence, evidence[0]]), /Invalid DMocks runtime snapshot/);
});
