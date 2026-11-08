import test from "node:test";
import assert from "node:assert/strict";
import {adminRequestMessage,createAdminAccessScope,isAdminAccessFailure} from "../src/admin-access.js";

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
const ended=error=>error.name==="AbortError"&&error.code==="admin_access_ended";
const permission={code:"42501",message:"private provider diagnostic"};

test("administrator data never starts before an explicit true role response",async()=>{
 for(const value of[false,null,undefined,"true",1,{},[]]){
  let calls=0;const scope=createAdminAccessScope({check:async()=>value});
  await assert.rejects(scope.run(async()=>calls++),ended);
  assert.equal(await scope.verify(),false);assert.equal(scope.snapshot().status,value===false?"denied":"unavailable");
  await assert.rejects(scope.run(async()=>calls++),ended);assert.equal(calls,0);scope.dispose();
 }
});

test("a missing target rechecks the role without clearing other permitted work or retrying the action",async()=>{
 let checks=0,actions=0;const changes=[];
 const scope=createAdminAccessScope({check:async()=>{checks++;return true;},onChange:value=>changes.push(value)});
 assert.equal(await scope.verify(),true);
 await assert.rejects(scope.run(async()=>{actions++;throw permission;}),error=>error===permission);
 assert.equal(checks,2);assert.equal(actions,1);assert.equal(scope.isCurrent(),true);
 assert.deepEqual(changes.map(value=>value.status),["allowed","allowed"]);
 assert.equal(await scope.run(async()=>"another private panel"),"another private panel");scope.dispose();
});

test("confirmed revocation aborts every request and masks a previously authorized late result",async()=>{
 let allowed=true,checks=0;const held=deferred(),changes=[];let requestSignal;
 const scope=createAdminAccessScope({check:async()=>{checks++;return allowed;},onChange:value=>changes.push(value)});
 await scope.verify();
 const pending=scope.run(signal=>{requestSignal=signal;return held.promise;});
 allowed=false;
 await assert.rejects(scope.run(async()=>{throw permission;}),ended);
 assert.equal(requestSignal.aborted,true);assert.deepEqual(scope.snapshot(),{status:"denied",hadAccess:true});
 held.resolve({private:"older content"});await assert.rejects(pending,ended);
 allowed=true;assert.equal(await scope.verify(),false);await assert.rejects(scope.run(async()=>"must not start"),ended);
 assert.equal(checks,2);assert.deepEqual(changes.map(value=>value.status),["allowed","denied"]);scope.dispose();
});

test("concurrent denied operations share one role check and never resend either operation",async()=>{
 const held=deferred();let checks=0,actions=0,wait=false;
 const scope=createAdminAccessScope({check:()=>{checks++;return wait?held.promise:Promise.resolve(true);}});
 await scope.verify();wait=true;
 const first=scope.run(async()=>{actions++;throw permission;}),second=scope.run(async()=>{actions++;throw{context:{status:403}};});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(checks,2);assert.equal(actions,2);
 held.resolve(false);await Promise.all([assert.rejects(first,ended),assert.rejects(second,ended)]);
 assert.equal(checks,2);assert.equal(actions,2);scope.dispose();
});

test("legacy admin permission errors recheck access while other legacy validation errors do not",async()=>{
 let allowed=true,checks=0;const scope=createAdminAccessScope({check:async()=>{checks++;return allowed;}});
 await scope.verify();const validation={code:"P0001",message:"Pending draft not found"};
 await assert.rejects(scope.run(async()=>{throw validation;}),error=>error===validation);assert.equal(checks,1);assert.equal(scope.isCurrent(),true);
 allowed=false;await assert.rejects(scope.run(async()=>{throw{code:"P0001",message:"Admin access required"};}),ended);
 assert.equal(checks,2);assert.equal(scope.snapshot().status,"denied");scope.dispose();
});

test("a verification timeout closes cached access even when a provider ignores cancellation",async()=>{
 const held=deferred();let wait=false;const changes=[];
 const scope=createAdminAccessScope({verificationTimeoutMs:15,check:()=>wait?held.promise:Promise.resolve(true),onChange:value=>changes.push(value)});
 await scope.verify();wait=true;assert.equal(await scope.verify(),false);
 assert.deepEqual(scope.snapshot(),{status:"unavailable",hadAccess:true});assert.equal(scope.signal.aborted,true);
 held.resolve(true);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(changes.map(value=>value.status),["allowed","unavailable"]);scope.dispose();
});

test("a failed verification cannot expose provider diagnostics or borrow an older allowed state",async()=>{
 let fail=false;const scope=createAdminAccessScope({check:async()=>{if(fail)throw new Error("private role-check diagnostic");return true;}});
 await scope.verify();fail=true;
 await assert.rejects(scope.run(async()=>{throw {context:{status:401}};}),ended);
 assert.deepEqual(scope.snapshot(),{status:"unavailable",hadAccess:true});scope.dispose();
});

test("account and same-route history changes invalidate results before React cleanup",async()=>{
 for(const changedScope of["account","history"]){
  const held=deferred(),changes=[];let current=true;
  const scope=createAdminAccessScope({check:()=>held.promise,isCurrent:()=>current,onChange:value=>changes.push(value)});
  const pending=scope.verify();current=false;held.resolve(true);
  assert.equal(await pending,false,changedScope);assert.deepEqual(changes,[]);
  await assert.rejects(scope.run(async()=>"old account content"),ended);scope.dispose();
 }
});

test("disposal rejects ignored late completions and suppresses old verification callbacks",async()=>{
 const held=deferred(),changes=[];const scope=createAdminAccessScope({check:()=>held.promise,onChange:value=>changes.push(value)});
 const pending=scope.verify();scope.dispose();held.resolve(true);
 assert.equal(await pending,false);assert.deepEqual(changes,[]);assert.equal(scope.signal.aborted,true);
});

test("an account invalidation aborts pending work synchronously and cannot reopen the old scope",async()=>{
 const held=deferred(),changes=[];const scope=createAdminAccessScope({check:async()=>true,onChange:value=>changes.push(value)});
 await scope.verify();let signal;const pending=scope.run(active=>{signal=active;return held.promise;});
 scope.invalidate();assert.equal(signal.aborted,true);assert.deepEqual(scope.snapshot(),{status:"unavailable",hadAccess:true});
 held.resolve("an old account download");await assert.rejects(pending,ended);assert.equal(await scope.verify(),false);
 assert.deepEqual(changes.map(value=>value.status),["allowed","unavailable"]);scope.dispose();
});

test("caller cancellation preserves administrator access and does not cause a role check",async()=>{
 let checks=0;const scope=createAdminAccessScope({check:async()=>{checks++;return true;}});
 await scope.verify();const controller=new AbortController(),held=deferred();
 const pending=scope.run(async signal=>{assert.equal(signal.aborted,false);return held.promise;},controller.signal);
 controller.abort();held.resolve("discarded cancelled content");await assert.rejects(pending,error=>error.name==="AbortError");
 assert.equal(checks,1);assert.equal(scope.isCurrent(),true);assert.equal(await scope.run(async()=>"fresh content"),"fresh content");scope.dispose();
});

test("ordinary service failures retain allowed access and safe operator messages exclude raw diagnostics",async()=>{
 let checks=0;const scope=createAdminAccessScope({check:async()=>{checks++;return true;}});
 await scope.verify();const diagnostic=new Error("private stack and database identifiers");
 await assert.rejects(scope.run(async()=>{throw diagnostic;}),error=>error===diagnostic);
 assert.equal(checks,1);assert.equal(scope.isCurrent(),true);
 for(const error of[diagnostic,permission,{status:403,message:diagnostic.message},{code:"22023",message:diagnostic.message},{code:"23505",message:diagnostic.message}]){
  assert.doesNotMatch(adminRequestMessage(error),/private|database|stack/);
 }
 assert.equal(isAdminAccessFailure({status:503}),false);assert.equal(isAdminAccessFailure({details:"missing_target"}),false);scope.dispose();
});
