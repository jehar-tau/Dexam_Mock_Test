import test from'node:test';
import assert from'node:assert/strict';
import{launchReadinessState,mvpLaunchGates}from'../src/launch-readiness.mjs';
const ready=()=>({scope:'paid-mvp-v1',environmentMode:'live',testCheckoutEnabled:false,apiProfileReady:true,offeringReady:true,policyPublished:true,allAttestationsApproved:true,readyForSales:true,gates:mvpLaunchGates.map(gate=>({gate,approved:true,evidence:'Original fictional reviewed evidence'}))});
test('historical green blueprint status cannot stand in for the frozen MVP release',()=>{
 assert.equal(launchReadinessState({readyForSales:true,paperBlueprintReady:true,gates:[]}).ready,false);
 assert.equal(launchReadinessState({readyForSales:true,paperBlueprintReady:true,gates:[]}).offeringReady,false);
});
test('MVP readiness requires explicit matching API, policy, offering and evidence receipts',()=>{
 assert.equal(launchReadinessState(ready()).ready,true);
 for(const key of['scope','apiProfileReady','offeringReady','policyPublished','allAttestationsApproved','readyForSales']){const value=ready();delete value[key];assert.equal(launchReadinessState(value).ready,false,key);}
 const value=ready();value.apiProfileReady='true';assert.equal(launchReadinessState(value).ready,false);
});
test('missing, duplicate, unknown or unapproved gates cannot produce a green operator view',()=>{
 for(const mutate of[v=>v.gates.pop(),v=>v.gates[0]=v.gates[1],v=>v.gates[0].gate='future_unreviewed',v=>v.gates[0].approved=false,v=>v.gates[0].evidence='',v=>v.gates.push({gate:'drawing_operations',approved:true,evidence:'Deferred operation'})]){const value=ready();mutate(value);assert.equal(launchReadinessState(value).ready,false);}
});
test('merchant Test acceptance never makes the operator view ready for Live sale',()=>{
 const value=ready();value.environmentMode='test';assert.equal(launchReadinessState(value).ready,false);value.environmentMode='live';value.testCheckoutEnabled=true;assert.equal(launchReadinessState(value).ready,false);
});
test('a known MVP profile keeps strict release requirements in expanded regression previews',()=>{
 const value=ready();value.apiProfileReady=false;assert.equal(launchReadinessState(value,{expandedPreview:true}).ready,false);
});
test('malformed gate data stays closed without crashing the operator view',()=>{
 for(const value of[null,{}, {scope:'paid-mvp-v1',readyForSales:true,gates:null},{scope:'paid-mvp-v1',readyForSales:true,gates:[null,'bad',{}]}])assert.equal(launchReadinessState(value).ready,false);
});
test('deferred drawing operations are excluded from the MVP decision and retained in legacy previews',()=>{
 const value={readyForSales:true,gates:[{gate:'drawing_operations',approved:false}]};assert.equal(launchReadinessState(value).gates.length,0);assert.equal(launchReadinessState(value,{expandedPreview:true}).gates.length,1);
});
