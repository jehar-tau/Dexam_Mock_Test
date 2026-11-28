import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { portalFixtureURL, seedPortalSession, stubPortalIdentity } from "./portal-fixture.js";
import { communityFeedFixture } from "./community-feed-fixture.js";

test.use({ baseURL: portalFixtureURL });
const actor = { id: "00000000-0000-4000-8000-000000000701", email: "community-reporting@example.invalid" };
const postId = "10000000-0000-4000-8000-000000000701";
const commentIds = [1, 2, 3, 4].map(n => `20000000-0000-4000-8000-${String(700 + n).padStart(12, "0")}`);
const api = "https://dmocks-portal-fixture.supabase.co";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const dialog = page => page.getByRole("dialog", { name: "Report community content", exact: true });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const recordKey = (id, user = actor.id) => `${user}:${id}`;

async function fixture(page, { long = false } = {}) {
  const post = { id: postId, exam: "uceed", topic: "observation", title: long ? "FictionalTitle".repeat(12).slice(0,160) : "A fictional discussion for reporting",
    body: "We compare original fictional methods without disclosing active assessment answers.", status: "visible", assetCount: 0,
    author: "Fictional member", comments: 4 };
  const comments = commentIds.map((id, index) => ({ id, parentId: index === 1 ? commentIds[0] : null,
    body: `Original fictional reply ${index + 1} for this exact target.`, author: `Fictional member ${index + 1}`, helpful: 0,
    isMine: false, markedHelpful: false, canReply: true, parentAvailable: index === 1,
    parentPreview: index === 1 ? { author: "Fictional member 1", body: "Original fictional reply 1 for this exact target." } : null, assetCount: 0 }));
  const state = { post, comments, reportCalls: [], calls: [], records: new Map(), accepted: 0, lostNext: false,
    holdNext: null, completed: 0, rejection: null };
  const known = {
    community_report_exists: "23505", community_report_limit: "P0001", community_report_unavailable: "42501",
    community_report_invalid: "22023", community_report_sign_in: "42501",
  };
  await page.route(api + "/rest/v1/rpc/**", async route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const name = new URL(request.url()).pathname.split("/").at(-1), input = request.postDataJSON();
    state.calls.push([name, input]);
    if (name === "report_community_content") {
      state.reportCalls.push(input);
      const jwt = request.headers().authorization?.split(" ")[1];
      const account = jwt ? JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).sub : actor.id;
      const key = recordKey(input.p_post_id ?? input.p_comment_id, account), existing = state.records.has(key);
      let rejection = existing ? "community_report_exists" : state.rejection;
      if (!rejection) { state.records.set(key, Object.freeze({ ...input })); state.accepted++; }
      const held = state.holdNext; state.holdNext = null;
      const lost = state.lostNext; state.lostNext = false;
      if (held) await held.promise;
      try {
        if (lost) return await route.abort();
        return await route.fulfill({ headers, status: rejection ? known[rejection] === "42501" ? 403 : 400 : 200,
          json: rejection ? { code: known[rejection], details: rejection, message: "private-report-diagnostic-must-not-render" } : null });
      } catch { /* Closing the dialog may abort the owned request. */ }
      finally { state.completed++; }
      return;
    }
    let value;
    if (name === "community_feed") value = communityFeedFixture([post],input);
    else if (name === "community_thread" || name === "community_reply_context") value = { ...post, comments, version: 1, nextCursor: null,
      ...(input.p_anchor_id ? { anchorId: input.p_anchor_id, hasEarlier: false } : {}) };
    else if (name === "public_all_india_top_ten") value = [];
    else throw new Error("Unexpected fictional procedure: " + name);
    return route.fulfill({ headers, json: value });
  });
  await stubPortalIdentity(page); await page.goto("/account"); await seedPortalSession(page, actor); await page.goto("/dashboard/community/discussions");
  await page.getByRole("button", { name: "Open discussion", exact: true }).click();
  await expect(page.getByRole("region", { name: "Discussion thread", exact: true })).toBeVisible();
  return state;
}

async function openReport(page, reply = null) {
  const opener = reply === null ? page.getByRole("button", { name: "Report discussion", exact: true }) :
    page.locator(`#community-comment-${reply}`).getByRole("button", { name: "Report", exact: true });
  await opener.press("Enter"); await expect(dialog(page)).toBeVisible();
  return opener;
}
const send = page => dialog(page).getByRole("button", { name: "Send report", exact: true });

test("discussion and exact replies send each established reason only after Send report", async ({ page }) => {
  const state = await fixture(page), reasons = ["spam", "abuse", "copyright", "answer_leak", "other"];
  for (const [index, reason] of reasons.entries()) {
    const reply = index ? commentIds[index - 1] : null;
    const opener = await openReport(page, reply);
    await dialog(page).getByLabel("Report reason", { exact: true }).selectOption(reason);
    const details = index % 2 ? `  Fictional context for ${reason}.  ` : "   ";
    await dialog(page).getByLabel("Details (optional)", { exact: true }).fill(details);
    expect(state.reportCalls).toHaveLength(index);
    await send(page).press("Enter");
    await expect(dialog(page).getByRole("status")).toHaveText("Report sent for moderator review.");
    await expect(dialog(page)).toBeVisible();
    expect(state.reportCalls[index]).toEqual({ p_post_id: reply ? null : postId, p_comment_id: reply,
      p_reason: reason, p_details: details.trim() || null });
    await dialog(page).getByRole("button", { name: "Close", exact: true }).press("Enter");
    await expect(dialog(page)).toHaveCount(0); await expect(opener).toBeFocused();
  }
  expect(state.accepted).toBe(5);
});

test("an unknown acknowledgement freezes the original payload and retry confirms one existing report", async ({ page }) => {
  const state = await fixture(page); state.lostNext = true;
  await openReport(page, commentIds[1]);
  await dialog(page).getByLabel("Report reason", { exact: true }).selectOption("copyright");
  await dialog(page).getByLabel("Details (optional)", { exact: true }).fill("  Original fictional permission concern.  ");
  await send(page).click();
  await expect(dialog(page).getByRole("status")).toContainText("may already be saved");
  await expect(dialog(page).getByLabel("Report reason", { exact: true })).toBeDisabled();
  await expect(dialog(page).getByLabel("Details (optional)", { exact: true })).toBeDisabled();
  await dialog(page).getByRole("button", { name: "Retry report", exact: true }).click();
  await expect(dialog(page).getByRole("status")).toContainText("already reported this content from this account");
  await expect(dialog(page).getByRole("status")).toContainText("earlier reason and details remain unchanged");
  expect(state.reportCalls).toHaveLength(2); expect(state.reportCalls[1]).toEqual(state.reportCalls[0]);
  expect(state.accepted).toBe(1); expect(state.records.size).toBe(1);
  await expect(dialog(page).getByRole("button", { name: "Send report", exact: true })).toHaveCount(0);
});

test("a duplicate receipt does not claim new reason or details replaced the original report", async ({ page }) => {
  const state = await fixture(page), previous = { p_post_id: postId, p_comment_id: null, p_reason: "spam", p_details: "Previous fictional report." };
  state.records.set(recordKey(postId), previous); state.rejection = "community_report_limit";
  await openReport(page);
  await dialog(page).getByLabel("Report reason", { exact: true }).selectOption("abuse");
  await dialog(page).getByLabel("Details (optional)", { exact: true }).fill("New text that must not overwrite the existing report.");
  await send(page).click();
  await expect(dialog(page).getByRole("status")).toContainText("earlier reason and details remain unchanged");
  expect(state.records.get(recordKey(postId))).toEqual(previous); expect(state.accepted).toBe(0);
  await expect(dialog(page).getByText("private-report-diagnostic-must-not-render", { exact: false })).toHaveCount(0);
});

test("known limits, unavailable targets and sign-in errors release fields without losing entered text", async ({ page }) => {
  const state = await fixture(page); await openReport(page, commentIds[2]);
  await dialog(page).getByLabel("Report reason", { exact: true }).selectOption("copyright");
  const details = "  Keep this fictional report text after a known rejection.  ";
  await dialog(page).getByLabel("Details (optional)", { exact: true }).fill(details);
  for (const [rejection, message] of [["community_report_limit", "report limit"], ["community_report_unavailable", "unavailable for a new report"],
    ["community_report_invalid", "1000 characters"], ["community_report_sign_in", "Sign in again"]]) {
    state.rejection = rejection; await send(page).click();
    await expect(dialog(page).getByRole("alert")).toContainText(message);
    await expect(dialog(page).getByLabel("Report reason", { exact: true })).toBeEnabled();
    await expect(dialog(page).getByLabel("Report reason", { exact: true })).toHaveValue("copyright");
    await expect(dialog(page).getByLabel("Details (optional)", { exact: true })).toHaveValue(details);
  }
  expect(state.accepted).toBe(0); state.rejection = null;
  await dialog(page).getByLabel("Report reason", { exact: true }).selectOption("other");
  await send(page).click(); await expect(dialog(page).getByRole("status")).toHaveText("Report sent for moderator review.");
  expect(state.accepted).toBe(1);
  await expect(page.getByText("private-report-diagnostic-must-not-render", { exact: false })).toHaveCount(0);
});

test("the native dialog traps keyboard focus and Escape restores the original opener without a report", async ({ page }) => {
  const state = await fixture(page), opener = await openReport(page, commentIds[0]);
  const reason = dialog(page).getByLabel("Report reason", { exact: true });
  await expect(reason).toBeFocused(); await page.keyboard.press("Shift+Tab");
  await expect(dialog(page).getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(reason).toBeFocused();
  await page.keyboard.press("Escape"); await expect(dialog(page)).toHaveCount(0); await expect(opener).toBeFocused();
  expect(state.reportCalls).toEqual([]);
});

test("a sending guard accepts one request and success remains open until the student closes", async ({ page }) => {
  const state = await fixture(page), held = deferred(); state.holdNext = held;
  await openReport(page); await send(page).click();
  await expect.poll(() => state.reportCalls.length).toBe(1);
  await dialog(page).evaluate(element => element.querySelector("form").requestSubmit());
  expect(state.reportCalls).toHaveLength(1);
  held.resolve(); await expect(dialog(page).getByRole("status")).toHaveText("Report sent for moderator review.");
  await expect(dialog(page)).toBeVisible(); expect(state.accepted).toBe(1);
});

test("closing an in-flight report ignores its late success and cannot close a later dialog", async ({ page }) => {
  const state = await fixture(page), held = deferred(); state.holdNext = held;
  await openReport(page); await send(page).click(); await expect.poll(() => state.reportCalls.length).toBe(1);
  await dialog(page).getByRole("button", { name: "Close", exact: true }).click(); await expect(dialog(page)).toHaveCount(0);
  await openReport(page, commentIds[3]);
  held.resolve(); await expect.poll(() => state.completed).toBe(1);
  await expect(dialog(page).getByLabel("Report reason", { exact: true })).toHaveValue("other");
  await expect(dialog(page).getByLabel("Details (optional)", { exact: true })).toHaveValue("");
  await expect(dialog(page).getByText("Report sent for moderator review.", { exact: true })).toHaveCount(0);
  await send(page).click(); await expect(dialog(page).getByRole("status")).toHaveText("Report sent for moderator review.");
  expect(state.reportCalls[1]).toEqual({ p_post_id: null, p_comment_id: commentIds[3], p_reason: "other", p_details: null });
});

test("account changes and navigation discard pending outcomes without reopening the reporting dialog", async ({ page }) => {
  const state = await fixture(page), held = deferred(); state.holdNext = held;
  await openReport(page); await send(page).click(); await expect.poll(() => state.reportCalls.length).toBe(1);
  await seedPortalSession(page, { id: "00000000-0000-4000-8000-000000000709", email: "other-reporting@example.invalid" });
  await page.evaluate(() => { const key = "sb-dmocks-portal-fixture-auth-token", channel = new BroadcastChannel(key);
    channel.postMessage({ event: "SIGNED_IN", session: JSON.parse(localStorage.getItem(key)) }); channel.close(); });
  await expect(dialog(page)).toHaveCount(0); held.resolve(); await expect.poll(() => state.completed).toBe(1);
  await expect(page.getByText("Report sent for moderator review.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Open discussion", exact: true }).click();
  const next = deferred(); state.holdNext = next;
  await openReport(page, commentIds[0]); await send(page).click(); await expect.poll(() => state.reportCalls.length).toBe(2);
  await page.goto("/"); next.resolve(); await expect.poll(() => state.completed).toBe(2);
  await expect(dialog(page)).toHaveCount(0); await expect(page.getByText("Report sent for moderator review.", { exact: true })).toHaveCount(0);
});

test("long labels and optional details reflow at 320px with accessible controls in both themes", async ({ page }) => {
  const state = await fixture(page, { long: true }); await page.setViewportSize({ width: 320, height: 740 });
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  for (let theme = 0; theme < 2; theme++) {
    await openReport(page); await dialog(page).getByLabel("Report reason", { exact: true }).selectOption("copyright");
    await dialog(page).getByLabel("Details (optional)", { exact: true }).fill("DetailedFictionalNote".repeat(50));
    expect(await page.evaluate(async () => (await window.axe.run(".community-report-dialog", {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    })).violations)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect(await dialog(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("switch", { name: "Dark mode", exact: true }).click();
  }
  expect(state.reportCalls).toEqual([]);
});
