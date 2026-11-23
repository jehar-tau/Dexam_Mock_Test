import assert from 'node:assert/strict';
import test from 'node:test';
import { ownedYearPaperAttempts } from '../src/year-paper-attempts.mjs';

const paperId = '10000000-0000-4000-8000-000000003001';
const base = { paperId, attemptId: '20000000-0000-4000-8000-000000003001',
  status: 'active', startedAt: '2026-11-23T09:00:00Z', resultsPending: false, score: null, total: null };

test('projects only owned paper attempt fields and keeps the latest active and result separate', () => {
  const rows = [base, { ...base, attemptId: '20000000-0000-4000-8000-000000003002',
    status: 'submitted', score: 17, total: 30, privateExtra: 'discard' }];
  const result = ownedYearPaperAttempts(rows).get(paperId);
  assert.equal(result.active.id, base.attemptId);
  assert.equal(result.submitted.score, 17);
  assert.equal(JSON.stringify(result).includes('privateExtra'), false);
});

test('keeps a held result hidden and refuses malformed, duplicate or injected identities', () => {
  const pending = { ...base, status: 'submitted', resultsPending: true };
  assert.equal(ownedYearPaperAttempts([pending]).get(paperId).submitted.score, null);
  for (const broken of [
    { ...base, paperId: '../admin' }, { ...base, attemptId: 'https://example.invalid' },
    { ...base, startedAt: 'yesterday' }, { ...base, status: 'other' },
    { ...base, score: 3 }, { ...pending, score: 3 },
    { ...base, status: 'submitted', score: null },
    { ...base, status: 'submitted', score: 3, total: -1 },
  ]) assert.throws(() => ownedYearPaperAttempts([broken]));
  assert.throws(() => ownedYearPaperAttempts([base, base]));
  assert.throws(() => ownedYearPaperAttempts({ attempts: [base] }));
});
