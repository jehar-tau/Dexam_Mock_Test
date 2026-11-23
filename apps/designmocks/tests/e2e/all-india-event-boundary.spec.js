import { expect, test } from '@playwright/test';
import { portalFixtureURL, seedPortalSession, stubPortalProvider } from './portal-fixture.js';

test.use({ baseURL: process.env.DMOCKS_EVENT_TEST_URL ?? portalFixtureURL });

for (const [device, viewport] of [
  ['desktop', { width: 1280, height: 800 }],
  ['mobile', { width: 320, height: 740 }],
]) {
  test(`an open All India start closes on ${device} at its cutoff without a reload`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const actor = { id: '00000000-0000-4000-8000-000000002101', email: 'fictional-event-boundary@example.invalid' };
    let starts = 0;
    await stubPortalProvider(page, name => {
      if (name === 'public_all_india_top_ten') return [];
      if (name === 'all_india_event_catalog') {
        const now = Date.now();
        return [{
        id: '10000000-0000-4000-8000-000000002101', exam: 'uceed', title: 'Fictional timed event',
        state: 'open', startsAt: new Date(now - 60000).toISOString(),
        lastStartAt: new Date(now + 5000).toISOString(), endsAt: new Date(now + 65000).toISOString(),
        reviewEndsAt: new Date(now + 86400000).toISOString(), durationSeconds: 60,
        uploadGraceSeconds: 0, qualityHeld: false, attemptId: null, result: null,
        }];
      }
      if (name === 'start_all_india_attempt') { starts++; return '20000000-0000-4000-8000-000000002101'; }
      return undefined;
    });
    await page.goto('/account');
    await seedPortalSession(page, actor);
    await page.goto('/dashboard/all-india');
    const start = page.getByRole('button', { name: 'Start once', exact: true });
    await expect(start).toBeEnabled();
    await start.click();
    const ready = page.getByRole('dialog', { name: 'Ready to begin Fictional timed event?' });
    await expect(ready).toBeVisible();
    expect(starts).toBe(0);
    await expect(ready.getByRole('button', { name: 'Begin timed attempt' })).toBeDisabled({ timeout: 8000 });
    await ready.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Refresh event status', exact: true })).toBeDisabled({ timeout: 8000 });
    await expect(page.getByText('The event window has changed. Refresh All India mocks to check its current status.')).toBeVisible();
    expect(starts).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}
