// Sections checked a second way: the cut face rebuilt face by face from the
// cube's six squares, pieces counted by sampling points, sliced cubes built
// as real polytopes from half-spaces, and the cake numbers from the
// pancake recurrence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_KINDS, sectionsQuestion, polytope, cubePlanes } from '../src/learn/sections.js';

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
const right = q => q.options.find(o => o.id === q.answer);
const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = a => Math.sqrt(dot(a, a));

test('every kind builds sound questions', () => {
  for (const [kind, levels] of Object.entries(SECTION_KINDS)) for (const level of levels) for (const seed of seeds) {
    const q = sectionsQuestion(seed, kind, level);
    if (q.answerMode === 'numeric') { assert.ok(Number.isInteger(q.answer.value)); for (const m of q.mistakes) assert.notEqual(m.value, q.answer.value); }
    else { assert.equal(q.options.length, 4); assert.equal(q.options.filter(o => o.correct).length, 1); assert.equal(new Set(q.options.map(o => o.text)).size, 4, `${kind} ${seed}`); }
    if (level >= 3) { assert.ok(q.hints.length >= 1, kind); assert.ok(q.solution.length >= 3, kind); }
  }
});

// Rebuild the section from the cube's faces: on each face square the plane leaves a segment.
function sectionByFaces(points) {
  const n = cross(sub(points[1], points[0]), sub(points[2], points[0])), d = dot(n, points[0]), segs = [];
  for (let axis = 0; axis < 3; axis++) for (const val of [0, 2]) {
    const corners = [[0, 0], [2, 0], [2, 2], [0, 2]].map(([a, b]) => { const p = [0, 0, 0], o = [0, 1, 2].filter(i => i !== axis); p[axis] = val; p[o[0]] = a; p[o[1]] = b; return p; });
    const hits = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4], fa = dot(n, a) - d, fb = dot(n, b) - d;
      if (Math.abs(fa) < 1e-9) hits.push(a);
      else if (fa * fb < 0) hits.push(a.map((v, k) => v + ((b[k] - v) * fa) / (fa - fb)));
    }
    const uniq = hits.filter((h, i) => hits.findIndex(o => norm(sub(o, h)) < 1e-9) === i);
    if (uniq.length === 2 && !segs.some(([a, b]) => (norm(sub(a, uniq[0])) < 1e-9 && norm(sub(b, uniq[1])) < 1e-9) || (norm(sub(a, uniq[1])) < 1e-9 && norm(sub(b, uniq[0])) < 1e-9))) segs.push(uniq);
  }
  return segs;
}
test('cube sections: sides are the faces crossed, and the shape name holds', () => {
  for (const level of [3, 4]) for (const seed of seeds) {
    const q = sectionsQuestion(seed, 'cube-section', level), segs = sectionByFaces(q.marks), name = right(q).text;
    const sides = segs.length, lens = segs.map(([a, b]) => norm(sub(a, b))), eq = (a, b) => Math.abs(a - b) < 1e-6;
    const want = { 'Equilateral triangle': 3, 'Isosceles triangle': 3, Square: 4, Rectangle: 4, Rhombus: 4, Trapezium: 4, Pentagon: 5, 'Regular hexagon': 6 }[name];
    assert.equal(sides, want, `seed ${seed} level ${level}: ${name}`);
    const dirs = segs.map(([a, b]) => sub(b, a)), par = (i, j) => norm(cross(dirs[i], dirs[j])) < 1e-6;
    if (name === 'Equilateral triangle' || name === 'Regular hexagon' || name === 'Square' || name === 'Rhombus') assert.ok(lens.every(l => eq(l, lens[0])), `${name} sides equal`);
    if (name === 'Isosceles triangle') assert.equal(new Set(lens.map(l => l.toFixed(6))).size, 2);
    if (name === 'Square' || name === 'Rectangle') assert.ok(dirs.some((dv, i) => dirs.some((dw, j) => j !== i && Math.abs(dot(dv, dw)) < 1e-6)));
    if (name === 'Rhombus') assert.ok(!dirs.some((dv, i) => dirs.some((dw, j) => j !== i && Math.abs(dot(dv, dw)) < 1e-6)));
    if (name === 'Trapezium') { const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]].filter(([i, j]) => par(i, j)); assert.equal(pairs.length, 1); }
  }
});

test('pieces: sampling points and grouping them by side of every cut', () => {
  for (const level of [3, 4]) for (const seed of seeds) {
    const q = sectionsQuestion(seed, 'cut-pieces', level);
    if (q.prompt.startsWith('A cube of cheese')) {
      const k = re => Number((q.prompt.match(re) ?? [0, 0])[1]);
      const a = k(/(\d+) cuts? from left/), b = k(/(\d+) cuts? from front/), c = k(/(\d+) cuts? parallel/);
      const groups = new Set();
      for (let x = 0.5; x < 60; x += 1) for (let y = 0.5; y < 60; y += 1) for (let z = 0.5; z < 60; z += 3) groups.add([Math.floor(x / (60 / (a + 1))), Math.floor(y / (60 / (b + 1))), Math.floor(z / (60 / (c + 1)))].join());
      assert.equal(q.answer.value, groups.size, q.prompt);
    } else if (q.prompt.startsWith('A round cake')) {
      const across = Number(q.prompt.match(/with (\d+) level/)[1]), through = Number(q.prompt.match(/and (\d+) upright/)[1]);
      const groups = new Set();
      for (let h = 0.01; h < 1; h += 0.02) for (let t = 0.001; t < 2 * Math.PI; t += 0.01) groups.add(`${Math.floor(h * (across + 1))},${Math.floor(t / (Math.PI / through))}`);
      assert.equal(q.answer.value, groups.size, q.prompt);
    } else {
      const n = Number(q.prompt.match(/cut (\d+) times/)[1]);
      let pieces = 1; for (let k = 0; k < n; k++) pieces += (k * k + k + 2) / 2;
      assert.equal(q.answer.value, pieces);
    }
  }
});

test('sliced cubes: build the real solid and count its faces, edges and corners', () => {
  const CORNERS = [[0, 0, 0], [6, 0, 0], [0, 6, 0], [6, 6, 0], [0, 0, 6], [6, 0, 6], [0, 6, 6], [6, 6, 6]];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (const seed of seeds) {
    const q = sectionsQuestion(seed, 'truncation', 4), planes = cubePlanes();
    // Pick edges that share no corner, then corners away from those edges.
    const usedCorners = new Set(), chosen = [];
    for (const e of EDGES) { if (chosen.length === q.edges) break; if (e.every(c => !usedCorners.has(c))) { chosen.push(e); e.forEach(c => usedCorners.add(c)); } }
    for (const [a, b] of chosen) { const m = CORNERS[a].map((v, i) => (v + CORNERS[b][i]) / 2), n = m.map((v, i) => (CORNERS[a][i] === CORNERS[b][i] ? (v === 6 ? 1 : -1) : 0)); planes.push({ n, d: dot(n, m) - 1 }); }
    const free = CORNERS.map((_, i) => i).filter(i => !usedCorners.has(i)).slice(0, q.corners);
    assert.equal(free.length, q.corners);
    for (const i of free) { const n = CORNERS[i].map(v => (v === 6 ? 1 : -1)); planes.push({ n, d: dot(n, CORNERS[i]) - 1 }); }
    const solid = polytope(planes), ask = q.prompt.match(/How many (\w+) does/)[1];
    assert.equal(q.answer.value, { faces: solid.faces, edges: solid.edges, corners: solid.vertices }[ask], q.prompt);
    assert.equal(solid.vertices - solid.edges + solid.faces, 2);
  }
});

test('spinning shapes: what each kind of edge sweeps', () => {
  for (const level of [2, 3]) for (const seed of seeds) {
    const q = sectionsQuestion(seed, 'revolution', level), shape = q.figures[0].shape, name = right(q).text;
    const onAxis = shape.filter(p => Math.abs(p[0]) < 1e-9).length, curved = shape.length > 6;
    if (name.startsWith('Tube')) assert.equal(onAxis, 0);
    else assert.ok(onAxis >= 2, `${name}: the shape touches the axis`);
    if (name === 'Sphere' || name === 'Hemisphere') assert.ok(curved);
    if (name === 'Cylinder') assert.equal(shape.length, 4);
    if (name === 'Cone') assert.equal(shape.length, 3);
  }
});
