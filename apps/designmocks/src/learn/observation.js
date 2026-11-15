// Visual observation: the odd icon in a grid, the tile that breaks a
// pattern, counting shapes in clutter, spotting differences, and letter
// symmetry. Specification: docs/learn/topics/observation.md.
import { pick, seededRandom, shuffle } from './random.js';

const LETTERS = 'ABCD';
function retry(seed, build) {
  for (let i = 0; i < 600; i++) { const q = build(seededRandom(seed * 6763 + i * 2903)); if (q) return q; }
  throw new Error('No observation question for seed ' + seed);
}
const lettered = (rng, list) => {
  const options = shuffle(rng, list).map((o, i) => ({ ...o, id: LETTERS[i], label: LETTERS[i] }));
  return { options, answer: options.find(o => o.correct).id };
};
const place = (i, cols) => `Row ${Math.floor(i / cols) + 1}, column ${(i % cols) + 1}`;

// An icon: a dial with a hand (0–7, eighths of a turn), 1–3 dots, filled or not.
export const iconKey = ic => `${ic.hand}-${ic.dots}-${ic.filled ? 1 : 0}`;
const randomIcon = rng => ({ hand: Math.floor(rng() * 8), dots: 1 + Math.floor(rng() * 3), filled: rng() < 0.5 });
function tweak(rng, ic, subtle) {
  const what = subtle ? pick(rng, ['hand', 'dots']) : pick(rng, ['filled', 'hand', 'dots']);
  if (what === 'filled') return { ...ic, filled: !ic.filled };
  if (what === 'hand') return { ...ic, hand: (ic.hand + (subtle ? pick(rng, [1, 7]) : 4)) % 8 };
  return { ...ic, dots: ic.dots === 3 ? 2 : ic.dots + 1 };
}
const DIFF_WORDS = (a, b) => (a.filled !== b.filled ? 'it is filled differently' : a.hand !== b.hand ? 'its hand points another way' : 'it has a different number of dots');

export function oddIconQuestion(seed, level = 2) {
  return retry(seed, rng => {
    const cols = level <= 2 ? 3 : 4, n = cols * cols, base = randomIcon(rng), odd = tweak(rng, base, level >= 3), at = Math.floor(rng() * n);
    const icons = Array.from({ length: n }, (_, i) => (i === at ? odd : base));
    const others = shuffle(rng, Array.from({ length: n }, (_, i) => i).filter(i => i !== at)).slice(0, 3);
    const { options, answer } = lettered(rng, [at, ...others].map(i => ({ correct: i === at, text: place(i, cols), reason: i === at ? `This one differs: ${DIFF_WORDS(odd, base)}.` : 'This icon matches the others.' })));
    return {
      kind: 'odd-icon', seed, answerMode: 'single', icons, cols, at,
      prompt: 'One icon is different from all the others. Where is it?',
      figures: [{ type: 'icon-grid', icons, cols }], options, answer,
      explanation: 'Compare features one at a time across the whole grid: first the fill, then the direction of the hand, then the number of dots. Scanning for one feature is faster and safer than comparing whole icons.',
      ...(level >= 3 ? { hints: ['Check one feature at a time across every icon.', 'Small turns of the hand are the easiest to miss.'], solution: [{ text: 'Fill: all the same?' }, { text: 'Hand direction and dots: scan row by row.' }, { text: `${place(at, cols)}: ${DIFF_WORDS(odd, base)}.` }] } : {}),
    };
  });
}
export function patternBreakQuestion(seed) {
  return retry(seed, rng => {
    const period = pick(rng, [2, 3, 4]), cols = 4, n = 12 + (period === 3 ? 0 : 4), motif = [];
    while (motif.length < period) { const ic = randomIcon(rng); if (!motif.some(m => iconKey(m) === iconKey(ic))) motif.push(ic); }
    const icons = Array.from({ length: n }, (_, i) => motif[i % period]), at = period + Math.floor(rng() * (n - period)), wrong = rng() < 0.5 ? motif[(at + 1) % period] : tweak(rng, motif[at % period], true);
    if (iconKey(wrong) === iconKey(icons[at])) return null;
    icons[at] = wrong;
    const others = shuffle(rng, Array.from({ length: n }, (_, i) => i).filter(i => i !== at)).slice(0, 3);
    const { options, answer } = lettered(rng, [at, ...others].map(i => ({ correct: i === at, text: place(i, cols), reason: i === at ? `The pattern repeats every ${period}; this tile should match the one ${period} places before it.` : 'This tile follows the repeat.' })));
    return {
      kind: 'pattern-break', seed, answerMode: 'single', icons, cols, period, at,
      prompt: 'These tiles follow a repeating pattern, read row by row from the top left. Which tile breaks the pattern?',
      figures: [{ type: 'icon-grid', icons, cols }], options, answer,
      explanation: `Find how often the pattern repeats (every ${period} tiles here), then check each tile against the one a full repeat earlier.`,
      hints: ['Find the length of the repeat from the first few tiles.', 'Compare each tile with the one a full repeat before it.'],
      solution: [{ text: `The first tiles repeat every ${period}.` }, { text: 'Check each tile against the one a repeat earlier.' }, { text: `${place(at, cols)} does not match.` }],
    };
  });
}

// Clutter: outline shapes scattered and overlapping.
export const SHAPES = ['triangle', 'square', 'circle', 'star'];
export function clutterQuestion(seed, level = 3) {
  return retry(seed, rng => {
    const total = level <= 3 ? 14 + Math.floor(rng() * 6) : 20 + Math.floor(rng() * 6);
    const shapes = Array.from({ length: total }, () => ({ type: pick(rng, SHAPES), x: Math.round(rng() * 900) / 100, y: Math.round(rng() * 600) / 100, size: 0.6 + Math.round(rng() * 140) / 100, turn: Math.floor(rng() * 4) * 90 + (rng() < 0.3 ? 30 : 0) }));
    const ask = pick(rng, SHAPES), up = level >= 4 && ask === 'triangle';
    const matches = shapes.filter(s => s.type === ask && (!up || s.turn === 0));
    const value = matches.length;
    if (value < 3 || value > 12) return null;
    if (up && shapes.filter(s => s.type === 'triangle').length === value) return null;
    const nearby = ask === 'square' ? shapes.filter(s => s.type === 'square' && s.turn % 90 !== 0).length : 0;
    const word = up ? 'triangles pointing straight up' : `${ask}s${ask === 'square' ? ' (at any angle)' : ''}`;
    return {
      kind: 'clutter-count', seed, answerMode: 'numeric', unit: '', shapes, ask, up,
      prompt: `How many ${word} are in the picture? Shapes may overlap.`,
      figures: [{ type: 'clutter', shapes }],
      answer: { value }, mistakes: [{ value: value - 1, reason: 'Overlapping shapes hide behind each other; trace each outline separately.' }, { value: value + 1, reason: 'Two overlapping shapes can look like an extra one; check each has its own full outline.' }, ...(up ? [{ value: shapes.filter(s => s.type === 'triangle').length, reason: 'Only the triangles pointing straight up count.' }] : []), ...(nearby ? [{ value: value - nearby, reason: 'A tilted square is still a square.' }] : [])].filter((m, i, l) => m.value > 0 && m.value !== value && l.findIndex(o => o.value === m.value) === i),
      explanation: 'Sweep the picture in strips, left to right, and tick each shape as you count it. Trace each outline: where outlines cross, follow the lines through.',
      hints: ['Divide the picture into strips and count strip by strip.', 'Follow each outline right round; overlaps hide shapes.'],
      solution: [{ text: 'Scan in strips from the top.' }, { text: `Each ${up ? 'upward triangle' : ask} has its own closed outline.` }, { text: `Count: ${value}.` }],
    };
  });
}
export function spotDifferenceQuestion(seed, level = 3) {
  return retry(seed, rng => {
    const cols = level <= 3 ? 4 : 5, n = cols * cols, left = Array.from({ length: n }, () => randomIcon(rng)), k = level <= 3 ? 2 + Math.floor(rng() * 3) : 3 + Math.floor(rng() * 4);
    const changed = shuffle(rng, Array.from({ length: n }, (_, i) => i)).slice(0, k), right = left.map((ic, i) => (changed.includes(i) ? tweak(rng, ic, level >= 4) : ic));
    const value = right.filter((ic, i) => iconKey(ic) !== iconKey(left[i])).length;
    return {
      kind: 'spot-difference', seed, answerMode: 'numeric', unit: '', left, right, cols,
      prompt: 'How many squares differ between the two pictures?',
      figures: [{ type: 'icon-grid', icons: left, cols, label: 'Left' }, { type: 'icon-grid', icons: right, cols, label: 'Right' }],
      answer: { value }, mistakes: [{ value: value - 1, reason: 'A small turn of a hand is a difference too.' }, { value: value + 1, reason: 'Check each candidate square feature by feature; some are the same.' }].filter(m => m.value > 0),
      explanation: 'Compare square by square in a fixed order, checking fill, hand and dots each time. A system beats glancing back and forth.',
      hints: ['Go square by square in reading order.', 'Check the same three features in every square.'],
      solution: [{ text: 'Row by row, compare each pair of squares.' }, { text: 'Check fill, hand direction and dots.' }, { text: `Differences: ${value}.` }],
    };
  });
}

// Capital letters in a plain sans-serif.
export const LETTER_SYMMETRY = Object.freeze({
  leftRight: 'AHIMOTUVWXY'.split(''), upDown: 'BCDEHIKOX'.split(''), halfTurn: 'HINOSXZ'.split(''),
});
export function letterQuestion(seed) {
  return retry(seed, rng => {
    const prop = pick(rng, ['leftRight', 'upDown', 'halfTurn']), words = { leftRight: 'look the same in a mirror stood beside them', upDown: 'look the same reflected in water below them', halfTurn: 'look the same when turned upside down' }[prop];
    const yes = LETTER_SYMMETRY[prop], letters = shuffle(rng, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')).slice(0, 4), ok = letters.filter(l => yes.includes(l));
    if (ok.length < 1 || ok.length > 3) return null;
    const options = letters.map((l, i) => ({ id: LETTERS[i], label: LETTERS[i], text: l, correct: yes.includes(l), reason: yes.includes(l) ? `${l} ${words}.` : `${l} changes: it does not ${words.replace(/^look/, 'look')}.` }));
    return {
      kind: 'letter-symmetry', seed, answerMode: 'multi',
      prompt: `In plain capital letters, which of these ${words}? Choose all that do.`,
      figures: [], options, answer: options.filter(o => o.correct).map(o => o.id),
      explanation: 'Picture each letter folded along the mirror line, or turned half a turn. Letters like N and S survive a half turn but not a mirror.',
    };
  });
}

export function observationQuestion(seed, kind, level) {
  switch (kind) {
    case 'odd-icon': return oddIconQuestion(seed, level);
    case 'pattern-break': return patternBreakQuestion(seed);
    case 'clutter-count': return clutterQuestion(seed, level);
    case 'spot-difference': return spotDifferenceQuestion(seed, level);
    case 'letter-symmetry': return letterQuestion(seed);
    default: throw new Error('Unknown observation kind ' + kind);
  }
}
export const OBSERVATION_KINDS = Object.freeze({ 'odd-icon': [2, 3], 'letter-symmetry': [2], 'pattern-break': [3], 'clutter-count': [3, 4], 'spot-difference': [3, 4] });
