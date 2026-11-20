import { expect, test } from "@playwright/test";
import { SAMPLE_STORAGE } from "../../src/sample.mjs";

test("a student can practise independently from the catalogue without an account", async ({ page }) => {
  await page.goto("/tests");
  await page.getByRole("link", { name: "Try a visual hierarchy exercise" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Visual hierarchy");
  const solution = page.getByText("Both signs point right", { exact: false });
  await expect(solution).toBeHidden();
  const comparison = page.locator("summary").filter({ hasText: "Compare your reasoning" });
  await comparison.focus();
  await comparison.press("Enter");
  await expect(solution).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Try five timed visual questions" }).click();
  await expect(page.getByRole("button", { name: "Begin the sample" })).toBeVisible();
});

test("the referenced UCEED paper format is distinct from the free sample and an unreleased CEED paper", async ({ page }) => {
  await page.goto("/tests/uceed/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("UCEED Part A practice");
  await expect(page.getByText("first planned paid DMocks paper", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "UCEED 2027 paper format and sample interface" }))
    .toHaveAttribute("href", "https://www.uceed.iitb.ac.in/2027/question-paper.html");
  await page.goto("/tests/ceed");
  await expect(page.getByText("This exam is coming later and is outside the initial annual-pass offer.")).toBeVisible();
  await expect(page.getByText("first planned paid DMocks paper", { exact: false })).toHaveCount(0);
});

test("new and restored rotation questions preserve the geometry for their edition", async ({ page }) => {
  await page.goto("/sample");
  await page.getByRole("button", { name: "Begin the sample" }).click();
  const choices = page.getByRole("group", { name: "Answer choices" }).getByRole("button");
  const shapes = () => choices.evaluateAll(buttons => buttons.map(button =>
    [...button.querySelectorAll("svg rect")].map(rect =>
      rect.getAttribute("x") + "," + rect.getAttribute("y")
    ).sort().join(" ")
  ));
  expect(new Set(await shapes()).size).toBe(4);
  await expect(choices.nth(1)).toHaveAccessibleDescription("Three squares along the bottom, with one above the right end.");
  await choices.nth(1).press("Enter");
  await page.reload();
  await expect(choices.nth(1)).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(key => {
    const stored = JSON.parse(localStorage.getItem(key));
    delete stored.version;
    localStorage.setItem(key, JSON.stringify(stored));
  }, SAMPLE_STORAGE);
  await page.reload();
  const legacy = await shapes();
  expect(legacy[1]).toBe(legacy[2]);
  await expect(choices.nth(1)).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Submit sample", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit & see my sample report" }).click();
  await expect(page.locator(".sample-score")).toContainText("1/5");
  await page.getByRole("button", { name: "Open answer review" }).click();
  await expect(page.locator(".answer-review article").first()).toContainText("Correct choice: B or C");
});
