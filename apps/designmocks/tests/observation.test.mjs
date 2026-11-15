// Observation answers checked independently: the odd icon by a majority
// vote over the drawn grid, the pattern break by trying every repeat length,
// clutter counts by re-reading the drawn shapes, and differences by comparing
// the two drawn grids feature by feature.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OBSERVATION_KINDS, observationQuestion } from '../src/learn/observation.js';

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
const right = q => q.options.find(o => o.id === q.answer);
const k = ic => JSON.stringify([ic.hand, ic.dots, !!ic.filled]);
const where = (text, cols) => { const [r, c] = text.match(/\d+/g).map(Number); return (r - 1) * cols + (c - 1); };

test('every kind builds sound questions', () => {
  for (const [kind, levels] of Object.entries(OBSERVATION_KINDS)) for (const level of levels) for (const seed of seeds) {
    const q = observationQuestion(seed, kind, level);
    if (q.answerMode === 'numeric') { for (const m of q.mistakes) assert.notEqual(m.value, q.answer.value); }
    else if (q.answerMode === 'multi') assert.ok(q.answer.length >= 1 && q.answer.length <= 3);
    else { assert.equal(q.options.length, 4); assert.equal(q.options.filter(o => o.correct).length, 1); assert.equal(new Set(q.options.map(o => o.text)).size, 4); }
    if (level >= 3) { assert.ok(q.hints.length >= 1, kind); assert.ok(q.solution.length >= 3, kind); }
  }
});

test('the odd icon is the only one outvoted', () => {
  for (const level of [2, 3]) for (const seed of seeds) {
    const q = observationQuestion(seed, 'odd-icon', level), f = q.figures[0], tally = {};
    f.icons.forEach(ic => { tally[k(ic)] = (tally[k(ic)] ?? 0) + 1; });
    const lonely = f.icons.map((ic, i) => (tally[k(ic)] === 1 ? i : -1)).filter(i => i >= 0);
    assert.deepEqual(lonely, [where(right(q).text, f.cols)], `seed ${seed}`);
  }
});

test('the pattern break is the one tile no repeat length explains', () => {
  for (const seed of seeds) {
    const q = observationQuestion(seed, 'pattern-break', 3), f = q.figures[0], keys = f.icons.map(k);
    // The true repeat leaves exactly one tile disagreeing with the majority of its column-of-repeat.
    let found = null;
    for (let p = 2; p <= 4 && found === null; p++) {
      const bad = [];
      for (let r = 0; r < p; r++) { const group = keys.map((x, i) => [x, i]).filter(([, i]) => i % p === r), t = {}; group.forEach(([x]) => { t[x] = (t[x] ?? 0) + 1; }); const top = Object.entries(t).sort((a, b) => b[1] - a[1])[0][0]; group.forEach(([x, i]) => { if (x !== top) bad.push(i); }); }
      if (bad.length === 1) found = bad[0];
    }
    assert.equal(found, where(right(q).text, f.cols), `seed ${seed}`);
  }
});

test('clutter and differences re-read from the drawn figures', () => {
  for (const level of [3, 4]) for (const seed of seeds) {
    const q = observationQuestion(seed, 'clutter-count', level), shapes = q.figures[0].shapes, kind = q.prompt.includes('triangles pointing') ? 'triangle' : q.prompt.match(/How many (\w+?)s /)[1];
    assert.equal(q.answer.value, shapes.filter(s => s.type === kind && (!q.prompt.includes('pointing straight up') || s.turn === 0)).length, q.prompt);
  }
  for (const level of [3, 4]) for (const seed of seeds) {
    const q = observationQuestion(seed, 'spot-difference', level), [a, b] = q.figures.map(f => f.icons);
    assert.equal(q.answer.value, a.filter((ic, i) => k(ic) !== k(b[i])).length);
  }
});

test('letter symmetry follows stroke-by-stroke reasoning', () => {
  // Each letter as straight strokes and arcs on a 2 × 4 box, reflected or turned and compared.
  const G = { A: [[0, 0, 1, 4], [1, 4, 2, 0], [0.5, 2, 1.5, 2]], B: null, C: null, D: null, E: [[0, 0, 0, 4], [0, 4, 2, 4], [0, 2, 1.5, 2], [0, 0, 2, 0]], F: [[0, 0, 0, 4], [0, 4, 2, 4], [0, 2, 1.5, 2]], H: [[0, 0, 0, 4], [2, 0, 2, 4], [0, 2, 2, 2]], I: [[1, 0, 1, 4]], K: [[0, 0, 0, 4], [0, 2, 2, 4], [0, 2, 2, 0]], L: [[0, 0, 0, 4], [0, 0, 2, 0]], M: [[0, 0, 0, 4], [0, 4, 1, 2], [1, 2, 2, 4], [2, 4, 2, 0]], N: [[0, 0, 0, 4], [0, 4, 2, 0], [2, 0, 2, 4]], T: [[0, 4, 2, 4], [1, 4, 1, 0]], V: [[0, 4, 1, 0], [1, 0, 2, 4]], W: [[0, 4, 0.5, 0], [0.5, 0, 1, 2], [1, 2, 1.5, 0], [1.5, 0, 2, 4]], X: [[0, 0, 2, 4], [0, 4, 2, 0]], Y: [[0, 4, 1, 2], [2, 4, 1, 2], [1, 2, 1, 0]], Z: [[0, 4, 2, 4], [2, 4, 0, 0], [0, 0, 2, 0]] };
  const norm = segs => segs.map(([a, b, c, d]) => (a < c || (a === c && b <= d) ? [a, b, c, d] : [c, d, a, b]).join()).sort().join(' ');
  const ops = { leftRight: ([a, b, c, d]) => [2 - a, b, 2 - c, d], upDown: ([a, b, c, d]) => [a, 4 - b, c, 4 - d], halfTurn: ([a, b, c, d]) => [2 - a, 4 - b, 2 - c, 4 - d] };
  const prop = q => (q.prompt.includes('mirror stood') ? 'leftRight' : q.prompt.includes('water') ? 'upDown' : 'halfTurn');
  for (const seed of seeds) {
    const q = observationQuestion(seed, 'letter-symmetry', 2), p = prop(q);
    for (const o of q.options) { const g = G[o.text]; if (!g) continue; assert.equal(norm(g.map(ops[p])) === norm(g), o.correct, `${o.text} ${p}`); }
  }
});
