// Shadow answers checked by casting rays: sample points on each solid, move
// every point along the light by its own height, and check the correct
// shadow covers them all with its corners on cast points, while every wrong
// option fails. Numbers are checked by cross-multiplying.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SHADOW_KINDS, shadowQuestion } from '../src/learn/shadows.js';

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
const right = q => q.options.find(o => o.id === q.answer);
const D = Math.PI / 180;

// Points on a solid's surface (cube, cylinder, cone, pyramid) with heights.
function samples(s) {
  const out = [], lift = s.base ?? 0, r = s.size / 2, [cx, cy] = s.at;
  const ring = (rr, z, round) => {
    if (round) for (let i = 0; i < 96; i++) out.push([cx + rr * Math.cos((2 * Math.PI * i) / 96), cy + rr * Math.sin((2 * Math.PI * i) / 96), z]);
    else for (let i = 0; i <= 8; i++) { const t = -rr + (2 * rr * i) / 8; out.push([cx + t, cy - rr, z], [cx + t, cy + rr, z], [cx - rr, cy + t, z], [cx + rr, cy + t, z]); }
  };
  const round = s.type === 'cylinder' || s.type === 'cone', pointed = s.type === 'cone' || s.type === 'pyramid';
  for (let k = 0; k <= 6; k++) { const f = k / 6; ring(pointed ? r * (1 - f) : r, lift + s.h * f, round); }
  out.push([cx, cy, lift + s.h]);
  return out;
}
const cast = (p, light) => { const len = p[2] / Math.tan(light.elevation * D); return [p[0] - Math.sin(light.azimuth * D) * len, p[1] - Math.cos(light.azimuth * D) * len]; };
function inside(poly, [x, y]) {
  // Convex polygon: signed distance to every edge has one sign, within 0.01.
  const area = poly.reduce((a, [px, py], i) => { const [qx, qy] = poly[(i + 1) % poly.length]; return a + px * qy - qx * py; }, 0), turn = Math.sign(area);
  return poly.every(([ax, ay], i) => { const [bx, by] = poly[(i + 1) % poly.length], len = Math.hypot(bx - ax, by - ay); return len < 1e-9 || (turn * ((bx - ax) * (y - ay) - (by - ay) * (x - ax))) / len > -0.01; });
}
// Does this polygon equal the shadow cast by solid s?
function castsAs(poly, s, light) {
  const pts = samples(s).map(p => cast(p, light));
  if (!pts.every(p => inside(poly, p))) return false;
  return poly.every(v => pts.some(p => Math.hypot(p[0] - v[0], p[1] - v[1]) < 0.06));
}

test('every kind builds sound questions', () => {
  for (const [kind, levels] of Object.entries(SHADOW_KINDS)) for (const level of levels) for (const seed of seeds) {
    const q = shadowQuestion(seed, kind, level);
    if (q.answerMode === 'numeric') { for (const m of q.mistakes) assert.notEqual(m.value, q.answer.value); }
    else if (q.answerMode === 'multi') assert.ok(q.answer.length >= 1 && q.answer.length <= 3);
    else { assert.equal(q.options.length, 4); assert.equal(q.options.filter(o => o.correct).length, 1); }
    if (level >= 3) { assert.ok(q.hints.length >= 1, kind); assert.ok(q.solution.length >= 3, kind); }
  }
});

test('shadows point to the opposite compass point', () => {
  const vec = { North: [0, 1], 'North-east': [1, 1], East: [1, 0], 'South-east': [1, -1], South: [0, -1], 'South-west': [-1, -1], West: [-1, 0], 'North-west': [-1, 1] };
  for (const seed of seeds) {
    const q = shadowQuestion(seed, 'shadow-direction', 1), given = q.prompt.match(/(?:sun is in the|points) ([a-z-]+)/)[1];
    const g = vec[given.replace(/^./, c => c.toUpperCase())], a = vec[right(q).text];
    assert.deepEqual(a, g.map(v => (v === 0 ? 0 : -v)), q.prompt);
  }
});

test('the right top view is the cast shadow and no wrong one is', () => {
  for (const seed of seeds) {
    const q = shadowQuestion(seed, 'solid-shadow', 3);
    for (const o of q.options) assert.equal(castsAs(o.figure.shadows[0], q.solid, q.light), o.correct, `seed ${seed} option ${o.label}`);
  }
  for (const seed of seeds) {
    const q = shadowQuestion(seed, 'row-shadows', 3);
    for (const o of q.options) assert.equal(o.figure.shadows.every((p, i) => castsAs(p, q.solids[i], q.light)), o.correct, `row seed ${seed} option ${o.label}`);
  }
});

test('stacked solids: each part casts from its own height', () => {
  for (const seed of seeds) {
    const q = shadowQuestion(seed, 'stacked-shadow', 4), az = { north: 0, 'north-east': 45, east: 90, 'south-east': 135, south: 180, 'south-west': 225, west: 270, 'north-west': 315 }[q.prompt.match(/sun is in the ([a-z-]+)/)[1]];
    const type = { cylinder: 'cylinder', cone: 'cone', 'square pyramid': 'pyramid' }[q.prompt.match(/^A (cylinder|cone|square pyramid)/)[1]];
    const light = { azimuth: az, elevation: 45 }, parts = [{ type: 'box', at: [0, 0], size: 2.4, h: 2 }, { type, at: [0, 0], size: 1.4, h: 2, base: 2 }];
    for (const o of q.options) assert.equal(o.figure.shadows.length === 2 && o.figure.shadows.every((p, i) => castsAs(p, parts[i], light)), o.correct, `seed ${seed} ${o.label}`);
  }
});

test('flat cards keep their shape, moved away from the sun by their height', () => {
  for (const seed of seeds) {
    const q = shadowQuestion(seed, 'flat-shadow', 2), az = q.figures[0].light, want = [-Math.sin(az * D) * 2, -Math.cos(az * D) * 2];
    for (const o of q.options) {
      const card = o.figure.outlines[0], sh = o.figure.shadows[0];
      const moved = card.length === sh.length && card.every((p, i) => Math.hypot(sh[i][0] - p[0] - want[0], sh[i][1] - p[1] - want[1]) < 1e-6);
      assert.equal(moved, o.correct, `seed ${seed} ${o.label}`);
    }
  }
});

test('walkers: only parallel shadows pointing away from the sun are right', () => {
  for (const seed of seeds) {
    const q = shadowQuestion(seed, 'compass-shadows', 4), sun = q.figures[0].light, away = [-Math.sin(sun * D), -Math.cos(sun * D)];
    for (const o of q.options) {
      const ok = o.figure.walkers.every(w => { const [[x0, y0], [x1, y1]] = w.shadow, l = Math.hypot(x1 - x0, y1 - y0); return Math.abs((x1 - x0) / l - away[0]) < 1e-6 && Math.abs((y1 - y0) / l - away[1]) < 1e-6; });
      assert.equal(ok, o.correct, `seed ${seed} ${o.label}`);
    }
  }
});

test('ratios and lamps check by cross-multiplying', () => {
  for (const seed of seeds) {
    const q = shadowQuestion(seed, 'shadow-ratio', 3), n = q.prompt.match(/[\d.]+(?= m)/g).map(Number), v = q.answer.value;
    if (q.prompt.includes('How tall')) assert.ok(Math.abs(n[0] * n[2] - v * n[1]) < 1e-9, q.prompt);
    else assert.ok(Math.abs(n[0] * v - n[2] * n[1]) < 1e-9, q.prompt);
  }
  for (const seed of seeds) {
    const q = shadowQuestion(seed, 'lamp-shadow', 4), [H, h, d] = q.prompt.match(/[\d.]+(?= m)/g).map(Number), s = q.answer.value;
    assert.ok(Math.abs(h * (d + s) - H * s) < 1e-9, q.prompt);
  }
});

test('silhouettes follow how each solid looks end on, side on and corner on', () => {
  const can = { circle: ['sphere', 'cylinder', 'cone'], square: ['cube', 'square pyramid'], rectangle: ['cylinder', 'cube', 'triangular prism'], triangle: ['cone', 'square pyramid', 'triangular prism'] };
  for (const seed of seeds) {
    const q = shadowQuestion(seed, 'silhouette-set', 4), outline = q.figures[0].outline;
    for (const o of q.options) assert.equal(can[outline].includes(o.text.replace(/^A /, '')), o.correct, `seed ${seed} ${o.text}`);
  }
});
