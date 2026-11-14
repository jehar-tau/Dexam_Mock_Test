// Questions for counting figures. Every count comes from figure-count.js;
// the tests recount every figure with the second counter.
// Specification: docs/learn/topics/counting-figures.md.
import { analyse, bounds, bySize, countOf, fan, fullSides, grid, gridWithDiagonals, mergeCollinear, panels, polygon, reflect, rhombus, shapesOf, shear, squareFrom, squareStar, triangleGrid } from './figure-count.js';
import { pick, seededRandom, shuffle } from './random.js';

const NAMES = { triangle: ['triangle', 'triangles'], 'right-triangle': ['right-angled triangle', 'right-angled triangles'], square: ['square', 'squares'], rectangle: ['rectangle', 'rectangles'], parallelogram: ['parallelogram', 'parallelograms'] };
const many = shape => NAMES[shape][1];
const plural = (n, shape) => `${n} ${NAMES[shape][n === 1 ? 0 : 1]}`;

// Turn or flip a figure. The count never changes; the picture does.
const TURNS = [p => p, ([x, y]) => [-x, y], ([x, y]) => [x, -y], ([x, y]) => [y, x], ([x, y]) => [-y, x], ([x, y]) => [-x, -y]];
function turned(rng, segments) {
  const move = pick(rng, TURNS), out = segments.map(s => s.map(move)), b = bounds(out);
  return out.map(s => s.map(([x, y]) => [x - b.minX, y - b.minY]));
}
const cellsOf = (rng, m, n, share) => { const out = []; for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (rng() < share) out.push([i, j, pick(rng, ['both', 'both', 'down', 'up'])]); return out; };

// kind → level → list of scenario makers. Each returns { segments, shape }.
const scenarios = {
  'count-squares': {
    1: [() => ({ segments: grid(2, 2) }), () => ({ segments: grid(3, 2) }), () => ({ segments: grid(3, 3) }), () => ({ segments: grid(4, 2) }), () => ({ segments: grid(4, 3) })],
    3: [
      () => ({ segments: grid(4, 4) }), () => ({ segments: grid(5, 3) }), () => ({ segments: grid(5, 4) }),
      () => ({ segments: squareFrom(['diamond', 'inner', 'upright', 'level']) }), () => ({ segments: squareFrom(['diamond', 'upright', 'level']) }), () => ({ segments: squareFrom(['inner', 'upright', 'level', 'falling', 'rising']) }),
      () => ({ segments: gridWithDiagonals(2, 2, [[0, 0, 'both'], [1, 0, 'both'], [0, 1, 'both'], [1, 1, 'both']]) }),
      () => ({ segments: gridWithDiagonals(3, 2, [[0, 0, 'both'], [1, 0, 'both'], [2, 0, 'both'], [0, 1, 'both'], [1, 1, 'both'], [2, 1, 'both']]) }),
      () => ({ segments: gridWithDiagonals(3, 3, [[0, 0, 'both'], [1, 0, 'both'], [0, 1, 'both'], [1, 1, 'both']]) }),
    ],
  },
  'count-rectangles': {
    2: [1, 2, 3, 4].flatMap(m => [1, 2, 3].filter(n => n <= m).map(n => () => ({ segments: grid(m, n) }))),
    3: [rng => ({ segments: panels(rng, 4, 3, 4) }), rng => ({ segments: panels(rng, 4, 3, 5) }), rng => ({ segments: panels(rng, 4, 4, 5) }), rng => ({ segments: panels(rng, 5, 3, 5) })],
    4: [
      rng => ({ segments: panels(rng, 5, 4, 7) }), rng => ({ segments: panels(rng, 5, 4, 8) }), rng => ({ segments: panels(rng, 6, 4, 8) }),
      rng => ({ segments: shear(panels(rng, 5, 3, 6), 0.6), shape: 'parallelogram' }), rng => ({ segments: shear(panels(rng, 4, 4, 6), -0.5), shape: 'parallelogram' }),
    ],
  },
  'count-triangles': {
    2: [() => ({ segments: fan(1) }), () => ({ segments: fan(2) }), () => ({ segments: fan(3) }), () => ({ segments: fan(4) }), () => ({ segments: squareStar(1) }), () => ({ segments: squareStar(2) }), () => ({ segments: triangleGrid(2) }), () => ({ segments: fan(1, 1) })],
    3: [
      () => ({ segments: fan(2, 1) }), () => ({ segments: fan(3, 1) }), () => ({ segments: fan(2, 2) }), () => ({ segments: fan(3, 2) }),
      () => ({ segments: triangleGrid(3) }), () => ({ segments: rhombus(['left']) }), () => ({ segments: rhombus(['top']) }),
      () => ({ segments: polygon(5, { edges: false, steps: [2] }) }), () => ({ segments: squareFrom(['falling', 'rising', 'diamond']) }), () => ({ segments: squareFrom(['falling', 'upright', 'level']) }),
      rng => ({ segments: gridWithDiagonals(2, 2, cellsOf(rng, 2, 2, 0.75)) }), () => ({ segments: polygon(6, { steps: [3] }) }),
    ],
    4: [
      () => ({ segments: polygon(5, { steps: [2] }) }), () => ({ segments: polygon(6, { steps: [2] }) }), () => ({ segments: triangleGrid(4) }), () => ({ segments: triangleGrid(5) }),
      () => ({ segments: rhombus(['left', 'right']) }), () => ({ segments: rhombus(['left', 'top']) }), () => ({ segments: squareStar(3) }), () => ({ segments: fan(4, 2) }), () => ({ segments: fan(3, 3) }),
      () => ({ segments: squareFrom(['falling', 'rising', 'upright', 'level', 'inner']) }), () => ({ segments: squareFrom(['falling', 'rising', 'diamond', 'inner']) }),
      rng => ({ segments: gridWithDiagonals(3, 2, cellsOf(rng, 3, 2, 0.7)) }), rng => ({ segments: gridWithDiagonals(3, 2, cellsOf(rng, 3, 2, 0.7)), shape: 'right-triangle' }),
      () => ({ segments: squareFrom(['falling', 'rising', 'diamond']), shape: 'right-triangle' }),
    ],
  },
};
const DEFAULT_SHAPE = { 'count-squares': 'square', 'count-rectangles': 'rectangle', 'count-triangles': 'triangle' };
const RANGE = { 1: [4, 30], 2: [3, 60], 3: [8, 60], 4: [12, 70] };

function retry(seed, build) {
  for (let i = 0; i < 200; i++) { const q = build(seededRandom(seed * 1013 + i * 7919)); if (q) return q; }
  throw new Error('No counting question for seed ' + seed);
}
const tallyText = (groups, shape) => groups.map(g => g.count).join(' + ');
function solutionFor(segments, shape, value) {
  const groups = bySize(shapesOf(segments, shape));
  const steps = [{ text: `Count by size, smallest first. There are ${groups.length} different sizes of ${NAMES[shape][0]}.` }];
  groups.forEach((g, i) => steps.push({ text: `${i === 0 ? 'Smallest' : i === groups.length - 1 ? 'Largest' : `Size ${i + 1}`}${g.times && i > 0 ? ` (as big as ${g.times} of the smallest)` : ''}: ${g.count}.` }));
  steps.push({ text: `${tallyText(groups, shape)} = ${value}.` });
  return { groups, steps };
}
function mistakesFor(groups, value, shape) {
  const seen = new Set([value]), out = [];
  const push = (v, reason) => { if (Number.isFinite(v) && v > 0 && !seen.has(v)) { seen.add(v); out.push({ value: v, reason }); } };
  push(groups[0].count, `That counts only the smallest ${many(shape)}. Bigger ones are made of several pieces.`);
  if (groups.length > 1) push(value - groups[groups.length - 1].count, `You have missed the largest ${groups[groups.length - 1].count === 1 ? NAMES[shape][0] : many(shape)}. Look at the whole outline.`);
  if (groups.length > 2) push(groups[0].count + groups[1].count, 'That is the two smallest sizes only. Keep going up in size.');
  return out;
}
function singleOptions(rng, value, groups, shape) {
  const wrong = [], seen = new Set([value]);
  const push = (v, reason) => { if (v > 0 && !seen.has(v) && wrong.length < 3) { seen.add(v); wrong.push({ value: v, reason }); } };
  push(groups[0].count, `That counts only the smallest ${many(shape)}.`);
  if (groups.length > 1) push(value - groups[groups.length - 1].count, `The largest ${many(shape)} are missing from that count.`);
  for (const d of shuffle(rng, [1, -1, 2, -2, 3, 4])) push(value + d, 'Close, but one size has been miscounted. Tally each size separately.');
  return shuffle(rng, [{ value, correct: true, reason: `${tallyText(groups, shape)} = ${value}.` }, ...wrong.map(w => ({ ...w, correct: false }))]).map((o, i) => ({ ...o, id: 'ABCD'[i], label: 'ABCD'[i], text: String(o.value) }));
}

function countQuestion(seed, kind, level) {
  return retry(seed, rng => {
    const made = pick(rng, scenarios[kind][level])(rng), shape = made.shape ?? DEFAULT_SHAPE[kind];
    const segments = level >= 3 ? turned(rng, made.segments) : made.segments, value = countOf(segments, shape);
    if (value < RANGE[level][0] || value > RANGE[level][1]) return null;
    const { groups, steps } = solutionFor(segments, shape, value);
    if (level >= 3 && groups.length < 2) return null;
    const base = {
      kind, seed, segments, shape, figures: [{ type: 'lines', segments }],
      prompt: `How many ${many(shape)} are there in this figure? Count every size.`,
      explanation: `By size, smallest first: ${tallyText(groups, shape)} = ${value}.`,
      hints: [`Count the smallest ${many(shape)} first and write the number down.`, `Then look for ${many(shape)} made of two pieces, then three, up to the whole outline.`],
      solution: steps,
    };
    if (level <= 2) { const options = singleOptions(rng, value, groups, shape); return { ...base, answerMode: 'single', options, answer: options.find(o => o.correct).id }; }
    return { ...base, answerMode: 'numeric', unit: many(shape), answer: { value }, mistakes: mistakesFor(groups, value, shape) };
  });
}

// ---------- a line is missing ----------
function hull(points) {
  const P = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]), turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => { const h = []; for (const p of list) { while (h.length >= 2 && turn(h[h.length - 2], h[h.length - 1], p) <= 1e-9) h.pop(); h.push(p); } h.pop(); return h; };
  return [...half(P), ...half([...P].reverse())];
}
const strictlyInside = (p, poly) => poly.every((a, i) => { const b = poly[(i + 1) % poly.length]; return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) > 1e-6; });
// The shortest drawn pieces: each merged segment cut at every point on it.
export function atoms(segments) {
  const { segs, pts } = analyse(segments), out = [];
  for (const s of segs) {
    const on = pts.map(p => ({ p, t: (p[0] - s.a[0]) * s.d[0] + (p[1] - s.a[1]) * s.d[1], off: Math.abs(s.d[0] * (p[1] - s.a[1]) - s.d[1] * (p[0] - s.a[0])) })).filter(o => o.off < 1e-6 && o.t > -1e-6 && o.t < s.length + 1e-6).sort((a, b) => a.t - b.t);
    for (let i = 0; i + 1 < on.length; i++) out.push([on[i].p, on[i + 1].p]);
  }
  return out;
}
const MISSING_BASES = {
  3: [() => ['triangle', squareStar(2)], () => ['triangle', fan(3, 1)], () => ['triangle', triangleGrid(3)], () => ['rectangle', grid(3, 3)], () => ['square', grid(3, 3)], () => ['rectangle', grid(4, 2)], () => ['triangle', fan(2, 2)]],
  4: [() => ['triangle', squareStar(3)], () => ['triangle', triangleGrid(4)], () => ['triangle', fan(3, 2)], () => ['rectangle', grid(4, 3)], () => ['square', grid(4, 4)], () => ['triangle', rhombus(['left'])], () => ['triangle', polygon(5, { steps: [2] })]],
};
function missingQuestion(seed, level) {
  return retry(seed, rng => {
    const [shape, full] = pick(rng, MISSING_BASES[level])(), pieces = atoms(full), all = pieces.flat(), shell = hull(all).reverse();
    const inside = pieces.map((piece, i) => i).filter(i => { const mid = [(pieces[i][0][0] + pieces[i][1][0]) / 2, (pieces[i][0][1] + pieces[i][1][1]) / 2]; return strictlyInside(mid, shell) || strictlyInside(mid, [...shell].reverse()); });
    const gone = shuffle(rng, inside).slice(0, level === 4 ? 2 : 1);
    if (gone.length < (level === 4 ? 2 : 1)) return null;
    const segments = turnedPair(rng, pieces.filter((_, i) => !gone.includes(i)), gone.map(i => pieces[i]));
    const before = countOf(full, shape), value = countOf(segments.kept, shape), lost = before - value;
    if (lost < 1 || value < 5 || value > 60) return null;
    const askLost = rng() < 0.35;
    const { steps } = solutionFor(segments.kept, shape, value);
    return {
      kind: 'count-missing', seed, answerMode: 'numeric', unit: many(shape), shape, segments: segments.kept, full: before,
      prompt: askLost
        ? `The complete figure had ${before} ${many(shape)}. The ${gone.length === 1 ? 'line shown dotted has' : 'two lines shown dotted have'} been rubbed out. How many ${many(shape)} were lost?`
        : `The ${gone.length === 1 ? 'line shown dotted has' : 'two lines shown dotted have'} been rubbed out. How many ${many(shape)} are left? Count every size.`,
      figures: [{ type: 'lines', segments: segments.kept, ghost: segments.gone }],
      answer: { value: askLost ? lost : value },
      mistakes: [askLost ? { value, reason: `That is how many are left. The question asks how many were lost: ${before} − ${value}.` } : { value: before, reason: 'That is the count for the complete figure. Some shapes used the missing line.' },
        askLost ? { value: gone.length, reason: 'One line can be a side of several shapes, large and small.' } : { value: before - gone.length, reason: 'One line can be a side of several shapes, large and small. Each of them is gone.' }].filter((m, i, list) => m.value !== (askLost ? lost : value) && m.value > 0 && list.findIndex(o => o.value === m.value) === i),
      explanation: `Without the dotted ${gone.length === 1 ? 'line' : 'lines'} there are ${value} ${many(shape)}, so ${lost} of the ${before} were lost.`,
      hints: ['Every shape that used the missing line as part of a side is gone, whatever its size.', askLost ? 'Count what is left by size, then subtract from the full count.' : 'Count what is left by size, smallest first.'],
      solution: [...steps, { text: askLost ? `${before} − ${value} = ${lost} lost.` : `${value} are left; ${lost} were lost.` }],
    };
  });
}
function turnedPair(rng, kept, gone) {
  const move = pick(rng, TURNS), a = kept.map(s => s.map(move)), g = gone.map(s => s.map(move)), b = bounds([...a, ...g]);
  const slide = list => list.map(s => s.map(([x, y]) => [x - b.minX, y - b.minY]));
  return { kept: slide(a), gone: slide(g) };
}

// ---------- copy, reflect, join ----------
const JOIN_BASES = [
  rng => ['rectangle', panels(rng, 2, 3, 2)], rng => ['rectangle', panels(rng, 3, 3, 3)], rng => ['rectangle', panels(rng, 3, 2, 3)],
  () => ['triangle', fan(1)], () => ['triangle', fan(2)], () => ['triangle', fan(1, 1)], () => ['triangle', triangleGrid(2)], () => ['triangle', fan(2, 1)],
  () => ['triangle', squareFrom(['falling'])], () => ['triangle', squareFrom(['falling', 'upright'])], () => ['triangle', squareFrom(['falling', 'rising'])], () => ['triangle', squareFrom(['rising', 'level'])],
  () => ['square', squareFrom(['upright', 'level'])], rng => ['triangle', gridWithDiagonals(2, 1, [[0, 0, pick(rng, ['down', 'up'])], [1, 0, 'both']])],
];
function joinedQuestion(seed) {
  return retry(seed, rng => {
    const [shape, base] = pick(rng, JOIN_BASES)(rng), sides = fullSides(base);
    if (!sides.length) return null;
    const side = pick(rng, sides), twice = rng() < 0.3 && sides.length > 1;
    let joined = [...base, ...reflect(base, side.axis, side.at)];
    const mirrors = [{ axis: side.axis, at: side.at }];
    if (twice) { const second = fullSides(joined).find(s => s.axis !== side.axis); if (!second) return null; joined = [...joined, ...reflect(joined, second.axis, second.at)]; mirrors.push({ axis: second.axis, at: second.at }); }
    const one = countOf(base, shape), value = countOf(joined, shape), copies = twice ? 4 : 2;
    if (value <= copies * one || value < 6 || value > 70) return null;
    const { steps } = solutionFor(joined, shape, value);
    return {
      kind: 'count-joined', seed, answerMode: 'numeric', unit: many(shape), shape, segments: base, joined, mirrors,
      prompt: twice
        ? `This figure is copied and the copy is reflected in the dashed line marked 1. The new, larger figure is then copied and reflected in the dashed line marked 2. How many ${many(shape)} are there in the final figure?`
        : `This figure is copied, and the copy is reflected in the dashed line so the two halves join. How many ${many(shape)} are there in the joined figure?`,
      figures: [{ type: 'lines', segments: base, mirrors }],
      answer: { value },
      mistakes: [{ value: copies * one, reason: `That is ${copies} times the count for one piece (${one}). New ${many(shape)} appear across the join: shapes with a part in each half.` }, { value: one, reason: 'That is the count for the figure as drawn. Count in the joined figure.' }].filter((m, i, list) => m.value !== value && list.findIndex(o => o.value === m.value) === i),
      explanation: `One piece has ${one}. ${copies} pieces give ${copies * one}, and ${value - copies * one} more ${many(shape)} cross a join. Total ${value}.`,
      hints: ['Sketch the joined figure. The line the halves share is still there, as one line.', `Count the ${many(shape)} inside one half, multiply, then look for the ones that cross the join.`],
      solution: [{ text: `One piece on its own has ${plural(one, shape)}.` }, { text: `${copies} pieces: ${copies} × ${one} = ${copies * one}.` }, { text: `Shapes that cross a join, with a part in more than one piece: ${value - copies * one}.` }, ...steps.slice(1)],
    };
  });
}

// ---------- which figures have exactly n ----------
const N_POOL = {
  triangle: [() => fan(2), () => fan(3), () => squareStar(1), () => squareStar(2), () => triangleGrid(2), () => triangleGrid(3), () => rhombus([]), () => polygon(5, { edges: false, steps: [2] }), () => fan(1, 1), () => fan(2, 1), () => fan(1, 2), () => squareFrom(['falling', 'upright']), () => squareFrom(['falling', 'upright', 'level']), () => polygon(6, { steps: [3] }), () => gridWithDiagonals(2, 1, [[0, 0, 'both'], [1, 0, 'both']]), () => fan(4), () => squareFrom(['falling', 'rising', 'upright']), () => gridWithDiagonals(2, 2, [[0, 0, 'down'], [1, 0, 'up'], [0, 1, 'up'], [1, 1, 'down']])],
  square: [() => grid(2, 2), () => grid(3, 2), () => grid(3, 3), () => grid(4, 2), () => squareFrom(['diamond', 'upright', 'level']), () => squareFrom(['inner', 'upright', 'level']), () => squareFrom(['diamond', 'inner']), () => gridWithDiagonals(2, 2, [[0, 0, 'both'], [1, 0, 'both'], [0, 1, 'both'], [1, 1, 'both']]), () => grid(4, 1), () => squareFrom(['diamond', 'inner', 'upright', 'level']), () => grid(5, 1), () => grid(4, 3)],
};
function withNQuestion(seed) {
  return retry(seed, rng => {
    const shape = rng() < 0.65 ? 'triangle' : 'square';
    const chosen = shuffle(rng, N_POOL[shape]).slice(0, 4).map(make => { const segments = make(); return { segments, count: countOf(segments, shape) }; });
    const n = pick(rng, chosen).count, right = chosen.filter(c => c.count === n).length;
    if (right > 3 || n < 5) return null;
    // At least one wrong figure must be close to n, so estimating is not enough.
    if (!chosen.some(c => c.count !== n && Math.abs(c.count - n) <= 4)) return null;
    const options = chosen.map((c, i) => ({ id: 'ABCD'[i], label: 'ABCD'[i], correct: c.count === n, count: c.count, figure: { type: 'lines', segments: c.segments }, reason: `This figure has ${plural(c.count, shape)}: ${tallyText(bySize(shapesOf(c.segments, shape)), shape)}.` }));
    const answer = options.filter(o => o.correct).map(o => o.id);
    return {
      kind: 'figure-with-n', seed, answerMode: 'multi', shape, n, figures: [],
      prompt: `Which of these figures contain exactly ${n} ${many(shape)}?`,
      options, answer,
      explanation: `Counts: ${options.map(o => `${o.label} has ${o.count}`).join(', ')}.`,
      hints: ['Count each figure fully, by size. Do not stop at the first one that works.', 'A quick estimate tells you which figures are far off. Count the close ones with care.'],
      solution: [...options.map(o => ({ text: `Option ${o.label}: ${o.reason}` })), { text: `So the answer is ${answer.join(' and ')}.` }],
    };
  });
}

export function figureQuestion(seed, kind, level) {
  if (kind === 'count-missing') return missingQuestion(seed, level);
  if (kind === 'count-joined') return joinedQuestion(seed);
  if (kind === 'figure-with-n') return withNQuestion(seed);
  return countQuestion(seed, kind, level);
}

// ---------- presets for the tool ----------
export const counterPresets = {
  'grid-2': { name: '2 × 2 grid', shape: 'square', segments: () => grid(2, 2) },
  'grid-3': { name: '3 × 3 grid', shape: 'square', segments: () => grid(3, 3) },
  'grid-3-rect': { name: '3 × 2 grid', shape: 'rectangle', segments: () => grid(3, 2) },
  'grid-4-rect': { name: '4 × 3 grid', shape: 'rectangle', segments: () => grid(4, 3) },
  'fan-2': { name: 'Two lines', shape: 'triangle', segments: () => fan(2) },
  'fan-3': { name: 'Three lines', shape: 'triangle', segments: () => fan(3) },
  'fan-bars': { name: 'Lines and a bar', shape: 'triangle', segments: () => fan(2, 1) },
  'fan-bars-2': { name: 'Lines and two bars', shape: 'triangle', segments: () => fan(3, 2) },
  'star-1': { name: 'Diagonals', shape: 'triangle', segments: () => squareStar(1) },
  'star-2': { name: 'Diagonals and midlines', shape: 'triangle', segments: () => squareStar(2) },
  'star-3': { name: 'With a diamond', shape: 'triangle', segments: () => squareStar(3) },
  'tri-3': { name: 'Three rows', shape: 'triangle', segments: () => triangleGrid(3) },
  'tri-4': { name: 'Four rows', shape: 'triangle', segments: () => triangleGrid(4) },
  pentagon: { name: 'Pentagon and star', shape: 'triangle', segments: () => polygon(5, { steps: [2] }) },
  'half-square': { name: 'One half', shape: 'triangle', segments: () => squareFrom(['falling', 'upright']) },
  'joined-square': { name: 'Joined', shape: 'triangle', segments: () => { const base = squareFrom(['falling', 'upright']); return [...base, ...reflect(base, 'x', 4)]; } },
  bricks: { name: 'Uneven panels', shape: 'rectangle', segments: () => panels(seededRandom(11), 4, 3, 5) },
  slanted: { name: 'Slanted panels', shape: 'parallelogram', segments: () => shear(panels(seededRandom(5), 4, 3, 5), 0.6) },
  'tilted-squares': { name: 'Tilted squares', shape: 'square', segments: () => squareFrom(['diamond', 'inner', 'upright', 'level']) },
};
export { mergeCollinear };
