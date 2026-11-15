// Fit answers checked a second way: rotations by matrix, tilings by trying
// every placement of every piece, and hidden figures by sampling points
// along every line and testing containment after each whole-number shift.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIT_KINDS, fitQuestion } from '../src/learn/fit.js';

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
const right = q => q.options.find(o => o.id === q.answer);
const norm = cells => { const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1])); return cells.map(([x, y]) => `${x - mx},${y - my}`).sort().join(' '); };
const rotations = cells => [0, 1, 2, 3].map(k => cells.map(([x, y]) => { let [a, b] = [x, y]; for (let i = 0; i < k; i++) [a, b] = [-b, a]; return [a, b]; }));
const fitsByTurning = (a, b) => rotations(a).some(r => norm(r) === norm(b));

// All placements of a piece (turns only) inside a set of free cells.
function placements(piece, free) {
  const out = [], f = [...free].map(k => k.split(',').map(Number));
  for (const r of rotations(piece)) for (const [fx, fy] of f) {
    const [ax, ay] = r[0], cells = r.map(([x, y]) => `${x - ax + fx},${y - ay + fy}`);
    if (cells.every(c => free.has(c))) out.push(cells);
  }
  return out;
}
function canTile(target, pieces) {
  const free = new Set(target.map(c => c.join(',')));
  if (pieces.reduce((s, p) => s + p.length, 0) !== free.size) return false;
  const go = (left, i) => { if (i === pieces.length) return left.size === 0; for (const pl of placements(pieces[i], left)) { const next = new Set(left); pl.forEach(c => next.delete(c)); if (go(next, i + 1)) return true; } return false; };
  return go(free, 0);
}

test('every kind builds sound questions', () => {
  for (const [kind, levels] of Object.entries(FIT_KINDS)) for (const level of levels) for (const seed of seeds) {
    const q = fitQuestion(seed, kind, level);
    if (q.answerMode === 'numeric') { for (const m of q.mistakes) assert.notEqual(m.value, q.answer.value); }
    else { assert.equal(q.options.length, 4); assert.equal(q.options.filter(o => o.correct).length, 1); }
    if (level >= 3) { assert.ok(q.hints.length >= 1, kind); assert.ok(q.solution.length >= 3, kind); }
  }
});

test('only the right piece fills the gap by turning', () => {
  for (const level of [2, 3]) for (const seed of seeds) {
    const q = fitQuestion(seed, 'fill-gap', level), gap = q.figures[0].holes;
    for (const o of q.options) assert.equal(fitsByTurning(o.figure.cells, gap), o.correct, `seed ${seed} ${o.label}`);
  }
});

test('only the right pair tiles the shape', () => {
  for (const seed of seeds) {
    const q = fitQuestion(seed, 'two-pieces', 3);
    for (const o of q.options) assert.equal(canTile(q.target, o.figure.pieces), o.correct, `seed ${seed} ${o.label}`);
  }
});

test('exactly one piece is left over', () => {
  for (const seed of seeds) {
    const q = fitQuestion(seed, 'odd-piece', 4), pieces = q.options.map(o => o.figure.cells);
    for (let i = 0; i < 4; i++) assert.equal(canTile(q.target, pieces.filter((_, j) => j !== i)), q.options[i].correct, `seed ${seed} ${q.options[i].label}`);
  }
});

// Raster: points every quarter step along each line.
const raster = segs => { const out = new Set(); for (const [[x1, y1], [x2, y2]] of segs) { const n = 4 * Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)); for (let i = 0; i <= n; i++) out.add(`${x1 + ((x2 - x1) * i) / n},${y1 + ((y2 - y1) * i) / n}`); } return out; };
function copies(target, drawing) {
  const t = [...raster(target)].map(k => k.split(',').map(Number)), d = raster(drawing);
  let count = 0;
  for (let ox = -10; ox <= 10; ox++) for (let oy = -10; oy <= 10; oy++) if (t.every(([x, y]) => d.has(`${x + ox},${y + oy}`))) count++;
  return count;
}
test('hidden figures: sampled points find the figure only in the right drawing', () => {
  for (const level of [3, 4]) for (const seed of seeds) {
    const q = fitQuestion(seed, 'hidden-figure', level), target = q.figures[0].segments;
    for (const o of q.options) assert.equal(copies(target, o.figure.segments) > 0, o.correct, `seed ${seed} ${o.label}`);
    const units = [...q.options.map(o => o.figure.unit), q.figures[0].unit];
    assert.equal(new Set(units).size, 1, 'all drawn to one scale');
  }
  for (const seed of seeds) {
    const q = fitQuestion(seed, 'hidden-count', 4);
    assert.equal(q.answer.value, copies(q.figures[0].segments, q.figures[1].segments), `count seed ${seed}`);
  }
});
