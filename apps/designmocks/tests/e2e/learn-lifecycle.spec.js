import{expect,test}from'@playwright/test';
import{portalFixtureURL,seedPortalSession,stubPortalProvider}from'./portal-fixture.js';
test.use({baseURL:portalFixtureURL});
const first={id:'00000000-0000-4000-8000-000000001501',email:'fictional-learn-first@example.invalid'},second={id:'00000000-0000-4000-8000-000000001502',email:'fictional-learn-second@example.invalid'};
const lesson={id:'50000000-0000-4000-8000-000000001501',slug:'original-fictional-observation',exam:'ceed',topic:'observation',title:'Original Fictional Observation',summary:'An original fictional lesson summary for learning lifecycle tests.',body:'An original fictional theory body for reading before topic practice.',completed:false};
const api='https://dmocks-portal-fixture.supabase.co',headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-api-version','Access-Control-Allow-Methods':'POST, GET, OPTIONS'};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
const actorOf=route=>JSON.parse(Buffer.from(route.request().headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub;
async function changeAccount(page,actor){await seedPortalSession(page,actor);await page.evaluate(()=>{const key='sb-dmocks-portal-fixture-auth-token',channel=new BroadcastChannel(key);channel.postMessage({event:'SIGNED_IN',session:JSON.parse(localStorage.getItem(key))});channel.close();});}
async function historyEntry(page,key){await page.evaluate(key=>{history.pushState({...history.state,key},'',location.href);dispatchEvent(new PopStateEvent('popstate',{state:history.state}));},key);}
async function fixture(page,{identity=null,catalogHold=null}={}){
 const state={identity,identityFailure:false,identityHold:null,heldIdentity:0,completeHold:null,readHold:null,catalogHold,catalogReads:0,startedReads:0,completedReads:0,writes:[],completedWrites:0,completed:{[first.id]:false,[second.id]:false},readFailure:null,catalogFailure:null,completeFailure:null,completeResponse:null,content:{...lesson},published:true};
 const provider=await stubPortalProvider(page,name=>{if(name==='public_all_india_top_ten')return[];});
 await page.route(api+'/auth/v1/user',async route=>{if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});const actor=state.identity??actorOf(route),held=state.identityHold;if(held){state.heldIdentity++;await held.promise;}await route.fulfill({headers,status:state.identityFailure?503:200,json:state.identityFailure?{message:'Private fictional learning Auth diagnostic'}:{id:actor,aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}}}).catch(()=>{});});
 for(const name of['learning_catalog','learning_progress','read_learning_lesson','complete_learning_lesson'])await page.route(api+'/rest/v1/rpc/'+name,async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});const actor=actorOf(route);let data,status=200;
  if(name==='learning_catalog'){state.catalogReads++;data=state.published?[{...state.content,completed:state.completed[actor]}]:[];const held=state.catalogHold;if(held)await held.promise;if(state.catalogFailure){data=state.catalogFailure;status=400;}}
  else if(name==='learning_progress')data={total:Number(state.published),completed:state.published?Number(state.completed[actor]):0,percent:state.published&&state.completed[actor]?100:0,recommendation:null};
  else if(name==='read_learning_lesson'){state.startedReads++;data={...state.content,completed:state.completed[actor]};const held=state.readHold;if(held)await held.promise;if(state.readFailure){data=state.readFailure;status=400;}state.completedReads++;}
  else{state.writes.push({actor,input:route.request().postDataJSON()});if(!state.completeFailure)state.completed[actor]=true;data=state.completeResponse;const held=state.completeHold;if(held)await held.promise;if(state.completeFailure){data=state.completeFailure;status=400;}state.completedWrites++;}
  await route.fulfill({headers,status,json:data}).catch(()=>{});
 });
 await page.goto('/dashboard/learn');await seedPortalSession(page,first);await page.reload();return Object.assign(state,provider);
}
const start=page=>page.getByRole('button',{name:'Start lesson →',exact:true}),complete=page=>page.getByRole('button',{name:'Mark complete',exact:true});

test('Learn checks the current account before private progress or lesson reads',async({page})=>{
 const state=await fixture(page,{identity:second.id});await expect(page.getByRole('alert')).toContainText('Learn access');expect(state.catalogReads).toBe(0);await expect(start(page)).toHaveCount(0);
});

test('same-route history discards an older lesson read before the reader can reopen',async({page})=>{
 const state=await fixture(page),held=deferred();await expect(start(page)).toBeEnabled();state.readHold=held;await start(page).click();await expect.poll(()=>state.startedReads).toBe(1);await historyEntry(page,'new-learning-history-entry');state.readHold=null;await expect(start(page)).toBeEnabled();held.resolve();await expect.poll(()=>state.completedReads).toBe(1);await expect(page.getByText(lesson.body,{exact:true})).toHaveCount(0);expect(state.writes).toEqual([]);
});

test('lesson completion rejects overlapping clicks before a render and commits once',async({page})=>{
 const state=await fixture(page),held=deferred();await start(page).click();await expect(page.getByText(lesson.body,{exact:true})).toBeVisible();state.completeHold=held;await complete(page).evaluate(node=>{node.click();node.click();});await expect.poll(()=>state.writes.length).toBeGreaterThan(0);held.resolve();await expect(page.getByRole('button',{name:'Lesson complete',exact:true})).toBeDisabled();expect(state.writes).toHaveLength(1);
});

test('an unresponsive lesson list expires without a late response reopening it',async({page})=>{
 await page.clock.install();const held=deferred(),state=await fixture(page,{catalogHold:held});await expect.poll(()=>state.catalogReads).toBeGreaterThan(0);await page.clock.fastForward(20001);await expect(page.getByRole('status')).toContainText('Couldn’t load the lesson list');held.resolve();state.catalogHold=null;await expect(start(page)).toHaveCount(0);expect(state.writes).toEqual([]);
});

test('a silent token change cannot mark a previous account lesson complete',async({page})=>{
 const state=await fixture(page);await start(page).click();await expect(page.getByText(lesson.body,{exact:true})).toBeVisible();await seedPortalSession(page,second);await complete(page).click();await expect(page.getByRole('alert')).toContainText('Learn access');expect(state.writes).toEqual([]);expect(state.completed[second.id]).toBe(false);
});

test('a committed completion cannot mark a newer account lesson or restore its old reader',async({page})=>{
 const state=await fixture(page),held=deferred();await start(page).click();await expect(complete(page)).toBeEnabled();state.completeHold=held;await complete(page).click();await expect.poll(()=>state.writes.length).toBe(1);await changeAccount(page,second);await expect(start(page)).toBeEnabled();await start(page).click();await expect(complete(page)).toBeEnabled();held.resolve();await expect.poll(()=>state.completedWrites).toBe(1);await expect(complete(page)).toBeEnabled();expect(state.completed[second.id]).toBe(false);expect(state.writes).toEqual([{actor:first.id,input:{p_lesson_id:lesson.id}}]);
});

test('unknown committed completion requires an explicit read without resubmission',async({page})=>{
 await page.clock.install();const state=await fixture(page),held=deferred();await start(page).click();await expect(complete(page)).toBeEnabled();state.completeHold=held;await complete(page).click();await expect.poll(()=>state.writes.length).toBe(1);await page.clock.fastForward(20001);await expect(page.getByRole('status')).toContainText('Couldn’t confirm lesson completion');await expect(complete(page)).toBeDisabled();await page.getByRole('button',{name:'Reload lesson',exact:true}).press('Enter');await expect(page.getByRole('button',{name:'Lesson complete',exact:true})).toBeDisabled();held.resolve();await expect.poll(()=>state.completedWrites).toBe(1);expect(state.writes).toHaveLength(1);await expect(page.getByText(lesson.body,{exact:true})).toBeVisible();
});

test('an invalid completion acknowledgement freezes another write until saved progress is checked',async({page})=>{
 const state=await fixture(page);await start(page).click();state.completeResponse={ok:true};await complete(page).click();await expect(page.getByRole('status')).toContainText('Couldn’t confirm lesson completion');await expect(complete(page)).toBeDisabled();await page.getByRole('button',{name:'Reload lesson',exact:true}).click();await expect(page.getByRole('button',{name:'Lesson complete',exact:true})).toBeDisabled();expect(state.writes).toHaveLength(1);
});

test('a timed-out theory read stays closed when its old body arrives and explicit reload recovers',async({page})=>{
 await page.clock.install();const state=await fixture(page),held=deferred();state.readHold=held;await start(page).click();await expect.poll(()=>state.startedReads).toBe(1);await page.clock.fastForward(20001);await expect(page.getByRole('status')).toContainText('Couldn’t open this lesson');held.resolve();state.readHold=null;await expect.poll(()=>state.completedReads).toBe(1);await expect(page.getByText(lesson.body,{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Reload lesson',exact:true}).click();await expect(page.getByText(lesson.body,{exact:true})).toBeVisible();expect(state.writes).toEqual([]);
});

test('invalid lesson bodies and provider list failures use static recovery without diagnostics',async({page})=>{
 const state=await fixture(page);state.content.body='short';await start(page).click();await expect(page.getByRole('status')).toContainText('Couldn’t open this lesson');await expect(page.getByText('short',{exact:true})).toHaveCount(0);state.content.body=lesson.body;await page.getByRole('button',{name:'Reload lesson',exact:true}).click();await expect(page.getByText(lesson.body,{exact:true})).toBeVisible();state.catalogFailure={code:'P0001',message:'Private fictional Learn provider diagnostic'};await page.getByRole('button',{name:'← All lessons',exact:true}).click();await expect(page.getByRole('status')).toContainText('Couldn’t load the lesson list');await expect(page.locator('#root')).not.toContainText('Private fictional Learn provider diagnostic');state.catalogFailure=null;await page.getByRole('button',{name:'Refresh lessons',exact:true}).click();await expect(start(page)).toBeEnabled();expect(state.writes).toEqual([]);
});

test('visible identity loss clears private learning state and requires explicit recovery',async({page})=>{
 await page.clock.install();const state=await fixture(page);await start(page).click();await expect(complete(page)).toBeEnabled();await complete(page).focus();state.identity=second.id;await page.clock.fastForward(60001);await expect(page.getByRole('alert')).toContainText('Learn access ended');await expect(page.getByText(lesson.body,{exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:/Build the idea/})).toBeFocused();state.identity=null;await page.clock.fastForward(60001);await expect(start(page)).toHaveCount(0);await page.getByRole('button',{name:'Check Learn access',exact:true}).press('Enter');await expect(start(page)).toBeEnabled();expect(state.writes).toEqual([]);
});

test('an unresponsive action identity read cannot dispatch completion after its deadline',async({page})=>{
 await page.clock.install();const state=await fixture(page),held=deferred();await start(page).click();await expect(complete(page)).toBeEnabled();state.identityHold=held;await complete(page).click();await expect.poll(()=>state.heldIdentity).toBe(1);await page.clock.fastForward(20001);await expect(page.getByRole('status')).toContainText('Couldn’t confirm lesson completion');held.resolve();state.identityHold=null;await page.getByRole('button',{name:'Reload lesson',exact:true}).click();await expect(complete(page)).toBeEnabled();expect(state.writes).toEqual([]);
});

test('a completion verified before a token change remains bound to its original actor',async({page})=>{
 const state=await fixture(page),held=deferred();await start(page).click();await expect(complete(page)).toBeEnabled();state.identityHold=held;await complete(page).click();await expect.poll(()=>state.heldIdentity).toBe(1);await seedPortalSession(page,second);state.identityHold=null;held.resolve();await expect.poll(()=>state.writes.length).toBe(1);expect(state.writes[0].actor).toBe(first.id);expect(state.completed[first.id]).toBe(true);expect(state.completed[second.id]).toBe(false);await expect(page.getByRole('alert')).toContainText('Learn access');await expect(page.getByText(lesson.body,{exact:true})).toHaveCount(0);
});

test('known read permission denial clears the reader and a fresh check never repeats completion',async({page})=>{
 const state=await fixture(page);await start(page).click();await expect(complete(page)).toBeEnabled();state.readFailure={code:'42501',message:'Private fictional denied Learn diagnostic'};await page.getByRole('button',{name:'Reload lesson',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Learn access');await expect(page.getByText(lesson.body,{exact:true})).toHaveCount(0);await expect(page.locator('#root')).not.toContainText('Private fictional denied Learn diagnostic');state.readFailure=null;await page.getByRole('button',{name:'Check Learn access',exact:true}).click();await expect(start(page)).toBeEnabled();expect(state.writes).toEqual([]);
});

test('withdrawal discards the open body and cannot record a new completion',async({page})=>{
 const state=await fixture(page);await start(page).click();await expect(complete(page)).toBeEnabled();state.published=false;state.completeFailure={code:'P0001',message:'Lesson not found'};await complete(page).click();await expect(page.getByRole('status')).toHaveText('This lesson is no longer available.');await expect(page.getByText(lesson.body,{exact:true})).toHaveCount(0);await expect(start(page)).toHaveCount(0);expect(state.completed[first.id]).toBe(false);await page.getByRole('button',{name:'Refresh lessons',exact:true}).click();await expect(page.getByText('No theory lessons have been published yet.',{exact:true})).toBeVisible();expect(state.writes).toHaveLength(1);
});

test('long lesson text supports focused reading, both themes and keyboard completion at 320px',async({page})=>{
 const state=await fixture(page);state.content={...lesson,title:'T'.repeat(160),summary:'S'.repeat(500),body:'W'.repeat(6000)};await page.getByRole('button',{name:'Refresh lessons',exact:true}).click();await expect(start(page)).toBeEnabled();await start(page).press('Enter');await expect(page.getByRole('heading',{name:state.content.title,exact:true})).toBeFocused();await page.setViewportSize({width:320,height:740});await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
 for(const dark of[false,true]){if(dark)await page.getByRole('switch',{name:'Dark mode',exact:true}).click();await expect.poll(()=>complete(page).evaluate(node=>getComputedStyle(node).backgroundColor)).toBe(dark?'rgb(220, 235, 161)':'rgb(36, 71, 53)');expect(await page.evaluate(async()=>(await window.axe.run('.learn-page',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(row=>row.id))).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=320)).toBe(true);}
 await complete(page).press('Enter');await expect(page.getByRole('status')).toHaveText('Lesson complete. Your progress is saved.');await expect(page.getByRole('button',{name:'Lesson complete',exact:true})).toBeDisabled();expect(state.writes).toHaveLength(1);
});
