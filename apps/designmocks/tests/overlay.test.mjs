// Sheets checked with real geometry: every mark becomes points in the plane
// (a centre, or the two ends of its line), each move is a rotation or a
// reflection about the sheet's centre or the fold line, and the moved points
// are read back into squares and line directions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OVERLAY_KINDS, overlayQuestion } from '../src/learn/overlay.js';

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
const right = q => q.options.find(o => o.id === q.answer);
const LINE = { h: [1, 0], v: [0, 1], d1: [1, -1], d2: [1, 1] };
const toPoints = (k, mark) => { const [c, r] = k.split(',').map(Number), cx = c + 0.5, cy = r + 0.5, d = LINE[mark]; return d ? [[cx - 0.3 * d[0], cy - 0.3 * d[1]], [cx + 0.3 * d[0], cy + 0.3 * d[1]]] : [[cx, cy]]; };
function fromPoints(pts, mark) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length, cell = `${Math.floor(cx)},${Math.floor(cy)}`;
  if (pts.length === 1) return [cell, mark];
  const dx = Math.round((pts[1][0] - pts[0][0]) / 0.6), dy = Math.round((pts[1][1] - pts[0][1]) / 0.6);
  const name = Object.keys(LINE).find(k => (LINE[k][0] === dx && LINE[k][1] === dy) || (LINE[k][0] === -dx && LINE[k][1] === -dy));
  return [cell, name];
}
const key = sheet => Object.entries(sheet).flatMap(([k, ms]) => ms.map(m => `${k}:${m}`)).sort().join(' ');
const apply = (sheet, f, keep = () => false) => { const out = {}; for (const [k, ms] of Object.entries(sheet)) for (const m of ms) { const [cell, mark] = keep(k) ? [k, m] : fromPoints(toPoints(k, m).map(f), m); (out[cell] ??= []).push(mark); } for (const k in out) out[k] = [...new Set(out[k])].sort(); return out; };
const union = (...sheets) => { const out = {}; for (const s of sheets) for (const [k, ms] of Object.entries(s)) out[k] = [...new Set([...(out[k] ?? []), ...ms])].sort(); return out; };
const moves = n => ({ turn: ([x, y]) => [n - y, x], flipH: ([x, y]) => [n - x, y], flipV: ([x, y]) => [x, n - y] });
const WORD_TO_MOVE = { 'a quarter turn clockwise': 'turn', 'from left to right': 'flipH', 'from top to bottom': 'flipV' };
const moveIn = prompt => Object.entries(WORD_TO_MOVE).find(([w]) => prompt.includes(w))?.[1] ?? null;

test('every kind builds sound questions', () => {
  for (const [kind, levels] of Object.entries(OVERLAY_KINDS)) for (const level of levels) for (const seed of seeds) {
    const q = overlayQuestion(seed, kind, level);
    if (q.answerMode === 'numeric') { for (const m of q.mistakes) assert.notEqual(m.value, q.answer.value); }
    else { assert.equal(q.options.length, 4); assert.equal(q.options.filter(o => o.correct).length, 1); assert.equal(new Set(q.options.map(o => key(o.figure.cells))).size, 4); }
    if (level >= 3) { assert.ok(q.hints.length >= 1, kind); assert.ok(q.solution.length >= 3, kind); }
  }
});

test('stacked sheets match rotations and reflections done in the plane', () => {
  for (const level of [2, 3]) for (const seed of seeds) {
    const q = overlayQuestion(seed, 'sheet-stack', level), mv = moveIn(q.prompt), last = q.sheets.length - 1;
    const sheets = q.sheets.map((s, i) => (mv && i === last ? apply(s, moves(q.n)[mv]) : s));
    assert.equal(key(right(q).figure.cells), key(union(...sheets)), `seed ${seed}`);
  }
});

test('folded sheets match a reflection across the fold line', () => {
  for (const level of [3, 4]) for (const seed of seeds) {
    const q = overlayQuestion(seed, 'sheet-fold', level), n = q.n;
    const reflect = { vertical: ([x, y]) => [n - x, y], horizontal: ([x, y]) => [x, n - y], diagonal: ([x, y]) => [y, x] }[q.line];
    const moving = { vertical: k => Number(k.split(',')[0]) >= n / 2, horizontal: k => Number(k.split(',')[1]) >= n / 2, diagonal: k => { const [c, r] = k.split(',').map(Number); return r > c; } }[q.line];
    assert.equal(key(right(q).figure.cells), key(apply(q.sheet, reflect, k => !moving(k))), `seed ${seed} ${q.line}`);
  }
});

test('overlap counts match a square-by-square tally', () => {
  for (const level of [3, 4]) for (const seed of seeds) {
    const q = overlayQuestion(seed, 'sheet-count', level), mv = moveIn(q.prompt), n = 4;
    const sheets = q.sheets.map((s, i) => (mv && i === 1 ? apply(s, moves(n)[mv]) : s)), want = q.prompt.includes('none') ? 0 : q.prompt.includes('all three') ? 3 : q.prompt.includes('exactly two') ? 2 : 1;
    let count = 0;
    for (let c = 0; c < n; c++) for (let r = 0; r < n; r++) if (sheets.filter(s => s[`${c},${r}`]).length === want) count++;
    assert.equal(q.answer.value, count, q.prompt);
  }
});
