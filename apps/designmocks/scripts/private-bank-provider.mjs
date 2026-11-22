import project from "../supabase/project.json" with { type: "json" };

const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
const managedHost = /^([a-z0-9]{20})\.supabase\.co$/;

export function bankProviderConfiguration(env) {
  return {
    url: env.DMOCKS_SUPABASE_URL, serviceRoleKey: env.DMOCKS_SUPABASE_SERVICE_ROLE_KEY,
    allowOrigin: env.DMOCKS_BANK_ALLOW_ORIGIN, environment: env.DMOCKS_BANK_ENVIRONMENT,
    productionAck: env.DMOCKS_BANK_PRODUCTION_ACK,
    expandedStagingProfile: env.DMOCKS_BANK_PROFILE === "expanded-staging",
    auditDatabaseUrl: env.DMOCKS_BANK_AUDIT_DATABASE_URL,
    auditDatabaseCaFile: env.DMOCKS_BANK_AUDIT_DATABASE_CA_FILE,
  };
}

export function serviceClaims(key) {
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
  if (environment === "production" && ref === project.project_ref) throw new Error("Production operations require a separate Supabase project from DMocks staging");

  const secret = typeof serviceRoleKey === "string" && /^sb_secret_[A-Za-z0-9_-]+$/.test(serviceRoleKey);
  const claims = secret ? null : serviceClaims(serviceRoleKey);
  if (!secret && claims?.role !== "service_role") throw new Error("A server-only service-role credential is required");
  if (!secret && ((ref && claims.ref !== ref) || (local && /^[a-z0-9]{20}$/.test(claims.ref ?? "")))) {
    throw new Error("The service-role credential belongs to a different provider project");
  }
  return { origin, secret, key: serviceRoleKey };
}

function providerFailure(operation, requestLabel, httpStatus) {
  const error = new Error(httpStatus ? `${requestLabel} ${operation} failed (HTTP ${httpStatus})` : `${requestLabel} ${operation} failed`);
  error.code = "PRIVATE_BANK_PROVIDER_FAILED";
  error.operation = operation;
  if (httpStatus) error.httpStatus = httpStatus;
  return error;
}

export function openPrivateDMocksTransport(config, {
  fetchImpl = fetch, acknowledgement = "USE_PRIVATE_BANK_ON", requestLabel = "Private bank request", timeoutMs = 45000,
} = {}) {
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
    const deadline = AbortSignal.timeout(timeoutMs);
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
      throw providerFailure(operation, requestLabel);
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw providerFailure(operation, requestLabel, response.status);
    }
    try {
      const content = await response.text();
      return content ? JSON.parse(content) : null;
    }
    catch { throw providerFailure(operation, requestLabel); }
  }

  return { origin, fetch: fetchFromTarget, rpc };
}

const expandedStagingSnapshot = `select jsonb_build_object(
  'closedSettings',exists(select 1 from public.launch_settings where singleton and environment_mode='test' and sales_enabled is false),
  'restrictedAdmission',exists(select 1 from dm_private.registration_policy where id and mode in('closed','testers')),
  'testCheckoutClosed',exists(select 1 from dm_private.mvp_test_checkout_control where singleton and enabled is false),
  'profileDrift',dm_private.mvp_profile_permissions_valid() is false,
  'bankServiceOnly',coalesce((select bool_and(
    to_regprocedure(signature) is not null
    and has_function_privilege('service_role',to_regprocedure(signature),'EXECUTE')
    and not has_function_privilege('anon',to_regprocedure(signature),'EXECUTE')
    and not has_function_privilege('authenticated',to_regprocedure(signature),'EXECUTE'))
    from unnest(array[
      'public.begin_question_bank_import(text,text,text,integer,integer,integer,integer)',
      'public.import_question_bank_batch(uuid,jsonb)',
      'public.finish_question_bank_import(uuid)']) signature),false))`;

async function defaultAuditDatabase(url, options) {
  const { openRecoveryPostgres } = await import('./recovery-postgres.mjs');
  return openRecoveryPostgres(url, options);
}

async function verifyExpandedStagingBankProfile(config, health, openDatabase) {
  const origin = `https://${project.project_ref}.supabase.co`;
  if (config.expandedStagingProfile !== true || config.environment !== 'staging' ||
      config.url !== origin || config.allowOrigin !== origin || health.paymentMode !== 'test' ||
      !config.auditDatabaseUrl || !config.auditDatabaseCaFile)
    throw new Error('The approved target must have the current DMocks paid MVP profile');
  let database;
  try {
    database = await openDatabase(config.auditDatabaseUrl, { localOnly: false, databaseCaFile: config.auditDatabaseCaFile });
    const state = JSON.parse(await database.query(expandedStagingSnapshot));
    if (['closedSettings', 'restrictedAdmission', 'testCheckoutClosed', 'profileDrift', 'bankServiceOnly']
      .some(key => state?.[key] !== true))
      throw new Error('The expanded staging bank profile is not safe for import');
  } catch {
    throw new Error('The expanded staging bank profile is not safe for import');
  } finally { await database?.close(); }
}

export async function openPrivateBankProvider(config, { openDatabase = defaultAuditDatabase, ...options } = {}) {
  const provider = openPrivateDMocksTransport(config, options);
  // Check the installed application before sending source rows, runtime plans or files.
  const health = await provider.rpc("admin_operational_health");
  if (health?.scope !== "paid-mvp-v1" || health.monitorVersion !== 1) {
    throw new Error("The approved target must have the current DMocks paid MVP profile");
  }
  if (health.apiProfileReady !== true)
    await verifyExpandedStagingBankProfile(config, health, openDatabase);
  return provider;
}
