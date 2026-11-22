import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

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
