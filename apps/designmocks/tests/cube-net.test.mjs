import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adjacentIndices, allViewSignatures, canonicalOrientation, checkAnswer, checkBuild, cubeNets, cubeView, cubesEquivalent, foldNet,
  generateQuestion, hexominoes, identity, oppositeIndex, oppositeView, project, questionKinds, rotations, transformCells, viewSignature,
} from '../src/learn/cube-net.js';

const cross = [{ x: 1, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 0 }, { x: 1, y: -1 }];
const lettered = cells => cells.map((c, i) => ({ ...c, content: { glyph: 'ABCDEF'[i] } }));

test('exactly eleven free hexominoes fold into a cube and the rotation group has 24 elements', () => {
  assert.equal(hexominoes().length, 216);
  assert.equal(cubeNets.length, 11);
  assert.equal(rotations.length, 24);
  assert.deepEqual([...new Set(cubeNets.map(n => n.family))].sort(), ['1-4-1', '2-2-2', '2-3-1', '3-3']);
  assert.equal(cubeNets.filter(n => n.family === '1-4-1').length, 6);
  assert.equal(cubeNets.filter(n => n.family === '2-3-1').length, 3);
  for (const net of cubeNets) for (let t = 0; t < 8; t++) assert.ok(foldNet(transformCells(net.cells, t)).ok, `${net.id} orientation ${t}`);
});

test('the cross net folds with the line rule giving opposite faces', () => {
  const fold = foldNet(cross);
  assert.ok(fold.ok);
  assert.equal(oppositeIndex(fold, 0), 4); // ends of the vertical line of three around the centre
  assert.equal(oppositeIndex(fold, 1), 3); // ends of the horizontal line
  assert.equal(oppositeIndex(fold, 2), 5); // centre and the tail
  assert.deepEqual(adjacentIndices(fold, 2).sort(), [0, 1, 3, 4]);
  for (let i = 0; i < 6; i++) assert.equal(oppositeIndex(fold, oppositeIndex(fold, i)), i);
});

test('shapes with a 2-by-2 block, a row of five or a gap are rejected with a reason', () => {
  assert.equal(foldNet([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 3, y: 0 }]).reason, 'overlap');
  assert.equal(foldNet([0, 1, 2, 3, 4].map(x => ({ x, y: 0 })).concat([{ x: 0, y: 1 }])).reason, 'overlap');
  assert.equal(foldNet([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }]).reason, 'disconnected');
  assert.equal(foldNet(cross.slice(0, 5)).reason, 'count');
  assert.equal(foldNet([...cross.slice(0, 5), cross[0]]).reason, 'duplicate');
});

test('views place three faces, preserve handedness and cover every face across the two corner views', () => {
  const net = { cells: lettered(cross) };
  const fold = foldNet(net.cells);
  const front = cubeView(net, fold, identity), back = cubeView(net, fold, oppositeView);
  const shown = [front, back].flatMap(v => ['top', 'left', 'right'].map(s => v[s].cell)).sort();
  assert.deepEqual(shown, [0, 1, 2, 3, 4, 5]);
  for (const view of [front, back]) for (const slot of ['top', 'left', 'right']) {
    const m = view[slot].m;
    assert.equal(m[0][0] * m[1][1] - m[0][1] * m[1][0], 1, 'folding never mirrors a face');
  }
  assert.equal(allViewSignatures(net, fold).size, 24, 'letters without symmetry give 24 distinct views');
});

test('the cube is drawn as it really folds, not as its mirror image', () => {
  // Paper seen from above: T is the top, E is the square to its right, N the square above it.
  const cells = [{ x: 0, y: 0, content: { glyph: 'T' } }, { x: 1, y: 0, content: { glyph: 'E' } }, { x: 0, y: 1, content: { glyph: 'N' } },
    { x: -1, y: 0, content: { glyph: 'L' } }, { x: 0, y: -1, content: { glyph: 'F' } }, { x: 0, y: -2, content: { glyph: 'B' } }];
  const fold = foldNet(cells);
  assert.ok(fold.ok);
  const view = cubeView({ cells }, fold, identity);
  // A viewer at the north-east corner, looking down, has the east face on the left and the north face on the right.
  assert.deepEqual([view.top.content.glyph, view.left.content.glyph, view.right.content.glyph], ['T', 'E', 'N']);
  const east = project([1, 0, 0]), north = project([0, 1, 0]), up = project([0, 0, 1]);
  assert.ok(east[0] < 0 && east[1] > 0, '+x runs to the lower left');
  assert.ok(north[0] > 0 && north[1] > 0, '+y runs to the lower right');
  assert.ok(up[0] === 0 && up[1] < 0, '+z runs up');
});

test('glyph symmetry collapses orientations that look identical', () => {
  const turned = [[0, -1], [1, 0]], mirrored = [[-1, 0], [0, 1]], upright = [[1, 0], [0, 1]];
  assert.equal(canonicalOrientation(turned, 'dot'), canonicalOrientation(upright, 'dot'));
  assert.equal(canonicalOrientation(mirrored, 'arrow'), canonicalOrientation(upright, 'arrow'));
  assert.notEqual(canonicalOrientation(turned, 'arrow'), canonicalOrientation(upright, 'arrow'));
  assert.notEqual(canonicalOrientation(mirrored, 'corner'), canonicalOrientation(upright, 'corner'));
  const plain = { cells: cross.map(c => ({ ...c, content: { glyph: 'dot' } })) };
  assert.equal(allViewSignatures(plain, foldNet(plain.cells)).size, 1, 'identical symmetric faces look the same from every corner');
});

test('questions are deterministic per seed, have one verifiable answer and impossible distractors', () => {
  for (const kind of questionKinds) {
    for (let seed = 1; seed <= 60; seed++) {
      const a = generateQuestion(kind, seed), b = generateQuestion(kind, seed);
      assert.deepEqual(a, b, `${kind} ${seed} is deterministic`);
      assert.ok(a.prompt && a.explanation, `${kind} ${seed} has prompt and explanation`);
      if (kind === 'build-net') { assert.equal(a.shape.length, 6); assert.equal(a.views.length, 2); continue; }
      assert.equal(a.options.length, kind === 'is-net' ? 2 : 4, `${kind} ${seed} option count`);
      assert.equal(a.options.filter(o => o.id === a.answer).length, 1);
      assert.equal(new Set(a.options.map(o => o.label)).size, a.options.length);
      if (kind === 'which-cube' || kind === 'cannot-cube') {
        const real = allViewSignatures(a.net, foldNet(a.net.cells));
        for (const option of a.options) {
          const possible = real.has(viewSignature(option.view));
          assert.equal(possible, kind === 'which-cube' ? option.id === a.answer : option.id !== a.answer, `${kind} ${seed} ${option.label}`);
          assert.ok(option.reason);
        }
      }
      if (kind === 'which-net') {
        for (const option of a.options) {
          const possible = allViewSignatures(option.net, foldNet(option.net.cells)).has(viewSignature(a.view));
          assert.equal(possible, option.id === a.answer, `which-net ${seed} ${option.label}`);
        }
      }
      if (kind === 'is-net') assert.equal(a.answer, foldNet(a.net.cells).ok ? 'yes' : 'no');
      if (kind === 'opposite') assert.equal(a.answer, 'ABCDEF'[oppositeIndex(foldNet(a.net.cells), a.focus)]);
    }
  }
  const yes = Array.from({ length: 40 }, (_, i) => generateQuestion('is-net', i + 1).answer).filter(v => v === 'yes').length;
  assert.ok(yes >= 10 && yes <= 30, 'is-net questions mix both answers');
});

test('answer checking explains both correct and wrong choices', () => {
  const q = generateQuestion('which-cube', 7);
  assert.match(checkAnswer(q, q.answer).feedback, /^Correct\./);
  const wrong = q.options.find(o => o.id !== q.answer);
  const outcome = checkAnswer(q, wrong.id);
  assert.equal(outcome.correct, false);
  assert.match(outcome.feedback, /^Not quite\./);
  assert.ok(outcome.feedback.includes(wrong.reason));
});

test('build checks accept every rotation of the target, name a wrong pair and detect the mirror image', () => {
  const q = generateQuestion('build-net', 3);
  const targetFold = foldNet(q.target.cells);
  const shapeFold = foldNet(q.shape);
  let solutions = 0;
  for (const rotation of rotations) {
    // Place each target face on the shape cell that lands on the same rotated normal.
    const placements = q.shape.map((_, i) => {
      const normal = shapeFold.frames[i].n;
      const index = q.target.cells.findIndex((_, j) => {
        const n = targetFold.frames[j].n;
        const rotated = [0, 1, 2].map(r => rotation[r][0] * n[0] + rotation[r][1] * n[1] + rotation[r][2] * n[2]);
        return rotated[0] === normal[0] && rotated[1] === normal[1] && rotated[2] === normal[2];
      });
      return q.target.cells[index].content.fill;
    });
    const built = checkBuild(q, placements);
    assert.ok(built.correct, built.feedback);
    solutions++;
    const mirrored = [...placements];
    const a = 0, b = adjacentIndices(shapeFold, 0)[0];
    [mirrored[a], mirrored[b]] = [mirrored[b], mirrored[a]];
    const outcome = checkBuild(q, mirrored);
    assert.equal(outcome.correct, false);
    assert.match(outcome.feedback, /opposite|mirror image/);
  }
  assert.equal(solutions, 24);
  assert.match(checkBuild(q, [null, null, null, null, null, null]).feedback, /Colour every square/);
  assert.match(checkBuild(q, ['c1', 'c1', 'c2', 'c3', 'c4', 'c5']).feedback, /each colour exactly once/);
  const net = { cells: lettered(cross) };
  assert.ok(cubesEquivalent(net, foldNet(net.cells), net, foldNet(net.cells)));
});
