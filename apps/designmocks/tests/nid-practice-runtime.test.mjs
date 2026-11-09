import assert from 'node:assert/strict';
import test from 'node:test';
import { nidPracticeRuntime } from '../scripts/nid-practice-runtime.mjs';
import { RULES_2027, runtimeQuestion } from '../scripts/question-runtime.mjs';
import { compileNidPracticePlan, nidPracticeOperator } from '../scripts/materialize-nid-practice.mjs';
import { sha256, stableJson } from '../scripts/question-bank-import.mjs';
const bindingId = '10000000-0000-4000-8000-000000002251', blueprintId = '20000000-0000-4000-8000-000000002251';
const sourceSha = 'a'.repeat(64), imageSha = 'b'.repeat(64);
const options = ['A', 'B', 'C'].map(key => ({ key, text: 'Original option ' + key }));
function fixture(kind = 'mcq') {
  const human = ['drawing', 'written'].includes(kind);
  const question = { externalKey: 'nid-original-fictional', provenance: { exam: 'nid' }, type: human ? 'DESCRIPTIVE' : kind.toUpperCase(), topic: 'observation', prompt: 'Original fictional practice task.', holds: [], assets: [], visualDependency: false, options: human || kind === 'nat' ? [] : options,
    answer: human ? null : { status: 'human-reviewed', raw: kind === 'msq' ? 'BA' : kind === 'nat' ? '1.000000000000000001 or 1.000000000000000002' : 'B' } };
  const section = { label: 'Original practice section', kind, count: 2, points: human ? 0.3 : 2.5, penalty: human || kind === 'nat' ? 0 : 0.25,
    rubric: human ? [{ label: 'Observation', points: 0.1, guidance: 'Credit clearly observed fictional relationships.' }, { label: 'Communication', points: 0.2, guidance: 'Credit clear original fictional communication.' }] : [] };
  const binding = { id: bindingId, externalKey: question.externalKey, contentSha256: sourceSha, sourceVersion: 'c'.repeat(64), current: true, sectionOrdinal: 1,
    blueprint: { id: blueprintId, revision: 3, currentRevision: 3, sha256: 'd'.repeat(64), status: 'reviewed', payload: { schemaVersion: 'nid-authored-practice-v1', title: 'Original fictional practice', purpose: 'An explicitly authored fictional practice scheme for private review.', durationMinutes: 37, uploadGraceMinutes: human ? 15 : 0, sections: [section] } } };
  return { question, binding };
}
test('NID practice keeps three choices and explicit marking/clock without modifying official rules', () => {
  const { question, binding } = fixture();
  const { runtime, issues } = nidPracticeRuntime(question, binding);
  assert.deepEqual(issues, []); assert.equal(runtime.options.length, 3);
  assert.deepEqual(runtime.key, { kind: 'mcq', correct: ['B'], sourceExternalKey: question.externalKey, practiceContext: runtime.context });
  assert.deepEqual(runtime.marking, { correct: 2.5, wrong: -0.25 }); assert.equal(runtime.context.durationSeconds, 2220);
  assert.equal(runtime.context.blueprintRevision, 3); assert.equal(runtime.context.scope, 'authored-practice');
  assert.equal(runtime.context.cycle, undefined); assert.equal(RULES_2027.nid, undefined);
  assert.equal(runtimeQuestion(question, { rule: RULES_2027.uceed }), null);
});
test('text-only drawing and written uploads use the reviewed exact decimal rubric and explicit grace', () => {
  for (const kind of ['drawing', 'written']) {
    const { question, binding } = fixture(kind), result = nidPracticeRuntime(question, binding);
    assert.deepEqual(result.issues, []); assert.equal(result.runtime.kind, 'drawing'); assert.equal(result.runtime.points, 0.3);
    assert.equal(result.runtime.marking.humanReview, true); assert.deepEqual(result.runtime.media, []);
    assert.equal(result.runtime.context.uploadGraceSeconds, 900); assert.equal(result.runtime.context.responseKind, kind);
    assert.deepEqual(result.runtime.context.rubric.map(value => value.points), [0.1, 0.2]); assert.equal(result.runtime.key.correct, undefined);
    binding.blueprint.payload.sections[0].rubric[0].points = 99;
    assert.equal(result.runtime.key.practiceContext.rubric[0].points, 0.1, 'frozen rubric is detached from the input design object');
  }
});
test('source-declared required figures need exact verified digests, dimensions and canonical paths', () => {
  const { question, binding } = fixture('drawing'); question.visualDependency = true;
  assert.equal(nidPracticeRuntime(question, binding).runtime, null);
  question.assets = [{ sha256: imageSha, width: 1, height: 1 }];
  const media = [{ sha256: imageSha, path: `papers/canonical/${imageSha}.png`, width: 1, height: 1, byteSize: 69 }];
  assert.equal(nidPracticeRuntime(question, binding, media).runtime.media[0].sha256, imageSha);
  for (const wrong of [{ ...media[0], width: 2 }, { ...media[0], path: 'unverified.png' }, { ...media[0], byteSize: 44 }]) assert.equal(nidPracticeRuntime(question, binding, [wrong]).runtime, null);
  question.visualDependency = 'false'; assert.equal(nidPracticeRuntime(question, binding, media).runtime, null);
});
test('practice set scoring stays exact-set and exact numeric alternatives stay strings', () => {
  let f = fixture('msq'), runtime = nidPracticeRuntime(f.question, f.binding).runtime;
  assert.deepEqual(runtime.key.correct, ['A', 'B']); assert.equal(runtime.marking.partial, undefined);
  f = fixture('nat'); runtime = nidPracticeRuntime(f.question, f.binding).runtime;
  assert.deepEqual(runtime.key.accepted, [{ exact: '1.000000000000000001' }, { exact: '1.000000000000000002' }]);
  for (const raw of ['1 or 1', '1 to 2 or 3', '1/2', '1,2', '1 or', '2 to 1']) { f.question.answer.raw = raw; assert.equal(nidPracticeRuntime(f.question, f.binding).runtime, null); }
  f.question.answer.raw = '-1 to -0.5'; assert.deepEqual(nidPracticeRuntime(f.question, f.binding).runtime.key.accepted, [{ range: ['-1', '-0.5'] }]);
});
test('pending/missing/inconsistent source answers and unresolved holds cannot be converted', () => {
  const changes = [q => { q.answer.status = 'pending'; }, q => { q.answer.raw = ''; }, q => { q.answer.raw = ['B']; }, q => { q.answer.raw = 'D'; },
    q => { q.holds = ['human-review']; }, q => { delete q.holds; }, q => { q.options[1] = q.options[0]; }, q => { q.options[0] = { key: 'A', text: '' }; }, q => { q.options[0] = { key: 'A', text: 'Original', asset: 'unmapped.png' }; }];
  for (const change of changes) { const f = fixture(); f.question.options = structuredClone(f.question.options); change(f.question); assert.equal(nidPracticeRuntime(f.question, f.binding).runtime, null); }
});
test('a stale, unreviewed, mismatched or malformed authored binding fails closed', () => {
  const changes = [f => { f.binding.current = false; }, f => { f.binding.current = 'true'; }, f => { f.binding.externalKey = 'other'; }, f => { f.binding.sectionOrdinal = 0; },
    f => { f.binding.blueprint.status = 'draft'; }, f => { f.binding.blueprint.currentRevision = 4; }, f => { f.binding.blueprint.sha256 = 'invalid'; },
    f => { f.binding.blueprint.payload.sections[0].kind = 'nat'; }, f => { f.binding.blueprint.payload.durationMinutes = 0; }, f => { f.question.provenance.exam = 123; }];
  for (const change of changes) { const f = fixture(); change(f); assert.equal(nidPracticeRuntime(f.question, f.binding).runtime, null); }
});
test('the operator compares its complete runtime to the server and the exact canonical source hash', () => {
  const { question, binding } = fixture(), manifest = { sourceCommit: 'e'.repeat(40), sourceSha256: 'f'.repeat(64), records: [{ externalKey: question.externalKey, contentSha256: sourceSha, exam: 'nid', payload: question }] };
  const row = { externalKey: question.externalKey, contentSha256: sourceSha, binding, runtime: nidPracticeRuntime(question, binding).runtime };
  let plan = compileNidPracticePlan(manifest, [row], []); assert.equal(plan.ready, 1); assert.equal(plan.records[0].bindingId, bindingId);
  assert.equal(plan.planSha256, sha256(stableJson(plan.records))); assert.equal(compileNidPracticePlan(manifest, [], []).withoutBinding, 1);
  assert.throws(() => compileNidPracticePlan(manifest, [{ ...row, contentSha256: '0'.repeat(64) }], []), /source changed/);
  assert.throws(() => compileNidPracticePlan(manifest, [{ ...row, runtime: { ...row.runtime, points: 99 } }], []), /disagree/);
  assert.throws(() => compileNidPracticePlan(manifest, [row, row], []), /Duplicate practice/);
  assert.equal(compileNidPracticePlan(manifest, [{ ...row, externalKey: 'outside-eligible-source' }], []).outsideCanonical, 1);
  const stale = { ...binding, current: false }; plan = compileNidPracticePlan(manifest, [{ ...row, binding: stale, runtime: null }], []); assert.equal(plan.ready, 0); assert.equal(plan.unavailable.length, 1);
});
test('the operator permits only the independent service target, bounded pages and exact plan replay', async () => {
  const ref = 'a'.repeat(20), url = 'https://' + ref + '.supabase.co';
  const key = role => 'x.' + Buffer.from(JSON.stringify({ role, ref })).toString('base64url') + '.x';
  const config = { url, allowOrigin: url, environment: 'staging', serviceRoleKey: key('service_role') };
  const local = 'http://127.0.0.1:63321';
  await assert.rejects(nidPracticeOperator({ ...config, url: local, allowOrigin: local }), /different provider project/);
  await assert.rejects(nidPracticeOperator({ ...config, serviceRoleKey: key('authenticated') }), /server-only/);
  const native = globalThis.fetch, calls = [];
  let repeatPage = false;
  try {
    globalThis.fetch = async (address, options) => {
      const body = JSON.parse(options.body);
      calls.push([address, body]);
      if (address.endsWith('admin_operational_health')) return Response.json({ scope: 'paid-mvp-v1', monitorVersion: 1, apiProfileReady: true });
      if (address.endsWith('nid_practice_runtime_plan')) return Response.json(repeatPage ? { items: [{ externalKey: 'repeated' }], nextKey: 'repeated' } : { items: [], nextKey: null });
      return Response.json(body.p_records.length);
    };
    const operator = await nidPracticeOperator(config); assert.deepEqual(await operator.bindings(), []);
    assert.deepEqual(calls[1][1], { p_after_key: null, p_limit: 100 });
    assert.equal(await operator.apply({ records: [], planSha256: sha256('[]') }), 0);
    await assert.rejects(operator.apply({ records: [], planSha256: '0'.repeat(64) }), /plan changed/);
    repeatPage = true;
    await assert.rejects(operator.bindings(), /Duplicate practice page/);
  } finally { globalThis.fetch = native; }
});
