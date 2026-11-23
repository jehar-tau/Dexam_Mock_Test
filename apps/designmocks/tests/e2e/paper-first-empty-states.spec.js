import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { portalFixtureURL, seedPortalSession, stubPortalProvider } from './portal-fixture.js';

test.use({ baseURL: portalFixtureURL });
const student = { id: '00000000-0000-4000-8000-000000003901', email: 'paper-first-empty@example.invalid' };

async function openEmptyCatalogue(page, path) {
  const provider = await stubPortalProvider(page, name => {
    if (['exam_mock_catalog', 'all_india_event_catalog', 'topic_catalog',
      'public_all_india_top_ten'].includes(name)) return [];
  });
  await page.goto('/account');
  await seedPortalSession(page, student);
  await page.goto(path);
  return provider;
}

test('exam-wise mocks explain the release order without inventing a paper', async ({ page }) => {
  const provider = await openEmptyCatalogue(page, '/dashboard/mocks');
  await expect(page.getByRole('heading', { name: 'No mock released yet' })).toBeVisible();
  await expect(page.getByText(/after their All India event ends and results are released/)).toBeVisible();
  await page.getByText('How are mock papers assembled?').click();
  await expect(page.getByText(/Fresh, reviewed parallel questions appear first in an All India event/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start mock' })).toHaveCount(0);
  expect(provider.calls.some(([name]) => name === 'start_exam_mock')).toBe(false);
  expect(provider.unexpected).toEqual([]);
});

test('topic practice explains its released-paper source at 320px', async ({ page }) => {
  const provider = await openEmptyCatalogue(page, '/dashboard/practice');
  await page.setViewportSize({ width: 320, height: 850 });
  await expect(page.getByText(/No practice topics are released yet/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore Papers →' })).toHaveAttribute('href', '/papers');
  await expect(page.getByRole('button', { name: 'Start practice' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.addScriptTag({ path: fileURLToPath(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url)) });
  expect((await page.evaluate(async () => (await window.axe.run('.topic-practice', {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })).violations.map(item => item.id))).toEqual([]);
  expect(provider.calls.some(([name]) => name === 'start_topic_practice')).toBe(false);
  expect(provider.unexpected).toEqual([]);
});

test('All India mocks show an empty event schedule without a start action', async ({ page }) => {
  const provider = await openEmptyCatalogue(page, '/dashboard/all-india');
  await expect(page.getByText(/No All India mock is scheduled yet/)).toBeVisible();
  await expect(page.getByText(/Fresh, reviewed questions will form one common paper for everyone/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start once' })).toHaveCount(0);
  expect(provider.calls.some(([name]) => name === 'start_all_india_attempt')).toBe(false);
  expect(provider.unexpected).toEqual([]);
});
