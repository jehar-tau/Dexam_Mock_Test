import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {loadFromGit} from './question-bank-import.mjs';
import {freeYearPaperProviderConfiguration,validateFreeYearPaperPlan} from './prepare-free-year-paper.mjs';
import {openFreeYearPaperProvider} from './private-bank-provider.mjs';

export function objectiveYearSources(plan,canonical,expectedDigest) {
  const summary=validateFreeYearPaperPlan(plan,canonical);
  if(summary.planSha256!==expectedDigest) throw new Error('The plan changed after its review SHA-256 was recorded');
  const byKey=new Map(canonical.records.map(record=>[record.externalKey,record]));
  return {summary,records:plan.questions.map(item=>byKey.get(item.externalKey))};
}

async function main() {
  const {values}=parseArgs({options:{plan:{type:'string'},expect:{type:'string'},apply:{type:'boolean'}}});
  if(!values.plan || !/^[a-f0-9]{64}$/.test(values.expect??'')) throw new Error('Private plan and expected SHA-256 required');
  const plan=JSON.parse(await readFile(values.plan,'utf8'));
  const canonical=loadFromGit('origin/main');
  const {summary,records}=objectiveYearSources(plan,canonical,values.expect);
  if(values.apply) {
    const provider=await openFreeYearPaperProvider(freeYearPaperProviderConfiguration(process.env),{
      acknowledgement:'PREPARE_FREE_YEAR_PAPER_ON',
    });
    const count=await provider.rpc('stage_objective_year_sources',{p_plan:plan,p_source_commit:canonical.sourceCommit,p_records:records});
    if(count!==records.length) throw new Error('Objective source registration count differs from the plan');
  }
  console.log(JSON.stringify({...summary,sourceCommit:canonical.sourceCommit,mode:values.apply?'staged-sources':'dry-run'}));
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
