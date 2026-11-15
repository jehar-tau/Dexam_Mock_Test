import assert from 'node:assert/strict';
import test from 'node:test';
import { MATRICES, MIRROR_SAFE, WATER_SAFE, applyTo, edgeSpots, imageAngles, imageCount, mirrorExamQuestion, mirrorTime, multiply, nameOf, patternKey, traceRay } from '../src/learn/mirror-exam.js';

// Second ways to do each thing, written without the engine's matrices.
const flipX = (cells, n) => Object.fromEntries(Object.entries(cells).map(([k, t]) => { const [x, y] = k.split(',').map(Number); return [`${n - 1 - x},${y}`, t]; }));
const flipY = (cells, n) => Object.fromEntries(Object.entries(cells).map(([k, t]) => { const [x, y] = k.split(',').map(Number); return [`${x},${n - 1 - y}`, t]; }));
const swapXY = cells => Object.fromEntries(Object.entries(cells).map(([k, t]) => { const [x, y] = k.split(',').map(Number); return [`${y},${x}`, t]; }));
const swapAnti = (cells, n) => Object.fromEntries(Object.entries(cells).map(([k, t]) => { const [x, y] = k.split(',').map(Number); return [`${n - 1 - y},${n - 1 - x}`, t]; }));
const byLine = { right: flipX, left: flipX, top: flipY, bottom: flipY, falling: (c) => swapXY(c), rising: swapAnti };

test('hand-checked rules from the spec', () => {
  for (const [[h, m], [rh, rm]] of [[[3, 0], [9, 0]], [[2, 20], [9, 40]], [[12, 0], [12, 0]], [[7, 35], [4, 25]], [[6, 0], [6, 0]]]) assert.deepEqual(mirrorTime(h, m), { h: rh, m: rm });
  assert.deepEqual([[90, false], [60, false], [45, false], [72, true], [72, false], [120, true], [120, false]].map(([t, b]) => imageCount(t, b)), [3, 5, 7, 4, 5, 2, 3]);
  assert.equal(nameOf(multiply(MATRICES.water, MATRICES.mirror)), 'turned', 'upright then level line: half turn');
  assert.equal(nameOf(multiply(MATRICES.mirror, MATRICES.mirror)), 'same');
  const ray = traceRay(3, { '1,1': '/' }, { x: 0, y: 1, d: [1, 0] });
  assert.deepEqual([ray.exit, ray.bounces], [{ x: 1, y: -1 }, 1]);
});

test('a clock read in a mirror, worked out from the angles of the hands', () => {
  for (let h = 1; h <= 12; h++) for (let m = 0; m < 60; m += 5) {
    // Hands as angles clockwise from 12; a mirror beside the clock sends angle a to 360 − a.
    const minute = (360 - m * 6) % 360, real = (360 - ((h % 12) * 30 + m / 2)) % 360;
    const rm = minute / 6, rh = Math.floor((real - rm / 2) / 30 + 1e-9);
    assert.deepEqual(mirrorTime(h, m), { h: rh || 12, m: rm }, `${h}:${m}`);
  }
});

test('images between two mirrors: the reflections followed one by one agree with the rule', () => {
  for (const theta of [30, 36, 40, 45, 60, 72, 90, 120]) for (const share of [0.5, 0.3, 0.12, 0.81]) {
    assert.equal(imageAngles(theta, theta * share).length, imageCount(theta, share === 0.5), `${theta}° at ${share}`);
  }
});

test('mirror-image L3 and diagonal-mirror answers match a flip done cell by cell', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const q = mirrorExamQuestion(seed, 'mirror-image', 3), truth = patternKey(byLine[q.side](q.cells, 7));
    const match = q.options.filter(o => patternKey(o.figure.cells) === truth);
    assert.equal(match.length, 1, `side seed ${seed}`);
    assert.equal(match[0].id, q.answer);
    assert.equal(new Set(q.options.map(o => patternKey(o.figure.cells))).size, 4);
    const d = mirrorExamQuestion(seed, 'diagonal-mirror', 3), dTruth = patternKey(byLine[d.line](d.cells, 6));
    assert.equal(d.options.filter(o => patternKey(o.figure.cells) === dTruth).map(o => o.id).join(), d.answer, `diagonal seed ${seed}`);
  }
});

test('reflection chains match reflecting the cells step by step', () => {
  const lineFlip = { V: flipX, H: flipY, D: c => swapXY(c), A: swapAnti };
  for (let seed = 1; seed <= 60; seed++) {
    const q = mirrorExamQuestion(seed, 'reflection-chain', 4);
    let cells = q.cells;
    for (const step of q.steps) cells = lineFlip[step.line](cells, 6);
    const match = q.options.filter(o => patternKey(o.figure.cells) === patternKey(cells));
    assert.equal(match.length, 1, `chain seed ${seed}`);
    assert.equal(match[0].id, q.answer);
  }
});

test('words: safe letters and order, tested letter by letter', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const q = mirrorExamQuestion(seed, 'symmetric-words', 3);
    for (const o of q.options) {
      const w = o.text, safe = q.where === 'mirror' ? MIRROR_SAFE : WATER_SAFE;
      const same = [...w].every(c => safe.includes(c)) && (q.where === 'water' || w === [...w].reverse().join(''));
      assert.equal(o.correct, same, `${q.where} ${w}`);
    }
    assert.ok(q.answer.length >= 1 && q.answer.length <= 3);
  }
});

test('clock, image-count and ray questions carry the right answers', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const c = mirrorExamQuestion(seed, 'clock-mirror', 3), real = mirrorTime(c.shown.h, c.shown.m);
    assert.equal(c.options.find(o => o.id === c.answer).text, `${real.h}:${String(real.m).padStart(2, '0')}`);
    assert.equal(new Set(c.options.map(o => o.text)).size, 4);
    const i = mirrorExamQuestion(seed, 'image-count', 4);
    assert.equal(i.answer.value, imageAngles(i.theta, i.onBisector ? i.theta / 2 : i.theta * 0.3).length);
    // Rays: walk the grid again with a separate turn table.
    const r = mirrorExamQuestion(seed, 'ray-exit', 4), turn = { '/': { '1,0': [0, -1], '0,-1': [1, 0], '-1,0': [0, 1], '0,1': [-1, 0] }, '\\': { '1,0': [0, 1], '0,1': [1, 0], '-1,0': [0, -1], '0,-1': [-1, 0] } };
    let { x, y, d } = r.entry, guard = 0;
    while (x >= 0 && y >= 0 && x < r.n && y < r.n && guard++ < 200) { const m = r.mirrors[`${x},${y}`]; if (m) d = turn[m][d.join(',')]; x += d[0]; y += d[1]; }
    const spots = edgeSpots(r.n), exit = spots.findIndex(s => s.x === x && s.y === y);
    assert.equal(r.options.find(o => o.id === r.answer).text, `Exit ${exit + 1}`, `ray seed ${seed}`);
    const b = mirrorExamQuestion(seed, 'ray-bounces', 4);
    assert.equal(b.answer.value, traceRay(b.n, b.mirrors, b.entry).bounces);
  }
  void applyTo;
});
