import{test,expect}from'@playwright/test';
import{fileURLToPath}from'node:url';
import{stubPortalProvider,seedPortalSession,emptyAdminRead}from'./portal-fixture.js';
test.use({baseURL:'http://127.0.0.1:4799'});
const actor={id:'00000000-0000-4000-8000-000000001971',email:'fictional-mvp-operator@example.invalid'},core=['admin_bug_report_page','admin_reported_questions','admin_operational_health','admin_privacy_request_page','admin_launch_readiness','admin_search_bank_questions','admin_nid_practice_blueprints'];
const gates=['content_rights','privacy_terms','refund_policy','child_safety','provider_acceptance','backup_restore','capacity_acceptance'];
async function admin(page,{legacy=false,health}={}){
 const state={approved:false},provider=await stubPortalProvider(page,(name,input)=>{
  if(name==='is_dmocks_admin')return true;
  if(name==='admin_launch_readiness')return{scope:legacy?undefined:'paid-mvp-v1',apiProfileReady:!legacy,offeringReady:false,salesEnabled:false,policyPublished:false,paperBlueprintReady:legacy,readyForSales:legacy,allAttestationsApproved:false,gates:gates.map(gate=>({gate,approved:gate==='content_rights'&&state.approved,evidence:gate==='content_rights'&&state.approved?'Fictional owner approval':null}))};
  if(name==='admin_set_launch_gate'){expect(input.p_gate).toBe('content_rights');state.approved=true;return null;}
  if(name==='admin_operational_health'&&health)return health;
  if(core.includes(name))return emptyAdminRead(name);
 });
 await page.goto('/');await seedPortalSession(page,actor);await page.goto('/admin');return provider;
}
test('the MVP operator desk loads only launch-critical reviews and keeps deferred administration hidden',async({page})=>{
 const provider=await admin(page);for(const name of['Operational health','Launch readiness','Imported bank review','Bug reports','Account privacy requests'])await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();for(const name of['PDF and photo question intake','Drawing review queue','Community moderation','Add a question draft','All India mock events','Exam-wise mock releases','Question review queue'])await expect(page.getByRole('heading',{name,exact:true})).toHaveCount(0);await expect(page.getByText('No approved paid Part A offering is released.',{exact:false})).toBeVisible();await expect(page.getByText('MVP server API controls verified.',{exact:true})).toBeVisible();expect(provider.calls.every(([name])=>name==='is_dmocks_admin'||core.includes(name))).toBe(true);expect(provider.unexpected).toEqual([]);
});
test('an old green blueprint response cannot show the frozen MVP as ready',async({page})=>{
 const provider=await admin(page,{legacy:true}),readiness=page.getByRole('region',{name:'Launch readiness',exact:true});await expect(readiness.getByText('closed',{exact:true})).toBeVisible();await expect(readiness.getByRole('alert')).toContainText('MVP server API controls are not verified');await expect(readiness.getByText('No approved paid Part A offering is released.',{exact:false})).toBeVisible();await expect(readiness.getByText('Human drawing-review operation',{exact:true})).toHaveCount(0);expect(provider.unexpected).toEqual([]);
});
test('staff health shows payment and active-pass counts as aggregates at mobile width', async ({page}) => {
 const provider = await admin(page,{health:{
  scope:'paid-mvp-v1',monitorVersion:1,apiProfileReady:true,status:'degraded',checkedAt:'2026-11-09T01:25:00Z',
  unverifiedPasses:2,paymentReviews:3,privateProviderDetails:'Original fictional private provider details',failedAiDrafts:5,
 }});
 const health = page.getByRole('region',{name:'Operational health',exact:true});
 await expect(health.getByText('degraded',{exact:true})).toBeVisible();
 await expect(health.getByRole('article').filter({hasText:'Unverified active passes'})).toContainText('2');
 await expect(health.getByRole('article').filter({hasText:'Payments needing review'})).toContainText('3');
 await expect(health.getByText('Failed AI drafts',{exact:true})).toHaveCount(0);
 await expect(health).not.toContainText('Original fictional private provider details');
 await page.setViewportSize({width:320,height:900});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=320)).toBe(true);
 expect(provider.unexpected).toEqual([]);
});
test('a recorded owner evidence decision does not publish a paper or enable sales',async({page})=>{
 const provider=await admin(page),readiness=page.getByRole('region',{name:'Launch readiness',exact:true});await readiness.getByLabel('Content publication rights evidence',{exact:true}).fill('Fictional owner approval of adapted practice material');await readiness.locator('article').filter({has:page.getByText('Content publication rights',{exact:true})}).getByRole('button',{name:'Approve',exact:true}).click();await expect(readiness.locator('article').filter({has:page.getByText('Content publication rights',{exact:true})}).getByRole('button',{name:'Revoke',exact:true})).toBeVisible();await expect(readiness.getByText('closed',{exact:true})).toBeVisible();await expect(readiness.getByText('Sales disabled',{exact:true})).toBeVisible();expect(provider.calls.filter(([name])=>name==='admin_set_launch_gate')).toHaveLength(1);expect(provider.calls.some(([name])=>['admin_release_mvp_paper','prepare_order','start_attempt'].includes(name))).toBe(false);expect(provider.unexpected).toEqual([]);
});
test('the paid offer identifies adapted student-recalled practice without claiming official papers',async({page})=>{
 await page.goto('/plans');await expect(page.locator('.annual-card').getByRole('listitem').filter({hasText:'Adapted practice questions based on student recollections'})).toBeVisible();await expect(page.locator('.annual-card').getByRole('listitem').filter({hasText:'Only the explicitly released papers listed in the catalogue'})).toBeVisible();await expect(page.getByText('Paid access is not open in this preview.',{exact:false})).toBeVisible();await expect(page.getByRole('checkbox')).toHaveCount(0);
});
test('the public contact page identifies the supplied operator and support email without publishing the private certificate',async({page})=>{
 const provider=await stubPortalProvider(page,()=>undefined);await page.goto('/');await page.getByRole('contentinfo').getByRole('link',{name:'Contact',exact:true}).press('Enter');await expect(page.getByRole('heading',{name:'Contact DMocks.',exact:true})).toBeVisible();
 const details=page.getByRole('region',{name:'Operator and contact',exact:true});for(const text of['DEXAM','Manisha Balasaheb Shinde','Office No. 101, Pallazo Condominium','Hadapsar Road, Hadapsar, Haveli','Pune, Maharashtra 411028, India','UDYAM-MH-26-1153416'])await expect(details).toContainText(text);await expect(details.getByRole('link',{name:'inquiry@designexam.com',exact:true})).toHaveAttribute('href','mailto:inquiry@designexam.com');await expect(details).toContainText('GSTIN: Not recorded in the supplied registration.');await expect(page.getByText(/\bPAN\b|IFSC|Bank Account Number|Gender|Social Category/)).toHaveCount(0);await expect(page.getByRole('link',{name:/certificate/i})).toHaveCount(0);expect(provider.calls).toEqual([]);expect(provider.unexpected).toEqual([]);
});
test('operator details remain consistent across policy pages and accessible in both themes at 320px',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});const provider=await stubPortalProvider(page,()=>undefined);await page.setViewportSize({width:320,height:900});
 for(const path of['/contact','/privacy','/terms']){
  await page.goto(path);const details=page.getByRole('region',{name:'Operator and contact',exact:true});await expect(details).toContainText('DEXAM');const email=details.getByRole('link',{name:'inquiry@designexam.com',exact:true});await email.focus();await expect(email).toBeFocused();await expect(email).toHaveAttribute('href','mailto:inquiry@designexam.com');if(path==='/terms')await expect(page.locator('.policy')).toContainText('12 calendar months');
  await page.addScriptTag({path:fileURLToPath(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url))});for(const dark of[false,true]){const toggle=page.getByRole('switch',{name:'Dark mode',exact:true});if(await toggle.getAttribute('aria-checked')!==String(dark))await toggle.click();await expect(page.locator('html')).toHaveAttribute('data-theme',dark?'dark':'light');expect(await page.evaluate(async()=>(await window.axe.run('.policy',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>v.id))).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=320)).toBe(true);}
 }
 expect(provider.calls).toEqual([]);expect(provider.unexpected).toEqual([]);
});
