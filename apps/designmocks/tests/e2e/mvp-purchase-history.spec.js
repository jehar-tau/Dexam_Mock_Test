import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { emptyAdminRead, portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

test.use({ baseURL: portalFixtureURL });

const buyer = { id: "00000000-0000-4000-8000-000000000501", email: "purchase-history@example.invalid" };
const references = {
  pending: "50000000-0000-4000-8000-000000000501",
  paid: "50000000-0000-4000-8000-000000000502",
  refunded: "50000000-0000-4000-8000-000000000503",
};
const cursor = { createdAt: "2026-11-09T13:12:11.123456+00:00", reference: "50000000-0000-4000-8000-000000000510" };
const testRows = [
  { reference: references.pending, amountMinor: 119300, currency: "INR", status: "pending", refundedMinor: 0, reviewRequired: true,
    createdAt: "2026-11-10T09:30:00.000000+00:00", paidAt: null, refundedAt: null },
  { reference: references.paid, amountMinor: 119300, currency: "INR", status: "paid", refundedMinor: 2550, reviewRequired: true,
    createdAt: "2026-11-09T12:00:00.000000+00:00", paidAt: "2026-11-09T12:04:00.000000+00:00",
    refundedAt: "2026-11-10T09:00:00+00:00", providerOrderId: "order_FictionalPrivate", paymentId: "pay_FictionalPrivate" },
  { reference: references.refunded, amountMinor: 119300, currency: "INR", status: "refunded", refundedMinor: 119300, reviewRequired: false,
    createdAt: "2026-11-08T10:00:00.000000+00:00", paidAt: "2026-11-08T10:01:00.000000+00:00", refundedAt: "2026-11-09T11:00:00.000000+00:00" },
];

async function fixture(page, respond = () => ({ mode: "test", items: testRows, nextCursor: null })) {
  const provider = await stubPortalProvider(page, (procedure, input) => {
    switch (procedure) {
      case "my_purchase_page": return respond(input);
      case "my_privacy_requests": return [];
      case "can_review_drawings": return false;
      case "logout": return null;
      default: return emptyAdminRead(procedure);
    }
  });
  await page.goto("/account");
  await seedPortalSession(page, buyer);
  await page.reload();
  return provider;
}

async function openHistory(page) {
  await page.getByRole("link", { name: "Purchase history", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Purchase history", exact: true })).toBeVisible();
}

test("account purchase history shows test pending, paid and refunded orders from the owned read", async ({ page }) => {
  const state = await fixture(page);
  await openHistory(page);
  const history = page.getByRole("region", { name: "Purchase history", exact: true });
  await expect(history.getByText("Test purchases", { exact: true })).toBeVisible();
  await expect(history.getByText("Pending payment", { exact: true })).toBeVisible();
  await expect(history.getByText("Payment under review", { exact: true })).toHaveCount(2);
  await expect(history.getByText("Paid", { exact: true })).toBeVisible();
  await expect(history.getByText("Refunded", { exact: true })).toBeVisible();
  await expect(history.getByText("Order reference", { exact: true })).toHaveCount(3);
  await expect(history.getByText("Refunded amount", { exact: true })).toHaveCount(2);
  await expect(history.getByText("₹25.50", { exact: true })).toBeVisible();
  await expect(history.getByText(references.pending, { exact: true })).toBeVisible();
  await expect(history.getByText(references.paid, { exact: true })).toBeVisible();
  await expect(history.getByText(references.refunded, { exact: true })).toBeVisible();
  await expect(history).toContainText("₹1,193.00");
  await expect(history.getByRole("link", { name: "Contact support", exact: true })).toHaveAttribute("href", "/report");
  await expect(history).not.toContainText(/order_FictionalPrivate|pay_FictionalPrivate/);
  expect(state.calls).toContainEqual(["my_purchase_page", { p_before_created_at: null, p_before_id: null }]);
  expect(state.calls.filter(([name]) => name === "my_purchase_page")).toHaveLength(1);
  expect(state.unexpected).toEqual([]);
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  const violations = await page.evaluate(async () => (await window.axe.run(".purchase-history-page", {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  })).violations.map(({ id }) => id));
  expect(violations).toEqual([]);
  await history.getByRole("button", { name: "Refresh purchases", exact: true }).press("Enter");
  await expect.poll(() => state.calls.filter(([name]) => name === "my_purchase_page").length).toBe(2);
});

test("refresh updates a pending order and older purchases use the exact server cursor", async ({ page }) => {
  const pageOne = Array.from({ length: 10 }, (_, index) => ({
    reference: `50000000-0000-4000-8000-${String(index + 501).padStart(12, "0")}`,
    amountMinor: 119300, currency: "INR", status: "pending", refundedMinor: 0, reviewRequired: false,
    createdAt: index === 9 ? cursor.createdAt : `2026-11-10T13:12:${String(20 - index).padStart(2, "0")}.000000+00:00`,
    paidAt: null, refundedAt: null,
  }));
  pageOne[9].reference = cursor.reference;
  let refreshed = false;
  const secondPage = [{ reference: "50000000-0000-4000-8000-000000000511", amountMinor: 119300, currency: "INR", status: "refunded",
    refundedMinor: 119300, reviewRequired: false, createdAt: "2026-11-01T00:00:00.000000+00:00", paidAt: "2026-11-01T00:01:00.000000+00:00",
    refundedAt: "2026-11-02T00:00:00.000000+00:00" }];
  const state = await fixture(page, input => {
    if (input.p_before_created_at !== null) return { mode: "test", items: secondPage, nextCursor: null };
    const rows = pageOne.map(row => ({ ...row }));
    if (refreshed) Object.assign(rows[0], { status: "paid", reviewRequired: false, paidAt: "2026-11-10T14:00:00.000000+00:00" });
    return { mode: "test", items: rows, nextCursor: cursor };
  });
  await openHistory(page);
  const history = page.getByRole("region", { name: "Purchase history", exact: true });
  const firstReference = pageOne[0].reference;
  const firstOrder = history.locator("article").filter({ hasText: firstReference });
  await expect(firstOrder.getByText("Pending payment", { exact: true })).toBeVisible();
  refreshed = true;
  await history.getByRole("button", { name: "Refresh purchases", exact: true }).press("Enter");
  await expect(firstOrder.getByText("Paid", { exact: true })).toBeVisible();
  await expect(history.getByText(cursor.reference, { exact: true })).toBeVisible();
  await history.getByRole("button", { name: "Load older purchases", exact: true }).press("Enter");
  await expect(history.getByText(secondPage[0].reference, { exact: true })).toBeVisible();
  await expect(history.locator("article").filter({ hasText: secondPage[0].reference })).toBeFocused();
  expect(state.calls).toContainEqual(["my_purchase_page", { p_before_created_at: cursor.createdAt, p_before_id: cursor.reference }]);
  expect(state.unexpected).toEqual([]);
});

test("purchase history reports a read error and refresh recovers", async ({ page }) => {
  let fail = true;
  const state = await fixture(page, () => fail
    ? { code: "P0001", message: "Fictional purchase history read unavailable" }
    : { mode: "test", items: testRows, nextCursor: null });
  await openHistory(page);
  const history = page.getByRole("region", { name: "Purchase history", exact: true });
  await expect(history.getByRole("alert")).toHaveText("Couldn’t load your purchases. Refresh and try again.");
  fail = false;
  await history.getByRole("button", { name: "Refresh purchases", exact: true }).press("Enter");
  await expect(history.getByText(references.paid, { exact: true })).toBeVisible();
  expect(state.calls.filter(([name]) => name === "my_purchase_page")).toHaveLength(2);
  expect(state.unexpected).toEqual([]);
});

test("signed-out visitors see the sign-in prompt and a late purchase response cannot restore private history", async ({ page }) => {
  const state = await fixture(page);
  let release;
  let began;
  const held = new Promise(resolve => { release = resolve; });
  const requested = new Promise(resolve => { began = resolve; });
  const routePattern = "https://dmocks-portal-fixture.supabase.co/rest/v1/rpc/my_purchase_page";
  await page.route(routePattern, async route => {
    const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version", "Access-Control-Allow-Methods": "POST, OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    state.calls.push(["my_purchase_page", route.request().postDataJSON()]);
    began();
    await held;
    await route.fulfill({ status: 200, headers, json: { mode: "test", items: testRows, nextCursor: null } }).catch(() => {});
  });
  await openHistory(page);
  await requested;
  await page.getByRole("link", { name: "Back to your account", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  release();
  await page.goto("/account/purchases");
  await expect(page.getByText("Sign in to view your purchases.", { exact: true })).toBeVisible();
  await expect(page.getByText(references.pending, { exact: true })).toHaveCount(0);
  expect(state.calls.filter(([name]) => name === "my_purchase_page")).toHaveLength(1);
  expect(state.unexpected).toEqual([]);
});
