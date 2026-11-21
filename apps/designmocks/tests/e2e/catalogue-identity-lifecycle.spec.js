import{expect,test}from'@playwright/test';
import{portalFixtureURL,seedPortalSession,stubPortalProvider}from'./portal-fixture.js';
test.use({baseURL:portalFixtureURL});
const first={id:'00000000-0000-4000-8000-000000001801',email:'fictional-catalogue-first@example.invalid'},second={id:'00000000-0000-4000-8000-000000001802',email:'fictional-catalogue-second@example.invalid'},eventId='10000000-0000-4000-8000-000000001801',attemptId='20000000-0000-4000-8000-000000001801';
const api='https://dmocks-portal-fixture.supabase.co',headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-api-version','Access-Control-Allow-Methods':'POST, GET, OPTIONS'};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
const actorOf=route=>JSON.parse(Buffer.from(route.request().headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub;
const modes={exam:{path:'/dashboard/mocks',read:'exam_mock_catalog',start:'start_exam_mock',heading:/Exam-wise mocks/,button:'Start mock',refresh:'Refresh exam mocks'},allIndia:{path:'/dashboard/all-india',read:'all_india_event_catalog',start:'start_all_india_attempt',heading:/One paper. One/,button:'Start once',refresh:'Refresh All India mocks'},topic:{path:'/dashboard/practice',read:'topic_catalog',start:'start_topic_practice',heading:/Build a topic/,button:'Start practice',refresh:'Refresh practice topics'}};
function catalog(kind,actor){
 if(kind==='exam')return[{exam:'uceed',questionCount:57,durationSeconds:7200,freeAttemptLimit:1,freeAttemptsUsed:actor===first.id?0:1,enabled:true,ready:true,structureVersion:'iitb-2027-v1',sectionLabel:'Part A',sectionCounts:{nat:14,msq:15,mcq:28}}];
 if(kind==='topic')return[{exam:'uceed',topic:actor===first.id?'first-observation':'second-observation',questions:40}];
 const now=Date.now();return[{id:eventId,exam:'uceed',title:actor===first.id?'Original fictional first event':'Original fictional second event',state:'open',startsAt:new Date(now-86400000).toISOString(),endsAt:new Date(now+86400000).toISOString(),lastStartAt:new Date(now+86400000-900000).toISOString(),reviewEndsAt:new Date(now+172800000).toISOString(),durationSeconds:900,uploadGraceSeconds:0,qualityHeld:false,attemptId:null,result:null}];
}
async function fixture(page,kind,{identity=null,holdIdentity=false,holdRead=false}={}){
 const config=modes[kind],state={identity,reads:[],finishedReads:0,starts:[],finishedStarts:0,startHold:null,startValue:attemptId,authHold:holdIdentity?deferred():null,heldAuth:0,readHold:holdRead?deferred():null,heldReads:0,activeReadHolds:[],savedActor:null,historyReads:[]};await stubPortalProvider(page,name=>{if(name==='public_all_india_top_ten')return[];});
 await page.route(api+'/auth/v1/user',async route=>{if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});const actor=state.identity??actorOf(route),held=state.authHold;if(held){state.heldAuth++;await held.promise;}await route.fulfill({headers,json:{id:actor,aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}}}).catch(()=>{});});
 await page.route(api+'/rest/v1/rpc/**',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});const name=new URL(route.request().url()).pathname.split('/').at(-1),actor=actorOf(route);let data,status=200;
  if(name===config.read){state.reads.push({name,actor});data=catalog(kind,actor);if(kind==='allIndia'&&state.savedActor===actor)data[0].attemptId=attemptId;const held=state.readHold;state.readHold=null;if(held){state.heldReads++;state.activeReadHolds.push(held);await held.promise;}}
  else if(name===config.start){state.starts.push({name,actor,input:route.request().postDataJSON()});state.savedActor=actor;data=state.startValue;const held=state.startHold;if(held)await held.promise;}
  else if(name==='my_attempt_history'){state.historyReads.push(actor);data=state.savedActor===actor?[{id:attemptId,title:'Original fictional saved active mock',status:'active',privateExtra:'discard'}]:[];}
  else if(name==='read_attempt'){status=403;data={code:'42501',message:'Fictional fixture stops after navigation.'};}
  else throw new Error('Unexpected fictional catalogue procedure: '+name);
  await route.fulfill({headers,status,json:data}).catch(()=>{});if(name===config.start)state.finishedStarts++;if(name===config.read)state.finishedReads++;
 });
 await page.goto('/account');await seedPortalSession(page,first);await page.goto(config.path);return state;
}
for(const[kind,config]of Object.entries(modes)){
 const start=page=>page.getByRole('button',{name:config.button,exact:true});
 test(`${kind} verifies the current actor before reading private mock choices`,async({page})=>{
  const state=await fixture(page,kind,{identity:second.id});await expect(page.getByRole('alert')).toContainText('Mock access');expect(state.reads).toEqual([]);await expect(start(page)).toHaveCount(0);
 });
 test(`${kind} does not start an earlier account mock after an unannounced token change`,async({page})=>{
  const state=await fixture(page,kind);await expect(start(page)).toBeEnabled();await seedPortalSession(page,second);await start(page).click();await expect(page.getByRole('alert')).toContainText('Mock access');expect(state.starts).toEqual([]);await expect(page).toHaveURL(config.path);
 });
 test(`${kind} cannot navigate after a held start crosses same-route history`,async({page})=>{
  const state=await fixture(page,kind);await expect(start(page)).toBeEnabled();state.startHold=deferred();await start(page).click();await expect.poll(()=>state.starts.length).toBe(1);await page.evaluate(()=>{history.pushState({...history.state,key:crypto.randomUUID()},'',location.href);dispatchEvent(new PopStateEvent('popstate',{state:history.state}));});state.startHold.resolve();await expect.poll(()=>state.finishedStarts).toBe(1);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await expect(page).toHaveURL(config.path);if(kind==='allIndia'){await expect(start(page)).toHaveCount(0);await expect(page.getByRole('link',{name:'Open attempt',exact:true})).toHaveAttribute('href','/attempt/'+attemptId);}else await expect(start(page)).toBeEnabled();
 });
 test(`${kind} pins a start after held verification and blocks navigation as a changed account`,async({page})=>{
  const state=await fixture(page,kind);await expect(start(page)).toBeEnabled();const held=deferred();state.authHold=held;await start(page).click();await expect.poll(()=>state.heldAuth).toBe(1);await seedPortalSession(page,second);state.authHold=null;held.resolve();await expect(page.getByRole('alert')).toContainText('Mock access');expect(state.starts.map(item=>item.actor)).toEqual([first.id]);await expect(page).toHaveURL(config.path);
 });
 test(`${kind} inspects saved attempts after an unknown receipt without automatically repeating its start`,async({page})=>{
  const state=await fixture(page,kind);await expect(start(page)).toBeEnabled();state.startValue={id:attemptId};await start(page).click();await expect(page.getByRole('alert')).toContainText('Couldn’t confirm this start');await expect(start(page)).toBeDisabled();expect(state.starts).toHaveLength(1);await page.getByRole('button',{name:config.refresh,exact:true}).press('Enter');const saved=page.getByRole('region',{name:'Saved active attempts',exact:true});await expect(saved.getByRole('link',{name:'Original fictional saved active mock',exact:true})).toHaveAttribute('href','/attempt/'+attemptId);expect(state.historyReads).toEqual([first.id]);expect(state.starts).toHaveLength(1);await expect(page).toHaveURL(config.path);if(kind==='allIndia'){await expect(page.getByRole('button',{name:'Start once',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Open attempt',exact:true})).toHaveAttribute('href','/attempt/'+attemptId);}else await expect(start(page)).toBeEnabled();
 });
 test(`${kind} rejects an old read after the new account has opened its own choices`,async({page})=>{
  const state=await fixture(page,kind);await expect(start(page)).toBeEnabled();const held=deferred();state.readHold=held;await page.getByRole('button',{name:config.refresh,exact:true}).click();await expect.poll(()=>state.heldReads).toBe(1);await notify(page,second);await expect(start(page)).toBeEnabled();held.resolve();await expect.poll(()=>state.finishedReads).toBe(3);if(kind==='exam')await expect(page.getByText(/1 free attempt left/)).toHaveCount(0);else if(kind==='allIndia'){await expect(page.getByRole('heading',{name:'Original fictional second event',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Original fictional first event',exact:true})).toHaveCount(0);}else await expect(page.getByRole('combobox',{name:'Topic',exact:true})).toHaveValue('second-observation');expect(state.starts).toEqual([]);
 });
}
async function notify(page,actor){await seedPortalSession(page,actor);await page.evaluate(()=>{const key='sb-dmocks-portal-fixture-auth-token',channel=new BroadcastChannel(key);channel.postMessage({event:'SIGNED_IN',session:JSON.parse(localStorage.getItem(key))});channel.close();});}
const topicStart=page=>page.getByRole('button',{name:'Start practice',exact:true});
test('a late initial mock identity check cannot reopen choices after its deadline',async({page})=>{
 await page.clock.install();const state=await fixture(page,'topic',{holdIdentity:true});await expect.poll(()=>state.heldAuth).toBeGreaterThan(0);await page.clock.fastForward(10001);await expect(page.getByRole('alert')).toContainText('Mock access');expect(state.reads).toEqual([]);const held=state.authHold;state.authHold=null;held.resolve();await expect(topicStart(page)).toHaveCount(0);await page.getByRole('button',{name:'Check mock access',exact:true}).press('Enter');await expect(topicStart(page)).toBeEnabled();expect(state.starts).toEqual([]);
});
test('a stalled mock read expires and ignores its late result until an explicit refresh',async({page})=>{
 await page.clock.install();const state=await fixture(page,'topic',{holdRead:true});await expect.poll(()=>state.heldReads).toBe(1);await page.clock.fastForward(20001);await expect(page.getByRole('alert')).toHaveText('Couldn’t load these mock choices. Refresh them to try again.');state.activeReadHolds[0].resolve();await expect.poll(()=>state.finishedReads).toBe(1);await expect(topicStart(page)).toHaveCount(0);await page.getByRole('button',{name:modes.topic.refresh,exact:true}).press('Enter');await expect(topicStart(page)).toBeEnabled();expect(state.starts).toEqual([]);
});
test('an unresponsive mock identity read cannot start a practice after its deadline',async({page})=>{
 await page.clock.install();const state=await fixture(page,'topic');await expect(topicStart(page)).toBeEnabled();const held=deferred();state.authHold=held;await topicStart(page).click();await expect.poll(()=>state.heldAuth).toBe(1);await page.clock.fastForward(20001);await expect(page.getByRole('alert')).toContainText('Couldn’t confirm this start');state.authHold=null;held.resolve();await expect(topicStart(page)).toBeDisabled();expect(state.starts).toEqual([]);await page.getByRole('button',{name:modes.topic.refresh,exact:true}).click();await expect(topicStart(page)).toBeEnabled();expect(state.starts).toEqual([]);
});
test('a synchronous repeated practice start stays disabled with only one in-flight request',async({page})=>{
 const state=await fixture(page,'topic');await expect(topicStart(page)).toBeEnabled();state.startHold=deferred();await topicStart(page).evaluate(node=>{node.click();node.click();});await expect.poll(()=>state.starts.length).toBe(1);await expect(page.locator('.catalogue-content').getByRole('button')).toBeDisabled();state.startHold.resolve();await expect(page).toHaveURL('/attempt/'+attemptId);expect(state.starts).toHaveLength(1);
});
test('visible identity loss clears practice choices and returns focus to the public heading',async({page})=>{
 const state=await fixture(page,'topic');await expect(topicStart(page)).toBeEnabled();await page.getByRole('combobox',{name:'Questions',exact:true}).focus();state.identity=second.id;await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(page.getByRole('alert')).toContainText('Mock access');await expect(topicStart(page)).toHaveCount(0);await expect(page.getByRole('heading',{name:modes.topic.heading})).toBeFocused();expect(state.starts).toEqual([]);
});
test('a committed mock start deadline preserves explicit saved-state recovery and ignores its late acknowledgement',async({page})=>{
 await page.clock.install();const state=await fixture(page,'exam');const start=page.getByRole('button',{name:'Start mock',exact:true});await expect(start).toBeEnabled();const held=deferred();state.startHold=held;await start.click();await expect.poll(()=>state.starts.length).toBe(1);await page.clock.fastForward(20001);await expect(page.getByRole('alert')).toContainText('Couldn’t confirm this start');await expect(start).toBeDisabled();await page.getByRole('button',{name:modes.exam.refresh,exact:true}).click();await expect(page.getByRole('region',{name:'Saved active attempts',exact:true})).toBeVisible();held.resolve();await expect.poll(()=>state.finishedStarts).toBe(1);await expect(page).toHaveURL(modes.exam.path);expect(state.starts).toHaveLength(1);
});
