// Patterns on a solid: stripes painted on a box that must join up across
// every edge when its net is folded. Built on solid-net.js.
//
// A mark is a straight segment on one face, with a class (which stripe).
// It lives in three frames:
//   - 3D, on the solid:          { face, cls, a, b } with a, b in 3D;
//   - "developed" on its face:   segments in the face's own flat frame;
//   - on a net:                  { face: net face index, cls, a, b } in net coordinates.
// A net carries the right pattern when its marks, folded back, are the
// solid's marks, allowing for turning the whole solid. Paper is printed on
// one side, so mirror images do not count.
import { describeFace, extrusion, profiles, unfold } from './solid-net.js';
import { pick, seededRandom, shuffle } from './random.js';

const round = v => Math.round(v * 1e3) / 1e3;
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

// ---------- frames ----------
// Developed point on a flat face → 3D.
export function lift(face) {
  const n = face.edges.length, c0 = face.corners[0], c1 = face.corners[1], cn = face.corners[n - 1];
  const P0 = face.edges[0].ends3[0], P1 = face.edges[1].ends3[0], Pn = face.edges[n - 1].ends3[0];
  const a = sub(c1, c0), b = sub(cn, c0), det = a[0] * b[1] - a[1] * b[0];
  return p => { const [x, y] = sub(p, c0), s = (x * b[1] - y * b[0]) / det, t = (a[0] * y - a[1] * x) / det; return P0.map((v, i) => v + s * (P1[i] - v) + t * (Pn[i] - v)); };
}
// 3D point on a flat face → developed.
export function drop(face) {
  const n = face.edges.length, c0 = face.corners[0], c1 = face.corners[1], cn = face.corners[n - 1];
  const P0 = face.edges[0].ends3[0], E1 = sub(face.edges[1].ends3[0], P0), En = sub(face.edges[n - 1].ends3[0], P0);
  const g11 = dot(E1, E1), g12 = dot(E1, En), g22 = dot(En, En), det = g11 * g22 - g12 * g12;
  return p => { const d = sub(p, P0), x = dot(d, E1), y = dot(d, En), s = (x * g22 - y * g12) / det, t = (g11 * y - g12 * x) / det; return [0, 1].map(i => c0[i] + s * (c1[i] - c0[i]) + t * (cn[i] - c0[i])); };
}
// Developed point → net coordinates (a turn and a slide, never a flip), and back.
function rigid(from0, from1, to0, to1) {
  const angle = Math.atan2(to1[1] - to0[1], to1[0] - to0[0]) - Math.atan2(from1[1] - from0[1], from1[0] - from0[0]), c = Math.cos(angle), s = Math.sin(angle);
  return p => [to0[0] + (p[0] - from0[0]) * c - (p[1] - from0[1]) * s, to0[1] + (p[0] - from0[0]) * s + (p[1] - from0[1]) * c];
}
const ontoNet = (face, netFace) => rigid(face.corners[0], face.corners[1], netFace.corners[0], netFace.corners[1]);
const offNet = (face, netFace) => rigid(netFace.corners[0], netFace.corners[1], face.corners[0], face.corners[1]);

// byFace: Map(solid face → [{ cls, a, b }] developed).
export function marksOnSolid(solid, byFace) {
  return [...byFace].flatMap(([f, list]) => { const up = lift(solid.faces[f]); return list.map(m => ({ face: f, cls: m.cls, a: up(m.a), b: up(m.b) })); });
}
export function marksOnNet(solid, net, byFace) {
  return net.faces.flatMap((netFace, i) => { const move = ontoNet(solid.faces[netFace.id], netFace); return (byFace.get(netFace.id) ?? []).map(m => ({ face: i, cls: m.cls, a: move(m.a), b: move(m.b) })); });
}
// Fold a marked net back: its marks in 3D on the solid.
export function foldMarks(solid, net) {
  return (net.marks ?? []).map(m => { const netFace = net.faces[m.face], face = solid.faces[netFace.id], back = offNet(face, netFace), up = lift(face); return { face: netFace.id, cls: m.cls, a: up(back(m.a)), b: up(back(m.b)) }; });
}

// ---------- comparing patterns ----------
const ROTATIONS = (() => {
  const out = [];
  for (const perm of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) for (let bits = 0; bits < 8; bits++) {
    const signs = [0, 1, 2].map(i => (bits >> i & 1 ? -1 : 1));
    const parity = (perm[0] === 0 ? (perm[1] === 1 ? 1 : -1) : perm[0] === 1 ? (perm[1] === 0 ? -1 : 1) : perm[1] === 0 ? 1 : -1);
    if (parity * signs[0] * signs[1] * signs[2] === 1) out.push(p => perm.map((k, i) => signs[i] * p[k]));
  }
  return out;
})();
function boxOf(solid) {
  const points = solid.faces.flatMap(face => face.edges.map(edge => edge.ends3[0]));
  const lo = [0, 1, 2].map(i => Math.min(...points.map(p => p[i]))), hi = [0, 1, 2].map(i => Math.max(...points.map(p => p[i])));
  return { centre: lo.map((v, i) => (v + hi[i]) / 2), half: lo.map((v, i) => (hi[i] - v) / 2) };
}
const keyOf = (marks, turn) => marks.map(m => { const ends = [m.a, m.b].map(p => turn(p).map(round).join(',')).sort(); return `${m.cls}:${ends[0]}|${ends[1]}`; }).sort().join(' ');
// Are two sets of 3D marks on the same box the same pattern, allowing the box to be turned?
export function samePattern(solid, marksA, marksB) {
  const { centre, half } = boxOf(solid);
  const centred = marks => marks.map(m => ({ cls: m.cls, a: sub(m.a, centre), b: sub(m.b, centre) }));
  const A = centred(marksA), B = centred(marksB), want = keyOf(B, p => p);
  return ROTATIONS.some(turn => turn(half).every((v, i) => Math.abs(Math.abs(v) - half[i]) < 1e-6) && keyOf(A, turn) === want);
}
export const patternMatches = (solid, net) => samePattern(solid, foldMarks(solid, net), solid.marks);

// ---------- stripes round a box ----------
// A stripe is where the plane (coordinate `axis` = `at`) cuts the surface: a loop over four faces.
export function ringMarks(solid, rings) {
  const byFace = new Map();
  solid.faces.forEach((face, f) => {
    const down = drop(face);
    rings.forEach((ring, cls) => {
      const hits = [];
      for (const edge of face.edges) {
        const [p, q] = edge.ends3, dp = p[ring.axis] - ring.at, dq = q[ring.axis] - ring.at;
        if (dp * dq < 0) hits.push(p.map((v, i) => v + (dp / (dp - dq)) * (q[i] - v)));
      }
      if (hits.length === 2) { if (!byFace.has(f)) byFace.set(f, []); byFace.get(f).push({ cls, a: down(hits[0]), b: down(hits[1]) }); }
    });
  });
  return byFace;
}

// Ways to spoil one face: its marks mirrored, or turned to run the other way.
const sameMarks = (x, y) => { const k = list => list.map(m => `${m.cls}:${[m.a, m.b].map(p => p.map(round).join(',')).sort().join('|')}`).sort().join(' '); return k(x) === k(y); };
function spoilers(face, marks) {
  const xs = face.corners.map(c => c[0]), ys = face.corners.map(c => c[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const apply = move => marks.map(m => ({ cls: m.cls, a: move(m.a), b: move(m.b) }));
  const single = marks.length === 1;
  return [
    { type: 'shifted', marks: apply(p => [2 * cx - p[0], p[1]]) },
    { type: 'shifted', marks: apply(p => [p[0], 2 * cy - p[1]]) },
    { type: single ? 'turned' : 'swapped', marks: apply(p => [cx + (p[1] - cy) * (w / h), cy + (p[0] - cx) * (h / w)]) },
  ].filter(s => !sameMarks(s.marks, marks));
}
const spoilText = {
  shifted: what => `On ${what} a stripe sits at the wrong distance from the edge, so it cannot meet the stripe on the face it touches when folded.`,
  turned: what => `On ${what} the stripe runs the wrong way: it never reaches the edges where its neighbours are waiting for it.`,
  swapped: what => `On ${what} the two stripes have changed places, so each one meets the wrong stripe at the edge.`,
};

export function patternedCuboidQuestion(seed) {
  const rng = seededRandom(seed);
  for (let attempt = 0; attempt < 60; attempt++) {
    // Two stripes round different axes. Each sits 1 from an end of a side at least 3 long, so it is never central.
    const [first, second, third] = shuffle(rng, [0, 1, 2]);
    const dims = [0, 0, 0];
    dims[first] = pick(rng, [3, 4]); dims[second] = pick(rng, [3, 4]); dims[third] = pick(rng, [2, 3]);
    const base = extrusion(profiles.box(dims[1], dims[2]), dims[0]);
    const rings = [first, second].map(axis => ({ axis, at: rng() < 0.5 ? 1 : dims[axis] - 1 }));
    const truth = ringMarks(base, rings);
    const solid = { ...base, marks: marksOnSolid(base, truth) };
    const layout = unfold(base, rng);
    if (!layout) continue;
    const withMarks = byFace => ({ ...layout, marks: marksOnNet(base, layout, byFace) });
    // Two spoiled faces X and Y give three wrong nets: X, Y, and both. No face is right in a majority of options.
    const faces = shuffle(rng, [...truth.keys()]);
    let found = null;
    for (let i = 0; i < faces.length && !found; i++) for (let j = i + 1; j < faces.length && !found; j++) {
      const X = pick(rng, spoilers(base.faces[faces[i]], truth.get(faces[i]))), Y = pick(rng, spoilers(base.faces[faces[j]], truth.get(faces[j])));
      if (!X || !Y) continue;
      const variants = [[X], [Y], [X, Y]].map(list => {
        const byFace = new Map(truth);
        list.forEach(s => byFace.set(s === X ? faces[i] : faces[j], s.marks));
        return { net: withMarks(byFace), list: list.map(s => ({ ...s, face: s === X ? faces[i] : faces[j] })) };
      });
      if (variants.every(v => !patternMatches(solid, v.net))) found = variants;
    }
    if (!found) continue;
    const reasonOf = list => list.map(s => spoilText[s.type](describeFace(base.faces[s.face]))).join(' Also: ');
    const options = shuffle(rng, [
      { net: withMarks(truth), correct: true, reason: 'Both stripes meet themselves across every fold, and across the cut edges that come together when the box closes.' },
      ...found.map(v => ({ net: v.net, correct: false, type: v.list.map(s => s.type).join('+'), reason: reasonOf(v.list) })),
    ]).map((o, i) => ({ ...o, id: 'ABCD'[i], label: 'ABCD'[i] }));
    const answer = options.find(o => o.correct).id;
    const size = [...dims].sort((a, b) => a - b).join(' × ');
    return {
      kind: 'patterned-cuboid', seed, answerMode: 'single', solid, dims, rings,
      prompt: 'Two stripes are painted right round this box. Each one joins up with itself. Which net folds to make the box?',
      options, answer,
      explanation: `The box is ${size}. Each stripe crosses four faces in a row and misses two opposite faces. In the right net every stripe arrives at an edge at the same point on both sides.`,
      hints: ['Follow one stripe at a time. Where it crosses a fold line, it must continue from the same point on the other side.', 'The four nets are the same shape. Find the faces where they differ and test only those.'],
      solution: [
        { text: `The box is ${size}. A stripe that runs right round crosses four faces and misses the two faces it runs parallel to.` },
        { text: 'The four nets are the same shape, so compare them face by face. They differ on two faces only.' },
        { text: 'On each of those faces, follow the stripe to a fold line. It must meet the stripe on the next face at the same point, measured from the same corner.' },
        { text: 'If the stripe runs along a fold and not across it, check the cut edge it does reach: fold that edge up in your head and see which face it lands against.' },
        ...options.filter(o => !o.correct).map(o => ({ text: `Option ${o.label}: ${o.reason}` })),
        { text: `So the answer is ${answer}.` },
      ],
    };
  }
  throw new Error('No patterned cuboid for seed ' + seed);
}
