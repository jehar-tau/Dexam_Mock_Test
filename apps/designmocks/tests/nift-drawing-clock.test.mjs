import assert from "node:assert/strict";
import test from "node:test";
import {niftDrawingDuration} from "../scripts/nift-drawing-clock.mjs";
const ids=["sample-b1","sample-b2","sample-b3"];
const plan={exam:"nift",timer:"separate",drawingMarksTotal:100,uploadGraceSeconds:600,tasks:ids.map(externalKey=>({externalKey})),
  sections:[{label:"GAT",plan:"objective",durationSeconds:7200,uploadGraceSeconds:0},
    {label:"CAT (drawing)",startsAfter:"GAT",durationSeconds:10800,questionKeys:ids}]};
test("NIFT uses 120 and 180 minutes with grace solely for CAT",()=>{
  assert.equal(niftDrawingDuration(plan),18000);
  assert.equal(niftDrawingDuration({...plan,exam:"ceed"}),null);
  assert.equal(niftDrawingDuration({...plan,timer:"shared"}),null);
  assert.throws(()=>niftDrawingDuration({...plan,sections:[{...plan.sections[0],uploadGraceSeconds:600},plan.sections[1]]}),/NIFT/);
  assert.throws(()=>niftDrawingDuration({...plan,sections:[plan.sections[0],{...plan.sections[1],questionKeys:ids.slice().reverse()}]}),/NIFT/);
  assert.throws(()=>niftDrawingDuration({...plan,sections:[...plan.sections,plan.sections[1]]}),/NIFT/);
});
