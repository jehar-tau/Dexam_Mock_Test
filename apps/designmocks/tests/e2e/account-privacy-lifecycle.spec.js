import {expect,test}from'@playwright/test';
import {portalFixtureURL,seedPortalSession,stubPortalProvider}from'./portal-fixture.js';
test.use({baseURL:portalFixtureURL});
const first={id:'00000000-0000-4000-8000-000000001301',email:'fictional-privacy-first@example.invalid'},second={id:'00000000-0000-4000-8000-000000001302',email:'fictional-privacy-second@example.invalid'};
const api='https://dmocks-portal-fixture.supabase.co',headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-api-version','Access-Control-Allow-Methods':'POST, GET, OPTIONS'};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
const request=(actor,status='open')=>({id:actor===first.id?'00000000-0000-4000-8000-000000001311':'00000000-0000-4000-8000-000000001312',type:'account_deletion',status,adminNote:actor===first.id?'Fictional first private team note':'Fictional second private team note',createdAt:'2026-11-08T01:00:00.000001Z',updatedAt:'2026-11-08T01:00:00.000001Z'});
const actorOf=route=>JSON.parse(Buffer.from(route.request().headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub;
async function changeAccount(page,state,actor){state.actor=actor;await seedPortalSession(page,actor);await page.evaluate(()=>{const key='sb-dmocks-portal-fixture-auth-token',channel=new BroadcastChannel(key);channel.postMessage({event:'SIGNED_IN',session:JSON.parse(localStorage.getItem(key))});channel.close();});}
async function fixture(page,{identity=null,holdRead=null}={}){
 const state={actor:first,identity,rows:{[first.id]:[request(first.id)],[second.id]:[request(second.id)]},reads:{},completedReads:0,holds:{[first.id]:holdRead},mutations:[],exports:[],completedMutations:0,actionHold:null,readFailure:null,actionFailure:null,identityHold:null,heldIdentity:0,identityFailure:false,identityChecks:0};
 const provider=await stubPortalProvider(page,name=>{if(name==='can_review_drawings'||name==='is_dmocks_admin')return false;if(name==='logout')return null;});
 await page.route(api+'/auth/v1/user',async route=>{if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});state.identityChecks++;const actor=state.identity??actorOf(route),held=state.identityHold;if(held){state.heldIdentity++;await held.promise;}await route.fulfill({headers,status:state.identityFailure?503:200,json:state.identityFailure?{message:'Private fictional Auth diagnostic'}:{id:actor,aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}}}).catch(()=>{});});
 for(const name of['my_privacy_requests','request_account_deletion','cancel_my_privacy_request','export_my_account_data'])await page.route(api+'/rest/v1/rpc/'+name,async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});const actor=actorOf(route);let data,status=200;
  if(name==='my_privacy_requests'){state.reads[actor]=(state.reads[actor]??0)+1;data=structuredClone(state.rows[actor]);const hold=state.holds[actor];if(hold)await hold.promise;if(state.readFailure){data=state.readFailure;status=400;}state.completedReads++;}
  else if(name==='export_my_account_data'){state.exports.push(actor);data={schemaVersion:2,exportedAt:new Date().toISOString(),accountId:actor,profile:null,attempts:[],questionReports:[],drawingUploads:[],results:{examMocks:[],allIndia:[],drawingReviews:[]}};}
  else{state.mutations.push({name,actor,input:route.request().postDataJSON()});if(name==='request_account_deletion'){const active=state.rows[actor].find(row=>['open','in_progress'].includes(row.status));if(!active)state.rows[actor]=[request(actor)];data=(active??state.rows[actor][0]).id;}else{const row=state.rows[actor].find(row=>row.id===route.request().postDataJSON().p_id);if(row)row.status='cancelled';data=null;}const hold=state.actionHold;if(hold)await hold.promise;if(Object.hasOwn(state,'acknowledgement'))data=state.acknowledgement;if(state.actionFailure){data=state.actionFailure;status=400;}state.completedMutations++;}
  await route.fulfill({headers,status,json:data}).catch(()=>{});
 });
 await page.goto('/account');await seedPortalSession(page,first);await page.reload();await expect(page.getByRole('heading',{name:'Your data and account',exact:true})).toBeVisible();return Object.assign(state,provider);
}

test('privacy data is not opened by a cached identity belonging to another account',async({page})=>{
 const state=await fixture(page,{identity:second.id});await expect(page.getByRole('alert')).toContainText('Privacy access');expect(Object.values(state.reads).reduce((a,b)=>a+b,0)).toBe(0);await expect(page.locator('#root')).not.toContainText('Fictional first private team note');
});

test('a held privacy read cannot replace the newer account request status',async({page})=>{
 const held=deferred(),state=await fixture(page,{holdRead:held});await expect.poll(()=>state.reads[first.id]??0).toBe(1);await changeAccount(page,state,second);await expect(page.getByText('Fictional second private team note',{exact:true})).toBeVisible();held.resolve();await expect.poll(()=>state.completedReads).toBeGreaterThan(1);await expect(page.getByText('Fictional second private team note',{exact:true})).toBeVisible();await expect(page.locator('#root')).not.toContainText('Fictional first private team note');
});

test('a pending privacy acknowledgement cannot restore a same-route history message',async({page})=>{
 const state=await fixture(page),held=deferred();await expect(page.getByText('Fictional first private team note',{exact:true})).toBeVisible();state.actionHold=held;await page.getByRole('button',{name:'Cancel deletion request',exact:true}).click();await expect.poll(()=>state.mutations.length).toBe(1);await page.evaluate(()=>{history.pushState({...history.state,key:'privacy-new-history'},'',location.href);dispatchEvent(new PopStateEvent('popstate',{state:history.state}));});await expect(page.getByRole('button',{name:'Request account deletion',exact:true})).toBeVisible();held.resolve();await expect.poll(()=>state.completedMutations).toBe(1);await expect(page.getByText('Deletion request cancelled.',{exact:true})).toHaveCount(0);
});

test('privacy mutation failures hide provider diagnostics and require a read before another write',async({page})=>{
 const state=await fixture(page);await expect(page.getByText('Fictional first private team note',{exact:true})).toBeVisible();state.actionFailure={code:'P0001',message:'Private fictional database diagnostic'};await page.getByRole('button',{name:'Cancel deletion request',exact:true}).click();await expect(page.getByRole('status')).toContainText('Refresh privacy requests');await expect(page.locator('#root')).not.toContainText('Private fictional database diagnostic');await expect(page.getByRole('button',{name:'Cancel deletion request',exact:true})).toBeDisabled();expect(state.mutations).toHaveLength(1);
});

test('a silent SDK token change cannot send the previous account deletion action',async({page})=>{
 const state=await fixture(page);await expect(page.getByText('Fictional first private team note',{exact:true})).toBeVisible();await seedPortalSession(page,second);await page.getByRole('button',{name:'Cancel deletion request',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Privacy access');expect(state.mutations).toEqual([]);expect(state.rows[second.id][0].status).toBe('open');
});

test('an unknown committed deletion request freezes writes until an explicit read without replay',async({page})=>{
 const state=await fixture(page);await page.clock.install();state.rows[first.id]=[];await page.getByRole('button',{name:'Refresh privacy requests',exact:true}).click();const held=deferred();state.actionHold=held;
 await expect(page.getByRole('button',{name:'Request account deletion',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Request account deletion',exact:true}).evaluate(node=>{node.click();node.click();});await expect.poll(()=>state.mutations.length).toBe(1);expect(state.rows[first.id][0].status).toBe('open');await page.clock.fastForward(20001);await expect(page.getByRole('status')).toContainText('Couldn’t confirm that change');await expect(page.getByRole('button',{name:'Request account deletion',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Refresh privacy requests',exact:true}).press('Enter');await expect(page.getByText('Deletion request: open',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Cancel deletion request',exact:true})).toBeEnabled();held.resolve();await expect.poll(()=>state.completedMutations).toBe(1);await expect(page.getByRole('status')).toContainText('Privacy requests refreshed');expect(state.mutations).toHaveLength(1);
});

test('a malformed acknowledgement cannot confirm or automatically repeat a cancellation',async({page})=>{
 const state=await fixture(page);await expect(page.getByText('Deletion request: open',{exact:true})).toBeVisible();state.acknowledgement={ok:true};await page.getByRole('button',{name:'Cancel deletion request',exact:true}).press('Enter');await expect(page.getByRole('status')).toContainText('Couldn’t confirm that change');await expect(page.getByRole('button',{name:'Cancel deletion request',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Refresh privacy requests',exact:true}).click();await expect(page.getByRole('button',{name:'Request account deletion',exact:true})).toBeEnabled();expect(state.mutations).toHaveLength(1);
});

test('failed and malformed privacy reads keep changes closed until a valid explicit refresh',async({page})=>{
 const state=await fixture(page);await expect(page.getByText('Deletion request: open',{exact:true})).toBeVisible();state.readFailure={code:'P0001',message:'Private fictional request diagnostic'};await page.getByRole('button',{name:'Refresh privacy requests',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Couldn’t load your privacy requests');await expect(page.getByRole('button',{name:'Request account deletion',exact:true})).toBeDisabled();await expect(page.locator('#root')).not.toContainText('Private fictional request diagnostic');state.readFailure=null;state.rows[first.id]=[{...request(first.id),status:'untrusted'}];await page.getByRole('button',{name:'Refresh privacy requests',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Couldn’t load your privacy requests');state.rows[first.id]=[request(first.id,'in_progress')];await page.getByRole('button',{name:'Refresh privacy requests',exact:true}).click();await expect(page.getByText('Deletion request: in progress',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Cancel deletion request',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Request account deletion',exact:true})).toHaveCount(0);expect(state.mutations).toEqual([]);
});

test('the owner can read the latest closed or declined privacy decision after a refresh', async ({page}) => {
 const state = await fixture(page), privacy = page.getByRole('region',{name:'Your data and account',exact:true});
 await expect(privacy.getByText('Deletion request: open',{exact:true})).toBeVisible();
 for (const status of ['closed','declined']) {
  const note = 'Original fictional decision marked ' + status + '.';
  state.rows[first.id] = [{...request(first.id,status),adminNote:note}];
  await privacy.getByRole('button',{name:'Refresh privacy requests',exact:true}).press('Enter');
  await expect(privacy.getByText('Latest deletion request: '+status,{exact:true})).toBeVisible();
  await expect(privacy.getByText(note,{exact:true})).toBeVisible();
  await expect(privacy.getByRole('button',{name:'Request account deletion',exact:true})).toBeEnabled();
 }
 await changeAccount(page,state,second);
 await expect(privacy.getByText('Fictional second private team note',{exact:true})).toBeVisible();
 await expect(privacy.getByText('Original fictional decision marked declined.',{exact:true})).toHaveCount(0);
 expect(state.mutations).toEqual([]);
});

test('a late read after its deadline does not reopen private request controls',async({page})=>{
 const state=await fixture(page);await expect(page.getByText('Deletion request: open',{exact:true})).toBeVisible();await page.clock.install();const held=deferred();state.holds[first.id]=held;const before=state.reads[first.id];await page.getByRole('button',{name:'Refresh privacy requests',exact:true}).click();await expect.poll(()=>state.reads[first.id]).toBe(before+1);await page.clock.fastForward(20001);await expect(page.getByRole('alert')).toContainText('Couldn’t load your privacy requests');held.resolve();state.holds[first.id]=null;await expect.poll(()=>state.completedReads).toBe(before+1);await expect(page.getByText('Fictional first private team note',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Refresh privacy requests',exact:true}).click();await expect(page.getByText('Fictional first private team note',{exact:true})).toBeVisible();expect(state.mutations).toEqual([]);
});

test('an unresponsive identity check times out a privacy action and cannot dispatch later',async({page})=>{
 const state=await fixture(page);await expect(page.getByText('Deletion request: open',{exact:true})).toBeVisible();await page.clock.install();const held=deferred();state.identityHold=held;await page.getByRole('button',{name:'Cancel deletion request',exact:true}).click();await expect.poll(()=>state.heldIdentity).toBe(1);await page.clock.fastForward(20001);await expect(page.getByRole('status')).toContainText('Couldn’t confirm that change');held.resolve();state.identityHold=null;await page.getByRole('button',{name:'Refresh privacy requests',exact:true}).click();await expect(page.getByRole('button',{name:'Cancel deletion request',exact:true})).toBeEnabled();expect(state.mutations).toEqual([]);
});

test('a token change after verification keeps a cancellation bound to the original account',async({page})=>{
 const state=await fixture(page);await expect(page.getByText('Deletion request: open',{exact:true})).toBeVisible();const held=deferred();state.identityHold=held;await page.getByRole('button',{name:'Cancel deletion request',exact:true}).click();await expect.poll(()=>state.heldIdentity).toBe(1);await seedPortalSession(page,second);state.identityHold=null;held.resolve();await expect.poll(()=>state.mutations.length).toBe(1);expect(state.mutations[0].actor).toBe(first.id);expect(state.rows[first.id][0].status).toBe('cancelled');expect(state.rows[second.id][0].status).toBe('open');await expect(page.getByRole('alert')).toContainText('Privacy access');await expect(page.getByText('Fictional first private team note',{exact:true})).toHaveCount(0);
});

test('an export pins the verified account and never downloads after a silent token mismatch',async({page})=>{
 const state=await fixture(page);await expect(page.getByText('Deletion request: open',{exact:true})).toBeVisible();const downloads=[];page.on('download',value=>downloads.push(value));const held=deferred();state.identityHold=held;await page.getByRole('button',{name:'Download my data',exact:true}).click();await expect.poll(()=>state.heldIdentity).toBe(1);await seedPortalSession(page,second);state.identityHold=null;held.resolve();await expect.poll(()=>downloads.length).toBe(1);expect(state.exports).toEqual([first.id]);await page.getByRole('button',{name:'Download my data',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Privacy access');expect(state.exports).toEqual([first.id]);expect(downloads).toHaveLength(1);expect(state.mutations).toEqual([]);
});

test('visible identity loss clears private requests and explicit recovery never repeats work',async({page})=>{
 await page.clock.install();const state=await fixture(page);await expect(page.getByText('Fictional first private team note',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel deletion request',exact:true}).focus();const before=state.identityChecks;state.identityFailure=true;await page.clock.fastForward(60001);await expect.poll(()=>state.identityChecks).toBeGreaterThan(before);await page.clock.fastForward(10001);await expect(page.getByRole('alert')).toContainText('Privacy access could not be verified');await expect(page.getByText('Fictional first private team note',{exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Your data and account',exact:true})).toBeFocused();state.identityFailure=false;await page.clock.fastForward(60001);await expect(page.getByRole('button',{name:'Cancel deletion request',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Check privacy access',exact:true}).press('Enter');await expect(page.getByText('Fictional first private team note',{exact:true})).toBeVisible();expect(state.mutations).toEqual([]);
});

test('long private team notes and cancellation feedback support keyboard and both themes at 320px',async({page})=>{
 const state=await fixture(page);await expect(page.getByText('Deletion request: open',{exact:true})).toBeVisible();state.rows[first.id][0].adminNote='W'.repeat(2000);await page.getByRole('button',{name:'Refresh privacy requests',exact:true}).press('Enter');await expect(page.locator('.account-privacy')).toContainText('W'.repeat(2000));await page.setViewportSize({width:320,height:740});await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
 for(const dark of[false,true]){if(dark)await page.getByRole('switch',{name:'Dark mode',exact:true}).click();await page.getByRole('button',{name:'Download my data',exact:true}).focus();await expect.poll(()=>page.locator('html').evaluate(node=>getComputedStyle(node).backgroundColor)).toBe(dark?'rgb(18, 37, 31)':'rgb(250, 249, 243)');expect(await page.evaluate(async()=>(await window.axe.run('.account-privacy-panel',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(row=>row.id))).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=320)).toBe(true);}
 await page.getByRole('button',{name:'Cancel deletion request',exact:true}).press('Enter');const confirmation=page.getByRole('status').filter({hasText:/^Deletion request cancelled\.$/});await expect(confirmation).toBeVisible();await expect(confirmation).toBeFocused();expect(state.mutations).toHaveLength(1);
});
