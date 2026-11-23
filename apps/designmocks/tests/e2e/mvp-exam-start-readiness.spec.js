import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { portalFixtureURL, seedPortalSession, stubPortalProvider } from './portal-fixture.js';

test.use({ baseURL: process.env.DMOCKS_EXAM_TEST_URL ?? portalFixtureURL });
const actor = { id: '00000000-0000-4000-8000-000000002301', email: 'fictional-exam-ready@example.invalid' };
const attemptId = '20000000-0000-4000-8000-000000002301';
async function fixture(page) {
  const starts = [];
  await stubPortalProvider(page, (name, input) => {
    if (name === 'public_all_india_top_ten') return [];
    if (name === 'exam_mock_catalog') return [
      { exam: 'uceed', questionCount: 57, durationSeconds: 7200, freeAttemptLimit: 1, freeAttemptsUsed: 0, enabled: true, ready: true, sectionLabel: 'Part A' },
      { exam: 'ceed', questionCount: 41, durationSeconds: 3600, freeAttemptLimit: 1, freeAttemptsUsed: 1, enabled: true, ready: true, sectionLabel: 'Part A' },
    ];
    if (name === 'start_exam_mock') { starts.push(input); return attemptId; }
    if (name === 'read_attempt') return { code: '42501', message: 'Fictional fixture stops after navigation.' };
  });
  await page.goto('/account');
  await seedPortalSession(page, actor);
  await page.goto('/dashboard/mocks');
  return starts;
}

test('exam readiness keeps cancellation free of starts and restores keyboard focus', async ({ page }) => {
  const starts = await fixture(page);
  const opener = page.getByRole('button', { name: 'Start mock', exact: true });
  await opener.focus(); await opener.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Ready to begin UCEED Part A?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('57 questions · 120 minutes')).toBeVisible();
  await expect(dialog.getByText(/clock keeps running/)).toBeVisible();
  await expect(dialog.getByText(/1 free attempt remaining. Beginning uses one./)).toBeVisible();
  const cancel = dialog.getByRole('button', { name: 'Cancel' });
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Begin timed mock' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
  await opener.click(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(opener).toBeFocused();
  expect(starts).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('exam readiness confirms the selected exam once and fits an accessible mobile dialog', async ({ page }, testInfo) => {
  const starts = await fixture(page);
  await page.locator('label').filter({ has: page.getByRole('radio', { name: /^CEED M.Des./ }) }).click();
  await page.getByRole('button', { name: 'Start mock', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ready to begin CEED Part A?' });
  await expect(dialog.getByText('41 questions · 60 minutes')).toBeVisible();
  await expect(dialog.getByText(/Beginning uses one/)).toHaveCount(0);
  expect(starts).toEqual([]);
  await page.addScriptTag({ path: fileURLToPath(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url)) });
  const violations = await page.evaluate(async () => (await window.axe.run('dialog', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations);
  expect(violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('exam-readiness.png') });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  expect(await page.evaluate(async () => (await window.axe.run('dialog', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations)).toEqual([]);
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
  await dialog.getByRole('button', { name: 'Begin timed mock' }).evaluate(button => { button.click(); button.click(); });
  await expect(page).toHaveURL('/attempt/' + attemptId);
  expect(starts).toEqual([{ p_exam: 'ceed' }]);
});
