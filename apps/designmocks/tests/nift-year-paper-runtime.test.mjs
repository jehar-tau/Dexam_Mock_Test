import test from 'node:test';
import assert from 'node:assert/strict';
import {compileNiftYearPaperRuntime} from '../scripts/nift-year-paper-runtime.mjs';
function inputs(programme) {
  const slug='nift-2024-'+programme+'-gat',key=slug+'-q1',hash='d'.repeat(64);
  const payload={externalKey:key,type:'MCQ',prompt:'Select the original fixture answer.',topic:'Reasoning',
    provenance:{paperId:slug,year:2024,exam:'NIFT'},assets:[],holds:[],visualDependency:false,
    answer:{raw:'B',status:'official-key'},options:['A','B','C','D'].map(key=>({key,text:key}))};
  const record={exam:'nift',type:'MCQ',externalKey:key,contentSha256:hash,payload};
  const plan={format:'dmocks-free-year-paper-v1',exam:'nift',sourcePaperId:slug,year:2024,title:'Fixture GAT',partLabel:'GAT',
    markingReference:'Fictional historical GAT instructions',durationSeconds:5400,questions:[{externalKey:key,
      contentSha256:hash,marking:{correct:2,wrong:-0.5},explanation:'The fixture resolves to its stored second option.'}]};
  return {plan,canonical:{records:[record]}};
}
test('NIFT year papers retain programme, historical marks, clock, exact answer and solution',()=>{
  for(const programme of ['mdes','bdes']){
    const {plan,canonical}=inputs(programme);
    const {runtime}=compileNiftYearPaperRuntime(plan,canonical,[]).records[0];
    assert.equal(runtime.context.programme,programme);
    assert.equal(runtime.context.year,2024);
    assert.equal(runtime.context.durationSeconds,5400);
    assert.equal(runtime.context.sourcePaperId,plan.sourcePaperId);
    assert.deepEqual(runtime.marking,{correct:2,wrong:-0.5});
    assert.equal(runtime.points,2);assert.equal(runtime.negativePoints,0.5);
    assert.deepEqual(runtime.key.correct,['B']);
    assert.equal(runtime.explanation,plan.questions[0].explanation);
  }
});
test('an unknown NIFT programme and a missing stored key cannot be materialized',()=>{
  const {plan,canonical}=inputs('unknown');
  assert.throws(()=>compileNiftYearPaperRuntime(plan,canonical,[]),/historical plan/);
  const v=inputs('mdes');v.canonical.records[0].payload.answer.raw='';
  assert.throws(()=>compileNiftYearPaperRuntime(v.plan,v.canonical,[]),/Unsupported historical/);
});
