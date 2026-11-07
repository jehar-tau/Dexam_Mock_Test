import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { emptyAdminRead, portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

test.use({ baseURL: portalFixtureURL });
const editor = { id: "00000000-0000-4000-8000-000000000112", email: "job-recovery@example.invalid" };
const requestId = "50000000-0000-4000-8000-000000000112";
const assetId = "50000000-0000-4000-8000-000000000113";
const heldDraft = { id: "draft-recovery", sourceName: "AI request fictional recovery", status: "pending",
  payload: { prompt: "Recovered fictional question", holds: ["ai-generated-human-review"] } };

test("administrators refresh expired jobs, resolve reference failures and explicitly retry through the real queue", async ({ page }) => {
  let expired = false, rightsCleared = false, requestStatus = "running", assetStatus = "extracting";
  let draft;
  const { calls, unexpected } = await stubPortalProvider(page, (procedure, input) => {
    switch (procedure) {
      case "is_dmocks_admin": return true;
      case "admin_question_drafts": return draft ? [draft] : [];
      case "admin_ai_draft_requests": return [{ id: requestId, exam: "uceed", topic: "observation", questionType: "MCQ",
        basisExternalKeys: ["fictional-approved-reference"], status: requestStatus, attemptCount: draft ? 2 : 1,
        retryAvailable: expired && !draft }];
      case "admin_question_intake_assets": return [{ id: assetId, name: "fictional-expired-source.pdf", mimeType: "application/pdf",
        byteSize: 1234, status: assetStatus, attemptCount: assetStatus === "extracted" ? 2 : 1,
        retryAvailable: expired && assetStatus === "extracting", candidates: [] }];
      case "admin_operational_health": return { status: expired && (!draft || assetStatus === "extracting") ? "degraded" : "healthy",
        checkedAt: "2026-11-07T05:00:00Z", expiredIntakeJobs: Number(expired && assetStatus === "extracting"), expiredAiDraftJobs: Number(expired && !draft) };
      case "ai-question-draft":
        if (input.requestId !== requestId) return { code: "42501", error: "AI draft request unavailable" };
        if (!rightsCleared) return { code: "P0001", error: "A basis question is no longer cleared for AI drafting" };
        requestStatus = "succeeded";
        draft = heldDraft;
        return { requestId, draftId: draft.id, status: requestStatus };
      case "question-intake-extract":
        assetStatus = "extracted";
        return { assetId: input.assetId, questions: 1, status: assetStatus };
      default: return emptyAdminRead(procedure);
    }
  });
  await page.goto("/admin");
  await seedPortalSession(page, editor);
  await page.reload();
  const ai = page.getByRole("region", { name: "Generate an AI-assisted question draft" });
  const source = page.locator(".intake-queue article");
  await expect(ai.getByRole("button", { name: "Retry draft" })).toHaveCount(0);
  await expect(source.getByRole("button", { name: "Retry extraction" })).toHaveCount(0);
  expired = true;
  await page.getByRole("button", { name: "Refresh queues" }).press("Enter");
  const health = page.getByRole("region", { name: "Operational health" });
  await expect(health.locator("article").filter({ hasText: "Expired extractions" })).toContainText("1");
  await expect(health.locator("article").filter({ hasText: "Expired draft requests" })).toContainText("1");
  await expect(source.getByText("Extraction timed out. Retry when ready.")).toBeVisible();
  expect(calls.some(([name]) => name === "ai-question-draft" || name === "question-intake-extract")).toBe(false);
  await ai.getByRole("button", { name: "Retry draft" }).click();
  await expect(ai.getByRole("alert")).toHaveText("A basis question is no longer cleared for AI drafting");
  rightsCleared = true;
  await ai.getByRole("button", { name: "Retry draft" }).press("Enter");
  await expect(ai.getByRole("status")).toHaveText("AI draft created and sent to human review.");
  await expect(ai.getByRole("button", { name: "Retry draft" })).toHaveCount(0);
  await expect(ai.getByText("Processing attempt 2")).toBeVisible();
  const card = page.getByRole("article").filter({ hasText: heldDraft.sourceName });
  await expect(card.locator("pre")).toContainText("ai-generated-human-review");
  await expect(card.getByRole("button", { name: "Create canonical review artifact" })).toHaveCount(0);
  await source.getByRole("button", { name: "Retry extraction" }).click();
  await expect(source.getByText("extracted", { exact: true })).toBeVisible();
  await expect(source.getByText("Processing attempt 2")).toBeVisible();
  expect(calls.filter(([name]) => name === "ai-question-draft").map(([, input]) => input)).toEqual([{ requestId }, { requestId }]);
  expect(calls.filter(([name]) => name === "question-intake-extract")).toEqual([["question-intake-extract", { assetId }]]);
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  const violations = await page.evaluate(async () => (await window.axe.run(".ai-drafting", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations);
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  expect(unexpected).toEqual([]);
});

test("a failed draft belonging to another administrator exposes no retry control", async ({ page }) => {
  const { calls, unexpected } = await stubPortalProvider(page, procedure => {
    if (procedure === "is_dmocks_admin") return true;
    if (procedure === "admin_ai_draft_requests") return [{ id: requestId, exam: "uceed", topic: "observation", questionType: "MCQ",
      basisExternalKeys: ["fictional-reference"], status: "failed", error: "Processing expired", retryAvailable: false }];
    return emptyAdminRead(procedure);
  });
  await page.goto("/admin");
  await seedPortalSession(page, editor);
  await page.reload();
  const ai = page.getByRole("region", { name: "Generate an AI-assisted question draft" });
  await expect(ai.getByText("Processing expired", { exact: true })).toBeVisible();
  await expect(ai.getByRole("button", { name: "Retry draft" })).toHaveCount(0);
  expect(calls.some(([name]) => name === "ai-question-draft")).toBe(false);
  expect(unexpected).toEqual([]);
});
