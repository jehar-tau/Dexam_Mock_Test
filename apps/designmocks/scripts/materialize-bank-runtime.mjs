// Server/operator entry point. Only this standalone project may receive the plan.
import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';
import{pathToFileURL}from'node:url';
import{loadFromGit,sha256,stableJson}from'./question-bank-import.mjs';
import{runtimeQuestion,RULES_2027}from'./question-runtime.mjs';

export function compileRuntimeManifest(manifest,mediaCatalog){
 assert.ok(Array.isArray(mediaCatalog),'Verified media catalogue required');
 assert.equal(new Set(mediaCatalog.map(a=>a.sha256)).size,mediaCatalog.length,'Duplicate private media digest');
 const byExam={};
 const records=manifest.records.map(record=>{
  const runtime=runtimeQuestion(record.payload,{rule:RULES_2027[record.exam],mediaCatalog});
  const summary=byExam[record.exam]??={ready:0,unavailable:0,withImages:0};
  if(runtime){summary.ready++;if(runtime.media.length)summary.withImages++;}else summary.unavailable++;
  return{externalKey:record.externalKey,contentSha256:record.contentSha256,runtime};
 });
 return{sourceCommit:manifest.sourceCommit,sourceSha256:manifest.sourceSha256,version:'iitb-2027-v1',byExam,total:records.length,ready:records.filter(r=>r.runtime).length,planSha256:sha256(stableJson(records)),records};
}
export async function runtimeOperator({url,serviceRoleKey}){
 const project=JSON.parse(await readFile(new URL('../supabase/project.json',import.meta.url),'utf8'));
 assert.equal(project.project_ref,'tiodqzvvujxvxssvjdis');
 assert.equal(url,`https://${project.project_ref}.supabase.co`,'Only the standalone project is permitted');
 const claims=JSON.parse(Buffer.from(serviceRoleKey?.split('.')[1]||'','base64url'));
 assert.equal(claims.role,'service_role','An operator server key is required');assert.equal(claims.ref,project.project_ref,'Wrong provider project');
 async function rpc(name,body={}){
  const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:serviceRoleKey,authorization:`Bearer ${serviceRoleKey}`,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  if(!response.ok){const error=new Error('Runtime provider request rejected');error.code='RUNTIME_PROVIDER_REJECTED';error.operation=name;error.httpStatus=response.status;throw error;}
  return response.json();
 }
 return{media:()=>rpc('canonical_bank_media_manifest'),apply:async plan=>{
  let recorded=0;
  for(let offset=0;offset<plan.records.length;offset+=100){const batch=plan.records.slice(offset,offset+100);const count=await rpc('upsert_question_bank_runtime_batch',{p_records:batch});assert.equal(count,batch.length,'Runtime registration count mismatch');recorded+=count;}
  return recorded;
 }};
}
async function main(){
 const index=process.argv.indexOf('--ref');const manifest=loadFromGit(index>=0?process.argv[index+1]:'origin/main');
 const operator=await runtimeOperator({url:process.env.DMOCKS_SUPABASE_URL,serviceRoleKey:process.env.DMOCKS_SUPABASE_SERVICE_ROLE_KEY});
 const plan=compileRuntimeManifest(manifest,await operator.media());const {records,...summary}=plan;
 if(process.argv.includes('--apply'))summary.recorded=await operator.apply(plan);
 console.log(JSON.stringify({mode:process.argv.includes('--apply')?'private-runtime-materialization':'dry-run',...summary},null,2));
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)main().catch(error=>{
 console.error(JSON.stringify({code:error.code==='RUNTIME_PROVIDER_REJECTED'?error.code:'RUNTIME_MATERIALIZATION_FAILED',...(error.code==='RUNTIME_PROVIDER_REJECTED'?{operation:error.operation,httpStatus:error.httpStatus}:{})}));process.exitCode=1;
});
