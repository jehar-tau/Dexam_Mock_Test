import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { emptyAdminRead, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

// 4788 is a production-shaped build (no post-launch preview) whose release list
// includes "drawing-review"; 4799 is the same shape without that release.
const released = "http://127.0.0.1:4788";
const closed = "http://127.0.0.1:4799";

const adminId = "00000000-0000-4000-8000-000000009301";
const reviewerId = "00000000-0000-4000-8000-000000009302";
const reviewId = "40000000-0000-4000-8000-000000009301";
const pending = {
  reviewId, version: 0, prompt: "Sketch an original fictional bus shelter.",
  uploadCount: 1, status: "pending", canClaim: true, canReview: false, assignedToMe: false, maxScore: 20,
};

test("a released build lets an admin grant review access and a teacher mark and release a drawing", async ({ page }) => {
  const fictionalPage = (await readFile(new URL("../fixtures/drawing-images/fictional-drawing.png", import.meta.url))).toString("base64");
  let actor = adminId, roster = [], drawing = pending;
  const reviewerEnabled = () => roster.some(({ userId }) => userId === reviewerId);
  const { calls, unexpected } = await stubPortalProvider(page, (procedure, input) => {
    switch (procedure) {
      case "is_dmocks_admin": return actor === adminId;
      case "can_review_drawings": return actor === adminId || reviewerEnabled();
      case "my_privacy_requests": return [];
      case "admin_drawing_queue": return [drawing];
      case "admin_drawing_reviewers": return roster;
      case "admin_set_drawing_reviewer":
        roster = input.p_enabled ? [{ userId: input.p_user_id }] : [];
        return true;
      case "my_drawing_review_page":
        if (input.p_scope === "mine") return { items: drawing.assignedToMe && drawing.status !== "released" ? [drawing] : [], nextCursor: null };
        return { items: drawing.canClaim ? [drawing] : [], nextCursor: null };
      case "admin_claim_drawing_review":
        drawing = { ...drawing, status: "assigned", version: 1, canClaim: false, canReview: true, assignedToMe: true };
        return null;
      case "drawing-review-media":
        return { images: [{ id: "fixture-page", ordinal: 1, url: "data:image/png;base64," + fictionalPage }] };
      case "admin_review_drawing":
        drawing = { ...drawing, status: "reviewed", version: 2, criteria: input.p_criterion_marks, comments: input.p_comments, score: input.p_score };
        return null;
      case "admin_release_drawing_review":
        drawing = { ...drawing, status: "released", canReview: false, version: 3 };
        return null;
      default: return emptyAdminRead(procedure);
    }
  });

  await page.goto(`${released}/admin`);
  await seedPortalSession(page, { id: adminId, email: "fictional-release-admin@example.invalid" });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Drawing review queue", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Drawing review queue" }).getByText(pending.prompt)).toBeVisible();
  const access = page.getByRole("region", { name: "Drawing reviewer access" });
  await expect(access.getByText("No separate reviewer accounts have access.")).toBeVisible();
  await access.getByLabel("Reviewer account ID").fill(reviewerId);
  await access.getByLabel("Reason for granting access").fill("Fictional pilot teacher for drawing marks.");
  await access.getByRole("button", { name: "Grant review access" }).click();
  await expect(access.getByText("Review access granted.")).toBeVisible();
  await expect(access.getByText(reviewerId)).toBeVisible();
  // Other post-launch admin tools stay closed in this build.
  for (const name of ["PDF and photo question intake", "Community moderation", "Question review queue"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
  }

  actor = reviewerId;
  await seedPortalSession(page, { id: reviewerId, email: "fictional-release-teacher@example.invalid" });
  await page.goto(`${released}/account`);
  await page.getByRole("link", { name: "Review drawings" }).click();
  await expect(page).toHaveURL(/\/review\/drawings$/);
  await expect(page.getByRole("heading", { name: "Drawing reviews." })).toBeVisible();
  await page.getByRole("button", { name: "Claim anonymous review" }).click();
  await expect(page.getByRole("button", { name: "My reviews" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Open private images" }).click();
  await expect(page.getByRole("img", { name: "Anonymous drawing page 1" })).toBeVisible();
  await page.getByLabel("Criterion 1", { exact: true }).fill("Clarity");
  await page.getByLabel("Mark 1", { exact: true }).fill("14.5");
  await page.getByLabel("Feedback").fill("Clear shelter form; add people for scale.");
  await page.getByRole("button", { name: "Save human review" }).click();
  await expect(page.getByText("Grade and feedback saved.")).toBeVisible();
  await page.getByRole("button", { name: "Release feedback to student" }).click();
  await expect(page.getByText("Grade finalized.")).toBeVisible();

  expect(calls).toContainEqual(["admin_set_drawing_reviewer", { p_user_id: reviewerId, p_enabled: true, p_reason: "Fictional pilot teacher for drawing marks." }]);
  expect(calls).toContainEqual(["admin_claim_drawing_review", { p_review_id: reviewId }]);
  expect(calls).toContainEqual(["admin_review_drawing", { p_review_id: reviewId, p_expected_version: 1,
    p_criterion_marks: { Clarity: 14.5 }, p_comments: "Clear shelter form; add people for scale.", p_score: 14.5, p_override_reason: null }]);
  expect(calls).toContainEqual(["admin_release_drawing_review", { p_review_id: reviewId, p_expected_version: 2 }]);
  expect(unexpected).toEqual([]);
});

test("without the drawing-review release the teacher route and admin tools stay closed", async ({ page }) => {
  const { calls, unexpected } = await stubPortalProvider(page, (procedure) => {
    if (procedure === "is_dmocks_admin") return true;
    if (procedure === "my_privacy_requests") return [];
    return emptyAdminRead(procedure);
  });
  await page.goto(`${closed}/review/drawings`);
  await seedPortalSession(page, { id: adminId, email: "fictional-release-admin@example.invalid" });
  await page.goto(`${closed}/review/drawings`);
  await expect(page.getByText("COMING LATER", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Drawing review." })).toBeVisible();
  await page.goto(`${closed}/account`);
  await expect(page.getByText("Signed in as fictional-release-admin@example.invalid")).toBeVisible();
  await expect(page.getByRole("link", { name: "Review drawings" })).toHaveCount(0);
  await page.goto(`${closed}/admin`);
  await expect(page.getByRole("heading", { name: "Operational health", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Drawing review queue", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Drawing reviewer access" })).toHaveCount(0);
  const drawingCalls = calls.filter(([name]) => /drawing/.test(name));
  expect(drawingCalls).toEqual([]);
  expect(unexpected).toEqual([]);
});
