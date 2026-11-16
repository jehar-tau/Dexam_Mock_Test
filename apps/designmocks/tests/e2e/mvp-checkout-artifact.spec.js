import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import project from "../../supabase/project.json" with { type: "json" };
import { readPublishedNotices } from "../../scripts/published-notices.mjs";
import { serveArtifact } from "./local-artifact-fixture.js";
import { seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

const frontend = project.frontend_origin;
const wrongFrontend = project.staging_frontend_origin;
const provider = `https://${project.project_ref}.supabase.co`;
const suppliedSite = process.env.DMOCKS_CHECKOUT_ARTIFACT_SITE;
const app = fileURLToPath(new URL("../../", import.meta.url));
const buyer = { id: "00000000-0000-4000-8000-000000001981", email: "checkout-artifact@example.invalid" };
const pay = page => page.getByRole("button", { name: "Pay ₹1,193 with Razorpay", exact: true });

let scratch, site, expectedVersion;
test.use({ baseURL: frontend, serviceWorkers: "block" });

test.beforeAll(async () => {
  if (suppliedSite !== undefined) {
    if (!isAbsolute(suppliedSite)) throw new Error("DMOCKS_CHECKOUT_ARTIFACT_SITE must be absolute");
    site = await realpath(suppliedSite);
    return;
  }

  scratch = await mkdtemp(join(tmpdir(), "dmocks-checkout-browser-"));
  site = join(scratch, "site");
  const noticeFile = join(scratch, "notices.json");
  const fixture = JSON.parse(await readFile(join(app, "tests/fixtures/fictional-published-notices.json"), "utf8"));
  await writeFile(noticeFile, JSON.stringify({ ...fixture, scope: "release" }));
  expectedVersion = readPublishedNotices(noticeFile).version;

  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("VITE_")));
  execFileSync(process.execPath, [join(app, "node_modules/vite/bin/vite.js"), "build", "--mode", "test", "--outDir", site], {
    cwd: app,
    env: {
      ...env, DMOCKS_PUBLISHED_NOTICES_FILE: noticeFile, VITE_TERMS_VERSION: expectedVersion,
      VITE_DEPLOYMENT_ENV: "test", VITE_PORTAL_ENABLED: "true", VITE_CHECKOUT_ENABLED: "true",
      VITE_CANDIDATE_PHONE_VERIFICATION_ENABLED: "false", VITE_POST_LAUNCH_PREVIEW: "false", VITE_TEST_LOGIN_ENABLED: "false", VITE_STAGING_PORTAL_ENABLED: "false",
      VITE_SUPABASE_URL: provider, VITE_SUPABASE_ANON_KEY: "sb_publishable_dmocks_artifact_fixture",
    },
    stdio: "pipe",
  });
  site = await realpath(site);
});

test.afterAll(async () => {
  if (scratch) await rm(scratch, { recursive: true, force: true });
});

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => route.abort());
  await page.route(url => [frontend, wrongFrontend].includes(url.origin), route =>
    serveArtifact(route, site, new URL(route.request().url())));
});

test("the private checkout artifact stays closed on the wrong host even with a cached session", async ({ page }) => {
  const providerAttempts = [];
  await page.route(url => url.hostname.endsWith(".supabase.co"), route => {
    providerAttempts.push(new URL(route.request().url()).pathname);
    return route.abort();
  });
  await page.goto(wrongFrontend + "/account");
  await seedPortalSession(page, buyer, project.project_ref);
  await page.reload();
  await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toBeDisabled();
  await expect(page.getByText(buyer.email, { exact: false })).toHaveCount(0);
  await page.goto(wrongFrontend + "/plans");
  await expect(page.getByText("Paid access is not open in this preview.", { exact: false })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(pay(page)).toHaveCount(0);
  await page.goto(wrongFrontend + "/dashboard");
  await expect(page.getByRole("heading", { name: "One account. Your own progress.", exact: true })).toBeVisible();
  expect(providerAttempts).toEqual([]);
});

test("the private checkout artifact uses the exact provider and opens only a verified fictional Test order", async ({ page }) => {
  let version, admitted = false;
  const wrongProviderAttempts = [];
  await page.route(url => url.hostname.endsWith(".supabase.co") && url.origin !== provider, route => {
    wrongProviderAttempts.push(new URL(route.request().url()).pathname);
    return route.abort();
  });
  const mocked = await stubPortalProvider(page, (name, input) => {
    if (name === "my_pass") return { active: false, expiresAt: null, revoked: false, mode: "test" };
    if (name === "accept_current_terms") {
      expect(input).toEqual({ p_version: version });
      return null;
    }
    if (name === "create-order") {
      expect(input).toEqual({ plan: "annual" });
      if (!admitted) return { code: "42501", message: "Fictional checkout approval is required" };
      return { orderId: "order_FictionalArtifactOrder", keyId: "rzp_test_FictionalArtifact", amount: 119300, currency: "INR" };
    }
  }, project.project_ref);
  await page.addInitScript(() => {
    window.openedCheckoutOrders = [];
    window.Razorpay = class {
      constructor(options) { this.options = options; }
      on() {}
      open() {
        const { order_id, amount, currency, key } = this.options;
        window.openedCheckoutOrders.push({ order_id, amount, currency, key });
      }
      close() {}
    };
  });

  await page.goto("/terms");
  const notice = page.locator("[data-notice-version]");
  await expect(notice).toHaveAttribute("data-notice-version", /^dmocks-notices-v1-[a-f0-9]{64}$/);
  version = await notice.getAttribute("data-notice-version");
  if (expectedVersion) {
    expect(version).toBe(expectedVersion);
    await expect(page.getByText("This fictional catalogue text is used only in automated Test checkout.", { exact: true })).toBeVisible();
  }

  let authorize;
  await page.route(`${provider}/auth/v1/authorize?*`, route => {
    authorize = new URL(route.request().url());
    return route.fulfill({ contentType: "text/html", body: "<p>Fictional Google authorization.</p>" });
  });
  await page.goto("/account");
  const signIn = page.getByRole("button", { name: "Continue with Google", exact: true });
  await expect(signIn).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(signIn).toBeEnabled();
  await signIn.click();
  await expect(page.getByText("Fictional Google authorization.", { exact: true })).toBeVisible();
  expect(authorize.origin).toBe(provider);
  expect(authorize.searchParams.get("redirect_to")).toBe(frontend + "/account/callback");
  expect(authorize.searchParams.get("provider")).toBe("google");
  await page.goto("/account");
  await seedPortalSession(page, buyer, project.project_ref);

  for (const path of ["/dashboard/community", "/dashboard/all-india", "/dashboard/practice", "/review/drawings"]) {
    await page.goto(path);
    await expect(page.getByText("This area is outside the first paid release.", { exact: false })).toBeVisible();
  }

  await page.goto("/plans");
  await expect(page.getByText("Razorpay Test mode for approved acceptance testers.", { exact: false })).toBeVisible();
  await expect(pay(page)).toBeDisabled();
  expect(mocked.calls.filter(([name]) => name === "create-order")).toEqual([]);
  await page.getByRole("checkbox").check();
  await pay(page).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(await page.evaluate(() => window.openedCheckoutOrders)).toEqual([]);

  admitted = true;
  await page.reload();
  await page.getByRole("checkbox").check();
  await pay(page).click();
  await expect.poll(() => page.evaluate(() => window.openedCheckoutOrders)).toEqual([
    { order_id: "order_FictionalArtifactOrder", key: "rzp_test_FictionalArtifact", amount: 119300, currency: "INR" },
  ]);
  expect(mocked.calls.filter(([name]) => ["accept_current_terms", "create-order"].includes(name))).toEqual([
    ["accept_current_terms", { p_version: version }], ["create-order", { plan: "annual" }],
    ["accept_current_terms", { p_version: version }], ["create-order", { plan: "annual" }],
  ]);
  expect(mocked.authCalls.length).toBeGreaterThan(0);
  expect(mocked.authCalls.every(({ actor }) => actor === buyer.id)).toBe(true);
  expect(mocked.unexpected).toEqual([]);
  expect(wrongProviderAttempts).toEqual([]);
});
