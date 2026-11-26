import { expect, test } from '@playwright/test';

test('the student desk leads to each mock mode without presenting fictional papers as released', async ({ page }) => {
  await page.goto('/portal-preview');
  const desk = page.locator('.overview-desk');
  await expect(desk.getByRole('heading', { name: 'What would you like to work on?' })).toBeVisible();
  await expect(desk.getByRole('heading', { name: 'A paper is in progress' })).toBeVisible();
  await expect(desk.getByRole('link', { name: 'Resume paper' })).toHaveAttribute('href', '/portal-preview/paper');
  const yearPapers = desk.locator('.overview-year-papers');
  await expect(yearPapers).toContainText('4 of 17 released papers attempted');
  await expect(yearPapers.getByRole('link', { name: 'Continue saved attempt →' })).toHaveAttribute('href', '/portal-preview/paper');
  await expect(yearPapers.getByRole('heading', { name: 'UCEED 2026 paper' })).toBeVisible();
  await expect(yearPapers.getByRole('link', { name: 'Open in Papers' })).toHaveAttribute('href', '/papers-preview?exam=uceed');
  await expect(desk.getByRole('link', { name: /Exam-wise mocks/ })).toHaveAttribute('href', '/exam-mocks-preview');
  await expect(desk.getByRole('link', { name: /All India mocks/ })).toHaveAttribute('href', '/all-india-preview');
  await expect(desk.getByRole('link', { name: /Topic-wise practice/ })).toHaveAttribute('href', '/topic-practice-preview');
  await expect(desk.getByRole('link', { name: /Year-wise Papers/ })).toHaveAttribute('href', '/papers-preview');
  await expect(desk.getByRole('link', { name: 'Practise the recommended topic →', exact: true })).toHaveAttribute('href', '/topic-practice-preview?topic=Visual+hierarchy');
  await expect(desk.getByText('No exam-wise mock has been released yet')).toBeVisible();
  await expect(desk.locator('.paper-list article')).toHaveCount(0);
  await expect(desk.getByRole('link', { name: 'Try an example paper' })).toHaveAttribute('href', '/portal-preview/paper');
  await expect(page.getByText('fictional account for exploring the interface')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await yearPapers.getByRole('link', { name: 'Open in Papers' }).click();
  await expect(page.getByRole('heading', { name: 'Explore the papers.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^UCEED\b/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.year-paper-card').filter({ hasText: 'UCEED 2026 paper' })).toContainText('Not attempted yet');
});
