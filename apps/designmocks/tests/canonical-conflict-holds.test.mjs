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

test('NID B.Des papers NID never published are DMocks reconstructions, labelled as such', () => {
  const bank = JSON.parse(fs.readFileSync(new URL('../../../server/data/exports/dexam-bank-export.json', import.meta.url), 'utf8'));
  const recalled = bank.questions.filter(question => /^nid-bdes-recalled-20\d\d$/.test(question.provenance?.paperId ?? ''));
  const count = id => recalled.filter(q => q.provenance.paperId === id).length;
  assert.deepEqual([count('nid-bdes-recalled-2023'), count('nid-bdes-recalled-2024'), count('nid-bdes-recalled-2026')], [4, 14, 6]);
  for (const q of recalled) {
    assert.equal(q.sourceKind, 'original');
    assert.equal(q.licence, 'dexam-original');
    assert.match(q.prompt, /Reconstructed by DMocks from candidates' recollections/);
    if (q.type !== 'DESCRIPTIVE') assert.equal(q.answer.status, 'independently-solved');
  }
});

test('NID 2018 B.Des and M.Des come from NID\'s booklets with NID\'s final answer keys', () => {
  const bank = JSON.parse(fs.readFileSync(new URL('../../../server/data/exports/dexam-bank-export.json', import.meta.url), 'utf8'));
  const paper = id => bank.questions.filter(question => question.provenance?.paperId === id);
  const bdes = paper('nid-bdes-2018'), mdes = paper('nid-mdes-2018');
  assert.equal(bdes.length, 67);
  assert.equal(mdes.length, 62);
  const objective = [...bdes, ...mdes].filter(q => q.type !== 'DESCRIPTIVE');
  assert.equal(objective.length, 64 + 59);
  for (const q of objective) assert.equal(q.answer.status, 'official-key');
  const raw = (list, n) => list.find(q => q.provenance.questionNo === String(n)).answer.raw;
  assert.deepEqual([raw(bdes, 10), raw(bdes, 28), raw(bdes, 48), raw(bdes, 59), raw(bdes, 60)], ['B or C', 'C', 'B or D', 'FULL MARKS', 'D']);
  assert.deepEqual([raw(mdes, 1), raw(mdes, 15), raw(mdes, 37), raw(mdes, 52)], ['A or D', 'A or C', 'C or D', 'A']);
  assert.equal([...bdes, ...mdes].some(q => q.holds.length), false);
});

test('NID B.Des and M.Des DAT Prelims samples (NIDA2023-26) come from NID\'s own papers', () => {
  const bank = JSON.parse(fs.readFileSync(new URL('../../../server/data/exports/dexam-bank-export.json', import.meta.url), 'utf8'));
  const paper = id => bank.questions.filter(question => question.provenance?.paperId === id);
  const bdes = paper('nid-bdes-sample-2023'), mdes = paper('nid-mdes-sample-2023');
  assert.equal(bdes.length, 31);
  assert.equal(mdes.length, 40);
  assert.deepEqual(bdes.filter(q => q.type === 'DESCRIPTIVE').map(q => q.provenance.questionNo), ['28', '29', '30', '31']);
  const partB = mdes.filter(q => q.type === 'DESCRIPTIVE');
  assert.deepEqual(partB.map(q => [q.provenance.questionNo, q.taskMarks, q.sourceKind, q.licence]),
    [['38', 8, 'original', 'dexam-original'], ['39', 10, 'original', 'dexam-original'], ['40', 12, 'original', 'dexam-original']]);
  for (const q of partB) assert.match(q.prompt, /Part B written by DMocks/);
  for (const q of [...bdes, ...mdes]) assert.notEqual(q.answer?.status, 'official-key');
  assert.deepEqual([...bdes, ...mdes].filter(q => q.holds.length), []);
  const b15 = bdes.find(q => q.provenance.questionNo === '15'), m37 = mdes.find(q => q.provenance.questionNo === '37');
  assert.deepEqual([b15.answer.raw, b15.options[0].text, m37.answer.raw, m37.options[3].text], ['A', '1, 2 & 3 only', 'D', '1:3']);
  for (const q of [b15, m37]) assert.match(q.prompt, /Corrected by DMocks/);
});

test('NID B.Des 2019 is rebuilt from NID\'s own sample paper with all 26 questions', () => {
  const bank = JSON.parse(fs.readFileSync(new URL('../../../server/data/exports/dexam-bank-export.json', import.meta.url), 'utf8'));
  const paper = bank.questions.filter(question => question.provenance?.paperId === 'nid-bdes-2019');
  assert.deepEqual(paper.map(question => question.provenance.questionNo), Array.from({ length: 26 }, (_, index) => String(index + 1)));
  assert.equal(new Set(paper.map(question => question.provenance.sourceSha256)).size, 1);
  const byNo = new Map(paper.map(question => [Number(question.provenance.questionNo), question]));
  for (const n of [1, 5, 7, 8, 9, 20, 22]) assert.equal(byNo.get(n).type, 'MCQ');
  assert.deepEqual([1, 5, 7, 8, 9, 20, 22].map(n => byNo.get(n).answer.raw), ['D', 'D', 'C', 'C', 'B', 'B', 'C']);
  for (const n of [16, 18]) assert.deepEqual(byNo.get(n).holds, []);
  assert.deepEqual([16, 18].map(n => byNo.get(n).answer.raw), ['A', 'B']);
  assert.equal(byNo.get(18).options[1].text, '22');
  for (const n of [16, 18]) assert.match(byNo.get(n).prompt, /Corrected by DMocks/);
  assert.deepEqual([23, 24, 25, 26].map(n => byNo.get(n).type), Array(4).fill('DESCRIPTIVE'));
  assert.equal(paper.some(question => question.answer?.status === 'official-key'), false);
});
