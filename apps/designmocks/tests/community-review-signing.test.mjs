import test from "node:test";
import assert from "node:assert/strict";
import { communityModerationMediaInput, communityReviewInput, signedCommunityModeration, signedCommunityReview } from "../supabase/functions/_shared/community-review.mjs";

const reportId="00000000-0000-4000-8000-000000000741",assetId="00000000-0000-4000-8000-000000000742";
const input={action:"review",reportId,reviewVersion:"a".repeat(64),context:"target"};
const page=(extra={})=>({id:assetId,ordinal:1,path:"community/original-fictional.png",mimeType:"image/png",width:120,height:90,orientation:1,...extra});
function fixture(first=[page()],second=first){
 const reads=[],signs=[];
 const bucket={createSignedUrls:async(paths,seconds)=>{signs.push({paths,seconds});return {data:paths.map(path=>({path,signedUrl:"https://example.invalid/fictional/"+path}))};}};
 const read=async args=>{reads.push(args);const value=reads.length===1?first:second;return value?.error?value:{data:value};};
 return{reads,signs,bucket,read};
}
test("report signing admits only the exact report/version/context request",()=>{
 assert.deepEqual(communityReviewInput(input),{p_report_id:reportId,p_expected_version:"a".repeat(64),p_context:"target"});
 for(const value of [null,{}, {...input,reportId:"invalid"},{...input,reviewVersion:null},{...input,reviewVersion:"A".repeat(64)},
  {...input,context:"all"},{...input,path:"another-private-object"},{...input,targetId:assetId},{...input,action:"upload"}]){
  assert.throws(()=>communityReviewInput(value),error=>error.code==="community_review_invalid"&&error.status===400);
 }
});
test("private report images are signed for five minutes and rechecked with the same report version",async()=>{
 const f=fixture([page(),page({id:reportId,ordinal:3,path:"community/fictional-legacy.jpg",mimeType:"image/jpeg",width:null,height:null,orientation:null})]);
 const result=await signedCommunityReview(input,f.read,f.bucket);
 assert.deepEqual(f.reads,[communityReviewInput(input),communityReviewInput(input)]);
 assert.deepEqual(f.signs,[{paths:["community/original-fictional.png","community/fictional-legacy.jpg"],seconds:300}]);
 assert.equal(result.media.length,2);assert.equal(result.media[1].width,null);
 assert.equal(Date.parse(result.expiresAt)-Date.parse(result.serverNow),300000);
 for(const image of result.media)for(const field of ["path","storagePath","sha256","byteSize","object"])assert.equal(Object.hasOwn(image,field),false);
});
test("an empty context still rechecks admission and does not call Storage",async()=>{
 const f=fixture([]);assert.deepEqual((await signedCommunityReview({...input,context:"parent"},f.read,f.bucket)).media,[]);assert.equal(f.reads.length,2);assert.equal(f.signs.length,0);
});
test("first-read denial or corrupt rows reveal no capabilities or private diagnostics",async()=>{
 for(const data of [{error:{code:"42501",message:"Private operator diagnostic"}},null,[null],[page(),page()],
  [page({orientation:null})],[page({width:24001})],[page({mimeType:"text/html"})],[page({path:""})]]){
  const f=fixture(data);await assert.rejects(signedCommunityReview(input,f.read,f.bucket),error=>!error.message.includes("Private")&&[403,502].includes(error.status));assert.equal(f.signs.length,0);
 }
});
test("revocation, report resolution or evidence change after signing discards all links",async()=>{
 for(const details of ["community_review_unavailable","community_review_changed","community_review_incomplete"]){
  const f=fixture([page()],{error:{details,message:"Private evidence diagnostic"}});
  await assert.rejects(signedCommunityReview(input,f.read,f.bucket),error=>error.code===details&&!error.message.includes("Private"));assert.equal(f.signs.length,1);assert.equal(f.reads.length,2);
 }
});
test("changed page identities or render metadata fail the final signing fence",async()=>{
 for(const second of [[],[page({path:"community/replaced.png"})],[page({id:reportId})],[page({width:121})],[page({orientation:2})]]){
  const f=fixture([page()],second);await assert.rejects(signedCommunityReview(input,f.read,f.bucket),error=>error.code==="community_review_changed"&&error.status===409);
 }
});
test("Storage failures and unknown RPC errors become safe retry messages",async()=>{
 const f=fixture();f.bucket.createSignedUrls=async()=>({error:new Error("Private signing key diagnostic")});
 await assert.rejects(signedCommunityReview(input,f.read,f.bucket),error=>error.code==="media_unavailable"&&!error.message.includes("Private"));
 for(const details of ["unrecognized","constructor","__proto__"]){
  const rejected=fixture({error:{details,message:"Private SQL diagnostic"}});await assert.rejects(signedCommunityReview(input,rejected.read,rejected.bucket),error=>error.code==="media_unavailable"&&error.status===502&&!error.message.includes("Private"));
 }
});

const moderationInput={action:"moderate",targetType:"comment",targetId:reportId,reviewVersion:"b".repeat(64),context:"parent"};
test("moderation signing binds exact target kind/id/version/context without accepting private paths",()=>{
 assert.deepEqual(communityModerationMediaInput(moderationInput),{p_target_type:"comment",p_target_id:reportId,p_expected_version:"b".repeat(64),p_context:"parent"});
 for(const value of [null,{}, {...moderationInput,action:"review"},{...moderationInput,targetType:"all"},{...moderationInput,targetId:"unknown"},
  {...moderationInput,reviewVersion:"B".repeat(64)},{...moderationInput,context:"all"},{...moderationInput,path:"private/operator-choice"},{...moderationInput,reportId}]){
  assert.throws(()=>communityModerationMediaInput(value),error=>error.code==="community_moderation_invalid"&&error.status===400);
 }
});
test("moderation signing uses current and legacy registered pages with a second exact-scope read",async()=>{
 const f=fixture([page({width:null,height:null,orientation:null})]);
 const result=await signedCommunityModeration(moderationInput,f.read,f.bucket);
 assert.deepEqual(f.reads,[communityModerationMediaInput(moderationInput),communityModerationMediaInput(moderationInput)]);
 assert.equal(f.signs.length,1);assert.equal(result.media[0].orientation,null);assert.equal(Object.hasOwn(result.media[0],"storagePath"),false);
 const empty=fixture([]);assert.deepEqual((await signedCommunityModeration(moderationInput,empty.read,empty.bucket)).media,[]);assert.equal(empty.signs.length,0);assert.equal(empty.reads.length,2);
});
test("moderation role, version and object failures before or after signing discard every link",async()=>{
 for(const details of ["community_moderation_unavailable","community_moderation_changed","community_moderation_incomplete"]){
  for(const after of [false,true]){
   const denied={error:{details,message:"Private operator diagnostic"}},f=after?fixture([page()],denied):fixture(denied);
   await assert.rejects(signedCommunityModeration(moderationInput,f.read,f.bucket),error=>error.code===details&&!error.message.includes("Private"));
   assert.equal(f.signs.length,after?1:0);
  }
 }
 for(const value of [null,[null],[page(),page()],[page({orientation:9})]]){
  const f=fixture(value);await assert.rejects(signedCommunityModeration(moderationInput,f.read,f.bucket),error=>error.code==="media_unavailable"&&error.status===502);assert.equal(f.signs.length,0);
 }
 const swapped=fixture([page()],[page({path:"community/changed-private-object.png"})]);
 await assert.rejects(signedCommunityModeration(moderationInput,swapped.read,swapped.bucket),error=>error.code==="community_moderation_changed"&&error.status===409);
});
