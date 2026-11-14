import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";

const percentile = (values, p) => values.length === 0 ? 0 : [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)];
const checks = new Set(["active-attempt", "accepted-revision", "persisted-revision"]);
const interpolate = (value, fixture) => String(value).replaceAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_, key) => {
  if (!(key in fixture)) throw new Error(`Missing fixture value: ${key}`);
  return String(fixture[key]);
});
const interpolateValue = (value, fixture) => {
  if (typeof value === "string") {
    const exact = value.match(/^\{([A-Za-z][A-Za-z0-9]*)\}$/);
    if (exact) {
      if (!(exact[1] in fixture)) throw new Error(`Missing fixture value: ${exact[1]}`);
      return fixture[exact[1]];
    }
    return interpolate(value, fixture);
  }
  if (Array.isArray(value)) return value.map(item => interpolateValue(item, fixture));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolateValue(item, fixture)]));
  return value;
};

export function validateCapacityPlan(plan) {
  if (!plan || plan.version !== 1) throw new Error("Capacity plan version must be 1");
  const target = new URL(plan.target);
  if (!["http:", "https:"].includes(target.protocol) || target.username || target.password || target.search || target.hash || target.pathname !== "/") throw new Error("Capacity target must be a credential-free HTTP(S) origin");
  if (["dmocks.com", "www.dmocks.com"].includes(target.hostname)) throw new Error("Production capacity tests are forbidden");
  if (!Number.isInteger(plan.sessions) || plan.sessions < 1 || plan.sessions > 500) throw new Error("sessions must be between 1 and 500");
  if (!Number.isInteger(plan.activeAttempts) || plan.activeAttempts < 0 || plan.activeAttempts > plan.sessions) throw new Error("activeAttempts must be between 0 and sessions");
  if (!Number.isInteger(plan.iterations) || plan.iterations < 1 || plan.iterations > 100) throw new Error("iterations must be between 1 and 100");
  for (const kind of ["browser", "activeAttempt"]) {
    if (!Array.isArray(plan.scenarios?.[kind]) || plan.scenarios[kind].length === 0) throw new Error(`${kind} scenario is required`);
    for (const request of plan.scenarios[kind]) {
      if (!request.name || !["GET", "POST"].includes(request.method) || !String(request.path).startsWith("/")) throw new Error(`Invalid ${kind} request`);
      if (String(request.path).startsWith("//")) throw new Error("Request paths must stay on the target origin");
      if (request.check !== undefined && !checks.has(request.check)) throw new Error(`Invalid ${kind} response check`);
    }
  }
  const thresholds = plan.thresholds ?? {};
  if (!(thresholds.maxErrorRate >= 0 && thresholds.maxErrorRate <= 1) || !(thresholds.publicP95Ms > 0) || !(thresholds.authenticatedP95Ms > 0)) throw new Error("Capacity thresholds are required");
  return { ...plan, target: target.origin };
}

function requestHeaders(spec, fixture, env) {
  return Object.fromEntries(Object.entries(spec.headers ?? {}).map(([name, value]) => {
    const raw = typeof value === "object" && value !== null && value.env ? env[value.env] : value;
    if (raw === undefined || raw === "") throw new Error(`Missing request header value for ${name}`);
    return [name, interpolate(raw, fixture)];
  }));
}

export async function runCapacityTest(rawPlan, { fixtures = [], fetchImpl = fetch, env = process.env } = {}) {
  const plan = validateCapacityPlan(rawPlan);
  if (plan.activeAttempts > fixtures.length) throw new Error(`Need ${plan.activeAttempts} synthetic active-attempt fixtures`);
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(new URL(plan.target).hostname);
  if (!local && env.CAPACITY_ALLOW_STAGING_LOAD !== plan.target) throw new Error("Set CAPACITY_ALLOW_STAGING_LOAD to the exact staging origin before remote execution");
  if (plan.scenarios.activeAttempt.some(request => request.check === "persisted-revision")) {
    const used = fixtures.slice(0, plan.activeAttempts);
    if (used.some(fixture => typeof fixture?.questionId !== "string" || !fixture.questionId.trim()
      || fixture.answer === undefined)) {
      throw new Error("Persistence checks require a synthetic question ID and answer");
    }
    for (const field of ["attemptId", "accessToken"]) {
      const values = used.map(fixture => fixture?.[field]);
      if (values.some(value => typeof value !== "string" || !value.trim()) || new Set(values).size !== used.length) {
        throw new Error("Persistence checks require distinct synthetic attempts and access tokens");
      }
    }
  }
  const samples = { browser: [], activeAttempt: [] }, errors = [];
  const requestSamples = Object.fromEntries(
    Object.keys(samples).map(kind => [kind, new Map(plan.scenarios[kind]
      .map(spec => [spec, {latencies: [], errors: 0}]))]),
  );
  function prepare(spec, fixture) {
    const url = new URL(interpolate(spec.path, fixture), plan.target);
    if (url.origin !== plan.target) throw new Error("Capacity request escaped the target origin");
    return {
      url,
      headers: requestHeaders(spec, fixture, env),
      body: spec.body === undefined ? undefined : JSON.stringify(interpolateValue(spec.body, fixture)),
    };
  }

  function matchesCheck(check, payload, fixture, state) {
    if (check === "accepted-revision") return payload?.accepted === true && payload.revision === fixture.revision;
    const sealed = payload?.id === fixture.attemptId && payload.status === "active"
      && Array.isArray(payload.questions) && payload.questions.length > 0
      && payload.questions.every(question => question && typeof question === "object" && !Array.isArray(question)
        && !["correctKey", "explanation", "outcome"].some(field => Object.hasOwn(question, field)));
    if (!sealed || typeof payload.deadline !== "string" || !Number.isFinite(Date.parse(payload.deadline))) return false;
    const deadline = Date.parse(payload.deadline);
    if (state.deadline !== undefined && state.deadline !== deadline) return false;
    state.deadline = deadline;
    if (check === "active-attempt") return true;
    const matching = payload.questions.filter(question => question.id === fixture.questionId);
    return matching.length === 1 && matching[0].answerRevision === fixture.revision
      && isDeepStrictEqual(matching[0].answer, fixture.answer);
  }

  const sessions = Array.from({ length: plan.sessions }, (_, index) => {
    const kind = index < plan.activeAttempts ? "activeAttempt" : "browser";
    const fixture = { ...(kind === "activeAttempt" ? fixtures[index] : {}), sessionId: index + 1, revision: 1 };
    for (const spec of plan.scenarios[kind]) prepare(spec, fixture);
    return {kind, fixture, state: {}};
  });
  const runRequest = async (kind, spec, fixture, state) => {
    const {url, headers, body} = prepare(spec, fixture);
    const started = performance.now();
    const request = requestSamples[kind].get(spec);
    function recordError(status, error) {
      request.errors++;
      errors.push({kind, name: spec.name, status, ...(error ? {error} : {})});
    }
    try {
      const response = await fetchImpl(url, {
        method: spec.method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(spec.timeoutMs ?? 5000),
      });
      if (response.ok && spec.check) {
        const payload = await response.json();
        if (!matchesCheck(spec.check, payload, fixture, state)) {
          recordError(response.status, "ResponseCheckFailed");
        }
      } else {
        // Measure the complete response while discarding content that needs no assertion.
        if (response.body) {
          for await (const chunk of response.body) void chunk;
        }
        if (!response.ok) recordError(response.status);
      }
    } catch {
      recordError(0, "RequestFailed");
    } finally {
      const elapsed = performance.now() - started;
      samples[kind].push(elapsed);
      request.latencies.push(elapsed);
    }
  };
  await Promise.all(sessions.map(async ({kind, fixture, state}) => {
    for (let iteration = 0; iteration < plan.iterations; iteration += 1) {
      fixture.revision = iteration + 1;
      for (const request of plan.scenarios[kind]) await runRequest(kind, request, fixture, state);
    }
  }));
  const total = samples.browser.length + samples.activeAttempt.length;
  const summary = {
    target: plan.target,
    sessions: plan.sessions,
    activeAttempts: plan.activeAttempts,
    requests: total,
    errors: errors.length,
    errorRate: total === 0 ? 0 : errors.length / total,
    browserP95Ms: Math.round(percentile(samples.browser, 0.95)),
    authenticatedP95Ms: Math.round(percentile(samples.activeAttempt, 0.95)),
  };
  summary.passed = summary.errorRate <= plan.thresholds.maxErrorRate && summary.browserP95Ms <= plan.thresholds.publicP95Ms && summary.authenticatedP95Ms <= plan.thresholds.authenticatedP95Ms;
  const requests = Object.entries(requestSamples).flatMap(([kind, entries]) => (
    [...entries].map(([spec, sample]) => ({
      kind, name: spec.name, count: sample.latencies.length, errors: sample.errors,
      p95Ms: Math.round(percentile(sample.latencies, 0.95)),
    }))
  ));
  return { summary, requests, failures: errors.slice(0, 20) };
}

async function main() {
  const args = process.argv.slice(2);
  const value = flag => {
    const index = args.indexOf(flag);
    return index < 0 || args[index + 1]?.startsWith("--") ? undefined : args[index + 1];
  };
  const planPath = value("--plan"), fixturePath = value("--fixtures");
  if (!planPath || !fixturePath || !args.includes("--execute")) throw new Error("Usage: node scripts/capacity-load.mjs --plan PLAN.json --fixtures SYNTHETIC.json --execute");
  const plan = JSON.parse(await readFile(planPath, "utf8")), fixtures = JSON.parse(await readFile(fixturePath, "utf8"));
  const result = await runCapacityTest(plan, { fixtures });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.summary.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
