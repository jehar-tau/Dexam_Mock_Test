import assert from 'node:assert/strict';
import test from 'node:test';
import {buildAllIndiaPlan, validateAllIndiaPlan} from '../scripts/all-india-paper.mjs';
import {sha256, stableJson} from '../scripts/question-bank-import.mjs';

const figure = {sha256: 'e'.repeat(64), width: 640, height: 480, byteSize: 2048};
const figures = new Map([['fictional-q1-1.svg', figure]]);
const explanation = {keyIdea: 'Fictional key idea for the test.', steps: ['First step.', 'Second step.'], trap: 'A tempting wrong answer.', fast: ''};

function paper(overrides = {}) {
  return {
    paperId: 'uceed-aim-9', exam: 'uceed', title: 'Fictional UCEED All-India Mock', pattern: 'Fictional pattern',
    questions: [
      {key: 'uceed-aim-9-q1', part: 'A', n: 1, type: 'NAT', prompt: 'How many fictional cubes are there?', options: [], answer: '12',
        figs: ['fictional-q1-1.svg'], explanation, topic: 'spatial-reasoning', subtopic: 'counting', difficulty: 'hard'},
      {key: 'uceed-aim-9-q2', part: 'A', n: 2, type: 'MSQ', prompt: 'Which fictional options apply?',
        options: [{key: 'A', text: 'One'}, {key: 'B', text: 'Two'}, {key: 'C', text: 'Three'}, {key: 'D', text: 'Four'}],
        answer: 'C,A', figs: [], explanation, topic: 'visual-reasoning'},
      {key: 'uceed-aim-9-q3', part: 'A', n: 3, type: 'MCQ', prompt: 'Which fictional option is right?',
        options: [{key: 'A', text: 'One'}, {key: 'B', text: 'Two'}, {key: 'C', text: 'Three'}, {key: 'D', text: 'Four'}],
        answer: 'B', figs: [], explanation, topic: 'design-knowledge'},
      {key: 'uceed-aim-9-b1', part: 'B', n: 1, type: 'DESCRIPTIVE', prompt: 'Draw a fictional reading corner.', options: [], answer: null,
        figs: [], explanation: {keyIdea: '', steps: '', trap: ''}, topic: 'drawing-creative', marks: 50,
        criteria: [['Composition', 25], ['Line quality', 25]]},
    ],
    ...overrides,
  };
}

test('an original paper becomes a hidden-source plan with official UCEED marking', () => {
  const {plan, summary} = buildAllIndiaPlan(paper(), figures);
  assert.equal(summary.objectiveCount, 3);
  assert.equal(summary.drawingCount, 1);
  assert.equal(summary.totalMarks, 4 + 4 + 3 + 50);
  assert.equal(plan.durationSeconds, 10800);
  assert.equal(plan.uploadGraceSeconds, 600);
  assert.deepEqual(plan.questions.map(item => item.externalKey), ['uceed-aim-9-q1', 'uceed-aim-9-q2', 'uceed-aim-9-q3', 'uceed-aim-9-b1']);
  const [nat, msq, mcq, drawing] = plan.questions.map(item => item.runtime);
  assert.deepEqual(nat.key, {kind: 'nat', accepted: [{exact: '12'}], sourceExternalKey: 'uceed-aim-9-q1'});
  assert.deepEqual(nat.marking, {correct: 4, wrong: 0});
  assert.deepEqual(nat.media, [{path: `papers/canonical/${'e'.repeat(64)}.png`, alt: 'Question figure 1', sha256: 'e'.repeat(64), width: 640, height: 480}]);
  assert.deepEqual(msq.key.correct, ['A', 'C']);
  assert.deepEqual(msq.marking, {correct: 4, wrong: -1, partial: true});
  assert.deepEqual(mcq.marking, {correct: 3, wrong: -0.71});
  assert.equal(mcq.negativePoints, 0.71);
  assert.match(mcq.explanation, /^Key idea: Fictional key idea[\s\S]*1\. First step\.[\s\S]*Trap: A tempting wrong answer\.$/);
  assert.deepEqual(drawing.marking, {correct: 50, wrong: 0, humanReview: true});
  assert.equal(drawing.explanation, 'Marked by a teacher out of 50 on: Composition (25); Line quality (25).');
  for (const item of plan.questions) {
    assert.equal(item.payload.sourceKind, 'original');
    assert.equal(item.payload.licence, 'dmocks-original');
    assert.deepEqual(item.payload.holds, []);
    assert.equal(item.payload.provenance.kind, 'all-india-mock');
    assert.equal(item.payload.provenance.paperId, 'uceed-aim-9');
    assert.equal(item.contentSha256, sha256(stableJson(item.payload)));
  }
  assert.equal(summary.planSha256, sha256(stableJson(plan)));
});

test('a drawing-only NID paper keeps each task\'s own marks', () => {
  const nid = paper({paperId: 'nid-bdes-aim-9', exam: 'nid', title: 'Fictional NID All-India Mock', questions: [
    {key: 'nid-bdes-aim-9-q1', part: 'A', n: 1, type: 'DESCRIPTIVE', prompt: 'Q1 (20 marks) Illustrate three fictional scenes.', options: [],
      answer: null, figs: ['fictional-q1-1.svg'], explanation, topic: 'drawing-creative', marks: 20, criteria: [['Story', 10], ['Drawing', 10]]},
    {key: 'nid-bdes-aim-9-q2', part: 'A', n: 2, type: 'DESCRIPTIVE', prompt: 'Q2 (15 marks) Propose three fictional measures.', options: [],
      answer: null, figs: [], explanation, topic: 'drawing-creative', marks: 15, criteria: [['Ideas', 15]]},
  ]});
  const {plan, summary} = buildAllIndiaPlan(nid, figures);
  assert.equal(summary.objectiveCount, 0);
  assert.equal(summary.drawingCount, 2);
  assert.equal(summary.totalMarks, 35);
  assert.deepEqual(plan.questions.map(item => [item.externalKey, item.runtime.points]), [['nid-bdes-aim-9-b1', 20], ['nid-bdes-aim-9-b2', 15]]);
  assert.match(plan.questions[0].runtime.explanation, /^Marked by a teacher out of 20 on: Story \(10\); Drawing \(10\)\.\n\nKey idea:/);
});

test('answers, figures and edits that do not match are rejected', () => {
  const bad = paper();
  bad.questions[2].answer = 'E';
  assert.throws(() => buildAllIndiaPlan(bad, figures), /answer does not match/);
  const twoMcq = paper();
  twoMcq.questions[2].answer = 'A,B';
  assert.throws(() => buildAllIndiaPlan(twoMcq, figures), /answer does not match/);
  assert.throws(() => buildAllIndiaPlan(paper(), new Map()), /was not rendered/);
  assert.throws(() => buildAllIndiaPlan(paper({paperId: 'uceed-2026'}), figures), /aim-<n>/);
  assert.throws(() => buildAllIndiaPlan(paper({exam: 'nift', paperId: 'nift-aim-9'}), figures), /No owner-approved clock/);
  const {plan} = buildAllIndiaPlan(paper(), figures);
  const edited = structuredClone(plan);
  edited.questions[0].payload.prompt = 'Changed after review';
  assert.throws(() => validateAllIndiaPlan(edited), /Invalid All India question/);
  const total = structuredClone(plan);
  total.totalMarks = 1;
  assert.throws(() => validateAllIndiaPlan(total), /total does not match/);
});
