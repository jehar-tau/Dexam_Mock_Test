import assert from 'node:assert/strict';
import test from 'node:test';
import { DICE_KINDS, diceQuestion, mirrorDie, orientations, roll, sameDie, standardDie } from '../src/learn/dice.js';
import { foldNet, oppositeIndex, rotations } from '../src/learn/cube-net.js';

// A second model of a die: a number for each outward normal, turned by rotation matrices.
const NORMALS = { U: [0, 0, 1], D: [0, 0, -1], N: [0, 1, 0], S: [0, -1, 0], E: [1, 0, 0], W: [-1, 0, 0] };
const toVec = d => Object.entries(NORMALS).map(([k, n]) => ({ n, v: d[k] }));
const fromVec = faces => Object.fromEntries(Object.entries(NORMALS).map(([k, n]) => [k, faces.find(f => f.n.join() === n.join()).v]));
const apply = (m, v) => m.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const ROLL = { east: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], west: [[0, 0, -1], [0, 1, 0], [1, 0, 0]], north: [[1, 0, 0], [0, 0, 1], [0, -1, 0]], south: [[1, 0, 0], [0, 0, -1], [0, 1, 0]] };
const rollByMatrix = (d, dir) => fromVec(toVec(d).map(f => ({ n: apply(ROLL[dir], f.n), v: f.v })));

test('hand-checked rolls and the standard die', () => {
  const d = standardDie();
  assert.deepEqual(['east', 'north', 'south', 'west'].map(dir => roll(d, dir).U), [4, 2, 5, 3]);
  let x = d; for (let i = 0; i < 4; i++) x = roll(x, 'east');
  assert.deepEqual(x, d);
  assert.deepEqual(roll(roll(d, 'east'), 'west'), d);
  assert.equal(orientations(d).length, 24);
  assert.equal(sameDie(mirrorDie(d), d), false, 'a die and its mirror image are different dice');
  // 1, 2 and 3 go anticlockwise round their corner seen from outside: top, then front, then right.
  // Seen from the corner (+E, −N, +U) the cross product of front × right points along top.
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  assert.deepEqual(cross(NORMALS.S, NORMALS.E).map(Math.abs), NORMALS.U.map(Math.abs));
});

test('the rolling rule agrees with turning the die by rotation matrices', () => {
  for (const start of orientations(standardDie())) for (const dir of Object.keys(ROLL)) assert.deepEqual(roll(start, dir), rollByMatrix(start, dir), `${dir}`);
  // Every roll matrix is a proper rotation from the cube-net list.
  for (const m of Object.values(ROLL)) assert.ok(rotations.some(r => JSON.stringify(r) === JSON.stringify(m)));
});

test('dice questions are recomputed from what the figures show', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const level of DICE_KINDS['die-roll']) {
      const q = diceQuestion(seed, 'die-roll', level);
      let d = q.start; for (const dir of q.path) d = rollByMatrix(d, dir);
      const given = q.answerMode === 'single' ? Number(q.options.find(o => o.id === q.answer).text) : q.answer.value;
      assert.equal(given, d.U, `roll L${level} seed ${seed}`);
      const pic = q.figures.find(f => f.type === 'die');
      assert.deepEqual([pic.top, pic.front, pic.right], [q.start.U, q.start.S, q.start.E]);
      if (level === 4) {
        // The net shown folds into exactly this die.
        const net = q.figures.find(f => f.type === 'net'), fold = foldNet(net.cells.map(c => ({ x: c.x, y: c.y })));
        const n = i => Number(net.cells[i].content.glyph);
        for (let i = 0; i < 6; i++) { const opp = n(oppositeIndex(fold, i)); assert.ok([['U', 'D'], ['N', 'S'], ['E', 'W']].some(([a, b]) => (q.start[a] === n(i) && q.start[b] === opp) || (q.start[b] === n(i) && q.start[a] === opp))); }
      }
    }
    for (const level of [3, 4]) {
      const p = diceQuestion(seed, 'die-positions', level);
      // Try every numbering of a die that fits all the pictures; the asked opposite must be the same in all.
      const target = Number(p.prompt.match(/opposite (\d)/)[1]), fits = new Set();
      const perms = l => (l.length <= 1 ? [l] : l.flatMap((x, i) => perms([...l.slice(0, i), ...l.slice(i + 1)]).map(r => [x, ...r])));
      for (const order of perms([1, 2, 3, 4, 5, 6])) {
        const d = { U: order[0], D: order[1], N: order[2], S: order[3], E: order[4], W: order[5] }, views = new Set(orientations(d).map(o => `${o.U},${o.S},${o.E}`));
        if (p.pictures.every(pic => views.has(pic.join(',')))) fits.add([['U', 'D'], ['N', 'S'], ['E', 'W']].flatMap(([a, b]) => (d[a] === target ? [d[b]] : d[b] === target ? [d[a]] : []))[0]);
      }
      assert.deepEqual([...fits], [p.answer.value], `positions L${level} seed ${seed}`);
    }
    const s = diceQuestion(seed, 'same-die', 3);
    for (const o of s.options) {
      const f = o.figure, ok = orientations(s.die).some(d => d.U === f.top && d.S === f.front && d.E === f.right);
      assert.equal(o.correct, ok, `same-die seed ${seed} option ${o.id}`);
    }
    const st = diceQuestion(seed, 'die-stack-sum', 4), shown = st.figures[1].dice;
    const pairOf = (a, b) => [[st.die.U, st.die.D], [st.die.N, st.die.S], [st.die.E, st.die.W]].find(pr => !pr.includes(a) && !pr.includes(b));
    const vertical = shown.map(d => pairOf(d.front, d.right));
    const want = st.prompt.includes('parallel to the ground (every') ? vertical.flat().reduce((a, b) => a + b, 0) : st.prompt.includes('cannot see') ? vertical.flat().reduce((a, b) => a + b, 0) - shown[0].top : vertical.at(-1).find(v => v !== st.stack.at(-1).U);
    assert.equal(st.answer.value, want, `stack seed ${seed}`);
    const row = diceQuestion(seed, 'die-row-hidden', 4), rp = row.figures[1].dice.map(d => [[row.die.U, row.die.D], [row.die.N, row.die.S], [row.die.E, row.die.W]].find(pr => !pr.includes(d.top) && !pr.includes(d.front)));
    assert.equal(row.answer.value, rp.flat().reduce((a, b) => a + b, 0), `row seed ${seed}`);
  }
});
