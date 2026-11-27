import { expect, test } from '@playwright/test';
import { portalFixtureURL, seedPortalSession } from './portal-fixture.js';
test.use({baseURL:portalFixtureURL});

test('student selects a printed option before adding drawing photos and sees each authored subpart',async({page})=>{
  const user='00000000-0000-4000-8000-000000000390',attempt='10000000-0000-4000-8000-000000000390',qid='20000000-0000-4000-8000-000000000390';
  let selected=null;
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
  await page.route('https://dmocks-portal-fixture.supabase.co/**',async route=>{
    const req=route.request(),name=new URL(req.url()).pathname.split('/').at(-1);
    if(req.method()==='OPTIONS')return route.fulfill({headers,status:204});
    let json=null;
    if(name==='user')json={id:user,aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}};
    if(name==='choose_year_drawing_task') {
      const body=req.postDataJSON();expect(body.p_attempt_id).toBe(attempt);expect(body.p_question_id).toBe(qid);
      selected=body.p_alternative;
    }
    if(name==='read_attempt')json={id:attempt,title:'Fictional studio exercise',status:'active',serverNow:new Date().toISOString(),
      deadline:new Date(Date.now()+3600000).toISOString(),yearDrawing:{maxMarks:20},questions:[{
        id:qid,ordinal:1,kind:'drawing',label:'TASK B2',prompt:'Illustrate a familiar scene.',topic:'drawing',points:20,negativePoints:0,
        marking:{max:20},media:[],answer:null,answerRevision:0,options:[],
        drawing:{maxImages:3,criteria:[{id:'form',label:'Form',max:20}],criteriaSource:'printed',instructions:[],
          alternatives:[{id:'A',label:'A quiet room'},{id:'B',label:'A busy street'}],subParts:[{id:'i',label:'A pencil outline',marks:12},{id:'ii',label:'Lighting',marks:8}]},
        drawingChoice:{group:'Choose one task',selected:!!selected,alternative:selected,uploadAllowed:!!selected}
      }]};
    if(name==='drawing-media')json={items:[]};
    return route.fulfill({headers,contentType:'application/json',body:JSON.stringify(json)});
  });
  await page.goto('/account');await seedPortalSession(page,{id:user,email:'studio@example.invalid'});await page.goto('/attempt/'+attempt);
  const option=page.getByRole('radio',{name:'B. A busy street'});
  await expect(option).toBeVisible({timeout:30000});
  await expect(page.getByRole('button',{name:'Add images'})).toHaveCount(0);
  await expect(page.getByText('i. A pencil outline')).toBeVisible();
  await option.check();
  await expect(option).toBeChecked();await expect(page.getByRole('button',{name:'Add images'})).toBeEnabled();
  await page.reload();await expect(page.getByRole('radio',{name:'B. A busy street'})).toBeChecked();
});
