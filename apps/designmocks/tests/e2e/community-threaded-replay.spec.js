import {expect,test} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {portalFixtureURL,seedPortalSession} from "./portal-fixture.js";
import {orientationPages} from "./drawing-orientation-fixture.js";
test.use({baseURL:portalFixtureURL});
const actor={id:"00000000-0000-4000-8000-000000000651",email:"threaded-community@example.invalid"};
const postId="10000000-0000-4000-8000-000000000651",parentId="20000000-0000-4000-8000-000000000651",ownId="20000000-0000-4000-8000-000000000652",newId="20000000-0000-4000-8000-000000000653";
const api="https://dmocks-portal-fixture.supabase.co",headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const row=(id,body,extra={})=>({id,parentId:null,body,author:"Mira",helpful:0,isMine:false,markedHelpful:false,canReply:true,parentAvailable:false,parentPreview:null,assetCount:0,...extra});
const parent=()=>row(parentId,"A reader’s original method explains the perspective.");
const post=()=>({id:postId,exam:"uceed",topic:"fictional",title:"An original fictional threaded discussion",body:"We compare original fictional methods for solving this drawing problem.",author:"Student",comments:1,status:"visible",assetCount:0});
const imageFile=async()=>({name:"fictional.png",mimeType:"image/png",buffer:await readFile(new URL("../fixtures/drawing-images/fictional-drawing.png",import.meta.url))});
async function fixture(page,options={}){
 const state={posts:options.empty?[]:[post()],comments:options.empty?[]:[parent()],second:[],version:1,next:false,postWrites:0,replyWrites:0,calls:[],uploads:[],assets:new Map(),receipts:new Map(),lostPost:false,lostReply:false,errorWrite:null,errorMore:null,holdMore:null,holdWrite:null,holdHelpful:null,holdUpload:null,errorAnchor:null,errorUpload:false};
 if(options.long)state.posts[0]={...post(),title:"Title".repeat(32),topic:"Topic".repeat(20),body:"OriginalFictionalBody".repeat(200)};
 if(options.other)state.posts.push({...post(),id:"10000000-0000-4000-8000-000000000652",title:"Another original fictional discussion"});
 const samples=await orientationPages(6);
 const target=id=>state.assets.get(id)??[];
 const dto=(id,replayed,kind,input)=>({id,postId:kind==="post"?id:input.p_post_id,parentId:kind==="post"?null:input.p_parent_id,status:state.posts[0]?.status??"visible",postStatus:state.posts[0]?.status??"visible",canUpload:(state.posts[0]?.status??"visible")==="visible",replayed});
 await page.route(api+"/rest/v1/rpc/**",async route=>{
  const request=route.request();if(request.method()==="OPTIONS")return route.fulfill({headers,status:204});
  const name=new URL(request.url()).pathname.split('/').at(-1),input=request.postDataJSON();state.calls.push([name,input]);let value;
  if(name==="community_feed")value=state.posts.filter(item=>item.status!=="hidden");
  else if(name==="public_all_india_top_ten")value=[];
  else if(name==="community_thread"||name==="community_reply_context"){
   if(input.p_cursor&&state.holdMore)await state.holdMore;
   const selected=state.posts.find(item=>item.id===input.p_post_id),all=input.p_post_id===postId?[...state.comments,...state.second]:[];
   const anchor=input.p_anchor_id?all.findIndex(item=>item.id===input.p_anchor_id):-1;
   const start=input.p_anchor_id?anchor:input.p_cursor?all.findIndex(item=>item.id===input.p_cursor.id)+1:0;
   const comments=input.p_anchor_id||input.p_cursor?all.slice(start,start+(input.p_limit??25)):state.comments;
   const hasMore=input.p_anchor_id||input.p_cursor?start+comments.length<all.length:state.next;
   value=!selected||selected.status==="hidden"||(input.p_anchor_id&&anchor<0)?{code:"42501",details:"community_target_unavailable",message:"Private moderation diagnostic"}:
    input.p_anchor_id&&state.errorAnchor?state.errorAnchor:input.p_cursor&&state.errorMore?state.errorMore:{...selected,version:state.version,assetCount:target(selected.id).length,
      ...(input.p_anchor_id?{anchorId:input.p_anchor_id,hasEarlier:anchor>0}:{}),comments:comments.map(item=>({...item,assetCount:target(item.id).length})),
      nextCursor:hasMore?{createdAt:"2026-01-01T00:00:00Z",snapshotAt:"2026-01-01T00:10:00Z",id:comments.at(-1).id,version:state.version}:null};
  }else if(name==="create_community_post"||name==="add_community_comment"){
   if(state.errorWrite)value=state.errorWrite;
   else{
    const kind=name==="create_community_post"?"post":"comment",stored=state.receipts.get(input.p_request_id),id=kind==="post"?postId:newId;
    if(!stored){state.receipts.set(input.p_request_id,{id,kind});if(kind==="post"){state.postWrites++;state.posts=[{...post(),title:input.p_title,body:input.p_body}];}
      else{state.replyWrites++;(state.next?state.second:state.comments).push(row(id,input.p_body,{parentId:input.p_parent_id,author:"You",isMine:true,parentAvailable:Boolean(input.p_parent_id),parentPreview:input.p_parent_id?{author:"Mira",body:parent().body}:null}));}}
    if(state.holdWrite)await state.holdWrite;
    if(kind==="post"&&state.lostPost){state.lostPost=false;try{return await route.abort();}catch{return;}}
    if(kind==="comment"&&state.lostReply){state.lostReply=false;try{return await route.abort();}catch{return;}}
    value=dto(id,Boolean(stored),kind,input);
   }
  }else if(name==="mark_community_helpful"){
   if(state.holdHelpful)await state.holdHelpful;
   const item=[...state.comments,...state.second].find(comment=>comment.id===input.p_comment_id);item.helpful=1;item.markedHelpful=true;value=null;
  }else if(name==="report_community_content")value=null;
  else throw new Error("Unexpected fictional procedure: "+name);
  try{await route.fulfill({headers,status:value?.code==="42501"?403:value?.code?400:200,json:value});}catch{}
 });
 await page.route(api+"/functions/v1/community-media",async route=>{
  const request=route.request();if(request.method()==="OPTIONS")return route.fulfill({headers,status:204});
  if(request.headers()["content-type"].startsWith("application/json")){
   const input=request.postDataJSON();return route.fulfill({headers,json:{media:target(input.targetId),serverNow:"2026-01-01T00:00:00Z",expiresAt:"2026-01-01T00:05:00Z"}});
  }
  const form=await new Request(request.url(),{method:"POST",headers:{"Content-Type":request.headers()["content-type"]},body:request.postDataBuffer()}).formData(),id=form.get("targetId"),ordinal=Number(form.get("ordinal"));
  state.uploads.push({id,ordinal});if(state.holdUpload)await state.holdUpload;
  if(state.errorUpload)return route.fulfill({headers,status:429,json:{code:"image_busy",error:"Private decoder diagnostic"}});
  state.assets.set(id,[{...samples[0],id:"30000000-0000-4000-8000-000000000651",ordinal}]);
  return route.fulfill({headers,json:{id:"30000000-0000-4000-8000-000000000651",ordinal}});
 });
 await page.goto("/account");await seedPortalSession(page,actor);await page.goto("/dashboard/community");await expect(page.getByRole("heading",{name:/Ask clearly/})).toBeVisible();
 state.addImage=id=>state.assets.set(id,[{...samples[0],id:"30000000-0000-4000-8000-000000000651",ordinal:1}]);return state;
}
async function compose(page,images=[]){await page.getByLabel("Topic",{exact:true}).fill("fictional");await page.getByLabel("Question title",{exact:true}).fill(post().title);await page.getByLabel("Your approach or question",{exact:true}).fill(post().body);await page.getByLabel("Question images (optional, up to 3)",{exact:true}).setInputFiles(images);}
const article=(page,body)=>page.locator(".community-comment").filter({has:page.locator('p').filter({hasText:body})}).first();

test("a lost text acknowledgement retries one post request before uploading its original images",async({page})=>{
 const state=await fixture(page,{empty:true});state.lostPost=true;await compose(page,[await imageFile()]);await page.getByRole("button",{name:"Post to community",exact:true}).click();
 const pending=page.getByRole("region",{name:"Unconfirmed post text",exact:true});await expect(pending).toBeVisible();await expect(page.getByLabel("Your approach or question",{exact:true})).toBeDisabled();expect(state.uploads).toEqual([]);
 await pending.getByRole("button",{name:"Retry post text",exact:true}).click();await expect(page.getByRole("img",{name:"Question attachment 1",exact:true})).toBeVisible();
 const writes=state.calls.filter(([name])=>name==="create_community_post");expect(writes).toHaveLength(2);expect(writes[0][1]).toEqual(writes[1][1]);expect(state.postWrites).toBe(1);expect(state.uploads).toEqual([{id:postId,ordinal:1}]);await expect(page.getByLabel("Your approach or question",{exact:true})).toHaveValue("");
});

test("nested text retry preserves its parent, clears the form and never repeats the reply",async({page})=>{
 const state=await fixture(page);await page.getByRole("button",{name:"Open discussion",exact:true}).click();
 await expect(page.getByRole("region",{name:"Discussion thread",exact:true}).getByRole("heading",{name:post().title,exact:true})).toBeFocused();
 await article(page,parent().body).getByRole("button",{name:"Reply to comment by Mira",exact:true}).press("Enter");
 const input=page.getByLabel("Your reply to comment",{exact:true});await expect(input).toBeFocused();await input.fill("A nested fictional solution to this exact comment.");state.lostReply=true;
 await page.getByRole("button",{name:"Reply",exact:true}).click();const pending=page.getByRole("region",{name:"Unconfirmed reply text",exact:true});await expect(pending).toBeVisible();
 await pending.getByRole("button",{name:"Retry reply text",exact:true}).click();await expect(page.getByLabel("Add a reply",{exact:true})).toHaveValue("");
 expect(state.replyWrites).toBe(1);const writes=state.calls.filter(([name])=>name==="add_community_comment");expect(writes[0][1]).toEqual(writes[1][1]);expect(writes[0][1].p_parent_id).toBe(parentId);
 await expect(page.getByText("A nested fictional solution to this exact comment.",{exact:true})).toBeVisible();await expect(page.getByText("Reply to Mira: "+parent().body,{exact:true})).toBeVisible();
});

test("known quota errors release the form while stopping an unknown request never silently reposts it",async({page})=>{
 const state=await fixture(page,{empty:true});state.lostPost=true;await compose(page);await page.getByRole("button",{name:"Post to community",exact:true}).click();
 await page.getByRole("button",{name:"Stop retrying this post",exact:true}).click();await expect(page.getByRole("status")).toContainText("may already be saved");expect(state.postWrites).toBe(1);
 state.errorWrite={code:"P0001",details:"community_post_limit",message:"Private quota diagnostic"};await page.getByRole("button",{name:"Post to community",exact:true}).click();
 await expect(page.getByRole("status")).toContainText("hourly post limit");await expect(page.getByRole("region",{name:"Unconfirmed post text",exact:true})).toHaveCount(0);await expect(page.getByRole("button",{name:"Post to community",exact:true})).toBeEnabled();await expect(page.getByText("Private quota diagnostic")).toHaveCount(0);
});

test("a replay confirms hidden saved text without uploading files or presenting it as live",async({page})=>{
 const state=await fixture(page,{empty:true});state.lostPost=true;await compose(page,[await imageFile()]);await page.getByRole("button",{name:"Post to community",exact:true}).click();
 await expect(page.getByRole("region",{name:"Unconfirmed post text",exact:true})).toBeVisible();state.posts[0].status="hidden";
 await page.getByRole("button",{name:"Retry post text",exact:true}).click();await expect(page.getByRole("status")).toContainText("Attachments were not uploaded");expect(state.uploads).toEqual([]);expect(state.postWrites).toBe(1);await expect(page.getByRole("region",{name:"Unconfirmed post text",exact:true})).toHaveCount(0);
});

test("reply context, cancellation, own helpful controls and reports are keyboard accessible in both themes",async({page})=>{
 const state=await fixture(page);state.comments.push(row(ownId,"My original fictional comment.",{author:"You",isMine:true}));await page.getByRole("button",{name:"Open discussion",exact:true}).click();
 const opener=article(page,parent().body).getByRole("button",{name:"Reply to comment by Mira",exact:true});await opener.press("Enter");await expect(page.getByLabel("Your reply to comment",{exact:true})).toBeFocused();
 await page.getByRole("button",{name:"Cancel nested reply",exact:true}).press("Enter");await expect(opener).toBeFocused();await expect(article(page,"My original fictional comment.").getByRole("button",{name:"Mark helpful",exact:true})).toHaveCount(0);
 await article(page,parent().body).getByRole("button",{name:"Mark helpful",exact:true}).click();await expect(article(page,parent().body).getByRole("button",{name:"Marked helpful",exact:true})).toBeDisabled();
 await page.getByRole("button",{name:"Report discussion",exact:true}).click();
 const report=page.getByRole("dialog",{name:"Report community content",exact:true});await report.getByRole("button",{name:"Send report",exact:true}).click();
 await expect(report.getByRole("status")).toHaveText("Report sent for moderator review.");
 expect(state.calls).toContainEqual(["report_community_content",{p_post_id:postId,p_comment_id:null,p_reason:"other",p_details:null}]);
 await report.getByRole("button",{name:"Close",exact:true}).click();
 await page.addScriptTag({path:fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js",import.meta.url))});
 for(let theme=0;theme<2;theme++){await expect(page.getByRole("button",{name:"Post to community",exact:true})).toHaveCSS("background-color",theme?"rgb(220, 235, 161)":"rgb(36, 71, 53)");expect(await page.evaluate(async()=> (await window.axe.run(".community-page",{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}})).violations.map(item=>item.id))).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);await page.getByRole("switch",{name:"Dark mode",exact:true}).click();}
 await page.setViewportSize({width:320,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("more replies append a bounded page without duplicates or losing a composed draft",async({page})=>{
 const state=await fixture(page);state.comments=Array.from({length:25},(_,n)=>row(`20000000-0000-4000-8000-${String(700+n).padStart(12,'0')}`,`Original fictional page reply ${n+1}.`));state.second=[row(newId,"The next original fictional reply.")];state.next=true;
 await page.getByRole("button",{name:"Open discussion",exact:true}).click();await page.getByLabel("Add a reply",{exact:true}).fill("An unsent fictional draft.");await page.getByRole("button",{name:"Load more replies",exact:true}).press("Enter");
 await expect(page.locator(".community-comment")).toHaveCount(26);await expect(page.getByLabel("Add a reply",{exact:true})).toHaveValue("An unsent fictional draft.");await expect(page.getByRole("button",{name:"Load more replies",exact:true})).toHaveCount(0);
 await expect(article(page,"The next original fictional reply.")).toBeFocused();await expect(page.getByRole("status")).toContainText("1 more reply loaded");await page.keyboard.press("Tab");await expect(article(page,"The next original fictional reply.").getByRole("button",{name:"Reply to comment by Mira",exact:true})).toBeFocused();
 const more=state.calls.find(([name,input])=>name==="community_thread"&&input.p_cursor);expect(more[1].p_limit).toBe(25);expect(more[1].p_cursor.version).toBe(1);
});

test("expired old image links do not return when a held next page finishes",async({page})=>{
 await page.clock.install({time:new Date("2026-11-07T12:00:00Z")});const state=await fixture(page);state.addImage(parentId);state.second=[row(newId,"A new fictional image reply.")];state.addImage(newId);state.next=true;let release;state.holdMore=new Promise(resolve=>{release=resolve;});
 await page.getByRole("button",{name:"Open discussion",exact:true}).click();await expect(article(page,parent().body).getByRole("img")).toBeVisible();
 const requested=page.waitForRequest(request=>request.url().endsWith("/rpc/community_thread")&&request.method()==="POST"&&request.postDataJSON()?.p_cursor);await page.getByRole("button",{name:"Load more replies",exact:true}).click();await requested;
 await page.clock.fastForward(300_001);await expect(article(page,parent().body).getByRole("img")).toHaveCount(0);release();
 await expect(article(page,"A new fictional image reply.").getByRole("img")).toBeVisible();await expect(article(page,parent().body).getByRole("img")).toHaveCount(0);
});

test("moderation invalidates an old cursor and removes parent content while preserving a visible child",async({page})=>{
 const state=await fixture(page);state.comments=[row(parentId,"Redacted original context."),row(newId,"A visible child remains.",{parentId,parentAvailable:true,parentPreview:{author:"Mira",body:"Redacted original context."}})];state.next=true;
 await page.getByRole("button",{name:"Open discussion",exact:true}).click();await expect(page.getByRole("button",{name:"Load more replies",exact:true})).toBeVisible();
 state.version=2;state.comments=[row(newId,"A visible child remains.",{parentId,parentAvailable:false,parentPreview:null})];state.errorMore={code:"40001",details:"community_thread_changed",message:"Private version diagnostic"};
 await page.getByRole("button",{name:"Load more replies",exact:true}).click();await expect(page.getByText("Reply to a removed or unavailable comment.",{exact:true})).toBeVisible();await expect(page.getByText(/Redacted original context/)).toHaveCount(0);await expect(page.getByRole("status")).toContainText("Discussion changed");
});

test("retryable page failures preserve an unsent reply but permission loss clears the thread",async({page})=>{
 const state=await fixture(page);state.next=true;await page.getByRole("button",{name:"Open discussion",exact:true}).click();await page.getByLabel("Add a reply",{exact:true}).fill("My unsent fictional draft.");state.errorMore={code:"PGRST000",message:"Private connection details"};
 await page.getByRole("button",{name:"Load more replies",exact:true}).click();await expect(page.getByRole("status")).toContainText("Couldn’t load more replies");await expect(page.getByLabel("Add a reply",{exact:true})).toHaveValue("My unsent fictional draft.");
 await expect(page.getByRole("button",{name:"Load more replies",exact:true})).toBeFocused();
 state.errorMore={code:"42501",message:"Private permission details"};await page.getByRole("button",{name:"Load more replies",exact:true}).click();await expect(page.getByRole("region",{name:"Discussion thread",exact:true})).toHaveCount(0);await expect(page.getByText("Private permission details")).toHaveCount(0);
});

test("account changes cancel a held write before its late acknowledgement can upload images",async({page})=>{
 const state=await fixture(page,{empty:true});let release;state.holdWrite=new Promise(resolve=>{release=resolve;});await compose(page,[await imageFile()]);
 const requested=page.waitForRequest(request=>request.url().endsWith("/rpc/create_community_post")&&request.method()==="POST");await page.getByRole("button",{name:"Post to community",exact:true}).click();await requested;
 await seedPortalSession(page,{id:"00000000-0000-4000-8000-000000000652",email:"other-threaded@example.invalid"});await page.evaluate(()=>{const key="sb-dmocks-portal-fixture-auth-token",channel=new BroadcastChannel(key);channel.postMessage({event:"SIGNED_IN",session:JSON.parse(localStorage.getItem(key))});channel.close();});release();
 await expect(page.getByLabel("Your approach or question",{exact:true})).toHaveValue("");await expect(page.getByRole("region",{name:"Unconfirmed post text",exact:true})).toHaveCount(0);expect(state.uploads).toEqual([]);expect(state.postWrites).toBe(1);
});

function paged(state){
 state.comments=Array.from({length:25},(_,n)=>row(`20000000-0000-4000-8000-${String(800+n).padStart(12,'0')}`,`Original fictional context reply ${n+1}.`));
 state.second=[parent()];state.next=true;
}

test("a saved later-page reply reveals its exact text and recovered images with a way back to the beginning",async({page})=>{
 const state=await fixture(page);paged(state);await page.getByRole("button",{name:"Open discussion",exact:true}).click();await page.getByRole("button",{name:"Load more replies",exact:true}).click();
 await article(page,parent().body).getByRole("button",{name:"Reply to comment by Mira",exact:true}).click();await page.getByLabel("Your reply to comment",{exact:true}).fill("A saved fictional reply after the first twenty-five.");
 await page.getByLabel("Solution images (optional, up to 3)",{exact:true}).setInputFiles([await imageFile()]);state.errorUpload=true;await page.getByRole("button",{name:"Reply",exact:true}).click();
 await expect(page.getByRole("region",{name:"Saved reply images",exact:true})).toBeVisible();
 state.second.push(...Array.from({length:30},(_,n)=>row(`20000000-0000-4000-8000-${String(900+n).padStart(12,'0')}`,`Original fictional replies after the saved target ${n+1}.`)));
 await page.getByRole("button",{name:"Open saved discussion",exact:true}).click();await expect(page.getByText("A saved fictional reply after the first twenty-five.",{exact:true})).toBeVisible();await expect(article(page,"A saved fictional reply after the first twenty-five.").getByRole("img")).toHaveCount(0);
 state.errorUpload=false;await page.getByRole("button",{name:"Retry reply images",exact:true}).click();
 await expect(article(page,"A saved fictional reply after the first twenty-five.").getByRole("img",{name:"Solution attachment 1",exact:true})).toBeVisible();
 await expect(page.getByText("Showing this reply and the replies that follow it.",{exact:true})).toBeVisible();await expect(page.getByText("Reply to Mira: "+parent().body,{exact:true})).toBeVisible();
 expect(state.replyWrites).toBe(1);expect(state.uploads).toEqual([{id:newId,ordinal:1},{id:newId,ordinal:1}]);expect(state.calls).toContainEqual(["community_reply_context",{p_post_id:postId,p_anchor_id:newId,p_limit:25}]);
 await expect(page.locator(".community-comment")).toHaveCount(25);await page.getByRole("button",{name:"Load more replies",exact:true}).click();await expect(page.locator(".community-comment")).toHaveCount(31);await expect(page.getByText("Showing this reply and the replies that follow it.",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Read from beginning",exact:true}).click();await expect(page.locator(".community-comment")).toHaveCount(25);await expect(page.getByRole("button",{name:"Load more replies",exact:true})).toBeVisible();
});

test("helpful on a later page retains loaded replies, keyboard focus and a draft even when count refresh fails",async({page})=>{
 const state=await fixture(page);paged(state);await page.getByRole("button",{name:"Open discussion",exact:true}).click();await page.getByRole("button",{name:"Load more replies",exact:true}).click();await page.getByLabel("Add a reply",{exact:true}).fill("My fictional draft stays here.");
 const button=article(page,parent().body).getByRole("button",{name:"Mark helpful",exact:true});await button.press("Enter");
 const marked=article(page,parent().body).getByRole("button",{name:"Marked helpful",exact:true});await expect(marked).toBeFocused();await expect(article(page,parent().body)).toContainText("1 helpful");await expect(page.locator(".community-comment")).toHaveCount(26);await expect(page.getByLabel("Add a reply",{exact:true})).toHaveValue("My fictional draft stays here.");expect(state.calls).toContainEqual(["community_reply_context",{p_post_id:postId,p_anchor_id:parentId,p_limit:1}]);
 state.errorAnchor={code:"PGRST000",message:"Private count diagnostic"};const other=article(page,"Original fictional context reply 1.");await other.getByRole("button",{name:"Mark helpful",exact:true}).press("Enter");
 await expect(page.getByRole("status").filter({hasText:"Couldn’t refresh the count"})).toBeVisible();await expect(other.getByRole("button",{name:"Marked helpful",exact:true})).toBeFocused();await expect(page.locator(".community-comment")).toHaveCount(26);await expect(page.getByLabel("Add a reply",{exact:true})).toHaveValue("My fictional draft stays here.");
 state.errorAnchor={code:"42501",message:"Private revocation diagnostic"};await article(page,"Original fictional context reply 2.").getByRole("button",{name:"Mark helpful",exact:true}).click();await expect(page.getByRole("region",{name:"Discussion thread",exact:true})).toHaveCount(0);await expect(page.getByText(/Private .* diagnostic/)).toHaveCount(0);
});

for(const destination of ["close","other","reopen"]){
 test(`a late reply acknowledgement respects an explicit ${destination} discussion choice`,async({page})=>{
  const state=await fixture(page,{other:true});await page.getByRole("button",{name:"Open discussion",exact:true}).first().click();await page.getByLabel("Add a reply",{exact:true}).fill("A fictional reply saved while I leave.");await page.getByLabel("Solution images (optional, up to 3)",{exact:true}).setInputFiles([await imageFile()]);
  let release;state.holdWrite=new Promise(resolve=>{release=resolve;});const requested=page.waitForRequest(request=>request.url().endsWith("/rpc/add_community_comment")&&request.method()==="POST");await page.getByRole("button",{name:"Reply",exact:true}).click();await requested;
  await page.getByRole("button",{name:"Close discussion",exact:true}).press("Enter");await expect(page.getByRole("button",{name:"Open discussion",exact:true}).first()).toBeFocused();
  if(destination!=="close"){await page.getByRole("button",{name:"Open discussion",exact:true}).nth(destination==="other"?1:0).press("Enter");await expect(page.getByRole("region",{name:"Discussion thread",exact:true})).toContainText(destination==="other"?"Another original fictional discussion":post().title);}
  const reads=state.calls.filter(([name])=>name==="community_thread"||name==="community_reply_context").length;release();await expect(page.getByRole("button",{name:"Post to community",exact:true})).toBeEnabled();
  expect(state.replyWrites).toBe(1);expect(state.uploads).toEqual([{id:newId,ordinal:1}]);expect(state.calls.filter(([name])=>name==="community_thread"||name==="community_reply_context")).toHaveLength(reads);
  if(destination==="close"){await expect(page.getByRole("region",{name:"Discussion thread",exact:true})).toHaveCount(0);await expect(page.getByRole("button",{name:"Open discussion",exact:true}).first()).toBeFocused();}
  else await expect(page.getByRole("region",{name:"Discussion thread",exact:true}).getByRole("heading",{name:destination==="other"?"Another original fictional discussion":post().title,exact:true})).toBeFocused();
 });
}

test("late image completion and a helpful acknowledgement preserve a newly opened discussion",async({page})=>{
 const state=await fixture(page,{other:true});await page.getByRole("button",{name:"Open discussion",exact:true}).first().click();await page.getByLabel("Add a reply",{exact:true}).fill("A fictional image reply saved before switching views.");await page.getByLabel("Solution images (optional, up to 3)",{exact:true}).setInputFiles([await imageFile()]);
 let release;state.holdUpload=new Promise(resolve=>{release=resolve;});const uploaded=page.waitForRequest(request=>request.url().endsWith("/community-media")&&request.method()==="POST"&&!request.headers()["content-type"].startsWith("application/json"));await page.getByRole("button",{name:"Reply",exact:true}).click();await uploaded;
 await page.getByRole("button",{name:"Open discussion",exact:true}).nth(1).press("Enter");await expect(page.getByRole("region",{name:"Discussion thread",exact:true}).getByRole("heading",{name:"Another original fictional discussion",exact:true})).toBeFocused();release();await expect(page.getByRole("button",{name:"Post to community",exact:true})).toBeEnabled();await expect(page.getByRole("region",{name:"Discussion thread",exact:true})).toContainText("Another original fictional discussion");expect(state.replyWrites).toBe(1);
 await page.getByRole("button",{name:"Open discussion",exact:true}).first().click();let releaseHelpful;state.holdHelpful=new Promise(resolve=>{releaseHelpful=resolve;});const helpful=page.waitForRequest(request=>request.url().endsWith("/rpc/mark_community_helpful")&&request.method()==="POST");await article(page,parent().body).getByRole("button",{name:"Mark helpful",exact:true}).click();await helpful;await page.getByRole("button",{name:"Open discussion",exact:true}).nth(1).press("Enter");await expect(page.getByRole("region",{name:"Discussion thread",exact:true}).getByRole("heading",{name:"Another original fictional discussion",exact:true})).toBeFocused();releaseHelpful();await expect(page.getByRole("button",{name:"Post to community",exact:true})).toBeEnabled();await expect(page.getByRole("region",{name:"Discussion thread",exact:true}).getByRole("heading",{name:"Another original fictional discussion",exact:true})).toBeFocused();
 expect(state.calls.filter(([name])=>name==="community_reply_context")).toEqual([]);
});

test("long unbroken discussion fields and active nested context reflow at 320 pixels in both themes",async({page})=>{
 const state=await fixture(page,{long:true});await expect(page.locator(".community-feed h2")).toHaveText("Title".repeat(32));state.comments=[row(parentId,"LongFictionalReply".repeat(170))];await page.setViewportSize({width:320,height:900});await page.getByRole("button",{name:"Open discussion",exact:true}).click();await page.getByRole("button",{name:"Reply to comment by Mira",exact:true}).click();await expect(page.getByLabel("Your reply to comment",{exact:true})).toBeFocused();
 await page.addScriptTag({path:fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js",import.meta.url))});
 for(let theme=0;theme<2;theme++){await expect(page.getByRole("button",{name:"Post to community",exact:true})).toHaveCSS("background-color",theme?"rgb(220, 235, 161)":"rgb(36, 71, 53)");expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);expect(await page.evaluate(async()=> (await window.axe.run(".community-page",{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}})).violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))})))).toEqual([]);await page.getByRole("switch",{name:"Dark mode",exact:true}).click();}
});
