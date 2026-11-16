// Programme content validation and progress bookkeeping. Pure functions only.
//
// A programme is either v2 (`tiers`, each with lessons and a quiz) or v1
// (`lessons` and a `challenge`), which is read as a single Foundations tier.
import { generateQuestion, kindInfo, markingSchemes, questionKinds } from './questions.js';

export const stepKinds = Object.freeze(['slide', 'hook', 'worked', 'check', 'practice', 'takeaway']);
export const tierIds = Object.freeze(['foundations', 'exam-standard', 'exam-hard', 'mastery']);
export const exams = Object.freeze(['uceed', 'ceed', 'nid', 'nift']);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const text = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
const fail = message => { throw new Error(`Invalid programme: ${message}`); };

// ---------- shape ----------
export function tiersOf(programme) {
  if (Array.isArray(programme.tiers)) return programme.tiers;
  const total = programme.challenge.questions.reduce((sum, q) => sum + q.count, 0);
  return [{
    id: 'foundations', title: 'Foundations', level: 2, lessons: programme.lessons,
    quiz: { title: programme.challenge.title, description: programme.challenge.description, minutes: programme.challenge.minutes, pass: Math.ceil(total * 0.7), marking: 'plain', questions: programme.challenge.questions },
  }];
}
export const lessonsOf = programme => tiersOf(programme).flatMap(tier => tier.lessons);
export const findLesson = (programme, lessonId) => lessonsOf(programme).find(lesson => lesson.id === lessonId) ?? null;
export const findTier = (programme, tierId) => tiersOf(programme).find(tier => tier.id === tierId) ?? null;
export const quizLength = quiz => quiz.questions.reduce((sum, q) => sum + q.count, 0);
export const checkSteps = lesson => lesson.steps.filter(step => step.kind === 'check');

function validQuestionRef(ref, where, { seed = true } = {}) {
  if (!ref || !questionKinds.includes(ref.kind)) fail(`question kind ${where}`);
  if (seed && !Number.isInteger(ref.seed)) fail(`question seed ${where}`);
  if (ref.level !== undefined && !kindInfo(ref.kind).levels.includes(ref.level)) fail(`question level ${where}`);
}

export function validateProgramme(programme) {
  if (!programme || typeof programme !== 'object') fail('not an object');
  if (!slugPattern.test(programme.slug ?? '')) fail('slug');
  if (!text(programme.title, 3, 80)) fail('title');
  if (!text(programme.summary, 10, 300)) fail('summary');
  if (!text(programme.topic, 2, 60)) fail('topic');
  if (!Array.isArray(programme.exams) || !programme.exams.length || !programme.exams.every(e => exams.includes(e))) fail('exams');
  if (!Number.isInteger(programme.minutes) || programme.minutes < 5) fail('minutes');
  if (programme.status !== undefined && !['preview', 'released'].includes(programme.status)) fail('status');
  if (!Array.isArray(programme.tiers) && (!Array.isArray(programme.lessons) || !programme.challenge)) fail('lessons');
  if (!Array.isArray(programme.tiers)) {
    const challenge = programme.challenge;
    if (!text(challenge.title, 3, 80) || !Number.isInteger(challenge.minutes) || challenge.minutes < 1) fail('challenge');
    if (!Array.isArray(challenge.questions) || !challenge.questions.length) fail('challenge questions');
    for (const q of challenge.questions) if (!questionKinds.includes(q.kind) || !Number.isInteger(q.count) || q.count < 1) fail('challenge recipe');
  }
  const tiers = tiersOf(programme);
  if (!tiers.length) fail('tiers');
  let lastTier = -1;
  const lessonIds = new Set();
  for (const tier of tiers) {
    const position = tierIds.indexOf(tier.id);
    if (position <= lastTier) fail(`tier id or order ${tier.id}`);
    lastTier = position;
    if (!text(tier.title, 3, 60) || !Number.isInteger(tier.level) || tier.level < 1 || tier.level > 5) fail(`tier ${tier.id}`);
    if (!Array.isArray(tier.lessons) || tier.lessons.length < 1) fail(`tier lessons ${tier.id}`);
    for (const lesson of tier.lessons) {
      if (!slugPattern.test(lesson.id ?? '') || lessonIds.has(lesson.id) || lesson.id.startsWith('quiz-') || lesson.id === 'challenge') fail(`lesson id ${lesson.id}`);
      lessonIds.add(lesson.id);
      if (!text(lesson.title, 3, 80)) fail(`lesson title ${lesson.id}`);
      if (!text(lesson.summary, 10, 300)) fail(`lesson summary ${lesson.id}`);
      if (!Number.isInteger(lesson.minutes) || lesson.minutes < 1) fail(`lesson minutes ${lesson.id}`);
      if (!Array.isArray(lesson.steps) || lesson.steps.length < 2) fail(`lesson steps ${lesson.id}`);
      const stepIds = new Set();
      for (const step of lesson.steps) {
        const where = `${lesson.id}/${step.id}`;
        if (!slugPattern.test(step.id ?? '') || stepIds.has(step.id)) fail(`step id ${where}`);
        stepIds.add(step.id);
        if (!stepKinds.includes(step.kind)) fail(`step kind ${where}`);
        if (step.kind === 'slide') {
          const paragraphs = Array.isArray(step.text) ? step.text : [step.text];
          if (!paragraphs.length || !paragraphs.every(p => text(p, 10, 600))) fail(`slide text ${where}`);
          if (step.title !== undefined && !text(step.title, 3, 120)) fail(`slide title ${where}`);
          if (step.tool !== undefined && !text(step.tool, 2, 40)) fail(`slide tool ${where}`);
          if (step.figure !== undefined && (!step.figure || typeof step.figure.type !== 'string')) fail(`slide figure ${where}`);
        }
        if (step.kind === 'check') validQuestionRef(step.question, `check ${where}`);
        if (step.kind === 'hook') { validQuestionRef(step.question, `hook ${where}`); if (!text(step.text, 10, 300)) fail(`hook text ${where}`); }
        if (step.kind === 'worked') {
          validQuestionRef(step.question, `worked ${where}`);
          if (!generateQuestion(step.question.kind, step.question.seed, step.question.level).solution.length) fail(`worked ${where} has no solution steps`);
        }
        if (step.kind === 'practice') {
          validQuestionRef(step.question, `practice ${where}`, { seed: false });
          if (!Number.isInteger(step.streak) || step.streak < 2 || step.streak > 5) fail(`practice streak ${where}`);
        }
        if (step.kind === 'takeaway' && !text(step.body, 10, 600)) fail(`takeaway ${where}`);
      }
      if (lesson.steps[lesson.steps.length - 1].kind !== 'takeaway') fail(`lesson ${lesson.id} must end with a take-away`);
    }
    const quiz = tier.quiz;
    if (!quiz || !text(quiz.title, 3, 80) || !Number.isInteger(quiz.minutes) || quiz.minutes < 1) fail(`quiz ${tier.id}`);
    if (!Object.hasOwn(markingSchemes, quiz.marking ?? 'plain')) fail(`quiz marking ${tier.id}`);
    if (!Array.isArray(quiz.questions) || !quiz.questions.length) fail(`quiz questions ${tier.id}`);
    for (const q of quiz.questions) {
      if (!Number.isInteger(q.count) || q.count < 1) fail(`quiz recipe ${tier.id}`);
      validQuestionRef(q, `quiz ${tier.id}`, { seed: false });
      if (kindInfo(q.kind) && generateQuestion(q.kind, 1, q.level).interactive) fail(`quiz ${tier.id} cannot use interactive kind ${q.kind}`);
    }
    if (!Number.isInteger(quiz.pass) || quiz.pass < 1 || quiz.pass > quizLength(quiz)) fail(`quiz pass ${tier.id}`);
    if (tier.id === 'mastery' && (quiz.marking ?? 'plain') === 'plain') fail('mastery quiz needs an exam marking scheme');
  }
  return programme;
}

// ---------- progress ----------
// v2: { version: 2, lessons: { id: { steps: { id: { correct, hinted } }, completedAt } },
//       quizzes: { tierId: { best: { score, total, marks, maxMarks, seconds, at }, attempts, passedAt } },
//       practice: { stepKey: { bestStreak, passedAt } } }
export function emptyProgress() { return { version: 2, lessons: {}, quizzes: {}, practice: {} }; }

const isDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const whole = value => Number.isInteger(value) && value >= 0;
function readAttempt(best) {
  if (!best || typeof best !== 'object' || !whole(best.score) || !Number.isInteger(best.total) || best.total < 1 || best.score > best.total || !whole(best.seconds) || !isDate(best.at)) return null;
  const marks = typeof best.marks === 'number' && Number.isFinite(best.marks) ? best.marks : best.score;
  const maxMarks = typeof best.maxMarks === 'number' && best.maxMarks > 0 ? best.maxMarks : best.total;
  return { score: best.score, total: best.total, marks, maxMarks, seconds: best.seconds, at: best.at };
}

export function readProgress(raw) {
  const progress = emptyProgress();
  if (!raw || typeof raw !== 'object' || ![1, 2].includes(raw.version) || !raw.lessons || typeof raw.lessons !== 'object') return progress;
  for (const [lessonId, entry] of Object.entries(raw.lessons)) {
    if (!slugPattern.test(lessonId) || !entry || typeof entry !== 'object') continue;
    const steps = {};
    for (const [stepId, value] of Object.entries(entry.steps ?? {})) {
      if (!slugPattern.test(stepId) || !value || typeof value !== 'object') continue;
      steps[stepId] = { correct: value.correct === true ? true : value.correct === false ? false : null, hinted: value.hinted === true };
    }
    progress.lessons[lessonId] = { steps, completedAt: isDate(entry.completedAt) ? entry.completedAt : null };
  }
  if (raw.version === 1) {
    const best = readAttempt(raw.challenge);
    if (best) progress.quizzes.foundations = { best, attempts: Number.isInteger(raw.challenge.attempts) && raw.challenge.attempts > 0 ? raw.challenge.attempts : 1, passedAt: null };
    return progress;
  }
  for (const [tierId, entry] of Object.entries(raw.quizzes ?? {})) {
    const best = readAttempt(entry?.best);
    if (!tierIds.includes(tierId) || !best) continue;
    progress.quizzes[tierId] = { best, attempts: Number.isInteger(entry.attempts) && entry.attempts > 0 ? entry.attempts : 1, passedAt: isDate(entry.passedAt) ? entry.passedAt : null };
  }
  for (const [key, entry] of Object.entries(raw.practice ?? {})) {
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(key) || !entry || !whole(entry.bestStreak)) continue;
    progress.practice[key] = { bestStreak: entry.bestStreak, passedAt: isDate(entry.passedAt) ? entry.passedAt : null };
  }
  return progress;
}

const lessonEntry = (progress, lessonId) => progress.lessons[lessonId] ?? { steps: {}, completedAt: null };

export function stepResult(progress, lessonId, stepId) {
  return lessonEntry(progress, lessonId).steps[stepId] ?? null;
}

// The first recorded result of a check stands.
export function recordStep(progress, lessonId, stepId, { correct = null, hinted = false } = {}) {
  const entry = lessonEntry(progress, lessonId);
  if (entry.steps[stepId]) return progress;
  const result = { correct: correct === true ? true : correct === false ? false : null, hinted: hinted === true };
  return { ...progress, lessons: { ...progress.lessons, [lessonId]: { ...entry, steps: { ...entry.steps, [stepId]: result } } } };
}

export function completeLesson(progress, lessonId, at = new Date().toISOString()) {
  const entry = lessonEntry(progress, lessonId);
  if (entry.completedAt) return progress;
  return { ...progress, lessons: { ...progress.lessons, [lessonId]: { ...entry, completedAt: at } } };
}

// Best is by marks, then by time. A pass, once earned, is kept.
export function recordQuiz(progress, tierId, { score, total, marks = score, maxMarks = total, seconds, passed, at = new Date().toISOString() }) {
  const previous = progress.quizzes[tierId];
  const attempt = { score, total, marks, maxMarks, seconds, at };
  const better = !previous || marks > previous.best.marks || (marks === previous.best.marks && seconds < previous.best.seconds);
  return { ...progress, quizzes: { ...progress.quizzes, [tierId]: { best: better ? attempt : previous.best, attempts: (previous?.attempts ?? 0) + 1, passedAt: previous?.passedAt ?? (passed ? at : null) } } };
}

export const practiceKey = (lessonId, stepId) => `${lessonId}/${stepId}`;
export function practiceResult(progress, lessonId, stepId) { return progress.practice[practiceKey(lessonId, stepId)] ?? null; }
export function recordPractice(progress, lessonId, stepId, { streak, passed, at = new Date().toISOString() }) {
  const key = practiceKey(lessonId, stepId);
  const previous = progress.practice[key];
  const bestStreak = Math.max(previous?.bestStreak ?? 0, streak);
  const passedAt = previous?.passedAt ?? (passed ? at : null);
  if (previous && previous.bestStreak === bestStreak && previous.passedAt === passedAt) return progress;
  return { ...progress, practice: { ...progress.practice, [key]: { bestStreak, passedAt } } };
}

// ---------- summaries ----------
export function lessonState(programme, progress, lessonId) {
  const lesson = findLesson(programme, lessonId);
  const entry = lessonEntry(progress, lessonId);
  const checks = checkSteps(lesson);
  const answered = checks.filter(step => entry.steps[step.id]).length;
  // "Right" means right on the first try without a hint.
  const correct = checks.filter(step => entry.steps[step.id]?.correct === true && !entry.steps[step.id].hinted).length;
  const status = entry.completedAt ? 'complete' : Object.keys(entry.steps).length ? 'started' : 'new';
  return { status, answered, correct, total: checks.length, completedAt: entry.completedAt };
}

export function quizPassed(programme, progress, tierId) {
  const tier = findTier(programme, tierId), entry = progress.quizzes[tierId];
  return Boolean(entry && (entry.passedAt || entry.best.score >= tier.quiz.pass));
}

// unlockAll: the development preview's review switch opens every tier; students never get it.
export function programmeSummary(programme, progress, { unlockAll = false } = {}) {
  const tiers = tiersOf(programme);
  const passed = tiers.map(tier => quizPassed(programme, progress, tier.id));
  const tierStates = tiers.map((tier, i) => {
    const lessons = tier.lessons.map(lesson => ({ lesson, ...lessonState(programme, progress, lesson.id) }));
    // Open when it is the first tier, the previous quiz is passed, or the student has skipped ahead past it.
    const open = unlockAll || i === 0 || passed[i - 1] || passed.slice(i).some(Boolean);
    return { tier, open, lessons, lessonsDone: lessons.filter(l => l.status === 'complete').length, quiz: { best: progress.quizzes[tier.id]?.best ?? null, attempts: progress.quizzes[tier.id]?.attempts ?? 0, passed: passed[i] } };
  });
  const all = tierStates.flatMap(t => t.lessons);
  const completed = all.filter(l => l.status === 'complete').length;
  const next = tierStates.filter(t => t.open).flatMap(t => t.lessons).find(l => l.status !== 'complete')?.lesson ?? null;
  return {
    tiers: tierStates, total: all.length, completed, percent: all.length ? Math.round(completed * 100 / all.length) : 0, next,
    checks: { answered: all.reduce((sum, l) => sum + l.answered, 0), correct: all.reduce((sum, l) => sum + l.correct, 0) },
    tiersPassed: passed.filter(Boolean).length,
  };
}

export function formatSeconds(seconds) {
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
export const formatMarks = marks => (Number.isInteger(marks) ? String(marks) : marks.toFixed(2));
