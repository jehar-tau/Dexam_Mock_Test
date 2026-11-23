import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

test.use({ baseURL: portalFixtureURL });
const student = { id: "00000000-0000-4000-8000-000000000351", email: "practice-student@example.invalid" };
const attemptId = "00000000-0000-4000-8000-000000000359";

async function fixture(page) {
  const state = { error: "", attempt: null };
  const provider = await stubPortalProvider(page, (procedure, input) => {
    switch (procedure) {
      case "topic_catalog": return [{ exam: "uceed", topic: "observation", questions: 40 },
        { exam: "uceed", topic: "spatial-reasoning", questions: 12 }];
      case "start_topic_practice": {
        if (state.error) return { code: "P0001", message: state.error };
        state.attempt = { id: attemptId, title: "Observation practice", status: "active", score: null, total: null,
          resultsPending: false, examResultsPending: false, serverNow: new Date().toISOString(),
          deadline: new Date(Date.now() + input.p_duration_seconds * 1000).toISOString(),
          questions: Array.from({ length: input.p_count }, (_, index) => ({
            id: "practice-question-" + index, ordinal: index + 1, kind: "mcq", topic: "observation",
            prompt: (index < 10 ? "Fresh practice question " + (index + 1) : "Review practice question " + (index - 9)),
            options: [{ id: "A", label: "First choice" }, { id: "B", label: "Second choice" },
              { id: "C", label: "Third choice" }, { id: "D", label: "Fourth choice" }],
            answer: null, answerRevision: 0, points: 3, negativePoints: 0.71,
            marking: { correct: 3, wrong: -0.71 }, media: [],
          })),
        };
        return attemptId;
      }
      case "read_attempt": return { ...state.attempt, serverNow: new Date().toISOString() };
      case "my_exam_mock_session": return null;
      case "my_exam_mock_report": return null;
    }
  });
  await page.goto("/dashboard/practice");
  await seedPortalSession(page, student);
  await page.reload();
  await expect(page.getByRole("button", { name: "Start practice", exact: true })).toBeEnabled();
  return Object.assign(state, provider);
}

test("the topic builder starts the selected fresh/review mix and reconnects to the same frozen practice", async ({ page }) => {
  const state = await fixture(page);
  await expect(page.getByText(/Questions come from released year-wise papers. Unseen questions come first/)).toBeVisible();
  await page.getByRole("combobox", { name: "Questions", exact: true }).selectOption("20");
  await page.getByRole("combobox", { name: "Time", exact: true }).selectOption("1800");
  await expect(page.getByRole("combobox", { name: "Topic", exact: true }).locator("option")).toHaveCount(1);
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  expect(await page.evaluate(async () => (await window.axe.run(".topic-practice", {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  })).violations)).toEqual([]);
  await page.getByRole("button", { name: "Start practice", exact: true }).press("Enter");
  await expect(page).toHaveURL(new RegExp("/attempt/" + attemptId + "$"));
  await expect(page.getByRole("heading", { name: "Fresh practice question 1", exact: true })).toBeVisible();
  expect(state.calls).toContainEqual(["start_topic_practice", { p_exam: "uceed", p_topic: "observation", p_count: 20, p_duration_seconds: 1800 }]);
  const deadline = state.attempt.deadline, identities = state.attempt.questions.map(question => question.id);
  await page.getByRole("button", { name: "Go to question 20", exact: true }).press("Enter");
  await expect(page.getByRole("heading", { name: "Review practice question 10", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Fresh practice question 1", exact: true })).toBeVisible();
  expect(state.attempt.deadline).toBe(deadline);
  expect(state.attempt.questions.map(question => question.id)).toEqual(identities);
  expect(state.calls.filter(([name]) => name === "start_topic_practice")).toHaveLength(1);
  expect(state.calls.filter(([name]) => name === "read_attempt")).toHaveLength(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  expect(state.unexpected).toEqual([]);
});

test("paid access, active-attempt and readiness failures remain retryable before thirty-question practice", async ({ page }) => {
  const state = await fixture(page);
  for (const error of ["An active pass is required", "Finish an active attempt before starting another",
    "Not enough reviewed questions for this practice"]) {
    state.error = error;
    await page.getByRole("button", { name: "Start practice", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(error);
    await expect(page.getByRole("button", { name: "Start practice", exact: true })).toBeEnabled();
    await expect(page).toHaveURL(/\/dashboard\/practice$/);
  }
  state.error = "";
  await page.getByRole("combobox", { name: "Questions", exact: true }).selectOption("30");
  await page.getByRole("combobox", { name: "Time", exact: true }).selectOption("2700");
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await expect(page.getByRole("button", { name: "Go to question 30", exact: true })).toBeVisible();
  expect(state.calls).toContainEqual(["start_topic_practice", { p_exam: "uceed", p_topic: "observation", p_count: 30, p_duration_seconds: 2700 }]);
  expect(state.calls.some(([name]) => ["prepare_order", "submit_attempt", "save_answer_revision"].includes(name))).toBe(false);
  expect(state.unexpected).toEqual([]);
});

test("selected short topics recover explicitly before sending a correctly sized start", async ({ page }) => {
  const state = await fixture(page);
  await page.getByRole("combobox", { name: "Topic", exact: true }).selectOption("spatial-reasoning");
  await page.getByRole("combobox", { name: "Time", exact: true }).selectOption("1800");
  await page.getByRole("combobox", { name: "Questions", exact: true }).selectOption("30");
  await expect(page.getByRole("combobox", { name: "Topic", exact: true })).toHaveValue("spatial-reasoning");
  await expect(page.getByRole("button", { name: "Start practice", exact: true })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "supports up to 10 questions" })).toBeVisible();
  expect(state.calls.filter(([name]) => name === "start_topic_practice")).toHaveLength(0);
  await page.getByRole("button", { name: "Use 10 questions", exact: true }).press("Enter");
  expect(state.calls.filter(([name]) => name === "start_topic_practice")).toHaveLength(0);
  await page.getByRole("button", { name: "Start practice", exact: true }).press("Enter");
  await expect(page).toHaveURL(new RegExp("/attempt/" + attemptId + "$"));
  expect(state.calls).toContainEqual(["start_topic_practice", { p_exam: "uceed", p_topic: "spatial-reasoning", p_count: 10, p_duration_seconds: 1800 }]);
  expect(state.unexpected).toEqual([]);
});
