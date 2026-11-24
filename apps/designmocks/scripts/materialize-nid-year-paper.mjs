// Private operator command. Run after the reviewed NID year plan arrives.
import {readFile,stat} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {loadFromGit} from './question-bank-import.mjs';
import {compileNidYearPaperRuntime} from './nid-year-paper-runtime.mjs';
import {bankProviderConfiguration,openPrivateBankProvider} from './private-bank-provider.mjs';

export async function materializeNidYearPaper(plan,canonical,provider,{apply=false,expect}={}){
 const media=await provider.rpc('canonical_bank_media_manifest');
 const compiled=compileNidYearPaperRuntime(plan,canonical,media);
 if(compiled.planSha256!==expect)throw new Error('NID plan changed after its review SHA-256 was recorded');
 if(apply){
  let recorded=0;
  for(let offset=0;offset<compiled.records.length;offset+=100){
   const batch=compiled.records.slice(offset,offset+100);
   const count=await provider.rpc('upsert_nid_year_runtime_batch',{p_plan:plan,p_records:batch});
   if(count!==batch.length)throw new Error('NID historical runtime batch count mismatch');
   recorded+=count;
  }
  return{...compiled,recorded};
 }
 return compiled;
}

async function main(){
 const {values}=parseArgs({options:{plan:{type:'string'},expect:{type:'string'},apply:{type:'boolean'}}});
 if(!values.plan||!values.expect||!/^[a-f0-9]{64}$/.test(values.expect))
  throw new Error('Private plan and expected SHA-256 required');
 const info=await stat(values.plan);
 if(!info.isFile()||info.size>2*1024*1024)throw new Error('Private NID plan is unreadable or too large');
 const plan=JSON.parse(await readFile(values.plan,'utf8'));
 const canonical=loadFromGit('origin/main');
 const provider=await openPrivateBankProvider(bankProviderConfiguration(process.env));
 const {records,...summary}=await materializeNidYearPaper(plan,canonical,provider,{apply:values.apply,expect:values.expect});
 console.log(JSON.stringify({mode:values.apply?'materialized':'dry-run',...summary}));
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href)
 main().catch(error=>{console.error(error.code==='PRIVATE_BANK_PROVIDER_FAILED'
  ?`NID runtime provider failed (HTTP ${error.httpStatus??0})`:error.message);process.exitCode=1;});
