import { expect, test } from '@playwright/test';

test('the student desk leads to each mock mode without presenting fictional papers as released', async ({ page }) => {
  await page.goto('/portal-preview');
  const desk = page.locator('.overview-desk');
  await expect(desk.getByRole('heading', { name: 'What would you like to work on?' })).toBeVisible();
  await expect(desk.getByRole('link', { name: /Exam-wise mocks/ })).toHaveAttribute('href', '/exam-mocks-preview');
  await expect(desk.getByRole('link', { name: /All India mocks/ })).toHaveAttribute('href', '/all-india-preview');
  await expect(desk.getByRole('link', { name: /Topic-wise practice/ })).toHaveAttribute('href', '/topic-practice-preview');
  await expect(desk.getByText('No papers have been released yet')).toBeVisible();
  await expect(desk.locator('.paper-list article')).toHaveCount(0);
  await expect(desk.getByRole('link', { name: 'Try an example paper' })).toHaveAttribute('href', '/portal-preview/paper');
  await expect(page.getByText('fictional account for exploring the interface')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});
