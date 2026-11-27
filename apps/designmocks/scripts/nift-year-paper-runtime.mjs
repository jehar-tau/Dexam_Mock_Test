// NIFT B.Des and M.Des GAT use the same four-option MCQ representation. A year
// paper's printed programme, duration and marking come from its own plan.
import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {loadFromGit} from './question-bank-import.mjs';
import {openFreeYearPaperProvider} from './private-bank-provider.mjs';
import {freeYearPaperProviderConfiguration,validateFreeYearPaperPlan} from './prepare-free-year-paper.mjs';
import {inspectRuntimeQuestion,RULES_2027} from './question-runtime.mjs';

export function compileNiftYearPaperRuntime(plan,canonical,mediaCatalog) {
  const summary=validateFreeYearPaperPlan(plan,canonical);
  const match=plan.sourcePaperId.match(/^nift-(\d{4})-(bdes|mdes)-gat$/);
  if(summary.exam!=='nift'||!match||Number(match[1])!==plan.year||!Array.isArray(mediaCatalog))
    throw new Error('NIFT GAT historical plan required');
  const source=new Map(canonical.records.map(record=>[record.externalKey,record]));
  const records=plan.questions.map(item=>{
    const record=source.get(item.externalKey);
    const inspected=inspectRuntimeQuestion(record.payload,{rule:RULES_2027.nift,mediaCatalog});
    if(record.type!=='MCQ'||!inspected.runtime||inspected.runtime.key.kind!=='mcq'||inspected.runtime.key.correct.length!==1)
      throw new Error('Unsupported historical NIFT MCQ: '+item.externalKey);
    const runtime={...inspected.runtime,marking:item.marking,points:item.marking.correct,
      negativePoints:Math.abs(item.marking.wrong),explanation:item.explanation,
      context:{version:'nift-historical-gat-v1',exam:'nift',programme:match[2],year:plan.year,
        scope:'historical-year-paper',sourcePaperId:plan.sourcePaperId,durationSeconds:plan.durationSeconds,
        markingReference:plan.markingReference}};
    return {externalKey:record.externalKey,contentSha256:record.contentSha256,exam:'nift',runtime};
  });
  return {...summary,records};
}


async function main() {
  const {values}=parseArgs({options:{plan:{type:'string'},expect:{type:'string'},apply:{type:'boolean'}}});
  if(!values.plan || !/^[a-f0-9]{64}$/.test(values.expect??'')) throw new Error('Private plan and expected SHA-256 required');
  const plan=JSON.parse(await readFile(values.plan,'utf8'));
  const canonical=loadFromGit('origin/main');
  if(validateFreeYearPaperPlan(plan,canonical).planSha256!==values.expect) throw new Error('Historical NIFT plan changed');
  const provider=await openFreeYearPaperProvider(freeYearPaperProviderConfiguration(process.env),{
    acknowledgement:'PREPARE_FREE_YEAR_PAPER_ON',
  });
  const {records,...summary}=compileNiftYearPaperRuntime(plan,canonical,await provider.rpc('canonical_bank_media_manifest'));
  if(values.apply) {
    for(let offset=0;offset<records.length;offset+=100) {
      const batch=records.slice(offset,offset+100);
      const n=await provider.rpc('upsert_nift_year_runtime_batch',{p_plan:plan,p_records:batch});
      if(n!==batch.length) throw new Error('Historical NIFT runtime count differs from the paper');
    }
  }
  console.log(JSON.stringify({...summary,mode:values.apply?'materialized':'dry-run'}));
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
