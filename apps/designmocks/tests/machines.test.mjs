// More machines checked a second way: frames by Laman's counting rule (no
// matrices), toppling by sampling points inside each block, pulleys by work
// in = work out, levers by moments, and rolling by the path of the centre.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MACHINE_KINDS, machinesQuestion } from '../src/learn/machines.js';

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
const right = q => q.options.find(o => o.id === q.answer);
const nums = s => s.match(/\d+(\.\d+)?/g).map(Number);

test('every kind builds sound questions', () => {
  for (const [kind, levels] of Object.entries(MACHINE_KINDS)) for (const level of levels) for (const seed of seeds) {
    const q = machinesQuestion(seed, kind, level);
    if (q.answerMode === 'numeric') { for (const m of q.mistakes) assert.notEqual(m.value, q.answer.value); }
    else { assert.equal(q.options.length, 4); assert.equal(q.options.filter(o => o.correct).length, 1); }
    if (level >= 3) { assert.ok(q.hints.length >= 1, kind); assert.ok(q.solution.length >= 3, kind); }
  }
});

test('lever classes, moments and pulley work', () => {
  const examples = { 'a see-saw': 1, 'a pair of scissors': 1, 'a crowbar lifting a stone': 1, pliers: 1, 'a wheelbarrow': 2, 'a nutcracker': 2, 'a bottle opener': 2, 'an oar rowing a boat': 2, 'a pair of tweezers': 3, 'a fishing rod': 3, 'a broom sweeping': 3, 'your forearm lifting a cup': 3 };
  for (const seed of seeds) {
    const q = machinesQuestion(seed, 'lever-class', 2), cls = Number(right(q).text.match(/Class (\d)/)[1]);
    if (q.figures.length) assert.equal(cls, { F: 1, L: 2, E: 3 }[q.figures[0].order[1]]);
    else assert.equal(cls, examples[q.prompt.match(/Which class of lever is (.+)\?$/)[1]]);
  }
  for (const seed of seeds) {
    const q = machinesQuestion(seed, 'lever-effort', 3), { load, effort } = q.figures[0].arms, w = nums(q.prompt)[0];
    assert.ok(Math.abs(q.answer.value * effort - w * load) < 1e-9, q.prompt);
  }
  for (const level of [3, 4]) for (const seed of seeds) {
    const q = machinesQuestion(seed, 'pulley-effort', level), n = q.figures[0].strands;
    if (q.unit === 'N') assert.ok(Math.abs(q.answer.value * n - nums(q.prompt)[0]) < 1e-9); // effort × n rope = load × 1
    else assert.ok(Math.abs(q.answer.value - n * nums(q.prompt)[0]) < 1e-9);
  }
});

// Laman: a set of bars is independent when every k joints carry at most 2k − 3 of them.
function independent(bars, joints) {
  for (let mask = 1; mask < 1 << joints; mask++) {
    const k = mask.toString(2).split('1').length - 1;
    if (k < 2) continue;
    if (bars.filter(([i, j]) => mask & (1 << i) && mask & (1 << j)).length > 2 * k - 3) return false;
  }
  return true;
}
function maxIndependent(bars, joints) {
  let best = 0;
  for (let mask = 0; mask < 1 << bars.length; mask++) { const pick = bars.filter((_, i) => mask & (1 << i)); if (pick.length > best && independent(pick, joints)) best = pick.length; }
  return best;
}
test('frames: rigidity by Laman counting', () => {
  for (const seed of seeds) {
    const q = machinesQuestion(seed, 'rigid-frame', 3);
    for (const o of q.options) { const n = o.figure.points.length; assert.equal(maxIndependent(o.figure.bars, n) === 2 * n - 3, o.correct, `seed ${seed} ${o.label}`); }
  }
  for (const seed of seeds) {
    const q = machinesQuestion(seed, 'rigid-frame', 4), n = q.frame.points.length;
    assert.equal(q.answer.value, 2 * n - 3 - maxIndependent(q.frame.bars, n), `seed ${seed}`);
  }
});

function inside(poly, x, y) { let c = false; poly.forEach(([ax, ay], i) => { const [bx, by] = poly[(i + 1) % poly.length]; if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) c = !c; }); return c; }
test('toppling: sampled balance point against the base', () => {
  for (const seed of seeds) {
    const q = machinesQuestion(seed, 'topple', 3), fall = q.prompt.includes('will fall over');
    for (const o of q.options) {
      const p = o.figure.poly; let sx = 0, count = 0;
      for (let x = -6; x <= 10; x += 0.05) for (let y = 0.025; y <= 7; y += 0.05) if (inside(p, x, y)) { sx += x; count++; }
      const cx = sx / count, base = p.filter(v => v[1] === 0).map(v => v[0]), tips = cx < Math.min(...base) || cx > Math.max(...base);
      assert.equal(tips === fall, o.correct, `seed ${seed} ${o.label}`);
    }
  }
});

test('rolling: turns from the path of the centre', () => {
  for (const level of [3, 4]) for (const seed of seeds) {
    const q = machinesQuestion(seed, 'rolling', level);
    if (q.figures[0]?.type === 'coins') { const { R, r, inside: inn } = q.figures[0], path = 2 * Math.PI * (inn ? R - r : R + r); assert.ok(Math.abs(q.answer.value - path / (2 * Math.PI * r)) < 1e-9); }
    else if (q.prompt.includes('plank')) assert.equal(q.answer.value, 2 * nums(q.prompt)[0]);
    else { const [d, turns] = nums(q.prompt); assert.ok(Math.abs(q.answer.value - (22 / 7) * d * turns) < 0.006, q.prompt); }
  }
});
