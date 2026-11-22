import { expect, test } from "@playwright/test";
import project from "../../supabase/project.json" with { type: "json" };
import { seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

const site = project.frontend_origin;
const artifact = "http://127.0.0.1:4797";
const tester = { id: "00000000-0000-4000-8000-000000000097", email: "owner-test@example.invalid" };
test.use({ baseURL: site, serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => route.abort());
  await page.route(url => [site, "https://www.dmocks.com"].includes(url.origin), async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: artifact + url.pathname + url.search, maxRedirects: 0 });
    return route.fulfill({ response });
  });
});

test("the controlled public build opens only approved Google tester access and no checkout", async ({ page }) => {
  let admitted = true;
  const { calls, unexpected } = await stubPortalProvider(page, procedure => {
    if (procedure === "can_enter_staging_portal") return admitted;
    if (procedure === "my_privacy_requests" || procedure === "available_papers" ||
        procedure === "my_attempt_history" || procedure === "learning_catalog" || procedure === "learning_progress") return [];
    if (procedure === "my_pass") return { active: false, expiresAt: null };
    if (procedure === "finalize_my_expired_attempts") return 0;
    if (procedure === "my_overview_analytics") return { completed: 0, waitingForResults: 0,
      objectiveAccuracy: null, objectiveAnswered: 0, topics: [], exams: [],
      drawingReviews: { pending: 0, released: 0 } };
  }, project.project_ref);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Test workspace." })).toBeVisible();
  await expect(page.getByText("Sign in with an approved Google test account.")).toBeVisible();
  expect(calls).toEqual([]);

  await page.goto("/account");
  await expect(page.getByText("Portal testing is limited to approved Google accounts. Checkout is closed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to test with Google" })).toBeEnabled();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await seedPortalSession(page, tester, project.project_ref);
  await page.reload();
  await page.getByRole("link", { name: "Open your workspace" }).click();
  await expect(page.getByRole("heading", { name: /Welcome to your next attempt/ })).toBeVisible();
  expect(calls.some(([name]) => name === "can_enter_staging_portal")).toBe(true);

  admitted = false;
  await page.reload();
  await expect(page.getByText("Test access is closed for this account.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Welcome to your next attempt/ })).toHaveCount(0);
  await page.goto("/plans");
  await expect(page.getByText("Checkout is closed during controlled testing.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay .* with Razorpay/ })).toBeDisabled();
  expect(unexpected).toEqual([]);
});

test("a copied controlled public build is inert on another host", async ({ page }) => {
  const { calls } = await stubPortalProvider(page, () => undefined, project.project_ref);
  await page.goto("https://www.dmocks.com/account");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  await seedPortalSession(page, tester, project.project_ref);
  await page.goto("https://www.dmocks.com/dashboard");
  await expect(page.getByRole("heading", { name: "Test workspace." })).toHaveCount(0);
  expect(calls).toEqual([]);
});
