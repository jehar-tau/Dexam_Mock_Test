// Colour from exam standard to exam hard: light and ink mixing, harmonies on
// the twelve-step wheel, tints, shades and tones, colour filters on black and
// white film, reading RGB, hex and CMYK values, paint proportions, equal
// value across hues and text contrast. Specification: docs/learn/topics/colour.md.
import { pick, seededRandom, shuffle } from './random.js';
import { hexToHsl, hsl, wheel } from './colour.js';

const LETTERS = 'ABCD';
const at = i => wheel[((i % 12) + 12) % 12];
const gap = (a, b) => { const d = Math.abs(a - b) % 12; return Math.min(d, 12 - d); };

function retry(seed, build) {
  for (let i = 0; i < 400; i++) { const q = build(seededRandom(seed * 2711 + i * 6151)); if (q) return q; }
  throw new Error('No colour question for seed ' + seed);
}
// list: [{ correct, reason, ...shown }], exactly one correct, four entries
const lettered = (rng, list) => {
  const options = shuffle(rng, list).map((o, i) => ({ ...o, id: LETTERS[i], label: LETTERS[i] }));
  return { options, answer: options.find(o => o.correct).id };
};
const swatchOf = (colour, name) => ({ type: 'swatch', colour, name });

// ---------- colour arithmetic (sRGB) ----------
export const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
export function hslToRgb(h, s, l) {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map(v => Math.round(v * 255));
}
const linear = c => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export const luminance = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
export const contrastRatio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

// ---------- light and ink ----------
export const PRIMARIES = Object.freeze({
  light: { names: ['red', 'green', 'blue'], rgb: { red: [255, 0, 0], green: [0, 255, 0], blue: [0, 0, 255] } },
  ink: { names: ['cyan', 'magenta', 'yellow'], rgb: { cyan: [0, 255, 255], magenta: [255, 0, 255], yellow: [255, 255, 0] } },
});
export const NAMED = Object.freeze({ red: [255, 0, 0], green: [0, 255, 0], blue: [0, 0, 255], cyan: [0, 255, 255], magenta: [255, 0, 255], yellow: [255, 255, 0], white: [255, 255, 255], black: [0, 0, 0] });
// Light adds channels; ink multiplies what each ink lets through.
export function mixLight(names) { return [0, 1, 2].map(c => Math.min(255, names.reduce((s, n) => s + NAMED[n][c], 0))); }
export function mixInk(names) { return [0, 1, 2].map(c => names.reduce((s, n) => s * NAMED[n][c] / 255, 255)); }
export const nameOf = rgb => Object.entries(NAMED).find(([, v]) => v.every((x, i) => x === Math.round(rgb[i])))?.[0] ?? null;

export function lightInkQuestion(seed) {
  return retry(seed, rng => {
    const system = pick(rng, ['light', 'ink']), all = PRIMARIES[system].names;
    const used = rng() < 0.25 ? all : shuffle(rng, all).slice(0, 2);
    const right = nameOf(system === 'light' ? mixLight(used) : mixInk(used));
    const pool = shuffle(rng, Object.keys(NAMED).filter(n => n !== right && !used.includes(n)));
    const wrong = [...new Set([system === 'light' ? (used.length === 3 ? 'black' : null) : (used.length === 3 ? 'white' : null), ...pool])].filter(n => n && n !== right).slice(0, 3);
    const reasonWrong = n => system === 'light' ? (n === 'black' ? 'Black is the absence of light. Adding lights only ever makes it brighter.' : `Light adds: ${used.join(' + ')} switches on ${right}, not ${n}.`) : (n === 'white' ? 'White is no ink at all. Every ink you add takes light away.' : `Each ink removes one primary of light; ${used.join(' and ')} together leave ${right}, not ${n}.`);
    const { options, answer } = lettered(rng, [right, ...wrong].map(n => ({ correct: n === right, figure: swatchOf(toHex(NAMED[n]), n), reason: n === right ? (system === 'light' ? `Coloured lights add: ${used.join(' + ')} = ${right}.` : `Inks subtract: ${used.join(' and ')} together let only ${right} through.`) : reasonWrong(n) })));
    const words = system === 'light' ? `Spotlights of ${used.join(', ').replace(/, ([^,]*)$/, ' and $1')} overlap on a white wall in a dark room.` : `${used.join(', ').replace(/, ([^,]*)$/, ' and $1').replace(/^./, c => c.toUpperCase())} printing inks are laid one over the other on white paper.`;
    return {
      kind: 'light-ink', seed, answerMode: 'single', system, used,
      prompt: `${words} What colour is the overlap?`,
      figures: used.map(n => swatchOf(toHex(NAMED[n]), n)),
      options, answer,
      explanation: system === 'light' ? 'Light mixing is additive: red, green and blue lights add up, and all three make white. Red and green light make yellow.' : 'Ink mixing is subtractive: cyan, magenta and yellow each absorb one primary of light. All three absorb everything and print black.',
    };
  });
}

// ---------- harmonies ----------
export const SCHEMES = Object.freeze({
  complementary: { name: 'Complementary', steps: [0, 6], rule: 'two colours directly across the wheel' },
  analogous: { name: 'Analogous', steps: [0, 1, 2], rule: 'three neighbours in a row' },
  triadic: { name: 'Triadic', steps: [0, 4, 8], rule: 'three colours four steps apart, an equal triangle' },
  split: { name: 'Split-complementary', steps: [0, 5, 7], rule: 'one colour and the two neighbours of its complement' },
  square: { name: 'Square (tetradic)', steps: [0, 3, 6, 9], rule: 'four colours three steps apart' },
});
export function schemeOf(indices) {
  const sorted = [...new Set(indices.map(i => ((i % 12) + 12) % 12))].sort((a, b) => a - b);
  for (const [id, s] of Object.entries(SCHEMES)) {
    if (s.steps.length !== sorted.length) continue;
    for (let r = 0; r < 12; r++) { const set = s.steps.map(x => (x + r) % 12).sort((a, b) => a - b); if (set.join() === sorted.join()) return id; }
  }
  return null;
}
export function harmonyNameQuestion(seed, level = 2) {
  return retry(seed, rng => {
    const pool = level <= 2 ? ['complementary', 'analogous', 'triadic'] : Object.keys(SCHEMES);
    const id = pick(rng, pool), base = Math.floor(rng() * 12), hues = shuffle(rng, SCHEMES[id].steps.map(s => at(base + s)));
    if (schemeOf(hues.map(h => wheel.indexOf(h))) !== id) return null;
    const near = { complementary: ['split', 'square', 'triadic'], analogous: ['triadic', 'split', 'complementary'], triadic: ['split', 'square', 'analogous'], split: ['complementary', 'triadic', 'analogous'], square: ['complementary', 'triadic', 'split'] }[id];
    const others = level <= 2 ? ['complementary', 'analogous', 'triadic', 'split'].filter(x => x !== id).slice(0, 3) : near;
    const idx = hues.map(h => wheel.indexOf(h)).sort((a, b) => a - b);
    const gaps = idx.map((v, i) => (idx[(i + 1) % idx.length] - v + 12) % 12 || 12);
    const { options, answer } = lettered(rng, [id, ...others].map(x => ({ correct: x === id, text: SCHEMES[x].name, reason: x === id ? `The steps round the wheel are ${gaps.join(', ')}: ${SCHEMES[x].rule}.` : `${SCHEMES[x].name} means ${SCHEMES[x].rule}; these are ${gaps.join(', ')} steps apart.` })));
    return {
      kind: 'harmony-name', seed, answerMode: 'single',
      prompt: `A designer picks these ${hues.length} colours from the twelve-step wheel. Which colour scheme is this?`,
      figures: hues.map(h => swatchOf(h.hex, h.name)),
      options, answer,
      explanation: `Place the colours on the wheel and count the steps between them: ${gaps.join(', ')}. That is ${SCHEMES[id].rule}, a ${SCHEMES[id].name.toLowerCase()} scheme.`,
      hints: ['Find each colour on the twelve-step wheel.', 'Count the steps between neighbours all the way round. The pattern of gaps names the scheme.'],
      solution: [{ text: `Wheel positions: ${hues.map(h => `${h.name} ${wheel.indexOf(h) + 1}`).join(', ')} (red = 1).` }, { text: `Gaps going round: ${gaps.join(', ')}.` }, { text: `${SCHEMES[id].name}: ${SCHEMES[id].rule}.` }],
    };
  });
}

// Which wheel diagram marks a valid triad (or split-complementary)?
export function schemeCheckQuestion(seed) {
  return retry(seed, rng => {
    const target = pick(rng, ['triadic', 'triadic', 'split']);
    const goodGaps = target === 'triadic' ? [4, 4, 4] : [5, 2, 5];
    const badGaps = shuffle(rng, target === 'triadic' ? [[3, 4, 5], [3, 3, 6], [2, 5, 5], [4, 5, 3], [5, 5, 2]] : [[4, 4, 4], [6, 1, 5], [4, 2, 6], [5, 3, 4], [3, 3, 6]]).filter(g => schemeOf(marksFrom(0, g)) !== target);
    const sets = [goodGaps, ...badGaps.slice(0, 3)].map(g => marksFrom(Math.floor(rng() * 12), shuffle(rng, g)));
    const ok = sets.map(s => schemeOf(s) === target);
    if (ok.filter(Boolean).length !== 1 || new Set(sets.map(m => [...m].sort((a, b) => a - b).join())).size !== 4) return null;
    const list = sets.map((marks, i) => {
      const s = [...marks].sort((a, b) => a - b), g = s.map((v, j) => (s[(j + 1) % 3] - v + 12) % 12);
      return { correct: ok[i], figure: { type: 'wheel-marks', marks }, reason: ok[i] ? `Gaps ${g.join(', ')}: ${SCHEMES[target].rule}.` : `Gaps ${g.join(', ')} round the wheel: not ${SCHEMES[target].rule}.` };
    });
    const { options, answer } = lettered(rng, list);
    return {
      kind: 'scheme-check', seed, answerMode: 'single',
      prompt: `Each wheel marks three colours. Which one marks a ${SCHEMES[target].name.toLowerCase()} scheme?`,
      figures: [], options, answer,
      explanation: `Count the steps between the marks going round. ${target === 'triadic' ? 'A triad needs three equal gaps of 4: an equilateral triangle.' : 'A split complement needs gaps of 5, 2 and 5: one colour and the two neighbours of its complement.'}`,
      hints: ['Number the twelve segments and count the gaps between the marks going round.'],
      solution: [{ text: target === 'triadic' ? 'Triad: gaps 4, 4, 4.' : 'Split-complementary: gaps 5, 2, 5.' }, ...options.map(o => ({ text: `${o.label}: ${o.reason}` }))],
    };
  });
}
function marksFrom(start, gaps) { const out = [start]; for (const g of gaps.slice(0, -1)) out.push((out[out.length - 1] + g) % 12); return out; }

// A walk round the wheel with one colour missing.
export function analogousRunQuestion(seed, level = 2) {
  return retry(seed, rng => {
    const step = level >= 3 ? pick(rng, [2, -2, 1, -1]) : pick(rng, [1, -1]), start = Math.floor(rng() * 12), len = 5;
    const run = Array.from({ length: len }, (_, i) => at(start + i * step)), missing = 1 + Math.floor(rng() * (len - 2)), right = run[missing];
    const used = new Set(run.map(h => h.id));
    const tempting = [at(start + missing * step + 6), at(start + missing * step - step / Math.abs(step)), at(start + missing * step + step / Math.abs(step))].filter(h => !used.has(h.id) && h.id !== right.id);
    const fill = shuffle(rng, wheel.filter(h => !used.has(h.id) && h.id !== right.id));
    const wrong = [...new Set([...tempting, ...fill])].slice(0, 3);
    if (wrong.length < 3) return null;
    const { options, answer } = lettered(rng, [right, ...wrong].map(h => ({ correct: h === right, figure: swatchOf(h.hex, h.name), reason: h === right ? `It sits ${Math.abs(step)} step${Math.abs(step) > 1 ? 's' : ''} on from ${run[missing - 1].name} and before ${run[missing + 1].name}.` : `${h.name} does not sit between ${run[missing - 1].name} and ${run[missing + 1].name} at this spacing.` })));
    return {
      kind: 'analogous-run', seed, answerMode: 'single',
      prompt: `These colours walk round the wheel in even steps. Which colour fills the gap?`,
      figures: run.map((h, i) => (i === missing ? { type: 'swatch', colour: 'transparent', name: 'missing' } : swatchOf(h.hex, h.name))),
      options, answer,
      explanation: `Each colour is ${Math.abs(step)} step${Math.abs(step) > 1 ? 's' : ''} ${step > 0 ? 'clockwise (red towards yellow)' : 'anticlockwise (red towards violet)'} from the one before, so ${right.name} fills the gap.`,
      hints: ['Find the direction of the walk: towards yellow, or towards violet?', 'Count how many wheel steps lie between two known neighbours.'],
      solution: [{ text: `Known colours: ${run.map((h, i) => (i === missing ? '?' : h.name)).join(', ')}.` }, { text: `Each step moves ${Math.abs(step)} place${Math.abs(step) > 1 ? 's' : ''} round the wheel.` }, { text: `${run[missing - 1].name} moved on ${Math.abs(step)} gives ${right.name}.` }],
    };
  });
}

// left neighbour / centre / right neighbour, matched to a new centre
export function neighbourAnalogyQuestion(seed) {
  return retry(seed, rng => {
    const a = Math.floor(rng() * 12), b = Math.floor(rng() * 12), dir = pick(rng, [1, -1]);
    if (gap(a, b) < 3) return null;
    const trio = c => [at(c - dir), at(c), at(c + dir)].map(h => h.name).join(' / ');
    const right = trio(b);
    const wrongs = [[at(b + dir), at(b), at(b - dir)], [at(b - 2 * dir), at(b), at(b + 2 * dir)], [at(b + 6 - dir), at(b), at(b + 6 + dir)], [at(b - dir), at(b + 6), at(b + dir)]].map(t => t.map(h => h.name).join(' / '));
    const texts = [...new Set([right, ...shuffle(rng, wrongs)])].slice(0, 4);
    if (texts.length < 4) return null;
    const why = t => t === wrongs[0] ? 'The right neighbours, but in the opposite order.' : t === wrongs[1] ? 'These are two steps away, not immediate neighbours.' : t === wrongs[2] ? 'These are the neighbours of the complement, not of the centre colour.' : 'The centre is the complement, not the colour asked for.';
    const { options, answer } = lettered(rng, texts.map(t => ({ correct: t === right, text: t, reason: t === right ? 'The two immediate neighbours, in the same order as the example.' : why(t) })));
    return {
      kind: 'neighbour-analogy', seed, answerMode: 'single',
      prompt: `${trio(a)} is to ${at(a).name} as which set is to ${at(b).name}?`,
      figures: [at(a - dir), at(a), at(a + dir)].map(h => swatchOf(h.hex, h.name)),
      options, answer,
      explanation: `The example is ${at(a).name} between its two wheel neighbours, ${at(a - dir).name} first. For ${at(b).name} the neighbours in the same order are ${at(b - dir).name} and ${at(b + dir).name}.`,
      hints: ['How far is each outer colour from the centre one?', 'Which side of the wheel does the first colour come from?'],
      solution: [{ text: `${at(a - dir).name} and ${at(a + dir).name} are one step either side of ${at(a).name}.` }, { text: `The first one is ${dir > 0 ? 'the anticlockwise' : 'the clockwise'} neighbour.` }, { text: `For ${at(b).name}: ${right}.` }],
    };
  });
}

// ---------- tint, shade, tone ----------
export function tintShadeQuestion(seed) {
  return retry(seed, rng => {
    const hue = pick(rng, wheel), base = hexToHsl(hue.hex), change = pick(rng, ['tint', 'shade', 'tone', 'hue']);
    const after = { tint: hsl(base.h, base.s, Math.min(0.88, base.l + 0.28)), shade: hsl(base.h, base.s, Math.max(0.16, base.l - 0.26)), tone: hsl(base.h, base.s * 0.3, base.l), hue: at(wheel.indexOf(hue) + pick(rng, [1, -1])).hex }[change];
    const label = { tint: 'A tint: white was added', shade: 'A shade: black was added', tone: 'A tone: grey was added', hue: 'A new hue: a neighbouring colour' };
    const { options, answer } = lettered(rng, Object.keys(label).map(k => ({ correct: k === change, text: label[k], reason: k === change ? `${{ tint: 'Lighter, same hue, still as pure.', shade: 'Darker, same hue.', tone: 'Same lightness and hue, but greyer and duller.', hue: 'The hue itself moved round the wheel.' }[k]}` : `${{ tint: 'A tint is lighter than the original.', shade: 'A shade is darker than the original.', tone: 'A tone keeps the lightness but loses purity.', hue: 'The hue has not moved; only lightness or purity changed.' }[k]}` })));
    return {
      kind: 'tint-shade-tone', seed, answerMode: 'single',
      prompt: `The first swatch was changed into the second. What was done?`,
      figures: [swatchOf(hue.hex, `${hue.name}, before`), swatchOf(after, 'after')],
      options, answer,
      explanation: 'White lightens a colour (a tint), black darkens it (a shade), and grey dulls it without much change in lightness (a tone). Changing the hue moves round the wheel.',
    };
  });
}

// ---------- black and white film through a colour filter ----------
export function filterPhotoQuestion(seed) {
  return retry(seed, rng => {
    const main = [0, 2, 4, 6, 8, 10], f = pick(rng, main), filter = at(f), askDark = rng() < 0.6;
    const others = shuffle(rng, [1, 2, 3, 4, 5].flatMap(d => [f + d, f - d])).filter((v, i, l) => l.findIndex(w => at(w).id === at(v).id) === i);
    const picks = [f + 6, f, ...others.slice(0, 2)].map(at);
    if (new Set(picks.map(h => h.id)).size < 4) return null;
    const right = askDark ? at(f + 6) : filter;
    const dist = h => gap(wheel.indexOf(h), f);
    const { options, answer } = lettered(rng, picks.map(h => ({ correct: h === right, figure: swatchOf(h.hex, h.name), reason: h === right ? (askDark ? `${h.name} is the complement of the ${filter.name} filter, so almost none of its light gets through.` : `The ${filter.name} filter passes ${h.name} light freely.`) : `${h.name} is ${dist(h)} step${dist(h) === 1 ? '' : 's'} from ${filter.name}: ${askDark ? 'some of its light still passes' : 'the filter holds back part of it'}.` })));
    return {
      kind: 'filter-photo', seed, answerMode: 'single', filter: filter.id,
      prompt: `Four objects of these colours are photographed on black and white film through a ${filter.name} filter. Which object comes out ${askDark ? 'darkest' : 'lightest'}?`,
      figures: [swatchOf(filter.hex, `${filter.name} filter`)],
      options, answer,
      explanation: `A filter lets its own colour through and blocks its complement. Through ${filter.name}, ${filter.name} objects print light and ${at(f + 6).name} objects, its complement, print darkest.`,
      hints: ['What does a coloured filter let through?', 'Find the complement of the filter colour.'],
      solution: [{ text: `The filter passes ${filter.name} light.` }, { text: `Its complement, ${at(f + 6).name}, is blocked most.` }, { text: `So ${right.name} prints ${askDark ? 'darkest' : 'lightest'}.` }],
    };
  });
}

// ---------- reading colour codes ----------
export const CODES = Object.freeze([
  ['red', [255, 0, 0]], ['orange', [255, 128, 0]], ['yellow', [255, 255, 0]], ['bright green', [0, 255, 0]], ['cyan', [0, 255, 255]], ['blue', [0, 0, 255]],
  ['magenta', [255, 0, 255]], ['purple', [128, 0, 128]], ['navy blue', [0, 0, 128]], ['maroon', [128, 0, 0]], ['olive', [128, 128, 0]], ['teal', [0, 128, 128]],
  ['brown', [128, 64, 0]], ['pink', [255, 160, 192]], ['white', [255, 255, 255]], ['black', [0, 0, 0]], ['light grey', [204, 204, 204]], ['dark grey', [64, 64, 64]],
]);
const rgbDistance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function codeReadQuestion(seed, level = 3) {
  return retry(seed, rng => {
    const [name, rgb] = pick(rng, level >= 4 ? CODES.filter(([n]) => n !== 'white' && n !== 'black') : CODES);
    const near = CODES.filter(([n]) => n !== name).sort((a, b) => rgbDistance(a[1], rgb) - rgbDistance(b[1], rgb));
    const wrong = level >= 4 ? near.slice(0, 3) : shuffle(rng, near.slice(0, 6)).slice(0, 3);
    const code = level >= 4 ? toHex(rgb).toUpperCase() : `R ${rgb[0]}, G ${rgb[1]}, B ${rgb[2]}`;
    const read = c => c.map((v, i) => `${'RGB'[i]} ${v === 255 ? 'full' : v === 0 ? 'off' : v >= 192 ? 'high' : v >= 96 ? 'half' : 'low'}`).join(', ');
    const { options, answer } = lettered(rng, [[name, rgb], ...wrong].map(([n, c]) => ({ correct: n === name, text: n, reason: n === name ? `${read(rgb)}.` : `${n} would be about ${level >= 4 ? toHex(c).toUpperCase() : `R ${c[0]}, G ${c[1]}, B ${c[2]}`}: ${read(c)}.` })));
    return {
      kind: 'code-read', seed, answerMode: 'single',
      prompt: `On screen, a colour is set to ${code}. Which colour is it?`,
      figures: [], options, answer,
      explanation: `${level >= 4 ? 'Each pair of hex digits is one channel from 00 (off) to FF (full, 255); 80 is about half. ' : ''}Screens mix red, green and blue light: ${read(rgb)} gives ${name}.`,
      hints: [level >= 4 ? 'Split the code into three pairs: red, green, blue. FF is full, 80 is half, 00 is off.' : 'Read each channel as off, half or full.', 'Red and green light together make yellow; half green with full red makes orange. Equal channels make a grey.'],
      solution: [{ text: `Channels: ${rgb.map((v, i) => `${'RGB'[i]} = ${v}`).join(', ')}.` }, { text: `In words: ${read(rgb)}.` }, { text: `That light mix is ${name}.` }],
    };
  });
}
export function hexGreyQuestion(seed) {
  return retry(seed, rng => {
    const v = pick(rng, [0x33, 0x66, 0x80, 0x99, 0xcc]), white = Math.round(v / 255 * 100), code = toHex([v, v, v]).toUpperCase();
    const pct = [white, 100 - white, ...[20, 40, 50, 60, 80].filter(x => x !== white && x !== 100 - white)];
    const list = [...new Set(pct)].slice(0, 4).map(x => ({ correct: x === white, text: `${x}% white, ${100 - x}% black`, reason: x === white ? `${v} out of 255 is ${white}% of full brightness.` : x === 100 - white ? 'Turned the wrong way round: a bigger number is lighter, so it holds more white.' : `${code.slice(1, 3)} in hex is ${v}, which is ${white}% of 255, not ${x}%.` }));
    if (list.length < 4) return null;
    const { options, answer } = lettered(rng, list);
    return {
      kind: 'hex-grey', seed, answerMode: 'single',
      prompt: `A grey is written ${code}. Mixed from white and black paint, which mix gives this grey?`,
      figures: [], options, answer,
      explanation: `Equal red, green and blue make a grey. ${code.slice(1, 3)} in hex is ${v}; ${v} ÷ 255 = ${white}% of full brightness, so about ${white}% white and ${100 - white}% black.`,
      hints: ['Equal channels mean a grey. Convert one pair of hex digits to a number.', 'Divide by 255 to get the share of white.'],
      solution: [{ text: `${code.slice(1, 3)} = ${Math.floor(v / 16)} × 16 + ${v % 16} = ${v}.` }, { text: `${v} ÷ 255 ≈ ${white}%.` }, { text: `${white}% white and ${100 - white}% black.` }],
    };
  });
}
// R = 255 (1 − C)(1 − K), likewise G from M and B from Y
export const cmykToRgb = ([c, m, y, k]) => [c, m, y].map(v => 255 * (1 - v / 100) * (1 - k / 100));
export function cmykChannelQuestion(seed) {
  return retry(seed, rng => {
    const vals = [0, 20, 40, 50, 60, 80, 100];
    const cmyk = [pick(rng, vals), pick(rng, vals), pick(rng, vals), pick(rng, [0, 20, 50, 60, 80])];
    const ch = Math.floor(rng() * 3), rgb = cmykToRgb(cmyk), value = rgb[ch];
    if (!Number.isInteger(Math.round(value * 1e6) / 1e6) || value === 0 || value === 255 || cmyk[3] === 0 && rng() < 0.7) return null;
    const ink = cmyk[ch], names = ['cyan', 'magenta', 'yellow'], chName = ['red', 'green', 'blue'][ch];
    const mistakes = [{ value: 255 * (1 - ink / 100), reason: 'Black ink darkens every channel too: multiply by (1 − K) as well.' }, { value: 255 * ink / 100 * (1 - cmyk[3] / 100), reason: `Ink takes light away: use 1 − ${ink}% for the ${names[ch]}, not ${ink}%.` }, { value: Math.max(0, 255 * (1 - ink / 100 - cmyk[3] / 100)), reason: 'Ink and black multiply; they do not simply add.' }].map(m => ({ ...m, value: Math.round(m.value) })).filter((m, i, l) => m.value !== Math.round(value) && l.findIndex(o => o.value === m.value) === i);
    return {
      kind: 'cmyk-channel', seed, answerMode: 'numeric', unit: '', cmyk,
      prompt: `A print colour is C ${cmyk[0]}%, M ${cmyk[1]}%, Y ${cmyk[2]}%, K ${cmyk[3]}%. Converted to screen colour with ${chName[0].toUpperCase()} = 255 × (1 − ${names[ch][0].toUpperCase()}) × (1 − K), what is the ${chName} value?`,
      figures: [{ type: 'swatch', colour: toHex(rgb), name: 'the print colour' }],
      answer: { value: Math.round(value) }, mistakes,
      explanation: `${names[ch]} ink absorbs ${chName} light, and black absorbs everything. ${chName[0].toUpperCase()} = 255 × ${(1 - ink / 100).toFixed(1)} × ${(1 - cmyk[3] / 100).toFixed(1)} = ${Math.round(value)}.`,
      hints: [`${names[ch].replace(/^./, c => c.toUpperCase())} ink controls the ${chName} channel.`, 'Turn each percentage into a share left over: 1 − 0.4 = 0.6, and so on.'],
      solution: [{ text: `${names[ch][0].toUpperCase()} = ${ink}%, so 1 − ${ink / 100} = ${(1 - ink / 100).toFixed(1)}.` }, { text: `K = ${cmyk[3]}%, so 1 − ${cmyk[3] / 100} = ${(1 - cmyk[3] / 100).toFixed(1)}.` }, { text: `255 × ${(1 - ink / 100).toFixed(1)} × ${(1 - cmyk[3] / 100).toFixed(1)} = ${Math.round(value)}.` }],
    };
  });
}

// ---------- paint proportions ----------
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export const fraction = (n, d) => { const g = gcd(n, d); return `${n / g}/${d / g}`; };
export function paintShareQuestion(seed) {
  return retry(seed, rng => {
    const recipes = [[1, 1, 1], [1, 1, 0], [0, 1, 1], [1, 0, 1], [1, 2, 0], [0, 2, 1], [2, 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1], [1, 1, 2], [2, 1, 1]];
    const pots = Array.from({ length: 2 + Math.floor(rng() * 2) }, () => pick(rng, recipes)), colour = pick(rng, [0, 1, 2]);
    const totals = pots.map(p => p[0] + p[1] + p[2]);
    // Equal volumes: average the share of the colour in each pot. Lowest common denominator.
    const den = totals.reduce((a, t) => (a * t) / gcd(a, t), 1) * pots.length;
    const num = pots.reduce((s, p, i) => s + p[colour] * (den / pots.length / totals[i]), 0);
    const right = fraction(num, den);
    const pooledN = pots.reduce((s, p) => s + p[colour], 0), pooledD = totals.reduce((a, b) => a + b, 0);
    const pooled = fraction(pooledN, pooledD);
    if (pooled === right || num === 0 || num === den) return null;
    const cand = [right, pooled, fraction(pots.filter(p => p[colour]).length, pots.length)].filter(t => t !== '1/1');
    const extras = ['1/3', '1/2', '2/3', '1/4', '3/4', '5/9', '4/9', '2/9', '1/6', '5/12', '7/12'];
    const texts = [...new Set([...cand, ...shuffle(rng, extras)])].filter(t => t !== '0/1').slice(0, 4);
    const names = ['red', 'yellow', 'blue'];
    const { options, answer } = lettered(rng, texts.map(t => ({ correct: t === right, text: t, reason: t === right ? 'Each pot is the same size, so average the share of the colour in each pot.' : t === pooled ? 'This adds the parts as if every part were the same size, but the pots hold equal amounts, not equal parts.' : 'This does not follow from the shares in each pot.' })));
    const desc = p => p.map((n, i) => (n ? `${n} part${n > 1 ? 's' : ''} ${names[i]}` : null)).filter(Boolean).join(' : ');
    return {
      kind: 'paint-share', seed, answerMode: 'single', pots, colour,
      prompt: `${pots.length} pots hold the same amount of paint each. Pot by pot, they are mixed as: ${pots.map((p, i) => `pot ${i + 1}, ${desc(p)}`).join('; ')}. All the pots are poured together. What share of the final mix is ${names[colour]}?`,
      figures: [{ type: 'table', head: ['Pot', 'Red', 'Yellow', 'Blue'], rows: pots.map((p, i) => [String(i + 1), ...p.map(String)]) }],
      options, answer,
      explanation: `Each pot is ${fraction(1, pots.length)} of the whole. The ${names[colour]} share is the average of ${pots.map((p, i) => fraction(p[colour], totals[i]).replace(/^0\/\d+$/, '0')).join(', ')}, which is ${right}.`,
      hints: ['Work out the share of the colour inside each pot first.', 'The pots are the same size, so the final share is the average of those shares.'],
      solution: [...pots.map((p, i) => ({ text: `Pot ${i + 1}: ${p[colour]} of ${totals[i]} parts is ${names[colour]}.` })), { text: `Average: (${pots.map((p, i) => fraction(p[colour], totals[i]).replace(/^0\/\d+$/, '0')).join(' + ')}) ÷ ${pots.length} = ${right}.` }],
    };
  });
}

// ---------- same value across hues ----------
export function colourAtLuminance(h, s, target) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (luminance(hslToRgb(h, s, mid)) < target) lo = mid; else hi = mid; }
  return hslToRgb(h, s, (lo + hi) / 2);
}
export function sameValueQuestion(seed) {
  return retry(seed, rng => {
    const hues = shuffle(rng, wheel).slice(0, 5), target = 0.12 + rng() * 0.3, ref = hues[0];
    const s = 0.75, refRgb = colourAtLuminance(hexToHsl(ref.hex).h, s, target);
    const shifts = shuffle(rng, [0, pick(rng, [0.07, 0.1]), -pick(rng, [0.05, 0.07]), pick(rng, [0.14, 0.2, -0.09])]);
    const list = hues.slice(1).map((h, i) => { const rgb = colourAtLuminance(hexToHsl(h.hex).h, s, target + shifts[i]); return { rgb, h, y: luminance(rgb) }; });
    const ys = list.map(x => x.y), refY = luminance(refRgb);
    const best = ys.map(y => Math.abs(y - refY));
    const correctIndex = best.indexOf(Math.min(...best));
    if (best[correctIndex] > 0.005 || best.some((d, i) => i !== correctIndex && d < 0.04) || gap(wheel.indexOf(ref), wheel.indexOf(list[correctIndex].h)) < 3) return null;
    const { options, answer } = lettered(rng, list.map((x, i) => ({ correct: i === correctIndex, figure: swatchOf(toHex(x.rgb), x.h.name), reason: i === correctIndex ? `It reflects the same share of light as the ${ref.name}: about ${Math.round(x.y * 100)}%.` : `It would print ${x.y > refY ? 'lighter' : 'darker'}: about ${Math.round(x.y * 100)}% against ${Math.round(refY * 100)}%.` })));
    return {
      kind: 'same-value', seed, answerMode: 'single',
      prompt: `Printed in black and white, which of these colours gives exactly the same grey as the ${ref.name} swatch?`,
      figures: [swatchOf(toHex(refRgb), `${ref.name}, reference`)],
      options, answer,
      explanation: 'Value is lightness, and it is independent of hue. Squint, or imagine a black and white photograph: yellows are naturally light and blues naturally dark, so a darker yellow can match a lighter blue.',
      hints: ['Ignore the hue. Ask only how light each colour is.', 'Yellow and green look light for their purity; blue and violet look dark.'],
      solution: [{ text: `The reference reflects about ${Math.round(refY * 100)}% of light.` }, ...options.map(o => ({ text: `${o.label}: ${o.reason}` }))],
    };
  });
}

// ---------- text contrast ----------
export function contrastQuestion(seed, level = 3) {
  return retry(seed, rng => {
    const palette = [...wheel.map(h => [h.name, hexToRgb(h.hex)]), ['white', [255, 255, 255]], ['black', [0, 0, 0]], ['light grey', [210, 210, 210]], ['dark grey', [70, 70, 70]], ['navy', [20, 30, 90]], ['cream', [250, 240, 210]]];
    const pairs = [];
    for (let i = 0; i < 40 && pairs.length < 4; i++) {
      const fg = pick(rng, palette), bg = pick(rng, palette);
      if (fg[0] === bg[0] || pairs.some(p => p.fg[0] === fg[0] && p.bg[0] === bg[0])) continue;
      pairs.push({ fg, bg, ratio: contrastRatio(fg[1], bg[1]) });
    }
    if (pairs.length < 4) return null;
    const sorted = [...pairs].sort((a, b) => b.ratio - a.ratio);
    const [best, next] = sorted;
    if (level <= 3 ? best.ratio < 7 || next.ratio > 4.5 : best.ratio < 4.5 || best.ratio / next.ratio > 1.8 || best.ratio / next.ratio < 1.25) return null;
    const { options, answer } = lettered(rng, pairs.map(p => ({ correct: p === best, figure: { type: 'text-swatch', fg: toHex(p.fg[1]), bg: toHex(p.bg[1]), name: `${p.fg[0]} text on ${p.bg[0]}` }, reason: `${p.fg[0]} on ${p.bg[0]}: contrast about ${p.ratio.toFixed(1)} to 1${p === best ? ', the strongest here.' : '.'}` })));
    return {
      kind: 'contrast-pick', seed, answerMode: 'single',
      prompt: 'A signboard must be read from far away. Which text and background pair is easiest to read?',
      figures: [], options, answer,
      explanation: 'Legibility depends on the difference in lightness (value) between text and background, not on how different the hues are. Two colours of similar value vibrate and blur, however bright they are.',
      hints: ['Picture each pair in black and white.', 'The pair with the biggest difference in lightness wins, even if the hues are dull.'],
      solution: [{ text: 'Compare the lightness of text and background in each pair.' }, ...options.map(o => ({ text: `${o.label}: ${o.reason}` }))],
    };
  });
}
export const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

// ---------- filters and coloured light (channel sets) ----------
export const CHANNELS = Object.freeze({ red: 'r', green: 'g', blue: 'b', yellow: 'rg', cyan: 'gb', magenta: 'rb', white: 'rgb', black: '' });
const chOf = x => CHANNELS[x] ?? x;
const both = (a, b) => [...chOf(a)].filter(c => chOf(b).includes(c)).join('');
const named = ch => Object.keys(CHANNELS).find(n => CHANNELS[n] === ['r', 'g', 'b'].filter(c => ch.includes(c)).join(''));
export function filterLightQuestion(seed, level = 3) {
  return retry(seed, rng => {
    const colours = ['red', 'green', 'blue', 'yellow', 'cyan', 'magenta'];
    const form = level >= 4 ? 'three' : pick(rng, ['sheets', 'object']);
    const a = pick(rng, colours), b = pick(rng, colours), c = pick(rng, colours);
    if (a === b) return null;
    let right, prompt, steps, figures;
    if (form === 'sheets') {
      right = named(both(a, b)); figures = [swatchOf(toHex(NAMED[a] ?? [255, 255, 255]), `${a} sheet`), swatchOf(toHex(NAMED[b] ?? [255, 255, 255]), `${b} sheet`)];
      prompt = `White light shines through a transparent ${a} sheet laid over a transparent ${b} sheet. What colour is the light that comes through both?`;
      steps = [`The ${a} sheet passes ${CHANNELS[a].split('').map(x => ({ r: 'red', g: 'green', b: 'blue' })[x]).join(' and ')} light.`, `The ${b} sheet passes ${CHANNELS[b].split('').map(x => ({ r: 'red', g: 'green', b: 'blue' })[x]).join(' and ')} light.`, `Only what both pass gets through: ${right}.`];
    } else if (form === 'object') {
      right = named(both(a, b)); figures = [swatchOf(toHex(NAMED[a]), `${a} object in white light`), swatchOf(toHex(NAMED[b] ?? [255, 255, 255]), `${b} light`)];
      prompt = `An object looks ${a} in white light. In a dark room it is lit only by ${b} light. What colour does it look?`;
      steps = [`A ${a} object reflects ${CHANNELS[a].split('').map(x => ({ r: 'red', g: 'green', b: 'blue' })[x]).join(' and ')} light.`, `${b.replace(/^./, m => m.toUpperCase())} light contains ${CHANNELS[b].split('').map(x => ({ r: 'red', g: 'green', b: 'blue' })[x]).join(', ')}.`, `It can only reflect what it receives and what it reflects: ${right}.`];
    } else {
      if (c === a || c === b) return null;
      right = named(both(both(a, b), c)); figures = [swatchOf(toHex(NAMED[a]), `${a} object`), swatchOf(toHex(NAMED[b] ?? [255, 255, 255]), `${b} light`), swatchOf(toHex(NAMED[c]), `${c} glasses`)];
      prompt = `An object that looks ${a} in white light is lit only by ${b} light and seen through ${c} glasses. What colour does it look?`;
      steps = [`Reflected light: what the ${a} object reflects out of the ${b} light, ${named(both(a, b))}.`, `The ${c} glasses pass ${CHANNELS[c].split('').map(x => ({ r: 'red', g: 'green', b: 'blue' })[x]).join(' and ')}.`, `What reaches the eye: ${right}.`];
      if (right === 'black' && rng() < 0.85) return null;
    }
    if (right === 'black' && rng() < 0.4) return null;
    const naive = form === 'sheets' ? nameOf(mixLight([a, b].filter(n => ['red', 'green', 'blue'].includes(n)))) : b === 'white' ? null : b;
    const pool = [naive, form === 'sheets' ? null : a, 'black', 'white', ...shuffle(rng, colours)].filter((n, i, l) => n && n !== right && l.indexOf(n) === i).slice(0, 3);
    const why = n => n === 'black' ? 'Some light does get through: the two share a colour of light.' : n === b && form !== 'sheets' ? 'That is the colour of the light, but the object cannot reflect all of it.' : n === a ? 'That is its colour in white light only.' : n === 'white' ? 'Filters and objects only take light away; they never add it.' : `${n} light is not passed by both.`;
    const { options, answer } = lettered(rng, [right, ...pool].map(n => ({ correct: n === right, figure: swatchOf(toHex(NAMED[n]), n), reason: n === right ? steps[steps.length - 1] : why(n) })));
    return {
      kind: 'filter-light', seed, answerMode: 'single', form, colours: [a, b, c],
      prompt, figures, options, answer,
      explanation: 'Think in red, green and blue light. Each sheet, object or lens only passes or reflects its own part of the light, so only the parts every one of them shares reach the eye. Nothing shared means black.',
      hints: ['Write each colour as red, green and blue light: yellow is red + green, cyan is green + blue, magenta is red + blue.', 'Keep only the parts every sheet, object or lens lets through.'],
      solution: steps.map(text => ({ text })),
    };
  });
}

export function colourExamQuestion(seed, kind, level) {
  switch (kind) {
    case 'light-ink': return lightInkQuestion(seed);
    case 'harmony-name': return harmonyNameQuestion(seed, level);
    case 'scheme-check': return schemeCheckQuestion(seed);
    case 'analogous-run': return analogousRunQuestion(seed, level);
    case 'neighbour-analogy': return neighbourAnalogyQuestion(seed);
    case 'tint-shade-tone': return tintShadeQuestion(seed);
    case 'filter-photo': return filterPhotoQuestion(seed);
    case 'code-read': return codeReadQuestion(seed, level);
    case 'hex-grey': return hexGreyQuestion(seed);
    case 'cmyk-channel': return cmykChannelQuestion(seed);
    case 'paint-share': return paintShareQuestion(seed);
    case 'same-value': return sameValueQuestion(seed);
    case 'contrast-pick': return contrastQuestion(seed, level);
    case 'filter-light': return filterLightQuestion(seed, level);
    default: throw new Error('Unknown colour kind ' + kind);
  }
}
export const COLOUR_EXAM_KINDS = Object.freeze({
  'light-ink': [2], 'harmony-name': [2, 3], 'tint-shade-tone': [2], 'analogous-run': [2, 3],
  'scheme-check': [3], 'neighbour-analogy': [3], 'filter-photo': [3], 'code-read': [3, 4], 'hex-grey': [3], 'contrast-pick': [3, 4], 'filter-light': [3, 4],
  'cmyk-channel': [4], 'paint-share': [4], 'same-value': [4],
});
