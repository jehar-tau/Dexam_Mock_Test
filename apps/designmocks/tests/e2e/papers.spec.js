import { test, expect } from '@playwright/test';

for (const exam of ['UCEED', 'CEED', 'NIFT', 'NID']) {
  test(`year-wise Papers shows real ${exam} source sets on desktop and mobile`, async ({ page }) => {
    await page.goto('/papers');
    await expect(page.getByRole('heading', { name: 'Explore the papers.' })).toBeVisible();
    await page.getByRole('button', { name: new RegExp(`^${exam}\\b`) }).click();
    await expect(page.getByRole('heading', { name: exam, exact: true })).toBeVisible();
    await expect(page.locator('.year-paper-card').first()).toBeVisible();
    await expect(page.locator('.year-paper-card').first()).toContainText('In preparation');
    await expect(page.locator('.year-paper-card').first()).toContainText('questions in this set');
    await expect(page.getByRole('button', { name: /Start paper|Take paper/ })).toHaveCount(0);
  });
}

test('same-year CEED papers remain separate and an unreleased paper cannot start', async ({ page }) => {
  await page.goto('/papers');
  await page.getByRole('button', { name: /^CEED\b/ }).click();
  await expect(page.getByRole('heading', { name: '2016 · Paper 1' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '2016 · Paper 2' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Take the free sample' })).toHaveAttribute('href', '/sample');
});
