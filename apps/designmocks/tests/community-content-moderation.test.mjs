import test from "node:test";
import assert from "node:assert/strict";
import { communityModerationActions, communityModerationFailure, communityModerationFilters, communityModerationGroups,
 communityModerationMedia, communityModerationPageInput, createCommunityModerationJob, readCommunityModerationPage,
 readCommunityModerationReceipt, readCommunityModerationView } from "../src/community-content-moderation.js";

const actor="00000000-0000-4000-8000-000000000951",other="00000000-0000-4000-8000-000000000952";
const postId="10000000-0000-4000-8000-000000000951",replyId="20000000-0000-4000-8000-000000000951",parentId="20000000-0000-4000-8000-000000000950";
const assetId="40000000-0000-4000-8000-000000000951",requestId="50000000-0000-4000-8000-000000000951";
const filters=communityModerationFilters();
const makeItem=(n,createdAt=`2026-01-01T12:00:00.${String(123480-n).padStart(6,"0")}+00:00`)=>({id:`10000000-0000-4000-8000-${String(n+1).padStart(12,"0")}`,kind:"post",postId:`10000000-0000-4000-8000-${String(n+1).padStart(12,"0")}`,parentId:null,
 title:`Original fictional discussion ${n}`,body:"Original fictional discussion body.",exam:"uceed",topic:"Observation",status:"visible",createdAt,assetCount:0,comments:0});
function page(items=Array.from({length:25},(_,n)=>makeItem(n)),more=true){
 const snapshotAt="2026-01-02T00:00:00.123456+00:00",version=7,last=items.at(-1);
 return {items,snapshotAt,version,filters:{...filters},nextCursor:more?{...filters,createdAt:last.createdAt,id:last.id,snapshotAt,version}:null};
}
function view(kind="comment"){
 const post={id:postId,kind:"post",title:"Original fictional discussion",body:"Original fictional discussion body.",status:"visible",exam:"uceed",topic:"Observation",assets:[]};
 const target=kind==="post"?post:{...post,id:replyId,kind:"comment",title:null,status:"hidden",assets:[{id:assetId,ordinal:3,mimeType:"image/webp",width:12,height:10,orientation:6,available:true}]};
 return {targetType:kind,targetId:target.id,reviewVersion:"a".repeat(64),canRestore:kind==="comment",target,post,
  parent:kind==="post"?null:{...post,id:parentId,kind:"comment",title:null,status:"hidden"},history:[{id:"moderation:1",action:"hide",note:"Earlier fictional reason.",createdAt:"2026-01-01T00:00:00Z"}]};
}
const read=(value= view())=>readCommunityModerationView(value,value.targetType,value.targetId);
function receipt(job,extra={}){return {requestId:job.input.p_request_id,targetType:job.input.p_target_type,targetId:job.input.p_target_id,action:job.input.p_action,
 previousStatus:job.previousStatus,status:job.input.p_action==="hide"?"hidden":job.input.p_action==="lock"?"locked":"visible",createdAt:"2026-01-03T12:00:00.123456+00:00",replayed:false,...extra};}

test("moderation filters bind exact topic/status and one discussion for replies",()=>{
 assert.deepEqual(communityModerationFilters({exam:" UCEED ",topic:" Observation ",status:" hidden "}),{targetType:"post",postId:null,exam:"uceed",topic:"Observation",status:"hidden"});
 assert.equal(communityModerationPageInput(filters).p_limit,25);
 assert.equal(communityModerationFilters({targetType:"comment",postId}).postId,postId);
 for(const input of [{targetType:"all"},{exam:"unknown"},{topic:1},{topic:"x".repeat(101)},{postId},{status:"all"},
  {targetType:"comment"},{targetType:"comment",postId,status:"locked"},{targetType:"comment",postId,exam:"uceed"}])assert.throws(()=>communityModerationFilters(input),/filters/);
});

test("bounded pages retain raw microsecond ordering and exact continuation rather than millisecond truncation",()=>{
 const first=readCommunityModerationPage(page(),filters);
 assert.equal(first.items.length,25);assert.equal(first.nextCursor.createdAt,"2026-01-01T12:00:00.123456+00:00");
 assert.deepEqual(communityModerationPageInput(filters,first.nextCursor).p_cursor,first.nextCursor);
 const second=page([makeItem(25)],false),combined=readCommunityModerationPage(second,filters,first);
 assert.equal(combined.items.length,26);assert.equal(combined.items.at(-1).createdAt,"2026-01-01T12:00:00.123455+00:00");
 assert.equal(combined.nextCursor,null);
 const original=page();original.items[0].privateAuthor=actor;
 assert.equal("privateAuthor" in readCommunityModerationPage(original,filters).items[0],false);
});

test("mixed scopes, repeated or reordered rows and malformed continuations cannot populate a moderation browser",()=>{
 for(const change of [
  value=>{value.items.push(makeItem(26));},value=>{value.items[1]=value.items[0];},value=>{value.items.reverse();},
  value=>{value.items[0].createdAt="2026-02-30T00:00:00Z";},value=>{value.items[0].kind="comment";},
  value=>{value.items[0].postId=postId;},value=>{value.items[0].status="removed";},value=>{value.items[0].assetCount=4;},
  value=>{value.filters.topic="different";},value=>{value.items[0].body="x".repeat(5001);},value=>{value.version=1.5;},value=>{value.nextCursor.extra=true;},
  value=>{value.nextCursor.id=postId;},value=>{value.nextCursor.createdAt="2026-01-01T12:00:00.123455+00:00";},
  value=>{value.nextCursor.snapshotAt="2026-01-02T00:00:00.123456Z";},value=>{value.nextCursor.version=8;},
 ]){const value=page();change(value);assert.throws(()=>readCommunityModerationPage(value,filters),/could not be verified/);}
 const prior=readCommunityModerationPage(page(),filters);
 for(const change of [value=>{value.version=8;},value=>{value.snapshotAt="2026-01-03T00:00:00Z";},value=>{value.items=[makeItem(1)];}]){
  const value=page([makeItem(25)],false);change(value);assert.throws(()=>readCommunityModerationPage(value,filters,prior),/could not be verified/);
 }
});

test("reply pages include hidden content only within the selected post and explicit reply filters",()=>{
 const replyFilters=communityModerationFilters({targetType:"comment",postId,status:"hidden"});
 const value=page([{...makeItem(0),id:replyId,kind:"comment",postId,parentId,title:null,status:"hidden",comments:null}],false);value.filters=replyFilters;
 const result=readCommunityModerationPage(value,replyFilters);assert.equal(result.items[0].parentId,parentId);
 value.items[0].postId=parentId;assert.throws(()=>readCommunityModerationPage(value,replyFilters),/could not be verified/);
});

test("moderation review preserves exact hidden context and strips private fields from new and legacy images",()=>{
 const raw=view();raw._groups={private:"paths"};raw.target.assets[0].path="private/object";raw.target.authorId=actor;
 const value=read(raw);assert.deepEqual(communityModerationGroups(value).map(group=>group.context),["target","parent","post"]);
 assert.equal("_groups"in value,false);assert.equal("authorId"in value.target,false);assert.equal("path"in value.target.assets[0],false);
 assert.deepEqual(communityModerationGroups(read(view("post"))).map(group=>group.context),["target"]);
 Object.assign(raw.target.assets[0],{width:null,height:null,orientation:null,available:false});
 assert.equal(read(raw).canRestore,false);assert.equal(read(raw).target.assets[0].orientation,null);
 for(const change of [value=>{value.targetId=postId;},value=>{value.reviewVersion="invalid";},value=>{value.parent.id=replyId;},
  value=>{value.target.exam="ceed";},value=>{value.target.assets[0].height=null;},value=>{value.post.kind="comment";},value=>{value.history.push(...Array(25).fill(value.history[0]));}]){
  const value=view();change(value);assert.throws(()=>readCommunityModerationView(value,"comment",replyId),/could not be verified/);
 }
});

test("a moderation job freezes account, target, exact review version and trimmed reason for identical retries",()=>{
 const original=read(),job=createCommunityModerationJob(original,"restore","  An original fictional restoration reason.  ",requestId,actor);
 assert.equal(Object.isFrozen(job),true);assert.equal(Object.isFrozen(job.input),true);
 assert.deepEqual(job.input,{p_target_type:"comment",p_target_id:replyId,p_action:"restore",p_note:"An original fictional restoration reason.",p_expected_version:"a".repeat(64),p_request_id:requestId});
 original.reviewVersion="b".repeat(64);assert.equal(job.input.p_expected_version,"a".repeat(64));
 assert.throws(()=>{job.input.p_note="changed";},TypeError);
 for(const note of [null,"short","        ","x".repeat(1001)])assert.throws(()=>createCommunityModerationJob(read(),"restore",note,requestId,actor),/8 to 1000/);
 for(const [id,user,action]of[["invalid",actor,"restore"],[requestId,"invalid","restore"],[requestId,actor,"lock"]])assert.throws(()=>createCommunityModerationJob(read(),action,"A complete fictional reason.",id,user));
 const incomplete=read();incomplete.canRestore=false;assert.throws(()=>createCommunityModerationJob(incomplete,"restore","A complete fictional reason.",requestId,actor),/unavailable/);
});

test("post state transitions are explicit while receipt replay never supplies a live content view",()=>{
 const original=read(view("post"));assert.deepEqual(communityModerationActions(original),["hide","lock"]);
 original.target.status="locked";assert.deepEqual(communityModerationActions(original),["hide","unlock"]);
 original.target.status="hidden";assert.deepEqual(communityModerationActions(original),["restore"]);
 const job=createCommunityModerationJob(read(),"restore","An original fictional reason.",requestId,actor),raw=receipt(job,{replayed:true,content:{private:"must not render"}});
 const result=readCommunityModerationReceipt(raw,job,actor);assert.equal(result.replayed,true);assert.equal("content"in result,false);
 for(const change of [value=>{value.requestId=postId;},value=>{value.targetType="post";},value=>{value.targetId=parentId;},value=>{value.action="hide";},
  value=>{value.previousStatus="visible";},value=>{value.status="hidden";},value=>{value.replayed="true";},value=>{value.createdAt="unknown";}]){
  const value=receipt(job);change(value);assert.throws(()=>readCommunityModerationReceipt(value,job,actor),error=>error.code==="community_moderation_receipt");
 }
 assert.throws(()=>readCommunityModerationReceipt(receipt(job),job,other),/saved action could not be verified/);
});

test("moderation images must match the exact inspected group and retain monotonic expiry bounds",()=>{
 const group=communityModerationGroups(read())[0],signed={media:group.content.assets.map(({available,...asset})=>({...asset,url:"https://images.example.invalid/fictional"})),serverNow:"2026-01-01T00:00:00Z",expiresAt:"2026-01-01T00:05:00Z"};
 assert.equal(communityModerationMedia(signed,group,42).lifetime,299958);
 signed.media[0].id=postId;assert.throws(()=>communityModerationMedia(signed,group,0),/could not be verified/);
});

test("moderation failures separate uncertain receipts from stale, denied and incomplete scopes without diagnostics",async()=>{
 for(const [error,kind]of[[{details:"community_moderation_changed"},"stale"],[{details:"community_moderation_conflict"},"stale"],
  [{details:"community_moderation_incomplete"},"incomplete"],[{code:"community_moderation_receipt"},"retry"],[{code:"42501"},"unavailable"],
  [{code:"40001"},"stale"],[{details:"constructor"},"retry"],[{details:"__proto__"},"retry"]]){
  const value=await communityModerationFailure({...error,message:"Private provider diagnostic"});assert.equal(value.kind,kind);assert.equal(value.message.includes("Private"),false);
 }
 for(const status of[401,403])assert.equal((await communityModerationFailure({context:new Response("Private provider HTML",{status})})).kind,"unavailable");
 assert.equal((await communityModerationFailure({context:new Response(JSON.stringify({code:"community_moderation_changed"}))})).kind,"stale");
});
