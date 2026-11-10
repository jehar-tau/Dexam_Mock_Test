import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

test.use({ baseURL: portalFixtureURL });
const student = { id: "00000000-0000-4000-8000-000000000401", email: "drawing-uploads@example.invalid" };
const attemptId = "30000000-0000-4000-8000-000000000401", questionId = "20000000-0000-4000-8000-000000000401";
const png = () => readFile(new URL("../fixtures/drawing-images/fictional-drawing.png", import.meta.url));

async function fixture(page, { cleanupPending = false } = {}) {
  const now = new Date(); await page.clock.install({ time: now });
  const state = { pages: [], uploads: [], nextError: null, loseReceipt: false, removals: [] };
  const provider = await stubPortalProvider(page, procedure => {
    switch (procedure) {
      case "read_attempt": return { id: attemptId, title: "Fictional drawing upload", status: "submitted", resultsPending: true,
        serverNow: now.toISOString(), deadline: new Date(+now - 1000).toISOString(), uploadDeadline: new Date(+now + 120_000).toISOString(),
        reviewEndsAt: new Date(+now + 864_000_000).toISOString(), questions: [],
        drawingUploadTasks: [{ id: questionId, prompt: "Sketch an original portable sign." }] };
      case "my_exam_mock_session": case "my_exam_mock_report": return null;
    }
  });
  const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  await page.route("https://dmocks-portal-fixture.supabase.co/functions/v1/drawing-media", async route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ headers, status: 204 });
    const contentType = request.headers()["content-type"];
    if (contentType.includes("application/json")) {
      const body = request.postDataJSON();
      if (body.action === "list") return route.fulfill({ headers, json: { items: state.pages } });
      state.removals.push(body);
      state.pages = state.pages.filter(item => item.id !== body.id);
      return route.fulfill({ headers, json: cleanupPending ? { removed: body.id, cleanupPending: true } : { removed: body.id } });
    }
    const form = await new Response(request.postDataBuffer(), { headers: { "Content-Type": contentType } }).formData();
    state.uploads.push({ ordinal: Number(form.get("ordinal")), attemptId: form.get("attemptId"), questionId: form.get("questionId"), file: form.get("file").name });
    if (state.nextError) {
      const code = state.nextError; state.nextError = null;
      return route.fulfill({ headers, status: code === "drawing_busy" ? 429 : 400, json: { code, error: "Private decoder implementation detail" } });
    }
    const item = { id: "fictional-page-" + state.uploads.length, ordinal: Number(form.get("ordinal")), mimeType: form.get("file").type, byteSize: form.get("file").size };
    state.pages.push(item);
    if (state.loseReceipt) { state.loseReceipt = false; return route.abort(); }
    return route.fulfill({ headers, json: { id: item.id, ordinal: item.ordinal } });
  });
  await page.goto("/account"); await seedPortalSession(page, student); await page.goto("/attempt/" + attemptId);
  await expect(page.getByRole("button", { name: "Add images" })).toBeEnabled();
  return Object.assign(state, provider);
}

test("a student can correct a rejected image, retry a busy upload, and replace a confirmed page", async ({ page }) => {
  const state = await fixture(page), input = page.locator('input[type="file"]');
  await expect(page.getByText(/10 MB, 24 megapixels/)).toBeVisible();
  await input.setInputFiles({ name: "unsupported.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
  await expect(page.locator(".drawing-uploads").getByRole("status")).toContainText("still PNG, JPEG or WebP"); expect(state.uploads).toEqual([]);
  const file = { name: "drawing.png", mimeType: "image/png", buffer: await png() };
  state.nextError = "invalid_image";
  await input.setInputFiles(file);
  await expect(page.locator(".drawing-uploads").getByRole("status")).toContainText("An image could not be fully read");
  await expect(page.getByText("Private decoder implementation detail")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add images" })).toBeEnabled();
  expect(state.pages).toEqual([]);
  state.nextError = "drawing_busy";
  await input.setInputFiles(file);
  await expect(page.locator(".drawing-uploads").getByRole("status")).toContainText("Another image is being checked");
  await expect(page.getByRole("button", { name: "Add images" })).toBeEnabled();
  await input.setInputFiles(file);
  await expect(page.locator(".drawing-uploads").getByRole("status")).toContainText("Drawing images saved privately");
  await expect(page.getByText("drawing.png", { exact: true })).toBeVisible();
  expect(state.uploads.every(item => item.attemptId === attemptId && item.questionId === questionId && item.ordinal === 1)).toBe(true);
  await page.getByRole("button", { name: "Remove drawing.png" }).press("Enter");
  await expect(page.getByText("drawing.png", { exact: true })).toHaveCount(0);
  await input.setInputFiles({ ...file, name: "replacement.png" });
  await expect(page.getByText("replacement.png", { exact: true })).toBeVisible();
  expect(state.pages).toHaveLength(1); expect(state.pages[0].ordinal).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  expect(await page.evaluate(async () => (await window.axe.run(".drawing-uploads", {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  })).violations.map(item => item.id))).toEqual([]);
  await page.clock.fastForward(121_000);
  await expect(page.getByRole("region", { name: "Drawing upload window" })).toHaveCount(0);
  expect(state.pages).toHaveLength(1); expect(state.unexpected).toEqual([]);
});

test("an ambiguous upload receipt is reconciled from saved pages before another image is added", async ({ page }) => {
  const state = await fixture(page), input = page.locator('input[type="file"]');
  const file = { name: "first.png", mimeType: "image/png", buffer: await png() };
  state.loseReceipt = true;
  await input.setInputFiles(file);
  await expect(page.locator(".drawing-uploads").getByRole("status")).toContainText("An upload did not confirm");
  await expect(page.getByText("Image 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add images" })).toBeEnabled();
  await input.setInputFiles({ ...file, name: "second.png" });
  await expect(page.locator(".drawing-uploads").getByRole("status")).toContainText("Drawing images saved privately");
  expect(state.uploads.map(item => item.ordinal)).toEqual([1, 2]); expect(state.pages).toHaveLength(2);
  expect(state.unexpected).toEqual([]);
});

test("a logically removed drawing page can be replaced before the original cutoff while cleanup is pending", async ({ page }) => {
  const state = await fixture(page, { cleanupPending: true });
  const window = page.getByRole("region", { name: "Drawing upload window", exact: true });
  const input = window.locator('input[type="file"]');
  const notice = window.getByRole("status");
  const file = { name: "old-drawing.png", mimeType: "image/png", buffer: await png() };
  await input.setInputFiles(file);
  await expect(window.getByText(file.name, { exact: true })).toBeVisible();

  await page.clock.fastForward(60_000);
  const originalId = state.pages[0].id;
  await window.getByRole("button", { name: "Remove " + file.name, exact: true }).press("Enter");
  await expect(window.getByText(file.name, { exact: true })).toHaveCount(0);
  await expect(notice).toHaveText("Drawing image removed from your submission. Private file cleanup is still pending.");
  expect(state.removals).toHaveLength(1);
  expect(state.removals[0]).toMatchObject({ action: "remove", id: originalId });
  expect(state.pages).toEqual([]);

  await input.setInputFiles({ ...file, name: "replacement.png" });
  await expect(window.getByText("replacement.png", { exact: true })).toBeVisible();
  expect(state.uploads.map(({ ordinal }) => ordinal)).toEqual([1, 1]);
  expect(state.pages).toHaveLength(1);
  expect(state.pages[0].id).not.toBe(originalId);

  await page.clock.fastForward(61_000);
  await expect(window).toHaveCount(0);
  expect(state.pages).toHaveLength(1);
  expect(state.unexpected).toEqual([]);
});
