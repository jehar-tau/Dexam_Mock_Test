// Sections of solids: the shape of a cut face, plane sections of a cube
// through marked points, pieces after cuts, solids with corners or edges
// sliced off, and solids made by turning a flat shape about an axis.
// Specification: docs/learn/topics/sections.md.
import { pick, seededRandom, shuffle } from './random.js';

const LETTERS = 'ABCD';
function retry(seed, build) {
  for (let i = 0; i < 600; i++) { const q = build(seededRandom(seed * 5023 + i * 8101)); if (q) return q; }
  throw new Error('No sections question for seed ' + seed);
}
const lettered = (rng, list) => {
  const options = shuffle(rng, list).map((o, i) => ({ ...o, id: LETTERS[i], label: LETTERS[i] }));
  return { options, answer: options.find(o => o.correct).id };
};
const textOptions = (rng, right, wrong, why) => lettered(rng, [right, ...wrong].slice(0, 4).map(t => ({ correct: t === right, text: t, reason: why(t) })));

// ---------- named solids ----------
export const CUTS = Object.freeze({
  cylinder: { level: 'a horizontal cut', vertical: 'a vertical cut through its axis', slant: 'a slanting cut that does not touch either end' },
  cone: { level: 'a horizontal cut', vertical: 'a vertical cut through its tip', slant: 'a slanting cut that does not touch the base' },
  sphere: { level: 'a cut anywhere', vertical: 'a cut through its centre', slant: 'a cut near its edge' },
  cube: { level: 'a cut parallel to a face', vertical: 'a cut through two opposite edges', slant: 'a cut through three corners next to one corner' },
  'square pyramid': { level: 'a horizontal cut', vertical: 'a vertical cut through its tip, parallel to a base edge', slant: 'a vertical cut through its tip and two opposite base corners' },
  'triangular prism': { level: 'a cut parallel to its triangular ends', vertical: 'a cut along its length, parallel to one side face', slant: 'a slanting cut across it that does not touch either end' },
});
export const CUT_FACE = Object.freeze({
  cylinder: { level: 'Circle', vertical: 'Rectangle', slant: 'Ellipse' }, cone: { level: 'Circle', vertical: 'Triangle', slant: 'Ellipse' },
  sphere: { level: 'Circle', vertical: 'Circle', slant: 'Circle' }, cube: { level: 'Square', vertical: 'Rectangle', slant: 'Triangle' },
  'square pyramid': { level: 'Square', vertical: 'Triangle', slant: 'Triangle' }, 'triangular prism': { level: 'Triangle', vertical: 'Rectangle', slant: 'Triangle' },
});
const SHAPES = ['Circle', 'Ellipse', 'Rectangle', 'Square', 'Triangle', 'Trapezium', 'Pentagon', 'Hexagon'];
export function cutFaceQuestion(seed, level = 1) {
  return retry(seed, rng => {
    const solid = pick(rng, Object.keys(CUTS)), cut = level <= 1 ? pick(rng, ['level', 'vertical']) : pick(rng, ['vertical', 'slant']), right = CUT_FACE[solid][cut];
    if (level >= 2 && solid === 'sphere' && rng() < 0.7) return null;
    const near = { Circle: ['Ellipse', 'Square', 'Triangle'], Ellipse: ['Circle', 'Rectangle', 'Triangle'], Rectangle: ['Square', 'Trapezium', 'Ellipse'], Square: ['Rectangle', 'Circle', 'Triangle'], Triangle: ['Trapezium', 'Rectangle', 'Circle'] }[right];
    const { options, answer } = textOptions(rng, right, near, t => (t === right ? `The cut runs ${CUTS[solid][cut].replace(/^a /, 'as ')}, giving a ${right.toLowerCase()}.` : `${t}: picture the cut face lying flat on the table.`));
    return {
      kind: 'cut-face', seed, answerMode: 'single', prompt: `A solid ${solid} is sliced by ${CUTS[solid][cut]}. What shape is the cut face?`, figures: [], options, answer,
      explanation: { cylinder: 'Across a cylinder you get its circle; along its axis, a rectangle; at a slant, a stretched circle, an ellipse.', cone: 'Across a cone you get a circle; through its tip, a triangle; at a slant, an ellipse.', sphere: 'Every flat cut of a sphere is a circle; only its size changes.', cube: 'Parallel to a face: a square. Through two opposite edges: a rectangle. Through three corners around one corner: a triangle.', 'square pyramid': 'Across: a smaller square. Through the tip: a triangle.', 'triangular prism': 'Parallel to the ends: the triangle. Along the length: a rectangle.' }[solid],
    };
  });
}

// ---------- plane sections of a cube ----------
// The cube is [0,2]^3 so that edge midpoints are whole numbers. x right, y back, z up.
const V = [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0], [0, 0, 2], [2, 0, 2], [2, 2, 2], [0, 2, 2]];
export const CUBE_EDGES = Object.freeze([[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]);
const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.sqrt(dot(a, a));
export function cubeSection(points) {
  const n = cross(sub(points[1], points[0]), sub(points[2], points[0])), d = dot(n, points[0]);
  if (len(n) < 1e-9) return null;
  const hits = [];
  const addHit = p => { if (!hits.some(h => len(sub(h, p)) < 1e-9)) hits.push(p); };
  for (const [a, b] of CUBE_EDGES) {
    const fa = dot(n, V[a]) - d, fb = dot(n, V[b]) - d;
    if (Math.abs(fa) < 1e-9) addHit(V[a]);
    if (Math.abs(fb) < 1e-9) addHit(V[b]);
    if (fa * fb < -1e-18) { const t = fa / (fa - fb); addHit(V[a].map((v, i) => v + (V[b][i] - v) * t)); }
  }
  if (hits.length < 3) return null;
  // Order round the centre in the plane.
  const c = hits.reduce((s, p) => s.map((v, i) => v + p[i] / hits.length), [0, 0, 0]), u = sub(hits[0], c), w = cross(n, u);
  return hits.map(p => ({ p, a: Math.atan2(dot(sub(p, c), w) / len(w), dot(sub(p, c), u) / len(u)) })).sort((x, y) => x.a - y.a).map(h => h.p);
}
export function classify(poly) {
  const k = poly.length, sides = poly.map((p, i) => len(sub(poly[(i + 1) % k], p))), eq = (a, b) => Math.abs(a - b) < 1e-6;
  const angle = i => { const a = sub(poly[(i + k - 1) % k], poly[i]), b = sub(poly[(i + 1) % k], poly[i]); return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b))))); };
  const parallel = (i, j) => len(cross(sub(poly[(i + 1) % k], poly[i]), sub(poly[(j + 1) % k], poly[j]))) < 1e-6;
  if (k === 3) { const same = [eq(sides[0], sides[1]), eq(sides[1], sides[2]), eq(sides[0], sides[2])].filter(Boolean).length; const right = [0, 1, 2].some(i => eq(angle(i), Math.PI / 2)); return same === 3 ? 'Equilateral triangle' : right ? (same ? 'Right isosceles triangle' : 'Right triangle') : same ? 'Isosceles triangle' : 'Scalene triangle'; }
  if (k === 4) {
    const rightAll = [0, 1, 2, 3].every(i => eq(angle(i), Math.PI / 2)), allEq = sides.every(s => eq(s, sides[0]));
    if (rightAll) return allEq ? 'Square' : 'Rectangle';
    const p1 = parallel(0, 2), p2 = parallel(1, 3);
    if (p1 && p2) return allEq ? 'Rhombus' : 'Parallelogram';
    return p1 || p2 ? 'Trapezium' : 'Quadrilateral';
  }
  if (k === 5) return 'Pentagon';
  return sides.every(s => eq(s, sides[0])) && [0, 1, 2, 3, 4, 5].every(i => eq(angle(i), (2 * Math.PI) / 3)) ? 'Regular hexagon' : 'Hexagon';
}
// Marked points: corners and edge midpoints of the [0,2] cube.
const POINTS = (() => { const out = V.map(v => ({ p: v, kind: 'corner' })); for (const [a, b] of CUBE_EDGES) out.push({ p: V[a].map((v, i) => (v + V[b][i]) / 2), kind: 'middle' }); return out; })();
const onSameFace = pts => [0, 1, 2].some(ax => [0, 2].some(val => pts.every(p => p[ax] === val)));
const CONFUSE = { 'Equilateral triangle': ['Isosceles triangle', 'Regular hexagon', 'Right isosceles triangle'], 'Isosceles triangle': ['Equilateral triangle', 'Trapezium', 'Scalene triangle'], 'Right isosceles triangle': ['Isosceles triangle', 'Square', 'Equilateral triangle'], 'Scalene triangle': ['Isosceles triangle', 'Trapezium', 'Pentagon'], Square: ['Rectangle', 'Rhombus', 'Trapezium'], Rectangle: ['Square', 'Parallelogram', 'Trapezium'], Rhombus: ['Square', 'Rectangle', 'Parallelogram'], Trapezium: ['Rectangle', 'Parallelogram', 'Pentagon'], Parallelogram: ['Rhombus', 'Rectangle', 'Trapezium'], Pentagon: ['Hexagon', 'Trapezium', 'Regular hexagon'], 'Regular hexagon': ['Pentagon', 'Hexagon', 'Equilateral triangle'], Hexagon: ['Pentagon', 'Regular hexagon', 'Trapezium'] };
export function cubeSectionQuestion(seed, level = 3) {
  const targets = level <= 3 ? ['Equilateral triangle', 'Rectangle', 'Square', 'Regular hexagon'] : ['Pentagon', 'Trapezium', 'Isosceles triangle', 'Rhombus'];
  const target = targets[seed % targets.length];
  return retry(seed, rng => {
    const marks = shuffle(rng, POINTS).slice(0, 3), pts = marks.map(m => m.p);
    if (onSameFace(pts)) return null;
    const poly = cubeSection(pts);
    if (!poly) return null;
    const name = classify(poly);
    if (name === 'Quadrilateral') return null;
    if (name !== target) return null;
    const { options, answer } = textOptions(rng, name, CONFUSE[name], t => (t === name ? `Joining the cut across each face gives a ${name.toLowerCase()} with ${poly.length} sides.` : `The plane crosses ${poly.length} faces, and its sides ${t.toLowerCase().includes('triangle') ? 'are not' : 'do not make'} a ${t.toLowerCase()}.`));
    const labels = ['P', 'Q', 'R'];
    return {
      kind: 'cube-section', seed, answerMode: 'single', marks: pts, polygon: poly,
      prompt: 'A cube is sliced by one flat cut through the three marked points P, Q and R. What shape is the cut face?',
      figures: [{ type: 'cube-cut', points: pts.map((p, i) => ({ p, label: labels[i] })) }],
      options, answer,
      explanation: `The cut meets ${poly.length} faces of the cube, so the section has ${poly.length} sides. Where two marked points share a face, the cut runs straight between them; parallel faces are cut along parallel lines. ${name}.`,
      hints: ['Join two marked points only when they lie on the same face.', 'The cut crosses opposite faces along parallel lines. Count the faces it crosses: that is the number of sides.'],
      solution: [{ text: `The plane through P, Q and R crosses ${poly.length} faces of the cube.` }, { text: `Its corners lie at ${poly.map(p => `(${p.map(v => +(v / 2).toFixed(2)).join(', ')})`).join(', ')}, taking the cube's side as 1.` }, { text: `Side lengths and angles make it a ${name.toLowerCase()}.` }],
    };
  });
}

// ---------- how many pieces ----------
export const maxPieces = n => (n * n * n + 5 * n + 6) / 6;
export function piecesQuestion(seed, level = 3) {
  return retry(seed, rng => {
    const form = level >= 4 ? pick(rng, ['grid', 'cake', 'cylinder']) : pick(rng, ['grid', 'cylinder']);
    if (form === 'grid') {
      const [a, b, c] = [0, 0, 0].map(() => Math.floor(rng() * 4)), value = (a + 1) * (b + 1) * (c + 1);
      if (a + b + c < 2) return null;
      const say = (k, dir) => (k ? `${k} cut${k > 1 ? 's' : ''} ${dir}` : null);
      return { kind: 'cut-pieces', seed, answerMode: 'numeric', unit: '', prompt: `A cube of cheese is cut with ${[say(a, 'from left to right'), say(b, 'from front to back'), say(c, 'parallel to the table')].filter(Boolean).join(', ')}. Every cut is flat, goes right through, and runs parallel to a face. How many pieces are there?`, figures: [], answer: { value }, mistakes: [{ value: a + b + c + 1, reason: 'Cuts in different directions multiply the pieces; they do not just add one each.' }, { value: a * b * c || a + b + c, reason: 'Each set of k parallel cuts makes k + 1 slices; multiply the slices.' }].filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i), explanation: `Parallel cuts make one more slice than cuts: ${a + 1} × ${b + 1} × ${c + 1} = ${value}.`, hints: ['k parallel cuts make k + 1 slices.', 'Cuts in the three directions multiply.'], solution: [{ text: `Left to right: ${a + 1} slices.` }, { text: `Front to back: ${b + 1}; parallel to the table: ${c + 1}.` }, { text: `${a + 1} × ${b + 1} × ${c + 1} = ${value}.` }] };
    }
    if (form === 'cylinder') {
      const across = 1 + Math.floor(rng() * 3), through = 1 + Math.floor(rng() * 3), value = (across + 1) * 2 * through;
      return { kind: 'cut-pieces', seed, answerMode: 'numeric', unit: '', prompt: `A round cake is cut with ${across} level cut${across > 1 ? 's' : ''} parallel to the plate and ${through} upright cut${through > 1 ? 's' : ''}, each through the centre at different angles. How many pieces are there?`, figures: [], answer: { value }, mistakes: [{ value: (across + 1) * (through + 1), reason: 'An upright cut through the centre crosses the whole cake, so k of them make 2k wedges, not k + 1.' }, { value: across + 2 * through, reason: 'The layers and the wedges multiply.' }].filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i), explanation: `${across} level cuts make ${across + 1} layers; ${through} cuts through the centre make ${2 * through} wedges. ${across + 1} × ${2 * through} = ${value}.`, hints: ['Cuts through the centre split every layer into wedges, two per cut.', 'Layers times wedges.'], solution: [{ text: `Layers: ${across} + 1 = ${across + 1}.` }, { text: `Wedges: 2 × ${through} = ${2 * through}.` }, { text: `Pieces: ${across + 1} × ${2 * through} = ${value}.` }] };
    }
    const n = pick(rng, [3, 4, 5]), value = maxPieces(n);
    return { kind: 'cut-pieces', seed, answerMode: 'numeric', unit: '', prompt: `A block of clay is cut ${n} times with straight flat cuts. The pieces are not moved between cuts. What is the greatest number of pieces possible?`, figures: [], answer: { value }, mistakes: [{ value: 2 ** n, reason: `Doubling works only up to 3 cuts. The ${n === 3 ? 'answer happens to match' : `${n}th cut cannot cross every piece`}.` }, { value: (n * n + n + 2) / 2, reason: 'That is the most pieces of a flat pancake cut by lines. A solid block can do better.' }, { value: n + 1, reason: 'That is for parallel cuts. Tilted cuts that cross give more.' }].filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i), explanation: `Each new cut adds as many pieces as the regions it is divided into by the earlier cuts. The most for ${n} cuts is (n³ + 5n + 6) ÷ 6 = ${value}.`, hints: ['Three cuts can make 8, like cutting a cube into eighths.', 'A new cut adds one piece for each region the earlier cuts divide it into: at most the pancake number for those cuts.'], solution: [{ text: 'Flat pancake with k lines: at most (k² + k + 2) ÷ 2 regions.' }, { text: `Each cut adds the pancake number of the cuts before it: 1, 2, 4, 7, 11 for cuts 1 to 5.` }, { text: `Total for ${n} cuts: ${value}.` }] };
  });
}

// ---------- slicing off corners and edges ----------
// Convex polytope from half-spaces: vertices are triple-plane meets that obey every plane.
export function polytope(planes) {
  const verts = [];
  for (let i = 0; i < planes.length; i++) for (let j = i + 1; j < planes.length; j++) for (let k = j + 1; k < planes.length; k++) {
    const [a, b, c] = [planes[i], planes[j], planes[k]], det = dot(a.n, cross(b.n, c.n));
    if (Math.abs(det) < 1e-9) continue;
    const p = cross(b.n, c.n).map((v, t) => (a.d * v + b.d * cross(c.n, a.n)[t] + c.d * cross(a.n, b.n)[t]) / det);
    if (planes.every(pl => dot(pl.n, p) <= pl.d + 1e-7) && !verts.some(v => len(sub(v, p)) < 1e-7)) verts.push(p);
  }
  const onPlane = pl => verts.map((v, i) => (Math.abs(dot(pl.n, v) - pl.d) < 1e-7 ? i : -1)).filter(i => i >= 0);
  const faces = planes.map(onPlane).filter(f => f.length >= 3);
  let edges = 0;
  for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) if (faces[i].filter(v => faces[j].includes(v)).length >= 2) edges++;
  return { vertices: verts.length, edges, faces: faces.length };
}
export const cubePlanes = () => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(n => ({ n, d: n.some(v => v < 0) ? 0 : 6 }));
export function truncationQuestion(seed) {
  return retry(seed, rng => {
    const corners = Math.floor(rng() * 5), edges = corners ? Math.floor(rng() * 2) : 1 + Math.floor(rng() * 2), ask = pick(rng, ['faces', 'edges', 'corners']);
    const F = 6 + corners + edges, E = 12 + 3 * corners + 3 * edges, Vn = 8 + 2 * corners + 2 * edges, value = { faces: F, edges: E, corners: Vn }[ask];
    const say = [corners ? `${corners} of its corners sliced off with small flat cuts` : null, edges ? `${edges === 1 ? 'one edge' : `${edges} edges that do not touch`} bevelled with a narrow flat cut along the edge` : null].filter(Boolean).join(' and ');
    return {
      kind: 'truncation', seed, answerMode: 'numeric', unit: '', corners, edges,
      prompt: `A wooden cube has ${say}. No two cuts touch. How many ${ask} does the solid have now?`,
      figures: [], answer: { value },
      mistakes: [{ value: { faces: 6, edges: 12, corners: 8 }[ask], reason: 'Every cut changes the solid: it adds a face and new edges and corners.' }, { value: { faces: F, edges: 12 + corners + edges, corners: 8 + corners + edges }[ask], reason: { faces: 'Check again.', edges: 'A sliced-off corner leaves a triangle: 3 new edges, not 1.', corners: 'A sliced corner is replaced by 3 corners: a net gain of 2.' }[ask] }, { value: { faces: 6 + corners, edges: 12 + 3 * corners, corners: 8 + 2 * corners }[ask], reason: 'The bevelled edges count too: each adds a face, three edges and two corners.' }].filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i),
      explanation: `Slicing off a corner adds 1 face, 3 edges and 2 corners. Bevelling an edge adds 1 face, 3 edges and 2 corners as well. ${ask}: ${{ faces: `6 + ${corners + edges} = ${F}`, edges: `12 + 3 × ${corners + edges} = ${E}`, corners: `8 + 2 × ${corners + edges} = ${Vn}` }[ask]}. Check: corners − edges + faces = ${Vn} − ${E} + ${F} = 2.`,
      hints: ['What does one cut add? A new face, the edges round it, and the corners it creates.', 'Check your answer with corners − edges + faces = 2.'],
      solution: [{ text: 'A cut-off corner leaves a small triangle: +1 face, +3 edges, +2 corners (3 new, 1 lost).' }, { text: 'A bevelled edge leaves a thin rectangle: +1 face, +3 edges (4 new, 1 lost), +2 corners (4 new, 2 lost).' }, { text: `${corners + edges} cuts: ${ask} = ${value}.` }],
    };
  });
}

// ---------- turning a shape about an axis ----------
export const PROFILES = Object.freeze({
  rect: { shape: [[0, 0], [2, 0], [2, 3], [0, 3]], solid: 'Cylinder', words: 'a rectangle turned about one of its sides' },
  tri: { shape: [[0, 0], [2, 0], [0, 3]], solid: 'Cone', words: 'a right triangle turned about one of its shorter sides' },
  semi: { shape: Array.from({ length: 13 }, (_, i) => [2 * Math.sin((Math.PI * i) / 12), 2 * Math.cos((Math.PI * i) / 12)]), solid: 'Sphere', words: 'a half circle turned about its straight edge' },
  quarter: { shape: [[0, 0], ...Array.from({ length: 7 }, (_, i) => [2 * Math.cos((Math.PI * i) / 12), 2 * Math.sin((Math.PI * i) / 12)])], solid: 'Hemisphere', words: 'a quarter circle turned about one straight edge' },
  trap: { shape: [[0, 0], [3, 0], [1.5, 3], [0, 3]], solid: 'Frustum (a cone with its tip cut off)', words: 'a right trapezium turned about its upright side' },
  offset: { shape: [[1, 0], [2.5, 0], [2.5, 3], [1, 3]], solid: 'Tube (a hollow cylinder)', words: 'a rectangle turned about a line parallel to it, a gap away' },
  steps: { shape: [[0, 0], [2.5, 0], [2.5, 1.5], [1.2, 1.5], [1.2, 3], [0, 3]], solid: 'Two cylinders stacked, wide below and narrow above', words: 'an L-shaped step turned about its long upright side' },
  house: { shape: [[0, 0], [2, 0], [2, 2], [0, 3.5]], solid: 'A cylinder with a cone on top', words: 'a rectangle topped by a triangle, turned about its upright side' },
  bead: { shape: [[0, 0], [2, 1.5], [0, 3]], solid: 'Two cones joined base to base', words: 'a triangle with its long side on the axis' },
});
export function revolutionQuestion(seed, level = 2) {
  return retry(seed, rng => {
    const pool = level <= 2 ? ['rect', 'tri', 'semi', 'quarter'] : ['trap', 'offset', 'steps', 'house', 'bead', 'tri'];
    const id = pick(rng, pool), right = PROFILES[id].solid;
    const others = shuffle(rng, Object.keys(PROFILES).filter(k => k !== id && PROFILES[k].solid !== right)).slice(0, 3).map(k => PROFILES[k].solid);
    const { options, answer } = textOptions(rng, right, others, t => (t === right ? 'Every point sweeps a circle round the axis; the outline traced is this solid.' : 'Trace what each edge sweeps: an edge parallel to the axis makes a cylinder wall, a slanting edge a cone, a curve a rounded surface.'));
    return {
      kind: 'revolution', seed, answerMode: 'single',
      prompt: 'This flat shape is spun once round the dashed axis. What solid does it sweep out?',
      figures: [{ type: 'revolve', shape: PROFILES[id].shape }], options, answer,
      explanation: `It is ${PROFILES[id].words}. An edge parallel to the axis sweeps a cylinder wall; an edge slanting to the axis sweeps a cone; an edge on the axis sweeps nothing; a gap from the axis leaves a hole.`,
      ...(level >= 3 ? { hints: ['Take each edge in turn and ask what it sweeps.', 'A gap between the shape and the axis leaves a hole down the middle.'], solution: [{ text: 'Edges on the axis sweep nothing.' }, { text: 'Edges parallel to the axis sweep cylinder walls; slanting edges sweep cones; flat edges square to the axis sweep flat rings or discs.' }, { text: `Together: ${right.toLowerCase()}.` }] } : {}),
    };
  });
}

export function sectionsQuestion(seed, kind, level) {
  switch (kind) {
    case 'cut-face': return cutFaceQuestion(seed, level);
    case 'cube-section': return cubeSectionQuestion(seed, level);
    case 'cut-pieces': return piecesQuestion(seed, level);
    case 'truncation': return truncationQuestion(seed);
    case 'revolution': return revolutionQuestion(seed, level);
    default: throw new Error('Unknown sections kind ' + kind);
  }
}
export const SECTION_KINDS = Object.freeze({ 'cut-face': [1, 2], revolution: [2, 3], 'cube-section': [3, 4], 'cut-pieces': [3, 4], truncation: [4] });
