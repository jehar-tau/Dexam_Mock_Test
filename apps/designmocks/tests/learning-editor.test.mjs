import test from "node:test";
import assert from "node:assert/strict";
import { learningDraftInput, learningPublicationInput } from "../src/learning-editor.js";

test("draft inputs preserve the saved ID and version and carry no publication flags", () => {
  const form = new FormData();
  const fields = { slug: " Directional-Contrast ", exam: "nid", topic: " visual-hierarchy ", title: " Directional contrast ",
    summary: " Describe the reading order. ", body: " An original example of visual hierarchy. ", ordinal: "4" };
  for (const [field, value] of Object.entries(fields)) form.set(field, value);
  assert.deepEqual(learningDraftInput(form, { id: "lesson", version: 3 }), {
    p_id: "lesson", p_expected_version: 3, p_slug: "directional-contrast", p_exam: "nid", p_topic: "visual-hierarchy",
    p_title: "Directional contrast", p_summary: "Describe the reading order.", p_body: "An original example of visual hierarchy.", p_ordinal: 4,
  });
  assert.equal(learningDraftInput(form).p_id, null);
  assert.equal(learningDraftInput(form).p_expected_version, null);
  for (const slug of ["", "two words", "a--b", "../draft"]) {
    form.set("slug", slug);
    assert.throws(() => learningDraftInput(form), /lesson URL/);
  }
});

test("publishing and withdrawing require an explicit audit reason and current lesson version", () => {
  const lesson = { id: "lesson", version: 4, published: false };
  for (const reason of ["  no  ", "x".repeat(1001)]) {
    assert.throws(() => learningPublicationInput(lesson, reason), /between 5 and 1,000/);
  }
  assert.deepEqual(learningPublicationInput(lesson, "  Original author approved publication.  "), {
    p_id: "lesson", p_expected_version: 4, p_publish: true, p_reason: "Original author approved publication.",
  });
  assert.equal(learningPublicationInput({ ...lesson, published: true }, "Withdraw for review.").p_publish, false);
});
