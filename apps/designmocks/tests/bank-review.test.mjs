import test from "node:test";
import assert from "node:assert/strict";
import { bankReviewImages, bankSearchInput, deliveryAnswerLabel, initialBankFilters, sourceAnswerLabel } from "../src/bank-review.js";

test("bank searches trim wording, preserve literal wildcard characters and start new filters at page one", () => {
  assert.deepEqual(bankSearchInput({ ...initialBankFilters, exam: "ceed", type: "NAT", topic: " spatial ", search: " 50%_key ", limit: "50" }), {
    p_exam: "ceed", p_type: "NAT", p_status: "pending", p_topic: "spatial", p_search: "50%_key", p_limit: 50, p_offset: 0,
  });
  assert.deepEqual(bankSearchInput(initialBankFilters, 25), {
    p_exam: null, p_type: null, p_status: "pending", p_topic: null, p_search: null, p_limit: 25, p_offset: 25,
  });
});

test("source answers retain pending verification and decimal precision", () => {
  assert.equal(sourceAnswerLabel({ raw: "2.000000000000000001", status: "pending" }), "2.000000000000000001 · pending verification");
  assert.equal(sourceAnswerLabel({ raw: ["A", "C"], status: "human-reviewed" }), "A, C");
  assert.equal(sourceAnswerLabel("B"), "B");
  assert.equal(sourceAnswerLabel(0), "0");
  for (const value of [null, {}, { raw: "  " }]) assert.equal(sourceAnswerLabel(value), "Awaiting verification");
});

test("delivery keys distinguish exact numeric answers, ranges, choices and human marking", () => {
  assert.equal(deliveryAnswerLabel({ kind: "nat", accepted: [{ exact: "2.000000000000000001" }, { range: ["3.01", "3.09"] }] }), "2.000000000000000001 or 3.01 to 3.09");
  assert.equal(deliveryAnswerLabel({ kind: "msq", correct: ["A", "D"] }), "A, D");
  assert.equal(deliveryAnswerLabel({ kind: "drawing" }), "Human review against the task rubric");
  assert.equal(deliveryAnswerLabel({ kind: "nat", accepted: [null] }), "Awaiting verification");
  assert.equal(deliveryAnswerLabel(null), "Awaiting conversion");
});

test("review figures must cover every canonical ordinal exactly once before they can be displayed", () => {
  const expected = [{ ordinal: 1 }, { ordinal: 2 }];
  const images = [{ ordinal: 2, url: "https://fixture.invalid/2" }, { ordinal: 1, url: "https://fixture.invalid/1" }];
  assert.deepEqual(bankReviewImages(images, expected).map(image => image.ordinal), [1, 2]);
  assert.equal(images[0].ordinal, 2);
  for (const result of [null, [], images.slice(0, 1), [images[0], images[0]], [images[0], { ordinal: 3, url: "x" }],
    [images[0], { ordinal: 1, url: "" }], [images[0], null]]) {
    assert.throws(() => bankReviewImages(result, expected), /figures are incomplete/);
  }
  assert.deepEqual(bankReviewImages([], []), []);
});
