import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

test.use({ baseURL: portalFixtureURL });
const first = { id: "00000000-0000-4000-8000-000000000281", email: "export-first@example.invalid" };
const second = { id: "00000000-0000-4000-8000-000000000282", email: "export-second@example.invalid" };
const payload = account => ({ schemaVersion: 2, exportedAt: "2026-11-07T07:00:00Z", accountId: account.id,
  profile: { user_id: account.id, display_name: "Fictional export student" },
  access: { orders: [], passes: [] }, learningProgress: [], community: { posts: [], comments: [] }, bugReports: [], drawingUploads: [],
  attempts: [{ id: "held-cohort-attempt", paper: "Fictional held paper", exam: "uceed", status: "submitted", score: null, total: null,
    resultsPending: true, responses: [{ questionId: "fixture-question", ordinal: 1, kind: "mcq", topic: "observation", answer: "B" }] }],
  results: { examMocks: [{ sessionId: "fixture-session", partAAttemptId: "held-cohort-attempt", partBAttemptId: null, exam: "uceed", state: "review_pending", resultsPending: true,
    objectiveScore: null, objectiveTotal: null, drawingScore: null, drawingTotal: null, combinedScore: null, combinedTotal: null }], allIndia: [], drawingReviews: [] },
  questionReports: [{ id: "own-report", attemptId: "held-cohort-attempt", questionId: "fixture-question", reason: "incorrect", details: "My fictional report text.", createdAt: "2026-11-07T06:00:00Z" }],
});

async function fixture(page) {
  const state = { account: first, response: null };
  state.response = () => payload(state.account);
  const provider = await stubPortalProvider(page, procedure => {
    switch (procedure) {
      case "my_privacy_requests": return [];
      case "can_review_drawings": return false;
      case "export_my_account_data": return state.response();
      case "logout": return null;
    }
  });
  await page.goto("/account");
  await seedPortalSession(page, state.account);
  await page.reload();
  await expect(page.getByRole("region", { name: "Your data and account", exact: true })).toBeVisible();
  return Object.assign(state, provider);
}

async function downloadJSON(page) {
  const promised = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my data", exact: true }).click();
  const download = await promised;
  expect(download.suggestedFilename()).toMatch(/^dmocks-account-export-\d{4}-\d{2}-\d{2}\.json$/);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

test("actual account downloads retain owned answers and reports while scores follow server release", async ({ page }) => {
  const state = await fixture(page);
  const region = page.getByRole("region", { name: "Your data and account", exact: true });
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  expect(await page.evaluate(async () => (await window.axe.run(".account-privacy", {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  })).violations)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  const held = await downloadJSON(page);
  expect(held.accountId).toBe(first.id);
  expect(held.attempts[0]).toMatchObject({ score: null, total: null, resultsPending: true });
  expect(held.attempts[0].responses[0].answer).toBe("B");
  expect(held.questionReports[0].details).toBe("My fictional report text.");
  expect(held.questionReports[0]).not.toHaveProperty("targetKey");
  expect(held.results.examMocks[0].combinedScore).toBeNull();
  await expect(region.getByRole("status")).toContainText("downloaded to this device");
  state.response = () => {
    const data = payload(state.account);
    data.exportedAt = "2026-11-07T07:15:00Z";
    data.attempts[0] = { ...data.attempts[0], score: 16, total: 24, resultsPending: false };
    data.results.examMocks = [];
    data.results.allIndia = [{ eventId: "event", attemptId: "held-cohort-attempt", releasedAt: "2026-11-07T07:10:00Z", score: 16, total: 24, rank: 1, alias: "Candidate 101", cohortSize: 12 }];
    return data;
  };
  const released = await downloadJSON(page);
  expect(released.attempts[0]).toMatchObject({ score: 16, resultsPending: false });
  expect(released.results.allIndia[0].rank).toBe(1);
  expect(state.calls.filter(([name]) => name === "export_my_account_data")).toHaveLength(2);
  expect(state.calls.some(([name]) => ["request_account_deletion", "prepare_order"].includes(name))).toBe(false);
  expect(state.unexpected).toEqual([]);
});

test("legacy, mis-scoped, held-score and failed export responses save no file and allow retry", async ({ page }) => {
  const state = await fixture(page);
  const downloads = [];
  page.on("download", download => downloads.push(download));
  const region = page.getByRole("region", { name: "Your data and account", exact: true });
  const cases = [
    () => ({ ...payload(first), schemaVersion: 1 }),
    () => payload(second),
    () => { const data = payload(first);data.attempts[0].score = 16;return data; },
    () => { const data = payload(first);data.questionReports[0].contentVersion = "private-review-hash";return data; },
  ];
  for (const response of cases) {
    state.response = response;
    await region.getByRole("button", { name: "Download my data", exact: true }).click();
    await expect(region.getByRole("status")).toHaveText("Your export could not be verified. Refresh your account and try again.");
    await expect(region.getByRole("button", { name: "Download my data", exact: true })).toBeEnabled();
  }
  state.response = () => ({ code: "P0001", message: "Fictional export temporarily unavailable" });
  await region.getByRole("button", { name: "Download my data", exact: true }).click();
  await expect(region.getByRole("status")).toHaveText("Couldn’t prepare your export. Try downloading your data again.");
  expect(downloads).toHaveLength(0);
  state.response = () => payload(first);
  expect((await downloadJSON(page)).accountId).toBe(first.id);
  expect(downloads).toHaveLength(1);
  expect(state.unexpected).toEqual([]);
});

test("leaving an account cancels its pending export before a different account downloads data", async ({ page }) => {
  const state = await fixture(page);
  const downloads = [], failed = [];
  page.on("download", download => downloads.push(download));
  page.on("requestfailed", request => { if (request.url().endsWith("/export_my_account_data")) failed.push(request); });
  let release, began;
  const pending = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { began = resolve; });
  const routePattern = "https://dmocks-portal-fixture.supabase.co/rest/v1/rpc/export_my_account_data";
  await page.route(routePattern, async route => {
    const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    began();await pending;
    await route.fulfill({ headers, json: payload(first) }).catch(() => {});
  });
  await page.getByRole("button", { name: "Download my data", exact: true }).click();
  await started;
  await expect(page.getByRole("button", { name: "Preparing your data…", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("region", { name: "Your data and account", exact: true })).toHaveCount(0);
  release();
  await expect.poll(() => failed.length).toBeGreaterThan(0);
  expect(downloads).toHaveLength(0);
  await page.unroute(routePattern);
  state.account = second;
  await seedPortalSession(page, second);
  await page.reload();
  expect((await downloadJSON(page)).accountId).toBe(second.id);
  expect(downloads).toHaveLength(1);
  expect(state.unexpected).toEqual([]);
});
