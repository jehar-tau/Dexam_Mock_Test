import {expect, test} from '@playwright/test';
import {seedPortalSession, stubPortalProvider} from './portal-fixture.js';

test.use({baseURL: 'http://127.0.0.1:4599'});

test('a revised year paper opens the original result and gives new attempts the cropped figure', async ({page}) => {
  const student = {id: '00000000-0000-4000-8000-000000009810', email: 'paper-revision@example.invalid'};
  const paperId = '10000000-0000-4000-8000-000000009810';
  const questionId = '30000000-0000-4000-8000-000000009810';
  const original = '20000000-0000-4000-8000-000000009810';
  const revised = '20000000-0000-4000-8000-000000009811';
  const release = {paperId, exam:'uceed', year:2026, sourcePaperId:'uceed-2026',
    partLabel:'Part A', questionCount:1, durationSeconds:900};
  const mediaRequests = [];

  function snapshot(id) {
    const submitted = id === original;
    const points = submitted ? 3 : 4;
    return {id, title:'Fictional UCEED paper', status:submitted ? 'submitted' : 'active',
      deadline:new Date(Date.now() + 900000).toISOString(), serverNow:new Date().toISOString(),
      score:submitted ? 3 : null, total:points, resultsPending:false,
      questions:[{id:questionId, ordinal:1, kind:'mcq', topic:'observation',
        prompt:'How many circles are shown?', options:[{key:'A',text:'One'}, {key:'B',text:'Two'}],
        marking:{correct:points,wrong:0}, points, negativePoints:0, answer:submitted ? 'A' : null,
        media:[{alt:'Circle diagram',sha256:(submitted ? 'a' : 'b').repeat(64)}],
        ...(submitted ? {outcome:'correct',awarded:3,correctKey:{correctOption:'A'},
          explanation:'The original sheet shows one complete circle.'} : {})}]};
  }
  await stubPortalProvider(page, (name, input) => {
    if (name === 'free_year_paper_catalog') return [release];
    if (name === 'my_year_paper_attempts') return [{paperId,attemptId:original,status:'submitted',
      startedAt:'2026-11-10T00:00:00Z',resultsPending:false,score:3,total:3}];
    if (name === 'finalize_my_expired_attempts') return 0;
    if (name === 'public_all_india_top_ten') return [];
    if (name === 'my_exam_mock_session' || name === 'my_exam_mock_report') return null;
    if (name === 'start_free_year_paper') {
      expect(input.p_paper_id).toBe(paperId);
      return revised;
    }
    if (name === 'read_attempt') {
      expect([original,revised]).toContain(input.p_id);
      return snapshot(input.p_id);
    }
    if (name === 'attempt-media') {
      expect([original,revised]).toContain(input.attemptId);
      mediaRequests.push(input.attemptId);
      const height = input.attemptId === original ? 180 : 60;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="${height}"><circle cx="40" cy="24" r="14"/></svg>`;
      return {media:{[questionId]:[{url:'data:image/svg+xml,' + encodeURIComponent(svg)}]}};
    }
  });

  await page.goto('/');
  await seedPortalSession(page, student);
  await page.goto('/papers/uceed');
  const card = page.locator('.year-paper-card').filter({hasText:'2026 paper'});
  await expect(card).toContainText('Latest result 3 / 3');
  await card.getByRole('link',{name:'Review latest attempt →'}).click();
  await expect(page).toHaveURL('/attempt/' + original);
  await page.getByRole('button',{name:'Open answer review'}).click();
  const figure = page.getByRole('img',{name:'Circle diagram',exact:true});
  await expect.poll(() => figure.evaluate(img => img.naturalHeight)).toBe(180);
  await page.getByRole('button',{name:'View solution',exact:true}).click();
  await expect(page.getByText('The original sheet shows one complete circle.',{exact:true})).toBeVisible();

  await page.goBack();
  await card.getByRole('button',{name:'Start or resume free paper'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Start or resume timed paper'}).click();
  await expect(page).toHaveURL('/attempt/' + revised);
  await expect(page.getByText('How many circles are shown?',{exact:true})).toBeVisible();
  await expect.poll(() => figure.evaluate(img => img.naturalHeight)).toBe(60);
  await expect(page.getByText('The original sheet shows one complete circle.',{exact:true})).toHaveCount(0);
  expect(mediaRequests).toContain(original);
  expect(mediaRequests).toContain(revised);
});
