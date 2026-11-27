import { expect,test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { largeDrawingPage,orientationPages } from "./drawing-orientation-fixture.js";
import { portalFixtureURL,seedPortalSession,stubPortalProvider } from "./portal-fixture.js";

test.use({baseURL:portalFixtureURL});
const account={id:"00000000-0000-4000-8000-000000000481",email:"inspection@example.invalid"};
const reviewId="40000000-0000-4000-8000-000000000481";
const attemptId="30000000-0000-4000-8000-000000000481",questionId="20000000-0000-4000-8000-000000000481";

async function reviewer(page) {
  const state={images:await orientationPages(6),denied:false,expiresAt:null,serverNow:null};
  const provider=await stubPortalProvider(page,(procedure,input)=>{
    if(procedure==="can_review_drawings")return true;
    if(procedure==="my_drawing_review_page")return{items:input.p_scope==="mine"?[{reviewId,version:1,prompt:"Inspect an original fictional drawing.",
      uploadCount:3,status:"assigned",canClaim:false,canReview:true,assignedToMe:true,maxScore:20}]:[],nextCursor:null};
    if(procedure==="drawing-review-media")return state.denied?{code:"42501",message:"Private diagnostic must not be reflected"}:{images:state.images,...(state.expiresAt?{expiresAt:state.expiresAt,serverNow:state.serverNow}:{})};
  });
  await page.goto("/account");await seedPortalSession(page,account);await page.goto("/review/drawings");
  await page.getByRole("button",{name:"My reviews",exact:true}).click();
  await page.getByRole("button",{name:"Open private images",exact:true}).click();
  await expect(page.getByRole("img",{name:"Anonymous drawing page 3",exact:true})).toBeVisible();
  return Object.assign(state,provider);
}

async function sampleScreenshot(page,buffer,width,height) {
  return page.evaluate(async({base64,width,height})=>{
    const image=new Image();image.src="data:image/png;base64,"+base64;await image.decode();
    const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const context=canvas.getContext("2d");context.drawImage(image,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
    return Array.from({length:width*height},(_,n)=>{
      const x=Math.floor(((n%width)+.5)*canvas.width/width),y=Math.floor((Math.floor(n/width)+.5)*canvas.height/height),at=(y*canvas.width+x)*4;
      return [...pixels.slice(at,at+3)];
    });
  },{base64:buffer.toString("base64"),width,height});
}

test("private PNG, JPEG and WebP pages display every EXIF orientation with the independently decoded pixels",async({page})=>{
  test.setTimeout(90_000);
  const state=await reviewer(page),references=JSON.parse(await readFile(new URL("../fixtures/drawing-images/orientation-pixels.json",import.meta.url),"utf8"));
  for(let orientation=1;orientation<=8;orientation++){
    state.images=await orientationPages(orientation);
    await page.getByRole("button",{name:"Refresh private images",exact:true}).click();
    for(const [index,image]of state.images.entries()){
      await expect(page.getByRole("img",{name:`Anonymous drawing page ${index+1}`,exact:true})).toBeVisible();
      const frame=page.locator(".drawing-review-grid figure").nth(index).locator(".drawing-image-canvas");
      const expected=references[image.mimeType][orientation],buffer=await frame.screenshot();
      const actual=await sampleScreenshot(page,buffer,expected.width,expected.height);
      const maximum=Math.max(...actual.flatMap((pixel,n)=>pixel.map((channel,k)=>Math.abs(channel-expected.pixels[n][k]))));
      expect(maximum,`${image.mimeType} orientation ${orientation}`).toBeLessThanOrEqual(4);
    }
  }
  expect(state.calls.some(([name])=>name==="admin_review_drawing")).toBe(false);expect(state.unexpected).toEqual([]);
});

test("teacher inspection supports keyboard rotation, mirror, zoom, fit and Escape without writing a grade",async({page})=>{
  const state=await reviewer(page);
  const opener=page.getByRole("button",{name:"Inspect page 3, anonymous drawing",exact:true});await opener.press("Enter");
  const dialog=page.getByRole("dialog",{name:"Anonymous drawing page 3",exact:true});await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button",{name:"Close image",exact:true})).toBeFocused();
  await dialog.getByRole("button",{name:"Rotate right",exact:true}).press("Enter");
  await dialog.getByRole("button",{name:"Mirror view",exact:true}).press("Enter");
  await expect(dialog.getByRole("status")).toContainText("rotated 90° · mirrored");
  for(let index=0;index<6;index++)await dialog.getByRole("button",{name:"Zoom in",exact:true}).click();
  await expect(dialog.getByRole("button",{name:"Zoom in",exact:true})).toBeDisabled();await expect(dialog.getByRole("status")).toContainText("400%");
  const viewport=dialog.getByRole("region",{name:"Anonymous drawing page 3 scrollable image",exact:true});
  expect(await viewport.evaluate(element=>element.scrollWidth>element.clientWidth||element.scrollHeight>element.clientHeight)).toBe(true);
  await viewport.focus();await page.keyboard.press("ArrowDown");
  await dialog.getByRole("button",{name:"Fit page",exact:true}).click();await expect(dialog.getByRole("status")).toContainText("100% of fit · rotated 90°");
  await dialog.getByRole("button",{name:"Reset view",exact:true}).click();await expect(dialog.getByRole("status")).toHaveText("100% of fit · rotated 0°");
  await dialog.getByRole("button",{name:"Actual size",exact:true}).click();
  const tiny=await dialog.getByRole("img",{name:"Anonymous drawing page 3",exact:true}).boundingBox();expect(tiny.width*tiny.height).toBeCloseTo(24,1);
  await dialog.getByRole("button",{name:"Fit page",exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await page.addScriptTag({path:fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js",import.meta.url))});
  expect(await page.evaluate(async()=> (await window.axe.run(".drawing-inspection-dialog",{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}})).violations.map(item=>item.id))).toEqual([]);
  await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
  await page.getByRole("switch",{name:"Dark mode",exact:true}).click();await opener.click();
  await expect(page.getByRole("dialog",{name:"Anonymous drawing page 3",exact:true})).toBeVisible();
  expect(await page.evaluate(async()=> (await window.axe.run(".drawing-inspection-dialog",{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}})).violations.map(item=>item.id))).toEqual([]);
  await page.keyboard.press("Escape");await expect(opener).toBeFocused();
  expect(state.calls.filter(([name])=>["admin_claim_drawing_review","admin_return_drawing_review","admin_review_drawing","admin_release_drawing_review"].includes(name))).toEqual([]);expect(state.unexpected).toEqual([]);
});

test("expired or revoked private links clear the image and any open inspection",async({page})=>{
  const now=new Date();await page.clock.install({time:now});const state=await reviewer(page);
  await page.getByRole("button",{name:"Inspect page 1, anonymous drawing",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Anonymous drawing page 1",exact:true})).toBeVisible();
  await page.clock.fastForward(300_001);
  await expect(page.getByRole("dialog")).toHaveCount(0);await expect(page.getByRole("img",{name:/Anonymous drawing page/})).toHaveCount(0);
  await expect(page.getByText("Private links expired. Open the images again to continue.")).toBeVisible();
  await page.getByRole("button",{name:"Open private images",exact:true}).click();await expect(page.getByRole("img",{name:"Anonymous drawing page 1",exact:true})).toBeVisible();
  state.denied=true;await page.getByRole("button",{name:"Refresh private images",exact:true}).click();
  await expect(page.getByRole("img",{name:/Anonymous drawing page/})).toHaveCount(0);
  await expect(page.getByText("Private diagnostic must not be reflected")).toHaveCount(0);
  await expect(page.getByText("That review changed or is no longer available. Refresh your reviews to load current work.")).toBeVisible();
  await expect(page.getByLabel("Feedback")).toHaveCount(0);await expect(page.getByRole("heading",{name:"My drawing reviews",exact:true})).toBeFocused();
  expect(state.unexpected).toEqual([]);
});

test("an original-size drawing retains native pixels and keyboard scrolling after viewport changes",async({page})=>{
  const state=await reviewer(page);state.images=[largeDrawingPage()];
  await page.getByRole("button",{name:"Refresh private images",exact:true}).click();
  await page.getByRole("button",{name:"Inspect page 1, anonymous drawing",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Anonymous drawing page 1",exact:true});
  await dialog.getByRole("button",{name:"Actual size",exact:true}).click();
  await expect(dialog.getByRole("button",{name:"Actual size",exact:true})).toBeDisabled();
  await page.setViewportSize({width:320,height:740});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect.poll(async()=>Math.round((await dialog.getByRole("img",{name:"Anonymous drawing page 1",exact:true}).boundingBox())?.width??0)).toBe(2400);
  const bounds=await dialog.getByRole("img",{name:"Anonymous drawing page 1",exact:true}).boundingBox();
  expect(Math.round(bounds.width)).toBe(2400);expect(Math.round(bounds.height)).toBe(1600);
  const viewport=dialog.getByRole("region",{name:"Anonymous drawing page 1 scrollable image",exact:true});
  await viewport.focus();await expect(viewport).toBeFocused();await page.keyboard.press("Home");await expect.poll(()=>viewport.evaluate(element=>element.scrollTop)).toBe(0);
  const before=await viewport.evaluate(element=>element.scrollTop);await page.keyboard.press("ArrowDown");
  await expect.poll(()=>viewport.evaluate(element=>element.scrollTop)).toBeGreaterThan(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await dialog.getByRole("button",{name:"Fit page",exact:true}).click();await expect(dialog.getByRole("status")).toContainText("100% of fit");
  await page.keyboard.press("Escape");expect(state.unexpected).toEqual([]);
});

test("transparent ink can be inspected against light and dark paper without altering the image",async({page})=>{
  const state=await reviewer(page),bytes=await readFile(new URL("../fixtures/drawing-images/transparent-ink.png",import.meta.url));
  state.images=[{id:"transparent-ink",ordinal:1,mimeType:"image/png",width:2,height:2,orientation:1,url:"data:image/png;base64,"+bytes.toString("base64")}];
  await page.getByRole("button",{name:"Refresh private images",exact:true}).click();await page.getByRole("button",{name:"Inspect page 1, anonymous drawing",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Anonymous drawing page 1",exact:true}),frame=dialog.locator(".drawing-image-canvas");
  await expect(dialog.getByRole("img",{name:"Anonymous drawing page 1",exact:true})).toBeVisible();
  expect(await sampleScreenshot(page,await frame.screenshot(),2,2)).toEqual(Array.from({length:4},()=>[255,255,255]));
  const original=await dialog.getByRole("img").getAttribute("src");await dialog.getByRole("button",{name:"Dark background",exact:true}).click();
  await expect(dialog.getByRole("button",{name:"Dark background",exact:true})).toHaveAttribute("aria-pressed","true");
  const pixels=await sampleScreenshot(page,await frame.screenshot(),2,2);
  await expect(frame).toHaveCSS("background-color","rgb(22, 40, 36)");
  // High-DPI resampling can blend the transparent pixel's boundary with its white neighbour.
  expect(pixels[0].every(channel=>channel>=250)).toBe(true);expect(pixels[1].every(channel=>channel<90)).toBe(true);
  expect(await dialog.getByRole("img").getAttribute("src")).toBe(original);await page.keyboard.press("Escape");expect(state.unexpected).toEqual([]);
});

test("students can inspect only saved pages, then remove a page and clear its private preview",async({page})=>{
  const images=(await orientationPages(6)).slice(0,1),state={items:images.map(image=>({...image,url:undefined,byteSize:121})),opens:[],removed:[]};
  const provider=await stubPortalProvider(page,(procedure,input)=>{
    if(procedure==="read_attempt")return{id:attemptId,title:"Fictional saved drawing",status:"submitted",resultsPending:true,
      serverNow:new Date().toISOString(),deadline:new Date(Date.now()-1000).toISOString(),uploadDeadline:new Date(Date.now()+600_000).toISOString(),
      questions:[],drawingUploadTasks:[{id:questionId,prompt:"An original fictional sketch."}]};
    if(procedure==="my_exam_mock_session"||procedure==="my_exam_mock_report")return null;
    if(procedure==="drawing-media"){
      if(input.action==="list")return{items:state.items};
      if(input.action==="pages"){state.opens.push(input);return{images};}
      if(input.action==="page")return{images};
      if(input.action==="remove"){state.removed.push(input);state.items=[];return{removed:input.id};}
    }
  });
  await page.goto("/account");await seedPortalSession(page,account);await page.goto("/attempt/"+attemptId);
  await page.getByRole("button",{name:"View saved images",exact:true}).click();
  await expect(page.getByRole("img",{name:"Your drawing page 1",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Inspect page 1, your drawing",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Your drawing page 1",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Close image",exact:true}).click();
  await page.getByRole("button",{name:"Remove image 1",exact:true}).click();
  await expect(page.getByText("Drawing image removed.",{exact:true})).toBeVisible();
  await expect(page.getByRole("img",{name:"Your drawing page 1",exact:true})).toHaveCount(0);await expect(page.getByRole("button",{name:"View saved images",exact:true})).toHaveCount(0);
  expect(state.opens).toEqual([{action:"pages",attemptId,questionId}]);expect(state.removed).toEqual([{action:"remove",id:images[0].id}]);expect(provider.unexpected).toEqual([]);
});

test("private link lifetime uses the server clock when the device clock differs",async({page})=>{
  const now=new Date();await page.clock.install({time:now});const state=await reviewer(page);
  state.serverNow="2026-01-01T00:00:00Z";state.expiresAt="2026-01-01T00:05:00Z";
  await page.getByRole("button",{name:"Refresh private images",exact:true}).click();
  await expect(page.getByRole("img",{name:"Anonymous drawing page 3",exact:true})).toBeVisible();
  await page.clock.fastForward(299_000);await expect(page.getByRole("img",{name:"Anonymous drawing page 3",exact:true})).toBeVisible();
  await page.clock.fastForward(1001);await expect(page.getByRole("img",{name:/Anonymous drawing page/})).toHaveCount(0);
  expect(state.unexpected).toEqual([]);
});

test("rapidly opening another saved student page ignores the previous dialog close",async({page})=>{
  const images=(await orientationPages(6)).slice(0,3);
  const provider=await stubPortalProvider(page,(procedure,input)=>{
    if(procedure==="read_attempt")return{id:attemptId,title:"Fictional rapid saved drawing inspection",status:"submitted",resultsPending:true,
      serverNow:new Date().toISOString(),deadline:new Date(Date.now()-1000).toISOString(),uploadDeadline:new Date(Date.now()+600_000).toISOString(),
      questions:[],drawingUploadTasks:[{id:questionId,prompt:"An original fictional sketch."}]};
    if(procedure==="my_exam_mock_session"||procedure==="my_exam_mock_report")return null;
    if(procedure==="drawing-media")return input.action==="list"?{items:images}:{images};
  });
  await page.goto("/account");await seedPortalSession(page,account);await page.goto("/attempt/"+attemptId);
  await page.getByRole("button",{name:"View saved images",exact:true}).press("Enter");
  await page.getByRole("button",{name:"Inspect page 1, your drawing",exact:true}).press("Enter");
  const first=page.getByRole("dialog",{name:"Your drawing page 1",exact:true});await expect(first.getByRole("img")).toBeVisible();
  // Native close restores focus before its queued close event. Select the next
  // page in that same task to exercise that real ordering deterministically.
  await first.evaluate(dialog=>{window.previousDrawingDialog=dialog;dialog.close();const opener=document.querySelector('[aria-label="Inspect page 2, your drawing"]');opener.focus();opener.click();});
  const next=page.getByRole("dialog",{name:"Your drawing page 2",exact:true});await expect(next).toBeVisible();await expect(next.getByRole("img")).toBeVisible();
  await page.evaluate(()=>window.previousDrawingDialog.dispatchEvent(new Event("close")));
  await expect(next).toBeVisible();await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Inspect page 2, your drawing",exact:true})).toBeFocused();
  expect(provider.unexpected).toEqual([]);
});

test("switching accounts clears a student's inspection before the next attempt read completes",async({page})=>{
  const images=(await orientationPages(6)).slice(0,1);let switched=false,release,completed;
  const held=new Promise(resolve=>{release=resolve;}),finished=new Promise(resolve=>{completed=resolve;});
  const provider=await stubPortalProvider(page,procedure=>{
    if(procedure==="read_attempt")return{id:attemptId,title:"Fictional private account drawing",status:"submitted",resultsPending:true,
      serverNow:new Date().toISOString(),deadline:new Date(Date.now()-1000).toISOString(),uploadDeadline:new Date(Date.now()+600_000).toISOString(),
      questions:[],drawingUploadTasks:[{id:questionId,prompt:"An original fictional sketch."}]};
    if(procedure==="my_exam_mock_session"||procedure==="my_exam_mock_report")return null;
    if(procedure==="drawing-media")return{items:images,images};
  });
  const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
  await page.route("https://dmocks-portal-fixture.supabase.co/rest/v1/rpc/read_attempt",async route=>{
    if(!switched)return route.fallback();
    if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers});
    await held;
    try{await route.fulfill({status:403,headers,json:{code:"42501",message:"Not your attempt"}});}finally{completed();}
  });
  await page.goto("/account");await seedPortalSession(page,account);await page.goto("/attempt/"+attemptId);
  await page.getByRole("button",{name:"View saved images",exact:true}).click();
  await page.getByRole("button",{name:"Inspect page 1, your drawing",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Your drawing page 1",exact:true})).toBeVisible();
  const oldPhoto=await page.getByRole("dialog").getByRole("img").getAttribute("src");
  expect(oldPhoto).toMatch(/^blob:/);
  await page.evaluate(()=>{const revoke=URL.revokeObjectURL.bind(URL);window.revokedDrawingURLs=[];URL.revokeObjectURL=url=>{window.revokedDrawingURLs.push(url);revoke(url);};});
  switched=true;
  await seedPortalSession(page,{id:"00000000-0000-4000-8000-000000000482",email:"other-inspection@example.invalid"});
  const nextRead=page.waitForRequest(request=>request.url().endsWith("/rpc/read_attempt")&&request.method()==="POST");
  await page.evaluate(()=>{
    const key="sb-dmocks-portal-fixture-auth-token",channel=new BroadcastChannel(key);
    channel.postMessage({event:"SIGNED_IN",session:JSON.parse(localStorage.getItem(key))});channel.close();
  });
  await nextRead;
  await expect.poll(()=>page.evaluate(url=>window.revokedDrawingURLs.includes(url),oldPhoto)).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);await expect(page.getByRole("img",{name:/Your drawing page/})).toHaveCount(0);
  await expect(page.getByText("Loading your attempt…",{exact:true})).toBeVisible();
  release();await finished;
  await expect(page.getByRole("alert")).toContainText("This attempt is unavailable");
  await expect(page.getByRole("img",{name:/Your drawing page/})).toHaveCount(0);expect(provider.unexpected).toEqual([]);
});

test("leaving a student attempt cancels a pending private gallery and ignores its late response",async({page})=>{
  const images=(await orientationPages(6)).slice(0,1);let release,completed;
  const held=new Promise(resolve=>{release=resolve;}),finished=new Promise(resolve=>{completed=resolve;});
  const provider=await stubPortalProvider(page,procedure=>{
    if(procedure==="read_attempt")return{id:attemptId,title:"Fictional pending image",status:"submitted",resultsPending:true,
      serverNow:new Date().toISOString(),deadline:new Date(Date.now()-1000).toISOString(),uploadDeadline:new Date(Date.now()+600_000).toISOString(),
      questions:[],drawingUploadTasks:[{id:questionId,prompt:"An original fictional sketch."}]};
    if(procedure==="my_exam_mock_session"||procedure==="my_exam_mock_report")return null;
    if(procedure==="finalize_my_expired_attempts")return 0;
    if(procedure==="my_pass")return{active:false};
    if(procedure==="my_attempt_history"||procedure==="available_papers")return[];
    if(procedure==="my_overview_analytics")return{completed:0,waitingForResults:0,objectiveAccuracy:null,objectiveAnswered:0,
      topics:[],exams:[],drawingReviews:{pending:0,released:0}};
  });
  const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
  await page.route("https://dmocks-portal-fixture.supabase.co/functions/v1/drawing-media",async route=>{
    if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers});
    const input=route.request().postDataJSON();
    if(input.action==="list")return route.fulfill({headers,json:{items:[{id:images[0].id,ordinal:1,mimeType:"image/png",byteSize:121}]}});
    await held;
    try{await route.fulfill({headers,json:{images}});}catch{/* The request is intentionally cancelled when its owner view unmounts. */}finally{completed();}
  });
  await page.goto("/account");await seedPortalSession(page,account);await page.goto("/attempt/"+attemptId);
  const requested=page.waitForRequest(request=>request.url().endsWith("/drawing-media")&&request.method()==="POST"&&request.postDataJSON()?.action==="pages");
  await page.getByRole("button",{name:"View saved images",exact:true}).click();await requested;
  await page.getByRole("link",{name:"Back to your workspace",exact:true}).click();await expect(page).toHaveURL(/\/dashboard$/);
  release();await finished;
  await expect(page.getByRole("heading",{name:/Welcome to your next attempt/})).toBeVisible();
  await expect(page.getByRole("img",{name:/Your drawing page/})).toHaveCount(0);await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(provider.unexpected).toEqual([]);
});
