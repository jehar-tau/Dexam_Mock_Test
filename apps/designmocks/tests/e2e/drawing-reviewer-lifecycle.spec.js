import {expect,test} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {portalFixtureURL,seedPortalSession,stubPortalProvider} from "./portal-fixture.js";

test.use({baseURL:portalFixtureURL});
const actor={id:"00000000-0000-4000-8000-000000001001",email:"reviewer-lifecycle@example.invalid"};
const api="https://dmocks-portal-fixture.supabase.co";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
const prompt="Original fictional private drawing review context.";
const card=(page,text=prompt)=>page.getByRole("region",{name:"Drawing review queue",exact:true}).getByRole("article").filter({has:page.getByText(text,{exact:true})});
const secondPrompt="Another original fictional private drawing review.";
const anotherActor={id:'00000000-0000-4000-8000-000000001003',email:'fictional-another-reviewer@example.invalid'};

async function fixture(page,{two=false}={}){
 const bytes=await readFile(new URL("../fixtures/drawing-images/fictional-drawing.png",import.meta.url));
 const drawing={reviewId:"99000000-0000-4000-8000-000000001001",version:1,status:"assigned",prompt,uploadCount:1,canClaim:false,canReview:true,assignedToMe:true,maxScore:20,criteria:{Clarity:12},comments:"Original fictional saved teacher feedback.",score:12};
 const drawings=[drawing,...(two?[{...drawing,reviewId:"99000000-0000-4000-8000-000000001002",prompt:"Another original fictional private drawing review."}]:[])];
 const state={allowed:true,roleFailure:false,hold:null,readCalls:0,completedReads:0,actions:[],actionHold:null,actionSuccess:false,actionError:null,completedActions:0,mediaHold:null,mediaStatus:200,mediaCalls:0,completedMedia:0};
 const provider=await stubPortalProvider(page,name=>{
  if(name==="can_review_drawings")return state.roleFailure?{code:"fixture-role-unavailable",message:"Private diagnostic must not render"}:state.allowed;
  if(name==="is_dmocks_admin")return false;
 });
 await page.route(api+"/rest/v1/rpc/my_drawing_review_page",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers,status:204});
  state.readCalls++;const input=route.request().postDataJSON(),held=state.hold,status=state.allowed?200:403,value=state.allowed?{items:input.p_scope==="mine"?structuredClone(drawings):[],nextCursor:null}:{code:"42501",message:"Drawing reviewer access required"};
  if(held)await held.promise;
  try{await route.fulfill({headers,status,json:value});}catch{}state.completedReads++;
 });
 await page.route(api+"/rest/v1/rpc/admin_review_drawing",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers,status:204});
  state.actions.push(route.request().postDataJSON());const held=state.actionHold;if(held)await held.promise;
  try{await route.fulfill({headers,status:state.actionSuccess?200:state.actionError?400:403,json:state.actionSuccess?null:state.actionError??{code:"42501",message:"Drawing reviewer access required"}});}catch{}state.completedActions++;
 });
 await page.route(api+"/functions/v1/drawing-review-media",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers,status:204});
  state.mediaCalls++;const held=state.mediaHold,status=state.mediaStatus;if(held)await held.promise;
  try{await route.fulfill({headers,status,json:status===200?{images:[{id:"original-fictional-page",ordinal:1,url:`data:image/png;base64,${bytes.toString("base64")}`}],serverNow:"2020-01-01T00:00:00Z",expiresAt:"2020-01-01T00:05:00Z"}:{error:"Private diagnostic must not render"}});}catch{}state.completedMedia++;
 });
 await page.goto("/account");await seedPortalSession(page,actor);await page.goto("/review/drawings");await page.getByRole("button",{name:"My reviews",exact:true}).click();await expect(page.getByText(prompt,{exact:true})).toBeVisible();
 return Object.assign(state,provider);
}

test("an older authorized refresh cannot revive private drawing context after a newer denial",async({page})=>{
 const state=await fixture(page),held=deferred(),reads=state.readCalls;state.hold=held;
 await page.getByRole("button",{name:"Refresh drawing reviews",exact:true}).click();await expect.poll(()=>state.readCalls).toBe(reads+1);
 state.allowed=false;await page.getByLabel("Mark 1",{exact:true}).fill("17");await page.getByLabel("Feedback").fill("An unsent fictional review must stay private after access ends.");await page.getByRole("button",{name:"Save human review",exact:true}).click();
 await expect(page.getByText(prompt,{exact:true})).toHaveCount(0);held.resolve();await expect.poll(()=>state.completedReads).toBe(reads+1);
 await expect(page.getByText(prompt,{exact:true})).toHaveCount(0);await expect(page.getByLabel("Feedback")).toHaveCount(0);expect(state.actions).toHaveLength(1);
});

test("an unannounced SDK token change cannot send the previous teacher grading draft",async({page})=>{
 const state=await fixture(page);await page.getByLabel('Mark 1',{exact:true}).fill('17');await page.getByLabel('Feedback').fill('Original fictional feedback from the first reviewer');await seedPortalSession(page,anotherActor);await page.getByRole('button',{name:'Save human review',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Drawing reviewer access could not be verified');await expect(page.getByLabel('Feedback')).toHaveCount(0);expect(state.actions).toEqual([]);
});

test("same-route history navigation clears private teacher images and grading drafts",async({page})=>{
 await fixture(page);await page.getByLabel("Feedback").fill("A private unsent draft from the older history entry.");
 await page.getByRole("button",{name:"Open private images",exact:true}).click();await expect(page.getByRole("img",{name:"Anonymous drawing page 1",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Inspect page 1, anonymous drawing",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();
 await page.evaluate(()=>{history.pushState({...history.state,key:"new-fictional-teacher-entry"},"",location.href);dispatchEvent(new PopStateEvent("popstate",{state:history.state}));});
 await expect(page.getByRole("dialog")).toHaveCount(0);await expect(page.getByRole("img",{name:"Anonymous drawing page 1",exact:true})).toHaveCount(0);await expect(page.getByLabel("Feedback")).toHaveCount(0);
});

test("an assignment denial removes only that review and invalidates an older queue response",async({page})=>{
 const state=await fixture(page,{two:true}),held=deferred(),reads=state.readCalls;state.hold=held;
 await card(page,secondPrompt).getByLabel("Feedback").fill("Another permitted unsent fictional grading draft.");
 await page.getByRole("button",{name:"Refresh drawing reviews",exact:true}).click();await expect.poll(()=>state.readCalls).toBe(reads+1);
 state.actionError={code:"P0001",message:"Review unavailable"};await card(page).getByRole("button",{name:"Save human review",exact:true}).click();
 await expect(card(page)).toHaveCount(0);await expect(card(page,secondPrompt).getByLabel("Feedback")).toHaveValue("Another permitted unsent fictional grading draft.");
 held.resolve();await expect.poll(()=>state.completedReads).toBe(reads+1);await expect(card(page)).toHaveCount(0);await expect(card(page,secondPrompt).getByLabel("Feedback")).toHaveValue("Another permitted unsent fictional grading draft.");
 await expect(page.getByRole("heading",{name:"My drawing reviews",exact:true})).toBeFocused();expect(state.actions).toHaveLength(1);
});

test("bare Edge role denial clears private reviews and explicit recovery starts with saved work",async({page})=>{
 const state=await fixture(page);await page.getByLabel("Feedback").fill("An unsent fictional draft that must clear with access.");
 await page.getByRole("button",{name:"Open private images",exact:true}).click();await page.getByRole("button",{name:"Inspect page 1, anonymous drawing",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();await page.keyboard.press("Escape");
 state.allowed=false;state.mediaStatus=403;await page.getByRole("button",{name:"Refresh private images",exact:true}).click();
 await expect(page.getByRole("alert")).toContainText("Drawing reviewer access has ended");await expect(page.getByLabel("Feedback")).toHaveCount(0);await expect(page.getByRole("dialog")).toHaveCount(0);await expect(page.getByRole("heading",{level:1,name:"Drawing reviews.",exact:true})).toBeFocused();
 state.allowed=true;state.mediaStatus=200;await page.getByRole("button",{name:"Check drawing reviewer access",exact:true}).click();await expect(page.getByRole("button",{name:"Available drawings",exact:true})).toBeVisible();await expect(page.getByLabel("Feedback")).toHaveCount(0);
 await page.getByRole("button",{name:"My reviews",exact:true}).click();await expect(page.getByLabel("Feedback")).toHaveValue("Original fictional saved teacher feedback.");expect(state.actions).toEqual([]);await expect(page.locator("#root")).not.toContainText("Private diagnostic must not render");
});

test("failed role verification clears cached teacher context and never retries a grade",async({page})=>{
 const state=await fixture(page);await page.getByLabel("Feedback").fill("A private draft before a failed verification.");state.roleFailure=true;
 await page.getByRole("button",{name:"Recheck drawing reviewer access",exact:true}).click();await expect(page.getByRole("alert")).toContainText("could not be verified");await expect(page.getByLabel("Feedback")).toHaveCount(0);await expect(page.getByText(prompt,{exact:true})).toHaveCount(0);
 state.roleFailure=false;await page.getByRole("button",{name:"Check drawing reviewer access",exact:true}).click();await page.getByRole("button",{name:"My reviews",exact:true}).click();await expect(page.getByLabel("Feedback")).toHaveValue("Original fictional saved teacher feedback.");expect(state.actions).toEqual([]);await expect(page.locator("#root")).not.toContainText("Private diagnostic must not render");
});

test("account and queue changes fence late actions and images without redirecting the newer view",async({page})=>{
 const state=await fixture(page),held=deferred();state.actionHold=held;state.actionSuccess=true;
 await page.getByLabel("Feedback").fill("An old account grading draft must not change the new view.");await page.getByRole("button",{name:"Save human review",exact:true}).click();await expect.poll(()=>state.actions.length).toBe(1);
 await seedPortalSession(page,{id:"00000000-0000-4000-8000-000000001003",email:"other-reviewer-lifecycle@example.invalid"});await page.evaluate(()=>{const key="sb-dmocks-portal-fixture-auth-token",channel=new BroadcastChannel(key);channel.postMessage({event:"SIGNED_IN",session:JSON.parse(localStorage.getItem(key))});channel.close();});
 await expect(page.getByRole("button",{name:"Available drawings",exact:true})).toHaveAttribute("aria-pressed","true");held.resolve();await expect.poll(()=>state.completedActions).toBe(1);await expect(page.getByRole("button",{name:"Available drawings",exact:true})).toHaveAttribute("aria-pressed","true");await expect(page.getByLabel("Feedback")).toHaveCount(0);
 await page.getByRole("button",{name:"My reviews",exact:true}).click();await expect(page.getByLabel("Feedback")).toHaveValue("Original fictional saved teacher feedback.");
 const media=deferred();state.mediaHold=media;await page.getByRole("button",{name:"Open private images",exact:true}).click();await expect.poll(()=>state.mediaCalls).toBe(1);
 await page.getByRole("button",{name:"Available drawings",exact:true}).click();media.resolve();await expect.poll(()=>state.completedMedia).toBe(1);await expect(page.getByRole("img",{name:"Anonymous drawing page 1",exact:true})).toHaveCount(0);await expect(page.getByRole("dialog")).toHaveCount(0);expect(state.actions).toHaveLength(1);
});

test("choosing the same queue starts a new scope and a late action preserves its newer draft",async({page})=>{
 const state=await fixture(page),held=deferred();state.actionHold=held;state.actionSuccess=true;
 await page.getByLabel("Feedback").fill("An older fictional draft for a held action.");await page.getByRole("button",{name:"Save human review",exact:true}).click();await expect.poll(()=>state.actions.length).toBe(1);
 await page.getByRole("button",{name:"My reviews",exact:true}).click();await expect(page.getByLabel("Feedback")).toHaveValue("Original fictional saved teacher feedback.");await page.getByLabel("Feedback").fill("A newer explicit queue choice must keep this draft.");const reads=state.readCalls;
 held.resolve();await expect.poll(()=>state.completedActions).toBe(1);await expect(page.getByLabel("Feedback")).toHaveValue("A newer explicit queue choice must keep this draft.");expect(state.readCalls).toBe(reads);await expect(page.getByText("Grade and feedback saved.",{exact:true})).toHaveCount(0);expect(state.actions).toHaveLength(1);
});

test("visible role checks close an open inspector and support keyboard recovery in both themes at 320px",async({page})=>{
 await page.clock.install({time:new Date()});const state=await fixture(page);
 await page.getByRole("button",{name:"Open private images",exact:true}).click();await page.getByRole("button",{name:"Inspect page 1, anonymous drawing",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();state.allowed=false;
 await page.clock.runFor(60020);await expect(page.getByRole("alert")).toContainText("Drawing reviewer access has ended");await expect(page.getByRole("dialog")).toHaveCount(0);await expect(page.getByLabel("Feedback")).toHaveCount(0);await expect(page.getByRole("heading",{level:1,name:"Drawing reviews.",exact:true})).toBeFocused();
 const checks=state.calls.filter(([name])=>name==="can_review_drawings").length;state.allowed=true;await page.clock.runFor(60020);expect(state.calls.filter(([name])=>name==="can_review_drawings")).toHaveLength(checks);await expect(page.getByRole("alert")).toContainText("Drawing reviewer access has ended");
 await page.setViewportSize({width:320,height:740});await page.addScriptTag({path:"node_modules/axe-core/axe.min.js"});
 for(const dark of[false,true]){
  if(dark)await page.getByRole("switch",{name:"Dark mode",exact:true}).click();
  expect(await page.evaluate(async()=>(await window.axe.run('[aria-label="Drawing reviewer access"]',{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}})).violations.map(item=>item.id))).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=320)).toBe(true);
 }
 await page.getByRole("button",{name:"Check drawing reviewer access",exact:true}).press("Enter");await expect(page.getByRole("button",{name:"My reviews",exact:true})).toBeVisible();await expect(page.getByRole("heading",{level:1,name:"Drawing reviews.",exact:true})).toBeFocused();await page.getByRole("button",{name:"My reviews",exact:true}).click();await expect(page.getByText(prompt,{exact:true})).toBeVisible();expect(state.actions).toEqual([]);
});

test("a signing denial for one assigned submission retains other permitted grading drafts",async({page})=>{
 const state=await fixture(page,{two:true});await card(page,secondPrompt).getByLabel("Feedback").fill("Keep another permitted private grading draft.");state.mediaStatus=403;
 await card(page).getByRole("button",{name:"Open private images",exact:true}).click();await expect(card(page)).toHaveCount(0);await expect(card(page,secondPrompt).getByLabel("Feedback")).toHaveValue("Keep another permitted private grading draft.");await expect(page.getByRole("heading",{name:"My drawing reviews",exact:true})).toBeFocused();expect(state.actions).toEqual([]);await expect(page.locator("#root")).not.toContainText("Private diagnostic must not render");
});
