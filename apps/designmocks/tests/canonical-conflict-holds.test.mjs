import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildManifest } from '../scripts/question-bank-import.mjs';

const bank = JSON.parse(fs.readFileSync(new URL('../../../server/data/exports/dexam-bank-export.json', import.meta.url), 'utf8'));

test('the canonical export contains only the solved Claude paper set', () => {
  assert.equal(bank.questions.length, 3302);
  assert.equal(new Set(bank.questions.map(question => question.externalKey)).size, 3302);
  assert.equal(new Set(bank.questions.map(question => question.provenance.paperId)).size, 49);
  assert.deepEqual(new Set(bank.questions.map(question => question.provenance.exam)), new Set(['ceed', 'uceed', 'nid', 'nift']));
  assert.ok(bank.questions.every(question => Array.isArray(question.holds) && question.holds.length === 0));
  assert.equal(buildManifest(bank).eligibleTotal, 3302);
  for (const removed of ['uceed-2017-q60', 'uceed-2018-q25', 'ceed-2010-q1-1']) {
    assert.equal(bank.questions.some(question => question.externalKey === removed), false);
  }
});

test('owner-resolved keys and figures remain in the exact retained records', () => {
  const byKey = new Map(bank.questions.map(question => [question.externalKey, question]));
  for (const key of ['uceed-2016-q62', 'uceed-2016-q74', 'uceed-2016-q75', 'uceed-2025-q18']) {
    assert.equal(byKey.get(key)?.answer?.raw, 'FULL MARKS');
  }
  assert.equal(byKey.get('uceed-2025-q36')?.answer?.raw, 'C');
  assert.equal(/2025\.\s*$/.test(byKey.get('uceed-2025-q3')?.prompt), false);
  assert.equal(byKey.get('uceed-2025-q36')?.assets.length, 1);
});
