// Everyday physics re-derived: floating by comparing densities, mirror
// distances by reflection geometry, lens images by ray tracing with similar
// triangles, sound by speed × time, loops by counting boundary components
// of a twisted strip, and rolling by arc length.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DENSITY, PHYSICS_KINDS, physicsQuestion } from '../src/learn/physics.js';
import { methodQuestion } from '../src/learn/method.js';
import { physicsMethod } from '../src/learn/physics.js';

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
const nums = s => s.match(/\d+(\.\d+)?/g).map(Number);

test('every kind builds sound questions', () => {
  for (const [kind, levels] of Object.entries(PHYSICS_KINDS)) for (const level of levels) for (const seed of seeds) {
    const q = physicsQuestion(seed, kind, level);
    if (q.answerMode === 'numeric') for (const m of q.mistakes) assert.notEqual(m.value, q.answer.value);
    else { assert.equal(q.options.length, 4); assert.equal(q.options.filter(o => o.correct).length, 1); }
    if (level >= 3) { assert.ok(q.hints.length >= 1, kind); assert.ok(q.solution.length >= 3, kind); }
  }
  for (const kind of Object.keys(physicsMethod.items)) for (const seed of seeds) assert.equal(methodQuestion(physicsMethod, kind, seed, 3).options.length, 4);
});

test('floating, mirrors, sound', () => {
  for (const seed of seeds) {
    const q = physicsQuestion(seed, 'floating', 2), floats = q.prompt.includes('floats');
    for (const o of q.options) { const d = Number(o.text.match(/\(([\d.]+) g/)[1]); assert.equal((d < 1) === floats, o.correct); }
    const q3 = physicsQuestion(seed, 'floating', 3), [rho, liquid] = nums(q3.prompt.replace(/one decimal/, ''));
    assert.ok(Math.abs(q3.answer.value - (100 * rho) / liquid) < 0.05);
    assert.ok(Object.values(DENSITY).includes(rho));
  }
  for (const seed of seeds) {
    const q = physicsQuestion(seed, 'mirror', 2), n = nums(q.prompt), d = n.length > 1 ? n[0] - n[1] : n[0];
    // Reflect yourself at x = d across the mirror at x = 0: the image is at −d.
    assert.equal(q.answer.value, d - -d);
    const q3 = physicsQuestion(seed, 'mirror', 3), H = nums(q3.prompt)[0], eye = H - 10;
    // Rays from head and feet reflect at heights midway to the eye: (H + eye)/2 and eye/2.
    assert.equal(q3.answer.value, (H + eye) / 2 - eye / 2);
  }
  for (const level of [2, 3]) for (const seed of seeds) {
    const q = physicsQuestion(seed, 'sound', level), t = nums(q.prompt)[0];
    assert.equal(q.answer.value, q.prompt.includes('echo') ? (340 * t) / 2 : 340 * t);
  }
});

test('lens images by ray tracing', () => {
  for (const level of [3, 4]) for (const seed of seeds) {
    const q = physicsQuestion(seed, 'lens', level), [u, f] = nums(q.prompt);
    // Ray parallel to the axis at height h bends through the focus; ray through the centre goes straight.
    const h = 1, x = (u * f) / (u - f); // where the two rays meet: h − h·x/f = −h·x/u
    assert.ok(Math.abs(h - (h * x) / f + (h * x) / u) < 1e-9);
    assert.ok(Math.abs(q.answer.value - (q.unit === 'cm' ? x : Math.round((x / u) * 100) / 100)) < 1e-9);
  }
});

test('twisted loops by tracing the edge', () => {
  for (const seed of seeds) {
    const q = physicsQuestion(seed, 'twist', 3), k = q.prompt.includes('no twist') ? 0 : nums(q.prompt)[0];
    // Walk along one edge: each half-twist swaps top and bottom edges. After one lap we are back on the same edge iff k is even.
    let edge = 0; for (let i = 0; i < k; i++) edge = 1 - edge;
    const edges = edge === 0 ? 2 : 1;
    assert.equal(q.answer.value, edges);
  }
});

test('rolling by arc length', () => {
  for (const seed of seeds) {
    const q = physicsQuestion(seed, 'roll-angle', 3), [r, dist] = nums(q.prompt);
    const turns = dist / (2 * (22 / 7) * r);
    assert.ok(Math.abs(q.answer.value - turns * 360) < 1e-6);
  }
});
