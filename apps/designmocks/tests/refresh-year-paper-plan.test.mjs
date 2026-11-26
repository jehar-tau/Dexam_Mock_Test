import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshPlan } from '../scripts/refresh-year-paper-plan.mjs';
import { encodeWorkedExplanation } from '../src/worked-solution.js';

const figure = { sha256: 'a'.repeat(64), width: 80, height: 40 };
const solution = { version: 1, figure, keyIdea: 'Fictional idea.', steps: [{ text: 'Mark it.', shapes: [{ tag: 'circle', attrs: { cx: '4', cy: '4', r: '2' } }] }] };
const canonical = { records: [
  { externalKey: 'fic-1', contentSha256: 'new1', payload: { assets: [{ ...figure, path: 'p/figures/x.png' }] } },
  { externalKey: 'fic-2', contentSha256: 'same', payload: { assets: [] } } ] };
const plan = { questions: [
  { externalKey: 'fic-1', contentSha256: 'old1', marking: { correct: 4, wrong: 0 }, explanation: 'Fictional explanation one.' },
  { externalKey: 'fic-2', contentSha256: 'same', marking: { correct: 4, wrong: 0 }, explanation: 'Fictional explanation two.' } ] };

test('hashes follow the question file and explanations stay exactly as reviewed', () => {
  const { plan: out, hashes, packed } = refreshPlan(plan, canonical);
  assert.deepEqual([hashes, packed], [1, 0]);
  assert.deepEqual(out.questions.map(q => [q.contentSha256, q.explanation]), [['new1', 'Fictional explanation one.'], ['same', 'Fictional explanation two.']]);
});

test('animation steps are packed only when the drawing belongs to the question\'s own figure, and re-running is stable', () => {
  const worked = { 'fic-1': { solution }, 'fic-2': { solution } };
  const first = refreshPlan(plan, canonical, worked);
  assert.equal(first.packed, 1);
  assert.equal(first.plan.questions[0].explanation, encodeWorkedExplanation('Fictional explanation one.', solution));
  assert.equal(first.plan.questions[1].explanation, 'Fictional explanation two.');
  assert.deepEqual(refreshPlan(first.plan, canonical, worked).plan, first.plan);
  assert.equal(refreshPlan(first.plan, canonical).plan.questions[0].explanation, 'Fictional explanation one.');
});
