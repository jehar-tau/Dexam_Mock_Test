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
  const byPos = new Map();
  for (const [i, c] of cells.entries()) {
    const k = `${c.x},${c.y}`;
    if (byPos.has(k)) return { ok: false, reason: 'duplicate' };
    byPos.set(k, i);
  }
  const frames = new Array(6).fill(null);
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
  dot: D4, plus: D4, square: D4, ring: D4,
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
export const contentLabel = content => content.glyph === 'square' && content.fill
  ? `plain ${paletteNames[content.fill]}`
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

// A view is {top,left,right}: each {content, m} where m is the 2x2 matrix that
// maps the glyph's own axes into the face basis (e1,e2).
export function cubeView(net, fold, rotation) {
  const view = {};
  for (const [slot, basis] of Object.entries(SLOTS)) {
    const index = fold.frames.findIndex(f => same(apply(rotation, f.n), basis.normal));
    const f = fold.frames[index];
    const r = apply(rotation, f.r), u = apply(rotation, f.u);
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

export function generateQuestion(kind, seed) {
  const rng = seededRandom(seed);
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
