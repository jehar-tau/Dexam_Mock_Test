import test from "node:test";
import assert from "node:assert/strict";
import {createDrawingReviewRequests,isDrawingReviewUnavailable} from "../src/drawing-review-lifecycle.js";

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
test("known assignment/version denials discard the target while ordinary mark validation remains correctable",()=>{
 for(const message of["Review unavailable","Review assignment changed. Refresh the queue.","Review changed. Refresh the queue.","Only an administrator can revise a released grade","Claim this review before grading","Claim the review before opening student work","Review is assigned to another teacher"]){
  assert.equal(isDrawingReviewUnavailable({code:"P0001",message}),true);
 }
 assert.equal(isDrawingReviewUnavailable({code:"42501"}),true);assert.equal(isDrawingReviewUnavailable({context:{status:403}}),true);
 assert.equal(isDrawingReviewUnavailable({code:"P0001",message:"Invalid criterion marks"}),false);assert.equal(isDrawingReviewUnavailable({status:503}),false);
});
test("a denied submission invalidates an older authorized queue response without ending other work",async()=>{
 const held=deferred(),scope=createDrawingReviewRequests(()=>true);let signal;
 const pending=scope.read(active=>{signal=active;return held.promise;});
 scope.invalidateReads();assert.equal(signal.aborted,true);assert.equal(scope.isCurrent(),true);
 held.resolve(["old private submission"]);const older=await pending;assert.equal(older.current(),false);
 const current=await scope.read(async()=>["another permitted submission"]);assert.equal(current.current(),true);assert.deepEqual(current.data,["another permitted submission"]);scope.dispose();
});
test("a newer refresh supersedes both successful and failed earlier responses",async()=>{
 for(const fail of[false,true]){
  const scope=createDrawingReviewRequests(()=>true),held=deferred();
  const pending=scope.read(()=>held.promise),latest=await scope.read(async()=>["latest private page"]);
  if(fail)held.reject(new Error("older private diagnostic"));else held.resolve(["older private page"]);
  const older=await pending;assert.equal(older.current(),false);assert.equal(latest.current(),true);assert.deepEqual(latest.data,["latest private page"]);scope.dispose();
 }
});
test("a completed outcome becomes obsolete if a newer permission decision wins before rendering",async()=>{
 const scope=createDrawingReviewRequests(()=>true),outcome=await scope.read(async()=>["already received private content"]);
 assert.equal(outcome.current(),true);scope.invalidateReads();assert.equal(outcome.current(),false);scope.dispose();
});
test("account or role invalidation masks pending data before component cleanup",async()=>{
 let allowed=true,calls=0;const scope=createDrawingReviewRequests(()=>allowed),held=deferred();
 const pending=scope.read(()=>{calls++;return held.promise;});allowed=false;held.resolve(["old account content"]);
 assert.equal((await pending).current(),false);assert.throws(scope.assertCurrent,{name:"AbortError"});
 await assert.rejects(scope.read(async()=>calls++),{name:"AbortError"});assert.equal(calls,1);scope.dispose();
});
test("page cleanup aborts in-flight work and an ignored late result cannot reopen it",async()=>{
 const scope=createDrawingReviewRequests(()=>true),held=deferred();let signal;
 const pending=scope.read(active=>{signal=active;return held.promise;});scope.dispose();assert.equal(signal.aborted,true);
 held.resolve(["detached page content"]);assert.equal((await pending).current(),false);assert.equal(scope.isCurrent(),false);
});
