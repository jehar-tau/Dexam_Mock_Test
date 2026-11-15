// Paper folding at exam level: shapes cut on the edges of a folded packet,
// straight cuts across it, flaps folded over on a two-coloured sheet, and a
// letter printed on top of the packet. Specification:
// docs/learn/topics/paper-folding.md.
//
// Conventions. Grid units, origin top-left, y DOWN, sheet S × S (S = 8).
// A fold keeps the left or top part still and lays the other part over it:
//   left     — the right half goes over the left half; the fold is the packet's right edge;
//   up       — the bottom half goes up over the top half; the fold is the packet's bottom edge;
//   diagonal — the top-right triangle goes over the bottom-left one; the fold is the line y = x.
// A packet is described by `layers`, maps from packet coordinates to sheet
// coordinates, listed bottom to top. The stationary layer is always first
// and is the identity, so packet coordinates are sheet coordinates.
import { pick, seededRandom, shuffle } from './random.js';

export const S = 8;
const R6 = v => Math.round(v * 1e6) / 1e6;
const key = p => `${R6(p[0])},${R6(p[1])}`;
const reflectFor = (kind, w, h) => (kind === 'left' ? ([x, y]) => [w - x, y] : kind === 'up' ? ([x, y]) => [x, h - y] : ([x, y]) => [y, x]);

// ---------- folding ----------
export function packetAfter(folds, size = S) {
  let state = { w: size, h: size, triangle: false, layers: [p => p], reflections: [] };
  for (const kind of folds) {
    const { w, h } = state;
    if (state.triangle) throw new Error('A triangle cannot be folded again');
    if (kind === 'diagonal' && w !== h) throw new Error('Only a square folds on the diagonal');
    const reflect = reflectFor(kind, w, h);
    // The moved part lands on top, its order reversed.
    const moved = state.layers.map(layer => p => layer(reflect(p))).reverse();
    state = { w: kind === 'left' ? w / 2 : w, h: kind === 'up' ? h / 2 : h, triangle: kind === 'diagonal', layers: [...state.layers, ...moved], reflections: [...state.reflections, { kind, w, h }] };
  }
  return state;
}
export const packetOutline = packet => (packet.triangle ? [[0, 0], [0, packet.h], [packet.w, packet.h]] : [[0, 0], [packet.w, 0], [packet.w, packet.h], [0, packet.h]]);
// Which edges of the packet are fold lines (the rest are the sheet's own edges).
export function foldEdges(folds) {
  const packet = packetAfter(folds), last = {};
  for (const r of packet.reflections) last[r.kind] = true;
  return { right: !!last.left, bottom: !!last.up, diagonal: !!last.diagonal, packet };
}
// Map shapes in packet coordinates through every layer to the sheet.
export const unfoldShapes = (packet, shapes) => packet.layers.flatMap(layer => shapes.map(shape => ({ ...shape, points: shape.points.map(layer) })));
// Fold sheet points back into the packet after the first j folds (for the step-by-step tool).
export function refold(points, folds, size = S) {
  let w = size, h = size;
  let out = points;
  for (const kind of folds) {
    const centre = out.reduce((a, p) => [a[0] + p[0] / out.length, a[1] + p[1] / out.length], [0, 0]);
    const beyond = kind === 'left' ? centre[0] > w / 2 + 1e-9 : kind === 'up' ? centre[1] > h / 2 + 1e-9 : centre[1] < centre[0] - 1e-9;
    if (beyond) out = out.map(reflectFor(kind, w, h));
    if (kind === 'left') w /= 2; else if (kind === 'up') h /= 2;
  }
  return out;
}

// ---------- cut shapes ----------
// A notch is built in a local frame: u along the edge, v into the packet. Asymmetric shapes are chiral.
const arc = (r, from, to, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const t = from + ((to - from) * i) / n; return [r * Math.cos(t), r * Math.sin(t)]; });
export const NOTCHES = {
  semicircle: { symmetric: true, name: 'a half circle', local: r => arc(r, 0, Math.PI) },
  triangle: { symmetric: true, name: 'a triangle', local: r => [[-r, 0], [r, 0], [0, 1.4 * r]] },
  square: { symmetric: true, name: 'a square', local: r => [[-r, 0], [r, 0], [r, 1.6 * r], [-r, 1.6 * r]] },
  'right-triangle': { symmetric: false, name: 'a right-angled triangle', local: r => [[-r, 0], [r, 0], [-r, 1.6 * r]] },
  step: { symmetric: false, name: 'a step', local: r => [[-r, 0], [r, 0], [r, 0.8 * r], [0, 0.8 * r], [0, 1.6 * r], [-r, 1.6 * r]] },
  flag: { symmetric: false, name: 'a slanted notch', local: r => [[-r, 0], [r, 0], [0.2 * r, 1.5 * r], [-r, 1.5 * r]] },
};
// Edges of a packet with a point at fraction t, the direction along the edge, and the inward normal.
function edgesOf(packet) {
  const { w, h } = packet, out = [];
  out.push({ name: 'left', from: [0, 0], to: [0, h], inward: [1, 0] });
  out.push({ name: 'bottom', from: [0, h], to: [w, h], inward: [0, -1] });
  if (packet.triangle) out.push({ name: 'diagonal', from: [0, 0], to: [w, h], inward: [-Math.SQRT1_2, Math.SQRT1_2] });
  else { out.push({ name: 'top', from: [0, 0], to: [w, 0], inward: [0, 1] }); out.push({ name: 'right', from: [w, 0], to: [w, h], inward: [-1, 0] }); }
  return out;
}
export function notch(packet, edgeName, t, type, size = 0.7) {
  const edge = edgesOf(packet).find(e => e.name === edgeName);
  const L = Math.hypot(edge.to[0] - edge.from[0], edge.to[1] - edge.from[1]), u = [(edge.to[0] - edge.from[0]) / L, (edge.to[1] - edge.from[1]) / L], n = edge.inward;
  const at = [edge.from[0] + u[0] * L * t, edge.from[1] + u[1] * L * t];
  return { type, edge: edgeName, t, points: NOTCHES[type].local(size).map(([a, b]) => [at[0] + u[0] * a + n[0] * b, at[1] + u[1] * a + n[1] * b]) };
}
export const punchHole = (centre, r = 0.42) => ({ type: 'hole', points: arc(r, 0, 2 * Math.PI, 16).slice(0, -1).map(([a, b]) => [centre[0] + a, centre[1] + b]) });

// ---------- holes and notches on the unfolded sheet ----------
// Pieces that share at least two corners (a common edge on a fold line) are one opening.
export function openings(shapes, size = S) {
  const parent = shapes.map((_, i) => i), find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const keys = shapes.map(s => new Set(s.points.map(key)));
  for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
    let shared = 0;
    for (const k of keys[i]) if (keys[j].has(k) && ++shared >= 2) break;
    if (shared >= 2) parent[find(i)] = find(j);
  }
  const groups = new Map();
  shapes.forEach((s, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(s); });
  const onEdge = p => Math.abs(p[0]) < 1e-6 || Math.abs(p[1]) < 1e-6 || Math.abs(p[0] - size) < 1e-6 || Math.abs(p[1] - size) < 1e-6;
  return [...groups.values()].map(pieces => ({ pieces, notch: pieces.some(s => s.points.some(onEdge)) }));
}
// A drawing's signature: every piece as a sorted list of rounded corners.
export const signature = shapes => shapes.map(s => s.points.map(key).sort().join(';')).sort().join('|');
const turnSheet = (shapes, size = S) => shapes.map(s => ({ ...s, points: s.points.map(([x, y]) => [size - y, x]) }));
const mirrorSheet = (shapes, axis, size = S) => shapes.map(s => ({ ...s, points: s.points.map(([x, y]) => (axis === 'x' ? [size - x, y] : [x, size - y])) }));
const mirrorPiece = shape => { const cx = shape.points.reduce((a, p) => a + p[0], 0) / shape.points.length; return { ...shape, points: shape.points.map(([x, y]) => [2 * cx - x, y]) }; };
const otherEdge = (packet, cut) => {
  const map = packet.triangle ? { left: 'bottom', bottom: 'left', diagonal: 'left' } : { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
  const t = packet.triangle && cut.edge === 'diagonal' ? 0.5 : cut.t;
  return notch(packet, map[cut.edge], t, cut.type, cut.size);
};

const FOLD_WORDS = { left: 'right half folded over to the left', up: 'bottom half folded up', diagonal: 'folded corner to corner' };
const SEQUENCES = { 2: [['left', 'up'], ['up', 'left'], ['left', 'left'], ['up', 'up']], 3: [['left', 'up', 'diagonal'], ['up', 'left', 'diagonal'], ['left', 'up', 'left'], ['up', 'left', 'up']] };
function sequenceFor(rng, level) {
  const list = level === 3 ? [...SEQUENCES[2], ...SEQUENCES[3]] : SEQUENCES[3];
  const folds = pick(rng, list);
  // 'left, up, left' needs an 8-wide sheet folded to 2 wide: allowed, the packet is 2 × 4.
  return folds;
}
function placeCuts(rng, packet, count, types) {
  const cuts = [], names = edgesOf(packet).map(e => e.name);
  for (let guard = 0; cuts.length < count && guard < 60; guard++) {
    const edge = pick(rng, names), t = pick(rng, edge === 'diagonal' ? [0.35, 0.5, 0.65] : [0.3, 0.5, 0.7]);
    const L = edge === 'diagonal' ? packet.w * Math.SQRT2 : edge === 'left' || edge === 'right' ? packet.h : packet.w;
    const size = Math.min(0.7, L * 0.16);
    const cut = notch(packet, edge, t, pick(rng, types), size);
    const centre = cut.points.reduce((a, p) => [a[0] + p[0] / cut.points.length, a[1] + p[1] / cut.points.length], [0, 0]);
    if (cuts.some(c => { const d = c.points.reduce((a, p) => [a[0] + p[0] / c.points.length, a[1] + p[1] / c.points.length], [0, 0]); return Math.hypot(d[0] - centre[0], d[1] - centre[1]) < 1.8; })) continue;
    // Keep notches clear of the packet's corners so no two copies overlap when unfolded.
    if (edge !== 'diagonal' && (t * L < size + 0.4 || (1 - t) * L < size + 0.4)) continue;
    cuts.push(cut);
  }
  return cuts.length === count ? cuts : null;
}
function retry(seed, build) {
  for (let i = 0; i < 200; i++) { const q = build(seededRandom(seed * 977 + i * 7919)); if (q) return q; }
  throw new Error('No paper question for seed ' + seed);
}
const describeFolds = folds => folds.map(k => FOLD_WORDS[k]).join(', then ');

// ---------- unfold-cuts ----------
export function unfoldCutsQuestion(seed, level) {
  return retry(seed, rng => {
    const folds = sequenceFor(rng, level), packet = packetAfter(folds);
    const types = level === 3 ? ['semicircle', 'triangle', 'square'] : ['right-triangle', 'step', 'flag', 'semicircle'];
    const cuts = placeCuts(rng, packet, level === 3 ? 1 + Math.floor(rng() * 2) : 2, types);
    if (!cuts || (level === 4 && !cuts.some(c => !NOTCHES[c.type].symmetric))) return null;
    const truth = unfoldShapes(packet, cuts), truthKey = signature(truth);
    const half = { ...packet, layers: packet.layers.slice(0, packet.layers.length / 2) };
    const flipped = packet.layers.map((layer, i) => i).filter(i => i > 0);
    const candidates = [
      { type: 'one-fold-forgotten', shapes: unfoldShapes(half, cuts), reason: 'This shows only half the layers, as if the last fold had not been made. Every cut goes through every layer.' },
      { type: 'other-edge', shapes: unfoldShapes(packet, cuts.map((c, i) => (i === 0 ? otherEdge(packet, c) : c))), reason: 'One cut has been placed on the wrong edge of the packet. A cut on a fold opens into a whole shape across the crease; a cut on an outer edge stays a notch at the edge of the sheet.' },
      { type: 'rotated', shapes: turnSheet(truth), reason: 'This is the right pattern turned a quarter turn. Folding mirrors a cut; it never turns the whole sheet.' },
      ...(level === 4 ? [{ type: 'unflipped', shapes: truth.map((s, i) => (i === cuts.length * pick(rng, flipped) + cuts.findIndex(c => !NOTCHES[c.type].symmetric) ? mirrorPiece(s) : s)), reason: 'One copy of the slanted cut faces the wrong way. Each copy is a mirror image of the one across the fold, so neighbouring copies face opposite ways.' }] : []),
      { type: 'mirrored', shapes: mirrorSheet(truth, rng() < 0.5 ? 'x' : 'y'), reason: 'This is the right pattern mirrored across the middle of the sheet. Check which side of the sheet each notch is on.' },
      { type: 'one-missing', shapes: truth.filter((_, i) => i !== cuts.length * (packet.layers.length - 1)), reason: 'One copy is missing. Count the layers: each cut is repeated once for every layer.' },
    ];
    const seen = new Set([truthKey]), wrong = [];
    for (const c of candidates) { const k = signature(c.shapes); if (seen.has(k)) continue; seen.add(k); wrong.push(c); }
    const chosen = level === 4 && wrong.some(w => w.type === 'unflipped') ? [wrong.find(w => w.type === 'unflipped'), ...wrong.filter(w => w.type !== 'unflipped')].slice(0, 3) : wrong.slice(0, 3);
    if (chosen.length < 3) return null;
    const options = shuffle(rng, [{ shapes: truth, correct: true, reason: 'Every cut is repeated in every layer and mirrored across each fold line in turn.' }, ...chosen.map(c => ({ ...c, correct: false }))])
      .map((o, i) => ({ id: 'ABCD'[i], label: 'ABCD'[i], correct: o.correct, reason: o.reason, type: o.type, figure: { type: 'cut-sheet', shapes: o.shapes } }));
    const open = openings(truth), holes = open.filter(o => !o.notch).length, notches = open.length - holes;
    return {
      kind: 'unfold-cuts', seed, answerMode: 'single', folds, cuts, truth,
      prompt: 'The sheet is folded as shown and the coloured parts are cut away. Which pattern appears when the sheet is opened out?',
      figures: [{ type: 'cut-sequence', folds, cuts }],
      options, answer: options.find(o => o.correct).id,
      explanation: `${folds.length} folds make ${packet.layers.length} layers, so each cut appears ${packet.layers.length} times. Opened out: ${holes} hole${holes === 1 ? '' : 's'} and ${notches} notch${notches === 1 ? '' : 'es'} at the edge.`,
      hints: ['Mark which edges of the folded packet are folds and which are the sheet\'s own edges.', 'Undo the last fold first. Mirror every cut across that fold line, then undo the fold before it.'],
      solution: [
        { text: `The folds: ${describeFolds(folds)}. That makes ${packet.layers.length} layers.` },
        ...cuts.map(c => ({ text: `The cut on the ${c.edge} edge is ${NOTCHES[c.type].name}. That edge is ${foldEdges(folds)[c.edge === 'right' ? 'right' : c.edge === 'bottom' ? 'bottom' : c.edge] ? 'a fold, so it opens into a whole shape across the crease' : 'the sheet\'s own edge, so it stays a notch'}.` })),
        { text: 'Undo the folds from the last to the first, mirroring every cut across each fold line.' },
        ...(level === 4 ? [{ text: 'A slanted cut flips at every fold: neighbouring copies face opposite ways.' }] : []),
        { text: `So the answer is ${options.find(o => o.correct).label}.` },
      ],
    };
  });
}

// ---------- hole-count ----------
export function holeCountQuestion(seed) {
  return retry(seed, rng => {
    const folds = pick(rng, [['left', 'up'], ['up', 'left'], ['left', 'up', 'diagonal'], ['left', 'up', 'left'], ['up', 'left', 'diagonal']]), packet = packetAfter(folds);
    const notches = placeCuts(rng, packet, 1 + Math.floor(rng() * 2), ['semicircle', 'triangle']);
    if (!notches) return null;
    // One punch inside the packet as well, away from the edges.
    const inside = packet.triangle ? [[0.9, packet.h - 0.9], [1.3, packet.h - 1.1]] : [[packet.w / 2, packet.h / 2], [1, 1], [packet.w - 1, 1]];
    const punch = punchHole(pick(rng, inside), 0.35), cuts = [...notches, punch];
    const shapes = unfoldShapes(packet, cuts), open = openings(shapes), value = open.filter(o => !o.notch).length;
    const naive = packet.layers.length * cuts.length;
    if (value < 3 || value === naive) return null;
    return {
      kind: 'hole-count', seed, answerMode: 'numeric', unit: 'holes', folds, cuts,
      prompt: 'The sheet is folded as shown, then cut and punched where coloured. When it is opened out, how many complete holes are there? Notches at the edge of the sheet do not count.',
      figures: [{ type: 'cut-sequence', folds, cuts }],
      answer: { value },
      mistakes: [{ value: naive, reason: `That is ${packet.layers.length} layers × ${cuts.length} cuts. Cuts on a fold join with their mirror image into one hole, and cuts on an outer edge are only notches.` }, { value: open.length, reason: 'That counts the notches on the edge of the sheet as holes.' }].filter((m, i, list) => m.value !== value && list.findIndex(o => o.value === m.value) === i),
      explanation: `${open.length} openings in all: ${value} complete holes and ${open.length - value} notches at the edge.`,
      hints: ['A punch in the middle of the packet makes one hole for every layer.', 'A cut on a fold makes one hole from two layers. A cut on an outer edge makes notches, not holes.'],
      solution: [
        { text: `${folds.length} folds: ${packet.layers.length} layers.` },
        { text: `The punch in the middle goes through all ${packet.layers.length} layers: ${packet.layers.length} holes, unless it sits on a fold.` },
        { text: 'Each cut on a fold joins with its mirror copy into one hole. Each cut on an outer edge becomes notches at the edge of the sheet.' },
        { text: `Complete holes: ${value}.` },
      ],
    };
  });
}

// ---------- piece-count ----------
export function pieceCountQuestion(seed) {
  return retry(seed, rng => {
    const folds = pick(rng, [['left', 'up'], ['up', 'left'], ['left', 'up', 'left'], ['up', 'left', 'up'], ['left', 'left'], ['up', 'up'], ['left', 'left', 'up']]), packet = packetAfter(folds);
    const both = rng() < 0.45, directions = both ? ['x', 'y'] : [rng() < 0.5 ? 'x' : 'y'];
    // Each cut runs right across the packet, parallel to one edge, never along an outer edge or a fold.
    const cutLines = directions.map(across => {
      const span = across === 'x' ? packet.w : packet.h, at = pick(rng, [0.25, 0.5, 0.75].map(f => f * span));
      return { across, at, line: across === 'x' ? [[at, 0], [at, packet.h]] : [[0, at], [packet.w, at]] };
    });
    const counts = cutLines.map(c => new Set(packet.layers.map(layer => R6(layer(c.line[0])[c.across === 'x' ? 0 : 1]))).size);
    const value = counts.reduce((product, n) => product * (n + 1), 1), naive = cutLines.length * packet.layers.length + 1;
    if (value < 3 || value > 40) return null;
    const words = counts.map((n, i) => `${n} ${cutLines[i].across === 'x' ? 'upright' : 'level'} line${n === 1 ? '' : 's'}`);
    return {
      kind: 'piece-count', seed, answerMode: 'numeric', unit: 'pieces', folds, cutLines: cutLines.map(c => c.line),
      prompt: `The folded sheet is cut right through along the dashed line${both ? 's' : ''}. When the pieces are opened out, how many separate pieces are there?`,
      figures: [{ type: 'cut-sequence', folds, cutLines: cutLines.map(c => c.line) }],
      answer: { value },
      mistakes: [
        { value: naive, reason: 'That counts one cut line per layer. Layers put their cuts on the same lines of the sheet, and cuts that cross make more pieces than cuts that do not.' },
        ...(both ? [{ value: counts[0] + counts[1] + 1, reason: 'The two sets of cuts cross each other. Each strip is cut again by every line the other way: multiply, do not add.' }] : []),
        { value: 2, reason: 'The cut goes through every layer, so the sheet is cut in several places.' },
      ].filter((m, i, list) => m.value !== value && list.findIndex(o => o.value === m.value) === i),
      explanation: `Opened out, the cuts lie along ${words.join(' and ')}. ${both ? `They cross, so the pieces are (${counts[0]} + 1) × (${counts[1]} + 1) = ${value}.` : `${counts[0]} parallel cuts make ${value} pieces.`}`,
      hints: ['Unfold each cut line through each fold in turn. Where does it land on the whole sheet?', 'Parallel cuts make one more piece than there are cuts. Cuts that cross multiply.'],
      solution: [
        { text: `${folds.length} folds make ${packet.layers.length} layers.` },
        ...cutLines.map((c, i) => ({ text: `The ${c.across === 'x' ? 'upright' : 'level'} cut, mirrored across every fold, lands on ${counts[i]} different line${counts[i] === 1 ? '' : 's'} of the sheet.` })),
        { text: both ? `Upright and level cuts cross: (${counts[0]} + 1) × (${counts[1]} + 1) = ${value} pieces.` : `${counts[0]} parallel cuts make ${value} pieces.` },
      ],
    };
  });
}

// ---------- two-colour-fold ----------
// Flaps: a strip of width k along a side, or a corner triangle with legs k, folded over onto the sheet.
const SIDES = ['top', 'right', 'bottom', 'left'], CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
const cornerPoint = { 'top-left': [0, 0], 'top-right': [S, 0], 'bottom-right': [S, S], 'bottom-left': [0, S] };
export function applyFlaps(flaps) {
  let outline = [[0, 0], [S, 0], [S, S], [0, S]];
  const back = [];
  for (const f of flaps) {
    if (f.kind === 'strip') {
      const k = f.size;
      const cut = { top: ([x, y]) => [x, Math.max(y, k)], bottom: ([x, y]) => [x, Math.min(y, S - k)], left: ([x, y]) => [Math.max(x, k), y], right: ([x, y]) => [Math.min(x, S - k), y] }[f.side];
      outline = outline.map(cut);
      back.push({ top: [[0, k], [S, k], [S, 2 * k], [0, 2 * k]], bottom: [[0, S - 2 * k], [S, S - 2 * k], [S, S - k], [0, S - k]], left: [[k, 0], [2 * k, 0], [2 * k, S], [k, S]], right: [[S - 2 * k, 0], [S - k, 0], [S - k, S], [S - 2 * k, S]] }[f.side]);
    } else {
      const [cx, cy] = cornerPoint[f.corner], k = f.size, dx = cx === 0 ? 1 : -1, dy = cy === 0 ? 1 : -1;
      const a = [cx + dx * k, cy], b = [cx, cy + dy * k];
      const i = outline.findIndex(p => p[0] === cx && p[1] === cy);
      outline = [...outline.slice(0, i), ...(dx * dy > 0 ? [b, a] : [a, b]), ...outline.slice(i + 1)];
      back.push([a, b, [cx + dx * k, cy + dy * k]]);
    }
  }
  // Keep the outline's corners in drawing order and drop repeated points.
  const tidy = outline.filter((p, i) => key(p) !== key(outline[(i + outline.length - 1) % outline.length]));
  return { outline: tidy, back };
}
const flapKey = r => `${r.outline.map(key).join(';')}#${r.back.map(poly => poly.map(key).sort().join(';')).sort().join('|')}#${r.allFront ? 'f' : ''}`;
const describeFlap = f => (f.kind === 'strip' ? `a strip ${f.size} wide along the ${f.side} edge` : `the ${f.corner} corner, ${f.size} along each edge`);
export function twoColourQuestion(seed) {
  return retry(seed, rng => {
    const count = 1 + Math.floor(rng() * 2), flaps = [];
    for (let guard = 0; flaps.length < count && guard < 20; guard++) {
      const f = rng() < 0.5 ? { kind: 'strip', side: pick(rng, SIDES), size: pick(rng, [1, 2]) } : { kind: 'corner', corner: pick(rng, CORNERS), size: pick(rng, [2, 3, 4]) };
      // No two flaps may touch: strips on opposite sides only, corners on corners not on a strip's side.
      const touches = g => (f.kind === 'strip' && g.kind === 'strip' ? !((f.side === 'top' && g.side === 'bottom') || (f.side === 'bottom' && g.side === 'top') || (f.side === 'left' && g.side === 'right') || (f.side === 'right' && g.side === 'left'))
        : f.kind === 'corner' && g.kind === 'corner' ? f.corner === g.corner || (f.size + g.size > S - 1 && (f.corner.split('-')[0] === g.corner.split('-')[0] || f.corner.split('-')[1] === g.corner.split('-')[1]))
          : (() => { const s = f.kind === 'strip' ? f : g, c = f.kind === 'corner' ? f : g; return c.corner.includes(s.side); })());
      if (!flaps.some(touches)) flaps.push(f);
    }
    if (flaps.length !== count) return null;
    const truth = applyFlaps(flaps), seen = new Set([flapKey(truth)]), wrong = [];
    const variants = [
      { result: { ...truth, allFront: true }, reason: 'The folded flap shows the back of the sheet, so it is the other colour.' },
      { result: { outline: [[0, 0], [S, 0], [S, S], [0, S]], back: truth.back }, reason: 'The outline must shrink: the flap has left the edge it was folded from.' },
      ...flaps.map((f, i) => ({ result: applyFlaps(flaps.map((g, j) => (j !== i ? g : g.kind === 'strip' ? { ...g, size: g.size === 1 ? 2 : 1 } : { ...g, size: g.size === 2 ? 3 : g.size - 1 }))), reason: 'One flap is the wrong size. A flap folded over covers exactly as much as it was.' })),
      ...flaps.map((f, i) => ({ result: applyFlaps(flaps.map((g, j) => (j !== i ? g : g.kind === 'strip' ? { ...g, side: SIDES[(SIDES.indexOf(g.side) + 2) % 4] } : { ...g, corner: CORNERS[(CORNERS.indexOf(g.corner) + 1) % 4] }))), reason: 'One flap is on the wrong side. Match each fold line on the diagram to its edge.' })),
    ];
    for (const v of shuffle(rng, variants)) { const k = flapKey(v.result); if (seen.has(k)) continue; seen.add(k); wrong.push(v); }
    if (wrong.length < 3) return null;
    const options = shuffle(rng, [{ result: truth, correct: true, reason: 'Each flap leaves its edge and lands on the sheet as a mirror image in the back colour.' }, ...wrong.slice(0, 3).map(w => ({ ...w, correct: false }))])
      .map((o, i) => ({ id: 'ABCD'[i], label: 'ABCD'[i], correct: o.correct, reason: o.reason, figure: { type: 'flap-sheet', outline: o.result.outline, back: o.result.back, allFront: !!o.result.allFront } }));
    return {
      kind: 'two-colour-fold', seed, answerMode: 'single', flaps,
      prompt: 'A square sheet is green on the front and orange on the back. The shaded parts are folded over along the dashed lines, onto the front. Which shows the sheet from the front afterwards?',
      figures: [{ type: 'flap-plan', flaps }],
      options, answer: options.find(o => o.correct).id,
      explanation: `${flaps.map(describeFlap).join(' and ')} ${flaps.length === 1 ? 'is' : 'are'} folded over. Each flap leaves its edge and lands as its mirror image across the fold line, showing the orange back.`,
      hints: ['A folded flap is the mirror image of itself across the fold line.', 'The flap shows the back of the sheet, so it is the other colour, and the edge it came from is now missing.'],
      solution: [{ text: 'A flap folded over lands face down, as its mirror image across the fold line, so it shows the orange back.' }, ...flaps.map(f => ({ text: `Fold ${describeFlap(f)}: that part leaves the outline and lands on the sheet beside the fold line, in orange.` })), { text: `So the answer is ${options.find(o => o.correct).label}.` }],
    };
  });
}

// ---------- seen-from-behind ----------
// Letters as strokes in a 1 × 1.5 box, origin top-left. None of them looks the same mirrored or turned.
export const GLYPHS = {
  F: [[[0, 1.5], [0, 0], [0.9, 0]], [[0, 0.7], [0.65, 0.7]]],
  L: [[[0, 0], [0, 1.5], [0.7, 1.5]]],
  J: [[[0.8, 0], [0.8, 1.5], [0, 1.5], [0, 1.1]]],
  R: [[[0, 1.5], [0, 0], [0.8, 0], [0.8, 0.7], [0, 0.7], [0.8, 1.5]]],
};
const mapStrokes = (strokes, f) => strokes.map(st => st.map(f));
const strokeKey = (strokes, panel) => `${panel}#${strokes.map(st => st.map(key).join(';')).map(s => [s, s.split(';').reverse().join(';')].sort()[0]).sort().join('|')}`;
export function behindQuestion(seed) {
  return retry(seed, rng => {
    const folds = pick(rng, [['left'], ['up'], ['left', 'up'], ['up', 'left'], ['left', 'up', 'diagonal']]), packet = packetAfter(folds), letter = pick(rng, Object.keys(GLYPHS));
    // Place the letter in the packet, clear of its edges.
    const k = 1.3, box = packet.triangle ? [0.25, packet.h - 2.15] : [(packet.w - k) / 2, (packet.h - 1.5 * k) / 2];
    const strokes = mapStrokes(GLYPHS[letter], ([x, y]) => [box[0] + k * x, box[1] + k * y]);
    // The top layer is the last layer: the copy of the bottom layer folded over last. One reflection, so the letter is on the back.
    const top = packet.layers[packet.layers.length - 1];
    const onSheet = mapStrokes(strokes, top), turnOver = ([x, y]) => [S - x, y];
    const truth = mapStrokes(onSheet, turnOver);
    const panelOf = st => { const p = st.flat(); const c = p.reduce((a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length], [0, 0]); return `${Math.floor(c[0] / (S / 2))},${Math.floor(c[1] / (S / 2))}`; };
    const variants = [
      { strokes: onSheet, reason: 'This is the letter seen through the paper from the front: it is back to front. Turned over, it reads the right way round.' },
      { strokes: mapStrokes(strokes, turnOver), reason: 'The letter is not where the top layer lands when the sheet is opened. The top layer is the part folded over last.' },
      { strokes: mapStrokes(truth, ([x, y]) => [x, S - y]), reason: 'This letter is upside down and back to front. It has been mirrored twice the wrong way.' },
      { strokes: mapStrokes(truth, ([x, y]) => [S - y, x]), reason: 'The letter has been turned. Folding and turning the sheet over only mirror it.' },
      { strokes: mapStrokes(strokes, p => p), reason: 'The letter has been left where it was printed. The top layer moved when the sheet was opened.' },
    ];
    const seen = new Set([strokeKey(truth, panelOf(truth))]), wrong = [];
    for (const v of variants) { const k = strokeKey(v.strokes, panelOf(v.strokes)); if (seen.has(k)) continue; seen.add(k); wrong.push(v); }
    if (wrong.length < 3) return null;
    const creases = folds;
    const options = shuffle(rng, [{ strokes: truth, correct: true, reason: 'The letter is on the part folded over last. Opened out it lies on the back of the sheet; turned over, it reads the right way round in its new place.' }, ...wrong.slice(0, 3).map(w => ({ ...w, correct: false }))])
      .map((o, i) => ({ id: 'ABCD'[i], label: 'ABCD'[i], correct: o.correct, reason: o.reason, figure: { type: 'letter-sheet', strokes: o.strokes, creases } }));
    return {
      kind: 'seen-from-behind', seed, answerMode: 'single', folds, letter,
      prompt: `The sheet is folded as shown and the letter ${letter} is printed on top of the folded packet. The sheet is opened out and turned over from left to right, so the letter faces you. Which does it look like?`,
      figures: [{ type: 'cut-sequence', folds, strokes }],
      options, answer: options.find(o => o.correct).id,
      explanation: 'The top of the packet is the part folded over last. Opened out, that part lies with its back up, so the letter is on the back of the sheet, mirrored. Turning the sheet over shows it the right way round, on the opposite side.',
      hints: ['Which part of the sheet is on top of the packet? It is the part folded over last.', 'That part was turned over by the fold, so the letter is on the back of the sheet.'],
      solution: [
        { text: `The last fold was the ${FOLD_WORDS[folds[folds.length - 1]]}. The part it moved is on top of the packet.` },
        { text: 'Opened out, that part is back in its place but face down: the letter is on the back of the sheet.' },
        { text: 'Turning the sheet over from left to right brings the letter to the front, reading the right way round, on the mirrored side of the sheet.' },
        { text: `So the answer is ${options.find(o => o.correct).label}.` },
      ],
    };
  });
}

export function paperQuestion(seed, kind, level) {
  if (kind === 'unfold-cuts') return unfoldCutsQuestion(seed, level);
  if (kind === 'hole-count') return holeCountQuestion(seed);
  if (kind === 'piece-count') return pieceCountQuestion(seed);
  if (kind === 'two-colour-fold') return twoColourQuestion(seed);
  if (kind === 'seen-from-behind') return behindQuestion(seed);
  throw new Error('Unknown paper kind ' + kind);
}
