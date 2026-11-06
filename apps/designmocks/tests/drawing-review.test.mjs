import test from "node:test";
import assert from "node:assert/strict";
import { validateDrawingReviewInput } from "../src/drawing-review.js";
import { rasterMimeType } from "../supabase/functions/_shared/raster.mjs";

const review = (rows, extra) => validateDrawingReviewInput({ rows, comments: " Clear visual hierarchy. ", maxScore: 20, ...extra });
const criterion = (name, mark) => ({ name, mark });

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
