// Nets of solids: solids with many faces of different shapes, their
// unfoldings, an exact test that a net folds into a solid, and wrong nets
// that differ from a true one by a single face.
//
// Conventions. 3D: the viewer stands at (+x, +y, +z), as in cube-net.js.
// An extrusion pushes a 2D profile (drawn in the y–z plane, anticlockwise)
// along x, so its front cap faces +x. Every face is described two ways:
//   - in 3D, for drawing the solid;
//   - "developed" flat in its own 2D frame, anticlockwise as seen from
//     OUTSIDE the solid, for laying out nets.
// A face has logical edges. A straight edge is one segment; an arc is one
// logical edge with a polyline for drawing. A curved side face is developed
// as a rectangle as long as its arc. Nets never fold along an arc.
import { pick, seededRandom, shuffle } from './random.js';

const TOL = 1e-4;
const near = (a, b) => Math.abs(a - b) < TOL;
const round = v => Math.round(v * 1e4) / 1e4;
const key3 = p => p.map(round).join(',');
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = v => Math.hypot(...v);
const unit = v => { const l = length(v); return v.map(c => c / l); };
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---------- faces ----------
export function newell(points) {
  const n = [0, 0, 0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return unit(n);
}
// Flatten a planar 3D outline into its own 2D frame, anticlockwise seen from outside.
function flatten(points) {
  const n = newell(points), o = points[0];
  const u = unit(sub(points[1], o)), v = cross(n, u);
  return points.map(p => [dot(sub(p, o), u), dot(sub(p, o), v)]);
}
const turnBetween = (a, b) => { let t = Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0]); while (t > Math.PI) t -= 2 * Math.PI; while (t <= -Math.PI) t += 2 * Math.PI; return round(t); };
const polylineLength = line => line.slice(1).reduce((s, p, i) => s + dist2(p, line[i]), 0);

// edges: [{ line2: [[x, y]…] developed polyline, ends3: [p, q] 3D endpoints, arc }]
function makeFace(edges, extra) {
  const shape = edges.map((edge, i) => {
    const next = edges[(i + 1) % edges.length];
    const out = sub(edge.line2[edge.line2.length - 1], edge.line2[edge.line2.length - 2]), into = sub(next.line2[1], next.line2[0]);
    return { len: round(polylineLength(edge.line2)), arc: Boolean(edge.arc), turn: turnBetween(out, into) };
  });
  return { edges, shape, corners: edges.map(e => e.line2[0]), ...extra };
}
function flatFace(points3, extra = {}) {
  const dev = flatten(points3);
  const edges = points3.map((p, i) => ({ line2: [dev[i], dev[(i + 1) % dev.length]], ends3: [p, points3[(i + 1) % points3.length]], arc: false }));
  return makeFace(edges, { kind: 'flat', draw: [{ points: points3, outline: true }], normal: newell(points3), ...extra });
}

function linkFaces(faces, extra = {}) {
  const byEdge = new Map();
  faces.forEach((face, f) => face.edges.forEach((edge, e) => {
    const k = edge.ends3.map(key3).sort().join('|') + (edge.arc ? '|arc' : '');
    if (!byEdge.has(k)) byEdge.set(k, []);
    byEdge.get(k).push({ face: f, edge: e });
  }));
  const neighbours = faces.map(face => face.edges.map(() => null));
  for (const pair of byEdge.values()) {
    if (pair.length !== 2) throw new Error('Solid is not closed: an edge is shared by ' + pair.length + ' faces');
    const [a, b] = pair;
    neighbours[a.face][a.edge] = b; neighbours[b.face][b.edge] = a;
  }
  return { faces, neighbours, ...extra };
}

// ---------- solid families ----------
// A profile is { points: [[y, z]…] anticlockwise, arcs: [group or null per edge i → i+1] }.
export function extrusion(profile, depth) {
  const { points, arcs } = profile, n = points.length;
  let start = 0;
  while (arcs[start] !== null && arcs[(start + n - 1) % n] === arcs[start]) start++;
  const runs = [];
  for (let i = 0; i < n;) {
    const k = (start + i) % n, group = arcs[k];
    let count = 1;
    if (group !== null) while (count < n && arcs[(k + count) % n] === group) count++;
    runs.push({ line: Array.from({ length: count + 1 }, (_, j) => points[(k + j) % n]), arc: group !== null });
    i += count;
  }
  const at = (x, p) => [x, p[0], p[1]];
  const front = makeFace(runs.map(run => ({ line2: run.line, ends3: [at(depth, run.line[0]), at(depth, run.line[run.line.length - 1])], arc: run.arc })),
    { kind: 'flat', role: 'cap', normal: [1, 0, 0], draw: [{ points: runs.flatMap(run => run.line.slice(0, -1)).map(p => at(depth, p)), outline: true }] });
  const backRuns = [...runs].reverse().map(run => ({ line: [...run.line].reverse(), arc: run.arc }));
  const back = makeFace(backRuns.map(run => ({ line2: run.line.map(p => [-p[0], p[1]]), ends3: [at(0, run.line[0]), at(0, run.line[run.line.length - 1])], arc: run.arc })),
    { kind: 'flat', role: 'cap', normal: [-1, 0, 0], draw: [{ points: backRuns.flatMap(run => run.line.slice(0, -1)).map(p => at(0, p)), outline: true }] });
  const sides = runs.map(run => {
    const S = run.line[0], E = run.line[run.line.length - 1], l = polylineLength(run.line);
    const fS = at(depth, S), bS = at(0, S), bE = at(0, E), fE = at(depth, E);
    const dev = [[0, 0], [depth, 0], [depth, l], [0, l]];
    const corners = [fS, bS, bE, fE];
    const edges = corners.map((c, i) => ({ line2: [dev[i], dev[(i + 1) % 4]], ends3: [c, corners[(i + 1) % 4]], arc: run.arc && i % 2 === 1 }));
    const d = sub(E, S);
    const draw = run.arc
      ? run.line.slice(1).map((p, i) => ({ points: [at(depth, run.line[i]), at(0, run.line[i]), at(0, p), at(depth, p)], outline: false }))
      : [{ points: corners, outline: true }];
    return makeFace(edges, { kind: run.arc ? 'curved' : 'flat', role: 'side', normal: unit([0, d[1], -d[0]]), draw });
  });
  return linkFaces([...sides, front, back], { family: 'extrusion', sides: sides.map((_, i) => i), caps: [sides.length, sides.length + 1], depth, profile });
}

export function pyramid(sides, radius = 2, heightAbove = 3) {
  const base = Array.from({ length: sides }, (_, i) => { const a = (2 * Math.PI * i) / sides + Math.PI / sides; return [radius * Math.cos(a), radius * Math.sin(a), 0]; });
  const apex = [0, 0, heightAbove];
  const faces = [flatFace([...base].reverse(), { role: 'cap' }), ...base.map((p, i) => flatFace([p, base[(i + 1) % sides], apex], { role: 'side' }))];
  return linkFaces(faces, { family: 'pyramid' });
}

// A solid built from unit cubes. Faces in the same plane that touch are merged into one polygon.
export function polycube(cells) {
  const has = new Set(cells.map(c => c.join(',')));
  const groups = new Map();
  for (const cell of cells) for (let axis = 0; axis < 3; axis++) for (const sign of [1, -1]) {
    const beside = [...cell]; beside[axis] += sign;
    if (has.has(beside.join(','))) continue;
    const [b, c] = [(axis + 1) % 3, (axis + 2) % 3];
    const k = `${axis},${sign},${cell[axis] + (sign > 0 ? 1 : 0)}`;
    if (!groups.has(k)) groups.set(k, new Set());
    groups.get(k).add(`${cell[b]},${cell[c]}`);
  }
  const loops = [];
  for (const [k, set] of groups) {
    const [axis, sign, plane] = k.split(',').map(Number);
    const [b, c] = [(axis + 1) % 3, (axis + 2) % 3];
    const left = new Set(set);
    while (left.size) {
      const piece = new Set(), stack = [left.values().next().value];
      left.delete(stack[0]);
      while (stack.length) {
        const cur = stack.pop(); piece.add(cur);
        const [u, v] = cur.split(',').map(Number);
        for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = `${u + du},${v + dv}`; if (left.has(q)) { left.delete(q); stack.push(q); } }
      }
      // Boundary edges, anticlockwise with the piece on the left.
      const next = new Map();
      for (const cur of piece) {
        const [u, v] = cur.split(',').map(Number);
        const sidesOf = [[[u, v], [u + 1, v], [0, -1]], [[u + 1, v], [u + 1, v + 1], [1, 0]], [[u + 1, v + 1], [u, v + 1], [0, 1]], [[u, v + 1], [u, v], [-1, 0]]];
        for (const [from, to, [du, dv]] of sidesOf) {
          if (piece.has(`${u + du},${v + dv}`)) continue;
          if (next.has(from.join(','))) return null; // pinched corner: ambiguous outline
          next.set(from.join(','), to);
        }
      }
      const first = next.keys().next().value;
      let loop = [], at = first;
      do { loop.push(at.split(',').map(Number)); at = next.get(at).join(','); } while (at !== first && loop.length <= next.size);
      if (loop.length !== next.size) return null; // a hole in the face
      loop = loop.filter((p, i) => { const a = loop[(i + loop.length - 1) % loop.length], z = loop[(i + 1) % loop.length]; return (p[0] - a[0]) * (z[1] - p[1]) !== (p[1] - a[1]) * (z[0] - p[0]); });
      if (sign < 0) loop.reverse();
      loops.push(loop.map(([u, v]) => { const p = [0, 0, 0]; p[axis] = plane; p[b] = u; p[c] = v; return p; }));
    }
  }
  // Split edges where another face's corner lies on them, so every edge meets exactly one neighbour.
  const corners = new Map(loops.flat().map(p => [key3(p), p]));
  const split = loops.map(loop => loop.flatMap((p, i) => {
    const q = loop[(i + 1) % loop.length], d = sub(q, p), l = length(d);
    const between = [...corners.values()].filter(r => { const t = dot(sub(r, p), d) / (l * l); return t > TOL && t < 1 - TOL && length(cross(sub(r, p), d)) < TOL; })
      .sort((a, z) => dot(sub(a, p), d) - dot(sub(z, p), d));
    return [p, ...between];
  }));
  try { return linkFaces(split.map(loop => flatFace(loop, { role: 'side' })), { family: 'polycube', cells }); } catch { return null; }
}

// Close a set of planar outlines into a solid: split edges where another face's corner lies on
// them, so every edge meets exactly one neighbour, then link.
function fromLoops(loops, roles, extra) {
  const corners = new Map(loops.flat().map(p => [key3(p), p]));
  const split = loops.map(loop => loop.flatMap((p, i) => {
    const q = loop[(i + 1) % loop.length], d = sub(q, p), l = length(d);
    const between = [...corners.values()].filter(r => { const t = dot(sub(r, p), d) / (l * l); return t > TOL && t < 1 - TOL && length(cross(sub(r, p), d)) < TOL; })
      .sort((x, z) => dot(sub(x, p), d) - dot(sub(z, p), d));
    return [p, ...between];
  }));
  return linkFaces(split.map((loop, i) => flatFace(loop, { role: roles[i] })), extra);
}
// A regular polygon of side 2 standing on the edge from `from` to `to`, to the left of that direction.
function polygonOn(from, to, n) {
  const points = [from];
  let angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  for (let i = 1; i < n; i++) { const last = points[points.length - 1]; points.push([last[0] + 2 * Math.cos(angle), last[1] + 2 * Math.sin(angle)]); angle += (2 * Math.PI) / n; }
  return points;
}
// Two prisms with regular ends, glued along one side face. The second is shorter and set in from
// both ends, so the solid has four separate end faces, as in long exam nets.
export function joined(n, m, depth = 4, inset = 1, short = 2) {
  const P = polygonOn([0, 0], [2, 0], n), Q = polygonOn([2, 0], [0, 0], m);
  const at = (x, p) => [x, p[0], p[1]];
  const loops = [], roles = [];
  const push = (loop, role) => { loops.push(loop); roles.push(role); };
  const side = (S, E, front, back) => [at(front, S), at(back, S), at(back, E), at(front, E)];
  push(P.map(p => at(depth, p)), 'cap'); push([...P].reverse().map(p => at(0, p)), 'cap');
  for (let k = 1; k < n; k++) push(side(P[k], P[(k + 1) % n], depth, 0), 'side');
  push(side(P[0], P[1], inset, 0), 'side'); push(side(P[0], P[1], depth, inset + short), 'side');
  push(Q.map(p => at(inset + short, p)), 'cap'); push([...Q].reverse().map(p => at(inset, p)), 'cap');
  for (let k = 1; k < m; k++) push(side(Q[k], Q[(k + 1) % m], inset + short, inset), 'side');
  return fromLoops(loops, roles, { family: 'joined' });
}

// A box with corners sliced off. Each cut passes through the three points one unit along the
// edges from a corner, so the new face is a triangle and every other face keeps whole-unit
// corners: its net sits exactly on a square grid, with the triangles folding along diagonals.
// `cuts` are corners as [0|1, 0|1, 0|1] (1 = the far end of that axis).
export function sliced(dims, cuts) {
  let polys = [];
  for (let k = 0; k < 3; k++) for (const sign of [1, 0]) {
    const b = (k + 1) % 3, c = (k + 2) % 3;
    const points = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => { const p = [0, 0, 0]; p[k] = sign * dims[k]; p[b] = u * dims[b]; p[c] = v * dims[c]; return p; });
    polys.push({ points: sign ? points : points.reverse(), role: 'side' });
  }
  for (const corner of cuts) {
    const n = corner.map(v => (v ? 1 : -1)), d = dot(n, corner.map((v, i) => v * dims[i])) - 1;
    const onPlane = new Map(), next = [];
    for (const poly of polys) {
      const out = [];
      poly.points.forEach((p, i) => {
        const q = poly.points[(i + 1) % poly.points.length], sp = dot(n, p) - d, sq = dot(n, q) - d;
        if (sp <= TOL) { out.push(p); if (sp > -TOL) onPlane.set(key3(p), p); }
        if ((sp < -TOL && sq > TOL) || (sp > TOL && sq < -TOL)) { const x = p.map((v, j) => v + (sp / (sp - sq)) * (q[j] - v)); out.push(x); onPlane.set(key3(x), x); }
      });
      const tidy = out.filter((p, i) => key3(p) !== key3(out[(i + out.length - 1) % out.length]));
      if (tidy.length >= 3) next.push({ points: tidy, role: poly.role });
    }
    const cap = [...onPlane.values()];
    if (cap.length < 3) return null;
    const centre = cap[0].map((_, i) => cap.reduce((sum, p) => sum + p[i], 0) / cap.length);
    const u = unit(sub(cap[0], centre)), v = cross(unit(n), u);
    cap.sort((p, q) => Math.atan2(dot(sub(p, centre), v), dot(sub(p, centre), u)) - Math.atan2(dot(sub(q, centre), v), dot(sub(q, centre), u)));
    next.push({ points: cap, role: 'slice' });
    polys = next;
  }
  try { return fromLoops(polys.map(poly => poly.points), polys.map(poly => poly.role), { family: 'sliced', dims, cuts }); } catch { return null; }
}

// ---------- folding motion ----------
// The outline of every net face in 3D when the net is folded by fraction t: 0 is flat, opened
// out from the root face where the solid stands; 1 is the closed solid. Each face swings about
// the hinge it shares with its parent, carrying its children. Flat faces only.
function rotateAbout(point, origin, axis, angle) {
  const v = sub(point, origin), c = Math.cos(angle), sn = Math.sin(angle), d = dot(axis, v), x = cross(axis, v);
  return origin.map((o, i) => o + v[i] * c + x[i] * sn + axis[i] * d * (1 - c));
}
export function canAnimate(solid) { return solid.faces.every(face => face.kind === 'flat'); }
export function foldedPose(solid, net, t) {
  const hinge = new Map();
  for (const fold of net.folds) {
    const parent = solid.faces[net.faces[fold.a].id], child = solid.faces[net.faces[fold.b].id];
    const [from, to] = parent.edges[fold.ea].ends3;
    const axis = unit(sub(to, from));
    // The turn that lays the child flat beside its parent brings its normal onto the parent's.
    const open = Math.atan2(dot(cross(child.normal, parent.normal), axis), dot(child.normal, parent.normal));
    hinge.set(fold.b, { parent: fold.a, origin: from, axis, open });
  }
  return net.faces.map((face, i) => {
    const chain = [];
    for (let at = i; hinge.has(at); at = hinge.get(at).parent) chain.push(hinge.get(at));
    // `place` carries any point of this face (a corner, or a mark drawn on it) to where the fold has taken it.
    const place = p => chain.reduce((q, h) => rotateAbout(q, h.origin, h.axis, (1 - t) * h.open), p);
    return { id: face.id, points: solid.faces[face.id].draw[0].points.map(place), place };
  });
}

// ---------- profiles ----------
const straight = points => ({ points, arcs: points.map(() => null) });
function withArcEnd(a, h, rest) {
  // A block whose right end is a half-round of diameter h, then `rest` back to the start.
  const arc = Array.from({ length: 9 }, (_, i) => { const t = -Math.PI / 2 + (Math.PI * i) / 8; return [a + (h / 2) * Math.cos(t), h / 2 + (h / 2) * Math.sin(t)]; });
  const points = [[0, 0], ...arc, ...rest];
  return { points, arcs: points.map((_, i) => (i >= 1 && i <= 8 ? 1 : null)) };
}
export const profiles = Object.freeze({
  box: (a, b) => straight([[0, 0], [a, 0], [a, b], [0, b]]),
  wedge: () => straight([[0, 0], [4, 0], [0, 3]]),
  trapezium: () => straight([[0, 0], [4, 0], [3, 2], [0, 2]]),
  ell: () => straight([[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]]),
  tee: () => straight([[0, 0], [3, 0], [3, 1], [2, 1], [2, 3], [1, 3], [1, 1], [0, 1]]),
  channel: () => straight([[0, 0], [3, 0], [3, 2], [2, 2], [2, 1], [1, 1], [1, 2], [0, 2]]),
  stairs: () => straight([[0, 0], [3, 0], [3, 1], [2, 1], [2, 2], [1, 2], [1, 3], [0, 3]]),
  ramp: () => straight([[0, 0], [5, 0], [5, 1], [4, 1], [2, 3], [1, 3], [1, 2], [0, 2]]),
  neck: () => straight([[0, 0], [2, 0], [3, 1], [5, 1], [5, 3], [3, 3], [2, 2], [0, 2]]),
  bow: () => straight([[0, 1], [1, 0], [2, 0], [3, 1], [4, 0], [5, 0], [6, 1], [6, 2], [5, 3], [4, 3], [3, 2], [2, 3], [1, 3], [0, 2]]),
  roundEnd: () => withArcEnd(4, 2, [[2, 2], [2, 3], [0, 3]]),
  roundStep: () => withArcEnd(5, 2, [[3, 2], [2, 3], [1, 3], [1, 2], [0, 2]]),
});
const polygonSides = n => straight(Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n - Math.PI / 2 - Math.PI / n; return [2 * Math.cos(a), 2 * Math.sin(a)]; }));
// Stretch everything beyond a line by one unit: a different solid that looks almost the same.
function stretched(profile, axis, cut) {
  return { points: profile.points.map(p => p.map((v, i) => (i === axis && v > cut ? v + 1 : v))), arcs: profile.arcs };
}

// ---------- nets ----------
// A net: { faces: [{ id, corners, outline, shape }], folds: [{ a, ea, b, eb }] } with a, b indices into net.faces.
function placeChild(parentEdge, face, edgeIndex) {
  // Rigid move (never a reflection) that lays `face` flat against the parent's edge, on its far side.
  const [Pa, Pb] = parentEdge;
  const line = face.edges[edgeIndex].line2, c0 = line[0], c1 = line[line.length - 1];
  const angle = Math.atan2(Pa[1] - Pb[1], Pa[0] - Pb[0]) - Math.atan2(c1[1] - c0[1], c1[0] - c0[0]);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return p => [Pb[0] + (p[0] - c0[0]) * cos - (p[1] - c0[1]) * sin, Pb[1] + (p[0] - c0[0]) * sin + (p[1] - c0[1]) * cos];
}
function placed(face, id, move) {
  const lines = face.edges.map(edge => edge.line2.map(move));
  return { id, lines, corners: lines.map(l => l[0]), outline: lines.flatMap(l => l.slice(0, -1)), shape: face.shape, kind: face.kind, role: face.role };
}
const edgeEnds = (netFace, e) => [netFace.lines[e][0], netFace.lines[e][netFace.lines[e].length - 1]];

function segmentsCross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const s1 = o(a, b, c), s2 = o(a, b, d), s3 = o(c, d, a), s4 = o(c, d, b);
  return s1 * s2 < -TOL && s3 * s4 < -TOL;
}
function inside(point, outline) {
  let hit = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i], b = outline[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
// Points just inside an outline, one beside each edge.
function probes(outline) {
  return outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length], l = dist2(a, b) || 1;
    return [(a[0] + b[0]) / 2 - ((b[1] - a[1]) / l) * 0.05, (a[1] + b[1]) / 2 + ((b[0] - a[0]) / l) * 0.05];
  });
}
export function netOverlaps(net) {
  for (let i = 0; i < net.faces.length; i++) for (let j = i + 1; j < net.faces.length; j++) {
    const A = net.faces[i].outline, B = net.faces[j].outline;
    for (let a = 0; a < A.length; a++) for (let b = 0; b < B.length; b++) if (segmentsCross(A[a], A[(a + 1) % A.length], B[b], B[(b + 1) % B.length])) return true;
    if (probes(A).some(p => inside(p, B)) || probes(B).some(p => inside(p, A))) return true;
  }
  return false;
}

// Lay out a spanning tree of the solid's faces. `tree` is a list of [parentFace, childFace] in an order where the parent is already placed.
export function unfoldTree(solid, root, tree) {
  const index = new Map([[root, 0]]);
  const faces = [placed(solid.faces[root], root, p => p)];
  const folds = [];
  for (const [parent, child] of tree) {
    const ea = solid.neighbours[parent].findIndex((n, e) => n.face === child && !solid.faces[parent].edges[e].arc);
    if (ea < 0 || !index.has(parent) || index.has(child)) return null;
    const eb = solid.neighbours[parent][ea].edge;
    const a = index.get(parent);
    faces.push(placed(solid.faces[child], child, placeChild(edgeEnds(faces[a], ea), solid.faces[child], eb)));
    index.set(child, faces.length - 1);
    folds.push({ a, ea, b: faces.length - 1, eb });
  }
  const net = { faces, folds };
  return faces.length === solid.faces.length && !netOverlaps(net) ? net : null;
}

// A belt net for an extrusion: the side faces in one strip, each cap on a straight segment.
function beltTree(solid, rng) {
  const m = solid.sides.length, start = Math.floor(rng() * m);
  const order = Array.from({ length: m }, (_, i) => solid.sides[(start + i) % m]);
  const tree = order.slice(1).map((face, i) => [order[i], face]);
  const flat = solid.sides.filter(f => solid.faces[f].kind === 'flat');
  for (const cap of solid.caps) tree.push([pick(rng, flat), cap]);
  return { root: order[0], tree };
}
function randomTree(solid, rng) {
  const root = Math.floor(rng() * solid.faces.length);
  const seen = new Set([root]), tree = [];
  let frontier = [root];
  while (seen.size < solid.faces.length && frontier.length) {
    const parent = pick(rng, frontier);
    const options = solid.neighbours[parent].filter((n, e) => !seen.has(n.face) && !solid.faces[parent].edges[e].arc);
    if (!options.length) { frontier = frontier.filter(f => f !== parent); continue; }
    const child = pick(rng, options).face;
    seen.add(child); tree.push([parent, child]); frontier.push(child);
  }
  return { root, tree };
}
const spread = net => { const pts = net.faces.flatMap(f => f.outline); const w = Math.max(...pts.map(p => p[0])) - Math.min(...pts.map(p => p[0])), h = Math.max(...pts.map(p => p[1])) - Math.min(...pts.map(p => p[1])); return Math.max(w, h) / Math.min(w, h); };
// Turn and slide a net so that one box edge of its first face lies along the x axis from the
// origin. For a sliced box every corner then lands on a whole-unit grid point, except the far
// tip of each triangle.
function onGrid(solid, net) {
  const root = solid.faces[net.faces[0].id];
  const e = root.edges.findIndex(edge => edge.ends3[0].filter((v, i) => !near(v, edge.ends3[1][i])).length === 1);
  if (e < 0) return null;
  const [from, to] = edgeEnds(net.faces[0], e), angle = -Math.atan2(to[1] - from[1], to[0] - from[0]), c = Math.cos(angle), sn = Math.sin(angle);
  const move = p => [round((p[0] - from[0]) * c - (p[1] - from[1]) * sn), round((p[0] - from[0]) * sn + (p[1] - from[1]) * c)];
  const faces = net.faces.map(face => { const lines = face.lines.map(line => line.map(move)); return { ...face, lines, corners: lines.map(l => l[0]), outline: lines.flatMap(l => l.slice(0, -1)) }; });
  return { faces, folds: net.folds, grid: true };
}
export function unfold(solid, rng) {
  if (solid.family === 'sliced') {
    // Triangles stay at the ends of the net (never in the middle of a chain), as on a grid in the exam.
    for (let attempt = 0; attempt < 800; attempt++) {
      const { root, tree } = randomTree(solid, rng);
      if (solid.faces[root].role === 'slice' || tree.some(([parent]) => solid.faces[parent].role === 'slice')) continue;
      const net = unfoldTree(solid, root, tree), flat = net && onGrid(solid, net);
      if (flat) return flat;
    }
    return null;
  }
  if (solid.family === 'joined') {
    // Exam nets of long solids are strips: of several random unfoldings keep the longest and thinnest.
    let best = null;
    for (let attempt = 0; attempt < 400 && (attempt < 60 || !best); attempt++) {
      const { root, tree } = randomTree(solid, rng);
      const net = unfoldTree(solid, root, tree);
      if (net && (!best || spread(net) > spread(best))) best = net;
    }
    return best;
  }
  for (let attempt = 0; attempt < 200; attempt++) {
    const { root, tree } = solid.family === 'extrusion' ? beltTree(solid, rng) : randomTree(solid, rng);
    const net = unfoldTree(solid, root, tree);
    if (net) return net;
  }
  return null;
}
export const netKey = net => net.folds.map(f => { const x = `${net.faces[f.a].id}.${f.ea}`, y = `${net.faces[f.b].id}.${f.eb}`; return x < y ? `${x}-${y}` : `${y}-${x}`; }).sort().join(' ');

// ---------- does this net fold into this solid? ----------
const sameEdge = (p, q) => near(p.len, q.len) && p.arc === q.arc && near(p.turn, q.turn);
// Shift s means net edge i lies on solid edge (i + s) mod n.
function fits(netShape, solidShape, s) {
  const n = netShape.length;
  if (n !== solidShape.length) return false;
  for (let i = 0; i < n; i++) if (!sameEdge(netShape[i], solidShape[(i + s) % n])) return false;
  return true;
}
export function foldsInto(net, solid) {
  if (net.faces.length !== solid.faces.length) return { ok: false, reason: 'count' };
  const children = net.faces.map(() => []);
  for (const fold of net.folds) { children[fold.a].push({ edge: fold.ea, to: fold.b, toEdge: fold.eb }); children[fold.b].push({ edge: fold.eb, to: fold.a, toEdge: fold.ea }); }
  const root = net.faces[0];
  let clash = 'shape';
  for (let g = 0; g < solid.faces.length; g++) for (let s = 0; s < root.shape.length; s++) {
    if (!fits(root.shape, solid.faces[g].shape, s)) continue;
    const where = new Map([[0, { face: g, shift: s }]]), used = new Set([g]);
    const queue = [0];
    let ok = true;
    while (queue.length && ok) {
      const f = queue.shift(), spot = where.get(f), n = net.faces[f].shape.length;
      for (const link of children[f]) {
        if (where.has(link.to)) continue;
        const across = solid.neighbours[spot.face][(link.edge + spot.shift) % n];
        const m = net.faces[link.to].shape.length;
        const shift = ((across.edge - link.toEdge) % m + m) % m;
        if (used.has(across.face)) { ok = false; clash = 'covered'; break; }
        if (solid.faces[across.face].shape.length !== m || !fits(net.faces[link.to].shape, solid.faces[across.face].shape, shift)) { ok = false; clash = 'edge'; break; }
        where.set(link.to, { face: across.face, shift }); used.add(across.face); queue.push(link.to);
      }
    }
    if (ok && where.size === net.faces.length) return { ok: true };
  }
  return { ok: false, reason: clash };
}

// ---------- wrong nets, one face away from a true one ----------
export function describeFace(face) {
  if (face.kind === 'curved') return 'the curved strip';
  // Merge edges that run straight on (a corner added only because a neighbour ends there).
  const first = face.shape.findIndex((e, i) => !near(face.shape[(i + face.shape.length - 1) % face.shape.length].turn, 0));
  const sides = [];
  for (let i = 0; i < face.shape.length; i++) {
    const edge = face.shape[(first + i) % face.shape.length], before = face.shape[(first + i + face.shape.length - 1) % face.shape.length];
    if (i > 0 && near(before.turn, 0)) sides[sides.length - 1].len = round(sides[sides.length - 1].len + edge.len), sides[sides.length - 1].turn = edge.turn;
    else sides.push({ len: edge.len, turn: edge.turn });
  }
  const n = sides.length;
  const allRight = sides.every(e => near(Math.abs(e.turn), Math.PI / 2));
  if (n === 4 && allRight) { const [a, b] = [sides[0].len, sides[1].len].sort((x, y) => x - y).map(v => (Number.isInteger(v) ? v : v.toFixed(1))); return a === b ? `the ${a} × ${a} square` : `the ${a} × ${b} rectangle`; }
  if (n === 3) return 'the triangle';
  return `the ${n}-sided face`;
}
// Detach a leaf face and re-attach it to another free edge of the same length.
function moveFlap(net, rng) {
  const degree = net.faces.map(() => 0);
  for (const f of net.folds) { degree[f.a]++; degree[f.b]++; }
  const leaves = shuffle(rng, net.faces.map((_, i) => i).filter(i => degree[i] === 1));
  const taken = new Set(net.folds.flatMap(f => [`${f.a}.${f.ea}`, `${f.b}.${f.eb}`]));
  for (const leaf of leaves) {
    const fold = net.folds.find(f => f.a === leaf || f.b === leaf);
    const leafEdge = fold.a === leaf ? fold.ea : fold.eb;
    const want = net.faces[leaf].shape[leafEdge].len;
    const targets = [];
    net.faces.forEach((face, f) => { if (f !== leaf) face.shape.forEach((edge, e) => { if (!edge.arc && near(edge.len, want) && !taken.has(`${f}.${e}`)) targets.push({ f, e }); }); });
    for (const target of shuffle(rng, targets)) {
      const source = { edges: net.faces[leaf].lines.map(line => ({ line2: line })) };
      const move = placeChild(edgeEnds(net.faces[target.f], target.e), source, leafEdge);
      const moved = { ...net.faces[leaf], lines: net.faces[leaf].lines.map(line => line.map(move)) };
      moved.corners = moved.lines.map(l => l[0]); moved.outline = moved.lines.flatMap(l => l.slice(0, -1));
      const faces = net.faces.map((face, i) => (i === leaf ? moved : face));
      const folds = net.folds.map(f => (f === fold ? { a: target.f, ea: target.e, b: leaf, eb: leafEdge } : f));
      const candidate = { ...net, faces, folds };
      if (!netOverlaps(candidate)) return { net: candidate, moved: leaf };
    }
  }
  return null;
}

// ---------- scenarios ----------
const cubeSets = {
  3: [[[0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]], [[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 0, 1]], [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 1]]],
  4: [[[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0], [0, 0, 1]], [[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 1, 0], [1, 0, 1]], [[0, 0, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0], [1, 1, 1]], [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [0, 0, 1]]],
};
function turnProfile(profile, rng) {
  // Quarter turns and an optional flip, keeping the outline anticlockwise and the arc flags on their edges.
  let { points, arcs } = profile;
  const quarter = Math.floor(rng() * 4);
  for (let i = 0; i < quarter; i++) points = points.map(([x, y]) => [-y, x]);
  if (rng() < 0.5) {
    const n = points.length;
    points = points.map(([x, y]) => [-x, y]).reverse();
    arcs = arcs.map((_, k) => arcs[(2 * n - 2 - k) % n]);
  }
  const minX = Math.min(...points.map(p => p[0])), minY = Math.min(...points.map(p => p[1]));
  return { points: points.map(([x, y]) => [x - minX, y - minY]), arcs };
}
// Boxes with two or three of the four corners in view sliced off.
const VISIBLE_CORNERS = [[1, 1, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0]];
function slicedScenario(rng) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const dims = pick(rng, [[2, 2, 2], [3, 2, 2], [2, 3, 2], [2, 2, 3], [3, 3, 2], [3, 2, 3], [2, 3, 3]]);
    // The near top corner shares an edge with each of the others: both ends of an edge can be cut only if it is 3 long.
    const allowed = set => !set.includes(0) || set.every(k => k === 0 || dims[k - 1] >= 3);
    const sets = [[1, 2], [1, 3], [2, 3], [1, 2, 3], [0, 1], [0, 2], [0, 3], [0, 1, 2], [0, 2, 3], [0, 1, 3]].filter(allowed);
    const chosen = pick(rng, sets), other = pick(rng, sets.filter(set => set !== chosen));
    const solid = sliced(dims, chosen.map(k => VISIBLE_CORNERS[k])), twin = sliced(dims, other.map(k => VISIBLE_CORNERS[k]));
    if (solid) return { solid, twin, name: 'box with corners sliced off', note: 'Every corner that is cut is in view.' };
  }
  return { solid: null };
}
export function scenario(rng, level) {
  // Returns { solid, name, twin } where twin is a near-identical different solid for one wrong option.
  if (level <= 2) {
    if (rng() < 0.35) { const n = 3 + Math.floor(rng() * 3); return { solid: pyramid(n), name: `pyramid with a ${n}-sided base`, twin: null }; }
    const n = 3 + Math.floor(rng() * 4), depth = 3;
    return { solid: extrusion(polygonSides(n), depth), name: `prism with ${n}-sided ends`, twin: extrusion(polygonSides(n), depth + 1) };
  }
  if (level === 4 && rng() < 0.25) {
    const [n, m] = pick(rng, [[6, 5], [6, 6], [5, 6], [8, 5], [5, 5], [6, 8]]);
    return { solid: joined(n, m), name: 'two joined prisms', twin: joined(n, m, 4, 1, 1) };
  }
  const usePolycube = rng() < (level === 3 ? 0.35 : 0.3);
  if (usePolycube) {
    const cells = pick(rng, cubeSets[level]);
    return { solid: polycube(cells), name: `solid built from ${cells.length} cubes`, twin: null };
  }
  const names = level === 3 ? ['box', 'wedge', 'trapezium', 'ell', 'tee', 'channel', 'stairs'] : ['ramp', 'neck', 'bow', 'roundEnd', 'roundStep', 'stairs', 'tee'];
  const name = pick(rng, names);
  const base = name === 'box' ? profiles.box(...shuffle(rng, [1, 2, 3, 4]).slice(0, 2)) : profiles[name]();
  const profile = turnProfile(base, rng);
  const depth = name === 'box' ? pick(rng, [1, 2, 3, 4].filter(d => !base.points.some(p => p[0] === d || p[1] === d))) ?? 5 : 1 + Math.floor(rng() * 3);
  const solid = extrusion(profile, depth);
  const axis = rng() < 0.5 ? 0 : 1;
  const cuts = [...new Set(profile.points.map(p => round(p[axis])))].sort((a, b) => a - b);
  const twinProfile = profile.arcs.some(a => a !== null) ? null : stretched(profile, axis, cuts[Math.floor(rng() * (cuts.length - 1))]);
  return { solid, name: 'solid', twin: rng() < 0.5 || !twinProfile ? extrusion(profile, depth + 1) : extrusion(twinProfile, depth) };
}
export function faceCounts(solid) {
  const counts = new Map();
  for (const face of solid.faces) { const d = describeFace(face).replace(/^the /, ''); counts.set(d, (counts.get(d) ?? 0) + 1); }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---------- questions ----------
function wrongNets(rng, solid, twin, trueNet, count, usedKeys) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 60) {
    const useTwin = twin && guard % 4 === 0;
    if (useTwin) {
      const net = unfold(twin, rng);
      if (!net || foldsInto(net, solid).ok) continue;
      const k = 'twin ' + netKey(net);
      if (usedKeys.has(k)) continue;
      usedKeys.add(k);
      out.push({ net, type: 'stretched', reason: solid.family === 'sliced' ? 'This is the net of a box with different corners cut. Check which faces have lost a corner, and how many corners each has lost.' : 'One part is a different length from the solid. Check the edge lengths of the strip against the solid before anything else.' });
      continue;
    }
    const base = guard % 3 === 0 ? unfold(solid, rng) : trueNet;
    const result = base && moveFlap(base, rng);
    if (!result) continue;
    const test = foldsInto(result.net, solid);
    if (test.ok) continue;
    const k = 'flap ' + netKey(result.net);
    if (usedKeys.has(k)) continue;
    usedKeys.add(k);
    const what = describeFace(result.net.faces[result.moved]);
    const cap = what.charAt(0).toUpperCase() + what.slice(1);
    out.push({ net: result.net, type: 'flap-moved', reason: test.reason === 'covered'
      ? `${cap} is joined in the wrong place: folded, it lands on a face that is already covered, and leaves another open.`
      : `${cap} is joined to an edge it does not share on the solid. The lengths match, but the face on the other side of that edge is a different one.` });
  }
  return out;
}

export function netQuestion(seed, level, kind = 'net-of-solid') {
  const rng = seededRandom(seed);
  let pack = null, trueNet = null;
  for (let attempt = 0; attempt < 30 && !trueNet; attempt++) { pack = kind === 'grid-net' ? slicedScenario(rng) : scenario(rng, level); if (pack.solid) trueNet = unfold(pack.solid, rng); }
  const { solid, twin } = pack;
  const roll = rng();
  const mode = level >= 3 && roll < 0.3 ? 'multi' : level >= 3 && roll < 0.45 ? 'cannot' : 'can';
  const wantTrue = mode === 'multi' ? 2 : mode === 'cannot' ? 3 : 1;
  const used = new Set([netKey(trueNet)]);
  const good = [trueNet];
  let guard = 0;
  while (good.length < wantTrue && guard++ < 40) { const net = unfold(solid, rng); if (net && !used.has(netKey(net))) { used.add(netKey(net)); good.push(net); } }
  const bad = wrongNets(rng, solid, twin, trueNet, 4 - good.length, used);
  if (good.length + bad.length < 4) return netQuestion(seed + 7919, level, kind);
  const options = shuffle(rng, [
    ...good.map(net => ({ net, correct: mode !== 'cannot', reason: mode === 'cannot' ? 'This one does fold into the solid: every face joins the face it shares an edge with.' : 'Every face is here, each joined along an edge it really shares on the solid.' })),
    ...bad.map(b => ({ net: b.net, correct: mode === 'cannot', reason: b.reason, type: b.type })),
  ]).map((o, i) => ({ ...o, id: 'ABCD'[i], label: 'ABCD'[i] }));
  const right = options.filter(o => o.correct).map(o => o.id);
  const counts = faceCounts(solid);
  const belt = solid.family === 'extrusion' ? solid.sides.map(f => { const face = solid.faces[f]; const l = face.shape[1].len; return Number.isInteger(l) ? String(l) : l.toFixed(1); }) : null;
  return {
    kind, seed, answerMode: mode === 'multi' ? 'multi' : 'single', solid,
    prompt: (mode === 'multi' ? 'Which of these nets can be folded to make the solid shown?' : mode === 'cannot' ? 'Which of these nets CANNOT be folded to make the solid shown?' : 'Which net can be folded to make the solid shown?') + (pack.note ? ` ${pack.note}` : ''),
    options, answer: mode === 'multi' ? right : right[0],
    explanation: mode === 'cannot'
      ? options.find(o => o.correct).reason
      : `The solid has ${plural(solid.faces.length, 'face')}: ${counts.map(([d, n]) => `${d} (×${n})`).join(', ')}. A true net has exactly these, each joined along an edge it shares on the solid.`,
    hints: [`Count the faces first: the solid has ${solid.faces.length}.`, belt ? 'Find the strip of side faces. Its segment lengths must follow the outline of the end face in order.' : 'Pick the largest face on the solid and find it in each net. Then check its neighbours one by one.'],
    solution: [
      { text: `Count and sort. The solid has ${plural(solid.faces.length, 'face')}: ${counts.map(([d, n]) => `${d} (×${n})`).join(', ')}.` },
      belt ? { text: `Find the belt. The side faces wrap round the solid and unroll into one strip with segments ${belt.join(', ')} long, in that order.` } : { text: 'Start from the largest face. Each of its edges meets one particular neighbour on the solid.' },
      { text: belt ? 'Place the two end faces. Each must join the strip along the segment that matches one of its own sides, one on each side of the strip.' : 'Walk outward from that face. Where two edges meet when folded, their lengths must be equal.' },
      ...options.filter(o => !o.correct === (mode !== 'cannot')).map(o => ({ text: `Option ${o.label}: ${o.reason}` })),
      { text: `So the answer is ${right.join(' and ')}.` },
    ],
  };
}

export function inventoryQuestion(seed) {
  const rng = seededRandom(seed);
  let pack = null;
  do { pack = scenario(rng, rng() < 0.5 ? 2 : 3); } while (!pack.solid);
  const { solid } = pack, n = solid.faces.length;
  const visible = solid.faces.filter(f => dot(f.normal, [1, 1, 1]) > TOL).length;
  const counts = faceCounts(solid);
  return {
    kind: 'face-inventory', seed, answerMode: 'numeric', unit: 'faces', solid,
    prompt: 'How many faces does this solid have? Count the ones you cannot see as well.',
    answer: { value: n },
    mistakes: [{ value: visible, reason: 'That counts only the faces in view. The solid has faces underneath and behind too.' }, { value: n - 2, reason: 'Remember the two end faces.' }, { value: n - 1, reason: 'One face is missing: check underneath.' }].filter((m, i, all) => m.value !== n && m.value > 0 && all.findIndex(o => o.value === m.value) === i),
    explanation: `Sorted by shape: ${counts.map(([d, c]) => `${d} (×${c})`).join(', ')}. That makes ${n}.`,
    hints: ['Sort the faces by shape and count each kind.'],
    solution: [...counts.map(([d, c]) => ({ text: `${d}: ${c}.` })), { text: `${counts.map(([, c]) => c).join(' + ')} = ${n} faces.` }],
  };
}

export function beltQuestion(seed) {
  const rng = seededRandom(seed);
  const name = pick(rng, ['ell', 'tee', 'channel', 'stairs', 'box']);
  const profile = turnProfile(name === 'box' ? profiles.box(2 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 2)) : profiles[name](), rng);
  const solid = extrusion(profile, 1 + Math.floor(rng() * 3));
  const segments = solid.sides.map(f => solid.faces[f].shape[1].len);
  const total = segments.reduce((a, b) => a + b, 0);
  return {
    kind: 'belt-length', seed, answerMode: 'numeric', unit: 'units', solid,
    prompt: 'The side faces of this solid unroll into one long strip. Each small step on the solid is 1 unit. How many units long is the strip?',
    answer: { value: total },
    mistakes: [{ value: segments.length, reason: 'That is the number of segments. Add up their lengths.' }, { value: total + 2 * solid.depth, reason: 'The depth of the solid is the width of the strip, not part of its length.' }].filter(m => m.value !== total),
    explanation: `The strip is as long as the outline of the end face: ${segments.join(' + ')} = ${total} units.`,
    hints: ['The strip wraps once round the end face. Walk round its outline.'],
    solution: [{ text: 'The side faces follow the outline of the end face, one segment per side.' }, { text: `Walking round the outline: ${segments.join(', ')}.` }, { text: `${segments.join(' + ')} = ${total} units.` }],
  };
}
