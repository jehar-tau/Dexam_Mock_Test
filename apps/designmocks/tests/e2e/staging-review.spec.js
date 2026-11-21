import { expect, test } from "@playwright/test";
import project from "../../supabase/project.json" with { type: "json" };

const staging = project.staging_frontend_origin;
const production = project.frontend_origin;
test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => route.abort());
  // Keep the real browser origins while serving the exact locally built files.
  await page.route(url => [staging, production].includes(url.origin), async route => {
    const { pathname, search } = new URL(route.request().url());
    const response = await route.fetch({ url: "http://127.0.0.1:4789" + pathname + search, maxRedirects: 0 });
    await route.fulfill({ response });
  });
});

async function workspaceLink(page, name) {
  const menu = page.getByRole("button", { name: "Student menu" });
  if ((page.viewportSize()?.width ?? 1000) < 900) await menu.click();
  await page.getByRole("navigation", { name: "Student workspace" }).getByRole("link", { name }).click();
}

test("hosted review connects the student workspace, examples and Learn without a provider", async ({ page }) => {
  const writes = [], backend = [], errors = [];
  page.on("request", request => {
    if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
    if (/supabase\.co|razorpay\.com|accounts\.google\.com/.test(request.url())) backend.push(request.url());
  });
  page.on("pageerror", error => errors.push(error.message));

  await page.goto(staging);
  const mainMenu = page.getByRole("button", { name: "Menu", exact: true });
  if (await mainMenu.isVisible()) await mainMenu.click();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Student preview" }).click();
  await expect(page.getByText(/Welcome, Sample Student/)).toBeVisible();

  await workspaceLink(page, "Exam-wise mocks");
  await expect(page.getByRole("heading", { name: /Pick your paper/ })).toBeVisible();
  await page.getByRole("button", { name: "Start mock" }).first().click();
  await expect(page.getByText("Preview: UCEED mock created")).toBeVisible();

  await workspaceLink(page, "All India mocks");
  await page.getByRole("link", { name: "View attempt" }).click();
  await expect(page).toHaveURL(staging + "/portal-preview/report");
  await expect(page.getByText(/Illustrative feedback for a fictional attempt/)).toBeVisible();
  await page.getByRole("link", { name: /Your preview workspace/ }).click();

  await workspaceLink(page, "Learn");
  await page.locator(".programme-card").filter({ has: page.getByRole("heading", { name: /Cube nets/i }) })
    .getByRole("link", { name: /Start programme/ }).click();
  await expect(page).toHaveURL(/\/learn-programme-preview\/cube-nets/);
  await page.reload();
  await expect(page.getByText("Staging review. Progress is saved only in this browser.")).toBeVisible();
  await page.getByRole("link", { name: /Practise this topic/ }).click();
  await expect(page).toHaveURL(/\/topic-practice-preview\?exam=uceed/);
  await expect(page.getByRole("heading", { name: /Build a topic session/ })).toBeVisible();

  await workspaceLink(page, "Community");
  await expect(page.getByText("How do you separate observation from assumption?")).toBeVisible();
  await workspaceLink(page, "Overview");
  await page.getByText("Explore student pages").click();
  const studentPages = page.getByRole("navigation", { name: "Sign-in-free student pages" });
  await studentPages.getByRole("link", { name: "Drawing uploads" }).click();
  await expect(page.getByRole("heading", { name: /Submit your drawing/ })).toBeVisible();
  await page.goto(staging + "/question-report-preview");
  await expect(page.getByRole("heading", { name: /Review a question/ })).toBeVisible();
  await page.goto(staging + "/profile-preview");
  await expect(page.getByRole("heading", { name: /Set up your profile/ })).toBeVisible();
  await page.goto(staging + "/sample");
  await page.getByRole("button", { name: "Begin the sample" }).click();
  await expect(page.getByRole("heading", { name: "One question at a time." })).toBeVisible();

  expect(backend).toEqual([]);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("hosted review keeps account, commerce and staff capabilities closed", async ({ page }) => {
  await page.goto(staging + "/account");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  await page.goto(staging + "/plans");
  await expect(page.getByText(/Paid access is not open/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Buy|Checkout|Pay now/i })).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");

  for (const path of ["/admin", "/review/drawings", "/ai-question-drafting-preview", "/drawing-review-lifecycle-preview",
    "/community-moderation-preview", "/question-draft-export-preview", "/intake-extraction-preview", "/attempt/example"]) {
    await page.goto(staging + path);
    await expect(page.getByRole("heading", { name: /This page took another path/ })).toBeVisible();
  }
});

test("the staging artifact exposes no review routes on the production hostname", async ({ page }) => {
  for (const path of ["/portal-preview", "/learn-programme-preview/cube-nets", "/drawing-uploads-preview"]) {
    await page.goto(production + path);
    await expect(page.getByRole("heading", { name: /This page took another path/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Student preview" })).toHaveCount(0);
  }
});
