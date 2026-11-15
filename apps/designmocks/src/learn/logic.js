// Logical reasoning for three programmes: codes and number patterns,
// arrangements and puzzles, and directions, clocks and calendars.
// Specification: docs/learn/topics/logic.md.
//
// Every puzzle is built from a hidden solution, and the clues are checked by
// a solver: a seating question is kept only if exactly one arrangement fits
// every clue; a number figure is kept only if no other rule in the list fits
// the complete figures with a different answer.
import { pick, seededRandom, shuffle } from './random.js';

function retry(seed, build) {
  for (let i = 0; i < 400; i++) { const q = build(seededRandom(seed * 1427 + i * 7919)); if (q) return q; }
  throw new Error('No logic question for seed ' + seed);
}
const letterOptions = (rng, truth, wrong) => {
  const seen = new Set([truth.text]), list = [{ ...truth, correct: true }];
  for (const w of wrong) if (!seen.has(w.text) && list.length < 4) { seen.add(w.text); list.push({ ...w, correct: false }); }
  if (list.length < 4) return null;
  const options = shuffle(rng, list).map((o, i) => ({ ...o, id: 'ABCD'[i], label: 'ABCD'[i] }));
  return { options, answer: options.find(o => o.correct).id };
};
const numericMistakes = (value, list) => { const seen = new Set([value]); return list.filter(m => Number.isFinite(m.value) && !seen.has(m.value) && seen.add(m.value)); };
const permutations = list => (list.length <= 1 ? [list] : list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map(p => [x, ...p])));

// =====================================================================
// Codes and number patterns
// =====================================================================
const isPrime = n => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
// Series makers: (rng) → { terms, rule } with the full list of terms.
const SERIES = {
  1: [
    rng => { const a = 2 + Math.floor(rng() * 20), d = pick(rng, [3, 4, 5, 6, 7, 9, 11]); return { terms: Array.from({ length: 6 }, (_, i) => a + i * d), rule: `add ${d} each time` }; },
    rng => { const a = pick(rng, [2, 3, 5]), r = pick(rng, [2, 3]); return { terms: Array.from({ length: 6 }, (_, i) => a * r ** i), rule: `multiply by ${r} each time` }; },
    rng => { const a = 50 + Math.floor(rng() * 50), d = pick(rng, [3, 4, 6, 7]); return { terms: Array.from({ length: 6 }, (_, i) => a - i * d), rule: `take away ${d} each time` }; },
  ],
  3: [
    rng => { const start = 10 + Math.floor(rng() * 80), primes = []; for (let n = start; primes.length < 8; n++) if (isPrime(n)) primes.push(n); return { terms: primes, rule: 'the prime numbers in order' }; },
    rng => { const a = 1 + Math.floor(rng() * 5), c = pick(rng, [-1, 1, 2]); return { terms: Array.from({ length: 7 }, (_, i) => (a + i) ** 2 + c), rule: `square numbers ${c > 0 ? 'plus' : 'minus'} ${Math.abs(c)}` }; },
    rng => { const a = 2 + Math.floor(rng() * 6), d0 = pick(rng, [1, 2, 3]), dd = pick(rng, [1, 2]); const t = [a]; for (let i = 1; i < 7; i++) t.push(t[i - 1] + d0 + (i - 1) * dd); return { terms: t, rule: `the gap grows by ${dd} each time` }; },
    rng => { const a = 2 + Math.floor(rng() * 9), b = 30 + Math.floor(rng() * 20), d = pick(rng, [2, 3, 5]), e = pick(rng, [3, 4, 7]); return { terms: Array.from({ length: 8 }, (_, i) => (i % 2 ? b - Math.floor(i / 2) * e : a + (i / 2) * d)), rule: `two series take turns: one adds ${d}, the other takes away ${e}` }; },
    rng => { const a = 1 + Math.floor(rng() * 4), m = pick(rng, [2, 3]), p = pick(rng, [1, 2]); const t = [a]; for (let i = 1; i < 6; i++) t.push(t[i - 1] * m + p); return { terms: t, rule: `multiply by ${m}, then add ${p}` }; },
  ],
};
export function seriesQuestion(seed, level) {
  return retry(seed, rng => {
    const { terms, rule } = pick(rng, SERIES[level === 1 ? 1 : 3])(rng);
    if (terms.some(t => t <= 0 || t > 9999)) return null;
    const gap = level === 1 ? terms.length - 1 : 2 + Math.floor(rng() * (terms.length - 3)), value = terms[gap];
    const shown = terms.map((t, i) => (i === gap ? '?' : t)).join(', ');
    const diffs = terms.slice(1).map((t, i) => t - terms[i]);
    const linear = gap > 0 ? terms[gap - 1] + diffs[0] : terms[1] - diffs[0];
    if (level === 1) {
      const made = letterOptions(rng, { text: String(value), reason: `The rule: ${rule}.` }, [
        { text: String(terms[gap - 1] + diffs[gap - 2] + 1), reason: 'The step is the same each time here; check it again.' },
        { text: String(terms[gap - 1] * 2), reason: 'The terms do not double here.' },
        { text: String(value + diffs[0]), reason: 'One step too many.' },
        { text: String(value - 1), reason: 'Close, but the rule gives a different number.' },
        { text: String(value + 2), reason: 'Close, but the rule gives a different number.' },
      ]);
      if (!made) return null;
      return { kind: 'number-series', seed, answerMode: 'single', figures: [], ...made, prompt: `Which number comes next? ${shown}`, explanation: `The rule is to ${rule}, so the next number is ${value}.` };
    }
    return {
      kind: 'series-rule', seed, answerMode: 'numeric', unit: '', figures: [],
      answer: { value },
      mistakes: numericMistakes(value, [{ value: linear, reason: 'The gaps between the numbers are not all equal. Write them down and look at them as a series of their own.' }, { value: terms[gap - 1] + 1, reason: 'Look at the gaps between the numbers first.' }]),
      prompt: `Which number replaces the question mark? ${shown}`,
      explanation: `The series is ${rule}. The missing number is ${value}.`,
      hints: ['Write the gaps between neighbouring numbers. Are they equal, growing, or alternating?', 'If the gaps are odd and uneven, test for primes or squares. If every other number fits, look for two series taking turns.'],
      solution: [{ text: `Gaps: ${diffs.map((d, i) => (i === gap - 1 || i === gap ? '?' : d)).join(', ')}.` }, { text: `The pattern: ${rule}.` }, { text: `So the missing number is ${value}.` }],
    };
  });
}
// One number in the series has been changed: which one?
export function seriesOddQuestion(seed) {
  return retry(seed, rng => {
    const { terms, rule } = pick(rng, SERIES[3])(rng);
    if (terms.some(t => t <= 0 || t > 9999)) return null;
    const at = 1 + Math.floor(rng() * (terms.length - 2)), wrongValue = terms[at] + pick(rng, [-2, -1, 1, 2, 3]);
    const shown = terms.map((t, i) => (i === at ? wrongValue : t));
    // The changed series must not still fit the same rule, and no other single change may also explain it.
    if (shown.filter((t, i) => t !== terms[i]).length !== 1) return null;
    const others = shuffle(rng, shown.map((t, i) => i).filter(i => i !== at)).slice(0, 3);
    const options = shuffle(rng, [at, ...others]).map((i, k) => ({ id: 'ABCD'[k], label: 'ABCD'[k], text: String(shown[i]), correct: i === at, reason: i === at ? `It should be ${terms[at]}: the series is ${rule}.` : `${shown[i]} fits the rule: ${rule}.` }));
    if (new Set(options.map(o => o.text)).size < 4) return null;
    return {
      kind: 'series-odd', seed, answerMode: 'single', figures: [], options, answer: options.find(o => o.correct).id,
      prompt: `One number in this series does not fit. Which one? ${shown.join(', ')}`,
      explanation: `The series is ${rule}. ${wrongValue} should be ${terms[at]}.`,
      hints: ['Find the rule from the numbers that agree with each other.', 'Write the gaps. One wrong number spoils two gaps next to each other.'],
      solution: [{ text: `Gaps: ${shown.slice(1).map((t, i) => t - shown[i]).join(', ')}.` }, { text: `Two neighbouring gaps are off, both next to ${wrongValue}. The rule: ${rule}.` }, { text: `${wrongValue} should be ${terms[at]}.` }],
    };
  });
}
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const WORDS3 = ['CAT', 'DOG', 'SUN', 'PEN', 'MAP', 'BOX', 'CUP', 'HAT', 'JAR', 'KEY', 'LOG', 'NET', 'OWL', 'RUG', 'TOY', 'VAN', 'WEB', 'YAK', 'ZIP', 'FAN', 'GEM', 'INK', 'LID', 'MUG'];
const WORDS5 = ['CHAIR', 'TABLE', 'PLANT', 'BRUSH', 'CLOUD', 'DREAM', 'FLAME', 'GRAPE', 'HOUSE', 'LIGHT', 'MOUSE', 'PAINT', 'RIVER', 'SHAPE', 'STONE', 'TRAIN', 'WATER', 'BREAD', 'CHALK', 'SPOON'];
export function shiftCode(word, k) { return [...word].map(c => ALPHA[(ALPHA.indexOf(c) + k + 26) % 26]).join(''); }
export function letterShiftQuestion(seed) {
  return retry(seed, rng => {
    const k = pick(rng, [1, 2, 3, -1, -2, 4]), [w1, w2] = shuffle(rng, WORDS5).slice(0, 2), reverse = rng() < 0.3;
    const code = w => { const c = shiftCode(w, k); return reverse ? [...c].reverse().join('') : c; };
    const made = letterOptions(rng, { text: code(w2), reason: `Each letter moves ${Math.abs(k)} ${k > 0 ? 'forward' : 'back'} in the alphabet${reverse ? ', and the code is written backwards' : ''}.` }, [
      { text: shiftCode(w2, -k), reason: 'The letters are moved the wrong way.' },
      { text: reverse ? shiftCode(w2, k) : [...shiftCode(w2, k)].reverse().join(''), reason: reverse ? 'The code is also written backwards; check the first and last letters.' : 'The code keeps the order of the letters.' },
      { text: shiftCode(w2, k + (k > 0 ? 1 : -1)), reason: 'The letters are moved one place too far.' },
      { text: code(w2).split('').map((c, i) => (i === 2 ? ALPHA[(ALPHA.indexOf(c) + 1) % 26] : c)).join(''), reason: 'One letter is wrong. Check each letter in turn.' },
    ]);
    if (!made) return null;
    return { kind: 'letter-shift', seed, answerMode: 'single', figures: [], ...made, prompt: `In a code, ${w1} is written as ${code(w1)}. How is ${w2} written in that code?`, explanation: `Compare ${w1} and ${code(w1)} letter by letter: each letter moves ${Math.abs(k)} place${Math.abs(k) === 1 ? '' : 's'} ${k > 0 ? 'forward' : 'back'}${reverse ? ', and the result is written backwards' : ''}. ${w2} becomes ${code(w2)}.` };
  });
}
// Words written as symbol codes: each letter has its own symbol, and words are coded in a fixed order.
const SYMBOLS = ['▲', '●', '■', '◆', '★', '✚', '▼', '◐'];
export function wordCodeQuestion(seed) {
  return retry(seed, rng => {
    const letters = shuffle(rng, ['T', 'E', 'A', 'R', 'S', 'N', 'O', 'L', 'P', 'D']).slice(0, 4), symbols = shuffle(rng, SYMBOLS).slice(0, 4), map = Object.fromEntries(letters.map((l, i) => [l, symbols[i]]));
    const reverse = rng() < 0.5, encode = w => { const s = [...w].map(c => map[c]); return (reverse ? s.reverse() : s).join(''); };
    const word = n => Array.from({ length: n }, () => pick(rng, letters)).join('');
    const examples = [word(3), word(3), word(4)], ask = word(4);
    // Every letter of the asked word must appear in an example, and the examples must fix every symbol.
    if (![...ask].every(c => examples.join('').includes(c)) || new Set(examples.join('')).size < 4) return null;
    if (examples.some(w => w === [...w].reverse().join(''))) return null;
    const swapTwo = s => { const a = [...s]; [a[0], a[1]] = [a[1], a[0]]; return a.join(''); };
    const made = letterOptions(rng, { text: encode(ask), reason: `Each letter has its own symbol${reverse ? ', and the code is written in reverse order' : ', in the same order as the letters'}.` }, [
      { text: reverse ? [...ask].map(c => map[c]).join('') : [...ask].map(c => map[c]).reverse().join(''), reason: reverse ? 'The code runs backwards: compare the first letter of a word with the last symbol of its code.' : 'The code keeps the order of the letters.' },
      { text: swapTwo(encode(ask)), reason: 'Two symbols have swapped places.' },
      { text: encode(ask).replace(map[ask[0]], map[letters.find(l => l !== ask[0])]), reason: 'One letter has the wrong symbol. Find each letter in a word whose code you know.' },
      { text: encode([...ask].reverse().join('')), reason: 'That is the code for the word spelled backwards.' },
    ]);
    if (!made) return null;
    return {
      kind: 'word-code', seed, answerMode: 'single', figures: [{ type: 'table', head: ['Word', 'Code'], rows: examples.map(w => [w, encode(w)]) }], ...made,
      prompt: `In a code language, each letter is replaced by a symbol, as in the table. What is the code for ${ask}?`,
      explanation: `${letters.map(l => `${l} = ${map[l]}`).join(', ')}${reverse ? ', and the symbols are written in reverse order' : ''}. So ${ask} is ${encode(ask)}.`,
      hints: ['Find a letter that appears in two words. The symbol they share is its code.', 'Check whether the code runs in the same order as the word, or backwards.'],
      solution: [{ text: `Matching letters and symbols: ${letters.map(l => `${l} = ${map[l]}`).join(', ')}.` }, { text: reverse ? 'The first letter of each word matches the last symbol: the code runs backwards.' : 'The symbols run in the same order as the letters.' }, { text: `${ask} → ${encode(ask)}.` }, { text: `So the answer is ${made.options.find(o => o.correct).label}.` }],
    };
  });
}
// Number figures: four numbers around a centre, the centre made from them by one rule.
export const FIGURE_RULES = {
  'sum': { text: 'the sum of the four outer numbers', f: ([a, b, c, d]) => a + b + c + d },
  'cross-diff': { text: '(top + bottom) − (left + right)', f: ([a, b, c, d]) => a + c - (b + d) },
  'products': { text: 'top × bottom − left × right', f: ([a, b, c, d]) => a * c - b * d },
  'pairs': { text: 'top × bottom + left × right', f: ([a, b, c, d]) => a * c + b * d },
  'diff-products': { text: '(top − bottom) × (left − right)', f: ([a, b, c, d]) => (a - c) * (b - d) },
  'half-sum': { text: 'half the sum of the four outer numbers', f: ([a, b, c, d]) => (a + b + c + d) / 2 },
};
export function figureNumberQuestion(seed) {
  return retry(seed, rng => {
    const name = pick(rng, Object.keys(FIGURE_RULES)), rule = FIGURE_RULES[name].f;
    const figs = Array.from({ length: 4 }, () => { const o = Array.from({ length: 4 }, () => 2 + Math.floor(rng() * 14)); return { outer: o, centre: rule(o) }; });
    if (figs.some(f => !Number.isInteger(f.centre) || f.centre <= 0 || f.centre > 300)) return null;
    // No other rule may fit the three complete figures.
    const others = Object.keys(FIGURE_RULES).filter(k => k !== name && figs.slice(0, 3).every(f => FIGURE_RULES[k].f(f.outer) === f.centre));
    if (others.length) return null;
    const value = figs[3].centre;
    return {
      kind: 'figure-number', seed, answerMode: 'numeric', unit: '',
      figures: figs.map((f, i) => ({ type: 'number-diamond', outer: f.outer, centre: i === 3 ? '?' : f.centre })),
      answer: { value },
      mistakes: numericMistakes(value, Object.keys(FIGURE_RULES).filter(k => k !== name).map(k => ({ value: FIGURE_RULES[k].f(figs[3].outer), reason: `That uses ${FIGURE_RULES[k].text}, which does not fit the other figures.` })).filter(m => Number.isInteger(m.value) && m.value > 0)),
      prompt: 'In each figure the middle number is made from the four numbers around it by the same rule. Which number replaces the question mark?',
      explanation: `The middle number is ${FIGURE_RULES[name].text}. In the last figure that is ${value}.`,
      hints: ['Try the simplest rule first: add the four numbers. Then try pairs: top with bottom, left with right.', 'A rule must work for every complete figure, not just one.'],
      solution: [{ text: `Test a rule on the first figure: ${FIGURE_RULES[name].text} gives ${figs[0].centre}.` }, { text: `It also works for the second (${figs[1].centre}) and third (${figs[2].centre}).` }, { text: `Last figure: ${figs[3].outer.join(', ')} → ${value}.` }],
    };
  });
}

// =====================================================================
// Arrangements and puzzles
// =====================================================================
const NAMES = ['Asha', 'Bilal', 'Charu', 'Dev', 'Esha', 'Farid', 'Gita'];
export function rankingQuestion(seed) {
  return retry(seed, rng => {
    const people = shuffle(rng, NAMES.slice(0, 5)), order = [...people]; // order[0] is the tallest
    const facts = [];
    for (let i = 0; i < order.length - 1; i++) facts.push(rng() < 0.5 ? `${order[i]} is taller than ${order[i + 1]}` : `${order[i + 1]} is shorter than ${order[i]}`);
    const ask = pick(rng, [0, 1, 2, 4]), words = ['the tallest', 'second tallest', 'in the middle', 'second shortest', 'the shortest'];
    const made = letterOptions(rng, { text: order[ask], reason: 'Line them up from the facts: each fact links two neighbours.' }, order.filter((_, i) => i !== ask).map(n => ({ text: n, reason: `Put the five in a line from the facts; ${n} is not ${words[ask]}.` })));
    if (!made) return null;
    return { kind: 'ranking', seed, answerMode: 'single', figures: [], ...made, prompt: `${shuffle(rng, facts).join('. ')}. Who is ${words[ask]}?`, explanation: `From tallest to shortest: ${order.join(', ')}.` };
  });
}
// Seating clue types, each checkable on an arrangement (array of names, left to right, or round a table).
const CLUES = {
  end: (a, x) => a[0] === x || a[a.length - 1] === x,
  notEnd: (a, x) => a[0] !== x && a[a.length - 1] !== x,
  leftOf: (a, x, y) => a.indexOf(x) === a.indexOf(y) - 1,
  between: (a, x, y, z) => Math.abs(a.indexOf(y) - a.indexOf(x)) === 1 && Math.abs(a.indexOf(z) - a.indexOf(x)) === 1,
  notNext: (a, x, y) => Math.abs(a.indexOf(x) - a.indexOf(y)) !== 1,
  gapOne: (a, x, y) => Math.abs(a.indexOf(x) - a.indexOf(y)) === 2,
};
export const CLUE_CHECK = CLUES;
const clueText = { end: (x) => `${x} sits at one end`, notEnd: (x) => `${x} does not sit at either end`, leftOf: (x, y) => `${x} sits immediately to the left of ${y}`, between: (x, y, z) => `${x} sits between ${y} and ${z}`, notNext: (x, y) => `${x} does not sit next to ${y}`, gapOne: (x, y) => `exactly one person sits between ${x} and ${y}` };
export function solveRow(names, clues) { return permutations(names).filter(a => clues.every(c => CLUES[c.type](a, ...c.who))); }
export function rowSeatingQuestion(seed) {
  return retry(seed, rng => {
    const n = 5, names = NAMES.slice(0, n), truth = shuffle(rng, names), clues = [];
    const make = () => {
      const t = pick(rng, Object.keys(CLUES)), i = Math.floor(rng() * n);
      if (t === 'end') return { type: t, who: [truth[pick(rng, [0, n - 1])]] };
      if (t === 'notEnd') return { type: t, who: [truth[1 + Math.floor(rng() * (n - 2))]] };
      if (t === 'leftOf') return i < n - 1 ? { type: t, who: [truth[i], truth[i + 1]] } : null;
      if (t === 'between') return i > 0 && i < n - 1 ? { type: t, who: [truth[i], truth[i - 1], truth[i + 1]] } : null;
      if (t === 'gapOne') return i < n - 2 ? { type: t, who: [truth[i], truth[i + 2]] } : null;
      const j = Math.floor(rng() * n); return Math.abs(i - j) > 1 ? { type: t, who: [truth[i], truth[j]] } : null;
    };
    for (let guard = 0; guard < 40 && solveRow(names, clues).length > 1; guard++) { const c = make(); if (c && !clues.some(d => JSON.stringify(d) === JSON.stringify(c))) clues.push(c); }
    if (solveRow(names, clues).length !== 1) return null;
    // Drop any clue the others make unnecessary, so every clue is needed.
    for (let i = clues.length - 1; i >= 0; i--) { const rest = clues.filter((_, j) => j !== i); if (solveRow(names, rest).length === 1) clues.splice(i, 1); }
    if (clues.length < 3 || clues.length > 6) return null;
    const ask = pick(rng, [{ q: 'Who sits in the middle?', i: 2 }, { q: 'Who sits at the left end?', i: 0 }, { q: 'Who sits second from the right?', i: n - 2 }]);
    const made = letterOptions(rng, { text: truth[ask.i], reason: `The only seating that fits every clue is ${truth.join(', ')}.` }, truth.filter((_, i) => i !== ask.i).map(x => ({ text: x, reason: `In the only seating that fits, ${x} is not in that seat.` })));
    if (!made) return null;
    return { kind: 'row-seating', seed, answerMode: 'single', figures: [], clues, ...made, prompt: `${names.join(', ')} sit in a row, facing you. ${clues.map(c => clueText[c.type](...c.who)).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join('. ')}. ${ask.q}`, explanation: `Left to right: ${truth.join(', ')}.` };
  });
}
// Round a table, all facing the centre. Arrangements are equal up to turning, so fix the first person in seat 0.
const roundOf = (a, x, k) => a[(a.indexOf(x) + k + a.length) % a.length];
export function solveCircle(names, clues) {
  const [first, ...rest] = names;
  return permutations(rest).map(p => [first, ...p]).filter(a => clues.every(c => (c.type === 'right' ? roundOf(a, c.who[1], -c.k) === c.who[0] : c.type === 'opposite' ? roundOf(a, c.who[1], a.length / 2) === c.who[0] : c.type === 'notNext' ? roundOf(a, c.who[0], 1) !== c.who[1] && roundOf(a, c.who[0], -1) !== c.who[1] : true)));
}
// Seats are numbered in the direction of each person's left: facing the centre, that is clockwise seen from above. Seat i's left neighbour is seat i + 1.
export function circleSeatingQuestion(seed) {
  return retry(seed, rng => {
    const names = NAMES.slice(0, 6), truth = [names[0], ...shuffle(rng, names.slice(1))], clues = [];
    const make = () => {
      const t = pick(rng, ['left', 'left', 'right', 'opposite', 'notNext']), i = Math.floor(rng() * 6), k = pick(rng, [1, 2]);
      if (t === 'left') return { type: 'right', who: [truth[(i + k) % 6], truth[i]], k: -k, text: `${truth[(i + k) % 6]} sits ${k === 1 ? 'immediately' : 'second'} to the left of ${truth[i]}` };
      if (t === 'right') return { type: 'right', who: [truth[(i - k + 6) % 6], truth[i]], k, text: `${truth[(i - k + 6) % 6]} sits ${k === 1 ? 'immediately' : 'second'} to the right of ${truth[i]}` };
      if (t === 'opposite') return { type: 'opposite', who: [truth[(i + 3) % 6], truth[i]], text: `${truth[(i + 3) % 6]} sits opposite ${truth[i]}` };
      const j = (i + 2 + Math.floor(rng() * 3)) % 6; return { type: 'notNext', who: [truth[i], truth[j]], text: `${truth[i]} does not sit next to ${truth[j]}` };
    };
    const same = (c, d) => c.type === d.type && (c.type === 'opposite' || c.type === 'notNext' ? [...c.who].sort().join() === [...d.who].sort().join() : c.text === d.text);
    for (let guard = 0; guard < 40 && solveCircle(names, clues).length > 1; guard++) { const c = make(); if (!clues.some(d => same(c, d))) clues.push(c); }
    if (solveCircle(names, clues).length !== 1) return null;
    for (let i = clues.length - 1; i >= 0; i--) { const rest = clues.filter((_, j) => j !== i); if (solveCircle(names, rest).length === 1) clues.splice(i, 1); }
    if (clues.length < 3 || clues.length > 6) return null;
    const target = pick(rng, names), askLeft = rng() < 0.5, answer = askLeft ? roundOf(truth, target, 1) : roundOf(truth, target, 3);
    const made = letterOptions(rng, { text: answer, reason: 'This is the only seating that fits every clue.' }, names.filter(n => n !== answer && n !== target).map(n => ({ text: n, reason: `In the only seating that fits, ${n} is not in that seat.` })));
    if (!made) return null;
    return { kind: 'circle-seating', seed, answerMode: 'single', figures: [], clues, ...made, prompt: `${names.join(', ')} sit round a table, all facing the centre. ${clues.map(c => c.text.charAt(0).toUpperCase() + c.text.slice(1)).join('. ')}. Who sits ${askLeft ? `immediately to the left of ${target}` : `opposite ${target}`}?`, explanation: `Going round to the left from ${truth[0]}: ${truth.join(', ')}.`, hints: ['Place one person first, then the clues that mention them.', 'Facing the centre, your left is the next seat clockwise, seen from above.'], solution: [{ text: `Start with ${truth[0]} and place the clues that mention them.` }, { text: `Round to the left: ${truth.join(', ')}.` }, { text: `${askLeft ? `Left of ${target}` : `Opposite ${target}`}: ${answer}.` }, { text: `So the answer is ${made.options.find(o => o.correct).label}.` }] };
  });
}
// Symbol sums that are counting in base 2 or 3 with symbols for digits.
export function toBase(n, b) { if (n === 0) return [0]; const out = []; while (n > 0) { out.unshift(n % b); n = Math.floor(n / b); } return out; }
export function symbolSumQuestion(seed) {
  return retry(seed, rng => {
    const base = pick(rng, [2, 2, 3]), syms = shuffle(rng, ['◆', '▲', '●', '■']).slice(0, base), write = n => toBase(n, base).map(d => syms[d]).join('');
    const pairs = [], used = new Set();
    while (pairs.length < 5) { const a = Math.floor(rng() * (base === 2 ? 6 : 9)), b = Math.floor(rng() * (base === 2 ? 6 : 9)), k = `${a}+${b}`; if (!used.has(k)) { used.add(k); pairs.push([a, b]); } }
    // Every symbol must appear, and at least one sum must carry.
    if (!pairs.some(([a, b]) => toBase(a + b, base).length > Math.max(toBase(a, base).length, toBase(b, base).length))) return null;
    const [x, y] = [3 + Math.floor(rng() * 5), 2 + Math.floor(rng() * 5)], value = write(x + y);
    if (pairs.some(([a, b]) => a + b === x + y)) return null;
    const made = letterOptions(rng, { text: value, reason: `The symbols are the digits of base ${base}: ${syms.map((s, d) => `${s} = ${d}`).join(', ')}.` }, [
      { text: write(x) + write(y), reason: 'Symbols are not just joined: they add, with carrying.' },
      { text: [...value].reverse().join(''), reason: 'The digits are in the wrong order.' },
      { text: write(x + y + 1), reason: 'One too many: check the carry.' },
      { text: write(Math.abs(x - y) || 1), reason: 'That is a difference, not a sum.' },
      { text: write(x + y - 1), reason: 'One too few: check the carry.' },
    ]);
    if (!made) return null;
    return {
      kind: 'symbol-sum', seed, answerMode: 'single', figures: [], ...made,
      prompt: `In these sums each symbol stands for something. ${pairs.map(([a, b]) => `${write(a)} + ${write(b)} = ${write(a + b)}`).join('; ')}. What is ${write(x)} + ${write(y)}?`,
      explanation: `The symbols count in base ${base}: ${syms.map((s, d) => `${s} = ${d}`).join(', ')}. ${write(x)} is ${x} and ${write(y)} is ${y}; ${x + y} is written ${value}.`,
      hints: ['Find the sum where adding the same symbol to itself makes a longer answer. That is a carry.', `Try reading the symbols as digits of a small number base.`],
      solution: [{ text: `${syms[0]} added to anything changes nothing, so ${syms[0]} is 0.` }, { text: `${syms[1]} + ${syms[1]} gives a two-symbol answer: the symbols count in base ${base}.` }, { text: `${write(x)} = ${x}, ${write(y)} = ${y}; the sum ${x + y} is ${value}.` }, { text: `So the answer is ${made.options.find(o => o.correct).label}.` }],
    };
  });
}
// A row of symbols changed by rules applied in order.
const RULES = {
  swap: (s, i, j) => { const a = [...s]; [a[i], a[j]] = [a[j], a[i]]; return a; },
  reverse: s => [...s].reverse(),
  replace: (s, from, to) => s.map(c => (c === from ? to : c)),
  rotate: s => [...s.slice(1), s[0]],
};
const ruleText = r => (r.type === 'swap' ? `Swap the ${['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'][r.args[0]]} and ${['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'][r.args[1]]} symbols` : r.type === 'reverse' ? 'Reverse the whole row' : r.type === 'replace' ? `Replace every ${r.args[0]} with ${r.args[1]}` : 'Move the first symbol to the end');
export const applyRules = (s, rules) => rules.reduce((acc, r) => RULES[r.type](acc, ...r.args), s);
export function ruleSequenceQuestion(seed) {
  return retry(seed, rng => {
    const syms = shuffle(rng, ['▲', '●', '■', '◆', '★', '✚']), row = Array.from({ length: 6 }, () => pick(rng, syms.slice(0, 4)));
    const rules = Array.from({ length: 4 }, () => { const t = pick(rng, ['swap', 'swap', 'reverse', 'replace', 'rotate']); if (t === 'swap') { const [i, j] = shuffle(rng, [0, 1, 2, 3, 4, 5]).slice(0, 2).sort(); return { type: t, args: [i, j] }; } if (t === 'replace') return { type: t, args: [pick(rng, row), pick(rng, syms.slice(4))] }; return { type: t, args: [] }; });
    const truth = applyRules(row, rules).join('');
    const wrong = [
      { text: applyRules(row, rules.slice(0, -1)).join(''), reason: 'The last rule has been left out.' },
      { text: applyRules(row, [...rules].reverse()).join(''), reason: 'The rules have been applied in the wrong order.' },
      ...rules.map((r, i) => ({ text: applyRules(row, rules.filter((_, j) => j !== i)).join(''), reason: `Rule ${i + 1} has been skipped.` })),
    ];
    const made = letterOptions(rng, { text: truth, reason: 'Each rule is applied in turn to the row left by the one before.' }, wrong);
    if (!made) return null;
    return {
      kind: 'rule-sequence', seed, answerMode: 'single', figures: [{ type: 'table', head: ['Rule', 'What it does'], rows: rules.map((r, i) => [String(i + 1), ruleText(r)]) }], ...made,
      prompt: `Start with the row ${row.join('')} and apply the rules in the table in order, from 1 to ${rules.length}. Which row do you end with?`,
      explanation: `Step by step: ${rules.map((r, i) => applyRules(row, rules.slice(0, i + 1)).join('')).join(' → ')}.`,
      hints: ['Write the row again after every rule. Never do two rules in your head at once.', 'Number the positions 1 to 6 above the row before swapping.'],
      solution: [{ text: `Start: ${row.join('')}.` }, ...rules.map((r, i) => ({ text: `${ruleText(r)}: ${applyRules(row, rules.slice(0, i + 1)).join('')}.` })), { text: `So the answer is ${made.options.find(o => o.correct).label}.` }],
    };
  });
}
export function handshakeQuestion(seed) {
  return retry(seed, rng => {
    const men = 3 + Math.floor(rng() * 8), women = 3 + Math.floor(rng() * 8), mode = pick(rng, ['all', 'cross', 'same']);
    const total = mode === 'all' ? ((men + women) * (men + women - 1)) / 2 : mode === 'cross' ? men * women : (men * (men - 1)) / 2 + (women * (women - 1)) / 2;
    if (mode === 'all' && rng() < 0.5) {
      const n = men + women;
      return { kind: 'handshakes', seed, answerMode: 'numeric', unit: 'people', figures: [], answer: { value: n }, mistakes: numericMistakes(n, [{ value: Math.round(Math.sqrt(2 * total)), reason: 'Close: the handshakes are n(n − 1) ÷ 2, not n² ÷ 2.' }, { value: Math.round(total / 2), reason: 'Each handshake needs two people, but each person makes many handshakes.' }]), prompt: `At a meeting, everyone shakes hands with everyone else exactly once. There are ${total} handshakes in all. How many people are at the meeting?`, explanation: `n people make n(n − 1) ÷ 2 handshakes. ${n} × ${n - 1} ÷ 2 = ${total}.`, hints: ['Each person shakes hands with everyone except themselves.', 'Count n(n − 1), then halve it: each handshake was counted twice.'], solution: [{ text: 'With n people: n(n − 1) ÷ 2 handshakes.' }, { text: `n(n − 1) = ${2 * total}.` }, { text: `${n} × ${n - 1} = ${2 * total}, so n = ${n}.` }] };
    }
    const value = mode === 'cross' ? women : women;
    const rule = mode === 'cross' ? 'each man shakes hands with each woman once, and nobody else' : mode === 'same' ? 'each man shakes hands with every other man, and each woman with every other woman, once each' : 'everyone shakes hands with everyone else once';
    const others = [];
    for (let w = 1; w <= 30; w++) { const t = mode === 'all' ? ((men + w) * (men + w - 1)) / 2 : mode === 'cross' ? men * w : (men * (men - 1)) / 2 + (w * (w - 1)) / 2; if (t === total) others.push(w); }
    if (others.length !== 1) return null;
    return {
      kind: 'handshakes', seed, answerMode: 'numeric', unit: 'women', figures: [], answer: { value },
      mistakes: numericMistakes(value, [{ value: total - men, reason: 'Handshakes are pairs: multiply or use n(n − 1) ÷ 2, do not subtract.' }, { value: Math.round(total / men), reason: 'That treats every handshake as one man with one woman. Read who shakes hands with whom.' }]),
      prompt: `A group has ${men} men and some women. At a party, ${rule}. There are ${total} handshakes in all. How many women are there?`,
      explanation: mode === 'cross' ? `${men} × w = ${total}, so w = ${value}.` : mode === 'same' ? `Men: ${men} × ${men - 1} ÷ 2 = ${(men * (men - 1)) / 2}. Women: ${total - (men * (men - 1)) / 2} handshakes = w(w − 1) ÷ 2, so w = ${value}.` : `(${men} + w)(${men} + w − 1) ÷ 2 = ${total}, so ${men + value} people and ${value} women.`,
      hints: ['How many handshakes does each kind of pair make?', 'A group of n shaking hands with each other makes n(n − 1) ÷ 2 handshakes.'],
      solution: [{ text: `Rule: ${rule}.` }, { text: mode === 'cross' ? `Handshakes = ${men} × women.` : mode === 'same' ? `Handshakes = ${men}·${men - 1}/2 + w(w − 1)/2.` : `Handshakes = n(n − 1)/2 with n = ${men} + w.` }, { text: `Solving gives ${value} women.` }],
    };
  });
}

// =====================================================================
// Directions, clocks and calendars
// =====================================================================
const DIRS = ['north', 'east', 'south', 'west'], VEC = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] };
export function walk(startDir, legs) {
  let d = DIRS.indexOf(startDir), x = 0, y = 0;
  legs.forEach((leg, i) => { if (i > 0) d = (d + (leg.turn === 'right' ? 1 : 3)) % 4; x += VEC[DIRS[d]][0] * leg.len; y += VEC[DIRS[d]][1] * leg.len; });
  return { x, y, facing: DIRS[d] };
}
const compass = (x, y) => (x === 0 && y === 0 ? 'at the start' : `${y > 0 ? 'north' : y < 0 ? 'south' : ''}${y !== 0 && x !== 0 ? '-' : ''}${x > 0 ? 'east' : x < 0 ? 'west' : ''}`);
export function directionQuestion(seed, level) {
  return retry(seed, rng => {
    const start = pick(rng, DIRS), legs = Array.from({ length: level === 1 ? 3 : 4 }, (_, i) => ({ len: pick(rng, [2, 3, 4, 5, 6, 8, 10]), turn: i ? pick(rng, ['left', 'right']) : null }));
    const end = walk(start, legs), text = `Starting out walking ${start}, Meera walks ${legs.map((l, i) => (i ? `turns ${l.turn} and walks ${l.len} m` : `${l.len} m`)).join(', then ')}.`;
    if (level === 1) {
      const made = letterOptions(rng, { text: end.facing.charAt(0).toUpperCase() + end.facing.slice(1), reason: 'Follow each turn from the way she is facing at that moment.' }, DIRS.filter(d => d !== end.facing).map(d => ({ text: d.charAt(0).toUpperCase() + d.slice(1), reason: 'A left or right turn depends on the way she is facing then, not on the page.' })));
      return made && { kind: 'direction-facing', seed, answerMode: 'single', figures: [], ...made, prompt: `${text} Which way is she facing now?`, explanation: `Her headings: ${legs.map((_, i) => walk(start, legs.slice(0, i + 1)).facing).join(', ')}. She ends facing ${end.facing}.` };
    }
    const dist = Math.hypot(end.x, end.y);
    if (!Number.isInteger(dist) || dist === 0) return null;
    return {
      kind: 'direction-distance', seed, answerMode: 'numeric', unit: 'metres', figures: [], answer: { value: dist },
      mistakes: numericMistakes(dist, [{ value: legs.reduce((s, l) => s + l.len, 0), reason: 'That is the distance walked. The question asks how far she is from the start, in a straight line.' }, { value: Math.abs(end.x) + Math.abs(end.y), reason: 'Use the straight line, not the sum of the two parts.' }]),
      prompt: `${text} How far is she from where she started, in a straight line?`,
      explanation: `She ends ${Math.abs(end.x)} m ${end.x >= 0 ? 'east' : 'west'} and ${Math.abs(end.y)} m ${end.y >= 0 ? 'north' : 'south'} of the start: √(${end.x}² + ${end.y}²) = ${dist} m, to the ${compass(end.x, end.y)}.`,
      hints: ['Draw each leg on squared paper, turning from the way she is facing.', 'Add up the east–west parts and the north–south parts separately, then use Pythagoras.'],
      solution: [...legs.map((l, i) => { const w = walk(start, legs.slice(0, i + 1)); return { text: `Leg ${i + 1}: ${l.len} m ${w.facing}; now at (${w.x}, ${w.y}).` }; }), { text: `Straight-line distance: √(${end.x}² + ${end.y}²) = ${dist} m.` }],
    };
  });
}
// Family relations from a small tree: each step is a parent, child or sibling link.
const REL = { father: ['male', 'parent'], mother: ['female', 'parent'], son: ['male', 'child'], daughter: ['female', 'child'], brother: ['male', 'sibling'], sister: ['female', 'sibling'] };
export function relate(path) {
  // Net generations up (+) or down (−), and whether the chain passes sideways.
  let gen = 0, side = false;
  for (const step of path) { const k = REL[step][1]; if (k === 'parent') gen += 1; else if (k === 'child') gen -= 1; else side = true; }
  return { gen, side };
}
const RELATION_NAME = (gen, side, sex) => {
  const m = sex === 'male';
  if (gen === 1 && !side) return m ? 'father' : 'mother';
  if (gen === -1 && !side) return m ? 'son' : 'daughter';
  if (gen === 0 && side) return m ? 'brother' : 'sister';
  if (gen === 2) return m ? 'grandfather' : 'grandmother';
  if (gen === -2) return m ? 'grandson' : 'granddaughter';
  if (gen === 1 && side) return m ? 'uncle' : 'aunt';
  if (gen === -1 && side) return m ? 'nephew' : 'niece';
  return null;
};
export function relationsQuestion(seed) {
  return retry(seed, rng => {
    // Build a chain X → … → Y where each word says what the next person is to the previous one.
    const steps = Array.from({ length: 2 + Math.floor(rng() * 2) }, () => pick(rng, Object.keys(REL)));
    // Disallow chains that loop back on themselves (child then parent, sibling then sibling).
    if (steps.some((s, i) => i && ((REL[s][1] === 'parent' && REL[steps[i - 1]][1] === 'child') || (REL[s][1] === 'child' && REL[steps[i - 1]][1] === 'parent') || (REL[s][1] === 'sibling' && REL[steps[i - 1]][1] === 'sibling')))) return null;
    // Sibling after a parent step is an uncle or aunt line; keep at most one sideways step.
    if (steps.filter(s => REL[s][1] === 'sibling').length > 1) return null;
    const people = shuffle(rng, ['P', 'Q', 'R', 'S', 'T']).slice(0, steps.length + 1);
    const { gen, side } = relate(steps), sex = REL[steps[steps.length - 1]][0], name = RELATION_NAME(gen, side, sex);
    // A sideways step before going down, or after going up, makes an uncle or aunt line; others are not well defined here.
    const sideIndex = steps.findIndex(s => REL[s][1] === 'sibling');
    if (!name || (side && sideIndex > 0 && REL[steps[sideIndex - 1]][1] === 'child')) return null;
    const sentence = steps.map((s, i) => `${people[i + 1]} is the ${s} of ${people[i]}`);
    const opposite = { father: 'son', mother: 'daughter', son: 'father', daughter: 'mother', grandfather: 'grandson', grandmother: 'granddaughter', grandson: 'grandfather', granddaughter: 'grandmother', uncle: 'nephew', aunt: 'niece', nephew: 'uncle', niece: 'aunt', brother: 'brother', sister: 'sister' };
    const wrongSex = name.replace(/father/, 'mother').replace(/^son$/, 'daughter').replace(/brother/, 'sister').replace(/uncle/, 'aunt').replace(/nephew/, 'niece').replace(/grandson/, 'granddaughter');
    const made = letterOptions(rng, { text: name.charAt(0).toUpperCase() + name.slice(1), reason: 'Follow the chain one link at a time, keeping track of generations.' }, [
      { text: opposite[name].charAt(0).toUpperCase() + opposite[name].slice(1), reason: `That is ${people[0]} to ${people[people.length - 1]}, the relation the other way round.` },
      { text: wrongSex.charAt(0).toUpperCase() + wrongSex.slice(1), reason: `The last link tells you ${people[people.length - 1]} is ${sex}.` },
      { text: 'Cousin', reason: 'A cousin is the child of an uncle or aunt; this chain does not go down again after going sideways.' },
      { text: 'Grandfather', reason: 'Count the generations: each parent link is one up, each child link one down.' },
      { text: 'Brother', reason: 'Count the generations: each parent link is one up, each child link one down.' },
    ]);
    if (!made) return null;
    return {
      kind: 'relations', seed, answerMode: 'single', figures: [], ...made,
      prompt: `${sentence.join('. ')}. How is ${people[people.length - 1]} related to ${people[0]}?`,
      explanation: `Going from ${people[0]}: ${steps.map((s, i) => `${people[i + 1]} is ${people[i]}'s ${s}`).join(', ')}. That is ${gen > 0 ? `${gen} generation${gen > 1 ? 's' : ''} up` : gen < 0 ? `${-gen} generation${gen < -1 ? 's' : ''} down` : 'the same generation'}${side ? ' on a brother or sister\'s side' : ''}: ${people[people.length - 1]} is ${people[0]}'s ${name}.`,
      hints: ['Draw a small family tree: parents above, children below, brothers and sisters side by side.', 'Count generations: up for each parent link, down for each child link.'],
      solution: [...steps.map((s, i) => ({ text: `${people[i + 1]} is the ${s} of ${people[i]}.` })), { text: `Net: ${gen > 0 ? `${gen} up` : gen < 0 ? `${-gen} down` : 'level'}${side ? ', one step sideways' : ''}, and ${people[people.length - 1]} is ${sex}.` }, { text: `So ${people[people.length - 1]} is ${people[0]}'s ${name}.` }],
    };
  });
}
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function dayQuestion(seed) {
  return retry(seed, rng => {
    const year = 2001 + Math.floor(rng() * 28), a = new Date(Date.UTC(year, Math.floor(rng() * 6), 1 + Math.floor(rng() * 28))), b = new Date(a.getTime() + (40 + Math.floor(rng() * 250)) * 86400000);
    if (b.getUTCFullYear() !== year) return null;
    const gap = Math.round((b - a) / 86400000), value = DAYS[b.getUTCDay()];
    const made = letterOptions(rng, { text: value, reason: `${gap} days is ${Math.floor(gap / 7)} weeks and ${gap % 7} days: move ${gap % 7} days on.` }, [1, 2, 6, 5].map(k => ({ text: DAYS[(b.getUTCDay() + k) % 7], reason: k === 1 || k === 6 ? 'Off by one: count the days between carefully; February has 28 days unless it is a leap year.' : 'Count the odd days left over after whole weeks.' })));
    if (!made) return null;
    return {
      kind: 'day-of-week', seed, answerMode: 'single', figures: [], ...made,
      prompt: `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} ${year} is a ${DAYS[a.getUTCDay()]}. What day of the week is ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]} ${year}?`,
      explanation: `From one date to the other is ${gap} days: ${Math.floor(gap / 7)} weeks and ${gap % 7} days. ${DAYS[a.getUTCDay()]} + ${gap % 7} days is ${value}.`,
      hints: ['Count the days between the dates, month by month.', 'Whole weeks do not change the day; only the remainder after dividing by 7 does.'],
      solution: [{ text: `Days from the first date to the second: ${gap}.` }, { text: `${gap} ÷ 7 = ${Math.floor(gap / 7)} weeks, remainder ${gap % 7}.` }, { text: `${DAYS[a.getUTCDay()]} moved on ${gap % 7} days is ${value}.` }],
    };
  });
}
export function calendarRepeatQuestion(seed) {
  return retry(seed, rng => {
    const year = 2001 + Math.floor(rng() * 30), leap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0, first = y => new Date(Date.UTC(y, 0, 1)).getUTCDay();
    let next = year + 1; while (!(first(next) === first(year) && leap(next) === leap(year))) next++;
    const naive = year + 7;
    return {
      kind: 'calendar-repeat', seed, answerMode: 'numeric', unit: '', figures: [], answer: { value: next },
      mistakes: numericMistakes(next, [{ value: naive, reason: 'Seven years is not always right: leap years move the days on by two, not one.' }, { value: year + 28, reason: 'Twenty-eight years always works, but the calendar usually repeats sooner.' }, { value: year + 6, reason: 'The year must also be a leap year exactly when this one is.' }, { value: year + 11, reason: 'Check the leap years in between one by one.' }]),
      prompt: `In which year after ${year} will the calendar of ${year} next be exactly the same, every date on the same day of the week?`,
      explanation: `A year moves 1 January on by one day, or by two after a leap year. Adding up from ${year}, 1 January is back on the same day in ${next}${leap(year) ? ', which is also a leap year' : ', which is also not a leap year'}.`,
      hints: ['An ordinary year has 365 days: 52 weeks and 1 day. A leap year has 2 odd days.', 'Add the odd days year by year until they make a whole number of weeks, and the leap-year status matches.'],
      solution: [{ text: `${year} is ${leap(year) ? '' : 'not '}a leap year.` }, { text: `Odd days year by year: ${Array.from({ length: next - year }, (_, i) => (leap(year + i) ? 2 : 1)).join(' + ')} = ${Array.from({ length: next - year }, (_, i) => (leap(year + i) ? 2 : 1)).reduce((a, b) => a + b, 0)}, a multiple of 7.` }, { text: `${next} starts on the same day and matches on leap years.` }],
    };
  });
}
// A clock that gains or loses steadily.
export function clockGainQuestion(seed) {
  return retry(seed, rng => {
    const gain = pick(rng, [2, 3, 4, 5, 6]) * (rng() < 0.6 ? 1 : -1), setAt = 6 + Math.floor(rng() * 4), hours = pick(rng, [5, 6, 8, 10, 12, 15]), real = setAt * 60 + hours * 60, shown = real + gain * hours;
    const fmt = m => { const t = ((m % 720) + 720) % 720; return `${Math.floor(t / 60) || 12}:${String(t % 60).padStart(2, '0')}`; };
    const value = gain * hours;
    return {
      kind: 'clock-gain', seed, answerMode: 'numeric', unit: 'minutes', figures: [], answer: { value: Math.abs(value) },
      mistakes: numericMistakes(Math.abs(value), [{ value: Math.abs(gain), reason: 'That is the change in one hour. Multiply by the hours that pass.' }, { value: Math.abs(gain) * (hours + 1), reason: 'Count the hours from the moment it was set right.' }]),
      prompt: `A clock ${gain > 0 ? 'gains' : 'loses'} ${Math.abs(gain)} minutes every hour. It is set right at ${setAt}:00 in the morning. When the correct time is ${fmt(real)}${real >= 720 ? ' in the evening' : ''}, how many minutes ${gain > 0 ? 'ahead' : 'behind'} is it?`,
      explanation: `${hours} hours have passed, at ${Math.abs(gain)} minutes an hour: ${Math.abs(value)} minutes ${gain > 0 ? 'ahead' : 'behind'}, so it shows ${fmt(shown)}.`,
      hints: ['How many hours have passed since it was set right?', 'Multiply by the minutes gained or lost each hour.'],
      solution: [{ text: `From ${setAt}:00 to ${fmt(real)} is ${hours} hours.` }, { text: `${hours} × ${Math.abs(gain)} = ${Math.abs(value)} minutes.` }, { text: `It shows ${fmt(shown)}.` }],
    };
  });
}
// A maze of rooms on a grid; walls between rooms have openings. Fewest openings from one room to another.
export function fewestOpenings(n, m, open, from, to) {
  // 0-1 search: moving through an opening costs 1; there is no other way between rooms.
  const dist = new Map([[from, 0]]), queue = [from];
  while (queue.length) {
    const cur = queue.shift(), [x, y] = cur.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`, wall = [cur, k].sort().join('|');
      if (nx < 0 || ny < 0 || nx >= n || ny >= m || !open.has(wall) || dist.has(k)) continue;
      dist.set(k, dist.get(cur) + 1); queue.push(k);
    }
  }
  return dist.get(to) ?? null;
}
export function mazeQuestion(seed) {
  return retry(seed, rng => {
    const n = 6, m = 5, open = new Set();
    // Every inside wall has an opening with some probability; the grid must stay connected.
    for (let x = 0; x < n; x++) for (let y = 0; y < m; y++) for (const [dx, dy] of [[1, 0], [0, 1]]) { const nx = x + dx, ny = y + dy; if (nx < n && ny < m && rng() < 0.42) open.add([`${x},${y}`, `${nx},${ny}`].sort().join('|')); }
    const from = `0,${m - 1}`, to = `${n - 1},0`, value = fewestOpenings(n, m, open, from, to);
    if (value === null || value < 9) return null;
    const straight = n - 1 + m - 1;
    return {
      kind: 'maze-openings', seed, answerMode: 'numeric', unit: 'openings', figures: [{ type: 'maze', n, m, open: [...open], from, to }], answer: { value },
      mistakes: numericMistakes(value, [{ value: straight, reason: 'That is the shortest route if every wall had an opening. Follow only real openings.' }, { value: value + 2, reason: 'There is a route with fewer openings. Look for one that doubles back early to avoid a long dead end.' }]),
      prompt: 'The plan shows rooms separated by walls; gaps in the walls are openings. What is the least number of openings Riya must pass through to walk from her room, R, to the room marked B?',
      explanation: `Spreading out from R one opening at a time, B is first reached after ${value} openings.`,
      hints: ['Mark every room you can reach through one opening, then through two, and so on.', 'The first time you reach B, that count is the least.'],
      solution: [{ text: 'Write 0 in R. Write 1 in every room one opening away, 2 in rooms one more opening on, and so on.' }, { text: 'Never write a number in a room that already has one: the first number is the least.' }, { text: `B gets the number ${value}.` }],
    };
  });
}

export function logicQuestion(seed, kind, level) {
  switch (kind) {
    case 'number-series': return seriesQuestion(seed, 1);
    case 'series-rule': return seriesQuestion(seed, 3);
    case 'letter-shift': return letterShiftQuestion(seed);
    case 'word-code': return wordCodeQuestion(seed);
    case 'figure-number': return figureNumberQuestion(seed);
    case 'series-odd': return seriesOddQuestion(seed);
    case 'ranking': return rankingQuestion(seed);
    case 'row-seating': return rowSeatingQuestion(seed);
    case 'circle-seating': return circleSeatingQuestion(seed);
    case 'symbol-sum': return symbolSumQuestion(seed);
    case 'rule-sequence': return ruleSequenceQuestion(seed);
    case 'handshakes': return handshakeQuestion(seed);
    case 'direction-facing': return directionQuestion(seed, 1);
    case 'direction-distance': return directionQuestion(seed, 2);
    case 'relations': return relationsQuestion(seed);
    case 'day-of-week': return dayQuestion(seed);
    case 'calendar-repeat': return calendarRepeatQuestion(seed);
    case 'clock-gain': return clockGainQuestion(seed);
    case 'maze-openings': return mazeQuestion(seed);
    default: throw new Error(`Unknown logic kind ${kind} at level ${level}`);
  }
}
export const LOGIC_KINDS = {
  'number-series': ['codes-patterns', 1], 'letter-shift': ['codes-patterns', 2], 'series-rule': ['codes-patterns', 3], 'word-code': ['codes-patterns', 3], 'figure-number': ['codes-patterns', 4], 'series-odd': ['codes-patterns', 4],
  ranking: ['arrangements', 1], 'row-seating': ['arrangements', 2], 'circle-seating': ['arrangements', 3], 'symbol-sum': ['arrangements', 3], 'rule-sequence': ['arrangements', 4], handshakes: ['arrangements', 4],
  'direction-facing': ['directions', 1], 'direction-distance': ['directions', 2], relations: ['directions', 3], 'day-of-week': ['directions', 3], 'clock-gain': ['directions', 3], 'calendar-repeat': ['directions', 4], 'maze-openings': ['directions', 4],
};
