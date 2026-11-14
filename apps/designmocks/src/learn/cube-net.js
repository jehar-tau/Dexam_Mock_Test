// Cube-net geometry: folding, the eleven nets, cube rotations, views and
// generated questions with verified answers. Pure, deterministic and free of
// DOM access so it can be unit tested and reused by every lesson.

// ---------- vectors and rotations ----------
const vec = (x, y, z) => [x, y, z];
const neg = v => [-v[0], -v[1], -v[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const key = v => `${v[0]},${v[1]},${v[2]}`;
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const apply = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const det3 = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

function buildRotations() {
  const rows = [];
  for (const axis of [0, 1, 2]) for (const sign of [1, -1]) rows.push([0, 0, 0].map((_, i) => (i === axis ? sign : 0)));
  const out = [];
  for (const a of rows) for (const b of rows) for (const c of rows) {
    if (Math.abs(a.findIndex(Boolean)) === Math.abs(b.findIndex(Boolean))) continue;
    const used = new Set([a.findIndex(Boolean), b.findIndex(Boolean)]);
    if (used.has(c.findIndex(Boolean))) continue;
    const m = [a, b, c];
    if (det3(m) === 1) out.push(m);
  }
  return out;
}
export const rotations = Object.freeze(buildRotations());
export const identity = rotations.find(m => m[0][0] === 1 && m[1][1] === 1 && m[2][2] === 1);
// Shows the three faces hidden by the identity view.
export const oppositeView = [[0, -1, 0], [-1, 0, 0], [0, 0, -1]];

// Named as seen by a viewer at (+x, +y, +z): the +x face is the front-left one.
const AXES = { '1,0,0': 'front left', '-1,0,0': 'back right', '0,1,0': 'front right', '0,-1,0': 'back left', '0,0,1': 'top', '0,0,-1': 'bottom' };
export const faceName = normal => AXES[key(normal)];

// ---------- folding ----------
// cells: [{x,y}] on an integer grid. The first cell is the top face with the
// printed side outward; neighbours fold down around their shared edge.
export function foldNet(cells, rootIndex = 0) {
  if (!Array.isArray(cells) || cells.length !== 6) return { ok: false, reason: 'count' };
  return foldCells(cells, rootIndex);
}
// The same fold for any number of squares up to six: five squares make an open box.
export function foldCells(cells, rootIndex = 0) {
  if (!Array.isArray(cells) || !cells.length || cells.length > 6) return { ok: false, reason: 'count' };
  const byPos = new Map();
  for (const [i, c] of cells.entries()) {
    const k = `${c.x},${c.y}`;
    if (byPos.has(k)) return { ok: false, reason: 'duplicate' };
    byPos.set(k, i);
  }
  const frames = new Array(cells.length).fill(null);
  frames[rootIndex] = { n: vec(0, 0, 1), r: vec(1, 0, 0), u: vec(0, 1, 0), from: null };
  const landed = new Map([[key(frames[rootIndex].n), rootIndex]]);
  const queue = [rootIndex];
  const order = [rootIndex];
  while (queue.length) {
    const i = queue.shift();
    const f = frames[i], c = cells[i];
    for (const [dx, dy, axis, sign] of [[1, 0, 'r', 1], [0, 1, 'u', 1], [-1, 0, 'r', -1], [0, -1, 'u', -1]]) {
      const j = byPos.get(`${c.x + dx},${c.y + dy}`);
      if (j === undefined || frames[j]) continue;
      const d = sign === 1 ? f[axis] : neg(f[axis]);
      const next = { n: d, r: f.r, u: f.u, from: i };
      next[axis] = sign === 1 ? neg(f.n) : f.n;
      const k = key(d);
      if (landed.has(k)) return { ok: false, reason: 'overlap', cells: [landed.get(k), j] };
      landed.set(k, j);
      frames[j] = next;
      queue.push(j);
      order.push(j);
    }
  }
  if (frames.some(f => !f)) return { ok: false, reason: 'disconnected' };
  return { ok: true, frames, order };
}

export function oppositeIndex(fold, index) {
  const target = neg(fold.frames[index].n);
  return fold.frames.findIndex(f => same(f.n, target));
}
export function adjacentIndices(fold, index) {
  const n = fold.frames[index].n;
  return fold.frames.map((f, i) => i).filter(i => i !== index && dot(fold.frames[i].n, n) === 0);
}

// ---------- the eleven nets ----------
const cellKey = c => `${c.x},${c.y}`;
function normalise(cells) {
  const minX = Math.min(...cells.map(c => c.x)), minY = Math.min(...cells.map(c => c.y));
  return cells.map(c => ({ x: c.x - minX, y: c.y - minY })).sort((a, b) => a.y - b.y || a.x - b.x);
}
const serial = cells => normalise(cells).map(cellKey).join('|');
export const transforms = [
  c => ({ x: c.x, y: c.y }), c => ({ x: -c.y, y: c.x }), c => ({ x: -c.x, y: -c.y }), c => ({ x: c.y, y: -c.x }),
  c => ({ x: -c.x, y: c.y }), c => ({ x: c.y, y: c.x }), c => ({ x: c.x, y: -c.y }), c => ({ x: -c.y, y: -c.x }),
];
export function transformCells(cells, index) { return normalise(cells.map(transforms[index])); }
function canonical(cells) {
  return transforms.map((_, i) => serial(transformCells(cells, i))).sort()[0];
}
export function hexominoes() {
  let shapes = new Map([['0,0', [{ x: 0, y: 0 }]]]);
  for (let size = 1; size < 6; size++) {
    const next = new Map();
    for (const cells of shapes.values()) {
      const taken = new Set(cells.map(cellKey));
      for (const c of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = { x: c.x + dx, y: c.y + dy };
        if (taken.has(cellKey(n))) continue;
        const grown = normalise([...cells, n]);
        next.set(serial(grown), grown);
      }
    }
    shapes = next;
  }
  return [...shapes.values()];
}
function rowPattern(cells) {
  const rows = new Map();
  for (const c of cells) rows.set(c.y, (rows.get(c.y) ?? 0) + 1);
  const pattern = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
  const reversed = [...pattern].reverse();
  return (pattern.join('-') > reversed.join('-') ? pattern : reversed).join('-');
}
function presentable(cells) {
  // Orient each net with its longest row horizontal and the shape as wide as possible.
  const candidates = transforms.map((_, i) => transformCells(cells, i));
  candidates.sort((a, b) => {
    const wa = Math.max(...a.map(c => c.x)), wb = Math.max(...b.map(c => c.x));
    return wb - wa || serial(a).localeCompare(serial(b));
  });
  return candidates[0];
}
function buildNets() {
  const seen = new Map();
  for (const cells of hexominoes()) {
    if (!foldNet(cells).ok) continue;
    const c = canonical(cells);
    if (!seen.has(c)) seen.set(c, presentable(cells));
  }
  return [...seen.values()]
    .map(cells => ({ cells, family: rowPattern(cells) }))
    .sort((a, b) => a.family.localeCompare(b.family) || serial(a.cells).localeCompare(serial(b.cells)))
    .map((net, i) => Object.freeze({ id: `net-${i + 1}`, family: net.family, cells: Object.freeze(net.cells.map(Object.freeze)) }));
}
export const cubeNets = Object.freeze(buildNets());

// ---------- face content and glyph symmetry ----------
export const palette = Object.freeze(['c1', 'c2', 'c3', 'c4', 'c5', 'c6']);
export const paletteNames = Object.freeze({ c1: 'orange', c2: 'green', c3: 'yellow', c4: 'blue', c5: 'plum', c6: 'grey' });
const I = [[1, 0], [0, 1]], R90 = [[0, -1], [1, 0]], R180 = [[-1, 0], [0, -1]], R270 = [[0, 1], [-1, 0]];
const MX = [[-1, 0], [0, 1]], MY = [[1, 0], [0, -1]], MD = [[0, 1], [1, 0]], MAD = [[0, -1], [-1, 0]];
const D4 = [I, R90, R180, R270, MX, MY, MD, MAD];
export const glyphSymmetry = Object.freeze({
  dot: D4, plus: D4, square: D4, ring: D4, blank: D4,
  // Path pieces run from edge midpoint to edge midpoint: a straight line from bottom to top, a bend from bottom to right.
  line: [I, R180, MX, MY], bend: [I, MAD],
  bar: [I, R180, MX, MY], diag: [I, R180, MD, MAD],
  arrow: [I, MX], tri: [I, MX], half: [I, MX],
  corner: [I], hook: [I],
  A: [I, MX], T: [I, MX], C: [I, MY], E: [I, MY], H: [I, R180, MX, MY], N: [I, R180], S: [I, R180], Z: [I, R180],
  F: [I], G: [I], J: [I], L: [I], P: [I], Q: [I], R: [I], B: [I, MY], D: [I, MY], K: [I, MY],
});
export const glyphs = Object.freeze(Object.keys(glyphSymmetry));
export const asymmetricGlyphs = Object.freeze(['arrow', 'corner', 'hook', 'half', 'F', 'G', 'J', 'L', 'P', 'R']);
export const plainGlyphs = Object.freeze(['dot', 'plus', 'square', 'ring']);
export const letterGlyphs = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'N', 'P', 'R', 'S', 'T']);

const mul2 = (a, b) => [[a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]], [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]]];
const ser2 = m => `${m[0][0]},${m[0][1]},${m[1][0]},${m[1][1]}`;
export function canonicalOrientation(matrix, glyph) {
  const group = glyphSymmetry[glyph] ?? [I];
  return group.map(g => ser2(mul2(matrix, g))).sort()[0];
}
export const contentKey = content => `${content.glyph}/${content.fill ?? ''}`;
const pathWords = { line: 'straight line', bend: 'bent line' };
export const contentLabel = content => content.glyph === 'square' && content.fill
  ? `plain ${paletteNames[content.fill]}`
  : content.glyph === 'blank' ? 'blank'
  : pathWords[content.glyph] ? `${paletteNames[content.fill] ?? 'plain'} with a ${pathWords[content.glyph]}`
  : (content.glyph.length === 1 ? `letter ${content.glyph}` : content.glyph) + (content.fill ? ` on ${paletteNames[content.fill]}` : '');
const sentence = text => text.charAt(0).toUpperCase() + text.slice(1);

// ---------- views ----------
// Right-handed in-plane bases for the three faces visible in the identity view.
// The viewer stands at (+x, +y, +z). In a right-handed world that viewer sees
// the +x face on the LEFT and the +y face on the RIGHT; drawing them the other
// way round would show the mirror image of the folded cube.
const SLOTS = Object.freeze({
  top: { normal: vec(0, 0, 1), e1: vec(1, 0, 0), e2: vec(0, 1, 0) },
  left: { normal: vec(1, 0, 0), e1: vec(0, 1, 0), e2: vec(0, 0, 1) },
  right: { normal: vec(0, 1, 0), e1: vec(0, 0, 1), e2: vec(1, 0, 0) },
});
export const slotNames = Object.freeze(['top', 'left', 'right']);
export const slotBases = SLOTS;

// A cell's content may carry `turn`: quarter turns anticlockwise of the glyph
// on the paper. glyphAxes gives the glyph's own right and up as 3D vectors
// once the cell is folded.
export function glyphAxes(frame, turn = 0) {
  let r = frame.r, u = frame.u;
  for (let t = 0; t < ((turn % 4) + 4) % 4; t++) [r, u] = [u, neg(r)];
  return { r, u };
}

// A view is {top,left,right}: each {content, m} where m is the 2x2 matrix that
// maps the glyph's own axes into the face basis (e1,e2). A slot with no face
// (an open box) is null.
export function cubeView(net, fold, rotation) {
  const view = {};
  for (const [slot, basis] of Object.entries(SLOTS)) {
    const index = fold.frames.findIndex(f => f && same(apply(rotation, f.n), basis.normal));
    if (index < 0) { view[slot] = null; continue; }
    const f = fold.frames[index];
    const axes = glyphAxes(f, net.cells[index].content?.turn);
    const r = apply(rotation, axes.r), u = apply(rotation, axes.u);
    view[slot] = { cell: index, content: net.cells[index].content, m: [[dot(r, basis.e1), dot(u, basis.e1)], [dot(r, basis.e2), dot(u, basis.e2)]] };
  }
  return view;
}
export function viewSignature(view) {
  return slotNames.map(slot => `${slot}:${contentKey(view[slot].content)}:${canonicalOrientation(view[slot].m, view[slot].content.glyph)}`).join(';');
}
export function allViewSignatures(net, fold) {
  return new Set(rotations.map(rotation => viewSignature(cubeView(net, fold, rotation))));
}
export function cubesEquivalent(netA, foldA, netB, foldB) {
  // Same cube up to rotation, treating each glyph's symmetry as invisible.
  const target = allViewSignatures(netA, foldA);
  return rotations.every(rotation => target.has(viewSignature(cubeView(netB, foldB, rotation))));
}

// ---------- projection for SVG ----------
const COS = Math.cos(Math.PI / 6), SIN = 0.5;
// Screen x grows with y and shrinks with x: +x runs to the lower left, +y to the
// lower right, +z up. This is the true view from (+x, +y, +z), not its mirror.
export const project = ([x, y, z]) => [(y - x) * COS, (x + y) * SIN - z];
export function slotGeometry(slot, size) {
  const basis = SLOTS[slot];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => project(scale(add(basis.normal, add(scale(basis.e1, a), scale(basis.e2, b))), size)));
  return { corners, centre: project(scale(basis.normal, size)), e1: project(scale(basis.e1, size)), e2: project(scale(basis.e2, size)) };
}
// SVG matrix placing a glyph drawn in [-1,1]² (y up) onto a face slot.
export function slotGlyphMatrix(slot, m, size, glyphScale = 0.5) {
  const { centre, e1, e2 } = slotGeometry(slot, size);
  const r = [e1[0] * m[0][0] + e2[0] * m[1][0], e1[1] * m[0][0] + e2[1] * m[1][0]];
  const u = [e1[0] * m[0][1] + e2[0] * m[1][1], e1[1] * m[0][1] + e2[1] * m[1][1]];
  return [r[0] * glyphScale, r[1] * glyphScale, u[0] * glyphScale, u[1] * glyphScale, centre[0], centre[1]];
}

// ---------- seeded randomness ----------
export function seededRandom(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
function shuffle(rng, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
const letters = 'ABCDEF';

export function randomNet(rng, contents) {
  const base = pick(rng, cubeNets);
  const cells = transformCells(base.cells, Math.floor(rng() * 8)).map((c, i) => ({ ...c, content: contents[i] }));
  return { id: base.id, family: base.family, cells };
}
function letterContents() { return letters.split('').map(glyph => ({ glyph })); }
function colourContents(rng) { return shuffle(rng, palette).map(fill => ({ glyph: 'square', fill })); }
function mixedContents(rng) {
  const chosen = shuffle(rng, [...asymmetricGlyphs.filter(g => g.length > 1), 'bar', 'diag', 'tri', 'A', 'T']).slice(0, 4);
  const plain = shuffle(rng, plainGlyphs).slice(0, 2);
  return shuffle(rng, [...chosen, ...plain]).map((glyph, i) => ({ glyph, fill: palette[i] }));
}
function randomHexomino(rng, wantNet) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const cells = [{ x: 0, y: 0 }];
    const taken = new Set(['0,0']);
    while (cells.length < 6) {
      const c = pick(rng, cells), [dx, dy] = pick(rng, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
      const n = { x: c.x + dx, y: c.y + dy };
      if (taken.has(cellKey(n))) continue;
      taken.add(cellKey(n));
      cells.push(n);
    }
    const shaped = normalise(cells);
    if (foldNet(shaped).ok === wantNet) return shaped;
  }
  return wantNet ? transformCells(pick(rng, cubeNets).cells, Math.floor(rng() * 8)) : normalise([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);
}

// ---------- questions ----------
export const questionKinds = Object.freeze(['is-net', 'opposite', 'which-cube', 'cannot-cube', 'which-net', 'build-net']);
const ordinal = i => letters[i];

export function generateQuestion(kind, seed, level) {
  const rng = seededRandom(seed);
  if (level >= 3 && ['which-cube', 'cannot-cube', 'which-net'].includes(kind)) return examQuestion(kind, rng, seed, level);
  if (examKinds[kind]) return examQuestion(kind, rng, seed, level ?? examKinds[kind][0]);
  switch (kind) {
    case 'is-net': return isNetQuestion(rng, seed);
    case 'opposite': return oppositeQuestion(rng, seed);
    case 'which-cube': return cubeQuestion(rng, seed, 'can');
    case 'cannot-cube': return cubeQuestion(rng, seed, 'cannot');
    case 'which-net': return whichNetQuestion(rng, seed);
    case 'build-net': return buildNetQuestion(rng, seed);
    default: throw new Error(`Unknown question kind: ${kind}`);
  }
}

function isNetQuestion(rng, seed) {
  const wantNet = rng() < 0.5;
  const cells = randomHexomino(rng, wantNet).map((c, i) => ({ ...c, content: { glyph: ordinal(i) } }));
  const fold = foldNet(cells);
  return {
    kind: 'is-net', seed, prompt: 'Can this shape fold into a closed cube?', net: { cells },
    options: [{ id: 'yes', label: 'Yes, it is a net' }, { id: 'no', label: 'No, it cannot close' }],
    answer: fold.ok ? 'yes' : 'no',
    explanation: fold.ok
      ? 'Every square lands on a different face, so the shape closes into a cube.'
      : fold.reason === 'overlap'
        ? `Squares ${ordinal(fold.cells[0])} and ${ordinal(fold.cells[1])} would land on the same face, so one face stays open.`
        : 'The squares do not all connect edge to edge, so they cannot fold into one solid.',
    highlight: fold.ok ? [] : fold.cells ?? [],
  };
}

function oppositeQuestion(rng, seed) {
  const net = randomNet(rng, letterContents());
  const fold = foldNet(net.cells);
  const index = Math.floor(rng() * 6);
  const opposite = oppositeIndex(fold, index);
  const others = shuffle(rng, [0, 1, 2, 3, 4, 5].filter(i => i !== index && i !== opposite)).slice(0, 3);
  const options = shuffle(rng, [opposite, ...others]).map(i => ({ id: ordinal(i), label: ordinal(i) }));
  const adjacent = adjacentIndices(fold, index).map(ordinal).join(', ');
  return {
    kind: 'opposite', seed, prompt: `When this net is folded, which face is opposite ${ordinal(index)}?`, net, focus: index,
    options, answer: ordinal(opposite),
    explanation: `${ordinal(index)} touches ${adjacent} after folding. The only face left, ${ordinal(opposite)}, is opposite it.`,
  };
}

function mutateView(rng, net, fold, rotation, allowed) {
  const view = cubeView(net, fold, rotation);
  const type = pick(rng, allowed);
  const slot = pick(rng, slotNames);
  const copy = { top: { ...view.top }, left: { ...view.left }, right: { ...view.right } };
  if (type === 'opposite-together') {
    const index = oppositeIndex(fold, view[slot].cell);
    copy[slot] = { cell: index, content: net.cells[index].content, m: view[slot].m };
    const other = pick(rng, slotNames.filter(s => s !== slot));
    return { view: copy, type, detail: { shown: net.cells[index].content, with: copy[other].content } };
  }
  if (type === 'swapped') {
    const other = pick(rng, slotNames.filter(s => s !== slot));
    copy[slot] = { ...view[other], m: view[slot].m };
    copy[other] = { ...view[slot], m: view[other].m };
    return { view: copy, type, detail: { first: copy[slot].content, second: copy[other].content } };
  }
  const turn = pick(rng, [R90, R270, MX, MY]);
  copy[slot] = { ...view[slot], m: mul2(view[slot].m, turn) };
  return { view: copy, type: turn === MX || turn === MY ? 'mirrored' : 'turned', detail: { face: view[slot].content } };
}
function distractorText(d) {
  if (d.type === 'opposite-together') return `It shows ${contentLabel(d.detail.shown)} next to ${contentLabel(d.detail.with)}, but those faces are opposite on this net and can never be seen together.`;
  if (d.type === 'swapped') return `It puts ${contentLabel(d.detail.first)} and ${contentLabel(d.detail.second)} the wrong way round around the corner. The order of faces around a corner cannot change.`;
  if (d.type === 'mirrored') return `The ${contentLabel(d.detail.face)} face is mirrored. Folding a paper net never mirrors a face.`;
  return `The ${contentLabel(d.detail.face)} face is turned the wrong way for the faces beside it.`;
}
function cubeQuestion(rng, seed, mode) {
  const net = randomNet(rng, mixedContents(rng));
  const fold = foldNet(net.cells);
  const real = allViewSignatures(net, fold);
  const trueRotation = pick(rng, rotations);
  const used = new Set();
  const options = [];
  if (mode === 'can') {
    const correct = cubeView(net, fold, trueRotation);
    used.add(viewSignature(correct));
    options.push({ id: 'correct', view: correct, correct: true, reason: 'All three faces, their order around the corner and their turns match the net.' });
    let guard = 0;
    while (options.length < 4 && guard++ < 200) {
      const rotation = guard % 2 ? trueRotation : pick(rng, rotations);
      const d = mutateView(rng, net, fold, rotation, ['opposite-together', 'swapped', 'turned', 'turned']);
      const signature = viewSignature(d.view);
      if (real.has(signature) || used.has(signature)) continue;
      used.add(signature);
      options.push({ id: `wrong-${options.length}`, view: d.view, correct: false, reason: distractorText(d) });
    }
  } else {
    let guard = 0;
    while (options.length < 3 && guard++ < 200) {
      const view = cubeView(net, fold, pick(rng, rotations));
      const signature = viewSignature(view);
      if (used.has(signature)) continue;
      used.add(signature);
      options.push({ id: `fine-${options.length}`, view, correct: false, reason: 'This view can be made: its faces, their order and their turns all match the net.' });
    }
    guard = 0;
    while (options.length < 4 && guard++ < 200) {
      const d = mutateView(rng, net, fold, pick(rng, rotations), ['opposite-together', 'swapped', 'turned']);
      const signature = viewSignature(d.view);
      if (real.has(signature) || used.has(signature)) continue;
      used.add(signature);
      options.push({ id: 'impossible', view: d.view, correct: true, reason: distractorText(d) });
    }
  }
  const shuffled = shuffle(rng, options).map((o, i) => ({ ...o, label: ordinal(i) }));
  const answer = shuffled.find(o => o.correct);
  return {
    kind: mode === 'can' ? 'which-cube' : 'cannot-cube', seed,
    prompt: mode === 'can' ? 'Which cube can be made by folding this net?' : 'Which cube CANNOT be made from this net?',
    net, options: shuffled, answer: answer.id, explanation: answer.reason,
  };
}

function whichNetQuestion(rng, seed) {
  const contents = mixedContents(rng);
  const net = randomNet(rng, contents);
  const fold = foldNet(net.cells);
  const rotation = pick(rng, rotations);
  const view = cubeView(net, fold, rotation);
  const signature = viewSignature(view);
  const options = [{ id: 'correct', net, correct: true, reason: 'Folding this net puts these three faces together in this order, with these turns.' }];
  const used = new Set([net.cells.map(c => contentKey(c.content)).join('|')]);
  let guard = 0;
  while (options.length < 4 && guard++ < 300) {
    const cells = net.cells.map(c => ({ ...c }));
    const a = Math.floor(rng() * 6);
    let b = Math.floor(rng() * 6);
    if (a === b) b = (b + 1) % 6;
    [cells[a].content, cells[b].content] = [cells[b].content, cells[a].content];
    const codeKey = cells.map(c => contentKey(c.content)).join('|');
    const candidate = { ...net, cells };
    const candidateFold = foldNet(cells);
    if (used.has(codeKey) || allViewSignatures(candidate, candidateFold).has(signature)) continue;
    used.add(codeKey);
    const visible = slotNames.map(s => view[s].content);
    const moved = [cells[a].content, cells[b].content].filter(c => visible.some(v => contentKey(v) === contentKey(c)));
    const reason = moved.length
      ? sentence(`${contentLabel(moved[0])} sits in a different place on this net, so the three shown faces cannot meet like this.`)
      : 'Swapping two faces changes which faces meet at the corner, so this view is impossible from this net.';
    options.push({ id: `wrong-${options.length}`, net: candidate, correct: false, reason });
  }
  const shuffled = shuffle(rng, options).map((o, i) => ({ ...o, label: ordinal(i) }));
  const answer = shuffled.find(o => o.correct);
  return { kind: 'which-net', seed, prompt: 'Which net folds into this cube?', view, options: shuffled, answer: answer.id, explanation: answer.reason };
}

function buildNetQuestion(rng, seed) {
  const target = randomNet(rng, colourContents(rng));
  const fold = foldNet(target.cells);
  const shape = transformCells(pick(rng, cubeNets).cells, Math.floor(rng() * 8));
  return {
    kind: 'build-net', seed, prompt: 'Colour the blank net so that it folds into this cube. Both views show the same cube.',
    target, views: [cubeView(target, fold, identity), cubeView(target, fold, oppositeView)],
    shape, palette: [...palette], answer: null,
    explanation: 'Each pair of opposite colours must sit two squares apart in a line or at the ends of a zigzag, and the three colours around each corner must run the same way as on the cube.',
  };
}

export function checkBuild(question, placements) {
  // placements: array of fill ids (or null) per shape cell.
  if (placements.some(p => !p)) return { correct: false, feedback: 'Colour every square before checking.' };
  if (new Set(placements).size !== 6) return { correct: false, feedback: 'Use each colour exactly once. A cube has six different faces here.' };
  const cells = question.shape.map((c, i) => ({ ...c, content: { glyph: 'square', fill: placements[i] } }));
  const built = foldNet(cells);
  const targetFold = foldNet(question.target.cells);
  if (cubesEquivalent(question.target, targetFold, { cells }, built)) return { correct: true, feedback: 'Correct. Folded, your net gives exactly this cube.' };
  for (let i = 0; i < 6; i++) {
    const fill = placements[i];
    const mine = placements[oppositeIndex(built, i)];
    const targetIndex = question.target.cells.findIndex(c => c.content.fill === fill);
    const theirs = question.target.cells[oppositeIndex(targetFold, targetIndex)].content.fill;
    if (mine !== theirs) return { correct: false, feedback: `On your net ${paletteNames[fill]} ends up opposite ${paletteNames[mine]}, but on the cube ${paletteNames[fill]} is opposite ${paletteNames[theirs]}.` };
  }
  return { correct: false, feedback: 'Every opposite pair is right, but the three colours around each corner run the other way. Your net makes the mirror image of this cube. Swap two colours that touch.' };
}

export function checkAnswer(question, response) {
  if (question.kind === 'build-net') return checkBuild(question, response);
  const correct = response === question.answer;
  if (correct) return { correct: true, feedback: `Correct. ${question.explanation}` };
  const chosen = question.options.find(o => o.id === response);
  const why = chosen?.reason ? ` ${chosen.reason}` : '';
  return { correct: false, feedback: `Not quite.${why} ${question.explanation}`.replace(/\s+/g, ' ').trim() };
}

// =====================================================================
// Exam standard, Exam hard and Mastery (levels 3 and 4).
// Specification: docs/learn/topics/cube-nets.md, sections 4 to 6.
//
// Conventions, on top of the ones above:
// - `turn` on a cell's content is quarter turns anticlockwise of the symbol
//   on the paper (glyphAxes). Every net an upper-tier question draws is laid
//   out by unfoldCube on one of the eleven shapes in one of eight
//   orientations, so turns appear on the question net as well as the options.
// - The mirror of a cube (mirrorNet) keeps every symbol readable: a symbol
//   whose mirror image is a turned copy of itself (a line, a bend) is turned
//   to that copy; a truly one-handed symbol (F, L, an arrowhead corner) keeps
//   its own shape. Either way the result never folds into the original cube.
// - Option ids are the labels A to D. Multiple-select answers are sorted.
// - Every option is verified: single-choice questions have exactly one
//   option that fits, select-all questions have one to three.
// =====================================================================
const mul3 = (a, b) => a.map(row => [0, 1, 2].map(j => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
const AXIS_NORMALS = [vec(1, 0, 0), vec(-1, 0, 0), vec(0, 1, 0), vec(0, -1, 0), vec(0, 0, 1), vec(0, 0, -1)];
const turnMatrix = t => { let m = I; for (let i = 0; i < ((t % 4) + 4) % 4; i++) m = mul2(R90, m); return m; };
const labelled = (rng, options) => shuffle(rng, options).map((o, i) => ({ ...o, id: ordinal(i), label: ordinal(i) }));
const name = content => contentLabel(content);
const Name = content => sentence(contentLabel(content));
const sameContent = (a, b) => contentKey(a) === contentKey(b);

// ---------- pentominoes and open boxes ----------
const P = list => Object.freeze(list.map(([x, y]) => Object.freeze({ x, y })));
export const pentominoes = Object.freeze({
  F: P([[1, 2], [2, 2], [0, 1], [1, 1], [1, 0]]), I: P([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]),
  L: P([[0, 0], [0, 1], [0, 2], [0, 3], [1, 0]]), N: P([[0, 0], [0, 1], [1, 1], [1, 2], [1, 3]]),
  P: P([[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]]), T: P([[0, 2], [1, 2], [2, 2], [1, 1], [1, 0]]),
  U: P([[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]]), V: P([[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]]),
  W: P([[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]]), X: P([[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]),
  Y: P([[0, 1], [1, 1], [2, 1], [3, 1], [1, 0]]), Z: P([[0, 2], [1, 2], [1, 1], [1, 0], [2, 0]]),
});
export const pentominoNames = Object.freeze(Object.keys(pentominoes));
export function polyominoes(size) {
  let shapes = new Map([['0,0', [{ x: 0, y: 0 }]]]);
  for (let n = 1; n < size; n++) {
    const next = new Map();
    for (const cells of shapes.values()) {
      const taken = new Set(cells.map(cellKey));
      for (const c of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const grown = { x: c.x + dx, y: c.y + dy };
        if (!taken.has(cellKey(grown))) { const shape = normalise([...cells, grown]); next.set(serial(shape), shape); }
      }
    }
    shapes = next;
  }
  const free = new Map();
  for (const cells of shapes.values()) free.set(canonical(cells), cells);
  return [...free.values()];
}
export const freeShapeKey = cells => canonical(cells);
// An open box: five faces, no lid. The base is the face opposite the missing one.
export function openBox(cells) {
  const fold = foldCells(cells);
  if (!fold.ok) return { ok: false, fold };
  const missing = AXIS_NORMALS.find(n => !fold.frames.some(f => same(f.n, n)));
  const base = fold.frames.findIndex(f => same(f.n, neg(missing)));
  return { ok: true, fold, missing, base };
}
export const openBoxNames = Object.freeze(pentominoNames.filter(n => openBox(pentominoes[n]).ok));

// ---------- edges, mirrors and unfolding ----------
// The faces met across each edge of the symbol on cell `index`: across its top, right, bottom and left.
export function edgeNeighbours(net, fold, index) {
  const { r, u } = glyphAxes(fold.frames[index], net.cells[index].content?.turn);
  const at = d => fold.frames.findIndex(f => f && same(f.n, d));
  return { top: at(u), right: at(r), bottom: at(neg(u)), left: at(neg(r)) };
}
function mirrorTurn(content) {
  const t = content.turn ?? 0;
  const mirrored = mul2(MX, turnMatrix(t));
  for (let k = 0; k < 4; k++) if (canonicalOrientation(turnMatrix(k), content.glyph) === canonicalOrientation(mirrored, content.glyph)) return k;
  return (4 - t) % 4;
}
export function mirrorNet(net) {
  const maxX = Math.max(...net.cells.map(c => c.x));
  return { ...net, cells: net.cells.map(c => ({ ...c, x: maxX - c.x, content: { ...c.content, turn: mirrorTurn(c.content) } })) };
}
// Lay a cube out on another shape: the net on `shape` (cells without content)
// whose fold is the given cube turned by `rotation`.
export function unfoldCube(net, fold, shape, rotation = identity) {
  const target = foldNet(shape.map(c => ({ x: c.x, y: c.y })));
  const cells = shape.map((c, j) => {
    const frame = target.frames[j];
    const i = fold.frames.findIndex(f => same(apply(rotation, f.n), frame.n));
    const source = glyphAxes(fold.frames[i], net.cells[i].content.turn);
    const r = apply(rotation, source.r), u = apply(rotation, source.u);
    const turn = [0, 1, 2, 3].find(t => { const axes = glyphAxes(frame, t); return same(axes.r, r) && same(axes.u, u); });
    return { x: c.x, y: c.y, content: { ...net.cells[i].content, turn } };
  });
  return { cells };
}
export const sameCube = (a, b) => cubesEquivalent(a, foldNet(a.cells), b, foldNet(b.cells));
export const oppositeContent = (net, fold, content) => net.cells[oppositeIndex(fold, net.cells.findIndex(c => sameContent(c.content, content)))].content;
function randomLayout(rng, net, exclude = []) {
  const shapes = cubeNets.filter(n => !exclude.includes(n.id));
  const base = pick(rng, shapes);
  const laid = unfoldCube(net, foldNet(net.cells), transformCells(base.cells, Math.floor(rng() * 8)), pick(rng, rotations));
  return { ...laid, id: base.id };
}
function asymmetricContents(rng, count) {
  const glyphsChosen = shuffle(rng, asymmetricGlyphs).slice(0, count);
  return shuffle(rng, palette).slice(0, count).map((fill, i) => ({ glyph: glyphsChosen[i], fill }));
}
const viewContents = view => slotNames.map(s => view[s]).filter(Boolean).map(f => f.content);
function pairsText(net, fold) {
  const seen = new Set(), pairs = [];
  net.cells.forEach((c, i) => {
    if (seen.has(i)) return;
    const j = oppositeIndex(fold, i);
    seen.add(i); seen.add(j);
    pairs.push(`${name(c.content)} and ${name(net.cells[j].content)}`);
  });
  return pairs.join('; ');
}
function anchorText(net, fold, content) {
  const i = net.cells.findIndex(c => sameContent(c.content, content));
  const e = edgeNeighbours(net, fold, i);
  return `Anchor on ${name(content)}. On the net the face across the top of its symbol is ${name(net.cells[e.top].content)}, and across its right edge is ${name(net.cells[e.right].content)}.`;
}
const cornerText = view => `top ${name(view.top.content)}, then right ${name(view.right.content)}, then left ${name(view.left.content)}`;

// ---------- net mutations, each verified by the caller ----------
function turnOneFace(rng, net, allowed = null) {
  const choices = net.cells.map((c, i) => i).filter(i => net.cells[i].content.glyph !== 'blank' && (!allowed || allowed.some(a => sameContent(a, net.cells[i].content))));
  const i = pick(rng, choices);
  const by = pick(rng, [1, 2, 3]);
  const cells = net.cells.map((c, j) => (j === i ? { ...c, content: { ...c.content, turn: ((c.content.turn ?? 0) + by) % 4 } } : c));
  return { net: { ...net, cells }, face: net.cells[i].content };
}
function swapTouching(rng, net, fold) {
  const i = Math.floor(rng() * 6), j = pick(rng, adjacentIndices(fold, i));
  const cells = net.cells.map(c => ({ ...c }));
  [cells[i].content, cells[j].content] = [cells[j].content, cells[i].content];
  return { net: { ...net, cells }, a: net.cells[i].content, b: net.cells[j].content };
}
// Reasons that name the faces, computed by comparing the option's fold with the true cube.
function netReason(type, truth, detail, option) {
  const truthFold = foldNet(truth.cells), optionFold = foldNet(option.cells);
  if (type === 'mirror') return 'Its opposite pairs are right, but folded, the faces run the other way round every corner. This net makes the mirror image.';
  if (type === 'pair') {
    const now = oppositeContent(option, optionFold, detail.a), was = oppositeContent(truth, truthFold, detail.a);
    return `On this net ${name(detail.a)} is opposite ${name(now)}, but on the cube ${name(detail.a)} is opposite ${name(was)}.`;
  }
  const at = (n, f) => n.cells[edgeNeighbours(n, f, n.cells.findIndex(c => sameContent(c.content, detail.face))).top].content;
  return `The ${name(detail.face)} face is turned. On this net the face across the top of its symbol is ${name(at(option, optionFold))}; on the cube it is ${name(at(truth, truthFold))}.`;
}

// ---------- cube pictures at level 3 ----------
function turnSlot(rng, view) {
  for (let guard = 0; guard < 20; guard++) {
    const slot = pick(rng, slotNames), turn = pick(rng, [R90, R180, R270]);
    const face = view[slot];
    if (canonicalOrientation(mul2(face.m, turn), face.content.glyph) === canonicalOrientation(face.m, face.content.glyph)) continue;
    return { view: { ...view, [slot]: { ...face, m: mul2(face.m, turn) } }, face: face.content };
  }
  return null;
}
function viewDistractor(rng, type, net, fold) {
  if (type === 'mirror') {
    const mirror = mirrorNet(net);
    return { view: cubeView(mirror, foldNet(mirror.cells), pick(rng, rotations)), reason: 'These three faces do meet at a corner, but they run the other way round it. This is the mirror image of the folded cube.' };
  }
  const base = cubeView(net, fold, pick(rng, rotations));
  if (type === 'turned') {
    const turned = turnSlot(rng, base);
    return turned && { view: turned.view, reason: `The ${name(turned.face)} face is turned the wrong way for the faces beside it. Check which face sits across the top of its symbol on the net.` };
  }
  if (type === 'swapped') {
    const a = pick(rng, slotNames), b = pick(rng, slotNames.filter(s => s !== a));
    return { view: { ...base, [a]: { ...base[b], m: base[a].m }, [b]: { ...base[a], m: base[b].m } }, reason: `${Name(base[a].content)} and ${name(base[b].content)} have changed places round the corner, so the order round the corner is wrong.` };
  }
  const slot = pick(rng, slotNames), index = oppositeIndex(fold, base[slot].cell);
  return { view: { ...base, [slot]: { cell: index, content: net.cells[index].content, m: base[slot].m } }, reason: `It shows ${name(net.cells[index].content)} beside ${name(base[slot === 'top' ? 'left' : 'top'].content)}, but ${name(net.cells[index].content)} is opposite ${name(base[slot].content)}, which does meet them. Opposite faces are never seen together.` };
}
function cubeExamQuestion(rng, seed, mode) {
  const source = randomNet(rng, asymmetricContents(rng, 6));
  const net = randomLayout(rng, source);
  const fold = foldNet(net.cells);
  const real = allViewSignatures(net, fold);
  const used = new Set(), options = [];
  const add = (view, correct, reason, type) => {
    const signature = viewSignature(view);
    if (used.has(signature) || real.has(signature) !== (mode === 'can' ? correct : !correct)) return false;
    used.add(signature);
    options.push({ view, correct, reason, type });
    return true;
  };
  if (mode === 'can') {
    add(cubeView(net, fold, pick(rng, rotations)), true, 'Every face, the order round the corner and the turn of each symbol all match the net.');
    const types = shuffle(rng, ['mirror', 'turned', 'swapped', pick(rng, ['turned', 'mirror'])]);
    for (let guard = 0; options.length < 4 && guard < 300; guard++) {
      const type = types[options.length - 1] ?? pick(rng, ['turned', 'mirror', 'swapped']);
      const d = viewDistractor(rng, type, net, fold);
      if (d) add(d.view, false, d.reason, type);
    }
  } else {
    for (let guard = 0; options.length < 3 && guard < 300; guard++) add(cubeView(net, fold, pick(rng, rotations)), false, 'This view can be made: the faces, their order round the corner and every turn match the net.');
    const type = rng() < 0.17 ? 'opposite-together' : pick(rng, ['mirror', 'turned', 'swapped']);
    for (let guard = 0; options.length < 4 && guard < 300; guard++) {
      const d = viewDistractor(rng, guard < 100 ? type : pick(rng, ['mirror', 'turned']), net, fold);
      if (d) add(d.view, true, d.reason, 'impossible');
    }
  }
  const shuffled = labelled(rng, options);
  const answer = shuffled.find(o => o.correct);
  const together = shuffled.find(o => o.view && slotNames.some(a => slotNames.some(b => a !== b && oppositeIndex(fold, o.view[a].cell) === o.view[b].cell)));
  return {
    kind: mode === 'can' ? 'which-cube' : 'cannot-cube', seed,
    prompt: mode === 'can' ? 'Which cube can be made by folding this net?' : 'Which cube CANNOT be made from this net?',
    net, options: shuffled.map(({ type, ...o }) => o), answer: answer.id, explanation: answer.reason,
    hints: ['Every symbol has a direction, so the turn test decides most options here.', 'Anchor on one face. On the net, note which face sits across the top of its symbol, then check that face in each picture.'],
    solution: [
      { text: `Opposite pairs on the net: ${pairsText(net, fold)}. ${together ? `Option ${together.label} shows an opposite pair together, so it is impossible.` : 'No option shows an opposite pair together, so test 1 settles nothing here.'}` },
      { text: anchorText(net, fold, answer.view.top.content) },
      ...shuffled.filter(o => o.id !== answer.id || mode === 'cannot').map(o => ({ text: `Option ${o.label}: ${o.reason}` })),
      { text: `So the answer is ${answer.label}.` },
    ],
  };
}

// ---------- which net, level 3 and 4 ----------
// Level 4 shuffles the three hidden faces of every option, so options cannot be compared with each other.
function shuffleHidden(rng, net, view) {
  const shown = new Set(slotNames.map(s => view[s].cell));
  const hidden = net.cells.map((c, i) => i).filter(i => !shown.has(i));
  const order = shuffle(rng, hidden);
  return { ...net, cells: net.cells.map((c, i) => (shown.has(i) ? c : { ...c, content: { ...net.cells[order[hidden.indexOf(i)]].content, turn: Math.floor(rng() * 4) } })) };
}
function whichNetExam(rng, seed, level) {
  const cube = randomNet(rng, asymmetricContents(rng, 6));
  const fold = foldNet(cube.cells);
  const view = cubeView(cube, fold, pick(rng, rotations));
  const signature = viewSignature(view);
  const shown = viewContents(view);
  const fits = n => allViewSignatures(n, foldNet(n.cells)).has(signature);
  const variant = () => (level === 4 ? shuffleHidden(rng, cube, view) : cube);
  const options = [], usedShapes = [];
  const add = (made, correct, reason) => {
    const laid = randomLayout(rng, made, usedShapes);
    if (fits(laid) !== correct) return false;
    usedShapes.push(laid.id);
    options.push({ net: laid, correct, reason });
    return true;
  };
  for (let guard = 0; !options.length && guard < 50; guard++) add(variant(), true, 'Folded, this net puts these three faces round one corner in this order, each symbol turned as shown.');
  const types = shuffle(rng, ['mirror', 'turned', 'swap']);
  for (let guard = 0; options.length < 4 && guard < 300; guard++) {
    const type = types[(options.length - 1) % 3];
    const start = variant();
    if (type === 'mirror') add(mirrorNet(start), false, 'Its faces sit in the right pairs, but folded, these three run the other way round the corner. It makes the mirror image.');
    else if (type === 'turned') { const t = turnOneFace(rng, start, shown); add(t.net, false, `The ${name(t.face)} face is turned: folded, its symbol points a different way from the picture.`); }
    else {
      const [a, b] = shuffle(rng, shown).slice(0, 2);
      const cells = start.cells.map(c => (sameContent(c.content, a) ? { ...c, content: { ...b, turn: c.content.turn } } : sameContent(c.content, b) ? { ...c, content: { ...a, turn: c.content.turn } } : c));
      add({ cells }, false, `${Name(a)} and ${name(b)} have changed places on this net, so the three faces meet in the wrong order.`);
    }
  }
  const shuffled = labelled(rng, options);
  const answer = shuffled.find(o => o.correct);
  return {
    kind: 'which-net', seed, prompt: level === 4 ? 'Which net can fold into this cube? Only three faces are shown; the hidden faces may be anything.' : 'Which net folds into this cube?',
    view, options: shuffled, answer: answer.id, explanation: answer.reason,
    hints: level === 4
      ? ['The hidden faces differ from net to net. Ignore them: only the three faces in the picture matter.', 'On each net, find the three faces. Check they meet, then the order round the corner, then the turn of each symbol.']
      : ['The nets are different shapes, so compare faces, not positions.', 'Anchor on the top face. On each net, check which face sits across the top of its symbol.'],
    solution: [
      { text: `The picture shows, clockwise round the corner: ${cornerText(view)}.` },
      ...(level === 4 ? [{ text: 'The three faces you cannot see are not fixed by the picture, so a net may put anything there.' }] : []),
      { text: 'On each net, check that the three faces touch, that they run the same way round the corner, and that each symbol points the same way relative to its neighbours.' },
      ...shuffled.filter(o => !o.correct).map(o => ({ text: `Option ${o.label}: ${o.reason}` })),
      { text: `So the answer is ${answer.label}.` },
    ],
  };
}

// ---------- net from views ----------
function viewsCovering(rng, net, fold, blank) {
  // Level 4: three corner views, none showing the blank face, five faces between them.
  const candidates = shuffle(rng, rotations.filter(r => slotNames.every(s => !sameContent(cubeView(net, fold, r)[s].content, blank))));
  for (let a = 0; a < candidates.length; a++) for (let b = a + 1; b < candidates.length; b++) for (let c = b + 1; c < candidates.length; c++) {
    const views = [candidates[a], candidates[b], candidates[c]].map(r => cubeView(net, fold, r));
    const corners = new Set(views.map(v => slotNames.map(s => v[s].cell).sort().join()));
    const faces = new Set(views.flatMap(v => slotNames.map(s => v[s].cell)));
    if (corners.size === 3 && faces.size === 5) return views;
  }
  return null;
}
function netFromViewsQuestion(rng, seed, level) {
  let contents;
  if (level === 3) {
    const symbols = asymmetricContents(rng, 3);
    const fills = palette.filter(f => !symbols.some(s => s.fill === f));
    contents = shuffle(rng, [...symbols, ...fills.map(fill => ({ glyph: 'square', fill }))]);
  } else contents = shuffle(rng, [...asymmetricContents(rng, 5), { glyph: 'blank' }]);
  const blank = { glyph: 'blank' };
  let cube, fold, views;
  for (let guard = 0; guard < 20; guard++) {
    cube = randomNet(rng, contents);
    fold = foldNet(cube.cells);
    if (level === 3) {
      const r = pick(rng, rotations);
      views = [cubeView(cube, fold, r), cubeView(cube, fold, mul3(oppositeView, r))];
      break;
    }
    views = viewsCovering(rng, cube, fold, blank);
    if (views) break;
  }
  const signatures = views.map(viewSignature);
  const fits = n => { const all = allViewSignatures(n, foldNet(n.cells)); return signatures.every(s => all.has(s)); };
  const options = [], usedShapes = [];
  const add = (made, correct, reason) => {
    const laid = randomLayout(rng, made, usedShapes);
    if (fits(laid) !== correct || sameCube(laid, cube) !== correct) return false;
    usedShapes.push(laid.id);
    options.push({ net: laid, correct, reason: typeof reason === 'function' ? reason(laid) : reason });
    return true;
  };
  for (let guard = 0; !options.length && guard < 20; guard++) add(cube, true, 'Folded, this net matches every view: the same pairs, the same order round each corner, every symbol turned the same way.');
  const types = shuffle(rng, ['mirror', 'pair', 'turned']);
  for (let guard = 0; options.length < 4 && guard < 300; guard++) {
    const type = types[(options.length - 1) % 3];
    if (type === 'mirror') add(mirrorNet(cube), false, laid => netReason('mirror', cube, null, laid));
    else if (type === 'pair') { const s = swapTouching(rng, cube, fold); add(s.net, false, laid => netReason('pair', cube, s, laid)); }
    else { const t = turnOneFace(rng, cube, contents.filter(c => c.glyph !== 'square' && c.glyph !== 'blank')); add(t.net, false, laid => netReason('turned', cube, t, laid)); }
  }
  const shuffled = labelled(rng, options);
  const answer = shuffled.find(o => o.correct);
  const shared = level === 4 ? viewContents(views[0]).find(c => views.every(v => viewContents(v).some(d => sameContent(c, d)))) : null;
  return {
    kind: 'net-from-views', seed,
    prompt: level === 4 ? 'These three views show one cube. The sixth face is blank. Which net folds into this cube?' : 'These two views show the same cube from opposite corners. Which net folds into it?',
    views, options: shuffled, answer: answer.id, explanation: answer.reason,
    hints: level === 4
      ? ['The blank face never appears. It must be opposite the face that appears in every view.', 'Fix the pairs first, then one corner, then the turn of one symbol.']
      : ['Each face in the first view is opposite one face in the second. List the three pairs.', 'Then read the first corner clockwise and check that order on each net.'],
    solution: [
      ...(level === 4
        ? [{ text: `${Name(shared)} appears in all three views, and the blank face in none. So the blank face is opposite ${name(shared)}.` }]
        : [{ text: 'The two views are opposite corners, so every face in one view is opposite a face in the other.' }]),
      { text: `The opposite pairs are: ${pairsText(cube, fold)}.` },
      { text: `Clockwise round the corner of the first view: ${cornerText(views[0])}. A true net runs the same way.` },
      ...shuffled.filter(o => !o.correct).map(o => ({ text: `Option ${o.label}: ${o.reason}` })),
      { text: `So the answer is ${answer.label}.` },
    ],
  };
}

// ---------- open boxes ----------
function openBoxQuestion(rng, seed) {
  const variant = pick(rng, ['base', 'opposite', 'which', 'which-not']);
  if (variant === 'which' || variant === 'which-not') {
    const good = shuffle(rng, openBoxNames), bad = shuffle(rng, pentominoNames.filter(n => !openBoxNames.includes(n)));
    const names = variant === 'which' ? [good[0], ...bad.slice(0, 3)] : [bad[0], ...good.slice(0, 3)];
    const options = labelled(rng, names.map(n => {
      const cells = transformCells(pentominoes[n], Math.floor(rng() * 8)).map((c, i) => ({ ...c, content: { glyph: String(i + 1) } }));
      const box = openBox(cells);
      const correct = variant === 'which' ? box.ok : !box.ok;
      const reason = box.ok
        ? `This folds into an open box: square ${box.base + 1} is the base and the other four stand round it as walls.`
        : `Squares ${box.fold.cells[0] + 1} and ${box.fold.cells[1] + 1} land on the same wall, so this cannot make an open box.`;
      return { net: { cells }, correct, reason, shape: n };
    }));
    const answer = options.find(o => o.correct);
    return {
      kind: 'open-box', seed, variant,
      prompt: variant === 'which' ? 'An open box is a cube without its lid. Which shape folds into an open box?' : 'An open box is a cube without its lid. Which shape CANNOT fold into an open box?',
      options: options.map(({ shape, ...o }) => o), answer: answer.id, explanation: answer.reason,
      hints: ['Choose a square to be the base and fold its neighbours up as walls.', 'A 2-by-2 block, a row of five, or two squares that reach the same wall can never work.'],
      solution: [
        { text: 'An open box has a base and four walls. Every wall touches the base; no two squares may land on the same wall.' },
        ...options.map(o => ({ text: `Option ${o.label}: ${o.reason}` })),
        { text: `So the answer is ${answer.label}.` },
      ],
    };
  }
  const shapeName = pick(rng, openBoxNames);
  const cells = transformCells(pentominoes[shapeName], Math.floor(rng() * 8)).map((c, i) => ({ ...c, content: { glyph: ordinal(i) } }));
  const box = openBox(cells);
  const touches = (i, j) => dot(box.fold.frames[i].n, box.fold.frames[j].n) === 0;
  let ask, target;
  if (variant === 'base') target = box.base;
  else {
    ask = pick(rng, [0, 1, 2, 3, 4].filter(i => i !== box.base));
    target = box.fold.frames.findIndex(f => same(f.n, neg(box.fold.frames[ask].n)));
  }
  const others = shuffle(rng, [0, 1, 2, 3, 4].filter(i => i !== target && i !== ask)).slice(0, 3);
  const options = labelled(rng, [target, ...others].map(i => ({ text: ordinal(i), square: i, correct: i === target })))
    .map(o => ({ ...o, text: ordinal(o.square), reason: o.correct
      ? (variant === 'base' ? `${ordinal(o.square)} touches all four other squares once folded, so it is the base.` : `${ordinal(o.square)} is the only square that never meets ${ordinal(ask)}: they are opposite walls.`)
      : variant === 'base'
        ? `${ordinal(o.square)} is a wall: once folded it does not touch ${ordinal([0, 1, 2, 3, 4].find(j => j !== o.square && !touches(o.square, j)))}.`
        : o.square === box.base ? `${ordinal(o.square)} is the base, and the base touches every wall.` : `${ordinal(o.square)} stands beside ${ordinal(ask)}: they share an upright edge of the box.` }));
  const answer = options.find(o => o.correct);
  return {
    kind: 'open-box', seed, variant, net: { cells },
    prompt: variant === 'base' ? 'This shape folds into an open box, a cube without its lid. Which square is the base, opposite the open top?' : `This shape folds into an open box, a cube without its lid. Which square is opposite ${ordinal(ask)}?`,
    focus: ask ?? null,
    options: options.map(({ square, ...o }) => o), answer: answer.id, explanation: answer.reason,
    hints: ['The base touches all four walls once folded. A wall touches only three squares.', 'Opposite walls never share an edge, and on the net they are often the ends of a line of three.'],
    solution: [
      { text: `Fold the shape: ${ordinal(box.base)} becomes the base and the other four stand up as walls round it.` },
      ...(variant === 'opposite' ? [{ text: `${ordinal(ask)} meets the base and two walls. The one square it never meets is opposite it.` }] : [{ text: 'Only the base touches all four other squares after folding.' }]),
      ...options.filter(o => !o.correct).map(o => ({ text: `${o.text}: ${o.reason}` })),
      { text: `So the answer is ${answer.text}.` },
    ],
  };
}

// ---------- same cube, select all ----------
function sameCubeQuestion(rng, seed) {
  const cube = randomNet(rng, asymmetricContents(rng, 6));
  const reference = randomLayout(rng, cube);
  const fold = foldNet(cube.cells);
  const rightCount = pick(rng, [1, 2, 2, 3]);
  const options = [], usedShapes = [reference.id];
  const add = (made, correct, reason) => {
    const laid = randomLayout(rng, made, usedShapes);
    if (sameCube(laid, reference) !== correct) return false;
    usedShapes.push(laid.id);
    options.push({ net: laid, correct, reason: typeof reason === 'function' ? reason(laid) : reason });
    return true;
  };
  for (let guard = 0; options.length < rightCount && guard < 50; guard++) add(cube, true, 'Same three opposite pairs, same order round a corner, every symbol turned the same way relative to its neighbours: it folds into the same cube.');
  const types = shuffle(rng, ['mirror', 'pair', 'turned']);
  for (let guard = 0; options.length < 4 && guard < 300; guard++) {
    const type = types[(options.length - rightCount) % 3];
    if (type === 'mirror') add(mirrorNet(cube), false, laid => netReason('mirror', cube, null, laid));
    else if (type === 'pair') { const s = swapTouching(rng, cube, fold); add(s.net, false, laid => netReason('pair', cube, s, laid)); }
    else { const t = turnOneFace(rng, cube); add(t.net, false, laid => netReason('turned', cube, t, laid)); }
  }
  const shuffled = labelled(rng, options);
  const answer = shuffled.filter(o => o.correct).map(o => o.id).sort();
  const refFold = foldNet(reference.cells);
  return {
    kind: 'same-cube', seed, answerMode: 'multi', net: reference,
    prompt: 'Which of these nets fold into the same cube as the net above?',
    options: shuffled, answer,
    explanation: `${answer.length === 1 ? 'Only option' : 'Options'} ${answer.join(' and ')} ${answer.length === 1 ? 'passes' : 'pass'} all three parts of the same-cube test: pairs, the order round a corner and the turns.`,
    hints: ['Check the opposite pairs on every net first. Any net with a wrong pair is out.', 'Then anchor on one face and check which face sits across the top of its symbol.'],
    solution: [
      { text: `Opposite pairs on the given net: ${pairsText(reference, refFold)}.` },
      { text: anchorText(reference, refFold, reference.cells[0].content) },
      ...shuffled.map(o => ({ text: `Option ${o.label}: ${o.reason}` })),
      { text: `So the answer is ${answer.join(' and ')}.` },
    ],
  };
}

// ---------- a path across faces ----------
// A path visits three or four faces. On each it runs from the edge it came in by to the edge it leaves by:
// straight across when those edges are opposite, a bend when they meet at a corner.
function pathOnCube(rng) {
  for (let guard = 0; guard < 200; guard++) {
    const length = pick(rng, [3, 4, 4]);
    const seq = [pick(rng, AXIS_NORMALS)];
    while (seq.length < length) {
      const next = AXIS_NORMALS.filter(n => dot(n, seq[seq.length - 1]) === 0 && !seq.some(s => same(s, n)));
      if (!next.length) break;
      seq.push(pick(rng, next));
    }
    if (seq.length < length) continue;
    const free = n => !seq.some(s => same(s, n));
    const starts = AXIS_NORMALS.filter(d => dot(d, seq[0]) === 0 && free(d)), ends = AXIS_NORMALS.filter(d => dot(d, seq[length - 1]) === 0 && free(d));
    if (!starts.length || !ends.length) continue;
    const start = pick(rng, starts), end = pick(rng, ends);
    return seq.map((n, i) => ({ n, from: i === 0 ? start : seq[i - 1], to: i === length - 1 ? end : seq[i + 1] }));
  }
  return null;
}
function pathTurn(frame, piece) {
  for (let t = 0; t < 4; t++) {
    const { r, u } = glyphAxes(frame, t);
    if (piece.glyph === 'line' && (same(u, piece.to) || same(u, piece.from))) return t;
    if (piece.glyph === 'bend' && ((same(neg(u), piece.from) && same(r, piece.to)) || (same(neg(u), piece.to) && same(r, piece.from)))) return t;
  }
  return null;
}
function pathCubeQuestion(rng, seed) {
  let net, fold, path;
  for (let guard = 0; guard < 50 && !net; guard++) {
    path = pathOnCube(rng);
    const shape = transformCells(pick(rng, cubeNets).cells, Math.floor(rng() * 8));
    const shapeFold = foldNet(shape);
    const fills = shuffle(rng, palette);
    const cells = shape.map((c, i) => {
      const piece = path.find(p => same(p.n, shapeFold.frames[i].n));
      if (!piece) return { ...c, content: { glyph: 'square', fill: fills[i] } };
      const glyph = same(piece.from, neg(piece.to)) ? 'line' : 'bend';
      return { ...c, content: { glyph, fill: fills[i], turn: pathTurn(shapeFold.frames[i], { ...piece, glyph }) } };
    });
    if (cells.some(c => c.content.turn === null)) continue;
    net = { cells };
    fold = shapeFold;
  }
  const order = path.map(p => net.cells[fold.frames.findIndex(f => same(f.n, p.n))].content);
  const onPath = content => order.some(c => sameContent(c, content));
  const joins = view => {
    const shown = slotNames.map(s => view[s].content);
    return order.slice(1).filter((c, i) => shown.some(s => sameContent(s, c)) && shown.some(s => sameContent(s, order[i]))).length;
  };
  const real = allViewSignatures(net, fold);
  const goodRotations = rotations.filter(r => joins(cubeView(net, fold, r)) >= 1);
  const best = Math.max(...goodRotations.map(r => joins(cubeView(net, fold, r))));
  const used = new Set(), options = [];
  const add = (view, correct, reason) => {
    const signature = viewSignature(view);
    if (used.has(signature) || real.has(signature) !== correct) return false;
    used.add(signature);
    options.push({ view, correct, reason });
    return true;
  };
  add(cubeView(net, fold, pick(rng, goodRotations.filter(r => joins(cubeView(net, fold, r)) === best))), true, 'Each piece of the line leaves its face through the same edge by which it enters the next, exactly as on the net.');
  const mirror = mirrorNet(net), mirrorFold = foldNet(mirror.cells);
  const mirrorRotations = rotations.filter(r => joins(cubeView(mirror, mirrorFold, r)) >= 1);
  const types = shuffle(rng, ['break', 'mirror', 'colours']);
  for (let guard = 0; options.length < 4 && guard < 300; guard++) {
    const type = types[(options.length - 1) % 3];
    if (type === 'mirror') { add(cubeView(mirror, mirrorFold, pick(rng, mirrorRotations)), false, 'The line looks unbroken, but the faces run the other way round the corner. This is the mirror image of the folded net.'); continue; }
    const view = cubeView(net, fold, pick(rng, goodRotations));
    const pathSlots = slotNames.filter(s => onPath(view[s].content));
    if (type === 'break') {
      const slot = pick(rng, pathSlots), face = view[slot];
      add({ ...view, [slot]: { ...face, m: mul2(face.m, R90) } }, false, `The line on the ${paletteNames[face.content.fill]} face is turned a quarter turn, so it leaves that face through the wrong edge.`);
    } else {
      const [a, b] = shuffle(rng, slotNames).slice(0, 2);
      if (!onPath(view[a].content) && !onPath(view[b].content)) continue;
      add({ ...view, [a]: { ...view[a], content: { ...view[a].content, fill: view[b].content.fill } }, [b]: { ...view[b], content: { ...view[b].content, fill: view[a].content.fill } } }, false,
        `The ${paletteNames[view[a].content.fill]} and ${paletteNames[view[b].content.fill]} faces have changed colours. The line may look right, but on the net these colours are not arranged like this.`);
    }
  }
  const shuffled = labelled(rng, options);
  const answer = shuffled.find(o => o.correct);
  return {
    kind: 'path-cube', seed, net, prompt: 'A line is drawn across the faces of this net. Which cube shows the line correctly after folding?',
    options: shuffled, answer: answer.id, explanation: answer.reason,
    hints: ['Follow the line on the net face by face. Note which coloured face it enters next and through which edge.', 'A line leaves one face and enters the next through the same shared edge.'],
    solution: [
      { text: `On the net the line runs over ${order.map(c => paletteNames[c.fill]).join(', then ')}.` },
      { text: 'Where it crosses from one face to the next, both pieces meet the same shared edge, at its middle. Folding keeps them joined.' },
      ...shuffled.filter(o => !o.correct).map(o => ({ text: `Option ${o.label}: ${o.reason}` })),
      { text: `So the answer is ${answer.label}.` },
    ],
  };
}

// kind → levels it supports at the exam tiers.
export const examKinds = Object.freeze({ 'net-from-views': [3, 4], 'open-box': [3], 'same-cube': [4], 'path-cube': [4] });
function examQuestion(kind, rng, seed, level) {
  switch (kind) {
    case 'which-cube': return cubeExamQuestion(rng, seed, 'can');
    case 'cannot-cube': return cubeExamQuestion(rng, seed, 'cannot');
    case 'which-net': return whichNetExam(rng, seed, level);
    case 'net-from-views': return netFromViewsQuestion(rng, seed, level);
    case 'open-box': return openBoxQuestion(rng, seed);
    case 'same-cube': return sameCubeQuestion(rng, seed);
    case 'path-cube': return pathCubeQuestion(rng, seed);
    default: throw new Error(`Unknown question kind: ${kind}`);
  }
}
