import {test,expect} from '@playwright/test';
import {portalFixtureURL,seedPortalSession} from './portal-fixture.js';
test.use({baseURL:portalFixtureURL});
const first={id:'00000000-0000-4000-8000-000000000961',email:'fictional-exam-one@example.invalid'},second={id:'00000000-0000-4000-8000-000000000962',email:'fictional-exam-two@example.invalid'};
const attemptId='10000000-0000-4000-8000-000000000961',questionId='20000000-0000-4000-8000-000000000961',partB='10000000-0000-4000-8000-000000000962';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-api-version','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
const actor=request=>{try{return JSON.parse(Buffer.from(request.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub;}catch{return null;}};
async function fixture(page,options={}){
 const state={identity:options.identity??null,authStatus:200,authHold:null,heldAuth:0,readHold:null,heldReads:0,finishedReads:0,saveHold:null,finishedSaves:0,startHold:null,finishedStarts:0,saveReceipt:undefined,submitStatus:200,readMedia:false,calls:[],deadline:new Date(Date.now()+3600000).toISOString(),...options};
 await page.route('https://dmocks-portal-fixture.supabase.co/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;if(request.method()==='OPTIONS')return route.fulfill({headers,status:204});
  const who=actor(request);
  if(path==='/auth/v1/user'){const identity=state.identity??who,status=state.authStatus,held=state.authHold;if(held){state.heldAuth++;await held.promise;}return route.fulfill({headers,status,json:status===200?{id:identity,aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}}:{code:'unexpected_failure',message:'Fictional provider private diagnostic'}}).catch(()=>{});}
  const name=path.split('/').at(-1),multipart=request.headers()['content-type']?.startsWith('multipart/'),input=multipart?{multipart:true}:request.postDataJSON()??{};state.calls.push({name,actor:who,input});
  let data,status=200;
  const question={id:questionId,ordinal:1,kind:state.drawing?'drawing':'mcq',topic:'observation',prompt:who===second.id?'Original fictional second account question':'Original fictional first account question',options:[{id:'A',label:'Fictional first choice'},{id:'B',label:'Fictional second choice'}],marking:{correct:3,wrong:-1},points:3,negativePoints:1,media:state.readMedia?[{path:'fictional-figure.png',alt:'Fictional figure'}]:[],answer:null,answerRevision:0};
  if(name==='read_attempt'){
   const held=state.readHold;if(held){state.heldReads++;await held.promise;}
   data={id:attemptId,title:'Original fictional timed paper',status:state.submitted?'submitted':'active',serverNow:state.serverNow??new Date().toISOString(),deadline:state.deadline,questions:state.submitted?[]:[question],score:0,total:3,examResultsPending:!!state.partBReady,resultsPending:!!state.submitted&&!state.partBReady,uploadDeadline:state.submitted?new Date(Date.now()+600000).toISOString():null,drawingUploadTasks:state.submitted?[{id:questionId,prompt:'Original fictional drawing task'}]:[]};
  }else if(name==='my_exam_mock_session')data=state.partBReady?{exam:'uceed',partAAttemptId:attemptId,partBState:'ready',partBTaskCount:2,partBDurationSeconds:3600,partBOpensAt:new Date(Date.now()-1000).toISOString()}:null;
  else if(name==='my_exam_mock_report')data=null;
  else if(name==='save_answer_revision'){const held=state.saveHold;if(held)await held.promise;data=state.saveReceipt===undefined?{accepted:true,answer:input.p_answer,revision:input.p_revision}:state.saveReceipt;}
  else if(name==='submit_attempt'){status=state.submitStatus;data=status===200?{id:attemptId,title:'Original fictional timed paper',status:'submitted',serverNow:state.serverNow??new Date().toISOString(),deadline:state.deadline,questions:[{...question,outcome:'incorrect',explanation:'Original fictional explanation'}],score:0,total:3}:{code:'P0001',message:'SECRET_FICTIONAL_PROVIDER_DETAIL'};}
  else if(name==='report_attempt_question'){if(state.reportReply)await state.reportReply.promise;data={reportCount:1,threshold:5,held:false};}
  else if(name==='attempt-media'){
   if(state.figureReply)await state.figureReply.promise;
   data={media:{[questionId]:[{url:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/%3E'}]}};
  }
  else if(name==='drawing-media')data=multipart?{id:'30000000-0000-4000-8000-000000000961',ordinal:1}:input.action==='list'?{items:[]}:{images:[]};
  else if(name==='start_exam_mock_part_b'){if(state.startHold)await state.startHold.promise;data=partB;}
  else throw new Error('Unexpected fictional attempt request: '+name);
  await route.fulfill({headers,status,json:data}).catch(()=>{});if(name==='read_attempt')state.finishedReads++;if(name==='save_answer_revision')state.finishedSaves++;if(name==='start_exam_mock_part_b')state.finishedStarts++;
 });
 await page.goto('/account');await seedPortalSession(page,first);await page.goto('/attempt/'+attemptId);return state;
}
const answer=page=>page.getByRole('button',{name:'B Fictional second choice',exact:true});
const privateQuestion=page=>page.getByRole('heading',{name:'Original fictional first account question',exact:true});
const calls=(state,name)=>state.calls.filter(item=>item.name===name);
const journal=page=>page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.startsWith('dmocks:pending-answer:')).map(([key,value])=>({key,...JSON.parse(value)})));
test('the active exam verifies identity before reading its frozen private paper',async({page})=>{
 const state=await fixture(page,{identity:second.id});await expect(page.getByRole('alert')).toContainText('Attempt access');expect(calls(state,'read_attempt')).toEqual([]);await expect(privateQuestion(page)).toHaveCount(0);
});
test('a silent account change cannot dispatch another account answer and keeps the original device journal',async({page})=>{
 const state=await fixture(page);await expect(answer(page)).toBeEnabled();await seedPortalSession(page,second);await answer(page).click();await expect(page.getByRole('alert')).toContainText('Attempt access');expect(calls(state,'save_answer_revision')).toEqual([]);await expect(privateQuestion(page)).toHaveCount(0);const entries=await journal(page);expect(entries).toHaveLength(1);expect(entries[0].key).toContain(first.id);expect(entries[0].answer).toBe('B');
});
test('question reporting verifies the account before sending the private explanation',async({page})=>{
 const state=await fixture(page);await expect(answer(page)).toBeEnabled();await page.getByRole('button',{name:'Report question',exact:true}).press('Enter');await page.getByLabel('Details (optional)',{exact:true}).fill('Fictional private report draft');await seedPortalSession(page,second);await page.getByRole('button',{name:'Send report',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Attempt access');expect(calls(state,'report_attempt_question')).toEqual([]);await expect(page.getByRole('textbox')).toHaveCount(0);
});
test('a held question report receipt cannot show after a silent account change', async ({ page }) => {
 const reportReply = deferred();
 const state = await fixture(page, { reportReply });
 await expect(answer(page)).toBeEnabled();
 await page.getByRole('button', { name: 'Report question', exact: true }).press('Enter');
 const details = 'Original fictional private report draft';
 const draft = page.getByLabel('Details (optional)', { exact: true });
 await draft.fill(details);
 await page.getByRole('button', { name: 'Send report', exact: true }).click();
 await expect.poll(() => calls(state, 'report_attempt_question')).toEqual([{
  name: 'report_attempt_question', actor: first.id,
  input: { p_attempt_id: attemptId, p_question_id: questionId, p_reason: 'incorrect', p_details: details },
 }]);
 await seedPortalSession(page, second);
 reportReply.resolve();
 await expect(page.getByRole('alert')).toContainText('Attempt access ended', { timeout: 3000 });
 await expect(draft).toHaveCount(0);
 await expect(privateQuestion(page)).toHaveCount(0);
 await expect(page.getByText('Report received.', { exact: false })).toHaveCount(0);
 expect(calls(state, 'report_attempt_question')).toHaveLength(1);
});
test('submission never dispatches as a newly cached account',async({page})=>{
 const state=await fixture(page);await expect(answer(page)).toBeEnabled();await page.getByRole('button',{name:'Submit attempt',exact:true}).click();await seedPortalSession(page,second);await page.getByRole('dialog').getByRole('button',{name:'Submit & view report',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Attempt access');expect(calls(state,'submit_attempt')).toEqual([]);await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('drawing multipart uploads verify the actor before sending a selected page',async({page})=>{
 const state=await fixture(page,{drawing:true});await expect(page.getByRole('button',{name:'Add images',exact:true})).toBeEnabled();await seedPortalSession(page,second);await page.locator('input[type=file]').setInputFiles({name:'fictional-page.png',mimeType:'image/png',buffer:Buffer.from('fictional transport fixture; no image-decoder claim')});await expect(page.getByRole('alert')).toContainText('Attempt access');expect(calls(state,'drawing-media').filter(item=>item.input.multipart)).toEqual([]);await expect(page.locator('input[type=file]')).toHaveCount(0);
});
test('a changed actor cannot sign private question figures after a held paper read',async({page})=>{
 const state=await fixture(page);await expect(answer(page)).toBeEnabled();state.readHold=deferred();state.readMedia=true;await page.reload();await expect.poll(()=>state.heldReads).toBeGreaterThan(0);await seedPortalSession(page,second);state.readHold.resolve();await expect(page.getByRole('alert')).toContainText('Attempt access');expect(calls(state,'attempt-media')).toEqual([]);await expect(page.getByRole('img',{name:'Fictional figure',exact:true})).toHaveCount(0);
});

test('a delayed question figure reply clears the old paper after a silent account change', async ({ page }) => {
 const figureReply = deferred();
 const state = await fixture(page, { readMedia: true, figureReply });
 await expect.poll(() => calls(state, 'attempt-media').length).toBe(1);
 await expect(page.getByText('Loading question figure…', { exact: true })).toBeVisible();
 await seedPortalSession(page, second);
 figureReply.resolve();
 await expect(page.getByRole('alert')).toContainText('Attempt access ended', { timeout: 3000 });
 await expect(privateQuestion(page)).toHaveCount(0);
 await expect(page.getByRole('img', { name: 'Fictional figure', exact: true })).toHaveCount(0);
 expect(calls(state, 'attempt-media').map(item => item.actor)).toEqual([first.id]);
});

test('a signed figure stays hidden until the current exam account is confirmed again', async ({ page }) => {
 const figureReply = deferred();
 const state = await fixture(page, { readMedia: true, figureReply });
 await expect.poll(() => calls(state, 'attempt-media').length).toBe(1);
 const verification = deferred();
 state.authHold = verification;
 figureReply.resolve();
 await expect.poll(() => state.heldAuth, { timeout: 3000 }).toBe(1);
 const figure = page.getByRole('img', { name: 'Fictional figure', exact: true });
 await expect(figure).toHaveCount(0);
 await expect(page.getByRole('timer', { name: 'Time remaining' })).toBeVisible();
 state.authHold = null;
 verification.resolve();
 await expect(figure).toBeVisible();
 await expect(answer(page)).toBeEnabled();
 expect(calls(state, 'attempt-media')).toHaveLength(1);
});

test('a silent swap during successful figure receipt verification clears the old paper', async ({ page }) => {
 const figureReply = deferred();
 const state = await fixture(page, { readMedia: true, figureReply });
 await expect.poll(() => calls(state, 'attempt-media').length).toBe(1);
 const verification = deferred();
 state.authHold = verification;
 figureReply.resolve();
 await expect.poll(() => state.heldAuth, { timeout: 3000 }).toBe(1);

 const figure = page.getByRole('img', { name: 'Fictional figure', exact: true });
 await expect(figure).toHaveCount(0);
 await seedPortalSession(page, second);
 state.authHold = null;
 verification.resolve();

 await expect(page.getByRole('alert')).toContainText('Attempt access ended', { timeout: 3000 });
 await expect(privateQuestion(page)).toHaveCount(0);
 await expect(figure).toHaveCount(0);
 expect(calls(state, 'attempt-media').map(item => item.actor)).toEqual([first.id]);
});

test('time spent verifying a paper receipt still counts against its fixed deadline', async ({ page }) => {
 const receivedAt = Date.now();
 await page.clock.setFixedTime(receivedAt);
 const readHold = deferred();
 const state = await fixture(page, {
  readHold, serverNow: new Date(receivedAt).toISOString(), deadline: new Date(receivedAt + 20000).toISOString(),
 });
 await expect.poll(() => state.heldReads).toBe(1);
 const verification = deferred();
 state.authHold = verification;
 readHold.resolve();
 await expect.poll(() => state.heldAuth).toBe(1);
 await expect(privateQuestion(page)).toHaveCount(0);
 await page.clock.setFixedTime(receivedAt + 3000);
 state.authHold = null;
 verification.resolve();

 await expect(answer(page)).toBeEnabled();
 await expect(page.getByRole('timer', { name: 'Time remaining' })).toContainText('00:00:17', { timeout: 3000 });
 expect(calls(state, 'read_attempt').map(item => item.actor)).toEqual([first.id]);
});

test('temporary identity network failure retains the trusted paper, clock and journal until verified recovery',async({page})=>{
 const state=await fixture(page);await expect(answer(page)).toBeEnabled();state.authStatus=503;await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(page.getByRole('status').filter({hasText:'Waiting to verify your exam account'})).toBeVisible();await expect(privateQuestion(page)).toBeVisible();await expect(page.getByRole('timer',{name:'Time remaining'})).toBeVisible();await answer(page).click();await expect.poll(async()=>(await journal(page)).length).toBe(1);expect(calls(state,'save_answer_revision')).toEqual([]);state.authStatus=200;await page.evaluate(()=>dispatchEvent(new Event('online')));await expect(page.getByText('Answers are saved to your account.',{exact:true})).toBeVisible();expect(calls(state,'save_answer_revision').map(item=>item.actor)).toEqual([first.id]);expect(await journal(page)).toEqual([]);
});
test('an ambiguous answer acknowledgement keeps the device answer for idempotent reconciliation',async({page})=>{
 const state=await fixture(page);await expect(answer(page)).toBeEnabled();state.saveReceipt=null;await answer(page).click();await expect(page.getByText('Answers saved on this device. Waiting to sync.',{exact:true})).toBeVisible();const pending=await journal(page);expect(pending).toHaveLength(1);state.saveReceipt=undefined;await page.getByRole('button',{name:'Retry waiting answers',exact:true}).click();await expect(page.getByText('Answers are saved to your account.',{exact:true})).toBeVisible();expect(calls(state,'save_answer_revision').map(item=>item.input.p_revision)).toEqual([pending[0].revision,pending[0].revision]);expect(await journal(page)).toEqual([]);
});
test('an answer request pins the verified actor even when SDK storage changes during verification',async({page})=>{
 const state=await fixture(page);await expect(answer(page)).toBeEnabled();const held=deferred();state.authHold=held;await answer(page).click();await expect.poll(()=>state.heldAuth).toBe(1);await seedPortalSession(page,second);state.authHold=null;held.resolve();await expect.poll(()=>calls(state,'save_answer_revision').length).toBe(1);expect(calls(state,'save_answer_revision').map(item=>item.actor)).toEqual([first.id]);await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(page.getByRole('alert')).toContainText('Attempt access');await expect(privateQuestion(page)).toHaveCount(0);
});
test('a late answer cannot acknowledge a journal after its same-route history scope ended',async({page})=>{
 const state=await fixture(page);await expect(answer(page)).toBeEnabled();const held=deferred();state.saveHold=held;await answer(page).click();await expect.poll(()=>calls(state,'save_answer_revision').length).toBe(1);await page.evaluate(()=>history.pushState({...history.state,key:crypto.randomUUID()},'',location.href));held.resolve();await expect.poll(()=>state.finishedSaves).toBe(1);expect(await journal(page)).toHaveLength(1);await page.evaluate(()=>dispatchEvent(new PopStateEvent('popstate',{state:history.state})));await expect(answer(page)).toBeEnabled();await expect(page.getByText('Answers are saved to your account.',{exact:true})).toBeVisible();expect(calls(state,'save_answer_revision')).toHaveLength(2);
});
test('the exam never displays raw submit provider errors',async({page})=>{
 const state=await fixture(page);await expect(answer(page)).toBeEnabled();state.submitStatus=400;await page.getByRole('button',{name:'Submit attempt',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Submit & view report',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Couldn’t confirm submission');await expect(page.getByText(/SECRET_FICTIONAL_PROVIDER_DETAIL/)).toHaveCount(0);
});
test('a late initial identity response cannot open a paper after its verification deadline',async({page})=>{
 await page.clock.install();const state=await fixture(page);await expect(answer(page)).toBeEnabled();state.authHold=deferred();const before=calls(state,'read_attempt').length;await page.reload();await expect.poll(()=>state.heldAuth).toBeGreaterThan(0);await page.clock.fastForward(10001);await expect(page.getByRole('alert')).toContainText('Attempt access could not be verified');const held=state.authHold;state.authHold=null;held.resolve();await expect(answer(page)).toHaveCount(0);expect(calls(state,'read_attempt')).toHaveLength(before);await page.getByRole('button',{name:'Check attempt access',exact:true}).press('Enter');await expect(answer(page)).toBeEnabled();
});
test('a timed out save identity check keeps working locally and ignores the late verification',async({page})=>{
 await page.clock.install();const state=await fixture(page);await expect(answer(page)).toBeEnabled();const held=deferred();state.authHold=held;await answer(page).click();await expect.poll(()=>state.heldAuth).toBeGreaterThan(0);await page.clock.fastForward(20001);await expect(page.getByText('Answers saved on this device. Waiting to sync.',{exact:true})).toBeVisible();await expect(privateQuestion(page)).toBeVisible();state.authHold=null;held.resolve();await expect(page.getByRole('status').filter({hasText:'Waiting to verify your exam account'})).toBeVisible();expect(calls(state,'save_answer_revision')).toEqual([]);await page.getByRole('button',{name:'Retry waiting answers',exact:true}).press('Enter');await expect(page.getByText('Answers are saved to your account.',{exact:true})).toBeVisible();expect(calls(state,'save_answer_revision')).toHaveLength(1);
});
test('synchronous repeated submission dispatches one mutation',async({page})=>{
 const state=await fixture(page);await expect(answer(page)).toBeEnabled();await page.getByRole('button',{name:'Submit attempt',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Submit & view report',exact:true}).evaluate(node=>{node.click();node.click();});await expect(page.getByRole('heading',{name:/Make this attempt/})).toBeVisible();expect(calls(state,'submit_attempt')).toHaveLength(1);
});
test('a late submitted result cannot replace a new same-route paper scope',async({page})=>{
 const state=await fixture(page);await expect(answer(page)).toBeEnabled();state.saveHold=deferred();await answer(page).click();await expect.poll(()=>calls(state,'save_answer_revision').length).toBe(1);await page.getByRole('button',{name:'Submit attempt',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Submit & view report',exact:true}).click();await page.evaluate(()=>{history.pushState({...history.state,key:crypto.randomUUID()},'',location.href);dispatchEvent(new PopStateEvent('popstate',{state:history.state}));});state.saveHold.resolve();await expect(answer(page)).toBeEnabled();await expect(page.getByRole('dialog')).toHaveCount(0);expect(calls(state,'submit_attempt')).toEqual([]);
});
test('Part B start verifies identity before using an earlier account session',async({page})=>{
 const state=await fixture(page,{submitted:true,partBReady:true});await expect(page.getByRole('button',{name:'Open Part B',exact:true})).toBeEnabled();await seedPortalSession(page,second);await page.getByRole('button',{name:'Open Part B',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Attempt access');expect(calls(state,'start_exam_mock_part_b')).toEqual([]);await expect(page).toHaveURL('/attempt/'+attemptId);
});
test('a held Part B start cannot navigate after verified account changes',async({page})=>{
 const state=await fixture(page,{submitted:true,partBReady:true});await expect(page.getByRole('button',{name:'Open Part B',exact:true})).toBeEnabled();state.startHold=deferred();await page.getByRole('button',{name:'Open Part B',exact:true}).click();await expect.poll(()=>calls(state,'start_exam_mock_part_b').length).toBe(1);await seedPortalSession(page,second);state.startHold.resolve();await expect(page.getByRole('alert')).toContainText('Attempt access');expect(calls(state,'start_exam_mock_part_b').map(item=>item.actor)).toEqual([first.id]);await expect(page).toHaveURL('/attempt/'+attemptId);
});
test('a held Part B start cannot navigate across native history before React is notified',async({page})=>{
 const state=await fixture(page,{submitted:true,partBReady:true});await expect(page.getByRole('button',{name:'Open Part B',exact:true})).toBeEnabled();state.startHold=deferred();await page.getByRole('button',{name:'Open Part B',exact:true}).click();await expect.poll(()=>calls(state,'start_exam_mock_part_b').length).toBe(1);await page.evaluate(()=>history.pushState({...history.state,key:crypto.randomUUID()},'',location.href));state.startHold.resolve();await expect.poll(()=>state.finishedStarts).toBe(1);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await expect(page).toHaveURL('/attempt/'+attemptId);await page.evaluate(()=>dispatchEvent(new PopStateEvent('popstate',{state:history.state})));await expect(page.getByRole('button',{name:'Open Part B',exact:true})).toBeEnabled();
});
test('confirmed Auth expiry clears an open report and returns focus to the public heading',async({page})=>{
 const state=await fixture(page);await expect(answer(page)).toBeEnabled();await page.getByRole('button',{name:'Report question',exact:true}).press('Enter');await page.getByLabel('Details (optional)',{exact:true}).fill('Original fictional private report');await page.getByLabel('Details (optional)',{exact:true}).focus();state.authStatus=401;await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(page.getByRole('alert')).toContainText('Attempt access ended');await expect(privateQuestion(page)).toHaveCount(0);await expect(page.getByRole('textbox')).toHaveCount(0);await expect(page.getByRole('heading',{name:/Your practice space/})).toBeFocused();expect(calls(state,'report_attempt_question')).toEqual([]);
});
test('an outage never restores elapsed exam time and reconnect finalizes the fixed attempt once',async({page})=>{
 const startedAt=Date.now(),deadline=startedAt+5000;
 // Freeze wall time during setup and input while leaving browser timers and actionability running.
 await page.clock.setFixedTime(startedAt);
 const state=await fixture(page,{serverNow:new Date(startedAt).toISOString(),deadline:new Date(deadline).toISOString()});
 const timer=page.getByRole('timer',{name:'Time remaining'});
 await expect(answer(page)).toBeEnabled();
 await expect(timer).toContainText('00:00:05');
 state.authStatus=503;
 await answer(page).click();
 await expect(page.getByText('Answers saved on this device. Waiting to sync.',{exact:true})).toBeVisible();
 state.serverNow=new Date(deadline).toISOString();
 await page.clock.setFixedTime(deadline);
 await expect(answer(page)).toBeDisabled();
 await expect(timer).toContainText('00:00:00');
 expect(calls(state,'submit_attempt')).toEqual([]);
 state.authStatus=200;
 await page.evaluate(()=>dispatchEvent(new Event('online')));
 await expect(page.getByRole('heading',{name:/Make this attempt/})).toBeVisible();
 expect(calls(state,'submit_attempt')).toHaveLength(1);
 expect(calls(state,'save_answer_revision')).toEqual([]);
 expect(await journal(page)).toEqual([]);
});
