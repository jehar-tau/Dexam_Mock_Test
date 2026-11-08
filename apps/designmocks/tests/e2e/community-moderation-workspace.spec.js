import {expect,test} from "@playwright/test";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {emptyAdminRead,portalFixtureURL,seedPortalSession,stubPortalProvider} from "./portal-fixture.js";
import {orientationPages} from "./drawing-orientation-fixture.js";

test.use({baseURL:portalFixtureURL});
const administrator={id:"00000000-0000-4000-8000-000000000981",email:"moderation-admin@example.invalid"};
const otherAdmin={id:"00000000-0000-4000-8000-000000000982",email:"other-moderation-admin@example.invalid"};
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const api="https://dmocks-portal-fixture.supabase.co",secretDiagnostic="private-moderation-diagnostic";
const browser=page=>page.getByRole("region",{name:"Community content browser",exact:true});
const review=page=>page.getByRole("region",{name:"Community content review",exact:true});
const cards=page=>browser(page).getByRole("region",{name:"Moderation content list",exact:true}).getByRole("article");
const row=(page,n=1)=>cards(page).nth(n-1);
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
const desc=(a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id);
let clockTick=0;
const stamp=()=>new Date(Math.max(Date.now(),++clockTick)).toISOString().replace("Z","000+00:00");

async function fixture(page,{long=false}={}){
 const samples=await orientationPages(6),source=new Map(),assets=new Map();
 const posts=Array.from({length:61},(_,n)=>({id:`11000000-0000-4000-8000-${String(980+n).padStart(12,"0")}`,kind:"post",postId:`11000000-0000-4000-8000-${String(980+n).padStart(12,"0")}`,parentId:null,
  title:`Original fictional moderation discussion ${n+1}`,body:`An original fictional discussion with a complete method for problem ${n+1}.`,exam:n===1?"ceed":"uceed",topic:n===1?"Exact case topic":"Observation",
  status:n===1?"hidden":n===2?"locked":"visible",createdAt:`2026-01-01T12:00:00.${String(123999-n).padStart(6,"0")}+00:00`,assetCount:0,comments:n===0?62:0}));
 const replies=Array.from({length:62},(_,n)=>({id:`22000000-0000-4000-8000-${String(980+n).padStart(12,"0")}`,kind:"comment",postId:posts[0].id,
  parentId:n===1?"22000000-0000-4000-8000-000000000980":null,title:null,body:`An original fictional reply with a distinct approach ${n+1}.`,exam:"uceed",topic:"Observation",status:n<2||n%5===0?"hidden":"visible",
  createdAt:`2026-01-01T12:00:00.${String(123900-n).padStart(6,"0")}+00:00`,assetCount:0,comments:null}));
 if(long){posts[0].title="Title".repeat(32);posts[0].body="OriginalFictionalBody".repeat(239).slice(0,5000);posts[0].topic="Topic".repeat(20);for(const item of replies)item.topic=posts[0].topic;}
 function attach(item,n,sample,legacy=false,ordinal=1){
  const id=`44000000-0000-4000-8000-${String(n).padStart(12,"0")}`;source.set(id,sample);
  const image={id,ordinal,mimeType:sample.mimeType,width:legacy?null:sample.width,height:legacy?null:sample.height,orientation:legacy?null:sample.orientation,available:true};
  assets.set(item.id,[...(assets.get(item.id)??[]),image]);item.assetCount=assets.get(item.id).length;
 }
 samples.forEach((sample,n)=>attach(posts[0],980+n,sample,false,n+1));attach(posts[1],983,samples[0],true);attach(replies[0],984,samples[1],true);attach(replies[1],985,samples[2],false,3);
 const state={posts,replies,assets,allowed:true,activeActor:administrator.id,admins:new Set([administrator.id,otherAdmin.id]),feedRevision:1,replyRevision:1,
  pageCalls:[],readCalls:[],mediaCalls:[],actionCalls:[],actions:[],receipts:new Map(),pageHolds:new Map(),readHolds:new Map(),holdMore:null,holdMedia:null,holdAction:null,
  failPageAfterHold:null,failRead:null,failMedia:null,failAction:null,bareMediaStatus:null,lostAcknowledgement:false,badAcknowledgement:false,brokenImage:false,ttl:300000,
  completedPages:0,completedReads:0,completedMedia:0,completedActions:0,reportQueue:[{id:"88000000-0000-4000-8000-000000000981",targetType:"post",reason:"other",details:null,contentStatus:"visible",content:"A separate fictional report remains open."}]};
 const actor=request=>{try{return JSON.parse(Buffer.from(request.headers().authorization.split(" ")[1].split(".")[1],"base64url").toString()).sub;}catch{return null;}};
 const authorized=request=>state.allowed&&state.admins.has(actor(request));
 const fail=detail=>({code:detail.includes("unavailable")?"42501":detail.includes("changed")?"40001":"22023",details:detail,message:secretDiagnostic});
 const fulfill=async(route,value)=>{try{await route.fulfill({headers:cors,status:value?.code==="42501"?403:value?.code?400:200,json:value});}catch{}};
 const find=(kind,id)=>(kind==="post"?posts:replies).find(item=>item.id===id);
 const content=item=>({id:item.id,kind:item.kind,title:item.title,body:item.body,status:item.status,exam:item.exam,topic:item.topic,assets:structuredClone(assets.get(item.id)??[])});
 const full=(kind,id)=>{
  const target=find(kind,id);if(!target)return null;
  const post=posts.find(item=>item.id===target.postId),parent=target.parentId?replies.find(item=>item.id===target.parentId):null;
  const result={targetType:kind,targetId:id,target:content(target),post:content(post),parent:parent?content(parent):null,
   history:state.actions.filter(action=>action.targetId===post.id||action.targetId===id||action.targetId===parent?.id).slice(-25).reverse().map((action,n)=>({id:`moderation:${state.actions.length-n}`,action:action.action,note:action.note,createdAt:action.createdAt}))};
  result.canRestore=target.status==="hidden"&&[result.target,result.post,result.parent].filter(Boolean).every(item=>item.assets.every(image=>image.available));
  result.reviewVersion=createHash("sha256").update(JSON.stringify(result)).digest("hex");return result;
 };
 state.view=full;
 const provider=await stubPortalProvider(page,name=>{
  if(name==="is_dmocks_admin")return state.allowed&&state.admins.has(state.activeActor);
  if(name==="admin_community_report_queue")return state.reportQueue;
  return emptyAdminRead(name);
 });
 await page.route(api+"/rest/v1/rpc/admin_community_content_page",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers:cors,status:204});
  const input=route.request().postDataJSON();state.pageCalls.push(input);
  const filters={targetType:input.p_target_type,postId:input.p_post_id,exam:input.p_exam,topic:input.p_topic,status:input.p_status},version=filters.targetType==="post"?state.feedRevision:state.replyRevision;
  let result;
  if(!authorized(route.request()))result=fail("community_moderation_unavailable");
  else if(input.p_cursor&&input.p_cursor.version!==version)result=fail("community_moderation_changed");
  else{
   const snapshotAt=input.p_cursor?.snapshotAt??stamp(),eligible=(filters.targetType==="post"?posts:replies.filter(item=>item.postId===filters.postId))
    .filter(item=>(!filters.exam||item.exam===filters.exam)&&(!filters.topic||item.topic===filters.topic)&&(!filters.status||item.status===filters.status)&&item.createdAt<=snapshotAt&&
     (!input.p_cursor||item.createdAt<input.p_cursor.createdAt||item.createdAt===input.p_cursor.createdAt&&item.id<input.p_cursor.id)).sort(desc);
   const items=structuredClone(eligible.slice(0,input.p_limit)),last=items.at(-1);
   result={items,filters,version,snapshotAt,nextCursor:eligible.length>input.p_limit?{...filters,createdAt:last.createdAt,id:last.id,snapshotAt,version}:null};
  }
  const held=input.p_cursor?state.holdMore:state.pageHolds.get(input.p_topic);if(held)await held.promise;
  if(state.failPageAfterHold)result=fail(state.failPageAfterHold);
  await fulfill(route,result);state.completedPages++;
 });
 await page.route(api+"/rest/v1/rpc/admin_review_community_content",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers:cors,status:204});
  const input=route.request().postDataJSON();state.readCalls.push(input);
  const value=authorized(route.request())&&!state.failRead?full(input.p_target_type,input.p_target_id):null,result=value??fail(state.failRead??"community_moderation_unavailable");
  const held=state.readHolds.get(input.p_target_id);if(held)await held.promise;
  await fulfill(route,result);state.completedReads++;
 });
 await page.route(api+"/rest/v1/rpc/admin_moderate_community",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers:cors,status:204});
  const input=route.request().postDataJSON(),user=actor(route.request());state.actionCalls.push(structuredClone(input));
  const held=state.holdAction;if(held)await held.promise;
  try{
   if(!authorized(route.request())||state.failAction)return await fulfill(route,fail(state.failAction??"community_moderation_unavailable"));
   const key=user+":"+input.p_request_id,existing=state.receipts.get(key),fingerprint=JSON.stringify(input);
   if(existing)return await fulfill(route,existing.fingerprint===fingerprint?{...existing.value,replayed:true}:fail("community_moderation_conflict"));
   const view=full(input.p_target_type,input.p_target_id),target=find(input.p_target_type,input.p_target_id);
   if(!view||view.reviewVersion!==input.p_expected_version)return await fulfill(route,fail("community_moderation_changed"));
   if(input.p_action==="restore"&&!view.canRestore)return await fulfill(route,fail("community_moderation_incomplete"));
   const previousStatus=target.status;target.status=input.p_action==="hide"?"hidden":input.p_action==="lock"?"locked":"visible";
   const createdAt=stamp(),value={requestId:input.p_request_id,targetType:input.p_target_type,targetId:input.p_target_id,action:input.p_action,previousStatus,status:target.status,createdAt};
   state.actions.push({targetId:target.id,action:input.p_action,note:input.p_note,createdAt,inspected:structuredClone(view)});
   state.receipts.set(key,{fingerprint,value});if(target.kind==="post")state.feedRevision++;state.replyRevision++;
   if(state.lostAcknowledgement){state.lostAcknowledgement=false;try{await route.abort();}catch{}return;}
   if(state.badAcknowledgement){state.badAcknowledgement=false;return await fulfill(route,{...value,requestId:otherAdmin.id,replayed:false});}
   return await fulfill(route,{...value,replayed:false});
  }finally{state.completedActions++;}
 });
 await page.route(api+"/functions/v1/community-media",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers:cors,status:204});
  const input=route.request().postDataJSON();state.mediaCalls.push(input);
  const current=full(input.targetType,input.targetId),held=state.holdMedia;if(held)await held.promise;
  try{
   if(state.bareMediaStatus)return await route.fulfill({headers:cors,status:state.bareMediaStatus,body:secretDiagnostic});
   if(!authorized(route.request())||state.failMedia)return await fulfill(route,fail(state.failMedia??"community_moderation_unavailable"));
   if(input.action!=="moderate"||input.reviewVersion!==current?.reviewVersion||full(input.targetType,input.targetId)?.reviewVersion!==current?.reviewVersion)return await fulfill(route,fail("community_moderation_changed"));
   const group=current[input.context];if(!group||group.assets.some(image=>!image.available))return await fulfill(route,fail("community_moderation_incomplete"));
   const media=group.assets.map(({available,...image})=>({...image,url:`https://moderation-images.example.invalid/${image.id}?link=${state.mediaCalls.length}`}));
   await fulfill(route,{media,serverNow:"2020-01-01T00:00:00Z",expiresAt:new Date(Date.parse("2020-01-01T00:00:00Z")+state.ttl).toISOString()});
  }finally{state.completedMedia++;}
 });
 await page.route("https://moderation-images.example.invalid/**",route=>{
  const sample=source.get(new URL(route.request().url()).pathname.slice(1));
  return route.fulfill({contentType:sample.mimeType,body:state.brokenImage?Buffer.from("Invalid fictional raster"):Buffer.from(sample.url.split(",")[1],"base64")});
 });
 await page.goto("/account");await seedPortalSession(page,administrator);await page.goto("/admin");
 await expect(page.getByRole("button",{name:"Browse Community content",exact:true})).toBeVisible();
 return Object.assign(state,provider);
}

async function openBrowser(page){await page.getByRole("button",{name:"Browse Community content",exact:true}).press("Enter");await expect(cards(page)).toHaveCount(25);}
async function openReview(page,n=1){await row(page,n).getByRole("button",{name:/^Review (discussion|reply)$/}).press("Enter");await expect(review(page).getByRole("heading",{name:"Review Community content",exact:true})).toBeFocused();await expect(review(page).getByLabel("Moderation reason",{exact:true})).toBeVisible();}
async function images(page,count){await review(page).getByRole("button",{name:"Open moderation images",exact:true}).press("Enter");const all=review(page).locator("img");await expect(all).toHaveCount(count);for(const item of await all.all()){await item.scrollIntoViewIfNeeded();await expect.poll(()=>item.evaluate(node=>node.naturalWidth>0)).toBe(true);}}
async function reason(page,text="An original fictional human moderation reason."){await review(page).getByLabel("Moderation reason",{exact:true}).fill(text);}
async function changed(page,action,noun="discussion"){await review(page).getByRole("button",{name:`${action} ${noun}`,exact:true}).press("Enter");await expect(review(page).getByRole("status").filter({hasText:/action recorded/})).toBeVisible();await expect(review(page).getByLabel("Moderation reason",{exact:true})).toHaveValue("");}

test("content browsing is lazy, bounded and keyboard paginated with exact raw timestamp continuations",async({page})=>{
 const state=await fixture(page);expect(state.pageCalls).toEqual([]);await openBrowser(page);
 await browser(page).getByRole("button",{name:"Load more moderation discussions",exact:true}).press("Enter");await expect(cards(page)).toHaveCount(50);await expect(row(page,26)).toBeFocused();
 await browser(page).getByRole("button",{name:"Load more moderation discussions",exact:true}).press("Enter");await expect(cards(page)).toHaveCount(61);await expect(row(page,51)).toBeFocused();
 expect(state.pageCalls.map(input=>input.p_limit)).toEqual([25,25,25]);expect(state.pageCalls[1].p_cursor.createdAt).toMatch(/\.123\d{3}\+00:00$/);expect(state.pageCalls[2].p_cursor.snapshotAt).toBe(state.pageCalls[1].p_cursor.snapshotAt);
 await expect(browser(page).getByRole("button",{name:"Load more moderation discussions",exact:true})).toHaveCount(0);
 await browser(page).getByRole("button",{name:"Reload moderation content",exact:true}).click();await expect(cards(page)).toHaveCount(25);expect(state.pageCalls.at(-1).p_cursor).toBeNull();expect(state.unexpected).toEqual([]);
});

test("exact exam/topic/status filters expose hidden discussions and replies with an explicit path back",async({page})=>{
 const state=await fixture(page);await openBrowser(page);
 const form=browser(page).getByRole("form",{name:"Community moderation filters",exact:true});
 await form.getByLabel("Moderation exam filter",{exact:true}).selectOption("ceed");await form.getByLabel("Moderation topic filter",{exact:true}).fill("Exact case topic");await form.getByLabel("Moderation status filter",{exact:true}).selectOption("hidden");await form.getByRole("button",{name:"Apply moderation filters",exact:true}).click();await expect(cards(page)).toHaveCount(1);await expect(row(page).getByText("hidden",{exact:true})).toBeVisible();
 await form.getByRole("button",{name:"Clear moderation filters",exact:true}).click();await expect(cards(page)).toHaveCount(25);
 await row(page).getByRole("button",{name:"Browse replies",exact:true}).click();await expect(cards(page)).toHaveCount(25);await expect(row(page).getByText("hidden",{exact:true})).toBeVisible();
 await browser(page).getByRole("button",{name:"Load more moderation replies",exact:true}).click();await expect(cards(page)).toHaveCount(50);
 await browser(page).getByRole("button",{name:"Back to discussions",exact:true}).click();await expect(cards(page)).toHaveCount(25);expect(state.pageCalls.at(-1).p_target_type).toBe("post");
});

test("a late filtered page cannot replace a newer filter or its selected review draft",async({page})=>{
 const state=await fixture(page);await openBrowser(page);const held=deferred();state.pageHolds.set("Observation",held);
 const form=browser(page).getByRole("form",{name:"Community moderation filters",exact:true});await form.getByLabel("Moderation topic filter",{exact:true}).fill("Observation");await form.getByRole("button",{name:"Apply moderation filters",exact:true}).click();await expect.poll(()=>state.pageCalls.length).toBe(2);
 await form.getByLabel("Moderation exam filter",{exact:true}).selectOption("ceed");await form.getByLabel("Moderation topic filter",{exact:true}).fill("Exact case topic");await form.getByRole("button",{name:"Apply moderation filters",exact:true}).click();await expect(cards(page)).toHaveCount(1);await openReview(page);await reason(page,"A new exact-context fictional review draft.");
 held.resolve();await expect.poll(()=>state.completedPages).toBe(3);await expect(cards(page)).toHaveCount(1);await expect(form.getByLabel("Moderation exam filter",{exact:true})).toHaveValue("ceed");await expect(review(page).getByLabel("Moderation reason",{exact:true})).toHaveValue("A new exact-context fictional review draft.");
});

test("hide and restore inspect current three-format images and retain every original asset and report",async({page})=>{
 const state=await fixture(page);await openBrowser(page);await openReview(page);await reason(page);await changed(page,"Hide");
 await expect(review(page).getByRole("button",{name:"Restore discussion",exact:true})).toBeDisabled();await images(page,3);
 for(const index of[1,2,3]){
  const opener=review(page).getByRole("button",{name:`Inspect selected discussion attachment ${index}`,exact:true});await opener.press("Enter");const modal=page.getByRole("dialog",{name:`Selected discussion attachment ${index}`,exact:true});await expect(modal).toBeVisible();
  await modal.getByRole("button",{name:"Rotate right",exact:true}).click();await modal.getByRole("button",{name:"Mirror view",exact:true}).click();await page.keyboard.press("Escape");await expect(modal).toHaveCount(0);await expect(opener).toBeFocused();
 }
 expect(state.mediaCalls).toHaveLength(1);await expect(review(page).getByRole("button",{name:"Restore discussion",exact:true})).toBeEnabled();await reason(page,"Restore after inspecting the original fictional images.");await changed(page,"Restore");
 expect(state.actions.map(action=>action.action)).toEqual(["hide","restore"]);expect(state.assets.get(state.posts[0].id)).toHaveLength(3);expect(state.reportQueue).toHaveLength(1);await expect(page.getByRole("article",{name:"Community report 1",exact:true})).toBeVisible();await expect(review(page).locator("img")).toHaveCount(0);
});

test("hidden nested replies include legacy parent and discussion images before restoration",async({page})=>{
 const state=await fixture(page);await openBrowser(page);await row(page).getByRole("button",{name:"Browse replies",exact:true}).click();await expect(cards(page)).toHaveCount(25);await openReview(page,2);
 await expect(review(page).getByRole("region",{name:"Parent reply",exact:true}).getByText(state.replies[0].body,{exact:true})).toBeVisible();await images(page,5);
 expect(state.mediaCalls.map(input=>input.context)).toEqual(["target","parent","post"]);await reason(page);await changed(page,"Restore","reply");expect(state.replies[1].status).toBe("visible");expect(state.replies[0].status).toBe("hidden");expect(state.posts[0].status).toBe("visible");
});

test("written lock and unlock actions preserve readable content and reject blank reasons",async({page})=>{
 const state=await fixture(page);await openBrowser(page);await openReview(page);
 await review(page).getByRole("button",{name:"Lock discussion",exact:true}).click();await expect(review(page).getByRole("alert")).toContainText("8 to 1000");expect(state.actionCalls).toEqual([]);
 await reason(page);await changed(page,"Lock");await expect(review(page).getByRole("button",{name:"Unlock discussion",exact:true})).toBeVisible();await reason(page);await changed(page,"Unlock");expect(state.actions.map(action=>action.action)).toEqual(["lock","unlock"]);expect(state.mediaCalls).toEqual([]);
});

test("a double click sends one frozen moderation intent while its acknowledgement is held",async({page})=>{
 const state=await fixture(page);await openBrowser(page);await openReview(page);await reason(page);const held=deferred();state.holdAction=held;
 await review(page).getByRole("button",{name:"Lock discussion",exact:true}).dblclick();await expect.poll(()=>state.actionCalls.length).toBe(1);held.resolve();await expect(review(page).getByRole("button",{name:"Unlock discussion",exact:true})).toBeVisible();expect(state.actions).toHaveLength(1);expect(state.actionCalls).toHaveLength(1);
});

for(const failure of["lostAcknowledgement","badAcknowledgement"])test(`an uncertain action freezes one request and confirms its receipt without repeating moderation ${failure}`,async({page})=>{
 const state=await fixture(page);await openBrowser(page);await openReview(page);await reason(page,"  A frozen fictional lock reason.  ");state[failure]=true;
 await review(page).getByRole("button",{name:"Lock discussion",exact:true}).click();const pending=review(page).getByRole("region",{name:"Unconfirmed moderation action",exact:true});await expect(pending).toBeVisible();await expect(review(page).getByLabel("Moderation reason",{exact:true})).toBeDisabled();expect(state.actions).toHaveLength(1);
 await pending.getByRole("button",{name:"Retry moderation action",exact:true}).press("Enter");await expect(pending).toHaveCount(0);await expect(review(page).getByRole("status").filter({hasText:"action confirmed"})).toBeVisible();
 expect(state.actions).toHaveLength(1);expect(state.actionCalls).toHaveLength(2);expect(state.actionCalls[1]).toEqual(state.actionCalls[0]);expect(state.actionCalls[0].p_note).toBe("A frozen fictional lock reason.");await expect(review(page).getByRole("button",{name:"Unlock discussion",exact:true})).toBeVisible();
});

test("stopping an uncertain action reloads current status and history without resending it",async({page})=>{
 const state=await fixture(page);await openBrowser(page);await openReview(page);await reason(page);state.lostAcknowledgement=true;await review(page).getByRole("button",{name:"Lock discussion",exact:true}).click();
 await review(page).getByRole("button",{name:"Stop retrying and refresh",exact:true}).click();await expect(review(page).getByRole("button",{name:"Unlock discussion",exact:true})).toBeVisible();await expect(review(page).getByLabel("Moderation reason",{exact:true})).toHaveValue("");expect(state.actionCalls).toHaveLength(1);expect(state.actions).toHaveLength(1);
 await review(page).getByText("Moderation history",{exact:true}).click();await expect(review(page).getByText(/lock ·/)).toBeVisible();
});

test("stale content clears images and reason and requires explicit current reopening",async({page})=>{
 const state=await fixture(page);await openBrowser(page);await openReview(page);await images(page,3);await reason(page);state.posts[0].body="A revised original fictional method after inspection.";
 await review(page).getByRole("button",{name:"Hide discussion",exact:true}).click();await expect(review(page).getByRole("button",{name:"Reopen content",exact:true})).toBeFocused();await expect(review(page).locator("img")).toHaveCount(0);expect(state.actions).toEqual([]);
 await review(page).getByRole("button",{name:"Reopen content",exact:true}).click();await expect(review(page).getByText(state.posts[0].body,{exact:true})).toBeVisible();await expect(review(page).getByLabel("Moderation reason",{exact:true})).toHaveValue("");
});

test("missing registered images block restoration while containment remains available",async({page})=>{
 const state=await fixture(page);state.assets.get(state.posts[1].id)[0].available=false;state.assets.get(state.posts[0].id)[0].available=false;
 await openBrowser(page);await openReview(page,2);await expect(review(page).getByRole("button",{name:"Restore discussion",exact:true})).toBeDisabled();expect(state.mediaCalls).toEqual([]);
 await row(page).getByRole("button",{name:"Review discussion",exact:true}).click();await reason(page);await changed(page,"Lock");expect(state.posts[0].status).toBe("locked");expect(state.mediaCalls).toEqual([]);
});

test("a denied continuation clears an open image viewer and every private content card",async({page})=>{
 const state=await fixture(page);await openBrowser(page);await openReview(page);await images(page,3);const held=deferred();state.holdMore=held;
 await browser(page).getByRole("button",{name:"Load more moderation discussions",exact:true}).click();await expect.poll(()=>state.pageCalls.length).toBe(2);await review(page).getByRole("button",{name:"Inspect selected discussion attachment 1",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();
 state.failPageAfterHold="community_moderation_unavailable";held.resolve();await expect(review(page)).toHaveCount(0);await expect(cards(page)).toHaveCount(0);await expect(page.getByRole("dialog")).toHaveCount(0);await expect(browser(page).getByRole("heading",{name:"Community content",exact:true})).toBeFocused();await expect(page.getByText(secretDiagnostic,{exact:false})).toHaveCount(0);
});

test("a delayed authorized page cannot restore content after a newer review denial",async({page})=>{
 const state=await fixture(page);await openBrowser(page);const held=deferred();state.holdMore=held;await browser(page).getByRole("button",{name:"Load more moderation discussions",exact:true}).click();await expect.poll(()=>state.pageCalls.length).toBe(2);
 state.failRead="community_moderation_unavailable";await row(page).getByRole("button",{name:"Review discussion",exact:true}).click();await expect(cards(page)).toHaveCount(0);held.resolve();await expect.poll(()=>state.completedPages).toBe(2);await expect(cards(page)).toHaveCount(0);await expect(review(page)).toHaveCount(0);
});

test("late action and image responses preserve a newer selected content draft",async({page})=>{
 const state=await fixture(page);await openBrowser(page);await openReview(page);await reason(page);const held=deferred();state.holdAction=held;await review(page).getByRole("button",{name:"Lock discussion",exact:true}).click();await expect.poll(()=>state.actionCalls.length).toBe(1);
 await row(page,2).getByRole("button",{name:"Review discussion",exact:true}).click();await expect(review(page).getByText(state.posts[1].body,{exact:true})).toBeVisible();await reason(page,"A newer unsent fictional review draft.");held.resolve();await expect.poll(()=>state.completedActions).toBe(1);await expect(review(page).getByLabel("Moderation reason",{exact:true})).toHaveValue("A newer unsent fictional review draft.");await expect(review(page).getByRole("button",{name:"Restore discussion",exact:true})).toBeVisible();
 const media=deferred();state.holdMedia=media;await review(page).getByRole("button",{name:"Open moderation images",exact:true}).click();await expect.poll(()=>state.mediaCalls.length).toBe(1);
 await row(page,3).getByRole("button",{name:"Review discussion",exact:true}).click();await expect(review(page).getByText(state.posts[2].body,{exact:true})).toBeVisible();await reason(page,"Another current fictional draft.");media.resolve();await expect.poll(()=>state.completedMedia).toBe(1);await expect(review(page).locator("img")).toHaveCount(0);await expect(review(page).getByLabel("Moderation reason",{exact:true})).toHaveValue("Another current fictional draft.");
});

test("account and same-route history changes discard queued private content and action responses",async({page})=>{
 const state=await fixture(page);await openBrowser(page);await openReview(page);await images(page,3);await reason(page);const held=deferred();state.holdAction=held;await review(page).getByRole("button",{name:"Lock discussion",exact:true}).click();await expect.poll(()=>state.actionCalls.length).toBe(1);
 state.activeActor=otherAdmin.id;await seedPortalSession(page,otherAdmin);await page.evaluate(()=>{const key="sb-dmocks-portal-fixture-auth-token",channel=new BroadcastChannel(key);channel.postMessage({event:"SIGNED_IN",session:JSON.parse(localStorage.getItem(key))});channel.close();});
 await expect(browser(page)).toHaveCount(0);held.resolve();await expect.poll(()=>state.completedActions).toBe(1);await expect(browser(page)).toHaveCount(0);
 await openBrowser(page);const read=deferred(),before=state.readCalls.length,completed=state.completedReads;state.readHolds.set(state.posts[0].id,read);await row(page).getByRole("button",{name:"Review discussion",exact:true}).click();await expect.poll(()=>state.readCalls.length).toBe(before+1);
 await page.evaluate(()=>{history.pushState({...history.state,key:"new-fictional-admin-history"},"",location.href);dispatchEvent(new PopStateEvent("popstate",{state:history.state}));});await expect(browser(page)).toHaveCount(0);read.resolve();await expect.poll(()=>state.completedReads).toBe(completed+1);await expect(browser(page)).toHaveCount(0);await openBrowser(page);
});

test("navigation drops a held private context response without reopening the workspace",async({page})=>{
 const state=await fixture(page);await openBrowser(page);const held=deferred();state.readHolds.set(state.posts[0].id,held);await row(page).getByRole("button",{name:"Review discussion",exact:true}).click();await expect.poll(()=>state.readCalls.length).toBe(1);
 await page.getByRole("banner").getByRole("link",{name:"DMocks home",exact:true}).click();await expect(page).toHaveURL(/\/$/);held.resolve();await expect.poll(()=>state.completedReads).toBe(1);await expect(review(page)).toHaveCount(0);await expect(browser(page)).toHaveCount(0);
});

test("expired or broken private images cannot authorize restoration and expired viewers do not return",async({page})=>{
 await page.clock.install({time:new Date()});const state=await fixture(page);state.ttl=5000;await openBrowser(page);await openReview(page,2);await images(page,1);
 await review(page).getByRole("button",{name:"Inspect selected discussion attachment 1",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();await page.clock.fastForward(6000);await expect(page.getByRole("dialog")).toHaveCount(0);await expect(review(page).locator("img")).toHaveCount(0);await expect(review(page).getByRole("button",{name:"Restore discussion",exact:true})).toBeDisabled();
 state.brokenImage=true;await review(page).getByRole("button",{name:"Open moderation images",exact:true}).click();await review(page).locator("img").scrollIntoViewIfNeeded();await expect(review(page).getByRole("alert").filter({hasText:"A private image could not be displayed."})).toBeVisible();await expect(review(page).getByRole("button",{name:"Restore discussion",exact:true})).toBeDisabled();expect(state.actions).toEqual([]);
});

test("moderation filters, context, current image controls and reasons support keyboard, both themes and 320px",async({page})=>{
 await fixture(page,{long:true});await openBrowser(page);await openReview(page);await images(page,3);await page.addScriptTag({path:fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js",import.meta.url))});
 for(const dark of[false,true]){
  if(dark)await page.getByRole("switch",{name:"Dark mode",exact:true}).click();await expect(browser(page).getByRole("button",{name:"Apply moderation filters",exact:true})).toHaveCSS("background-color",dark?"rgb(220, 235, 161)":"rgb(36, 71, 53)");
  expect(await page.evaluate(async()=>(await window.axe.run(".community-content-browser",{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}})).violations.map(item=>item.id))).toEqual([]);
  const opener=review(page).getByRole("button",{name:"Inspect selected discussion attachment 1",exact:true});await opener.press("Enter");const modal=page.getByRole("dialog",{name:"Selected discussion attachment 1",exact:true});await expect(modal).toBeVisible();await page.keyboard.press("Shift+Tab");await expect(modal.getByRole("region",{name:"Selected discussion attachment 1 scrollable image",exact:true})).toBeFocused();await page.keyboard.press("Tab");await expect(modal.getByRole("button",{name:"Close image",exact:true})).toBeFocused();await page.keyboard.press("Escape");await expect(opener).toBeFocused();
 }
 await page.setViewportSize({width:320,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
 await review(page).getByRole("button",{name:"Close content review",exact:true}).press("Enter");await expect(row(page).getByRole("button",{name:"Review discussion",exact:true})).toBeFocused();
});
