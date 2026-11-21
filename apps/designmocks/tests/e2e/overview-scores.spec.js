import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

test.use({ baseURL: portalFixtureURL });
const student = { id: "00000000-0000-4000-8000-000000000291", email: "overview-student@example.invalid" };
const empty = () => ({ completed: 1, waitingForResults: 1, objectiveAccuracy: null, objectiveAnswered: 0,
  topics: [], exams: [], drawingReviews: { pending: 1, released: 0 } });

async function fixture(page) {
  const state = { analytics: empty(), attempts: [], events: [] };
  const provider = await stubPortalProvider(page, procedure => {
    switch (procedure) {
      case "finalize_my_expired_attempts": return 0;
      case "my_attempt_history": return state.attempts;
      case "my_pass": return { active: true, expiresAt: "2027-11-07T00:00:00Z" };
      case "my_overview_analytics": return state.analytics;
      case "available_papers": return [];
      case "all_india_event_catalog": return state.events;
    }
  });
  await page.goto("/dashboard");
  await seedPortalSession(page, student);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Welcome to your/ })).toBeVisible();
  await expect(page.getByText("1 submitted attempt is awaiting results.", { exact: true })).toBeVisible();
  return Object.assign(state, provider);
}

test("each exam in Overview links to its own All India results, including ranks outside the public ten", async ({ page }) => {
  const state = await fixture(page);
  state.analytics.exams = ["nift", "ceed", "uceed", "nid"].map(exam => ({
    exam, attempts: 1, averagePercent: 67, bestPercent: 67,
  }));
  const dates = { startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-01T01:00:00Z", lastStartAt: "2026-10-01T00:45:00Z",
    reviewEndsAt: new Date(Date.now() + 86400000).toISOString(), durationSeconds: 3600, uploadGraceSeconds: 0, qualityHeld: false };
  state.events = [
    { ...dates, id: "10000000-0000-4000-8000-000000000291", exam: "uceed", title: "Fictional UCEED final", state: "released",
      attemptId: "20000000-0000-4000-8000-000000000291", result: { rank: 14, cohortSize: 48, score: 27, total: 30 } },
    { ...dates, id: "10000000-0000-4000-8000-000000000292", exam: "nift", title: "Fictional NIFT review", state: "review",
      attemptId: "20000000-0000-4000-8000-000000000292", result: null },
  ];

  await page.reload();
  await expect(page.getByRole("link", { name: "NID All India results →", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "UCEED All India results →", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/all-india\?exam=uceed$/);
  const exam = page.getByRole("combobox", { name: "Exam", exact: true });
  await expect(exam).toHaveValue("uceed");
  await expect(page.getByText("Rank 14 of 48 · 27/30 marks", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View attempt", exact: true })).toHaveAttribute("href", "/attempt/20000000-0000-4000-8000-000000000291");
  await expect(page.getByRole("heading", { name: "Fictional NIFT review" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Share on public results/ })).toHaveCount(0);

  await exam.selectOption("nift");
  await expect(exam).toHaveValue("nift");
  await expect(page.getByText(/Results under review until/)).toBeVisible();
  await expect(page.getByText(/Rank 14 of 48/)).toHaveCount(0);

  await exam.selectOption("nid");
  await expect(page.getByText("No NID All India mocks are listed yet.", { exact: true })).toBeVisible();
  await exam.selectOption("");
  await expect(page.getByRole("heading", { name: "Fictional UCEED final" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fictional NIFT review" })).toBeVisible();
  expect(state.calls.filter(([name]) => name.startsWith("start_") || name === "public_all_india_top_ten")).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test("Overview displays released whole-test percentages after cohort and combined-exam holds", async ({ page }) => {
  const state = await fixture(page);
  const snapshot = page.getByLabel("Performance snapshot", { exact: true });
  await expect(snapshot).not.toContainText("% average");
  for (const result of [
    { percent: 67, score: 16, total: 24, title: "Fictional published All India paper" },
    { percent: 30, score: 89, total: 300, title: "Fictional complete exam" },
  ]) {
    state.analytics = { ...empty(), completed: 2, waitingForResults: 0, objectiveAccuracy: 0, objectiveAnswered: 1,
      exams: [{ exam: "uceed", attempts: 1, averagePercent: result.percent, bestPercent: result.percent }],
      drawingReviews: { pending: 0, released: 2 } };
    state.attempts = result.total === 24 ? [{ id: "20000000-0000-4000-8000-000000000291", title: result.title, status: "submitted",
      resultsPending: false, score: result.score, total: result.total }] : [];
    await page.reload();
    await expect(snapshot.getByRole("heading", { name: result.percent + "% average", exact: true })).toBeVisible();
    await expect(snapshot).toContainText("Best " + result.percent + "% across 1 released test.");
    if (result.total === 24) await expect(page.getByText("16 / 24", { exact: true })).toBeVisible();
    await expect(page.getByText("1 submitted attempt is awaiting results.", { exact: true })).toHaveCount(0);
  }
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  expect(await page.evaluate(async () => (await window.axe.run(".workspace", {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  })).violations)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  expect(state.unexpected).toEqual([]);
  expect(state.calls.filter(([name]) => name.startsWith("start_"))).toEqual([]);
});

test("zero and negative released percentages remain visible without objective answers or drawing reviews", async ({ page }) => {
  const state = await fixture(page);
  state.analytics = { ...empty(), waitingForResults: 0, drawingReviews: { pending: 0, released: 0 },
    exams: [{ exam: "uceed", attempts: 3, averagePercent: -5, bestPercent: 0 },
      { exam: "ceed", attempts: 1, averagePercent: 0, bestPercent: 0 }] };
  await page.reload();
  const snapshot = page.getByLabel("Performance snapshot", { exact: true });
  await expect(snapshot.getByRole("heading", { name: "-5% average", exact: true })).toBeVisible();
  await expect(snapshot.getByRole("heading", { name: "0% average", exact: true })).toBeVisible();
  await expect(snapshot).toContainText("Best 0% across 3 released tests.");
  await expect(snapshot).not.toContainText("OBJECTIVE ACCURACY");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  expect(state.unexpected).toEqual([]);
});
