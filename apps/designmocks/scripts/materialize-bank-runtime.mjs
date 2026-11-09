// Server/operator entry point. Send the plan to the approved DMocks project.
import assert from 'node:assert/strict';
import{pathToFileURL}from'node:url';
import{loadFromGit,sha256,stableJson}from'./question-bank-import.mjs';
import{runtimeQuestion,RULES_2027}from'./question-runtime.mjs';
import{bankProviderConfiguration,openPrivateBankProvider}from'./private-bank-provider.mjs';

export function compileRuntimeManifest(manifest,mediaCatalog){
 assert.ok(Array.isArray(mediaCatalog),'Verified media catalogue required');
 assert.equal(new Set(mediaCatalog.map(a=>a.sha256)).size,mediaCatalog.length,'Duplicate private media digest');
 const byExam={};
 const records=manifest.records.map(record=>{
  const runtime=runtimeQuestion(record.payload,{rule:RULES_2027[record.exam],mediaCatalog});
  const summary=byExam[record.exam]??={ready:0,objective:0,drawing:0,unavailable:0,withImages:0};
  if(runtime){summary.ready++;summary[runtime.kind==='drawing'?'drawing':'objective']++;if(runtime.media.length)summary.withImages++;}else summary.unavailable++;
  return{externalKey:record.externalKey,contentSha256:record.contentSha256,exam:record.exam,runtime};
 });
 return{sourceCommit:manifest.sourceCommit,sourceSha256:manifest.sourceSha256,version:'verified-2027-v2',byExam,total:records.length,ready:records.filter(r=>r.runtime).length,planSha256:sha256(stableJson(records)),records};
}
export async function runtimeOperator(config){
 const {rpc}=await openPrivateBankProvider(config);
 return{media:()=>rpc('canonical_bank_media_manifest'),apply:async plan=>{
  let recorded=0;
  for(const [exam,records]of Object.entries(Object.groupBy(plan.records,record=>record.exam==='nift'?'nift':'other'))){for(let offset=0;offset<records.length;offset+=100){const batch=records.slice(offset,offset+100);const count=await rpc(exam==='nift'?'upsert_nift_question_bank_runtime_batch':'upsert_question_bank_runtime_batch',{p_records:batch});assert.equal(count,batch.length,'Runtime registration count mismatch');recorded+=count;}}
  return recorded;
 }};
}
async function main(){
 const index=process.argv.indexOf('--ref');const manifest=loadFromGit(index>=0?process.argv[index+1]:'origin/main');
 const operator=await runtimeOperator(bankProviderConfiguration(process.env));
 const plan=compileRuntimeManifest(manifest,await operator.media());const {records,...summary}=plan;
 if(process.argv.includes('--apply'))summary.recorded=await operator.apply(plan);
 console.log(JSON.stringify({mode:process.argv.includes('--apply')?'private-runtime-materialization':'dry-run',...summary},null,2));
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)main().catch(error=>{
 console.error(JSON.stringify({code:error.code==='PRIVATE_BANK_PROVIDER_FAILED'?error.code:'RUNTIME_MATERIALIZATION_FAILED',...(error.code==='PRIVATE_BANK_PROVIDER_FAILED'?{operation:error.operation,httpStatus:error.httpStatus}:{})}));process.exitCode=1;
});
