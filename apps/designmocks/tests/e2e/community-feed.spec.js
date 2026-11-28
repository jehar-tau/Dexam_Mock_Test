import {expect,test} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {portalFixtureURL,seedPortalSession,stubPortalIdentity} from "./portal-fixture.js";
test.use({baseURL:portalFixtureURL});
const actor={id:"00000000-0000-4000-8000-000000000801",email:"community-feed@example.invalid"};
const api="https://dmocks-portal-fixture.supabase.co",headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const snapshot="2026-01-02T00:00:00.654321+00:00";
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
const post=n=>({id:`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`,exam:n%2?"uceed":"ceed",topic:n%3?"observation":"Perspective & form",
 title:`Original fictional feed question ${n}`,body:"We compare original fictional methods without sharing active assessment answers.",author:"Fictional member",comments:0,assetCount:0,status:n%7?"visible":"locked",createdAt:`2026-01-01T00:00:00.${String(n).padStart(6,"0")}+00:00`});
const feed=page=>page.getByRole("region",{name:"Community discussions",exact:true}),cards=page=>feed(page).locator(".community-feed > article"),filters=page=>page.getByRole("form",{name:"Discussion filters",exact:true});
async function choose(page,exam="",topic=""){
 await filters(page).getByLabel("Exam filter",{exact:true}).selectOption(exam);
 await filters(page).getByLabel("Topic filter",{exact:true}).fill(topic);
 await filters(page).getByRole("button",{name:"Apply filters",exact:true}).click();
}
async function fixture(page,{long=false}={}){
 const state={posts:Array.from({length:61},(_,i)=>post(i+1)),version:1,calls:[],completed:0,errorNext:false,invalidNext:false,holdFilter:null,holdMore:null,holdReload:null,holdWrite:null,holdUpload:null,writes:0,uploads:0};
 if(long)state.posts[60]={...state.posts[60],title:"Title".repeat(32),topic:"Topic".repeat(20),body:"OriginalFictionalBody".repeat(200)};
 await page.route(api+"/rest/v1/rpc/**",async route=>{
  const request=route.request();if(request.method()==="OPTIONS")return route.fulfill({headers,status:204});
  const name=new URL(request.url()).pathname.split("/").at(-1),input=request.postDataJSON();let value,status=200,held;
  if(name==="community_feed"){
   state.calls.push(input);
   const selected={exam:input.p_exam,topic:input.p_topic};
   if(input.p_cursor&&input.p_cursor.version!==state.version){status=409;value={code:"40001",details:"community_feed_changed",message:"private-feed-diagnostic"};}
   else if(input.p_cursor&&state.errorNext){status=503;value={code:"XX000",message:"private-feed-diagnostic"};}
   else{
    const all=state.posts.filter(p=>p.status!=="hidden"&&p.createdAt<=snapshot&&(!selected.exam||p.exam===selected.exam)&&(!selected.topic||p.topic===selected.topic))
     .sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
    const start=input.p_cursor?all.findIndex(p=>p.id===input.p_cursor.id)+1:0,rows=all.slice(start,start+25),last=rows.at(-1);
    value={posts:structuredClone(rows),version:state.version,snapshotAt:snapshot,filters:selected,
     nextCursor:start+rows.length<all.length?{id:last.id,createdAt:last.createdAt,snapshotAt:snapshot,version:state.version,...selected}:null};
    if(state.invalidNext){state.invalidNext=false;value.posts=Array.from({length:26},(_,i)=>post(i+1));}
   }
   if(state.holdFilter&&input.p_exam===state.holdFilter.exam){held=state.holdFilter;state.holdFilter=null;}
   else if(input.p_cursor&&state.holdMore){held=state.holdMore;state.holdMore=null;}
   else if(!input.p_cursor&&state.holdReload){held=state.holdReload;state.holdReload=null;}
  }else if(name==="create_community_post"){
   state.writes++;const saved={...post(999),exam:input.p_exam,topic:input.p_topic,title:input.p_title,body:input.p_body,status:"visible"};state.posts.push(saved);
   value={id:saved.id,postId:saved.id,parentId:null,status:"visible",postStatus:"visible",canUpload:true,replayed:false};held=state.holdWrite;
  }else if(name==="community_thread"){
   const selected=state.posts.find(p=>p.id===input.p_post_id);value={...selected,comments:[],version:1,nextCursor:null};
  }else if(name==="public_all_india_top_ten")value=[];
  else throw new Error("Unexpected fictional feed procedure: "+name);
  if(held)await held.promise;
  try{await route.fulfill({headers,status,json:value});}catch{}finally{if(name==="community_feed")state.completed++;}
 });
 await page.route(api+"/functions/v1/community-media",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers,status:204});
  state.uploads++;if(state.holdUpload)await state.holdUpload.promise;
  try{await route.fulfill({headers,json:{id:"30000000-0000-4000-8000-000000000801",ordinal:1,reused:false}});}catch{}
 });
 await stubPortalIdentity(page);await page.goto("/account");await seedPortalSession(page,actor);await page.goto("/dashboard/community/discussions");await expect(cards(page)).toHaveCount(25);
 return state;
}
const more=page=>feed(page).getByRole("button",{name:"Load more discussions",exact:true});

test("bounded pages preserve order, focus and a composer draft through the final page",async({page})=>{
 const state=await fixture(page);await page.getByLabel("Question title",{exact:true}).fill("An unsent original fictional draft");
 await more(page).press("Enter");await expect(cards(page)).toHaveCount(50);await expect(page.locator("#community-post-"+post(36).id)).toBeFocused();
 await expect(feed(page).getByText("25 more discussions loaded.",{exact:true})).toBeVisible();
 await more(page).press("Enter");await expect(cards(page)).toHaveCount(61);await expect(page.locator("#community-post-"+post(11).id)).toBeFocused();
 await expect(more(page)).toHaveCount(0);await expect(page.getByLabel("Question title",{exact:true})).toHaveValue("An unsent original fictional draft");
 expect(await cards(page).evaluateAll(rows=>rows.map(row=>row.id))).toEqual(state.posts.slice().reverse().map(row=>"community-post-"+row.id));
 expect(state.calls.map(input=>input.p_limit)).toEqual([25,25,25]);expect(state.calls[1].p_cursor.createdAt).toBe(post(37).createdAt);
});

test("exam and exact topic filters replace pages and clear back to the first page",async({page})=>{
 const state=await fixture(page);await choose(page,"ceed","  Perspective & form  ");await expect(cards(page)).toHaveCount(10);
 expect(await cards(page).evaluateAll(rows=>rows.map(row=>row.textContent))).toEqual(expect.arrayContaining([expect.stringContaining("ceed · Perspective & form")]));
 expect(state.calls.at(-1)).toEqual({p_exam:"ceed",p_topic:"Perspective & form",p_cursor:null,p_limit:25});
 await choose(page,"ceed","perspective & form");await expect(cards(page)).toHaveCount(0);await expect(feed(page).getByText("No discussions match these filters.",{exact:true})).toBeVisible();
 await filters(page).getByRole("button",{name:"Clear filters",exact:true}).click();await expect(cards(page)).toHaveCount(25);await expect(filters(page).getByLabel("Exam filter",{exact:true})).toHaveValue("");expect(state.writes).toBe(0);
});

test("a held older filter cannot overwrite a newer exam choice",async({page})=>{
 const state=await fixture(page),held={exam:"uceed",...deferred()};state.holdFilter=held;
 await choose(page,"uceed");await expect.poll(()=>state.calls.length).toBe(2);await expect(cards(page)).toHaveCount(0);
 await choose(page,"ceed");await expect(cards(page)).toHaveCount(25);const before=state.completed;held.resolve();await expect.poll(()=>state.completed).toBe(before+1);
 await expect(filters(page).getByLabel("Exam filter",{exact:true})).toHaveValue("ceed");
 expect((await cards(page).allTextContents()).every(value=>value.includes("ceed ·")&&!value.includes("uceed ·"))).toBe(true);
});

test("a failed continuation retains its pages and exact cursor for retry",async({page})=>{
 const state=await fixture(page);state.errorNext=true;await more(page).click();await expect(feed(page).getByRole("status")).toHaveText("Couldn’t load discussions. Try again.");await expect(cards(page)).toHaveCount(25);
 const cursor=state.calls.at(-1).p_cursor;state.errorNext=false;await more(page).click();await expect(cards(page)).toHaveCount(50);expect(state.calls.at(-1).p_cursor).toEqual(cursor);
 await expect(page.getByText("private-feed-diagnostic",{exact:false})).toHaveCount(0);
});

test("redaction invalidates the continuation and clears old pages before a bounded reload",async({page})=>{
 const state=await fixture(page),hidden=state.posts[60],held=deferred();hidden.status="hidden";state.version++;state.holdReload=held;
 await more(page).click();await expect.poll(()=>state.calls.length).toBe(3);await expect(cards(page)).toHaveCount(0);await expect(more(page)).toHaveCount(0);
 held.resolve();await expect(cards(page)).toHaveCount(25);await expect(page.locator("#community-post-"+hidden.id)).toHaveCount(0);
 await expect(feed(page).getByText("Discussions changed. The latest discussions are now shown.",{exact:true})).toBeVisible();expect(state.calls.at(-1).p_cursor).toBeNull();
});

test("an oversized or mismatched provider page is never rendered and can be refreshed",async({page})=>{
 const state=await fixture(page);state.invalidNext=true;await choose(page,"ceed");await expect(feed(page).getByRole("status")).toHaveText("Couldn’t load discussions. Try again.");await expect(cards(page)).toHaveCount(0);
 await feed(page).getByRole("button",{name:"Refresh discussions",exact:true}).click();await expect(cards(page)).toHaveCount(25);
 expect((await cards(page).allTextContents()).every(value=>value.includes("ceed ·")&&!value.includes("uceed ·"))).toBe(true);
});

async function compose(page,images=false){
 await page.getByLabel("Topic",{exact:true}).fill("observation");await page.getByLabel("Question title",{exact:true}).fill("Original fictional pending discussion");
 await page.getByLabel("Your approach or question",{exact:true}).fill("An original fictional pending discussion body for the old exam scope.");
 if(images)await page.getByLabel("Question images (optional, up to 3)",{exact:true}).setInputFiles({name:"fictional.png",mimeType:"image/png",buffer:await readFile(new URL("../fixtures/drawing-images/fictional-drawing.png",import.meta.url))});
 await page.getByRole("button",{name:"Post to community",exact:true}).click();
}
for(const stage of ["text","image"])test(`late ${stage} completion respects a newer feed filter without opening an old discussion`,async({page})=>{
 const state=await fixture(page),held=deferred();state[stage==="text"?"holdWrite":"holdUpload"]=held;
 await compose(page,stage==="image");await expect.poll(()=>stage==="text"?state.writes:state.uploads).toBe(1);
 await choose(page,"ceed");await expect(cards(page)).toHaveCount(25);const count=state.calls.length;
 held.resolve();await expect(page.getByText(stage==="text"?"Your post is live.":"Your post is live. All images confirmed.",{exact:true})).toBeVisible();
 expect(state.calls.length).toBe(count);await expect(page.getByRole("region",{name:"Discussion thread",exact:true})).toHaveCount(0);await expect(filters(page).getByLabel("Exam filter",{exact:true})).toHaveValue("ceed");
});

test("leaving Community aborts a held continuation and ignores its later page",async({page})=>{
 const state=await fixture(page),held=deferred();state.holdMore=held;await more(page).click();await expect.poll(()=>state.calls.length).toBe(2);
 await page.getByRole("banner").getByRole("link",{name:"DMocks home",exact:true}).click();await expect(page).toHaveURL(/\/$/);held.resolve();await expect.poll(()=>state.completed).toBe(2);await expect(feed(page)).toHaveCount(0);
});

test("an account change discards the old feed and cannot append its held continuation",async({page})=>{
 const state=await fixture(page),held=deferred();state.holdMore=held;await more(page).click();await expect.poll(()=>state.calls.length).toBe(2);
 await seedPortalSession(page,{id:"00000000-0000-4000-8000-000000000802",email:"other-community-feed@example.invalid"});
 await page.evaluate(()=>{const key="sb-dmocks-portal-fixture-auth-token",channel=new BroadcastChannel(key);channel.postMessage({event:"SIGNED_IN",session:JSON.parse(localStorage.getItem(key))});channel.close();});
 await expect.poll(()=>state.calls.length).toBe(3);await expect(cards(page)).toHaveCount(25);
 const before=state.completed;held.resolve();await expect.poll(()=>state.completed).toBe(before+1);await expect(cards(page)).toHaveCount(25);
});

test("filters and loaded discussions remain keyboard accessible and reflow in both themes at 320px",async({page})=>{
 await fixture(page,{long:true});await page.setViewportSize({width:320,height:900});await filters(page).getByLabel("Topic filter",{exact:true}).fill("Topic".repeat(20));
 await filters(page).getByRole("button",{name:"Apply filters",exact:true}).press("Enter");await expect(cards(page)).toHaveCount(1);
 await page.addScriptTag({path:fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js",import.meta.url))});
 for(const dark of [false,true]){
  if(dark)await page.getByRole("switch",{name:"Dark mode",exact:true}).click();
  await expect(filters(page).getByRole("button",{name:"Apply filters",exact:true})).toHaveCSS("background-color",dark?"rgb(220, 235, 161)":"rgb(36, 71, 53)");
  expect(await page.evaluate(async()=> (await window.axe.run(".community-page",{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}})).violations.map(item=>item.id))).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
 }
});
