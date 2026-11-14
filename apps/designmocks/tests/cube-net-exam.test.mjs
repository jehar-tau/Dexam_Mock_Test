// Cube nets, Exam standard to Mastery. Every answer is recomputed here by a
// second method that does not use view signatures: faces are matched by their
// folded frames (normal plus the symbol's own right and up), allowing for each
// symbol's symmetry, under each of the 24 rotations.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cubeNets, cubesEquivalent, cubeView, edgeNeighbours, foldCells, foldNet, freeShapeKey, generateQuestion, glyphAxes, glyphSymmetry,
  identity, mirrorNet, openBox, openBoxNames, pentominoes, pentominoNames, polyominoes, rotations, slotBases, slotNames, transformCells, unfoldCube,
} from '../src/learn/cube-net.js';
import { generateQuestion as registryQuestion, checkAnswer, markFor } from '../src/learn/questions.js';

const apply = (m, v) => m.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const neg = v => v.map(x => -x);
const contentKey = c => `${c.glyph}/${c.fill ?? ''}`;
// The symbol's axes after applying symmetry g (glyph coordinates), as 3D vectors.
const withSymmetry = ({ r, u }, g) => ({ r: r.map((x, i) => g[0][0] * x + g[1][0] * u[i]), u: r.map((x, i) => g[0][1] * x + g[1][1] * u[i]) });
const axesMatch = (a, b, glyph) => (glyphSymmetry[glyph] ?? [[[1, 0], [0, 1]]]).some(g => { const s = withSymmetry(a, g); return same(s.r, b.r) && same(s.u, b.u); });
function facesOf(net) {
  const fold = foldNet(net.cells);
  return net.cells.map((c, i) => ({ content: c.content, n: fold.frames[i].n, ...glyphAxes(fold.frames[i], c.content.turn) }));
}
// Second method for "same cube": some rotation carries every face of A onto the face of B with the same content, symbol aligned.
function sameCubeByFrames(a, b) {
  const fa = facesOf(a), fb = facesOf(b);
  return rotations.some(q => fa.every(face => {
    const other = fb.find(f => contentKey(f.content) === contentKey(face.content));
    if (!other || !same(apply(q, face.n), other.n)) return false;
    return axesMatch({ r: apply(q, face.r), u: apply(q, face.u) }, other, face.content.glyph);
  }));
}
// Second method for "this picture can be made from this net".
function viewPossible(net, view) {
  const faces = facesOf(net);
  return rotations.some(q => slotNames.every(slot => {
    const shown = view[slot], basis = slotBases[slot];
    const face = faces.find(f => contentKey(f.content) === contentKey(shown.content));
    if (!face || !same(apply(q, face.n), basis.normal)) return false;
    const world = { r: basis.e1.map((x, i) => shown.m[0][0] * x + shown.m[1][0] * basis.e2[i]), u: basis.e1.map((x, i) => shown.m[0][1] * x + shown.m[1][1] * basis.e2[i]) };
    return axesMatch({ r: apply(q, face.r), u: apply(q, face.u) }, world, face.content.glyph);
  }));
}
const symbols = ['F', 'G', 'J', 'L', 'P', 'R'].map((glyph, i) => ({ glyph, fill: `c${i + 1}` }));
const cross = [{ x: 1, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 0 }, { x: 1, y: -1 }];
const exam = [['which-cube', 3], ['cannot-cube', 3], ['which-net', 3], ['which-net', 4], ['net-from-views', 3], ['net-from-views', 4], ['open-box', 3], ['same-cube', 4], ['path-cube', 4]];

test('the second method agrees with the engine on the hand-checked basics', () => {
  const net = { cells: cross.map((c, i) => ({ ...c, content: symbols[i] })) };
  assert.ok(sameCubeByFrames(net, net));
  assert.ok(viewPossible(net, cubeView(net, foldNet(net.cells), identity)));
  const turned = { cells: net.cells.map((c, i) => (i === 2 ? { ...c, content: { ...c.content, turn: 1 } } : c)) };
  assert.equal(sameCubeByFrames(net, turned), false, 'a quarter turn of one symbol makes a different cube');
  assert.equal(cubesEquivalent(net, foldNet(net.cells), turned, foldNet(turned.cells)), false);
});

test('a turned symbol: the face across its top edge moves round by one edge per quarter turn', () => {
  // Cross net, centre square 2. On paper its neighbours are 0 above, 3 right, 4 below, 1 left.
  const cells = cross.map((c, i) => ({ ...c, content: { glyph: 'ABCDEF'[i] } }));
  const fold = foldNet(cells);
  assert.deepEqual(edgeNeighbours({ cells }, fold, 2), { top: 0, right: 3, bottom: 4, left: 1 });
  cells[2].content = { glyph: 'C', turn: 1 }; // a quarter turn anticlockwise: the symbol's top now faces the left square
  assert.deepEqual(edgeNeighbours({ cells }, fold, 2), { top: 1, right: 0, bottom: 3, left: 4 });
});

test('unfoldCube lays a cube out on all eleven shapes in all eight orientations; the mirror is a different cube', () => {
  const net = { cells: cross.map((c, i) => ({ ...c, content: symbols[i] })) };
  const fold = foldNet(net.cells);
  for (const shape of cubeNets) for (let t = 0; t < 8; t++) for (const rotation of [identity, rotations[5], rotations[17]]) {
    const laid = unfoldCube(net, fold, transformCells(shape.cells, t), rotation);
    assert.ok(cubesEquivalent(net, fold, laid, foldNet(laid.cells)), `${shape.id} orientation ${t}`);
    assert.ok(sameCubeByFrames(net, laid));
  }
  const mirror = mirrorNet(net);
  assert.equal(sameCubeByFrames(net, mirror), false);
  assert.equal(cubesEquivalent(net, fold, mirror, foldNet(mirror.cells)), false);
  const dots = { cells: cross.map(c => ({ ...c, content: { glyph: 'dot' } })) };
  assert.ok(cubesEquivalent(dots, foldNet(dots.cells), mirrorNet(dots), foldNet(mirrorNet(dots).cells)), 'with six dots the mirror looks the same');
});

test('exactly eight of the twelve five-square shapes fold into an open box: F, L, N, T, W, X, Y and Z', () => {
  const free = polyominoes(5);
  assert.equal(free.length, 12);
  assert.deepEqual(new Set(free.map(freeShapeKey)), new Set(pentominoNames.map(n => freeShapeKey(pentominoes[n]))), 'the named shapes are the twelve free pentominoes');
  assert.deepEqual([...openBoxNames], ['F', 'L', 'N', 'T', 'W', 'X', 'Y', 'Z']);
  for (const n of ['I', 'P', 'U', 'V']) assert.equal(foldCells(pentominoes[n]).reason, 'overlap', n);
  // The X shape: the centre square is the base whatever square the fold starts from.
  for (let root = 0; root < 5; root++) {
    const fold = foldCells(pentominoes.X, root);
    const box = openBox(pentominoes.X);
    assert.equal(box.base, 2);
    const missing = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].find(n => !fold.frames.some(f => same(f.n, n)));
    assert.ok(same(fold.frames[2].n, neg(missing)), `root ${root}`);
  }
});

// The base by a root-independent rule: once folded it touches all four other squares.
function touchesAll(cells, i) {
  for (let root = 0; root < cells.length; root++) {
    const fold = foldCells(cells, root);
    const touching = fold.frames.filter((f, j) => j !== i && f.n.reduce((s, x, k) => s + x * fold.frames[i].n[k], 0) === 0).length;
    if (touching !== 4) return false;
  }
  return true;
}

test('every exam kind: deterministic, four labelled options, answer verified by the second method, wrong options verified wrong', () => {
  for (const [kind, level] of exam) {
    const positions = new Set(), counts = new Set(), variants = new Set();
    for (let seed = 1; seed <= 60; seed++) {
      const where = `${kind} L${level} seed ${seed}`;
      const q = generateQuestion(kind, seed, level);
      assert.deepEqual(generateQuestion(kind, seed, level), q, `${where} deterministic`);
      assert.equal(q.options.length, 4, `${where} option count`);
      assert.deepEqual(q.options.map(o => o.id), ['A', 'B', 'C', 'D']);
      assert.ok(q.options.every(o => o.reason && o.reason.length > 20), `${where} reasons`);
      assert.ok(q.hints.length >= 1 && q.solution.length >= 3, `${where} hints and solution`);
      const right = q.options.filter(o => (Array.isArray(q.answer) ? q.answer.includes(o.id) : o.id === q.answer));
      if (kind === 'same-cube') {
        assert.ok(right.length >= 1 && right.length <= 3, where);
        counts.add(right.length);
        for (const o of q.options) {
          assert.equal(sameCubeByFrames(o.net, q.net), q.answer.includes(o.id), `${where} option ${o.id}`);
          assert.notEqual(freeShapeKey(o.net.cells), undefined);
        }
      } else assert.equal(right.length, 1, where);
      positions.add(Array.isArray(q.answer) ? q.answer.join('') : q.answer);
      if (kind === 'which-cube' || kind === 'path-cube') for (const o of q.options) assert.equal(viewPossible(q.net, o.view), o.id === q.answer, `${where} option ${o.id}`);
      if (kind === 'cannot-cube') for (const o of q.options) assert.equal(viewPossible(q.net, o.view), o.id !== q.answer, `${where} option ${o.id}`);
      if (kind === 'which-net') {
        for (const o of q.options) assert.equal(viewPossible(o.net, q.view), o.id === q.answer, `${where} option ${o.id}`);
        assert.equal(new Set(q.options.map(o => freeShapeKey(o.net.cells))).size >= 3, true, `${where} options use different net shapes`);
      }
      if (kind === 'net-from-views') {
        assert.equal(q.views.length, level === 3 ? 2 : 3);
        const seen = new Set(q.views.flatMap(v => slotNames.map(s => contentKey(v[s].content))));
        assert.equal(seen.size, level === 3 ? 6 : 5, `${where} faces shown`);
        if (level === 4) assert.ok(!seen.has('blank/'), `${where} the blank face is never shown`);
        for (const o of q.options) {
          assert.equal(q.views.every(v => viewPossible(o.net, v)), o.id === q.answer, `${where} option ${o.id}`);
          assert.equal(sameCubeByFrames(o.net, q.options.find(x => x.id === q.answer).net), o.id === q.answer, `${where} option ${o.id} same cube`);
        }
      }
      if (kind === 'open-box') {
        variants.add(q.variant);
        if (q.variant === 'which' || q.variant === 'which-not') {
          for (const o of q.options) {
            const folds = openBoxNames.some(n => freeShapeKey(pentominoes[n]) === freeShapeKey(o.net.cells));
            assert.equal(folds, (o.id === q.answer) === (q.variant === 'which'), `${where} option ${o.id}`);
          }
        } else {
          const cells = q.net.cells;
          const index = letter => 'ABCDE'.indexOf(letter);
          const target = index(q.options.find(o => o.id === q.answer).text);
          if (q.variant === 'base') {
            for (const o of q.options) assert.equal(touchesAll(cells, index(o.text)), o.id === q.answer, `${where} option ${o.id}`);
          } else {
            const fold = foldCells(cells);
            for (const o of q.options) {
              const i = index(o.text);
              assert.equal(same(fold.frames[i].n, neg(fold.frames[q.focus].n)), i === target, `${where} option ${o.id}`);
            }
          }
        }
      }
      if (kind === 'path-cube') {
        // The path on the net is continuous: piece ends meet in pairs across shared edges, and no end touches another path face otherwise.
        const fold = foldNet(q.net.cells);
        const ends = q.net.cells.flatMap((c, i) => {
          if (!['line', 'bend'].includes(c.content.glyph)) return [];
          const { r, u } = glyphAxes(fold.frames[i], c.content.turn);
          return (c.content.glyph === 'line' ? [neg(u), u] : [neg(u), r]).map(d => ({ face: i, d }));
        });
        const pieces = new Set(ends.map(e => e.face)).size;
        const joins = ends.filter(e => ends.some(o => o.face !== e.face && same(fold.frames[o.face].n, e.d) && same(o.d, fold.frames[e.face].n))).length;
        assert.equal(joins, 2 * (pieces - 1), `${where} path joins up`);
        assert.ok(pieces >= 3 && pieces <= 4, `${where} path length`);
      }
    }
    if (kind !== 'same-cube') assert.ok(positions.size >= 4, `${kind} L${level}: the correct option moves round`);
    else assert.ok(counts.size === 3 && positions.size >= 6, 'same-cube: one, two or three right, in varying places');
    if (kind === 'open-box') assert.deepEqual([...variants].sort(), ['base', 'opposite', 'which', 'which-not']);
  }
});

test('upper-level symbols are never shown mirrored, so no option can be thrown out at a glance', () => {
  for (const kind of ['which-cube', 'cannot-cube', 'path-cube']) for (let seed = 1; seed <= 60; seed++) {
    const q = generateQuestion(kind, seed, kind === 'path-cube' ? 4 : 3);
    for (const o of q.options) for (const slot of slotNames) {
      const { m, content } = o.view[slot];
      // A one-handed symbol drawn with a negative determinant would be a mirrored letter: easy to throw out.
      if ((glyphSymmetry[content.glyph] ?? []).length === 1) assert.equal(m[0][0] * m[1][1] - m[0][1] * m[1][0], 1, `${kind} ${seed} ${o.id} ${slot}`);
    }
  }
});

test('the registry serves the new kinds with figures, and select-all marking works on same-cube', () => {
  const views = registryQuestion('net-from-views', 4, 4);
  assert.equal(views.figures.filter(f => f.type === 'cube').length, 3);
  assert.ok(views.options.every(o => o.figure.type === 'net'));
  const box = registryQuestion('open-box', 7, 3);
  assert.equal(box.figures[0].type, 'net');
  assert.ok(box.options.every(o => o.text));
  const multi = registryQuestion('same-cube', 1, 4);
  assert.equal(multi.answerMode, 'multi');
  assert.ok(checkAnswer(multi, multi.answer).correct);
  assert.equal(markFor(multi, multi.answer, 'uceed'), 4);
  const wrong = multi.options.find(o => !multi.answer.includes(o.id)).id;
  assert.equal(markFor(multi, [wrong], 'uceed'), -1);
  assert.throws(() => registryQuestion('same-cube', 1, 3), /does not support level 3/);
  assert.equal(registryQuestion('which-cube', 41, 2).options[0].id.length > 1, true, 'level 2 questions are unchanged');
});
