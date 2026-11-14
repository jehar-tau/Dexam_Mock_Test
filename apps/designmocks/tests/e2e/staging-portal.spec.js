import { realpath } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import project from "../../supabase/project.json" with { type: "json" };
import { serveArtifact } from "./local-artifact-fixture.js";
import { communityFeedFixture } from "./community-feed-fixture.js";
import { seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

const stage = project.staging_frontend_origin;
const publicHosts = [project.frontend_origin, "https://designmocks-studio.snehal1155.chatgpt.site"];
const stagedArtifact = "http://127.0.0.1:4699";
const artifactSite = process.env.DMOCKS_STAGING_ARTIFACT_SITE;
const provider = `https://${project.project_ref}.supabase.co`;
const tester = { id: "00000000-0000-4000-8000-000000000098", email: "staging-fixture@example.invalid" };
test.use({ baseURL: stage, serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  const site = artifactSite ? await realpath(artifactSite) : null;
  await page.route("**/*", (route) => route.abort());
  // Deliver the local artifact on both hostnames without visiting either hosted site.
  await page.route(url => [stage, ...publicHosts].includes(url.origin), async route => {
    const url = new URL(route.request().url());
    if (site) return serveArtifact(route, site, url);
    const response = await route.fetch({ url: stagedArtifact + url.pathname + url.search, maxRedirects: 0 });
    return route.fulfill({ response });
  });
});

test("the staging artifact rejects a different host before contacting the provider", async ({ page }) => {
  const { calls, unexpected, authCalls } = await stubPortalProvider(page, () => undefined, project.project_ref);
  for (const origin of publicHosts) {
    await page.goto(origin + "/account");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    await expect(page.getByText("PRIVATE STAGING", { exact: false })).toHaveCount(0);
    await seedPortalSession(page, tester, project.project_ref);
    await page.goto(origin + "/dashboard");
    await expect(page.getByRole("heading", { name: "One account. Your own progress." })).toBeVisible();
  }
  expect(calls).toEqual([]);
  expect(authCalls).toEqual([]);
  expect(unexpected).toEqual([]);
});

test("the private staging home never requests the public ranking feed", async ({ page }) => {
  const { calls, unexpected } = await stubPortalProvider(page, name => {
    if (name === "public_all_india_top_ten") return [];
  }, project.project_ref);
  await page.goto("/");
  await expect(page.getByText("Portal acceptance for approved testers. Checkout is closed.")).toBeVisible();
  await seedPortalSession(page, tester, project.project_ref);
  await page.reload();
  await expect(page.getByText("Portal acceptance for approved testers. Checkout is closed.")).toBeVisible();
  await page.getByRole("link", { name: "Explore the annual pass", exact: true }).click();
  await expect(page).toHaveURL(/\/plans$/);
  expect(calls).toEqual([]);
  expect(unexpected).toEqual([]);
});

test("approved staging sessions can enter the workspace with checkout and draft terms closed", async ({ page }) => {
  let admitted = true;
  const { calls, unexpected } = await stubPortalProvider(page, (procedure) => {
    switch (procedure) {
      case "can_enter_staging_portal": return admitted;
      case "can_review_drawings": return false;
      case "my_privacy_requests":
      case "learning_catalog":
      case "available_papers":
      case "my_attempt_history": return [];
      case "learning_progress": return [];
      case "my_pass": return { active: false, expiresAt: null };
      case "finalize_my_expired_attempts": return 0;
      case "my_overview_analytics": return { completed: 0, waitingForResults: 0, objectiveAccuracy: null, objectiveAnswered: 0,
        topics: [], exams: [], drawingReviews: { pending: 0, released: 0 } };
      default: return undefined;
    }
  }, project.project_ref);
  let oauth;
  await page.route(`${provider}/auth/v1/authorize?*`, async (route) => {
    const url = new URL(route.request().url());
    oauth = Object.fromEntries(url.searchParams);
    await route.fulfill({ status: 200, contentType: "text/html", body: "<p>Fictional Google authorization endpoint.</p>" });
  });
  await page.goto("/dashboard");
  await expect(page.getByText("Sign in with an approved Google test account.")).toBeVisible();
  expect(calls).toEqual([]);
  await page.getByRole("link", { name: "Go to account" }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign in to staging with Google" }).click();
  await expect(page.getByText("Fictional Google authorization endpoint.")).toBeVisible();
  expect(oauth).toMatchObject({ provider: "google", redirect_to: `${stage}/account/callback`, scopes: "openid email profile" });
  expect(oauth.code_challenge).toMatch(/^[a-z0-9_-]{43}$/i);
  await page.goto("/account?error=access_denied");
  await expect(page.getByRole("alert")).toContainText("Google sign-in was cancelled");
  await seedPortalSession(page, tester, project.project_ref);
  await page.evaluate(() => sessionStorage.setItem("designmocks-pending-terms", "fictional-draft-terms"));
  await page.goto("/account");
  await page.getByRole("link", { name: "Open staging workspace" }).click();
  await expect(page.getByRole("heading", { name: /Welcome to your next attempt/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not active" })).toBeVisible();
  expect(calls.filter(([name]) => name === "can_enter_staging_portal").length).toBeGreaterThanOrEqual(2);

  const menu = page.getByRole("button", { name: "Student menu" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("navigation", { name: "Student workspace" }).getByRole("link", { name: "Learn" }).click();
  await expect(page.getByRole("heading", { name: /Build the idea/ })).toBeVisible();
  const programmes = page.getByLabel("Interactive programmes");
  await programmes.locator("article", { hasText: "Cube nets" }).getByRole("link", { name: "Start programme" }).click();
  await expect(page).toHaveURL(/\/dashboard\/learn\/programme\/cube-nets$/);
  await expect(page.getByRole("heading", { name: "Cube nets", exact: true })).toBeVisible();
  await page.goto("/dashboard/learn");
  await programmes.locator("article", { hasText: "Gears, belts and levers" }).getByRole("link", { name: "Start programme" }).click();
  await expect(page).toHaveURL(/\/dashboard\/learn\/programme\/mechanisms$/);
  const mechanismsHeading = page.getByRole("heading", { name: "Gears, belts and levers", exact: true });
  await expect(mechanismsHeading).toBeVisible();
  admitted = false;
  await page.reload();
  await expect(page.getByText("Staging access is closed for this account.")).toBeVisible();
  await expect(mechanismsHeading).toHaveCount(0);
  await page.goto("/plans");
  await expect(page.getByText("Checkout is closed in staging.", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Pay .* with Razorpay/ })).toBeDisabled();
  expect(await page.evaluate(() => sessionStorage.getItem("designmocks-pending-terms"))).toBe("fictional-draft-terms");
  expect(unexpected).toEqual([]);
});

test("an unavailable admission check keeps returning accounts out of protected routes", async ({ page }) => {
  const { calls, unexpected } = await stubPortalProvider(page, (procedure) =>
    procedure === "can_enter_staging_portal" ? { code: "PGRST202", message: "Fixture migration missing" } : undefined,
  project.project_ref);
  await page.goto("/account");
  await seedPortalSession(page, tester, project.project_ref);
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Couldn’t verify staging access.");
  await expect(page.getByRole("link", { name: "Open staging workspace" })).toHaveCount(0);
  await expect(page.getByText("Your data and account")).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByRole("alert")).toContainText("Couldn’t verify staging access.");
  await expect(page.getByRole("heading", { name: "Admin review." })).toHaveCount(0);
  expect(calls.every(([name]) => name === "can_enter_staging_portal")).toBe(true);
  expect(unexpected).toEqual([]);
});

test("the API admission hook denial keeps a returning account out of staging", async ({page}) => {
  const {calls, unexpected} = await stubPortalProvider(page, procedure =>
    procedure === "can_enter_staging_portal"
      ? {code: "42501", message: "Private staging requires an approved Google tester"} : undefined,
  project.project_ref);
  await page.goto("/account");
  await seedPortalSession(page, tester, project.project_ref);
  await page.goto("/dashboard");
  await expect(page.getByText("Staging access is closed for this account.")).toBeVisible();
  await expect(page.getByRole("heading", {name: /Welcome to your next attempt/})).toHaveCount(0);
  expect(calls.map(([name]) => name)).toEqual(["can_enter_staging_portal"]);
  expect(unexpected).toEqual([]);
});

test("staging admission alone grants neither administrator nor drawing-review access", async ({page}) => {
  let reviewer = false;
  const {calls, unexpected} = await stubPortalProvider(page, procedure => {
    if (procedure === "can_enter_staging_portal") return true;
    if (procedure === "is_dmocks_admin") return false;
    if (procedure === "can_review_drawings") return reviewer;
    if (procedure === "my_drawing_review_page" && reviewer) return {items: [], nextCursor: null};
    return undefined;
  }, project.project_ref);
  await page.goto("/account");
  await seedPortalSession(page, tester, project.project_ref);

  await page.goto("/review/drawings");
  await expect(page.getByRole("alert")).toHaveText("Drawing reviewer access required.");
  expect(calls.some(([name]) => name === "my_drawing_review_page")).toBe(false);

  reviewer = true;
  await page.getByRole("button", {name: "Check drawing reviewer access"}).click();
  await expect(page.getByRole("button", {name: "Available drawings"})).toBeVisible();
  await expect.poll(() => calls.filter(([name]) => name === "my_drawing_review_page").length).toBe(1);

  await page.goto("/admin");
  await expect(page.getByRole("alert")).toHaveText("This account is not an administrator.");
  expect(calls.some(([name]) => name.startsWith("admin_"))).toBe(false);
  expect(unexpected).toEqual([]);
});

test("a stalled identity check expires without opening staging when it replies late", async ({page}) => {
  const {calls, unexpected} = await stubPortalProvider(page, procedure =>
    procedure === "can_enter_staging_portal" ? true : undefined, project.project_ref);
  await page.goto("/account");
  await seedPortalSession(page, tester, project.project_ref);
  await page.clock.install();

  let release;
  const reply = new Promise(resolve => { release = resolve; });
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  const identityUrl = `${provider}/auth/v1/user`;
  await page.route(identityUrl, async route => {
    markStarted();
    await reply;
    await route.fallback();
  });

  try {
    await page.goto("/dashboard");
    await started;
    await expect(page.getByText("Checking staging access…")).toBeVisible();
    await page.clock.fastForward(21_000);
    await expect(page.getByRole("alert")).toContainText("Couldn’t verify staging access.");
    const lateIdentity = page.waitForResponse(response => response.url() === identityUrl && response.ok());
    release();
    await lateIdentity;
  } finally {
    release();
  }
  await expect(page.getByRole("alert")).toContainText("Couldn’t verify staging access.");
  expect(calls).toEqual([]);
  expect(unexpected).toEqual([]);
});

test("an admitted tester can open Community and loses access after revocation", async ({page}) => {
  let admitted = true;
  const {calls, unexpected} = await stubPortalProvider(page, (procedure, input) => {
    if (procedure === "can_enter_staging_portal") {
      return admitted || {code: "42501", message: "Private staging requires an approved Google tester"};
    }
    if (procedure === "community_feed") return communityFeedFixture([], input);
    return undefined;
  }, project.project_ref);
  await page.goto("/account");
  await seedPortalSession(page, tester, project.project_ref);
  await page.goto("/dashboard/community");
  await expect(page.getByRole("heading", {name: /Ask clearly/})).toBeVisible();
  await expect(page.getByText("No discussions match these filters.")).toBeVisible();
  expect(calls.filter(([name]) => name === "community_feed")).toHaveLength(1);

  admitted = false;
  calls.length = 0;
  await page.reload();
  await expect(page.getByText("Staging access is closed for this account.")).toBeVisible();
  await expect(page.getByRole("heading", {name: /Ask clearly/})).toHaveCount(0);
  expect(calls.map(([name]) => name)).toEqual(["can_enter_staging_portal"]);
  expect(unexpected).toEqual([]);
});

test("a removed staff tester cannot reopen teacher or admin work with the same session", async ({page}) => {
  let admitted = true;
  const {calls, unexpected} = await stubPortalProvider(page, procedure => {
    if (procedure === "can_enter_staging_portal") {
      return admitted || {code: "42501", message: "Private staging requires an approved Google tester"};
    }
    if (procedure === "can_review_drawings" || procedure === "is_dmocks_admin") return true;
    if (procedure === "my_drawing_review_page") return {items: [], nextCursor: null};
    return undefined;
  }, project.project_ref);
  await page.goto("/account");
  await seedPortalSession(page, tester, project.project_ref);
  await page.goto("/review/drawings");
  await expect(page.getByText("No drawing submissions await review.")).toBeVisible();
  expect(calls.some(([name]) => name === "can_review_drawings")).toBe(true);

  admitted = false;
  for (const path of ["/review/drawings", "/admin"]) {
    calls.length = 0;
    await page.goto(path);
    await expect(page.getByText("Staging access is closed for this account.")).toBeVisible();
    await expect(page.getByRole("button", {name: "Available drawings"})).toHaveCount(0);
    expect(calls.map(([name]) => name)).toEqual(["can_enter_staging_portal"]);
  }
  expect(unexpected).toEqual([]);
});
