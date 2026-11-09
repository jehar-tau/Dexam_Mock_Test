import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { emptyAdminRead, portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

test.use({ baseURL: portalFixtureURL });

const admin = { id: "00000000-0000-4000-8000-000000000142", email: "question-export@example.invalid" };
const exportId = "60000000-0000-4000-8000-000000000142";
const externalKey = "dmocks-uceed-observation-fixture-001";
const reviewedPayload = {
  type: "MCQ",
  prompt: "Which fictional sign has the clearest wayfinding hierarchy?",
  options: ["A", "B", "C", "D"].map(key => ({ key, text: `Fictional option ${key}`, asset: null })),
  answer: { raw: "B", status: "human-reviewed" },
  explanation: "The fictional second sign gives the destination the clearest visual priority.",
  topic: "observation",
  assets: [],
  visualDependency: false,
  sourceKind: "original",
  licence: "original-author-owned",
  holds: [],
  provenance: { exam: "uceed", basisExternalKeys: [] },
  externalKey,
};
const payloadText = JSON.stringify(reviewedPayload, null, 2);
const contentSha256 = createHash("sha256").update(payloadText, "utf8").digest("hex");
const responseEnvelope = {
  format: "dmocks-question-export-v1",
  artifactId: exportId,
  externalKey,
  contentSha256,
  payloadText,
  rightsNote: "Fictional rights record for browser regression coverage.",
  createdAt: "2026-11-10T00:00:00.000Z",
  sourceType: "manual",
  publicationState: "git-review-required",
};

async function openQueue(page, { adminAccess = true, exportSummary = true } = {}) {
  let adminRole = adminAccess;
  const pending = {
    id: "60000000-0000-4000-8000-000000000143",
    sourceName: "Fictional pending question",
    status: "pending",
    payload: { ...reviewedPayload, holds: ["human-review"] },
  };
  const approved = {
    id: "60000000-0000-4000-8000-000000000144",
    sourceName: "Fictional approved question",
    status: "exported",
    payload: reviewedPayload,
    export: exportSummary ? { id: exportId, externalKey, contentSha256, payload: reviewedPayload } : null,
  };
  const provider = await stubPortalProvider(page, (procedure, input) => {
    switch (procedure) {
      case "is_dmocks_admin": return adminRole;
      case "admin_question_drafts": return [pending, approved];
      case "admin_read_question_export":
        if (input.p_export_id !== exportId) return { code: "42501", message: "Export is unavailable" };
        return responseEnvelope;
      default: return emptyAdminRead(procedure);
    }
  });
  await page.goto("/admin");
  await seedPortalSession(page, admin);
  await page.reload();
  return { ...provider, setAdminRole: value => { adminRole = value; } };
}

test("an approved exported question downloads its verified immutable review packet", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const state = await openQueue(page);
  const pendingCard = page.getByRole("article").filter({ hasText: "Fictional pending question" });
  await expect(pendingCard).toBeVisible();
  await expect(pendingCard.getByRole("button", { name: "Download bank review packet" })).toHaveCount(0);

  const approvedCard = page.getByRole("article").filter({ hasText: "Fictional approved question" });
  const downloadPromise = page.waitForEvent("download");
  await approvedCard.getByRole("button", { name: "Download bank review packet" }).press("Enter");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`dmocks-question-${exportId}.json`);
  const path = await download.path();
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(path);
  const packet = JSON.parse(bytes.toString("utf8"));
  expect(packet).toEqual(responseEnvelope);
  expect(createHash("sha256").update(packet.payloadText, "utf8").digest("hex")).toBe(packet.contentSha256);
  expect(JSON.parse(packet.payloadText)).toEqual(reviewedPayload);
  expect(JSON.parse(packet.payloadText).holds).toEqual([]);
  expect(packet.publicationState).toBe("git-review-required");
  expect(state.calls).toContainEqual(["admin_read_question_export", { p_export_id: exportId }]);
  expect(state.unexpected).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});

test("a mismatched export digest is rejected without creating a download", async ({ page }) => {
  const state = await openQueue(page);
  const tampered = { ...responseEnvelope, contentSha256: "f".repeat(64) };
  await page.route("https://dmocks-portal-fixture.supabase.co/rest/v1/rpc/admin_read_question_export", async route => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    state.calls.push(["admin_read_question_export", route.request().postDataJSON()]);
    return route.fulfill({ status: 200, headers, json: tampered });
  });
  const approvedCard = page.getByRole("article").filter({ hasText: "Fictional approved question" });
  const downloads = [];
  page.on("download", download => downloads.push(download));
  await approvedCard.getByRole("button", { name: "Download bank review packet" }).click();
  await expect(approvedCard.getByRole("alert")).toHaveText("Couldn’t verify this export packet. Refresh the review queue and try again.");
  expect(downloads).toHaveLength(0);
  expect(state.calls).toContainEqual(["admin_read_question_export", { p_export_id: exportId }]);
  expect(state.unexpected).toEqual([]);
});

test("a non-admin cannot access question export packets", async ({ page }) => {
  const state = await openQueue(page, { adminAccess: false });
  await expect(page.getByText("This account is not an administrator.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download bank review packet" })).toHaveCount(0);
  expect(state.calls.some(([name]) => name === "admin_read_question_export")).toBe(false);
  expect(state.unexpected).toEqual([]);
});

test("role revoked while an export reply is held prevents the packet download", async ({ page }) => {
  const state = await openQueue(page);
  let releaseReply;
  let requestReceived;
  const heldReply = new Promise(resolve => { releaseReply = resolve; });
  const received = new Promise(resolve => { requestReceived = resolve; });
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
  await page.route("https://dmocks-portal-fixture.supabase.co/rest/v1/rpc/admin_read_question_export", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    state.calls.push(["admin_read_question_export", route.request().postDataJSON()]);
    requestReceived();
    await heldReply;
    return route.fulfill({ status: 200, headers, json: responseEnvelope });
  });

  const approvedCard = page.getByRole("article").filter({ hasText: "Fictional approved question" });
  const downloads = [];
  page.on("download", download => downloads.push(download));
  await approvedCard.getByRole("button", { name: "Download bank review packet" }).click();
  await received;
  state.setAdminRole(false);
  releaseReply();

  await expect(page.getByText("Administrator access has ended. Private views were cleared.", { exact: true })).toBeVisible();
  expect(downloads).toHaveLength(0);
  expect(state.calls).toContainEqual(["admin_read_question_export", { p_export_id: exportId }]);
  expect(state.calls.filter(([name]) => name === "is_dmocks_admin").length).toBeGreaterThan(1);
  expect(state.unexpected).toEqual([]);
});
