// Visual series, matrices, analogies and odd one out. Specification:
// docs/learn/topics/visual-patterns.md.
//
// A panel is a list of items { shape, fill, x, y, rot, size } with x and y
// from 0 to 1 (y down) and rot in degrees clockwise. Rules change panels
// step by step; every wrong option breaks exactly one rule, and is checked to
// differ from the right answer.
import { pick, seededRandom, shuffle } from './random.js';
import { looks } from './pattern-shapes.js';

export const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'plus'];
export const CHIRAL = ['arrow', 'hook', 'flag'];
export const FILLS = ['black', 'white', 'grey'];
const RING = Array.from({ length: 8 }, (_, k) => { const a = (k * Math.PI) / 4 - Math.PI / 2; return [0.5 + 0.36 * Math.cos(a), 0.5 + 0.36 * Math.sin(a)]; });
const GRID = [[0.25, 0.25], [0.5, 0.25], [0.75, 0.25], [0.25, 0.5], [0.5, 0.5], [0.75, 0.5], [0.25, 0.75], [0.5, 0.75], [0.75, 0.75]];
const round = v => Math.round(v * 1000) / 1000;
// Two panels are the same when they look the same: compare their drawn outlines.
export const panelKey = looks;

// ---------- rules ----------
// Each rule is (step, base) → part of a panel; a series panel is the union of its layers.
const LAYERS = {
  spin: (rng) => { const shape = pick(rng, CHIRAL), by = pick(rng, [45, 90, -90, 135]), start = pick(rng, [0, 90, 180, 270]); return { name: 'spin', text: `the ${shape} in the middle turns ${Math.abs(by)}° ${by > 0 ? 'clockwise' : 'anticlockwise'} each time`, at: k => [{ shape, fill: 'black', x: 0.5, y: 0.5, rot: start + by * k, size: 0.42 }], broken: k => [{ shape, fill: 'black', x: 0.5, y: 0.5, rot: start + by * (k - 1), size: 0.42 }], other: k => [{ shape, fill: 'black', x: 0.5, y: 0.5, rot: start - by * k, size: 0.42 }], mirror: k => [{ shape, mirror: true, fill: 'black', x: 0.5, y: 0.5, rot: start + by * k, size: 0.42 }] }; },
  orbit: (rng) => { const shape = pick(rng, ['circle', 'square', 'triangle']), by = pick(rng, [1, 2, -1, 3]), start = Math.floor(rng() * 8), fill = pick(rng, ['black', 'grey']); return { name: 'orbit', text: `the small ${shape} moves ${Math.abs(by)} place${Math.abs(by) === 1 ? '' : 's'} ${by > 0 ? 'clockwise' : 'anticlockwise'} round the edge each time`, at: k => { const [x, y] = RING[(((start + by * k) % 8) + 8) % 8]; return [{ shape, fill, x, y, rot: 0, size: 0.16 }]; }, broken: k => { const [x, y] = RING[(((start + by * (k - 1)) % 8) + 8) % 8]; return [{ shape, fill, x, y, rot: 0, size: 0.16 }]; }, other: k => { const [x, y] = RING[(((start - by * k) % 8) + 8) % 8]; return [{ shape, fill, x, y, rot: 0, size: 0.16 }]; } }; },
  count: (rng) => { const shape = pick(rng, ['circle', 'square', 'triangle', 'star']), start = 1 + Math.floor(rng() * 2), by = pick(rng, [1, 1, 2]); const cells = shuffle(rng, GRID.map((_, i) => i).filter(i => i !== 4)); const make = n => cells.slice(0, Math.max(0, Math.min(8, n))).map(i => ({ shape, fill: 'grey', x: GRID[i][0], y: GRID[i][1], rot: 0, size: 0.13 })); return { name: 'count', text: `the number of small ${shape}s goes up by ${by} each time`, at: k => make(start + by * k), broken: k => make(start + by * k + 1), other: k => make(start + by * k - 1) }; },
  fill: (rng) => { const shape = pick(rng, SHAPES.filter(s => s !== 'plus')), order = shuffle(rng, FILLS), size = 0.24; return { name: 'fill', text: `the corner ${shape} changes ${order.join(' → ')} and repeats`, at: k => [{ shape, fill: order[k % 3], x: 0.18, y: 0.18, rot: 0, size }], broken: k => [{ shape, fill: order[(k + 1) % 3], x: 0.18, y: 0.18, rot: 0, size }], other: k => [{ shape, fill: order[(k + 2) % 3], x: 0.18, y: 0.18, rot: 0, size }] }; },
};
function seriesOf(rng, names) {
  const layers = names.map(n => LAYERS[n](rng));
  // Keep layers from overlapping: the count layer uses the inner grid, so it does not go with spin.
  return { layers, at: k => layers.flatMap(l => l.at(k)), text: layers.map(l => l.text) };
}
function retry(seed, build) {
  for (let i = 0; i < 300; i++) { const q = build(seededRandom(seed * 1709 + i * 7919)); if (q) return q; }
  throw new Error('No pattern question for seed ' + seed);
}
const optionsOf = (rng, truth, wrong) => {
  const seen = new Set([panelKey(truth)]), list = [{ panel: truth, correct: true, reason: 'Every rule is carried one step further.' }];
  for (const w of wrong) { const k = panelKey(w.panel); if (!seen.has(k) && list.length < 4) { seen.add(k); list.push({ ...w, correct: false }); } }
  if (list.length < 4) return null;
  const options = shuffle(rng, list).map((o, i) => ({ id: 'ABCD'[i], label: 'ABCD'[i], correct: o.correct, reason: o.reason, figure: { type: 'panel', panel: o.panel } }));
  return { options, answer: options.find(o => o.correct).id };
};
const COMBOS = { 1: [['spin'], ['orbit'], ['count'], ['fill']], 2: [['spin'], ['orbit'], ['count']], 3: [['spin', 'orbit'], ['orbit', 'count'], ['spin', 'fill'], ['orbit', 'fill'], ['count', 'fill']], 4: [['spin', 'orbit', 'fill'], ['orbit', 'count', 'fill'], ['spin', 'orbit']] };

// ---------- series-next ----------
export function seriesNextQuestion(seed, level) {
  return retry(seed, rng => {
    const s = seriesOf(rng, pick(rng, COMBOS[level])), n = level <= 2 ? 4 : 5, shown = Array.from({ length: n }, (_, k) => s.at(k)), truth = s.at(n);
    const wrong = [];
    for (const l of s.layers) {
      const rest = s.layers.filter(m => m !== l).flatMap(m => m.at(n));
      wrong.push({ panel: [...rest, ...l.broken(n)], reason: `One rule has not moved on: ${l.text}.` });
      wrong.push({ panel: [...rest, ...l.other(n)], reason: `One rule goes the wrong way: ${l.text}.` });
      if (l.mirror) wrong.push({ panel: [...rest, ...l.mirror(n)], reason: 'The middle shape is a mirror image. Turning never flips a shape.' });
    }
    wrong.push({ panel: s.at(n - 1), reason: 'This repeats the last figure.' });
    wrong.push({ panel: s.at(n + 1), reason: 'This moves two steps on instead of one.' });
    wrong.push({ panel: s.at(0), reason: 'This is the first figure again; the series does not go back to the start yet.' });
    const made = optionsOf(rng, truth, shuffle(rng, wrong));
    if (!made) return null;
    return {
      kind: 'series-next', seed, answerMode: 'single', ...made,
      prompt: 'Which figure comes next in the series?',
      figures: [{ type: 'panel-row', panels: shown, ask: true }],
      explanation: `The rules: ${s.text.join('; ')}.`,
      ...(level >= 3 ? { hints: ['Follow one part of the figure at a time across the series, ignoring the rest.', 'When you have a rule for each part, apply all of them to the last figure.'], solution: [...s.text.map(t => ({ text: `Rule: ${t}.` })), { text: 'Apply every rule once more to the last figure.' }, { text: `So the answer is ${made.options.find(o => o.correct).label}.` }] } : {}),
    };
  });
}

// ---------- matrix-cell ----------
// Row rule: each row has the three shapes once (a Latin square). Column rule: fill by column. Third rule (L4): count grows along the row.
export function matrixQuestion(seed, level) {
  return retry(seed, rng => {
    const shapes = shuffle(rng, ['circle', 'square', 'triangle', 'diamond', 'star']).slice(0, 3), fills = shuffle(rng, FILLS), shift = pick(rng, [1, 2]);
    const counts = level === 4 ? pick(rng, [[1, 2, 3], [3, 2, 1], [2, 3, 4]]) : null;
    const cell = (r, c) => { const shape = shapes[(c + shift * r) % 3], fill = fills[c], n = counts ? counts[c] : 1; return Array.from({ length: n }, (_, i) => ({ shape, fill, x: n === 1 ? 0.5 : 0.25 + (0.5 * i) / (n - 1), y: 0.5, rot: 0, size: n === 1 ? 0.4 : 0.22 })); };
    const truth = cell(2, 2), grid = [0, 1, 2].map(r => [0, 1, 2].map(c => (r === 2 && c === 2 ? null : cell(r, c))));
    const rowShapes = new Set([cell(2, 0)[0].shape, cell(2, 1)[0].shape]);
    const wrongShape = shapes.find(s => rowShapes.has(s)), withShape = s => truth.map(i => ({ ...i, shape: s })), withFill = f => truth.map(i => ({ ...i, fill: f }));
    const wrong = [
      { panel: withShape(wrongShape), reason: `${wrongShape.charAt(0).toUpperCase() + wrongShape.slice(1)} is already in the bottom row; each row has each shape once.` },
      { panel: withFill(fills[(2 + 1) % 3]), reason: 'The fill is wrong: every figure in a column has the same fill.' },
      { panel: withShape(cell(1, 2)[0].shape), reason: 'This copies the figure above. The shape changes from row to row.' },
      ...(counts ? [{ panel: cell(2, 1).map(i => ({ ...i, shape: truth[0].shape, fill: truth[0].fill })), reason: 'The number of shapes is wrong: it changes along each row.' }] : [{ panel: withFill(fills[(2 + 2) % 3]), reason: 'The fill is wrong: every figure in a column has the same fill.' }]),
    ];
    const made = optionsOf(rng, truth, shuffle(rng, wrong));
    if (!made) return null;
    return {
      kind: 'matrix-cell', seed, answerMode: 'single', ...made,
      prompt: 'Which figure completes the grid?',
      figures: [{ type: 'panel-grid', grid }],
      explanation: `Each row uses the three shapes once; each column keeps one fill${counts ? '; the number of shapes changes along the row' : ''}.`,
      hints: ['Look along the rows first: what changes, what stays?', 'Then look down the columns. The missing figure must fit its row and its column.'],
      solution: [{ text: `Rows: each has ${shapes.join(', ')} once.` }, { text: `Columns: fills are ${fills.join(', ')}, left to right.` }, ...(counts ? [{ text: `Counts along a row: ${counts.join(', ')}.` }] : []), { text: `Bottom right: a ${truth[0].shape}, ${truth[0].fill}${counts ? `, ${counts[2]} of them` : ''}.` }, { text: `So the answer is ${made.options.find(o => o.correct).label}.` }],
    };
  });
}

// ---------- analogy ----------
const TRANSFORMS = {
  turn: { text: 'turned a quarter turn clockwise', f: p => p.map(i => ({ ...i, rot: i.rot + 90, x: 1 - i.y, y: i.x })) },
  flip: { text: 'flipped left to right', f: p => p.map(i => ({ ...i, mirror: !i.mirror, rot: -i.rot, x: 1 - i.x })) },
  swapFill: { text: 'with black and white swapped', f: p => p.map(i => ({ ...i, fill: i.fill === 'black' ? 'white' : i.fill === 'white' ? 'black' : i.fill })) },
  shrink: { text: 'with the big shape made small and the small ones big', f: p => p.map(i => ({ ...i, size: i.size >= 0.3 ? 0.18 : 0.4 })) },
};
function analogyBase(rng) {
  const big = { shape: pick(rng, CHIRAL), fill: pick(rng, ['black', 'white']), x: 0.5, y: 0.5, rot: pick(rng, [0, 90, 180, 270]), size: 0.42 };
  const small = { shape: pick(rng, ['circle', 'square', 'triangle']), fill: big.fill === 'black' ? 'white' : 'black', x: pick(rng, [0.18, 0.82]), y: pick(rng, [0.18, 0.82]), rot: 0, size: 0.16 };
  return [big, small];
}
export function analogyQuestion(seed) {
  return retry(seed, rng => {
    const names = shuffle(rng, Object.keys(TRANSFORMS)), use = names.slice(0, rng() < 0.5 ? 1 : 2), apply = p => use.reduce((acc, n) => TRANSFORMS[n].f(acc), p);
    const A = analogyBase(rng), C = analogyBase(rng);
    if (panelKey(A) === panelKey(C)) return null;
    const truth = apply(C);
    const wrong = [
      ...names.filter(n => !use.includes(n)).map(n => ({ panel: TRANSFORMS[n].f(C), reason: `This is ${TRANSFORMS[n].text}. A was ${use.map(u => TRANSFORMS[u].text).join(' and ')}.` })),
      ...(use.length === 2 ? use.map(n => ({ panel: TRANSFORMS[n].f(C), reason: 'Only one of the two changes has been made.' })) : []),
      { panel: C, reason: 'This is C unchanged.' },
      { panel: apply(A), reason: 'This applies the change to A again, not to C.' },
    ];
    const made = optionsOf(rng, truth, shuffle(rng, wrong));
    if (!made) return null;
    return {
      kind: 'analogy', seed, answerMode: 'single', ...made,
      prompt: 'The first figure changes into the second. Change the third figure in the same way. Which option do you get?',
      figures: [{ type: 'panel-row', panels: [A, apply(A), C], analogy: true }],
      explanation: `The first figure is ${use.map(u => TRANSFORMS[u].text).join(' and ')}. Do the same to the third.`,
      hints: ['Name every change from the first figure to the second: turn, flip, colour, size.', 'Apply exactly those changes to the third figure, nothing more.'],
      solution: [{ text: `From the first to the second: ${use.map(u => TRANSFORMS[u].text).join(', then ')}.` }, { text: 'A turn and a flip look alike; check which way a slanted part points.' }, { text: `So the answer is ${made.options.find(o => o.correct).label}.` }],
    };
  });
}

// ---------- odd-one-out ----------
export function oddOneQuestion(seed, level) {
  return retry(seed, rng => {
    const base = analogyBase(rng), extra = { shape: pick(rng, ['triangle', 'square']), fill: 'grey', x: 0.82, y: 0.5, rot: 0, size: 0.14 }, figure = [...base, extra];
    const turns = shuffle(rng, [0, 90, 180, 270]).slice(0, 4), odd = Math.floor(rng() * 4);
    const turn = (p, t) => { let q = p; for (let i = 0; i < t / 90; i++) q = TRANSFORMS.turn.f(q); return q; };
    const panels = turns.map((t, i) => {
      const p = turn(figure, t);
      if (i !== odd) return p;
      return level === 4 ? TRANSFORMS.flip.f(p) : p.map((it, j) => (j === 2 ? { ...it, fill: 'black' } : it));
    });
    if (new Set(panels.map(panelKey)).size < 4) return null;
    const options = panels.map((p, i) => ({ id: 'ABCD'[i], label: 'ABCD'[i], correct: i === odd, reason: i === odd ? (level === 4 ? 'This is the mirror image. The others are the same figure turned.' : 'One small part has a different colour. The others are the same figure turned.') : 'This is the same figure, turned.', figure: { type: 'panel', panel: p } }));
    return {
      kind: 'odd-one-out', seed, answerMode: 'single', options, answer: 'ABCD'[odd], figures: [],
      prompt: 'Three of these are the same figure turned round. Which one is different?',
      explanation: level === 4 ? 'Turn each figure so the big shape points the same way. Three match; one is its mirror image.' : 'Turn each figure in your head: three match exactly; one has a part of a different colour.',
      ...(level === 4 ? { hints: ['Pick one part, such as the small grey shape, and check which side of the big shape it sits on.', 'In a turned copy it stays on the same side; in a mirror image it swaps sides.'], solution: [{ text: 'Choose a landmark: the point of the big shape.' }, { text: 'Turn each option until the landmark points up. Look where the small shapes sit.' }, { text: `Three match; ${'ABCD'[odd]} has them on the other side: it is a mirror image.` }] } : {}),
    };
  });
}

export function patternQuestion(seed, kind, level) {
  if (kind === 'series-next') return seriesNextQuestion(seed, level);
  if (kind === 'matrix-cell') return matrixQuestion(seed, level);
  if (kind === 'analogy') return analogyQuestion(seed);
  if (kind === 'odd-one-out') return oddOneQuestion(seed, level);
  throw new Error('Unknown pattern kind ' + kind);
}
export const PATTERN_KINDS = { 'series-next': [1, 2, 3, 4], 'matrix-cell': [3, 4], analogy: [3], 'odd-one-out': [2, 4] };
export { LAYERS, seriesOf, TRANSFORMS };
