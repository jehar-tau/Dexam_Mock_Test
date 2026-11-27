import { test, expect } from '@playwright/test';
import { portalFixtureURL, seedPortalSession } from './portal-fixture.js';

test.use({baseURL:portalFixtureURL});
const student='00000000-0000-4000-8000-000000000386', attemptId='10000000-0000-4000-8000-000000000386';
const questionId='20000000-0000-4000-8000-000000000386';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};

test('historical drawing locks answers, accepts only photos during grace and exposes calibrated review state',async({page})=>{
  let cutoff=Date.now()+3600000, submitted=false;
  const q={id:questionId,ordinal:1,kind:'drawing',label:'TASK B1',topic:'Form',prompt:'Draw two original shapes.',options:[],points:20,
    negativePoints:0,marking:{max:20},media:[],answer:null,answerRevision:0,
    drawing:{criteria:[{id:'form',label:'Shape and proportion',max:20}],criteriaSource:'printed',maxImages:2,instructions:['Use a pencil.']}};
  const attempt=()=>({id:attemptId,title:'Fictional authored year paper',status:submitted?'submitted':'active',
    yearDrawing:{maxMarks:20,sections:[]},serverNow:new Date().toISOString(),deadline:new Date(cutoff).toISOString(),
    uploadDeadline:new Date(submitted?Date.now()-1000:cutoff+600000).toISOString(),score:submitted?0:null,total:submitted?0:null,
    questions:[submitted?{...q,drawingEstimate:{status:'awaiting_teacher',flags:['illegible']},explanation:'Consider the proportions.'}:q]});
  await page.route('https://dmocks-portal-fixture.supabase.co/**',async route=>{
    const req=route.request(),name=new URL(req.url()).pathname.split('/').at(-1);
    if(req.method()==='OPTIONS')return route.fulfill({headers,status:204});
    let reply=null;
    if(name==='user')reply={id:student,aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}};
    if(name==='read_attempt')reply=attempt();
    if(name==='submit_attempt'){submitted=true;reply=attempt();}
    if(name==='drawing-media')reply=req.postDataJSON().action==='list'?{items:[]}:{images:[],expiresAt:new Date().toISOString(),serverNow:new Date().toISOString()};
    return route.fulfill({headers,contentType:'application/json',body:JSON.stringify(reply)});
  });
  await page.goto('/account'); await seedPortalSession(page,{id:student,email:'student@example.invalid'}); await page.goto('/attempt/'+attemptId);
  await expect(page.getByRole('heading',{name:'How it’s marked'})).toBeVisible({timeout:30000});
  await expect(page.getByText('Shape and proportion')).toBeVisible();
  await expect(page.getByText('Add up to 2 photos', {exact:false})).toBeVisible();
  cutoff=Date.now()-5000; await page.reload();
  await expect(page.getByRole('heading',{name:'Time’s up. Upload your drawings.'})).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Add images'})).toBeEnabled();
  await page.getByRole('button',{name:'Submit paper and finish uploads'}).click();
  await page.getByRole('button',{name:'Open answer review'}).click();
  await expect(page.getByText('Score: awaiting teacher review.')).toBeVisible();
  await expect(page.getByText('Parts of the drawing are hard to make out')).toBeVisible();
  await expect(page.getByRole('button',{name:'Add images'})).toHaveCount(0);
});
