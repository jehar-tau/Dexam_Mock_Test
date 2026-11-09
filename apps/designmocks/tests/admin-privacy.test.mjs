import assert from "node:assert/strict";
import test from "node:test";
import { activePrivacyReview, matchesPrivacyDecision, privacyQueueLimit, readPrivacyQueue } from "../src/admin-privacy.js";

const actor = "00000000-0000-4000-8000-000000003202";
const createdAt = "2026-11-06T12:00:00.123456Z";
const items = Array.from({ length: privacyQueueLimit }, (_, index) => ({
  id: "30000000-0000-4000-8000-" + String(privacyQueueLimit - index).padStart(12, "0"),
  userId: "00000000-0000-4000-8000-000000003201",
  createdAt, type: "account_deletion", status: index ? "cancelled" : "open", adminNote: null, reviewRevision: 0,
}));
const cursor = { queue: "privacy", staffId: actor, id: items.at(-1).id, createdAt };

test("staff privacy pages accept an actor-bound continuation and keep inactive requests visible", () => {
  const page = { items, nextCursor: cursor };
  assert.deepEqual(readPrivacyQueue(page, actor), page);
  assert.equal(activePrivacyReview(items[0]), true);
  assert.equal(activePrivacyReview(items[1]), false);
  assert.equal(activePrivacyReview({ status: "in_progress" }), true);
});

test("privacy pages reject foreign continuations, duplicate rows and invalid revisions", () => {
  for (const nextCursor of [{ ...cursor, staffId: items[0].userId }, { ...cursor, queue: "support" }, { ...cursor, id: items[0].id }]) {
    assert.throws(() => readPrivacyQueue({ items, nextCursor }, actor), /Invalid privacy request cursor/);
  }
  assert.throws(() => readPrivacyQueue({ items: [items[0], items[0]], nextCursor: null }, actor), /Invalid privacy request/);
  assert.throws(() => readPrivacyQueue({ items: [{ ...items[0], reviewRevision: -1 }], nextCursor: null }, actor), /Invalid privacy request/);
});

test("a privacy decision receipt must match the request and the reviewed revision", () => {
  const command = { p_id: items[0].id, p_expected_revision: 3, p_status: "closed", p_note: "Original fictional review." };
  const receipt = { requestId: items[0].id, reviewRevision: 4, status: "closed", adminNote: command.p_note };
  assert.equal(matchesPrivacyDecision(command, receipt), true);
  for (const [key, value] of [
    ["requestId", items[1].id], ["reviewRevision", 3], ["status", "declined"], ["adminNote", null],
  ]) {
    assert.equal(matchesPrivacyDecision(command, { ...receipt, [key]: value }), false);
  }
  assert.equal(matchesPrivacyDecision(command, null), false);
});
