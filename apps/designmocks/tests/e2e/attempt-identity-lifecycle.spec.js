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
  const question={id:questionId,ordinal:1,kind:state.drawing?'drawing':'mcq',topic:'observation',prompt:who===second.id?'Original fictional second account question':'Original fictional first account question',options:[{id:'A',label:'Fictional first choice'},{id:'B',label:'Fictional second choice'}],marking:{correct:3,wrong:-1},points:3,negativePoints:1,media:state.readMedia?[{path:'fictional-figure.png',alt:'Fictional figure'}]:[],answer:state.readAnswer?.answer ?? null,answerRevision:state.readAnswer?.revision ?? 0};
  if(name==='read_attempt'){
   const held=state.readHold;if(held){state.heldReads++;await held.promise;}
   data={id:attemptId,title:'Original fictional timed paper',status:state.submitted?'submitted':'active',serverNow:state.serverNow??new Date().toISOString(),deadline:state.deadline,questions:state.submitted?[]:[question],score:0,total:3,examResultsPending:!!(state.partBReady||state.partBUnavailable),resultsPending:!!state.submitted&&!(state.partBReady||state.partBUnavailable),uploadDeadline:state.submitted?new Date(Date.now()+600000).toISOString():null,drawingUploadTasks:state.submitted?[{id:questionId,prompt:'Original fictional drawing task'}]:[]};
  }else if(name==='my_exam_mock_session')data=(state.partBReady||state.partBUnavailable)?{exam:'uceed',partAAttemptId:attemptId,partBState:state.partBUnavailable?'unavailable':'ready',partBTaskCount:2,partBDurationSeconds:3600,partBOpensAt:new Date(Date.now()-1000).toISOString()}:null;
  else if(name==='my_exam_mock_report')data=null;
  else if(name==='save_answer_revision'){const held=state.saveHold;if(held)await held.promise;data=state.saveReceipt===undefined?{accepted:true,answer:input.p_answer,revision:input.p_revision}:state.saveReceipt;}
  else if(name==='submit_attempt'){status=state.submitStatus;data=status===200?{id:attemptId,title:'Original fictional timed paper',status:'submitted',serverNow:state.serverNow??new Date().toISOString(),deadline:state.deadline,questions:[{...question,outcome:'incorrect',explanation:'Original fictional explanation'}],score:0,total:3}:{code:'P0001',message:'SECRET_FICTIONAL_PROVIDER_DETAIL'};}
  else if(name==='report_attempt_question'){
   if(state.reportReply)await state.reportReply.promise;
   status=state.reportError?.status??200;
   data=state.reportError?.body??{reportCount:1,threshold:5,held:false};
  }
  else if(name==='attempt-media'){
   if(state.figureReply)await state.figureReply.promise;
   status=state.figureStatus??200;
   data=status===200?{media:{[questionId]:[{url:state.figureUrl??'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/%3E'}]}}:{error:'Fictional media failure'};
  }
  else if(name==='drawing-media')data=multipart?{id:'30000000-0000-4000-8000-000000000961',ordinal:1}:input.action==='list'?{items:[]}:{images:[]};
  else if(name==='start_exam_mock_part_b'){if(state.startHold)await state.startHold.promise;data=partB;}
  else throw new Error('Unexpected fictional attempt request: '+name);
  if (state.examReplies && ['my_exam_mock_session', 'my_exam_mock_report'].includes(name)) await state.examReplies.promise;
  await route.fulfill({headers,status,json:data}).catch(()=>{});if(name==='read_attempt')state.finishedReads++;if(name==='save_answer_revision')state.finishedSaves++;if(name==='start_exam_mock_part_b')state.finishedStarts++;
 });
 await page.goto('/account');await seedPortalSession(page,first);await page.goto('/attempt/'+attemptId);return state;
}
const answer=page=>page.getByRole('button',{name:'B Fictional second choice',exact:true});
const privateQuestion=page=>page.getByRole('heading',{name:'Original fictional first account question',exact:true});
const calls=(state,name)=>state.calls.filter(item=>item.name===name);
async function waitForExamReads(state) {
 // Their request-time checks must finish before the targeted Auth hold starts.
 // Keep the replies queued so neither can trigger its response-time check yet.
 await expect.poll(() => ['my_exam_mock_session', 'my_exam_mock_report'].map(name => calls(state, name).length)).toEqual([1, 1]);
}
const journal=page=>page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.startsWith('dmocks:pending-answer:')).map(([key,value])=>({key,...JSON.parse(value)})));
test('the active exam verifies identity before reading its frozen private paper',async({page})=>{
 const state=await fixture(page,{identity:second.id});await expect(page.getByRole('alert')).toContainText('Attempt access');expect(calls(state,'read_attempt')).toEqual([]);await expect(privateQuestion(page)).toHaveCount(0);
});
test('a silent account change cannot dispatch another account answer and keeps the original device journal',async({page})=>{
 // Hold unrelated exam-read replies so their identity checks cannot invalidate
 // the page before the answer-dispatch race this test is meant to exercise.
 const examReplies=deferred(),state=await fixture(page,{examReplies});
 try {
  await expect(answer(page)).toBeEnabled();await waitForExamReads(state);
  await seedPortalSession(page,second);await answer(page).press('Enter');
  await expect(page.getByRole('alert')).toContainText('Attempt access');
  expect(calls(state,'save_answer_revision')).toEqual([]);await expect(privateQuestion(page)).toHaveCount(0);
  const entries=await journal(page);expect(entries).toHaveLength(1);expect(entries[0].key).toContain(first.id);expect(entries[0].answer).toBe('B');
 } finally { examReplies.resolve(); }
});
test('question reporting verifies the account before sending the private explanation',async({page})=>{
 const state=await fixture(page);await expect(answer(page)).toBeEnabled();await page.getByRole('button',{name:'Report question',exact:true}).press('Enter');await page.getByLabel('Details (optional)',{exact:true}).fill('Fictional private report draft');await seedPortalSession(page,second);await page.getByRole('button',{name:'Send report',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Attempt access');expect(calls(state,'report_attempt_question')).toEqual([]);await expect(page.getByRole('textbox')).toHaveCount(0);
});
test('an ambiguous question report can be retried and confirms the original report', async ({ page }) => {
 const state = await fixture(page);
 await expect(answer(page)).toBeEnabled();
 await page.getByRole('button', {name:'Report question', exact:true}).press('Enter');
 const details = page.getByLabel('Details (optional)', {exact:true});
 await details.fill('Fictional report with a lost receipt');
 const send = page.getByRole('button', {name:'Send report', exact:true});
 state.reportError = {status:503, body:{code:'P0001', message:'Private fixture error'}};
 await send.click();
 await expect(page.getByText('Couldn’t confirm this report. Reconnect and try again.')).toBeVisible();
 await expect(details).toHaveValue('Fictional report with a lost receipt');
 await expect(page.getByText('Private fixture error')).toHaveCount(0);

 state.reportError = {status:400, body:{code:'P0001', message:'You have already reported this issue for this question version'}};
 await send.click();
 await expect(page.getByText('You already reported this issue for this question version.')).toBeVisible();
 await expect(details).toHaveCount(0);
 const requests = calls(state, 'report_attempt_question');
 expect(requests).toHaveLength(2);
 expect(requests[1]).toEqual(requests[0]);
});
test('question reporting preserves the draft when the hourly limit is reached', async ({ page }) => {
 const state = await fixture(page, {
  reportError: {status:400, body:{code:'P0001', message:'Too many question reports. Please try again after the hourly window'}},
 });
 await expect(answer(page)).toBeEnabled();
 await page.getByRole('button', {name:'Report question', exact:true}).press('Enter');
 const details = page.getByLabel('Details (optional)', {exact:true});
 await details.fill('Fictional report draft at the hourly limit');
 await page.getByRole('button', {name:'Send report', exact:true}).evaluate(button => {
  button.click();
  button.click();
 });
 await expect(page.getByText('You’ve reached the hourly question report limit. Try again later.')).toBeVisible();
 await expect(details).toHaveValue('Fictional report draft at the hourly limit');
 expect(calls(state, 'report_attempt_question')).toHaveLength(1);
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

test('a failed question figure can be retried without reopening the timed attempt', async ({page}) => {
  const state = await fixture(page, {readMedia:true, figureStatus:503});
  const retry = page.getByRole('button', {name:'Retry figure 1', exact:true});
  await expect(retry).toBeVisible();
  await expect(page.getByText('Loading question figure…', {exact:true})).toHaveCount(0);
  state.figureStatus = 200;
  state.figureUrl = 'data:image/png;base64,AAAA';
  await retry.press('Enter');
  await expect(privateQuestion(page)).toBeFocused();
  await expect.poll(() => calls(state, 'attempt-media').length).toBe(2);
  await expect(retry).toBeVisible();

  state.figureUrl = undefined;
  await retry.click();
  const figure = page.getByRole('img', {name:'Fictional figure', exact:true});
  await expect.poll(() => figure.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await expect(retry).toHaveCount(0);
  expect(calls(state, 'read_attempt')).toHaveLength(1);
  expect(calls(state, 'attempt-media').map(call => call.actor)).toEqual(Array(3).fill(first.id));
  await expect(page.getByRole('timer', {name:'Time remaining'})).toBeVisible();
});

test('a signed figure stays hidden until the current exam account is confirmed again', async ({ page }) => {
 const figureReply = deferred();
 const examReplies = deferred();
 const verification = deferred();
 try {
  const state = await fixture(page, { readMedia: true, figureReply, examReplies });
  await waitForExamReads(state);
  await expect.poll(() => calls(state, 'attempt-media').length).toBe(1);
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
 } finally {
  figureReply.resolve();
  verification.resolve();
  examReplies.resolve();
 }
});

test('a silent swap during successful figure receipt verification clears the old paper', async ({ page }) => {
 const figureReply = deferred();
 const examReplies = deferred();
 const verification = deferred();
 try {
  const state = await fixture(page, { readMedia: true, figureReply, examReplies });
  await waitForExamReads(state);
  await expect.poll(() => calls(state, 'attempt-media').length).toBe(1);
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
 } finally {
  figureReply.resolve();
  verification.resolve();
  examReplies.resolve();
 }
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
test('an answer request pins the verified actor even when SDK storage changes during verification', async ({ page }) => {
 const examReplies = deferred();
 const verification = deferred();
 try {
  const state = await fixture(page, { examReplies });
  await expect(answer(page)).toBeEnabled();
  await waitForExamReads(state);
  state.authHold = verification;
  await answer(page).click();
  await expect.poll(() => state.heldAuth).toBe(1);
  await seedPortalSession(page, second);
  state.authHold = null;
  verification.resolve();
  await expect.poll(() => calls(state, 'save_answer_revision').length).toBe(1);
  expect(calls(state, 'save_answer_revision').map(item => item.actor)).toEqual([first.id]);
  await page.evaluate(() => dispatchEvent(new Event('focus')));
  await expect(page.getByRole('alert')).toContainText('Attempt access');
  await expect(privateQuestion(page)).toHaveCount(0);
 } finally {
  verification.resolve();
  examReplies.resolve();
 }
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
 const state=await fixture(page);await expect(answer(page)).toBeEnabled();await page.getByRole('button',{name:'Submit attempt',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Submit & view report',exact:true}).evaluate(node=>{node.click();node.click();});await expect(page.getByRole('heading',{name:"Paper analysis",exact:true})).toBeVisible();expect(calls(state,'submit_attempt')).toHaveLength(1);
});
test('a late submitted result cannot replace a new same-route paper scope',async({page})=>{
 const state=await fixture(page);await expect(answer(page)).toBeEnabled();state.saveHold=deferred();await answer(page).click();await expect.poll(()=>calls(state,'save_answer_revision').length).toBe(1);await page.getByRole('button',{name:'Submit attempt',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Submit & view report',exact:true}).click();await page.evaluate(()=>{history.pushState({...history.state,key:crypto.randomUUID()},'',location.href);dispatchEvent(new PopStateEvent('popstate',{state:history.state}));});state.saveHold.resolve();await expect(answer(page)).toBeEnabled();await expect(page.getByRole('dialog')).toHaveCount(0);expect(calls(state,'submit_attempt')).toEqual([]);
});
test('a historical Part A with unavailable Part B stays readable without a start action',async({page})=>{
 const state=await fixture(page,{submitted:true,partBUnavailable:true});
 await expect(page.getByRole('heading',{name:'Your Part A is locked.'})).toBeVisible();
 await expect(page.getByLabel('Exam Part B')).toContainText('Part B is unavailable for this session.');
 await expect(page.getByRole('button',{name:'Open Part B',exact:true})).toHaveCount(0);
 expect(calls(state,'start_exam_mock_part_b')).toEqual([]);
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
 await expect(page.getByRole('heading',{name:"Paper analysis",exact:true})).toBeVisible();
 expect(calls(state,'submit_attempt')).toHaveLength(1);
 expect(calls(state,'save_answer_revision')).toEqual([]);
 expect(await journal(page)).toEqual([]);
});

test('a click after the deadline cannot save an answer before the displayed clock refreshes', async ({page}) => {
  const startedAt = Date.now();
  const deadline = startedAt + 5000;
  await page.clock.setFixedTime(startedAt);
  const state = await fixture(page, {
    serverNow: new Date(startedAt).toISOString(),
    deadline: new Date(deadline).toISOString(),
  });
  await expect(answer(page)).toBeEnabled();
  await page.evaluate(() => {
    const originalNow = Date.now;
    Date.now = () => originalNow() + 5000;
    try {
      const choice = [...document.querySelectorAll('button')].find(button => /Fictional second choice/.test(button.textContent));
      if (!choice || choice.disabled) throw new Error('Expected an enabled choice before the clock repaint');
      choice.click();
    } finally {
      Date.now = originalNow;
    }
  });
  expect(await journal(page)).toEqual([]);
  expect(calls(state, 'save_answer_revision')).toEqual([]);
});

test('an invalid newer server answer cannot clear the pending device answer', async ({page}) => {
  const state = await fixture(page);
  state.saveHold = deferred();
  await answer(page).click();
  await expect.poll(() => calls(state, 'save_answer_revision').length).toBe(1);
  const [pending] = await journal(page);
  state.saveReceipt = {accepted:false, revision:pending.revision + 1, answer:'not-an-option'};
  state.saveHold.resolve();
  await expect(page.getByText('Answers saved on this device. Waiting to sync.', {exact:true})).toBeVisible();
  expect(await journal(page)).toEqual([pending]);
  state.saveReceipt = {accepted:false, revision:pending.revision + 1, answer:'A'};
  await page.getByRole('button', {name:'Retry waiting answers', exact:true}).click();
  await expect(page.getByText('Answers are saved to your account.', {exact:true})).toBeVisible();
  expect(await journal(page)).toEqual([]);
  expect(calls(state, 'save_answer_revision').map(call => call.input.p_revision)).toEqual([pending.revision, pending.revision]);
});

test('reloading with an invalid newer readback retries the original device answer', async ({page}) => {
  const state = await fixture(page, {saveReceipt: null});
  await answer(page).click();
  await expect(page.getByText('Answers saved on this device. Waiting to sync.', {exact:true})).toBeVisible();
  const [pending] = await journal(page);
  state.readAnswer = {answer:'not-an-option', revision:pending.revision + 1};
  state.saveHold = deferred();
  await page.reload();
  await expect.poll(() => calls(state, 'save_answer_revision').length).toBe(2);
  expect(await journal(page)).toEqual([pending]);
  expect(calls(state, 'save_answer_revision').map(call => call.input.p_revision)).toEqual([pending.revision, pending.revision]);
  state.saveReceipt = {accepted:false, answer:'A', revision:pending.revision + 1};
  state.saveHold.resolve();
  await expect(page.getByText('Answers are saved to your account.', {exact:true})).toBeVisible();
  expect(await journal(page)).toEqual([]);
});

test('a blocked answer save explains how to retry submission without reopening the paper', async ({page}) => {
  const state = await fixture(page);
  await expect(answer(page)).toBeEnabled();
  state.saveReceipt = null;
  await answer(page).click();
  await expect(page.getByText('Answers saved on this device. Waiting to sync.', {exact:true})).toBeVisible();
  const [saved] = await journal(page);
  await page.getByRole('button', {name:'Submit attempt', exact:true}).click();
  const dialog = page.getByRole('dialog');
  const submit = dialog.getByRole('button', {name:'Submit & view report', exact:true});
  await submit.click();
  await expect(dialog.getByRole('alert')).toContainText('Your attempt is still open. Reconnect and select Submit again to save your waiting answers.');
  expect(calls(state, 'submit_attempt')).toEqual([]);
  expect(await journal(page)).toEqual([saved]);

  state.saveReceipt = undefined;
  await submit.click();
  await expect(page.getByRole('heading', {name:"Paper analysis",exact:true})).toBeVisible();
  expect(calls(state, 'save_answer_revision').map(call => call.input.p_revision)).toEqual(Array(3).fill(saved.revision));
  expect(calls(state, 'submit_attempt')).toHaveLength(1);
  expect(await journal(page)).toEqual([]);
});

test('a queued revision cannot follow an acknowledged save after the deadline', async ({page}) => {
  const startedAt = Date.now();
  const deadline = startedAt + 5000;
  await page.clock.setFixedTime(startedAt);
  const saveHold = deferred();
  const state = await fixture(page, {
    saveHold,
    serverNow: new Date(startedAt).toISOString(),
    deadline: new Date(deadline).toISOString(),
  });
  await answer(page).click();
  await expect.poll(() => calls(state, 'save_answer_revision').length).toBe(1);
  await page.getByRole('button', {name:'A Fictional first choice', exact:true}).click();
  expect((await journal(page)).map(entry => entry.answer)).toEqual(['A']);
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', {name:'Submit attempt', exact:true}).click();
  const submit = dialog.getByRole('button', {name:'Submit & view report', exact:true});
  await submit.click();
  await expect(submit).toBeDisabled();

  state.serverNow = new Date(deadline).toISOString();
  await page.clock.setFixedTime(deadline);
  saveHold.resolve();
  await expect(page.getByRole('heading', {name:"Paper analysis",exact:true})).toBeVisible();
  expect(calls(state, 'save_answer_revision').map(call => call.input.p_answer)).toEqual(['B']);
  expect(calls(state, 'submit_attempt')).toHaveLength(1);
  expect(await journal(page)).toEqual([]);
});

test('a failed answer save that crosses the deadline finalizes the server snapshot once', async ({page}) => {
  const startedAt = Date.now(), deadline = startedAt + 5000;
  await page.clock.setFixedTime(startedAt);
  const state = await fixture(page, {serverNow:new Date(startedAt).toISOString(), deadline:new Date(deadline).toISOString()});
  await expect(answer(page)).toBeEnabled();
  state.saveHold = deferred();
  state.saveReceipt = null;
  await answer(page).click();
  await expect.poll(() => calls(state, 'save_answer_revision').length).toBe(1);
  await page.getByRole('button', {name:'Submit attempt', exact:true}).click();
  const submit = page.getByRole('dialog').getByRole('button', {name:'Submit & view report', exact:true});
  await submit.click();
  await expect(submit).toBeDisabled();

  state.serverNow = new Date(deadline).toISOString();
  await page.clock.setFixedTime(deadline);
  state.saveHold.resolve();
  await expect(page.getByRole('heading', {name:"Paper analysis",exact:true})).toBeVisible();
  expect(calls(state, 'save_answer_revision')).toHaveLength(1);
  expect(calls(state, 'submit_attempt')).toHaveLength(1);
  expect(await journal(page)).toEqual([]);
});
