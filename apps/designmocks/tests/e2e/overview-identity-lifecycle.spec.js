import{expect,test}from'@playwright/test';
import{portalFixtureURL,seedPortalSession,stubPortalProvider}from'./portal-fixture.js';
test.use({baseURL:portalFixtureURL});
const first={id:'00000000-0000-4000-8000-000000001701',email:'fictional-overview-first@example.invalid'},second={id:'00000000-0000-4000-8000-000000001702',email:'fictional-overview-second@example.invalid'};
const paperId='10000000-0000-4000-8000-000000001701',attemptId='20000000-0000-4000-8000-000000001701';
const title='Original fictional first-account saved paper',api='https://dmocks-portal-fixture.supabase.co',headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-api-version','Access-Control-Allow-Methods':'POST, GET, OPTIONS'};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
const actorOf=route=>JSON.parse(Buffer.from(route.request().headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub;
async function fixture(page,{identity=null,holdHistory=false,holdIdentity=false}={}){
 const state={identity,calls:[],authHold:holdIdentity?deferred():null,heldAuth:0,historyHold:holdHistory?deferred():null,heldHistory:0,startHold:null,starts:[],finishedStarts:0,startFailure:null,startValue:attemptId};await stubPortalProvider(page,name=>{if(name==='public_all_india_top_ten')return[];});
 await page.route(api+'/auth/v1/user',async route=>{if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});const actor=state.identity??actorOf(route),held=state.authHold;if(held){state.heldAuth++;await held.promise;}await route.fulfill({headers,json:{id:actor,aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}}}).catch(()=>{});});
 await page.route(api+'/rest/v1/rpc/**',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});const name=new URL(route.request().url()).pathname.split('/').at(-1),actor=actorOf(route),input=route.request().postDataJSON();state.calls.push({name,actor,input});let data,status=200;
  if(name==='finalize_my_expired_attempts')data=0;
  else if(name==='my_pass')data={active:true,expiresAt:'2027-11-08T00:00:00Z'};
  else if(name==='my_overview_analytics')data={completed:1,waitingForResults:0,objectiveAccuracy:null,objectiveAnswered:0,topics:[],exams:[],drawingReviews:{pending:0,released:0}};
  else if(name==='available_papers')data=[{id:paperId,exam:'uceed',title:'Original fictional released paper',durationSeconds:900,qualityHeld:false}];
  else if(name==='my_attempt_history'){data=[{id:attemptId,title:actor===first.id?title:'Original fictional second-account saved paper',status:'submitted',resultsPending:false,score:1,total:3}];const held=state.historyHold;if(held){state.heldHistory++;await held.promise;}}
  else if(name==='start_attempt'){state.starts.push({actor,input});data=state.startFailure??state.startValue;status=state.startFailure?400:200;const held=state.startHold;if(held)await held.promise;}
  else if(name==='read_attempt'){status=403;data={code:'42501',message:'Fictional fixture stops after navigation.'};}
  else throw new Error('Unexpected fictional Overview RPC: '+name);
  await route.fulfill({headers,status,json:data}).catch(()=>{});if(name==='start_attempt')state.finishedStarts++;
 });
 await page.goto('/account');await seedPortalSession(page,first);await page.goto('/dashboard');await expect(page.getByRole('heading',{name:/Welcome to your/})).toBeVisible();return state;
}
const start=page=>page.locator('.paper-list article').getByRole('button');
const history=page=>page.evaluate(()=>{window.history.pushState({...window.history.state,key:'new-overview-history'},'',location.href);dispatchEvent(new PopStateEvent('popstate',{state:window.history.state}));});
async function notify(page,actor){await seedPortalSession(page,actor);await page.evaluate(()=>{const key='sb-dmocks-portal-fixture-auth-token',channel=new BroadcastChannel(key);channel.postMessage({event:'SIGNED_IN',session:JSON.parse(localStorage.getItem(key))});channel.close();});}

test('Overview verifies current identity before reading or finalizing private attempts',async({page})=>{
 const state=await fixture(page,{identity:second.id});await expect(page.getByRole('alert')).toContainText('Overview access');expect(state.calls).toEqual([]);await expect(page.getByRole('link',{name:title,exact:true})).toHaveCount(0);
});
test('changing accounts clears old Overview history while the next account read is pending',async({page})=>{
 const state=await fixture(page);await expect(page.getByRole('link',{name:title,exact:true})).toBeVisible();state.historyHold=deferred();await notify(page,second);await expect.poll(()=>state.heldHistory).toBe(1);await expect(page.getByRole('link',{name:title,exact:true})).toHaveCount(0);state.historyHold.resolve();await expect(page.getByRole('link',{name:'Original fictional second-account saved paper',exact:true})).toBeVisible();
});
test('same-route history disposes a previous Overview snapshot before a replacement read',async({page})=>{
 const state=await fixture(page);await expect(page.getByRole('link',{name:title,exact:true})).toBeVisible();state.historyHold=deferred();await history(page);await expect(page.getByRole('link',{name:title,exact:true})).toHaveCount(0);await expect.poll(()=>state.heldHistory).toBe(1);state.historyHold.resolve();await expect(page.getByRole('link',{name:title,exact:true})).toBeVisible();
});
test('a silent token change cannot start the previous Overview account paper',async({page})=>{
 const state=await fixture(page);await expect(start(page)).toBeEnabled();await seedPortalSession(page,second);await start(page).click();await expect(page.getByRole('alert')).toContainText('Overview access');expect(state.starts).toEqual([]);await expect(page).toHaveURL('/dashboard');
});
test('an Overview start acknowledgement cannot navigate through changed same-route history',async({page})=>{
 const state=await fixture(page);await expect(start(page)).toBeEnabled();state.startHold=deferred();await start(page).click();await expect.poll(()=>state.starts.length).toBe(1);await history(page);state.startHold.resolve();await expect.poll(()=>state.finishedStarts).toBe(1);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await expect(page).toHaveURL('/dashboard');await expect(start(page)).toBeEnabled();
});
test('synchronous repeated Overview start clicks create only one in-flight request',async({page})=>{
 const state=await fixture(page);await expect(start(page)).toBeEnabled();state.startHold=deferred();await start(page).evaluate(node=>{node.click();node.click();});await expect.poll(()=>state.starts.length).toBe(1);await expect(start(page)).toBeDisabled();state.startHold.resolve();await expect(page).toHaveURL('/attempt/'+attemptId);expect(state.starts).toHaveLength(1);
});
test('a stalled Overview read expires and only an explicit refresh can replace it',async({page})=>{
 await page.clock.install();const state=await fixture(page,{holdHistory:true});await expect.poll(()=>state.heldHistory).toBe(1);await page.clock.fastForward(20001);await expect(page.getByRole('alert')).toHaveText('Couldn’t load your workspace. Refresh it to try again.');const held=state.historyHold;state.historyHold=null;held.resolve();await expect(page.getByRole('link',{name:title,exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Refresh workspace',exact:true}).press('Enter');await expect(page.getByRole('link',{name:title,exact:true})).toBeVisible();expect(state.starts).toEqual([]);
});
test('a failed Overview start hides provider diagnostics and requires current saved-state inspection',async({page})=>{
 const state=await fixture(page);await expect(start(page)).toBeEnabled();state.startFailure={code:'P0001',message:'private-provider-host-token-diagnostic'};await start(page).click();await expect(page.getByRole('alert')).toContainText('Couldn’t confirm this start');await expect(page.getByText('private-provider-host-token-diagnostic',{exact:false})).toHaveCount(0);await expect(start(page)).toBeDisabled();expect(state.starts).toHaveLength(1);state.startFailure=null;await page.getByRole('button',{name:'Refresh workspace',exact:true}).press('Enter');await expect(start(page)).toBeEnabled();expect(state.starts).toHaveLength(1);
});
test('a start verified before a token swap creates only the intended actor attempt and never navigates as the new account',async({page})=>{
 const state=await fixture(page);await expect(start(page)).toBeEnabled();state.authHold=deferred();await start(page).click();await expect.poll(()=>state.heldAuth).toBe(1);await seedPortalSession(page,second);state.authHold.resolve();await expect(page.getByRole('alert')).toContainText('Overview access');expect(state.starts.map(item=>item.actor)).toEqual([first.id]);await expect(page).toHaveURL('/dashboard');
});
test('late initial identity verification cannot reopen Overview after its deadline',async({page})=>{
 await page.clock.install();const state=await fixture(page,{holdIdentity:true});await expect.poll(()=>state.heldAuth).toBeGreaterThan(0);await page.clock.fastForward(10001);await expect(page.getByRole('alert')).toContainText('Overview access');expect(state.calls).toEqual([]);const held=state.authHold;state.authHold=null;held.resolve();await expect(page.getByRole('link',{name:title,exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Check Overview access',exact:true}).press('Enter');await expect(start(page)).toBeEnabled();expect(state.starts).toEqual([]);
});
test('an unresponsive identity check cannot start a paper after its deadline',async({page})=>{
 await page.clock.install();const state=await fixture(page);await expect(start(page)).toBeEnabled();state.authHold=deferred();await start(page).click();await expect.poll(()=>state.heldAuth).toBe(1);await page.clock.fastForward(20001);await expect(page.getByRole('alert')).toContainText('Couldn’t confirm this start');const held=state.authHold;state.authHold=null;held.resolve();await expect(start(page)).toBeDisabled();expect(state.starts).toEqual([]);await page.getByRole('button',{name:'Refresh workspace',exact:true}).press('Enter');await expect(start(page)).toBeEnabled();expect(state.starts).toEqual([]);
});
test('a malformed successful start receipt cannot navigate or trigger a replay',async({page})=>{
 const state=await fixture(page);await expect(start(page)).toBeEnabled();state.startValue={id:attemptId};await start(page).click();await expect(page.getByRole('alert')).toContainText('Couldn’t confirm this start');await expect(page).toHaveURL('/dashboard');await expect(start(page)).toBeDisabled();expect(state.starts).toHaveLength(1);await page.getByRole('button',{name:'Refresh workspace',exact:true}).click();await expect(start(page)).toBeEnabled();expect(state.starts).toHaveLength(1);
});
