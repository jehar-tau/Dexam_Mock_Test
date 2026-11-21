import assert from 'node:assert/strict';
import test from 'node:test';
import { assessmentExams } from '../src/catalogue-data.js';
import { examGuides, initialCatalogueExam } from '../src/exam-guides.js';

test('all supported exams have a sourced guide without release or bank fields', () => {
  assert.deepEqual(Object.keys(examGuides).sort(), [...assessmentExams].sort());
  for (const guide of Object.values(examGuides)) {
    assert.equal(new URL(guide.source).protocol, 'https:');
    assert.ok(guide.sections.length);
    for (const key of ['questionCount','ready','freeAttemptLimit','bankCount']) assert.equal(key in guide, false);
  }
  assert.equal(examGuides.nid.sample.answer, undefined);
});

test('the catalogue opens a ready exam first and tolerates unpublished or empty catalogues', () => {
  assert.equal(initialCatalogueExam([]), 'uceed');
  const rows = [{exam:'nid', enabled:true, ready:false}, {exam:'nift', enabled:true, ready:true}];
  assert.equal(initialCatalogueExam(rows), 'nift');
  assert.equal(initialCatalogueExam(rows.slice(0,1)), 'nid');
});
