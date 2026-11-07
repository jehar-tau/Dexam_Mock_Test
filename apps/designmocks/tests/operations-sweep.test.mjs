import test from "node:test";
import assert from "node:assert/strict";
import {runOperationsSweep,validateOperationsConfiguration}from "../scripts/operations-sweep.mjs";

const serviceJwt=`x.${Buffer.from(JSON.stringify({role:"service_role"})).toString("base64url")}.x`;
const base={url:"https://fixture.supabase.co",key:serviceJwt,allowOrigin:"https://fixture.supabase.co",environment:"staging"};

test("operations configuration rejects browser keys, origin drift and unacknowledged production",()=>{
  assert.throws(()=>validateOperationsConfiguration({...base,key:"sb_publishable_fixture"}),/service-role/);
  assert.throws(()=>validateOperationsConfiguration({...base,allowOrigin:"https://other.supabase.co"}),/exactly match/);
  assert.throws(()=>validateOperationsConfiguration({...base,url:"https://dmocks.com",allowOrigin:"https://dmocks.com",environment:"production"}),/acknowledgement/);
});

test("operations sweep drains bounded batches, prunes retention and returns privacy-safe health",async()=>{
  const calls=[],responses=[500,12,{intake:1,aiDrafts:2,privateNote:"must be omitted"},7,{checkedAt:"2026-11-06T10:00:00Z",status:"attention",expiredAttempts:0,openBugs:2}];
  const fetchImpl=async(url,options)=>{calls.push({url,body:JSON.parse(options.body),authorization:options.headers.authorization});return new Response(JSON.stringify(responses.shift()),{status:200,headers:{"content-type":"application/json"}})};
  const result=await runOperationsSweep(base,{fetchImpl,now:new Date("2026-11-06T10:00:00Z")});
  assert.deepEqual(result,{environment:"staging",checkedAt:"2026-11-06T10:00:00Z",status:"attention",finalizedAttempts:512,finalizationBatches:2,recoveredQuestionJobs:{intake:1,aiDrafts:2},prunedRateBuckets:7,queues:{expiredAttempts:0,openBugs:2}});
  assert.equal(calls[0].body.p_limit,500);
  assert.ok(calls[2].url.endsWith("/recover_expired_question_jobs"));
  assert.equal(calls[2].body.p_limit,500);
  assert.equal(calls[3].body.p_before,"2026-11-04T10:00:00.000Z");
  assert.ok(calls.every(call=>call.authorization===`Bearer ${serviceJwt}`));
});

test("operations sweep rejects impossible service responses",async()=>{
  const fetchImpl=async()=>new Response("501",{status:200});
  await assert.rejects(()=>runOperationsSweep(base,{fetchImpl}),/Invalid finalization count/);
});

test("operations refuses malformed recovery counts before continuing the sweep", async () => {
  for (const recovery of [{ intake: -1, aiDrafts: 0 }, { intake: 501, aiDrafts: 0 }, { intake: 0 }, { intake: 0, aiDrafts: "1" }]) {
    const responses = [0, recovery];
    await assert.rejects(() => runOperationsSweep(base, { fetchImpl: async () => Response.json(responses.shift()) }), /Invalid question recovery count/);
    assert.equal(responses.length, 0);
  }
});
