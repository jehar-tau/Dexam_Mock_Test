import {expect,test} from "@playwright/test";
import {emptyAdminRead,portalFixtureURL,seedPortalSession,stubPortalProvider} from "./portal-fixture.js";
import {orientationPages} from "./drawing-orientation-fixture.js";

test.use({baseURL:portalFixtureURL});
const admin={id:"00000000-0000-4000-8000-000000000991",email:"admin-access@example.invalid"};
const other={id:"00000000-0000-4000-8000-000000000992",email:"other-admin-access@example.invalid"};
const api="https://dmocks-portal-fixture.supabase.co",diagnostic="private-administrator-diagnostic";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
const denied=()=>({code:"42501",message:diagnostic});
const health=page=>page.getByRole("button",{name:"Refresh queues",exact:true});
const currentBug=page=>page.getByText("Current fictional private bug",{exact:true});
const heading=page=>page.getByRole("heading",{level:1,name:"Admin review.",exact:true});

async function fixture(page){
 const sample=(await orientationPages(6))[0],postId="66000000-0000-4000-8000-000000000991",imageId="77000000-0000-4000-8000-000000000991";
 const state={allowed:true,roleFailure:false,roleHold:null,roleChecks:0,roleCompleted:0,bugVersion:0,bugHolds:[],bugReads:0,bugCompleted:0,replyCalls:[],denyReply:false,denyLessons:false,bareLessonsStatus:null,
  mediaHold:null,mediaStatus:200,mediaCalls:0,mediaCompleted:0,intakeHold:null,intakeCalls:0,intakeCompleted:0};
 const target={id:postId,kind:"post",title:"Original fictional private discussion",body:"Complete original fictional private content for administrator access acceptance.",exam:"uceed",topic:"Observation",status:"visible",assets:[{id:imageId,ordinal:1,mimeType:sample.mimeType,width:sample.width,height:sample.height,orientation:sample.orientation,available:true}]};
 state.report = {status: "open", adminReply: "Saved fictional reply.", replyRevision: 0};
 state.saveReply = command => {
  state.report = {status: command.p_status, adminReply: command.p_reply || null, replyRevision: command.p_expected_revision + 1};
  return {reportId: command.p_id, requestId: command.p_request_id, ...state.report};
 };
 const bug = title => ({id: "55000000-0000-4000-8000-000000000991", title, description: "An original fictional private bug statement.",
  createdAt: "2026-11-06T12:00:00.123456Z", ...state.report});
 const provider=await stubPortalProvider(page,name=>{
  if(name==="is_dmocks_admin")return state.allowed;
  if(name==="admin_bug_report_page")return{items:[bug("Current fictional private bug")],nextCursor:null};
  if(name==="admin_question_intake_assets")return[{id:"88000000-0000-4000-8000-000000000991",name:"Original fictional source.pdf",status:"uploaded",byteSize:120,candidates:[]}];
  return emptyAdminRead(name);
 });
 await page.route(api+"/rest/v1/rpc/is_dmocks_admin",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers,status:204});
  state.roleChecks++;const result=state.allowed,hold=state.roleHold;if(hold)await hold.promise;
  try{await route.fulfill({headers,status:state.roleFailure?503:200,json:state.roleFailure?{message:diagnostic}:result});}catch{}state.roleCompleted++;
 });
 await page.route(api+"/rest/v1/rpc/admin_bug_report_page",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers,status:204});
  state.bugReads++;const version=state.bugVersion,hold=state.bugHolds[version],result=[bug(version===0?"Current fictional private bug":`Refreshed fictional private bug ${version}`)];
  if(hold)await hold.promise;
  try{await route.fulfill({headers,json:{items:result,nextCursor:null}});}catch{}state.bugCompleted++;
 });
 await page.route(api+"/rest/v1/rpc/admin_reply_bug_report",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers,status:204});
  const command = route.request().postDataJSON();
  state.replyCalls.push(command);
  await route.fulfill({headers,status:state.denyReply?400:200,json:state.denyReply?{code:"P0001",message:"Admin access required"}:state.saveReply(command)});
 });
 await page.route(api+"/rest/v1/rpc/admin_learning_lessons",route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers,status:204});
  if(state.bareLessonsStatus)return route.fulfill({headers,status:state.bareLessonsStatus,body:diagnostic});
  return route.fulfill({headers,status:state.denyLessons?403:200,json:state.denyLessons?denied():[]});
 });
 await page.route(api+"/rest/v1/rpc/admin_community_content_page",route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers,status:204});
  const input=route.request().postDataJSON();return route.fulfill({headers,json:{items:[{...target,postId,parentId:null,createdAt:"2020-01-01T00:00:00.123456+00:00",assetCount:1,comments:0}],nextCursor:null,snapshotAt:new Date().toISOString(),version:1,
   filters:{targetType:input.p_target_type,postId:input.p_post_id,exam:input.p_exam,topic:input.p_topic,status:input.p_status}}});
 });
 await page.route(api+"/rest/v1/rpc/admin_review_community_content",route=>route.request().method()==="OPTIONS"?route.fulfill({headers,status:204}):route.fulfill({headers,json:{targetType:"post",targetId:postId,reviewVersion:"a".repeat(64),canRestore:false,target,post:target,parent:null,history:[]}}));
 await page.route(api+"/functions/v1/community-media",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers,status:204});
  state.mediaCalls++;const held=state.mediaHold,status=state.mediaStatus;if(held)await held.promise;
  try{await route.fulfill({headers,status,json:status===200?{media:[{...target.assets[0],url:"https://admin-access-images.example.invalid/private.png"}],serverNow:"2020-01-01T00:00:00Z",expiresAt:"2020-01-01T00:05:00Z"}:{error:diagnostic}});}catch{}state.mediaCompleted++;
 });
 await page.route("https://admin-access-images.example.invalid/private.png",route=>route.fulfill({contentType:sample.mimeType,body:Buffer.from(sample.url.split(",")[1],"base64")}));
 await page.route(api+"/functions/v1/question-intake",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers,status:204});
  state.intakeCalls++;const held=state.intakeHold;if(held)await held.promise;
  try{await route.fulfill({headers,contentType:"application/octet-stream",body:Buffer.from("%PDF-1.4 original fictional private source")});}catch{}state.intakeCompleted++;
 });
 await page.goto("/account");await seedPortalSession(page,admin);await page.goto("/admin");
 await expect(currentBug(page)).toBeVisible({timeout:15000});
 return Object.assign(state,provider);
}

async function holdIdentity(page){
 const held=deferred();let reads=0;
 await page.route(api+'/auth/v1/user',async route=>{
  const cors={...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':headers['Access-Control-Allow-Headers']+', x-supabase-api-version'};
  if(route.request().method()==='OPTIONS')return route.fulfill({headers:cors,status:204});
  const token=route.request().headers().authorization.split(' ')[1],id=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub;reads++;await held.promise;
  try{await route.fulfill({headers:cors,json:{id,aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}}});}catch{}
 });
 return{release:held.resolve,reads:()=>reads};
}
const requestActor=request=>JSON.parse(Buffer.from(request.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub;

async function privacyFixture(page, count = 1) {
 const provider = await fixture(page);
 const requests = Array.from({length:count}, (_, index) => ({
  id: "30000000-0000-4000-8000-" + String(count - index).padStart(12, "0"),
  userId: "00000000-0000-4000-8000-000000003201", type: "account_deletion",
  status: index ? "cancelled" : "open", adminNote: null, reviewRevision: 0,
  createdAt: "2026-11-06T12:00:00.123456Z",
 }));
 const pageCalls = [];
 await page.route(api + "/rest/v1/rpc/admin_privacy_request_page", async route => {
  if (route.request().method() === "OPTIONS") return route.fulfill({headers,status:204});
  const input = route.request().postDataJSON();
  pageCalls.push(input);
  const items = input.p_cursor ? requests.slice(25) : requests.slice(0,25);
  const last = items.at(-1);
  const nextCursor = !input.p_cursor && count > 25
   ? {queue:"privacy",staffId:admin.id,id:last.id,createdAt:last.createdAt} : null;
  return route.fulfill({headers,json:{items,nextCursor}});
 });
 const queue = page.getByRole("region", {name:"Account privacy requests",exact:true});
 await health(page).click();
 await expect(queue.getByRole("article")).toHaveCount(Math.min(count,25));
 return {provider, queue, requests, pageCalls};
}

test("staff privacy requests page independently with keyboard focus at the queue", async ({page}) => {
 const {provider, queue, requests, pageCalls} = await privacyFixture(page, 26);
 await queue.getByRole("button", {name:"Next requests",exact:true}).press("Enter");
 await expect(queue.getByRole("article")).toHaveCount(1);
 await expect(queue.getByRole("heading")).toBeFocused();
 await expect(page.getByRole("region", {name:"Bug reports",exact:true}).getByRole("article")).toHaveCount(1);
 await queue.getByRole("button", {name:"Previous requests",exact:true}).press("Enter");
 await expect(queue.getByRole("article")).toHaveCount(25);
 expect(pageCalls).toEqual([null,{queue:"privacy",staffId:admin.id,id:requests[24].id,createdAt:requests[24].createdAt},null]
  .map(p_cursor => ({p_cursor,p_limit:25})));
 expect(provider.unexpected).toEqual([]);
});

test("a stale privacy decision requires a fresh read before another save", async ({page}) => {
 const {queue, requests} = await privacyFixture(page), calls = [];
 const form = queue.getByRole("form", {name:"Review privacy request",exact:true});
 const note = form.getByLabel("Operator action and retention note");
 const save = form.getByRole("button", {name:"Save privacy status",exact:true});
 await note.fill("Original fictional draft from an old view.");
 requests[0] = {...requests[0], status:"in_progress", adminNote:"Newer fictional note by a second operator.", reviewRevision:1};
 await page.route(api + "/rest/v1/rpc/admin_resolve_privacy_request", async route => {
  if (route.request().method() === "OPTIONS") return route.fulfill({headers,status:204});
  const command = route.request().postDataJSON();
  calls.push(command);
  if (command.p_expected_revision !== requests[0].reviewRevision) return route.fulfill({headers,status:409,json:{code:"40001",message:diagnostic}});
  requests[0] = {...requests[0],status:command.p_status,adminNote:command.p_note,reviewRevision:command.p_expected_revision+1};
  return route.fulfill({headers,json:{requestId:command.p_id,reviewRevision:requests[0].reviewRevision,status:command.p_status,adminNote:command.p_note}});
 });
 await save.click();
 await expect(queue.getByRole("alert")).toContainText("This request changed");
 await expect(note).toHaveValue("Original fictional draft from an old view.");
 await expect(save).toBeDisabled();
 await queue.getByRole("button", {name:"Refresh request",exact:true}).click();
 await expect(queue.getByText("Newer fictional note by a second operator.",{exact:true})).toBeVisible();
 await expect(note).toHaveValue("");
 await note.fill("Original fictional decision after verification.");
 await form.getByLabel("Privacy request status").selectOption("closed");
 await save.click();
 await expect(queue.getByRole("status")).toHaveText("Privacy decision saved.");
 await expect(form).toHaveCount(0);
 expect(calls.map(command => command.p_expected_revision)).toEqual([0,1]);
});

test("a lost privacy acknowledgement freezes edits until a read confirms the saved status", async ({page}) => {
 const {queue, requests} = await privacyFixture(page), calls = [];
 await page.route(api + "/rest/v1/rpc/admin_resolve_privacy_request", async route => {
  if (route.request().method() === "OPTIONS") return route.fulfill({headers,status:204});
  const command = route.request().postDataJSON();
  calls.push(command);
  requests[0] = {...requests[0],status:command.p_status,adminNote:command.p_note,reviewRevision:command.p_expected_revision+1};
  return route.abort();
 });
 const form = queue.getByRole("form", {name:"Review privacy request",exact:true});
 const note = form.getByLabel("Operator action and retention note");
 const saved = "Original fictional decision persisted before the reply was lost.";
 await note.fill(saved);
 await form.evaluate(element => { element.requestSubmit(); element.requestSubmit(); });
 await expect(queue.getByRole("alert")).toContainText("decision could not be confirmed");
 await expect(note).toBeDisabled();
 await queue.getByRole("button", {name:"Refresh request",exact:true}).click();
 await expect(queue.getByText(saved,{exact:true})).toBeVisible();
 await expect(note).toHaveValue("");
 await expect(note).toBeEnabled();
 expect(calls).toEqual([{p_id:requests[0].id,p_expected_revision:0,p_status:"in_progress",p_note:saved}]);
});

test("staff can page through a bounded report queue and return to the first page", async ({page}) => {
 const state = await fixture(page), calls = [];
 const reports = Array.from({length: 26}, (_, index) => ({
  id: "55000000-0000-4000-8000-" + String(26 - index).padStart(12, "0"),
  title: "Original fictional support report " + (26 - index),
  description: "A fictional report for bounded support review.",
  createdAt: "2026-11-06T12:00:00.123456Z",
  status: "open", adminReply: null, replyRevision: 0,
 }));
 const last = reports[24];
 const cursor = {staffId: admin.id, id: last.id, createdAt: last.createdAt};
 await page.route(api + "/rest/v1/rpc/admin_bug_report_page", async route => {
  if (route.request().method() === "OPTIONS") return route.fulfill({headers,status:204});
  const input = route.request().postDataJSON();
  calls.push(input);
  return route.fulfill({headers,json:input.p_cursor
   ? {items:reports.slice(25),nextCursor:null} : {items:reports.slice(0,25),nextCursor:cursor}});
 });
 const queue = page.getByRole("region", {name:"Bug reports",exact:true});
 await health(page).click();
 await expect(queue.getByRole("article")).toHaveCount(25);
 await expect(queue.getByText(last.title,{exact:true})).toBeVisible();
 await queue.getByRole("button", {name:"Next reports",exact:true}).press("Enter");
 await expect(queue.getByRole("article")).toHaveCount(1);
 await expect(queue.getByText(reports[25].title,{exact:true})).toBeVisible();
 await expect(queue.getByRole("button", {name:"Next reports",exact:true})).toHaveCount(0);
 await expect(queue.getByRole("heading", {name:"Bug reports",exact:true})).toBeFocused();
 await queue.getByRole("button", {name:"Previous reports",exact:true}).press("Enter");
 await expect(queue.getByRole("article")).toHaveCount(25);
 await expect(queue.getByText(reports[0].title,{exact:true})).toBeVisible();
 expect(calls).toEqual([null,cursor,null].map(p_cursor => ({p_cursor,p_limit:25})));
 expect(state.unexpected).toEqual([]);
});

test("one pending staff reply disables its fields and suppresses duplicate form submissions",async({page})=>{
 const state=await fixture(page),held=deferred();
 await page.route(api+"/rest/v1/rpc/admin_reply_bug_report",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({headers,status:204});
  const command = route.request().postDataJSON();
  state.replyCalls.push(command);
  await held.promise;
  try{await route.fulfill({headers,json:state.saveReply(command)});}catch{}
 });
 const form=page.getByRole("form",{name:"Reply to report Current fictional private bug",exact:true});
 await form.getByLabel("Report status",{exact:true}).selectOption("fixed");await form.getByLabel("Reply to reporter",{exact:true}).fill("An original fictional fixed-issue reply.");
 await form.evaluate(element=>{element.requestSubmit();element.requestSubmit();});await expect.poll(()=>state.replyCalls.length).toBe(1);
 await expect(form.getByLabel("Report status",{exact:true})).toBeDisabled();await expect(form.getByLabel("Reply to reporter",{exact:true})).toBeDisabled();await expect(form.getByRole("button",{name:"Saving…",exact:true})).toBeDisabled();
 held.resolve();
 await expect(form.getByRole("button",{name:"Save",exact:true})).toBeEnabled();
 expect(state.replyCalls).toEqual([{p_id:"55000000-0000-4000-8000-000000000991",p_expected_revision:0,p_status:"fixed",
  p_reply:"An original fictional fixed-issue reply.",p_request_id:expect.stringMatching(/^[0-9a-f-]{36}$/)}]);
 expect(state.unexpected).toEqual([]);
});

test("a stale staff reply keeps its draft until the current report is reviewed", async ({page}) => {
 const state = await fixture(page), report = page.getByRole("region", {name: "Bug reports", exact: true});
 const form = report.getByRole("form", {name: "Reply to report Current fictional private bug", exact: true});
 await form.getByLabel("Reply to reporter").fill("Original draft from an earlier view");
 state.report = {status: "fixed", adminReply: "Newer response already saved", replyRevision: 1};
 await page.route(api + "/rest/v1/rpc/admin_reply_bug_report", async route => {
  if (route.request().method() === "OPTIONS") return route.fulfill({headers,status:204});
  const command = route.request().postDataJSON();
  state.replyCalls.push(command);
  if (command.p_expected_revision !== state.report.replyRevision) {
   return route.fulfill({headers,status:409,json:{code:"40001",message:diagnostic}});
  }
  return route.fulfill({headers,json:state.saveReply(command)});
 });
 await form.getByRole("button", {name:"Save",exact:true}).click();
 await expect(report.getByRole("alert")).toContainText("This report changed");
 await expect(form.getByLabel("Reply to reporter")).toHaveValue("Original draft from an earlier view");
 await expect(form.getByRole("button", {name:"Save",exact:true})).toBeDisabled();
 await report.getByRole("button", {name:"Refresh report",exact:true}).click();
 await expect(form.getByLabel("Reply to reporter")).toHaveValue("Newer response already saved");
 await form.getByLabel("Reply to reporter").fill("Reviewed follow-up");
 await form.getByRole("button", {name:"Save",exact:true}).click();
 await expect(report.getByRole("status")).toHaveText("Reply saved.");
 expect(state.replyCalls.map(command => command.p_expected_revision)).toEqual([0,1]);
 expect(state.replyCalls[0].p_request_id).not.toBe(state.replyCalls[1].p_request_id);
});

test("an unknown staff reply result retries only the exact saved command", async ({page}) => {
 const state = await fixture(page), report = page.getByRole("region", {name:"Bug reports",exact:true});
 const form = report.getByRole("form", {name:"Reply to report Current fictional private bug",exact:true});
 const reference = report.getByRole("article").getByText("Report reference 55000000-0000-4000-8000-000000000991", {exact:true});
 await expect(reference).toBeVisible();
 let receipt;
 await page.route(api + "/rest/v1/rpc/admin_reply_bug_report", async route => {
  if (route.request().method() === "OPTIONS") return route.fulfill({headers,status:204});
  const command = route.request().postDataJSON();
  state.replyCalls.push(command);
  if (!receipt) {
   receipt = state.saveReply(command);
   return route.abort();
  }
  return route.fulfill({headers,json:receipt});
 });
 await form.getByLabel("Reply to reporter").fill("Fictional reply saved before the response was lost");
 await form.getByRole("button", {name:"Save",exact:true}).click();
 await expect(report.getByRole("alert")).toContainText("reply could not be confirmed");
 await expect(form.getByLabel("Reply to reporter")).toBeDisabled();
 await report.getByRole("button", {name:"Retry same reply",exact:true}).click();
 await expect(report.getByRole("status")).toHaveText("Reply saved.");
 expect(state.replyCalls).toHaveLength(2);
 expect(state.replyCalls[0]).toEqual(state.replyCalls[1]);
 await expect(reference).toBeVisible();
 expect(state.unexpected).toEqual([]);
});

test("an unannounced SDK token change cannot send a private administrator reply as another actor",async({page})=>{
 const state=await fixture(page),form=page.getByRole('form',{name:'Reply to report Current fictional private bug',exact:true});await form.getByLabel('Reply to reporter',{exact:true}).fill('An original fictional reply from the first administrator');await seedPortalSession(page,other);await form.getByRole('button',{name:'Save',exact:true}).press('Enter');await expect(page.getByRole('alert')).toContainText('Administrator access could not be verified');await expect(page.getByText('Current fictional private bug',{exact:true})).toHaveCount(0);expect(state.replyCalls).toEqual([]);
});

test("an unannounced SDK token change cannot fetch a private source through the administrator Edge client",async({page})=>{
 const state=await fixture(page);let downloads=0;page.on('download',download=>{downloads++;void download.cancel();});await seedPortalSession(page,other);await page.getByRole('button',{name:'Download private source',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Administrator access could not be verified');expect(state.intakeCalls).toBe(0);expect(downloads).toBe(0);await expect(page.getByText('Original fictional source.pdf',{exact:true})).toHaveCount(0);
});

test('administrator RPC dispatch stays pinned when the SDK token changes after verification',async({page})=>{
 const state=await fixture(page),actors=[],form=page.getByRole('form',{name:'Reply to report Current fictional private bug',exact:true});await form.getByLabel('Reply to reporter',{exact:true}).fill('An original fictional actor-pinned administrator reply');await page.waitForLoadState('networkidle');
 const identity=await holdIdentity(page);await page.route(api+'/rest/v1/rpc/admin_reply_bug_report',async route=>{if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});actors.push(requestActor(route.request()));const command=route.request().postDataJSON();state.replyCalls.push(command);return route.fulfill({headers,json:state.saveReply(command)});});
 await form.evaluate(element=>element.requestSubmit());await expect.poll(identity.reads).toBe(1);expect(actors).toEqual([]);await seedPortalSession(page,other);identity.release();await expect.poll(()=>actors).toEqual([admin.id]);expect(state.replyCalls).toHaveLength(1);await expect(page.getByRole('alert')).toContainText('Administrator access could not be verified');expect(state.unexpected).toEqual([]);
});

test('administrator Edge dispatch stays pinned when the SDK token changes after verification',async({page})=>{
 const state=await fixture(page),actors=[];let downloads=0;page.on('download',download=>{downloads++;void download.cancel();});await page.waitForLoadState('networkidle');const identity=await holdIdentity(page);
 await page.route(api+'/functions/v1/question-intake',async route=>{if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});actors.push(requestActor(route.request()));state.intakeCalls++;return route.fulfill({headers,contentType:'application/octet-stream',body:Buffer.from('%PDF-1.4 original fictional private source')});});
 await page.getByRole('button',{name:'Download private source',exact:true}).evaluate(button=>button.click());await expect.poll(identity.reads).toBe(1);expect(actors).toEqual([]);await seedPortalSession(page,other);identity.release();await expect.poll(()=>actors).toEqual([admin.id]);await expect.poll(()=>downloads).toBe(1);expect(state.intakeCalls).toBe(1);
 await page.getByRole('button',{name:'Download private source',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Administrator access could not be verified');expect(actors).toEqual([admin.id]);expect(state.intakeCalls).toBe(1);expect(downloads).toBe(1);
});

test("a confirmed role loss clears every private panel, selected file and unsent draft",async({page})=>{
 const state=await fixture(page),roleChecks=state.roleChecks;
 await page.getByText("Add a theory lesson",{exact:true}).click();await page.getByLabel("Lesson URL slug",{exact:true}).fill("unsent-private-lesson");
 await page.getByLabel("Private source file",{exact:true}).setInputFiles({name:"original-fictional-question.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4 fictional private fixture")});
 state.allowed=false;state.denyLessons=true;await page.getByRole("button",{name:"Refresh lesson list",exact:true}).click();
 await expect(page.getByRole("alert").filter({hasText:"Administrator access has ended"})).toBeVisible();
 await expect(page.getByText("Current fictional private bug",{exact:true})).toHaveCount(0);await expect(page.getByRole("heading",{name:"Theory lessons",exact:true})).toHaveCount(0);
 await expect(page.getByLabel("Private source file",{exact:true})).toHaveCount(0);await expect(page.getByLabel("Lesson URL slug",{exact:true})).toHaveCount(0);await expect(page.getByRole("dialog")).toHaveCount(0);await expect(heading(page)).toBeFocused();
 await expect(page.locator("#root")).not.toContainText(diagnostic);expect(state.roleChecks).toBe(roleChecks+1);
});

test("a bare RPC authorization failure rechecks the role without needing a SQL error code",async({page})=>{
 const state=await fixture(page),checks=state.roleChecks;state.allowed=false;state.bareLessonsStatus=401;
 await page.getByRole("button",{name:"Refresh lesson list",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:"Administrator access has ended"})).toBeVisible();
 await expect(page.getByText("Current fictional private bug",{exact:true})).toHaveCount(0);await expect(heading(page)).toBeFocused();expect(state.roleChecks).toBe(checks+1);await expect(page.locator("#root")).not.toContainText(diagnostic);
});

test("an older bulk response cannot replace a newer refresh or reopen a revoked workspace",async({page})=>{
 const state=await fixture(page),older=deferred(),reads=state.bugReads;state.bugHolds[1]=older;state.bugVersion=1;
 await health(page).click();await expect.poll(()=>state.bugReads).toBe(reads+1);state.bugVersion=2;await health(page).click();await expect(page.getByText("Refreshed fictional private bug 2",{exact:true})).toBeVisible();
 older.resolve();await expect.poll(()=>state.bugCompleted).toBe(reads+2);await expect(page.getByText("Refreshed fictional private bug 2",{exact:true})).toBeVisible();await expect(page.getByText("Refreshed fictional private bug 1",{exact:true})).toHaveCount(0);
 state.allowed=false;state.denyLessons=true;await page.getByRole("button",{name:"Refresh lesson list",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:"Administrator access has ended"})).toBeVisible();await expect(page.getByText("Refreshed fictional private bug 2",{exact:true})).toHaveCount(0);
});

test("an unavailable target rechecks the role and preserves other permitted panels and drafts",async({page})=>{
 const state=await fixture(page),checks=state.roleChecks;
 await page.getByText("Add a theory lesson",{exact:true}).click();await page.getByLabel("Lesson URL slug",{exact:true}).fill("another-private-draft");
 state.denyReply=true;const form=page.getByRole("article").filter({has:page.getByText("Current fictional private bug",{exact:true})}).locator("form");
 await form.getByPlaceholder("Reply to reporter",{exact:true}).fill("A distinct unsent fictional response.");await form.getByRole("button",{name:"Save",exact:true}).click();
 await expect(page.getByRole("alert").filter({hasText:"This item is unavailable"})).toBeVisible();
 await expect(currentBug(page)).toBeVisible({timeout:15000});await expect(page.getByLabel("Lesson URL slug",{exact:true})).toHaveValue("another-private-draft");
 await expect(form.getByPlaceholder("Reply to reporter",{exact:true})).toHaveValue("A distinct unsent fictional response.");expect(state.roleChecks).toBe(checks+1);expect(state.replyCalls).toHaveLength(1);await expect(page.locator("#root")).not.toContainText(diagnostic);
});

test("bare Edge denial confirms role loss and clears the whole desk and private image dialog",async({page})=>{
 const state=await fixture(page);
 await page.getByRole("button",{name:"Browse Community content",exact:true}).click();await page.getByRole("button",{name:"Review discussion",exact:true}).click();
 const review=page.getByRole("region",{name:"Community content review",exact:true});await review.getByRole("button",{name:"Open moderation images",exact:true}).click();
 await expect(review.getByRole("img")).toBeVisible();await review.getByRole("button",{name:"Inspect selected discussion attachment 1",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();
 await page.keyboard.press("Escape");state.allowed=false;state.mediaStatus=403;await review.getByRole("button",{name:"Refresh moderation images",exact:true}).click();
 await expect(page.getByRole("alert").filter({hasText:"Administrator access has ended"})).toBeVisible();await expect(page.getByRole("dialog")).toHaveCount(0);await expect(review).toHaveCount(0);await expect(page.getByText("Current fictional private bug",{exact:true})).toHaveCount(0);
 await expect(heading(page)).toBeFocused();expect(state.mediaCalls).toBe(2);await expect(page.locator("#root")).not.toContainText(diagnostic);
});

test("a role-check timeout closes cached access and an explicit retry ignores the old success",async({page})=>{
 await page.clock.install({time:new Date()});const state=await fixture(page),held=deferred(),checks=state.roleChecks;state.roleHold=held;
 await page.getByRole("button",{name:"Recheck administrator access",exact:true}).click();await expect.poll(()=>state.roleChecks).toBe(checks+1);await page.clock.runFor(10020);
 await expect(page.getByRole("alert").filter({hasText:"could not be verified"})).toBeVisible();await expect(page.getByText("Current fictional private bug",{exact:true})).toHaveCount(0);await expect(heading(page)).toBeFocused();
 state.roleHold=null;state.bugVersion=2;await page.getByRole("button",{name:"Check administrator access",exact:true}).click();await expect(page.getByText("Refreshed fictional private bug 2",{exact:true})).toBeVisible();
 // Recovery checks the new scope both before loading the desk and before showing its data.
 held.resolve();await expect.poll(()=>state.roleCompleted).toBe(checks+3);await expect(page.getByText("Refreshed fictional private bug 2",{exact:true})).toBeVisible();await expect(page.getByRole("alert")).toHaveCount(0);expect(state.roleChecks).toBe(checks+3);
});

test("visible polling and focus restoration share a check and close a revoked idle desk",async({page})=>{
 await page.clock.install({time:new Date()});const state=await fixture(page),checks=state.roleChecks;
 await page.clock.runFor(60020);await expect.poll(()=>state.roleChecks).toBe(checks+1);await expect(currentBug(page)).toBeVisible({timeout:15000});
 const held=deferred();state.roleHold=held;state.allowed=false;
 await page.evaluate(()=>{for(let n=0;n<4;n++){dispatchEvent(new Event("focus"));document.dispatchEvent(new Event("visibilitychange"));}});
 await expect.poll(()=>state.roleChecks).toBe(checks+2);held.resolve();await expect(page.getByRole("alert").filter({hasText:"Administrator access has ended"})).toBeVisible();
 await expect(page.getByText("Current fictional private bug",{exact:true})).toHaveCount(0);expect(state.roleChecks).toBe(checks+2);
});

test("revocation cancels an already requested private download and retry never resends the earlier action",async({page})=>{
 const state=await fixture(page),held=deferred();let downloads=0;page.on("download",()=>downloads++);state.intakeHold=held;
 await page.getByRole("button",{name:"Download private source",exact:true}).click();await expect.poll(()=>state.intakeCalls).toBe(1);state.allowed=false;
 await page.getByRole("button",{name:"Recheck administrator access",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:"Administrator access has ended"})).toBeVisible();
 held.resolve();await expect.poll(()=>state.intakeCompleted).toBe(1);expect(downloads).toBe(0);
 state.allowed=true;await page.getByRole("button",{name:"Check administrator access",exact:true}).click();await expect(currentBug(page)).toBeVisible({timeout:15000});expect(state.intakeCalls).toBe(1);
 state.allowed=false;state.denyReply=true;const form=page.getByRole("article").filter({has:page.getByText("Current fictional private bug",{exact:true})}).locator("form");
 await form.getByPlaceholder("Reply to reporter",{exact:true}).fill("A denied fictional response must never be resent.");await form.getByRole("button",{name:"Save",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:"Administrator access has ended"})).toBeVisible();
 state.allowed=true;state.denyReply=false;await page.getByRole("button",{name:"Check administrator access",exact:true}).click();await expect(currentBug(page)).toBeVisible({timeout:15000});expect(state.replyCalls).toHaveLength(1);
 await expect(form.getByPlaceholder("Reply to reporter",{exact:true})).toHaveValue("Saved fictional reply.");
});

test("account, same-route history and navigation invalidate pending old private results",async({page})=>{
 const state=await fixture(page),held=deferred(),reads=state.bugReads;state.bugHolds[1]=held;state.bugVersion=1;
 await health(page).click();await expect.poll(()=>state.bugReads).toBe(reads+1);state.bugVersion=2;
 await seedPortalSession(page,other);await page.evaluate(()=>{const key="sb-dmocks-portal-fixture-auth-token",channel=new BroadcastChannel(key);channel.postMessage({event:"SIGNED_IN",session:JSON.parse(localStorage.getItem(key))});channel.close();});
 await expect(page.getByText("Refreshed fictional private bug 2",{exact:true})).toBeVisible();held.resolve();await expect.poll(()=>state.bugCompleted).toBe(reads+2);await expect(page.getByText("Refreshed fictional private bug 1",{exact:true})).toHaveCount(0);
 await page.getByText("Add a theory lesson",{exact:true}).click();await page.getByLabel("Lesson URL slug",{exact:true}).fill("old-history-private-draft");
 await page.getByLabel("Private source file",{exact:true}).setInputFiles({name:"history-private.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4 fictional")});
 await page.evaluate(()=>{history.pushState({...history.state,key:"new-fictional-whole-admin-entry"},"",location.href);dispatchEvent(new PopStateEvent("popstate",{state:history.state}));});
 await expect(page.getByText("Refreshed fictional private bug 2",{exact:true})).toBeVisible();await expect(page.getByLabel("Lesson URL slug",{exact:true})).toHaveValue("");await expect(page.getByLabel("Lesson URL slug",{exact:true})).not.toBeVisible();expect(await page.getByLabel("Private source file",{exact:true}).evaluate(input=>input.files.length)).toBe(0);
 const media=deferred();state.mediaHold=media;await page.getByRole("button",{name:"Browse Community content",exact:true}).click();await page.getByRole("button",{name:"Review discussion",exact:true}).click();await page.getByRole("button",{name:"Open moderation images",exact:true}).click();await expect.poll(()=>state.mediaCalls).toBe(1);
 await page.getByRole("banner").getByRole("link",{name:"DMocks home",exact:true}).click();media.resolve();await expect.poll(()=>state.mediaCompleted).toBe(1);await expect(page).toHaveURL(/\/$/);await expect(page.getByRole("region",{name:"Administrator access",exact:true})).toHaveCount(0);await expect(page.getByRole("dialog")).toHaveCount(0);await expect(page.locator("img[src*='admin-access-images']")).toHaveCount(0);
});

test("an account change cancels a pending private download before mounting the next desk",async({page})=>{
 const state=await fixture(page),held=deferred();let downloads=0;page.on("download",()=>downloads++);state.intakeHold=held;
 await page.getByRole("button",{name:"Download private source",exact:true}).click();await expect.poll(()=>state.intakeCalls).toBe(1);
 state.bugVersion=2;await seedPortalSession(page,other);await page.evaluate(()=>{const key="sb-dmocks-portal-fixture-auth-token",channel=new BroadcastChannel(key);channel.postMessage({event:"SIGNED_IN",session:JSON.parse(localStorage.getItem(key))});channel.close();});
 await expect(page.getByText("Refreshed fictional private bug 2",{exact:true})).toBeVisible();held.resolve();await expect.poll(()=>state.intakeCompleted).toBe(1);expect(downloads).toBe(0);expect(state.intakeCalls).toBe(1);await expect(page.getByRole("alert")).toHaveCount(0);
});

test("failed role verification shows a safe keyboard recovery in both themes at 320px",async({page})=>{
 const state=await fixture(page);await page.setViewportSize({width:320,height:740});state.roleFailure=true;
 await page.getByRole("button",{name:"Recheck administrator access",exact:true}).press("Enter");await expect(page.getByRole("alert").filter({hasText:"could not be verified"})).toBeVisible();await expect(heading(page)).toBeFocused();
 await page.addScriptTag({path:"node_modules/axe-core/axe.min.js"});
 for(const dark of[false,true]){
  if(dark)await page.getByRole("switch",{name:"Dark mode",exact:true}).click();
  expect(await page.evaluate(async()=>(await window.axe.run('[aria-label="Administrator access"]',{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}})).violations.map(item=>item.id))).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=320)).toBe(true);
 }
 state.roleFailure=false;await page.getByRole("button",{name:"Check administrator access",exact:true}).press("Enter");await expect(currentBug(page)).toBeVisible({timeout:15000});await expect(heading(page)).toBeFocused();await expect(page.locator("#root")).not.toContainText(diagnostic);expect(state.unexpected).toEqual([]);
});
