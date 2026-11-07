import test from "node:test";
import assert from "node:assert/strict";
import { communityReviewFailure, communityReviewGroups, communityReviewInput, communityReviewMedia, validateCommunityReport } from "../src/community-moderation.js";

const reportId = "80000000-0000-4000-8000-000000000611";
const postId = "81000000-0000-4000-8000-000000000611", targetId = "82000000-0000-4000-8000-000000000611";
const parentId = "83000000-0000-4000-8000-000000000611", assetId = "84000000-0000-4000-8000-000000000611";
function fixture() {
  const post = { id: postId, kind: "post", title: "Fictional discussion", body: "An original fictional method discussion.",
    exam: "uceed", topic: "observation", status: "hidden", assets: [] };
  return { id: reportId, targetType: "comment", targetId, reason: "copyright", details: "Fictional image needs review.",
    createdAt: "2026-11-08T10:00:00Z", status: "open", resolution: null, reviewVersion: "a".repeat(64), canDismiss: true,
    target: { ...post, id: targetId, kind: "comment", title: null, body: "Fictional reported reply.", assets: [
      { id: assetId, ordinal: 1, mimeType: "image/webp", width: 6, height: 4, orientation: 6, available: true },
    ] }, post, parent: { ...post, id: parentId, kind: "comment", title: null, body: "Fictional immediate parent." },
    history: [{ id: 1, action: "hide", note: "Fictional earlier reason.", createdAt: "2026-11-08T09:00:00Z" }] };
}
const read = value => validateCommunityReport(value, reportId);
function signed(group, overrides = {}) {
  return { media: group.content.assets.map(({ available, ...page }) => ({ ...page, url: `https://media.example.invalid/${page.id}` })),
    serverNow: "2026-01-01T00:00:00Z", expiresAt: "2026-01-01T00:05:00Z", ...overrides };
}

test("complete current report content preserves hidden context and strips unapproved fields", () => {
  const value = fixture(); value.reporterId = "private"; value.target.storagePath = "private/path";
  const report = read(value);
  assert.deepEqual(communityReviewGroups(report).map(group => [group.context, group.content.id]), [["target", targetId], ["parent", parentId], ["post", postId]]);
  assert.equal(report.parent.status, "hidden");
  assert.equal(report.canDismiss, true);
  assert.equal("reporterId" in report, false);
  assert.equal("storagePath" in report.target, false);
  value.target.body = "Changed after validation.";
  assert.equal(report.target.body, "Fictional reported reply.");
});

test("a post report has one image group while missing or legacy images remain explicit", () => {
  const value = fixture(); value.targetType = "post"; value.targetId = postId; value.target = value.post; value.parent = null;
  assert.deepEqual(communityReviewGroups(read(value)).map(group => group.context), ["target"]);
  const legacy = fixture(); Object.assign(legacy.target.assets[0], { width: null, height: null, orientation: null, available: false });
  const report = read(legacy);
  assert.equal(report.canDismiss, false);
  assert.deepEqual(report.target.assets[0], legacy.target.assets[0]);
  legacy.history[0].note = null;
  assert.equal(read(legacy).history[0].note, "");
});

test("malformed, mixed-target and incomplete render metadata cannot open a review", () => {
  for (const change of [
    value => { value.id = postId; }, value => { value.reviewVersion = "not-a-digest"; },
    value => { value.targetId = parentId; }, value => { value.target.exam = "ceed"; },
    value => { value.parent.id = value.targetId; }, value => { value.status = "resolved"; },
    value => { value.target.assets.push(value.target.assets[0]); },
    value => { value.target.assets[0].width = null; }, value => { value.target.assets[0].width = 12001; },
    value => { value.target.assets[0].orientation = 9; }, value => { value.target.assets[0].available = "true"; },
    value => { value.history[0].createdAt = "unavailable"; },
  ]) {
    const value = fixture(); change(value);
    assert.throws(() => read(value), /could not be verified/);
  }
});

test("decisions bind the inspected version and require a trimmed human reason", () => {
  const report = read(fixture());
  assert.deepEqual(communityReviewInput(report, "hide", "  Original fictional image checked.  "), {
    p_report_id: reportId, p_expected_version: "a".repeat(64), p_resolution: "hide", p_note: "Original fictional image checked.",
  });
  for (const note of [null, "       ", "short", "x".repeat(1001)]) assert.throws(() => communityReviewInput(report, "hide", note), /8 to 1000/);
  assert.throws(() => communityReviewInput(report, "restore", "A complete valid reason."), /Reopen/);
  const incomplete = { ...report, canDismiss: false };
  assert.throws(() => communityReviewInput(incomplete, "dismiss", "A complete valid reason."), /unavailable/);
  assert.equal(communityReviewInput(incomplete, "hide", "Contain the fictional issue.").p_resolution, "hide");
});

test("RPC and Edge failures expose only safe fixed messages", async () => {
  const known = await communityReviewFailure({ code: "40001", details: "community_review_changed", message: "private SQL and account details" });
  assert.equal(known.kind, "stale"); assert.match(known.message, /Reopen/);
  const edge = await communityReviewFailure({ context: new Response(JSON.stringify({ code: "community_review_unavailable", error: "private diagnostics" })) });
  assert.equal(edge.kind, "unavailable");
  for (const status of [401,403]) {
    const bare = await communityReviewFailure({ context: new Response("private HTML diagnostic", { status }) });
    assert.equal(bare.kind, "unavailable"); assert.equal(bare.message.includes("diagnostic"), false);
  }
  for (const detail of ["community_review_incomplete", "community_review_invalid", "community_review_required"]) {
    const result = await communityReviewFailure({ details: detail, message: "private diagnostics" });
    assert.equal(result.message.includes("private diagnostics"), false);
  }
  const unknown = await communityReviewFailure({ code: "XX000", message: "private diagnostics" });
  assert.equal(unknown.kind, "retry"); assert.equal(unknown.message.includes("diagnostics"), false);
});

test("signed images must match the requested context identities and validated metadata", () => {
  const group = communityReviewGroups(read(fixture()))[0], response = signed(group);
  assert.equal(communityReviewMedia(response, group, 1200).lifetime, 298800);
  assert.equal(communityReviewMedia(response, group, 300001).lifetime, 0);
  for (const change of [
    result => { result.media = []; }, result => { result.media.push(result.media[0]); },
    result => { result.media[0].id = parentId; }, result => { result.media[0].ordinal = 2; },
    result => { result.media[0].orientation = 1; }, result => { result.media[0].width = null; },
    result => { result.media[0].url = "javascript:private()"; }, result => { result.media[0].url = "https://user:password@example.invalid/"; },
    result => { result.media[0].url = "http://remote.example.invalid/image"; },
    result => { result.serverNow = "missing"; }, result => { result.expiresAt = "2026-01-01T00:06:00Z"; },
    result => { result.expiresAt = result.serverNow; },
  ]) {
    const result = signed(group); change(result);
    assert.throws(() => communityReviewMedia(result, group), /could not be verified/);
  }
  group.content.assets[0].available = false;
  assert.throws(() => communityReviewMedia(response, group), /could not be verified/);
});
