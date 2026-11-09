import { expect, test } from "@playwright/test";

test.use({ baseURL: "http://127.0.0.1:4499" });

async function openControlledAccount(page) {
  const providerRequests = [];
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id: "00000000-0000-4000-8000-000000000089",
    email: "controlled-fixture@example.invalid",
    app_metadata: { provider: "google" },
    user_metadata: {},
    aud: "authenticated",
  };
  const jwt = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({
    sub: user.id, aud: "authenticated", role: "authenticated", exp: expiresAt,
  })).toString("base64url")}.fixture`;
  const session = { user, access_token: jwt, refresh_token: "fixture-refresh", expires_at: expiresAt, expires_in: 3600, token_type: "bearer" };
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  await page.route("https://dmocks-controlled-fixture.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    providerRequests.push(url.pathname);
    if (request.method() === "OPTIONS" || url.pathname === "/auth/v1/logout") {
      await route.fulfill({ status: 204, headers });
    } else if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
      await route.fulfill({ json: { ...session, refresh_token: "fixture-refreshed" }, headers });
    } else {
      await route.abort();
    }
  });
  await page.goto("/account");
  await expect(page.getByRole("button", { name: "Test Google sign-in" })).toBeEnabled();
  await page.evaluate((value) => {
    localStorage.setItem("sb-dmocks-controlled-fixture-auth-token", JSON.stringify(value));
  }, session);
  await page.reload();
  await expect(page.getByText("Signed in as controlled-fixture@example.invalid")).toBeVisible();
  return providerRequests;
}

function expectNoWorkspaceRequests(providerRequests) {
  expect(providerRequests.filter(path => path.startsWith("/rest/") || path.startsWith("/functions/"))).toEqual([]);
}

async function expectClosedWorkspace(page, path) {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "The workspace is closed." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to account" })).toHaveAttribute("href", "/account");
}

test("a controlled Google session can refresh and sign out after a closed workspace visit", async ({ page }) => {
  const providerRequests = await openControlledAccount(page);
  await page.getByRole("button", { name: "Refresh test session" }).click();
  await expect(page.getByRole("status")).toContainText("Test session refreshed successfully.");
  await expect(page.getByRole("link", { name: "Open your workspace" })).toHaveCount(0);
  await expectClosedWorkspace(page, "/dashboard");
  await page.getByRole("link", { name: "Go to account" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Test Google sign-in" })).toBeEnabled();
  expectNoWorkspaceRequests(providerRequests);
});

for (const [area, paths] of [
  ["student modules", ["/dashboard/mocks", "/dashboard/all-india", "/dashboard/practice", "/dashboard/learn", "/dashboard/community"]],
  ["profile, support, staff and attempt routes", ["/onboarding", "/report", "/admin", "/review/drawings", "/attempt/synthetic"]],
]) {
  test(`a controlled Google session keeps ${area} closed on direct navigation`, async ({ page }) => {
    const providerRequests = await openControlledAccount(page);
    for (const path of paths) await expectClosedWorkspace(page, path);
    expectNoWorkspaceRequests(providerRequests);
  });
}
