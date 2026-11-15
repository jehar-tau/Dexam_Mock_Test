// Mirror and water images at exam level. Specification:
// docs/learn/topics/mirror-images.md.
//
// Conventions. Patterns are n × n cell grids, cell "x,y" with x to the right
// and y DOWN; each cell has a tone, 1 (dark) or 2 (orange). The eight
// symmetries of the square are 2 × 2 integer matrices acting about the
// grid's centre: [[a, b], [c, d]] sends (u, v) to (a u + b v, c u + d v).
// Applying A and then B is the matrix B · A.
import { pick, seededRandom, shuffle } from './random.js';

export const MATRICES = Object.freeze({
  same: [[1, 0], [0, 1]], mirror: [[-1, 0], [0, 1]], water: [[1, 0], [0, -1]], turned: [[-1, 0], [0, -1]],
  quarter: [[0, -1], [1, 0]], quarterBack: [[0, 1], [-1, 0]], transposed: [[0, 1], [1, 0]], anti: [[0, -1], [-1, 0]],
});
export const NAMES = { same: 'unchanged', mirror: 'flipped left to right', water: 'flipped top to bottom', turned: 'turned half way round', quarter: 'turned a quarter turn clockwise', quarterBack: 'turned a quarter turn anticlockwise', transposed: 'flipped across the falling diagonal', anti: 'flipped across the rising diagonal' };
export const multiply = (B, A) => [[B[0][0] * A[0][0] + B[0][1] * A[1][0], B[0][0] * A[0][1] + B[0][1] * A[1][1]], [B[1][0] * A[0][0] + B[1][1] * A[1][0], B[1][0] * A[0][1] + B[1][1] * A[1][1]]];
export const nameOf = M => Object.keys(MATRICES).find(k => JSON.stringify(MATRICES[k]) === JSON.stringify(M));
export function applyTo(cells, name, n) {
  const [[a, b], [c, d]] = MATRICES[name], h = (n - 1) / 2, out = {};
  for (const [k, tone] of Object.entries(cells)) { const [x, y] = k.split(',').map(Number), u = x - h, v = y - h; out[`${a * u + b * v + h},${c * u + d * v + h}`] = tone; }
  return out;
}
export const patternKey = cells => Object.entries(cells).map(([k, t]) => `${k}:${t}`).sort().join('|');

// A connected two-tone pattern that looks different under every one of the seven other symmetries.
export function tonePattern(rng, n = 7, size = [14, 20]) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const h = Math.floor(n / 2), cells = { [`${h},${h}`]: 1 }, target = size[0] + Math.floor(rng() * (size[1] - size[0] + 1));
    let guard = 0;
    while (Object.keys(cells).length < target && guard++ < 500) {
      const [x, y] = pick(rng, Object.keys(cells)).split(',').map(Number), [dx, dy] = pick(rng, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
      if (x + dx < 0 || y + dy < 0 || x + dx >= n || y + dy >= n) continue;
      cells[`${x + dx},${y + dy}`] = rng() < 0.3 ? 2 : 1;
    }
    const base = patternKey(cells);
    if (Object.values(cells).filter(t => t === 2).length < 3) continue;
    if (Object.keys(MATRICES).filter(k => k !== 'same').every(k => patternKey(applyTo(cells, k, n)) !== base)) return cells;
  }
  throw new Error('No asymmetric pattern');
}
function retry(seed, build) {
  for (let i = 0; i < 200; i++) { const q = build(seededRandom(seed * 1201 + i * 7919)); if (q) return q; }
  throw new Error('No mirror question for seed ' + seed);
}
const optionsFrom = (rng, list) => shuffle(rng, list).map((o, i) => ({ ...o, id: 'ABCD'[i], label: 'ABCD'[i] }));

// ---------- mirror-image L3: the line on any side ----------
const SIDE_RULE = { left: 'mirror', right: 'mirror', top: 'water', bottom: 'water' };
export function anySideQuestion(seed) {
  return retry(seed, rng => {
    const n = 7, cells = tonePattern(rng), side = pick(rng, ['left', 'right', 'top', 'bottom']), truth = SIDE_RULE[side], other = truth === 'mirror' ? 'water' : 'mirror';
    const result = applyTo(cells, truth, n), keys = Object.keys(result);
    const swapped = { ...result }, flip = pick(rng, keys); swapped[flip] = swapped[flip] === 1 ? 2 : 1;
    const list = [
      { cells: result, correct: true, reason: `A ${side === 'left' || side === 'right' ? 'mirror beside the figure swaps left and right' : 'line above or below the figure swaps top and bottom'}, and both tones stay where they were in the pattern.` },
      { cells: applyTo(cells, other, n), correct: false, reason: `This is flipped ${other === 'mirror' ? 'left to right' : 'top to bottom'}. The line is ${side === 'left' || side === 'right' ? 'beside' : side === 'top' ? 'above' : 'below'} the figure, so ${truth === 'mirror' ? 'left and right' : 'top and bottom'} swap instead.` },
      { cells: applyTo(cells, 'turned', n), correct: false, reason: 'This is turned half way round. A reflection swaps one pair of sides, never both.' },
      { cells: swapped, correct: false, reason: 'The outline is right but one cell has the wrong tone. Check the orange cells too.' },
    ];
    if (new Set(list.map(o => patternKey(o.cells))).size < 4) return null;
    const options = optionsFrom(rng, list.map(o => ({ correct: o.correct, reason: o.reason, figure: { type: 'tone-grid', cells: o.cells, n } })));
    return {
      kind: 'mirror-image', seed, answerMode: 'single', cells, side,
      prompt: `A mirror is placed along the ${side} side of the figure, as shown. Which option shows its reflection?`,
      figures: [{ type: 'tone-grid', cells, n, lines: [{ at: side }] }],
      options, answer: options.find(o => o.correct).id,
      explanation: `With the mirror on the ${side}, ${truth === 'mirror' ? 'left and right swap; top stays top' : 'top and bottom swap; left stays left'}. Every orange cell moves with the rest.`,
      hints: ['Which pair of sides does this mirror swap?', 'Check one corner cell and one orange cell in each option.'],
      solution: [
        { text: `The mirror is on the ${side}, so ${truth === 'mirror' ? 'left and right' : 'top and bottom'} swap.` },
        { text: 'Pick a cell near a corner and find where it must land. Do the same for an orange cell.' },
        { text: 'Rule out the turned option (both pairs swapped) and the one with a cell of the wrong tone.' },
        { text: `So the answer is ${options.find(o => o.correct).label}.` },
      ],
    };
  });
}

// ---------- diagonal-mirror ----------
export function diagonalQuestion(seed) {
  return retry(seed, rng => {
    const n = 6, cells = tonePattern(rng, n, [10, 15]), line = pick(rng, ['falling', 'rising']), truth = line === 'falling' ? 'transposed' : 'anti';
    const wrong = shuffle(rng, ['mirror', 'water', 'quarter', 'quarterBack', 'turned', line === 'falling' ? 'anti' : 'transposed']).slice(0, 3);
    const reason = { mirror: 'This is a side mirror image. A 45° mirror swaps across and down together.', water: 'This is a water image. A 45° mirror swaps across and down together.', quarter: 'This is turned a quarter turn. A mirror never turns a figure; check a slanted part, which must flip.', quarterBack: 'This is turned a quarter turn. A mirror never turns a figure; check a slanted part, which must flip.', turned: 'This is a half turn, not a reflection.', transposed: 'This is the reflection in the other diagonal.', anti: 'This is the reflection in the other diagonal.' };
    const options = optionsFrom(rng, [{ correct: true, reason: 'A mirror at 45° swaps each cell\'s distance across with its distance down.', figure: { type: 'tone-grid', cells: applyTo(cells, truth, n), n } }, ...wrong.map(w => ({ correct: false, reason: reason[w], figure: { type: 'tone-grid', cells: applyTo(cells, w, n), n } }))]);
    return {
      kind: 'diagonal-mirror', seed, answerMode: 'single', cells, line,
      prompt: 'A mirror is placed at 45° along the dashed line. Which option shows the reflection?',
      figures: [{ type: 'tone-grid', cells, n, lines: [{ at: line }] }],
      options, answer: options.find(o => o.correct).id,
      explanation: `A mirror along the ${line} diagonal turns rows into columns: a cell ${line === 'falling' ? 'a steps across and b steps down lands b steps across and a steps down' : 'near the top-left corner lands near the bottom-right corner, with across and down swapped'}.`,
      hints: ['Rows of the figure become columns of the reflection.', 'The corner the mirror points at stays where it is.'],
      solution: [
        { text: `The dashed line runs along the ${line} diagonal.` },
        { text: 'Read the top row of the figure. In the reflection it is a column, in the same order.' },
        { text: 'A quarter turn also turns rows into columns, but in the wrong order. Check one orange cell to tell them apart.' },
        { text: `So the answer is ${options.find(o => o.correct).label}.` },
      ],
    };
  });
}

// ---------- reflection-chain ----------
const LINES = { V: { name: 'the upright line', matrix: 'mirror' }, H: { name: 'the level line', matrix: 'water' }, D: { name: 'the falling diagonal', matrix: 'transposed' }, A: { name: 'the rising diagonal', matrix: 'anti' } };
export function chainQuestion(seed) {
  return retry(seed, rng => {
    const n = 6, cells = tonePattern(rng, n, [10, 15]), count = rng() < 0.55 ? 2 : 3;
    const chosen = shuffle(rng, ['V', 'H', 'D', 'A']).slice(0, count), labels = ['P', 'Q', 'R'].slice(0, count);
    const order = shuffle(rng, labels.map((l, i) => i));
    const steps = order.map(i => ({ label: labels[i], line: chosen[i] }));
    let M = MATRICES.same;
    const after = steps.map(s => (M = multiply(MATRICES[LINES[s.line].matrix], M)));
    const truth = nameOf(M);
    const reverse = nameOf(steps.reduceRight((acc, s) => multiply(MATRICES[LINES[s.line].matrix], acc), MATRICES.same));
    const firstOnly = LINES[steps[0].line].matrix, lastOnly = LINES[steps[steps.length - 1].line].matrix;
    const pool = [{ name: reverse, reason: 'This is the result of reflecting in the reverse order. Two reflections in lines that cross at 45° do not give the same result both ways.' }, { name: firstOnly, reason: 'This is the result of the first reflection only.' }, { name: lastOnly, reason: 'This is the result of the last reflection only.' }, { name: 'turned', reason: 'This is a half turn. That is what two reflections in an upright and a level line give, not these lines.' }, { name: 'same', reason: 'This is the original figure.' }, ...Object.keys(MATRICES).map(k => ({ name: k, reason: `This figure is ${NAMES[k]}. Follow the reflections one at a time.` }))];
    const seen = new Set([truth]), wrong = [];
    for (const p of pool) if (!seen.has(p.name)) { seen.add(p.name); wrong.push(p); if (wrong.length === 3) break; }
    const options = optionsFrom(rng, [{ correct: true, reason: `Overall the figure is ${NAMES[truth]}.`, figure: { type: 'tone-grid', cells: applyTo(cells, truth, n), n } }, ...wrong.map(w => ({ correct: false, reason: w.reason, figure: { type: 'tone-grid', cells: applyTo(cells, w.name, n), n } }))]);
    return {
      kind: 'reflection-chain', seed, answerMode: 'single', cells, steps,
      prompt: `The figure is reflected in ${steps.map(s => `line ${s.label}`).join(', then the result in ')}. Which option shows the final figure?`,
      figures: [{ type: 'tone-grid', cells, n, lines: chosen.map((line, i) => ({ at: { V: 'right', H: 'bottom', D: 'falling', A: 'rising' }[line], label: labels[i] })) }],
      options, answer: options.find(o => o.correct).id,
      explanation: `Step by step: ${steps.map((s, i) => `after line ${s.label} the figure is ${NAMES[nameOf(after[i])]}`).join('; ')}.`,
      hints: ['Do one reflection at a time and sketch the figure after each.', 'Two reflections in lines at right angles make a half turn. Two in lines at 45° make a quarter turn.'],
      solution: [...steps.map((s, i) => ({ text: `Reflect in line ${s.label} (${LINES[s.line].name}): now the figure is ${NAMES[nameOf(after[i])]} compared with the start.` })), { text: `So the answer is ${options.find(o => o.correct).label}.` }],
    };
  });
}

// ---------- letters and words ----------
export const MIRROR_SAFE = 'AHIMOTUVWXY', WATER_SAFE = 'BCDEHIKOX';
export const WORDS = Object.freeze(['TOOT', 'OTTO', 'MUM', 'WOW', 'AHA', 'TAT', 'AVA', 'HAH', 'MATH', 'TOMATO', 'WAIT', 'YOUTH', 'BOX', 'HIDE', 'CHOKE', 'DECK', 'BIKE', 'COOK', 'FLAG', 'ROAD', 'PAGE', 'JUNE', 'OHIO', 'EXIT', 'DIODE', 'HOW', 'TOY', 'MOM']);
export const sameInMirror = w => [...w].every(c => MIRROR_SAFE.includes(c)) && [...w].reverse().join('') === w;
export const sameInWater = w => [...w].every(c => WATER_SAFE.includes(c));
export function wordsQuestion(seed) {
  return retry(seed, rng => {
    const where = rng() < 0.5 ? 'mirror' : 'water', test = where === 'mirror' ? sameInMirror : sameInWater;
    const chosen = shuffle(rng, WORDS).slice(0, 4), right = chosen.filter(test);
    if (right.length < 1 || right.length > 3) return null;
    // At least one wrong word must be close: every letter safe but the order reverses, or one letter fails.
    const why = w => {
      const safe = where === 'mirror' ? MIRROR_SAFE : WATER_SAFE, bad = [...w].find(c => !safe.includes(c));
      if (test(w)) return where === 'mirror' ? `${w} uses only letters that look the same in a mirror, and reads the same backwards.` : `Every letter of ${w} looks the same upside down in water, and water keeps the order.`;
      if (bad) return `${bad} changes: it ${where === 'mirror' ? 'faces the other way in a mirror' : 'is upside down in water'}.`;
      return `Every letter of ${w} is safe, but a mirror reverses the order: it reads ${[...w].reverse().join('')}.`;
    };
    if (!chosen.some(w => !test(w) && ![...w].some(c => !(where === 'mirror' ? MIRROR_SAFE : WATER_SAFE).includes(c))) && where === 'mirror' && rng() < 0.6) return null;
    const options = chosen.map((w, i) => ({ id: 'ABCD'[i], label: 'ABCD'[i], text: w, correct: test(w), reason: why(w) }));
    return {
      kind: 'symmetric-words', seed, answerMode: 'multi', figures: [], where,
      prompt: where === 'mirror' ? 'Which of these words look exactly the same when the whole word is seen in a mirror placed beside it?' : 'Which of these words look exactly the same in their reflection in still water below them?',
      options, answer: options.filter(o => o.correct).map(o => o.id),
      explanation: where === 'mirror' ? `In a mirror the letters flip and the order reverses. The word must use only ${MIRROR_SAFE.split('').join(' ')} and read the same backwards.` : `In water each letter turns upside down but the order stays. The word must use only ${WATER_SAFE.split('').join(' ')}.`,
      hints: [where === 'mirror' ? 'Two tests: every letter must look the same flipped, and the word must read the same backwards.' : 'One test: every letter must look the same upside down. The order does not change.'],
      solution: [...options.map(o => ({ text: `${o.text}: ${o.reason}` })), { text: `So the answer is ${options.filter(o => o.correct).map(o => o.label).join(' and ')}.` }],
    };
  });
}

// ---------- clock-mirror ----------
export function mirrorTime(h, m) {
  const t = (h % 12) * 60 + m, r = (720 - t) % 720;
  return { h: Math.floor(r / 60) || 12, m: r % 60 };
}
const fmt = ({ h, m }) => `${h}:${String(m).padStart(2, '0')}`;
export function clockQuestion(seed) {
  return retry(seed, rng => {
    const shown = { h: 1 + Math.floor(rng() * 12), m: 5 * Math.floor(rng() * 12) }, real = mirrorTime(shown.h, shown.m);
    if (fmt(real) === fmt(shown)) return null;
    const water = (() => { const t = (shown.h % 12) * 60 + shown.m, r = ((18 * 60 + 30 - t) % 720 + 720) % 720; return { h: Math.floor(r / 60) || 12, m: r % 60 }; })();
    const wrong = [
      { time: shown, reason: 'That is the time as it appears. A mirror reverses the clock, so the real time is different.' },
      { time: water, reason: 'That uses the water rule (18:30 minus the time). A mirror beside the clock uses 11:60 minus the time.' },
      { time: { h: ((shown.h + 5) % 12) + 1, m: shown.m }, reason: 'Adding six hours turns the hands half way round. A mirror flips them left to right instead.' },
      { time: { h: real.h, m: (60 - real.m) % 60 || 0 }, reason: 'The hour is right but the minutes are mirrored again. Work it out as 11:60 minus the time shown.' },
    ];
    const seen = new Set([fmt(real)]), picked = [];
    for (const w of wrong) if (!seen.has(fmt(w.time))) { seen.add(fmt(w.time)); picked.push(w); }
    if (picked.length < 3) return null;
    const options = optionsFrom(rng, [{ correct: true, text: fmt(real), reason: `11:60 − ${fmt(shown)} = ${fmt(real)}.` }, ...picked.slice(0, 3).map(w => ({ correct: false, text: fmt(w.time), reason: w.reason }))]);
    return {
      kind: 'clock-mirror', seed, answerMode: 'single', shown, real,
      prompt: 'This is a clock seen in a mirror. What is the real time?',
      figures: [{ type: 'clock', h: shown.h, m: shown.m }],
      options, answer: options.find(o => o.correct).id,
      explanation: `The clock in the mirror reads ${fmt(shown)}. Mirror time and real time add up to 12:00, so the real time is 11:60 − ${fmt(shown)} = ${fmt(real)}.`,
      hints: ['Read the time the clock seems to show first.', 'Real time + mirror time = 12:00. Work it out as 11:60 minus the time shown.'],
      solution: [{ text: `The clock appears to show ${fmt(shown)}.` }, { text: 'A mirror flips the face left to right, so each hand is as far before 12 as it really is after 12.' }, { text: `11:60 − ${fmt(shown)} = ${fmt(real)}.` }, { text: `So the answer is ${options.find(o => o.correct).label}.` }],
    };
  });
}

// ---------- image-count ----------
export function imageCount(theta, onBisector) {
  const m = 360 / theta;
  if (m % 2 === 0) return m - 1;
  return onBisector ? m - 1 : m;
}
// Images by following the reflections: mirrors along 0° and θ°, the object at φ° between them.
// Each chain starts in one mirror and alternates; an image is reflected again only while it is not
// behind both mirrors (the region from 180° to 180° + θ). Returns the distinct image angles.
export function imageAngles(theta, phi) {
  const norm = a => ((a % 360) + 360) % 360, dead = a => a >= 180 - 1e-9 && a <= 180 + theta + 1e-9, out = [];
  for (const first of [0, 1]) {
    let a = phi, mirror = first;
    for (let step = 0; step < 50; step++) {
      a = norm(2 * (mirror ? theta : 0) - a);
      if (!out.some(b => Math.abs(b - a) < 1e-6 || Math.abs(Math.abs(b - a) - 360) < 1e-6)) out.push(a);
      if (dead(a)) break;
      mirror = 1 - mirror;
    }
  }
  return out;
}
export function imageCountQuestion(seed) {
  return retry(seed, rng => {
    const theta = pick(rng, [30, 40, 45, 60, 72, 90, 120]), m = 360 / theta, odd = m % 2 === 1;
    const onBisector = odd ? rng() < 0.5 : rng() < 0.3, value = imageCount(theta, onBisector);
    return {
      kind: 'image-count', seed, answerMode: 'numeric', unit: 'images', theta, onBisector,
      prompt: `Two mirrors meet at ${theta}°. A small object is placed between them, ${onBisector ? 'exactly half way between the two mirrors' : 'closer to one mirror than the other'}. How many images of it are formed?`,
      figures: [{ type: 'mirror-angle', theta, onBisector }],
      answer: { value },
      mistakes: [{ value: m, reason: `That is 360 ÷ ${theta}. ${odd ? (onBisector ? 'On the line half way between the mirrors, the last two images fall in the same place: subtract one.' : '') : 'When 360 ÷ θ is even, subtract one: the last two images fall in the same place.'}` }, { value: 180 / theta, reason: 'Use 360 ÷ θ, not 180 ÷ θ.' }, { value: m - 1, reason: 'When 360 ÷ θ is odd and the object is off the middle line, the two last images are separate: do not subtract.' }].filter((x, i, list) => Number.isInteger(x.value) && x.value !== value && x.value > 0 && list.findIndex(o => o.value === x.value) === i),
      explanation: `360 ÷ ${theta} = ${m}, which is ${odd ? 'odd' : 'even'}. ${odd ? (onBisector ? 'On the middle line: subtract one.' : 'Off the middle line: no subtraction.') : 'Even: subtract one.'} So ${value} images.`,
      hints: ['Work out m = 360 ÷ θ.', 'If m is even, there are m − 1 images. If m is odd, it depends on where the object is.'],
      solution: [{ text: `m = 360 ÷ ${theta} = ${m}.` }, { text: odd ? `m is odd. The object is ${onBisector ? 'on' : 'off'} the line half way between the mirrors.` : 'm is even, so the last two images fall on top of each other.' }, { text: `Images = ${odd && !onBisector ? 'm' : 'm − 1'} = ${value}.` }],
    };
  });
}

// ---------- ray-exit and ray-bounces ----------
// A ray moves cell to cell. At '/' (bottom-left to top-right, y down) east turns north, north turns east,
// west turns south, south turns west. At '\' east turns south, south turns east, west turns north, north turns west.
const TURN = { '/': ([dx, dy]) => [-dy, -dx], '\\': ([dx, dy]) => [dy, dx] };
export function traceRay(n, mirrors, entry) {
  let { x, y, d } = entry, bounces = 0;
  const path = [[x, y]], seen = new Set();
  while (x >= 0 && y >= 0 && x < n && y < n) {
    const k = `${x},${y},${d}`;
    if (seen.has(k)) return null;
    seen.add(k);
    const m = mirrors[`${x},${y}`];
    if (m) { d = TURN[m](d); bounces++; }
    x += d[0]; y += d[1];
    path.push([x, y]);
  }
  return { exit: { x, y }, bounces, path };
}
// Edge positions outside the grid, labelled clockwise from the top-left.
export function edgeSpots(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: i, y: -1, d: [0, 1] });
  for (let i = 0; i < n; i++) out.push({ x: n, y: i, d: [-1, 0] });
  for (let i = n - 1; i >= 0; i--) out.push({ x: i, y: n, d: [0, -1] });
  for (let i = n - 1; i >= 0; i--) out.push({ x: -1, y: i, d: [1, 0] });
  return out;
}
export function rayQuestion(seed, kind) {
  return retry(seed, rng => {
    const n = pick(rng, [5, 6]), mirrors = {}, count = 4 + Math.floor(rng() * 3);
    while (Object.keys(mirrors).length < count) mirrors[`${Math.floor(rng() * n)},${Math.floor(rng() * n)}`] = rng() < 0.5 ? '/' : '\\';
    const spots = edgeSpots(n), start = pick(rng, spots), entry = { x: start.x + start.d[0], y: start.y + start.d[1], d: start.d };
    const result = traceRay(n, mirrors, entry);
    if (!result || result.bounces < 3) return null;
    const exitIndex = spots.findIndex(s => s.x === result.exit.x && s.y === result.exit.y);
    if (exitIndex < 0 || spots[exitIndex] === start) return null;
    const label = i => String(i + 1);
    if (kind === 'ray-bounces') {
      return {
        kind, seed, answerMode: 'numeric', unit: 'bounces', n, mirrors, entry,
        prompt: 'A ray of light enters the grid at the arrow. Each slanted line is a two-sided mirror. How many times does the ray bounce before it leaves the grid?',
        figures: [{ type: 'ray-grid', n, mirrors, start, labels: [] }],
        answer: { value: result.bounces },
        mistakes: [{ value: Object.keys(mirrors).length, reason: 'Not every mirror is on the ray\'s path. Follow it cell by cell.' }, { value: result.bounces - 1, reason: 'Count every mirror the ray turns at, including the last one.' }].filter((m, i, list) => m.value !== result.bounces && m.value > 0 && list.findIndex(o => o.value === m.value) === i),
        explanation: `Following the ray cell by cell, it turns at ${result.bounces} mirrors and leaves at the edge.`,
        hints: ['Move one cell at a time in a straight line until you meet a mirror.', 'At a mirror the ray turns a right angle, like a ball off a slanted wall.'],
        solution: [{ text: 'Start at the arrow and move one cell at a time.' }, { text: 'At each mirror turn a right angle: on / a ray going right turns up; on \\ a ray going right turns down.' }, { text: `The ray meets ${result.bounces} mirrors before it leaves.` }],
      };
    }
    // Wrong exits: treat one mirror on the path as the other kind.
    const onPath = result.path.map(([x, y]) => `${x},${y}`).filter(k => mirrors[k]);
    const exits = new Map([[exitIndex, { correct: true, reason: `The ray turns at ${result.bounces} mirrors and leaves at ${label(exitIndex)}.` }]]);
    for (const k of shuffle(rng, onPath)) {
      const swapped = { ...mirrors, [k]: mirrors[k] === '/' ? '\\' : '/' }, r = traceRay(n, swapped, entry);
      if (!r) continue;
      const i = spots.findIndex(s => s.x === r.exit.x && s.y === r.exit.y);
      if (i >= 0 && !exits.has(i)) exits.set(i, { correct: false, reason: 'This is where the ray leaves if one mirror is read the wrong way round. Check the slant of each mirror it meets.' });
    }
    for (const i of shuffle(rng, spots.map((_, i) => i))) { if (exits.size >= 4) break; if (!exits.has(i) && spots[i] !== start) exits.set(i, { correct: false, reason: 'The ray does not reach this edge. Follow it cell by cell.' }); }
    const options = optionsFrom(rng, [...exits.entries()].slice(0, 4).map(([i, o]) => ({ ...o, text: `Exit ${label(i)}`, spot: i })));
    return {
      kind: 'ray-exit', seed, answerMode: 'single', n, mirrors, entry,
      prompt: 'A ray of light enters the grid at the arrow. Each slanted line is a two-sided mirror. At which numbered edge does it leave?',
      figures: [{ type: 'ray-grid', n, mirrors, start, labels: options.map(o => ({ spot: spots[o.spot], text: label(o.spot) })) }],
      options, answer: options.find(o => o.correct).id,
      explanation: `The ray bounces ${result.bounces} times and leaves at ${label(exitIndex)}.`,
      hints: ['Move one cell at a time in a straight line until you meet a mirror.', 'On / a ray going right turns up; on \\ a ray going right turns down.'],
      solution: [{ text: 'Start at the arrow and move one cell at a time.' }, { text: 'At each mirror the ray turns a right angle, by the slant of the mirror.' }, { text: `After ${result.bounces} bounces it leaves at ${label(exitIndex)}.` }, { text: `So the answer is ${options.find(o => o.correct).label}.` }],
    };
  });
}

export function mirrorExamQuestion(seed, kind, level) {
  switch (kind) {
    case 'mirror-image': return anySideQuestion(seed);
    case 'diagonal-mirror': return diagonalQuestion(seed);
    case 'reflection-chain': return chainQuestion(seed);
    case 'symmetric-words': return wordsQuestion(seed);
    case 'clock-mirror': return clockQuestion(seed);
    case 'image-count': return imageCountQuestion(seed);
    case 'ray-exit': case 'ray-bounces': return rayQuestion(seed, kind);
    default: throw new Error('Unknown mirror kind ' + kind + ' at level ' + level);
  }
}
