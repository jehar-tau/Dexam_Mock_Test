// Views and rotation: solids made of unit cubes, their front, top and side
// views, and the same solid turned or mirrored. Specification:
// docs/learn/topics/views-and-rotation.md.
//
// Conventions, identical to cube-net.js and cube-count.js: the viewer is at
// (+x, +y, +z) and z is up. A supported solid (every cube on the floor or on
// another cube) is a height map heights[x][y]. Front view: seen from +x, y
// to the right. Top view: x down the page, y to the right. Right side: seen
// from +y, x increasing to the LEFT.
import { rotations } from './cube-net.js';
import { pick, seededRandom, shuffle } from './random.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const turn = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
export const normalise = cubes => {
  const lo = [0, 1, 2].map(i => Math.min(...cubes.map(c => c[i])));
  return cubes.map(c => c.map((v, i) => v - lo[i])).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
};
const keyOf = cubes => normalise(cubes).map(c => c.join(',')).join(';');
export const rotate = (cubes, m) => normalise(cubes.map(c => turn(m, c)));
export const mirror = cubes => normalise(cubes.map(([x, y, z]) => [-x, y, z]));
export const canonical = cubes => rotations.map(m => keyOf(cubes.map(c => turn(m, c)))).sort()[0];
export const sameSolid = (a, b) => a.length === b.length && canonical(a) === canonical(b);
export const isChiral = cubes => !sameSolid(cubes, mirror(cubes));
export const symmetryCount = cubes => { const k = keyOf(cubes); return rotations.filter(m => keyOf(cubes.map(c => turn(m, c))) === k).length; };

// ---------- stacks and their views ----------
export const stackCubes = heights => heights.flatMap((row, x) => row.flatMap((h, y) => Array.from({ length: h }, (_, z) => [x, y, z])));
export function stackViews(heights) {
  const nx = heights.length, ny = heights[0].length;
  return { top: heights.map(row => row.map(h => h > 0)), front: Array.from({ length: ny }, (_, y) => Math.max(...heights.map(row => row[y]))), side: Array.from({ length: nx }, (_, x) => Math.max(...heights[x])) };
}
// A view as a grid of rows top to bottom, each a list of booleans left to right.
export function viewGrid(heights, which) {
  const v = stackViews(heights), nx = heights.length, ny = heights[0].length, nz = Math.max(1, ...v.front);
  if (which === 'top') return v.top.map(r => [...r]);
  if (which === 'front') return Array.from({ length: nz }, (_, r) => Array.from({ length: ny }, (_, y) => v.front[y] > nz - 1 - r));
  if (which === 'side') return Array.from({ length: nz }, (_, r) => Array.from({ length: nx }, (_, c) => v.side[nx - 1 - c] > nz - 1 - r));
  // left side, seen from −y: x increasing to the right
  return Array.from({ length: nz }, (_, r) => Array.from({ length: nx }, (_, x) => v.side[x] > nz - 1 - r));
}
export const gridKey = g => g.map(r => r.map(b => (b ? 1 : 0)).join('')).join('/');
const trimGrid = g => { const rows = g.filter(r => r.some(Boolean)); const cols = rows[0].map((_, c) => rows.some(r => r[c])); const first = cols.indexOf(true), last = cols.lastIndexOf(true); return rows.map(r => r.slice(first, last + 1)); };
export const sameView = (a, b) => gridKey(trimGrid(a)) === gridKey(trimGrid(b));
// The largest stack these views allow: each floor square as high as both its column and its row let it be.
export function maximalStack(top, front, side) { return top.map((row, x) => row.map((on, y) => (on ? Math.min(front[y], side[x]) : 0))); }
export function consistent(top, front, side) {
  const v = stackViews(maximalStack(top, front, side));
  return JSON.stringify(v.top) === JSON.stringify(top) && JSON.stringify(v.front) === JSON.stringify(front) && JSON.stringify(v.side) === JSON.stringify(side);
}
export function randomStack(rng, n = 3, maxH = 3, fill = [5, 8]) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const h = Array.from({ length: n }, () => Array(n).fill(0)), cells = shuffle(rng, Array.from({ length: n * n }, (_, i) => [Math.floor(i / n), i % n])).slice(0, fill[0] + Math.floor(rng() * (fill[1] - fill[0] + 1)));
    for (const [x, y] of cells) h[x][y] = 1 + Math.floor(rng() * maxH);
    const v = stackViews(h);
    // Every row and column of the floor used, so no view is just a strip.
    if (v.front.every(Boolean) && v.side.every(Boolean) && new Set(h.flat().filter(Boolean)).size >= 2) return h;
  }
  return [[3, 1, 0], [2, 1, 1], [1, 0, 2]];
}

// ---------- polycubes ----------
export function randomPolycube(rng, size = 6, box = 3) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const set = new Map([['1,1,0', [1, 1, 0]]]);
    while (set.size < size) {
      const [x, y, z] = pick(rng, [...set.values()]), [dx, dy, dz] = pick(rng, [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, 1]]);
      const c = [x + dx, y + dy, z + dz];
      if (c.some(v => v < 0 || v >= box)) continue;
      set.set(c.join(','), c);
    }
    const cubes = normalise([...set.values()]);
    if (isChiral(cubes) && symmetryCount(cubes) === 1) return cubes;
  }
  throw new Error('No asymmetric polycube');
}
// Faces seen from (+x, +y, +z): a face is seen if its outward neighbour is empty and nothing lies in front of it.
export function visibleFaces(cubes) {
  const has = new Set(cubes.map(c => c.join(','))), out = [];
  for (const c of cubes) for (const axis of [0, 1, 2]) {
    const n = [...c]; n[axis] += 1;
    if (has.has(n.join(','))) continue;
    const centre = c.map((v, i) => v + 0.5 + (i === axis ? 0.5 : 0));
    let hidden = false;
    for (let t = 0.25; t < 8 && !hidden; t += 0.25) { const p = centre.map(v => v + t); if (has.has(p.map(Math.floor).join(','))) hidden = true; }
    if (!hidden) out.push({ cube: c, axis });
  }
  return out;
}
// What the drawing shows: each visible face as its place on the page (u, v) and its tone.
export const drawingKey = cubes => visibleFaces(cubes).map(({ cube, axis }) => { const c = cube.map((v, i) => v + 0.5 + (i === axis ? 0.5 : 0)); return `${axis}:${(c[1] - c[0]).toFixed(2)},${((c[0] + c[1]) / 2 - c[2]).toFixed(2)}`; }).sort().join('|');
const fullyShown = cubes => { const seen = new Set(visibleFaces(cubes).map(f => f.cube.join(','))); return cubes.every(c => seen.has(c.join(','))); };
// A view of the solid from a random orientation, with every cube showing at least one face.
function showable(rng, cubes) {
  for (const m of shuffle(rng, rotations)) { const r = rotate(cubes, m); if (fullyShown(r)) return r; }
  return null;
}
// The same solid with one cube moved to another place on its surface, still connected.
function oneMoved(rng, cubes) {
  const has = set => new Set(set.map(c => c.join(',')));
  for (let attempt = 0; attempt < 60; attempt++) {
    const i = Math.floor(rng() * cubes.length), rest = cubes.filter((_, j) => j !== i), restKeys = has(rest);
    const spots = rest.flatMap(c => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(d => c.map((v, k) => v + d[k]))).filter(p => !restKeys.has(p.join(',')) && p.join(',') !== cubes[i].join(','));
    if (!spots.length) continue;
    const moved = normalise([...rest, pick(rng, spots)]);
    // still in one piece
    const keys = has(moved), seen = new Set([moved[0].join(',')]), stack = [moved[0]];
    while (stack.length) { const c = stack.pop(); for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const n = c.map((v, k) => v + d[k]).join(','); if (keys.has(n) && !seen.has(n)) { seen.add(n); stack.push(n.split(',').map(Number)); } } }
    if (seen.size === moved.length && !sameSolid(moved, cubes) && !sameSolid(moved, mirror(cubes))) return moved;
  }
  return null;
}

function retry(seed, build) {
  for (let i = 0; i < 300; i++) { const q = build(seededRandom(seed * 1559 + i * 7919)); if (q) return q; }
  throw new Error('No views question for seed ' + seed);
}
const VIEW_NAMES = { top: 'top view', front: 'front view', side: 'right-side view', left: 'left-side view' };
const toCubeList = cubes => cubes.map(([x, y, z]) => ({ x, y, z }));

// ---------- view-of-stack ----------
export function viewOfStackQuestion(seed, level) {
  return retry(seed, rng => {
    const heights = randomStack(rng, 3, level === 1 ? 2 : 3, level === 1 ? [4, 6] : [6, 9]), ask = pick(rng, ['top', 'front', 'side']);
    const truth = viewGrid(heights, ask), flipped = truth.map(r => [...r].reverse());
    const moved = heights.map(r => [...r]), [cx, cy] = [Math.floor(rng() * 3), Math.floor(rng() * 3)]; moved[cx][cy] = moved[cx][cy] ? 0 : 1;
    const candidates = [
      ...['top', 'front', 'side', 'left'].filter(w => w !== ask).map(w => ({ grid: viewGrid(heights, w), reason: `That is the ${VIEW_NAMES[w]}.` })),
      { grid: flipped, reason: 'That is the right view, mirrored. Check which side is nearer you.' },
      { grid: viewGrid(moved, ask), reason: 'One column is the wrong height or missing. Count the cubes in each row or column again.' },
    ];
    const seen = new Set([gridKey(truth)]), wrong = [];
    for (const c of shuffle(rng, candidates)) { const k = gridKey(c.grid); if (!seen.has(k) && wrong.length < 3) { seen.add(k); wrong.push(c); } }
    if (wrong.length < 3) return null;
    const options = shuffle(rng, [{ grid: truth, correct: true, reason: `This is the ${VIEW_NAMES[ask]}.` }, ...wrong.map(w => ({ ...w, correct: false }))]).map((o, i) => ({ id: 'ABCD'[i], label: 'ABCD'[i], correct: o.correct, reason: o.reason, figure: { type: 'view-grid', grid: o.grid } }));
    return {
      kind: 'view-of-stack', seed, answerMode: 'single', heights,
      prompt: `Which option is the ${VIEW_NAMES[ask]} of this stack of cubes? ${ask === 'front' ? 'The front is the face on the lower left.' : ask === 'side' ? 'The right side is the face on the lower right.' : 'Seen from above, with the front at the bottom of the page.'}`,
      figures: [{ type: 'stack', heights, large: true }],
      options, answer: options.find(o => o.correct).id,
      explanation: ask === 'top' ? 'From above you see every floor square that has a cube, whatever its height.' : `Each ${ask === 'front' ? 'column' : 'column of the side view'} is as tall as the tallest stack behind it.`,
      ...(level >= 2 ? { hints: ['Each view flattens one direction. Which direction does this one flatten?'], solution: [{ text: `The ${VIEW_NAMES[ask]} flattens the ${ask === 'top' ? 'heights' : ask === 'front' ? 'depth' : 'width'}.` }, { text: 'Read each column: the tallest stack behind it sets its height.' }, { text: `So the answer is ${options.find(o => o.correct).label}.` }] } : {}),
    };
  });
}

// ---------- solid-from-views ----------
export function solidFromViewsQuestion(seed) {
  return retry(seed, rng => {
    const heights = randomStack(rng, 3, 3, [6, 8]), v = stackViews(heights), vk = JSON.stringify(v);
    const variants = [];
    for (let guard = 0; guard < 80 && variants.length < 3; guard++) {
      const h = heights.map(r => [...r]), x = Math.floor(rng() * 3), y = Math.floor(rng() * 3), d = pick(rng, [-1, 1]);
      h[x][y] = Math.max(0, Math.min(3, h[x][y] + d));
      const hv = stackViews(h), changed = ['top', 'front', 'side'].filter(k => JSON.stringify(hv[k]) !== JSON.stringify(v[k]));
      if (changed.length !== 1 || variants.some(w => JSON.stringify(w.h) === JSON.stringify(h))) continue;
      variants.push({ h, changed: changed[0] });
    }
    if (variants.length < 3) return null;
    const options = shuffle(rng, [{ h: heights, correct: true }, ...variants.map(w => ({ ...w, correct: false }))]).map((o, i) => ({
      id: 'ABCD'[i], label: 'ABCD'[i], correct: o.correct, figure: { type: 'stack', heights: o.h },
      reason: o.correct ? 'All three views match this stack.' : `This stack's ${VIEW_NAMES[o.changed]} is different: one stack is a cube taller or shorter there.`,
    }));
    if (options.filter(o => JSON.stringify(stackViews(o.figure.heights)) === vk).length !== 1) return null;
    return {
      kind: 'solid-from-views', seed, answerMode: 'single', heights,
      prompt: 'These are the top, front and right-side views of a stack of cubes. Which stack is it?',
      figures: [{ type: 'views', ...v }],
      options, answer: options.find(o => o.correct).id,
      explanation: 'Start from the top view (which squares are used), then read the heights from the front and side. Each wrong stack differs in exactly one view.',
      hints: ['Check the top view first: it rules out stacks with the wrong floor squares.', 'Then compare the tallest stack in each column of the front view, and each row of the side view.'],
      solution: [{ text: 'Top view: which floor squares carry cubes.' }, { text: 'Front view: the tallest stack in each column, left to right.' }, { text: 'Right-side view: the tallest stack in each row, front row on the left.' }, { text: `Only ${options.find(o => o.correct).label} matches all three.` }],
    };
  });
}

// ---------- missing-view ----------
// Every side view possible for a stack with this top and front, found by trying every stack.
export function possibleSides(top, front, maxH = 3) {
  const cells = top.flatMap((row, x) => row.map((on, y) => (on ? [x, y] : null))).filter(Boolean), out = new Map();
  const h = top.map(r => r.map(() => 0));
  const go = i => {
    if (i === cells.length) { const v = stackViews(h); if (JSON.stringify(v.front) === JSON.stringify(front)) out.set(JSON.stringify(v.side), v.side); return; }
    const [x, y] = cells[i];
    for (let k = 1; k <= Math.min(maxH, front[y]); k++) { h[x][y] = k; go(i + 1); }
    h[x][y] = 0;
  };
  go(0);
  return [...out.values()];
}
const sideGrid = (side, nz) => Array.from({ length: nz }, (_, r) => Array.from({ length: side.length }, (_, c) => side[side.length - 1 - c] > nz - 1 - r));
export function missingViewQuestion(seed) {
  return retry(seed, rng => {
    const heights = randomStack(rng, 3, 3, [5, 7]), v = stackViews(heights), possible = possibleSides(v.top, v.front);
    if (possible.length < 2) return null;
    const keyS = s => s.join(','), possibleKeys = new Set(possible.map(keyS)), nz = Math.max(...v.front);
    const impossible = [];
    for (let guard = 0; guard < 200 && impossible.length < 6; guard++) { const s = [0, 1, 2].map(() => 1 + Math.floor(rng() * 3)); if (!possibleKeys.has(keyS(s)) && !impossible.some(t => keyS(t) === keyS(s))) impossible.push(s); }
    const rightCount = 1 + Math.floor(rng() * Math.min(3, possible.length)), chosen = [...shuffle(rng, possible).slice(0, rightCount), ...impossible.slice(0, 4 - rightCount)];
    if (chosen.length < 4) return null;
    const why = s => { const tall = Math.max(...s); if (tall > nz) return `This has a stack ${tall} high, but the front view is never taller than ${nz}.`; const x = s.findIndex((h, i) => h > Math.max(...v.top[i].map((on, y) => (on ? v.front[y] : 0)))); if (x >= 0) return `Row ${x + 1} from the front can be at most ${Math.max(...v.top[x].map((on, y) => (on ? v.front[y] : 0)))} high: its squares lie under front columns no taller than that.`; return 'No stack with this top and front view has this side view: the tallest stacks it needs cannot all fit the front view at once.'; };
    const options = shuffle(rng, chosen).map((s, i) => ({ id: 'ABCD'[i], label: 'ABCD'[i], correct: possibleKeys.has(keyS(s)), figure: { type: 'view-grid', grid: sideGrid(s, Math.max(nz, ...s)) }, reason: possibleKeys.has(keyS(s)) ? 'A stack with this top and front view can have this side view.' : why(s) }));
    return {
      kind: 'missing-view', seed, answerMode: 'multi',
      prompt: 'A stack of cubes has the top and front views shown. Which of the options could be its right-side view? More than one may be possible.',
      figures: [{ type: 'views', top: v.top, front: v.front, side: null }],
      options, answer: options.filter(o => o.correct).map(o => o.id),
      explanation: 'A side view is possible when some stack fits all three views: each row of the side view needs a square in that row of the top view whose front column is at least as tall.',
      hints: ['The side view cannot be taller than the front view anywhere.', 'For each row of the side view, find the squares in that row of the top view, and how tall their front columns let them be.'],
      solution: [{ text: `Front view heights: ${v.front.join(', ')}.` }, { text: 'Each row from the front can be at most as tall as its tallest allowed square.' }, ...options.map(o => ({ text: `Option ${o.label}: ${o.reason}` })), { text: `So the answer is ${options.filter(o => o.correct).map(o => o.label).join(' and ')}.` }],
    };
  });
}

// ---------- same-solid ----------
export function sameSolidQuestion(seed, level) {
  return retry(seed, rng => {
    const cubes = randomPolycube(rng, level === 2 ? 5 : 6), shown = showable(rng, cubes);
    if (!shown) return null;
    const wrongSolids = [];
    if (level >= 3) wrongSolids.push({ cubes: mirror(cubes), reason: 'This is the mirror image. Walk along the solid from one end: at one corner it turns the other way.' });
    for (let guard = 0; guard < 20 && wrongSolids.length < (level === 4 ? 4 : 3); guard++) { const m = oneMoved(rng, cubes); if (m && !wrongSolids.some(w => sameSolid(w.cubes, m))) wrongSolids.push({ cubes: m, reason: 'One cube is in a different place. Count the cubes along each arm.' }); }
    const rightCount = level === 4 ? 1 + Math.floor(rng() * 3) : 1;
    const pictures = [...Array.from({ length: rightCount }, () => ({ cubes, correct: true, reason: 'This is the same solid, turned.' })), ...wrongSolids.slice(0, 4 - rightCount).map(w => ({ ...w, correct: false }))];
    if (pictures.length < 4) return null;
    const drawn = pictures.map(p => ({ ...p, view: showable(rng, p.cubes) }));
    if (drawn.some(d => !d.view)) return null;
    // Every drawing different, and none identical to the first picture.
    const keys = drawn.map(d => drawingKey(d.view));
    if (new Set([...keys, drawingKey(shown)]).size < 5) return null;
    const options = shuffle(rng, drawn).map((d, i) => ({ id: 'ABCD'[i], label: 'ABCD'[i], correct: d.correct, reason: d.reason, figure: { type: 'voxels', cubes: toCubeList(d.view) } }));
    const right = options.filter(o => o.correct).map(o => o.id);
    return {
      kind: 'same-solid', seed, answerMode: level === 4 ? 'multi' : 'single', cubes,
      prompt: level === 4 ? 'Which of these are the solid shown, turned to another position? More than one may be.' : 'Which option is the solid shown, turned to another position?',
      figures: [{ type: 'voxels', cubes: toCubeList(shown), large: true }],
      options, answer: level === 4 ? right : right[0],
      explanation: level >= 3 ? 'Turning never changes which way the solid twists. Its mirror image twists the other way, however it is turned.' : 'A turned solid has the same cubes in the same arrangement, seen from a new side.',
      ...(level >= 3 ? { hints: ['Find a landmark: the end of the longest arm, or a cube on top of another.', 'Walk from that landmark along the solid. Does each turn go the same way in the option?'], solution: [{ text: `The solid has ${cubes.length} cubes.` }, { text: 'Pick a landmark and walk along the solid, noting each turn: left, right, up.' }, ...options.map(o => ({ text: `Option ${o.label}: ${o.reason}` })), { text: `So the answer is ${right.join(' and ')}.` }] } : {}),
    };
  });
}

// ---------- view-after-turn ----------
export const turnStack = (heights, quarter) => { let h = heights; for (let i = 0; i < ((quarter % 4) + 4) % 4; i++) h = h[0].map((_, y) => h.map((_, x) => h[h.length - 1 - x][y])); return h; };
export function viewAfterTurnQuestion(seed) {
  return retry(seed, rng => {
    const heights = randomStack(rng, 3, 3, [6, 8]), quarter = pick(rng, [1, 2, 3]), ask = pick(rng, ['front', 'side']);
    const turned = turnStack(heights, quarter), truth = viewGrid(turned, ask);
    const candidates = [
      { grid: viewGrid(heights, ask), reason: 'That is the view before the turn.' },
      { grid: viewGrid(turnStack(heights, 4 - quarter), ask), reason: 'That is the view after turning the other way.' },
      { grid: truth.map(r => [...r].reverse()), reason: 'That is the right view, mirrored.' },
      { grid: viewGrid(turned, ask === 'front' ? 'side' : 'front'), reason: `That is the ${ask === 'front' ? 'side' : 'front'} view after the turn.` },
      { grid: viewGrid(turnStack(heights, quarter + 2), ask), reason: 'That is a half turn more than asked.' },
    ];
    const seen = new Set([gridKey(truth)]), wrong = [];
    for (const c of shuffle(rng, candidates)) { const k = gridKey(c.grid); if (!seen.has(k) && wrong.length < 3) { seen.add(k); wrong.push(c); } }
    if (wrong.length < 3) return null;
    const words = { 1: 'a quarter turn clockwise', 2: 'half a turn', 3: 'a quarter turn anticlockwise' }[quarter];
    const options = shuffle(rng, [{ grid: truth, correct: true, reason: `After ${words}, this is the ${VIEW_NAMES[ask]}.` }, ...wrong.map(w => ({ ...w, correct: false }))]).map((o, i) => ({ id: 'ABCD'[i], label: 'ABCD'[i], correct: o.correct, reason: o.reason, figure: { type: 'view-grid', grid: o.grid } }));
    return {
      kind: 'view-after-turn', seed, answerMode: 'single', heights, quarter,
      prompt: `The stack is turned ${words} on the spot, as seen from above. Which option is its ${VIEW_NAMES[ask]} after the turn?`,
      figures: [{ type: 'stack', heights, large: true }],
      options, answer: options.find(o => o.correct).id,
      explanation: quarter === 2 ? 'Half a turn swaps front with back and left with right: the new front is the old back.' : `A quarter turn brings a side round to the front. Seen from above, turning ${quarter === 1 ? 'clockwise' : 'anticlockwise'} makes the new ${ask === 'front' ? 'front' : 'right side'} the old ${quarter === 1 ? (ask === 'front' ? 'right side' : 'back') : (ask === 'front' ? 'left side' : 'front')}.`,
      hints: ['Mark the front-left corner of the stack and follow it round as the stack turns.', 'Then draw the new front view from the tallest stack in each column.'],
      solution: [{ text: `Turning ${words} moves each floor square round the middle.` }, { text: 'Rebuild the floor plan after the turn, keeping each stack\'s height.' }, { text: `Read the ${VIEW_NAMES[ask]} from the new plan.` }, { text: `So the answer is ${options.find(o => o.correct).label}.` }],
    };
  });
}

export function viewsQuestion(seed, kind, level) {
  if (kind === 'view-of-stack') return viewOfStackQuestion(seed, level);
  if (kind === 'solid-from-views') return solidFromViewsQuestion(seed);
  if (kind === 'missing-view') return missingViewQuestion(seed);
  if (kind === 'same-solid') return sameSolidQuestion(seed, level);
  if (kind === 'view-after-turn') return viewAfterTurnQuestion(seed);
  throw new Error('Unknown views kind ' + kind);
}
