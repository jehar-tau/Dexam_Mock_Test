export const portalFixtureURL = "http://127.0.0.1:4599";
const fixtureProject = "dmocks-portal-fixture";

const adminLists = new Set([
  "admin_question_drafts", "admin_bug_reports", "admin_bank_questions", "admin_exam_mock_blueprints",
  "admin_all_india_events", "admin_reported_questions", "admin_learning_lessons", "admin_question_intake_assets",
  "admin_community_report_queue", "admin_ai_draft_requests", "admin_privacy_requests",
  "admin_drawing_reviewers", "admin_drawing_queue",
]);

export function emptyAdminRead(procedure) {
  if (adminLists.has(procedure)) return [];
  if (procedure === "admin_operational_health") return { status: "healthy", checkedAt: "2026-11-06T12:00:00Z" };
  if (procedure === "admin_launch_readiness") return { gates: [], readyForSales: false, salesEnabled: false };
}

export async function stubPortalProvider(page, respond, projectRef = fixtureProject) {
  const calls = [];
  const unexpected = [];
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  await page.route(`https://${projectRef}.supabase.co/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const path = new URL(request.url()).pathname;
    const procedure = path.split("/").at(-1);
    const input = request.postDataJSON() ?? {};
    calls.push([procedure, input]);
    const result = respond(procedure, input);
    if (result === undefined) {
      unexpected.push(path);
      return route.abort();
    }
    const status = result?.code === "42501" ? 403 : result?.code ? 400 : 200;
    return route.fulfill({ json: result, headers, status });
  });
  return { calls, unexpected };
}

export async function seedPortalSession(page, { id, email }, projectRef = fixtureProject) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const user = { id, email, app_metadata: { provider: "google" }, user_metadata: {}, aud: "authenticated" };
  const jwt = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({
    sub: id, aud: "authenticated", role: "authenticated", exp: expiresAt,
  })).toString("base64url")}.fixture`;
  const session = { user, access_token: jwt, refresh_token: "fixture-refresh", expires_at: expiresAt, expires_in: 3600, token_type: "bearer" };
  await page.evaluate(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, { storageKey: `sb-${projectRef}-auth-token`, session });
}
