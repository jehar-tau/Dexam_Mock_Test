import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

// Fictional accounts only. Checkout stays closed on this fixture build.
test.use({ baseURL: "http://127.0.0.1:4788" });

const student = { id: "00000000-0000-4000-8000-00000000e101", email: "pass-pricing-fixture@example.invalid" };
const attemptId = "20000000-0000-4000-8000-00000000e101";
const token = "0123456789abcdef".repeat(4);
const axe = fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url));
const violations = (page, selector) => page.evaluate(async target => (await window.axe.run(target, {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(item => [item.id, item.nodes.map(node => node.target)]), selector);

async function signedIn(page, respond = () => undefined, path = "/") {
  const provider = await stubPortalProvider(page, respond);
  await page.goto("/");
  await seedPortalSession(page, student);
  await page.goto(path);
  return provider;
}

test("the plans page offers the annual and Duo passes and keeps checkout closed", async ({ page }) => {
  const provider = await signedIn(page, () => undefined, "/plans");
  await expect(page.getByRole("heading", { name: "The DMocks annual pass." })).toBeVisible();
  const choice = page.getByRole("group", { name: "Choose your pass" });
  await expect(choice.getByRole("radio", { name: /Annual pass/ })).toBeChecked();
  await expect(page.locator(".annual-amount")).toContainText("₹1,284");
  await expect(page.getByRole("button", { name: "Pay ₹1,284 with Razorpay", exact: true })).toBeDisabled();
  await choice.getByText("Duo pass", { exact: true }).click();
  await expect(choice.getByRole("radio", { name: /Duo pass/ })).toBeChecked();
  await expect(page.locator(".annual-amount")).toContainText("₹2,142");
  await expect(page.getByText(/one-time link for one friend/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay ₹2,142 with Razorpay", exact: true })).toBeDisabled();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  const table = page.getByRole("table");
  for (const [part, free, paid] of [
    ["Worked solutions", "The first 5 questions of each paper", "Every question"],
    ["Topic practice", "One 10-question session a day", "Unlimited sessions"],
    ["Learn", "The Foundations level", "Exam standard, Exam hard and Mastery"],
    ["Teacher drawing marking", "Not included", "4 drawings a month"],
  ]) {
    const row = table.getByRole("row").filter({ hasText: part });
    await expect(row).toContainText(free);
    await expect(row).toContainText(paid);
  }
  await page.addScriptTag({ path: axe });
  expect(await violations(page, "main")).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  expect(provider.calls.filter(([name]) => ["create-order", "prepare_order", "prepare_plan_order"].includes(name))).toEqual([]);
  expect(provider.unexpected).toEqual([]);
});

test("after a paper, a free student sees five worked solutions and a prompt for the rest", async ({ page }) => {
  const questions = Array.from({ length: 7 }, (_, index) => ({
    id: `30000000-0000-4000-8000-00000000e1${10 + index}`, ordinal: index + 1, kind: "mcq", topic: "observation",
    prompt: `Original fictional question ${index + 1}.`, options: [{ id: "A", label: "First" }, { id: "B", label: "Second" }],
    marking: { correct: 3, wrong: -1 }, points: 3, negativePoints: 1, answer: "A", answerRevision: 1, media: [],
    outcome: "correct", awarded: 3, correctKey: { correct: ["A"] },
    ...(index < 5 ? { explanation: `Original fictional worked step ${index + 1}.` } : { explanation: null, solutionLocked: true }),
  }));
  const snapshot = { id: attemptId, title: "Original fictional year paper", status: "submitted", score: 21, total: 21,
    deadline: new Date(Date.now() - 60000).toISOString(), serverNow: new Date().toISOString(), resultsPending: false,
    examResultsPending: false, scoreKind: "objective", questions, lockedSolutions: 2, passActive: false };
  const provider = await signedIn(page, name => {
    if (name === "read_attempt") return snapshot;
    if (["my_exam_mock_session", "my_exam_mock_report"].includes(name)) return null;
  }, "/attempt/" + attemptId);
  await expect(page.getByText("You’ve seen worked solutions for the first 5 questions.")).toBeVisible();
  await expect(page.getByRole("link", { name: "See how to solve the other 2 →" })).toHaveAttribute("href", "/plans");
  await page.getByRole("button", { name: "Open answer review", exact: true }).click();
  await page.getByRole("button", { name: "View solution", exact: true }).click();
  await expect(page.getByText("Original fictional worked step 1.")).toBeVisible();
  await page.getByRole("button", { name: /^Review question 6,/ }).click();
  await expect(page.getByText("Original fictional question 6.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "View solution", exact: true })).toHaveCount(0);
  await expect(page.locator(".solution-locked")).toContainText("The step-by-step solution comes with the pass.");
  await expect(page.locator(".solution-locked").getByRole("link", { name: "See plans →" })).toHaveAttribute("href", "/plans");
  await page.addScriptTag({ path: axe });
  expect(await violations(page, ".analysis-workspace")).toEqual([]);
  expect(provider.unexpected).toEqual([]);
});

test("a second topic session in a day offers the pass", async ({ page }) => {
  const provider = await signedIn(page, name => {
    if (name === "topic_catalog") return [{ exam: "uceed", topic: "observation", questions: 40 }];
    if (name === "start_topic_practice") return { code: "P0001", message: "Free accounts include one topic practice session a day" };
    if (name === "public_all_india_top_ten") return [];
  }, "/dashboard/practice");
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Free accounts include one topic practice session a day");
  await expect(alert.getByRole("link", { name: "See plans →" })).toHaveAttribute("href", "/plans");
  expect(provider.calls.filter(([name]) => name === "start_topic_practice")).toHaveLength(1);
  expect(provider.unexpected).toEqual([]);
});

test("without a pass, Learn keeps Foundations open and offers the pass for the exam levels", async ({ page }) => {
  // The development preview server without the student portal.
  const preview = "http://127.0.0.1:4399/learn-programme-preview/cube-nets";
  await page.goto(preview + "?pass=none");
  await expect(page.getByRole("heading", { name: "Cube nets", exact: true })).toBeVisible();
  const foundations = page.getByRole("region", { name: "Foundations", exact: true });
  await expect(foundations.getByRole("button", { name: "Start" }).first()).toBeEnabled();
  for (const tier of ["Exam standard", "Exam hard", "Mastery"]) {
    const region = page.getByRole("region", { name: tier, exact: true });
    await expect(region).toContainText("Comes with the pass.");
    await expect(region.getByRole("link", { name: /See plans/ }).first()).toHaveAttribute("href", "/plans");
    for (const button of await region.getByRole("button").all()) await expect(button).toBeDisabled();
  }
  // A paid quiz cannot be opened from a link either.
  await page.goto(preview + "?pass=none&lesson=quiz-exam-standard");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Exam standard", exact: true })).toContainText("Comes with the pass.");
});

test("a friend claims a Duo invite once with their Google account", async ({ page }) => {
  let claims = 0;
  const provider = await signedIn(page, (name, input) => {
    if (name !== "redeem_duo_invite") return undefined;
    expect(input).toEqual({ p_token: token });
    claims += 1;
    return claims === 1 ? { code: "55000", message: "This invite has already been used", hint: "dmocks_duo_used" }
      : { active: true, expiresAt: "2027-11-28T00:00:00Z" };
  }, "/duo/" + token);
  await expect(page.getByRole("heading", { name: "Your friend got you a pass." })).toBeVisible();
  await page.getByRole("button", { name: "Claim my pass" }).click();
  await expect(page.getByRole("alert")).toHaveText("This invite has already been used.");
  await page.getByRole("button", { name: "Claim my pass" }).click();
  await expect(page.getByText("Your 12-month pass is active.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open your workspace" })).toHaveAttribute("href", "/dashboard");
  await page.goto("/duo/not-a-token");
  await expect(page.getByRole("alert")).toContainText("This invite link is not valid.");
  expect(provider.unexpected).toEqual([]);
});
