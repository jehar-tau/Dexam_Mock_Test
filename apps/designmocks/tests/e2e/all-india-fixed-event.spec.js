import { expect, test } from '@playwright/test';
import { seedPortalSession, stubPortalProvider } from './portal-fixture.js';

// The production-shaped build releases all-india (see playwright.config.js),
// so this is the student path the live site will show once the flag is on.
test.use({ baseURL: 'http://127.0.0.1:4788' });

const eventId = '10000000-0000-4000-8000-000000002961';
const attemptId = '20000000-0000-4000-8000-000000002961';
const questionId = '30000000-0000-4000-8000-000000002961';
const student = { id: '00000000-0000-4000-8000-000000002961', email: 'fictional-all-india-student@example.invalid' };
const hour = 3600000;

function schedule(now, overrides = {}) {
  return {
    id: eventId, exam: 'nid', title: 'Fictional NID All India Mock', startsAt: new Date(now + 2 * 24 * hour).toISOString(),
    endsAt: new Date(now + 5 * 24 * hour).toISOString(), lastStartAt: new Date(now + 5 * 24 * hour - 3.2 * hour).toISOString(),
    reviewEndsAt: new Date(now + 9 * 24 * hour).toISOString(), durationSeconds: 10800, uploadGraceSeconds: 600,
    entry: 'free', seatCap: 150, seatsLeft: 37, ...overrides,
  };
}

function catalogueEvent(now, overrides = {}) {
  return { ...schedule(now), state: 'scheduled', qualityHeld: false, attemptId: null, result: null, registered: false, ...overrides };
}

for (const [device, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 360, height: 760 }]]) {
  test(`a signed-out visitor sees seats left on the All India and sign-up pages (${device})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const provider = await stubPortalProvider(page, name => {
      if (name === 'public_all_india_upcoming') return [schedule(Date.now())];
      if (name === 'public_all_india_top_ten') return [];
      if (name === 'free_signup_notice') return null;
      return undefined;
    });
    await page.goto('/dashboard/all-india');
    const upcoming = page.getByRole('region', { name: 'Upcoming All India mocks' });
    await expect(upcoming.getByText('Fictional NID All India Mock', { exact: true })).toBeVisible();
    await expect(upcoming.getByText('37 of 150 seats left', { exact: true })).toBeVisible();
    await expect(upcoming.getByText(/^Opens in 2 days/)).toBeVisible();
    await expect(upcoming.getByText(/180 minutes · free entry/)).toBeVisible();
    await page.locator('#main').getByRole('link', { name: 'Student sign in', exact: true }).click();
    await expect(page).toHaveURL('/account?for=all-india');
    await expect(page.getByRole('region', { name: 'Upcoming All India mocks' }).getByText('37 of 150 seats left', { exact: true })).toBeVisible();
    expect(provider.calls.some(([name]) => ['all_india_event_catalog', 'register_all_india_event'].includes(name))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}

test('a student reserves a seat before the window and sees the countdown', async ({ page }) => {
  const now = Date.now();
  let registered = false;
  const provider = await stubPortalProvider(page, (name, input) => {
    if (name === 'all_india_event_catalog') return [catalogueEvent(now, registered ? { registered: true, seatsLeft: 36 } : {})];
    if (name === 'register_all_india_event') {
      expect(input).toEqual({ p_event_id: eventId });
      registered = true;
      return { eventId, registered: true, seatCap: 150, seatsLeft: 36 };
    }
    if (name === 'public_all_india_top_ten') return [];
    return undefined;
  });
  await page.goto('/account');
  await seedPortalSession(page, student);
  await page.goto('/dashboard/all-india');
  const card = page.locator('.all-india-event').filter({ hasText: 'Fictional NID All India Mock' });
  await expect(card.getByText(/^Opens in 2 days/)).toBeVisible();
  await expect(card.getByText('37 of 150 seats left', { exact: true })).toBeVisible();
  await expect(card.getByText('Free entry', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Start once' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Reserve my seat', exact: true }).click();
  await expect(card.getByText('Your seat is reserved', { exact: true })).toBeVisible();
  await expect(card.getByText('36 of 150 seats left', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Reserve my seat' })).toHaveCount(0);
  expect(provider.calls.filter(([name]) => name === 'register_all_india_event')).toHaveLength(1);
  expect(provider.unexpected).toEqual([]);
});

test('a full event explains that every seat is taken', async ({ page }) => {
  const now = Date.now();
  const provider = await stubPortalProvider(page, name => {
    if (name === 'all_india_event_catalog') return [catalogueEvent(now, {
      state: 'open', startsAt: new Date(now - hour).toISOString(), seatsLeft: 0 })];
    if (name === 'public_all_india_top_ten') return [];
    return undefined;
  });
  await page.goto('/account');
  await seedPortalSession(page, student);
  await page.goto('/dashboard/all-india');
  const card = page.locator('.all-india-event').filter({ hasText: 'Fictional NID All India Mock' });
  await expect(card.getByText('All 150 seats are taken', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'All seats taken', exact: true })).toBeDisabled();
  expect(provider.calls.some(([name]) => ['start_all_india_attempt', 'register_all_india_event'].includes(name))).toBe(false);
});

test('a registered student starts once, submits, waits for results, then sees rank and the top ten', async ({ page }) => {
  const now = Date.now();
  let phase = 'open', submitted = false;
  const attempt = () => ({
    id: attemptId, title: 'Fictional NID All India Mock', status: submitted ? 'submitted' : 'active',
    deadline: new Date(Date.now() + 3 * hour).toISOString(), serverNow: new Date().toISOString(),
    reviewEndsAt: new Date(now + 9 * 24 * hour).toISOString(), resultsPending: submitted, score: null, total: null,
    drawingUploadTasks: [],
    questions: submitted ? [] : [{ id: questionId, ordinal: 1, kind: 'mcq', topic: 'visual-reasoning',
      prompt: 'Fictional original All India question.', options: [{ id: 'A', label: 'First' }, { id: 'B', label: 'Second' }],
      marking: { correct: 4, wrong: -1 }, points: 4, negativePoints: 1, answer: null, answerRevision: 0, media: [] }],
  });
  const provider = await stubPortalProvider(page, name => {
    if (name === 'all_india_event_catalog') {
      if (phase === 'open') return [catalogueEvent(now, { state: 'open', startsAt: new Date(now - hour).toISOString(), registered: true, seatsLeft: 0 })];
      return [catalogueEvent(now, { state: 'released', registered: true, seatsLeft: 0, attemptId,
        result: { score: 82, total: 100, rank: 3, cohortSize: 148 } })];
    }
    if (name === 'start_all_india_attempt') return attemptId;
    if (name === 'read_attempt') return attempt();
    if (name === 'submit_attempt') { submitted = true; return attempt(); }
    if (name === 'my_attempt_history') return [];
    if (name === 'public_all_india_top_ten') return phase === 'open' ? [] : [{ eventId, exam: 'nid', title: 'Fictional NID All India Mock',
      releasedAt: new Date().toISOString(), sharingVersion: 1, topTen: [
        { rank: 1, alias: 'Candidate-A1B2C3D4E5', score: 91, total: 100 }, { rank: 2, alias: 'Candidate-F6A7B8C9D0', score: 88, total: 100 }] }];
    return undefined;
  });
  await page.goto('/account');
  await seedPortalSession(page, student);
  await page.goto('/dashboard/all-india');
  const card = page.locator('.all-india-event').filter({ hasText: 'Fictional NID All India Mock' });
  await expect(card.getByText('Your seat is reserved', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Start once', exact: true }).click();
  const ready = page.getByRole('dialog', { name: 'Ready to begin Fictional NID All India Mock?' });
  await expect(ready.getByText('180 minutes for the exam, plus 10 minutes for drawing uploads.')).toBeVisible();
  await ready.getByRole('button', { name: 'Begin timed attempt', exact: true }).click();
  await expect(page).toHaveURL('/attempt/' + attemptId);
  await expect(page.getByText('Fictional original All India question.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Submit attempt', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Submit/ }).click();
  await expect(page.getByRole('heading', { name: /Your work is saved/ })).toBeVisible();
  await expect(page.getByText(/Marks, topic feedback, answer keys and ranks stay private/)).toBeVisible();
  expect(provider.calls.filter(([name]) => name === 'start_all_india_attempt')).toHaveLength(1);

  phase = 'released';
  await page.goto('/dashboard/all-india');
  await expect(card.getByText('Rank 3 of 148 · 82/100 marks', { exact: true })).toBeVisible();
  await expect(card.getByRole('link', { name: 'View attempt', exact: true })).toHaveAttribute('href', '/attempt/' + attemptId);
  const board = page.getByRole('region', { name: 'All India top ten' });
  await expect(board.getByText('Candidate-A1B2C3D4E5', { exact: true })).toBeVisible();
  await expect(board.getByText('91/100', { exact: true })).toBeVisible();
  expect(provider.unexpected).toEqual([]);
});
