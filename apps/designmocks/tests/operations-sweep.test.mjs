import test from 'node:test';
import assert from 'node:assert/strict';
import {runOperationsSweep,validateOperationsConfiguration}from '../scripts/operations-sweep.mjs';
const serviceJwt=`x.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.x`;
const base={url:'https://fixture.supabase.co',key:serviceJwt,allowOrigin:'https://fixture.supabase.co',environment:'staging'};
const health=(patch={})=>({scope:'paid-mvp-v1',checkedAt:'2026-11-08T10:00:00Z',status:'attention',staleAttempts:0,expiredAttempts:0,stalePendingOrders:0,paymentReviews:0,openBugs:2,pendingQuestionReports:1,...patch});
function fixture(responses){const calls=[];return{calls,fetchImpl:async(url,options)=>{calls.push({name:url.split('/').at(-1),body:JSON.parse(options.body),authorization:options.headers.authorization});assert.ok(options.signal instanceof AbortSignal);return Response.json(responses.shift());}};}
test('operations configuration rejects browser keys, origin drift and unacknowledged production',()=>{
 assert.throws(()=>validateOperationsConfiguration({...base,key:'sb_publishable_fixture'}),/service-role/);
 assert.throws(()=>validateOperationsConfiguration({...base,allowOrigin:'https://other.supabase.co'}),/exactly match/);
 assert.throws(()=>validateOperationsConfiguration({...base,url:'https://dmocks.com',allowOrigin:'https://dmocks.com',environment:'production'}),/acknowledgement/);
});
test('MVP operations verifies service health first, drains bounded batches and never invokes deferred jobs',async()=>{
 const f=fixture([health(),500,12,7,health()]);const result=await runOperationsSweep(base,{...f,now:new Date('2026-11-08T10:00:00Z')});
 assert.deepEqual(result,{environment:'staging',scope:'paid-mvp-v1',checkedAt:'2026-11-08T10:00:00Z',status:'attention',queues:{staleAttempts:0,expiredAttempts:0,stalePendingOrders:0,paymentReviews:0,openBugs:2,pendingQuestionReports:1},finalizedAttempts:512,finalizationBatches:2,finalizationLimitReached:false,prunedRateBuckets:7});
 assert.deepEqual(f.calls.map(c=>c.name),['admin_operational_health','finalize_expired_attempts','finalize_expired_attempts','prune_attempt_rate_buckets','admin_operational_health']);assert.equal(f.calls[1].body.p_limit,500);assert.equal(f.calls[3].body.p_before,'2026-11-06T10:00:00.000Z');assert.ok(f.calls.every(c=>c.authorization===`Bearer ${serviceJwt}`));
});
test('unrecognized or malformed initial health refuses every mutation',async()=>{
 for(const bad of[null,{},health({scope:undefined}),health({paymentReviews:null}),health({pendingQuestionReports:'1'}),health({openBugs:-1}),health({checkedAt:'unknown'}),health({status:'unknown'})]){
  const f=fixture([bad]);await assert.rejects(runOperationsSweep(base,f),/not verified/);assert.deepEqual(f.calls.map(c=>c.name),['admin_operational_health']);
 }
});
test('impossible or coerced finalization and prune acknowledgements cannot continue',async()=>{
 for(const value of[null,'0',-1,501,0.5]){const f=fixture([health(),value]);await assert.rejects(runOperationsSweep(base,f),/Invalid finalization count/);assert.equal(f.calls.length,2);}
 for(const value of[null,'0',-1,0.5]){const f=fixture([health(),0,value]);await assert.rejects(runOperationsSweep(base,f),/Invalid prune count/);assert.equal(f.calls.length,3);}
});
test('only the allowlisted aggregate counters leave the runner',async()=>{
 const f=fixture([health(),0,0,health({privateActorId:'must-stay-private',privateNumericField:123456,failedAiDrafts:99})]);const result=await runOperationsSweep(base,f);assert.equal(result.queues.privateNumericField,undefined);assert.equal(result.queues.failedAiDrafts,undefined);assert.doesNotMatch(JSON.stringify(result),/privateActor|privateNumeric|123456|failedAi/);
});
test('the finalization budget remains bounded and preserves degraded final health',async()=>{
 const f=fixture([health(),500,500,0,health({status:'degraded',expiredAttempts:2})]);const result=await runOperationsSweep(base,{...f,maxBatches:2});assert.equal(result.finalizationLimitReached,true);assert.equal(result.finalizationBatches,2);assert.equal(result.finalizedAttempts,1000);assert.equal(result.status,'degraded');assert.equal(result.queues.expiredAttempts,2);
});
test('unavailable profile, invalid limits or invalid clock cannot dispatch a recovery write',async()=>{
 let calls=0;await assert.rejects(runOperationsSweep(base,{fetchImpl:async()=>{calls++;return Response.json({error:'Private provider detail'},{status:403});}}),/admin_operational_health failed \(403\)/);assert.equal(calls,1);
 for(const patch of[{maxBatches:0},{batchSize:501},{now:new Date(NaN)}]){const f=fixture([]);await assert.rejects(runOperationsSweep(base,{...f,...patch}));assert.equal(f.calls.length,0);}
});
