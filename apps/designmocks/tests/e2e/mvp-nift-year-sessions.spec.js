import {test,expect} from "@playwright/test";
import {portalFixtureURL,seedPortalSession} from "./portal-fixture.js";
test.use({baseURL: process.env.DMOCKS_NIFT_SESSION_FIXTURE_URL || portalFixtureURL});
const student="00000000-0000-4000-8000-000000000391", id="10000000-0000-4000-8000-000000000391";
const gatId="20000000-0000-4000-8000-000000000391", catId="20000000-0000-4000-8000-000000000392";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const gat={id:gatId,ordinal:1,kind:"mcq",topic:"Logic",prompt:"Which shape has three sides?",options:[{id:"A",label:"Triangle"},{id:"B",label:"Square"}],points:1,negativePoints:0,
  marking:{correct:1,wrong:0},media:[],answer:null,answerRevision:0};
const cat={id:catId,ordinal:2,kind:"drawing",label:"TASK B1",topic:"Form",prompt:"Create a fictional paper sculpture.",options:[],points:30,negativePoints:0,
  marking:{max:30},media:[],answer:null,answerRevision:0,drawing:{criteria:[{id:"form",label:"Form and balance",max:30}],criteriaSource:"inferred",maxImages:3,instructions:[]}};
test("NIFT historical GAT submission opens the timed CAT break, resumes, then enters photo-only grace",async({page},testInfo)=>{
  const shot=async(name)=>{if(process.env.DMOCKS_NIFT_SESSION_SCREENSHOTS) await page.screenshot({path:process.env.DMOCKS_NIFT_SESSION_SCREENSHOTS+"/"+testInfo.project.name+"-"+name+".png",fullPage:true});};
  let phase="gat", cutoff=Date.now()+7200000, starts=0, savedAnswer=null;
  const state=()=>({id,title:"NIFT · Fictional session test",status:phase==="completed"?"submitted":"active",yearDrawing:{maxMarks:30,sections:[]},
    niftSession:{phase},serverNow:new Date().toISOString(),deadline:new Date(cutoff).toISOString(),uploadDeadline:phase==="gat"?null:new Date(cutoff+600000).toISOString(),
    questions:phase==="gat"?[gat]:phase==="cat"?[cat]:[gat,{...cat,drawingEstimate:{status:"not_attempted"},explanation:"Fictional model notes."}],
    score:phase==="completed"?0:null,total:phase==="completed"?1:null});
  await page.route("https://dmocks-portal-fixture.supabase.co/**",async route=>{
    const req=route.request(), name=new URL(req.url()).pathname.split("/").at(-1);
    if(req.method()==="OPTIONS")return route.fulfill({headers,status:204});
    let reply=null;
    if(name==="user")reply={id:student,aud:"authenticated",app_metadata:{provider:"google"},user_metadata:{}};
    if(name==="read_attempt")reply=state();
    if(name==="save_answer_revision"){const body=req.postDataJSON();savedAnswer=body.p_answer;reply={accepted:true,answer:savedAnswer,revision:body.p_revision};}
    if(name==="finish_nift_year_gat"){starts++;phase="cat";cutoff=Date.now()+10800000;reply=state();}
    if(name==="submit_attempt"){phase="completed";reply=state();}
    if(name==="drawing-media")reply=req.postDataJSON().action==="list"?{items:[]}:{images:[],expiresAt:new Date().toISOString(),serverNow:new Date().toISOString()};
    return route.fulfill({headers,contentType:"application/json",body:JSON.stringify(reply)});
  });
  await page.goto("/account"); await seedPortalSession(page,{id:student,email:"student@example.invalid"}); await page.goto("/attempt/"+id);
  await expect(page.getByText(gat.prompt)).toBeVisible();await expect(page.getByText(cat.prompt)).toHaveCount(0);
  await page.getByRole("button",{name:"A Triangle"}).click();
  await expect.poll(()=>savedAnswer).toBe("A");
  await shot("gat");
  await page.getByRole("button",{name:"Review & finish GAT"}).click();
  await page.getByRole("button",{name:"Finish GAT & start CAT"}).click();
  await expect(page.getByRole("heading",{name:"Your GAT is complete."})).toBeVisible(); await shot("transition");
  await page.reload();
  await expect(page.getByRole("timer",{name:"CAT time remaining"})).toBeVisible();
  await page.addScriptTag({path:"node_modules/axe-core/axe.min.js"});
  expect(await page.evaluate(async()=> (await window.axe.run('[aria-labelledby="nift-cat-start-heading"]',
    {runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}})).violations.map(item=>item.id))).toEqual([]);
  const openCat=page.getByRole("button",{name:"Open CAT drawing tasks"});
  await openCat.focus(); await page.keyboard.press("Enter");
  await expect(page.getByText(cat.prompt)).toBeVisible(); await expect(page.getByText(gat.prompt)).toHaveCount(0);
  await shot("cat");
  cutoff=Date.now()-10000; await page.reload();
  await expect(page.getByRole("heading",{name:"Time’s up. Upload your drawings."})).toBeVisible();
  await expect(page.getByRole("button",{name:"Add images"})).toBeEnabled();
  await shot("grace");
  await page.getByRole("button",{name:"Submit paper and finish uploads"}).click();
  await expect(page.getByRole("button",{name:"Open answer review"})).toBeVisible();
  expect(starts).toBe(1);
});
