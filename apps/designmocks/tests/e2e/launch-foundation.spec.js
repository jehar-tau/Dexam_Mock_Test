import { test, expect } from "@playwright/test";

test("DMocks branding and support entry point render", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/DMocks/);
  await expect(page.getByRole("link", { name: "DMocks home" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Report a problem" })).toBeVisible();
});

test("bug reporting fails closed for signed-out visitors", async ({ page }) => {
  await page.goto("/report");
  await expect(page.getByRole("heading", { name: /Report a problem/ })).toBeVisible();
  await expect(page.getByText("Please sign in to continue.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send report" })).toHaveCount(0);
});

test("student modules require authentication", async ({ page }) => {
  await page.goto("/dashboard/all-india");
  await expect(page.getByRole("heading", { name: /Sign in to continue/ })).toBeVisible();
  await expect(page.locator("#main").getByRole("link", { name: "Student sign in" })).toBeVisible();
});

test("fictional portal preview exposes every requested navigation area", async ({ page }) => {
  await page.goto("/portal-preview");
  const mobileMenu = page.getByRole("button", { name: "Student menu" });
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  const navigation = page.getByRole("navigation", { name: "Student workspace" });
  for (const name of ["Overview", "Exam-wise mocks", "All India mocks", "Topic practice", "Learn", "Community"]) {
    await expect(navigation.getByRole("link", { name })).toBeVisible();
  }
  await expect(page.getByText("Sample Student")).toBeVisible();
});
