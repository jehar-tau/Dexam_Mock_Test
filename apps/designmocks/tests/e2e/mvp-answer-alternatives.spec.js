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
const fictionalFigureUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/ScAAAAASUVORK5CYII=";

async function attemptFixture(page, runtime) {
  const state = { answer: null, revision: 0, submitted: false };
  const snapshot = () => ({
    id: attempt, title: "Original fictional released objective paper", status: state.submitted ? "submitted" : "active",
    deadline: new Date(Date.now() + 900000).toISOString(), serverNow: new Date().toISOString(),
    score: state.submitted ? runtime.points : null, total: runtime.points,
    questions: [{
      id: questionId, ordinal: 1, kind: runtime.kind, topic: runtime.topic, prompt: runtime.prompt,
      options: runtime.options, marking: runtime.marking, points: runtime.points, negativePoints: runtime.negativePoints,
      answer: state.answer, answerRevision: state.revision, media: runtime.media,
      ...(state.submitted ? { outcome: "correct", correctKey: runtime.key, explanation: runtime.explanation } : {}),
    }],
  });
  const provider = await stubPortalProvider(page, (name, input) => {
    if (name === "read_attempt") return snapshot();
    if (name === "attempt-media" && runtime.media.length) return {
      media: { [questionId]: runtime.media.map(() => ({ url: fictionalFigureUrl })) },
    };
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

for (const answerStatus of ["official-key", "owner-adjudicated"]) {
test(`${answerStatus} released answer review reveals the next annotation through the keyboard`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  const figure = { sha256: "a".repeat(64), width: 80, height: 40 };
  const originalBlock = { sha256: "d".repeat(64), width: 120, height: 80 };
  const runtime = runtimeQuestion({
    externalKey: "fictional-visual-solution", provenance: { exam: "uceed" }, type: "NAT",
    prompt, explanation, holds: [], options: [],
    assets: [{ ...originalBlock, role: "figure" }, { ...figure, role: "solution" }], visualDependency: true,
    answer: { raw: "2", status: answerStatus },
    solutionReview: { fingerprint: "b".repeat(64), solutionSha256: "c".repeat(64),
      ...(answerStatus === "owner-adjudicated" ? { decision: "owner-adjudicated" } : {}) },
    workedSolution: {
      version: 1, figure, keyIdea: "Group the fictional shapes.",
      steps: [
        { text: "Mark the left group.", shapes: [{ tag: "rect", attrs: { x: "4", y: "4", width: "12", height: "12" } }] },
        { text: "Mark the right group.", shapes: [{ tag: "circle", attrs: { cx: "32", cy: "8", r: "4" } }] },
      ],
    },
  }, { rule: RULES_2027.uceed, mediaCatalog: [originalBlock, figure].map(asset =>
    ({ ...asset, path: `papers/canonical/${asset.sha256}.png`, byteSize: 128 })) });
  expect(runtime).not.toBeNull();
  expect(runtime.media.map(item => item.role)).toEqual([undefined, "solution"]);
  const provider = await attemptFixture(page, runtime);
  await page.goto("/attempt/" + attempt);
  await expect(page.getByText(prompt, { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Question figure 1", exact: true })).toHaveCount(1);
  await expect(page.getByRole("img", { name: "Question figure 2", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Worked solution", exact: true })).toHaveCount(0);
  await expect(page.getByText("Group the fictional shapes.", { exact: true })).toHaveCount(0);
  await page.getByLabel("Your numerical answer", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Save answer", exact: true }).press("Enter");
  await expect.poll(() => provider.state.answer).toEqual("2");
  await page.getByRole("button", { name: "Submit attempt", exact: true }).press("Enter");
  await page.getByRole("dialog").getByRole("button", { name: "Submit & view report", exact: true }).click();
  await page.getByRole("button", { name: "Open answer review", exact: true }).press("Enter");
  await expect(page.getByRole("navigation", { name: "Review questions", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Review correct questions (1)", exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "Review question 1, Correct", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Worked solution", exact: true })).toBeVisible();
  const overlay = page.locator(".worked-solution-figure svg");
  await expect(overlay.locator("rect")).toHaveCount(1);
  await expect(overlay.locator("circle")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Previous step", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Next step", exact: true }).press("Enter");
  await expect(page.getByText("Step 2 of 2", { exact: true })).toBeVisible();
  await expect(overlay.locator("circle")).toHaveCount(1);
  await page.getByRole("button", { name: "Previous step", exact: true }).press("Enter");
  await expect(overlay.locator("circle")).toHaveCount(0);
  await page.getByText("Full explanation", { exact: true }).click();
  await expect(page.getByText(explanation, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect(provider.unexpected).toEqual([]);
});
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
