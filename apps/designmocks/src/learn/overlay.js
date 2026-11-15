// Transparent sheets: stack two or three sheets (some turned or flipped
// first), fold one sheet onto itself, and count what overlaps.
// Specification: docs/learn/topics/overlays.md.
// A sheet is an n × n grid; each cell holds a set of marks. Line marks keep
// their direction: h (—), v (|), d1 (/), d2 (\). Columns run left to right,
// rows top to bottom.
import { pick, seededRandom, shuffle } from './random.js';

const LETTERS = 'ABCD';
export const MARKS = ['dot', 'ring', 'h', 'v', 'd1', 'd2'];
const LINE = { h: [1, 0], v: [0, 1], d1: [1, -1], d2: [1, 1] }; // screen vectors, y down
const lineOf = ([x, y]) => { const s = x < 0 || (x === 0 && y < 0) ? -1 : 1; const v = [x * s, y * s]; return Object.keys(LINE).find(k => LINE[k][0] === v[0] && LINE[k][1] === v[1]); };
function retry(seed, build) {
  for (let i = 0; i < 600; i++) { const q = build(seededRandom(seed * 7121 + i * 3089)); if (q) return q; }
  throw new Error('No overlay question for seed ' + seed);
}
const lettered = (rng, list) => {
  const options = shuffle(rng, list).map((o, i) => ({ ...o, id: LETTERS[i], label: LETTERS[i] }));
  return { options, answer: options.find(o => o.correct).id };
};

// Sheets as maps "c,r" -> sorted list of marks.
export const sheetKey = sheet => Object.entries(sheet).filter(([, m]) => m.length).map(([k, m]) => `${k}:${[...m].sort().join('+')}`).sort().join(' ');
export function overlay(...sheets) {
  const out = {};
  for (const s of sheets) for (const [k, m] of Object.entries(s)) out[k] = [...new Set([...(out[k] ?? []), ...m])].sort();
  return out;
}
// Point maps on cell indices, with the matching change to line directions.
const TRANSFORMS = {
  turn: n => ({ cell: ([c, r]) => [n - 1 - r, c], vec: ([x, y]) => [-y, x] }), // quarter turn clockwise
  flipH: n => ({ cell: ([c, r]) => [n - 1 - c, r], vec: ([x, y]) => [-x, y] }), // left to right
  flipV: n => ({ cell: ([c, r]) => [c, n - 1 - r], vec: ([x, y]) => [x, -y] }), // top to bottom
};
export function transform(sheet, name, n) {
  const t = TRANSFORMS[name](n), out = {};
  for (const [k, m] of Object.entries(sheet)) {
    const [c, r] = t.cell(k.split(',').map(Number));
    out[`${c},${r}`] = m.map(mark => (LINE[mark] ? lineOf(t.vec(LINE[mark])) : mark)).sort();
  }
  return out;
}
function randomSheet(rng, n, count, pool) {
  const sheet = {};
  for (const k of shuffle(rng, Array.from({ length: n * n }, (_, i) => `${i % n},${Math.floor(i / n)}`)).slice(0, count)) sheet[k] = [pick(rng, pool)];
  return sheet;
}
const fig = (sheet, n, label, extra = {}) => ({ type: 'sheet', n, cells: sheet, ...(label ? { label } : {}), ...extra });
const moveOne = (rng, sheet, n) => { const keys = Object.keys(sheet), from = pick(rng, keys), free = Array.from({ length: n * n }, (_, i) => `${i % n},${Math.floor(i / n)}`).filter(k => !sheet[k]); if (!free.length) return null; const out = { ...sheet }; out[pick(rng, free)] = out[from]; delete out[from]; return out; };

const WORDS = { turn: 'turned a quarter turn clockwise', flipH: 'flipped over from left to right', flipV: 'flipped over from top to bottom' };
export function stackQuestion(seed, level = 2) {
  return retry(seed, rng => {
    const n = level <= 2 ? 3 : 4, count = level <= 2 ? 2 : 3, pool = level <= 2 ? ['dot', 'ring', 'h', 'v'] : MARKS;
    const sheets = Array.from({ length: count }, () => randomSheet(rng, n, level <= 2 ? 3 : 3 + Math.floor(rng() * 2), pool));
    const move = level >= 3 ? pick(rng, ['turn', 'flipH', 'flipV']) : null, which = count - 1;
    const used = sheets.map((s, i) => (move && i === which ? transform(s, move, n) : s));
    if (move && sheetKey(used[which]) === sheetKey(sheets[which])) return null;
    const right = overlay(...used);
    const wrongs = [
      { sheet: move ? overlay(...sheets) : overlay(...sheets.map((s, i) => (i === which ? transform(s, 'flipH', n) : s))), reason: move ? `Sheet ${which + 1} was not ${WORDS[move]} before stacking.` : `Sheet ${which + 1} has been flipped; it is laid down as drawn.` },
      { sheet: overlay(...used.filter((_, i) => i !== 0)), reason: 'Every mark on every sheet shows through; sheet 1’s marks are missing.' },
      { sheet: overlay(...used.map((s, i) => (i === 0 ? moveOne(rng, s, n) ?? s : s))), reason: 'One mark is in the wrong square.' },
      ...(move ? [{ sheet: overlay(...sheets.map((s, i) => (i === which ? transform(s, move === 'turn' ? 'flipH' : 'turn', n) : s))), reason: `Sheet ${which + 1} was moved the wrong way.` }] : []),
    ].filter((w, i, l) => sheetKey(w.sheet) !== sheetKey(right) && l.findIndex(o => sheetKey(o.sheet) === sheetKey(w.sheet)) === i).slice(0, 3);
    if (wrongs.length < 3) return null;
    const { options, answer } = lettered(rng, [{ correct: true, figure: fig(right, n), reason: 'Every mark shows through, each in its own square.' }, ...wrongs.map(w => ({ correct: false, figure: fig(w.sheet, n), reason: w.reason }))]);
    return {
      kind: 'sheet-stack', seed, answerMode: 'single', sheets, move, n,
      prompt: `These transparent sheets are laid exactly on top of each other${move ? `, sheet ${which + 1} first ${WORDS[move]}` : ''}. What do you see?`,
      figures: sheets.map((s, i) => fig(s, n, `Sheet ${i + 1}`)),
      options, answer,
      explanation: `Transparent sheets show every mark at once, each in its own square.${move ? ` Move sheet ${which + 1} first: ${move === 'turn' ? 'a quarter turn clockwise takes the top row to the right-hand column, and a — mark becomes |' : move === 'flipH' ? 'flipping left to right swaps the columns and turns / into \\' : 'flipping top to bottom swaps the rows and turns / into \\'}.` : ''}`,
      ...(level >= 3 ? { hints: [`Redraw sheet ${which + 1} after it is ${WORDS[move]}.`, 'Slanting lines change direction when a sheet is flipped or turned.'], solution: [{ text: `Sheet ${which + 1} ${WORDS[move]}: ${move === 'turn' ? 'column = 3 − row index, row = old column' : 'mirror its squares'}, and turn its line marks with it.` }, { text: 'Lay all the sheets in the same squares.' }, { text: 'Every mark shows, so the result is all the marks together.' }] } : {}),
    };
  });
}

// One sheet folded along a line: the folded half lands mirrored on the other half.
export function foldQuestion(seed, level = 3) {
  return retry(seed, rng => {
    const n = 4, line = level >= 4 ? pick(rng, ['vertical', 'horizontal', 'diagonal']) : pick(rng, ['vertical', 'horizontal']), pool = level >= 4 ? MARKS : ['dot', 'ring', 'd1', 'd2', 'h'];
    const sheet = randomSheet(rng, n, 5 + Math.floor(rng() * 3), pool);
    const right = foldSheet(sheet, n, line), wrong1 = foldSheet(sheet, n, line, { keepLines: true }), wrong2 = foldSheet(sheet, n, line, { moveOnly: true }), wrong3 = foldSheet(sheet, n, line, { otherHalf: true });
    const list = [{ correct: true, sheet: right, reason: 'The folded half lands as its mirror image on the half that stays.' }, { sheet: wrong1, reason: 'Slanting lines must be mirrored too: / lands as \\.' }, { sheet: wrong2, reason: 'This slides the half across instead of folding it over.' }, { sheet: wrong3, reason: 'This keeps the wrong half in place.' }];
    if (new Set(list.map(o => sheetKey(o.sheet.cells))).size !== 4) return null;
    const { options, answer } = lettered(rng, list.map(o => ({ correct: !!o.correct, reason: o.reason, figure: fig(o.sheet.cells, n, null, { region: o.sheet.region }) })));
    const words = { vertical: 'along the dashed upright line, right half over onto the left', horizontal: 'along the dashed level line, bottom half up onto the top', diagonal: 'along the dashed diagonal, the lower-left half over onto the upper-right' }[line];
    return {
      kind: 'sheet-fold', seed, answerMode: 'single', sheet, line, n,
      prompt: `This transparent sheet is folded ${words}. What do you see on the folded sheet?`,
      figures: [fig(sheet, n, null, { fold: line })],
      options, answer,
      explanation: 'Folding is a mirror. Every mark on the moving half lands at its mirror position across the fold, and line marks flip direction with it. Marks on the half that stays do not move.',
      hints: ['Each folded mark lands as far from the fold on the other side.', 'Mirror the direction of slanting and, on a diagonal fold, of upright and level lines too.'],
      solution: [{ text: 'Keep the half that stays as it is.' }, { text: 'Mirror each mark of the moving half across the fold, line directions included.' }, { text: 'Put both together on the remaining half.' }],
    };
  });
}
// Reflection of a cell and a line direction for each fold.
const MIRROR = {
  vertical: n => ({ cell: ([c, r]) => [n - 1 - c, r], vec: ([x, y]) => [-x, y], moving: ([c]) => c >= n / 2 }),
  horizontal: n => ({ cell: ([c, r]) => [c, n - 1 - r], vec: ([x, y]) => [x, -y], moving: ([, r]) => r >= n / 2 }),
  diagonal: () => ({ cell: ([c, r]) => [r, c], vec: ([x, y]) => [y, x], moving: ([c, r]) => r > c }), // fold line from top-left to bottom-right
};
export function foldSheet(sheet, n, line, { keepLines = false, moveOnly = false, otherHalf = false } = {}) {
  const m = MIRROR[line](n), moves = cell => (otherHalf ? !m.moving(cell) && !(line === 'diagonal' && cell[0] === cell[1]) : m.moving(cell)), out = {};
  const put = (k, marks) => { out[k] = [...new Set([...(out[k] ?? []), ...marks])].sort(); };
  for (const [k, marks] of Object.entries(sheet)) {
    const cell = k.split(',').map(Number);
    if (!moves(cell)) { put(k, marks); continue; }
    // moveOnly slides the half across without mirroring (diagonal: rows and columns swapped, lines unchanged)
    const target = moveOnly && line !== 'diagonal' ? (line === 'vertical' ? [cell[0] + (otherHalf ? n / 2 : -n / 2), cell[1]] : [cell[0], cell[1] + (otherHalf ? n / 2 : -n / 2)]) : m.cell(cell);
    put(target.join(','), moveOnly || keepLines ? marks : marks.map(mk => (LINE[mk] ? lineOf(m.vec(LINE[mk])) : mk)));
  }
  const region = { vertical: otherHalf ? 'right' : 'left', horizontal: otherHalf ? 'bottom' : 'top', diagonal: otherHalf ? 'lower' : 'upper' }[line];
  return { cells: out, region };
}

// Count squares covered a given number of times.
export function countQuestion(seed, level = 3) {
  return retry(seed, rng => {
    const n = 4, count = 3, sheets = Array.from({ length: count }, () => randomSheet(rng, n, 5 + Math.floor(rng() * 3), ['fill']));
    const move = level >= 4 ? pick(rng, ['turn', 'flipH', 'flipV']) : null, used = sheets.map((s, i) => (move && i === 1 ? transform(s, move, n) : s));
    const cover = {};
    for (const s of used) for (const k of Object.keys(s)) cover[k] = (cover[k] ?? 0) + 1;
    const ask = pick(rng, ['exactly two', 'all three', 'none', 'exactly one']);
    const tally = t => Array.from({ length: n * n }, (_, i) => `${i % n},${Math.floor(i / n)}`).filter(k => (cover[k] ?? 0) === t).length;
    const value = { 'exactly two': tally(2), 'all three': tally(3), none: tally(0), 'exactly one': tally(1) }[ask];
    if (value === 0 && rng() < 0.8) return null;
    const plain = {}; for (const s of sheets) for (const k of Object.keys(s)) plain[k] = (plain[k] ?? 0) + 1;
    const plainTally = Array.from({ length: n * n }, (_, i) => `${i % n},${Math.floor(i / n)}`).filter(k => (plain[k] ?? 0) === { 'exactly two': 2, 'all three': 3, none: 0, 'exactly one': 1 }[ask]).length;
    const mistakes = [...(move ? [{ value: plainTally, reason: `Sheet 2 must be ${WORDS[move]} before you count.` }] : []), { value: ask === 'exactly two' ? tally(2) + tally(3) : ask === 'exactly one' ? tally(1) + tally(2) + tally(3) : ask === 'none' ? n * n - value : tally(2), reason: ask === 'none' ? 'That counts the shaded squares, not the clear ones.' : ask === 'all three' ? 'That counts squares shaded twice.' : '“Exactly” leaves out squares shaded more often.' }].filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i);
    return {
      kind: 'sheet-count', seed, answerMode: 'numeric', unit: '', sheets, move,
      prompt: `Three transparent sheets with shaded squares are laid on top of each other${move ? `, sheet 2 first ${WORDS[move]}` : ''}. How many squares are shaded on ${ask === 'none' ? 'none of the sheets' : ask === 'all three' ? 'all three sheets' : `${ask} sheet${ask === 'exactly one' ? '' : 's'}`}?`,
      figures: sheets.map((s, i) => fig(s, n, `Sheet ${i + 1}`)),
      answer: { value }, mistakes,
      explanation: `Go square by square and count how many sheets shade it. ${value} square${value === 1 ? ' is' : 's are'} shaded on ${ask === 'none' ? 'none' : ask}.`,
      hints: [move ? `Redraw sheet 2 ${WORDS[move]} first.` : 'Write a number in each square: how many sheets shade it.', 'Then count the squares with the number asked for.'],
      solution: [...(move ? [{ text: `Sheet 2 ${WORDS[move]}.` }] : [{ text: 'Lay the three sheets in place as drawn.' }]), { text: `Squares shaded 0, 1, 2 and 3 times: ${[0, 1, 2, 3].map(tally).join(', ')}.` }, { text: `The answer is ${value}.` }],
    };
  });
}

export function overlayQuestion(seed, kind, level) {
  switch (kind) {
    case 'sheet-stack': return stackQuestion(seed, level);
    case 'sheet-fold': return foldQuestion(seed, level);
    case 'sheet-count': return countQuestion(seed, level);
    default: throw new Error('Unknown overlay kind ' + kind);
  }
}
export const OVERLAY_KINDS = Object.freeze({ 'sheet-stack': [2, 3], 'sheet-fold': [3, 4], 'sheet-count': [3, 4] });
