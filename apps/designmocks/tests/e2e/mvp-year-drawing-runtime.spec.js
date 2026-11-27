import { test, expect } from '@playwright/test';
import { prepareDrawingImage } from '../../supabase/functions/_shared/drawing-image.mjs';
import { portalFixtureURL, seedPortalSession } from './portal-fixture.js';

test.use({baseURL:portalFixtureURL});
const student='00000000-0000-4000-8000-000000000386', attemptId='10000000-0000-4000-8000-000000000386';
const questionId='20000000-0000-4000-8000-000000000386';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};

test('historical drawing locks answers, accepts only photos during grace and exposes calibrated review state',async({page})=>{
  let cutoff=Date.now()+3600000, submitted=false, completeUpload, reevaluated=false;
  const uploadGate = new Promise(resolve => { completeUpload = resolve; });
  const q={id:questionId,ordinal:1,kind:'drawing',label:'TASK B1',topic:'Form',prompt:'Draw two original shapes.',options:[],points:20,
    negativePoints:0,marking:{max:20},media:[],answer:null,answerRevision:0,
    drawing:{criteria:[{id:'form',label:'Shape and proportion',max:20}],criteriaSource:'printed',maxImages:2,instructions:['Use a pencil.']}};
  const attempt=()=>({id:attemptId,title:'Fictional authored year paper',status:submitted?'submitted':'active',
    yearDrawing:{maxMarks:20,sections:[]},serverNow:new Date().toISOString(),deadline:new Date(cutoff).toISOString(),
    uploadDeadline:new Date(submitted?Date.now()-1000:cutoff+600000).toISOString(),score:submitted?0:null,total:submitted?0:null,
    questions:[submitted?{...q,drawingEstimate:reevaluated?{status:'evaluating'}:{status:'awaiting_teacher',flags:['illegible','not_a_drawing'],canReevaluate:true},explanation:'Consider the proportions.'}:q]});
  await page.route('https://dmocks-portal-fixture.supabase.co/**',async route=>{
    const req=route.request(),name=new URL(req.url()).pathname.split('/').at(-1);
    if(req.method()==='OPTIONS')return route.fulfill({headers,status:204});
    let reply=null;
    if(name==='user')reply={id:student,aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}};
    if(name==='read_attempt')reply=attempt();
    if(name==='reevaluate_year_drawing'){expect(req.postDataJSON()).toEqual({p_attempt_id:attemptId,p_question_id:questionId});reevaluated=true;reply={status:'evaluating',canReevaluate:false};}
    if(name==='submit_attempt'){submitted=true;reply=attempt();}
    if(name==='drawing-media') {
      if(req.headers()['content-type']?.startsWith('multipart/')) {
        const form=await new Response(req.postDataBuffer(),{headers:{'Content-Type':req.headers()['content-type']}}).formData();
        expect(form.get('file').type).toBe('image/jpeg');
        const checked=await prepareDrawingImage(new Uint8Array(await form.get('file').arrayBuffer()),'image/jpeg');
        expect([checked.width,checked.height]).toEqual([48,96]);
        await uploadGate;
        reply={id:'30000000-0000-4000-8000-000000000386',ordinal:1};
      } else reply=req.postDataJSON().action==='list'?{items:[]}:{images:[],expiresAt:new Date().toISOString(),serverNow:new Date().toISOString()};
    }
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
  const png=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=c.height=32;
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file][multiple]').setInputFiles({name:'test-page.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  const finish=page.getByRole('button',{name:'Submit paper and finish uploads'});
  await expect(finish).toBeDisabled();
  await expect(page.getByRole('img',{name:'Page 1 before upload'})).toBeVisible();
  await page.getByRole('button',{name:'Discard selection'}).click();
  await expect(finish).toBeEnabled();
  // A synthetic 96 x 48 HEIC of three color bars, created for this test.
  const syntheticHeic = 'AAAAJGZ0eXBoZWljAAAAAG1pZjFNaVBybWlhZk1pSEJoZWljAAABhm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAHBpY3QAAAAAAAAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAADnBpdG0AAAAAAAEAAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABodmMxAAAAAOZpcHJwAAAAxWlwY28AAAATY29scm5jbHgAAgACAAaAAAAADGNsbGkAywBAAAAAFGlzcGUAAAAAAAAAYAAAADAAAAAJaXJvdAAAAAAQcGl4aQAAAAADCAgIAAAAcWh2Y0MBA3AAAACwAAAAAAAe8AD8/fj4AAALA6AAAQAXQAEMAf//A3AAAAMAsAAAAwAAAwAecCShAAEAI0IBAQNwAAADALAAAAMAAAMAHqAUIEHBDE4h7kWVTcCAgYAgogABAAlEAcBhcshEU2QAAAAZaXBtYQAAAAAAAAABAAEGgQIDhAWGAAAAHmlsb2MAAAAARAAAAQABAAAAAQAAAboAAABhAAAAAW1kYXQAAAAAAAAAcQAAAF0oAa+jzYAqtP/7Af/8Yay8D/X5t74ea+NGth+MNj/5Tq810ymQ3b74CdxozUqzhry4eTBcVSivo15Ny3VIrv3JhdXo9m9bp3djnzpMZ/oumv0LGdA9S5xivn4RFmA=';
  await page.locator('input[type=file][multiple]').setInputFiles({name:'phone.heic',mimeType:'image/heic',buffer:Buffer.from(syntheticHeic,'base64')});
  await page.getByRole('button',{name:'Rotate page 1 clockwise'}).click({timeout:30000});
  await page.getByRole('button',{name:'Save photo',exact:true}).click();
  await expect(finish).toBeDisabled();
  completeUpload();
  await expect(page.getByText('Drawing images saved privately.')).toBeVisible();
  await expect(finish).toBeEnabled();await finish.click();
  await page.getByRole('button',{name:'Open answer review'}).click();
  await expect(page.getByText('Score: awaiting teacher review.')).toBeVisible();
  await expect(page.getByText('Parts of the drawing are hard to make out')).toHaveCount(0);
  await expect(page.locator('.drawing-flags,.drawing-estimate-note')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Add images'})).toHaveCount(0);
  await page.getByRole('button',{name:'Try re-evaluating'}).click();
  await expect(page.getByText('Evaluating your drawing…', {exact:false})).toBeVisible();
});
