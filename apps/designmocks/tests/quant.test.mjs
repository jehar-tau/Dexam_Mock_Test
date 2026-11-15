import assert from 'node:assert/strict';
import test from 'node:test';
import { QUANT_LEVELS, basketTotals, crossingBest, cycleItem, handsTime, quantQuestion, runProcedure, slabsOf } from '../src/learn/quant.js';

// Read the numbers back out of a question's text, so each check redoes the sum from what the student sees.
const nums = text => (text.replace(/₹/g, '').replace(/(\d),(?=\d)/g, '$1').match(/\d+(\.\d+)?/g) ?? []).map(Number);

test('crossing with one umbrella: the two-plan rule matches a full search', () => {
  // Breadth-first search over who is still at the bus stop and where the umbrella is.
  const search = times => {
    const start = { left: times.map((_, i) => i), at: 'stop', t: 0 }, best = new Map();
    let queue = [start], answer = Infinity;
    while (queue.length) {
      const next = [];
      for (const s of queue) {
        const key = `${s.left.join(',')}|${s.at}`;
        if ((best.get(key) ?? Infinity) <= s.t) continue;
        best.set(key, s.t);
        if (!s.left.length) { answer = Math.min(answer, s.t); continue; }
        if (s.at === 'stop') {
          for (let i = 0; i < s.left.length; i++) for (let j = i; j < s.left.length; j++) {
            const go = [s.left[i], s.left[j]], left = s.left.filter(k => !go.includes(k));
            next.push({ left, at: 'home', t: s.t + Math.max(times[go[0]], times[go[1]]) });
          }
        } else {
          for (const k of times.map((_, i) => i).filter(i => !s.left.includes(i))) next.push({ left: [...s.left, k].sort(), at: 'stop', t: s.t + times[k] });
        }
      }
      queue = next;
    }
    return answer;
  };
  for (const times of [[1, 2, 5, 10], [1, 2, 3, 4], [2, 5, 10, 12], [1, 5, 6, 8], [3, 4, 7, 15], [1, 10, 12, 15]]) assert.equal(crossingBest(times), search(times), String(times));
  for (let seed = 1; seed <= 30; seed++) {
    const q = quantQuestion(seed, 'crossing'), times = nums(q.prompt).slice(0, 4).sort((a, b) => a - b);
    assert.equal(q.answer.value, search(times), `crossing seed ${seed}`);
  }
});

test('clock hands: a minute-by-minute simulation finds the same moments', () => {
  for (let h = 1; h <= 11; h++) for (const target of [0, 90, 180]) {
    let t = 0.1;
    const angle = m => { const g = Math.abs(((30 * h + 0.5 * m) - 6 * m) % 360); return Math.min((g + 360) % 360, 360 - ((g + 360) % 360)); };
    while (t < 70 && Math.abs(angle(t) - target) > 0.01) t += 0.0005;
    if (t < 70) assert.ok(Math.abs(t - handsTime(h, target)) < 0.01, `${h}:00 to ${target}°: ${t} vs ${handsTime(h, target)}`);
  }
});

test('every number question is recomputed from its own words', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const age = quantQuestion(seed, 'age-puzzle'), [k, n, m] = nums(age.prompt);
    let found = null;
    for (let Y = 1; Y < 200 && !found; Y++) { const X = Y + m; if (X === k * (Y - n)) found = { X, Y }; }
    assert.equal(age.answer.value, age.prompt.includes('sum') ? found.X + found.Y : found.X, `age seed ${seed}`);

    const frac = quantQuestion(seed, 'fraction-time'), hours = { day: 24, week: 168, 'year 2023': 8760, 'year 2024': 8784, 'month of 30 days': 720 };
    const period = Object.keys(hours).find(p => frac.prompt.includes(`one ${p}`)), fr = [...frac.prompt.matchAll(/(\d+)\/(\d+)/g)].map(x => Number(x[1]) / Number(x[2]));
    assert.ok(Math.abs(frac.answer.value - hours[period] * (1 - fr.reduce((a, b) => a + b, 0))) < 1e-6, `fraction seed ${seed}`);

    const train = quantQuestion(seed, 'relative-speed'), [u, v, t1, t2] = nums(train.prompt);
    // Simulate: lengths from the two facts, then the time for the faster train to slide past a point on the slower.
    const sum = (u + v) / 3.6, diff = (u - v) / 3.6, slow = diff * t2, fast = sum * t1 - slow;
    assert.ok(Math.abs(train.answer.value - fast / diff) < 1e-9, `train seed ${seed}`);

    const cut = quantQuestion(seed, 'cut-sheets'), [a, b, W, H] = nums(cut.prompt);
    let most = 0;
    for (const [p, q] of [[a, b], [b, a]]) { let c = 0; for (let x = 0; x + p <= W; x += p) for (let y = 0; y + q <= H; y += q) c++; most = Math.max(most, c); }
    assert.equal(cut.answer.value, most, `cut seed ${seed}`);

    const walk = quantQuestion(seed, 'walk-distance'), [d1, d2] = nums(walk.prompt);
    // Walk the two people on a grid: A east then left (north); B west then left (south) or right (north).
    const A = [d1, d2], B = walk.prompt.includes('one turns left') ? [-d1, d2] : [-d1, -d2];
    assert.ok(Math.abs(walk.answer.value - Math.hypot(A[0] - B[0], A[1] - B[1])) < 1e-9, `walk seed ${seed}`);

    const pieces = quantQuestion(seed, 'max-pieces'), cuts = nums(pieces.prompt).at(-1);
    let p = 1; for (let c = 1; c <= cuts; c++) p += c;
    assert.equal(pieces.answer.value, p);

    const slab = quantQuestion(seed, 'slab-pattern'), amount = nums(slab.prompt).at(-1), rows = slab.figures[0].rows.map(r => nums(r.join(' ')));
    // Extend the table by its own steps: ranges double, the discount step doubles.
    let [from, to, disc] = rows[rows.length - 1], step = disc - rows[rows.length - 2][2];
    while (amount > to) { from = to + 1; to *= 2; step *= 2; disc += step; }
    assert.equal(slab.answer.value, disc, `slab seed ${seed}`);
    void from;
  }
});

test('hard puzzles: legs, bricks, digits, procedures, baskets and calendars', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const legs = quantQuestion(seed, 'two-legs'), avg = nums(legs.prompt)[0], times = Number(legs.prompt.match(/at (\d) times/)[1]);
    const ratio = legs.prompt.match(/(\d+)\/(\d+) of the length/) ? Number(RegExp.$1) / Number(RegExp.$2) : Number(legs.prompt.match(/(\d+) times as long/)[1]);
    // Try first speeds until the overall average matches.
    let x = 1; while (x < 200 && Math.abs((1 + ratio) / (1 / x + ratio / (times * x)) - avg) > 1e-9) x++;
    assert.equal(legs.answer.value, times * x, `legs seed ${seed}`);

    const bricks = quantQuestion(seed, 'displacement'), [l, w, h, water, b1, b2, b3, pct] = nums(bricks.prompt);
    let n = 0, level = water; while (level < l * w * h - 1e-9) { n++; level += b1 * b2 * b3 * (1 - pct / 100); }
    assert.equal(bricks.answer.value, n, `bricks seed ${seed}`);

    const dig = quantQuestion(seed, 'clock-digits'), [, hh, m1, , m2] = dig.prompt.match(/from (\d+):(\d+) to (\d+):(\d+)/).map(Number);
    let total = 0; for (let m = m1; m <= m2; m++) total += `${hh}${String(m).padStart(2, '0')}`.split('').reduce((s, c) => s + Number(c), 0);
    assert.equal(dig.answer.value, total, `digits seed ${seed}`);

    const proc = quantQuestion(seed, 'procedure'), rows = proc.figures[0].rows, [x0, y0] = nums(rows[0][1]), stop = nums(rows[3][1])[0], op = rows[1][1];
    let px = x0, py = y0; do { px = op.includes('×') ? px * py : op.includes('2y') ? px + 2 * py : px + py; py++; } while (py !== stop);
    assert.equal(proc.answer.value, px, `procedure seed ${seed}`);
    assert.equal(runProcedure({ x0, y0, op: op.includes('×') ? 'times' : op.includes('2y') ? 'plus-double' : 'plus', stop }), px);

    const basket = quantQuestion(seed, 'basket'), [max, p, q, r, min] = nums(basket.prompt);
    const ok = []; for (let apples = 1; apples <= max; apples++) for (let good = 1; good <= apples; good++) {
      if (good * (1 + p) !== apples) continue; const oranges = r * apples;
      if (oranges % (1 + q) === 0 && apples + oranges > min && apples + oranges <= max) ok.push(apples + oranges);
    }
    assert.deepEqual(ok, [basket.answer.value], `basket seed ${seed}`);
    assert.deepEqual(basketTotals({ p, q, r, max, min }), ok);

    const cal = quantQuestion(seed, 'calendar-cycle'), items = cal.prompt.match(/kit ([A-D](?:, [A-D])*) in turn/)[1].split(', ');
    // Step day by day with Date objects.
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dates = [...cal.prompt.matchAll(/(\d+) (January|February|March|April|May|June|July|August|September|October|November|December)/g)].map(mm => [Number(mm[1]), months.indexOf(mm[2])]);
    const year = 2022, at = ([d, mo]) => Date.UTC(year, mo, d), [start, gapFrom, gapTo, target] = dates.map(at);
    let kit = -1, day = start; for (; day <= target; day += 86400000) { if (day >= gapFrom && day <= gapTo) { kit = -1; continue; } kit = (kit + 1) % items.length; }
    assert.equal(cal.options.find(o => o.id === cal.answer).text, `Item ${items[kit]}`, `calendar seed ${seed}`);
    assert.equal(cycleItem({ start, gapFrom, gapTo, target, items }), items[kit]);
  }
});

test('foundation questions have four different options with the right one marked', () => {
  for (const kind of Object.keys(QUANT_LEVELS).filter(k => QUANT_LEVELS[k] <= 2)) for (let seed = 1; seed <= 60; seed++) {
    const q = quantQuestion(seed, kind);
    assert.equal(new Set(q.options.map(o => o.text)).size, 4, `${kind} ${seed}`);
    assert.equal(q.options.filter(o => o.correct).length, 1);
  }
  const pc = quantQuestion(1, 'percent-change'), [P, up, down] = nums(pc.prompt);
  assert.equal(pc.options.find(o => o.correct).value, (P * (100 + up) * (100 - down)) / 10000);
  assert.deepEqual(slabsOf({ end: 300, d1: 19, k: 30 }, 5).map(s => s.discount), [19, 49, 109, 229, 469]);
});
