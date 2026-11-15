// Paper folding and punching. A square sheet on a grid is folded in half
// (left, up or along the diagonal), punched, and unfolded. Every layer is an
// affine map from the folded sheet back to the original, so holes are exact.
import { seededRandom } from './random.js';

export const GRID = 6;
export const foldKinds = Object.freeze({
  left: 'Fold the right half over to the left',
  up: 'Fold the bottom half up over the top',
  diagonal: 'Fold the top-right corner down to the bottom-left',
});

const identity = p => ({ x: p.x, y: p.y });
const compose = (outer, inner) => p => outer(inner(p));

// state: { w, h, triangle, layers: [map], folds: [kind] } in grid units, y down.
export function freshSheet() {
  return { w: GRID, h: GRID, triangle: false, layers: [identity], folds: [] };
}

export function canFold(state, kind) {
  if (kind === 'left') return !state.triangle && state.w >= 2;
  if (kind === 'up') return !state.triangle && state.h >= 2;
  if (kind === 'diagonal') return !state.triangle && state.w === state.h && state.w >= 2;
  return false;
}

export function fold(state, kind) {
  if (!canFold(state, kind)) throw new Error(`Cannot fold ${kind} now`);
  const { w, h } = state;
  let reflect, next;
  if (kind === 'left') { reflect = p => ({ x: w - p.x, y: p.y }); next = { w: w / 2, h, triangle: false }; }
  else if (kind === 'up') { reflect = p => ({ x: p.x, y: h - p.y }); next = { w, h: h / 2, triangle: false }; }
  else { reflect = p => ({ x: p.y, y: p.x }); next = { w, h, triangle: true }; }
  return { ...next, layers: [...state.layers, ...state.layers.map(layer => compose(layer, reflect))], folds: [...state.folds, kind] };
}

// Cells of the folded sheet that can be punched, as grid cell centres.
export function punchable(state) {
  const cells = [];
  for (let i = 0; i < state.w; i++) for (let j = 0; j < state.h; j++) {
    const p = { x: i + 0.5, y: j + 0.5 };
    if (state.triangle && p.y < p.x) continue; // keep the lower-left triangle (y >= x)
    cells.push(p);
  }
  return cells;
}

export function punch(state, points) {
  const holes = new Set();
  for (const p of points) for (const layer of state.layers) {
    const q = layer(p);
    holes.add(`${Math.floor(q.x)},${Math.floor(q.y)}`);
  }
  return [...holes].map(k => k.split(',').map(Number)).map(([x, y]) => ({ x, y })).sort((a, b) => a.y - b.y || a.x - b.x);
}

const holeKey = holes => holes.map(h => `${h.x},${h.y}`).join('|');
const flipX = holes => holes.map(h => ({ x: GRID - 1 - h.x, y: h.y }));
const flipY = holes => holes.map(h => ({ x: h.x, y: GRID - 1 - h.y }));
const rotate = holes => holes.map(h => ({ x: GRID - 1 - h.y, y: h.x }));
const sortHoles = holes => [...holes].sort((a, b) => a.y - b.y || a.x - b.x);

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
function shuffle(rng, list) { const out = [...list]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }

export function randomFoldSequence(rng, count) {
  let state = freshSheet();
  for (let i = 0; i < count; i++) {
    // The diagonal fold makes a triangle that cannot be folded again, so it only comes last.
    const options = ['left', 'up', ...(i === count - 1 ? ['diagonal'] : [])].filter(kind => canFold(state, kind));
    if (!options.length) break;
    state = fold(state, pick(rng, options));
  }
  return state;
}

export function unfoldQuestion(seed, { folds = 2, punches = 1, level = 2 } = {}) {
  const rng = seededRandom(seed);
  // Level 3: three folds, the last on the diagonal, and one or two punches.
  let state;
  if (level === 3) { state = freshSheet(); for (const kind of [...shuffle(rng, ['left', 'up']), 'diagonal']) state = fold(state, kind); punches = 1 + Math.floor(rng() * 2); }
  else state = randomFoldSequence(rng, folds);
  const cells = shuffle(rng, punchable(state)).slice(0, punches);
  const holes = punch(state, cells);
  const correctKey = holeKey(holes);
  const used = new Set([correctKey]);
  const options = [{ id: 'correct', holes, correct: true, reason: 'Each hole goes through every layer, so the pattern mirrors across every fold line in reverse order.' }];
  const candidates = [
    { holes: sortHoles(flipX(holes)), reason: 'This pattern is mirrored left to right. Check it against the last fold line.' },
    { holes: sortHoles(flipY(holes)), reason: 'This pattern is mirrored top to bottom. Check it against the last fold line.' },
    { holes: sortHoles(rotate(holes)), reason: 'This pattern is turned a quarter turn. Folds mirror holes; they never turn them.' },
    { holes: sortHoles(holes.slice(0, Math.max(1, holes.length / 2))), reason: `This pattern has too few holes. ${state.layers.length} layers were punched, so each punch makes ${state.layers.length} holes.` },
    { holes: sortHoles(punch({ ...state, layers: state.layers.slice(0, state.layers.length / 2) }, cells)), reason: 'This pattern forgets the last fold. Unfold one step at a time, mirroring across each fold line.' },
  ];
  for (const candidate of shuffle(rng, candidates)) {
    const key = holeKey(candidate.holes);
    if (used.has(key) || options.length >= 4) continue;
    used.add(key);
    options.push({ id: `wrong-${options.length}`, holes: candidate.holes, correct: false, reason: candidate.reason });
  }
  let guard = 0;
  while (options.length < 4 && guard++ < 50) {
    const extra = sortHoles(shuffle(rng, allCells()).slice(0, holes.length));
    const key = holeKey(extra);
    if (used.has(key)) continue;
    used.add(key);
    options.push({ id: `wrong-${options.length}`, holes: extra, correct: false, reason: 'These holes do not mirror across the fold lines.' });
  }
  const shuffled = shuffle(rng, options).map((o, i) => ({ ...o, label: 'ABCD'[i] }));
  const answer = shuffled.find(o => o.correct);
  return {
    kind: 'unfold', seed, prompt: 'The sheet is folded as shown, then punched. Which pattern appears when it is unfolded?',
    folds: state.folds, punched: { state: { w: state.w, h: state.h, triangle: state.triangle }, cells },
    options: shuffled, answer: answer.id, explanation: answer.reason,
    ...(level === 3 ? {
      hints: ['Undo the diagonal fold first: mirror each hole across the diagonal.', 'Then undo the other two folds, mirroring everything across each fold line.'],
      solution: [
        { text: `Three folds: ${state.folds.join(', then ')}. That makes ${state.layers.length} layers.` },
        { text: `Undo the diagonal fold: each hole is copied across the line from corner to corner.` },
        { text: `Undo the ${state.folds[1]} fold, then the ${state.folds[0]} fold, mirroring every hole each time.` },
        { text: `${holes.length} holes. So the answer is ${answer.label}.` },
      ],
    } : {}),
  };
}
function allCells() { const out = []; for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) out.push({ x, y }); return out; }

export function foldCountQuestion(seed) {
  const rng = seededRandom(seed);
  const folds = 1 + Math.floor(rng() * 3);
  const state = randomFoldSequence(rng, folds);
  const layers = state.layers.length;
  const answers = shuffle(rng, [...new Set([layers, layers * 2, Math.max(1, layers / 2), layers + 1])]).slice(0, 4);
  const options = answers.map(n => ({ id: String(n), label: String(n), text: `${n} hole${n === 1 ? '' : 's'}` }));
  return {
    kind: 'fold-count', seed, prompt: 'After these folds, one punch goes through every layer. How many holes will the unfolded sheet have?',
    folds: state.folds, punched: null,
    options, answer: String(layers),
    explanation: `Each fold doubles the layers: ${folds} fold${folds === 1 ? '' : 's'} make${folds === 1 ? 's' : ''} ${layers} layer${layers === 1 ? '' : 's'}, so one punch gives ${layers} hole${layers === 1 ? '' : 's'}.`,
  };
}
