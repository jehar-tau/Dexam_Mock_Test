import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { prepareDrawingImage } from "../../supabase/functions/_shared/drawing-image.mjs";
import { emptyAdminRead, portalFixtureURL, seedPortalSession, stubPortalProvider as stubProvider } from "./portal-fixture.js";

test.use({ baseURL: portalFixtureURL });

const accountId = "00000000-0000-4000-8000-000000000092";
const reviewerId = "00000000-0000-4000-8000-000000000093";
const drawingId = "40000000-0000-4000-8000-000000000001";
const denied = { code: "42501", message: "Drawing reviewer access required" };

const seedSession = (page) => seedPortalSession(page, { id: accountId, email: "drawing-fixture@example.invalid" });

const availableDrawing = {
  reviewId: drawingId, version: 0, prompt: "Sketch an original station sign.",
  uploadCount: 1, status: "pending", canClaim: true, canReview: false, assignedToMe: false, maxScore: 20,
};
const secondDrawing = {
  ...availableDrawing, reviewId: "40000000-0000-4000-8000-000000000002", prompt: "Sketch a folding lamp.",
};

test("anonymous teacher images preserve browser orientation and every displayed pixel after metadata removal", async ({ page }) => {
  const originals = [], images = [];
  for (const [index, ext, mime] of [[1, "png", "image/png"], [2, "jpg", "image/jpeg"], [3, "webp", "image/webp"]]) {
    const bytes = await readFile(new URL(`../fixtures/drawing-images/fictional-drawing.${ext}`, import.meta.url));
    const sanitized = await prepareDrawingImage(bytes, mime);
    originals.push(`data:${mime};base64,${bytes.toString("base64")}`);
    images.push({ id: "fictional-raster-" + index, ordinal: index, url: `data:${mime};base64,${Buffer.from(sanitized.bytes).toString("base64")}` });
  }
  const { unexpected } = await stubProvider(page, (procedure, input) => {
    if (procedure === "can_review_drawings") return true;
    if (procedure === "my_drawing_review_page") return { items: input.p_scope === "mine" ? [{
      ...availableDrawing, version: 1, status: "assigned", canClaim: false, canReview: true, assignedToMe: true, uploadCount: 3,
    }] : [], nextCursor: null };
    if (procedure === "drawing-review-media") return { images };
  });
  await page.goto("/account"); await seedSession(page); await page.goto("/review/drawings");
  await page.getByRole("button", { name: "My reviews", exact: true }).click();
  await page.getByRole("button", { name: "Open private images" }).press("Enter");
  await expect(page.getByRole("img", { name: /Anonymous drawing page/ })).toHaveCount(3);
  const comparisons = await page.evaluate(async originals => {
    const pixels = image => {
      const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d"); context.drawImage(image, 0, 0); return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    return Promise.all([...document.querySelectorAll(".drawing-review-media img")].map(async (image, index) => {
      const original = new Image(); original.src = originals[index]; await original.decode(); await image.decode();
      const before = pixels(original), after = pixels(image);
      return { width: image.naturalWidth, height: image.naturalHeight, same: original.naturalWidth === image.naturalWidth &&
        original.naturalHeight === image.naturalHeight && before.length === after.length && before.every((value, at) => value === after[at]) };
    }));
  }, originals);
  expect(comparisons.every(result => result.same && result.width * result.height === 24)).toBe(true);
  expect(comparisons.slice(0, 2)).toEqual(Array.from({ length: 2 }, () => ({ width: 4, height: 6, same: true })));
  // The current browser ignores WebP EXIF in both original and filtered files.
  // Preserve that native rendering here; Exif-aware orientation is checked independently.
  expect(unexpected).toEqual([]);
});

test("an authenticated reviewer can page, claim, grade and finalize anonymous work", async ({ page }) => {
  let drawing = availableDrawing;
  let enabled = true;
  const { calls, unexpected } = await stubProvider(page, (procedure, input) => {
    switch (procedure) {
      case "my_privacy_requests": return [];
      case "can_review_drawings": return enabled;
      case "is_dmocks_admin": return false;
      case "my_drawing_review_page":
        if (!enabled) return denied;
        if (input.p_scope === "mine") return { items: drawing.canReview ? [drawing] : [], nextCursor: null };
        return input.p_after
          ? { items: [secondDrawing], nextCursor: null }
          : { items: drawing.canClaim ? [drawing] : [], nextCursor: drawingId };
      case "admin_claim_drawing_review":
        drawing = { ...drawing, status: "assigned", version: 1, canClaim: false, canReview: true, assignedToMe: true,
          aiSuggestion: { provider: "Fictional provider", model: "Synthetic model", rubricVersion: "fixture-v1",
            proposedScore: 11.5, confidence: 0.8, criteria: { Clarity: 11.5, Contrast: 0 },
            comments: "Synthetic advisory for review.", evidence: ["Contrast could be stronger"] } };
        return null;
      case "drawing-review-media":
        return { images: [{ id: "fixture-page", ordinal: 1,
          url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='40'%3E%3Crect width='50' height='40' fill='%23305944'/%3E%3C/svg%3E" }] };
      case "admin_review_drawing":
        drawing = { ...drawing, status: "reviewed", version: 2,
          criteria: input.p_criterion_marks, comments: input.p_comments, score: input.p_score };
        return null;
      case "admin_release_drawing_review":
        drawing = { ...drawing, status: "released", canReview: false, version: 3 };
        return null;
      default: return undefined;
    }
  });
  await page.goto("/account");
  await seedSession(page);
  await page.reload();
  await page.getByRole("link", { name: "Review drawings" }).click();
  await expect(page).toHaveURL(/\/review\/drawings$/);
  await expect(page.getByRole("heading", { name: "Drawing reviews." })).toBeVisible();
  await expect(page.getByText(availableDrawing.prompt)).toBeVisible();
  await expect(page.getByRole("button", { name: "Open private images" })).toHaveCount(0);
  await expect(page.getByLabel("AI review advisory")).toHaveCount(0);
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  const accessibilityViolations = () => page.evaluate(async () => {
    const result = await window.axe.run(".admin-page", {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }));
  });
  expect(await accessibilityViolations()).toEqual([]);
  await page.getByRole("button", { name: "Next page" }).press("Enter");
  await expect(page.getByText(secondDrawing.prompt)).toBeVisible();
  await expect(page.getByText(availableDrawing.prompt)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
  await page.getByRole("button", { name: "Previous page" }).press("Enter");
  await page.getByRole("button", { name: "Claim anonymous review" }).press("Enter");
  await expect(page.getByRole("button", { name: "My reviews" })).toHaveAttribute("aria-pressed", "true");
  const advisory = page.getByLabel("AI review advisory");
  const marks = advisory.getByLabel("Suggested criterion marks");
  await expect(marks.locator("dt")).toHaveText(["Clarity", "Contrast"]);
  await expect(marks.locator("dd")).toHaveText(["11.5", "0"]);
  await expect(page.getByLabel("Mark 1", { exact: true })).toHaveValue("");
  await page.setViewportSize({ width: 320, height: page.viewportSize().height });
  expect(await accessibilityViolations()).toEqual([]);
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.getByRole("button", { name: "My reviews", exact: true })).toHaveCSS("background-color", "rgb(220, 235, 161)");
  expect(await accessibilityViolations()).toEqual([]);
  await page.getByRole("button", { name: "Open private images" }).click();
  await expect(page.getByRole("img", { name: "Anonymous drawing page 1" })).toBeVisible();
  await page.getByLabel("Criterion 1", { exact: true }).fill("Clarity");
  await page.getByLabel("Mark 1", { exact: true }).fill("16");
  await page.getByLabel("Feedback").fill("The direction is legible from a distance.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await page.getByRole("button", { name: "Save human review" }).click();
  await page.getByRole("button", { name: "Release feedback to student" }).click();
  await expect(page.getByText("Grade finalized.")).toBeVisible();
  await expect(page.getByText("No drawing submissions await review.")).toBeVisible();
  await expect(advisory).toHaveCount(0);
  expect(calls).toContainEqual(["my_drawing_review_page", { p_scope: "available", p_after: drawingId }]);
  expect(calls).toContainEqual(["admin_claim_drawing_review", { p_review_id: drawingId }]);
  expect(calls).toContainEqual(["drawing-review-media", { reviewId: drawingId }]);
  expect(calls).toContainEqual(["admin_review_drawing", { p_review_id: drawingId, p_expected_version: 1,
    p_criterion_marks: { Clarity: 16 }, p_comments: "The direction is legible from a distance.", p_score: 16, p_override_reason: null }]);
  expect(calls).toContainEqual(["admin_release_drawing_review", { p_review_id: drawingId, p_expected_version: 2 }]);

  await page.goto("/admin");
  await expect(page.getByText("This account is not an administrator.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Drawing reviewer access" })).toHaveCount(0);
  await page.goto("/review/drawings");
  await expect(page.getByRole("button", { name: "Refresh drawing reviews" })).toBeVisible();
  enabled = false;
  await page.getByRole("button", { name: "Refresh drawing reviews" }).click();
  await expect(page.getByText("Drawing reviewer access has ended. Private reviews were cleared.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Drawing review queue" })).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

test("an assigned teacher grades the fixed practice criteria and individual limits", async ({ page }) => {
  const rubric = [
    { label: "Visual communication", points: 8.25, guidance: "Credit the legibility of the intended direction and sign hierarchy." },
    { label: "Task fit and evidence", points: 11.75, guidance: "Credit the observable links between the design and the original task brief." },
  ];
  let drawing = availableDrawing;
  const { calls, unexpected } = await stubProvider(page, (procedure, input) => {
    switch (procedure) {
      case "can_review_drawings": return true;
      case "my_drawing_review_page":
        return { items: (input.p_scope === "available" && drawing.canClaim || input.p_scope === "mine" && drawing.canReview) ? [drawing] : [], nextCursor: null };
      case "admin_claim_drawing_review":
        drawing = { ...drawing, rubric, version: 1, status: "assigned", canClaim: false, canReview: true, assignedToMe: true,
          aiSuggestion: { provider: "Fictional model provider", model: "Fixture model", rubricVersion: "fixture-v1",
            proposedScore: 10, confidence: 0.7, criteria: { "Visual communication": 7, "Task fit and evidence": 3 },
            comments: "Original fictional suggestion.", evidence: [] } };
        return null;
      case "admin_review_drawing":
        drawing = { ...drawing, version: 2, status: "reviewed", criteria: input.p_criterion_marks, score: input.p_score, comments: input.p_comments };
        return null;
      case "admin_release_drawing_review":
        drawing = { ...drawing, version: 3, status: "released", canReview: false };
        return null;
      default: return undefined;
    }
  });
  await page.goto("/account");
  await seedSession(page);
  await page.goto("/review/drawings");
  await expect(page.getByText(availableDrawing.prompt)).toBeVisible();
  await expect(page.getByRole("group", { name: "Frozen practice rubric" })).toHaveCount(0);
  await page.getByRole("button", { name: "Claim anonymous review" }).press("Enter");
  const rubricGroup = page.getByRole("group", { name: "Frozen practice rubric" });
  await expect(rubricGroup).toBeVisible();
  await expect(rubricGroup.getByText(rubric[0].guidance, { exact: true })).toBeVisible();
  const first = rubricGroup.getByRole("spinbutton", { name: "Mark for Visual communication" });
  const second = rubricGroup.getByRole("spinbutton", { name: "Mark for Task fit and evidence" });
  await expect(first).toHaveValue("");
  await expect(second).toHaveValue("");
  await expect(first).toHaveAttribute("max", "8.25");
  await expect(second).toHaveAttribute("max", "11.75");
  await expect(rubricGroup.getByRole("button", { name: "Add criterion" })).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 760 });
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  const accessibilityViolations = () => page.evaluate(async () => {
    const result = await window.axe.run(".drawing-review-form", {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }));
  });
  expect(await accessibilityViolations()).toEqual([]);
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.getByRole("button", { name: "My reviews", exact: true })).toHaveCSS("background-color", "rgb(220, 235, 161)");
  expect(await accessibilityViolations()).toEqual([]);
  await first.fill("8.26");
  await second.fill("0");
  await rubricGroup.getByLabel("Feedback").fill("The primary hierarchy reads clearly.");
  await rubricGroup.getByRole("button", { name: "Save human review" }).click();
  expect(await first.evaluate(input => input.validity.rangeOverflow)).toBe(true);
  expect(calls.filter(([name]) => name === "admin_review_drawing")).toHaveLength(0);
  await first.fill("7.25");
  await expect(rubricGroup.getByLabel("Total marks")).toHaveText("7.25 / 20");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await rubricGroup.getByRole("button", { name: "Save human review" }).press("Enter");
  const release = page.getByRole("button", { name: "Release feedback to student" });
  await expect(release).toBeVisible();
  expect(calls).toContainEqual(["admin_review_drawing", {
    p_review_id: drawingId, p_expected_version: 1, p_score: 7.25, p_comments: "The primary hierarchy reads clearly.",
    p_criterion_marks: { "Visual communication": 7.25, "Task fit and evidence": 0 }, p_override_reason: null,
  }]);
  await release.press("Enter");
  await expect(page.getByText("Grade finalized.")).toBeVisible();
  expect(unexpected).toEqual([]);
});

test("signed-out visitors and students cannot open the teacher queue", async ({ page }) => {
  const { calls, unexpected } = await stubProvider(page, (procedure) => {
    if (procedure === "can_review_drawings") return false;
    if (procedure === "my_privacy_requests") return [];
    if (procedure === "my_drawing_review_page") return denied;
  });
  await page.goto("/review/drawings");
  await expect(page.getByRole("link", { name: "sign in", exact: true })).toHaveAttribute("href", "/account");
  expect(calls).toEqual([]);
  await seedSession(page);
  await page.goto("/account");
  await expect(page.getByText("Signed in as drawing-fixture@example.invalid")).toBeVisible();
  await expect.poll(() => calls.some(([name]) => name === "can_review_drawings")).toBe(true);
  await expect(page.getByRole("link", { name: "Review drawings" })).toHaveCount(0);
  await page.goto("/review/drawings");
  await expect(page.getByText("Drawing reviewer access required.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim anonymous review" })).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

test("an administrator grants and revokes an existing account's reviewer access", async ({ page }) => {
  let roster = [];
  let returned = false;
  const { calls, unexpected } = await stubProvider(page, (procedure, input) => {
    switch (procedure) {
      case "is_dmocks_admin": return true;
      case "admin_drawing_queue": return returned ? [availableDrawing] : [];
      case "admin_drawing_reviewers": return roster;
      case "admin_set_drawing_reviewer":
        roster = input.p_enabled ? [{ userId: input.p_user_id }] : [];
        returned = !input.p_enabled;
        return true;
      default: return emptyAdminRead(procedure);
    }
  });
  await page.goto("/admin");
  await seedSession(page);
  await page.reload();
  const region = page.getByRole("region", { name: "Drawing reviewer access" });
  await expect(region.getByText("No separate reviewer accounts have access.")).toBeVisible();
  await region.getByLabel("Reviewer account ID").fill(reviewerId);
  await region.getByLabel("Reason for granting access").fill("Completed teacher training.");
  await region.getByRole("button", { name: "Grant review access" }).click();
  await expect(region.getByText("Review access granted.")).toBeVisible();
  await expect(region.getByText(reviewerId)).toBeVisible();
  await region.getByLabel("Reason for revoking access").fill("Reviewer assignment ended.");
  await region.getByRole("button", { name: "Revoke review access" }).click();
  await expect(region.getByText("Review access revoked.")).toBeVisible();
  await expect(region.getByText(reviewerId)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Drawing review queue" }).getByText(availableDrawing.prompt)).toBeVisible();
  expect(calls.filter(([name]) => name === "admin_set_drawing_reviewer")).toEqual([
    ["admin_set_drawing_reviewer", { p_user_id: reviewerId, p_enabled: true, p_reason: "Completed teacher training." }],
    ["admin_set_drawing_reviewer", { p_user_id: reviewerId, p_enabled: false, p_reason: "Reviewer assignment ended." }],
  ]);
  expect(unexpected).toEqual([]);
});
