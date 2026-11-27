import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { yearPaperCatalogue, paperLabel, paperSubtitle } from '../src/paper-years.mjs';
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
  assert.ok(generated.some(paper => paper.exam === 'nift'));
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

test('card subtitles keep same-year NID B.Des. and M.Des. papers apart', () => {
  assert.equal(paperSubtitle({ exam: 'uceed', year: 2026, paperId: 'uceed-2026' }), 'Question paper');
  assert.equal(paperSubtitle({ exam: 'ceed', year: 2016, paperId: 'ceed-2016-paper2' }), 'Paper 2');
  assert.equal(paperSubtitle({ exam: 'nid', year: 2018, paperId: 'nid-bdes-2018' }), 'B.Des. question paper');
  assert.equal(paperSubtitle({ exam: 'nid', year: 2018, paperId: 'nid-mdes-2018' }), 'M.Des. question paper');
  assert.equal(paperSubtitle({ exam: 'nid', year: 2024, paperId: 'nid-bdes-sample-2024' }), 'B.Des. sample paper');
});

test('NIFT GAT papers say GAT, and every paper belongs to the B.Des. or M.Des. list', async () => {
  const { paperSubtitle: subtitle, paperProgramme, inProgramme, programmeFromQuery } = await import('../src/paper-years.mjs');
  assert.equal(subtitle({ exam: 'nift', year: 2026, paperId: 'nift-2026-bdes-gat' }), 'B.Des. GAT paper');
  assert.equal(subtitle({ exam: 'nift', year: 2025, paperId: 'nift-2025-mdes-gat' }), 'M.Des. GAT paper');
  assert.equal(subtitle({ exam: 'nid', year: 2025, paperId: 'nid-mdes-sample-2025' }), 'M.Des. sample paper');
  assert.equal(subtitle({ exam: 'nid', year: 2025, paperId: 'nid-mdes-sample-2025' }, false), 'Sample paper');
  assert.equal(subtitle({ exam: 'nift', year: 2026, paperId: 'nift-2026-bdes-gat' }, false), 'GAT paper');
  assert.equal(paperProgramme({ exam: 'uceed', paperId: 'uceed-2026' }), 'B.Des.');
  assert.equal(paperProgramme({ exam: 'ceed', paperId: 'ceed-2026' }), 'M.Des.');
  assert.equal(paperProgramme({ exam: 'nid', paperId: 'nid-mdes-2018' }), 'M.Des.');
  assert.equal(paperProgramme({ exam: 'nift', paperId: 'nift-2026-bdes-gat' }), 'B.Des.');
  assert.equal(inProgramme({ exam: 'ceed', paperId: 'ceed-2026' }, 'B.Des.'), false);
  assert.equal(inProgramme({ exam: 'nift', paperId: 'nift-2026' }, 'B.Des.'), true);
  assert.equal(inProgramme({ exam: 'nift', paperId: 'nift-2026' }, 'M.Des.'), true);
  assert.equal(programmeFromQuery(new URLSearchParams('programme=mdes')), 'M.Des.');
  assert.equal(programmeFromQuery(new URLSearchParams('programme=x')), '');
});
