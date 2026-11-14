// One registry for every generated question kind across topics.
//
// A question carries `figures` (shown above the answer area) and, for choice
// modes, `options`, each with a `figure` or `text`, so the player renders
// every topic the same way. Every question has a `level` (1–5) and an
// `answerMode`: 'single' (one option id), 'multi' (a set of option ids) or
// 'numeric' (a typed number).
import * as cubeNet from './cube-net.js';
import { foldCountQuestion, unfoldQuestion } from './paper-fold.js';
import { imageQuestion } from './mirror.js';
import { countQuestion } from './cube-count.js';
import { colourQuestion } from './colour.js';
import { seededRandom } from './random.js';
import { beltQuestion, inventoryQuestion, netQuestion } from './solid-net.js';
import { patternedCuboidQuestion } from './solid-pattern.js';
import { mechanismQuestion } from './gears.js';

function cubeNetFigures(q) {
  const figures = [];
  if (q.net) figures.push({ type: 'net', cells: q.net.cells, states: q.focus !== undefined && q.focus !== null ? { [q.focus]: 'is-focus' } : {}, badCells: q.highlight ?? [] });
  if (q.view) figures.push({ type: 'cube', view: q.view, large: true });
  for (const [i, view] of (q.views ?? []).entries()) figures.push({ type: 'cube', view, large: true, label: `View ${i + 1}` });
  const options = q.options?.map(o => ({ ...o, figure: o.view ? { type: 'cube', view: o.view } : o.net ? { type: 'net', cells: o.net.cells, compact: true } : null, text: o.view || o.net ? null : o.label }));
  return { ...q, figures, options: options ?? [] };
}
const net = kind => (seed, level) => cubeNetFigures(cubeNet.generateQuestion(kind, seed, level));
function imageFigures(q, line) {
  return { ...q, figures: [{ type: 'image', figure: q.figure, transform: 'same', line }], options: q.options.map(o => ({ ...o, figure: { type: 'image', figure: q.figure, transform: o.transform } })) };
}
// Counting questions bring their own figures when they need something other than the plain stack.
const stack = kind => (seed, level) => {
  const q = countQuestion(seed, kind, level);
  return q.figures ? q : { ...q, figures: [{ type: 'stack', heights: q.heights, large: true }] };
};
function colourFigures(q) {
  return { ...q, figures: q.swatches.map(s => ({ type: 'swatch', colour: s.colour, name: s.name })), options: q.options.map(o => ({ ...o, figure: { type: 'swatch', colour: o.colour, name: o.name ?? '' } })) };
}
function solidFigures(q) {
  return { ...q, figures: [{ type: 'solid', solid: q.solid, large: true }], options: (q.options ?? []).map(o => ({ ...o, figure: { type: 'solid-net', net: o.net } })) };
}
const mechanism = kind => (seed, level) => mechanismQuestion(seed, kind, level);
const colour = kind => seed => colourFigures(colourQuestion(seed, kind));

// kind → { topic, levels, generate(seed, level) }. Never rename a kind once a programme uses it.
const kinds = {
  'is-net': { topic: 'cube-nets', levels: [1], generate: net('is-net') },
  'opposite': { topic: 'cube-nets', levels: [1], generate: net('opposite') },
  'which-cube': { topic: 'cube-nets', levels: [2, 3], generate: net('which-cube') },
  'cannot-cube': { topic: 'cube-nets', levels: [2, 3], generate: net('cannot-cube') },
  'which-net': { topic: 'cube-nets', levels: [2, 3, 4], generate: net('which-net') },
  'net-from-views': { topic: 'cube-nets', levels: [3, 4], generate: net('net-from-views') },
  'open-box': { topic: 'cube-nets', levels: [3], generate: net('open-box') },
  'same-cube': { topic: 'cube-nets', levels: [4], generate: net('same-cube') },
  'path-cube': { topic: 'cube-nets', levels: [4], generate: net('path-cube') },
  'build-net': { topic: 'cube-nets', levels: [2], generate: seed => ({ ...cubeNet.generateQuestion('build-net', seed), figures: [], options: [], interactive: 'build-net' }) },
  'fold-count': { topic: 'paper-folding', levels: [1], generate: seed => { const q = foldCountQuestion(seed); return { ...q, figures: [{ type: 'fold-sequence', folds: q.folds, punched: null }] }; } },
  'unfold': { topic: 'paper-folding', levels: [2], generate: seed => { const q = unfoldQuestion(seed); return { ...q, figures: [{ type: 'fold-sequence', folds: q.folds, punched: q.punched }], options: q.options.map(o => ({ ...o, figure: { type: 'holes', holes: o.holes } })) }; } },
  'mirror-image': { topic: 'mirror-images', levels: [1], generate: seed => imageFigures(imageQuestion(seed, 'mirror-image'), 'mirror') },
  'water-image': { topic: 'mirror-images', levels: [2], generate: seed => imageFigures(imageQuestion(seed, 'water-image'), 'water') },
  'count-cubes': { topic: 'counting-cubes', levels: [1, 3], generate: stack('count-cubes') },
  'count-hidden': { topic: 'counting-cubes', levels: [2, 3], generate: stack('count-hidden') },
  'count-box': { topic: 'counting-cubes', levels: [2], generate: stack('count-box') },
  'painted-count': { topic: 'counting-cubes', levels: [3], generate: stack('painted-count') },
  'touch-count': { topic: 'counting-cubes', levels: [3], generate: stack('touch-count') },
  'views-max': { topic: 'counting-cubes', levels: [4], generate: stack('views-max') },
  'views-min': { topic: 'counting-cubes', levels: [4], generate: stack('views-min') },
  'painted-stack': { topic: 'counting-cubes', levels: [4], generate: stack('painted-stack') },
  'removed-visible': { topic: 'counting-cubes', levels: [4], generate: stack('removed-visible') },
  'face-inventory': { topic: 'nets-of-solids', levels: [1], generate: seed => solidFigures(inventoryQuestion(seed)) },
  'prism-net': { topic: 'nets-of-solids', levels: [2], generate: seed => solidFigures(netQuestion(seed, 2, 'prism-net')) },
  'net-of-solid': { topic: 'nets-of-solids', levels: [3, 4], generate: (seed, level) => solidFigures(netQuestion(seed, level)) },
  'patterned-cuboid': { topic: 'nets-of-solids', levels: [3], generate: seed => solidFigures(patternedCuboidQuestion(seed)) },
  'grid-net': { topic: 'nets-of-solids', levels: [4], generate: seed => solidFigures(netQuestion(seed, 4, 'grid-net')) },
  'belt-length': { topic: 'nets-of-solids', levels: [3], generate: seed => solidFigures(beltQuestion(seed)) },
  'gear-direction': { topic: 'mechanisms', levels: [1, 2], generate: mechanism('gear-direction') },
  'belt-direction': { topic: 'mechanisms', levels: [2], generate: mechanism('belt-direction') },
  'gear-speed': { topic: 'mechanisms', levels: [2, 3], generate: mechanism('gear-speed') },
  'compound-speed': { topic: 'mechanisms', levels: [3], generate: mechanism('compound-speed') },
  'count-clockwise': { topic: 'mechanisms', levels: [3], generate: mechanism('count-clockwise') },
  'lever-balance': { topic: 'mechanisms', levels: [3], generate: mechanism('lever-balance') },
  'system-speed': { topic: 'mechanisms', levels: [4], generate: mechanism('system-speed') },
  'rope-count': { topic: 'mechanisms', levels: [4], generate: mechanism('rope-count') },
  'gear-realign': { topic: 'mechanisms', levels: [4], generate: mechanism('gear-realign') },
  'will-it-move': { topic: 'mechanisms', levels: [4], generate: mechanism('will-it-move') },
  'mobile-balance': { topic: 'mechanisms', levels: [4], generate: mechanism('mobile-balance') },
  'mix': { topic: 'colour-basics', levels: [1], generate: colour('mix') },
  'complement': { topic: 'colour-basics', levels: [2], generate: colour('complement') },
  'warm-cool': { topic: 'colour-basics', levels: [2], generate: colour('warm-cool') },
  'value': { topic: 'colour-basics', levels: [2], generate: colour('value') },
};

export const questionKinds = Object.freeze(Object.keys(kinds));
export function kindInfo(kind) {
  const info = kinds[kind];
  return info ? { topic: info.topic, levels: [...info.levels] } : null;
}
const targetSeconds = { 1: null, 2: null, 3: 120, 4: 150, 5: 150 };

// `level` defaults to the lowest level the kind supports.
export function generateQuestion(kind, seed, level) {
  const info = kinds[kind];
  if (!info) throw new Error(`Unknown question kind: ${kind}`);
  const chosen = level ?? info.levels[0];
  if (!info.levels.includes(chosen)) throw new Error(`Question kind ${kind} does not support level ${chosen}`);
  const question = info.generate(seed, chosen);
  return { answerMode: 'single', figures: [], options: [], hints: [], solution: [], targetSeconds: targetSeconds[chosen], ...question, kind, level: chosen };
}

// ---------- answering ----------
const numberPattern = /^-?\d+(?:\.\d+)?$/;
export function parseNumber(response) {
  const text = String(response ?? '').trim();
  return numberPattern.test(text) ? Number(text) : null;
}
export function emptyResponse(question) { return question.answerMode === 'multi' ? [] : question.answerMode === 'numeric' ? '' : null; }
export function hasResponse(question, response) {
  if (question.answerMode === 'multi') return Array.isArray(response) && response.length > 0;
  if (question.answerMode === 'numeric') return parseNumber(response) !== null;
  return response !== null && response !== undefined;
}
export function answerText(question) {
  if (question.answerMode === 'numeric') return question.answer.value !== undefined ? String(question.answer.value) : `${question.answer.min} to ${question.answer.max}`;
  const ids = question.answerMode === 'multi' ? question.answer : [question.answer];
  return ids.map(id => question.options.find(o => o.id === id)?.label ?? id).join(', ');
}
function numericCorrect(question, value) {
  const { answer } = question;
  return answer.value !== undefined ? value === answer.value : value >= answer.min && value <= answer.max;
}

export function checkAnswer(question, response) {
  if (question.interactive === 'build-net') return cubeNet.checkBuild(question, response);
  const tidy = text => text.replace(/\s+/g, ' ').trim();
  if (question.answerMode === 'numeric') {
    const value = parseNumber(response);
    if (value === null) return { correct: false, feedback: 'Enter a number.' };
    if (numericCorrect(question, value)) return { correct: true, feedback: question.explanation };
    const slip = (question.mistakes ?? []).find(m => m.value === value);
    return { correct: false, feedback: tidy(`${slip ? slip.reason : ''} The answer is ${answerText(question)}${question.unit ? ` ${question.unit}` : ''}. ${question.explanation}`) };
  }
  if (question.answerMode === 'multi') {
    const chosen = Array.isArray(response) ? response : [];
    const right = new Set(question.answer);
    const rightChosen = chosen.filter(id => right.has(id)), wrongChosen = chosen.filter(id => !right.has(id));
    const missed = question.answer.filter(id => !chosen.includes(id));
    const partial = { rightChosen: rightChosen.length, wrongChosen: wrongChosen.length, missed: missed.length };
    if (!wrongChosen.length && !missed.length) return { correct: true, feedback: question.explanation, partial };
    const reasonOf = id => question.options.find(o => o.id === id)?.reason ?? '';
    const lead = wrongChosen.length ? reasonOf(wrongChosen[0]) : `You found ${rightChosen.length} of ${question.answer.length}. ${reasonOf(missed[0])}`;
    return { correct: false, feedback: tidy(`${lead} ${question.explanation}`), partial };
  }
  if (response === question.answer) return { correct: true, feedback: question.explanation };
  const chosen = question.options.find(o => o.id === response);
  return { correct: false, feedback: tidy(`${chosen?.reason ?? ''} ${question.explanation}`) };
}

// ---------- marking ----------
// The real schemes, from docs/EXAM_RULES.md. Change that document first.
export const markingSchemes = Object.freeze({
  plain: { label: 'One point for each fully correct answer.', numeric: [1, 0], single: [1, 0], multi: [1, 0], partial: false },
  uceed: { label: 'Numerical +4, wrong 0. Select-all +4, part marks for a correct but incomplete choice, −1 if any chosen option is wrong. Single choice +3, wrong −0.71.', numeric: [4, 0], single: [3, -0.71], multi: [4, -1], partial: true },
  ceed: { label: 'Numerical +4, wrong 0. Select-all +4, part marks for a correct but incomplete choice, −1 if any chosen option is wrong. Single choice +3, wrong −0.5.', numeric: [4, 0], single: [3, -0.5], multi: [4, -1], partial: true },
  nift: { label: 'Each question +1, wrong −0.25.', numeric: [1, 0], single: [1, -0.25], multi: [1, -0.25], partial: false },
});
export function maxMarks(question, scheme = 'plain') { return markingSchemes[scheme][question.answerMode][0]; }
export function markFor(question, response, scheme = 'plain') {
  const rules = markingSchemes[scheme];
  if (!rules) throw new Error(`Unknown marking scheme: ${scheme}`);
  const [right, wrong] = rules[question.answerMode];
  if (!hasResponse(question, response)) return 0;
  const outcome = checkAnswer(question, response);
  if (outcome.correct) return right;
  if (question.answerMode === 'multi' && rules.partial) {
    if (outcome.partial.wrongChosen > 0) return wrong;
    return outcome.partial.rightChosen; // a proper, all-correct subset earns one mark per option
  }
  return wrong;
}

// ---------- quizzes ----------
// The questions of one quiz attempt, fixed by the seed: each recipe line draws its own seeds, then the set is shuffled.
export function buildQuiz(quiz, seed) {
  const rng = seededRandom(seed);
  const list = [];
  for (const recipe of quiz.questions) for (let i = 0; i < recipe.count; i++) list.push(generateQuestion(recipe.kind, Math.floor(rng() * 2 ** 31), recipe.level));
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}
