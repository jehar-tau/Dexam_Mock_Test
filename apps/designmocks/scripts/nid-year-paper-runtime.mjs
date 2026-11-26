// Operator-only compiler. The private release plan, not the current NID mock
// blueprint, supplies each historic paper's clock and per-question marks.
import {validateFreeYearPaperPlan} from './prepare-free-year-paper.mjs';
import {createNidYearRule,inspectRuntimeQuestion} from './question-runtime.mjs';

export function compileNidYearPaperRuntime(plan,canonical,mediaCatalog){
 const summary=validateFreeYearPaperPlan(plan,canonical);
 if(summary.exam!=='nid'||!Array.isArray(mediaCatalog))
  throw new Error('NID year plan and verified media catalogue required');
 const rule=createNidYearRule(plan);
 const source=new Map(canonical.records.map(record=>[record.externalKey,record]));
 const records=[];
 for(const item of plan.questions){
  const record=source.get(item.externalKey);
  if(record?.type!=='MCQ')throw new Error(`NID year objective runtime does not support ${record?.type??'missing'}: ${item.externalKey}`);
  const inspected=inspectRuntimeQuestion(record.payload,{rule,mediaCatalog});
  if(inspected.issues.length||!inspected.runtime)
   throw new Error(`NID year runtime blocked for ${item.externalKey}: ${inspected.issues.map(issue=>issue.code).join(',')}`);
  const runtime={...inspected.runtime,explanation:item.explanation};
  records.push({externalKey:item.externalKey,contentSha256:item.contentSha256,exam:'nid',runtime});
 }
 return {...summary,records};
}
