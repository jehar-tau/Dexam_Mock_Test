// Surface answers checked a second way: a flood fill over plain arrays for
// surfaces, maximal straight boundary runs for outline sides, Euler's rule
// for edges and corners, and painted surfaces subtracted from the total for
// painted blocks. The spec's hand-checked cases are pinned too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SURFACE_KINDS, surfacesQuestion, surfaceCount, outlineSides, tunnelCube } from '../src/learn/surfaces.js';

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);

function grid3(cubes) {
  const n = Math.max(...cubes.flat()) + 3, g = Array.from({ length: n }, () => Array.from({ length: n }, () => Array(n).fill(false)));
  for (const [x, y, z] of cubes) g[x + 1][y + 1][z + 1] = true;
  return { g, n };
}
// Count flat patches open to the air, plane by plane, with an array flood fill.
function patches(cubes, keep = () => true) {
  const { g, n } = grid3(cubes);
  let total = 0;
  for (let axis = 0; axis < 3; axis++) for (const sign of [1, -1]) for (let p = 0; p < n; p++) {
    const open = Array.from({ length: n }, () => Array(n).fill(false));
    for (let u = 0; u < n; u++) for (let v = 0; v < n; v++) {
      const c = [0, 0, 0], o = [0, 0, 0], others = [0, 1, 2].filter(i => i !== axis);
      c[axis] = p; c[others[0]] = u; c[others[1]] = v; o[axis] = p + sign; o[others[0]] = u; o[others[1]] = v;
      if (g[c[0]][c[1]][c[2]] && !(o[axis] >= 0 && o[axis] < n && g[o[0]][o[1]][o[2]]) && keep(c.map(x => x - 1), axis, sign)) open[u][v] = true;
    }
    for (let u = 0; u < n; u++) for (let v = 0; v < n; v++) if (open[u][v]) {
      total++;
      const st = [[u, v]]; open[u][v] = false;
      while (st.length) { const [a, b] = st.pop(); for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const A = a + da, B = b + db; if (A >= 0 && B >= 0 && A < n && B < n && open[A][B]) { open[A][B] = false; st.push([A, B]); } } }
    }
  }
  return total;
}
// Sides of a cell outline: unit boundary edges merged into straight runs.
function sidesByRuns(cells) {
  const has = new Set(cells.map(c => c.join(','))), edges = new Set();
  for (const [x, y] of cells) {
    if (!has.has(`${x},${y - 1}`)) edges.add(`h,${x},${y},b`); if (!has.has(`${x},${y + 1}`)) edges.add(`h,${x},${y + 1},t`);
    if (!has.has(`${x - 1},${y}`)) edges.add(`v,${x},${y},l`); if (!has.has(`${x + 1},${y}`)) edges.add(`v,${x + 1},${y},r`);
  }
  let runs = 0;
  for (const e of edges) { const [d, a, b, side] = e.split(','); const prev = d === 'h' ? `h,${a - 1},${b},${side}` : `v,${a},${b - 1},${side}`; if (!edges.has(prev)) runs++; }
  return runs;
}

test('the hand-checked cases from the spec', () => {
  assert.equal(surfaceCount([[0, 0, 0]]), 6);
  assert.equal(surfaceCount([[0, 0, 0], [1, 0, 0], [0, 1, 0]]), 8);
  assert.equal(surfaceCount(tunnelCube(5, [0])), 10);
  assert.equal(surfaceCount(tunnelCube(5, [0, 1, 2])), 30);
  assert.equal(surfaceCount(tunnelCube(3, [], 1, true)), 30);
  assert.equal(outlineSides([[0, 0], [0, 1], [0, 2], [1, 0]]) + 2, 8);
  assert.equal(outlineSides([[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]) + 2, 14);
});

test('every kind builds sound questions', () => {
  for (const [kind, levels] of Object.entries(SURFACE_KINDS)) for (const level of levels) for (const seed of seeds) {
    const q = surfacesQuestion(seed, kind, level);
    if (q.answerMode === 'numeric') { assert.ok(Number.isInteger(q.answer.value)); for (const m of q.mistakes) { assert.notEqual(m.value, q.answer.value); assert.ok(m.reason.length > 10); } }
    else { assert.equal(q.options.length, 4); assert.equal(q.options.filter(o => o.correct).length, 1); assert.equal(new Set(q.options.map(o => o.text)).size, 4); }
    if (level >= 3) { assert.ok(q.hints.length >= 1, kind); assert.ok(q.solution.length >= 3, `${kind} ${seed}`); }
  }
});

const value = q => (q.answerMode === 'numeric' ? q.answer.value : Number(q.options.find(o => o.id === q.answer).text));
test('stacks, notches and tunnels match an independent flood fill', () => {
  for (const [kind, level] of [['polycube-surfaces', 2], ['polycube-surfaces', 3], ['notch-surfaces', 3], ['tunnel-surfaces', 4]]) for (const seed of seeds) {
    const q = surfacesQuestion(seed, kind, level);
    assert.equal(value(q), patches(q.cubes), `${kind} ${seed}`);
  }
});

test('extruded outlines: sides by straight runs, plus two, plus hole walls', () => {
  for (const level of [2, 3]) for (const seed of seeds) {
    const q = surfacesQuestion(seed, 'extrusion-surfaces', level), f = q.figures[0];
    assert.equal(value(q), sidesByRuns([...f.cells, ...f.holes]) + 2 + (f.holes.length ? 4 : 0), `seed ${seed}`);
  }
  for (const seed of seeds) {
    const q = surfacesQuestion(seed, 'extrusion-set', 3), n = Number(q.prompt.match(/more than (\d+)/)[1]);
    assert.equal(q.answer.value, q.figures.filter(f => sidesByRuns(f.cells) + 2 > n).length);
  }
  for (const seed of seeds) {
    const q = surfacesQuestion(seed, 'operation-transfer', 4), [x, y] = q.figures.map(f => sidesByRuns(f.cells));
    const holes = (q.prompt.match(/hole/g) ?? []).length, cornersCut = (q.prompt.match(/corner/g) ?? []).length;
    assert.equal(Number(q.prompt.match(/has (\d+) surfaces/)[1]), x + 2 + 4 * holes + cornersCut);
    assert.equal(q.answer.value, y + 2 + 4 * holes + cornersCut);
  }
});

test('named solids obey Euler and the prism and pyramid rules', () => {
  const sides = { triangular: 3, square: 4, pentagonal: 5, hexagonal: 6, octagonal: 8 };
  for (const seed of seeds) {
    const q = surfacesQuestion(seed, 'edges-corners', 2), [, what, name] = q.prompt.match(/How many (\w+) does an? (.+) have\?/);
    const n = name.startsWith('cub') ? 4 : sides[name.split(' ')[0]], prism = name.includes('prism') || name.startsWith('cub');
    const F = prism ? n + 2 : n + 1, E = prism ? 3 * n : 2 * n, V = prism ? 2 * n : n + 1;
    assert.equal(V - E + F, 2);
    assert.equal(value(q), { faces: F, edges: E, corners: V }[what], q.prompt);
  }
});

test('painted blocks: bare surfaces are all surfaces minus painted ones', () => {
  for (const seed of seeds) {
    const q = surfacesQuestion(seed, 'unpainted-surfaces', 4), box = q.box;
    const onOuter = (c, axis, sign) => (sign > 0 ? c[axis] === box[axis] - 1 : c[axis] === 0);
    const all = q.pieces.reduce((s, p) => s + patches(p), 0), painted = q.pieces.reduce((s, p) => s + patches(p, onOuter), 0);
    assert.equal(q.answer.value, all - painted, `seed ${seed}`);
    assert.equal(q.pieces.flat().length, box[0] * box[1] * box[2]);
    assert.equal(new Set(q.pieces.flat().map(c => c.join())).size, box[0] * box[1] * box[2]);
  }
});
