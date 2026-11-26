import test from 'node:test';
import assert from 'node:assert/strict';
import { overviewPaperProgress } from '../src/overview-papers.mjs';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const release = (n, exam, year, partLabel = 'Part A') => ({ exam, year, sourcePaperId: `${exam}-${year}`, paperId: id(n),
  questionCount: 50, durationSeconds: 7200, partLabel });
const releases = [release(1, 'uceed', 2026), release(2, 'uceed', 2025), release(3, 'uceed', 2024), release(4, 'ceed', 2026)];

test('a new student is pointed at the newest UCEED paper', () => {
  const progress = overviewPaperProgress(releases);
  assert.deepEqual([progress.total, progress.attempted, progress.inProgress.length, progress.results.length], [4, 0, 0, 0]);
  assert.deepEqual(progress.next, { exam: 'uceed', year: 2026, paperId: 'uceed-2026', questionCount: 50, minutes: 120 });
});

test('own attempts are split into in progress and results, and the next paper skips attempted years', () => {
  const attempts = new Map([
    [id(1), { active: { id: id(101), startedAt: '2026-11-25T10:00:00Z' }, submitted: null }],
    [id(2), { active: null, submitted: { id: id(102), startedAt: '2026-11-20T10:00:00Z', resultsPending: false, score: 140, total: 300 } }],
  ]);
  const progress = overviewPaperProgress(releases, attempts);
  assert.equal(progress.attempted, 2);
  assert.equal(progress.inProgress[0].attempt.id, id(101));
  assert.equal(progress.results[0].attempt.score, 140);
  assert.equal(progress.next.paperId, 'uceed-2024');
});

test('the most recent exam a student worked on decides the next suggestion', () => {
  const attempts = new Map([[id(4), { active: null, submitted: { id: id(104), startedAt: '2026-11-26T10:00:00Z', resultsPending: true, score: null, total: null } }]]);
  assert.equal(overviewPaperProgress([...releases, release(5, 'ceed', 2025)], attempts).next.paperId, 'ceed-2025');
});

test('an unreadable catalogue is rejected rather than summarised', () => {
  assert.throws(() => overviewPaperProgress([{ exam: 'uceed' }]));
});
