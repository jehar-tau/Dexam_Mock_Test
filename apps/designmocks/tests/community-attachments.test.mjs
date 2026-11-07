import test from "node:test";
import assert from "node:assert/strict";
import {communityAttachmentFiles,communityAttachmentPlan} from "../src/community-attachments.js";
import {resumeCommunityImages} from "../src/community-media.js";
const postId="10000000-0000-4000-8000-000000000811",commentId="20000000-0000-4000-8000-000000000811";
const target={targetType:"comment",targetId:commentId,postId};
const scope={...target,occupiedOrdinals:[1],maximum:3};
const file=name=>new File(["fictional bytes"],name,{type:"image/png"});
test("follow-up selection requires actual bounded raster files before any scope read",()=>{
 assert.match(communityAttachmentFiles([]),/at least one/);assert.match(communityAttachmentFiles(null),/at least one/);
 assert.equal(communityAttachmentFiles([file("fictional.png")]),null);
 assert.match(communityAttachmentFiles(Array.from({length:4},()=>file("fictional.png"))),/three/);
 assert.match(communityAttachmentFiles([new File(["fictional"],"fictional.svg",{type:"image/svg+xml"})]),/fully read/);
});
test("attachment plans bind the owned target and use only fresh free positions",()=>{
 const files=[file("first.png"),file("second.png")],plan=communityAttachmentPlan(scope,target,files);
 assert.deepEqual(plan.ordinals,[2,3]);assert.equal(plan.next,0);assert.equal(plan.followUp,true);assert.equal(plan.files[0],files[0]);assert.notEqual(plan.files,files);
 assert.throws(()=>{plan.ordinals[0]=1;},TypeError);files.reverse();assert.equal(plan.files[0].name,"first.png");
 assert.deepEqual(communityAttachmentPlan({...scope,occupiedOrdinals:[2]},target,files).ordinals,[1,3]);
});
test("mismatched account-target inventories and malformed positions create no upload plan",()=>{
 for(const changed of [null,{...scope,targetId:postId},{...scope,postId:commentId},{...scope,targetType:"post"},{...scope,maximum:4},
  {...scope,occupiedOrdinals:[1,1]},{...scope,occupiedOrdinals:[0]},{...scope,occupiedOrdinals:[1.5]},{...scope,occupiedOrdinals:[4]}])assert.throws(()=>communityAttachmentPlan(changed,target,[file("fictional.png")]),/Refresh/);
 assert.throws(()=>communityAttachmentPlan(scope,{...target,targetId:[commentId]},[file("fictional.png")]),/Refresh/);
});
test("a concurrently filled target asks for a fresh explicit selection without replacing an image",()=>{
 assert.throws(()=>communityAttachmentPlan({...scope,occupiedOrdinals:[1,2]},target,[file("one.png"),file("two.png")]),/Only 1 more image/);
 assert.throws(()=>communityAttachmentPlan({...scope,occupiedOrdinals:[1,2,3]},target,[file("one.png")]),/already has three/);
});
test("follow-up retry preserves file identity and the exact non-sequential ordinal plan",async()=>{
 const files=[file("one.png"),file("two.png")],job=communityAttachmentPlan({...scope,occupiedOrdinals:[2]},target,files),calls=[];
 let fail=true;
 const invoke=async body=>{const ordinal=Number(body.get("ordinal"));calls.push([ordinal,body.get("file")]);if(ordinal===3&&fail)return{error:new Error("private provider diagnostic")};return{data:{id:"fictional-image-"+ordinal,ordinal}};};
 await assert.rejects(resumeCommunityImages(job,invoke),/did not confirm/);assert.equal(job.next,1);
 fail=false;await resumeCommunityImages(job,invoke);assert.equal(job.next,2);assert.deepEqual(calls.map(call=>call[0]),[1,3,3]);assert.equal(calls[1][1],calls[2][1]);
});
test("an invalid ordinal plan, false receipt or cancellation cannot advance progress",async()=>{
 let calls=0;const job=communityAttachmentPlan(scope,target,[file("one.png")]);
 await assert.rejects(resumeCommunityImages({...job,ordinals:[4]},async()=>{calls++;}),/Refresh/);assert.equal(calls,0);
 await assert.rejects(resumeCommunityImages(job,async()=>({data:{id:"fictional-wrong-position",ordinal:1}})),/did not confirm/);assert.equal(job.next,0);
 const controller=new AbortController();controller.abort();await assert.rejects(resumeCommunityImages(job,async()=>{calls++;},controller.signal));assert.equal(calls,0);assert.equal(job.next,0);
});
