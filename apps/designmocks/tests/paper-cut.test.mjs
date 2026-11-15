import assert from 'node:assert/strict';
import test from 'node:test';
import { GLYPHS, NOTCHES, S, applyFlaps, notch, openings, packetAfter, paperQuestion, punchHole, refold, signature, unfoldShapes } from '../src/learn/paper-cut.js';
import { seededRandom } from '../src/learn/random.js';

const close = (a, b) => Math.abs(a - b) < 1e-9;
// A second way to unfold: mirror the cut across each fold line in reverse order, by hand.
function unfoldByHand(folds, shapes) {
  const sizes = []; let w = S, h = S;
  for (const k of folds) { sizes.push({ k, w, h }); if (k === 'left') w /= 2; else if (k === 'up') h /= 2; }
  let copies = shapes.map(s => s.points);
  for (const { k, w: W, h: H } of [...sizes].reverse()) {
    const m = k === 'left' ? ([x, y]) => [W - x, y] : k === 'up' ? ([x, y]) => [x, H - y] : ([x, y]) => [y, x];
    copies = [...copies, ...copies.map(points => points.map(m))];
  }
  return copies.map(points => ({ points }));
}

test('hand-checked folds: layers, positions, and which layer is on top', () => {
  assert.equal(packetAfter(['left', 'up', 'diagonal']).layers.length, 8);
  // Fold left: a hole at (1.5, 0.5) also appears at (6.5, 0.5).
  const centres = unfoldShapes(packetAfter(['left']), [punchHole([1.5, 0.5])]).map(s => s.points.reduce((a, p) => [a[0] + p[0] / s.points.length, a[1] + p[1] / s.points.length], [0, 0]));
  assert.ok(centres.some(c => close(c[0], 1.5)) && centres.some(c => close(c[0], 6.5)));
  // A half circle on the fold opens into one hole; on the outer edge it makes two notches.
  const half = packetAfter(['left']);
  const onFold = openings(unfoldShapes(half, [notch(half, 'right', 0.5, 'semicircle', 0.7)]));
  assert.deepEqual([onFold.length, onFold.filter(o => !o.notch).length], [1, 1]);
  const onEdge = openings(unfoldShapes(half, [notch(half, 'left', 0.5, 'semicircle', 0.7)]));
  assert.deepEqual([onEdge.length, onEdge.filter(o => o.notch).length], [2, 2]);
  // A cut at the corner where two folds meet opens into one shape in the middle of the sheet.
  const quarter = packetAfter(['left', 'up']);
  const corner = openings(unfoldShapes(quarter, [{ points: [[4, 4], [3.3, 4], [4, 3.3]] }]));
  assert.equal(corner.length, 1);
  assert.equal(corner[0].pieces.length, 4);
  // The top layer after a fold is that fold's moved part: one reflection, so it lies face down.
  const top = packetAfter(['left', 'up']).layers.at(-1);
  assert.deepEqual(top([1, 1]), [1, 7]);
});

test('unfolding through the layers matches mirroring by hand, for every sequence', () => {
  const sequences = [['left'], ['up'], ['left', 'up'], ['up', 'left'], ['left', 'up', 'diagonal'], ['up', 'left', 'diagonal'], ['left', 'up', 'left'], ['left', 'left', 'up']];
  for (const folds of sequences) {
    const packet = packetAfter(folds);
    const edges = packet.triangle ? ['left', 'bottom', 'diagonal'] : ['top', 'right', 'bottom', 'left'];
    for (const edge of edges) for (const type of Object.keys(NOTCHES)) {
      const cut = notch(packet, edge, 0.5, type, 0.5);
      assert.equal(signature(unfoldShapes(packet, [cut])), signature(unfoldByHand(folds, [cut])), `${folds} ${edge} ${type}`);
    }
  }
});

test('every unfold-cuts option is checked against the truth, and only one matches', () => {
  for (const level of [3, 4]) for (let seed = 1; seed <= 60; seed++) {
    const q = paperQuestion(seed, 'unfold-cuts', level), truth = signature(unfoldByHand(q.folds, q.cuts));
    const matching = q.options.filter(o => signature(o.figure.shapes) === truth);
    assert.equal(matching.length, 1, `L${level} seed ${seed}`);
    assert.equal(matching[0].id, q.answer);
    assert.equal(new Set(q.options.map(o => signature(o.figure.shapes))).size, 4);
    if (level === 4) assert.ok(q.cuts.some(c => !NOTCHES[c.type].symmetric), 'exam hard uses a slanted cut');
  }
});

test('hole and piece counts are recounted another way', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const holes = paperQuestion(seed, 'hole-count', 3), pieces = unfoldByHand(holes.folds, holes.cuts);
    // An opening is a hole when no piece of it reaches the edge of the sheet.
    const edge = p => [0, 1].some(i => close(p[i], 0) || close(p[i], S));
    const groups = openings(pieces);
    assert.equal(holes.answer.value, groups.filter(g => !g.pieces.some(piece => piece.points.some(edge))).length, `holes seed ${seed}`);

    const cut = paperQuestion(seed, 'piece-count', 4);
    // Cut a fine grid of sample points and count connected regions directly.
    const packet = packetAfter(cut.folds), lines = cut.cutLines.flatMap(line => packet.layers.map(layer => line.map(layer)));
    const xs = lines.filter(l => close(l[0][0], l[1][0])).map(l => l[0][0]), ys = lines.filter(l => close(l[0][1], l[1][1])).map(l => l[0][1]);
    const bandsX = new Set(Array.from({ length: 64 }, (_, i) => xs.filter(x => x < (i + 0.5) / 8).length)).size;
    const bandsY = new Set(Array.from({ length: 64 }, (_, i) => ys.filter(y => y < (i + 0.5) / 8).length)).size;
    assert.equal(cut.answer.value, bandsX * bandsY, `pieces seed ${seed}`);
  }
});

test('two-coloured sheets: flaps are mirrored onto the sheet and the outline shrinks', () => {
  const strip = applyFlaps([{ kind: 'strip', side: 'right', size: 2 }]);
  assert.deepEqual(strip.outline, [[0, 0], [6, 0], [6, 8], [0, 8]]);
  assert.deepEqual(strip.back[0], [[4, 0], [6, 0], [6, 8], [4, 8]]);
  const corner = applyFlaps([{ kind: 'corner', corner: 'top-right', size: 3 }]);
  assert.equal(corner.outline.length, 5);
  assert.deepEqual(corner.back[0].map(p => p.join(',')).sort(), ['5,0', '5,3', '8,3']);
  for (let seed = 1; seed <= 60; seed++) {
    const q = paperQuestion(seed, 'two-colour-fold', 4), truth = applyFlaps(q.flaps);
    const match = q.options.filter(o => !o.figure.allFront && JSON.stringify(o.figure.outline) === JSON.stringify(truth.outline) && JSON.stringify(o.figure.back) === JSON.stringify(truth.back));
    assert.equal(match.length, 1, `flaps seed ${seed}`);
    assert.equal(match[0].id, q.answer);
    // Area is kept: the outline loses exactly what the back-coloured flaps cover.
    const area = poly => Math.abs(poly.reduce((s, p, i) => s + p[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * p[1], 0)) / 2;
    assert.ok(close(S * S - area(truth.outline), truth.back.reduce((s, b) => s + area(b), 0)));
  }
});

test('the printed letter ends up mirrored by the last fold and read the right way round from the back', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const q = paperQuestion(seed, 'seen-from-behind', 4), packet = packetAfter(q.folds);
    const last = q.folds.at(-1), before = packetAfter(q.folds.slice(0, -1));
    const reflect = last === 'left' ? ([x, y]) => [before.w - x, y] : last === 'up' ? ([x, y]) => [x, before.h - y] : ([x, y]) => [y, x];
    const printed = q.figures[0].strokes, expected = printed.map(st => st.map(p => { const [x, y] = reflect(p); return [S - x, y]; }));
    const answer = q.options.find(o => o.id === q.answer).figure.strokes;
    assert.deepEqual(answer.map(st => st.map(p => p.map(v => +v.toFixed(6)))), expected.map(st => st.map(p => p.map(v => +v.toFixed(6)))), `letter seed ${seed}`);
    // Reflecting and then turning over is a rotation (or nothing): the letter is never back to front.
    const [a, b, c] = [[0, 0], [1, 0], [0, 1]].map(p => { const [x, y] = reflect(p); return [S - x, y]; });
    assert.ok((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0);
    assert.equal(packet.layers.length, 2 ** q.folds.length);
  }
  assert.ok(Object.keys(GLYPHS).length >= 3);
});

test('refolding a fully opened cut brings every copy back onto the packet', () => {
  const folds = ['left', 'up', 'diagonal'], packet = packetAfter(folds), cut = notch(packet, 'bottom', 0.5, 'step', 0.5);
  const back = unfoldShapes(packet, [cut]).map(s => refold(s.points, folds));
  for (const points of back) assert.equal(signature([{ points }]), signature([cut]));
  void seededRandom;
});
