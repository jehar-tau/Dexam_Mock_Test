import { test, expect } from '@playwright/test';
import { seedPortalSession, stubPortalProvider } from './portal-fixture.js';

test.use({ baseURL: 'http://127.0.0.1:4788' });

const actor = { id: '00000000-0000-4000-8000-000000009211', email: 'fictional-student-release@example.invalid' };

test('explicit student releases open only their selected routes and navigation', async ({ page }) => {
  const provider = await stubPortalProvider(page, () => []);
  await page.goto('/');
  await seedPortalSession(page, actor);
  await page.goto('/dashboard/all-india');
  await expect(page.getByRole('heading', { name: 'One paper. One attempt.' })).toBeVisible();
  const menu = page.getByRole('button', { name: 'Student menu' });
  if (await menu.isVisible()) await menu.click();
  const nav = page.getByRole('navigation', { name: 'Student workspace' });
  await expect(nav.getByRole('link', { name: 'All India mocks' })).toHaveAttribute('href', '/dashboard/all-india');
  await expect(nav.getByRole('link', { name: 'Topic practice' })).toHaveAttribute('href', '/dashboard/practice');
  await expect(nav.getByRole('link', { name: 'Released papers' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Papers', exact: true })).toHaveAttribute('href', '/papers');
  await expect(nav.getByRole('link', { name: 'Community' })).toHaveCount(0);
  await page.goto('/dashboard/practice');
  await expect(page.getByRole('heading', { name: /Build a topic/ })).toBeVisible();
  await page.goto('/dashboard/community');
  await expect(page.getByText('COMING LATER', { exact: true })).toBeVisible();
  expect(provider.unexpected).toEqual([]);
});
