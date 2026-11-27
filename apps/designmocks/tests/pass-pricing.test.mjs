import test from 'node:test';
import assert from 'node:assert/strict';
import { passPlans, freeAllowance, brand } from '../src/config.js';
import { duoClaimMessage, duoInviteLink, duoTokenPattern, passIsActive } from '../src/pass-rules.js';
import { safeReturnPath } from '../src/return-path.js';
import { learningCatalogResponse } from '../src/learning-reader.js';
import { emptyProgress, programmeSummary, recordQuiz, tiersOf } from '../src/learn/programme-model.js';
import { programmes } from '../src/learn/programmes/index.js';

const token = 'a'.repeat(64);

test('the browser labels the owner-approved prices and free allowance', () => {
  assert.equal(brand.price, 1284);
  assert.deepEqual([passPlans.annual.amountMinor, passPlans.duo.amountMinor], [128400, 214200]);
  assert.equal(passPlans.duo.seats, 2);
  assert.deepEqual(freeAllowance, { workedSolutionsPerPaper: 5, topicSessionsPerDay: 1, topicSessionQuestions: 10, drawingMarkingPerMonth: 4 });
});

test('only an unrevoked active server pass counts as a pass', () => {
  assert.equal(passIsActive({ active: true, expiresAt: '2027-11-28T00:00:00Z' }), true);
  for (const value of [null, {}, { active: 'true' }, { active: false }, { active: true, revoked: true }]) assert.equal(passIsActive(value), false);
});

test('Duo invite links are exact 64-character tokens and every server refusal has a plain message', () => {
  assert.ok(duoTokenPattern.test(token));
  for (const value of ['A'.repeat(64), 'a'.repeat(63), token + 'a', '../' + token]) assert.equal(duoTokenPattern.test(value), false);
  assert.equal(duoInviteLink('https://dmocks.com', token), 'https://dmocks.com/duo/' + token);
  for (const hint of ['dmocks_duo_google', 'dmocks_duo_invalid', 'dmocks_duo_payer', 'dmocks_duo_used', 'dmocks_duo_unavailable', 'dmocks_duo_expired', 'dmocks_duo_has_pass'])
    assert.doesNotMatch(duoClaimMessage({ hint }), /Couldn’t claim/);
  assert.match(duoClaimMessage(new Error('Private diagnostic')), /Couldn’t claim/);
});

test('sign-in can return to the plans page and a Duo invite, nowhere else new', () => {
  assert.equal(safeReturnPath('/plans'), '/plans');
  assert.equal(safeReturnPath('/duo/' + token), '/duo/' + token);
  for (const path of ['/duo/' + token + '/x', '/duo/short', '//evil.example/duo/' + token, '/plans?next=https://evil.example']) assert.equal(safeReturnPath(path), null);
});

test('theory lessons keep the server lock flag and default to open', () => {
  const lesson = { id: '50000000-0000-4000-8000-000000009001', slug: 'first-lesson', exam: 'uceed', topic: 'colour', title: 'First lesson', summary: 'A fictional first lesson.', completed: false };
  const { lessons } = learningCatalogResponse([{ ...lesson, locked: true }, { ...lesson, id: '50000000-0000-4000-8000-000000009002', slug: 'second-lesson' }], { total: 2, completed: 0, percent: 0 });
  assert.deepEqual(lessons.map(row => row.locked), [true, false]);
});

test('without a pass only the Foundations tier of a programme opens', () => {
  const programme = programmes.find(entry => tiersOf(entry).length > 1);
  assert.ok(programme, 'a tiered programme exists');
  const progress = emptyProgress();
  const free = programmeSummary(programme, progress, { passActive: false });
  assert.deepEqual(free.tiers.map(state => state.passLocked), tiersOf(programme).map(tier => tier.id !== 'foundations'));
  assert.ok(free.tiers.filter(state => state.passLocked).every(state => !state.open));
  assert.equal(free.foundationsFinished, false);
  const foundations = tiersOf(programme)[0];
  const passed = recordQuiz(progress, foundations.id, { score: foundations.quiz.pass, total: foundations.quiz.pass, seconds: 60, passed: true });
  const afterFoundations = programmeSummary(programme, passed, { passActive: false });
  assert.equal(afterFoundations.foundationsFinished, true);
  assert.equal(afterFoundations.tiers[1].open, false, 'passing Foundations does not open a paid tier');
  assert.equal(programmeSummary(programme, passed, { passActive: true }).tiers[1].open, true, 'a pass holder moves on');
  assert.equal(programmeSummary(programme, progress, { passActive: false, unlockAll: true }).tiers.every(state => state.open), true, 'the preview review switch still opens everything');
});
