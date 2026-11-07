import { pathToFileURL } from "node:url";

const productionHosts=new Set(["dmocks.com","www.dmocks.com"]);
function jwtPayload(key){try{const part=key.split(".")[1];return JSON.parse(Buffer.from(part,"base64url").toString("utf8"))}catch{return null}}

export function validateOperationsConfiguration({url,key,allowOrigin,environment,productionAck}){
  if(!url||!key)throw new Error("DMOCKS_SUPABASE_URL and DMOCKS_SUPABASE_SERVICE_ROLE_KEY are required");
  const target=new URL(url);
  if(target.protocol!=="https:"&&!['localhost','127.0.0.1','[::1]'].includes(target.hostname))throw new Error("Operations target must use HTTPS outside localhost");
  if(target.username||target.password||target.search||target.hash||target.pathname!=="/")throw new Error("Operations target must be a credential-free origin");
  if(allowOrigin!==target.origin)throw new Error("DMOCKS_OPERATIONS_ALLOW_ORIGIN must exactly match the target origin");
  if(!["staging","production"].includes(environment))throw new Error("Operations environment must be staging or production");
  const payload=jwtPayload(key),serverKey=key.startsWith("sb_secret_")||payload?.role==="service_role";
  if(!serverKey||key.startsWith("sb_publishable_")||payload?.role==="anon")throw new Error("A server-only service-role credential is required");
  const production=environment==="production"||productionHosts.has(target.hostname);
  if(production&&productionAck!==`FINALIZE_EXPIRED_ATTEMPTS_ON_${target.origin}`)throw new Error("Exact production operations acknowledgement is required");
  if(environment!=="production"&&productionHosts.has(target.hostname))throw new Error("Production host cannot run in staging mode");
  return{origin:target.origin,environment};
}

async function rpc(origin,key,name,body,fetchImpl){const response=await fetchImpl(`${origin}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:key,authorization:`Bearer ${key}`,"content-type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)}),text=await response.text();if(!response.ok)throw new Error(`${name} failed (${response.status})`);return text?JSON.parse(text):null}

export async function runOperationsSweep(config,{fetchImpl=fetch,maxBatches=10,batchSize=500,now=new Date()}={}){
  const validated=validateOperationsConfiguration(config);
  if(!Number.isInteger(maxBatches)||maxBatches<1||maxBatches>20||!Number.isInteger(batchSize)||batchSize<1||batchSize>500)throw new Error("Invalid bounded sweep limits");
  let finalized=0,batches=0;
  while(batches<maxBatches){const count=Number(await rpc(validated.origin,config.key,"finalize_expired_attempts",{p_limit:batchSize},fetchImpl));if(!Number.isInteger(count)||count<0||count>batchSize)throw new Error("Invalid finalization count");finalized+=count;batches+=1;if(count<batchSize)break}
  const recovery=await rpc(validated.origin,config.key,"recover_expired_question_jobs",{p_limit:batchSize},fetchImpl);
  const recoveredQuestionJobs={intake:recovery?.intake,aiDrafts:recovery?.aiDrafts};
  if(Object.values(recoveredQuestionJobs).some(count=>!Number.isInteger(count)||count<0||count>batchSize))throw new Error("Invalid question recovery count");
  const pruned=Number(await rpc(validated.origin,config.key,"prune_attempt_rate_buckets",{p_before:new Date(now.getTime()-2*86400000).toISOString()},fetchImpl));
  if(!Number.isInteger(pruned)||pruned<0)throw new Error("Invalid prune count");
  const health=await rpc(validated.origin,config.key,"admin_operational_health",{},fetchImpl);
  return{environment:validated.environment,checkedAt:health.checkedAt,status:health.status,finalizedAttempts:finalized,finalizationBatches:batches,recoveredQuestionJobs,prunedRateBuckets:pruned,queues:Object.fromEntries(Object.entries(health).filter(([key,value])=>key!=="checkedAt"&&key!=="status"&&typeof value==="number"))};
}

async function main(){const config={url:process.env.DMOCKS_SUPABASE_URL,key:process.env.DMOCKS_SUPABASE_SERVICE_ROLE_KEY,allowOrigin:process.env.DMOCKS_OPERATIONS_ALLOW_ORIGIN,environment:process.env.DMOCKS_OPERATIONS_ENVIRONMENT,productionAck:process.env.DMOCKS_OPERATIONS_PRODUCTION_ACK};const result=await runOperationsSweep(config);process.stdout.write(`${JSON.stringify(result)}\n`);if(result.status==="degraded")process.exitCode=2}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{process.stderr.write(`${error.message}\n`);process.exitCode=1});
