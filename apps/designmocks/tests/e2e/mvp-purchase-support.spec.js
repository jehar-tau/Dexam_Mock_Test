import { expect, test } from "@playwright/test";
import { emptyAdminRead, portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

test.use({ baseURL: portalFixtureURL });

const student = { id: "00000000-0000-4000-8000-000000001871", email: "purchase-support@example.invalid" };
const reference = "71000000-0000-4000-8000-000000001871";
const reportId = "91000000-0000-4000-8000-000000001871";
const createdAt = "2026-06-01T12:00:00.123456Z";
const title = "Question about my annual pass";
const description = "I need help understanding the recorded payment for my annual pass.";
const purchase = { reference, mode: "test", status: "paid", amountMinor: 119300, currency: "INR", refundedMinor: 0, reviewRequired: false };
const providerOrder = "order_fictionalPrivatePurchase1871";
const providerPayment = "pay_fictionalPrivatePurchase1871";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reportPage = items => ({ items, nextCursor: null });
const helpLink = page => page.getByRole("link", { name: "Get help with this order", exact: true });
const removeLink = page => page.getByRole("button", { name: "Remove order link", exact: true });
const titleInput = page => page.getByLabel("Short title", { exact: true });
const descriptionInput = page => page.getByRole("textbox", { name: "What happened?", exact: true });
const sendReport = page => page.getByRole("button", { name: "Send report", exact: true });

function report(input, linked = true) {
  return {
    id: reportId, title: input.p_title, description: input.p_description, createdAt, updatedAt: createdAt,
    status: "open", adminReply: null, ...(linked ? { purchase: { reference, mode: "test" } } : {}),
  };
}

async function studentFixture(page, { dropReceipt = false, rejectLink = false, mode = "test" } = {}) {
  const submissions = [];
  const receipts = new Map();
  const provider = await stubPortalProvider(page, name => {
    if (name === "my_purchase_page") {
      return {
        mode, nextCursor: null,
        items: [{ ...purchase, createdAt, paidAt: createdAt, refundedAt: null, providerOrderId: providerOrder, providerPaymentId: providerPayment }],
      };
    }
    if (name === "my_bug_report_page") return reportPage([...receipts.values()]);
  });

  await page.route("https://dmocks-portal-fixture.supabase.co/rest/v1/rpc/submit_bug_report", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ headers, status: 204 });
    const input = route.request().postDataJSON();
    submissions.push(input);
    if (rejectLink && input.p_purchase_order_id) {
      return route.fulfill({ headers, status: 400, json: {
        code: "22023", details: "purchase_order_unavailable", message: "Private purchase validation diagnostic",
      } });
    }
    if (!receipts.has(input.p_request_id)) receipts.set(input.p_request_id, report(input, Boolean(input.p_purchase_order_id)));
    if (dropReceipt && submissions.length === 1) return route.abort("failed");
    return route.fulfill({ headers, json: reportId });
  });

  await page.goto("/");
  await seedPortalSession(page, student);
  await page.goto("/account/purchases");
  return { ...provider, submissions, receipts };
}

async function openLinkedReport(page) {
  await expect(helpLink(page)).toHaveAttribute("href", "/report");
  await helpLink(page).click();
  await expect(page).toHaveURL(portalFixtureURL + "/report");
  await expect(page.getByText("Linked order", { exact: false })).toBeVisible();
  await expect(page.getByText(reference, { exact: false })).toBeVisible();
  await expect(removeLink(page)).toBeVisible();
}

async function fillReport(page) {
  await titleInput(page).fill(title);
  await descriptionInput(page).fill(description);
}

function genericArgs() {
  return {
    p_title: title, p_description: description, p_page_url: portalFixtureURL + "/report",
    p_request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
  };
}

test("a linked purchase report retries the identical request after a lost receipt", async ({ page }) => {
  const state = await studentFixture(page, { dropReceipt: true });
  await openLinkedReport(page);
  await fillReport(page);
  await sendReport(page).click();
  const retry = page.getByRole("button", { name: "Retry report", exact: true });
  await expect(retry).toBeVisible();
  await expect(titleInput(page)).toBeDisabled();
  expect(state.submissions).toEqual([{ ...genericArgs(), p_purchase_order_id: reference }]);

  await retry.click();
  await expect(page.getByRole("status").filter({ hasText: "Your report is in the review queue." })).toBeVisible();
  const history = page.getByRole("article", { name: title, exact: true });
  await expect(history.getByText(reference, { exact: false })).toBeVisible();
  expect(state.submissions).toEqual([state.submissions[0], state.submissions[0]]);
  expect(state.receipts.size).toBe(1);
  expect(state.unexpected).toEqual([]);
  await expect(page.locator("#root")).not.toContainText(providerOrder);
  await expect(page.locator("#root")).not.toContainText(providerPayment);
});

test("an unavailable linked order preserves the editable draft and can be removed", async ({ page }) => {
  const state = await studentFixture(page, { rejectLink: true });
  await openLinkedReport(page);
  await fillReport(page);
  await sendReport(page).click();

  await expect(page.getByRole("alert").or(page.getByRole("status")).filter({ hasText: /order/i })).toBeVisible();
  await expect(page.locator("#root")).not.toContainText("Private purchase validation diagnostic");
  await expect(titleInput(page)).toBeEnabled();
  await expect(titleInput(page)).toHaveValue(title);
  await expect(descriptionInput(page)).toHaveValue(description);
  await removeLink(page).click();
  await expect(removeLink(page)).toHaveCount(0);
  await expect(page.getByText(reference, { exact: false })).toHaveCount(0);
  await sendReport(page).click();

  await expect(page.getByRole("status").filter({ hasText: "Your report is in the review queue." })).toBeVisible();
  expect(state.submissions).toEqual([{ ...genericArgs(), p_purchase_order_id: reference }, genericArgs()]);
  expect(state.submissions[1].p_request_id).not.toBe(state.submissions[0].p_request_id);
  expect(state.unexpected).toEqual([]);
});

test("a live purchase page cannot expose an order or report link in the test portal", async ({ page }) => {
  const state = await studentFixture(page, { mode: "live" });
  await expect(page.getByText("Couldn’t load your purchases. Refresh and try again.", { exact: true })).toBeVisible();
  await expect(helpLink(page)).toHaveCount(0);
  await expect(page.locator("#root")).not.toContainText(reference);
  expect(state.calls.filter(([name]) => name === "my_purchase_page")).toEqual([
    ["my_purchase_page", { p_before_created_at: null, p_before_id: null }],
  ]);
  expect(state.submissions).toEqual([]);
});

test("admin support shows the recorded payment beside the existing reply form", async ({ page }) => {
  let row = { ...report({ p_title: title, p_description: description }), purchase, replyRevision: 0 };
  const provider = await stubPortalProvider(page, (name, input) => {
    if (name === "is_dmocks_admin") return true;
    if (name === "admin_bug_report_page") return reportPage([row]);
    if (name === "admin_reply_bug_report") {
      row = { ...row, status: input.p_status, adminReply: input.p_reply, replyRevision: 1 };
      return { reportId, requestId: input.p_request_id, status: row.status, adminReply: row.adminReply, replyRevision: row.replyRevision };
    }
    return emptyAdminRead(name);
  });

  await page.goto("/");
  await seedPortalSession(page, student);
  await page.goto("/admin");
  const form = page.getByRole("form", { name: "Reply to report " + title, exact: true });
  await expect(form).toBeVisible();
  await expect(page.getByText(reference, { exact: false })).toBeVisible();
  await expect(page.getByText(/₹\s*1,193\.00/)).toBeVisible();
  await expect(page.getByText(/\bpaid\b/i)).toBeVisible();
  const reply = "The recorded payment is confirmed.";
  await form.getByRole("textbox", { name: "Reply to reporter" }).fill(reply);
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Reply saved.", { exact: true })).toBeVisible();
  expect(provider.calls.filter(([name]) => name === "admin_reply_bug_report")).toEqual([
    ["admin_reply_bug_report", { p_id: reportId, p_status: "open", p_reply: reply, p_expected_revision: 0, p_request_id: expect.stringMatching(/^[0-9a-f-]{36}$/) }],
  ]);
  expect(provider.unexpected).toEqual([]);
});
