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

// On the public free portal, the operator may stage a year paper while checkout
// stays closed. This audit only enables the named paper functions and bucket.
const paperFunctions = new Map([
  ['canonical_bank_media_manifest', ''],
  ['stage_objective_year_sources', 'jsonb,text,jsonb'],
  ['register_bank_media_assets', 'jsonb'],
  ['upsert_nift_question_bank_runtime_batch', 'jsonb'],
  ['upsert_question_bank_runtime_batch', 'jsonb'],
  ['upsert_nid_year_runtime_batch', 'jsonb,jsonb'],
  ['upsert_nift_year_runtime_batch', 'jsonb,jsonb'],
  ['prepare_free_year_paper', 'jsonb'],
  ['register_free_year_paper', 'uuid,text,integer,text,text,integer,text'],
  ['stage_all_india_paper', 'jsonb,text'],
]);
const freePaperAudit = `select jsonb_build_object(
  'freeAdmission',exists(select 1 from dm_private.registration_policy where id and mode='open'),
  'policyActive',exists(select 1 from public.launch_settings where singleton and
    environment_mode='test' and sales_enabled is false and policy_version ~ '^dmocks-notices-v1-[0-9a-f]{64}$'),
  'noticeInstalled',to_regprocedure('public.free_signup_notice()') is not null
    and has_function_privilege('authenticated','public.free_signup_notice()','EXECUTE')
    and not has_function_privilege('anon','public.free_signup_notice()','EXECUTE'),
  'bucketPrivate',exists(select 1 from storage.buckets where id='paper-media' and public=false),
  'paperServiceOnly',coalesce((select bool_and(to_regprocedure(fn) is not null
    and has_function_privilege('service_role',to_regprocedure(fn),'EXECUTE')
    and not has_function_privilege('anon',to_regprocedure(fn),'EXECUTE')
    and not has_function_privilege('authenticated',to_regprocedure(fn),'EXECUTE'))
    from unnest(array[${[...paperFunctions].map(([name,args])=>`'public.${name}(${args})'`).join(',')}]) fn),false))`;

function scopeFreePaperTransport(provider) {
  return {
    origin: provider.origin,
    rpc(name, body) {
      if (!paperFunctions.has(name)) throw new Error('Unsupported year-paper operation');
      return provider.rpc(name, body);
    },
    fetch(input, init={}) {
      const url=new URL(input instanceof Request?input.url:input);
      const method=(init.method ?? (input instanceof Request?input.method:'GET')).toUpperCase();
      const bucketRead=method==='GET' && url.pathname==='/storage/v1/bucket/paper-media';
      const objectRead=method==='GET' && /^\/storage\/v1\/object\/authenticated\/paper-media\/papers\/canonical\/[0-9a-f]{64}\.png$/.test(url.pathname);
      const objectWrite=method==='POST' && /^\/storage\/v1\/object\/paper-media\/papers\/canonical\/[0-9a-f]{64}\.png$/.test(url.pathname)
        && new Headers(init.headers ?? (input instanceof Request?input.headers:undefined)).get('x-upsert')==='false';
      if (url.search || ![bucketRead,objectRead,objectWrite].includes(true)) throw new Error('Unsupported year-paper storage operation');
      return provider.fetch(input, init);
    },
  };
}

async function defaultAuditDatabase(url, options) {
  const { openRecoveryPostgres } = await import('./recovery-postgres.mjs');
  return openRecoveryPostgres(url, options);
}

async function verifyExpandedStagingBankProfile(config, health, openDatabase, yearPapers) {
  const origin = `https://${project.project_ref}.supabase.co`;
  if (config.expandedStagingProfile !== true || config.environment !== 'staging' ||
      config.url !== origin || config.allowOrigin !== origin || health.paymentMode !== 'test' ||
      !config.auditDatabaseUrl || !config.auditDatabaseCaFile)
    throw new Error('The approved target must have the current DMocks paid MVP profile');
  let database;
  try {
    database = await openDatabase(config.auditDatabaseUrl, { localOnly: false, databaseCaFile: config.auditDatabaseCaFile });
    const state = JSON.parse(await database.query(expandedStagingSnapshot));
    if (['closedSettings', 'testCheckoutClosed', 'profileDrift', 'bankServiceOnly']
      .some(key => state?.[key] !== true))
      throw new Error('The expanded staging bank profile is not safe for import');
    if (state.restrictedAdmission !== true) {
      if (!yearPapers) throw new Error();
      const paper = JSON.parse(await database.query(freePaperAudit));
      if (['freeAdmission','policyActive','noticeInstalled','bucketPrivate','paperServiceOnly'].some(key=>paper?.[key] !== true)) throw new Error();
    }
  } catch {
    throw new Error('The expanded staging bank profile is not safe for import');
  } finally { await database?.close(); }
}

async function openProvider(config, { openDatabase = defaultAuditDatabase, ...options }, yearPapers) {
  const provider = openPrivateDMocksTransport(config, options);
  // Check the installed application before sending source rows, runtime plans or files.
  const health = await provider.rpc("admin_operational_health");
  if (health?.scope !== "paid-mvp-v1" || health.monitorVersion !== 1) {
    throw new Error("The approved target must have the current DMocks paid MVP profile");
  }
  if (health.apiProfileReady !== true)
    await verifyExpandedStagingBankProfile(config, health, openDatabase, yearPapers);
  return yearPapers ? scopeFreePaperTransport(provider) : provider;
}

export const openPrivateBankProvider = (config, options={}) => openProvider(config, options, false);
export const openFreeYearPaperProvider = (config, options={}) => openProvider(config, options, true);
