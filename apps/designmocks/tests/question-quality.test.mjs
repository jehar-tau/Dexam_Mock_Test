import test from "node:test";
import assert from "node:assert/strict";
import { questionReportConfirmation, questionReviewInput } from "../src/question-quality.js";

test("report receipts distinguish unique reporters, the threshold and a hold without pausing the student's clock", () => {
  assert.match(questionReportConfirmation({ reportCount: 1, threshold: 5, held: false }), /1 unique student reported this version; the review threshold is 5/);
  assert.match(questionReportConfirmation({ reportCount: 5, threshold: 5, held: true }), /5 unique students.*New attempts are held.*original clock/);
  assert.doesNotMatch(questionReportConfirmation({ reportCount: 7, threshold: 5, held: false }), /held/);
});

test("human review carries both the delivered-case revision and current canonical-bank version", () => {
  const report = { targetKey: "fixture:version:123", revision: 4, bankVersion: "canonical-current" };
  assert.deepEqual(questionReviewInput(report, "fix", "  Corrected source reviewed.  "), {
    p_target_key: report.targetKey, p_action: "fix", p_note: "Corrected source reviewed.", p_expected_revision: 4, p_expected_bank_version: "canonical-current",
  });
  assert.equal(questionReviewInput({ ...report, bankVersion: null }, "restore", "Original frozen question reviewed.").p_expected_bank_version, null);
  for (const note of ["short", " ".repeat(10), "x".repeat(1001)]) assert.throws(() => questionReviewInput(report, "retire", note), /review reason/);
  assert.throws(() => questionReviewInput(report, undefined, "Reviewed original version."), /Choose a review/);
});
