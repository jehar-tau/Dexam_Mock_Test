import {expect,test} from '@playwright/test';
import {portalFixtureURL,seedPortalSession,stubPortalProvider} from './portal-fixture.js';

test.use({baseURL:portalFixtureURL});
const first={id:'00000000-0000-4000-8000-000000001101',email:'fictional-support-first@example.invalid'};
const second={id:'00000000-0000-4000-8000-000000001102',email:'fictional-support-second@example.invalid'};
const api='https://dmocks-portal-fixture.supabase.co';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-api-version','Access-Control-Allow-Methods':'POST, GET, OPTIONS'};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
const report=(id,title)=>({id,title,description:'An original fictional private support description.',status:'fixed',adminReply:'An original fictional private team reply.',createdAt:'2026-01-01T12:00:00.123456Z',updatedAt:'2026-01-01T13:00:00.123456Z'});
const firstTitle='First account original private support report';
const secondTitle='Second account original private support report';
async function changeAccount(page,state,actor){
 state.actor=actor;await seedPortalSession(page,actor);
 await page.evaluate(()=>{const key='sb-dmocks-portal-fixture-auth-token',channel=new BroadcastChannel(key);channel.postMessage({event:'SIGNED_IN',session:JSON.parse(localStorage.getItem(key))});channel.close();});
}
async function fixture(page,{holdInitial=null,waitForReports=true,path='/report',identityOverride=null,identityHold=null}={}){
 const state={actor:first,rows:{[first.id]:[report('91000000-0000-4000-8000-000000001101',firstTitle)],[second.id]:[report('91000000-0000-4000-8000-000000001102',secondTitle)]},holds:{[first.id]:holdInitial},reads:{},completedReads:{},pageInputs:[],submissions:[],completedSubmissions:0,submitHold:null,dropAcknowledgements:0,submitReject:null,receipts:new Map(),authFailure:false,identityOverride,identityHold,readFailure:false,duplicatePage:false};
 const provider=await stubPortalProvider(page,name=>{
  if(name==='is_dmocks_admin')return false;
  if(name==='user')return{...state.actor,aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}};
  if(name==='logout')return null;
 });
 await page.route(api+'/auth/v1/user',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});
  const actor=state.identityOverride??state.actor,held=state.identityHold,failure=state.authFailure;if(held)await held.promise;
  try{return await route.fulfill({headers,status:failure?503:200,json:failure?{message:'Private identity diagnostic must not render'}:{...actor,aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}}});}catch{}
 });
 await page.route(api+'/rest/v1/rpc/my_bug_report*',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});
  const name=new URL(route.request().url()).pathname.split('/').at(-1),token=route.request().headers().authorization?.split(' ')[1];
  const owner=token?JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub:state.actor.id;
  const rows=structuredClone(state.rows[owner]??[]),held=state.holds[owner],input=route.request().postDataJSON()??{},failure=state.readFailure;state.reads[owner]=(state.reads[owner]??0)+1;
  state.pageInputs.push(input);const offset=input.p_cursor?rows.findIndex(row=>row.id===input.p_cursor.id)+1:0,items=state.duplicatePage&&input.p_cursor?[rows[0]]:rows.slice(offset,offset+25),last=items.at(-1),nextCursor=offset+25<rows.length?{ownerId:owner,snapshotAt:'2026-06-01T12:00:00.123456Z',createdAt:last.createdAt,id:last.id}:null;
  if(held)await held.promise;
  try{await route.fulfill({headers,status:failure?failure.status??503:200,json:failure?failure.data??{message:'Private history diagnostic must not render'}:name==='my_bug_reports'?rows:{items,nextCursor}});}catch{}
  state.completedReads[owner]=(state.completedReads[owner]??0)+1;
 });
 await page.route(api+'/rest/v1/rpc/submit_bug_report',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});
  const input=route.request().postDataJSON(),owner=state.actor.id,held=state.submitHold,reject=state.submitReject;state.submissions.push(input);
  if(reject){state.completedSubmissions++;return route.fulfill({headers,status:reject.status,json:reject.data});}
  const key=owner+':'+input.p_request_id;let saved=state.receipts.get(key);
  if(!saved){saved=report('91000000-0000-4000-8000-'+String(1102+state.submissions.length).padStart(12,'0'),input.p_title);saved.description=input.p_description;saved.status='open';saved.adminReply=null;state.rows[owner].unshift(saved);state.receipts.set(key,saved);}
  if(held)await held.promise;
  try{if(state.dropAcknowledgements>0){state.dropAcknowledgements--;await route.abort('failed');}else await route.fulfill({headers,status:200,json:saved.id});}catch{}
  state.completedSubmissions++;
 });
 await page.goto('/account');await seedPortalSession(page,first);await page.goto(path);
 if(waitForReports)await expect(page.getByText(firstTitle,{exact:true})).toBeVisible();
 return Object.assign(state,provider);
}
const queuedReport = page => page.getByRole('status').filter({hasText:'Your report is in the review queue.'});
const reportReference = (scope, id) => scope.getByText('Report reference ' + id, {exact:true});

async function fillReport(page,title='Original fictional report after submission'){
 await page.getByLabel('Short title',{exact:true}).fill(title);await page.getByRole('textbox',{name:'What happened?',exact:true}).fill('An original fictional reproduction description with enough detail.');
}

test('a saved bug report acknowledges success, clears the form and reloads the team history',async({page})=>{
 const state=await fixture(page);await fillReport(page);await page.getByRole('button',{name:'Send report',exact:true}).click();
 await expect(queuedReport(page)).toBeVisible();
 const saved = state.rows[first.id][0];
 await expect(queuedReport(page)).toHaveText('Your report is in the review queue. Report reference ' + saved.id);
 await expect(page.getByLabel('Short title',{exact:true})).toHaveValue('');await expect(page.getByRole('textbox',{name:'What happened?',exact:true})).toHaveValue('');
 await expect(page.getByLabel('Short title',{exact:true})).toBeFocused();
 await expect(reportReference(page.getByRole('article',{name:saved.title,exact:true}), saved.id)).toBeVisible();expect(state.submissions).toHaveLength(1);expect(state.unexpected).toEqual([]);
});

test('changing account clears private report history and unsent details before the new read completes',async({page})=>{
 const state=await fixture(page),held=deferred();await fillReport(page,'A private unsent first-account support draft');state.holds[second.id]=held;
 await changeAccount(page,state,second);await expect.poll(()=>state.reads[second.id]??0).toBeGreaterThan(0);
 await expect(page.getByText(firstTitle,{exact:true})).toHaveCount(0);await expect(page.getByLabel('Short title',{exact:true})).not.toHaveValue('A private unsent first-account support draft');
 await expect(reportReference(page, state.rows[first.id][0].id)).toHaveCount(0);
 held.resolve();await expect(reportReference(page.getByRole('article',{name:secondTitle,exact:true}), state.rows[second.id][0].id)).toBeVisible();expect(state.submissions).toEqual([]);expect(state.unexpected).toEqual([]);
});

test('an old account history response cannot replace the new account reports',async({page})=>{
 const held=deferred(),state=await fixture(page,{holdInitial:held,waitForReports:false});
 await expect.poll(()=>state.reads[first.id]??0).toBeGreaterThan(0);await changeAccount(page,state,second);await expect(page.getByText(secondTitle,{exact:true})).toBeVisible();
 const count=state.reads[first.id];held.resolve();await expect.poll(()=>state.completedReads[first.id]??0).toBe(count);
 await expect(page.getByText(firstTitle,{exact:true})).toHaveCount(0);await expect(page.getByText(secondTitle,{exact:true})).toBeVisible();expect(state.unexpected).toEqual([]);
});

test('support context excludes URL query strings and fragments',async({page})=>{
 const state=await fixture(page,{path:'/report?token=fictional-private-query#fictional-private-fragment'});await fillReport(page);await page.getByRole('button',{name:'Send report',exact:true}).click();
 await expect.poll(()=>state.submissions.length).toBe(1);expect(state.submissions[0].p_page_url).toBe(portalFixtureURL+'/report');
});

test('an SDK token change before notification cannot send another account private support draft',async({page})=>{
 const state=await fixture(page);await fillReport(page,'A private original fictional first-account draft');await seedPortalSession(page,second);await page.getByRole('button',{name:'Send report',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Report access could not be verified');await expect(page.getByLabel('Short title',{exact:true})).toHaveCount(0);expect(state.submissions).toEqual([]);
});

test('a lost committed acknowledgement retries the same report and keeps an intervening team reply',async({page})=>{
 await page.clock.install();const state=await fixture(page);state.dropAcknowledgements=1;await fillReport(page);await page.getByRole('button',{name:'Send report',exact:true}).click();
 await expect(page.getByText('Couldn’t confirm your report. Retry the same report to check it.',{exact:true})).toBeVisible();await expect(page.getByLabel('Short title',{exact:true})).toBeDisabled();
 await page.clock.fastForward(60000);await expect(page.getByRole('button',{name:'Retry report',exact:true})).toBeEnabled();expect(state.submissions).toHaveLength(1);
 const saved=state.rows[first.id][0];saved.status='fixed';saved.adminReply='An intervening original fictional support reply.';
 await expect(queuedReport(page)).toHaveCount(0);
 await page.getByRole('button',{name:'Retry report',exact:true}).click();
 await expect(queuedReport(page)).toHaveText('Your report is in the review queue. Report reference ' + saved.id);
 await expect(reportReference(page.getByRole('article',{name:saved.title,exact:true}), saved.id)).toBeVisible();
 expect(state.submissions).toHaveLength(2);expect(state.submissions[1]).toEqual(state.submissions[0]);expect(state.rows[first.id].filter(row=>row.title==='Original fictional report after submission')).toHaveLength(1);
 await expect(page.getByText('An intervening original fictional support reply.',{exact:false})).toBeVisible();expect(saved.status).toBe('fixed');expect(state.unexpected).toEqual([]);
});

test('an uncertain submission times out, can be stopped, and cannot clear a newer draft',async({page})=>{
 await page.clock.install();const state=await fixture(page),held=deferred();state.submitHold=held;await fillReport(page);await page.getByRole('button',{name:'Send report',exact:true}).click();await expect.poll(()=>state.submissions.length).toBe(1);
 await page.clock.fastForward(20001);await expect(page.getByRole('button',{name:'Retry report',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Stop retrying and refresh',exact:true}).click();
 await expect(page.getByLabel('Short title',{exact:true})).toBeFocused();await fillReport(page,'A different new explicit report draft');held.resolve();await expect.poll(()=>state.completedSubmissions).toBe(1);
 await expect(page.getByLabel('Short title',{exact:true})).toHaveValue('A different new explicit report draft');expect(state.submissions).toHaveLength(1);await expect(queuedReport(page)).toHaveCount(0);
});

test('same-route history disposes a pending acknowledgement without changing the newer report form',async({page})=>{
 const state=await fixture(page),held=deferred();state.submitHold=held;await fillReport(page);await page.getByRole('button',{name:'Send report',exact:true}).click();await expect.poll(()=>state.submissions.length).toBe(1);
 await page.evaluate(()=>{history.pushState({...history.state,key:'new-fictional-support-entry'},'',location.href);dispatchEvent(new PopStateEvent('popstate',{state:history.state}));});
 await expect(page.getByLabel('Short title',{exact:true})).toHaveValue('');await expect(page.getByRole('heading',{level:1,name:'Report a problem.',exact:true})).toBeFocused();await fillReport(page,'New history support draft');
 held.resolve();await expect.poll(()=>state.completedSubmissions).toBe(1);await expect(page.getByLabel('Short title',{exact:true})).toHaveValue('New history support draft');await expect(queuedReport(page)).toHaveCount(0);
});

test('known quota and validation rejection preserve editable details and hide provider diagnostics',async({page})=>{
 const state=await fixture(page);
 for(const error of[{code:'P0001',details:'bug_report_limit',message:'Private provider quota diagnostic'},{code:'22023',message:'Private provider validation diagnostic'}]){
  state.submitReject={status:400,data:error};await fillReport(page);await page.getByRole('button',{name:'Send report',exact:true}).click();await expect(page.getByLabel('Short title',{exact:true})).toBeEnabled();await expect(page.getByLabel('Short title',{exact:true})).toHaveValue('Original fictional report after submission');
  await expect(page.getByRole('button',{name:'Send report',exact:true})).toBeEnabled();await expect(page.locator('#root')).not.toContainText('Private provider');
 }
 expect(state.submissions).toHaveLength(2);expect(state.receipts.size).toBe(0);expect(state.submissions[0].p_request_id).not.toBe(state.submissions[1].p_request_id);
});

test('missing receipt schema fails explicitly without falling back to an untracked submission',async({page})=>{
 const state=await fixture(page);state.submitReject={status:404,data:{code:'PGRST202',message:'Private schema diagnostic'}};await fillReport(page);await page.getByRole('button',{name:'Send report',exact:true}).click();
 await expect(page.getByText('Reporting is temporarily unavailable. Please try again later.',{exact:true})).toBeVisible();await expect(page.getByLabel('Short title',{exact:true})).toBeEnabled();expect(state.submissions).toHaveLength(1);expect(state.submissions[0].p_request_id).toMatch(/^[0-9a-f-]{36}$/);expect(state.receipts.size).toBe(0);
});

function moreReports(state){state.rows[first.id]=[state.rows[first.id][0],...Array.from({length:28},(_,n)=>report('92000000-0000-4000-8000-'+String(9000-n).padStart(12,'0'),'Original fictional history report '+n))];}

test('bounded history continues with exact microseconds, preserves drafts and focuses the first new report',async({page})=>{
 const state=await fixture(page);moreReports(state);await fillReport(page,'A report draft retained during history browsing');await page.getByRole('button',{name:'Refresh your reports',exact:true}).click();
 const history=page.getByRole('region',{name:'Your support reports',exact:true});await expect(history.getByRole('article')).toHaveCount(25);await page.getByRole('button',{name:'Load more reports',exact:true}).click();await expect(history.getByRole('article')).toHaveCount(29);
 await expect(history.getByRole('article',{name:'Original fictional history report 24',exact:true})).toBeFocused();await expect(page.getByLabel('Short title',{exact:true})).toHaveValue('A report draft retained during history browsing');
 expect(state.pageInputs.at(-1).p_cursor.createdAt).toBe('2026-01-01T12:00:00.123456Z');expect(state.pageInputs.at(-1).p_cursor.ownerId).toBe(first.id);expect(state.submissions).toEqual([]);
});

test('overlapping continuation data stays recoverable without crashing or clearing the current draft',async({page})=>{
 const state=await fixture(page);moreReports(state);await page.getByRole('button',{name:'Refresh your reports',exact:true}).click();const history=page.getByRole('region',{name:'Your support reports',exact:true});await expect(history.getByRole('article')).toHaveCount(25);
 await fillReport(page,'A draft during a malformed continuation');state.duplicatePage=true;await page.getByRole('button',{name:'Load more reports',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Couldn’t load your reports');await expect(history.getByRole('article')).toHaveCount(25);await expect(page.getByLabel('Short title',{exact:true})).toHaveValue('A draft during a malformed continuation');
 state.duplicatePage=false;await page.getByRole('button',{name:'Load more reports',exact:true}).click();await expect(history.getByRole('article')).toHaveCount(29);expect(state.submissions).toEqual([]);
});

test('failed identity verification clears private history and draft until an explicit new check',async({page})=>{
 const state=await fixture(page);await fillReport(page,'A private draft before identity becomes unavailable');state.authFailure=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByRole('alert')).toContainText('Report access could not be verified');await expect(page.getByText(firstTitle,{exact:true})).toHaveCount(0);await expect(page.getByLabel('Short title',{exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{level:1,name:'Report a problem.',exact:true})).toBeFocused();
 state.authFailure=false;await page.getByRole('button',{name:'Check report access',exact:true}).click();await expect(page.getByText(firstTitle,{exact:true})).toBeVisible();await expect(page.getByLabel('Short title',{exact:true})).toHaveValue('');expect(state.submissions).toEqual([]);await expect(page.locator('#root')).not.toContainText('Private identity');
});

test('a denied report read clears the whole private scope and ignores a late committed acknowledgement',async({page})=>{
 const state=await fixture(page),held=deferred();state.submitHold=held;await fillReport(page);await page.getByRole('button',{name:'Send report',exact:true}).click();await expect.poll(()=>state.submissions.length).toBe(1);
 state.readFailure={status:403,data:{code:'42501',message:'Private capability diagnostic'}};await page.getByRole('button',{name:'Refresh your reports',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Report access could not be verified');await expect(page.getByText(firstTitle,{exact:true})).toHaveCount(0);await expect(page.getByLabel('Short title',{exact:true})).toHaveCount(0);
 held.resolve();await expect.poll(()=>state.completedSubmissions).toBe(1);state.readFailure=false;state.submitHold=null;await page.getByRole('button',{name:'Check report access',exact:true}).click();await expect(page.getByText('Original fictional report after submission',{exact:true})).toBeVisible();await expect(page.getByLabel('Short title',{exact:true})).toHaveValue('');expect(state.submissions).toHaveLength(1);await expect(page.locator('#root')).not.toContainText('Private capability');
});

test('a cached account cannot open report data until its current identity matches',async({page})=>{
 const state=await fixture(page,{waitForReports:false,identityOverride:second});await expect(page.getByRole('alert')).toContainText('Your sign-in changed or ended');await expect(page.getByLabel('Short title',{exact:true})).toHaveCount(0);expect(state.reads[first.id]??0).toBe(0);
 state.identityOverride=null;await page.getByRole('button',{name:'Check report access',exact:true}).click();await expect(page.getByText(firstTitle,{exact:true})).toBeVisible();expect(state.submissions).toEqual([]);
});

test('a timed-out initial identity read cannot later reopen private report data',async({page})=>{
 await page.clock.install();const held=deferred(),state=await fixture(page,{waitForReports:false,identityHold:held});await expect(page.getByText('Checking report access…',{exact:true})).toBeVisible();await page.clock.fastForward(10001);await expect(page.getByRole('alert')).toContainText('Report access could not be verified');
 held.resolve();state.identityHold=null;await expect(page.getByLabel('Short title',{exact:true})).toHaveCount(0);expect(state.reads[first.id]??0).toBe(0);await page.getByRole('button',{name:'Check report access',exact:true}).click();await expect(page.getByText(firstTitle,{exact:true})).toBeVisible();expect(state.submissions).toEqual([]);
});

test('leaving the report page aborts its pending request and a late acknowledgement cannot reopen it',async({page})=>{
 const state=await fixture(page),held=deferred();state.submitHold=held;let aborted=0;page.on('requestfailed',request=>{if(request.url().endsWith('/rpc/submit_bug_report'))aborted++;});
 await fillReport(page);await page.getByRole('button',{name:'Send report',exact:true}).click();await expect.poll(()=>state.submissions.length).toBe(1);
 await page.getByRole('banner').getByRole('link',{name:'DMocks home',exact:true}).click();await expect(page.getByRole('heading',{level:1,name:'Report a problem.',exact:true})).toHaveCount(0);await expect.poll(()=>aborted).toBe(1);
 held.resolve();await expect.poll(()=>state.completedSubmissions).toBe(1);await expect(queuedReport(page)).toHaveCount(0);await page.getByRole('link',{name:'Report a problem',exact:true}).click();
 await expect(page.getByLabel('Short title',{exact:true})).toHaveValue('');await expect(page.getByText('Original fictional report after submission',{exact:true})).toBeVisible();expect(state.submissions).toHaveLength(1);
});

test('validation, long private replies and report controls support keyboard, WCAG and 320px in both themes',async({page})=>{
 const state=await fixture(page);await page.getByLabel('Short title',{exact:true}).fill('four');await page.getByRole('textbox',{name:'What happened?',exact:true}).fill('short');await page.getByRole('button',{name:'Send report',exact:true}).press('Enter');
 await expect(page.getByLabel('Short title',{exact:true})).toHaveAttribute('aria-invalid','true');await expect(page.getByLabel('Short title',{exact:true})).toBeFocused();await expect(page.getByRole('textbox',{name:'What happened?',exact:true})).toHaveAttribute('aria-invalid','true');expect(state.submissions).toEqual([]);
 state.rows[first.id]=[{...state.rows[first.id][0],title:'T'.repeat(140),description:'D'.repeat(5000),adminReply:'R'.repeat(5000)}];await page.getByRole('button',{name:'Refresh your reports',exact:true}).click();await expect(page.getByRole('article')).toHaveCount(1);
 await page.setViewportSize({width:320,height:740});await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
 for(const dark of[false,true]){
  if(dark)await page.getByRole('switch',{name:'Dark mode',exact:true}).click();
  await expect.poll(()=>page.getByRole('button',{name:'Send report',exact:true}).evaluate(node=>getComputedStyle(node).backgroundColor)).toBe(dark?'rgb(220, 235, 161)':'rgb(36, 71, 53)');
  expect(await page.evaluate(async()=>(await window.axe.run('[aria-label="Report access"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))})))).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=320)).toBe(true);
 }
});
