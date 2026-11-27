import { test, expect } from "@playwright/test";
import { portalFixtureURL, seedPortalSession } from "./portal-fixture.js";

test.use({baseURL:portalFixtureURL});
test("one drawing with two photos counts once in navigation and the submit dialog, including after reload", async ({page}) => {
  const owner="00000000-0000-4000-8000-000000000394", id="10000000-0000-4000-8000-000000000394";
  const number="20000000-0000-4000-8000-000000000394", drawing="30000000-0000-4000-8000-000000000394";
  const pages=[];
  const q={options:[],negativePoints:0,points:5,marking:{max:5},media:[],answerRevision:0,topic:"Form"};
  const data=()=>({id,title:"Drawing progress fixture",status:"active",serverNow:new Date().toISOString(),
    deadline:new Date(Date.now()+3600000).toISOString(),uploadDeadline:new Date(Date.now()+4200000).toISOString(),
    yearDrawing:{maxMarks:5,sections:[]},questions:[
      {...q,id:number,ordinal:1,kind:"nat",prompt:"Enter a number.",answer:0},
      {...q,id:drawing,ordinal:2,kind:"drawing",prompt:"Draw a form.",answer:null,drawing:{criteria:[],instructions:[],maxImages:2,criteriaSource:"printed"}}
    ]});
  await page.route("https://dmocks-portal-fixture.supabase.co/**",async route=>{
    const req=route.request(), name=new URL(req.url()).pathname.split("/").at(-1);
    const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
    if(req.method()==="OPTIONS")return route.fulfill({status:204,headers});
    let body=null;
    if(name==="read_attempt") body=data();
    if(name==="user")body={id:owner,aud:"authenticated",app_metadata:{provider:"google"},user_metadata:{}};
    if(name==="my_drawing_uploads"){expect(req.postDataJSON()).toEqual({p_attempt_id:id,p_question_id:drawing});body=pages;}
    if(name==="drawing-media"){
      if(req.headers()["content-type"]?.startsWith("multipart/")){
        const form=await new Response(req.postDataBuffer(),{headers:{"Content-Type":req.headers()["content-type"]}}).formData();
        const ordinal=Number(form.get("ordinal"));body={id:"40000000-0000-4000-8000-00000000039"+ordinal,ordinal};pages.push(body);
      }else{
        const params=req.postDataJSON();
        if(params.action==="list")body={items:pages};
        if(params.action==="open")body={images:[]};
        if(params.action==="remove"){const index=pages.findIndex(item=>item.id===params.id);expect(index).toBeGreaterThanOrEqual(0);pages.splice(index,1);body={removed:params.id};}
      }
    }
    return route.fulfill({headers,contentType:"application/json",body:JSON.stringify(body)});
  });
  await page.goto("/account");await seedPortalSession(page,{id:owner,email:"drawing@example.invalid"});await page.goto("/attempt/"+id);
  const nav=page.getByRole("complementary",{name:"Question navigator"});
  const total=n=>expect(nav.getByText(n+" of 2 answered",{exact:true})).toBeVisible();
  await total(1);await page.getByRole("button",{name:"Go to question 2",exact:true}).click();
  await expect(page.getByRole("button",{name:"Add images"})).toBeEnabled();
  const png=Buffer.from(await page.evaluate(()=>document.createElement("canvas").toDataURL("image/png").split(",")[1]),"base64");
  const files=[1,2].map(n=>({name:n+".png",mimeType:"image/png",buffer:png}));
  await page.locator('input[type="file"][multiple]').setInputFiles(files);
  await expect(page.getByText("Drawing images saved privately.")).toBeVisible();await total(2);
  await expect(nav.getByRole("button",{name:"Go to question 2"})).toHaveAttribute("data-status","answered");
  await page.reload();await total(2);
  await nav.getByRole("button",{name:/Finish|Submit/}).click();await expect(page.getByRole("dialog")).toContainText("2 of 2 answered.");
  await page.keyboard.press("Escape");await page.getByRole("button",{name:"Go to question 2",exact:true}).click();
  await page.getByRole("button",{name:/^Remove /}).first().click();await expect(page.getByRole("button",{name:/^Remove /})).toHaveCount(1);await total(2);
  await page.getByRole("button",{name:/^Remove /}).click();await total(1);
  await page.reload();await total(1);await nav.getByRole("button",{name:/Finish|Submit/}).click();
  await expect(page.getByRole("dialog")).toContainText("1 of 2 answered.");
});
