import assert from "node:assert/strict";
import test from "node:test";
import { matchesSupportReplyReceipt, readSupportPage, supportPageLimit, supportReplyRequest } from "../src/admin-support.js";

const actor = "00000000-0000-4000-8000-000000000001";
const createdAt = "2026-11-06T12:00:00.123456Z";
const reports = Array.from({ length: supportPageLimit }, (_, index) => ({
  id: "55000000-0000-4000-8000-" + String(supportPageLimit - index).padStart(12, "0"),
  title: "Original fictional support report",
  description: "Original fictional details for the support queue.",
  status: "open",
  adminReply: null,
  replyRevision: 0,
  createdAt,
}));
const nextCursor = { staffId: actor, id: reports.at(-1).id, createdAt };

test("accepts bounded report pages with a cursor for the current staff actor and last row", () => {
  const first = { items: reports, nextCursor };
  const last = { items: [reports.at(-1)], nextCursor: null };
  const empty = { items: [], nextCursor: null };
  for (const page of [first, last, empty]) assert.deepEqual(readSupportPage(page, actor), page);
});

test("rejects excess or duplicate report rows and invalid reply revisions", () => {
  const oversized = [...reports, { ...reports[0], id: "55000000-0000-4000-8000-000000000026" }];
  assert.throws(() => readSupportPage({ items: oversized, nextCursor: null }, actor), /Invalid support page/);
  assert.throws(() => readSupportPage({ items: [reports[0], reports[0]], nextCursor: null }, actor), /Invalid support report/);
  for (const replyRevision of [-1, 1.5, "0", Number.MAX_SAFE_INTEGER + 1]) {
    const items = [{ ...reports[0], replyRevision }];
    assert.throws(() => readSupportPage({ items, nextCursor: null }, actor), /Invalid support report/);
  }
});

test("rejects a continuation that does not match a full page, its last row or its actor", () => {
  for (const cursor of [
    undefined, { ...nextCursor, staffId: reports[0].id }, { ...nextCursor, id: reports[0].id },
    { ...nextCursor, createdAt: "2026-11-06T12:00:00.123457Z" }, { ...nextCursor, extra: true },
  ]) {
    assert.throws(() => readSupportPage({ items: reports, nextCursor: cursor }, actor), /Invalid support cursor/);
  }
  assert.throws(() => readSupportPage({ items: reports.slice(1), nextCursor }, actor), /Invalid support cursor/);
});

test("a reply command retains the inspected revision and submitted text for exact retries", () => {
  const draft = { revision: 3, status: "fixed", reply: "  An original fictional fix.  " };
  const request = supportReplyRequest(reports[0].id, draft, actor);
  draft.reply = "Later draft";
  assert.ok(Object.isFrozen(request));
  assert.deepEqual(request, {
    p_id: reports[0].id, p_expected_revision: 3, p_status: "fixed",
    p_reply: "An original fictional fix.", p_request_id: actor,
  });
});

test("only a receipt bound to the exact report, request, next revision, status and reply confirms a save", () => {
  const request = supportReplyRequest(reports[0].id, { revision: 0, status: "closed", reply: " " }, actor);
  const receipt = { reportId: reports[0].id, requestId: actor, replyRevision: 1, status: "closed", adminReply: null };
  assert.equal(matchesSupportReplyReceipt(request, receipt), true);
  for (const [key, value] of [
    ["reportId", reports[1].id], ["requestId", reports[1].id], ["replyRevision", 2], ["status", "fixed"], ["adminReply", ""],
  ]) {
    assert.equal(matchesSupportReplyReceipt(request, { ...receipt, [key]: value }), false);
  }
  assert.equal(matchesSupportReplyReceipt(request, null), false);
});

test("staff support pages project the recorded payment summary and reject inconsistent money", () => {
  const purchase = { reference: reports[1].id, mode: "test", amountMinor: 119300, currency: "INR",
    status: "paid", refundedMinor: 2550, reviewRequired: true };
  const source = { ...reports[0], purchase: { ...purchase, providerOrderId: "private-order" }, reporterId: actor };
  assert.deepEqual(readSupportPage({ items: [source], nextCursor: null }, actor).items, [{ ...reports[0], purchase }]);
  for (const invalid of [{ refundedMinor: 119301 }, { reviewRequired: "true" }, { status: ["paid"] }, { currency: "USD" }]) {
    assert.throws(() => readSupportPage({ items: [{ ...source, purchase: { ...purchase, ...invalid } }], nextCursor: null }, actor),
      /Invalid linked purchase/);
  }
});
