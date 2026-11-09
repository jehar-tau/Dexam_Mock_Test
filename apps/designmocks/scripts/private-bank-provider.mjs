const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
const managedHost = /^([a-z0-9]{20})\.supabase\.co$/;

export function bankProviderConfiguration(env) {
  return {
    url: env.DMOCKS_SUPABASE_URL, serviceRoleKey: env.DMOCKS_SUPABASE_SERVICE_ROLE_KEY,
    allowOrigin: env.DMOCKS_BANK_ALLOW_ORIGIN, environment: env.DMOCKS_BANK_ENVIRONMENT,
    productionAck: env.DMOCKS_BANK_PRODUCTION_ACK,
  };
}

function serviceClaims(key) {
  if (typeof key !== "string" || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(key)) return null;
  try { return JSON.parse(Buffer.from(key.split(".")[1], "base64url")); }
  catch { return null; }
}

function targetConfiguration({ url, serviceRoleKey, allowOrigin, environment, productionAck }, acknowledgement) {
  let target;
  try { target = new URL(url); }
  catch { throw new Error("A private DMocks API origin is required"); }
  const { origin, hostname, protocol } = target;
  const local = loopback.has(hostname) && ["http:", "https:"].includes(protocol);
  const ref = protocol === "https:" && !target.port && hostname.match(managedHost)?.[1];
  if (target.username || target.password || target.search || target.hash || target.pathname !== "/"
    || (!local && !ref)) throw new Error("Use an approved Supabase origin or a loopback fixture");
  if (allowOrigin !== origin) throw new Error("The approved origin must exactly match the DMocks API origin");
  if (!["development", "staging", "production"].includes(environment) || (environment === "development" && !local)) {
    throw new Error("Choose the bank environment explicitly. Development requires loopback");
  }
  if (environment === "production" && productionAck !== `${acknowledgement}_${origin}`) {
    throw new Error("Exact production bank acknowledgement is required");
  }
  if (environment === "production" && !ref) throw new Error("Production bank work requires a managed Supabase project");

  const secret = typeof serviceRoleKey === "string" && /^sb_secret_[A-Za-z0-9_-]+$/.test(serviceRoleKey);
  const claims = secret ? null : serviceClaims(serviceRoleKey);
  if (!secret && claims?.role !== "service_role") throw new Error("A server-only service-role credential is required");
  if (!secret && ((ref && claims.ref !== ref) || (local && /^[a-z0-9]{20}$/.test(claims.ref ?? "")))) {
    throw new Error("The service-role credential belongs to a different provider project");
  }
  return { origin, secret, key: serviceRoleKey };
}

function providerFailure(operation, httpStatus) {
  const error = new Error(httpStatus ? `Private bank request ${operation} failed (HTTP ${httpStatus})` : `Private bank request ${operation} failed`);
  error.code = "PRIVATE_BANK_PROVIDER_FAILED";
  error.operation = operation;
  if (httpStatus) error.httpStatus = httpStatus;
  return error;
}

export async function openPrivateBankProvider(config, { fetchImpl = fetch, acknowledgement = "USE_PRIVATE_BANK_ON" } = {}) {
  const { origin, secret, key } = targetConfiguration(config, acknowledgement);
  function fetchFromTarget(input, init = {}) {
    const request = input instanceof Request ? input : null;
    const destination = new URL(request?.url ?? input);
    if (destination.origin !== origin || destination.username || destination.password) {
      throw new Error("Private bank requests must stay on the approved origin");
    }
    const headers = new Headers(init.headers ?? request?.headers);
    headers.set("apikey", key);
    if (secret) headers.delete("authorization");
    else headers.set("authorization", `Bearer ${key}`);
    const deadline = AbortSignal.timeout(45000);
    const signal = init.signal ?? request?.signal;
    return fetchImpl(input, { ...init, headers, redirect: "error", signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
  }
  async function rpc(operation, body = {}) {
    let response;
    try {
      response = await fetchFromTarget(`${origin}/rest/v1/rpc/${operation}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
    } catch {
      throw providerFailure(operation);
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw providerFailure(operation, response.status);
    }
    try {
      const content = await response.text();
      return content ? JSON.parse(content) : null;
    }
    catch { throw providerFailure(operation); }
  }

  // Check the installed application before sending source rows, runtime plans or files.
  const health = await rpc("admin_operational_health");
  if (health?.scope !== "paid-mvp-v1" || health.monitorVersion !== 1 || health.apiProfileReady !== true) {
    throw new Error("The approved target must have the current DMocks paid MVP profile");
  }
  return { origin, fetch: fetchFromTarget, rpc };
}
