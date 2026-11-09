export const portalFixtureURL = "http://127.0.0.1:4599";
const fixtureProject = "dmocks-portal-fixture";

const adminLists = new Set([
  "admin_question_drafts", "admin_bank_questions", "admin_exam_mock_blueprints",
  "admin_all_india_events", "admin_reported_questions", "admin_learning_lessons", "admin_question_intake_assets",
  "admin_community_report_queue", "admin_ai_draft_requests",
  "admin_drawing_reviewers", "admin_drawing_queue",
]);

export function emptyAdminRead(procedure) {
  if (["admin_bug_report_page", "admin_privacy_request_page"].includes(procedure)) return { items: [], nextCursor: null };
  if (procedure === 'admin_nid_question_binding') return { binding: null, canConvert: false, materialized: false, requestResult: null, history: [] };
  if (procedure === "admin_nid_practice_blueprints") return { items: [], total: 0, offset: 0, limit: 10 };
  if (procedure === "admin_search_bank_questions") return { items: [], total: 0, offset: 0, limit: 25, topics: [], summary: { active: 0, available: 0, approved: 0, inactive: 0 } };
  if (adminLists.has(procedure)) return [];
  if (procedure === "admin_operational_health") return { status: "healthy", checkedAt: "2026-11-06T12:00:00Z" };
  if (procedure === "admin_launch_readiness") return { gates: [], readyForSales: false, salesEnabled: false };
}

export async function stubPortalIdentity(page,projectRef=fixtureProject){
  const calls=[];
  await page.route(`https://${projectRef}.supabase.co/auth/v1/user`,async route=>{
    const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info, x-supabase-api-version","Access-Control-Allow-Methods":"GET, OPTIONS"};
    if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});
    const token=route.request().headers().authorization?.split(' ')[1];let actor;
    try{actor=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub;}catch{}
    calls.push({actor:actor??null});return route.fulfill({headers,status:actor?200:401,json:actor?{id:actor,aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}}:{message:'Fictional session missing'}});
  });
  return calls;
}

export async function stubPortalProvider(page, respond, projectRef = fixtureProject) {
  const calls = [];
  const unexpected = [];
  const authCalls = [];
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
  await page.route(`https://${projectRef}.supabase.co/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const path = new URL(request.url()).pathname;
    const procedure = path.split("/").at(-1);
    if(path==='/auth/v1/user'){
      const token=request.headers().authorization?.split(' ')[1];let actor;
      try{actor=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub;}catch{}
      authCalls.push({actor:actor??null});
      return route.fulfill({headers,status:actor?200:401,json:actor?{id:actor,aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}}:{message:'Fictional session missing'}});
    }
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
  return { calls, unexpected, authCalls };
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
