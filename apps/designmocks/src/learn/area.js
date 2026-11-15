// Areas on a grid: shaded areas, the largest of four shapes, nested shapes
// and the chance of landing on the shaded part. Part of the counting-figures
// programme; specification docs/learn/topics/counting-figures.md (areas).
import { pick, seededRandom, shuffle } from './random.js';

const LETTERS = 'ABCD';
function retry(seed, build) {
  for (let i = 0; i < 800; i++) { const q = build(seededRandom(seed * 8059 + i * 4421)); if (q) return q; }
  throw new Error('No area question for seed ' + seed);
}
const lettered = (rng, list) => {
  const options = shuffle(rng, list).map((o, i) => ({ ...o, id: LETTERS[i], label: LETTERS[i] }));
  return { options, answer: options.find(o => o.correct).id };
};
export const shoelace = poly => Math.abs(poly.reduce((s, [x, y], i) => { const [u, v] = poly[(i + 1) % poly.length]; return s + x * v - u * y; }, 0)) / 2;
export function hull(points) {
  const pts = [...new Map(points.map(p => [p.join(), p])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of [...pts].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
const gridLines = (w, h) => [...Array.from({ length: w + 1 }, (_, x) => [[x, 0], [x, h]]), ...Array.from({ length: h + 1 }, (_, y) => [[0, y], [w, y]])];
const edgesOf = poly => poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);
const areaFig = (w, h, poly, extra = []) => ({ type: 'lines', segments: [...gridLines(w, h), ...edgesOf(poly), ...extra], highlight: poly, unit: 22, label: `A ${w} by ${h} grid of unit squares with a shaded shape with ${poly.length} corners` });
const fmt = v => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export const fraction = (n, d) => { const g = gcd(n, d); return `${n / g}/${d / g}`; };

function randomPolygon(rng, w, h, level) {
  if (level <= 2) {
    const kind = pick(rng, ['right-triangle', 'trapezium', 'parallelogram']), x0 = Math.floor(rng() * 2), y0 = Math.floor(rng() * 2), a = 2 + Math.floor(rng() * (w - 2 - x0)), b = 2 + Math.floor(rng() * (h - 2 - y0));
    if (kind === 'right-triangle') return [[x0, y0], [x0 + a, y0], [x0, y0 + b]];
    const t = 1 + Math.floor(rng() * (a - 1));
    return kind === 'trapezium' ? [[x0, y0], [x0 + a, y0], [x0 + t, y0 + b], [x0, y0 + b]] : [[x0, y0], [x0 + a - t, y0], [x0 + a, y0 + b], [x0 + t, y0 + b]];
  }
  const pts = Array.from({ length: 3 + Math.floor(rng() * 3) }, () => [Math.floor(rng() * (w + 1)), Math.floor(rng() * (h + 1))]);
  return hull(pts);
}
export function shadedAreaQuestion(seed, level = 2) {
  return retry(seed, rng => {
    const [w, h] = [6, 5], poly = randomPolygon(rng, w, h, level), value = shoelace(poly);
    if (poly.length < 3 || value < 3 || (level >= 3 && poly.length < 4 && rng() < 0.5)) return null;
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]), box = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (level >= 3 && box === value) return null;
    const mistakes = [{ value: box, reason: 'That is the whole rectangle around the shape. Take away the unshaded corners.' }, { value: 2 * value, reason: 'A triangle is half of its rectangle; remember to halve.' }, { value: Math.round(value), reason: 'Half squares count as halves; do not round.' }].filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i);
    return {
      kind: 'shaded-area', seed, answerMode: 'numeric', unit: 'squares', poly,
      prompt: 'Each small square of the grid has area 1. What is the area of the shaded shape?',
      figures: [areaFig(w, h, poly)],
      answer: { value }, mistakes,
      explanation: `Draw the rectangle around the shape (area ${box}) and subtract the right triangles and rectangles outside it: ${fmt(value)}.`,
      ...(level >= 3 ? { hints: ['Draw the smallest rectangle around the shape.', 'The parts outside the shape are right triangles and rectangles: each triangle is half its own rectangle.'], solution: [{ text: `Surrounding rectangle: ${box} squares.` }, { text: `Outside pieces: ${fmt(box - value)} squares altogether.` }, { text: `Shaded area: ${box} − ${fmt(box - value)} = ${fmt(value)}.` }] } : {}),
    };
  });
}
export function largestQuestion(seed) {
  return retry(seed, rng => {
    const shapes = Array.from({ length: 4 }, () => randomPolygon(rng, 4, 4, 3)), areas = shapes.map(shoelace);
    if (shapes.some(p => p.length < 3) || areas.some(a => a < 2)) return null;
    const best = Math.max(...areas), sorted = [...areas].sort((a, b) => b - a);
    if (sorted[0] - sorted[1] < 0.5 || sorted[0] - sorted[1] > 2.5) return null;
    const { options, answer } = lettered(rng, shapes.map((p, i) => ({ correct: areas[i] === best, figure: areaFig(4, 4, p), reason: `Area ${fmt(areas[i])} squares.` })));
    return {
      kind: 'largest-shape', seed, answerMode: 'single',
      prompt: 'Each grid is made of unit squares. Which shaded shape has the largest area?',
      figures: [], options, answer,
      explanation: 'Work out each area: the rectangle round the shape, minus the pieces outside it. The shapes that look biggest are not always the largest.',
      hints: ['Find each area with the surrounding rectangle.', 'Long thin slanting shapes are often smaller than they look.'],
      solution: [...options.map(o => ({ text: `${o.label}: ${o.reason}` })), { text: `Largest: ${options.find(o => o.correct).label}.` }],
    };
  });
}

// Nested shapes and chance: answers as fractions.
const fracOptions = (rng, right, wrong, why) => { const list = [right, ...wrong].filter((t, i, l) => l.indexOf(t) === i).slice(0, 4); return list.length < 4 ? null : lettered(rng, list.map(t => ({ correct: t === right, text: t, reason: why(t) }))); };
export function nestedQuestion(seed) {
  return retry(seed, rng => {
    const form = pick(rng, ['square', 'triangle', 'grid']);
    if (form === 'square') {
      const k = 1 + Math.floor(rng() * 3), s = 2 ** (k + 1), squares = [[[0, 0], [s, 0], [s, s], [0, s]]];
      for (let i = 0; i < k; i++) { const p = squares[i]; squares.push(p.map((a, j) => { const b = p[(j + 1) % 4]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; })); }
      const right = fraction(1, 2 ** k), wrong = [fraction(1, 2 ** (k + 1)), fraction(1, 4 ** k), fraction(1, 2 * k + 1), fraction(1, 3), fraction(1, 4 ** (k + 1)), fraction(1, 6)];
      const made = fracOptions(rng, right, wrong, t => (t === right ? 'Joining midpoints halves the square each time.' : 'Each midpoint square is half the one around it, not a quarter.'));
      if (!made) return null;
      const { options, answer } = made;
      return { kind: 'nested-ratio', seed, answerMode: 'single', prompt: `Starting from a square, the midpoints of its sides are joined to make a new square, ${k === 1 ? 'once' : `${k} times over`}. What fraction of the big square is the smallest square?`, figures: [{ type: 'lines', segments: squares.flatMap(edgesOf), highlight: squares[k], unit: 34 / (2 ** (k - 1)), label: `A square with ${k} smaller square${k > 1 ? 's' : ''} drawn inside by joining midpoints; the smallest is shaded` }], options, answer, explanation: `The midpoint square cuts off four corner triangles that together make exactly half the square. So each new square is half the last: (1/2)^${k} = ${right}.`, hints: ['Fold the four corner triangles in: they cover the middle square exactly.'], solution: [{ text: 'Each midpoint square is half the square around it.' }, { text: `${k} steps: multiply by 1/2 ${k} time${k > 1 ? 's' : ''}.` }, { text: `Fraction: ${right}.` }] };
    }
    if (form === 'triangle') {
      const k = 1 + Math.floor(rng() * 2), tris = [[[0, 0], [8, 0], [4, 8]]];
      for (let i = 0; i < k; i++) { const p = tris[i]; tris.push(p.map((a, j) => { const b = p[(j + 1) % 3]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; })); }
      const right = fraction(1, 4 ** k), wrong = [fraction(1, 2 ** k), fraction(1, 3 ** k), fraction(1, 4 ** k * 2), fraction(1, 3), fraction(1, 6)];
      const made = fracOptions(rng, right, wrong, t => (t === right ? 'Joining midpoints of a triangle makes four equal triangles; the middle one is a quarter.' : 'Count the four equal triangles that joining the midpoints makes.'));
      if (!made) return null;
      const { options, answer } = made;
      return { kind: 'nested-ratio', seed, answerMode: 'single', prompt: `The midpoints of a triangle's sides are joined, ${k === 1 ? 'once' : 'and then again inside the middle triangle'}. What fraction of the big triangle is the smallest middle triangle?`, figures: [{ type: 'lines', segments: tris.flatMap(edgesOf), highlight: tris[k], unit: 22, label: 'A triangle with smaller triangles made by joining midpoints; the smallest middle one is shaded' }], options, answer, explanation: `Joining the midpoints splits a triangle into four equal triangles, so the middle one is a quarter. ${k} times: ${right}.`, hints: ['Joining the midpoints makes four triangles. Are they equal?'], solution: [{ text: 'The midpoint lines make four equal triangles.' }, { text: 'The middle one is 1/4 of the triangle.' }, { text: `${k} steps: ${right}.` }] };
    }
    const n = pick(rng, [4, 6]), poly = randomPolygon(rng, n, n, 3), a2 = Math.round(shoelace(poly) * 2), total = 2 * n * n;
    if (poly.length < 3 || a2 < 4) return null;
    const right = fraction(a2, total), wrong = [fraction(a2, total / 2 > a2 ? total / 2 : total * 2), fraction(Math.max(1, a2 - 2), total), fraction(a2 + 2, total), fraction(Math.round(a2 / 2) || 1, n * n * 3)];
    const made = fracOptions(rng, right, wrong, t => (t === right ? `Shaded ${fmt(a2 / 2)} of ${n * n} squares.` : 'Recount the shaded area, then divide by the whole square.'));
    if (!made) return null;
    const { options, answer } = made;
    return { kind: 'nested-ratio', seed, answerMode: 'single', prompt: `What fraction of the whole ${n} × ${n} square is shaded?`, figures: [areaFig(n, n, poly)], options, answer, explanation: `Shaded area ${fmt(a2 / 2)}, whole ${n * n}: ${right}.`, hints: ['Find the shaded area first, then divide by the whole.'], solution: [{ text: `Shaded area: ${fmt(a2 / 2)} squares.` }, { text: `Whole square: ${n * n} squares.` }, { text: `Fraction: ${fmt(a2 / 2)} ÷ ${n * n} = ${right}.` }] };
  });
}
export function chanceQuestion(seed) {
  return retry(seed, rng => {
    const n = pick(rng, [4, 5, 6]), poly = randomPolygon(rng, n, n, 3), a2 = Math.round(shoelace(poly) * 2), total = 2 * n * n;
    if (poly.length < 3 || a2 < 4 || a2 >= total) return null;
    const right = fraction(a2, total), miss = fraction(total - a2, total);
    const wrong = [miss, fraction(poly.length, n * n), fraction(a2, total + 2 * n)];
    if (new Set([right, ...wrong]).size < 4) return null;
    const made = fracOptions(rng, right, wrong, t => (t === right ? 'Chance = shaded area ÷ whole area.' : t === miss ? 'That is the chance of missing the shaded part.' : 'Use areas, not counts of corners or lines.'));
    if (!made) return null;
    const { options, answer } = made;
    return {
      kind: 'land-chance', seed, answerMode: 'single',
      prompt: `A dart lands at a random point of this ${n} × ${n} square board. What is the chance it lands in the shaded part?`,
      figures: [areaFig(n, n, poly)], options, answer,
      explanation: `Every point is equally likely, so the chance is the shaded area over the whole area: ${fmt(a2 / 2)} ÷ ${n * n} = ${right}.`,
      hints: ['Chance = shaded area ÷ whole area.', 'Find the shaded area with the surrounding rectangle.'],
      solution: [{ text: `Shaded area: ${fmt(a2 / 2)}.` }, { text: `Whole board: ${n * n}.` }, { text: `Chance: ${right}.` }],
    };
  });
}

export function areaQuestion(seed, kind, level) {
  switch (kind) {
    case 'shaded-area': return shadedAreaQuestion(seed, level);
    case 'largest-shape': return largestQuestion(seed);
    case 'nested-ratio': return nestedQuestion(seed);
    case 'land-chance': return chanceQuestion(seed);
    default: throw new Error('Unknown area kind ' + kind);
  }
}
export const AREA_KINDS = Object.freeze({ 'shaded-area': [2, 3], 'largest-shape': [3], 'nested-ratio': [4], 'land-chance': [4] });
