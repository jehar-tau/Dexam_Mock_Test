import assert from 'node:assert/strict';
import test from 'node:test';
import { conversionChecklist, nidQuestionPractice, practiceApprovalReady, questionUsage } from '../src/bank-review.js';
function question() {
  const b = { id: 'binding', externalKey: 'original-nid', contentSha256: 'a'.repeat(64), current: true, sectionOrdinal: 1,
    blueprint: { id: 'blueprint', revision: 2, currentRevision: 2, sha256: 'b'.repeat(64), status: 'reviewed', payload: { schemaVersion: 'nid-authored-practice-v1', title: 'Original practice', purpose: 'An explicitly authored original fictional observation exercise.', durationMinutes: 37, uploadGraceMinutes: 0,
      sections: [{ label: 'Original observation', kind: 'mcq', count: 3, points: 2.5, penalty: 0.25, rubric: [] }] } } };
  return { externalKey: b.externalKey, contentSha256: b.contentSha256, exam: 'nid', type: 'MCQ', active: true, media: [], options: ['A', 'B', 'C'].map(key => ({ key, text: 'Original option ' + key })), answer: { raw: 'B' }, runtimeReady: false,
    nidPractice: { binding: b, canConvert: true, materialized: false } };
}
test('a reviewed authored NID binding explains the exact scheme while conversion and question approval remain separate', () => {
  const q = question(), usage = questionUsage(q);
  assert.equal(usage.section, 'Authored practice · Original observation'); assert.match(usage.scoring, /2\.5.*0\.25/); assert.equal(usage.duration, '37 practice minutes');
  assert.equal(practiceApprovalReady(q), false); assert.equal(conversionChecklist(q)[0].state, 'queue'); assert.match(conversionChecklist(q)[0].label, /guarded conversion/);
  q.runtimeReady = true; q.nidPractice.materialized = true;
  assert.equal(practiceApprovalReady(q), false, 'a materialized flag alone cannot replace the exact context');
  q.context = { version: 'nid-authored-practice-v1', bindingId: 'binding', blueprintId: 'blueprint', blueprintRevision: 2, blueprintSha256: 'b'.repeat(64) };
  assert.equal(practiceApprovalReady(q), true); assert.equal(conversionChecklist(q)[0].state, 'ready'); assert.match(conversionChecklist(q)[0].label, /DMocks-authored practice/);
});
test('wrong question/source/revision, stale bindings and legacy NID runtime flags never claim verified use', () => {
  for (const change of [q => { q.nidPractice.binding.current = false; }, q => { q.nidPractice.binding.externalKey = 'other'; }, q => { q.nidPractice.binding.contentSha256 = 'c'.repeat(64); },
    q => { q.nidPractice.binding.blueprint.currentRevision = 3; }, q => { q.nidPractice.binding.blueprint.status = 'draft'; }, q => { q.nidPractice.binding.blueprint.payload.durationMinutes = 0; }, q => { delete q.nidPractice; }]) {
    const q = question(); q.runtimeReady = true; change(q); assert.equal(nidQuestionPractice(q), null); assert.equal(practiceApprovalReady(q), false); assert.equal(conversionChecklist(q)[0].state, 'blocked');
  }
});
test('human criteria and upload time are clearly authored, and source availability still blocks use', () => {
  const q = question(), p = q.nidPractice.binding.blueprint.payload;
  q.type = 'DESCRIPTIVE'; p.uploadGraceMinutes = 15; Object.assign(p.sections[0], { kind: 'written', points: 10, penalty: 0, rubric: [{ label: 'Reasoning', points: 10, guidance: 'Credit explicitly explained original fictional reasoning.' }] });
  assert.match(questionUsage(q).scoring, /10 maximum marks/); assert.match(questionUsage(q).duration, /15 minutes to upload/);
  q.media = [{ ordinal: 1, available: false }]; q.holdReason = 'Original fictional correction hold';
  assert.deepEqual(conversionChecklist(q).map(issue => issue.state), ['queue', 'blocked', 'fix']);
});
