import { fileURLToPath } from 'node:url';
import{test,expect}from'@playwright/test';
import{seedPortalSession,stubPortalProvider}from'./portal-fixture.js';
import{runtimeQuestion,RULES_2027}from'../../scripts/question-runtime.mjs';
test.use({baseURL:'http://127.0.0.1:4799'});
const actor={id:'00000000-0000-4000-8000-000000001701',email:'fictional-mvp@example.invalid'},paper='10000000-0000-4000-8000-000000001701',attempt='20000000-0000-4000-8000-000000001701';
async function fixture(page,{drawing=false,numericAlternatives=false,multipleSelect=false,markings=null,released=true,analytics=null}={}){
 const state={answer:null,revision:0,submitted:false,released};
 const numeric=numericAlternatives?runtimeQuestion({externalKey:'original-numeric-alternatives',provenance:{exam:'uceed'},type:'NAT',prompt:'Original fictional exact-decimal practice question.',holds:[],assets:[],options:[],answer:{raw:'1.000000000000000001 or 1.000000000000000002',status:'reviewed'}},{rule:RULES_2027.uceed}):null;
 const score=()=>numericAlternatives?(numeric.key.accepted.some(value=>value.exact===state.answer)?4:0):-1;
 const kind=numeric?.kind??(drawing?'drawing':multipleSelect?'msq':'mcq');
 const question=()=>({id:'30000000-0000-4000-8000-000000001701',ordinal:1,kind,topic:'observation',prompt:numeric?.prompt??'Original fictional MVP objective question',options:numeric?.options??[{id:'A',label:'Original first choice'},{id:'B',label:'Original second choice'}],marking:numeric?.marking??{correct:4,wrong:-1,partial:multipleSelect},points:4,negativePoints:numericAlternatives?0:1,answer:state.answer,answerRevision:state.revision,media:[],...(state.submitted?{outcome:score()>0?'full_marks':'incorrect',explanation:numeric?.explanation??'Original fictional MVP answer explanation.'}:{})});
 const snapshot=()=>({id:attempt,title:'Original fictional released objective paper',status:state.submitted?'submitted':'active',deadline:new Date(Date.now()+900000).toISOString(),serverNow:new Date().toISOString(),questions:markings ? markings.map((marking,index)=>({...question(),id:`30000000-0000-4000-8000-${String(1701+index).padStart(12,'0')}`,ordinal:index+1,marking,points:marking.correct,negativePoints:Math.abs(marking.wrong)})) : [question()],score:state.submitted?score():null,total:4});
 const provider=await stubPortalProvider(page,(name,input)=>{
  if(name==='finalize_my_expired_attempts')return 0;
  if(name==='my_attempt_history')return[];
  if(name==='my_pass')return{active:true,expiresAt:new Date(Date.now()+86400000).toISOString()};
  if(name==='my_overview_analytics')return analytics??{completed:0,waitingForResults:0,objectiveAccuracy:null,objectiveAnswered:0,topics:[],exams:[],drawingReviews:{pending:0,released:0}};
  if(name==='available_papers')return state.released?[{id:paper,title:'Original fictional released objective paper',exam:'uceed',durationSeconds:900,qualityHeld:false}]:[];
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
test('a mismatched customer notice revision keeps the checkout switch closed', async ({ page }) => {
 const provider = await fixture(page);
 await page.goto('/plans');
 await expect(page.getByText('Paid access is not open in this preview.', { exact: false })).toBeVisible();
 await expect(page.getByRole('checkbox')).toHaveCount(0);
 await page.goto('/terms');
 await expect(page.locator('.policy')).toContainText('The final scope of published papers');
 await expect(page.locator('[data-notice-version]')).toHaveCount(0);
 await expect(page.getByText('This fictional refund notice', { exact: false })).toHaveCount(0);
 expect(provider.calls).toEqual([]);
});
for(const[path,title]of[['/dashboard/all-india','All India mocks'],['/dashboard/practice','Topic practice'],['/dashboard/community','Community'],['/review/drawings','Drawing review']])test(`the MVP disables ${title} before any private module request`,async({page})=>{
 const provider=await stubPortalProvider(page,()=>undefined);await page.goto('/');await seedPortalSession(page,actor);await page.goto(path);await expect(page.getByText('COMING LATER',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:title+'.',exact:true})).toBeVisible();
 const menu=page.getByRole('button',{name:'Student menu',exact:true});if(await menu.isVisible())await menu.click();const nav=page.getByRole('navigation',{name:'Student workspace',exact:true});await expect(nav.getByRole('link')).toHaveCount(3);await expect(nav.getByRole('link',{name:'Released papers',exact:true})).toHaveAttribute('href','/dashboard/mocks');await expect(nav.getByRole('link',{name:'Learn',exact:true})).toHaveAttribute('href','/dashboard/learn');expect(provider.calls).toEqual([]);expect(provider.unexpected).toEqual([]);
});
test('the released-paper MVP starts, saves, submits and reviews its objective offering without deferred services',async({page})=>{
 const provider=await fixture(page);await page.goto('/dashboard/mocks');await expect(page.getByRole('heading',{name:'Choose your released paper.',exact:true})).toBeVisible();await page.getByRole('button',{name:'Start or resume',exact:true}).click();await expect(page).toHaveURL('/attempt/'+attempt);
 await expect(page.getByRole('group',{name:'Choose one answer',exact:true}).getByText('Choose one answer',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'B Original second choice',exact:true}).click();await expect(page.getByText('Answers are saved to your account.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Submit attempt',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Submit & view report',exact:true}).click();
 await expect(page.getByRole('heading',{name:"Paper analysis",exact:true})).toBeVisible();await expect(page.getByText('This report covers the objective paper you submitted.',{exact:false})).toBeVisible();await expect(page.getByText('teacher-reviewed submission.',{exact:false})).toHaveCount(0);await page.getByRole('button',{name:'Open answer review',exact:true}).click();await expect(page.getByText('Original fictional MVP answer explanation.',{exact:true})).toBeVisible();expect(provider.state.answer).toBe('B');expect(provider.calls.filter(([name])=>name==='submit_attempt')).toHaveLength(1);
 expect(provider.calls.some(([name])=>['start_exam_mock','my_exam_mock_session','my_exam_mock_report','drawing-media','community_feed','learning_catalog','prepare_order'].includes(name))).toBe(false);expect(provider.unexpected).toEqual([]);
});
test('released papers stays focused while Overview retains progress',async({page})=>{
 const analytics={completed:3,waitingForResults:0,objectiveAccuracy:75,objectiveAnswered:12,topics:[{topic:'Observation',accuracy:75,correct:9,answered:12}],exams:[],drawingReviews:{pending:0,released:0}};
 const provider=await fixture(page,{analytics});
 await page.goto('/dashboard');
 await expect(page.getByRole('heading',{name:'Your papers.'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Your performance snapshot.'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Your topic picture.'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Your recent attempts.'})).toBeVisible();
 await page.goto('/dashboard/mocks');
 await expect(page.getByRole('heading',{name:'Released papers.'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Original fictional released objective paper'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Start or resume'})).toBeEnabled();
 await expect(page.getByRole('heading',{name:'Your performance snapshot.'})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Your topic picture.'})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Your recent attempts.'})).toHaveCount(0);
 await expect(page.getByText('COMPLETED ATTEMPTS')).toHaveCount(0);
 expect(provider.unexpected).toEqual([]);
});
test('an MSQ shows how to select answers and saves more than one choice', async ({ page }) => {
 const provider = await fixture(page, { multipleSelect: true });
 await page.goto('/attempt/' + attempt);
 const group = page.getByRole('group', { name: 'Choose all that apply', exact: true });
 await expect(group).toBeVisible();
 await expect(group.getByText('Choose all that apply', { exact: true })).toBeVisible();
 const first = group.getByRole('button', { name: 'A Original first choice', exact: true });
 const second = group.getByRole('button', { name: 'B Original second choice', exact: true });
 await first.press('Enter');
 await expect.poll(() => provider.state.answer).toEqual(['A']);
 await second.click();
 await expect.poll(() => provider.state.answer).toEqual(['A', 'B']);
 await expect(first).toHaveAttribute('aria-pressed', 'true');
 await expect(second).toHaveAttribute('aria-pressed', 'true');
 await page.setViewportSize({ width: 320, height: 900 });
 await page.addScriptTag({ path: fileURLToPath(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url)) });
 for (const theme of ['light', 'dark']) {
  const toggle = page.getByRole('switch', { name: 'Dark mode', exact: true });
  if (await toggle.getAttribute('aria-checked') !== String(theme === 'dark')) await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(group.getByText('Choose all that apply', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const violations = await page.evaluate(async () => (await window.axe.run('.live-choices', {
   runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })).violations.map(violation => violation.id));
  expect(violations).toEqual([]);
 }
 expect(provider.unexpected).toEqual([]);
});
test('a prepared paper stays out of the active-pass catalogue until an explicit release', async ({ page }) => {
 const provider = await fixture(page, { released: false });
 await page.goto('/dashboard/mocks');
 await expect(page.getByText('No papers have been released yet.', { exact: false })).toBeVisible();
 await expect(page.getByText('Original fictional released objective paper', { exact: true })).toHaveCount(0);
 await expect(page.getByRole('button', { name: 'Start or resume', exact: true })).toHaveCount(0);
 expect(provider.calls.some(([name]) => ['prepare_mvp_paper', 'start_attempt'].includes(name))).toBe(false);
 provider.state.released = true;
 await page.reload();
 await expect(page.getByText('Original fictional released objective paper', { exact: true })).toBeVisible();
 await expect(page.getByRole('button', { name: 'Start or resume', exact: true })).toBeEnabled();
 expect(provider.unexpected).toEqual([]);
});
for(const[value,marks]of[['1.000000000000000001',4],['1.000000000000000002',4],['1.000000000000000003',0]])test(`numeric alternative ${value} preserves its exact input and canonical ${marks}-mark report`,async({page})=>{
 const provider=await fixture(page,{numericAlternatives:true});await page.goto('/attempt/'+attempt);await page.getByLabel('Your numerical answer',{exact:true}).fill(value);await page.getByRole('button',{name:'Save answer',exact:true}).press('Enter');await expect.poll(()=>provider.state.answer).toBe(value);
 expect(provider.calls.filter(([name])=>name==='save_answer_revision').at(-1)[1].p_answer).toBe(value);await page.getByRole('button',{name:'Submit attempt',exact:true}).press('Enter');await page.getByRole('dialog').getByRole('button',{name:'Submit & view report',exact:true}).click();await expect(page.getByRole('group',{name:'Objective result',exact:true})).toContainText(`${marks}/4`);await page.getByRole('button',{name:'Open answer review',exact:true}).press('Enter');await expect(page.locator('.answer-review article')).toContainText('Your answer: '+value);expect(provider.unexpected).toEqual([]);
});
test('an unsupported drawing paper fails closed in the MVP runner',async({page})=>{
 const provider=await fixture(page,{drawing:true});await page.goto('/attempt/'+attempt);await expect(page.getByRole('alert')).toContainText('This attempt is unavailable');await expect(page.getByRole('heading',{name:'Original fictional MVP objective question',exact:true})).toHaveCount(0);await expect(page.locator('input[type=file]')).toHaveCount(0);expect(provider.calls.map(([name])=>name)).toEqual(['read_attempt']);expect(provider.unexpected).toEqual([]);
});
test('the original free sample completes without creating a provider account or payment',async({page})=>{
 const provider=await stubPortalProvider(page,()=>undefined);await page.goto('/sample');await page.getByRole('button',{name:'Begin the sample',exact:true}).click();
 for(let index=0;index<5;index++){await page.getByRole('button',{name:'Option A',exact:true}).click();if(index<4)await page.getByRole('button',{name:'Next question',exact:true}).click();}
 await page.getByRole('button',{name:'Review & submit',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Submit & see my sample report',exact:true}).click();await expect(page).toHaveURL('/sample/result');await expect(page.getByRole('heading',{name:'A little insight. Your next step.',exact:true})).toBeVisible();await page.getByRole('button',{name:'Open answer review',exact:false}).click();await expect(page.locator('.answer-review article')).toHaveCount(5);expect(provider.calls).toEqual([]);expect(provider.unexpected).toEqual([]);
});
test('released Learn opens every interactive programme without any private request',async({page})=>{
 const provider=await stubPortalProvider(page,()=>undefined);await page.goto('/');await seedPortalSession(page,actor);await page.goto('/dashboard/learn');
 await expect(page.getByRole('heading',{name:'Learn by doing.',exact:true})).toBeVisible();
 const cards=page.locator('.programme-list article');await expect(cards).toHaveCount(28);await expect(page.locator('.programme-list .motif')).toHaveCount(28);
 await page.getByRole('link',{name:/Start programme/}).first().click();await expect(page).toHaveURL(/\/dashboard\/learn\/programme\//);await expect(page.locator('.tier-head').first()).toBeVisible();
 expect(provider.calls).toEqual([]);expect(provider.unexpected).toEqual([]);
});
test('a production build cannot enable deferred modules or checkout with preview flags',async({page})=>{
 await page.goto('http://127.0.0.1:4899/dashboard/community');await expect(page.getByText('COMING LATER',{exact:true})).toBeVisible();const menu=page.getByRole('button',{name:'Student menu',exact:true});if(await menu.isVisible())await menu.click();await expect(page.getByRole('navigation',{name:'Student workspace'}).getByRole('link')).toHaveCount(3);
 await page.goto('http://127.0.0.1:4899/plans');await expect(page.getByRole('checkbox')).toHaveCount(0);await expect(page.getByRole('button',{name:/Pay .* with Razorpay/})).toHaveCount(0);await expect(page.getByRole('listitem').filter({hasText:'Only the explicitly released papers listed in the catalogue'})).toBeVisible();
});

test('the closed public landing offers two available resources and identifies the sole planned paid paper', async ({ page }) => {
  await page.goto('http://127.0.0.1:4899/');
  await expect(page.getByRole('link', { name: 'Join free', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Student account', exact: true })).toHaveCount(0);
  const features = page.locator('#features');
  await expect(features.getByRole('link')).toHaveCount(3);
  await expect(features.getByRole('link', { name: 'Start the free sample' })).toHaveAttribute('href', '/sample');
  await expect(features.getByRole('link', { name: 'Compare the museum signs' })).toHaveAttribute('href', '/practice/visual-hierarchy');
  await expect(features.getByRole('link', { name: 'Read the UCEED Part A guide' })).toHaveAttribute('href', '/tests/uceed');
  await expect(page.locator('main')).not.toContainText(/opening soon|all india|top ten|reviewer|community|interactive programmes|illustrative preview/i);
  await expect(page.getByRole('heading', { name: 'Read your five-question report' })).toBeVisible();
  await page.locator('.hero-actions').getByRole('link', { name: 'Try 5 sample questions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Begin the sample', exact: true })).toBeVisible();
});

test('the public landing and sample do not fetch deferred portal JavaScript', async ({ page }) => {
  const origin = 'http://127.0.0.1:4899';
  const scripts = new Set();
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname.endsWith('.js')) scripts.add(url.pathname);
  });
  await page.goto(origin + '/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto(origin + '/sample');
  await expect(page.getByRole('button', { name: 'Begin the sample', exact: true })).toBeVisible();
  expect([...scripts].some(path => /^\/assets\/index-/.test(path))).toBe(true);
  expect([...scripts].filter(path => /^\/assets\/(?:ExamMocks|TopicPractice|AllIndia|Learn|LearnProgramme|Community)-/.test(path))).toEqual([]);
});

for (const partial of [false, true]) test(`section guidance follows the active MSQ marking rule (partial ${partial})`, async ({ page }) => {
 const provider = await fixture(page, { multipleSelect: true, markings: [
  { correct: 4, wrong: -1, partial: !partial },
  { correct: 2, wrong: 0, partial },
 ] });
 await page.goto('/attempt/' + attempt);
 const guidance = page.getByRole('navigation', { name: 'Sections', exact: true }).locator('.section-rule');
 await expect(guidance).toContainText('+4 correct · -1 wrong');
 await page.getByRole('button', { name: 'Go to question 2', exact: true }).click();
 await expect(guidance).toHaveText('Multiple select (MSQ) · +2 correct · 0 wrong' + (partial ? ' · partial marks for a correct subset' : ''));
 await page.getByRole('button', { name: 'Go to question 1', exact: true }).click();
 await expect(guidance).toHaveText('Multiple select (MSQ) · +4 correct · -1 wrong' + (!partial ? ' · partial marks for a correct subset' : ''));
 expect(provider.calls.filter(([name]) => name === 'save_answer_revision')).toEqual([]);
 expect(provider.unexpected).toEqual([]);
});
