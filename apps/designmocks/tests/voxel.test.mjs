import assert from 'node:assert/strict';
import test from 'node:test';
import { canonical, consistent, drawingKey, isChiral, maximalStack, mirror, possibleSides, rotate, sameSolid, stackViews, symmetryCount, turnStack, viewGrid, viewsQuestion } from '../src/learn/voxel.js';
import { rotations } from '../src/learn/cube-net.js';

const grid = g => g.map(r => r.map(b => (b ? 1 : 0)).join('')).join('/');

test('hand-checked solids and views', () => {
  assert.equal(symmetryCount([[0, 0, 0], [1, 0, 0], [2, 0, 0]]), 8);
  assert.equal(isChiral([[0, 0, 0], [1, 0, 0], [2, 0, 0]]), false);
  assert.equal(isChiral([[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [2, 1, 1]]), true);
  const s = [[0, 0, 0], [1, 0, 0], [2, 1, 0], [0, 0, 1], [1, 0, 1]];
  const turnZ = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];
  assert.ok(sameSolid(rotate(rotate(rotate(rotate(s, turnZ), turnZ), turnZ), turnZ), s), 'four quarter turns return the solid');
  assert.equal(rotations.length, 24);
  // A stack two high at the front-left corner: front view one column two high on the left; right side one column two high on the right.
  const h = [[2, 0, 0], [0, 0, 0], [0, 0, 0]];
  assert.equal(grid(viewGrid(h, 'front')), '100/100');
  assert.equal(grid(viewGrid(h, 'side')), '001/001');
  assert.equal(grid(viewGrid(h, 'top')), '100/000/000');
  assert.equal(consistent([[true]], [2], [1]), false, 'the heights disagree');
  // A 2×2×2 block with one top cube removed: the views do not show the gap, so the largest stack is the full block.
  const block = [[2, 2], [2, 1]], v = stackViews(block);
  assert.deepEqual(maximalStack(v.top, v.front, v.side), [[2, 2], [2, 2]]);
});

test('turning a stack moves each square round the middle, from above', () => {
  const h = [[1, 2, 3], [0, 0, 0], [0, 0, 0]];
  // A quarter turn clockwise, seen from above, takes the far edge round to the right-hand edge.
  assert.deepEqual(turnStack(h, 4), h);
  assert.deepEqual(turnStack(turnStack(h, 1), 3), h);
  const cubes = h.flatMap((row, x) => row.flatMap((n, y) => Array.from({ length: n }, (_, z) => [x, y, z])));
  const turned = turnStack(h, 1).flatMap((row, x) => row.flatMap((n, y) => Array.from({ length: n }, (_, z) => [x, y, z])));
  assert.ok(sameSolid(cubes, turned), 'a turned stack is the same solid');
});

test('possible side views: brute force over every stack under the views', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const q = viewsQuestion(seed, 'missing-view', 3), { top, front } = q.figures[0];
    // Every height map with heights 0–3 on the used squares only.
    const cells = top.flatMap((row, x) => row.map((on, y) => (on ? [x, y] : null))).filter(Boolean), sides = new Set();
    for (let code = 0; code < 3 ** cells.length; code++) {
      const h = top.map(r => r.map(() => 0)); let c = code;
      for (const [x, y] of cells) { h[x][y] = (c % 3) + 1; c = Math.floor(c / 3); }
      const v = stackViews(h);
      if (JSON.stringify(v.front) === JSON.stringify(front)) sides.add(grid(viewGrid(h, 'side')));
    }
    for (const o of q.options) {
      const g = o.figure.grid, rows = g.length, key = grid(g);
      // Compare after padding to the same height.
      const match = [...sides].some(s => { const r = s.split('/'); const pad = Array(Math.max(0, rows - r.length)).fill('0'.repeat(r[0].length)); return [...pad, ...r].join('/') === key; });
      assert.equal(o.correct, match, `missing view seed ${seed} option ${o.id}`);
    }
    assert.equal(possibleSides(top, front).length >= 2, true);
  }
});

test('solid-from-views and view questions match their views', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const q = viewsQuestion(seed, 'solid-from-views', 3), want = q.figures[0];
    for (const o of q.options) {
      const v = stackViews(o.figure.heights), same = ['top', 'front', 'side'].every(k => JSON.stringify(v[k]) === JSON.stringify(want[k]));
      assert.equal(o.correct, same, `from views seed ${seed}`);
    }
    for (const level of [1, 2]) {
      const p = viewsQuestion(seed, 'view-of-stack', level), which = p.prompt.includes('top view') ? 'top' : p.prompt.includes('front view') ? 'front' : 'side';
      assert.equal(grid(p.options.find(o => o.correct).figure.grid), grid(viewGrid(p.heights, which)));
      assert.equal(new Set(p.options.map(o => grid(o.figure.grid))).size, 4);
    }
    const t = viewsQuestion(seed, 'view-after-turn', 4), which = t.prompt.includes('front view') ? 'front' : 'side';
    // Turn the cubes themselves about the vertical axis and read the view again.
    const cubes = t.heights.flatMap((row, x) => row.flatMap((n, y) => Array.from({ length: n }, (_, z) => [x, y, z])));
    let turned = cubes; for (let i = 0; i < t.quarter; i++) turned = turned.map(([x, y, z]) => [y, 2 - x, z]);
    const h = [0, 1, 2].map(x => [0, 1, 2].map(y => turned.filter(c => c[0] === x && c[1] === y).length));
    assert.equal(grid(t.options.find(o => o.correct).figure.grid), grid(viewGrid(h, which)), `after turn seed ${seed}`);
  }
});

test('same-solid: correct options are rotations, wrong ones are not, and no two drawings look alike', () => {
  for (const level of [2, 3, 4]) for (let seed = 1; seed <= 25; seed++) {
    const q = viewsQuestion(seed, 'same-solid', level), shown = q.figures[0].cubes.map(c => [c.x, c.y, c.z]);
    for (const o of q.options) {
      const cubes = o.figure.cubes.map(c => [c.x, c.y, c.z]);
      // Independent check: try every rotation of the option against the picture.
      const key = s => s.map(c => c.join(',')).sort().join(';'), norm = s => { const lo = [0, 1, 2].map(i => Math.min(...s.map(c => c[i]))); return s.map(c => c.map((v, i) => v - lo[i])); };
      const match = rotations.some(m => key(norm(cubes.map(c => [0, 1, 2].map(i => m[i][0] * c[0] + m[i][1] * c[1] + m[i][2] * c[2])))) === key(norm(shown)));
      assert.equal(o.correct, match, `same-solid L${level} seed ${seed} option ${o.id}`);
    }
    assert.equal(new Set(q.options.map(o => drawingKey(o.figure.cubes.map(c => [c.x, c.y, c.z])))).size, 4);
    if (level >= 3) assert.ok(q.options.some(o => sameSolid(o.figure.cubes.map(c => [c.x, c.y, c.z]), mirror(shown))) || level === 4);
  }
  void canonical;
});

test('a clockwise quarter turn, seen from above, brings the right side to the front', () => {
  // One tall stack on the right edge, middle row: after the turn the front view shows it in the middle column.
  const h = [[0, 0, 0], [0, 0, 3], [0, 0, 0]];
  const after = turnStack(h, 1);
  assert.equal(after[2][1], 3, 'the stack from the right edge is now on the front row');
  // The old right-side view becomes the new front view.
  assert.equal(grid(viewGrid(after, 'front')), grid(viewGrid(h, 'side')));
});
