import assert from 'node:assert/strict';
import test from 'node:test';
import { PATTERN_KINDS, TRANSFORMS, patternQuestion } from '../src/learn/patterns.js';
import { OUTLINES, looks, placed } from '../src/learn/pattern-shapes.js';

const turn = (p, k) => { let q = p; for (let i = 0; i < k; i++) q = TRANSFORMS.turn.f(q); return q; };

test('slanted shapes are never their own mirror image; plain shapes are', () => {
  for (const shape of ['arrow', 'hook', 'flag']) {
    const item = { shape, fill: 'black', x: 0.5, y: 0.5, size: 0.4, rot: 0 };
    for (let r = 0; r < 360; r += 15) assert.notEqual(looks([{ ...item, rot: r }]), looks([{ ...item, mirror: true }]), `${shape} at ${r}°`);
  }
  for (const shape of ['circle', 'square', 'diamond', 'plus']) assert.equal(looks([{ shape, fill: 'grey', x: 0.3, y: 0.3, size: 0.2, rot: 0 }]), looks([{ shape, fill: 'grey', x: 0.3, y: 0.3, size: 0.2, rot: 0, mirror: true }]));
  assert.ok(Object.keys(OUTLINES).length >= 9);
  assert.equal(placed({ shape: 'square', x: 0.5, y: 0.5, size: 1, rot: 0 }).length, 4);
});

test('every option looks different, at every level', () => {
  for (const [kind, levels] of Object.entries(PATTERN_KINDS)) for (const level of levels) for (let seed = 1; seed <= 40; seed++) {
    const q = patternQuestion(seed, kind, level);
    assert.equal(new Set(q.options.map(o => looks(o.figure.panel))).size, 4, `${kind} L${level} seed ${seed}`);
    assert.equal(q.options.filter(o => o.correct).length, 1);
  }
});

test('grids: the right answer fits its row and column; each wrong one breaks one', () => {
  for (const level of [3, 4]) for (let seed = 1; seed <= 40; seed++) {
    const q = patternQuestion(seed, 'matrix-cell', level), g = q.figures[0].grid;
    const fits = cell => {
      const row = [g[2][0], g[2][1], cell], col = [g[0][2], g[1][2], cell];
      const shapes = new Set(row.map(p => p[0].shape)), fill = new Set(col.map(p => p[0].fill));
      const countsOk = level === 3 || [0, 1, 2].every(c => g[0][c].length === (c === 2 ? cell.length : g[2][c]?.length ?? cell.length));
      return shapes.size === 3 && fill.size === 1 && countsOk && cell.every(i => i.shape === cell[0].shape && i.fill === cell[0].fill);
    };
    for (const o of q.options) assert.equal(fits(o.figure.panel), o.correct, `grid L${level} seed ${seed} option ${o.id}`);
  }
});

test('analogies: every one or two changes that turn the first figure into the second give the answer', () => {
  const names = Object.keys(TRANSFORMS);
  for (let seed = 1; seed <= 40; seed++) {
    const q = patternQuestion(seed, 'analogy', 3), [A, B, C] = q.figures[0].panels, answers = new Set();
    for (const a of names) for (const b of [null, ...names]) {
      const f = p => (b ? TRANSFORMS[b].f(TRANSFORMS[a].f(p)) : TRANSFORMS[a].f(p));
      if (looks(f(A)) === looks(B)) answers.add(looks(f(C)));
    }
    assert.ok(answers.has(looks(q.options.find(o => o.correct).figure.panel)), `analogy seed ${seed}`);
  }
});

test('odd one out: the other three are turns of each other; the odd one is not', () => {
  for (const level of [2, 4]) for (let seed = 1; seed <= 40; seed++) {
    const q = patternQuestion(seed, 'odd-one-out', level), panels = q.options.map(o => o.figure.panel);
    const sameUpToTurn = (a, b) => [0, 1, 2, 3].some(k => looks(turn(a, k)) === looks(b));
    const odd = q.options.findIndex(o => o.correct), rest = panels.filter((_, i) => i !== odd);
    assert.ok(rest.every(p => sameUpToTurn(rest[0], p)), `odd L${level} seed ${seed}: the others match`);
    assert.ok(!sameUpToTurn(rest[0], panels[odd]), `odd L${level} seed ${seed}: the odd one differs`);
  }
});
