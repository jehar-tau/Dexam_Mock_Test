import test from "node:test";
import assert from "node:assert/strict";
import { questionReportConfirmation, questionReportFailure, questionReviewInput } from "../src/question-quality.js";

test("report receipts distinguish unique reporters, the threshold and a hold without pausing the student's clock", () => {
  assert.match(questionReportConfirmation({ reportCount: 1, threshold: 5, held: false }), /1 unique student reported this version; the review threshold is 5/);
  assert.match(questionReportConfirmation({ reportCount: 5, threshold: 5, held: true }), /5 unique students.*New attempts are held.*original clock/);
  assert.doesNotMatch(questionReportConfirmation({ reportCount: 7, threshold: 5, held: false }), /held/);
});

test("report retry acknowledges an existing report and rejects incomplete receipts", () => {
  assert.match(questionReportConfirmation({ alreadyReported: true }), /already reported this issue/);
  for (const receipt of [null, {}, { reportCount: 0, threshold: 5, held: false }, { reportCount: 1, threshold: 5 }]) {
    assert.throws(() => questionReportConfirmation(receipt), /Couldn’t confirm/);
  }
});

test("only the known database report errors are classified", () => {
  const duplicate = "You have already reported this issue for this question version";
  const limited = "Too many question reports. Please try again after the hourly window";
  assert.equal(questionReportFailure({ code: "P0001", message: duplicate }), "duplicate");
  assert.equal(questionReportFailure({ code: "P0001", message: limited }), "limited");
  assert.equal(questionReportFailure({ code: "42501", message: duplicate }), null);
  assert.equal(questionReportFailure({ code: "P0001", message: "Private database detail" }), null);
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
