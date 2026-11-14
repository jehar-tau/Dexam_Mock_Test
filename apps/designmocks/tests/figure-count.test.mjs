import assert from 'node:assert/strict';
import test from 'node:test';
import { bySize, countByLines, countOf, fan, fullSides, grid, gridWithDiagonals, mergeCollinear, panels, polygon, reflect, rhombus, shapesOf, shear, squareFrom, squareStar, triangleGrid } from '../src/learn/figure-count.js';
import { atoms, counterPresets, figureQuestion } from '../src/learn/figure-questions.js';
import { seededRandom } from '../src/learn/random.js';

const SHAPES = ['triangle', 'right-triangle', 'square', 'rectangle', 'parallelogram'];
const agree = (segments, shape, label) => { const a = countOf(segments, shape), b = countByLines(segments, shape); assert.equal(a, b, `${label}: ${shape} by points ${a}, by lines ${b}`); return a; };

test('hand-checked counts', () => {
  assert.equal(agree(squareStar(1), 'triangle', 'square with diagonals'), 8);
  assert.equal(agree(squareStar(2), 'triangle', 'diagonals and midlines'), 16);
  assert.equal(agree(fan(2), 'triangle', 'fan 2'), 6);
  assert.equal(agree(fan(3), 'triangle', 'fan 3'), 10);
  assert.equal(agree(grid(2, 2), 'rectangle', 'grid'), 9);
  assert.equal(agree(grid(2, 2), 'square', 'grid'), 5);
  assert.equal(agree(grid(3, 3), 'rectangle', 'grid'), 36);
  assert.equal(agree(grid(3, 3), 'square', 'grid'), 14);
  assert.equal(agree(grid(4, 3), 'rectangle', 'grid'), 60);
  assert.equal(agree(triangleGrid(2), 'triangle', 'rows'), 5);
  assert.equal(agree(triangleGrid(3), 'triangle', 'rows'), 13);
  // A five-pointed star alone: five points and five larger triangles. Inside a pentagon: the well-known 35.
  assert.equal(agree(polygon(5, { edges: false, steps: [2] }), 'triangle', 'pentagram'), 10);
  assert.equal(agree(polygon(5, { steps: [2] }), 'triangle', 'pentagon with star'), 35);
  // A rhombus with both diagonals is a square with diagonals, stretched.
  assert.equal(agree(rhombus([]), 'triangle', 'rhombus'), 8);
  // Every triangle in a square with diagonals is right-angled; none in an equilateral grid is.
  assert.equal(agree(squareStar(1), 'right-triangle', 'square'), 8);
  assert.equal(agree(triangleGrid(3), 'right-triangle', 'rows'), 0);
});

test('formulas: grids, fans, rows of triangles', () => {
  const pairs = n => (n * (n + 1)) / 2;
  for (let m = 1; m <= 5; m++) for (let n = 1; n <= 4; n++) {
    assert.equal(agree(grid(m, n), 'rectangle', `grid ${m}×${n}`), pairs(m) * pairs(n));
    let squares = 0; for (let k = 1; k <= Math.min(m, n); k++) squares += (m - k + 1) * (n - k + 1);
    assert.equal(agree(grid(m, n), 'square', `grid ${m}×${n}`), squares);
    assert.equal(agree(shear(grid(m, n), 0.5), 'parallelogram', 'sheared grid'), pairs(m) * pairs(n));
    assert.equal(countOf(shear(grid(m, n), 0.5), 'rectangle'), 0, 'a sheared grid has no rectangles');
  }
  for (let k = 0; k <= 5; k++) for (let b = 0; b <= 3; b++) assert.equal(agree(fan(k, b), 'triangle', `fan ${k} ${b}`), (b + 1) * pairs(k + 1));
  // Triangles in an equilateral triangle of n rows: floor(n(n+2)(2n+1)/8).
  for (let n = 1; n <= 6; n++) assert.equal(agree(triangleGrid(n), 'triangle', `rows ${n}`), Math.floor((n * (n + 2) * (2 * n + 1)) / 8));
});

test('the two counters agree on every family, and turning or flipping changes nothing', () => {
  const figures = [squareStar(3), squareFrom(['diamond', 'inner', 'upright', 'level']), squareFrom(['falling', 'rising', 'upright', 'level', 'inner']), rhombus(['left']), rhombus(['left', 'right']), rhombus(['left', 'top']),
    polygon(6, { steps: [2] }), polygon(6, { steps: [3] }), polygon(6, { steps: [2, 3] }), polygon(5, { steps: [2], spokes: true }), polygon(7, { steps: [2] }), polygon(8, { steps: [3] }),
    gridWithDiagonals(3, 2, [[0, 0, 'both'], [1, 0, 'down'], [2, 1, 'up'], [1, 1, 'both']]), fan(4, 2)];
  for (let seed = 1; seed <= 12; seed++) { figures.push(panels(seededRandom(seed), 5, 4, 7)); figures.push(shear(panels(seededRandom(seed + 50), 4, 3, 5), 0.6)); }
  figures.forEach((segments, i) => SHAPES.forEach(shape => {
    const n = agree(segments, shape, `figure ${i}`);
    assert.equal(countOf(segments.map(s => s.map(([x, y]) => [y, -x])), shape), n, 'a quarter turn keeps the count');
    assert.equal(countOf(reflect(segments, 'x', 0), shape), n, 'a mirror image keeps the count');
    assert.equal(countOf([...segments].reverse().map(([p, q]) => [q, p]), shape), n, 'the order the lines are drawn in does not matter');
  }));
  // Squares are rectangles, rectangles are parallelograms, right triangles are triangles.
  for (const segments of figures) {
    assert.ok(countOf(segments, 'square') <= countOf(segments, 'rectangle') && countOf(segments, 'rectangle') <= countOf(segments, 'parallelogram'));
    assert.ok(countOf(segments, 'right-triangle') <= countOf(segments, 'triangle'));
  }
});

test('a line drawn in pieces is one line, and sizes add up', () => {
  const whole = [[[0, 0], [4, 0]], [[4, 0], [4, 4]], [[4, 4], [0, 4]], [[0, 4], [0, 0]], [[0, 0], [4, 4]]];
  const pieces = [[[0, 0], [1, 0]], [[1, 0], [4, 0]], [[4, 0], [4, 4]], [[4, 4], [0, 4]], [[0, 4], [0, 2]], [[0, 3], [0, 0]], [[0, 0], [2, 2]], [[2, 2], [4, 4]]];
  assert.equal(mergeCollinear(pieces).length, 5);
  assert.equal(countOf(pieces, 'triangle'), countOf(whole, 'triangle'));
  assert.equal(countOf(whole, 'triangle'), 2);
  // A gap breaks a side: two collinear pieces that do not touch are two lines.
  assert.equal(countOf([[[0, 0], [1.5, 0]], [[2.5, 0], [4, 0]], [[4, 0], [4, 4]], [[4, 4], [0, 4]], [[0, 4], [0, 0]]], 'rectangle'), 0);
  const groups = bySize(shapesOf(grid(3, 3), 'square'));
  assert.deepEqual(groups.map(g => g.count), [9, 4, 1]);
  assert.deepEqual(groups.map(g => g.times), [1, 4, 9]);
  assert.equal(atoms(grid(2, 2)).length, 12, 'a 2 × 2 grid is drawn with twelve unit pieces');
  assert.deepEqual(fullSides(grid(2, 3)).map(s => s.name), ['right', 'bottom', 'left']);
});

test('every generated question is recounted by the second counter', () => {
  const cases = [['count-squares', 1], ['count-squares', 3], ['count-rectangles', 2], ['count-rectangles', 3], ['count-rectangles', 4], ['count-triangles', 2], ['count-triangles', 3], ['count-triangles', 4]];
  for (const [kind, level] of cases) for (let seed = 1; seed <= 60; seed++) {
    const q = figureQuestion(seed, kind, level), truth = countByLines(q.segments, q.shape);
    const given = q.answerMode === 'single' ? q.options.find(o => o.id === q.answer).value : q.answer.value;
    assert.equal(given, truth, `${kind} L${level} seed ${seed}`);
    if (q.answerMode === 'single') { assert.equal(new Set(q.options.map(o => o.value)).size, 4); assert.ok(q.options.every(o => o.value > 0)); }
    else assert.ok(q.mistakes.every(m => m.value !== truth));
    // The solution's tally adds up to the answer.
    assert.equal(bySize(shapesOf(q.segments, q.shape)).reduce((sum, g) => sum + g.count, 0), truth);
    assert.ok(q.solution[q.solution.length - 1].text.endsWith(`= ${truth}.`));
  }
  for (let seed = 1; seed <= 60; seed++) {
    for (const level of [3, 4]) {
      const q = figureQuestion(seed, 'count-missing', level), left = countByLines(q.segments, q.shape);
      const whole = countByLines([...q.segments, ...q.figures[0].ghost], q.shape);
      assert.equal(whole, q.full, `missing L${level} seed ${seed}: putting the lines back gives the full figure`);
      assert.equal(q.answer.value, q.prompt.includes('were lost') ? whole - left : left);
      assert.equal(q.figures[0].ghost.length, level === 4 ? 2 : 1);
      assert.ok(whole > left);
    }
    const joined = figureQuestion(seed, 'count-joined', 4);
    let built = joined.segments;
    for (const m of joined.mirrors) built = [...built, ...reflect(built, m.axis, m.at)];
    assert.equal(joined.answer.value, countByLines(built, joined.shape), `joined seed ${seed}`);
    assert.ok(joined.answer.value > joined.mirrors.length * 2 * countByLines(joined.segments, joined.shape) - 1, 'shapes appear across the join');
    const pickN = figureQuestion(seed, 'figure-with-n', 4);
    pickN.options.forEach(o => assert.equal(o.correct, countByLines(o.figure.segments, pickN.shape) === pickN.n, `with-n seed ${seed} ${o.id}`));
    assert.ok(pickN.answer.length >= 1 && pickN.answer.length <= 3);
  }
});

test('tool presets count the same both ways', () => {
  for (const [name, preset] of Object.entries(counterPresets)) assert.ok(agree(preset.segments(), preset.shape, name) >= 4, name);
  assert.equal(countOf(counterPresets['joined-square'].segments(), 'triangle') > 2 * countOf(counterPresets['half-square'].segments(), 'triangle'), true);
});
