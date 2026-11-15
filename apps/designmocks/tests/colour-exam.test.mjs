// Every colour answer is checked by a second method that does not reuse the
// engine's own arithmetic: channel sets for light and ink, angle gaps for
// harmonies, parsed codes for RGB, hex and CMYK, exact fractions for paint
// and a separate luminance formula for value and contrast.
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLOUR_EXAM_KINDS, colourExamQuestion } from '../src/learn/colour-exam.js';

const WHEEL = ['red', 'red-orange', 'orange', 'yellow-orange', 'yellow', 'yellow-green', 'green', 'blue-green', 'blue', 'blue-violet', 'violet', 'red-violet'];
const pos = name => WHEEL.indexOf(name.replace(/,.*$/, '').replace(/ filter$/, ''));
const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
const correctOption = q => q.options.find(o => o.id === q.answer);

function hexRgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
function anyRgb(colour) {
  if (colour.startsWith('#')) return hexRgb(colour);
  const [h, s, l] = colour.match(/[\d.]+/g).map(Number);
  const S = s / 100, L = l / 100, C = (1 - Math.abs(2 * L - 1)) * S, X = C * (1 - Math.abs(((h / 60) % 2) - 1)), m = L - C / 2;
  const [r, g, b] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
  return [r, g, b].map(v => Math.round((v + m) * 255));
}
function hslOf(colour) {
  const [r, g, b] = anyRgb(colour).map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max !== min) h = max === r ? 60 * (((g - b) / (max - min) + 6) % 6) : max === g ? 60 * ((b - r) / (max - min) + 2) : 60 * ((r - g) / (max - min) + 4);
  return { h, s, l };
}
// Relative luminance written out from the sRGB definition, by table lookup.
const LIN = Array.from({ length: 256 }, (_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
const lum = ([r, g, b]) => 0.2126 * LIN[r] + 0.7152 * LIN[g] + 0.0722 * LIN[b];

test('every kind builds valid questions at every level', () => {
  for (const [kind, levels] of Object.entries(COLOUR_EXAM_KINDS)) for (const level of levels) for (const seed of seeds) {
    const q = colourExamQuestion(seed, kind, level);
    assert.equal(q.kind, kind);
    if (q.answerMode === 'numeric') { assert.ok(Number.isInteger(q.answer.value)); for (const m of q.mistakes) { assert.notEqual(m.value, q.answer.value); assert.ok(m.reason.length > 10); } continue; }
    assert.equal(q.options.length, 4, `${kind} ${seed}`);
    assert.equal(q.options.filter(o => o.correct).length, 1, `${kind} ${seed}`);
    assert.equal(new Set(q.options.map(o => o.text ?? `${o.figure.type}:${o.figure.colour ?? o.figure.marks?.slice().sort((a, b) => a - b).join() ?? o.figure.name}`)).size, 4, `${kind} ${seed} duplicate options`);
    assert.ok(correctOption(q).correct);
    if (level >= 3 && q.hints) { assert.ok(q.hints.length >= 1); assert.ok(q.solution.length >= 3); }
  }
});

test('light adds channels and ink removes them', () => {
  const lightChannels = { red: 'r', green: 'g', blue: 'b' }, inkRemoves = { cyan: 'r', magenta: 'g', yellow: 'b' };
  const byChannels = { '': 'black', r: 'red', g: 'green', b: 'blue', rg: 'yellow', gb: 'cyan', rb: 'magenta', rgb: 'white' };
  for (const seed of seeds) {
    const q = colourExamQuestion(seed, 'light-ink', 2);
    const on = q.system === 'light' ? new Set(q.used.map(n => lightChannels[n])) : new Set(['r', 'g', 'b'].filter(c => !q.used.some(n => inkRemoves[n] === c)));
    assert.equal(correctOption(q).figure.name, byChannels[['r', 'g', 'b'].filter(c => on.has(c)).join('')]);
  }
});

const gapsOf = names => { const a = names.map(n => pos(n) * 30).sort((x, y) => x - y); return a.map((v, i) => ((a[(i + 1) % a.length] - v + 360) % 360) || 360).sort((x, y) => x - y).join(); };
const NAMED_GAPS = { Complementary: '180,180', Analogous: '30,30,300', Triadic: '120,120,120', 'Split-complementary': '60,150,150', 'Square (tetradic)': '90,90,90,90' };
test('harmonies match the angle gaps between the colours', () => {
  for (const level of [2, 3]) for (const seed of seeds) {
    const q = colourExamQuestion(seed, 'harmony-name', level);
    assert.equal(gapsOf(q.figures.map(f => f.name)), NAMED_GAPS[correctOption(q).text], `seed ${seed}`);
  }
  for (const seed of seeds) {
    const q = colourExamQuestion(seed, 'scheme-check', 3), want = q.prompt.includes('triadic') ? NAMED_GAPS.Triadic : NAMED_GAPS['Split-complementary'];
    for (const o of q.options) assert.equal(gapsOf(o.figure.marks.map(m => WHEEL[m])) === want, o.correct, `seed ${seed} ${o.label}`);
  }
});

test('walks and analogies follow wheel positions', () => {
  for (const level of [2, 3]) for (const seed of seeds) {
    const q = colourExamQuestion(seed, 'analogous-run', level), names = q.figures.map(f => f.name), m = names.indexOf('missing');
    const a = pos(names[m - 1]), b = pos(names[m + 1]), step = ((b - a + 12) % 12) / 2;
    assert.ok(Number.isInteger(step) || Number.isInteger(((a - b + 12) % 12) / 2));
    const fwd = (b - a + 12) % 12, mid = fwd <= 4 ? (a + fwd / 2) % 12 : (a - ((a - b + 12) % 12) / 2 + 12) % 12;
    assert.equal(correctOption(q).figure.name, WHEEL[mid], `seed ${seed}`);
  }
  for (const seed of seeds) {
    const q = colourExamQuestion(seed, 'neighbour-analogy', 3), ex = q.figures.map(f => pos(f.name));
    const dir = (ex[1] - ex[0] + 12) % 12 === 1 ? 1 : -1, centre = pos(q.prompt.match(/is to ([a-z-]+)\?$/)[1]);
    assert.equal(correctOption(q).text, [centre - dir, centre, centre + dir].map(i => WHEEL[(i + 12) % 12]).join(' / '));
  }
});

test('tints are lighter, shades darker, tones greyer and new hues move', () => {
  for (const seed of seeds) {
    const q = colourExamQuestion(seed, 'tint-shade-tone', 2), [before, after] = q.figures.map(f => hslOf(f.colour)), text = correctOption(q).text;
    const hueMoved = Math.min(Math.abs(before.h - after.h), 360 - Math.abs(before.h - after.h)) > 6;
    if (text.startsWith('A tint')) assert.ok(after.l > before.l + 0.1 && !hueMoved);
    else if (text.startsWith('A shade')) assert.ok(after.l < before.l - 0.1 && !hueMoved);
    else if (text.startsWith('A tone')) assert.ok(after.s < before.s - 0.2 && Math.abs(after.l - before.l) < 0.03);
    else assert.ok(hueMoved);
  }
});

test('a filter darkens its complement and lightens its own colour', () => {
  for (const seed of seeds) {
    const q = colourExamQuestion(seed, 'filter-photo', 3), f = pos(q.figures[0].name);
    const dist = o => { const d = Math.abs(pos(o.figure.name) - f) % 12; return Math.min(d, 12 - d); };
    const pickBy = q.prompt.includes('darkest') ? Math.max : Math.min, best = pickBy(...q.options.map(dist));
    assert.equal(dist(correctOption(q)), best);
    assert.equal(q.options.filter(o => dist(o) === best).length, 1);
  }
});

const CODE_TABLE = { red: 'FF0000', orange: 'FF8000', yellow: 'FFFF00', 'bright green': '00FF00', cyan: '00FFFF', blue: '0000FF', magenta: 'FF00FF', purple: '800080', 'navy blue': '000080', maroon: '800000', olive: '808000', teal: '008080', brown: '804000', pink: 'FFA0C0', white: 'FFFFFF', black: '000000', 'light grey': 'CCCCCC', 'dark grey': '404040' };
test('colour codes read back to their names, greys and CMYK values', () => {
  for (const level of [3, 4]) for (const seed of seeds) {
    const q = colourExamQuestion(seed, 'code-read', level);
    const hex = level >= 4 ? q.prompt.match(/#([0-9A-F]{6})/)[1] : q.prompt.match(/R (\d+), G (\d+), B (\d+)/).slice(1).map(v => Number(v).toString(16).toUpperCase().padStart(2, '0')).join('');
    assert.equal(CODE_TABLE[correctOption(q).text], hex);
  }
  for (const seed of seeds) {
    const q = colourExamQuestion(seed, 'hex-grey', 3), v = parseInt(q.prompt.match(/#([0-9A-F]{2})\1\1/)[1], 16);
    assert.equal(correctOption(q).text, `${Math.round(v * 100 / 255)}% white, ${100 - Math.round(v * 100 / 255)}% black`);
  }
  for (const seed of seeds) {
    const q = colourExamQuestion(seed, 'cmyk-channel', 4), [c, m, y, k] = q.prompt.match(/C (\d+)%, M (\d+)%, Y (\d+)%, K (\d+)%/).slice(1).map(Number);
    const ink = { red: c, green: m, blue: y }[q.prompt.match(/what is the (red|green|blue) value/)[1]];
    // Whole-number arithmetic: 255 × (100 − ink) × (100 − K) / 10000
    assert.equal(q.answer.value * 10000, 255 * (100 - ink) * (100 - k));
  }
});

test('paint shares average the pots as exact fractions', () => {
  const g = (a, b) => (b ? g(b, a % b) : a);
  for (const seed of seeds) {
    const q = colourExamQuestion(seed, 'paint-share', 4);
    let n = 0, d = 1;
    for (const p of q.pots) { const pn = p[q.colour], pd = p.reduce((a, b) => a + b, 0); n = n * pd + pn * d; d *= pd; }
    d *= q.pots.length; const k = g(n, d);
    assert.equal(correctOption(q).text, `${n / k}/${d / k}`);
  }
});

test('same value and contrast answers hold under a separate luminance formula', () => {
  for (const seed of seeds) {
    const q = colourExamQuestion(seed, 'same-value', 4), ref = lum(hexRgb(q.figures[0].colour));
    const diffs = q.options.map(o => Math.abs(lum(hexRgb(o.figure.colour)) - ref));
    assert.equal(diffs.indexOf(Math.min(...diffs)), q.options.indexOf(correctOption(q)));
    assert.ok(Math.min(...diffs) < 0.01);
    assert.ok(diffs.filter(x => x < 0.03).length === 1, `seed ${seed}: two options too close`);
  }
  for (const level of [3, 4]) for (const seed of seeds) {
    const q = colourExamQuestion(seed, 'contrast-pick', level);
    const ratio = o => { const [a, b] = [lum(hexRgb(o.figure.fg)), lum(hexRgb(o.figure.bg))].sort((x, y) => y - x); return (a + 0.05) / (b + 0.05); };
    const rs = q.options.map(ratio);
    assert.equal(rs.indexOf(Math.max(...rs)), q.options.indexOf(correctOption(q)));
  }
});

test('sheets, objects and coloured light keep only the light every one passes', () => {
  // Second method: subtractive thinking. Each colour blocks its complement's channels.
  const blocks = { red: ['green', 'blue'], green: ['red', 'blue'], blue: ['red', 'green'], yellow: ['blue'], cyan: ['red'], magenta: ['green'], white: [] };
  const toName = left => ({ 'red,green,blue': 'white', 'red,green': 'yellow', 'green,blue': 'cyan', 'red,blue': 'magenta', red: 'red', green: 'green', blue: 'blue', '': 'black' })[left.join()];
  for (const level of [3, 4]) for (const seed of seeds) {
    const q = colourExamQuestion(seed, 'filter-light', level), used = q.form === 'three' ? q.colours : q.colours.slice(0, 2);
    const left = ['red', 'green', 'blue'].filter(ch => used.every(n => !blocks[n].includes(ch)));
    assert.equal(correctOption(q).figure.name, toName(left), `seed ${seed} ${q.prompt}`);
  }
});
