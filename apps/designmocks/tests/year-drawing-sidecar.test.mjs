import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDrawingSidecar } from '../scripts/year-drawing-sidecar.mjs';
import { drawingEstimateView } from '../src/drawing-estimate.mjs';
import { planDrawingPages } from '../src/drawing-upload.js';

const fixture=()=>{
  const key='fixture-2025-b1',digest='a'.repeat(64),bankSha='b'.repeat(64);
  const plan={format:'dmocks-year-paper-drawing-v1',sourcePaperId:'fixture-2025',objectivePlan:'fixture-2025-year-paper.plan.json',year:2025,exam:'ceed',
    timer:'shared',durationSeconds:10800,uploadGraceSeconds:600,drawingMarksTotal:20,sections:[{questionKeys:[key]}],tasks:[{externalKey:key,contentSha256:digest,kind:'drawing',
      marking:{max:20},drawing:{maxImages:3,criteriaSource:'printed',criteria:[{id:'form',label:'Form',max:20}],instructions:[]}}]};
  const src={sourceCommit:'c'.repeat(40),records:[{externalKey:key,exam:'ceed',type:'DESCRIPTIVE',topic:'form',contentSha256:bankSha,
    payload:{provenance:{paperId:'fixture-2025',year:2025},taskMarks:20,prompt:'Draw a shape',assets:[],explanation:'Look for clarity.'}}]};
  return {plan,src,hash:{[key]:digest}};
};
test('drawing and canonical digests both survive in their owning representations',()=>{
  const {plan,src,hash}=fixture(),doc=validateDrawingSidecar(plan,src,hash);
  assert.equal(doc.items[0].contentSha256,src.records[0].contentSha256);
  assert.equal(doc.items[0].drawingSourceSha256,plan.tasks[0].contentSha256);
  assert.equal(doc.durationSeconds,10800);
  assert.throws(()=>validateDrawingSidecar(plan,src,{}),/Drawing content changed/);
  plan.tasks[0].drawing.criteria[0].max=19;
  assert.throws(()=>validateDrawingSidecar(plan,src,hash),/Criterion marks differ/);
});
test('separate-session and choose-one plans stay ineligible for a shared-clock installation',()=>{
  const {plan,src,hash}=fixture();plan.timer='separate';assert.equal(validateDrawingSidecar(plan,src,hash).supported,false);
  plan.timer='shared';plan.sections[0].chooseOne=true;assert.equal(validateDrawingSidecar(plan,src,hash).supported,false);
});
test('no numeric estimate or unknown flags before calibration, and per-task page cap',()=>{
  const view=drawingEstimateView({status:'awaiting_teacher',flags:['illegible','invented'],score:100},[{id:'form',max:20}]);
  assert.equal(view.total,null);assert.deepEqual(view.flags,['illegible']);
  assert.ok(planDrawingPages(['a','b'],[{ordinal:1}],2).error);
});
