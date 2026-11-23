import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

test.use({ reducedMotion: "reduce" });

test("topic browser configures an example, gives feedback and respects session size", async ({ page }) => {
  await page.goto("/topic-practice-preview");
  await expect(page.getByText(/fictional examples/)).toBeVisible();
  await expect(page.getByLabel("Topic", { exact: true }).locator("option")).not.toContainText([/ready/]);
  await page.getByRole("searchbox", { name: "Search catalogue" }).fill("spatial uceed");
  const choose = page.getByRole("button", { name: /UCEED Spatial reasoning/ });
  await choose.press("Enter");
  await expect(page.getByRole("combobox", { name: "Topic", exact: true })).toHaveValue("spatial-reasoning");
  const answer = page.getByRole("button", { name: "Tile C", exact: true });
  await answer.press("Enter");
  await expect(page.getByRole("status")).toContainText("A half turn is 180°");
  await page.getByRole("combobox", { name: "Questions" }).selectOption("20");
  await expect(choose).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Topic", exact: true })).toHaveValue("spatial-reasoning");
  await expect(page.getByRole("button", { name: "Start practice", exact: true })).toBeDisabled();
  await page.getByRole("searchbox").fill("no such topic");
  await expect(page.getByRole("status").filter({ hasText: "No topics match" })).toBeVisible();
});

test("fictional event filters, a single preview start and example results stay local", async ({ page }) => {
  const writes = [];
  page.on("request", request => { if (request.method() === "POST") writes.push(request.url()); });
  await page.goto("/all-india-preview");
  await expect(page.getByText(/fictional event schedule/)).toBeVisible();
  const status = page.getByRole("combobox", { name: "Status" });
  await status.selectOption("review");
  await expect(page.getByRole("status")).toContainText("No events match");
  await status.selectOption("open");
  const open = page.getByRole("article").filter({ hasText: "UCEED All India Mock 01" });
  await open.getByText("Window details").press("Enter");
  await expect(open.getByText("Last start", { exact: true })).toBeVisible();
  await status.selectOption("");
  await page.getByRole("button", { name: "Start once" }).press("Enter");
  await expect(page.getByRole("dialog", { name: "Ready to begin UCEED All India Mock 01?" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Begin timed attempt" }).press("Enter");
  await expect(page.getByRole("button", { name: "Preview started" })).toBeDisabled();
  await page.getByRole("combobox", { name: "Exam" }).selectOption("nift");
  await expect(page.getByRole("heading", { name: "UCEED All India Mock 01" })).toHaveCount(0);
  const ranks = page.getByRole("link", { name: "See example rankings" });
  await ranks.press("Enter");
  await expect(page).toHaveURL(/all-india-preview\?exam=nift#all-india-example-ranks/);
  await expect(page.getByText("Candidate-A1B2C3")).toBeVisible();
  await page.getByRole("combobox", { name: "Exam" }).selectOption("uceed");
  await expect(page.getByRole("button", { name: "Preview started" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Example rankings" })).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("All India readiness can be cancelled with Escape and restores keyboard focus", async ({ page }) => {
  const writes = [];
  page.on("request", request => { if (request.method() === "POST") writes.push(request.url()); });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/all-india-preview");
  const opener = page.getByRole("button", { name: "Start once", exact: true });
  await opener.focus();
  await opener.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Ready to begin UCEED All India Mock 01?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("one attempt");
  await expect(dialog).toContainText("keeps running if you disconnect");
  await expect(dialog).toContainText("15 minutes for drawing uploads");
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  expect(await page.evaluate(async () => (await window.axe.run("dialog[open]", {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  })).violations.map(item => item.id))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toEqual([]);
});

for (const [route, scope] of [["/topic-practice-preview", ".topic-practice"], ["/all-india-preview", ".all-india"]]) {
  test(`${route} reflows at 320 pixels in both themes`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(route);
    await expect(page.locator(scope)).toBeVisible();
    if (route === "/topic-practice-preview") {
      await page.getByRole("combobox", { name: "Topic", exact: true }).selectOption("spatial-reasoning");
      await page.getByRole("combobox", { name: "Questions", exact: true }).selectOption("20");
      await expect(page.getByRole("button", { name: "Use 10 questions", exact: true })).toBeVisible();
    }
    await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
    for (let theme = 0; theme < 2; theme++) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      const violations = await page.evaluate(async selector => (await window.axe.run(selector, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      })).violations, scope);
      expect(violations).toEqual([]);
      await page.getByRole("switch", { name: "Dark mode", exact: true }).click();
    }
  });
}

test("short-topic recovery preserves the topic and time without starting implicitly", async ({ page }) => {
  const writes = [];
  page.on("request", request => { if (request.method() === "POST") writes.push(request.url()); });
  await page.goto("/topic-practice-preview?exam=nift&topic=proportion");
  const questions = page.getByRole("combobox", { name: "Questions", exact: true });
  const topic = page.getByRole("combobox", { name: "Topic", exact: true });
  const start = page.getByRole("button", { name: "Start practice", exact: true });
  await page.getByRole("combobox", { name: "Time", exact: true }).selectOption("2700");
  await questions.selectOption("30");
  await expect(topic).toHaveValue("proportion");
  await expect(start).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "supports up to 20 questions" })).toBeVisible();
  await page.getByRole("button", { name: "Use 20 questions", exact: true }).press("Enter");
  await expect(page.getByRole("combobox", { name: "Time", exact: true })).toHaveValue("2700");
  await expect(questions).toHaveValue("20");
  await expect(page.getByText(/Preview created/)).toHaveCount(0);
  await questions.selectOption("30");
  await questions.selectOption("10");
  await expect(topic).toHaveValue("proportion");
  await expect(start).toBeEnabled();
  expect(writes).toEqual([]);
});
