import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildManifest } from '../scripts/question-bank-import.mjs';

test('identified source conflicts are held out of the canonical import', () => {
  const bank = JSON.parse(fs.readFileSync(new URL('../../../server/data/exports/dexam-bank-export.json', import.meta.url), 'utf8'));
  const conflicts = new Map([
    ['uceed-2017-q60', 'answer-key-conflict'],
    ['uceed-2018-q25', 'source-wording-figure-count-conflict'],
  ]);
  const byKey = new Map(bank.questions.map(question => [question.externalKey, question]));
  const imported = new Set(buildManifest(bank).records.map(record => record.externalKey));
  for (const [key, hold] of conflicts) {
    assert.deepEqual(byKey.get(key)?.holds, [hold], `${key} must retain its source hold`);
    assert.equal(imported.has(key), false, `${key} must not enter the eligible import`);
  }
});

test('owner-resolved conflicts are released with full marks for every candidate', () => {
  const bank = JSON.parse(fs.readFileSync(new URL('../../../server/data/exports/dexam-bank-export.json', import.meta.url), 'utf8'));
  const byKey = new Map(bank.questions.map(question => [question.externalKey, question]));
  for (const key of ['uceed-2016-q62', 'uceed-2016-q74', 'uceed-2016-q75', 'uceed-2025-q18']) {
    assert.deepEqual(byKey.get(key)?.holds, [], `${key} is released by the owner`);
    assert.equal(byKey.get(key)?.answer?.raw, 'FULL MARKS', `${key} awards full marks`);
  }
});

test('UCEED 2025 Q36 is restored and Q3 is released with a clean prompt', () => {
  const bank = JSON.parse(fs.readFileSync(new URL('../../../server/data/exports/dexam-bank-export.json', import.meta.url), 'utf8'));
  const byKey = new Map(bank.questions.map(question => [question.externalKey, question]));
  assert.equal(byKey.get('uceed-2025-q36')?.answer?.raw, 'C');
  assert.deepEqual(byKey.get('uceed-2025-q3')?.holds, []);
  assert.equal(/2025\.\s*$/.test(byKey.get('uceed-2025-q3').prompt), false);
  const imported = new Set(buildManifest(bank).records.map(record => record.externalKey));
  for (const n of [3, 18, 36]) assert.equal(imported.has(`uceed-2025-q${n}`), true);
});

test('UCEED 2016 prompts and options carry no page footers or section instructions', () => {
  const bank = JSON.parse(fs.readFileSync(new URL('../../../server/data/exports/dexam-bank-export.json', import.meta.url), 'utf8'));
  const footer = /17 January 2016|Page \d+ of \d+|This section contains a total of/;
  for (const question of bank.questions.filter(item => item.externalKey.startsWith('uceed-2016-'))) {
    for (const text of [question.prompt, ...question.options.map(option => option.text || '')]) {
      assert.equal(footer.test(text), false, `${question.externalKey}: ${text.slice(-60)}`);
    }
  }
});
