import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
import {parseArgs} from "node:util";
import project from "../supabase/project.json" with {type: "json"};

const backend = `https://${project.project_ref}.supabase.co`;
const deniedMessage = "Private staging requires an approved Google tester";
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function claims(token) {
  try {
    const parts = token.split(".");
    return parts.length === 3 ? JSON.parse(Buffer.from(parts[1], "base64url")) : null;
  } catch {
    return null;
  }
}

export async function checkStagingApiAdmission({origin, key, admitted, excluded, portalEdge = false, fetchImpl = fetch}) {
  assert.ok(origin === backend, "Use the designated DMocks staging backend origin");
  const apiClaims = claims(key);
  assert.ok(/^sb_publishable_[\w-]+$/.test(key ?? "") ||
    (apiClaims?.role === "anon" && apiClaims.ref === project.project_ref), "Use the public DMocks API key");

  const sessions = [admitted, excluded].map(claims);
  assert.ok(sessions.every(session => session?.role === "authenticated" && uuid.test(session.sub)),
    "Supply two fictional authenticated staging sessions");
  assert.ok(sessions[0].sub !== sessions[1].sub, "Use two different fictional staging accounts");

  async function request(path, token, body, frontendOrigin) {
    try {
      const response = await fetchImpl(origin + path, {
        method: body === undefined ? "GET" : "POST",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: {
          apikey: key,
          ...(token ? {Authorization: "Bearer " + token} : {}),
          ...(body === undefined ? {} : {"Content-Type": "application/json"}),
          ...(frontendOrigin ? {Origin: frontendOrigin} : {}),
        },
        body,
      });
      return {status: response.status, data: await response.json().catch(() => null),
        cors: response.headers.get("access-control-allow-origin") === frontendOrigin};
    } catch {
      return {status: null, data: null};
    }
  }

  const identity = await Promise.all([admitted, excluded].map(token => request("/auth/v1/user", token)));
  assert.ok(identity.every(({status, data}, index) => status === 200 && data?.id === sessions[index].sub),
    "Both fictional sessions must be valid on this staging backend");

  assert.ok(identity.every(({data}) => data.app_metadata?.provider === "google" && data.is_anonymous === false &&
    typeof data.email_confirmed_at === "string" && Number.isFinite(Date.parse(data.email_confirmed_at))),
    "Both fictional accounts must have confirmed Google identities");

  const rpc = (name, token) => request("/rest/v1/rpc/" + name, token, "{}");
  const [eligible, admittedAdmin, admittedHistory, excludedAdmin, excludedHistory, anonymous] = await Promise.all([
    rpc("can_enter_staging_portal", admitted),
    rpc("is_dmocks_admin", admitted),
    rpc("my_attempt_history", admitted),
    rpc("is_dmocks_admin", excluded),
    rpc("my_attempt_history", excluded),
    rpc("can_enter_staging_portal"),
  ]);
  const deniedByHook = ({status, data}) => status === 403 && data?.code === "42501" && data.message === deniedMessage;
  const checks = [
    {check: "admitted-tester", status: eligible.status, passed: eligible.status === 200 && eligible.data === true},
    {check: "admitted-admin-rpc", status: admittedAdmin.status, passed: admittedAdmin.status === 200 && typeof admittedAdmin.data === "boolean"},
    {check: "admitted-history-rpc", status: admittedHistory.status, passed: admittedHistory.status === 200 && Array.isArray(admittedHistory.data)},
    {check: "excluded-admin-rpc", status: excludedAdmin.status, passed: deniedByHook(excludedAdmin)},
    {check: "excluded-history-rpc", status: excludedHistory.status, passed: deniedByHook(excludedHistory)},
    {check: "anonymous-admission-rpc", status: anonymous.status, passed: [401, 403].includes(anonymous.status) && anonymous.data?.code === "42501"},
  ];
  if (portalEdge) {
    const edge = [
      ["attempt-media", 400, "Invalid attempt"],
      ["drawing-media", 400, "Invalid drawing action"],
      ["drawing-review-media", 400, "Invalid review"],
      ["community-media", 400, "Invalid community target"],
      ["question-intake", admittedAdmin.data === true ? 400 : 403,
        admittedAdmin.data === true ? "Intake asset id required" : "Admin access required"],
      ["bank-review-media", 400, "A bank question and review version are required"],
      ["reported-question-media", 400, "A reported question and current revision are required"],
    ];
    const edgeChecks = await Promise.all(edge.map(async ([name, status, error]) => {
      // An empty JSON object can only reach input validation or the intake role check.
      const call = token => request("/functions/v1/" + name, token, "{}", project.staging_frontend_origin);
      const [allowed, denied] = await Promise.all([call(admitted), call(excluded)]);
      return [
        {check: `${name}-admitted`, status: allowed.status,
          passed: allowed.status === status && allowed.cors && allowed.data?.error === error},
        {check: `${name}-excluded`, status: denied.status,
          passed: denied.status === 403 && denied.cors && denied.data?.error === deniedMessage && Object.keys(denied.data).length === 1},
      ];
    }));
    checks.push(...edgeChecks.flat());
  }
  return {scope: portalEdge ? "staging-postgrest-and-portal-edge-admission" : "staging-postgrest-admission-only",
    passed: checks.every(check => check.passed), checks};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const {values} = parseArgs({options: {"portal-edge": {type: "boolean"}}});
    const report = await checkStagingApiAdmission({
      origin: process.env.VITE_SUPABASE_URL,
      key: process.env.VITE_SUPABASE_ANON_KEY,
      admitted: process.env.DMOCKS_ADMITTED_TEST_TOKEN,
      excluded: process.env.DMOCKS_EXCLUDED_TEST_TOKEN,
      portalEdge: values["portal-edge"],
    });
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
