// Surfaces of solids: named solids, faces, edges and corners, extruded
// outlines, stepped stacks, notched blocks, tunnels, painted blocks split
// into pieces, and operations moved from one shape to another.
// Specification: docs/learn/topics/solid-surfaces.md.
import { pick, seededRandom, shuffle } from './random.js';
import { stackReadable } from './cube-count.js';

const LETTERS = 'ABCD';
const key = c => c.join(',');
const DIRS = [[0, 1, 'facing front'], [0, -1, 'facing back'], [1, 1, 'facing right'], [1, -1, 'facing left'], [2, 1, 'facing up'], [2, -1, 'facing down']];
// x runs to the viewer's front-right, y to the front-left, z up (as in the voxels figure).

// Unit faces open to the air, grouped by direction and plane, merged when they share an edge.
export function surfacesByDirection(cubes) {
  const has = new Set(cubes.map(key));
  return DIRS.map(([axis, sign, name]) => {
    const groups = new Map();
    for (const c of cubes) {
      const n = [...c]; n[axis] += sign;
      if (has.has(key(n))) continue;
      const plane = c[axis] + (sign > 0 ? 1 : 0), uv = [0, 1, 2].filter(i => i !== axis).map(i => c[i]);
      if (!groups.has(plane)) groups.set(plane, new Set());
      groups.get(plane).add(key(uv));
    }
    let count = 0;
    for (const cells of groups.values()) {
      const seen = new Set();
      for (const start of cells) {
        if (seen.has(start)) continue;
        count++;
        const stack = [start]; seen.add(start);
        while (stack.length) { const [u, v] = stack.pop().split(',').map(Number); for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key([u + du, v + dv]); if (cells.has(k) && !seen.has(k)) { seen.add(k); stack.push(k); } } }
      }
    }
    return { name, count };
  });
}
export const surfaceCount = cubes => surfacesByDirection(cubes).reduce((s, d) => s + d.count, 0);
export const unitFaces = cubes => { const has = new Set(cubes.map(key)); return cubes.reduce((s, c) => s + DIRS.filter(([a, sg]) => { const n = [...c]; n[a] += sg; return !has.has(key(n)); }).length, 0); };

// Corners of a union of unit cells: every lattice point where the boundary turns.
export function outlineSides(cells) {
  const has = new Set(cells.map(key));
  const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
  let corners = 0;
  for (let x = Math.min(...xs); x <= Math.max(...xs) + 1; x++) for (let y = Math.min(...ys); y <= Math.max(...ys) + 1; y++) {
    const q = [has.has(key([x - 1, y - 1])), has.has(key([x, y - 1])), has.has(key([x - 1, y])), has.has(key([x, y]))], n = q.filter(Boolean).length;
    if (n === 1 || n === 3) corners++;
    else if (n === 2 && q[0] === q[3]) corners += 2;
  }
  return corners;
}
const connected2 = cells => { if (!cells.length) return false; const has = new Set(cells.map(key)), seen = new Set([key(cells[0])]), st = [cells[0]]; while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key([x + dx, y + dy]); if (has.has(k) && !seen.has(k)) { seen.add(k); st.push([x + dx, y + dy]); } } } return seen.size === cells.length; };

function retry(seed, build) {
  for (let i = 0; i < 600; i++) { const q = build(seededRandom(seed * 4021 + i * 9173)); if (q) return q; }
  throw new Error('No surfaces question for seed ' + seed);
}
const numberOptions = (rng, value, wrong) => {
  const list = [{ value, correct: true, reason: 'Counted surface by surface.' }];
  for (const w of wrong) if (w.value > 0 && !list.some(o => o.value === w.value) && list.length < 4) list.push({ ...w, correct: false });
  for (let d = 1; list.length < 4; d++) for (const v of [value + d, value - d]) if (v > 0 && !list.some(o => o.value === v) && list.length < 4) list.push({ value: v, correct: false, reason: 'Count again, one direction at a time.' });
  const options = shuffle(rng, list).map((o, i) => ({ id: LETTERS[i], label: LETTERS[i], text: String(o.value), correct: o.correct, reason: o.reason }));
  return { options, answer: options.find(o => o.correct).id };
};
const toList = cubes => cubes.map(([x, y, z]) => ({ x, y, z }));
const directionLines = cubes => surfacesByDirection(cubes).map(d => ({ text: `${d.name.replace(/^./, c => c.toUpperCase())}: ${d.count}.` }));

// ---------- foundations ----------
export const SOLIDS = Object.freeze([
  { name: 'cube', faces: 6, edges: 12, corners: 8 }, { name: 'cuboid', faces: 6, edges: 12, corners: 8 },
  { name: 'triangular prism', faces: 5, edges: 9, corners: 6 }, { name: 'pentagonal prism', faces: 7, edges: 15, corners: 10 }, { name: 'hexagonal prism', faces: 8, edges: 18, corners: 12 }, { name: 'octagonal prism', faces: 10, edges: 24, corners: 16 },
  { name: 'square pyramid', faces: 5, edges: 8, corners: 5 }, { name: 'triangular pyramid', faces: 4, edges: 6, corners: 4 }, { name: 'pentagonal pyramid', faces: 6, edges: 10, corners: 6 }, { name: 'hexagonal pyramid', faces: 7, edges: 12, corners: 7 },
  { name: 'cylinder', faces: 3 }, { name: 'cone', faces: 2 }, { name: 'sphere', faces: 1 }, { name: 'hemisphere', faces: 2 },
]);
export function basicQuestion(seed) {
  return retry(seed, rng => {
    const s = pick(rng, SOLIDS), round = s.edges === undefined;
    const wrong = round ? [{ value: s.faces + 1, reason: 'A curved surface is one surface, however far it bends.' }, { value: s.faces === 1 ? 2 : s.faces - 1, reason: 'Every flat end counts as a surface of its own.' }] : [{ value: s.edges, reason: 'That is the number of edges, not surfaces.' }, { value: s.corners, reason: 'That is the number of corners.' }];
    const made = numberOptions(rng, s.faces, wrong);
    return { kind: 'basic-surfaces', seed, answerMode: 'single', prompt: `How many surfaces does a ${s.name} have?`, figures: [], ...made, explanation: round ? `A ${s.name} has ${s.faces} surface${s.faces > 1 ? 's' : ''}: every flat end, plus one curved surface.` : `A ${s.name} has ${s.faces} flat faces. ${s.name.includes('prism') || s.name.startsWith('cub') ? 'A prism has one face per side of its end shape, plus the two ends.' : 'A pyramid has one triangle per side of its base, plus the base.'}` };
  });
}
export function edgesCornersQuestion(seed) {
  return retry(seed, rng => {
    const s = pick(rng, SOLIDS.filter(x => x.edges)), ask = pick(rng, ['edges', 'corners', 'faces']), value = s[ask];
    const prism = s.name.includes('prism') || s.name.startsWith('cub'), n = prism ? s.corners / 2 : s.corners - 1;
    const wrong = { edges: [{ value: prism ? 2 * n : n, reason: prism ? 'Count the edges round the side as well: n on each end and n joining them.' : 'Count the slanting edges to the apex too, not only the base.' }, { value: s.corners, reason: 'That counts corners, not edges.' }], corners: [{ value: s.edges, reason: 'That counts edges.' }, { value: prism ? n : n + 2, reason: prism ? 'Both ends have corners.' : 'Base corners plus the one apex.' }], faces: [{ value: s.edges, reason: 'That counts edges.' }, { value: prism ? n : n + 2, reason: prism ? 'Remember the two end faces.' : 'One triangle per base side, plus the base.' }] }[ask];
    const made = numberOptions(rng, value, wrong);
    return { kind: 'edges-corners', seed, answerMode: 'single', prompt: `How many ${ask} does a ${s.name} have?`, figures: [], ...made, explanation: `${prism ? `A prism with an ${n}-sided end has ${n} + 2 faces, 3 × ${n} edges and 2 × ${n} corners` : `A pyramid with an ${n}-sided base has ${n} + 1 faces, 2 × ${n} edges and ${n} + 1 corners`}. Check: corners − edges + faces = ${s.corners} − ${s.edges} + ${s.faces} = 2.` };
  });
}

// ---------- outlines and extrusion ----------
const OUTLINES = Object.freeze({
  L: [[0, 0], [0, 1], [0, 2], [1, 0]], T: [[0, 2], [1, 2], [2, 2], [1, 1], [1, 0]], U: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]], plus: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
  step: [[0, 0], [1, 0], [2, 0], [1, 1], [2, 1], [2, 2]], Z: [[0, 2], [1, 2], [1, 1], [1, 0], [2, 0]], square: [[0, 0], [1, 0], [0, 1], [1, 1]], bar: [[0, 0], [1, 0], [2, 0]],
  E: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2], [1, 2], [2, 2], [0, 3], [0, 4], [1, 4], [2, 4]], H: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 0], [2, 1], [2, 2]], C: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2], [1, 2], [2, 2]], stairs: [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1], [3, 1], [2, 2], [3, 2], [3, 3]],
});
const RING = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [3, 1], [0, 2], [3, 2], [0, 3], [1, 3], [2, 3], [3, 3]];
export function extrusionQuestion(seed, level = 2) {
  return retry(seed, rng => {
    const name = pick(rng, Object.keys(OUTLINES).filter(n => n !== 'square' && n !== 'bar')), withHole = level >= 3 && rng() < 0.5;
    const cells = withHole ? RING.concat(pick(rng, [[], [[4, 0], [4, 1]], [[4, 3]]])) : OUTLINES[name], holeCells = withHole ? [[1, 1], [2, 1], [1, 2], [2, 2]] : [];
    const outer = outlineSides([...cells, ...holeCells]), inner = withHole ? 4 : 0, value = outer + inner + 2;
    const wrong = [{ value: outer + inner, reason: 'Add the two flat ends, top and bottom.' }, { value: cells.length + 2, reason: 'Count the sides of the outline, not the squares inside it.' }, ...(withHole ? [{ value: outer + 2, reason: 'The hole’s four walls are surfaces too.' }] : [])];
    const base = { kind: 'extrusion-surfaces', seed, prompt: `This flat shape${withHole ? ', with a square hole right through it,' : ''} is pushed straight up into a solid. How many surfaces does the solid have?`, figures: [{ type: 'outline', cells, holes: holeCells }], explanation: `One surface for every side of the outline (${outer}${withHole ? `, plus ${inner} for the hole` : ''}) and two flat ends: ${value}.` };
    if (level <= 2) return { ...base, answerMode: 'single', ...numberOptions(rng, value, wrong) };
    return { ...base, answerMode: 'numeric', unit: '', answer: { value }, mistakes: wrong.filter(m => m.value !== value), hints: ['Count the corners of the outline: a rectilinear shape has as many sides as corners.', 'Add two for the ends, and the walls of any hole.'], solution: [{ text: `Outline: ${outer} sides.` }, ...(withHole ? [{ text: 'Hole: 4 walls.' }] : []), { text: 'Ends: 2.' }, { text: `Total ${value}.` }] };
  });
}
export function extrusionSetQuestion(seed) {
  return retry(seed, rng => {
    const names = shuffle(rng, Object.keys(OUTLINES)).slice(0, 6), totals = names.map(n => outlineSides(OUTLINES[n]) + 2);
    const n = pick(rng, [5, 6, 7, 8, 9, 10]), value = totals.filter(t => t > n).length;
    if (value < 1 || value > 5) return null;
    return {
      kind: 'extrusion-set', seed, answerMode: 'numeric', unit: '', names,
      prompt: `Each of these six shapes is pushed straight up into a solid. How many of the solids have more than ${n} surfaces?`,
      figures: names.map(name => ({ type: 'outline', cells: OUTLINES[name], label: name })),
      answer: { value }, mistakes: [{ value: totals.filter(t => t >= n).length, reason: `“More than ${n}” leaves out solids with exactly ${n}.` }, { value: names.filter(nm => outlineSides(OUTLINES[nm]) > n).length, reason: 'Each solid also has its two ends.' }].filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i),
      explanation: `Surfaces = sides + 2. In order: ${totals.join(', ')}. ${value} of them are above ${n}.`,
      hints: ['Count corners to count sides quickly.', 'Then add 2 for each solid.'],
      solution: names.map((nm, i) => ({ text: `Shape ${i + 1}: ${outlineSides(OUTLINES[nm])} sides, ${totals[i]} surfaces.` })).concat([{ text: `More than ${n}: ${value}.` }]),
    };
  });
}

// ---------- stacks of cubes ----------
const stackToCubes = heights => heights.flatMap((row, x) => row.flatMap((h, y) => Array.from({ length: h }, (_, z) => [x, y, z])));
function randomStack(rng, nx, ny, maxH, fill) {
  const heights = Array.from({ length: nx }, () => Array.from({ length: ny }, () => (rng() < fill ? 1 + Math.floor(rng() * maxH) : 0)));
  const foot = heights.flatMap((r, x) => r.flatMap((h, y) => (h ? [[x, y]] : [])));
  if (!connected2(foot) || !stackReadable(heights)) return null;
  return heights;
}
export function stackSurfacesQuestion(seed, level = 2) {
  return retry(seed, rng => {
    const heights = level <= 2 ? randomStack(rng, 2, 2, 2, 0.7) : randomStack(rng, 3, 3, 3, 0.75);
    if (!heights) return null;
    const cubes = stackToCubes(heights), n = cubes.length;
    if (level <= 2 ? n < 3 || n > 4 : n < 6 || n > 12) return null;
    const value = surfaceCount(cubes), unit = unitFaces(cubes);
    if (value === unit) return null;
    const visible = surfacesByDirection(cubes).filter(d => ['facing front', 'facing right', 'facing up'].includes(d.name)).reduce((s, d) => s + d.count, 0);
    const wrong = [{ value: unit, reason: 'That counts every square face of every cube. Squares side by side in one flat plane make one surface.' }, { value: visible, reason: 'That counts only the surfaces you can see. Count the hidden back, left and bottom ones too.' }];
    const base = { kind: 'polycube-surfaces', seed, cubes, prompt: 'Cubes are glued into this solid. Every cube stands on the floor or on another cube, and every column can be seen. How many flat surfaces does the solid have, counting the hidden ones underneath and behind?', figures: [{ type: 'voxels', cubes: toList(cubes), large: true }], explanation: 'Count direction by direction: up, down, front, back, left, right. In each direction, squares that lie in one plane and touch along an edge are one surface.' };
    if (level <= 2) return { ...base, answerMode: 'single', ...numberOptions(rng, value, wrong) };
    return { ...base, answerMode: 'numeric', unit: '', answer: { value }, mistakes: wrong.filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i), hints: ['Take one direction at a time.', 'In each direction, count the separate flat patches, not the squares.'], solution: [...directionLines(cubes), { text: `Total: ${value}.` }] };
  });
}

// A rectangular block with notches cut from the edges you can see.
export function notchQuestion(seed) {
  return retry(seed, rng => {
    const [a, b, c] = [pick(rng, [3, 4]), pick(rng, [3, 4]), pick(rng, [2, 3])];
    let cells = [];
    for (let x = 0; x < a; x++) for (let y = 0; y < b; y++) for (let z = 0; z < c; z++) cells.push([x, y, z]);
    const cuts = [];
    for (let k = 0; k < 1 + Math.floor(rng() * 2); k++) {
      const kind = pick(rng, ['top-slot-x', 'top-slot-y', 'front-edge', 'right-edge', 'corner']);
      const w = 1, d = 1 + Math.floor(rng() * 2);
      let cut;
      if (kind === 'top-slot-x') { const y0 = 1 + Math.floor(rng() * (b - 2)); cut = p => p[1] >= y0 && p[1] < y0 + w && p[2] >= c - d; }
      else if (kind === 'top-slot-y') { const x0 = 1 + Math.floor(rng() * (a - 2)); cut = p => p[0] >= x0 && p[0] < x0 + w && p[2] >= c - d; }
      else if (kind === 'front-edge') cut = p => p[0] === a - 1 && p[2] >= c - d;
      else if (kind === 'right-edge') cut = p => p[1] === b - 1 && p[2] >= c - d;
      else cut = p => p[0] >= a - d && p[1] >= b - d && p[2] >= c - 1;
      cuts.push(kind); cells = cells.filter(p => !cut(p));
    }
    const heights = Array.from({ length: a }, (_, x) => Array.from({ length: b }, (_, y) => cells.filter(p => p[0] === x && p[1] === y).length));
    if (!stackReadable(heights) || cells.length === a * b * c) return null;
    const value = surfaceCount(cells);
    if (value === 6) return null;
    return {
      kind: 'notch-surfaces', seed, answerMode: 'numeric', unit: '', cubes: cells,
      prompt: `Notches are cut from a rectangular block ${a} × ${b} × ${c} as shown. Nothing is cut from the sides you cannot see. How many surfaces does the solid have?`,
      figures: [{ type: 'voxels', cubes: toList(cells), large: true }],
      answer: { value }, mistakes: [{ value: 6, reason: 'A notch adds its own walls and splits the faces it cuts into.' }, { value: unitFaces(cells), reason: 'That counts unit squares. Count whole flat surfaces.' }, { value: 6 + 2 * cuts.length, reason: 'Count each notch’s walls and any face it splits in two.' }].filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i),
      explanation: 'A notch removes part of the faces it cuts through, may split a face in two, and adds its own floor and walls. Count direction by direction.',
      hints: ['Start from the six faces of the block.', 'For each notch: which faces does it split, and which new walls and floors does it add?'],
      solution: [...directionLines(cells), { text: `Total: ${value}.` }],
    };
  });
}

// ---------- exam hard ----------
export function tunnelCube(n, axes, width = 1, corners = false) {
  const lo = (n - width) / 2, hi = lo + width, inT = v => v >= lo && v < hi, out = [];
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) {
    const p = [x, y, z];
    if (axes.some(ax => [0, 1, 2].filter(i => i !== ax).every(i => inT(p[i])))) continue;
    if (corners && p.every(v => v === 0 || v === n - 1)) continue;
    out.push(p);
  }
  return out;
}
export function tunnelQuestion(seed) {
  return retry(seed, rng => {
    const n = pick(rng, [3, 5, 5]), width = n === 5 ? pick(rng, [1, 1, 3]) : 1, count = 1 + Math.floor(rng() * 3), corners = n === 3 && rng() < 0.4;
    const axes = shuffle(rng, [0, 1, 2]).slice(0, count), cubes = tunnelCube(n, axes, width, corners), value = surfaceCount(cubes);
    if (corners && count > 1) return null;
    const naive = 6 + 4 * count + (corners ? 24 : 0);
    return {
      kind: 'tunnel-surfaces', seed, answerMode: 'numeric', unit: '', cubes,
      prompt: `A ${n} × ${n} × ${n} cube has ${count === 1 ? 'a square tunnel' : `${count} square tunnels`} ${width} unit${width > 1 ? 's' : ''} wide cut straight through it, ${count === 1 ? 'from the centre of one face to the centre of the opposite face' : `each from the centre of one face to the centre of the opposite face, in ${count === 3 ? 'all three directions' : 'two different directions'}`}${corners ? ', and all eight corner cubes removed' : ''}. How many surfaces does it have?`,
      figures: [{ type: 'voxels', cubes: toList(cubes), large: true }],
      answer: { value }, mistakes: [{ value: naive, reason: count > 1 ? 'Where tunnels cross, their walls are broken into separate pieces.' : 'Check each removed corner: it leaves three small new faces and changes the faces around it.' }, { value: 6, reason: 'The tunnel walls inside are surfaces too.' }, { value: 6 + 4 * count, reason: 'Crossing tunnels break each other’s walls into separate surfaces.' }].filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i),
      explanation: `The outside still has 6 faces, each with a hole. ${count === 1 ? 'One tunnel adds 4 walls.' : 'Where tunnels cross at the centre, each tunnel wall is cut into pieces, one on each side of the crossing.'}${corners ? ' Each removed corner adds 3 small faces.' : ''}`,
      hints: ['Count the outside faces first: a hole does not split a face into more surfaces.', 'Then count the tunnel walls. Where two tunnels cross, a wall is broken.'],
      solution: [...directionLines(cubes), { text: `Total: ${value}.` }],
    };
  });
}

// A block split into prism pieces; painted outside, separated. Unpainted surfaces touched another piece.
export function piecesOf(a, b, c, rng) {
  const layers = c >= 2 && rng() < 0.5 ? [[0, 1], [1, c]] : [[0, c]], pieces = [];
  for (const [z0, z1] of layers) {
    const parts = layers.length > 1 ? 1 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 3);
    const owner = Array.from({ length: a }, () => Array(b).fill(-1)), seeds = shuffle(rng, Array.from({ length: a * b }, (_, i) => [Math.floor(i / b), i % b])).slice(0, Math.min(parts, a * b));
    seeds.forEach(([x, y], i) => { owner[x][y] = i; });
    let changed = true;
    while (changed) { changed = false; for (const [x, y] of shuffle(rng, Array.from({ length: a * b }, (_, i) => [Math.floor(i / b), i % b]))) { if (owner[x][y] >= 0) continue; const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => owner[x + dx]?.[y + dy]).filter(v => v >= 0); if (nb.length) { owner[x][y] = pick(rng, nb); changed = true; } } }
    for (let i = 0; i < seeds.length; i++) { const foot = []; for (let x = 0; x < a; x++) for (let y = 0; y < b; y++) if (owner[x][y] === i) foot.push([x, y]); const cubes = []; for (const [x, y] of foot) for (let z = z0; z < z1; z++) cubes.push([x, y, z]); pieces.push(cubes); }
  }
  return pieces;
}
export function unpaintedCount(pieces, box) {
  const outer = (p, axis, sign) => (sign > 0 ? p[axis] + 1 === box[axis] : p[axis] === 0);
  let total = 0;
  for (const piece of pieces) {
    const has = new Set(piece.map(key));
    for (const [axis, sign] of DIRS) {
      const groups = new Map();
      for (const c of piece) { const n = [...c]; n[axis] += sign; if (has.has(key(n))) continue; const plane = c[axis] + (sign > 0 ? 1 : 0); if (!groups.has(plane)) groups.set(plane, []); groups.get(plane).push(c); }
      for (const [, faces] of groups) {
        const cells = new Set(faces.map(c => key([0, 1, 2].filter(i => i !== axis).map(i => c[i])))), seen = new Set();
        for (const f of faces) {
          const k0 = key([0, 1, 2].filter(i => i !== axis).map(i => f[i]));
          if (seen.has(k0)) continue;
          const comp = [k0]; seen.add(k0); const st = [k0];
          while (st.length) { const [u, v] = st.pop().split(',').map(Number); for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key([u + du, v + dv]); if (cells.has(k) && !seen.has(k)) { seen.add(k); st.push(k); comp.push(k); } } }
          const painted = comp.some(k => { const [u, v] = k.split(',').map(Number), p = []; let j = 0; for (let i = 0; i < 3; i++) p[i] = i === axis ? f[axis] : [u, v][j++]; return outer(p, axis, sign); });
          if (!painted) total++;
        }
      }
    }
  }
  return total;
}
export function unpaintedQuestion(seed) {
  return retry(seed, rng => {
    const box = [pick(rng, [2, 3]), pick(rng, [2, 3]), pick(rng, [1, 2])], pieces = piecesOf(...box, rng);
    if (pieces.length < 2 || pieces.length > 4 || pieces.some(p => p.length < 2)) return null;
    const value = unpaintedCount(pieces, box);
    if (value < 2) return null;
    const total = pieces.reduce((s, p) => s + surfaceCount(p), 0);
    return {
      kind: 'unpainted-surfaces', seed, answerMode: 'numeric', unit: '', box, pieces,
      prompt: `A ${box.join(' × ')} block is made of the ${pieces.length} shaded pieces drawn beside it, each standing just as it sits in the block. The block is painted all over the outside, then taken apart. Counting every piece, how many surfaces have no paint at all?`,
      figures: [{ type: 'voxels', cubes: pieces.flatMap((p, i) => toList(p).map(c => ({ ...c, piece: i + 1 }))), box, large: true, label: `The ${box.join(' by ')} block, its ${pieces.length} pieces in different shades` }].concat(pieces.map((p, i) => { const z0 = Math.min(...p.map(c => c[2])); return { type: 'voxels', cubes: toList(p.map(([x, y, z]) => [x, y, z - z0])).map(c => ({ ...c, piece: i + 1 })), box: [box[0], box[1], Math.max(1, ...p.map(c => c[2] - z0 + 1))], label: `Piece ${i + 1} on its own, ${p.length} cubes` }; })),
      answer: { value }, mistakes: [{ value: total - value, reason: 'That counts the painted surfaces. Count the ones that were hidden inside.' }, { value: total, reason: 'That counts every surface of every piece.' }].filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i),
      explanation: 'A surface has no paint when it was pressed against another piece. Look at where each piece touches the others and count those flat faces, piece by piece.',
      hints: ['Paint only reaches the outside of the block.', 'For each piece, find the faces that touched a neighbour.'],
      solution: pieces.map((p, i) => { const k = unpaintedCount([p], box); return { text: `Piece ${i + 1}: ${k} surface${k === 1 ? '' : 's'} pressed against other pieces.` }; }).concat([{ text: `Total: ${value}.` }]),
    };
  });
}
// Operations: extrude (+2), punch a rectangular hole (+4), cut one vertical corner off (+1).
export function operationQuestion(seed) {
  return retry(seed, rng => {
    const names = shuffle(rng, Object.keys(OUTLINES).filter(n => n !== 'bar')).slice(0, 2), ops = pick(rng, [['hole'], ['corner'], ['hole', 'corner'], ['corner', 'corner'], ['hole', 'hole']]);
    const add = ops.reduce((s, o) => s + (o === 'hole' ? 4 : 1), 0);
    const [sx, sy] = names.map(n => outlineSides(OUTLINES[n])), x = sx + 2 + add, value = sy + 2 + add;
    if (sx === sy) return null;
    const words = ops.map(o => (o === 'hole' ? 'a square hole punched straight down through it' : 'one upright outside corner sliced off flat')).join(', and ');
    return {
      kind: 'operation-transfer', seed, answerMode: 'numeric', unit: '',
      prompt: `Shape X is pushed up into a solid, which then has ${words}. The result has ${x} surfaces. The same is done to shape Y. How many surfaces does Y's result have?`,
      figures: [{ type: 'outline', cells: OUTLINES[names[0]], label: 'X' }, { type: 'outline', cells: OUTLINES[names[1]], label: 'Y' }],
      answer: { value }, mistakes: [{ value: x, reason: 'Y has a different number of sides from X, so its count changes too.' }, { value: sy + 2, reason: `The same operations add ${add} surfaces to Y as well.` }, { value: x + (sy - sx) - 2, reason: 'Both solids have two ends; they cancel out.' }].filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i),
      explanation: `X has ${sx} sides, so pushing it up gives ${sx + 2}; the operations add ${add}, making ${x}. Y has ${sy} sides: ${sy} + 2 + ${add} = ${value}.`,
      hints: ['Work out what the operations add, using X.', 'Then apply the same to Y.'],
      solution: [{ text: `X: ${sx} sides + 2 ends = ${sx + 2}.` }, { text: `The operations add ${x} − ${sx + 2} = ${add}.` }, { text: `Y: ${sy} + 2 + ${add} = ${value}.` }],
    };
  });
}

export function surfacesQuestion(seed, kind, level) {
  switch (kind) {
    case 'basic-surfaces': return basicQuestion(seed);
    case 'edges-corners': return edgesCornersQuestion(seed);
    case 'extrusion-surfaces': return extrusionQuestion(seed, level);
    case 'extrusion-set': return extrusionSetQuestion(seed);
    case 'polycube-surfaces': return stackSurfacesQuestion(seed, level);
    case 'notch-surfaces': return notchQuestion(seed);
    case 'tunnel-surfaces': return tunnelQuestion(seed);
    case 'unpainted-surfaces': return unpaintedQuestion(seed);
    case 'operation-transfer': return operationQuestion(seed);
    default: throw new Error('Unknown surfaces kind ' + kind);
  }
}
export const SURFACE_KINDS = Object.freeze({ 'basic-surfaces': [1], 'edges-corners': [2], 'extrusion-surfaces': [2, 3], 'polycube-surfaces': [2, 3], 'extrusion-set': [3], 'notch-surfaces': [3], 'tunnel-surfaces': [4], 'unpainted-surfaces': [4], 'operation-transfer': [4] });
