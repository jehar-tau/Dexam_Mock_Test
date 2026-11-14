import assert from 'node:assert/strict';
import test from 'node:test';
import { ACW, CW, line, mechanismQuestion, mobileBalanced, mobileWeight, moment, presetSystem, ring, ropeDirections, ropePath, ropeSystem, solve } from '../src/learn/gears.js';
import { seededRandom } from '../src/learn/random.js';

const wheel = (id, size, extra = {}) => ({ id, x: 0, y: 0, r: 1, size, toothed: true, plane: 0, ...extra });
const speedOf = f => f.n / f.d;

// A second, separate way to work out a system: floating-point walk over the links.
function walk(system) {
  const dir = system.wheels.map(() => 0), speed = system.wheels.map(() => 0);
  dir[system.driver] = system.dir; speed[system.driver] = system.speed ?? 1;
  let changed = true;
  while (changed) {
    changed = false;
    for (const { type, a, b } of system.links) for (const [from, to] of [[a, b], [b, a]]) {
      if (dir[from] === 0 || dir[to] !== 0) continue;
      dir[to] = type === 'mesh' || type === 'crossed' ? -dir[from] : dir[from];
      speed[to] = type === 'shaft' ? speed[from] : (speed[from] * system.wheels[from].size) / system.wheels[to].size;
      changed = true;
    }
  }
  return { dir, speed };
}

test('worked examples from first principles: a compound train and two belts', () => {
  // X (10 teeth, clockwise, 100 a minute) meshes Y (20); Y shares a shaft with Z (8); Z meshes W (16).
  const train = { wheels: [wheel('X', 10), wheel('Y', 20), wheel('Z', 8), wheel('W', 16)], links: [{ type: 'mesh', a: 0, b: 1 }, { type: 'shaft', a: 1, b: 2 }, { type: 'mesh', a: 2, b: 3 }], driver: 0, dir: CW, speed: 100 };
  const result = solve(train);
  assert.deepEqual(result.dir, [CW, ACW, ACW, CW]);
  assert.deepEqual(result.speed.map(speedOf), [100, 50, 50, 25]);
  assert.equal(result.locked, false);
  // A open belt to B, B crossed belt to C.
  const belts = solve({ wheels: [wheel('A', 2), wheel('B', 2), wheel('C', 1)], links: [{ type: 'open', a: 0, b: 1 }, { type: 'crossed', a: 1, b: 2 }], driver: 0, dir: CW, speed: 30 });
  assert.deepEqual(belts.dir, [CW, CW, ACW]);
  assert.deepEqual(belts.speed.map(speedOf), [30, 30, 60]);
  // The driver need not be the first wheel.
  assert.deepEqual(solve({ ...train, driver: 3, dir: ACW, speed: 25 }).speed.map(speedOf), [100, 50, 50, 25]);
});

test('a ring of gears locks when it has an odd number, and a chain never locks', () => {
  for (let n = 3; n <= 8; n++) assert.equal(solve(ring(n)).locked, n % 2 === 1, `ring of ${n}`);
  for (let n = 2; n <= 6; n++) assert.equal(solve(line(n)).locked, false);
  assert.equal(solve(ring(5, 12, true)).locked, true, 'a gear hanging off a locked ring is locked too');
  assert.equal(solve(ring(4, 12, true)).dir[4], solve(ring(4, 12, true)).dir[1] * -1);
  // Ring gears really touch: neighbouring centres are two radii apart.
  const r = ring(5); r.wheels.forEach((w, i) => { const next = r.wheels[(i + 1) % 5]; assert.ok(Math.abs(Math.hypot(w.x - next.x, w.y - next.y) - 2 * w.r) < 1e-9); });
});

test('a rope turns each pulley the way it moves at the rim', () => {
  // One pulley; the rope comes up on the left, goes over the top and down on the right. Screen y runs down.
  const over = { pulleys: [{ id: 'A', x: 0, y: 0, r: 1, side: 1 }], weight: { x: -1, y: 5 }, pull: { x: 1, y: 5 } };
  assert.deepEqual(ropeDirections(over, true), [CW], 'pulled on the right, over the top: clockwise');
  assert.deepEqual(ropeDirections(over, false), [ACW], 'let out: anticlockwise');
  const path = ropePath(over);
  assert.ok(path.pieces[0].to[1] < 0.01 && path.pieces[0].to[0] < 0, 'the rope reaches the pulley on its left side');
  assert.ok(Math.abs(path.wraps[0] - Math.PI) < 0.01, 'and wraps half way round');

  for (let seed = 1; seed <= 40; seed++) {
    const rope = ropeSystem(seededRandom(seed), 6 + (seed % 4)), drawn = ropePath(rope);
    assert.ok(drawn, `seed ${seed} can be drawn`);
    rope.pulleys.forEach((p, i) => {
      const touch = drawn.pieces[i].to, u = drawn.pieces[i].u;
      // The rope is tangent: it touches the rim and runs at right angles to the radius there.
      assert.ok(Math.abs(Math.hypot(touch[0] - p.x, touch[1] - p.y) - p.r) < 1e-6);
      assert.ok(Math.abs((touch[0] - p.x) * u[0] + (touch[1] - p.y) * u[1]) < 1e-6);
      // Direction from the geometry alone: the turning sense of the rim point moving with the rope.
      const sense = Math.sign((touch[0] - p.x) * u[1] - (touch[1] - p.y) * u[0]);
      assert.equal(sense, ropeDirections(rope, true)[i], `seed ${seed} pulley ${p.id}`);
      assert.ok(drawn.wraps[i] > 0.3 && drawn.wraps[i] < 5, 'the rope really wraps the pulley');
    });
    for (let i = 0; i < rope.pulleys.length; i++) for (let j = i + 1; j < rope.pulleys.length; j++) assert.ok(Math.hypot(rope.pulleys[i].x - rope.pulleys[j].x, rope.pulleys[i].y - rope.pulleys[j].y) > rope.pulleys[i].r + rope.pulleys[j].r);
  }
});

test('direction, speed and counting questions agree with a separate walk of the links', () => {
  const cases = [['gear-direction', 1], ['gear-direction', 2], ['belt-direction', 2], ['gear-speed', 2], ['gear-speed', 3], ['compound-speed', 3], ['system-speed', 4], ['count-clockwise', 3]];
  for (const [kind, level] of cases) for (let seed = 1; seed <= 60; seed++) {
    const q = mechanismQuestion(seed, kind, level), again = walk(q.system), last = q.system.wheels.length - 1;
    // Drawn sizes are in proportion to the ratio sizes, so the picture never contradicts the numbers.
    const k = q.system.wheels[0].r / q.system.wheels[0].size;
    q.system.wheels.forEach(w => assert.ok(Math.abs(w.r / w.size - k) < 1e-9));
    // Meshing wheels touch; wheels on a shaft share a centre; belted wheels stand apart.
    for (const l of q.system.links) {
      const a = q.system.wheels[l.a], b = q.system.wheels[l.b], gap = Math.hypot(a.x - b.x, a.y - b.y);
      if (l.type === 'mesh') assert.ok(Math.abs(gap - a.r - b.r) < 1e-9, `${kind} ${seed} mesh touches`);
      else if (l.type === 'shaft') assert.equal(gap, 0);
      else assert.ok(gap > a.r + b.r + 1);
    }
    if (kind.endsWith('direction')) {
      const chosen = q.options.find(o => o.id === q.answer);
      assert.equal(chosen.value, again.dir[last], `${kind} L${level} seed ${seed}`);
      assert.equal(q.options.filter(o => o.correct).length, 1);
    } else if (kind === 'count-clockwise') {
      assert.equal(q.answer.value, again.dir.filter(d => d === CW).length, `count seed ${seed}`);
      assert.ok(q.answer.value > 0 && q.answer.value < q.system.wheels.length);
    } else {
      const value = q.answerMode === 'single' ? q.options.find(o => o.id === q.answer).value : q.answer.value;
      assert.ok(Math.abs(value - again.speed[last]) < 1e-9, `${kind} L${level} seed ${seed}`);
      assert.ok(Number.isInteger(value) && value >= 5 && value <= 2000);
      if (q.answerMode === 'single') assert.equal(new Set(q.options.map(o => o.value)).size, 4);
    }
    assert.ok(q.solution.length >= 2 && q.hints.length >= 1);
  }
  // Exam-hard systems really mix the link types.
  for (let seed = 1; seed <= 30; seed++) {
    const types = new Set(mechanismQuestion(seed, 'system-speed', 4).system.links.map(l => l.type));
    assert.ok(types.has('mesh') && types.has('shaft') && (types.has('open') || types.has('crossed')));
  }
});

test('rope, realign and will-it-move answers are recomputed another way', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rope = mechanismQuestion(seed, 'rope-count', 4), drawn = ropePath(rope.rope);
    const clockwise = rope.rope.pulleys.filter((p, i) => Math.sign((drawn.pieces[i].to[0] - p.x) * drawn.pieces[i].u[1] - (drawn.pieces[i].to[1] - p.y) * drawn.pieces[i].u[0]) * (rope.towardsPull ? 1 : -1) === CW).length;
    assert.equal(rope.answer.value, clockwise, `rope seed ${seed}`);
    assert.ok(rope.rope.pulleys.length >= 6 && rope.rope.pulleys.length <= 9);

    const marks = mechanismQuestion(seed, 'gear-realign', 4), [a, b] = marks.system.wheels.map(w => w.size);
    let teeth = 1; while (teeth % a || teeth % b) teeth++; // step the gears a tooth at a time until both marks are back
    assert.equal(marks.answer.value, teeth / (marks.prompt.includes('must gear B') ? b : a), `marks seed ${seed}`);

    const move = mechanismQuestion(seed, 'will-it-move', 4);
    move.options.forEach(option => {
      // Two-colour the gears: a system of meshing gears turns exactly when no two touching gears get the same colour.
      const system = option.figure.system, colour = system.wheels.map(() => 0); colour[0] = 1;
      let clash = false, changed = true;
      while (changed) { changed = false; for (const l of system.links) for (const [x, y] of [[l.a, l.b], [l.b, l.a]]) { if (colour[x] && !colour[y]) { colour[y] = -colour[x]; changed = true; } else if (colour[x] && colour[x] === colour[y]) clash = true; } }
      assert.equal(option.correct, !clash, `move seed ${seed} option ${option.id}`);
    });
    assert.ok(move.answer.length >= 1 && move.answer.length <= 3);
  }
});

test('lever and mobile questions balance exactly with the stated answer', () => {
  // By hand: 6 kg, 15 units left of the pivot, balances 3.6 kg at 25 units; in whole numbers 6 × 3 = 9 × 2.
  assert.equal(moment({ pivot: 3, loads: [{ at: 0, weight: 6 }, { at: 5, weight: 9 }] }), 0);
  assert.ok(moment({ pivot: 3, loads: [{ at: 0, weight: 6 }, { at: 5, weight: 8 }] }) < 0, 'negative means the left side goes down');
  for (let seed = 1; seed <= 60; seed++) {
    const lever = mechanismQuestion(seed, 'lever-balance', 3), beam = lever.beam;
    assert.equal(moment(beam), 0, `lever seed ${seed}`);
    const unknown = beam.loads[beam.loads.length - 1];
    assert.equal(lever.answer.value, lever.unit === 'kg' ? unknown.weight : unknown.at - beam.pivot);
    assert.ok(beam.loads.every(l => l.at >= 0 && l.at <= beam.length && l.at !== beam.pivot));

    const mobile = mechanismQuestion(seed, 'mobile-balance', 4);
    assert.equal(mobileBalanced(mobile.mobile), true, `mobile seed ${seed}`);
    const leaves = []; (function collect(n) { if (n.weight !== undefined) leaves.push(n); else { collect(n.left); collect(n.right); } })(mobile.mobile);
    assert.ok(leaves.length >= 4 && new Set(leaves.map(l => l.name[0])).size === leaves.length);
    const asked = leaves.find(l => mobile.prompt.includes(`is the ${l.name[0]} weight`));
    assert.equal(mobile.answer.value, asked.weight);
    assert.ok(leaves.every(l => Number.isInteger(l.weight) && l.weight >= 1));
    assert.equal(mobileWeight(mobile.mobile), leaves.reduce((sum, l) => sum + l.weight, 0));
  }
  // An unbalanced stick is caught.
  assert.equal(mobileBalanced({ left: { weight: 2 }, right: { weight: 2 }, a: 1, b: 2 }), false);
});

test('tool presets are valid systems', () => {
  for (const [name, options] of [['pair', {}], ['pair', { big: true }], ['chain', { count: 5 }], ['belt', { crossed: true }], ['compound', {}], ['mixed', {}], ['ring', { count: 4 }], ['ring', { count: 5 }]]) {
    const system = presetSystem(name, options), result = solve(system);
    assert.equal(result.locked, name === 'ring' && options.count === 5, name);
    if (!result.locked) assert.ok(result.dir.every(d => d !== 0));
  }
  assert.equal(solve(presetSystem('belt', { crossed: true })).dir[1], ACW);
  assert.deepEqual(solve(presetSystem('compound')).speed.map(speedOf), [60, 30, 30, 12]);
});
