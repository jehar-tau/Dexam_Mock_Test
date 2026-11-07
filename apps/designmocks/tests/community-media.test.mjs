import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as codec from "@imagemagick/magick-wasm";
import { createDrawingValidator } from "../supabase/functions/_shared/drawing-validation.mjs";
import { COMMUNITY_MAX_BYTES, communityMediaFailure, communityTarget, validateCommunityImage } from "../supabase/functions/_shared/community-image.mjs";
import { checkCommunityFiles, communityLinkLifetime, communityUploadError, resumeCommunityImages } from "../src/community-media.js";
const fixture = name => readFile(new URL(`./fixtures/drawing-images/${name}`,import.meta.url));
const decode = createDrawingValidator(codec,()=>readFile(new URL(import.meta.resolve("@imagemagick/magick-wasm/magick.wasm"))));
const id="00000000-0000-4000-8000-000000000501";

test("Community validates full PNG/JPEG/WebP pixels and hashes sanitized evidence without personal metadata",async()=>{
  for(const [ext,mime]of[["png","image/png"],["jpg","image/jpeg"],["webp","image/webp"]]){
    const input=await fixture(`fictional-drawing.${ext}`),result=await validateCommunityImage(input,mime,decode);
    assert.equal(Buffer.from(result.bytes).includes("DMOCKS_FICTIONAL_PRIVATE_METADATA_2026"),false);
    assert.deepEqual([result.width,result.height,result.orientation],[6,4,6]);assert.match(result.sha256,/^[a-f0-9]{64}$/);
    const signature=bytes=>codec.ImageMagick.read(bytes,image=>{image.autoOrient();return image.signature;});
    assert.equal(signature(result.bytes),signature(input));
    assert.equal((await validateCommunityImage(result.bytes,mime,decode)).sha256,result.sha256);
  }
});
test("Community rejects truncated, animated and spoofed content through the actual raster decoder",async()=>{
  for(const [name,mime]of[["fictional-drawing.png","image/png"],["fictional-drawing.jpg","image/jpeg"],["fictional-drawing.webp","image/webp"]]){
    const input=await fixture(name);
    await assert.rejects(validateCommunityImage(input.subarray(0,12),mime,decode),error=>error.code==="invalid_image");
    await assert.rejects(validateCommunityImage(input,"image/svg+xml",decode),error=>error.code==="invalid_image");
  }
  await assert.rejects(validateCommunityImage(await fixture("animated.webp"),"image/webp",decode),error=>error.code==="invalid_image");
});
test("the Community byte policy admits its inclusive 5 MiB boundary and rejects excess before decoding",async()=>{
  let calls=0;const check=async bytes=>{calls++;return{bytes};};
  await assert.rejects(validateCommunityImage(new Uint8Array(COMMUNITY_MAX_BYTES+1),"image/png",check),error=>error.code==="image_size"&&error.status===413);
  await assert.rejects(validateCommunityImage(new Uint8Array(),"image/png",check));assert.equal(calls,0);
  await validateCommunityImage(new Uint8Array(COMMUNITY_MAX_BYTES),"image/png",check);assert.equal(calls,1);
  await assert.rejects(validateCommunityImage(new Uint8Array([1]),"image/png",async()=>({bytes:new Uint8Array(COMMUNITY_MAX_BYTES+1)})),error=>error.code==="image_size");
});
test("Community errors expose bounded actions instead of arbitrary Storage or decoder diagnostics",async()=>{
  assert.deepEqual(communityMediaFailure({code:"drawing_busy",message:"private raw path"}),{error:"Another image is being checked. Try the remaining images again.",code:"image_busy",status:429});
  assert.equal(communityMediaFailure(new Error("private raw path")).status,502);
  assert.equal(JSON.stringify(communityMediaFailure({code:"unknown",message:"private raw path"})).includes("private"),false);
  const error=await communityUploadError({context:new Response(JSON.stringify({code:"image_size",error:"private raw path"}))});assert.match(error.message,/5 MB/);
  assert.equal((await communityUploadError({message:"private raw path"})).message.includes("private"),false);
});
test("client checks reject unsupported counts, size and types before creating discussion text",()=>{
  const file={size:12,type:"image/png"};assert.equal(checkCommunityFiles([file,file,file]),null);
  assert.match(checkCommunityFiles([file,file,file,file]),/three/);
  assert.match(checkCommunityFiles([{...file,size:0}]),/5 MB/);
  assert.match(checkCommunityFiles([{...file,size:COMMUNITY_MAX_BYTES+1}]),/5 MB/);
  assert.match(checkCommunityFiles([{...file,type:"image/svg+xml"}]),/still PNG/);
});
test("partial Community uploads resume the same target at the first unconfirmed position",async()=>{
  const files=[1,2,3].map(n=>new File([`fictional-${n}`],`${n}.png`,{type:"image/png"})),job={targetType:"post",targetId:id,files,next:0};
  const calls=[],progress=[];let fail=true;
  const invoke=async form=>{const ordinal=Number(form.get("ordinal"));calls.push([form.get("targetId"),ordinal,form.get("file").name]);
    return fail&&ordinal===2?{error:new Error("unconfirmed")}: {data:{id:"receipt-"+ordinal,ordinal}};};
  await assert.rejects(resumeCommunityImages(job,invoke,new AbortController().signal,n=>progress.push(n)));assert.equal(job.next,1);
  fail=false;await resumeCommunityImages(job,invoke,new AbortController().signal,n=>progress.push(n));
  assert.deepEqual(calls,[[id,1,"1.png"],[id,2,"2.png"],[id,2,"2.png"],[id,3,"3.png"]]);assert.deepEqual(progress,[1,2,3]);
});
test("lost or inconsistent receipts never advance Community progress and retries retain the same image",async()=>{
  const file=new File(["fictional"],"one.png",{type:"image/png"}),job={targetType:"comment",targetId:id,files:[file],next:0};
  await assert.rejects(resumeCommunityImages(job,async()=>({data:{id:"wrong",ordinal:2}})));assert.equal(job.next,0);
  await resumeCommunityImages(job,async form=>{assert.equal(form.get("file").name,file.name);return{data:{id:"saved",ordinal:1,reused:true}};});assert.equal(job.next,1);
});
test("a cancelled account or navigation cannot advance an upload after its response arrives",async()=>{
  const controller=new AbortController(),job={targetType:"post",targetId:id,files:[new File(["x"],"one.png")],next:0};
  await assert.rejects(resumeCommunityImages(job,async()=>{controller.abort();return{data:{id:"late",ordinal:1}};},controller.signal),{name:"AbortError"});assert.equal(job.next,0);
});
test("Community link lifetimes use server time, cap capability duration and reject malformed sets",()=>{
  const media=[{id:"page",ordinal:1,url:"https://example.invalid/private"}],result={media,serverNow:"2026-01-01T00:00:00Z",expiresAt:"2026-01-01T00:05:00Z"};
  assert.equal(communityLinkLifetime(result,1500),298500);assert.equal(communityLinkLifetime({...result,expiresAt:"2026-01-01T01:00:00Z"}),300000);
  assert.equal(communityLinkLifetime({...result,expiresAt:"2025-01-01T00:00:00Z"}),0);assert.equal(communityLinkLifetime({media}),300000);
  for(const bad of[{media:[...media,...media]},{media:[{...media[0],ordinal:4}]},{media:[{...media[0],url:null}]},{}])assert.throws(()=>communityLinkLifetime(bad));
});
test("Community targets require a supported kind and a UUID before any privileged Storage operation",()=>{
  assert.equal(communityTarget("post",id),true);assert.equal(communityTarget("comment",id),true);
  for(const [kind,target]of[[null,id],["post",null],["post","../../other"],["drawing",id]])assert.equal(communityTarget(kind,target),false);
});
