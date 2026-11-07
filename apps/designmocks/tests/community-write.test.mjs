import test from "node:test";
import assert from "node:assert/strict";
import {newCommunityWrite,submitCommunityWrite,communityWriteFailure,communityCommentOrder,mergeCommunityComments,communityPageCursor,validateCommunityThread} from "../src/community-write.js";
const post="10000000-0000-4000-8000-000000000601",reply="20000000-0000-4000-8000-000000000601",key="30000000-0000-4000-8000-000000000601";
const fields={p_exam:"uceed",p_topic:"fictional",p_title:"An original fictional discussion",p_body:"We compare original fictional approaches to this question."};
const receipt=(kind="post",extra={})=>({id:kind==="post"?post:reply,postId:post,parentId:null,status:"visible",postStatus:"visible",canUpload:true,replayed:false,...extra});
const comment=(extra={})=>({id:reply,parentId:null,body:"A fictional reply.",author:"Student",helpful:0,isMine:false,canReply:true,markedHelpful:false,parentAvailable:false,parentPreview:null,assetCount:0,...extra});
const page=(extra={})=>({id:post,title:fields.p_title,body:fields.p_body,exam:"uceed",topic:"fictional",status:"visible",version:1,assetCount:0,comments:[comment()],nextCursor:null,...extra});

test("one text request retains its identity and input after a lost committed acknowledgement",async()=>{
  const input={...fields},files=[new File(["fictional"],"one.png")],job=newCommunityWrite("post",input,files,()=>key);input.p_body="Changed after dispatch";files.length=0;
  let writes=0,first=true;const calls=[];
  const send=async(name,args)=>{calls.push([name,args]);if(!writes)writes++;if(first){first=false;throw new Error("private transport diagnostics");}return receipt("post",{replayed:true});};
  await assert.rejects(submitCommunityWrite(job,send),error=>!error.definitive&&!error.message.includes("private"));
  const saved=await submitCommunityWrite(job,send);assert.equal(saved.id,post);assert.equal(saved.replayed,true);assert.equal(writes,1);
  assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0][1].p_request_id,key);assert.equal(calls[0][1].p_body,fields.p_body);assert.equal(job.files.length,1);
});
test("reply request keys bind the exact post and parent, including top-level replies",async()=>{
  const input={p_post_id:post,p_parent_id:reply,p_body:"A nested fictional reply."},job=newCommunityWrite("comment",input,[],()=>key);
  const value=await submitCommunityWrite(job,async(name,args)=>{assert.equal(name,"add_community_comment");assert.equal(args.p_parent_id,reply);return receipt("comment",{parentId:reply});});assert.equal(value.parentId,reply);
  await assert.rejects(submitCommunityWrite(job,async()=>receipt("comment")),/did not confirm/);
  assert.throws(()=>newCommunityWrite("post",fields,[],()=>"bad-key"));
});
test("legacy, mis-scoped and contradictory text receipts cannot be accepted as a confirmation",async()=>{
  const job=newCommunityWrite("post",fields,[],()=>key);
  for(const value of[post,receipt("post",{postId:reply}),receipt("post",{parentId:reply}),receipt("post",{replayed:null}),receipt("post",{status:"hidden",canUpload:true}),null])
    await assert.rejects(submitCommunityWrite(job,async()=>value),error=>error.definitive===false);
});
test("replayed hidden or locked receipts confirm existing text without granting upload access",async()=>{
  const job=newCommunityWrite("post",fields,[],()=>key);
  for(const status of["hidden","locked"]){const saved=await submitCommunityWrite(job,async()=>receipt("post",{status,postStatus:status,canUpload:false,replayed:true}));assert.equal(saved.canUpload,false);}
});
test("only known server decisions release an unconfirmed write and no raw diagnostic is displayed",()=>{
  for(const details of["community_invalid_input","community_request_conflict","community_post_limit","community_reply_limit","community_target_unavailable"]){
    const error=communityWriteFailure({details,message:"private body or path"});assert.equal(error.definitive,true);assert.equal(error.message.includes("private"),false);
  }
  for(const error of[undefined,{details:"arbitrary",message:"private body"},{message:"private body"}])assert.equal(communityWriteFailure(error).definitive,false);
});
test("an aborted account or navigation cannot return a late text receipt",async()=>{
  const controller=new AbortController(),job=newCommunityWrite("post",fields,[],()=>key);
  await assert.rejects(submitCommunityWrite(job,async()=>{controller.abort();return receipt();},controller.signal),{name:"AbortError"});
});
test("thread order preserves parent/child relationships even when rows arrive out of order",()=>{
  const rows=[{id:"child",parentId:"parent"},{id:"other",parentId:null},{id:"parent",parentId:null},{id:"grandchild",parentId:"child"}];
  assert.deepEqual(communityCommentOrder(rows).map(item=>[item.id,item.depth]),[["other",0],["parent",0],["child",1],["grandchild",2]]);
});
test("removed parents, self references and cycles never hide visible replies",()=>{
  const rows=[{id:"missing",parentId:"not-loaded"},{id:"self",parentId:"self"},{id:"a",parentId:"b"},{id:"b",parentId:"a"}];
  const ordered=communityCommentOrder(rows);assert.deepEqual(new Set(ordered.map(item=>item.id)),new Set(rows.map(item=>item.id)));assert.equal(ordered.length,4);
});
test("long historical reply chains are traversed without recursive stack exhaustion",()=>{
  const rows=Array.from({length:6000},(_,index)=>({id:String(index),parentId:index?String(index-1):null}));
  const ordered=communityCommentOrder(rows);assert.equal(ordered.length,6000);assert.equal(ordered.at(-1).depth,5999);
});
test("loaded pages merge once per reply and retain the latest server fields",()=>{
  const merged=mergeCommunityComments([{id:"a",body:"old"},{id:"b",body:"unchanged"}],[{id:"a",body:"new"},{id:"c",body:"added"}]);
  assert.deepEqual(merged,[{id:"a",body:"new"},{id:"b",body:"unchanged"},{id:"c",body:"added"}]);
});
test("page cursors are server-clock independent, bounded and tied to their thread version",()=>{
  const cursor={id:reply,createdAt:"2026-01-01T00:00:00Z",snapshotAt:"2026-01-01T00:10:00Z",version:2};assert.deepEqual(communityPageCursor(cursor),cursor);
  for(const bad of[{...cursor,version:1.5},{...cursor,id:"bad"},{...cursor,createdAt:"invalid"},{...cursor,snapshotAt:"2025-01-01"},{...cursor,extra:true}])assert.throws(()=>communityPageCursor(bad));
  assert.equal(communityPageCursor(null),null);
});
test("thread pages reject unrelated IDs, duplicate/oversized sets and invalid role or parent context",()=>{
  assert.equal(validateCommunityThread(page(),post).comments.length,1);
  for(const bad of[page({id:reply}),page({version:null}),page({comments:[comment(),comment()]}),page({comments:[comment({isMine:"yes"})]}),page({comments:[comment({parentPreview:{body:null}})]}),page({comments:Array.from({length:51},()=>comment())})])assert.throws(()=>validateCommunityThread(bad,post));
});
