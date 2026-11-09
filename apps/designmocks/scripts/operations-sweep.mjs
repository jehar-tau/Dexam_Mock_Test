import { pathToFileURL } from "node:url";

const productionHosts=new Set(["dmocks.com","www.dmocks.com"]);
function jwtPayload(key){try{const part=key.split(".")[1];return JSON.parse(Buffer.from(part,"base64url").toString("utf8"))}catch{return null}}

export function validateOperationsConfiguration({url,key,allowOrigin,environment,productionAck}, action="FINALIZE_EXPIRED_ATTEMPTS_ON"){
  if(!url||!key)throw new Error("DMOCKS_SUPABASE_URL and DMOCKS_SUPABASE_SERVICE_ROLE_KEY are required");
  const target=new URL(url);
  if(target.protocol!=="https:"&&!(target.protocol==="http:"&&['localhost','127.0.0.1','[::1]'].includes(target.hostname)))throw new Error("Operations target must use HTTPS outside localhost");
  if(target.username||target.password||target.search||target.hash||target.pathname!=="/")throw new Error("Operations target must be a credential-free origin");
  if(allowOrigin!==target.origin)throw new Error("DMOCKS_OPERATIONS_ALLOW_ORIGIN must exactly match the target origin");
  if(!["staging","production"].includes(environment))throw new Error("Operations environment must be staging or production");
  const payload=jwtPayload(key),serverKey=key.startsWith("sb_secret_")||payload?.role==="service_role";
  if(!serverKey||key.startsWith("sb_publishable_")||payload?.role==="anon")throw new Error("A server-only service-role credential is required");
  const production=environment==="production"||productionHosts.has(target.hostname);
  if(production&&productionAck!==`${action}_${target.origin}`)throw new Error("Exact production operations acknowledgement is required");
  if(environment!=="production"&&productionHosts.has(target.hostname))throw new Error("Production host cannot run in staging mode");
  return{origin:target.origin,environment};
}

async function rpc(origin, key, name, body, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(`${origin}/rest/v1/rpc/${name}`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`Could not reach ${name}`);
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new Error(`${name} failed (${response.status})`);
  }
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Invalid ${name} response`);
  }
}

const queueKeys=Object.freeze(['staleAttempts','expiredAttempts','stalePendingOrders','paymentReviews','openBugs','pendingQuestionReports']);
function mvpHealth(value, requireMonitor){
  if(!value||value.scope!=="paid-mvp-v1"||!["healthy","attention","degraded"].includes(value.status)||
    typeof value.checkedAt!=="string"||!/^\d{4}-\d\d-\d\dT/.test(value.checkedAt)||!Number.isFinite(Date.parse(value.checkedAt))||
    queueKeys.some(key=>!Number.isSafeInteger(value[key])||value[key]<0))throw new Error("MVP operations profile or aggregate response is not verified");
  const health = {
    scope: value.scope, checkedAt: value.checkedAt, status: value.status,
    queues: Object.fromEntries(queueKeys.map(key => [key, value[key]])),
  };
  if (requireMonitor) {
    if (value.monitorVersion !== 1 || typeof value.apiProfileReady !== "boolean"
      || !Number.isSafeInteger(value.unverifiedPasses) || value.unverifiedPasses < 0) {
      throw new Error("MVP monitoring response is not verified");
    }
    health.apiProfileReady = value.apiProfileReady;
    health.queues.unverifiedPasses = value.unverifiedPasses;
  } else if (value.apiProfileReady === false) {
    throw new Error("MVP operations permissions are not verified");
  }
  return health;
}

export async function readOperationsHealth({ origin, key, fetchImpl = fetch, requireMonitor = false }) {
  return mvpHealth(await rpc(origin, key, "admin_operational_health", {}, fetchImpl), requireMonitor);
}
export async function runOperationsSweep(config,{fetchImpl=fetch,maxBatches=10,batchSize=500,now=new Date()}={}){
  const validated=validateOperationsConfiguration(config);
  if(!Number.isInteger(maxBatches)||maxBatches<1||maxBatches>20||!Number.isInteger(batchSize)||batchSize<1||batchSize>500)throw new Error("Invalid bounded sweep limits");
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new Error("Invalid operations clock");
  // Verify the deployed MVP profile and service authorization before any write.
  await readOperationsHealth({ origin: validated.origin, key: config.key, fetchImpl });
  let finalized=0,batches=0,count=0;
  while(batches<maxBatches){count=await rpc(validated.origin,config.key,"finalize_expired_attempts",{p_limit:batchSize},fetchImpl);if(!Number.isInteger(count)||count<0||count>batchSize)throw new Error("Invalid finalization count");finalized+=count;batches+=1;if(count<batchSize)break}
  const pruned=await rpc(validated.origin,config.key,"prune_attempt_rate_buckets",{p_before:new Date(now.getTime()-2*86400000).toISOString()},fetchImpl);
  if(!Number.isSafeInteger(pruned)||pruned<0)throw new Error("Invalid prune count");
  const health=await readOperationsHealth({ origin: validated.origin, key: config.key, fetchImpl });
  return{environment:validated.environment,...health,finalizedAttempts:finalized,finalizationBatches:batches,finalizationLimitReached:batches===maxBatches&&count===batchSize,prunedRateBuckets:pruned};
}

export function operationsConfiguration(env) {
  return {
    url: env.DMOCKS_SUPABASE_URL, key: env.DMOCKS_SUPABASE_SERVICE_ROLE_KEY,
    allowOrigin: env.DMOCKS_OPERATIONS_ALLOW_ORIGIN, environment: env.DMOCKS_OPERATIONS_ENVIRONMENT,
    productionAck: env.DMOCKS_OPERATIONS_PRODUCTION_ACK,
  };
}

async function main(){const result=await runOperationsSweep(operationsConfiguration(process.env));process.stdout.write(`${JSON.stringify(result)}\n`);if(result.status==="degraded")process.exitCode=2}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{process.stderr.write(`${error.message}\n`);process.exitCode=1});
