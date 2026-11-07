import test from "node:test";
import assert from "node:assert/strict";
import { communityReportAcknowledged, communityReportFailure, communityReportInput, communityReportReasons, communityReportTarget } from "../src/community-report.js";

const postId = "10000000-0000-4000-8000-000000000701", commentId = "20000000-0000-4000-8000-000000000701";
const post = { postId, commentId: null }, reply = { postId: null, commentId };

test("report targets contain exactly one valid discussion or reply UUID", () => {
  assert.deepEqual(communityReportTarget(post), post);
  assert.deepEqual(communityReportTarget(reply), reply);
  assert.deepEqual(communityReportTarget({ postId: postId.toUpperCase(), label: "Ignored payload label" }), post);
  const uppercase = "ABCDEFAB-ABCD-4ABC-8ABC-ABCDEFABCDEF";
  assert.equal(communityReportTarget({ postId: uppercase }).postId, uppercase.toLowerCase());
  for (const target of [null, {}, { postId: null, commentId: null }, { postId, commentId }, { postId: "preview" },
    { commentId: [commentId] }, { postId: 1 }, { postId: "../" + postId }, { postId: postId + "extra" }]) {
    assert.throws(() => communityReportTarget(target), { code: "community_report_target" });
  }
});

test("all established reasons preserve exact target identity and trim optional details", () => {
  assert.deepEqual(communityReportReasons.map(item => item.value), ["spam", "abuse", "copyright", "answer_leak", "other"]);
  for (const { value } of communityReportReasons) {
    assert.deepEqual(communityReportInput(reply, value, "  A fictional note about this exact reply.  "), {
      p_post_id: null, p_comment_id: commentId, p_reason: value, p_details: "A fictional note about this exact reply.",
    });
  }
  for (const details of ["", "  \n\t ", null, undefined]) assert.equal(communityReportInput(post, "other", details).p_details, null);
});

test("invalid reasons, non-text details and overlong trimmed details create no request", () => {
  for (const reason of [null, "SPAM", "spam ", "unlisted", ["other"]]) assert.throws(() => communityReportInput(post, reason, ""), { code: "community_report_invalid" });
  for (const details of [{}, ["text"], 1, "x".repeat(1001)]) assert.throws(() => communityReportInput(post, "other", details), { code: "community_report_invalid" });
  assert.equal(communityReportInput(post, "other", "x".repeat(1000)).p_details.length, 1000);
  assert.equal([...communityReportInput(post, "other", "😀".repeat(1000)).p_details].length, 1000);
  assert.throws(() => communityReportInput(post, "other", "😀".repeat(1001)), { code: "community_report_invalid" });
});

test("the retry payload is an immutable snapshot independent of later form and target edits", () => {
  const target = { ...reply }, payload = communityReportInput(target, "copyright", "  Original fictional details.  ");
  target.commentId = "20000000-0000-4000-8000-000000000702";
  assert.equal(Object.isFrozen(payload), true);
  assert.throws(() => { payload.p_reason = "other"; }, TypeError);
  assert.deepEqual(payload, { p_post_id: null, p_comment_id: commentId, p_reason: "copyright", p_details: "Original fictional details." });
  assert.equal(Object.keys(payload).length, 4);
});

test("only the documented void acknowledgements confirm a save", () => {
  assert.equal(communityReportAcknowledged(null), true);
  assert.equal(communityReportAcknowledged(undefined), true);
  for (const value of [false, true, 0, "saved", {}, []]) assert.equal(communityReportAcknowledged(value), false);
});

test("duplicate receipts acknowledge the existing report without claiming new details replaced it", async () => {
  const value = await communityReportFailure({ code: "23505", details: "community_report_exists", message: "private provider diagnostics" });
  assert.equal(value.kind, "exists");
  assert.match(value.message, /already reported.*this account/);
  assert.match(value.message, /earlier reason and details remain unchanged/);
  assert.equal(value.message.includes("private provider"), false);
});

test("known rejection details and wrapped Edge codes use fixed safe messages", async () => {
  for (const [details, part] of [["community_report_limit", "report limit"], ["community_report_unavailable", "unavailable"],
    ["community_report_invalid", "1000 characters"], ["community_report_sign_in", "Sign in again"]]) {
    const value = await communityReportFailure({ details, code: "42501", message: "private diagnostic" });
    assert.equal(value.kind, "rejected"); assert.ok(value.message.includes(part)); assert.equal(value.message.includes("diagnostic"), false);
  }
  const wrapped = await communityReportFailure({ context: new Response(JSON.stringify({ code: "community_report_exists", error: "private diagnostic" })) });
  assert.equal(wrapped.kind, "exists");
});

test("unknown errors remain unconfirmed and never expose provider text", async () => {
  for (const error of [undefined, new Error("private diagnostic"), { code: "23505", message: "private diagnostic" },
    { context: new Response("private diagnostic", { status: 503 }) }, { details: "unrecognized", code: "XX000" }]) {
    const result = await communityReportFailure(error);
    assert.equal(result.kind, "unconfirmed"); assert.match(result.message, /may already be saved/);
    assert.equal(result.message.includes("private diagnostic"), false);
  }
});
