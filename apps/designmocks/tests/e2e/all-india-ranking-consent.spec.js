import { expect, test } from '@playwright/test';
import { portalFixtureURL, seedPortalSession, stubPortalProvider } from './portal-fixture.js';

test.use({ baseURL: portalFixtureURL });

const actor = { id: '00000000-0000-4000-8000-000000001901', email: 'fictional-ranking-candidate@example.invalid' };
const other = { id: '00000000-0000-4000-8000-000000001902', email: 'fictional-other-candidate@example.invalid' };
const eventId = '10000000-0000-4000-8000-000000001901';
const publicationId = '30000000-0000-4000-8000-000000001901';
const alias = 'Candidate-ABCDEF1234';
const api = 'https://dmocks-portal-fixture.supabase.co';
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

async function notify(page, user) {
  await seedPortalSession(page, user);
  await page.evaluate(() => {
    const key = 'sb-dmocks-portal-fixture-auth-token';
    const channel = new BroadcastChannel(key);
    channel.postMessage({ event: 'SIGNED_IN', session: JSON.parse(localStorage.getItem(key)) });
    channel.close();
  });
}

async function fixture(page, { released = true, sharing = { publicationId, revision: 0, shared: false, alias }, identity = actor.id } = {}) {
  const state = { writes: [], currentActor: identity, responseHold: null, publicRows: [] };
  await stubPortalProvider(page, (name, input) => {
    if (name === 'public_all_india_top_ten') return state.publicRows;
    if (name === 'all_india_event_catalog') {
      return [{
        id: eventId, exam: 'uceed', title: 'Fictional released UCEED event', state: released ? 'released' : 'review',
        startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-01T01:00:00Z', lastStartAt: '2026-10-01T00:45:00Z',
        reviewEndsAt: '2026-10-02T00:00:00Z', durationSeconds: 3600, uploadGraceSeconds: 0,
        qualityHeld: false, attemptId: '20000000-0000-4000-8000-000000001901',
        result: released ? { rank: 4, cohortSize: 48, score: 27, total: 30, ...(sharing == null ? {} : { sharing }) } : null,
      }];
    }
    if (name === 'my_attempt_history') return [];
    if (name === 'set_all_india_result_sharing') {
      state.writes.push({ actor: state.currentActor, input });
      return undefined;
    }
    if (name === 'start_all_india_attempt') return undefined;
    return undefined;
  });
  await page.route(`${api}/rest/v1/rpc/set_all_india_result_sharing`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ headers, status: 204 });
    const input = route.request().postDataJSON();
    const token = route.request().headers().authorization.split(' ')[1];
    const requestActor = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub;
    state.writes.push({ actor: requestActor, input });
    if (state.responseHold) await state.responseHold.promise;
    const responseActor = state.currentActor;
    return route.fulfill({ headers, json: { publicationId, revision: input.p_expected_revision + 1, shared: input.p_shared, alias }, status: 200 })
      .catch(() => {});
  });
  await page.goto('/account');
  await seedPortalSession(page, actor);
  await page.goto('/dashboard/all-india');
  return state;
}

test('released personal top ten requires an explicit opt-in and can be withdrawn', async ({ page }) => {
  const state = await fixture(page);
  const on = page.getByRole('button', { name: 'Share on public results', exact: true });
  await expect(on).toBeVisible();
  await expect(page.getByText(/generated alias, rank and marks may appear on the public site/i)).toBeVisible();
  expect(state.writes).toEqual([]);
  await on.press('Enter');
  await expect(page.getByRole('status')).toContainText('Public sharing is on.');
  expect(state.writes).toEqual([{ actor: actor.id, input: { p_event_id: eventId, p_publication_id: publicationId, p_expected_revision: 0, p_shared: true } }]);
  await expect(page.getByRole('button', { name: 'Stop public sharing', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop public sharing', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Public sharing is off.');
  await expect(page.getByText(/Rank 4 of 48 · 27\/30 marks/)).toBeVisible();
  expect(state.writes[1]).toEqual({ actor: actor.id, input: { p_event_id: eventId, p_publication_id: publicationId, p_expected_revision: 1, p_shared: false } });
});

test('missing consent metadata exposes no publication control', async ({ page }) => {
  await fixture(page, { sharing: null });
  await expect(page.getByRole('button', { name: /public results/i })).toHaveCount(0);
});

test('unreleased results expose no publication control', async ({ page }) => {
  await fixture(page, { released: false });
  await expect(page.getByRole('button', { name: /public results/i })).toHaveCount(0);
});

test('an in-flight sharing reply after account switch is discarded', async ({ page }) => {
  const state = await fixture(page);
  const held = deferred();
  state.responseHold = held;
  await page.getByRole('button', { name: 'Share on public results', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  state.currentActor = other.id;
  await notify(page, other);
  held.resolve();
  await expect(page.getByRole('alert')).toContainText('Mock access');
  await expect(page.getByRole('button', { name: 'Stop public sharing', exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].actor).toBe(actor.id);
});
