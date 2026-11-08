import{test,expect}from'@playwright/test';
import{stubPortalProvider,seedPortalSession,emptyAdminRead}from'./portal-fixture.js';
test.use({baseURL:'http://127.0.0.1:4799'});
const actor={id:'00000000-0000-4000-8000-000000001971',email:'fictional-mvp-operator@example.invalid'},core=['admin_bug_reports','admin_reported_questions','admin_operational_health','admin_privacy_requests','admin_launch_readiness','admin_search_bank_questions'];
const gates=['content_rights','privacy_terms','refund_policy','child_safety','provider_acceptance','backup_restore','capacity_acceptance'];
async function admin(page,{legacy=false}={}){
 const state={approved:false},provider=await stubPortalProvider(page,(name,input)=>{
  if(name==='is_dmocks_admin')return true;
  if(name==='admin_launch_readiness')return{scope:legacy?undefined:'paid-mvp-v1',apiProfileReady:!legacy,offeringReady:false,salesEnabled:false,policyPublished:false,paperBlueprintReady:legacy,readyForSales:legacy,allAttestationsApproved:false,gates:gates.map(gate=>({gate,approved:gate==='content_rights'&&state.approved,evidence:gate==='content_rights'&&state.approved?'Fictional owner approval':null}))};
  if(name==='admin_set_launch_gate'){expect(input.p_gate).toBe('content_rights');state.approved=true;return null;}
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
test('a recorded owner evidence decision does not publish a paper or enable sales',async({page})=>{
 const provider=await admin(page),readiness=page.getByRole('region',{name:'Launch readiness',exact:true});await readiness.getByLabel('Content publication rights evidence',{exact:true}).fill('Fictional owner approval of adapted practice material');await readiness.locator('article').filter({has:page.getByText('Content publication rights',{exact:true})}).getByRole('button',{name:'Approve',exact:true}).click();await expect(readiness.locator('article').filter({has:page.getByText('Content publication rights',{exact:true})}).getByRole('button',{name:'Revoke',exact:true})).toBeVisible();await expect(readiness.getByText('closed',{exact:true})).toBeVisible();await expect(readiness.getByText('Sales disabled',{exact:true})).toBeVisible();expect(provider.calls.filter(([name])=>name==='admin_set_launch_gate')).toHaveLength(1);expect(provider.calls.some(([name])=>['admin_release_mvp_paper','prepare_order','start_attempt'].includes(name))).toBe(false);expect(provider.unexpected).toEqual([]);
});
test('the paid offer identifies adapted student-recalled practice without claiming official papers',async({page})=>{
 await page.goto('/plans');await expect(page.locator('.annual-card').getByRole('listitem').filter({hasText:'Adapted practice questions based on student recollections'})).toBeVisible();await expect(page.locator('.annual-card').getByRole('listitem').filter({hasText:'Only the explicitly released papers listed in the catalogue'})).toBeVisible();await expect(page.getByText('Paid access is not open in this preview.',{exact:false})).toBeVisible();await expect(page.getByRole('checkbox')).toHaveCount(0);
});
