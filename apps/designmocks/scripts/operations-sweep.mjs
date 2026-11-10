import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openPrivateDMocksTransport } from "./private-bank-provider.mjs";

const isPaymentMode = value => value === "test" || value === "live";

export function openOperationsProvider(config, { fetchImpl = fetch, acknowledgement = "FINALIZE_EXPIRED_ATTEMPTS_ON" } = {}) {
  const { url, key, allowOrigin, environment, productionAck } = config;
  if (!["staging", "production"].includes(environment)) throw new Error("Operations environment must be staging or production");
  const expectedPaymentMode = config.expectedPaymentMode ?? (environment === "production" ? "live" : "test");
  if (!isPaymentMode(expectedPaymentMode) || (environment === "staging" && expectedPaymentMode !== "test")) {
    throw new Error("Choose a valid payment mode for the operations environment");
  }
  const { origin, rpc } = openPrivateDMocksTransport({ url, serviceRoleKey: key, allowOrigin, environment, productionAck }, {
    fetchImpl, acknowledgement, requestLabel: "Operations request", timeoutMs: 15000,
  });
  return { origin, rpc, environment, expectedPaymentMode };
}

const queueKeys=Object.freeze(['staleAttempts','expiredAttempts','stalePendingOrders','paymentReviews','openBugs','pendingQuestionReports']);
function mvpHealth(value, requireMonitor){
  if(!value||value.scope!=="paid-mvp-v1"||!isPaymentMode(value.paymentMode)||!["healthy","attention","degraded"].includes(value.status)||
    typeof value.checkedAt!=="string"||!/^\d{4}-\d\d-\d\dT/.test(value.checkedAt)||!Number.isFinite(Date.parse(value.checkedAt))||
    queueKeys.some(key=>!Number.isSafeInteger(value[key])||value[key]<0))throw new Error("MVP operations profile or aggregate response is not verified");
  const health = {
    scope: value.scope, checkedAt: value.checkedAt, status: value.status, paymentMode: value.paymentMode,
    queues: Object.fromEntries(queueKeys.map(key => [key, value[key]])),
  };
  if (requireMonitor) {
    if (value.monitorVersion !== 1 || typeof value.apiProfileReady !== "boolean"
      || !Number.isSafeInteger(value.unverifiedPasses) || value.unverifiedPasses < 0) {
      throw new Error("MVP monitoring response is not verified");
    }
    health.apiProfileReady = value.apiProfileReady;
    health.queues.unverifiedPasses = value.unverifiedPasses;
  } else if (value.apiProfileReady !== true) {
    throw new Error("MVP operations permissions are not verified");
  }
  return health;
}

export async function readOperationsHealth(rpc, { requireMonitor = false } = {}) {
  return mvpHealth(await rpc("admin_operational_health"), requireMonitor);
}
export async function runOperationsSweep(config,{fetchImpl=fetch,maxBatches=10,batchSize=500,now=new Date()}={}){
  const { rpc, environment, expectedPaymentMode } = openOperationsProvider(config, { fetchImpl });
  if(!Number.isInteger(maxBatches)||maxBatches<1||maxBatches>20||!Number.isInteger(batchSize)||batchSize<1||batchSize>500)throw new Error("Invalid bounded sweep limits");
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new Error("Invalid operations clock");
  // Verify the deployed MVP profile and service authorization before any write.
  const initial = await readOperationsHealth(rpc);
  if (initial.paymentMode !== expectedPaymentMode) throw new Error("Operations payment mode does not match the approved target");
  let finalized=0,batches=0,count=0;
  while(batches<maxBatches){count=await rpc("finalize_expired_attempts",{p_limit:batchSize});if(!Number.isInteger(count)||count<0||count>batchSize)throw new Error("Invalid finalization count");finalized+=count;batches+=1;if(count<batchSize)break}
  const pruned=await rpc("prune_attempt_rate_buckets",{p_before:new Date(now.getTime()-2*86400000).toISOString()});
  if(!Number.isSafeInteger(pruned)||pruned<0)throw new Error("Invalid prune count");
  const health=await readOperationsHealth(rpc);
  if (health.paymentMode !== expectedPaymentMode) throw new Error("Operations payment mode changed during the sweep");
  return{environment,...health,finalizedAttempts:finalized,finalizationBatches:batches,finalizationLimitReached:batches===maxBatches&&count===batchSize,prunedRateBuckets:pruned};
}

export function operationsConfiguration(env) {
  return {
    url: env.DMOCKS_SUPABASE_URL, key: env.DMOCKS_SUPABASE_SERVICE_ROLE_KEY,
    allowOrigin: env.DMOCKS_OPERATIONS_ALLOW_ORIGIN, environment: env.DMOCKS_OPERATIONS_ENVIRONMENT,
    productionAck: env.DMOCKS_OPERATIONS_PRODUCTION_ACK,
    expectedPaymentMode: env.DMOCKS_OPERATIONS_EXPECT_PAYMENT_MODE,
  };
}

async function main(){const result=await runOperationsSweep(operationsConfiguration(process.env));process.stdout.write(`${JSON.stringify(result)}\n`);if(result.status==="degraded")process.exitCode=2}
if (import.meta.main ?? (process.argv[1] && existsSync(process.argv[1]) &&
    realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)))) {
  main().catch(error=>{process.stderr.write(`${error.message}\n`);process.exitCode=1});
}
