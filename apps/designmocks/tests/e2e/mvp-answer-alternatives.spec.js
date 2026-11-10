import { expect, test } from "@playwright/test";
import { RULES_2027, runtimeQuestion } from "../../scripts/question-runtime.mjs";
import { seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

test.use({ baseURL: "http://127.0.0.1:4799" });

const student = { id: "00000000-0000-4000-8000-000000001681", email: "alternatives-fixture@example.invalid" };
const attempt = "20000000-0000-4000-8000-000000001681";
const questionId = "30000000-0000-4000-8000-000000001681";
const prompt = "Original fictional alternative answer question.";
const explanation = "Original fictional worked explanation.";
const options = ["A", "B", "C", "D"].map(key => ({ key, text: `Fictional choice ${key}` }));

async function attemptFixture(page, runtime) {
  const state = { answer: null, revision: 0, submitted: false };
  const snapshot = () => ({
    id: attempt, title: "Original fictional released objective paper", status: state.submitted ? "submitted" : "active",
    deadline: new Date(Date.now() + 900000).toISOString(), serverNow: new Date().toISOString(),
    score: state.submitted ? runtime.points : null, total: runtime.points,
    questions: [{
      id: questionId, ordinal: 1, kind: runtime.kind, topic: runtime.topic, prompt: runtime.prompt,
      options: runtime.options, marking: runtime.marking, points: runtime.points, negativePoints: runtime.negativePoints,
      answer: state.answer, answerRevision: state.revision, media: [],
      ...(state.submitted ? { outcome: "correct", correctKey: runtime.key, explanation: runtime.explanation } : {}),
    }],
  });
  const provider = await stubPortalProvider(page, (name, input) => {
    if (name === "read_attempt") return snapshot();
    if (name === "save_answer_revision") {
      state.answer = input.p_answer;
      state.revision = input.p_revision;
      return { accepted: true, revision: state.revision, answer: state.answer };
    }
    if (name === "submit_attempt") {
      state.submitted = true;
      return snapshot();
    }
  });
  await page.goto("/");
  await seedPortalSession(page, student);
  return { state, ...provider };
}

const alternatives = [
  { type: "MCQ", raw: "C or A", selected: ["A"], saved: "A", label: "C or A" },
  { type: "MSQ", raw: "AD or BC", selected: ["B", "C"], saved: ["B", "C"], label: "A, D or B, C" },
  { type: "NAT", raw: "1.25 or 2.50 to 2.75", selected: [], saved: "2.55", label: "1.25 or 2.50 to 2.75" },
];
for (const { type, raw, selected, saved, label } of alternatives) {
  test(`${type} keeps its response type and shows accepted alternatives after submission`, async ({ page }) => {
    const runtime = runtimeQuestion({
      externalKey: `original-${type.toLowerCase()}-alternative-fixture`,
      provenance: { exam: "uceed" }, type, prompt, explanation, holds: [], assets: [],
      options: type === "NAT" ? [] : options, answer: { raw, status: "human-reviewed" },
    }, { rule: RULES_2027.uceed });
    expect(runtime).not.toBeNull();
    const provider = await attemptFixture(page, runtime);
    await page.goto("/attempt/" + attempt);
    await expect(page.getByText(prompt, { exact: true })).toBeVisible();
    await expect(page.getByText("Accepted answers", { exact: true })).toHaveCount(0);
    if (type === "NAT") {
      await page.getByLabel("Your numerical answer", { exact: true }).fill(saved);
      await page.getByRole("button", { name: "Save answer", exact: true }).press("Enter");
    } else {
      for (const id of selected) await page.getByRole("button", { name: `${id} Fictional choice ${id}`, exact: true }).click();
    }
    await expect.poll(() => provider.state.answer).toEqual(saved);
    await page.getByRole("button", { name: "Submit attempt", exact: true }).press("Enter");
    await page.getByRole("dialog").getByRole("button", { name: "Submit & view report", exact: true }).click();
    await expect(page.getByRole("group", { name: "Objective result", exact: true })).toContainText(`${runtime.points}/${runtime.points}`);
    await page.getByRole("button", { name: "Open answer review", exact: true }).press("Enter");
    await expect(page.locator(".answer-review article")).toContainText(`Accepted answers ${label}`);
    await expect(page.getByText(explanation, { exact: true })).toBeVisible();
    expect(provider.unexpected).toEqual([]);
  });
}
