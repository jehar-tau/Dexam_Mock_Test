import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { emptyAdminRead, portalFixtureURL, seedPortalSession, stubPortalProvider } from './portal-fixture.js';
test.use({baseURL:portalFixtureURL});
const actor={id:'00000000-0000-4000-8000-000000007172',email:'payment-review@example.invalid'};
const row=n=>({reference:`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,amountMinor:119300,currency:'INR',status:'paid',refundedMinor:30000,reviewRequired:true,createdAt:'2026-11-01T00:00:00Z',paidAt:null,refundedAt:null,passState:'none'});
async function fixture(page,respond){
 const provider=await stubPortalProvider(page,(name,input)=>name==='is_dmocks_admin'?true:name==='admin_payment_review_page'?respond(input):emptyAdminRead(name));
 await page.goto('/');await seedPortalSession(page,actor);await page.goto('/admin');return provider;
}
test('read-only payment inspection paginates without support reports or provider requests',async({page})=>{
 const rows=Array.from({length:10},(_,n)=>row(20-n));const last=rows.at(-1);
 const provider=await fixture(page,input=>({mode:'test',items:input.p_before_id?[row(1)]:rows,nextCursor:input.p_before_id?null:{reference:last.reference,createdAt:last.createdAt}}));
 const queue=page.getByRole('region',{name:'Payment reviews',exact:true});
 await queue.getByRole('button',{name:'Refresh payment reviews'}).focus();
 await page.keyboard.press('Enter');
 await expect(queue.getByRole('heading',{name:'Purchase review'})).toHaveCount(10);
 await expect(queue.getByText('Matching pass: none').first()).toBeVisible();
 await queue.getByRole('button',{name:'Next payment reviews'}).click();
 await expect(queue.getByRole('heading',{name:'Purchase review'})).toHaveCount(1);
 await expect(queue.getByText(row(1).reference,{exact:false})).toBeVisible();
 expect(provider.calls.filter(([name])=>name==='admin_payment_review_page').map(([,input])=>input)).toEqual([{p_before_created_at:null,p_before_id:null},{p_before_created_at:last.createdAt,p_before_id:last.reference}]);
 expect(provider.calls.some(([name])=>/refund|fulfil|create-order|attach_provider/.test(name))).toBe(false);
 await page.setViewportSize({width:320,height:720});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.addScriptTag({path:fileURLToPath(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url))});
 for (const theme of ['light','dark']) {
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   const violations=await page.evaluate(async()=> (await window.axe.run('[aria-label="Payment reviews"]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);
   expect(violations).toEqual([]);
 }
});
test('malformed reply clears old records and allows an explicit retry',async({page})=>{
 let count=0;await fixture(page,()=>++count===1?{mode:'test',items:[{...row(1),refundedMinor:-1}],nextCursor:null}:{mode:'test',items:[],nextCursor:null});
 const queue=page.getByRole('region',{name:'Payment reviews',exact:true});
 await queue.getByRole('button',{name:'Refresh payment reviews'}).click();await expect(queue.getByRole('alert')).toBeVisible();
 await queue.getByRole('button',{name:'Refresh payment reviews'}).click();await expect(queue.getByText('No payments need review.')).toBeVisible();
});
test('revoked staff cannot keep visible payment records',async({page})=>{
 await fixture(page,()=>({mode:'test',items:[row(1)],nextCursor:null}));
 await page.getByRole('button',{name:'Refresh payment reviews'}).click();await expect(page.getByText(row(1).reference,{exact:false})).toBeVisible();
 await page.route('**/rest/v1/rpc/is_dmocks_admin',route=>route.fulfill({headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},json:false}));
 await page.getByRole('button',{name:'Recheck administrator access',exact:true}).click();
 await expect(page.getByRole('region',{name:'Payment reviews',exact:true})).toHaveCount(0);
});
