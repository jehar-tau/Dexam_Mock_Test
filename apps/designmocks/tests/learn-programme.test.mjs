import assert from 'node:assert/strict';
import test from 'node:test';
import { programmes, findProgramme } from '../src/learn/programmes/index.js';
import { checkAnswer, generateQuestion, hasResponse, kindInfo, markFor, maxMarks, questionKinds } from '../src/learn/questions.js';
import {
  completeLesson, emptyProgress, findLesson, lessonState, lessonsOf, programmeSummary, quizLength, quizPassed, readProgress, recordPractice, recordQuiz, recordStep, stepResult, tiersOf, validateProgramme,
} from '../src/learn/programme-model.js';
import { clearProgress, loadProgress, saveProgress } from '../src/learn/programme-storage.js';

const toolNames = ['fold-explorer', 'opposite-explorer', 'worked-cube', 'net-builder', 'fold-punch', 'mirror', 'stack-builder', 'colour-wheel', 'unfolder', 'gear-train', 'lever-bench', 'figure-counter', 'cut-unfolder', 'mirror-lab', 'number-lab', 'logic-lab', 'solid-turner', 'die-roller', 'rule-mixer', 'colour-mixer', 'sun-table', 'surface-explorer', 'section-slicer', 'piece-fitter', 'sheet-stacker', 'feature-scanner', 'perspective-box'];
const rightResponse = q => (q.answerMode === 'numeric' ? String(q.answer.value ?? q.answer.min) : q.answer);
const wrongResponse = q => (q.answerMode === 'numeric' ? String((q.answer.value ?? q.answer.max) + 1) : q.answerMode === 'multi' ? [q.options.find(o => !q.answer.includes(o.id)).id] : q.options.find(o => o.id !== q.answer).id);

test('every registered programme validates and every lesson question can be answered and marked', () => {
  assert.deepEqual(programmes.map(p => p.slug), ['cube-nets', 'nets-of-solids', 'dice', 'paper-folding', 'mirror-images', 'counting-cubes', 'views-and-rotation', 'mechanisms', 'counting-figures', 'quant', 'codes-patterns', 'arrangements', 'directions', 'visual-patterns', 'colour-basics', 'shadows-and-light', 'solid-surfaces', 'sections', 'fit', 'overlays', 'observation-skills', 'perspective', 'crafts', 'art-history', 'product-design', 'posters', 'storyboarding', 'everyday-physics']);
  for (const programme of programmes) {
    assert.equal(validateProgramme(programme), programme);
    for (const lesson of lessonsOf(programme)) for (const step of lesson.steps) {
      if (step.kind === 'slide' && step.tool) assert.ok(toolNames.includes(step.tool), `${programme.slug}/${lesson.id}/${step.id} uses a known tool`);
      if (!['check', 'hook', 'worked'].includes(step.kind)) continue;
      const where = `${programme.slug}/${lesson.id}/${step.id}`;
      const question = generateQuestion(step.question.kind, step.question.seed, step.question.level);
      assert.ok(question.explanation.length > 20, `${where} explains`);
      if (question.level >= 3) { assert.ok(question.hints.length >= 1, `${where} has a hint`); assert.ok(question.solution.length >= 3, `${where} has solution steps`); }
      if (question.interactive) continue;
      assert.ok(checkAnswer(question, rightResponse(question)).correct, where);
      assert.equal(checkAnswer(question, wrongResponse(question)).correct, false, where);
    }
    for (const tier of tiersOf(programme)) assert.ok(quizLength(tier.quiz) >= 5);
  }
  const cubeNets = findProgramme('cube-nets');
  assert.equal(lessonsOf(cubeNets).length, 12);
  assert.deepEqual(tiersOf(cubeNets).map(t => [t.id, t.lessons.length, quizLength(t.quiz)]), [['foundations', 5, 10], ['exam-standard', 3, 8], ['exam-hard', 3, 8], ['mastery', 1, 12]]);
  assert.equal(quizLength(tiersOf(cubeNets)[0].quiz), 10);
  assert.equal(findProgramme('missing'), null);
});

test('the reference programme climbs four tiers to an exam-marked set', () => {
  const programme = findProgramme('counting-cubes');
  const tiers = tiersOf(programme);
  assert.deepEqual(tiers.map(t => [t.id, t.level]), [['foundations', 2], ['exam-standard', 3], ['exam-hard', 4], ['mastery', 5]]);
  assert.equal(tiers[3].quiz.marking, 'uceed');
  assert.equal(quizLength(tiers[3].quiz), 12);
  for (const tier of tiers.slice(1, 3)) for (const lesson of tier.lessons) {
    const kinds = lesson.steps.map(s => s.kind);
    assert.equal(kinds[0], 'hook', `${lesson.id} opens with a hook`);
    assert.ok(kinds.includes('worked') && kinds.includes('practice'), `${lesson.id} has a worked example and practice`);
    const hook = lesson.steps[0].question, again = lesson.steps.find(s => s.id === 'check-hook').question;
    assert.deepEqual(again, hook, `${lesson.id} returns to its hook`);
    for (const step of lesson.steps.filter(s => s.kind === 'check')) assert.equal(generateQuestion(step.question.kind, step.question.seed, step.question.level).answerMode, 'numeric');
  }
});

test('every question kind is deterministic at every level it supports', () => {
  for (const kind of questionKinds) for (const level of kindInfo(kind).levels) {
    for (let seed = 1; seed <= 30; seed++) {
      const a = generateQuestion(kind, seed, level), b = generateQuestion(kind, seed, level);
      assert.deepEqual(a, b, `${kind} L${level} ${seed} deterministic`);
      assert.equal(a.level, level);
      assert.ok(Array.isArray(a.figures) && ['single', 'multi', 'numeric'].includes(a.answerMode));
      if (a.interactive) continue;
      if (a.answerMode === 'multi') { assert.ok(Array.isArray(a.answer) && a.answer.length >= 1 && a.answer.length <= 3 && a.answer.every(id => a.options.some(o => o.id === id))); continue; }
      if (a.answerMode === 'numeric') { assert.ok(Number.isFinite(a.answer.value ?? a.answer.min)); assert.ok(a.mistakes.every(m => m.value !== a.answer.value && m.reason.length > 10)); continue; }
      assert.equal(a.options.length, kind === 'is-net' ? 2 : 4, `${kind} ${seed} option count`);
      assert.equal(new Set(a.options.map(o => o.id)).size, a.options.length);
      assert.ok(a.options.every(o => o.figure || o.text || o.label));
      assert.equal(a.options.filter(o => o.id === a.answer).length, 1);
    }
  }
  assert.equal(generateQuestion('count-cubes', 5).level, 1, 'the lowest level is the default');
  assert.throws(() => generateQuestion('count-cubes', 5, 2), /does not support level 2/);
  assert.throws(() => generateQuestion('nope', 1), /Unknown question kind/);
  assert.equal(kindInfo('nope'), null);
});

test('answers are checked and marked in all three modes under every scheme', () => {
  const numeric = generateQuestion('views-min', 3, 4);
  assert.equal(hasResponse(numeric, ''), false);
  assert.equal(hasResponse(numeric, 'abc'), false);
  assert.equal(hasResponse(numeric, ' 23 '), true);
  assert.ok(checkAnswer(numeric, '23').correct);
  const slip = checkAnswer(numeric, String(numeric.mistakes[0].value));
  assert.equal(slip.correct, false);
  assert.ok(slip.feedback.startsWith(numeric.mistakes[0].reason) && slip.feedback.includes('The answer is 23 cubes.'));
  assert.deepEqual([markFor(numeric, '23', 'uceed'), markFor(numeric, '24', 'uceed'), markFor(numeric, '', 'uceed'), maxMarks(numeric, 'uceed')], [4, 0, 0, 4]);
  assert.equal(markFor({ ...numeric, answer: { min: 2.4, max: 2.6 } }, '2.5', 'ceed'), 4);
  assert.equal(markFor({ ...numeric, answer: { min: 2.4, max: 2.6 } }, '2.7', 'ceed'), 0);

  const single = generateQuestion('count-box', 3);
  const wrong = single.options.find(o => o.id !== single.answer).id;
  assert.deepEqual([markFor(single, single.answer, 'uceed'), markFor(single, wrong, 'uceed'), markFor(single, null, 'uceed')], [3, -0.71, 0]);
  assert.deepEqual([markFor(single, wrong, 'ceed'), markFor(single, single.answer, 'nift'), markFor(single, wrong, 'nift'), markFor(single, wrong, 'plain')], [-0.5, 1, -0.25, 0]);

  const multi = { kind: 'demo', answerMode: 'multi', answer: ['a', 'b', 'c'], explanation: 'Because.', options: ['a', 'b', 'c', 'd'].map(id => ({ id, label: id.toUpperCase(), reason: `Reason ${id}.` })) };
  assert.ok(checkAnswer(multi, ['c', 'a', 'b']).correct);
  assert.deepEqual(checkAnswer(multi, ['a']).partial, { rightChosen: 1, wrongChosen: 0, missed: 2 });
  assert.match(checkAnswer(multi, ['a']).feedback, /^You found 1 of 3\. Reason b\./);
  assert.match(checkAnswer(multi, ['a', 'd']).feedback, /^Reason d\./);
  // UCEED and CEED: exact 4; an all-correct proper subset earns its size; any wrong choice −1; blank 0.
  assert.deepEqual([['a', 'b', 'c'], ['a', 'b'], ['a'], ['a', 'd'], ['d'], []].map(r => markFor(multi, r, 'uceed')), [4, 2, 1, -1, -1, 0]);
  assert.deepEqual([['a', 'b', 'c'], ['a', 'b'], ['d']].map(r => markFor(multi, r, 'plain')), [1, 0, 0]);
  assert.throws(() => markFor(multi, ['a'], 'gate'), /Unknown marking scheme/);
});

// Every programme may now be tiered, so the v1 shape (lessons plus a challenge) is rebuilt from the cube nets Foundations tier.
function v1Programme() {
  const programme = JSON.parse(JSON.stringify(findProgramme('cube-nets')));
  const [foundations] = programme.tiers;
  delete programme.tiers;
  return { ...programme, lessons: foundations.lessons, challenge: { title: 'Cube net challenge', minutes: 10, description: foundations.quiz.description, questions: foundations.quiz.questions.map(({ kind, count }) => ({ kind, count })) } };
}

test('programme validation names the broken part', () => {
  const clone = slug => (slug === 'cube-nets' ? v1Programme() : JSON.parse(JSON.stringify(findProgramme(slug))));
  assert.ok(validateProgramme(clone('cube-nets')), 'the v1 shape still validates');
  assert.equal(tiersOf(clone('cube-nets'))[0].quiz.pass, 7, 'a v1 challenge passes at 70%');
  assert.throws(() => validateProgramme({ ...clone('cube-nets'), slug: 'Bad Slug' }), /slug/);
  assert.throws(() => validateProgramme({ ...clone('cube-nets'), exams: ['jee'] }), /exams/);
  const dupe = clone('cube-nets'); dupe.lessons[1].id = dupe.lessons[0].id;
  assert.throws(() => validateProgramme(dupe), /lesson id/);
  const kind = clone('cube-nets'); kind.lessons[0].steps.find(s => s.kind === 'check').question.kind = 'unknown';
  assert.throws(() => validateProgramme(kind), /question kind/);
  const slide = clone('cube-nets'); slide.lessons[0].steps[0].text = 'short';
  assert.throws(() => validateProgramme(slide), /slide text/);
  const ending = clone('cube-nets'); ending.lessons[0].steps.pop();
  assert.throws(() => validateProgramme(ending), /take-away/);
  const recipe = clone('cube-nets'); recipe.challenge.questions[0].count = 0;
  assert.throws(() => validateProgramme(recipe), /challenge recipe/);

  const order = clone('counting-cubes'); [order.tiers[1], order.tiers[2]] = [order.tiers[2], order.tiers[1]];
  assert.throws(() => validateProgramme(order), /tier id or order/);
  const level = clone('counting-cubes'); level.tiers[1].lessons[0].steps.find(s => s.kind === 'check').question.level = 2;
  assert.throws(() => validateProgramme(level), /question level/);
  const worked = clone('counting-cubes'); Object.assign(worked.tiers[1].lessons[0].steps.find(s => s.kind === 'worked').question, { kind: 'count-box', level: 2 });
  assert.throws(() => validateProgramme(worked), /no solution steps/);
  const streak = clone('counting-cubes'); streak.tiers[1].lessons[0].steps.find(s => s.kind === 'practice').streak = 9;
  assert.throws(() => validateProgramme(streak), /practice streak/);
  const pass = clone('counting-cubes'); pass.tiers[0].quiz.pass = 99;
  assert.throws(() => validateProgramme(pass), /quiz pass/);
  const plain = clone('counting-cubes'); plain.tiers[3].quiz.marking = 'plain';
  assert.throws(() => validateProgramme(plain), /mastery quiz needs an exam marking scheme/);
  const interactive = clone('cube-nets'); interactive.challenge.questions.push({ kind: 'build-net', count: 1 });
  assert.throws(() => validateProgramme(interactive), /interactive kind/);
});

test('progress records first answers and hints, completes lessons once and keeps the best quiz', () => {
  const programme = findProgramme('cube-nets');
  let progress = emptyProgress();
  assert.equal(programmeSummary(programme, progress).next.id, 'fold');
  progress = recordStep(progress, 'fold', 'check-1', { correct: false });
  progress = recordStep(progress, 'fold', 'check-1', { correct: true });
  assert.equal(stepResult(progress, 'fold', 'check-1').correct, false, 'first result stands');
  progress = recordStep(progress, 'fold', 'check-2', { correct: true });
  progress = recordStep(progress, 'fold', 'check-3', { correct: true, hinted: true });
  assert.deepEqual(lessonState(programme, progress, 'fold'), { status: 'started', answered: 3, correct: 1, total: 4, completedAt: null }, 'a hinted answer is not right first time');
  progress = completeLesson(progress, 'fold', '2026-11-12T10:00:00.000Z');
  assert.equal(completeLesson(progress, 'fold', '2026-11-13T10:00:00.000Z').lessons.fold.completedAt, '2026-11-12T10:00:00.000Z');
  const summary = programmeSummary(programme, progress);
  assert.deepEqual({ completed: summary.completed, total: summary.total, percent: summary.percent, next: summary.next.id }, { completed: 1, total: 12, percent: 8, next: 'opposite' });
  progress = recordQuiz(progress, 'foundations', { score: 6, total: 10, seconds: 400, passed: false, at: '2026-11-12T11:00:00.000Z' });
  progress = recordQuiz(progress, 'foundations', { score: 6, total: 10, seconds: 300, passed: false, at: '2026-11-12T12:00:00.000Z' });
  progress = recordQuiz(progress, 'foundations', { score: 4, total: 10, seconds: 100, passed: false, at: '2026-11-12T13:00:00.000Z' });
  assert.deepEqual(progress.quizzes.foundations, { best: { score: 6, total: 10, marks: 6, maxMarks: 10, seconds: 300, at: '2026-11-12T12:00:00.000Z' }, attempts: 3, passedAt: null });
  assert.equal(quizPassed(programme, progress, 'foundations'), false);
  progress = recordQuiz(progress, 'foundations', { score: 7, total: 10, seconds: 500, passed: true, at: '2026-11-12T14:00:00.000Z' });
  assert.equal(quizPassed(programme, progress, 'foundations'), true);
  progress = recordPractice(progress, 'fold', 'practice', { streak: 2, passed: false });
  progress = recordPractice(progress, 'fold', 'practice', { streak: 3, passed: true, at: '2026-11-12T15:00:00.000Z' });
  progress = recordPractice(progress, 'fold', 'practice', { streak: 0, passed: false });
  assert.deepEqual(progress.practice['fold/practice'], { bestStreak: 3, passedAt: '2026-11-12T15:00:00.000Z' });
});

test('tiers unlock by passing the quiz before them, and a later quiz can be used to skip ahead', () => {
  const programme = findProgramme('counting-cubes');
  const open = progress => programmeSummary(programme, progress).tiers.map(t => t.open);
  let progress = emptyProgress();
  assert.deepEqual(open(progress), [true, false, false, false]);
  assert.equal(programmeSummary(programme, progress).next.id, 'columns');
  for (const lesson of tiersOf(programme)[0].lessons) progress = completeLesson(progress, lesson.id);
  assert.equal(programmeSummary(programme, progress).next, null, 'finishing lessons alone does not open the next tier');
  progress = recordQuiz(progress, 'foundations', { score: 5, total: 8, seconds: 200, passed: false });
  assert.deepEqual(open(progress), [true, false, false, false]);
  progress = recordQuiz(progress, 'foundations', { score: 6, total: 8, seconds: 200, passed: true });
  assert.deepEqual(open(progress), [true, true, false, false]);
  assert.equal(programmeSummary(programme, progress).next.id, 'layers');
  const skipped = recordQuiz(emptyProgress(), 'exam-hard', { score: 5, total: 8, seconds: 900, passed: true });
  assert.deepEqual(open(skipped), [true, true, true, true], 'passing a later quiz opens it, everything before it and the tier after it');
  assert.equal(findLesson(programme, 'views-fewest').level, 4);
});

test('stored progress is sanitised on read and version 1 is upgraded', () => {
  assert.deepEqual(readProgress(null), emptyProgress());
  assert.deepEqual(readProgress({ version: 3, lessons: {} }), emptyProgress());
  const v1 = readProgress({ version: 1, lessons: { fold: { steps: { 'check-1': { correct: 'yes' }, 'Bad Id': { correct: true } }, completedAt: 'not a date' }, 'Bad Lesson': {} }, challenge: { score: 7, total: 10, seconds: 90, at: '2026-11-12T00:00:00Z', attempts: 2 } });
  assert.deepEqual(v1, { version: 2, lessons: { fold: { steps: { 'check-1': { correct: null, hinted: false } }, completedAt: null } }, quizzes: { foundations: { best: { score: 7, total: 10, marks: 7, maxMarks: 10, seconds: 90, at: '2026-11-12T00:00:00Z' }, attempts: 2, passedAt: null } }, practice: {} });
  assert.equal(quizPassed(findProgramme('cube-nets'), v1, 'foundations'), true, 'an old best score that meets the pass mark counts');
  const v2 = readProgress({ version: 2, lessons: {}, quizzes: { mastery: { best: { score: 11, total: 10, seconds: 1, at: '2026-11-12T00:00:00Z' } }, bogus: {} }, practice: { 'a/b': { bestStreak: 2 }, bad: { bestStreak: 1 } } });
  assert.deepEqual(v2, { version: 2, lessons: {}, quizzes: {}, practice: { 'a/b': { bestStreak: 2, passedAt: null } } });
});

test('local storage round trip tolerates a missing or failing store', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };
  const progress = recordStep(emptyProgress(), 'fold', 'check-1', { correct: true });
  assert.equal(saveProgress('cube-nets', 'actor-1', progress), true);
  assert.deepEqual(loadProgress('cube-nets', 'actor-1'), progress);
  assert.deepEqual(loadProgress('cube-nets', 'actor-2'), emptyProgress(), 'progress is per account');
  clearProgress('cube-nets', 'actor-1');
  assert.deepEqual(loadProgress('cube-nets', 'actor-1'), emptyProgress());
  globalThis.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(loadProgress('cube-nets', 'actor-1'), emptyProgress());
  assert.equal(saveProgress('cube-nets', 'actor-1', progress), false);
  delete globalThis.localStorage;
});

test('the preview review switch opens every tier without changing the student lock', () => {
  for (const programme of programmes.filter(p => tiersOf(p).length > 1)) {
    const fresh = emptyProgress();
    assert.deepEqual(programmeSummary(programme, fresh).tiers.map(t => t.open), tiersOf(programme).map((_, i) => i === 0), programme.slug);
    assert.ok(programmeSummary(programme, fresh, { unlockAll: true }).tiers.every(t => t.open), programme.slug);
  }
});

test('every programme has its own topic animation', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/TopicMotion.jsx', import.meta.url), 'utf8');
  const keys = [...source.slice(source.indexOf('const topics = {')).matchAll(/^\s+"?([a-z-]+)"?: \[/gm)].map(m => m[1]);
  for (const programme of programmes) assert.ok(keys.includes(programme.slug), `${programme.slug} has no animation`);
});

test('the 3D topic models project into the frame, light and hide their back faces', async () => {
  const { scenes3D, project, box } = await import('../src/scene3d.js');
  for (const [name, build] of Object.entries(scenes3D)) {
    const scene = build();
    for (const t of [0, 1.5, 4, 9]) {
      const view = project(scene, t);
      assert.ok(view.faces.length > 0 && view.faces.length < scene.faces.length, `${name} hides some faces at ${t}s`);
      for (let i = 1; i < view.faces.length; i++) assert.ok(view.faces[i - 1].depth >= view.faces[i].depth, `${name} draws far to near`);
      const xs = view.faces.flatMap(f => [...f.d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => [+m[1], +m[2]]));
      assert.ok(xs.every(([x, y]) => x > -20 && x < 340 && y > -20 && y < 260), `${name} stays in its frame at ${t}s`);
    }
  }
  const cube = { faces: box(0, 0, 0, 1, 1, 1, 'red'), view: () => ({ yaw: 0.6, pitch: -0.4 }) };
  assert.equal(project(cube, 0).faces.length, 3, 'a cube seen from above and to one side shows three faces');
});
