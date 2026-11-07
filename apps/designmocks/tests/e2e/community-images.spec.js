import { expect,test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { orientationPages } from "./drawing-orientation-fixture.js";
import { portalFixtureURL,seedPortalSession,stubPortalProvider } from "./portal-fixture.js";
test.use({baseURL:portalFixtureURL});
const student={id:"00000000-0000-4000-8000-000000000591",email:"community-images@example.invalid"};
const postId="10000000-0000-4000-8000-000000000591",commentId="20000000-0000-4000-8000-000000000591";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const files=async()=>Promise.all([["png","image/png"],["jpg","image/jpeg"],["webp","image/webp"]].map(async([ext,mimeType])=>({name:"fictional."+ext,mimeType,buffer:await readFile(new URL(`../fixtures/drawing-images/fictional-drawing.${ext}`,import.meta.url))})));
async function fixture(page,{existing=false}={}){
  const samples=await orientationPages(6),state={posts:[],comments:[],assets:new Map(),postWrites:0,replyWrites:0,uploads:[],failOrdinal:null,lostOrdinal:null,denied:false,hold:null};
  const target=(id)=>state.assets.get(id)??[];
  const post=()=>({id:postId,exam:"uceed",topic:"observation",title:"An original fictional image discussion",body:"We compare the same original fictional sketches to explain our method.",status:"visible",comments:state.comments.length,author:"Fictional student"});
  if(existing){state.posts.push(post());state.assets.set(postId,[samples[0]]);}
  const provider=await stubPortalProvider(page,(name,input)=>{
    if(name==="community_feed")return state.posts.filter(item=>item.status!=="hidden");
    if(name==="create_community_post"){state.postWrites++;state.posts=[{...post(),title:input.p_title,body:input.p_body}];return postId;}
    if(name==="add_community_comment"){state.replyWrites++;state.comments=[{id:commentId,body:input.p_body,author:"Fictional reply",helpful:0}];return commentId;}
    if(name==="community_thread")return state.posts[0]?.status==="hidden"?{code:"42501",message:"Private moderation diagnostic"}:{...state.posts[0],assetCount:target(postId).length,comments:state.comments.map(item=>({...item,assetCount:target(item.id).length}))};
    if(name==="mark_community_helpful"){state.comments[0].helpful++;return null;}
    if(name==="report_community_content")return null;
    if(name==="public_all_india_top_ten")return [];
  });
  await page.route("https://dmocks-portal-fixture.supabase.co/functions/v1/community-media",async route=>{
    const request=route.request();if(request.method()==="OPTIONS")return route.fulfill({status:204,headers});
    if(request.headers()["content-type"].startsWith("application/json")){
      const input=request.postDataJSON();if(state.hold)await state.hold;
      try{return await route.fulfill({headers,status:state.denied?403:200,json:state.denied?{code:"target_unavailable",error:"Private image diagnostic"}:
        {media:target(input.targetId),serverNow:"2026-01-01T00:00:00Z",expiresAt:"2026-01-01T00:05:00Z"}});}catch{return;}
    }
    const form=await new Request(request.url(),{method:"POST",headers:{"Content-Type":request.headers()["content-type"]},body:request.postDataBuffer()}).formData();
    const id=form.get("targetId"),ordinal=Number(form.get("ordinal"));state.uploads.push({targetType:form.get("targetType"),id,ordinal,name:form.get("file").name});
    if(state.failOrdinal===ordinal)return route.fulfill({headers,status:429,json:{code:"image_busy",error:"Private decoder diagnostic"}});
    const images=target(id),saved=images.find(item=>item.ordinal===ordinal),image=saved??{...samples[(ordinal-1)%3],id:`${id}-image-${ordinal}`,ordinal};
    if(!saved)state.assets.set(id,[...images,image]);
    if(state.lostOrdinal===ordinal){state.lostOrdinal=null;return route.abort();}
    return route.fulfill({headers,json:{id:image.id,ordinal,reused:Boolean(saved)}});
  });
  await page.goto("/account");await seedPortalSession(page,student);await page.goto("/dashboard/community");
  await expect(page.getByRole("heading",{name:/Ask clearly/})).toBeVisible();
  return Object.assign(state,provider);
}
async function compose(page,attachments){
  await page.getByLabel("Topic",{exact:true}).fill("observation");
  await page.getByLabel("Question title",{exact:true}).fill("An original fictional image discussion");
  await page.getByLabel("Your approach or question",{exact:true}).fill("We compare the same original fictional sketches to explain our method.");
  await page.getByLabel("Question images (optional, up to 3)",{exact:true}).setInputFiles(attachments);
}

test("invalid attachment counts, size and types create no Community text or upload",async({page})=>{
  const state=await fixture(page),[first]=await files();
  for(const [attachments,message]of[[[first,first,first,first],"Choose no more than three images."],
    [[{name:"oversized.png",mimeType:"image/png",buffer:Buffer.alloc(5*1024*1024+1)}],"Use images no larger than 5 MB each."],
    [[{name:"unsupported.svg",mimeType:"image/svg+xml",buffer:Buffer.from("<svg/>")}],"An image could not be fully read."]]){
    await compose(page,attachments);await page.getByRole("button",{name:"Post to community",exact:true}).click();
    await expect(page.getByRole("status")).toContainText(message);
  }
  expect(state.postWrites).toBe(0);expect(state.uploads).toEqual([]);expect(state.unexpected).toEqual([]);
});

test("partial post images resume one saved discussion and preserve order and WebP orientation",async({page})=>{
  const state=await fixture(page);state.failOrdinal=2;await compose(page,await files());
  await page.getByRole("button",{name:"Post to community",exact:true}).click();
  const pending=page.getByRole("region",{name:"Saved post images",exact:true});
  await expect(pending).toContainText("1 of 3 images confirmed");await expect(page.getByRole("button",{name:"Post to community",exact:true})).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("Another image is being checked");
  state.failOrdinal=null;await pending.getByRole("button",{name:"Retry post images",exact:true}).click();
  await expect(pending).toHaveCount(0);await expect(page.getByRole("img",{name:"Question attachment 3",exact:true})).toBeVisible();
  const image=await page.getByRole("img",{name:"Question attachment 3",exact:true}).boundingBox();expect(image.width/image.height).toBeCloseTo(4/6,2);
  expect(state.postWrites).toBe(1);expect(state.uploads.map(item=>item.ordinal)).toEqual([1,2,2,3]);expect(state.uploads.every(item=>item.id===postId)).toBe(true);
  expect(state.assets.get(postId)).toHaveLength(3);expect(state.unexpected).toEqual([]);
});

test("a lost reply receipt retries the same reply and helpful/report refresh keeps its images",async({page})=>{
  const state=await fixture(page,{existing:true});await page.getByRole("button",{name:"Open discussion",exact:true}).click();
  await page.getByLabel("Add a reply",{exact:true}).fill("Here are two original fictional views of my solution.");
  await page.getByLabel("Solution images (optional, up to 3)",{exact:true}).setInputFiles((await files()).slice(0,2));state.lostOrdinal=1;
  await page.getByRole("button",{name:"Reply",exact:true}).click();
  const pending=page.getByRole("region",{name:"Saved reply images",exact:true});await expect(pending).toContainText("0 of 2 images confirmed");
  await pending.getByRole("button",{name:"Retry reply images",exact:true}).click();
  await expect(page.getByRole("img",{name:"Solution attachment 2",exact:true})).toBeVisible();
  expect(state.replyWrites).toBe(1);expect(state.assets.get(commentId)).toHaveLength(2);
  expect(state.uploads.map(item=>[item.id,item.ordinal])).toEqual([[commentId,1],[commentId,1],[commentId,2]]);
  await page.getByRole("button",{name:"Mark helpful",exact:true}).click();await expect(page.getByRole("img",{name:"Solution attachment 2",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Report",exact:true}).click();await expect(page.getByRole("status")).toHaveText("Report sent for moderator review.");expect(state.unexpected).toEqual([]);
});

test("members can finish saved text without the unconfirmed attachments",async({page})=>{
  const state=await fixture(page);state.failOrdinal=1;await compose(page,(await files()).slice(0,1));
  await page.getByRole("button",{name:"Post to community",exact:true}).click();
  await page.getByRole("button",{name:"Finish post without remaining images",exact:true}).click();
  await expect(page.getByRole("region",{name:"Saved post images",exact:true})).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Remaining images were not uploaded.");expect(state.postWrites).toBe(1);
  await expect(page.getByRole("button",{name:"Post to community",exact:true})).toBeEnabled();expect(state.unexpected).toEqual([]);
});

test("expired links clear Community images using server time and denied refresh reveals no private diagnostics",async({page})=>{
  await page.clock.install({time:new Date("2026-11-07T11:00:00Z")});const state=await fixture(page,{existing:true});
  await page.getByRole("button",{name:"Open discussion",exact:true}).click();await expect(page.getByRole("img",{name:"Question attachment 1",exact:true})).toBeVisible();
  await page.clock.fastForward(300_001);await expect(page.getByRole("img",{name:/attachment/})).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Image links expired");
  await page.getByRole("button",{name:"Refresh discussion",exact:true}).click();await expect(page.getByRole("img",{name:"Question attachment 1",exact:true})).toBeVisible();
  state.denied=true;await page.getByRole("button",{name:"Refresh discussion",exact:true}).click();await expect(page.getByRole("img",{name:/attachment/})).toHaveCount(0);
  await expect(page.getByText("Private image diagnostic")).toHaveCount(0);await expect(page.getByRole("status")).toContainText("unavailable");expect(state.unexpected).toEqual([]);
});

test("locked discussions preserve readable images and keyboard/mobile accessibility in both themes",async({page})=>{
  const state=await fixture(page,{existing:true});state.posts[0].status="locked";
  await page.getByRole("button",{name:"Open discussion",exact:true}).press("Enter");
  await expect(page.getByRole("button",{name:"Reply",exact:true})).toBeDisabled();await expect(page.getByRole("img",{name:"Question attachment 1",exact:true})).toBeVisible();
  await page.addScriptTag({path:fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js",import.meta.url))});
  for(let theme=0;theme<2;theme++){
    await expect(page.getByRole("button",{name:"Post to community",exact:true})).toHaveCSS("background-color",theme===0?"rgb(36, 71, 53)":"rgb(220, 235, 161)");
    expect(await page.evaluate(async()=> (await window.axe.run(".community-page",{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}})).violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))})))).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
    await page.getByRole("switch",{name:"Dark mode",exact:true}).click();
  }
  state.posts[0].status="hidden";await page.getByRole("button",{name:"Refresh discussion",exact:true}).click();
  await expect(page.getByRole("region",{name:"Discussion thread",exact:true})).toHaveCount(0);expect(state.unexpected).toEqual([]);
});

test("navigation cancels a held signer and ignores the late Community images",async({page})=>{
  const state=await fixture(page,{existing:true});let release;state.hold=new Promise(resolve=>{release=resolve;});
  const requested=page.waitForRequest(request=>request.url().endsWith("/community-media")&&request.method()==="POST");
  await page.getByRole("button",{name:"Open discussion",exact:true}).click();await requested;
  await page.getByRole("link",{name:"DMocks home",exact:true}).first().click();await expect(page).toHaveURL(/\/$/);release();
  await expect(page.getByRole("img",{name:/attachment/})).toHaveCount(0);await expect(page.getByRole("region",{name:"Discussion thread",exact:true})).toHaveCount(0);expect(state.unexpected).toEqual([]);
});

test("switching accounts clears an open discussion and pending upload recovery",async({page})=>{
  const state=await fixture(page,{existing:true});await page.getByRole("button",{name:"Open discussion",exact:true}).click();
  await expect(page.getByRole("img",{name:"Question attachment 1",exact:true})).toBeVisible();
  state.failOrdinal=1;await compose(page,(await files()).slice(0,1));await page.getByRole("button",{name:"Post to community",exact:true}).click();
  await expect(page.getByRole("region",{name:"Saved post images",exact:true})).toBeVisible();state.posts=[];
  await seedPortalSession(page,{id:"00000000-0000-4000-8000-000000000592",email:"other-community@example.invalid"});
  await page.evaluate(()=>{const key="sb-dmocks-portal-fixture-auth-token",channel=new BroadcastChannel(key);channel.postMessage({event:"SIGNED_IN",session:JSON.parse(localStorage.getItem(key))});channel.close();});
  await expect(page.getByRole("region",{name:"Saved post images",exact:true})).toHaveCount(0);await expect(page.getByRole("img",{name:/attachment/})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Post to community",exact:true})).toBeEnabled();expect(state.unexpected).toEqual([]);
});
