// Counting cubes. A stack is a height map on a floor: heights[x][y].
//
// Conventions (shared with cube-net.js): the viewer stands at (+x, +y, +z).
// In the isometric drawing +x runs to the lower left and +y to the lower
// right, so the +x side of a stack is its FRONT (the left visible side) and
// the +y side is its RIGHT SIDE. In the plan grid x runs down the page and y
// runs right. Views: front[y] is seen from +x, side[x] from +y, top[x][y]
// from above.
import { pick, seededRandom, shuffle } from './random.js';

export const total = heights => heights.flat().reduce((a, b) => a + b, 0);
export const height = (heights, x, y) => (heights[x]?.[y] ?? 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function cubeList(heights) {
  const list = [];
  for (let x = 0; x < heights.length; x++) for (let y = 0; y < heights[x].length; y++) for (let z = 0; z < heights[x][y]; z++) list.push({ x, y, z });
  return list;
}
// Back-to-front order for drawing.
export const drawOrder = list => [...list].sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z) || a.z - b.z);
export const cubes = heights => drawOrder(cubeList(heights));
const keyOf = (x, y, z) => `${x},${y},${z}`;
export function occupancy(list) {
  const set = new Set(list.map(c => keyOf(c.x, c.y, c.z)));
  return (x, y, z) => set.has(keyOf(x, y, z));
}

// ---------- what the viewer can see ----------
// True when the centre of one face of cube (x, y, z) is in plain view. The
// sight line runs from the face centre toward (+1, +1, +1).
export function faceVisible(has, x, y, z, face) {
  const reach = 12;
  if (face === 'top') {
    if (has(x, y, z + 1)) return false;
    for (let k = 1; k < reach; k++) if (has(x + k, y + k, z + k) || has(x + k, y + k, z + k + 1)) return false;
    return true;
  }
  const [ax, ay] = face === 'front' ? [1, 0] : [0, 1];
  for (let j = 0; j < reach; j++) if (has(x + ax + j, y + ay + j, z + j) || has(x + 1 + j, y + 1 + j, z + 1 + j)) return false;
  return true;
}
export const cubeVisible = (has, x, y, z) => ['top', 'front', 'side'].some(face => faceVisible(has, x, y, z, face));
// True when an empty cell can be looked into: nothing sits on the sight line from its centre.
export function cellSeen(has, x, y, z) {
  for (let k = 1; k < 12; k++) if (has(x + k, y + k, z + k)) return false;
  return true;
}
// A stack is readable when the top of every column, and every bare floor square, is in plain view,
// so the drawing alone fixes every height.
export function stackReadable(heights) {
  const has = occupancy(cubeList(heights));
  for (let x = 0; x < heights.length; x++) for (let y = 0; y < heights[x].length; y++) if (!faceVisible(has, x, y, heights[x][y] - 1, 'top')) return false;
  return true;
}

// ---------- measures ----------
// A cube is hidden when the cube above it and both front neighbours are present.
export function hiddenCount(heights) {
  let hidden = 0;
  for (let x = 0; x < heights.length; x++) for (let y = 0; y < heights[x].length; y++) for (let z = 0; z < heights[x][y]; z++) {
    if (heights[x][y] > z + 1 && height(heights, x + 1, y) > z && height(heights, x, y + 1) > z) hidden++;
  }
  return hidden;
}
export function hiddenByLayer(heights) {
  const layers = [];
  for (let x = 0; x < heights.length; x++) for (let y = 0; y < heights[x].length; y++) for (let z = 0; z < heights[x][y]; z++) {
    if (heights[x][y] > z + 1 && height(heights, x + 1, y) > z && height(heights, x, y + 1) > z) layers[z] = (layers[z] ?? 0) + 1;
  }
  return Array.from(layers, n => n ?? 0);
}
export function boxGap(heights) {
  const max = Math.max(...heights.flat());
  return heights.length * heights[0].length * max - total(heights);
}
export function layerSizes(heights) {
  const max = Math.max(0, ...heights.flat());
  return Array.from({ length: max }, (_, z) => heights.flat().filter(h => h > z).length);
}
export function viewsOf(heights) {
  const nx = heights.length, ny = heights[0].length;
  return {
    top: heights.map(row => row.map(h => h > 0)),
    front: Array.from({ length: ny }, (_, y) => Math.max(...heights.map(row => row[y]))),
    side: Array.from({ length: nx }, (_, x) => Math.max(...heights[x])),
  };
}
function maxMatching(columns, rows, allowed) {
  const matchOfRow = new Map();
  const attempt = (column, seen) => {
    for (const row of rows) {
      if (!allowed(row, column) || seen.has(row)) continue;
      seen.add(row);
      if (!matchOfRow.has(row) || attempt(matchOfRow.get(row), seen)) { matchOfRow.set(row, column); return true; }
    }
    return false;
  };
  return columns.filter(column => attempt(column, new Set())).length;
}
// The fewest and the most cubes that fit three views. `shared` lists, per height, how many towers
// can serve a front column and a side column at once.
export function minMaxFromViews(top, front, side) {
  let floor = 0, max = 0;
  for (let x = 0; x < top.length; x++) for (let y = 0; y < top[x].length; y++) if (top[x][y]) { floor++; max += Math.min(front[y], side[x]); }
  let min = floor;
  const shared = [];
  const tallest = Math.max(0, ...front, ...side);
  for (let h = 2; h <= tallest; h++) {
    const columns = front.map((v, y) => (v === h ? y : -1)).filter(y => y >= 0);
    const rows = side.map((v, x) => (v === h ? x : -1)).filter(x => x >= 0);
    if (!columns.length && !rows.length) continue;
    const matched = maxMatching(columns, rows, (x, y) => top[x][y]);
    const towers = columns.length + rows.length - matched;
    min += (h - 1) * towers;
    shared.push({ height: h, front: columns.length, side: rows.length, matched, towers });
  }
  return { min, max, floor, shared };
}
// Painted faces of each cube when a set of cubes is painted where it can be reached.
export function exposure(list, { floorPainted = true } = {}) {
  const has = occupancy(list);
  return list.map(({ x, y, z }) => {
    const neighbours = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].filter(([dx, dy, dz]) => has(x + dx, y + dy, z + dz)).length;
    return 6 - neighbours - (z === 0 && !floorPainted ? 1 : 0);
  });
}
export function paintedCounts(a, b, c) {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (let x = 0; x < a; x++) for (let y = 0; y < b; y++) for (let z = 0; z < c; z++) {
    counts[[x === 0, x === a - 1, y === 0, y === b - 1, z === 0, z === c - 1].filter(Boolean).length]++;
  }
  return counts;
}
export function faceNeighbours(has, { x, y, z }) {
  return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].filter(([dx, dy, dz]) => has(x + dx, y + dy, z + dz)).length;
}

// ---------- stacks ----------
export function randomStack(rng, size = 3, maxHeight = 3, minCubes = 5) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const heights = Array.from({ length: size }, () => Array.from({ length: size }, () => Math.floor(rng() * (maxHeight + 1))));
    if (total(heights) >= minCubes) return heights;
  }
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 1));
}
// A stack that slopes down toward the viewer so that every height can be read from the drawing.
export function readableStack(rng, size, maxHeight, minTotal, maxTotal, accept = () => true) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const heights = Array.from({ length: size }, (_, x) => Array.from({ length: size }, (_, y) => {
      const slope = maxHeight * (1 - (x + y) / (2 * (size - 1)));
      return Math.max(0, Math.min(maxHeight, Math.round(slope + (rng() * 2 - 1) * 1.5)));
    }));
    const n = total(heights);
    if (n >= minTotal && n <= maxTotal && stackReadable(heights) && accept(heights)) return heights;
  }
  return Array.from({ length: size }, (_, x) => Array.from({ length: size }, (_, y) => Math.max(0, maxHeight - x - y)));
}

function numberOptions(rng, correct, spread) {
  const nearby = [];
  for (let d = -spread; d <= spread; d++) if (d !== 0 && correct + d >= 0) nearby.push(correct + d);
  const values = [correct, ...shuffle(rng, nearby).slice(0, 3)];
  return shuffle(rng, values).map(n => ({ id: String(n), label: String(n), text: String(n) }));
}
const mistakes = (answer, list) => list.filter(m => Number.isFinite(m.value) && m.value >= 0 && m.value !== answer)
  .filter((m, i, all) => all.findIndex(o => o.value === m.value) === i);

// ---------- questions ----------
export function countQuestion(seed, kind, level) {
  const rng = seededRandom(seed);
  switch (kind) {
    case 'count-cubes': return level >= 3 ? countCubesHard(rng, seed) : countCubesEasy(rng, seed);
    case 'count-hidden': return level >= 3 ? countHiddenHard(rng, seed) : countHiddenEasy(rng, seed);
    case 'count-box': return countBox(rng, seed);
    case 'painted-count': return paintedCount(rng, seed);
    case 'touch-count': return touchCount(rng, seed);
    case 'views-max': return viewsQuestion(rng, seed, 'max');
    case 'views-min': return viewsQuestion(rng, seed, 'min');
    case 'painted-stack': return paintedStack(rng, seed);
    case 'removed-visible': return removedVisible(rng, seed);
    default: throw new Error(`Unknown counting kind: ${kind}`);
  }
}

function countCubesEasy(rng, seed) {
  const heights = randomStack(rng);
  const n = total(heights), columns = heights.flat().filter(Boolean).length;
  return {
    kind: 'count-cubes', seed, heights, prompt: 'How many cubes make up this stack? Every column stands on the floor with no gaps.',
    options: numberOptions(rng, n, 3), answer: String(n),
    explanation: `Count column by column: ${heights.flat().filter(Boolean).join(' + ')} = ${n} cubes in ${plural(columns, 'column')}.`,
  };
}
function countHiddenEasy(rng, seed) {
  const heights = randomStack(rng);
  const hidden = hiddenCount(heights);
  return {
    kind: 'count-hidden', seed, heights, prompt: 'How many cubes in this stack have all three facing sides covered, so you cannot see them at all?',
    options: numberOptions(rng, hidden, 3), answer: String(hidden),
    explanation: `A cube is hidden only when the cube above it, the cube to its front-left and the cube to its front-right are all present. ${hidden === 0 ? 'No cube here has all three.' : `${hidden} cube${hidden === 1 ? ' does' : 's do'}.`}`,
  };
}
function countBox(rng, seed) {
  const heights = randomStack(rng);
  const n = total(heights), gap = boxGap(heights), tall = Math.max(...heights.flat()), floor = heights.length * heights[0].length;
  return {
    kind: 'count-box', seed, heights, prompt: 'How many more cubes are needed to fill this stack up into a solid block as tall as its tallest column?',
    options: numberOptions(rng, gap, 4), answer: String(gap),
    explanation: `The tallest column has ${tall} cubes, so a full block needs ${floor} × ${tall} = ${floor * tall} cubes. The stack has ${n}, so ${gap} more.`,
  };
}

function layerSteps(heights) {
  const sizes = layerSizes(heights);
  const steps = [];
  for (let z = sizes.length - 1; z >= 0; z--) steps.push({ text: `Layer ${z + 1}${z === sizes.length - 1 ? ' (the top)' : z === 0 ? ' (on the floor)' : ''} has ${plural(sizes[z], 'cube')}. Every cube above it stands on a cube here.` });
  steps.push({ text: `${[...sizes].reverse().join(' + ')} = ${total(heights)} cubes.` });
  return steps;
}
function countCubesHard(rng, seed) {
  const heights = readableStack(rng, 4, 4, 14, 40);
  const n = total(heights), hidden = hiddenCount(heights), columns = heights.flat().filter(Boolean).length;
  return {
    kind: 'count-cubes', seed, answerMode: 'numeric', heights, unit: 'cubes',
    prompt: 'How many cubes make up this stack? Every column stands on the floor with no gaps.',
    answer: { value: n },
    mistakes: mistakes(n, [
      { value: n - hidden, reason: 'That counts only the cubes you can see. Cubes underneath and behind still count.' },
      { value: columns, reason: 'That is the number of columns. Each column has as many cubes as its height.' },
    ]),
    explanation: `Layer by layer from the top: ${[...layerSizes(heights)].reverse().join(' + ')} = ${n} cubes.`,
    hints: ['Count one layer at a time, from the top down.', `The top layer has ${plural(layerSizes(heights).at(-1), 'cube')}. The layer below it is at least as big.`],
    solution: layerSteps(heights),
  };
}
function countHiddenHard(rng, seed) {
  const heights = readableStack(rng, 4, 4, 18, 44, h => hiddenCount(h) >= 2);
  const hidden = hiddenCount(heights), n = total(heights), columns = heights.flat().filter(Boolean).length;
  const layers = hiddenByLayer(heights);
  return {
    kind: 'count-hidden', seed, answerMode: 'numeric', heights, unit: 'cubes',
    prompt: 'How many cubes in this stack cannot be seen at all, because the cube above and both front neighbours cover them?',
    answer: { value: hidden },
    mistakes: mistakes(hidden, [
      { value: n - columns, reason: 'That counts every cube with a cube on top of it. A cube is hidden only when both of its front sides are covered as well.' },
    ]),
    explanation: `Only cubes below the top of their column can be hidden, and both columns in front must reach at least as high. That leaves ${plural(hidden, 'hidden cube')}.`,
    hints: ['Only a cube with another cube on top can be hidden.', 'For each such cube, look at the column to its front-left and the column to its front-right. Both must be at least as high as that cube.'],
    solution: [
      { text: 'A cube is hidden when three things cover it: the cube above, the front-left neighbour and the front-right neighbour.' },
      ...layers.map((count, z) => ({ text: `Layer ${z + 1}: ${plural(count, 'cube')} hidden.` })),
      { text: `${layers.join(' + ')} = ${hidden} hidden cubes.` },
    ],
  };
}

function paintedCount(rng, seed) {
  let a, b, c, k, answer;
  for (let attempt = 0; attempt < 50; attempt++) {
    [a, b, c] = [0, 0, 0].map(() => 2 + Math.floor(rng() * 4));
    const roll = rng();
    k = roll < 0.3 ? 0 : roll < 0.6 ? 1 : roll < 0.9 ? 2 : 3;
    answer = paintedCounts(a, b, c)[k];
    if (a * b * c >= 12 && (k === 3 || answer !== 8) && !(k === 0 && answer === 0 && attempt < 40)) break;
  }
  const inner = (a - 2) * (b - 2) * (c - 2);
  const edges = 4 * (a - 2) + 4 * (b - 2) + 4 * (c - 2);
  const faces = 2 * ((a - 2) * (b - 2) + (a - 2) * (c - 2) + (b - 2) * (c - 2));
  const heights = Array.from({ length: a }, () => Array.from({ length: b }, () => c));
  const what = k === 0 ? 'no paint at all' : `exactly ${k} painted face${k === 1 ? '' : 's'}`;
  return {
    kind: 'painted-count', seed, answerMode: 'numeric', heights, unit: 'cubes', block: [a, b, c], faces: k,
    prompt: `A block of ${a} × ${b} × ${c} small cubes is painted on all six faces, then taken apart. How many small cubes have ${what}?`,
    answer: { value: answer },
    mistakes: mistakes(answer, [
      k === 2 && { value: edges + 8, reason: 'That includes the eight corner cubes. Corners have three painted faces, not two.' },
      k === 1 && { value: Math.max((a - 2) * (b - 2), (a - 2) * (c - 2), (b - 2) * (c - 2)) * 2, reason: 'That counts only one pair of opposite faces. The block has three pairs.' },
      k === 0 && { value: (a - 1) * (b - 1) * (c - 1), reason: 'The inside loses one layer on both sides of each direction, so take 2 off each side length, not 1.' },
      k === 3 && { value: 4, reason: 'That counts the corners of one face. A block has eight corners.' },
    ].filter(Boolean)),
    explanation: `Corners have three painted faces (8). Cubes along the edges between corners have two (${edges}). Cubes inside a face have one (${faces}). Cubes fully inside have none (${inner}).`,
    hints: ['Sort the small cubes into corners, edges, faces and inside.', `Take 2 off each side length to step inside the paint: ${a - 2}, ${b - 2} and ${c - 2}.`],
    solution: [
      { text: 'Corners: 8 cubes, each with 3 painted faces.' },
      { text: `Edges without their corners: 4 × ${a - 2} + 4 × ${b - 2} + 4 × ${c - 2} = ${edges} cubes with 2 painted faces.` },
      { text: `Middles of the faces: 2 × (${a - 2} × ${b - 2} + ${a - 2} × ${c - 2} + ${b - 2} × ${c - 2}) = ${faces} cubes with 1 painted face.` },
      { text: `Inside: ${a - 2} × ${b - 2} × ${c - 2} = ${inner} cubes with no paint.` },
      { text: `So ${plural(answer, 'cube')} ${answer === 1 ? 'has' : 'have'} ${what}. Check: 8 + ${edges} + ${faces} + ${inner} = ${a * b * c}.` },
    ],
  };
}

function touchCount(rng, seed) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const heights = readableStack(rng, 3, 3, 9, 20);
    const list = cubeList(heights), has = occupancy(list);
    const candidates = list.filter(c => cubeVisible(has, c.x, c.y, c.z) && faceNeighbours(has, c) >= 1);
    if (!candidates.length) continue;
    const marked = pick(rng, candidates);
    const n = faceNeighbours(has, marked);
    const diagonal = [[1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 0, -1], [-1, 0, -1], [0, 1, -1], [0, -1, -1]]
      .filter(([dx, dy, dz]) => has(marked.x + dx, marked.y + dy, marked.z + dz)).length;
    const below = has(marked.x, marked.y, marked.z - 1), above = has(marked.x, marked.y, marked.z + 1);
    const sides = n - (below ? 1 : 0) - (above ? 1 : 0);
    return {
      kind: 'touch-count', seed, answerMode: 'numeric', heights, marked, unit: 'cubes',
      figures: [{ type: 'stack', heights, marked, large: true }],
      prompt: 'How many cubes share a whole face with the orange cube? Touching along an edge or at a corner does not count.',
      answer: { value: n },
      mistakes: mistakes(n, [
        { value: n + diagonal, reason: 'That includes cubes that touch only along an edge. Count whole faces only.' },
        { value: sides, reason: 'Look above and below as well as to the sides.' },
      ]),
      explanation: `Check its six sides: ${above ? 'one cube above' : 'nothing above'}, ${below ? 'one below' : 'the floor below'}, and ${plural(sides, 'cube')} beside it. That makes ${n}.`,
      hints: ['A cube has six faces: above, below and four sides.', 'A neighbouring column touches the orange cube only if it is at least as tall as the orange cube’s level.'],
      solution: [
        { text: `Above: ${above ? '1 cube' : 'nothing'}. Below: ${below ? '1 cube' : 'the floor, which is not a cube'}.` },
        { text: `The four columns next to it: ${plural(sides, 'column')} reach${sides === 1 ? 'es' : ''} the orange cube’s level.` },
        { text: `${(above ? 1 : 0) + (below ? 1 : 0)} + ${sides} = ${n} cubes share a face with it.` },
      ],
    };
  }
  throw new Error('touch-count: no stack found');
}

function viewsQuestion(rng, seed, which) {
  let views = null, result = null;
  for (let attempt = 0; attempt < 300 && !result; attempt++) {
    const size = rng() < 0.7 ? 3 : 4;
    const heights = Array.from({ length: size }, () => Array.from({ length: size }, () => (rng() < 0.25 ? 0 : 1 + Math.floor(rng() * 3))));
    if (heights.flat().filter(Boolean).length < 6) continue;
    const candidate = viewsOf(heights);
    if (candidate.front.includes(0) || candidate.side.includes(0)) continue;
    const measured = minMaxFromViews(candidate.top, candidate.front, candidate.side);
    if (measured.max - measured.min >= 2 && measured.shared.length) { views = candidate; result = measured; }
  }
  if (!result) {
    views = viewsOf([[2, 1, 0], [1, 3, 1], [0, 1, 2]]);
    result = minMaxFromViews(views.top, views.front, views.side);
  }
  const { min, max, floor, shared } = result;
  const answer = which === 'max' ? max : min;
  const frontSum = views.front.reduce((a, b) => a + b, 0), sideSum = views.side.reduce((a, b) => a + b, 0);
  const noSharing = floor + views.front.reduce((a, v) => a + v - 1, 0) + views.side.reduce((a, v) => a + v - 1, 0);
  const rows = views.top.map((row, x) => row.map((on, y) => (on ? Math.min(views.front[y], views.side[x]) : 0)));
  return {
    kind: which === 'max' ? 'views-max' : 'views-min', seed, answerMode: 'numeric', unit: 'cubes', views,
    figures: [{ type: 'views', ...views }],
    prompt: `These are the top, front and right-side views of a stack of cubes. What is the ${which === 'max' ? 'greatest' : 'smallest'} number of cubes the stack can have?`,
    answer: { value: answer },
    mistakes: mistakes(answer, which === 'max' ? [
      { value: floor, reason: 'That is one cube on every floor square. The views allow most squares to rise higher.' },
      { value: Math.max(frontSum, sideSum), reason: 'That adds up one view only. Every floor square can rise, not just one per column.' },
      { value: min, reason: 'That is the smallest number that fits. The question asks for the greatest.' },
    ] : [
      { value: max, reason: 'That is the greatest number that fits. The question asks for the smallest.' },
      { value: floor, reason: 'One cube per floor square covers the top view, but the front and side views need taller towers.' },
      { value: noSharing, reason: 'That builds a separate tower for every front column and every side column. A tower where they cross can serve both.' },
    ]),
    explanation: which === 'max'
      ? `Each floor square can rise to the smaller of its front height and its side height. Adding those gives ${max}.`
      : `Every floor square needs one cube (${floor}). Then each front column and each side column needs one tower of its full height, and a tower can serve both where they cross. That gives ${min}.`,
    hints: which === 'max'
      ? ['The top view tells you which floor squares are used.', 'A square cannot be taller than its column in the front view, or its column in the side view.']
      : ['Start with one cube on every floor square of the top view.', 'A column of the front view and a column of the side view with the same height can share one tower.'],
    solution: which === 'max' ? [
      { text: `The top view shows ${plural(floor, 'floor square')}.` },
      { text: 'Each square can be as tall as the smaller of two numbers: its column in the front view and its column in the side view.' },
      ...rows.map((row, x) => ({ text: `Row ${x + 1} of the top view: ${row.filter(Boolean).join(' + ') || '0'} = ${row.reduce((a, b) => a + b, 0)}.` })),
      { text: `Total: ${max} cubes.` },
    ] : [
      { text: `The top view shows ${plural(floor, 'floor square')}, so at least ${floor} cubes: one on each.` },
      ...shared.map(s => ({ text: `Height ${s.height}: the front view needs ${plural(s.front, 'tower')} this tall and the side view ${s.side}. ${s.matched ? `${plural(s.matched, 'tower')} can serve both` : 'None can be shared'}, so ${plural(s.towers, 'tower')}, each adding ${s.height - 1} cube${s.height - 1 === 1 ? '' : 's'}: ${(s.height - 1) * s.towers} more.` })),
      { text: `${floor} + ${shared.map(s => (s.height - 1) * s.towers).join(' + ')} = ${min} cubes.` },
    ],
  };
}

function paintedStack(rng, seed) {
  const heights = readableStack(rng, 3, 3, 8, 16);
  const list = cubeList(heights), n = list.length, has = occupancy(list);
  const floorPainted = rng() < 0.5;
  const painted = exposure(list, { floorPainted });
  const contacts = list.reduce((sum, c) => sum + faceNeighbours(has, c), 0) / 2;
  const onFloor = list.filter(c => c.z === 0).length;
  const unpainted = 6 * n - painted.reduce((a, b) => a + b, 0);
  const how = floorPainted ? 'on every face that can be reached, including underneath' : 'while it stands on a table, so the faces resting on the table get no paint';
  return {
    kind: 'painted-stack', seed, answerMode: 'numeric', heights, unit: 'faces', floorPainted,
    prompt: `This stack of ${n} cubes is painted ${how}. The cubes are then pulled apart. How many cube faces have no paint?`,
    answer: { value: unpainted },
    mistakes: mistakes(unpainted, [
      { value: floorPainted ? unpainted + onFloor : unpainted - onFloor, reason: floorPainted ? 'The underneath was painted too, so the faces on the floor do have paint.' : 'The faces resting on the table got no paint. Add them.' },
      { value: contacts + (floorPainted ? 0 : onFloor), reason: 'Where two cubes touch, both of their faces stay unpainted. Count each touching pair twice.' },
    ]),
    explanation: `Paint cannot reach faces that touch another cube. There are ${contacts} touching pairs, so ${2 * contacts} faces${floorPainted ? '' : `, plus ${onFloor} resting on the table`}: ${unpainted} in all.`,
    hints: ['A face stays unpainted only where something covers it.', 'Count the places where two cubes touch. Each one hides two faces.'],
    solution: [
      { text: `Cubes stacked on each other: ${list.filter(c => c.z > 0).length} touching pairs.` },
      { text: `Cubes side by side: ${contacts - list.filter(c => c.z > 0).length} touching pairs.` },
      { text: `${contacts} pairs hide 2 faces each: ${2 * contacts} faces.` },
      { text: floorPainted ? 'The underneath was painted, so nothing else is hidden.' : `${onFloor} cubes rest on the table and each keeps one face unpainted: ${onFloor} more.` },
      { text: `${unpainted} faces have no paint.` },
    ],
  };
}

function removedVisible(rng, seed) {
  const size = 3;
  const full = [];
  for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let z = 0; z < size; z++) full.push({ x, y, z });
  let remaining = null, removed = null;
  for (let attempt = 0; attempt < 300 && !remaining; attempt++) {
    let list = [...full];
    const gone = [];
    const target = 4 + Math.floor(rng() * 5);
    for (let i = 0; i < target; i++) {
      const has = occupancy(list);
      const candidates = list.filter(c => cubeVisible(has, c.x, c.y, c.z));
      const choice = pick(rng, candidates);
      gone.push(choice);
      list = list.filter(c => c !== choice);
    }
    const has = occupancy(list);
    if (gone.every(c => cellSeen(has, c.x, c.y, c.z))) { remaining = list; removed = gone; }
  }
  if (!remaining) {
    removed = [{ x: 2, y: 2, z: 2 }, { x: 2, y: 1, z: 2 }, { x: 1, y: 2, z: 2 }];
    remaining = full.filter(c => !removed.some(r => r.x === c.x && r.y === c.y && r.z === c.z));
  }
  const left = remaining.length, out = removed.length;
  const perLayer = Array.from({ length: size }, (_, z) => removed.filter(c => c.z === z).length);
  return {
    kind: 'removed-visible', seed, answerMode: 'numeric', unit: 'cubes', remaining, removed,
    figures: [{ type: 'voxels', cubes: remaining, box: size, large: true }],
    prompt: `A solid block of ${size} × ${size} × ${size} small cubes was glued together, then some cubes were taken out. Only cubes you could see were taken; nothing hidden was removed. How many small cubes are left?`,
    answer: { value: left },
    mistakes: mistakes(left, [
      { value: out, reason: 'That is how many were taken out. The question asks how many are left.' },
      { value: size ** 3, reason: 'That is the full block. Take away the missing cubes.' },
    ]),
    explanation: `The full block has ${size ** 3} cubes. ${plural(out, 'cube')} ${out === 1 ? 'is' : 'are'} missing, so ${left} are left.`,
    hints: [`The full block has ${size ** 3} cubes.`, 'Count the missing cubes one layer at a time, from the top.'],
    solution: [
      { text: `A full ${size} × ${size} × ${size} block has ${size ** 3} cubes.` },
      ...[...perLayer].reverse().map((count, i) => ({ text: `Layer ${size - i}${i === 0 ? ' (the top)' : ''}: ${plural(count, 'cube')} missing.` })),
      { text: `${size ** 3} − ${out} = ${left} cubes are left.` },
    ],
  };
}
