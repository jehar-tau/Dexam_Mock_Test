import assert from 'node:assert/strict';
import test from 'node:test';
import { canFold, fold, foldCountQuestion, freshSheet, punch, punchable, unfoldQuestion, GRID } from '../src/learn/paper-fold.js';
import { applyTransform, imageQuestion, isAsymmetric, randomPattern } from '../src/learn/mirror.js';
import { boxGap, countQuestion, cubeList, cubes, exposure, faceNeighbours, faceVisible, hiddenCount, minMaxFromViews, occupancy, paintedCounts, stackReadable, total, viewsOf } from '../src/learn/cube-count.js';
import { colourQuestion, complement, hexToHsl, mixOf, swatch, wheel } from '../src/learn/colour.js';
import { seededRandom } from '../src/learn/random.js';

const holeKey = holes => holes.map(h => `${h.x},${h.y}`).sort().join('|');

test('folding doubles layers and punching mirrors holes across every fold line', () => {
  let sheet = freshSheet();
  assert.equal(sheet.layers.length, 1);
  sheet = fold(sheet, 'left');
  assert.deepEqual([sheet.w, sheet.h, sheet.layers.length], [3, 6, 2]);
  assert.deepEqual(punch(sheet, [{ x: 0.5, y: 0.5 }]), [{ x: 0, y: 0 }, { x: 5, y: 0 }]);
  sheet = fold(sheet, 'up');
  assert.deepEqual([sheet.w, sheet.h, sheet.layers.length], [3, 3, 4]);
  assert.equal(holeKey(punch(sheet, [{ x: 1.5, y: 0.5 }])), holeKey([{ x: 1, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 5 }, { x: 4, y: 5 }]));
  assert.equal(canFold(sheet, 'diagonal'), true);
  const triangle = fold(sheet, 'diagonal');
  assert.equal(triangle.layers.length, 8);
  assert.equal(canFold(triangle, 'left'), false);
  assert.throws(() => fold(triangle, 'up'), /Cannot fold/);
  assert.ok(punchable(triangle).every(p => p.y >= p.x), 'only the kept triangle can be punched');
  assert.equal(punch(triangle, [{ x: 0.5, y: 2.5 }]).length, 8);
  assert.throws(() => fold(fold(fold(freshSheet(), 'left'), 'left'), 'left'), /Cannot fold/, 'a one-column strip cannot fold left again');
});

test('unfold questions have four distinct patterns and one that matches the real punch', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const q = unfoldQuestion(seed);
    let sheet = freshSheet();
    for (const kind of q.folds) sheet = fold(sheet, kind);
    const real = holeKey(punch(sheet, q.punched.cells));
    assert.equal(q.options.length, 4, `seed ${seed}`);
    assert.equal(new Set(q.options.map(o => holeKey(o.holes))).size, 4, `seed ${seed} distinct`);
    for (const option of q.options) assert.equal(holeKey(option.holes) === real, option.id === q.answer, `seed ${seed} ${option.label}`);
    assert.ok(q.options.every(o => o.holes.every(h => h.x >= 0 && h.x < GRID && h.y >= 0 && h.y < GRID)));
    const count = foldCountQuestion(seed);
    assert.equal(Number(count.answer), 2 ** count.folds.length);
  }
});

test('mirror patterns are asymmetric and the six transforms differ', () => {
  const rng = seededRandom(5);
  for (let i = 0; i < 20; i++) {
    const cells = randomPattern(rng);
    assert.ok(isAsymmetric(cells));
    assert.equal(applyTransform(applyTransform(cells, 'mirror'), 'mirror').sort().join(), [...cells].sort().join());
  }
  for (let seed = 1; seed <= 40; seed++) for (const kind of ['mirror-image', 'water-image']) {
    const q = imageQuestion(seed, kind);
    assert.equal(q.options.length, 4);
    assert.equal(q.answer, kind === 'mirror-image' ? 'mirror' : 'water');
    assert.equal(new Set(q.options.map(o => o.transform)).size, 4);
  }
});

test('cube stacks count totals, hidden cubes and box gaps', () => {
  const heights = [[3, 3, 2], [3, 3, 2], [2, 2, 1]];
  assert.equal(total(heights), 21);
  assert.equal(cubes(heights).length, 21);
  // Columns (0,0), (0,1), (1,0) and (1,1) each hide their two lower cubes: the cube above and both front neighbours reach over them.
  assert.equal(hiddenCount(heights), 8);
  assert.equal(hiddenCount([[3, 0, 0], [0, 0, 0], [0, 0, 0]]), 0, 'a lone tall column hides nothing');
  assert.equal(hiddenCount([[3, 1, 0], [1, 0, 0], [0, 0, 0]]), 1, 'two low neighbours hide the bottom cube only');
  assert.equal(hiddenCount([[1, 1], [1, 1]]), 0);
  assert.equal(boxGap(heights), 27 - 21);
  for (let seed = 1; seed <= 40; seed++) for (const kind of ['count-cubes', 'count-hidden', 'count-box']) {
    const q = countQuestion(seed, kind);
    assert.equal(q.options.length, 4, `${kind} ${seed}`);
    assert.equal(new Set(q.options.map(o => o.id)).size, 4);
    const expected = kind === 'count-cubes' ? total(q.heights) : kind === 'count-hidden' ? hiddenCount(q.heights) : boxGap(q.heights);
    assert.equal(q.answer, String(expected));
  }
});

test('the colour wheel pairs complements, names mixes and renders swatches', () => {
  assert.equal(wheel.length, 12);
  assert.equal(complement('red').id, 'green');
  assert.equal(complement('yellow').id, 'violet');
  assert.equal(complement('blue-green').id, 'red-orange');
  assert.equal(mixOf('blue', 'yellow'), 'green');
  assert.equal(mixOf('yellow', 'red'), 'orange');
  assert.equal(mixOf('green', 'red'), null);
  const red = hexToHsl('#d7263d');
  assert.ok(red.h < 10 || red.h > 350);
  assert.match(swatch('blue', { value: 0.7 }), /^hsl\(\d+ \d+% 70%\)$/);
  for (let seed = 1; seed <= 40; seed++) for (const kind of ['complement', 'mix', 'warm-cool', 'value']) {
    const q = colourQuestion(seed, kind);
    assert.equal(q.options.length, 4, `${kind} ${seed}`);
    assert.equal(q.options.filter(o => o.correct).length, 1);
    assert.equal(q.options.find(o => o.correct).id, q.answer);
    if (kind === 'value') {
      const levels = q.options.map(o => o.level);
      const expected = q.prompt.includes('lightest') ? Math.max(...levels) : Math.min(...levels);
      assert.equal(q.options.find(o => o.correct).level, expected);
    }
  }
});

test('views give the fewest and most cubes, checked against exhaustive search', () => {
  const sample = viewsOf([[2, 1, 0], [1, 3, 1], [0, 1, 2]]);
  assert.deepEqual([sample.front, sample.side, sample.top.flat().filter(Boolean).length], [[2, 3, 2], [2, 3, 2], 7]);
  const { min, max } = minMaxFromViews(sample.top, sample.front, sample.side);
  assert.deepEqual([min, max], [11, 15]);
  const tilted = viewsOf([[3, 0], [1, 2]]);
  assert.deepEqual([tilted.front, tilted.side], [[3, 2], [3, 2]]);
  const rng = seededRandom(9);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (let round = 0; round < 25; round++) {
    const heights = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Math.floor(rng() * 4)));
    const views = viewsOf(heights);
    let least = Infinity, most = -1;
    for (let code = 0; code < 4 ** 9; code++) {
      const candidate = Array.from({ length: 3 }, (_, x) => Array.from({ length: 3 }, (_, y) => Math.floor(code / 4 ** (x * 3 + y)) % 4));
      if (!same(viewsOf(candidate), views)) continue;
      const n = total(candidate);
      least = Math.min(least, n); most = Math.max(most, n);
    }
    const formula = minMaxFromViews(views.top, views.front, views.side);
    assert.deepEqual([formula.min, formula.max], [least, most], JSON.stringify(heights));
  }
});

test('paint, contact and visibility measures match hand-worked cases', () => {
  assert.deepEqual(paintedCounts(3, 3, 3), { 0: 1, 1: 6, 2: 12, 3: 8 });
  assert.deepEqual(paintedCounts(4, 3, 2), { 0: 0, 1: 4, 2: 12, 3: 8 });
  assert.deepEqual(paintedCounts(5, 5, 5), { 0: 27, 1: 54, 2: 36, 3: 8 });
  assert.deepEqual(exposure([{ x: 0, y: 0, z: 0 }], { floorPainted: false }), [5]);
  assert.deepEqual(exposure([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }], { floorPainted: true }), [5, 5]);
  const list = cubeList([[2, 1], [1, 0]]), has = occupancy(list);
  assert.equal(faceNeighbours(has, { x: 0, y: 0, z: 0 }), 3);
  assert.equal(faceNeighbours(has, { x: 0, y: 0, z: 1 }), 1);
  // A one-cube column directly behind a three-cube column, on the line of sight, cannot be seen.
  assert.equal(stackReadable([[1, 0], [0, 3]]), false);
  assert.equal(stackReadable([[3, 2], [2, 1]]), true);
  assert.equal(faceVisible(occupancy(cubeList([[1, 0], [0, 3]])), 0, 0, 0, 'top'), false);
  assert.equal(faceVisible(occupancy(cubeList([[1, 0], [0, 1]])), 0, 0, 0, 'top'), true);
});

test('exam-level counting questions are numerical and their answers are recomputed independently', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const cubesQ = countQuestion(seed, 'count-cubes', 3);
    assert.equal(cubesQ.answer.value, total(cubesQ.heights));
    assert.ok(cubesQ.heights.length === 4 && stackReadable(cubesQ.heights) && cubesQ.answer.value >= 14);
    const hiddenQ = countQuestion(seed, 'count-hidden', 3);
    assert.equal(hiddenQ.answer.value, hiddenCount(hiddenQ.heights));
    const paintQ = countQuestion(seed, 'painted-count', 3);
    assert.equal(paintQ.answer.value, paintedCounts(...paintQ.block)[paintQ.faces]);
    const touchQ = countQuestion(seed, 'touch-count', 3);
    assert.equal(touchQ.answer.value, faceNeighbours(occupancy(cubeList(touchQ.heights)), touchQ.marked));
    assert.ok(touchQ.marked.z < touchQ.heights[touchQ.marked.x][touchQ.marked.y], 'the marked cube exists');
    for (const kind of ['views-max', 'views-min']) {
      const q = countQuestion(seed, kind, 4);
      const range = minMaxFromViews(q.views.top, q.views.front, q.views.side);
      assert.equal(q.answer.value, kind === 'views-max' ? range.max : range.min);
      assert.ok(range.max - range.min >= 2);
    }
    const stackQ = countQuestion(seed, 'painted-stack', 4);
    const cubesIn = cubeList(stackQ.heights);
    const painted = exposure(cubesIn, { floorPainted: stackQ.floorPainted }).reduce((a, b) => a + b, 0);
    assert.equal(stackQ.answer.value, 6 * cubesIn.length - painted);
    const goneQ = countQuestion(seed, 'removed-visible', 4);
    assert.equal(goneQ.answer.value, goneQ.remaining.length);
    assert.equal(goneQ.remaining.length + goneQ.removed.length, 27);
    for (const q of [cubesQ, hiddenQ, paintQ, touchQ, stackQ, goneQ]) {
      assert.equal(q.answerMode, 'numeric');
      assert.ok(q.solution.length >= 3 && q.hints.length >= 1);
      assert.ok(q.mistakes.every(m => m.value !== q.answer.value));
    }
  }
});
