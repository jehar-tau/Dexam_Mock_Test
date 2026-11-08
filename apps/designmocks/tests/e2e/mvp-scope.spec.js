import{test,expect}from'@playwright/test';
import{seedPortalSession,stubPortalProvider}from'./portal-fixture.js';
test.use({baseURL:'http://127.0.0.1:4799'});
const actor={id:'00000000-0000-4000-8000-000000001701',email:'fictional-mvp@example.invalid'},paper='10000000-0000-4000-8000-000000001701',attempt='20000000-0000-4000-8000-000000001701';
async function fixture(page,{drawing=false}={}){
 const state={answer:null,revision:0,submitted:false};
 const question=()=>({id:'30000000-0000-4000-8000-000000001701',ordinal:1,kind:drawing?'drawing':'mcq',topic:'observation',prompt:'Original fictional MVP objective question',options:[{id:'A',label:'Original first choice'},{id:'B',label:'Original second choice'}],marking:{correct:4,wrong:-1},points:4,negativePoints:1,answer:state.answer,answerRevision:state.revision,media:[],...(state.submitted?{outcome:'incorrect',explanation:'Original fictional MVP answer explanation.'}:{})});
 const snapshot=()=>({id:attempt,title:'Original fictional released objective paper',status:state.submitted?'submitted':'active',deadline:new Date(Date.now()+900000).toISOString(),serverNow:new Date().toISOString(),questions:[question()],score:state.submitted?-1:null,total:4});
 const provider=await stubPortalProvider(page,(name,input)=>{
  if(name==='finalize_my_expired_attempts')return 0;
  if(name==='my_attempt_history')return[];
  if(name==='my_pass')return{active:true,expiresAt:new Date(Date.now()+86400000).toISOString()};
  if(name==='my_overview_analytics')return{completed:0,waitingForResults:0,objectiveAccuracy:null,objectiveAnswered:0,topics:[],exams:[],drawingReviews:{pending:0,released:0}};
  if(name==='available_papers')return[{id:paper,title:'Original fictional released objective paper',exam:'uceed',durationSeconds:900,qualityHeld:false}];
  if(name==='start_attempt')return attempt;
  if(name==='read_attempt')return snapshot();
  if(name==='save_answer_revision'){state.answer=input.p_answer;state.revision=input.p_revision;return{accepted:true,revision:state.revision,answer:state.answer};}
  if(name==='submit_attempt'){state.submitted=true;return snapshot();}
 });
 await page.goto('/');await seedPortalSession(page,actor);return{state,...provider};
}
test('the public offer limits the pass to released papers and keeps checkout independently closed',async({page})=>{
 const provider=await stubPortalProvider(page,()=>undefined);await page.goto('/');await expect(page.getByRole('heading',{name:/Make your next attempt count/})).toBeVisible();expect(provider.calls).toEqual([]);
 await page.goto('/tests/nid');await expect(page.getByText('This exam is coming later and is outside the initial annual-pass offer.',{exact:true})).toBeVisible();await seedPortalSession(page,actor);await page.goto('/plans');
 await expect(page.getByRole('listitem').filter({hasText:'Only the explicitly released papers listed in the catalogue'})).toBeVisible();await expect(page.getByText('Mock-test catalogue for UCEED, NID DAT, NIFT and CEED',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:/Pay .* with Razorpay/})).toBeDisabled();await expect(page.getByRole('checkbox')).toHaveCount(0);expect(provider.calls).toEqual([]);expect(provider.unexpected).toEqual([]);
});
for(const[path,title]of[['/dashboard/all-india','All India mocks'],['/dashboard/practice','Topic practice'],['/dashboard/learn','Learn'],['/dashboard/community','Community'],['/review/drawings','Drawing review']])test(`the MVP disables ${title} before any private module request`,async({page})=>{
 const provider=await stubPortalProvider(page,()=>undefined);await page.goto('/');await seedPortalSession(page,actor);await page.goto(path);await expect(page.getByText('COMING LATER',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:title+'.',exact:true})).toBeVisible();
 const menu=page.getByRole('button',{name:'Student menu',exact:true});if(await menu.isVisible())await menu.click();const nav=page.getByRole('navigation',{name:'Student workspace',exact:true});await expect(nav.getByRole('link')).toHaveCount(2);await expect(nav.getByRole('link',{name:'Released papers',exact:true})).toHaveAttribute('href','/dashboard/mocks');expect(provider.calls).toEqual([]);expect(provider.unexpected).toEqual([]);
});
test('the released-paper MVP starts, saves, submits and reviews its objective offering without deferred services',async({page})=>{
 const provider=await fixture(page);await page.goto('/dashboard/mocks');await expect(page.getByRole('heading',{name:'Choose your released paper.',exact:true})).toBeVisible();await page.getByRole('button',{name:'Start or resume',exact:true}).click();await expect(page).toHaveURL('/attempt/'+attempt);
 await page.getByRole('button',{name:'B Original second choice',exact:true}).click();await expect(page.getByText('Answers are saved to your account.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Submit attempt',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Submit & view report',exact:true}).click();
 await expect(page.getByRole('heading',{name:/Make this attempt/})).toBeVisible();await page.getByRole('button',{name:'Open answer review',exact:true}).click();await expect(page.getByText('Original fictional MVP answer explanation.',{exact:true})).toBeVisible();expect(provider.state.answer).toBe('B');expect(provider.calls.filter(([name])=>name==='submit_attempt')).toHaveLength(1);
 expect(provider.calls.some(([name])=>['start_exam_mock','my_exam_mock_session','my_exam_mock_report','drawing-media','community_feed','learning_catalog','prepare_order'].includes(name))).toBe(false);expect(provider.unexpected).toEqual([]);
});
test('an unsupported drawing paper fails closed in the MVP runner',async({page})=>{
 const provider=await fixture(page,{drawing:true});await page.goto('/attempt/'+attempt);await expect(page.getByRole('alert')).toContainText('This attempt is unavailable');await expect(page.getByRole('heading',{name:'Original fictional MVP objective question',exact:true})).toHaveCount(0);await expect(page.locator('input[type=file]')).toHaveCount(0);expect(provider.calls.map(([name])=>name)).toEqual(['read_attempt']);expect(provider.unexpected).toEqual([]);
});
test('the original free sample completes without creating a provider account or payment',async({page})=>{
 const provider=await stubPortalProvider(page,()=>undefined);await page.goto('/sample');await page.getByRole('button',{name:'Begin the sample',exact:true}).click();
 for(let index=0;index<5;index++){await page.getByRole('button',{name:'Option A',exact:true}).click();if(index<4)await page.getByRole('button',{name:'Next question',exact:true}).click();}
 await page.getByRole('button',{name:'Review & submit',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Submit & see my sample report',exact:true}).click();await expect(page).toHaveURL('/sample/result');await expect(page.getByRole('heading',{name:'A little insight. Your next step.',exact:true})).toBeVisible();await page.getByRole('button',{name:'Open answer review',exact:false}).click();await expect(page.locator('.answer-review article')).toHaveCount(5);expect(provider.calls).toEqual([]);expect(provider.unexpected).toEqual([]);
});
test('a production build cannot enable deferred modules or checkout with preview flags',async({page})=>{
 await page.goto('http://127.0.0.1:4899/dashboard/community');await expect(page.getByText('COMING LATER',{exact:true})).toBeVisible();const menu=page.getByRole('button',{name:'Student menu',exact:true});if(await menu.isVisible())await menu.click();await expect(page.getByRole('navigation',{name:'Student workspace'}).getByRole('link')).toHaveCount(2);
 await page.goto('http://127.0.0.1:4899/plans');await expect(page.getByRole('checkbox')).toHaveCount(0);await expect(page.getByRole('button',{name:/Pay .* with Razorpay/})).toHaveCount(0);await expect(page.getByRole('listitem').filter({hasText:'Only the explicitly released papers listed in the catalogue'})).toBeVisible();
});
