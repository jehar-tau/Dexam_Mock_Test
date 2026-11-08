import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

test.use({ baseURL: portalFixtureURL });
const student = { id: "00000000-0000-4000-8000-000000000301", email: "drawing-results@example.invalid" };
const partA = "20000000-0000-4000-8000-000000000301", partB = "20000000-0000-4000-8000-000000000302";
const releasedAt = "2026-11-07T07:00:00Z";
const drawingQuestions = released => [45, 40].map((score, index) => ({
  id: "drawing-" + index, ordinal: index + 1, kind: "drawing", topic: "drawing", answer: null, media: [],
  prompt: "Fictional drawing task " + (index + 1), options: [], points: 50, negativePoints: 0, marking: { humanReview: true },
  ...(released ? { correctKey: { kind: "drawing" }, explanation: "", drawingReview: { status: "released",
    score, maxScore: 50, criteria: { composition: score }, comments: "Released fictional feedback " + (index + 1), releasedAt } } :
    { drawingReview: { status: "pending" } }),
}));
const report = released => ({ sessionId: "fictional-session", exam: "uceed", partAAttemptId: partA, partBAttemptId: partB,
  state: released ? "released" : "review_pending", resultsPending: !released,
  objectiveScore: released ? 4 : null, objectiveTotal: released ? 200 : null, drawingScore: released ? 85 : null,
  drawingTotal: released ? 100 : null, combinedScore: released ? 89 : null, combinedTotal: released ? 300 : null });
const accountExport = released => ({ schemaVersion: 2, exportedAt: new Date().toISOString(), accountId: student.id,
  profile: { user_id: student.id }, access: { orders: [], passes: [] }, learningProgress: [], community: { posts: [], comments: [] },
  bugReports: [], questionReports: [], drawingUploads: [],
  attempts: [{ id: partA, status: "submitted", resultsPending: !released, score: released ? 4 : null,
    total: released ? 200 : null, responses: [] }, { id: partB, status: "submitted", resultsPending: !released,
    score: released ? 85 : null, total: released ? 100 : null, responses: drawingQuestions(released).map(question => ({
      questionId: question.id, ordinal: question.ordinal, kind: "drawing", topic: "drawing", answer: null })) }],
  results: { examMocks: [report(released)], allIndia: [], drawingReviews: released ? drawingQuestions(true).map(question => ({
    reviewId: "review-" + question.ordinal, attemptId: partB, questionId: question.id,
    score: question.drawingReview.score, maxScore: 50, criteria: question.drawingReview.criteria,
    comments: question.drawingReview.comments, releasedAt })) : [] },
});

async function fixture(page) {
  const state = { released: false, invalidTotal: false };
  const provider = await stubPortalProvider(page, procedure => {
    switch (procedure) {
      case "finalize_my_expired_attempts": return 0;
      case "my_pass": return { active: true, expiresAt: "2027-11-07T00:00:00Z" };
      case "available_papers": return [];
      case "my_overview_analytics": return { completed: 2, waitingForResults: state.released ? 0 : 2,
        objectiveAccuracy: null, objectiveAnswered: 0, topics: [], drawingReviews: { pending: state.released ? 0 : 2, released: state.released ? 2 : 0 },
        exams: state.released ? [{ exam: "uceed", attempts: 1, averagePercent: 30, bestPercent: 30 }] : [] };
      case "my_attempt_history": return [{ id: partB, title: "Fictional UCEED Part B", status: "submitted",
        resultsPending: !state.released, score: state.released ? 85 : null, total: state.released ? 100 : null }];
      case "read_attempt": return { id: partB, title: "Fictional UCEED Part B", status: "submitted",
        deadline: "2026-11-07T06:00:00Z", uploadDeadline: "2026-11-07T06:15:00Z", serverNow: new Date().toISOString(),
        resultsPending: false, examResultsPending: !state.released, scoreKind: "drawing",
        score: state.released ? 85 : null, total: state.released ? 100 : null, questions: drawingQuestions(state.released) };
      case "my_exam_mock_session": return { exam: "uceed", partAAttemptId: partA, partBAttemptId: partB, partBState: "started" };
      case "my_exam_mock_report": return report(state.released);
      case "my_privacy_requests": return [];
      case "can_review_drawings": return false;
      case "export_my_account_data": {
        const value = accountExport(state.released);
        if (state.invalidTotal) value.attempts[1].total = 0;
        return value;
      }
    }
  });
  await page.goto("/dashboard");
  await seedPortalSession(page, student);
  await page.reload();
  await expect(page.getByRole("link", { name: "Fictional UCEED Part B", exact: true })).toBeVisible();
  return Object.assign(state, provider);
}

async function downloadedJSON(page) {
  const promised = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my data", exact: true }).click();
  const download = await promised, stream = await download.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

test("Part B history, drawing result, combined report and private download use the released human grade", async ({ page }) => {
  const state = await fixture(page);
  await expect(page.getByText("Awaiting release", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Fictional UCEED Part B", exact: true }).click();
  const result = page.getByRole("group", { name: "Drawing result", exact: true });
  await expect(result).toContainText("full result pending");
  await expect(page.getByRole("status")).toContainText("Full exam result pending.");
  await expect(page.getByRole("button", { name: "Open answer review", exact: true })).toHaveCount(0);
  await expect(page.getByText("Released fictional feedback 1", { exact: true })).toHaveCount(0);
  state.released = true;
  await page.reload();
  await expect(result).toContainText("85/100");
  await expect(result).toContainText("drawing marks");
  await expect(result).not.toContainText("objective marks");
  await expect(page.getByRole("region", { name: "Combined exam result", exact: true })).toContainText("89/300 marks");
  await page.getByRole("button", { name: "Open answer review", exact: true }).press("Enter");
  await expect(page.getByText("Released fictional feedback 1", { exact: true })).toBeVisible();
  await expect(page.getByText("45/50 marks", { exact: true })).toBeVisible();
  await expect(page.getByText("40/50 marks", { exact: true })).toBeVisible();
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  expect(await page.evaluate(async () => (await window.axe.run(".sample-result", {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  })).violations)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await page.getByRole("link", { name: "← Your workspace", exact: true }).click();
  await expect(page.getByText("85 / 100", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "30% average", exact: true })).toBeVisible();
  await page.goto("/account");
  const value = await downloadedJSON(page);
  expect(value.attempts[1]).toMatchObject({ score: 85, total: 100, resultsPending: false });
  expect(value.results.examMocks[0]).toMatchObject({ drawingScore: 85, drawingTotal: 100, combinedScore: 89, combinedTotal: 300 });
  expect(value.results.drawingReviews).toHaveLength(2);
  expect(state.unexpected).toEqual([]);
  expect(state.calls.some(([name]) => ["save_answer_revision", "submit_attempt", "start_exam_mock_part_b", "prepare_order"].includes(name))).toBe(false);
});

test("an inconsistent legacy drawing total saves no account file and permits a corrected retry", async ({ page }) => {
  const state = await fixture(page), downloads = [];
  state.released = true;state.invalidTotal = true;
  page.on("download", value => downloads.push(value));
  await page.goto("/account");
  await page.getByRole("button", { name: "Download my data", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Your export could not be verified. Refresh your account and try again.");
  expect(downloads).toHaveLength(0);
  state.invalidTotal = false;
  expect((await downloadedJSON(page)).attempts[1]).toMatchObject({ score: 85, total: 100 });
  expect(downloads).toHaveLength(1);
  expect(state.unexpected).toEqual([]);
});
