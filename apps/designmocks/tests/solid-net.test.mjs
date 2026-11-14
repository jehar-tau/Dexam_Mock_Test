import assert from 'node:assert/strict';
import test from 'node:test';
import { beltQuestion, canAnimate, foldedPose, joined, describeFace, extrusion, faceCounts, foldsInto, inventoryQuestion, netKey, netOverlaps, netQuestion, polycube, profiles, pyramid, sliced, unfold } from '../src/learn/solid-net.js';
import { marksOnNet, marksOnSolid, patternMatches, patternedCuboidQuestion, ringMarks, samePattern } from '../src/learn/solid-pattern.js';
import { foldNet, hexominoes } from '../src/learn/cube-net.js';
import { seededRandom } from '../src/learn/random.js';

const families = () => [
  ...Object.entries(profiles).map(([name, make]) => [name, extrusion(name === 'box' ? make(2, 3) : make(), 2)]),
  ['pyramid-4', pyramid(4)], ['pyramid-5', pyramid(5)],
  ['three-cubes', polycube([[0, 0, 0], [1, 0, 0], [0, 0, 1]])], ['five-cubes', polycube([[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 1, 0], [1, 0, 1]])],
];

test('solids are closed and have the face counts worked out by hand', () => {
  const count = solid => solid.faces.length;
  assert.equal(count(extrusion(profiles.wedge(), 2)), 5, 'triangular prism');
  assert.equal(count(extrusion(profiles.box(2, 3), 1)), 6);
  assert.equal(count(extrusion(profiles.stairs(), 2)), 10, 'an 8-sided outline gives 8 side faces and 2 ends');
  assert.equal(count(extrusion(profiles.bow(), 1)), 16);
  assert.equal(count(extrusion(profiles.roundEnd(), 2)), 8, 'the rounded end is one curved face');
  assert.equal(count(pyramid(4)), 5);
  // Two cubes in a row with one on top of an end: two L-shaped faces and six rectangles.
  assert.deepEqual(faceCounts(polycube([[0, 0, 0], [1, 0, 0], [0, 0, 1]])), [['1 × 1 square', 4], ['1 × 2 rectangle', 2], ['6-sided face', 2]]);
  assert.equal(count(polycube([[0, 0, 0]])), 6);
  for (const [name, solid] of families()) for (const row of solid.neighbours) for (const link of row) assert.ok(link, `${name}: every edge meets exactly one other face`);
  const round = extrusion(profiles.roundEnd(), 2);
  const curved = round.faces.find(f => f.kind === 'curved');
  assert.ok(Math.abs(curved.shape[1].len - Math.PI) < 0.03, 'a half-round of radius 1 unrolls to about 3.14');
  assert.equal(describeFace(curved), 'the curved strip');
});

test('every unfolding is flat, complete and folds back; many different nets exist for one solid', () => {
  const rng = seededRandom(11);
  for (const [name, solid] of families()) {
    const keys = new Set();
    for (let i = 0; i < 20; i++) {
      const net = unfold(solid, rng);
      assert.ok(net, `${name} unfolds`);
      assert.equal(net.faces.length, solid.faces.length);
      assert.equal(net.folds.length, solid.faces.length - 1, 'a net is a tree of folds');
      assert.equal(netOverlaps(net), false, `${name} lies flat without overlap`);
      assert.deepEqual(foldsInto(net, solid), { ok: true }, `${name} folds back`);
      keys.add(netKey(net));
    }
    assert.ok(keys.size >= 8, `${name} has many nets`);
  }
});

test('the fold test agrees with the cube engine on every six-square shape', () => {
  const cube = polycube([[0, 0, 0]]);
  const square = cube.faces[0].shape;
  let nets = 0;
  for (const cells of hexominoes()) {
    const faces = cells.map((c, id) => { const p = [[c.x, c.y], [c.x + 1, c.y], [c.x + 1, c.y + 1], [c.x, c.y + 1]]; return { id, lines: p.map((q, j) => [q, p[(j + 1) % 4]]), corners: p, outline: p, shape: square }; });
    const folds = [], seen = new Set([0]), queue = [0];
    while (queue.length) {
      const a = queue.shift();
      cells.forEach((c, b) => {
        if (seen.has(b)) return;
        const dx = c.x - cells[a].x, dy = c.y - cells[a].y;
        const edge = dx === 1 && dy === 0 ? 1 : dx === -1 && dy === 0 ? 3 : dy === 1 && dx === 0 ? 2 : dy === -1 && dx === 0 ? 0 : -1;
        if (edge < 0) return;
        seen.add(b); queue.push(b); folds.push({ a, ea: edge, b, eb: (edge + 2) % 4 });
      });
    }
    const expected = foldNet(cells).ok;
    assert.equal(foldsInto({ faces, folds }, cube).ok, expected, JSON.stringify(cells));
    if (expected) nets++;
  }
  // 11 distinct nets appear in 20 fixed orientations among the 216 fixed hexominoes... count them rather than assume.
  assert.equal(nets, hexominoes().filter(cells => foldNet(cells).ok).length);
  assert.ok(nets >= 11);
});

test('a net of a different solid, or with a face in the wrong place, is rejected', () => {
  const rng = seededRandom(5);
  const solid = extrusion(profiles.stairs(), 2), deeper = extrusion(profiles.stairs(), 3);
  assert.equal(foldsInto(unfold(deeper, rng), solid).ok, false, 'a deeper block has a wider belt');
  assert.equal(foldsInto(unfold(extrusion(profiles.tee(), 2), rng), solid).ok, false);
  // All four triangles of a pyramid on one side of the base cannot close.
  const p = pyramid(4), net = unfold(p, rng);
  assert.equal(foldsInto({ faces: net.faces.slice(0, 4), folds: net.folds.slice(0, 3) }, p).reason, 'count');
});

test('net questions have verified options at every level, in all three forms', () => {
  const forms = { can: 0, cannot: 0, multi: 0 };
  for (const level of [2, 3, 4]) for (let seed = 1; seed <= 60; seed++) {
    const q = netQuestion(seed, level);
    assert.deepEqual(q, netQuestion(seed, level), 'deterministic');
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options.map(o => netKey(o.net) + o.reason)).size, 4, 'four different nets');
    const cannot = q.prompt.includes('CANNOT');
    forms[q.answerMode === 'multi' ? 'multi' : cannot ? 'cannot' : 'can']++;
    for (const option of q.options) {
      assert.equal(netOverlaps(option.net), false, `L${level} seed ${seed} ${option.label} lies flat`);
      assert.equal(foldsInto(option.net, q.solid).ok, cannot ? !option.correct : option.correct, `L${level} seed ${seed} ${option.label}`);
      assert.ok(option.reason.length > 20);
    }
    const right = q.options.filter(o => o.correct).map(o => o.id);
    assert.deepEqual(q.answerMode === 'multi' ? q.answer : [q.answer], right);
    assert.ok(right.length === (q.answerMode === 'multi' ? 2 : 1));
    if (level === 4) assert.ok(q.solid.faces.length >= 8, 'exam-hard solids have at least eight faces');
    assert.ok(q.solution.length >= 4 && q.hints.length >= 1);
  }
  assert.equal(forms.cannot === 0 || forms.multi === 0, false, 'all forms occur');
  const big = Array.from({ length: 60 }, (_, i) => netQuestion(i + 1, 4).solid.faces.length);
  assert.ok(Math.max(...big) >= 16 && big.filter(n => n >= 10).length >= 40, 'most exam-hard solids have ten or more faces, some sixteen');
});

test('inventory and belt questions are recomputed from the solid', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const inv = inventoryQuestion(seed);
    assert.equal(inv.answer.value, inv.solid.faces.length);
    assert.ok(inv.mistakes.every(m => m.value !== inv.answer.value));
    const belt = beltQuestion(seed);
    const outline = belt.solid.profile.points;
    const perimeter = outline.reduce((sum, p, i) => sum + Math.hypot(p[0] - outline[(i + 1) % outline.length][0], p[1] - outline[(i + 1) % outline.length][1]), 0);
    assert.ok(Math.abs(belt.answer.value - perimeter) < 1e-6 && Number.isInteger(belt.answer.value));
  }
});

test('two prisms joined along a face unfold, fold back, and keep four end faces', () => {
  for (const [n, m] of [[6, 5], [5, 4], [6, 3], [4, 3]]) {
    const solid = joined(n, m);
    // n + 1 side faces on the first prism (one is split by the join), m - 1 on the second, 4 ends.
    assert.equal(solid.faces.length, n + m + 4, `${n}+${m} face count`);
    assert.equal(solid.faces.filter(face => face.role === 'cap').length, 4);
    for (let seed = 1; seed <= 4; seed++) {
      const net = unfold(solid, seededRandom(seed));
      assert.equal(net.faces.length, solid.faces.length);
      assert.equal(netOverlaps(net), false, `${n}+${m} seed ${seed} lies flat`);
      assert.equal(foldsInto(net, solid).ok, true, `${n}+${m} seed ${seed} folds back`);
    }
  }
  assert.equal(foldsInto(unfold(joined(6, 5), seededRandom(1)), joined(6, 4)).ok, false, 'a different pair of prisms is rejected');
});

test('the folding motion starts flat, ends as the solid, and never stretches a face', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const side = points => points.map((p, i) => Math.hypot(...p.map((v, k) => v - points[(i + 1) % points.length][k])));
  const samples = [extrusion(profiles.stairs(), 2), extrusion(profiles.wedge(), 3), pyramid(5), joined(6, 5), polycube([[0, 0, 0], [1, 0, 0], [0, 0, 1]])];
  assert.equal(canAnimate(extrusion(profiles.roundEnd(), 2)), false, 'curved faces are not hinged');
  for (const solid of samples) {
    assert.equal(canAnimate(solid), true);
    const net = unfold(solid, seededRandom(5));
    const closed = foldedPose(solid, net, 1), flat = foldedPose(solid, net, 0), half = foldedPose(solid, net, 0.5);
    closed.forEach(face => face.points.forEach((p, i) => p.forEach((v, k) => assert.ok(near(v, solid.faces[face.id].draw[0].points[i][k]), 'closed pose is the solid'))));
    // Flat: every face lies in the plane of the root face.
    const root = solid.faces[net.faces[0].id], origin = root.draw[0].points[0];
    flat.forEach(face => face.points.forEach(p => assert.ok(near(p.reduce((sum, v, k) => sum + (v - origin[k]) * root.normal[k], 0), 0), 'flat pose lies in one plane')));
    // Rigid: edge lengths are the same at every stage.
    [flat, half].forEach(pose => pose.forEach((face, f) => side(face.points).forEach((length, i) => assert.ok(near(length, side(closed[f].points)[i]), 'faces keep their size'))));
  }
});

test('edges that continue straight on are described as one edge', () => {
  // The big side of an L-shaped block of three cubes is an L with six edges, not eight unit steps.
  const solid = polycube([[0, 0, 0], [1, 0, 0], [0, 0, 1]]);
  const words = solid.faces.map(describeFace);
  assert.ok(words.every(text => typeof text === 'string' && text.length > 0));
  assert.ok(words.some(text => /6/.test(text) || /six/i.test(text)), 'the L-shaped face is named with six edges');
});

test('a box with corners sliced off has the faces worked out by hand, and its nets sit on a unit grid', () => {
  // One corner off a 2 x 2 x 2 box: three faces lose a corner (five sides each), three stay square, one triangle is added.
  const one = sliced([2, 2, 2], [[1, 1, 1]]);
  assert.equal(one.faces.length, 7);
  assert.deepEqual(faceCounts(one).map(([name, n]) => `${n} ${name}`).sort(), ['1 triangle', '3 2 × 2 square', '3 5-sided face']);
  // Three corners off, none sharing an edge: every face loses one or two corners.
  const three = sliced([2, 2, 2], [[0, 1, 1], [1, 0, 1], [1, 1, 0]]);
  assert.equal(three.faces.length, 9);
  assert.equal(three.faces.filter(face => face.role === 'slice').length, 3);
  three.faces.filter(face => face.role === 'slice').forEach(face => face.shape.forEach(edge => assert.ok(Math.abs(edge.len - Math.SQRT2) < 1e-3, 'slice edges are grid diagonals')));
  for (let seed = 1; seed <= 6; seed++) {
    const net = unfold(three, seededRandom(seed));
    assert.equal(net.grid, true);
    assert.equal(foldsInto(net, three).ok, true);
    assert.equal(netOverlaps(net), false);
    net.faces.filter(face => face.role !== 'slice').forEach(face => face.corners.forEach(p => p.forEach(v => assert.ok(Math.abs(v - Math.round(v)) < 1e-3, 'box faces keep whole-unit corners'))));
    // Triangles are always at the end of a chain.
    net.folds.forEach(fold => assert.notEqual(net.faces[fold.a].role, 'slice'));
  }
  assert.equal(foldsInto(unfold(one, seededRandom(1)), three).ok, false);
});

test('grid-net questions are verified, and stay on the grid in every option', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const q = netQuestion(seed, 4, 'grid-net');
    const cannot = q.prompt.includes('CANNOT');
    assert.equal(q.options.length, 4);
    assert.equal(q.solid.family, 'sliced');
    for (const option of q.options) {
      assert.equal(foldsInto(option.net, q.solid).ok, cannot ? !option.correct : option.correct, `seed ${seed} option ${option.id}`);
      assert.equal(netOverlaps(option.net), false);
      assert.equal(option.net.grid, true);
    }
    assert.ok(q.options.some(o => o.correct) && q.options.some(o => !o.correct));
  }
});

test('stripes round a box: one net carries the pattern, three verified not to', () => {
  // By hand: a stripe round a 3 x 4 x 2 box at x = 1 crosses the four faces that are not the ends in x.
  const box = extrusion(profiles.box(4, 2), 3), ring = ringMarks(box, [{ axis: 0, at: 1 }]);
  assert.equal(ring.size, 4);
  const marks = marksOnSolid(box, ring);
  marks.forEach(m => { assert.ok(Math.abs(m.a[0] - 1) < 1e-6 && Math.abs(m.b[0] - 1) < 1e-6, 'every piece lies in the plane x = 1'); });
  // Total length of the loop is the distance round the box: 2 x (4 + 2).
  assert.ok(Math.abs(marks.reduce((sum, m) => sum + Math.hypot(...m.a.map((v, i) => v - m.b[i])), 0) - 12) < 1e-6);
  // Folding the marked net back gives the same pattern, for any unfolding.
  const solid = { ...box, marks };
  for (let seed = 1; seed <= 5; seed++) {
    const net = unfold(box, seededRandom(seed));
    assert.equal(patternMatches(solid, { ...net, marks: marksOnNet(box, net, ring) }), true);
  }
  // The stripe at the other end is the same box turned round; a stripe round another axis is not.
  assert.equal(samePattern(box, marksOnSolid(box, ringMarks(box, [{ axis: 0, at: 2 }])), marks), true);
  assert.equal(samePattern(box, marksOnSolid(box, ringMarks(box, [{ axis: 1, at: 1 }])), marks), false);

  for (let seed = 1; seed <= 60; seed++) {
    const q = patternedCuboidQuestion(seed);
    assert.equal(q.options.filter(o => o.correct).length, 1);
    assert.equal(q.options.find(o => o.correct).id, q.answer);
    q.options.forEach(o => assert.equal(patternMatches(q.solid, o.net), o.correct, `seed ${seed} option ${o.id}`));
    // All four options are the same net; only the marks differ.
    assert.equal(new Set(q.options.map(o => netKey(o.net))).size, 1);
    assert.deepEqual(patternedCuboidQuestion(seed).answer, q.answer, 'same seed, same question');
  }
});
