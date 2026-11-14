// Counting figures: how many triangles, squares, rectangles or
// parallelograms a drawing of straight lines contains.
// Specification: docs/learn/topics/counting-figures.md.
//
// Conventions. A figure is a list of segments [[x1, y1], [x2, y2]] in
// SCREEN coordinates: x to the right, y DOWN. One unit is one grid cell.
//
// Two counters that share nothing but the merged segments:
//   - by points: every pair of points on one drawn line is "joined"; a
//     triangle is three joined points not in a line, a parallelogram is
//     four joined points a, b, c = b + d - a, d.
//   - by lines: a triangle is three drawn lines that cross each other at
//     three different points; a parallelogram is two pairs of parallel
//     lines whose four crossings all lie on the drawn parts.
// The tests check that both agree on every figure, and against formulas
// where a family has one.
//
// Points come from cos and sin for the regular polygons, so arithmetic is
// floating point with a tolerance. Every coordinate in a figure is at most
// about 12, so a tolerance of 1e-6 separates distinct points by many orders
// of magnitude.

const EPS = 1e-7, SNAP = 1e-6;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const near = (a, b) => Math.abs(a[0] - b[0]) < SNAP && Math.abs(a[1] - b[1]) < SNAP;

// ---------- merged segments ----------
// Overlapping or touching pieces of one straight line become one segment, so a side drawn in two
// strokes still counts as one side.
export function mergeCollinear(segments) {
  const lines = [];
  for (const [p, q] of segments) {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L < EPS) continue;
    let d = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
    if (d[0] < -EPS || (Math.abs(d[0]) < EPS && d[1] < 0)) d = [-d[0], -d[1]];
    const c = cross(d, p);
    let line = lines.find(l => Math.abs(cross(l.d, d)) < EPS && Math.abs(l.c - c) < SNAP);
    if (!line) { line = { d, c, spans: [] }; lines.push(line); }
    const t1 = dot(p, line.d), t2 = dot(q, line.d);
    line.spans.push([Math.min(t1, t2), Math.max(t1, t2)]);
  }
  const out = [];
  for (const line of lines) {
    const normal = [-line.d[1], line.d[0]], base = scale(normal, line.c);
    const make = ([t1, t2]) => ({ a: add(base, scale(line.d, t1)), b: add(base, scale(line.d, t2)), d: line.d, length: t2 - t1 });
    line.spans.sort((x, y) => x[0] - y[0]);
    let current = null;
    for (const span of line.spans) {
      if (current && span[0] <= current[1] + SNAP) current[1] = Math.max(current[1], span[1]);
      else { if (current) out.push(make(current)); current = [...span]; }
    }
    if (current) out.push(make(current));
  }
  return out;
}
// Where two merged segments cross, if they do (touching at an end counts).
export function crossing(s, r) {
  const denom = cross(s.d, r.d);
  if (Math.abs(denom) < EPS) return null;
  const w = sub(r.a, s.a), u = cross(w, r.d) / denom, v = cross(w, s.d) / denom;
  if (u < -SNAP || u > s.length + SNAP || v < -SNAP || v > r.length + SNAP) return null;
  return add(s.a, scale(s.d, u));
}
const onSegment = (p, s) => { const w = sub(p, s.a), t = dot(w, s.d); return Math.abs(cross(s.d, w)) < SNAP && t > -SNAP && t < s.length + SNAP; };

// ---------- the point structure ----------
export function analyse(segments) {
  const segs = mergeCollinear(segments), pts = [];
  const find = p => pts.findIndex(q => near(p, q));
  const put = p => { const i = find(p); if (i >= 0) return i; pts.push(p); return pts.length - 1; };
  segs.forEach(s => { put(s.a); put(s.b); });
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) { const p = crossing(segs[i], segs[j]); if (p) put(p); }
  const n = pts.length, joined = new Uint8Array(n * n), neighbours = pts.map(() => []);
  for (const s of segs) {
    const on = pts.map((p, i) => i).filter(i => onSegment(pts[i], s));
    for (const a of on) for (const b of on) if (a !== b && !joined[a * n + b]) { joined[a * n + b] = 1; neighbours[a].push(b); }
  }
  return { segs, pts, find, linked: (a, b) => joined[a * n + b] === 1, neighbours };
}
const areaOf = points => Math.abs(points.reduce((sum, p, i) => sum + cross(p, points[(i + 1) % points.length]), 0)) / 2;

// ---------- counting by points ----------
// Each shape is { points: [[x, y]…] in order round the shape, area }.
export function triangles(segments, { right = false } = {}) {
  const { pts, linked, neighbours } = analyse(segments), out = [];
  for (let a = 0; a < pts.length; a++) for (const b of neighbours[a]) {
    if (b <= a) continue;
    for (const c of neighbours[b]) {
      if (c <= b || !linked(a, c)) continue;
      const P = [pts[a], pts[b], pts[c]], area = areaOf(P);
      if (area < SNAP) continue;
      if (right && !P.some((p, i) => { const u = sub(P[(i + 1) % 3], p), v = sub(P[(i + 2) % 3], p); return Math.abs(dot(u, v)) < 1e-6 * Math.hypot(...u) * Math.hypot(...v); })) continue;
      out.push({ points: P, area });
    }
  }
  return out;
}
// kind: 'parallelogram' | 'rectangle' | 'square'
export function quadrilaterals(segments, kind = 'rectangle') {
  const { pts, find, linked, neighbours } = analyse(segments), seen = new Set(), out = [];
  for (let a = 0; a < pts.length; a++) {
    const list = neighbours[a];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const b = list[i], d = list[j], u = sub(pts[b], pts[a]), v = sub(pts[d], pts[a]);
      const lu = Math.hypot(...u), lv = Math.hypot(...v);
      if (Math.abs(cross(u, v)) < 1e-6 * lu * lv) continue;
      if (kind !== 'parallelogram' && Math.abs(dot(u, v)) > 1e-6 * lu * lv) continue;
      if (kind === 'square' && Math.abs(lu - lv) > SNAP) continue;
      const c = find(add(pts[b], v));
      if (c < 0 || !linked(b, c) || !linked(d, c)) continue;
      const key = [a, b, c, d].sort((x, y) => x - y).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      const P = [pts[a], pts[b], pts[c], pts[d]];
      out.push({ points: P, area: areaOf(P) });
    }
  }
  return out;
}
export function shapesOf(segments, shape) {
  if (shape === 'triangle') return triangles(segments);
  if (shape === 'right-triangle') return triangles(segments, { right: true });
  return quadrilaterals(segments, shape);
}
export const countOf = (segments, shape) => shapesOf(segments, shape).length;

// ---------- counting by lines ----------
export function countByLines(segments, shape) {
  const segs = mergeCollinear(segments), n = segs.length;
  const at = Array.from({ length: n }, () => Array(n).fill(null));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) at[i][j] = at[j][i] = crossing(segs[i], segs[j]);
  let count = 0;
  if (shape === 'triangle' || shape === 'right-triangle') {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (!at[i][j]) continue;
      for (let k = j + 1; k < n; k++) {
        const p = at[i][j], q = at[i][k], r = at[j][k];
        if (!q || !r || near(p, q) || near(p, r) || near(q, r)) continue;
        if (shape === 'right-triangle' && ![[i, j], [i, k], [j, k]].some(([x, y]) => Math.abs(dot(segs[x].d, segs[y].d)) < 1e-6)) continue;
        count++;
      }
    }
    return count;
  }
  const parallel = (x, y) => Math.abs(cross(segs[x].d, segs[y].d)) < EPS;
  const pairs = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (parallel(i, j)) pairs.push([i, j]);
  for (let x = 0; x < pairs.length; x++) for (let y = x + 1; y < pairs.length; y++) {
    const [i, j] = pairs[x], [k, l] = pairs[y];
    if (parallel(i, k)) continue;
    const corners = [at[i][k], at[i][l], at[j][l], at[j][k]];
    if (corners.some(c => !c)) continue;
    if (shape !== 'parallelogram' && Math.abs(dot(segs[i].d, segs[k].d)) > 1e-6) continue;
    if (shape === 'square' && Math.abs(Math.hypot(...sub(corners[0], corners[1])) - Math.hypot(...sub(corners[0], corners[3]))) > SNAP) continue;
    count++;
  }
  return count;
}

// ---------- tally by size ----------
// Groups of shapes of equal area, smallest first. `times` is the area in smallest shapes when that is a whole number.
export function bySize(shapes) {
  const groups = [];
  for (const s of [...shapes].sort((a, b) => a.area - b.area)) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.area - s.area) < 1e-4) last.shapes.push(s);
    else groups.push({ area: s.area, shapes: [s] });
  }
  const unit = groups[0]?.area ?? 1;
  return groups.map(g => { const k = g.area / unit; return { area: g.area, count: g.shapes.length, shapes: g.shapes, times: Math.abs(k - Math.round(k)) < 1e-4 ? Math.round(k) : null }; });
}

// ---------- families ----------
// Each returns a list of segments. Sizes are chosen so every figure fits in about 8 × 8 units.
const seg = (a, b) => [a, b];
export function grid(m, n) {
  const out = [];
  for (let i = 0; i <= m; i++) out.push(seg([i, 0], [i, n]));
  for (let j = 0; j <= n; j++) out.push(seg([0, j], [m, j]));
  return out;
}
// A grid with diagonals in some cells: `cells` lists [i, j, 'down' | 'up' | 'both'].
export function gridWithDiagonals(m, n, cells) {
  const out = grid(m, n);
  for (const [i, j, which] of cells) {
    if (which !== 'up') out.push(seg([i, j], [i + 1, j + 1]));
    if (which !== 'down') out.push(seg([i, j + 1], [i + 1, j]));
  }
  return out;
}
// A triangle with k lines from the top corner to the base, and b bars parallel to the base.
const FAN = { apex: [3, 0], left: [0, 5], right: [6, 5] };
export function fan(k, b = 0) {
  const { apex, left, right } = FAN, out = [seg(apex, left), seg(apex, right), seg(left, right)];
  for (let i = 1; i <= k; i++) out.push(seg(apex, [left[0] + ((right[0] - left[0]) * i) / (k + 1), left[1]]));
  for (let j = 1; j <= b; j++) { const t = j / (b + 1); out.push(seg(add(apex, scale(sub(left, apex), t)), add(apex, scale(sub(right, apex), t)))); }
  return out;
}
// A square with its diagonals (level 1), midlines (2), and the square joining the midpoints (3).
export function squareStar(level, size = 4) {
  const s = size, h = s / 2, out = [seg([0, 0], [s, 0]), seg([s, 0], [s, s]), seg([s, s], [0, s]), seg([0, s], [0, 0])];
  if (level >= 1) out.push(seg([0, 0], [s, s]), seg([s, 0], [0, s]));
  if (level >= 2) out.push(seg([h, 0], [h, s]), seg([0, h], [s, h]));
  if (level >= 3) out.push(seg([h, 0], [s, h]), seg([s, h], [h, s]), seg([h, s], [0, h]), seg([0, h], [h, 0]));
  return out;
}
// A square split into parts that can be combined: pieces is a subset of the names below.
export const squarePieces = {
  border: s => [seg([0, 0], [s, 0]), seg([s, 0], [s, s]), seg([s, s], [0, s]), seg([0, s], [0, 0])],
  falling: s => [seg([0, 0], [s, s])], rising: s => [seg([s, 0], [0, s])],
  upright: s => [seg([s / 2, 0], [s / 2, s])], level: s => [seg([0, s / 2], [s, s / 2])],
  diamond: s => [seg([s / 2, 0], [s, s / 2]), seg([s, s / 2], [s / 2, s]), seg([s / 2, s], [0, s / 2]), seg([0, s / 2], [s / 2, 0])],
  inner: s => [seg([s / 4, s / 4], [(3 * s) / 4, s / 4]), seg([(3 * s) / 4, s / 4], [(3 * s) / 4, (3 * s) / 4]), seg([(3 * s) / 4, (3 * s) / 4], [s / 4, (3 * s) / 4]), seg([s / 4, (3 * s) / 4], [s / 4, s / 4])],
};
export const squareFrom = (names, s = 4) => ['border', ...names].flatMap(name => squarePieces[name](s));
// An equilateral triangle cut into n rows of small triangles.
const H = Math.sqrt(3) / 2;
export function triangleGrid(n, size = 6) {
  const u = size / n, P = (i, j) => [((n - i) / 2 + j) * u, i * H * u], out = [];
  for (let i = 1; i <= n; i++) out.push(seg(P(i, 0), P(i, i)));
  for (let j = 0; j < n; j++) out.push(seg(P(j, j), P(n, j)));
  for (let r = 0; r < n; r++) out.push(seg(P(r, 0), P(n, n - r)));
  return out;
}
// A regular polygon with some of its diagonals. `steps` lists the diagonal lengths to draw (2 = skip one corner).
export function polygon(sides, { edges = true, steps = [], spokes = false, radius = 3.5 } = {}) {
  const V = Array.from({ length: sides }, (_, k) => { const a = -Math.PI / 2 + (2 * Math.PI * k) / sides; return [radius + radius * Math.cos(a), radius + radius * Math.sin(a)]; });
  const out = [];
  if (edges) V.forEach((p, k) => out.push(seg(p, V[(k + 1) % sides])));
  for (const step of steps) for (let k = 0; k < sides; k++) { if (step * 2 === sides && k >= sides / 2) continue; out.push(seg(V[k], V[(k + step) % sides])); }
  if (spokes) V.forEach(p => out.push(seg([radius, radius], p)));
  return out;
}
// A rhombus with both diagonals and lines from the side corners to the far sides.
export function rhombus(extra) {
  const T = [3, 0], R = [6, 4], B = [3, 8], L = [0, 4], mid = (p, q, t = 0.5) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const out = [seg(T, R), seg(R, B), seg(B, L), seg(L, T), seg(T, B), seg(L, R)];
  if (extra.includes('left')) out.push(seg(L, mid(T, R)), seg(L, mid(B, R)));
  if (extra.includes('right')) out.push(seg(R, mid(T, L)), seg(R, mid(B, L)));
  if (extra.includes('top')) out.push(seg(T, mid(L, B)), seg(T, mid(R, B)));
  return out;
}
// A rectangle cut by a few straight cuts that stop at earlier cuts (uneven panels, like brickwork).
export function panels(rng, w, h, cuts) {
  const out = [seg([0, 0], [w, 0]), seg([w, 0], [w, h]), seg([w, h], [0, h]), seg([0, h], [0, 0])];
  let boxes = [[0, 0, w, h]];
  for (let c = 0; c < cuts; c++) {
    const options = boxes.map((box, i) => ({ box, i })).filter(({ box }) => box[2] - box[0] >= 2 || box[3] - box[1] >= 2);
    if (!options.length) break;
    const { box, i } = options[Math.floor(rng() * options.length)];
    const [x0, y0, x1, y1] = box, canX = x1 - x0 >= 2, canY = y1 - y0 >= 2;
    const vertical = canX && (!canY || rng() < 0.5);
    if (vertical) { const x = x0 + 1 + Math.floor(rng() * (x1 - x0 - 1)); out.push(seg([x, y0], [x, y1])); boxes.splice(i, 1, [x0, y0, x, y1], [x, y0, x1, y1]); }
    else { const y = y0 + 1 + Math.floor(rng() * (y1 - y0 - 1)); out.push(seg([x0, y], [x1, y])); boxes.splice(i, 1, [x0, y0, x1, y], [x0, y, x1, y1]); }
  }
  return out;
}
export const shear = (segments, k) => segments.map(s => s.map(([x, y]) => [x + k * y, y]));
export const reflect = (segments, axis, at) => segments.map(s => s.map(([x, y]) => (axis === 'x' ? [2 * at - x, y] : [x, 2 * at - y])));
export function bounds(segments) {
  const xs = segments.flatMap(s => [s[0][0], s[1][0]]), ys = segments.flatMap(s => [s[0][1], s[1][1]]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
// Sides of the bounding box that are drawn along their whole length: a figure can be mirrored onto them.
export function fullSides(segments) {
  const b = bounds(segments), merged = mergeCollinear(segments), out = [];
  const covers = (p, q) => merged.some(s => onSegment(p, s) && onSegment(q, s));
  if (covers([b.maxX, b.minY], [b.maxX, b.maxY])) out.push({ axis: 'x', at: b.maxX, name: 'right' });
  if (covers([b.minX, b.maxY], [b.maxX, b.maxY])) out.push({ axis: 'y', at: b.maxY, name: 'bottom' });
  if (covers([b.minX, b.minY], [b.minX, b.maxY])) out.push({ axis: 'x', at: b.minX, name: 'left' });
  return out;
}
