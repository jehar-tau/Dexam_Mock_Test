import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { seedPortalSession, stubPortalProvider } from './portal-fixture.js';
import project from '../../supabase/project.json' with { type: 'json' };

for (const exam of ['UCEED', 'CEED', 'NIFT', 'NID']) {
  test(`year-wise Papers shows only reviewed ${exam} releases on desktop and mobile`, async ({ page }) => {
    await page.goto('/papers');
    await expect(page.getByRole('heading', { name: 'Explore the papers.' })).toBeVisible();
    await page.getByRole('button', { name: new RegExp(`^${exam}\\b`) }).click();
    await expect(page.getByRole('heading', { name: exam, exact: true })).toBeVisible();
    await expect(page.locator('.year-paper-card')).toHaveCount(0);
    await expect(page.getByText(`No ${exam} paper released yet`)).toBeVisible();
    await expect(page.getByRole('button', { name: /Start paper|Take paper/ })).toHaveCount(0);
  });
}

test('same-year CEED releases remain separate', async ({ page }) => {
  const releases = [1,2].map((number) => ({paperId:`10000000-0000-4000-8000-00000000300${number}`,
    exam:'ceed',year:2016,sourcePaperId:`ceed-2016-paper-${number}`,partLabel:'Part A',questionCount:10,durationSeconds:3600}));
  await stubPortalProvider(page, name => name === 'free_year_paper_catalog' ? releases : undefined);
  await page.goto('http://127.0.0.1:4599/papers');
  await page.getByRole('button', { name: /^CEED\b/ }).click();
  await expect(page.getByRole('heading', { name: '2016 · Paper 1' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '2016 · Paper 2' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Take the free sample' })).toHaveAttribute('href', '/sample');
});

test('Papers tabs work by keyboard, reflow at 320px and pass accessibility checks', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/papers');
  const ceed = page.getByRole('button', { name: /^CEED\b/ });
  await ceed.focus();
  await page.keyboard.press('Enter');
  await expect(ceed).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.addScriptTag({ path: fileURLToPath(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url)) });
  const violations = await page.evaluate(async () => (await window.axe.run('.year-papers', {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
  })).violations.map(item => item.id));
  expect(violations).toEqual([]);
});

test.describe('free year-paper release', () => {
  test.use({ baseURL: 'http://127.0.0.1:4599' });
  const actor = { id: '00000000-0000-4000-8000-000000003001', email: 'fictional-year@example.invalid' };
  const paperId = '10000000-0000-4000-8000-000000003001';
  const attemptId = '20000000-0000-4000-8000-000000003001';
  const release = { paperId, exam: 'uceed', year: 2026, sourcePaperId: 'uceed-2026', partLabel: 'Part A', questionCount: 57, durationSeconds: 7200 };
  test('released fixed paper is free to browse and requests sign-in', async ({ page }) => {
    const provider = await stubPortalProvider(page, name => name === 'free_year_paper_catalog' ? [release] :
      name === 'public_all_india_top_ten' ? [] : undefined);
    await page.goto('/papers');
    const card = page.locator('.year-paper-card').filter({ hasText: '2026 paper' });
    await expect(card).toContainText('Free paper open');
    await expect(card.getByRole('link', { name: 'Sign in to start free paper' })).toHaveAttribute('href', '/account');
    await page.setViewportSize({ width: 320, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.addScriptTag({ path: fileURLToPath(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url)) });
    expect((await page.evaluate(async () => (await window.axe.run('.year-papers', {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
    })).violations.map(item => item.id)))).toEqual([]);
    expect(provider.calls.filter(([name]) => name === 'free_year_paper_catalog')).toHaveLength(1);
    expect(provider.unexpected).toEqual([]);
  });
  test('signed-in free year paper starts without a pass on desktop and mobile', async ({ page }) => {
    const provider = await stubPortalProvider(page, name => {
      if (name === 'free_year_paper_catalog') return [release];
      if (name === 'finalize_my_expired_attempts') return 0;
      if (name === 'my_year_paper_attempts') return [];
      if (name === 'start_free_year_paper') return attemptId;
      if (name === 'public_all_india_top_ten') return [];
      if (name === 'my_exam_mock_session' || name === 'my_exam_mock_report') return null;
      if (name === 'read_attempt') return { id: attemptId, title: 'Fictional 2026 Part A paper', status: 'active',
        deadline: new Date(Date.now() + 7200000).toISOString(), serverNow: new Date().toISOString(), score: null, total: null,
        questions: [{ id: '30000000-0000-4000-8000-000000003001', ordinal: 1, kind: 'mcq', topic: 'Observation',
          prompt: 'Fictional year-paper question', options: [{ id: 'A', label: 'First' }, { id: 'B', label: 'Second' }],
          marking: { correct: 3, wrong: -1 }, points: 3, negativePoints: 1, answer: null, media: [] }] };
    });
    await page.goto('/');
    await seedPortalSession(page, actor);
    await page.goto('/papers');
    const card = page.locator('.year-paper-card').filter({ hasText: '2026 paper' });
    await card.getByRole('button', { name: 'Start or resume free paper' }).focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Ready to open UCEED 2026 Part A?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.year-paper-start-facts')).toContainText('57'); await expect(dialog.locator('.year-paper-start-facts')).toContainText('120 min');
    expect(provider.calls.filter(([name]) => name === 'start_free_year_paper')).toHaveLength(0);
    await dialog.getByRole('button', { name: 'Start or resume timed paper' }).click();
    await expect(page).toHaveURL('/attempt/' + attemptId);
    await expect(page.getByText('Fictional year-paper question')).toBeVisible();
    expect(provider.calls.some(([name]) => name === 'start_free_year_paper')).toBe(true);
    expect(provider.calls.some(([name]) => name === 'my_pass' || name === 'prepare_order' || name === 'start_attempt')).toBe(false);
    expect(provider.unexpected).toEqual([]);
  });
  test('cancel and Escape preserve the free paper clock and return focus to its starter', async ({ page }) => {
    const provider = await stubPortalProvider(page, name => {
      if (name === 'free_year_paper_catalog') return [release];
      if (name === 'finalize_my_expired_attempts') return 0;
      if (name === 'my_year_paper_attempts') return [];
      if (name === 'public_all_india_top_ten') return [];
    });
    await page.goto('/');
    await seedPortalSession(page, actor);
    await page.goto('/papers');
    const start = page.locator('.year-paper-card').filter({hasText:'2026 paper'})
      .getByRole('button', {name:'Start or resume free paper'});
    await start.click();
    const dialog = page.getByRole('dialog', {name:'Ready to open UCEED 2026 Part A?'});
    await expect(dialog).toContainText('original deadline');
    await dialog.getByRole('button', {name:'Cancel'}).click();
    await expect(dialog).toHaveCount(0);
    await expect(start).toBeFocused();
    await start.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(start).toBeFocused();
    expect(provider.calls.filter(([name]) => name === 'start_free_year_paper')).toHaveLength(0);
    await page.setViewportSize({width:320,height:850});
    await start.click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.addScriptTag({path:fileURLToPath(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url))});
    expect((await page.evaluate(async () => (await window.axe.run('.year-paper-start-dialog', {
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']},
    })).violations.map(item => item.id)))).toEqual([]);
    expect(provider.unexpected).toEqual([]);
  });
  test('failed release read offers an in-page retry before a free paper can start', async ({ page }) => {
    let reads = 0;
    const provider = await stubPortalProvider(page, name => {
      if (name === 'free_year_paper_catalog') return ++reads === 1 ? {code:'PGRST000',message:'Fictional network failure'} : [release];
      if (name === 'public_all_india_top_ten') return [];
    });
    await page.goto('/papers');
    await expect(page.getByRole('alert')).toContainText('Couldn’t check released papers');
    await expect(page.getByRole('button', {name:'Refresh papers'})).toBeVisible();
    await page.getByRole('button', {name:'Refresh papers'}).click();
    await expect(page.locator('.year-paper-card').filter({hasText:'2026 paper'})).toContainText('Free paper open');
    expect(reads).toBe(2);
    expect(provider.unexpected).toEqual([]);
  });
  test('a lost start reply locks another start until saved attempts are checked', async ({ page }) => {
    let starts = 0, created = false;
    const provider = await stubPortalProvider(page, name => {
      if (name === 'free_year_paper_catalog') return [release];
      if (name === 'finalize_my_expired_attempts') return 0;
      if (name === 'my_year_paper_attempts') return [];
      if (name === 'start_free_year_paper') {starts++;created = true;return {code:'PGRST000',message:'Fictional lost response'};}
      if (name === 'my_attempt_history') return created ? [{id:attemptId,title:'Fictional saved year paper',status:'active'}] : [];
      if (name === 'public_all_india_top_ten') return [];
    });
    await page.goto('/');
    await seedPortalSession(page, actor);
    await page.goto('/papers');
    const card = page.locator('.year-paper-card').filter({hasText:'2026 paper'});
    const start = card.getByRole('button', {name:'Start or resume free paper'});
    await start.click();
    await page.getByRole('dialog', {name:'Ready to open UCEED 2026 Part A?'})
      .getByRole('button', {name:'Start or resume timed paper'}).click();
    await expect(page.getByText('This start may already be saved.')).toBeVisible();
    await expect(start).toBeDisabled();
    await page.getByRole('button', {name:'Check saved attempts'}).click();
    await expect(page.getByRole('link', {name:'Fictional saved year paper'})).toHaveAttribute('href','/attempt/'+attemptId);
    expect(starts).toBe(1);
    expect(provider.unexpected).toEqual([]);
  });
  test('owned paper card links to its saved attempt and latest released report', async ({ page }) => {
    const secondAttempt = '20000000-0000-4000-8000-000000003002';
    const provider = await stubPortalProvider(page, name => {
      if (name === 'free_year_paper_catalog') return [release];
      if (name === 'finalize_my_expired_attempts') return 0;
      if (name === 'my_year_paper_attempts') return [
        {paperId,attemptId,status:'active',startedAt:'2026-11-23T10:00:00Z',resultsPending:false,score:null,total:null},
        {paperId,attemptId:secondAttempt,status:'submitted',startedAt:'2026-11-22T10:00:00Z',resultsPending:false,score:17,total:30},
      ];
      if (name === 'public_all_india_top_ten') return [];
    });
    await page.goto('/');
    await seedPortalSession(page, actor);
    await page.goto('/papers');
    const card = page.locator('.year-paper-card').filter({hasText:'2026 paper'});
    await expect(card.getByRole('link', {name:'Continue saved attempt →'})).toHaveAttribute('href','/attempt/'+attemptId);
    await expect(card).toContainText('Latest result 17 / 30');
    await expect(card.getByRole('link', {name:'Review latest attempt →'})).toHaveAttribute('href','/attempt/'+secondAttempt);
    await expect(card.getByRole('button', {name:'Start or resume free paper'})).toHaveCount(0);
    await page.setViewportSize({width:320,height:850});
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.addScriptTag({path:fileURLToPath(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url))});
    expect((await page.evaluate(async () => (await window.axe.run('.year-papers', {
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']},
    })).violations.map(item=>item.id)))).toEqual([]);
    expect(provider.calls.filter(([name]) => name === 'start_free_year_paper')).toHaveLength(0);
    expect(provider.unexpected).toEqual([]);
  });
  test('a failed owned-history read offers a retry without hiding a released paper', async ({ page }) => {
    let reads = 0;
    const provider = await stubPortalProvider(page, name => {
      if (name === 'free_year_paper_catalog') return [release];
      if (name === 'finalize_my_expired_attempts') return 0;
      if (name === 'my_year_paper_attempts') return ++reads === 1
        ? {code:'PGRST000',message:'Fictional history outage'}
        : [{paperId,attemptId,status:'active',startedAt:'2026-11-23T10:00:00Z',resultsPending:false,score:null,total:null}];
      if (name === 'public_all_india_top_ten') return [];
    });
    await page.goto('/');
    await seedPortalSession(page, actor);
    await page.goto('/papers');
    const card = page.locator('.year-paper-card').filter({hasText:'2026 paper'});
    await expect(card).toContainText('Free paper open');
    await expect(page.getByText('Couldn’t check your saved papers. You can still open a released paper.')).toBeVisible();
    await page.getByRole('button', {name:'Retry saved papers'}).click();
    await expect(card.getByRole('link', {name:'Continue saved attempt →'})).toHaveAttribute('href','/attempt/'+attemptId);
    expect(reads).toBe(2);
    expect(provider.unexpected).toEqual([]);
  });
});

test.describe('signed-out public year-paper catalogue', () => {
  test.use({ baseURL: 'http://127.0.0.1:4798' });
  test('an already open Papers tab shows a newly released paper when refocused', async ({ page }) => {
    const first = {paperId:'10000000-0000-4000-8000-000000003011',exam:'uceed',
      year:2026,sourcePaperId:'uceed-2026',partLabel:'Part A',questionCount:57,durationSeconds:7200};
    const added = {paperId:'10000000-0000-4000-8000-000000003012',exam:'ceed',
      year:2025,sourcePaperId:'ceed-2025',partLabel:'Part A',questionCount:42,durationSeconds:3600};
    let releases = [first];
    const provider = await stubPortalProvider(page, name => name === 'free_year_paper_catalog' ? releases : undefined, project.project_ref);
    await page.goto('/papers');
    await expect(page.getByRole('button', {name:'UCEED 1',exact:true})).toBeVisible();
    releases = [first,added];
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('button', {name:'CEED 1',exact:true})).toBeVisible();
    await page.getByRole('button', {name:'CEED 1',exact:true}).click();
    await expect(page.getByRole('heading', {name:'2025 paper'})).toBeVisible();
    expect(provider.calls.filter(([name]) => name === 'free_year_paper_catalog')).toHaveLength(2);
    expect(provider.unexpected).toEqual([]);
  });
  test('reads released papers with an anonymous client while Google sign-in stays closed', async ({ page }) => {
    const release = {paperId:'10000000-0000-4000-8000-000000003001',exam:'uceed',
      year:2026,sourcePaperId:'uceed-2026',partLabel:'Part A',questionCount:57,durationSeconds:7200};
    const provider = await stubPortalProvider(page, name => name === 'free_year_paper_catalog' ? [release] : undefined, project.project_ref);
    await page.goto('/papers');
    const card = page.locator('.year-paper-card').filter({ hasText: '2026 paper' });
    await expect(card).toContainText('Free paper open');
    await expect(card.getByRole('link', { name: 'Sign in to start free paper' })).toHaveAttribute('href', '/account');
    expect(provider.calls.map(([name]) => name)).toEqual(['free_year_paper_catalog']);
    expect(provider.authCalls).toEqual([]);
    expect(provider.unexpected).toEqual([]);
    await page.goto('/account');
    await expect(page.getByText('Google sign-in is being connected for this new app.', {exact:false})).toBeVisible();
  });
});

test('sign-in-free Papers preview shows saved progress states and opens the demo room', async ({ page }) => {
  await page.goto('/papers-preview');
  await expect(page.getByText('PAPERS PREVIEW')).toBeVisible();
  const card = year => page.locator('.year-paper-card').filter({ hasText: `UCEED ${year} paper` });
  await expect(card(2026)).toContainText('Not attempted yet');
  await expect(card(2025).getByRole('link', { name: 'Continue saved attempt →' })).toHaveAttribute('href', '/portal-preview/paper');
  await expect(card(2024)).toContainText('Latest result 142 / 300');
  await expect(card(2023)).toContainText('Result under review');
  await expect(page.locator('.year-papers-stats')).toContainText('2015–2026');
  await card(2026).getByRole('button', { name: 'Start or resume free paper' }).click();
  await page.getByRole('dialog', { name: 'Ready to open UCEED 2026 Part A?' }).getByRole('button', { name: 'Start or resume timed paper' }).click();
  await expect(page).toHaveURL('/portal-preview/paper');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('the exam room hides site chrome and keeps the clock, theme and navigator in reach', async ({ page }) => {
  await page.goto('/portal-preview/paper');
  const bar = page.locator('.attempt-bar');
  await expect(bar.getByRole('heading', { level: 1, name: 'Visual design paper' })).toBeVisible();
  await expect(bar.getByRole('timer', { name: 'Time remaining' })).toBeVisible();
  await expect(page.locator('header.header')).toBeHidden();
  await expect(page.locator('footer')).toBeHidden();
  await bar.getByRole('switch', { name: 'Dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const box = await bar.boundingBox();
  await page.mouse.wheel(0, 900);
  await expect.poll(async () => (await bar.boundingBox()).y).toBeLessThanOrEqual(Math.max(0, box.y));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('the answer review shows a structured, step-by-step animated solution', async ({ page }) => {
  await page.goto('/portal-preview/report');
  await page.getByRole('button', { name: 'Open answer review' }).click();
  await page.getByRole('button', { name: 'View solution', exact: true }).click();
  const solution = page.locator('.worked-solution');
  await expect(solution.getByRole('heading', { name: 'Worked solution' })).toBeVisible();
  await expect(solution.getByText('Step 1 of 3', { exact: true })).toBeVisible();
  await expect(solution.locator('svg g')).toHaveCount(1);
  await expect(solution.getByRole('heading', { name: 'Common trap' })).toBeVisible();
  await expect(solution.getByRole('heading', { name: 'Faster method' })).toBeVisible();
  await solution.getByRole('button', { name: /The bottom row has four tiles/ }).click();
  await expect(solution.getByText('Step 3 of 3', { exact: true })).toBeVisible();
  await expect(solution.locator('svg > g')).toHaveCount(3);
  await solution.getByRole('button', { name: 'Replay steps' }).click();
  await expect(solution.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(solution.getByText('Step 2 of 3', { exact: true })).toBeVisible({ timeout: 6000 });
  await page.getByRole('button', { name: 'Review question 3, Partial credit' }).click();
  await page.getByRole('button', { name: 'View solution', exact: true }).click();
  const options = page.getByRole('region', { name: 'Option by option' });
  await expect(options.locator('li[data-verdict="correct"]')).toHaveCount(2);
  await expect(options.locator('li[data-verdict="wrong"]')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('an exam with B.Des. and M.Des. papers can be narrowed to one programme', async ({ page }) => {
  await page.goto('/papers-preview?exam=nid');
  await expect(page.getByRole('button', { name: /^NID\b/ })).toHaveAttribute('aria-pressed', 'true');
  const levels = page.getByRole('group', { name: 'Choose a NID programme' });
  await expect(levels.getByRole('button', { name: 'All 6' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.year-paper-card')).toHaveCount(6);
  await levels.getByRole('button', { name: 'M.Des. 2' }).click();
  await expect(page.locator('.year-paper-card')).toHaveCount(2);
  await expect(page.locator('.year-paper-card').first()).toContainText('M.Des. sample paper');
  await expect(page.locator('.year-papers-stats')).toContainText('2018–2025');
  await page.getByRole('button', { name: /^UCEED\b/ }).click();
  await expect(page.getByRole('group', { name: /programme$/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^NID\b/ }).click();
  await expect(page.locator('.year-paper-card')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
