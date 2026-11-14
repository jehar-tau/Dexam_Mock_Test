import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { emptyAdminRead, portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";
import { orientationPages } from "./drawing-orientation-fixture.js";

test.use({ baseURL: portalFixtureURL });
const administrator = { id: "00000000-0000-4000-8000-000000000661", email: "community-review@example.invalid" };
const ids = {
  first: "80000000-0000-4000-8000-000000000661", second: "80000000-0000-4000-8000-000000000662",
  firstPost: "81000000-0000-4000-8000-000000000661", secondPost: "81000000-0000-4000-8000-000000000662",
  reply: "82000000-0000-4000-8000-000000000662", parent: "83000000-0000-4000-8000-000000000662",
};
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reviewRegion = page => page.getByRole("region", { name: "Community report review", exact: true });
const queueRegion = page => page.getByRole("region", { name: "Community moderation", exact: true });
const row = (page, n) => queueRegion(page).getByRole("article", { name: `Community report ${n}`, exact: true });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

async function fixture(page) {
  const samples = await orientationPages(6), sources = new Map();
  const image = (n, sample) => {
    const id = `84000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    sources.set(id, sample);
    return { id, ordinal: 1, mimeType: sample.mimeType, width: sample.width, height: sample.height, orientation: sample.orientation, available: true };
  };
  const content = (id, kind, body, assets) => ({ id, kind, body, title: kind === "post" ? "Fictional Community discussion" : null,
    status: "visible", exam: "uceed", topic: "observation", assets });
  const firstPost = content(ids.firstPost, "post", "Current fictional reported discussion.", [image(661, samples[0])]);
  const post = content(ids.secondPost, "post", "Complete fictional discussion context.", [image(662, samples[0])]);
  const target = content(ids.reply, "comment", "The exact fictional reported reply.", [image(663, samples[2])]);
  const parent = { ...content(ids.parent, "comment", "Hidden fictional immediate parent context.", [image(664, samples[1])]), status: "hidden" };
  const makeReport = (id, reported, discussion, parent) => ({ id, targetType: reported.kind, targetId: reported.id,
    reason: "answer_leak", details: "A fictional report note for human review.", createdAt: "2026-11-08T10:00:00Z",
    status: "open", resolution: null, reviewVersion: (id === ids.first ? "a" : "b").repeat(64), canDismiss: true,
    target: reported, post: discussion, parent, history: [{ id: "moderation:1", source: "moderation", action: "hide", note: null, createdAt: "2026-11-08T09:00:00Z" }],
    reporterId: "private-diagnostic-must-not-render" });
  const state = { allowed: true, full: new Map([[ids.first, makeReport(ids.first, firstPost, firstPost, null)],
    [ids.second, makeReport(ids.second, target, post, parent)]]), reads: [], mediaCalls: [], decisions: [], audits: [],
    readHolds: new Map(), mediaHold: null, decisionHold: null, failRead: null, failMedia: null, failDecision: null, ttl: 300000,
    completedReads: [], completedMedia: 0, completedDecisions: 0, bareMediaStatus: null, brokenImage: false };
  const list = () => [...state.full.values()].filter(item => item.status === "open").map(item => ({ id: item.id, targetType: item.targetType,
    reason: item.reason, details: item.details, contentStatus: item.target.status, content: item.target.body }));
  const provider = await stubPortalProvider(page, name => {
    if (name === "is_dmocks_admin") return state.allowed;
    if (name === "admin_community_report_queue") return list();
    return emptyAdminRead(name);
  });
  const fail = details => ({ code: details === "community_review_changed" ? "40001" : details === "community_review_unavailable" ? "42501" : "22023",
    details, message: "private-diagnostic-must-not-render" });
  const fulfill = async (route, value) => {
    try { await route.fulfill({ json: value, headers: cors, status: value?.code === "42501" ? 403 : value?.code ? 400 : 200 }); } catch { /* An aborted read has no visible completion. */ }
  };
  await page.route("**/rest/v1/rpc/admin_community_report", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const input = route.request().postDataJSON(), snapshot = structuredClone(state.full.get(input.p_report_id));
    state.reads.push(input); provider.calls.push(["admin_community_report", input]);
    const held = state.readHolds.get(input.p_report_id); if (held) await held.promise;
    await fulfill(route, !state.allowed || state.failRead ? fail(state.failRead || "community_review_unavailable") : snapshot);
    state.completedReads.push(input.p_report_id);
  });
  await page.route("**/rest/v1/rpc/admin_resolve_community_report", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const input = route.request().postDataJSON(); state.decisions.push(input); provider.calls.push(["admin_resolve_community_report", input]);
    const held = state.decisionHold; if (held) await held.promise;
    const report = state.full.get(input.p_report_id);
    try {
      if (!state.allowed || state.failDecision) return await fulfill(route, fail(state.failDecision || "community_review_unavailable"));
      if (report.status !== "open" || input.p_expected_version !== report.reviewVersion) return await fulfill(route, fail("community_review_changed"));
      report.status = "resolved"; report.resolution = input.p_resolution; state.audits.push(input);
      return await fulfill(route, null);
    } finally { state.completedDecisions++; }
  });
  await page.route("**/functions/v1/community-media", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const input = route.request().postDataJSON(); state.mediaCalls.push(input);
    const held = state.mediaHold; if (held) await held.promise;
    try {
      if(state.bareMediaStatus)return await route.fulfill({status:state.bareMediaStatus,headers:cors,body:"private-diagnostic-must-not-render"});
      if (!state.allowed || state.failMedia) return await fulfill(route, fail(state.failMedia || "community_review_unavailable"));
      const report = state.full.get(input.reportId), item = report[input.context];
      if (input.action !== "review" || input.reviewVersion !== report.reviewVersion) return await fulfill(route, fail("community_review_changed"));
      const media = item.assets.map(({ available, ...asset }) => ({ ...asset, url: `https://community-review-images.example.invalid/${asset.id}` }));
      return await fulfill(route, { media, serverNow: "2020-01-01T00:00:00.000Z", expiresAt: new Date(Date.parse("2020-01-01T00:00:00Z") + state.ttl).toISOString() });
    } finally { state.completedMedia++; }
  });
  await page.route("https://community-review-images.example.invalid/*", route => {
    if(state.brokenImage)return route.fulfill({body:Buffer.from("An invalid fictional raster"),contentType:"image/png"});
    const sample = sources.get(new URL(route.request().url()).pathname.slice(1));
    return route.fulfill({ body: Buffer.from(sample.url.split(",")[1], "base64"), contentType: sample.mimeType });
  });
  await page.goto("/account"); await seedPortalSession(page, administrator); await page.goto("/admin");
  await expect(queueRegion(page)).toBeVisible();
  return Object.assign(state, provider);
}

async function open(page, n = 1) {
  await row(page, n).getByRole("button", { name: "Review report", exact: true }).press("Enter");
  await expect(reviewRegion(page).getByText("Current content.", { exact: false })).toBeVisible();
}

test("a moderator inspects current hidden context and private images before a reasoned version-bound dismissal", async ({ page }) => {
  const state = await fixture(page);
  await expect(queueRegion(page).getByRole("button", { name: "Hide content", exact: true })).toHaveCount(0);
  await open(page, 2);
  const review = reviewRegion(page);
  await expect(review.getByRole("heading", { name: "Review Community report", exact: true })).toBeFocused();
  await expect(review.getByText("Hidden fictional immediate parent context.", { exact: true })).toBeVisible();
  await expect(review.getByRole("button", { name: "Dismiss report", exact: true })).toBeDisabled();
  await review.getByRole("button", { name: "Open private images", exact: true }).press("Enter");
  for (const name of ["Reported reply image 1", "Parent reply image 1", "Discussion image 1"]) {
    const image=review.locator(`img[alt="${name}"]`);await image.scrollIntoViewIfNeeded();await expect(image).toBeVisible();
  }
  await expect(review.getByRole("button", { name: "Refresh private images", exact: true })).toBeFocused();
  expect(state.mediaCalls.map(input => input.context)).toEqual(["target", "parent", "post"]);
  expect(state.mediaCalls.every(input => input.reportId === ids.second && input.reviewVersion === "b".repeat(64) && input.action === "review")).toBe(true);
  const inspect = review.getByRole("button", { name: "Inspect reported reply image 1", exact: true });
  await inspect.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Reported reply image 1", exact: true });
  await expect(dialog).toBeVisible(); await dialog.getByRole("button", { name: "Rotate right", exact: true }).press("Enter");
  await dialog.getByRole("button", { name: "Mirror view", exact: true }).press("Enter");
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(inspect).toBeFocused();
  await review.getByLabel("Review reason", { exact: true }).fill("        ");
  await review.getByRole("button", { name: "Hide content", exact: true }).click();
  await expect(review.getByRole("alert")).toHaveText("Enter a review reason of 8 to 1000 characters."); expect(state.decisions).toEqual([]);
  await review.getByLabel("Review reason", { exact: true }).fill("  The fictional evidence does not disclose an active answer.  ");
  await review.getByRole("button", { name: "Dismiss report", exact: true }).click();
  await expect(review).toHaveCount(0); await expect(queueRegion(page).getByText("Report review recorded.")).toBeVisible();
  expect(state.audits).toEqual([{ p_report_id: ids.second, p_expected_version: "b".repeat(64), p_resolution: "dismiss", p_note: "The fictional evidence does not disclose an active answer." }]);
  await expect(page.getByText("private-diagnostic-must-not-render", { exact: false })).toHaveCount(0);
  expect(state.unexpected).toEqual([]);
});

test("stale decisions clear private evidence and require explicit reopening with a fresh reason", async ({ page }) => {
  const state = await fixture(page); await open(page);
  const review = reviewRegion(page);
  await review.getByRole("button", { name: "Open private images", exact: true }).click();
  await expect(review.getByRole("img", { name: "Reported discussion image 1", exact: true })).toBeVisible();
  state.full.get(ids.first).reviewVersion = "c".repeat(64);
  await review.getByLabel("Review reason", { exact: true }).fill("Fictional evidence reviewed before the change.");
  await review.getByRole("button", { name: "Hide content", exact: true }).press("Enter");
  await expect(review.getByRole("alert")).toContainText("changed. Reopen");
  await expect(review.getByRole("button", { name: "Reopen report", exact: true })).toBeFocused();
  await expect(review.getByRole("img")).toHaveCount(0); await expect(review.getByLabel("Review reason", { exact: true })).toHaveCount(0);
  expect(state.reads).toHaveLength(1); expect(state.audits).toEqual([]);
  await review.getByRole("button", { name: "Reopen report", exact: true }).click();
  await expect(review.getByLabel("Review reason", { exact: true })).toHaveValue("");
  await expect(review.getByRole("img")).toHaveCount(0); expect(state.reads).toHaveLength(2);
  await review.getByLabel("Review reason", { exact: true }).fill("The updated fictional evidence requires containment.");
  await review.getByRole("button", { name: "Hide content", exact: true }).click();
  await expect(review).toHaveCount(0); expect(state.audits[0].p_expected_version).toBe("c".repeat(64));
  expect(state.unexpected).toEqual([]);
});

test("missing registered images prevent dismissal while allowing reasoned containment", async ({ page }) => {
  const state = await fixture(page), report = state.full.get(ids.first);
  report.target.assets[0].available = false; report.canDismiss = false;
  await open(page); const review = reviewRegion(page);
  await expect(review.getByText(/Some registered images/)).toBeVisible();
  await expect(review.getByRole("button", { name: "Dismiss report", exact: true })).toBeDisabled();
  await expect(review.getByRole("button", { name: "Open private images", exact: true })).toBeDisabled();
  await review.getByLabel("Review reason", { exact: true }).fill("Contain the fictional content while the image is checked.");
  await review.getByRole("button", { name: "Hide content", exact: true }).click();
  await expect(review).toHaveCount(0); expect(state.audits[0].p_resolution).toBe("hide"); expect(state.mediaCalls).toEqual([]);
});

test("server-derived expiry clears private images and the inspector until links are refreshed", async ({ page }) => {
  await page.clock.install({time:new Date()});
  const state = await fixture(page);
  state.ttl = 10000;
  await open(page);
  const review = reviewRegion(page);
  await review.getByRole("button", { name: "Open private images", exact: true }).click();
  await expect(review.getByRole("img", { name: "Reported discussion image 1", exact: true })).toBeVisible();
  await review.getByRole("button", { name: "Inspect reported discussion image 1", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.clock.runFor(state.ttl + 1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(review.getByRole("img")).toHaveCount(0);
  await expect(review.getByRole("status")).toContainText("links expired");
  await expect(review.getByRole("button", { name: "Dismiss report", exact: true })).toBeDisabled();
  state.ttl = 300000; await review.getByRole("button", { name: "Open private images", exact: true }).click();
  await expect(review.getByRole("img", { name: "Reported discussion image 1", exact: true })).toBeVisible();
  expect(state.mediaCalls).toHaveLength(2);
});

test("read and signing denials discard content and show no provider diagnostics", async ({ page }) => {
  const state = await fixture(page);
  const read = deferred();
  state.readHolds.set(ids.first, read);
  try {
    await row(page, 1).getByRole("button", { name: "Review report", exact: true }).click();
    await expect.poll(() => state.reads.length).toBe(1);
    state.allowed = false;
  } finally {
    state.readHolds.delete(ids.first);
    read.resolve();
  }
  const review = reviewRegion(page);
  await expect(page.getByRole("alert")).toContainText("Administrator access has ended");
  await expect(queueRegion(page)).toHaveCount(0);
  await expect(review.getByText("Current content.", { exact: false })).toHaveCount(0);
  state.allowed = true; await page.getByRole("button", { name: "Check administrator access", exact: true }).click(); await open(page);
  await expect(review.getByText("Current content.", { exact: false })).toBeVisible();
  state.failMedia = "community_review_unavailable";
  await review.getByRole("button", { name: "Open private images", exact: true }).click();
  await expect(review.getByRole("alert")).toContainText("review access has ended");
  await expect(review.getByRole("img")).toHaveCount(0);
  await expect(review.getByRole("button", { name: "Reopen report", exact: true })).toBeFocused();
  await expect(review.getByRole("button", { name: "Hide content", exact: true })).toHaveCount(0);
  await expect(page.getByText("private-diagnostic-must-not-render", { exact: false })).toHaveCount(0);
  state.failMedia = "community_review_incomplete";
  await review.getByRole("button", { name: "Reopen report", exact: true }).click();
  await review.getByRole("button", { name: "Open private images", exact: true }).click();
  await expect(review.getByRole("alert")).toContainText("private images are unavailable");
  await expect(review.getByRole("button", { name: "Hide content", exact: true })).toBeEnabled();
  await expect(review.getByRole("button", { name: "Dismiss report", exact: true })).toBeDisabled();
  expect(state.decisions).toEqual([]); expect(state.unexpected).toEqual([]);
});

test("late reads and signing cannot replace a later selected report or undo a close", async ({ page }) => {
  const state = await fixture(page), readHold = deferred(); state.readHolds.set(ids.first, readHold);
  await row(page, 1).getByRole("button", { name: "Review report", exact: true }).click();
  await expect.poll(() => state.reads.length).toBe(1);
  await open(page, 2); readHold.resolve();
  await expect.poll(() => state.completedReads.includes(ids.first)).toBe(true);
  await expect(reviewRegion(page).getByText("The exact fictional reported reply.", { exact: true })).toBeVisible();
  const signHold = deferred(); state.mediaHold = signHold;
  await reviewRegion(page).getByRole("button", { name: "Open private images", exact: true }).click();
  await expect.poll(() => state.mediaCalls.length).toBe(1);
  await reviewRegion(page).getByRole("button", { name: "Close report", exact: true }).click();
  await expect(row(page, 2).getByRole("button", { name: "Review report", exact: true })).toBeFocused();
  signHold.resolve(); await expect.poll(() => state.completedMedia).toBe(1); await expect(reviewRegion(page)).toHaveCount(0);
  await expect(page.getByRole("img", { name: /Reported .* image/ })).toHaveCount(0); expect(state.decisions).toEqual([]);
});

test("a late completed decision does not close a later report or bring back private evidence", async ({ page }) => {
  const state = await fixture(page), hold = deferred(); await open(page); state.decisionHold = hold;
  await reviewRegion(page).getByLabel("Review reason", { exact: true }).fill("Contain the fictional first discussion.");
  await reviewRegion(page).getByRole("button", { name: "Hide content", exact: true }).click();
  await expect.poll(() => state.decisions.length).toBe(1);
  await open(page, 2); hold.resolve();
  await expect.poll(() => state.audits.length).toBe(1);
  await expect.poll(() => state.completedDecisions).toBe(1);
  await expect(reviewRegion(page).getByText("The exact fictional reported reply.", { exact: true })).toBeVisible();
  await expect(reviewRegion(page).getByLabel("Review reason", { exact: true })).toHaveValue("");
});

test("account changes and navigation clear an open inspector and pending signing", async ({ page }) => {
  const state = await fixture(page); await open(page);
  await reviewRegion(page).getByRole("button", { name: "Open private images", exact: true }).click();
  await expect(reviewRegion(page).getByRole("img", { name: "Reported discussion image 1", exact: true })).toBeVisible();
  await reviewRegion(page).getByRole("button", { name: "Inspect reported discussion image 1", exact: true }).click();
  state.allowed = false;
  await seedPortalSession(page, { id: "00000000-0000-4000-8000-000000000669", email: "other-review@example.invalid" });
  await page.evaluate(() => { const key = "sb-dmocks-portal-fixture-auth-token", channel = new BroadcastChannel(key);
    channel.postMessage({ event: "SIGNED_IN", session: JSON.parse(localStorage.getItem(key)) }); channel.close(); });
  await expect(page.getByRole("dialog")).toHaveCount(0); await expect(reviewRegion(page)).toHaveCount(0);
  await expect(page.getByText("This account is not an administrator.")).toBeVisible();
  state.allowed = true; await page.goto("/admin"); await open(page);
  const hold = deferred(); state.mediaHold = hold;
  await reviewRegion(page).getByRole("button", { name: "Open private images", exact: true }).click();
  await expect.poll(() => state.mediaCalls.length).toBe(2);
  await page.goto("/"); hold.resolve();
  await expect.poll(() => state.completedMedia).toBe(2);
  await expect(reviewRegion(page)).toHaveCount(0); await expect(page.getByRole("img", { name: /Reported .* image/ })).toHaveCount(0);
});

test("long current content and review controls stay accessible at 320px in both themes", async ({ page }) => {
  const state = await fixture(page); await page.setViewportSize({ width: 320, height: 740 });
  state.full.get(ids.first).target.body = "FictionalLongWord".repeat(240);
  state.full.get(ids.first).details = "FictionalDetails".repeat(60);
  await open(page);
  await reviewRegion(page).getByRole("button", { name: "Open private images", exact: true }).click();
  await expect(reviewRegion(page).getByRole("img", { name: "Reported discussion image 1", exact: true })).toBeVisible();
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  for (let theme = 0; theme < 2; theme++) {
    await expect(reviewRegion(page).getByRole("button", { name: "Dismiss report", exact: true })).toHaveCSS("background-color",theme ? "rgb(220, 235, 161)" : "rgb(36, 71, 53)");
    expect(await page.evaluate(async () => (await window.axe.run(".community-moderation", {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    })).violations)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await reviewRegion(page).getByLabel("Review reason", { exact: true }).fill("Fictional accessible review reason.");
    await page.getByRole("switch", { name: "Dark mode", exact: true }).click();
  }
  await reviewRegion(page).getByRole("button", { name: "Close report", exact: true }).press("Enter");
  await expect(row(page, 1).getByRole("button", { name: "Review report", exact: true })).toBeFocused();
  expect(state.decisions).toEqual([]);
});


test("bare authorization failures clear private current content as well as images",async({page})=>{
 const state=await fixture(page);await open(page);const review=reviewRegion(page);
 for(const status of [401,403]){
  state.bareMediaStatus=status;await review.getByRole("button",{name:"Open private images",exact:true}).click();
  await expect(review.getByRole("alert")).toContainText("review access has ended");await expect(review.getByText("Current content.",{exact:false})).toHaveCount(0);await expect(review.getByRole("img")).toHaveCount(0);
  await expect(page.getByText("private-diagnostic-must-not-render",{exact:false})).toHaveCount(0);
  state.bareMediaStatus=null;await review.getByRole("button",{name:"Reopen report",exact:true}).click();await expect(review.getByLabel("Review reason",{exact:true})).toHaveValue("");
 }
 expect(state.decisions).toEqual([]);
});

test("an unreadable private image prevents dismissal and permits a refreshed image or containment",async({page})=>{
 const state=await fixture(page);state.brokenImage=true;await open(page);const review=reviewRegion(page);
 await review.getByRole("button",{name:"Open private images",exact:true}).click();await expect(review.getByRole("alert").filter({hasText:"could not be displayed"}).first()).toBeVisible();
 await expect(review.getByRole("button",{name:"Dismiss report",exact:true})).toBeDisabled();await expect(review.getByRole("button",{name:"Hide content",exact:true})).toBeEnabled();expect(state.decisions).toEqual([]);
 state.brokenImage=false;await review.getByRole("button",{name:"Refresh private images",exact:true}).click();await expect(review.getByRole("img",{name:"Reported discussion image 1",exact:true})).toBeVisible();await expect(review.getByRole("button",{name:"Dismiss report",exact:true})).toBeEnabled();
 await review.getByLabel("Review reason",{exact:true}).fill("The refreshed original fictional image is acceptable.");await review.getByRole("button",{name:"Dismiss report",exact:true}).click();await expect(review).toHaveCount(0);expect(state.audits).toHaveLength(1);
});
