import { expect, test } from "@playwright/test";
import {fileURLToPath} from "node:url";
import {readFileSync} from "node:fs";
import {compilePublishedNotices} from "../../scripts/published-notices.mjs";
import project from "../../supabase/project.json" with { type: "json" };
import { seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/fictional-published-notices.json", import.meta.url), "utf8"));
const version = compilePublishedNotices({...fixture, scope:"release"}, {freeSignup:true}).version;
const exempt = {required:false, accepted:false, version:null};
const site = project.frontend_origin;
const artifactPort = Number(process.env.DMOCKS_CONTROLLED_PUBLIC_TEST_PORT || 4797);
const artifact = "http://127.0.0.1:" + artifactPort;
const tester = { id: "00000000-0000-4000-8000-000000000097", email: "owner-test@example.invalid" };
test.use({ baseURL: site, serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => route.abort());
  await page.route(url => [site, "https://www.dmocks.com"].includes(url.origin), async route => {
    const url = new URL(route.request().url());
    // Keep fixture bytes independent of the browser request context during navigation.
    const response = await fetch(artifact + url.pathname + url.search, {
      redirect: "manual", headers: { "accept-encoding": "identity" },
    });
    const headers = Object.fromEntries(response.headers);
    delete headers["content-encoding"];
    delete headers["content-length"];
    await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
  });
});

test("the controlled public build opens only approved Google tester access and no checkout", async ({ page }) => {
  let admitted = true;
  const { calls, unexpected } = await stubPortalProvider(page, procedure => {
    if (procedure === "free_signup_notice") return exempt;
    if (procedure === "can_enter_staging_portal") return admitted;
    if (procedure === "my_privacy_requests" || procedure === "available_papers" ||
        procedure === "my_attempt_history" || procedure === "learning_catalog" || procedure === "learning_progress") return [];
    if (procedure === "my_pass") return { active: false, expiresAt: null };
    if (procedure === "finalize_my_expired_attempts") return 0;
    if (procedure === "my_overview_analytics") return { completed: 0, waitingForResults: 0,
      objectiveAccuracy: null, objectiveAnswered: 0, topics: [], exams: [],
      drawingReviews: { pending: 0, released: 0 } };
  }, project.project_ref);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Your workspace." })).toBeVisible();
  await expect(page.getByText("Sign in with Google to open your free workspace.")).toBeVisible();
  expect(calls).toEqual([]);

  await page.goto("/account");
  await expect(page.getByText("Sign in with Google to take free past papers. The annual pass is not on sale yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await seedPortalSession(page, tester, project.project_ref);
  await page.reload();
  await page.getByRole("link", { name: "Open your workspace" }).click();
  await expect(page.getByRole("heading", { name: /Welcome to your next attempt/ })).toBeVisible();
  expect(calls.some(([name]) => name === "can_enter_staging_portal")).toBe(true);

  admitted = false;
  await page.reload();
  await expect(page.getByText("Sign-up is not open for this account yet.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Welcome to your next attempt/ })).toHaveCount(0);
  await page.goto("/plans");
  await expect(page.getByText("Checkout is closed during controlled testing.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay .* with Razorpay/ })).toBeDisabled();
  expect(unexpected).toEqual([]);
});

test("a copied controlled public build is inert on another host", async ({ page }) => {
  const { calls } = await stubPortalProvider(page, () => undefined, project.project_ref);
  await page.goto("https://www.dmocks.com/account");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  await seedPortalSession(page, tester, project.project_ref);
  await page.goto("https://www.dmocks.com/dashboard");
  await expect(page.getByRole("heading", { name: "Your workspace." })).toHaveCount(0);
  expect(calls).toEqual([]);
});

test("an admitted tester can reopen saved pending and drawing attempts without opening checkout", async ({ page }) => {
  const drawingId = "00000000-0000-4000-8000-000000000098";
  const pendingId = "00000000-0000-4000-8000-000000000099";
  const now = new Date().toISOString();
  const { calls, unexpected } = await stubPortalProvider(page, (procedure, input) => {
    if (procedure === "free_signup_notice") return exempt;
    if (procedure === "can_enter_staging_portal") return true;
    if (procedure === "finalize_my_expired_attempts") return 0;
    if (procedure === "my_pass") return { active: false, expiresAt: null };
    if (procedure === "available_papers") return [];
    if (procedure === "my_attempt_history") return [
      { id: drawingId, title: "Original fictional drawing result", status: "submitted", resultsPending: false, score: 20, total: 100 },
      { id: pendingId, title: "Original fictional pending result", status: "submitted", resultsPending: true, score: null, total: null },
    ];
    if (procedure === "my_overview_analytics") return { completed: 2, waitingForResults: 1,
      objectiveAccuracy: null, objectiveAnswered: 0, topics: [], exams: [],
      drawingReviews: { pending: 0, released: 1 } };
    if (procedure === "my_exam_mock_session") return input.p_attempt_id === drawingId ? {
      exam: "ceed", partAAttemptId: "00000000-0000-4000-8000-000000000097",
      partBAttemptId: drawingId, partBState: "started", partBOpensAt: now,
    } : null;
    if (procedure === "my_exam_mock_report") return null;
    if (procedure === "read_attempt") return input.p_id === drawingId ? {
      id: drawingId, title: "Original fictional drawing result", status: "submitted", deadline: now,
      serverNow: now, resultsPending: false, scoreKind: "drawing", score: 20, total: 100,
      questions: [{ id: "00000000-0000-4000-8000-000000000101", ordinal: 1, kind: "drawing",
        topic: "observation", prompt: "Sketch a fictional object.", answer: null, media: [],
        drawingReview: { status: "released", score: 20, maxScore: 100, comments: "Original fictional review." } }],
    } : input.p_id === pendingId ? {
      id: pendingId, title: "Original fictional pending result", status: "submitted", deadline: now,
      serverNow: now, resultsPending: true, reviewEndsAt: now, score: null, total: null, questions: [],
    } : undefined;
  }, project.project_ref);
  await page.goto("/account");
  await seedPortalSession(page, tester, project.project_ref);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Original fictional drawing result" })).toBeVisible();
  await page.getByRole("link", { name: "Original fictional drawing result" }).click();
  await expect(page.getByRole("heading", { name: "Paper analysis" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Drawing result" })).toContainText("20/100");
  await expect(page.getByRole("link", { name: "Continue Part B" })).toHaveCount(0);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Original fictional pending result" }).click();
  await expect(page.getByRole("heading", { name: /Results come after review/ })).toBeVisible();
  await expect(page.getByText("Marks, topic feedback, answer keys and ranks stay private")).toBeVisible();
  expect(calls.filter(([name]) => name === "read_attempt").map(([, input]) => input.p_id)).toEqual([drawingId, pendingId]);
  expect(calls.some(([name]) => name === "create-order" || name === "prepare_order")).toBe(false);
  expect(unexpected).toEqual([]);
});

test("a new student accepts the displayed version and returns to their requested exam", async ({page})=>{
  let accepted=false;
  const {calls,unexpected}=await stubPortalProvider(page,(name,input)=>{
    if(name==='free_signup_notice') return {required:true,accepted,version};
    if(name==='accept_current_terms'){expect(input).toEqual({p_version:version});accepted=true;return null;}
    if(name==='can_enter_staging_portal') return true;
    if(name==='my_privacy_requests')return [];
    if(name==='finalize_my_expired_attempts')return 0;
  },project.project_ref);
  await page.goto('/account');
  const account = page.locator('.account-card');
  await expect(account.getByRole('link',{name:'Terms of Use'})).toHaveAttribute('href','/terms');
  await expect(account.getByRole('link',{name:'Privacy Notice'})).toHaveAttribute('href','/privacy');
  await expect(account).toContainText('students aged 18 or older');
  await expect(account.getByRole('checkbox')).toHaveCount(0);
  await seedPortalSession(page,tester,project.project_ref);
  await page.evaluate(()=>sessionStorage.setItem('dmocks:return-after-sign-in','/papers/ceed'));
  await page.goto('/account/callback');
  const consent=page.getByRole('region',{name:'Before you start'});
  const confirm=consent.getByRole('button',{name:'Accept and continue'});
  await expect(consent).toContainText(tester.email);
  await expect(consent.getByRole('checkbox',{name:/I am 18 or older/})).toBeVisible();
  await expect(confirm).toBeDisabled();
  await page.addScriptTag({path:fileURLToPath(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url))});
  expect(await page.evaluate(async()=>(await window.axe.run('.signup-notice',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations)).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expect(consent.getByRole('link',{name:'Terms of Use'})).toHaveAttribute('href','/terms');
  await expect(consent.getByRole('link',{name:'Privacy Notice'})).toHaveAttribute('href','/privacy');
  expect(calls.some(([name])=>name==='my_year_paper_attempts'||name==='accept_current_terms')).toBe(false);
  await consent.getByRole('checkbox').check();
  await confirm.click();
  await expect(page).toHaveURL(site+'/papers/ceed');
  await expect(page.getByRole('heading',{name:'Before you start'})).toHaveCount(0);
  expect(calls.filter(([name])=>name==='accept_current_terms')).toHaveLength(1);
  expect(calls.filter(([name])=>name==='free_signup_notice').length).toBeGreaterThanOrEqual(2);
  expect(unexpected).toEqual([]);
});

test("a version change or failed acceptance keeps student data private", async({page})=>{
  let state='mismatch';
  let writes=0;
  const {calls}=await stubPortalProvider(page,name=>{
    if(name==='free_signup_notice')return {required:true,accepted:false,version:state==='mismatch'?'changed':version};
    if(name==='logout')return {};
    if(name==='accept_current_terms'){writes++; return {code:'invalid',message:'Test failure'};}
  },project.project_ref);
  await page.goto('/privacy');
  await seedPortalSession(page,tester,project.project_ref);
  await page.goto('/dashboard/practice');
  await expect(page.getByRole('alert')).toContainText('published notices have changed');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  const start=page.getByRole('button',{name:'Accept and continue'});
  state='current';
  await page.getByRole('button',{name:'Reload notices'}).click();
  await page.getByRole('checkbox').check();
  await start.click();
  await expect(page.getByRole('alert')).toContainText('couldn’t confirm');
  await page.getByRole('button',{name:'Check again'}).click();
  await expect(start).toBeDisabled();
  expect(writes).toBe(1);
  expect(calls.map(([name])=>name).filter(name=>!['free_signup_notice','accept_current_terms'].includes(name))).toEqual([]);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByText('Sign in with Google to open your free workspace.')).toBeVisible();
});

test("switching accounts drops a checked notice and a late acceptance response",async({page})=>{
  let entered,release;
  const inFlight = new Promise(resolve=>{entered=resolve;});
  const wait = new Promise(resolve=>{release=resolve;});
  const actorB={id:'00000000-0000-4000-8000-000000000199',email:'second@example.invalid'};
  const {calls}=await stubPortalProvider(page,name=>name==='free_signup_notice'?{required:true,accepted:false,version}:undefined,project.project_ref);
  await page.route('**/rest/v1/rpc/accept_current_terms',async route=>{
    if(route.request().method()==='OPTIONS')return route.fallback();
    const token=route.request().headers().authorization?.split(' ')[1];
    expect(JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub).toBe(tester.id);
    entered();await wait;
    await route.fulfill({status:204,headers:{'access-control-allow-origin':'*'}}).catch(()=>{});
  });
  await page.goto('/account');
  await seedPortalSession(page,tester,project.project_ref);
  await page.goto('/dashboard');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Accept and continue'}).click();
  await inFlight;
  await seedPortalSession(page,actorB,project.project_ref);
  await page.evaluate(ref=>{
    const key='sb-'+ref+'-auth-token',channel=new BroadcastChannel(key);
    channel.postMessage({event:'SIGNED_IN',session:JSON.parse(localStorage.getItem(key))});
    channel.close();
  },project.project_ref);
  await expect(page.getByText('Signed in as '+actorB.email)).toBeVisible();
  release();
  await expect(page.getByText('Signed in as '+actorB.email)).toBeVisible();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  expect(calls.some(([name])=>name==='my_overview_analytics')).toBe(false);
});
