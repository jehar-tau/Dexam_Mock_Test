import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

// Spoken feedback on the development preview route. The device voice is
// replaced by a stand-in that records what would be said.
const programme = "/learn-programme-preview/cube-nets";
const player = page => page.getByRole("dialog");
const feedback = page => player(page).locator(".feedback");
const switchButton = page => player(page).getByRole("button", { name: "Spoken feedback" });
const spoken = page => page.evaluate(() => window.__speech);

async function standInVoice(page, voices = [{ name: "Fixture India", lang: "en-IN" }, { name: "Fixture US", lang: "en-US", default: true }]) {
  await page.addInitScript(list => {
    window.__speech = { said: [], cancelled: 0, voices: [] };
    // The browser's own speechSynthesis is a read-only property, so replace it by definition.
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, writable: true, value: class { constructor(text) { this.text = text; } } });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { getVoices: () => list, addEventListener() {}, removeEventListener() {},
      cancel() { window.__speech.cancelled++; }, speak(utterance) { window.__speech.said.push(utterance.text); window.__speech.voices.push(utterance.voice?.name ?? null); } } });
  }, voices);
}
async function toFirstCheck(page) {
  await page.locator(".path-item", { hasText: "From flat to solid" }).getByRole("button", { name: "Start" }).click();
  for (let screen = 0; screen < 3; screen++) await player(page).getByRole("button", { name: "Continue" }).click();
  await expect(player(page).getByText("Can this shape fold into a closed cube?")).toBeVisible();
}

test("a wrong answer's explanation is read aloud once the student turns spoken feedback on", async ({ page }) => {
  await standInVoice(page);
  await page.goto(programme);
  await toFirstCheck(page);
  await expect(switchButton(page)).toHaveAttribute("aria-pressed", "false");
  await player(page).getByRole("button", { name: "Yes, it is a net" }).click();
  await player(page).getByRole("button", { name: "Check" }).click();
  await expect(feedback(page)).toContainText("Not quite");
  expect((await spoken(page)).said).toEqual([]); // off until the student turns it on

  await switchButton(page).click();
  await expect(switchButton(page)).toHaveAttribute("aria-pressed", "true");
  const written = (await feedback(page).locator("p").textContent()).trim();
  await expect.poll(async () => (await spoken(page)).said).toEqual([written.replace(/\s+([.,;:!?])/g, "$1")]);
  expect((await spoken(page)).voices).toEqual(["Fixture India"]);
  await expect(feedback(page)).toContainText(written); // the written explanation stays on screen

  const before = (await spoken(page)).cancelled;
  await player(page).getByRole("button", { name: "Continue" }).click();
  await expect.poll(async () => (await spoken(page)).cancelled).toBeGreaterThan(before); // moving on stops the voice

  // Start the lesson again from the beginning; only the spoken feedback choice is kept.
  await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key !== "dmocks.learn.spoken-feedback") localStorage.removeItem(key); });
  await page.goto(programme);
  await toFirstCheck(page);
  await expect(switchButton(page)).toHaveAttribute("aria-pressed", "true"); // remembered on this device
  await player(page).getByRole("button", { name: "No, it cannot close" }).click();
  await player(page).getByRole("button", { name: "Check" }).click();
  await expect(feedback(page)).toContainText("Correct");
  expect((await spoken(page)).said).toEqual([]); // right answers are not read aloud

  await switchButton(page).click();
  await expect(switchButton(page)).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => localStorage.getItem("dmocks.learn.spoken-feedback"))).toBe("off");
});

test("the switch is hidden where the browser has no speech, and the player passes the accessibility audit", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined }); });
  await page.goto(programme);
  await toFirstCheck(page);
  await expect(switchButton(page)).toHaveCount(0);
  await page.goto("about:blank");
  await standInVoice(page);
  await page.goto(programme);
  await toFirstCheck(page);
  await switchButton(page).click();
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  expect(await page.evaluate(async () => (await window.axe.run(".player", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations.map(item => item.id))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("a speech engine that fails never breaks the lesson", async ({ page }) => {
  await page.addInitScript(() => {
    window.__errors = [];
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { getVoices: () => [{ name: "Fixture", lang: "en-IN" }], addEventListener() {}, removeEventListener() {},
      cancel() {}, speak() { throw new Error("fictional engine failure"); } } });
  });
  page.on("pageerror", error => page.evaluate(message => window.__errors.push(message), error.message).catch(() => {}));
  await page.goto(programme);
  await toFirstCheck(page);
  await switchButton(page).click();
  await player(page).getByRole("button", { name: "Yes, it is a net" }).click();
  await player(page).getByRole("button", { name: "Check" }).click();
  await expect(feedback(page)).toContainText("Not quite");
  await expect(switchButton(page)).toHaveCount(0); // switched itself off for this visit
  await expect(player(page).getByRole("button", { name: "Continue" })).toBeEnabled();
  expect(await page.evaluate(() => window.__errors)).toEqual([]);
});

test("the released build shows no spoken feedback switch", async ({ page }) => {
  await standInVoice(page);
  const provider = await stubPortalProvider(page, () => undefined);
  await page.goto("http://127.0.0.1:4999/"); await seedPortalSession(page, { id: "00000000-0000-4000-8000-000000000990", email: "learn-audio@example.invalid" });
  await page.goto("http://127.0.0.1:4999/dashboard/learn/programme/cube-nets");
  await toFirstCheck(page);
  await expect(switchButton(page)).toHaveCount(0);
  await player(page).getByRole("button", { name: "Yes, it is a net" }).click();
  await player(page).getByRole("button", { name: "Check" }).click();
  await expect(feedback(page)).toContainText("Not quite");
  expect((await spoken(page)).said).toEqual([]);
  expect(provider.unexpected).toEqual([]);
});
