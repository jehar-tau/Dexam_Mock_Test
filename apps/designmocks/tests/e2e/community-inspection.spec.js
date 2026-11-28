import {expect,test} from "@playwright/test";
import {fileURLToPath} from "node:url";
import {portalFixtureURL,seedPortalSession,stubPortalIdentity} from "./portal-fixture.js";
import {orientationPages} from "./drawing-orientation-fixture.js";
import {communityFeedFixture} from "./community-feed-fixture.js";
test.use({baseURL:portalFixtureURL});
const actor={id:"00000000-0000-4000-8000-000000000841",email:"community-inspection@example.invalid"};
const postId="10000000-0000-4000-8000-000000000841",commentId="20000000-0000-4000-8000-000000000841",nextId="20000000-0000-4000-8000-000000000842";
const api="https://dmocks-portal-fixture.supabase.co",headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
const viewer=(page,label="Question attachment 1")=>page.getByRole("dialog",{name:label,exact:true});
const inspect=(page,label="question attachment 1")=>page.getByRole("button",{name:"Inspect "+label,exact:true});
async function fixture(page,{clock=false,linkLifetime=300000}={}){
 if(clock)await page.clock.install({time:new Date()});
 const samples=await orientationPages(6),state={links:1,hasMore:true,holdMore:null,signingStatus:null,calls:[],signs:0,completed:0};
 const post={id:postId,exam:"uceed",topic:"observation",title:"Original fictional private image discussion",body:"An original fictional discussion with private raster question and solution images.",status:"visible",author:"Fictional author",comments:2,assetCount:3};
 const row=(id,assets)=>({id,parentId:null,body:id===commentId?"An original fictional legacy JPEG solution.":"An original fictional later method.",author:"Fictional solver",helpful:0,isMine:false,canReply:true,markedHelpful:false,parentAvailable:false,parentPreview:null,assetCount:assets});
 const media=(index,legacy=false)=>({...samples[index],id:`30000000-0000-4000-8000-${String(index+841+(legacy?10:0)).padStart(12,"0")}`,ordinal:legacy?1:index+1,
  url:`${api}/storage/v1/object/sign/community-media/fictional-${index}?token=fictional-${state.links}`,...(legacy?{width:null,height:null,orientation:null}:{} )});
 await page.route(api+"/storage/v1/object/sign/community-media/**",route=>{
  const index=Number(new URL(route.request().url()).pathname.split("fictional-").at(-1)),source=samples[index];
  return route.fulfill({headers:{"Content-Type":source.mimeType,"Cache-Control":"no-store"},body:Buffer.from(source.url.split(",")[1],"base64")});
 });
 await page.route(api+"/rest/v1/rpc/**",async route=>{
  const request=route.request();if(request.method()==="OPTIONS")return route.fulfill({headers,status:204});
  const name=new URL(request.url()).pathname.split("/").at(-1),input=request.postDataJSON();state.calls.push([name,input]);let value;
  if(name==="community_feed")value=communityFeedFixture([post],input);
  else if(name==="community_thread"||name==="community_reply_context"){
   if(input.p_cursor&&state.holdMore)await state.holdMore.promise;
   value={...post,comments:input.p_cursor?[row(nextId,0)]:[row(commentId,1)],version:1,nextCursor:!input.p_cursor&&state.hasMore?{createdAt:"2026-01-01T00:00:00.123456Z",id:commentId,snapshotAt:"2026-01-02T00:00:00.654321Z",version:1}:null};
  }else if(name==="public_all_india_top_ten")value=[];
  else throw new Error("Unexpected fictional inspector procedure: "+name);
  try{await route.fulfill({headers,json:value});}catch{}finally{state.completed++;}
 });
 await page.route(api+"/functions/v1/community-media",async route=>{
  const request=route.request();if(request.method()==="OPTIONS")return route.fulfill({headers,status:204});state.signs++;
  const input=request.postDataJSON();return route.fulfill({headers,status:state.signingStatus??200,json:state.signingStatus?{error:"private-inspection-diagnostic"}:
   {media:input.targetType==="post"?[media(0),media(1),media(2)]:input.targetId===commentId?[media(1,true)]:[],serverNow:"2026-01-01T00:00:00Z",expiresAt:new Date(Date.parse("2026-01-01T00:00:00Z")+linkLifetime).toISOString()}});
 });
 await stubPortalIdentity(page);await page.goto("/account");await seedPortalSession(page,actor);await page.goto("/dashboard/community/discussions");await page.getByRole("button",{name:"Open discussion",exact:true}).click();await expect(inspect(page)).toBeVisible();return state;
}

test("members inspect current PNG, JPEG, WebP and legacy solution images without another signing request",async({page})=>{
 const state=await fixture(page),signed=state.signs;
 for(const label of ["Question attachment 1","Question attachment 2","Question attachment 3","Solution attachment 1"]){
  const opener=inspect(page,label.toLowerCase());await opener.press("Enter");const dialog=viewer(page,label);await expect(dialog).toBeVisible();await expect(dialog.getByRole("img",{name:label,exact:true})).toBeVisible();
  await dialog.getByRole("button",{name:"Rotate right",exact:true}).press("Enter");await dialog.getByRole("button",{name:"Mirror view",exact:true}).press("Enter");await expect(dialog.getByRole("status")).toContainText("rotated 90° · mirrored");
  await dialog.getByRole("button",{name:"Actual size",exact:true}).click();await dialog.getByRole("button",{name:"Fit page",exact:true}).click();await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
 }
 expect(state.signs).toBe(signed);
});

test("native inspection wraps keyboard focus and closes to its exact opener",async({page})=>{
 await fixture(page);await inspect(page).press("Enter");const dialog=viewer(page),close=dialog.getByRole("button",{name:"Close image",exact:true});await expect(close).toBeFocused();
 await page.keyboard.press("Shift+Tab");await expect(dialog.getByRole("region",{name:"Question attachment 1 scrollable image",exact:true})).toBeFocused();await page.keyboard.press("Tab");await expect(close).toBeFocused();
 await close.press("Enter");await expect(dialog).toHaveCount(0);await expect(inspect(page)).toBeFocused();
});

test("a queued old close cannot dismiss or steal focus from a newer selected image",async({page})=>{
 await fixture(page);await inspect(page).click();await expect(viewer(page)).toBeVisible();
 await page.evaluate(()=>{document.querySelector(".drawing-inspection-dialog").close();[...document.querySelectorAll(".community-image-frame button")].find(button=>button.textContent==="Inspect question attachment 2").click();});
 const next=viewer(page,"Question attachment 2");await expect(next).toBeVisible();await expect(next.getByRole("button",{name:"Close image",exact:true})).toBeFocused();await page.keyboard.press("Escape");await expect(next).toHaveCount(0);await expect(inspect(page,"question attachment 2")).toBeFocused();
});

test("an older question close cannot dismiss a newly opened solution inspector",async({page})=>{
 await fixture(page);await inspect(page).click();await page.evaluate(()=>{document.querySelector(".drawing-inspection-dialog").close();[...document.querySelectorAll(".community-image-frame button")].find(button=>button.textContent==="Inspect solution attachment 1").click();});
 const next=viewer(page,"Solution attachment 1");await expect(next).toBeVisible();await expect(next.getByRole("button",{name:"Close image",exact:true})).toBeFocused();await page.keyboard.press("Escape");await expect(inspect(page,"solution attachment 1")).toBeFocused();
});

test("a refreshed URL clears an older inspector while preserving the draft and loaded replies",async({page})=>{
 const state=await fixture(page),held=deferred();state.holdMore=held;await page.getByLabel("Add a reply",{exact:true}).fill("An original fictional unsent draft while inspecting images.");await page.getByRole("button",{name:"Load more replies",exact:true}).click();await expect.poll(()=>state.calls.filter(([name])=>name==="community_thread").length).toBe(2);
 await inspect(page).click();await expect(viewer(page)).toBeVisible();state.links=2;held.resolve();await expect(viewer(page)).toHaveCount(0);await expect(page.getByText("An original fictional later method.",{exact:true})).toBeVisible();await expect(page.getByLabel("Add a reply",{exact:true})).toHaveValue("An original fictional unsent draft while inspecting images.");await expect(inspect(page)).toBeFocused();
 await inspect(page).press("Enter");await expect(viewer(page).getByRole("img",{name:"Question attachment 1",exact:true})).toHaveAttribute("src",/fictional-2$/);
});

test("expiry closes an active inspector and a late fresh page cannot resurrect that selection",async({page})=>{
 const state=await fixture(page,{clock:true,linkLifetime:10000}),held=deferred();state.holdMore=held;await page.getByRole("button",{name:"Load more replies",exact:true}).click();await inspect(page).click();await expect(viewer(page)).toBeVisible();
 await page.clock.runFor(10_050);await expect(viewer(page)).toHaveCount(0);await expect(page.getByRole("img",{name:/Question attachment/})).toHaveCount(0);await expect(page.getByRole("region",{name:"Discussion thread",exact:true}).getByRole("heading",{name:"Original fictional private image discussion",exact:true})).toBeFocused();
 held.resolve();await expect(page.getByText("An original fictional later method.",{exact:true})).toBeVisible();await expect(inspect(page)).toBeVisible();await expect(viewer(page)).toHaveCount(0);await inspect(page).click();await expect(viewer(page)).toBeVisible();
});

test("denied signing during an open inspector clears private views and restores feed focus",async({page})=>{
 const state=await fixture(page),held=deferred();state.holdMore=held;await page.getByRole("button",{name:"Load more replies",exact:true}).click();await inspect(page).click();await expect(viewer(page)).toBeVisible();state.signingStatus=403;held.resolve();await expect(viewer(page)).toHaveCount(0);await expect(page.getByRole("region",{name:"Discussion thread",exact:true})).toHaveCount(0);await expect(page.getByRole("button",{name:"Open discussion",exact:true})).toBeFocused();await expect(page.getByText("private-inspection-diagnostic",{exact:false})).toHaveCount(0);
});

test("account change and navigation remove an active private inspector",async({page})=>{
 await fixture(page);await inspect(page).click();await seedPortalSession(page,{id:"00000000-0000-4000-8000-000000000842",email:"other-inspector@example.invalid"});await page.evaluate(()=>{const key="sb-dmocks-portal-fixture-auth-token",channel=new BroadcastChannel(key);channel.postMessage({event:"SIGNED_IN",session:JSON.parse(localStorage.getItem(key))});channel.close();});await expect(viewer(page)).toHaveCount(0);await expect(page.getByRole("region",{name:"Discussion thread",exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Open discussion",exact:true}).click();await inspect(page).click();await expect(viewer(page)).toBeVisible();await page.goto("/");await expect(viewer(page)).toHaveCount(0);await expect(page.getByRole("img",{name:/Question attachment/})).toHaveCount(0);
});

test("member inspection controls and gallery reflow at 320px in both accessible themes",async({page})=>{
 await fixture(page);await page.setViewportSize({width:320,height:900});await page.addScriptTag({path:fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js",import.meta.url))});
 for(const dark of [false,true]){if(dark)await page.getByRole("switch",{name:"Dark mode",exact:true}).click();await expect(page.getByRole("button",{name:"Post to community",exact:true})).toHaveCSS("background-color",dark?"rgb(220, 235, 161)":"rgb(36, 71, 53)");
  await inspect(page).click();await expect(viewer(page).getByRole("img",{name:"Question attachment 1",exact:true})).toBeVisible();expect(await page.evaluate(async()=> (await window.axe.run(".drawing-inspection-dialog",{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}})).violations.map(item=>item.id))).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);await page.keyboard.press("Escape");
 }
});
