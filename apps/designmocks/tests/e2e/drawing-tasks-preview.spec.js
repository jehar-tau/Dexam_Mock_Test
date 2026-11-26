import { test, expect } from '@playwright/test';

test('drawing tasks preview shows criteria, the upload grace clock and every estimate state', async ({ page }) => {
  await page.goto('/drawing-tasks-preview');
  await expect(page.getByText('DRAWING TASKS PREVIEW')).toBeVisible();
  const criteria = page.locator('.drawing-preview-attempt .drawing-criteria');
  await expect(criteria.getByRole('listitem')).toHaveCount(7);
  await expect(criteria).toContainText('the marks are split equally');
  await expect(page.getByRole('heading', { name: 'Time’s up. Upload your drawings.' })).toBeVisible();
  await expect(page.getByRole('timer', { name: 'Upload time remaining' })).toContainText(/\d:\d\d/);

  const estimate = page.locator('.drawing-estimate');
  await expect(estimate).toContainText('AI estimate · not an official score');
  await expect(estimate.locator('.drawing-estimate-total')).toHaveText('13/20');
  await expect(estimate.locator('.drawing-scores li')).toHaveCount(4);
  await expect(page.getByRole('img', { name: 'Your drawing, page 2' })).toBeVisible();

  await page.getByRole('button', { name: 'Checked by DMocks' }).click();
  await expect(estimate.locator('.drawing-estimate-total')).toHaveText('14/20');
  await expect(estimate).toContainText('the AI estimate was 13/20');

  await page.getByRole('button', { name: 'Flagged' }).click();
  await expect(estimate.locator('.drawing-estimate-total')).toHaveText('0/20');
  await expect(estimate.getByRole('list', { name: 'Things the estimate noticed' }).getByRole('listitem')).toHaveCount(2);
  await expect(estimate.locator('.drawing-scores')).toHaveCount(0);

  await page.getByRole('button', { name: 'Unavailable' }).click();
  await expect(estimate).toContainText('Score unavailable.');
  await estimate.getByRole('button', { name: 'Try re-evaluating' }).click();
  await expect(estimate.getByRole('status')).toContainText('Evaluating your drawing');

  await page.getByRole('button', { name: 'Not attempted' }).click();
  await expect(estimate).toContainText('No photo was uploaded for this task, so it scores 0.');
  await expect(page.getByText('No photo uploaded.')).toBeVisible();
  // Before a score exists, the criteria sit beside the estimate instead.
  await expect(page.locator('.drawing-task-side .drawing-criteria')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
