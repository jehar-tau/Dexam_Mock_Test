import test from "node:test";
import assert from "node:assert/strict";
import { drawingAdvisoryMarks, drawingReviewActions, drawingReviewerChange, validateDrawingReviewInput } from "../src/drawing-review.js";
import { rasterMimeType } from "../supabase/functions/_shared/raster.mjs";

const review = (rows, extra) => validateDrawingReviewInput({ rows, comments: " Clear visual hierarchy. ", maxScore: 20, ...extra });
const criterion = (name, mark) => ({ name, mark });

test("drawing advice preserves zero and fractional marks and omits an unavailable breakdown", () => {
  assert.deepEqual(drawingAdvisoryMarks({ Clarity: 8.25, Contrast: 0 }), [["Clarity", 8.25], ["Contrast", 0]]);
  for (const criteria of [undefined, {}, [7], { " ": 4 }, { Clarity: -1 }, { Clarity: "5" },
    { Clarity: Number.POSITIVE_INFINITY }, Object.fromEntries(Array.from({ length: 13 }, (_, index) => [`Criterion ${index}`, 1]))]) {
    assert.deepEqual(drawingAdvisoryMarks(criteria), []);
  }
});

test("drawing review derives an exact two-decimal total from the criteria", () => {
  assert.deepEqual(review([criterion("Composition", " 8.10 "), criterion(" Clarity ", "7.2")]), {
    criteria: { Composition: 8.1, Clarity: 7.2 },
    comments: "Clear visual hierarchy.",
    score: 15.3,
    overrideReason: null,
  });
  assert.equal(review([criterion("Clarity", "0")]).score, 0);
});

test("drawing review rejects an over-limit total and invalid marks or duplicate criteria", () => {
  assert.throws(() => review([criterion("Composition", "14"), criterion("Clarity", "8")]), /cannot exceed 20/);
  for (const mark of ["", "-1", "1.234", "Infinity"]) {
    assert.throws(() => review([criterion("Composition", mark)]), /non-negative mark/);
  }
  assert.throws(() => review([criterion("Clarity", "1"), criterion(" clarity ", "2")]), /different name/);
  assert.throws(() => review(Array.from({ length: 13 }, (_, index) => criterion(`Skill ${index}`, "1"))), /between 1 and 12/);
});

test("drawing review requires feedback and a reason for changing a prior decision", () => {
  const rows = [criterion("Composition", "15")];
  assert.throws(() => review(rows, { comments: "    " }), /Feedback/);
  assert.throws(() => review(rows, { requiresOverride: true, overrideReason: "" }), /override reason/);
  assert.equal(review(rows, { requiresOverride: true, overrideReason: " Second reviewer correction " }).overrideReason,
    "Second reviewer correction");
});

test("drawing upload content must identify as a supported raster image", () => {
  assert.equal(rasterMimeType(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])), "image/png");
  assert.equal(rasterMimeType(Uint8Array.from([255, 216, 255])), "image/jpeg");
  assert.equal(rasterMimeType(Buffer.from("RIFF0000WEBP")), "image/webp");
  assert.equal(rasterMimeType(Buffer.from("<svg></svg>")), null);
  assert.equal(rasterMimeType(Buffer.from("RIFF0000WAVE")), null);
  assert.equal(rasterMimeType(Uint8Array.from([137, 80, 78, 71])), null);
});

test("reviewer and admin actions send the same versioned drawing commands", async () => {
  const calls = [];
  const actions = drawingReviewActions((name, args) => calls.push([name, args]), (name) => calls.push(name));
  await actions.onClaim("drawing");
  await actions.onReturn("drawing", 1);
  await actions.onReview("drawing", 3, { criteria: { Clarity: 6 }, comments: "Clear route.", score: 6, overrideReason: null });
  await actions.onRelease("drawing", 4);
  assert.deepEqual(calls, [
    ["admin_claim_drawing_review", { p_review_id: "drawing" }], "admin_claim_drawing_review",
    ["admin_return_drawing_review", { p_review_id: "drawing", p_expected_version: 1 }], "admin_return_drawing_review",
    ["admin_review_drawing", { p_review_id: "drawing", p_expected_version: 3, p_criterion_marks: { Clarity: 6 },
      p_comments: "Clear route.", p_score: 6, p_override_reason: null }], "admin_review_drawing",
    ["admin_release_drawing_review", { p_review_id: "drawing", p_expected_version: 4 }], "admin_release_drawing_review",
  ]);
  const denied = drawingReviewActions(async () => { throw new Error("Access required"); }, () => assert.fail("Refresh after denied action"));
  await assert.rejects(denied.onClaim("drawing"), /Access required/);
});

test("reviewer role changes require an account ID and a bounded audit reason", () => {
  const userId = "00000000-0000-4000-8000-000000000089";
  const form = new FormData();
  form.set("userId", "candidate@example.invalid");
  assert.throws(() => drawingReviewerChange(form, true), /account ID/);
  form.set("userId", ` ${userId} `);
  for (const reason of ["  no  ", "a".repeat(401)]) {
    form.set("reason", reason);
    assert.throws(() => drawingReviewerChange(form, true), /between 5 and 400/);
  }
  form.set("reason", " End of reviewer assignment. ");
  assert.deepEqual(drawingReviewerChange(form, false), {
    p_user_id: userId, p_enabled: false, p_reason: "End of reviewer assignment.",
  });
});
