import{test,expect}from'@playwright/test';
import{seedPortalSession,stubPortalProvider}from'./portal-fixture.js';
test.use({baseURL:'http://127.0.0.1:4799'});
test('a server-revoked pass prevents another paper start without charging again or erasing past results',async({page})=>{
 const actor={id:'00000000-0000-4000-8000-000000001851',email:'fictional-refund-status@example.invalid'},state={revoked:false};
 const provider=await stubPortalProvider(page,name=>{
  if(name==='finalize_my_expired_attempts')return 0;
  if(name==='my_pass')return{active:!state.revoked,expiresAt:new Date(Date.now()+(state.revoked?-1000:86400000)).toISOString(),revoked:state.revoked};
  if(name==='my_attempt_history')return[{id:'20000000-0000-4000-8000-000000001851',title:'Original fictional saved result',status:'submitted',score:3,total:4,resultsPending:false}];
  if(name==='my_overview_analytics')return{completed:1,waitingForResults:0,objectiveAccuracy:75,objectiveAnswered:4,topics:[],exams:[],drawingReviews:{pending:0,released:0}};
  if(name==='available_papers')return[{id:'10000000-0000-4000-8000-000000001851',title:'Original fictional next objective paper',exam:'uceed',durationSeconds:900,qualityHeld:false}];
 });
 await page.goto('/');await seedPortalSession(page,actor);await page.goto('/dashboard');await expect(page.getByRole('button',{name:'Start or resume',exact:true})).toBeEnabled();state.revoked=true;
 await page.getByRole('button',{name:'Refresh workspace',exact:true}).click();await expect(page.getByRole('heading',{name:'Not active',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Start or resume',exact:true})).toBeDisabled();await expect(page.getByRole('link',{name:'Original fictional saved result',exact:false})).toHaveAttribute('href','/attempt/20000000-0000-4000-8000-000000001851');
 expect(provider.calls.some(([name])=>['start_attempt','prepare_order','create-order','fulfil_verified_payment','record_verified_refund'].includes(name))).toBe(false);expect(provider.unexpected).toEqual([]);
});
