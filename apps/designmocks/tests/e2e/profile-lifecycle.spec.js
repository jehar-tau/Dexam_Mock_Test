import {expect,test} from '@playwright/test';
import {portalFixtureURL,seedPortalSession,stubPortalProvider} from './portal-fixture.js';

test.use({baseURL:portalFixtureURL});
const first={id:'00000000-0000-4000-8000-000000001201',email:'fictional-profile-first@example.invalid'},second={id:'00000000-0000-4000-8000-000000001202',email:'fictional-profile-second@example.invalid'};
const api='https://dmocks-portal-fixture.supabase.co',headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-api-version','Access-Control-Allow-Methods':'POST, GET, OPTIONS'};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
const verificationURL='http://127.0.0.1:4999';
const firstProfile={displayName:'Original Fictional First Student',phone:'+919000001201',appearingYear:2027,city:'Fictional Pune',exams:['uceed'],phoneVerified:false,completed:false};
const secondProfile={displayName:'Original Fictional Second Student',phone:'+919000001202',appearingYear:2028,city:'Fictional Mumbai',exams:['nift'],phoneVerified:false,completed:false};
async function changeAccount(page,state,actor){state.actor=actor;await seedPortalSession(page,actor);await page.evaluate(()=>{const key='sb-dmocks-portal-fixture-auth-token',channel=new BroadcastChannel(key);channel.postMessage({event:'SIGNED_IN',session:JSON.parse(localStorage.getItem(key))});channel.close();});}
async function fixture(page,{identity=null,readFailure=null,holdRead=null,identityHold=null,waitForProfile=true,phoneVerification=false}={}){
 const state={actor:first,identity,identityHold,identityFailure:false,profiles:{[first.id]:{...firstProfile},[second.id]:{...secondProfile}},holds:{[first.id]:holdRead},reads:{},completedReads:{},saveHold:null,saves:[],completedSaves:0,readFailure,saveFailure:null,saveResponse:null,phoneCalls:[],completedPhoneCalls:0,phoneReply:null};
 const provider=await stubPortalProvider(page,name=>{if(name==='user')return{...(state.identity??state.actor),aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}};if(name==='is_dmocks_admin'||name==='can_review_drawings')return false;if(name==='my_privacy_requests')return[];});
 await page.route(api+'/auth/v1/user',async route=>{if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});const held=state.identityHold,failure=state.identityFailure,actor=state.identity??state.actor;if(held)await held.promise;try{await route.fulfill({headers,status:failure?503:200,json:failure?{message:'Private fictional identity diagnostic'}:{...actor,aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}}});}catch{}});
 await page.route(api+'/rest/v1/rpc/my_candidate_profile',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});const token=route.request().headers().authorization?.split(' ')[1],owner=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub;
  const held=state.holds[owner],data=structuredClone(state.profiles[owner]),failure=state.readFailure;state.reads[owner]=(state.reads[owner]??0)+1;if(held)await held.promise;
  try{await route.fulfill({headers,status:failure?failure.status??503:200,json:failure?failure.data??{message:'Private fictional profile read diagnostic'}:data});}catch{}state.completedReads[owner]=(state.completedReads[owner]??0)+1;
 });
 await page.route(api+'/rest/v1/rpc/save_candidate_profile',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});const input=route.request().postDataJSON(),held=state.saveHold,failure=state.saveFailure,override=state.saveResponse,token=route.request().headers().authorization.split(' ')[1],owner=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub;state.saves.push(input);
  const verified=state.profiles[owner]?.phone===input.p_phone&&state.profiles[owner]?.phoneVerified===true;
  const result={displayName:input.p_display_name,phone:input.p_phone,appearingYear:input.p_appearing_year,city:input.p_city,exams:input.p_exams,phoneVerified:verified,completed:verified};if(!failure)state.profiles[owner]=result;if(held)await held.promise;
  try{await route.fulfill({headers,status:failure?400:200,json:failure??override??result});}catch{}state.completedSaves++;
 });
 await page.route(api+'/functions/v1/candidate-phone',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});
  const body=route.request().postDataJSON(),token=route.request().headers().authorization.split(' ')[1],owner=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub;
  state.phoneCalls.push({owner,...body});
  const reply=await state.phoneReply?.(body,owner);
  try{
   if(reply)await route.fulfill({headers,status:reply.httpStatus??200,json:reply.data??reply});
   else await route.abort('failed');
  }catch{}state.completedPhoneCalls++;
 });
 const origin=phoneVerification?verificationURL:portalFixtureURL;
 await page.goto(origin+'/account');await seedPortalSession(page,first);await page.goto(origin+'/onboarding');
 if(waitForProfile&&!readFailure&&!identity&&!holdRead&&!identityHold)await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveValue(firstProfile.displayName);
 return Object.assign(state,provider);
}

test('switching accounts clears the previous private profile before the next read completes',async({page})=>{
 const state=await fixture(page),held=deferred();state.holds[second.id]=held;
 state.profiles[first.id]={...firstProfile,phoneVerified:true,completed:true};
 await page.getByRole('button',{name:'Reload profile',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Phone number',exact:true})).toHaveAccessibleDescription('Your saved phone number is verified.');
 await page.getByRole('textbox',{name:'City',exact:true}).fill('An unsent original fictional first-account city');
 await changeAccount(page,state,second);await expect.poll(()=>state.reads[second.id]??0).toBeGreaterThan(0);
 await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveCount(0);held.resolve();await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveValue(secondProfile.displayName);await expect(page.getByRole('textbox',{name:'City',exact:true})).toHaveValue(secondProfile.city);await expect(page.getByRole('textbox',{name:'Phone number',exact:true})).toHaveAccessibleDescription(/Phone verification is currently unavailable/);expect(state.saves).toEqual([]);
});

test('same-route history changes clear private profile drafts and reload current details',async({page})=>{
 const state=await fixture(page);await page.getByRole('textbox',{name:'Student name',exact:true}).fill('An unsent original fictional profile draft');
 await page.evaluate(()=>{history.pushState({...history.state,key:'new-fictional-profile-entry'},'',location.href);dispatchEvent(new PopStateEvent('popstate',{state:history.state}));});
 await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveValue(firstProfile.displayName);await expect(page.getByRole('heading',{level:1,name:'Set up your profile.',exact:true})).toBeFocused();expect(state.saves).toEqual([]);
});

test('a pending profile save freezes its snapshot and suppresses overlapping form submissions',async({page})=>{
 const state=await fixture(page),held=deferred();state.saveHold=held;await page.getByRole('textbox',{name:'City',exact:true}).fill('An original fictional submitted city');
 await page.locator('.candidate-profile-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await expect.poll(()=>state.saves.length).toBe(1);await expect(page.getByRole('textbox',{name:'City',exact:true})).toBeDisabled();held.resolve();await expect(page.getByRole('button',{name:'Save profile',exact:true})).toBeEnabled();expect(state.saves).toHaveLength(1);expect(state.unexpected).toEqual([]);
});

test('current identity must match before private profile details are mounted',async({page})=>{
 const state=await fixture(page,{identity:second});await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveCount(0);await expect(page.getByRole('alert')).toContainText('Your sign-in changed or ended');expect(state.reads[first.id]??0).toBe(0);
});

test('profile save failures preserve editable input without rendering provider diagnostics',async({page})=>{
 const state=await fixture(page);state.saveFailure={code:'22023',message:'Private fictional profile save diagnostic'};await page.getByRole('textbox',{name:'City',exact:true}).fill('An original fictional rejected city');await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Check your profile details');await expect(page.getByRole('textbox',{name:'City',exact:true})).toHaveValue('An original fictional rejected city');await expect(page.getByRole('textbox',{name:'City',exact:true})).toBeEnabled();await expect(page.locator('#root')).not.toContainText('Private fictional profile save diagnostic');
});

test('an old profile read cannot replace a newer account or its new draft',async({page})=>{
 const held=deferred(),state=await fixture(page,{holdRead:held});await expect.poll(()=>state.reads[first.id]??0).toBe(1);await changeAccount(page,state,second);await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveValue(secondProfile.displayName);await page.getByRole('textbox',{name:'City',exact:true}).fill('A new original fictional second-account draft');held.resolve();await expect.poll(()=>state.completedReads[first.id]??0).toBe(1);await expect(page.getByRole('textbox',{name:'City',exact:true})).toHaveValue('A new original fictional second-account draft');await expect(page.getByRole('textbox',{name:'Phone number',exact:true})).toHaveValue(secondProfile.phone);
});

test('a committed old-account save cannot acknowledge or clear a new-account draft',async({page})=>{
 const state=await fixture(page),held=deferred();state.saveHold=held;await page.getByRole('textbox',{name:'City',exact:true}).fill('Original fictional first-account submitted city');await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect.poll(()=>state.saves.length).toBe(1);await changeAccount(page,state,second);await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveValue(secondProfile.displayName);await page.getByRole('textbox',{name:'City',exact:true}).fill('A new original fictional second-account city');held.resolve();await expect.poll(()=>state.completedSaves).toBe(1);await expect(page.getByRole('textbox',{name:'City',exact:true})).toHaveValue('A new original fictional second-account city');await expect(page.getByText('Profile saved.',{exact:true})).toHaveCount(0);expect(state.saves).toHaveLength(1);
});

test('a save completion cannot clear the newer draft after same-route history changes',async({page})=>{
 const state=await fixture(page),held=deferred();state.saveHold=held;await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect.poll(()=>state.saves.length).toBe(1);await page.evaluate(()=>{history.pushState({...history.state,key:'new-pending-profile-entry'},'',location.href);dispatchEvent(new PopStateEvent('popstate',{state:history.state}));});await expect(page.getByRole('button',{name:'Save profile',exact:true})).toBeEnabled();await page.getByRole('textbox',{name:'City',exact:true}).fill('A newer original fictional history draft');held.resolve();await expect.poll(()=>state.completedSaves).toBe(1);await expect(page.getByRole('textbox',{name:'City',exact:true})).toHaveValue('A newer original fictional history draft');await expect(page.getByText('Profile saved.',{exact:true})).toHaveCount(0);
});

test('an uncertain timed-out save freezes input until an explicit read without resending',async({page})=>{
 await page.clock.install();const state=await fixture(page),held=deferred();state.saveHold=held;await page.getByRole('textbox',{name:'City',exact:true}).fill('Original fictional uncertain saved city');await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect.poll(()=>state.saves.length).toBe(1);await page.clock.fastForward(20001);await expect(page.getByRole('status')).toContainText('Couldn’t confirm your saved profile');await expect(page.getByRole('textbox',{name:'Phone number',exact:true})).toHaveAccessibleDescription('Reload your profile to confirm the saved phone status.');await expect(page.getByRole('textbox',{name:'City',exact:true})).toBeDisabled();await page.locator('.candidate-profile-form').evaluate(form=>form.requestSubmit());expect(state.saves).toHaveLength(1);await page.getByRole('button',{name:'Reload profile',exact:true}).click();await expect(page.getByRole('textbox',{name:'City',exact:true})).toHaveValue('Original fictional uncertain saved city');await expect(page.getByRole('button',{name:'Save profile',exact:true})).toBeEnabled();await page.getByRole('textbox',{name:'City',exact:true}).fill('A newer draft after checking the actual saved values');held.resolve();await expect.poll(()=>state.completedSaves).toBe(1);await expect(page.getByRole('textbox',{name:'City',exact:true})).toHaveValue('A newer draft after checking the actual saved values');expect(state.saves).toHaveLength(1);
});

test('read failure and invalid profile data require explicit recovery without private diagnostics',async({page})=>{
 const state=await fixture(page,{readFailure:true});await expect(page.getByRole('alert')).toContainText('Couldn’t load your profile');await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveCount(0);state.readFailure=false;await page.getByRole('button',{name:'Reload profile',exact:true}).click();await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveValue(firstProfile.displayName);state.profiles[first.id]={...firstProfile,phoneVerified:'untrusted'};await page.getByRole('button',{name:'Reload profile',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Couldn’t load your profile');state.profiles[first.id]={...firstProfile};await page.getByRole('button',{name:'Reload profile',exact:true}).click();await expect(page.getByRole('textbox',{name:'City',exact:true})).toHaveValue(firstProfile.city);await expect(page.locator('#root')).not.toContainText('Private fictional');expect(state.saves).toEqual([]);
});

test('initial identity verification timeout cannot reopen from a late response',async({page})=>{
 await page.clock.install();const held=deferred(),state=await fixture(page,{identityHold:held});await expect(page.getByText('Checking profile access…',{exact:true})).toBeVisible();await page.clock.fastForward(10001);await expect(page.getByRole('alert')).toContainText('Profile access could not be verified');held.resolve();state.identityHold=null;await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveCount(0);expect(state.reads[first.id]??0).toBe(0);await page.getByRole('button',{name:'Check profile access',exact:true}).click();await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveValue(firstProfile.displayName);expect(state.saves).toEqual([]);
});

test('permission denial clears profile details and fences a late committed save',async({page})=>{
 const state=await fixture(page),held=deferred();state.saveHold=held;await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect.poll(()=>state.saves.length).toBe(1);state.readFailure={status:403,data:{code:'42501',message:'Private fictional capability diagnostic'}};await page.getByRole('button',{name:'Reload profile',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Profile access could not be verified');held.resolve();await expect.poll(()=>state.completedSaves).toBe(1);await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveCount(0);state.readFailure=false;await page.getByRole('button',{name:'Check profile access',exact:true}).click();await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveValue(firstProfile.displayName);expect(state.saves).toHaveLength(1);await expect(page.locator('#root')).not.toContainText('Private fictional');
});

test('an unconfirmed server snapshot cannot acknowledge a profile save',async({page})=>{
 const state=await fixture(page);state.saveResponse={...firstProfile,city:'A different unconfirmed original fictional city'};await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('status')).toContainText('Couldn’t confirm your saved profile');await expect(page.getByRole('textbox',{name:'City',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Reload profile',exact:true}).click();await expect(page.getByRole('textbox',{name:'City',exact:true})).toHaveValue(firstProfile.city);await expect(page.getByRole('button',{name:'Save profile',exact:true})).toBeEnabled();expect(state.saves).toHaveLength(1);
});

test('stored phone verification is visible on reload and stays bound to the saved number',async({page})=>{
 const state=await fixture(page);
 const phone=page.getByRole('textbox',{name:'Phone number',exact:true});
 const save=page.getByRole('button',{name:'Save profile',exact:true});
 await expect(phone).toHaveAccessibleDescription(/Phone verification is currently unavailable/);
 state.profiles[first.id]={...firstProfile,phoneVerified:true,completed:true};
 await page.getByRole('button',{name:'Reload profile',exact:true}).click();
 await expect(phone).toHaveAccessibleDescription('Your saved phone number is verified.');
 await save.click();
 await expect(page.getByText('Profile saved.',{exact:true})).toBeVisible();
 await expect(phone).toHaveAccessibleDescription('Your saved phone number is verified.');
 expect(state.saves).toEqual([{p_display_name:firstProfile.displayName,p_phone:firstProfile.phone,p_appearing_year:firstProfile.appearingYear,p_city:firstProfile.city,p_exams:firstProfile.exams}]);
 await phone.fill('+919000001203');
 await expect(phone).toHaveAccessibleDescription(/Saving a different number clears the previous phone verification/);
 const held=deferred();
 state.saveHold=held;
 await save.click();
 await expect(phone).toBeDisabled();
 await expect(phone).toHaveAccessibleDescription(/Saving a different number clears the previous phone verification/);
 held.resolve();
 await expect(page.getByText('Profile saved.',{exact:true})).toBeVisible();
 await expect(phone).toHaveAccessibleDescription(/Phone verification is currently unavailable/);
 expect(state.saves[1]).toEqual({...state.saves[0],p_phone:'+919000001203'});
 await expect(page.getByRole('button',{name:'Send verification code',exact:true})).toHaveCount(0);expect(state.phoneCalls).toEqual([]);
});

test('empty profiles, validation and long values support keyboard, WCAG and 320px in both themes',async({page})=>{
 const state=await fixture(page);state.profiles[first.id]={};await page.getByRole('button',{name:'Reload profile',exact:true}).click();await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveValue('');await page.getByRole('button',{name:'Save profile',exact:true}).press('Enter');await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveAttribute('aria-invalid','true');await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toBeFocused();expect(state.saves).toEqual([]);
 await page.getByRole('textbox',{name:'Student name',exact:true}).fill('N'.repeat(100));await page.getByRole('textbox',{name:'Phone number',exact:true}).fill('+919000001211');await page.getByRole('textbox',{name:'City',exact:true}).fill('C'.repeat(120));await page.getByLabel('UCEED',{exact:true}).check();await page.getByRole('button',{name:'Save profile',exact:true}).press('Enter');await expect(page.getByText('Profile saved.',{exact:true})).toBeVisible();
 await page.setViewportSize({width:320,height:740});await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});for(const dark of[false,true]){if(dark)await page.getByRole('switch',{name:'Dark mode',exact:true}).click();await expect.poll(()=>page.getByRole('button',{name:'Save profile',exact:true}).evaluate(node=>getComputedStyle(node).backgroundColor)).toBe(dark?'rgb(220, 235, 161)':'rgb(36, 71, 53)');expect(await page.evaluate(async()=>(await window.axe.run('[aria-label="Profile access"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.target)})))).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=320)).toBe(true);}
});

test('a held SDK initial session cannot replace a newer profile account event',async({page})=>{
 const state=await fixture(page);await page.evaluate(()=>{history.pushState({...history.state,key:'profile-to-account-session'},'','/account');dispatchEvent(new PopStateEvent('popstate',{state:history.state}));});await expect(page.getByRole('link',{name:'Complete your profile',exact:true})).toBeVisible();
 await page.evaluate(async()=>{const{platform}=await import('/src/platform.js'),native=platform.auth.getSession.bind(platform.auth);window.profileInitialState={capture:true,waiting:0,completed:0};platform.auth.getSession=async(...args)=>{const result=await native(...args),trace=window.profileInitialState;if(trace.capture){trace.capture=false;trace.waiting++;await new Promise(resolve=>{trace.release=resolve;});trace.completed++;}return result;};});
 await page.getByRole('link',{name:'Complete your profile',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.profileInitialState.waiting)).toBe(1);await changeAccount(page,state,second);await expect(page.getByRole('textbox',{name:'Student name',exact:true})).toHaveValue(secondProfile.displayName);await page.getByRole('textbox',{name:'City',exact:true}).fill('A new original fictional city after the current Auth event');await page.evaluate(()=>window.profileInitialState.release());await expect.poll(()=>page.evaluate(()=>window.profileInitialState.completed)).toBe(1);await expect(page.getByRole('textbox',{name:'City',exact:true})).toHaveValue('A new original fictional city after the current Auth event');await expect(page.getByRole('textbox',{name:'Phone number',exact:true})).toHaveValue(secondProfile.phone);expect(state.saves).toEqual([]);expect(state.unexpected).toEqual([]);
});

test('visible verification clears private profile data and requires explicit recovery',async({page})=>{
 await page.clock.install();const state=await fixture(page);await page.getByRole('textbox',{name:'City',exact:true}).fill('An original fictional private draft before failed verification');state.identityFailure=true;await page.clock.fastForward(60001);await expect(page.getByRole('alert')).toContainText('Profile access could not be verified');await expect(page.getByRole('textbox',{name:'Phone number',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{level:1,name:'Set up your profile.',exact:true})).toBeFocused();state.identityFailure=false;await page.clock.fastForward(60001);await expect(page.getByRole('textbox',{name:'City',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Check profile access',exact:true}).press('Enter');await expect(page.getByRole('textbox',{name:'City',exact:true})).toHaveValue(firstProfile.city);expect(state.saves).toEqual([]);
});

test('an SDK token change before its notification cannot write one account profile into another',async({page})=>{
 const state=await fixture(page);await page.getByRole('textbox',{name:'City',exact:true}).fill('An original fictional first-account draft before token change');await seedPortalSession(page,second);await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Profile access could not be verified');await expect(page.getByRole('textbox',{name:'Phone number',exact:true})).toHaveCount(0);expect(state.saves).toEqual([]);expect(state.profiles[second.id]).toEqual(secondProfile);
});

const sendButton=page=>page.getByRole('button',{name:'Send verification code',exact:true});
const codeInput=page=>page.getByRole('textbox',{name:'Six-digit SMS code',exact:true});
const verifyButton=page=>page.getByRole('button',{name:'Verify phone number',exact:true});
const sent=now=>({status:'sent',retryAt:new Date(now+60_000).toISOString(),expiresAt:new Date(now+300_000).toISOString()});

test('saved phone verification supports keyboard, six-digit SMS entry, WCAG and 320px',async({page})=>{
 const state=await fixture(page,{phoneVerification:true}),phone=page.getByRole('textbox',{name:'Phone number',exact:true});
 state.phoneReply=({action,code},owner)=>{
  if(action==='send')return sent(Date.now());
  if(code==='012345'){state.profiles[owner]={...state.profiles[owner],phoneVerified:true,completed:true};return{status:'verified'};}
  return{status:'invalid'};
 };
 await phone.fill('+919000001203');
 await expect(phone).toHaveAccessibleDescription(/Save your phone number before verifying it/);
 await expect(sendButton(page)).toHaveCount(0);
 expect(state.phoneCalls).toEqual([]);
 await phone.fill(firstProfile.phone);
 await sendButton(page).focus();
 await expect(sendButton(page)).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(codeInput(page)).toBeFocused();
 await expect(codeInput(page)).toHaveAttribute('autocomplete','one-time-code');
 await expect(codeInput(page)).toHaveAttribute('inputmode','numeric');
 await expect(page.getByRole('button',{name:'Send another code'})).toBeDisabled();
 await codeInput(page).fill('12345');
 await codeInput(page).press('Enter');
 await expect(codeInput(page)).toHaveAccessibleDescription('Enter the six-digit code.');
 expect(state.phoneCalls).toHaveLength(1);
 expect(state.saves).toEqual([]);
 await codeInput(page).fill('012344');
 await verifyButton(page).press('Enter');
 await expect(codeInput(page)).toHaveAccessibleDescription('The code didn’t match. Check the text and try again.');
 await page.setViewportSize({width:320,height:740});
 await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
 for(const dark of[false,true]){
  if(dark)await page.getByRole('switch',{name:'Dark mode',exact:true}).click();
  await expect.poll(()=>page.getByRole('button',{name:'Save profile',exact:true}).evaluate(node=>getComputedStyle(node).backgroundColor)).toBe(dark?'rgb(220, 235, 161)':'rgb(36, 71, 53)');
  expect(await page.evaluate(async()=>(await window.axe.run('[aria-label="Profile access"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.target)})))).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=320)).toBe(true);
 }
 await codeInput(page).fill('012345');
 await codeInput(page).press('Enter');
 await expect(phone).toHaveAccessibleDescription('Your saved phone number is verified.');
 await expect(phone).toBeFocused();
 await expect(codeInput(page)).toHaveCount(0);
 expect(state.reads[first.id]).toBe(2);
 const {challengeId}=state.phoneCalls[0];
 expect(challengeId).toMatch(/^[a-f0-9-]{36}$/);
 expect(state.phoneCalls).toEqual([
  {owner:first.id,action:'send',phone:firstProfile.phone,challengeId},
  {owner:first.id,action:'verify',phone:firstProfile.phone,challengeId,code:'012344'},
  {owner:first.id,action:'verify',phone:firstProfile.phone,challengeId,code:'012345'},
 ]);
 expect(await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage]))).not.toContain(challengeId);
 expect(await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage]))).not.toContain('012345');
 expect(state.saves).toEqual([]);
});

test('a lost send response allows verification of the same challenge and never retries automatically',async({page})=>{
 await page.clock.install();
 const state=await fixture(page,{phoneVerification:true});
 state.phoneReply=({action},owner)=>{
  if(action==='verify'){state.profiles[owner]={...state.profiles[owner],phoneVerified:true,completed:true};return{status:'verified'};}
 };
 await sendButton(page).click();
 await expect(codeInput(page)).toHaveAccessibleDescription(/couldn’t confirm that the text was sent/);
 await expect(page.getByRole('button',{name:'Send another code'})).toBeDisabled();
 await page.clock.fastForward(60_001);
 await expect(page.getByRole('button',{name:'Send another code'})).toBeEnabled();
 expect(state.phoneCalls).toHaveLength(1);
 await codeInput(page).fill('001234');
 await verifyButton(page).click();
 await expect(page.getByRole('textbox',{name:'Phone number',exact:true})).toHaveAccessibleDescription('Your saved phone number is verified.');
 expect(state.phoneCalls[1]).toEqual({...state.phoneCalls[0],action:'verify',code:'001234'});
});

test('a late send reply is discarded after a phone edit even if the draft returns to its saved number',async({page})=>{
 const state=await fixture(page,{phoneVerification:true}),held=deferred();
 state.phoneReply=async()=>{await held.promise;return sent(Date.now());};
 await sendButton(page).click();
 await expect.poll(()=>state.phoneCalls.length).toBe(1);
 const phone=page.getByRole('textbox',{name:'Phone number',exact:true});
 await phone.fill('+919000001203');
 await expect(sendButton(page)).toHaveCount(0);
 await phone.fill(firstProfile.phone);
 await expect(sendButton(page)).toBeEnabled();
 held.resolve();
 await expect.poll(()=>state.completedPhoneCalls).toBe(1);
 await expect(codeInput(page)).toHaveCount(0);
 expect(state.phoneCalls).toHaveLength(1);
 expect(state.saves).toEqual([]);
});

test('a late confirmation read cannot mark the next account phone verified',async({page})=>{
 const state=await fixture(page,{phoneVerification:true}),held=deferred();
 state.phoneReply=({action},owner)=>{
  if(action==='send')return sent(Date.now());
  state.profiles[owner]={...state.profiles[owner],phoneVerified:true,completed:true};
  state.holds[owner]=held;
  return{status:'verified'};
 };
 await sendButton(page).click();
 await codeInput(page).fill('012345');
 await verifyButton(page).click();
 await expect.poll(()=>state.reads[first.id]).toBe(2);
 await changeAccount(page,state,second);
 const phone=page.getByRole('textbox',{name:'Phone number',exact:true});
 await expect(phone).toHaveValue(secondProfile.phone);
 await expect(sendButton(page)).toBeEnabled();
 held.resolve();
 await expect.poll(()=>state.completedReads[first.id]).toBe(2);
 await expect(phone).toHaveAccessibleDescription('Verify your saved phone number by text message.');
 await expect(codeInput(page)).toHaveCount(0);
 expect(state.phoneCalls).toHaveLength(2);
 expect(state.phoneCalls.every(call=>call.owner===first.id)).toBe(true);
});

test('an unavailable phone service and unconfirmed profile stay generic',async({page})=>{
 const state=await fixture(page,{phoneVerification:true});
 state.phoneReply=()=>({httpStatus:503,data:{message:'Private fictional provider diagnostic'}});
 await sendButton(page).click();
 await expect(page.getByText('Phone verification is temporarily unavailable. Please try again later.',{exact:true})).toBeVisible();
 await expect(codeInput(page)).toHaveCount(0);
 await expect(page.locator('#root')).not.toContainText('Private fictional provider diagnostic');
 state.phoneReply=({action})=>action==='send'?sent(Date.now()):{status:'verified'};
 await sendButton(page).click();
 await codeInput(page).fill('012345');
 await verifyButton(page).click();
 await expect(page.getByText(/couldn’t confirm verification/)).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Phone number',exact:true})).toHaveAccessibleDescription('Verify your saved phone number by text message.');
 await expect(codeInput(page)).toHaveCount(0);
 expect(state.reads[first.id]).toBe(2);
});

test('a newly saved phone can request another challenge after server cooldown',async({page})=>{
 await page.clock.install();
 const state=await fixture(page,{phoneVerification:true});
 const phone=page.getByRole('textbox',{name:'Phone number',exact:true}),nextPhone='+919000001203';
 state.phoneReply=({action})=>action==='send'?sent(Date.now()):{status:'expired'};
 await phone.fill(nextPhone);
 await expect(sendButton(page)).toHaveCount(0);
 expect(state.phoneCalls).toEqual([]);
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await expect(page.getByText('Profile saved.',{exact:true})).toBeVisible();
 await sendButton(page).click();
 await codeInput(page).fill('012345');
 await verifyButton(page).click();
 await expect(page.getByText(/This code is no longer valid/)).toBeVisible();
 await expect(codeInput(page)).toHaveCount(0);
 await expect(sendButton(page)).toBeDisabled();
 await page.clock.fastForward(60_001);
 await expect(sendButton(page)).toBeEnabled();
 expect(state.phoneCalls).toHaveLength(2);
 await sendButton(page).click();
 await expect(codeInput(page)).toHaveValue('');
 expect(state.phoneCalls[0].phone).toBe(nextPhone);
 expect(state.phoneCalls[2].phone).toBe(nextPhone);
 expect(state.phoneCalls[2].challengeId).not.toBe(state.phoneCalls[0].challengeId);
 expect(state.saves).toHaveLength(1);
});
