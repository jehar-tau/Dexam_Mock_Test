import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { emptyAdminRead, seedPortalSession, stubPortalProvider } from './portal-fixture.js';
test.use({ baseURL: 'http://127.0.0.1:4799' });
const owner = { id: '00000000-0000-4000-8000-000000002251', email: 'nid-binding-owner@example.invalid' };
const blueprintId = '10000000-0000-4000-8000-000000002251';
const picture = 'https://nid-binding-figure-fixture.invalid/figure.png';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4+vEFAAWtAs+P9YeZAAAAAElFTkSuQmCC', 'base64');
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const endpoint = name => 'https://dmocks-portal-fixture.supabase.co/rest/v1/rpc/' + name;
const bank = page => page.getByRole('region', { name: 'Imported bank review', exact: true });
const review = page => bank(page).getByRole('region', { name: 'Question review', exact: true });
const panel = page => review(page).getByRole('region', { name: 'NID question practice binding', exact: true });
const held = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
const note = 'Original fictional source and required figures fit the explicitly authored practice section.';
const rubric = [{ label: 'Observation', points: 0.1, guidance: 'Credit clearly observed fictional spatial relationships.' }, { label: 'Communication', points: 0.2, guidance: 'Credit clear original fictional communication.' }];
function blueprint() {
  return { id: blueprintId, revision: 1, currentRevision: 1, sha256: 'b'.repeat(64), status: 'reviewed', payload: {
    schemaVersion: 'nid-authored-practice-v1', title: 'Original fictional NID practice', purpose: 'An explicitly authored original fictional observation and response practice scheme.', durationMinutes: 37, uploadGraceMinutes: 15,
    sections: [ { label: 'Observation', kind: 'mcq', count: 2, points: 2.5, penalty: 0.25, rubric: [] }, { label: 'Exact sets', kind: 'msq', count: 1, points: 4, penalty: 1, rubric: [] },
      { label: 'Exact numbers', kind: 'nat', count: 1, points: 7, penalty: 0, rubric: [] }, { label: 'Visual practice', kind: 'drawing', count: 1, points: 0.3, penalty: 0, rubric: structuredClone(rubric) },
      { label: 'Written practice', kind: 'written', count: 1, points: 0.3, penalty: 0, rubric: structuredClone(rubric) } ],
  } };
}
async function fixture(page, { type = 'MCQ', figure = true, existing = false, draftCount = 0, admin = true } = {}) {
  let version = 1, bindingNumber = 0;
  const bp = blueprint(), requests = new Map(), histories = [];
  const question = { externalKey: 'nid-binding-original', exam: 'nid', type, topic: 'observation', licence: 'owned', active: true, approved: false, rightsConfirmed: false, runtimeReady: false,
    prompt: 'Original fictional source task with a complete independently reviewed answer.', options: ['MCQ', 'MSQ'].includes(type) ? ['A', 'B', 'C'].map(key => ({ key, text: 'Original option ' + key })) : [],
    answer: type === 'DESCRIPTIVE' ? null : { raw: type === 'NAT' ? '1.000000000000000001 or 1.000000000000000002' : type === 'MSQ' ? 'BA' : 'B', status: 'human-reviewed' },
    explanation: 'Original fictional source explanation.', runtimeKey: null, marking: null, context: null,
    sourceCommit: 'c'.repeat(40), contentSha256: 'a'.repeat(64), reviewVersion: '1'.repeat(64), media: figure ? [{ ordinal: 1, width: 1, height: 1, available: true }] : [] };
  const state = { admin, bp, question, requests, histories, writes: [], binding: null, draftCount };
  const touch = () => { question.reviewVersion = createHash('sha256').update('fictional-version-' + (++version)).digest('hex'); };
  state.touch = touch;
  state.makeBinding = input => {
    const value = { id: `20000000-0000-4000-8000-${String(++bindingNumber).padStart(12, '0')}`, externalKey: question.externalKey, contentSha256: question.contentSha256, sourceVersion: 'd'.repeat(64), current: true,
      sectionOrdinal: input.p_section_ordinal, note: input.p_note, blueprint: structuredClone(bp) };
    state.binding = value; histories.push({ id: value.id, blueprintRevision: bp.revision, sectionOrdinal: value.sectionOrdinal, note: value.note });
    Object.assign(question, { runtimeReady: false, approved: false, rightsConfirmed: false, context: null, marking: null, runtimeKey: null }); touch();
    return { externalKey: question.externalKey, bindingId: value.id, reviewVersion: question.reviewVersion, status: 'bound' };
  };
  state.prepare = () => {
    const b = state.binding, section = bp.payload.sections[b.sectionOrdinal - 1];
    question.context = { version: 'nid-authored-practice-v1', scope: 'authored-practice', exam: 'nid', blueprintId: bp.id, blueprintRevision: bp.revision, blueprintSha256: bp.sha256, bindingId: b.id,
      sectionOrdinal: b.sectionOrdinal, sectionLabel: section.label, responseKind: section.kind, durationSeconds: 2220, uploadGraceSeconds: 900, rubric: section.rubric };
    question.marking = { correct: section.points, wrong: -section.penalty, ...(['drawing', 'written'].includes(section.kind) ? { humanReview: true } : {}) };
    question.runtimeKey = { kind: ['drawing', 'written'].includes(section.kind) ? 'drawing' : section.kind, sourceExternalKey: question.externalKey, correct: ['B'] };
    question.runtimeReady = true; touch();
  };
  if (existing) { state.makeBinding({ p_section_ordinal: 1, p_note: 'Original fictional previous binding review.' }); state.prepare(); }
  state.respond = (name, input) => {
    if (name === 'is_dmocks_admin') return state.admin;
    if (!state.admin && name.startsWith('admin_')) return { code: '42501', message: 'Admin access required' };
    switch (name) {
      case 'admin_search_bank_questions': {
        const visible = (!input.p_exam || input.p_exam === question.exam) && (!input.p_type || input.p_type === question.type) &&
          ({ unavailable: !question.runtimeReady, pending: question.runtimeReady && !question.approved, approved: question.approved, all: true }[input.p_status]);
        return { items: visible ? [question] : [], total: visible ? 1 : 0, limit: input.p_limit, offset: 0, topics: ['observation'], summary: { active: 1, available: Number(question.runtimeReady), approved: Number(question.approved), inactive: 0 } };
      }
      case 'admin_bank_question': return input.p_expected_version === question.reviewVersion ? { ...question, nidPractice: { binding: state.binding, canConvert: Boolean(state.binding?.current), materialized: question.runtimeReady } } : { code: '40001', message: 'Question changed. Refresh the bank and review it again.' };
      case 'bank-review-media': return { images: [{ ordinal: 1, width: 1, height: 1, url: picture }] };
      case 'admin_nid_practice_blueprints': {
        const items = [...Array.from({ length: state.draftCount }, (_, n) => ({ id: 'unreviewed-' + n, title: 'Original draft ' + n, status: 'draft', revision: 1, sha256: 'e'.repeat(64) })), { ...bp, title: bp.payload.title }];
        return { items: items.slice(input.p_offset, input.p_offset + input.p_limit), total: items.length, offset: input.p_offset, limit: input.p_limit };
      }
      case 'admin_nid_practice_blueprint': return { item: bp, versions: [], requestResult: null };
      case 'admin_nid_question_binding': {
        if (input.p_expected_version && input.p_expected_version !== question.reviewVersion) return { code: '40001', message: 'Question changed' };
        return { binding: state.binding, canConvert: Boolean(state.binding?.current), materialized: question.runtimeReady, reviewVersion: question.reviewVersion, history: histories, requestResult: requests.get(input.p_request_id)?.ack ?? null };
      }
      case 'admin_bind_nid_question': {
        state.writes.push([name, structuredClone(input)]);
        const old = requests.get(input.p_request_id);
        if (old) return old.body === JSON.stringify(input) ? old.ack : { code: '40001', message: 'Conflicting request' };
        if (input.p_expected_version !== question.reviewVersion || input.p_revision !== bp.revision || input.p_blueprint_sha256 !== bp.sha256 || bp.status !== 'reviewed') return { code: '40001', message: 'Question or blueprint changed' };
        const ack = state.makeBinding(input); requests.set(input.p_request_id, { body: JSON.stringify(input), ack }); return ack;
      }
      case 'admin_review_bank_question':
        if (input.p_expected_version !== question.reviewVersion) return { code: '40001', message: 'Question changed' };
        question.approved = input.p_approved; question.rightsConfirmed = input.p_rights_confirmed; touch(); return null;
      default: return emptyAdminRead(name);
    }
  };
  Object.assign(state, await stubPortalProvider(page, state.respond));
  await page.route(picture, route => route.fulfill({ body: png, contentType: 'image/png' }));
  await page.goto('/admin'); await seedPortalSession(page, owner); await page.reload();
  if (admin) {
    await expect(bank(page).getByText(question.runtimeReady ? '1–1 of 1 matching questions' : 'No questions match these filters.', { exact: true })).toBeVisible();
    await bank(page).getByRole('combobox', { name: 'Review status', exact: true }).selectOption(question.runtimeReady ? 'pending' : 'unavailable');
    await bank(page).getByRole('button', { name: 'Search bank', exact: true }).click();
    await expect(bank(page).getByText('1–1 of 1 matching questions', { exact: true })).toBeVisible();
  }
  return state;
}
async function open(page) {
  await bank(page).getByRole('button', { name: 'Open question nid-binding-original', exact: true }).click();
  await expect(panel(page).getByRole('combobox', { name: 'Reviewed blueprint', exact: true })).toBeEnabled();
  await expect(panel(page).getByRole('combobox', { name: 'Reviewed blueprint', exact: true }).locator('option').filter({ hasText: 'Original fictional NID practice' })).toHaveCount(1);
}
async function choose(page, section = '1') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await panel(page).getByRole('combobox', { name: 'Reviewed blueprint', exact: true }).selectOption(blueprintId);
  await expect(panel(page).getByRole('combobox', { name: 'Practice section', exact: true })).toBeEnabled();
  await panel(page).getByRole('combobox', { name: 'Practice section', exact: true }).selectOption(section);
  await panel(page).getByRole('textbox', { name: 'Question fit review', exact: true }).fill(note);
  const confirmation = panel(page).getByRole('checkbox', { name: /^I inspected this question/ });
  await expect(confirmation).toBeVisible();
  await confirmation.scrollIntoViewIfNeeded();
  await confirmation.check();
  await expect(confirmation).toBeChecked();
}
async function figures(page) { await review(page).getByRole('button', { name: 'Open private figures', exact: true }).click(); await expect(review(page).getByRole('img', { name: 'Question figure 1', exact: true })).toBeVisible(); }
async function saved(page) { await expect(bank(page).getByText('Practice binding saved. Run the guarded conversion, then review the exact question version.', { exact: true })).toBeVisible(); await expect(review(page)).toHaveCount(0); }

test('bind an inspected private question, then require a separate conversion and exact question approval', async ({ page }) => {
  const state = await fixture(page); await open(page); await choose(page);
  await expect(panel(page).getByRole('button', { name: 'Save practice binding', exact: true })).toBeDisabled(); await figures(page);
  await panel(page).getByRole('button', { name: 'Save practice binding', exact: true }).press('Enter'); await saved(page);
  expect(state.writes).toHaveLength(1); const command = state.writes[0][1]; expect(command).toMatchObject({ p_external_key: state.question.externalKey, p_blueprint_id: blueprintId, p_revision: 1, p_blueprint_sha256: 'b'.repeat(64), p_section_ordinal: 1, p_note: note });
  expect(state.question.runtimeReady).toBe(false); expect(state.question.approved).toBe(false); expect(state.question.rightsConfirmed).toBe(false);
  await open(page); await expect(review(page).getByRole('region', { name: 'Student exam preview', exact: true })).toContainText('Authored practice · Observation'); await expect(review(page).getByRole('button', { name: 'Approve for practice', exact: true })).toBeDisabled();
  await review(page).getByRole('button', { name: 'Close question', exact: true }).click(); state.prepare(); await bank(page).getByRole('combobox', { name: 'Review status', exact: true }).selectOption('pending'); await bank(page).getByRole('button', { name: 'Search bank', exact: true }).click(); await open(page);
  await review(page).getByRole('textbox', { name: 'Review note', exact: true }).fill('Original fictional final question, figure, key and practice context reviewed.'); await review(page).getByRole('checkbox', { name: 'I checked the question and confirm DMocks has the right to use it.', exact: true }).check();
  await expect(review(page).getByRole('button', { name: 'Approve for practice', exact: true })).toBeDisabled(); await figures(page); await review(page).getByRole('button', { name: 'Approve for practice', exact: true }).press('Enter');
  await expect(bank(page).getByText('Review saved. The question bank has been refreshed.', { exact: true })).toBeVisible(); expect(state.question.approved).toBe(true); expect(state.calls.some(([name]) => /start_|release_mvp|upsert_/.test(name))).toBe(false); expect(state.unexpected).toEqual([]);
});

test('text-only written pages show the authored rubric and clock without requiring an invented figure', async ({ page }) => {
  const state = await fixture(page, { type: 'DESCRIPTIVE', figure: false }); await open(page); await choose(page, '5');
  await expect(panel(page)).toContainText('Observation · 0.1 marks'); await expect(panel(page)).toContainText('Communication · 0.2 marks'); await expect(panel(page)).toContainText('37 practice minutes · 15 minutes');
  await expect(review(page).getByRole('button', { name: 'Open private figures', exact: true })).toHaveCount(0); await panel(page).getByRole('button', { name: 'Save practice binding', exact: true }).click(); await saved(page); await open(page);
  const context = panel(page).getByRole('region', { name: 'Bound practice scheme', exact: true }); await expect(context).toContainText('Written practice · 0.3 maximum marks'); await expect(context).toContainText('Observation · 0.1 marks'); expect(state.binding.sectionOrdinal).toBe(5); expect(state.question.runtimeReady).toBe(false); expect(state.unexpected).toEqual([]);
});

test('a numeric source preserves both exact decimal alternatives in the private binding preview', async ({ page }) => {
  const state = await fixture(page, { type: 'NAT', figure: false }); await open(page); await choose(page, '3');
  await expect(review(page).locator('dd').first()).toHaveText('1.000000000000000001 or 1.000000000000000002');
  await panel(page).getByRole('button', { name: 'Save practice binding', exact: true }).click(); await saved(page); expect(state.binding.sectionOrdinal).toBe(3); expect(state.question.answer.raw).toBe('1.000000000000000001 or 1.000000000000000002'); expect(state.unexpected).toEqual([]);
});

test('a changed canonical question rejects an old fit review and requires a fresh inspection', async ({ page }) => {
  const state = await fixture(page, { figure: false }); await open(page); await choose(page); state.question.prompt = 'Changed original fictional source prompt.'; state.touch();
  await panel(page).getByRole('button', { name: 'Save practice binding', exact: true }).click(); await expect(panel(page).getByRole('alert')).toContainText('question or practice revision changed'); await expect(panel(page).getByRole('combobox', { name: 'Reviewed blueprint', exact: true })).toBeDisabled(); expect(state.binding).toBe(null);
  await bank(page).getByRole('button', { name: 'Refresh bank', exact: true }).click(); await open(page); await expect(review(page).getByText('Changed original fictional source prompt.', { exact: true }).first()).toBeVisible(); await expect(panel(page).getByRole('textbox', { name: 'Question fit review', exact: true })).toHaveCount(0); expect(state.writes).toHaveLength(1);
});

test('a practice blueprint changed after inspection cannot silently reuse the earlier confirmation', async ({ page }) => {
  const state = await fixture(page, { figure: false }); await open(page); await choose(page); state.bp.revision = 2; state.bp.currentRevision = 2; state.bp.sha256 = 'f'.repeat(64); state.bp.status = 'draft';
  await panel(page).getByRole('button', { name: 'Save practice binding', exact: true }).click(); await expect(panel(page).getByRole('alert')).toContainText('question or practice revision changed'); expect(state.binding).toBe(null);
  await bank(page).getByRole('button', { name: 'Refresh bank', exact: true }).click(); await open(page); const option = panel(page).getByRole('combobox', { name: 'Reviewed blueprint', exact: true }).locator('option').filter({ hasText: 'revision 2 · draft' }); await expect(option).toHaveJSProperty('disabled', true); await expect(panel(page).getByRole('checkbox')).toHaveCount(0);
});

for (const malformed of [false, true]) test(`a committed binding with ${malformed ? 'an incomplete acknowledgement' : 'a lost reply'} recovers without replay or accidental old question approval`, async ({ page }) => {
  const state = await fixture(page, { existing: true }); await open(page); await figures(page); await review(page).getByRole('textbox', { name: 'Review note', exact: true }).fill('Original fictional previous converted question review.'); await review(page).getByRole('checkbox', { name: 'I checked the question and confirm DMocks has the right to use it.', exact: true }).check(); await expect(review(page).getByRole('button', { name: 'Approve for practice', exact: true })).toBeEnabled(); await choose(page);
  await page.route(endpoint('admin_bind_nid_question'), async route => { if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors }); state.respond('admin_bind_nid_question', route.request().postDataJSON()); return malformed ? route.fulfill({ headers: cors, json: { status: 'bound' } }) : route.abort(); });
  await panel(page).getByRole('button', { name: 'Save practice binding', exact: true }).click(); await expect(panel(page).getByRole('alert')).toContainText('not confirmed');
  for (const name of ['Approve for practice', 'Close question']) await expect(review(page).getByRole('button', { name, exact: true })).toBeDisabled(); await expect(bank(page).getByRole('button', { name: 'Refresh bank', exact: true })).toBeDisabled(); await expect(panel(page).getByRole('textbox', { name: 'Question fit review', exact: true })).toBeDisabled();
  await panel(page).getByRole('button', { name: 'Check saved practice binding', exact: true }).click(); await saved(page); expect(state.writes).toHaveLength(1); expect(state.histories).toHaveLength(2); expect(state.question.approved).toBe(false); expect(state.calls.filter(([name]) => name === 'admin_review_bank_question')).toHaveLength(0); expect(state.unexpected).toEqual([]);
});

test('an uncommitted binding stays locked until an explicit identical retry succeeds once', async ({ page }) => {
  const state = await fixture(page, { figure: false }); await open(page); await choose(page); let lost;
  await page.route(endpoint('admin_bind_nid_question'), async route => { if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors }); lost = route.request().postDataJSON(); return route.abort(); });
  await panel(page).getByRole('button', { name: 'Save practice binding', exact: true }).click(); await expect(panel(page).getByRole('alert')).toContainText('not confirmed'); await panel(page).getByRole('button', { name: 'Check saved practice binding', exact: true }).click(); await expect(panel(page)).toContainText('not visible as committed yet'); expect(state.writes).toHaveLength(0);
  await page.unroute(endpoint('admin_bind_nid_question')); await panel(page).getByRole('button', { name: 'Retry same practice binding', exact: true }).click(); await saved(page); expect(state.writes).toEqual([['admin_bind_nid_question', lost]]); expect(state.requests.size).toBe(1);
});

test('duplicate submissions dispatch once and SDK signout clears a held private binding result', async ({ page }) => {
  const state = await fixture(page, { figure: false }); await open(page); await choose(page); const began = held(), waiting = held();
  await page.route(endpoint('admin_bind_nid_question'), async route => { if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors }); const result = state.respond('admin_bind_nid_question', route.request().postDataJSON()); began.release(); await waiting.promise; return route.fulfill({ headers: cors, json: result }); });
  await panel(page).getByRole('form', { name: 'Bind NID question to practice', exact: true }).evaluate(form => { form.requestSubmit(); form.requestSubmit(); }); await began.promise; expect(state.writes).toHaveLength(1);
  await page.evaluate(async () => { const { platform } = await import('/src/platform.js'); await platform.auth.signOut({ scope: 'local' }); }); await expect(bank(page)).toHaveCount(0); waiting.release(); await expect(page.getByText('Please sign in to continue.', { exact: true })).toBeVisible(); expect(state.writes).toHaveLength(1);
});

test('failed private figures block a binding until every required image has opened successfully', async ({ page }) => {
  const state = await fixture(page); await open(page); await choose(page); await page.route(picture, route => route.abort()); await review(page).getByRole('button', { name: 'Open private figures', exact: true }).click();
  await expect(review(page).getByRole('alert')).toContainText('could not be displayed'); await expect(panel(page).getByRole('button', { name: 'Save practice binding', exact: true })).toBeDisabled(); expect(state.writes).toHaveLength(0);
  await page.unroute(picture); await page.route(picture, route => route.fulfill({ body: png, contentType: 'image/png' })); await review(page).getByRole('button', { name: 'Refresh private figures', exact: true }).click(); await expect(panel(page).getByRole('button', { name: 'Save practice binding', exact: true })).toBeEnabled(); await panel(page).getByRole('button', { name: 'Save practice binding', exact: true }).click(); await saved(page);
});

test('blueprints are paginated, incompatible sections stay disabled and paging resets the chosen scheme', async ({ page }) => {
  const state = await fixture(page, { figure: false, draftCount: 11 });
  await bank(page).getByRole('button', { name: 'Open question nid-binding-original', exact: true }).click(); await expect(panel(page).getByRole('combobox', { name: 'Reviewed blueprint', exact: true })).toBeEnabled(); await expect(panel(page)).toContainText('No reviewed scheme on this page'); await panel(page).getByRole('button', { name: 'Next practice schemes', exact: true }).click();
  await expect(panel(page).getByRole('combobox', { name: 'Reviewed blueprint', exact: true }).locator('option').filter({ hasText: 'Original fictional NID practice' })).toHaveCount(1); await choose(page);
  await expect(panel(page).getByRole('combobox', { name: 'Practice section', exact: true }).locator('option[value="4"]')).toHaveJSProperty('disabled', true); await panel(page).getByRole('button', { name: 'Previous practice schemes', exact: true }).click(); await expect(panel(page).getByRole('checkbox')).toHaveCount(0); expect(state.writes).toHaveLength(0);
});

test('role removal clears source/context previews and a student never reads a binding', async ({ page }) => {
  const state = await fixture(page, { figure: false }); await open(page); await choose(page); const reads = state.calls.filter(([name]) => name === 'admin_nid_question_binding').length; state.admin = false; await page.getByRole('button', { name: 'Recheck administrator access', exact: true }).press('Enter');
  await expect(page.getByText('Administrator access has ended. Private views were cleared.', { exact: true })).toBeVisible(); await expect(panel(page)).toHaveCount(0); expect(state.writes).toHaveLength(0);
  await seedPortalSession(page, { id: '00000000-0000-4000-8000-000000002253', email: 'nid-binding-student@example.invalid' }); await page.reload();
  await expect(page.getByText('This account is not an administrator.', { exact: true })).toBeVisible(); expect(state.calls.filter(([name]) => name === 'admin_nid_question_binding')).toHaveLength(reads); await expect(panel(page)).toHaveCount(0);
});

test('private binding review supports keyboard, both themes, WCAG and a 320px layout', async ({ page }) => {
  const state = await fixture(page, { figure: false }); await open(page); await choose(page);
  await panel(page).getByRole('textbox', { name: 'Question fit review', exact: true }).focus(); await page.keyboard.press('Tab'); await expect(panel(page).getByRole('checkbox')).toBeFocused();
  await page.addScriptTag({ path: fileURLToPath(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url)) });
  for (const theme of ['light', 'dark']) { await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme); expect(await page.evaluate(async () => (await window.axe.run('.nid-question-binding', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations)).toEqual([]); }
  await page.setViewportSize({ width: 320, height: 780 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320); await expect(panel(page).getByRole('button', { name: 'Save practice binding', exact: true })).toBeVisible(); expect(state.unexpected).toEqual([]);
});
