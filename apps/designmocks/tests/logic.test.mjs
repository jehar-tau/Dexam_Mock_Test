import assert from 'node:assert/strict';
import test from 'node:test';
import { FIGURE_RULES, LOGIC_KINDS, logicQuestion } from '../src/learn/logic.js';

const perms = l => (l.length <= 1 ? [l] : l.flatMap((x, i) => perms([...l.slice(0, i), ...l.slice(i + 1)]).map(p => [x, ...p])));
const nums = t => (t.match(/-?\d+/g) ?? []).map(Number);
const isPrime = n => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
// Does a list of numbers follow one of the series families taught?
function fitsSomeRule(t) {
  const d = t.slice(1).map((x, i) => x - t[i]), dd = d.slice(1).map((x, i) => x - d[i]);
  if (d.every(x => x === d[0])) return true;
  if (t[0] && t.every((x, i) => i === 0 || x * t[i - 1] && x / t[i - 1] === t[1] / t[0])) return true;
  if (dd.every(x => x === dd[0])) return true;
  if (t.every(isPrime) && t.every((x, i) => i === 0 || (x > t[i - 1] && [...Array(x - t[i - 1] - 1)].every((_, k) => !isPrime(t[i - 1] + k + 1))))) return true;
  for (const c of [-1, 1, 2]) { const r = t.map(x => Math.sqrt(x - c)); if (r.every(Number.isInteger) && r.slice(1).every((x, i) => x === r[i] + 1)) return true; }
  const ev = t.filter((_, i) => i % 2 === 0), od = t.filter((_, i) => i % 2 === 1), arith = s => s.slice(1).every((x, i) => x - s[i] === s[1] - s[0]);
  if (ev.length > 2 && od.length > 2 && arith(ev) && arith(od)) return true;
  for (const m of [2, 3]) for (const p of [1, 2]) if (t.slice(1).every((x, i) => x === t[i] * m + p)) return true;
  return false;
}

test('series: the answer completes a pattern, and no wrong option does', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const easy = logicQuestion(seed, 'number-series', 1), shown = easy.prompt.split('? ')[1].split(', ').filter(x => x !== '?').map(Number);
    for (const o of easy.options) assert.equal(fitsSomeRule([...shown, Number(o.text)]), o.correct, `next seed ${seed} option ${o.text}`);
    const hard = logicQuestion(seed, 'series-rule', 3), parts = hard.prompt.split('mark? ')[1].split(', ');
    const filled = parts.map(p => (p === '?' ? hard.answer.value : Number(p)));
    assert.ok(fitsSomeRule(filled), `series seed ${seed}`);
    for (const m of hard.mistakes) assert.equal(fitsSomeRule(parts.map(p => (p === '?' ? m.value : Number(p)))), false, `mistake fits, seed ${seed}`);
    const odd = logicQuestion(seed, 'series-odd', 4), list = odd.prompt.split('one? ')[1].split(', ').map(Number);
    // The odd number is the only one that can be changed (by up to 5) to complete a pattern.
    const fixable = list.map((_, i) => [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].some(k => fitsSomeRule(list.map((x, j) => (j === i ? x + k : x)))));
    assert.equal(odd.options.find(o => o.correct).text, String(list[fixable.indexOf(true)]), `odd seed ${seed}`);
  }
});

test('codes: the transform is found by searching every shift and every symbol assignment', () => {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', shift = (w, k) => [...w].map(c => A[(A.indexOf(c) + k + 26) % 26]).join('');
  for (let seed = 1; seed <= 60; seed++) {
    const q = logicQuestion(seed, 'letter-shift', 2), [, w1, c1, w2] = q.prompt.match(/In a code, (\w+) is written as (\w+)\. How is (\w+)/);
    const fits = [];
    for (let k = -25; k <= 25; k++) for (const rev of [false, true]) { const f = w => { const c = shift(w, k); return rev ? [...c].reverse().join('') : c; }; if (f(w1) === c1) fits.push(f(w2)); }
    assert.equal(new Set(fits).size, 1, `shift seed ${seed}`);
    assert.equal(q.options.find(o => o.correct).text, fits[0]);

    const s = logicQuestion(seed, 'word-code', 3), rows = s.figures[0].rows, ask = s.prompt.match(/code for (\w+)\?/)[1];
    const letters = [...new Set(rows.map(r => r[0]).join(''))], symbols = [...new Set([...rows.map(r => r[1]).join('')])];
    const answers = new Set();
    for (const p of perms(symbols)) for (const rev of [false, true]) {
      const map = Object.fromEntries(letters.map((l, i) => [l, p[i]])), enc = w => { const x = [...w].map(c => map[c]); return (rev ? x.reverse() : x).join(''); };
      if (rows.every(([w, c]) => enc(w) === c)) answers.add(enc(ask));
    }
    assert.equal(answers.size, 1, `symbols seed ${seed}`);
    assert.equal(s.options.find(o => o.correct).text, [...answers][0]);
  }
});

test('number figures: exactly one listed rule fits the complete figures', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const q = logicQuestion(seed, 'figure-number', 4), done = q.figures.slice(0, 3), last = q.figures[3];
    const fitting = Object.values(FIGURE_RULES).filter(r => done.every(f => r.f(f.outer) === f.centre));
    assert.equal(fitting.length, 1, `figure seed ${seed}`);
    assert.equal(q.answer.value, fitting[0].f(last.outer));
  }
});

test('arrangements: clues are parsed back and every seating is tried', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rank = logicQuestion(seed, 'ranking', 1), names = ['Asha', 'Bilal', 'Charu', 'Dev', 'Esha'];
    const facts = rank.prompt.split('. Who')[0].split('. ').map(f => f.match(/(\w+) is (taller|shorter) than (\w+)/));
    const lines = perms(names).filter(p => facts.every(([, a, rel, b]) => (rel === 'taller' ? p.indexOf(a) < p.indexOf(b) : p.indexOf(a) > p.indexOf(b))));
    assert.equal(lines.length, 1);
    const pos = { 'the tallest': 0, 'second tallest': 1, 'in the middle': 2, 'second shortest': 3, 'the shortest': 4 }[rank.prompt.match(/Who is (.+)\?/)[1]];
    assert.equal(rank.options.find(o => o.correct).text, lines[0][pos], `rank seed ${seed}`);

    const row = logicQuestion(seed, 'row-seating', 2), sentences = row.prompt.split('facing you. ')[1].split('. Who')[0].split('. ');
    const test = (a, s) => {
      let m;
      if ((m = s.match(/^(\w+) sits at one end$/))) return a[0] === m[1] || a[4] === m[1];
      if ((m = s.match(/^(\w+) does not sit at either end$/))) return a[0] !== m[1] && a[4] !== m[1];
      if ((m = s.match(/^(\w+) sits immediately to the left of (\w+)$/))) return a.indexOf(m[1]) + 1 === a.indexOf(m[2]);
      if ((m = s.match(/^(\w+) sits between (\w+) and (\w+)$/))) return Math.abs(a.indexOf(m[1]) - a.indexOf(m[2])) === 1 && Math.abs(a.indexOf(m[1]) - a.indexOf(m[3])) === 1;
      if ((m = s.match(/^(\w+) does not sit next to (\w+)$/))) return Math.abs(a.indexOf(m[1]) - a.indexOf(m[2])) !== 1;
      if ((m = s.match(/^Exactly one person sits between (\w+) and (\w+)$/))) return Math.abs(a.indexOf(m[1]) - a.indexOf(m[2])) === 2;
      throw new Error('Unparsed clue: ' + s);
    };
    const fits = perms(names).filter(a => sentences.every(s => test(a, s)));
    assert.equal(fits.length, 1, `row seed ${seed}`);
    const seat = { 'Who sits in the middle?': 2, 'Who sits at the left end?': 0, 'Who sits second from the right?': 3 }[row.prompt.match(/Who sits[^?]+\?/)[0]];
    assert.equal(row.options.find(o => o.correct).text, fits[0][seat]);

    const circle = logicQuestion(seed, 'circle-seating', 3), six = ['Asha', 'Bilal', 'Charu', 'Dev', 'Esha', 'Farid'], cs = circle.prompt.split('the centre. ')[1].split('. Who')[0].split('. ');
    // Seats 0–5 clockwise seen from above; facing the centre, a person's left is the next seat clockwise.
    const ctest = (a, s) => {
      const at = n => a.indexOf(n), d = (x, y) => (at(x) - at(y) + 6) % 6; let m;
      if ((m = s.match(/^(\w+) sits (immediately|second) to the (left|right) of (\w+)$/))) return d(m[1], m[4]) === ((m[2] === 'immediately' ? 1 : 2) * (m[3] === 'left' ? 1 : -1) + 6) % 6;
      if ((m = s.match(/^(\w+) sits opposite (\w+)$/))) return d(m[1], m[2]) === 3;
      if ((m = s.match(/^(\w+) does not sit next to (\w+)$/))) return d(m[1], m[2]) !== 1 && d(m[1], m[2]) !== 5;
      throw new Error('Unparsed clue: ' + s);
    };
    const tables = perms(six.slice(1)).map(p => ['Asha', ...p]).filter(a => cs.every(s => ctest(a, s)));
    assert.equal(tables.length, 1, `circle seed ${seed}`);
    const [, which, who] = circle.prompt.match(/Who sits (immediately to the left of|opposite) (\w+)\?/), t = tables[0];
    assert.equal(circle.options.find(o => o.correct).text, t[(t.indexOf(who) + (which === 'opposite' ? 3 : 1)) % 6], `circle answer seed ${seed}`);
  }
});

test('symbol sums, rule sequences and handshakes are re-solved by search', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const q = logicQuestion(seed, 'symbol-sum', 3), eqs = q.prompt.split('something. ')[1].split('. What')[0].split('; ').map(e => e.match(/(\S+) \+ (\S+) = (\S+)/).slice(1));
    const [, x, y] = q.prompt.match(/What is (\S+) \+ (\S+)\?/), syms = [...new Set(eqs.flat().join(''))];
    const results = new Set();
    for (const base of [2, 3, 4]) for (const p of perms([...Array(Math.max(base, syms.length)).keys()].slice(0, syms.length))) {
      if (p.some(d => d >= base)) continue;
      const val = s => [...s].reduce((n, c) => n * base + p[syms.indexOf(c)], 0), write = n => { let out = ''; do { out = syms[p.indexOf(n % base)] + out; n = Math.floor(n / base); } while (n > 0); return out; };
      if (eqs.every(([a, b, c]) => write(val(a) + val(b)) === c && !c.startsWith(syms[p.indexOf(0)]) || (c.length === 1 && write(val(a) + val(b)) === c))) results.add(write(val(x) + val(y)));
    }
    assert.ok(results.has(q.options.find(o => o.correct).text), `symbols seed ${seed}`);

    const r = logicQuestion(seed, 'rule-sequence', 4);
    let row = [...r.prompt.match(/the row (\S+)/)[1]];
    const pos = { '1st': 0, '2nd': 1, '3rd': 2, '4th': 3, '5th': 4, '6th': 5 };
    for (const [, text] of r.figures[0].rows) {
      let m;
      if ((m = text.match(/Swap the (\w+) and (\w+) symbols/))) { const [i, j] = [pos[m[1]], pos[m[2]]]; [row[i], row[j]] = [row[j], row[i]]; }
      else if (text === 'Reverse the whole row') row.reverse();
      else if ((m = text.match(/Replace every (\S+) with (\S+)/))) row = row.map(c => (c === m[1] ? m[2] : c));
      else if (text === 'Move the first symbol to the end') row = [...row.slice(1), row[0]];
    }
    assert.equal(r.options.find(o => o.correct).text, row.join(''), `rules seed ${seed}`);

    const h = logicQuestion(seed, 'handshakes', 4), total = Number(h.prompt.match(/There are (\d+) handshakes/)[1]);
    if (h.prompt.includes('How many people')) { let n = 1; while (n * (n - 1) / 2 < total) n++; assert.equal(h.answer.value, n); }
    else {
      const men = Number(h.prompt.match(/has (\d+) men/)[1]), found = [];
      for (let w = 1; w <= 40; w++) {
        const count = h.prompt.includes('each man shakes hands with each woman') ? men * w : h.prompt.includes('every other man') ? men * (men - 1) / 2 + w * (w - 1) / 2 : (men + w) * (men + w - 1) / 2;
        if (count === total) found.push(w);
      }
      assert.deepEqual(found, [h.answer.value], `handshake seed ${seed}`);
    }
  }
});

test('directions, families, days, clocks and mazes', () => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (let seed = 1; seed <= 60; seed++) {
    for (const kind of ['direction-facing', 'direction-distance']) {
      const q = logicQuestion(seed, kind, LOGIC_KINDS[kind][1]);
      // Walk with complex numbers: heading as i^k, right turn multiplies by −i.
      let h = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] }[q.prompt.match(/walking (\w+)/)[1]], pos = [0, 0];
      const legs = [...q.prompt.matchAll(/(?:turns (left|right) and walks )?(\d+) m/g)];
      for (const [, turn, len] of legs) { if (turn === 'right') h = [h[1], -h[0]]; if (turn === 'left') h = [-h[1], h[0]]; pos = [pos[0] + h[0] * len, pos[1] + h[1] * len]; }
      if (kind === 'direction-facing') assert.equal(q.options.find(o => o.correct).text.toLowerCase(), { '0,1': 'north', '1,0': 'east', '0,-1': 'south', '-1,0': 'west' }[h.join()], `facing seed ${seed}`);
      else assert.equal(q.answer.value, Math.hypot(...pos), `distance seed ${seed}`);
    }
    const rel = logicQuestion(seed, 'relations', 3), links = [...rel.prompt.matchAll(/(\w) is the (\w+) of (\w)/g)];
    // Generations: each person's level relative to the first person in the chain.
    const level = { [links[0][3]]: 0 }; let sideways = false;
    for (const [, who, word, of] of links) { const step = { father: 1, mother: 1, son: -1, daughter: -1, brother: 0, sister: 0 }[word]; level[who] = level[of] + step; if (step === 0) sideways = true; }
    const last = links.at(-1)[1], male = ['father', 'son', 'brother'].includes(links.at(-1)[2]), g = level[last];
    const name = g === 2 ? (male ? 'grandfather' : 'grandmother') : g === -2 ? (male ? 'grandson' : 'granddaughter') : g === 1 ? (sideways ? (male ? 'uncle' : 'aunt') : (male ? 'father' : 'mother')) : g === -1 ? (sideways ? (male ? 'nephew' : 'niece') : (male ? 'son' : 'daughter')) : (male ? 'brother' : 'sister');
    assert.equal(rel.options.find(o => o.correct).text.toLowerCase(), name, `relations seed ${seed}`);

    const day = logicQuestion(seed, 'day-of-week', 3), [[, d1, m1, y], [, d2, m2]] = [...day.prompt.matchAll(/(\d+) (\w+) (\d{4})/g)];
    assert.equal(day.options.find(o => o.correct).text, days[new Date(Date.UTC(Number(y), months.indexOf(m2), Number(d2))).getUTCDay()], `day seed ${seed}`);
    assert.equal(day.prompt.match(/is a (\w+)\./)[1], days[new Date(Date.UTC(Number(y), months.indexOf(m1), Number(d1))).getUTCDay()]);

    const cal = logicQuestion(seed, 'calendar-repeat', 4), year = Number(cal.prompt.match(/after (\d{4})/)[1]);
    const pattern = yy => { const out = []; for (let t = Date.UTC(yy, 0, 1); new Date(t).getUTCFullYear() === yy; t += 86400000) out.push(new Date(t).getUTCDay()); return out.join(''); };
    let next = year + 1; while (pattern(next) !== pattern(year)) next++;
    assert.equal(cal.answer.value, next, `calendar seed ${seed}`);

    const clock = logicQuestion(seed, 'clock-gain', 3), [rate, setAt] = nums(clock.prompt), [hh, mm] = clock.prompt.match(/correct time is (\d+):(\d+)/).slice(1).map(Number);
    let elapsed = ((hh % 12) * 60 + mm - setAt * 60 + 720 * 2) % 720 || 720; if (clock.prompt.includes('evening') && hh % 12 + 12 - setAt > 12) elapsed += 0;
    let drift = 0; for (let m = 0; m < elapsed + (clock.prompt.includes('evening') && (hh % 12) * 60 + mm < setAt * 60 ? 0 : 0); m++) drift += rate / 60;
    const hours = clock.answer.value / rate;
    assert.ok(Number.isInteger(hours) && hours > 0, `clock seed ${seed}`);

    const maze = logicQuestion(seed, 'maze-openings', 4), f = maze.figures[0], open = new Set(f.open);
    // Relax distances until nothing changes (Bellman–Ford), a different method from the engine's search.
    const dist = {}; for (let x = 0; x < f.n; x++) for (let y = 0; y < f.m; y++) dist[`${x},${y}`] = Infinity; dist[f.from] = 0;
    for (let changed = true; changed;) { changed = false; for (const k of open) { const [a, b] = k.split('|'); if (dist[a] + 1 < dist[b]) { dist[b] = dist[a] + 1; changed = true; } if (dist[b] + 1 < dist[a]) { dist[a] = dist[b] + 1; changed = true; } } }
    assert.equal(maze.answer.value, dist[f.to], `maze seed ${seed}`);
  }
});
