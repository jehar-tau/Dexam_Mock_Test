// Perspective answers re-read from the drawings themselves: which side of
// the horizon the box lies, which edge families stay parallel on the page,
// where two drawn edges cross, where the horizon cuts each person, and the
// left-to-right order found with plain angles on the plan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PERSPECTIVE_KINDS, perspectiveQuestion } from '../src/learn/perspective.js';

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
const right = q => q.options.find(o => o.id === q.answer);
const slope = ([[x1, y1], [x2, y2]]) => Math.atan2(y2 - y1, x2 - x1);
const parallel = (a, b) => { const d = Math.abs(slope(a) - slope(b)) % Math.PI; return Math.min(d, Math.PI - d) < 1e-6; };

test('every kind builds sound questions', () => {
  for (const [kind, levels] of Object.entries(PERSPECTIVE_KINDS)) for (const level of levels) for (const seed of seeds) {
    const q = perspectiveQuestion(seed, kind, level);
    if (q.answerMode === 'numeric') { for (const m of q.mistakes) assert.notEqual(m.value, q.answer.value); }
    else { assert.equal(q.options.length, 4); assert.equal(q.options.filter(o => o.correct).length, 1); }
    if (level >= 3) { assert.ok(q.hints.length >= 1, kind); assert.ok(q.solution.length >= 3, kind); }
  }
});

test('eye level and perspective type, read from the drawn box', () => {
  for (const seed of seeds) {
    const q = perspectiveQuestion(seed, 'eye-level', 2), vs = q.figures[0].lines.flat().map(p => p[1]);
    // The horizon is the line v = 0: the box drawn wholly beneath it means the horizon is above the box.
    const answer = Math.max(...vs) < 0 ? 'Above the box' : Math.min(...vs) > 0 ? 'Below the box' : 'Level with the middle of the box';
    assert.equal(right(q).text, answer, `seed ${seed}`);
  }
  for (const seed of seeds) {
    const q = perspectiveQuestion(seed, 'perspective-type', 2), L = q.figures[0].lines;
    const xFamily = [L[0], L[2], L[4], L[6]], yFamily = [L[1], L[3], L[5], L[7]], ups = [L[8], L[9], L[10], L[11]];
    const allPar = fam => fam.every(e => parallel(e, fam[0]));
    const points = (allPar(xFamily) ? 0 : 1) + (allPar(yFamily) ? 0 : 1) + (allPar(ups) ? 0 : 1);
    assert.equal(right(q).text, ['', 'One-point perspective', 'Two-point perspective', 'Three-point perspective'][points], `seed ${seed}`);
  }
});

function cross([[x1, y1], [x2, y2]], [[x3, y3], [x4, y4]]) {
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4), a = x1 * y2 - y1 * x2, b = x3 * y4 - y3 * x4;
  return [(a * (x3 - x4) - (x1 - x2) * b) / d, (a * (y3 - y4) - (y1 - y2) * b) / d];
}
test('vanishing points: where two drawn edges cross', () => {
  for (const seed of seeds) {
    const q = perspectiveQuestion(seed, 'vanishing-point', 3), f = q.figures[0], L = f.lines, side = q.prompt.includes('to the left') ? -1 : 1;
    const vps = [cross(L[0], L[4]), cross(L[1], L[5])].sort((a, b) => a[0] - b[0]), vp = side < 0 ? vps[0] : vps[1];
    const near = f.points.find(p => Math.hypot(p.at[0] - vp[0], p.at[1] - vp[1]) < 1e-6);
    assert.ok(near, `seed ${seed}: no labelled point at the crossing`);
    assert.equal(right(q).text, `Point ${near.label}`);
    assert.ok(Math.abs(vp[1]) < 1e-6, 'level edges vanish on the horizon');
  }
});

test('eye height: where the horizon cuts each person', () => {
  for (const level of [3, 4]) for (const seed of seeds) {
    const q = perspectiveQuestion(seed, 'eye-height', level), H = Number(q.prompt.match(/People ([\d.]+) m/)[1]);
    for (const p of q.figures[0].people) {
      const frac = (0 - p.foot[1]) / (p.head[1] - p.foot[1]);
      assert.ok(Math.abs(frac * H - q.answer.value) < 1e-6, `seed ${seed}`);
    }
  }
});

test('camera views: left-to-right order by angles on the plan', () => {
  const spots = { south: [0, -8], east: [8, 0], north: [0, 8], west: [-8, 0] };
  for (const level of [3, 4]) for (const seed of seeds) {
    const q = perspectiveQuestion(seed, 'camera-view', level), [cx, cy] = spots[q.from], fx = -cx / 8, fy = -cy / 8;
    // Signed angle to the right of the facing direction.
    const order = q.objects.map(o => { const dx = o.at[0] - cx, dy = o.at[1] - cy; return { type: o.type, a: Math.atan2(dx * fy - dy * fx, dx * fx + dy * fy) }; }).sort((a, b) => a.a - b.a).map(o => o.type);
    assert.deepEqual(right(q).figure.items.map(i => i.type), order, `seed ${seed} from ${q.from}`);
  }
});
