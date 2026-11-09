import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
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

async function expectAccessible(page, selector) {
  await page.addScriptTag({ path: fileURLToPath(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url)) });
  const violations = await page.evaluate(async scope => {
    const result = await window.axe.run(scope, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }));
  }, selector);
  expect(violations).toEqual([]);
}

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
  const state = { writes: [], currentActor: identity, responseHold: null, responseMode: 'success', serverShared: false, catalogReads: 0, finishedWrites: 0 };
  await stubPortalProvider(page, (name) => {
    if (name === 'public_all_india_top_ten') return state.publicRows;
    if (name === 'all_india_event_catalog') {
      state.catalogReads++;
      const accountHasScope = state.currentActor === actor.id;
      const currentSharing = accountHasScope && state.serverShared
        ? { publicationId, revision: 1, shared: true, alias }
        : accountHasScope ? sharing : null;
      return [{
        id: eventId, exam: 'uceed', title: accountHasScope ? 'Fictional released UCEED event' : 'Other account private result', state: released ? 'released' : 'review',
        startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-01T01:00:00Z', lastStartAt: '2026-10-01T00:45:00Z',
        reviewEndsAt: '2026-10-02T00:00:00Z', durationSeconds: 3600, uploadGraceSeconds: 0,
        qualityHeld: false, attemptId: '20000000-0000-4000-8000-000000001901',
        result: released ? { rank: 4, cohortSize: 48, score: 27, total: 30, ...(currentSharing == null ? {} : { sharing: currentSharing }) } : null,
      }];
    }
    if (name === 'my_attempt_history') return [];
    return undefined;
  });
  await page.route(`${api}/rest/v1/rpc/set_all_india_result_sharing`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ headers, status: 204 });
    const input = route.request().postDataJSON();
    const token = route.request().headers().authorization.split(' ')[1];
    const requestActor = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub;
    state.writes.push({ actor: requestActor, input });
    state.serverShared = input.p_shared;
    if (state.responseHold) await state.responseHold.promise;
    try {
      if (state.responseMode === 'error') await route.fulfill({ headers, status: 500, body: 'fixture transport failure' });
      else if (state.responseMode === 'malformed') await route.fulfill({ headers, json: { publicationId: 'invalid', revision: -1, shared: !input.p_shared, alias: 'not-an-alias' }, status: 200 });
      else await route.fulfill({ headers, json: { publicationId, revision: input.p_expected_revision + 1, shared: input.p_shared, alias }, status: 200 });
    } catch (error) {
      if (!state.responseHold) throw error;
    } finally {
      state.finishedWrites++;
    }
  });
  await page.goto('/account');
  await seedPortalSession(page, actor);
  await page.goto('/dashboard/all-india');
  return state;
}

test('released personal top ten requires an explicit opt-in and can be withdrawn', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const state = await fixture(page);
  const on = page.getByRole('button', { name: 'Share on public results', exact: true });
  await expect(on).toBeVisible();
  await expect(on).toHaveAccessibleDescription(/generated alias, rank and marks may appear on the public site/i);
  await expectAccessible(page, '.all-india-list');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
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
  await expect(page.getByText(/Rank 4 of 48 · 27\/30 marks/)).toBeVisible();
  await expect(page.getByRole('button', { name: /public results/i })).toHaveCount(0);
});

test('unreleased results expose no publication control', async ({ page }) => {
  await fixture(page, { released: false });
  await expect(page.getByText(/Results under review until/)).toBeVisible();
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
  await expect.poll(() => state.catalogReads).toBeGreaterThan(1);
  await expect(page.getByRole('heading', { name: 'Other account private result', exact: true })).toBeVisible();
  held.resolve();
  await expect.poll(() => state.finishedWrites).toBe(1);
  await expect(page.getByText('Public sharing is on.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Public sharing is off.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /public results/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Stop public sharing', exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].actor).toBe(actor.id);
});

for (const responseMode of ['error', 'malformed']) {
  test(`an unconfirmed sharing write stays blocked until refresh discovers server state (${responseMode})`, async ({ page }) => {
    const state = await fixture(page);
    state.responseMode = responseMode;
    const share = page.getByRole('button', { name: 'Share on public results', exact: true });
    await share.click();
    await expect(page.getByRole('alert')).toHaveText('Couldn’t confirm public sharing. Refresh All India mocks to check your current choice.');
    await expect(share).toBeDisabled();
    expect(state.writes).toHaveLength(1);
    await page.getByRole('button', { name: 'Refresh All India mocks', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stop public sharing', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
  });
}

test('homepage publishes only current-version redacted ranking rows and reflows at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const state = {
    publicRows: [
      {
        eventId: '40000000-0000-4000-8000-000000001901', exam: 'uceed', title: 'Legacy fictional event',
        releasedAt: '2026-10-05T12:00:00Z', topTen: [{ rank: 1, alias: 'Candidate-AAAAAA', score: 30, total: 30 }],
      },
      {
        eventId: '40000000-0000-4000-8000-000000001902', exam: 'nid', title: 'Published fictional event',
        releasedAt: '2026-10-06T12:00:00Z', sharingVersion: 1,
        topTen: [
          { rank: 2, alias: 'Candidate-000006', score: 28, total: 30 },
          { rank: 7, alias: 'Candidate-ABCDEF1234', score: 25, total: 30 },
        ],
      },
    ],
  };
  await stubPortalProvider(page, (name) => name === 'public_all_india_top_ten' ? state.publicRows : undefined);
  await page.goto('/');
  const feed = page.locator('.all-india-highlights');
  await expect(feed.getByRole('heading', { name: /NID · Published fictional event/i })).toBeVisible();
  await expect(feed.getByText('Candidate-000006', { exact: true })).toBeVisible();
  await expect(feed.getByText('Candidate-ABCDEF1234', { exact: true })).toBeVisible();
  await expect(feed.getByText(/Candidate-AAAAAA|Legacy fictional event/)).toHaveCount(0);
  await expect(feed.getByText('#2', { exact: true })).toBeVisible();
  await expect(feed.getByText('28/30')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expectAccessible(page, '.all-india-highlights');
});
