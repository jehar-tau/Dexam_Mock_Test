// Read-only setup smoke checks. This never creates users, orders or payments.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
try {
  process.loadEnvFile(".env.local");
} catch {}
const project = JSON.parse(
  await readFile(new URL("../supabase/project.json", import.meta.url), "utf8"),
);
const base = process.env.VITE_SUPABASE_URL,
  key = process.env.VITE_SUPABASE_ANON_KEY;
assert.equal(
  base,
  `https://${project.project_ref}.supabase.co`,
  "Explicit independent project URL required",
);
assert.ok(key, "A public anon key is required; never use a service key");
if (!key.startsWith("sb_publishable_")) {
  assert.equal(key.split(".").length, 3, "A publishable or legacy anon key is required");
  const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url"));
  assert.equal(payload.role, "anon", "Only the public anon role is allowed");
}
const results = [];
const authStage = process.env.DMOCKS_AUTH_STAGE || "closed";
assert.ok(["closed", "controlled"].includes(authStage), "Explicit closed or controlled Auth test stage required");
const backendStage = process.env.DMOCKS_BACKEND_STAGE || "foundation";
assert.ok(["foundation", "portal", "staging"].includes(backendStage), "Choose foundation, portal or staging backend checks");
const staging = backendStage === "staging";
if (staging) assert.equal(authStage, "controlled", "Staging requires the controlled Auth stage");
const origin = staging ? project.staging_frontend_origin : project.frontend_origin;
async function request(path, method = "GET", body, headers = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { apikey: key, "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null, allowOrigin: response.headers.get("access-control-allow-origin") };
}
let response = await request(
  "/rest/v1/plans?select=id,amount,currency,duration_months",
);
assert.equal(response.status, 200);
assert.deepEqual(response.data, [
  { id: "annual", amount: 119300, currency: "INR", duration_months: 12 },
]);
results.push({ check: "authoritative annual plan", status: 200, passed: true });
for (const name of [
  "prepare_order",
  "my_pass",
  "available_papers",
  "my_attempt_history",
  ...(backendStage !== "foundation" ? [
    "is_dmocks_admin", "my_bug_reports", "admin_bug_report_page", "admin_question_drafts", "export_my_account_data", "request_account_deletion", "my_privacy_requests", "admin_privacy_request_page",
    "admin_bank_questions", "my_candidate_profile", "topic_catalog", "exam_mock_catalog",
    "admin_exam_mock_blueprints", "admin_all_india_events", "all_india_event_catalog",
    "learning_catalog", "admin_learning_lessons", "community_feed", "admin_drawing_queue",
    "my_overview_analytics",
    "canonical_bank_media_manifest", "admin_question_intake_assets",
  ] : []),
  ...(staging ? ["can_enter_staging_portal", "can_review_drawings", "my_drawing_review_page", "admin_drawing_reviewers", "admin_search_bank_questions", "admin_reported_questions"] : []),
]) {
  response = await request("/rest/v1/rpc/" + name, "POST", {});
  assert.ok(
    [401, 403].includes(response.status),
    name + " must reject anonymous execution",
  );
  assert.equal(response.data?.code, "42501");
  results.push({
    check: "anonymous " + name + " denied",
    status: response.status,
    passed: true,
  });
}
if (backendStage !== "foundation") {
  response = await request("/rest/v1/rpc/admin_export_question_draft", "POST", {
    p_draft_id: "00000000-0000-4000-8000-000000000000",
    p_external_key: "hosted-smoke-fixture",
    p_rights_confirmed: false,
    p_rights_note: "Anonymous hosted smoke fixture",
  });
  assert.ok([401, 403].includes(response.status), "anonymous draft export must be denied");
  assert.equal(response.data?.code, "42501");
  results.push({ check: "anonymous admin_export_question_draft denied", status: response.status, passed: true });
  response = await request("/rest/v1/rpc/public_all_india_top_ten", "POST", {});
  assert.equal(response.status, 200, "Alias-only public ranking remains available");
  assert.ok(Array.isArray(response.data));
  results.push({ check: "public ranking route available", status: 200, passed: true });
}
response = await request("/auth/v1/settings");
assert.equal(response.status, 200);
assert.equal(
  response.data.disable_signup,
  authStage === "closed",
  "Auth registration switch does not match the selected setup stage",
);
if (authStage === "controlled") assert.equal(response.data.external?.google, true);
results.push({
  check: authStage === "closed" ? "new registrations globally closed" : "Google enabled for controlled-hook acceptance (allowlist verified separately)",
  status: 200,
  passed: true,
  googleEnabled: Boolean(response.data.external?.google),
});
for (const [name, body, status] of [
  ["create-order", { plan: "annual" }, 503],
  ["attempt-media", { attemptId: "00000000-0000-4000-8000-000000000001" }, 401],
  ["payment-webhook", {}, 503],
]) {
  response = await request("/functions/v1/" + name, "POST", body, {
    Origin: origin,
  });
  assert.equal(response.status, status, name + " setup gate");
  results.push({ check: name + " setup/identity gate", status, passed: true });
}
response = await request(
  "/functions/v1/create-order",
  "POST",
  { plan: "annual" },
  { Origin: "https://invalid.example" },
);
assert.equal(response.status, 403);
results.push({
  check: "unapproved checkout origin denied",
  status: 403,
  passed: true,
});
if (staging) {
  for (const [name, body] of [
    ["my_candidate_profile", {}],
    ["save_candidate_profile", { p_display_name: "Anonymous original fictional profile", p_phone: "+919000000000", p_appearing_year: 2027, p_city: "Original Fictional City", p_exams: ["uceed"] }],
    ["my_bug_report_page", { p_cursor: null, p_limit: 25 }],
    ["submit_bug_report", { p_title: "Anonymous hosted support fixture", p_description: "An anonymous hosted smoke check must never create a support record.", p_page_url: null, p_request_id: "00000000-0000-4000-8000-000000000000" }],
    ["admin_reply_bug_report", { p_id: "00000000-0000-4000-8000-000000000000", p_expected_revision: 0, p_status: "fixed", p_reply: "Anonymous hosted support fixture", p_request_id: "00000000-0000-4000-8000-000000000000" }],
    ["admin_resolve_privacy_request", { p_id: "00000000-0000-4000-8000-000000000000", p_expected_revision: 0, p_status: "closed", p_note: "Anonymous hosted privacy fixture" }],
    ["admin_bank_question", { p_external_key: "hosted-smoke-fixture", p_expected_version: "unavailable" }],
    ["admin_bank_review_media_paths", { p_external_key: "hosted-smoke-fixture", p_expected_version: "unavailable" }],
    ["admin_review_bank_question", { p_external_key: "hosted-smoke-fixture", p_expected_version: "unavailable", p_approved: false,
      p_rights_confirmed: false, p_note: "Anonymous hosted smoke fixture" }],
    ["admin_reported_question", { p_target_key: "hosted-smoke-fixture", p_expected_revision: 1 }],
    ["admin_reported_question_media_paths", { p_target_key: "hosted-smoke-fixture", p_expected_revision: 1 }],
    ["admin_resolve_reported_question", { p_target_key: "hosted-smoke-fixture", p_expected_revision: 1, p_expected_bank_version: null,
      p_action: "retire", p_note: "Anonymous hosted smoke fixture" }],
    ["admin_community_report", { p_report_id: "00000000-0000-4000-8000-000000000000" }],
    ["admin_community_report_media_paths", { p_report_id: "00000000-0000-4000-8000-000000000000", p_expected_version: "0".repeat(64), p_context: "target" }],
    ["admin_resolve_community_report", { p_report_id: "00000000-0000-4000-8000-000000000000", p_expected_version: "0".repeat(64), p_resolution: "dismiss", p_note: "Anonymous hosted smoke fixture" }],
    ["admin_community_content_page", { p_target_type: "post", p_post_id: null, p_exam: null, p_topic: null, p_status: null, p_cursor: null, p_limit: 25 }],
    ["admin_review_community_content", { p_target_type: "post", p_target_id: "00000000-0000-4000-8000-000000000000" }],
    ["admin_community_moderation_media_paths", { p_target_type: "post", p_target_id: "00000000-0000-4000-8000-000000000000", p_expected_version: "0".repeat(64), p_context: "target" }],
    ["admin_moderate_community", { p_target_type: "post", p_target_id: "00000000-0000-4000-8000-000000000000", p_action: "hide", p_note: "Anonymous hosted smoke fixture", p_expected_version: "0".repeat(64), p_request_id: "00000000-0000-4000-8000-000000000000" }],
  ]) {
    response = await request("/rest/v1/rpc/" + name, "POST", body);
    assert.ok([401, 403].includes(response.status), name + " must reject anonymous execution");
    assert.equal(response.data?.code, "42501");
    results.push({ check: "anonymous " + name + " denied", status: response.status, passed: true });
  }
  for (const name of ["attempt-media", "drawing-media", "drawing-review-media", "community-media", "question-intake", "bank-review-media", "reported-question-media"]) {
    response = await request("/functions/v1/" + name, "OPTIONS", undefined, {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,apikey,content-type,x-client-info",
    });
    assert.equal(response.status, 204, name + " staging preflight");
    assert.equal(response.allowOrigin, origin, name + " staging origin");
    results.push({ check: name + " accepts the staging origin", status: 204, passed: true });
  }
}
await mkdir("test-results", { recursive: true });
await writeFile(
  staging ? "test-results/hosted-staging-smoke.json" : "test-results/hosted-smoke.json",
  JSON.stringify(results, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      project: project.name,
      backendStage,
      checks: results.length,
      passed: results.every((result) => result.passed),
    },
    null,
    2,
  ),
);
