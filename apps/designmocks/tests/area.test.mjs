// Areas checked by Pick's theorem: area = interior lattice points + boundary
// points ÷ 2 − 1, counted point by point, never by the shoelace formula the
// engine uses. Nested shapes are checked against the outermost shape drawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AREA_KINDS, areaQuestion } from '../src/learn/area.js';

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
const right = q => q.options.find(o => o.id === q.answer);
const g = (a, b) => (b ? g(b, a % b) : Math.abs(a));
function pick(poly) {
  let boundary = 0;
  poly.forEach(([x, y], i) => { const [u, v] = poly[(i + 1) % poly.length]; boundary += g(u - x, v - y); });
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  let interior = 0;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x++) for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
    let inside = true, onEdge = false, sign = 0;
    poly.forEach(([ax, ay], i) => { const [bx, by] = poly[(i + 1) % poly.length], c = (bx - ax) * (y - ay) - (by - ay) * (x - ax); if (c === 0 && Math.min(ax, bx) <= x && x <= Math.max(ax, bx) && Math.min(ay, by) <= y && y <= Math.max(ay, by)) onEdge = true; else if (c !== 0) { if (!sign) sign = Math.sign(c); else if (Math.sign(c) !== sign) inside = false; } });
    if (inside && !onEdge) interior++;
  }
  return interior + boundary / 2 - 1;
}
const asFraction = t => { const [n, d] = t.split('/').map(Number); return n / d; };

test('every kind builds sound questions', () => {
  for (const [kind, levels] of Object.entries(AREA_KINDS)) for (const level of levels) for (const seed of seeds) {
    const q = areaQuestion(seed, kind, level);
    if (q.answerMode === 'numeric') { for (const m of q.mistakes) assert.notEqual(m.value, q.answer.value); }
    else { assert.equal(q.options.length, 4); assert.equal(q.options.filter(o => o.correct).length, 1); assert.equal(new Set(q.options.map(o => o.text ?? JSON.stringify(o.figure.highlight))).size, 4); }
    if (level >= 3) { assert.ok(q.hints.length >= 1, kind); assert.ok(q.solution.length >= 3, kind); }
  }
});

test("shaded areas and the largest shape agree with Pick's theorem", () => {
  for (const level of [2, 3]) for (const seed of seeds) {
    const q = areaQuestion(seed, 'shaded-area', level);
    assert.equal(q.answer.value, pick(q.figures[0].highlight), `seed ${seed}`);
  }
  for (const seed of seeds) {
    const q = areaQuestion(seed, 'largest-shape', 3), areas = q.options.map(o => pick(o.figure.highlight));
    assert.equal(areas.indexOf(Math.max(...areas)), q.options.indexOf(right(q)));
  }
});

test('fractions and chances are shaded area over the whole', () => {
  for (const seed of seeds) {
    const q = areaQuestion(seed, 'land-chance', 4), n = Number(q.prompt.match(/this (\d+) ×/)[1]);
    assert.ok(Math.abs(asFraction(right(q).text) - pick(q.figures[0].highlight) / (n * n)) < 1e-12, `seed ${seed}`);
  }
  for (const seed of seeds) {
    const q = areaQuestion(seed, 'nested-ratio', 4), f = q.figures[0], shaded = f.highlight;
    const area = poly => Math.abs(poly.reduce((s, [x, y], i) => { const [u, v] = poly[(i + 1) % poly.length]; return s + (u - x) * (v + y); }, 0)) / 2; // trapezium rule, a different sum
    let whole;
    if (q.prompt.includes('square, the midpoints')) whole = area(f.segments.slice(0, 4).map(s => s[0]));
    else if (q.prompt.includes("triangle's sides")) whole = area(f.segments.slice(0, 3).map(s => s[0]));
    else { const n = Number(q.prompt.match(/whole (\d+) ×/)[1]); whole = n * n; assert.equal(area(shaded), pick(shaded)); }
    assert.ok(Math.abs(asFraction(right(q).text) - area(shaded) / whole) < 1e-12, `seed ${seed}: ${q.prompt}`);
  }
});
