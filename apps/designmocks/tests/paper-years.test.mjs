import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { yearPaperCatalogue, paperLabel } from '../src/paper-years.mjs';
import generated from '../src/paper-years.generated.json' with { type: 'json' };

test('year-wise catalogue uses only empty-holds records and keeps same-year papers distinct', () => {
  const question = (paperId, holds, year = 2024) => ({ holds, type: 'MCQ', answer: 'A', provenance: { exam: 'ceed', year, paperId } });
  assert.deepEqual(yearPaperCatalogue([
    question('ceed-2024-paper1', []), question('ceed-2024-paper2', []),
    question('ceed-2024-paper1', ['quality']), question('ceed-2024-paper2', undefined),
    question('ceed-no-year', [], null),
  ]).map(({ paperId, questionCount }) => [paperId, questionCount]), [
    ['ceed-2024-paper1', 1], ['ceed-2024-paper2', 1],
  ]);
});

test('generated public metadata matches the canonical export without prompts, answers or media paths', () => {
  const bank = JSON.parse(fs.readFileSync(new URL('../../../server/data/exports/dexam-bank-export.json', import.meta.url), 'utf8'));
  assert.deepEqual(generated, yearPaperCatalogue(bank.questions));
  assert.ok(generated.some(paper => paper.exam === 'uceed'));
  assert.ok(generated.some(paper => paper.exam === 'ceed'));
  assert.equal(generated.some(paper => paper.exam === 'nift'), false);
  assert.ok(generated.some(paper => paper.exam === 'nid'));
  for (const paper of generated) {
    assert.equal(paper.keyedCount <= paper.questionCount, true);
    assert.equal('prompt' in paper, false);
    assert.equal('answer' in paper, false);
    assert.equal('assets' in paper, false);
  }
});

test('paper labels distinguish samples and multiple papers', () => {
  assert.equal(paperLabel({ exam: 'ceed', year: 2016, paperId: 'ceed-2016-paper2' }), '2016 · Paper 2');
  assert.equal(paperLabel({ exam: 'nid', year: 2024, paperId: 'nid-bdes-sample-2024' }), '2024 sample paper');
});
