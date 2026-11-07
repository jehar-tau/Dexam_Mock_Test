import {expect,test} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {portalFixtureURL,seedPortalSession} from "./portal-fixture.js";
import {orientationPages} from "./drawing-orientation-fixture.js";
import {communityFeedFixture} from "./community-feed-fixture.js";
test.use({baseURL:portalFixtureURL});
const actor={id:"00000000-0000-4000-8000-000000000811",email:"followup-images@example.invalid"},other="00000000-0000-4000-8000-000000000812";
const postId="10000000-0000-4000-8000-000000000811",otherPost="10000000-0000-4000-8000-000000000812",replyId="20000000-0000-4000-8000-000000000811",foreignReply="20000000-0000-4000-8000-000000000812";
const api="https://dmocks-portal-fixture.supabase.co",headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
const files=async()=>Promise.all([["png","image/png"],["jpg","image/jpeg"]].map(async([ext,mimeType])=>({name:"fictional-followup."+ext,mimeType,buffer:await readFile(new URL(`../fixtures/drawing-images/fictional-drawing.${ext}`,import.meta.url))})));
async function fixture(page,{foreign=false,full=false,locked=false,otherThread=false}={}){
 const samples=await orientationPages(6),state={assets:new Map(),calls:[],uploads:[],writes:0,scopeReads:0,scopeError:false,signingStatus:null,failOrdinal:null,lostOrdinal:null,holdScope:null,holdUpload:null,scopeCompleted:0,uploadCompleted:0};
 const initial={...samples[0],id:"30000000-0000-4000-8000-000000000811",ordinal:1,hash:"original"};
 state.assets.set(postId,full?[initial,{...samples[1],ordinal:2,id:"full-2"},{...samples[2],ordinal:3,id:"full-3"}]:[initial]);
 state.assets.set(replyId,[{...samples[1],id:"30000000-0000-4000-8000-000000000812",ordinal:2,hash:"original-reply"}]);
 const owner=id=>id===otherPost||id===foreignReply||foreign?other:actor.id;
 const post=id=>({id,exam:"uceed",topic:id===postId?"observation":"Perspective",title:id===postId?"Original fictional saved discussion":"Another original fictional discussion",
  body:"An original fictional saved discussion whose text must not be posted again.",status:locked&&id===postId?"locked":"visible",author:"Fictional member",comments:1,assetCount:state.assets.get(id)?.length??0});
 const comments=id=>[{id:id===postId?foreignReply:replyId,parentId:null,body:"An original fictional saved solution whose text stays unchanged.",author:"Fictional solution author",helpful:0,isMine:owner(id===postId?foreignReply:replyId)===actor.id,markedHelpful:false,parentAvailable:false,parentPreview:null,canReply:true,assetCount:state.assets.get(id===postId?foreignReply:replyId)?.length??0}];
 await page.route(api+"/rest/v1/rpc/**",async route=>{
  const request=route.request();if(request.method()==="OPTIONS")return route.fulfill({headers,status:204});
  const name=new URL(request.url()).pathname.split("/").at(-1),input=request.postDataJSON();state.calls.push([name,input]);let value,status=200;
  const user=JSON.parse(Buffer.from(request.headers().authorization.split(" ")[1].split(".")[1],"base64url")).sub;
  if(name==="community_feed")value=communityFeedFixture([post(postId),post(otherPost)],input);
  else if(name==="community_thread"||name==="community_reply_context"){
   const current=post(input.p_post_id);value={...current,isMine:owner(current.id)===user,canAttach:owner(current.id)===user&&current.status==="visible"&&current.assetCount<3,version:1,nextCursor:null,
    comments:comments(current.id).map(row=>({...row,isMine:owner(row.id)===user,canAttach:owner(row.id)===user&&current.status==="visible"&&row.assetCount<3})),
    ...(input.p_anchor_id?{anchorId:input.p_anchor_id,hasEarlier:false}:{})};
  }else if(name==="community_attachment_slots"){
   state.scopeReads++;if(state.holdScope)await state.holdScope.promise;
   const parent=input.p_target_type==="post"?input.p_target_id:otherPost;
   if(state.scopeError||owner(input.p_target_id)!==user||post(parent).status!=="visible"){status=403;value={code:"42501",details:"community_attachments_unavailable",message:"private-followup-diagnostic"};}
   else value={targetType:input.p_target_type,targetId:input.p_target_id,postId:parent,occupiedOrdinals:(state.assets.get(input.p_target_id)??[]).map(image=>image.ordinal),maximum:3};
   state.scopeCompleted++;
  }else if(name==="create_community_post"||name==="add_community_comment"){state.writes++;throw new Error("Follow-up must never create Community text");}
  else if(name==="public_all_india_top_ten")value=[];
  else throw new Error("Unexpected fictional follow-up procedure: "+name);
  try{await route.fulfill({headers,status,json:value});}catch{}
 });
 await page.route(api+"/functions/v1/community-media",async route=>{
  const request=route.request();if(request.method()==="OPTIONS")return route.fulfill({headers,status:204});
  if(request.headers()["content-type"].startsWith("application/json")){
   if(state.signingStatus)return route.fulfill({headers,status:state.signingStatus,json:{error:"private-followup-diagnostic"}});
   const input=request.postDataJSON();return route.fulfill({headers,json:{media:(state.assets.get(input.targetId)??[]).slice().sort((a,b)=>a.ordinal-b.ordinal),serverNow:"2026-01-01T00:00:00Z",expiresAt:"2026-01-01T00:05:00Z"}});
  }
  const form=await new Request(request.url(),{method:"POST",headers:{"Content-Type":request.headers()["content-type"]},body:request.postDataBuffer()}).formData(),id=form.get("targetId"),ordinal=Number(form.get("ordinal")),file=form.get("file"),hash=createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");
  state.uploads.push({targetType:form.get("targetType"),id,ordinal,name:file.name,hash});
  if(state.failOrdinal===ordinal)return route.fulfill({headers,status:429,json:{code:"image_busy",error:"private-followup-diagnostic"}});
  const current=state.assets.get(id)??[],saved=current.find(image=>image.ordinal===ordinal);
  if(saved&&saved.hash!==hash)return route.fulfill({headers,status:409,json:{code:"slot_conflict",error:"private-followup-diagnostic"}});
  const image=saved??{...samples[ordinal-1],id:`${id}-additional-${ordinal}`,ordinal,hash};if(!saved)state.assets.set(id,[...current,image]);
  if(state.holdUpload)await state.holdUpload.promise;
  try{if(state.lostOrdinal===ordinal){state.lostOrdinal=null;return await route.abort();}await route.fulfill({headers,json:{id:image.id,ordinal,reused:Boolean(saved)}});}catch{}finally{state.uploadCompleted++;}
 });
 await page.goto("/account");await seedPortalSession(page,actor);await page.goto("/dashboard/community");
 const title=otherThread?"Another original fictional discussion":"Original fictional saved discussion";
 await page.locator(".community-feed article").filter({has:page.getByRole("heading",{name:title,exact:true})}).getByRole("button",{name:"Open discussion",exact:true}).click();await expect(page.getByRole("region",{name:"Discussion thread",exact:true})).toBeVisible();
 return state;
}
const picker=(page,reply=false)=>page.getByRole("region",{name:reply?"Add reply images":"Add discussion images",exact:true});
async function select(page,selected,reply=false){await page.getByRole("button",{name:reply?"Add reply images":"Add discussion images",exact:true}).click();await picker(page,reply).getByLabel("Additional images",{exact:true}).setInputFiles(selected);}
const send=(page,reply=false)=>picker(page,reply).getByRole("button",{name:"Add selected images",exact:true});

test("authors fill remaining discussion positions without recreating text or replacing the original image",async({page})=>{
 const state=await fixture(page),original=state.assets.get(postId)[0];await page.getByLabel("Add a reply",{exact:true}).fill("An unsent original fictional reply must survive adding images.");await select(page,await files());await send(page).click();
 await expect(page.getByText("Additional images confirmed.",{exact:true})).toBeVisible();await expect(page.getByRole("img",{name:"Question attachment 3",exact:true})).toBeVisible();
 expect(state.uploads.map(item=>[item.targetType,item.id,item.ordinal])).toEqual([["post",postId,2],["post",postId,3]]);expect(state.assets.get(postId)[0]).toEqual(original);expect(state.writes).toBe(0);expect(state.scopeReads).toBe(1);
 await expect(page.getByRole("button",{name:"Add discussion images",exact:true})).toHaveCount(0);await expect(picker(page)).toHaveCount(0);
 await expect(page.getByLabel("Add a reply",{exact:true})).toHaveValue("An unsent original fictional reply must survive adding images.");
});

test("an owned solution under another author uses its exact non-sequential free positions",async({page})=>{
 const state=await fixture(page,{otherThread:true}),original=state.assets.get(replyId)[0];await expect(page.getByRole("button",{name:"Add discussion images",exact:true})).toHaveCount(0);
 await page.getByLabel("Add a reply",{exact:true}).fill("An unsent original fictional reply draft stays here.");await select(page,await files(),true);await send(page,true).click();await expect(page.getByRole("img",{name:"Solution attachment 3",exact:true})).toBeVisible();
 expect(state.uploads.map(item=>[item.targetType,item.id,item.ordinal])).toEqual([["comment",replyId,1],["comment",replyId,3]]);expect(state.assets.get(replyId).find(image=>image.ordinal===2)).toEqual(original);expect(state.writes).toBe(0);
 await expect(page.getByLabel("Add a reply",{exact:true})).toHaveValue("An unsent original fictional reply draft stays here.");
});

test("a lost additional-image acknowledgement retries the same file and position once",async({page})=>{
 const state=await fixture(page);state.lostOrdinal=2;await select(page,(await files()).slice(0,1));await send(page).click();
 const recovery=page.getByRole("region",{name:"Saved post images",exact:true});await expect(recovery).toContainText("0 of 1 images confirmed");await expect(picker(page)).toHaveCount(0);
 await recovery.getByRole("button",{name:"Retry post images",exact:true}).click();await expect(page.getByText("Additional images confirmed.",{exact:true})).toBeVisible();
 expect(state.uploads.map(item=>item.ordinal)).toEqual([2,2]);expect(state.uploads[0].hash).toBe(state.uploads[1].hash);expect(state.assets.get(postId)).toHaveLength(2);expect(state.writes).toBe(0);expect(state.scopeReads).toBe(1);
});

test("partial follow-up failures resume only the remaining explicit image position",async({page})=>{
 const state=await fixture(page);state.failOrdinal=3;await select(page,await files());await send(page).click();
 const recovery=page.getByRole("region",{name:"Saved post images",exact:true});await expect(recovery).toContainText("1 of 2 images confirmed");state.failOrdinal=null;
 await recovery.getByRole("button",{name:"Retry post images",exact:true}).click();await expect(page.getByRole("img",{name:"Question attachment 3",exact:true})).toBeVisible();expect(state.uploads.map(item=>item.ordinal)).toEqual([2,3,3]);expect(state.writes).toBe(0);
});

test("fresh inventory detects another tab filling a target without uploading or overwriting it",async({page})=>{
 const state=await fixture(page);await select(page,(await files()).slice(0,1));const original=state.assets.get(postId)[0];
 state.assets.set(postId,[original,{...original,id:"concurrent-2",ordinal:2},{...original,id:"concurrent-3",ordinal:3}]);await send(page).click();
 await expect(page.getByText("This item already has three images. Refresh the discussion to view them.",{exact:true})).toBeVisible();expect(state.uploads).toEqual([]);expect(state.writes).toBe(0);expect(await picker(page).getByLabel("Additional images",{exact:true}).evaluate(input=>input.files.length)).toBe(1);
});

test("invalid selection never reads upload scope and cancellation restores its opener",async({page})=>{
 const state=await fixture(page),opener=page.getByRole("button",{name:"Add discussion images",exact:true});await opener.press("Enter");await expect(picker(page).getByLabel("Additional images",{exact:true})).toBeFocused();
 await picker(page).getByLabel("Additional images",{exact:true}).setInputFiles({name:"fictional.svg",mimeType:"image/svg+xml",buffer:Buffer.from("<svg/>")});await send(page).click();await expect(picker(page).getByRole("alert")).toContainText("fully read");expect(state.scopeReads).toBe(0);expect(state.uploads).toEqual([]);
 await picker(page).getByRole("button",{name:"Cancel image selection",exact:true}).press("Enter");await expect(picker(page)).toHaveCount(0);await expect(opener).toBeFocused();
});

test("a target becoming unavailable retains the selection without showing private diagnostics",async({page})=>{
 const state=await fixture(page);state.scopeError=true;await select(page,(await files()).slice(0,1));await send(page).click();await expect(page.getByText("This saved discussion or reply could not be checked for uploads. Refresh it and try again.",{exact:true})).toBeVisible();
 expect(state.uploads).toEqual([]);await expect(picker(page)).toBeVisible();await expect(page.getByText("private-followup-diagnostic",{exact:false})).toHaveCount(0);
});

test("a denied follow-up gallery refresh clears prior private images while retaining the saved upload",async({page})=>{
 const state=await fixture(page);await select(page,(await files()).slice(0,1));state.signingStatus=401;await send(page).click();
 await expect(page.getByText("This discussion or its images are unavailable. Refresh the feed or try again.",{exact:true})).toBeVisible();
 await expect(page.getByRole("region",{name:"Discussion thread",exact:true})).toHaveCount(0);await expect(page.getByRole("img",{name:/Question attachment/})).toHaveCount(0);
 expect(state.assets.get(postId)).toHaveLength(2);expect(state.writes).toBe(0);await expect(page.getByText("private-followup-diagnostic",{exact:false})).toHaveCount(0);
});

for(const options of [{foreign:true},{full:true},{locked:true}])test(`foreign, full or locked discussions do not offer follow-up uploads ${JSON.stringify(options)}`,async({page})=>{
 const state=await fixture(page,options);await expect(page.getByRole("button",{name:"Add discussion images",exact:true})).toHaveCount(0);expect(state.scopeReads).toBe(0);expect(state.uploads).toEqual([]);
});

test("a held inventory response cannot start uploads after an account change",async({page})=>{
 const state=await fixture(page),held=deferred();state.holdScope=held;await select(page,(await files()).slice(0,1));await send(page).click();await expect.poll(()=>state.scopeReads).toBe(1);
 await seedPortalSession(page,{id:other,email:"other-followup@example.invalid"});await page.evaluate(()=>{const key="sb-dmocks-portal-fixture-auth-token",channel=new BroadcastChannel(key);channel.postMessage({event:"SIGNED_IN",session:JSON.parse(localStorage.getItem(key))});channel.close();});
 await expect(page.getByRole("region",{name:"Discussion thread",exact:true})).toHaveCount(0);held.resolve();await expect.poll(()=>state.scopeCompleted).toBe(1);expect(state.uploads).toEqual([]);await expect(page.getByRole("region",{name:"Saved post images",exact:true})).toHaveCount(0);
});

test("late follow-up completion respects a newer discussion and feed filter",async({page})=>{
 const state=await fixture(page),held=deferred();state.holdUpload=held;await select(page,(await files()).slice(0,1));await send(page).click();await expect.poll(()=>state.uploads.length).toBe(1);
 await page.getByRole("button",{name:"Close discussion",exact:true}).click();await page.locator(".community-feed article").filter({has:page.getByRole("heading",{name:"Another original fictional discussion",exact:true})}).getByRole("button",{name:"Open discussion",exact:true}).click();
 const filter=page.getByRole("form",{name:"Discussion filters",exact:true});await filter.getByLabel("Topic filter",{exact:true}).fill("Perspective");await filter.getByRole("button",{name:"Apply filters",exact:true}).click();held.resolve();
 await expect(page.getByText("Additional images confirmed.",{exact:true})).toBeVisible();await expect(page.getByRole("region",{name:"Discussion thread",exact:true}).getByRole("heading",{name:"Another original fictional discussion",exact:true})).toBeVisible();await expect(filter.getByLabel("Topic filter",{exact:true})).toHaveValue("Perspective");expect(state.writes).toBe(0);
});

test("follow-up selection reflows at 320px and passes keyboard accessibility in both themes",async({page})=>{
 await fixture(page);await page.setViewportSize({width:320,height:900});await page.getByRole("button",{name:"Add discussion images",exact:true}).press("Enter");await page.addScriptTag({path:fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js",import.meta.url))});
 for(const dark of [false,true]){if(dark)await page.getByRole("switch",{name:"Dark mode",exact:true}).click();await expect(send(page)).toHaveCSS("background-color",dark?"rgb(220, 235, 161)":"rgb(36, 71, 53)");expect(await page.evaluate(async()=> (await window.axe.run(".community-page",{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}})).violations.map(item=>item.id))).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);}
});
