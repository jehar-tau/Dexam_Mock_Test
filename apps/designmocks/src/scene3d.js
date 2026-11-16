// Geometry for the turning 3D topic animations (Motion3D.jsx): simple solids,
// a perspective projection with lighting and back-face removal, and the five
// models. Plain JavaScript, so it is tested without a browser.
const T = {
  ink: "var(--m-ink)", paper: "var(--m-paper)", tint: "var(--m-tint)", mid: "var(--m-mid)",
  lime: "var(--m-lime)", yellow: "var(--m-yellow)", orange: "var(--m-orange)", sage: "var(--m-cube-right)",
};

// ---------- building blocks ----------
// A face is { p: [[x,y,z]...], n: outward normal, tone, smooth }.
export function box(x, y, z, w, h, d, tone, extra = {}) {
  const [a, b, c, e, f, g] = [x - w / 2, x + w / 2, y, y + h, z - d / 2, z + d / 2];
  const face = (p, n) => ({ p, n, tone, ...extra });
  return [
    face([[a, e, f], [b, e, f], [b, e, g], [a, e, g]], [0, 1, 0]),
    face([[a, c, f], [a, c, g], [b, c, g], [b, c, f]], [0, -1, 0]),
    face([[a, c, f], [b, c, f], [b, e, f], [a, e, f]], [0, 0, -1]),
    face([[a, c, g], [a, e, g], [b, e, g], [b, c, g]], [0, 0, 1]),
    face([[a, c, f], [a, e, f], [a, e, g], [a, c, g]], [-1, 0, 0]),
    face([[b, c, f], [b, c, g], [b, e, g], [b, e, f]], [1, 0, 0]),
  ];
}
// Spin a profile of [radius, height] points round the vertical axis.
// tone may be a function of (ring, segment) for painted bands and ribs.
export function lathe(profile, { x = 0, y = 0, z = 0, segments = 18, tone, smooth = true }) {
  const faces = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i], [r1, y1] = profile[i + 1];
    let nr = y1 - y0, ny = -(r1 - r0);
    const len = Math.hypot(nr, ny) || 1; nr /= len; ny /= len;
    for (let s = 0; s < segments; s++) {
      const t0 = (s / segments) * Math.PI * 2, t1 = ((s + 1) / segments) * Math.PI * 2, tm = (t0 + t1) / 2;
      const at = (r, h, t) => [x + r * Math.cos(t), y + h, z + r * Math.sin(t)];
      const p = [at(r0, y0, t0), at(r1, y1, t0), at(r1, y1, t1), at(r0, y0, t1)];
      faces.push({ p, n: [nr * Math.cos(tm), ny, nr * Math.sin(tm)], tone: typeof tone === "function" ? tone(i, s) : tone, smooth });
    }
  }
  return faces;
}
// Turn a set of faces about the z axis by a (radians), round a point.
export function turnZ(faces, a, [cx, cy] = [0, 0]) {
  const c = Math.cos(a), s = Math.sin(a);
  const r = ([x, y, z]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c, z];
  const rn = ([x, y, z]) => [x * c - y * s, x * s + y * c, z];
  return faces.map(f => ({ ...f, p: f.p.map(r), n: rn(f.n) }));
}

// ---------- the renderer ----------
const LIGHT = (() => { const v = [-0.5, 0.75, -0.45], l = Math.hypot(...v); return v.map(k => k / l); })();
const shadeCache = new Map();
function shaded(tone, light) {
  const step = Math.round(light * 20) / 20, key = tone + step;
  let out = shadeCache.get(key);
  if (!out) {
    out = step < 1 ? `color-mix(in srgb, ${tone}, #10201a ${Math.round((1 - step) * 100)}%)` : `color-mix(in srgb, ${tone}, #ffffff ${Math.round((step - 1) * 100)}%)`;
    shadeCache.set(key, out);
  }
  return out;
}

export function project(scene, t) {
  const { yaw, pitch, dist = 9, focal = 560, cx = 160, cy = 132 } = scene.view(t);
  const ca = Math.cos(yaw), sa = Math.sin(yaw), cb = Math.cos(pitch), sb = Math.sin(pitch);
  const rot = ([x, y, z]) => { const x1 = x * ca + z * sa, z1 = -x * sa + z * ca; return [x1, y * cb - z1 * sb, y * sb + z1 * cb]; };
  const cam = ([x, y, z]) => [cx + (focal * x) / (z + dist), cy - (focal * y) / (z + dist)];
  const faces = [];
  for (const f of scene.faces) {
    const q = f.p.map(rot), n = rot(f.n);
    const c = q.reduce((m, v) => [m[0] + v[0], m[1] + v[1], m[2] + v[2]], [0, 0, 0]).map(k => k / q.length);
    if (n[0] * c[0] + n[1] * c[1] + n[2] * (c[2] + dist) >= 0) continue;
    const light = 0.62 + 0.5 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    const fill = shaded(f.tone, light);
    faces.push({ depth: c[2], d: "M" + q.map(v => cam(v).map(k => k.toFixed(1)).join(" ")).join("L") + "Z", fill, stroke: f.smooth ? fill : "var(--m-ink)", width: f.smooth ? 0.7 : 1.1, opacity: f.opacity ?? 1 });
  }
  faces.sort((a, b) => b.depth - a.depth);
  const line = l => { const [a, b] = [cam(rot(l.a)), cam(rot(l.b))]; return { d: `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`, stroke: l.tone, width: l.width ?? 1.4, opacity: l.opacity ?? 1, dash: l.dash ?? "" }; };
  return { faces, under: (scene.under ?? []).map(line), over: (scene.over ?? []).map(line) };
}

// ---------- the five models ----------
const turntable = (speed = 0.45, pitch = -0.42, extra = {}) => t => ({ yaw: 0.6 + t * speed, pitch, ...extra });
const sway = (amount, speed, pitch, extra = {}) => t => ({ yaw: 0.5 + Math.sin(t * speed) * amount, pitch, ...extra });

// Product design: a chair, legs splayed for stability, turning on a stand.
export function chairScene() {
  const faces = [
    ...box(0, 1.7, 0, 3, 0.32, 2.8, T.lime),
    ...[[-1.25, -1.15], [1.25, -1.15], [-1.25, 1.15], [1.25, 1.15]].flatMap(([x, z]) => box(x, -1.4, z, 0.28, 3.1, 0.28, T.sage)),
    ...[-1.25, 1.25].flatMap(x => box(x, 2.02, 1.15, 0.28, 2.6, 0.28, T.sage)),
    ...box(0, 3.5, 1.15, 3, 1.1, 0.24, T.yellow),
    ...box(0, 2.6, 1.15, 2.2, 0.22, 0.18, T.yellow),
    ...box(0, -0.4, -1.15, 2.2, 0.18, 0.16, T.sage),
  ];
  return { faces, view: turntable(0.5, -0.36, { dist: 13, focal: 380, cy: 168 }), ground: -1.4 };
}

// Art history: a domed tomb on a raised plinth, with four minarets.
export function monumentScene() {
  const onion = [[0, 0], [1.05, 0], [1.2, 0.35], [1.38, 0.8], [1.32, 1.3], [1.0, 1.75], [0.55, 2.1], [0.2, 2.35], [0.08, 2.6], [0, 2.75]];
  const small = onion.map(([r, h]) => [r * 0.42, h * 0.42]);
  const faces = [
    ...box(0, -1.8, 0, 7, 0.5, 7, T.yellow),
    ...box(0, -1.3, 0, 3.6, 2.4, 3.6, T.tint),
    ...box(0, -1.3, -1.85, 1.2, 1.8, 0.12, T.mid),
    ...box(0, -1.3, 1.85, 1.2, 1.8, 0.12, T.mid),
    ...box(-1.85, -1.3, 0, 0.12, 1.8, 1.2, T.mid),
    ...box(1.85, -1.3, 0, 0.12, 1.8, 1.2, T.mid),
    ...lathe([[0, 0], [1.05, 0], [1.05, 0.45], [0, 0.45]], { y: 1.1, segments: 16, tone: T.tint }),
    ...lathe(onion, { y: 1.55, segments: 20, tone: T.lime }),
    ...[[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]].flatMap(([x, z]) => [
      ...lathe([[0, 0], [0.4, 0], [0.4, 0.45], [0, 0.45]], { x, y: 1.1, z, segments: 10, tone: T.tint }),
      ...lathe(small, { x, y: 1.55, z, segments: 10, tone: T.lime }),
    ]),
    ...[[-3.1, -3.1], [3.1, -3.1], [-3.1, 3.1], [3.1, 3.1]].flatMap(([x, z]) => [
      ...lathe([[0, 0], [0.3, 0], [0.24, 3.4], [0.36, 3.45], [0.36, 3.6], [0.22, 3.62], [0.22, 3.95], [0, 4.25]], { x, y: -1.55, z, segments: 10, tone: T.sage }),
    ]),
  ];
  return { faces, view: turntable(0.32, -0.38, { dist: 18, focal: 390, cy: 128 }), ground: -2.05 };
}

// Crafts and materials: a clay pot with painted bands on a turning wheel,
// beside a spool of thread and a block of wood.
export function craftsScene() {
  const pot = [[0, 0], [0.9, 0], [1.25, 0.35], [1.55, 1.0], [1.5, 1.7], [1.05, 2.35], [0.8, 2.6], [0.95, 2.85], [1.0, 2.95], [0.86, 2.95], [0.7, 2.62], [0, 2.62]];
  const band = (ring, seg) => ring === 3 ? (seg % 4 < 2 ? T.yellow : T.paper) : ring === 5 ? T.yellow : T.orange;
  const spool = [[0, 0], [0.7, 0], [0.7, 0.2], [0.42, 0.24], [0.42, 1.3], [0.7, 1.34], [0.7, 1.54], [0, 1.54]];
  const faces = [
    ...lathe([[0, 0], [2.3, 0], [2.3, 0.3], [0, 0.3]], { y: -1.3, segments: 24, tone: (r, s) => (s % 6 === 0 && r === 1 ? T.mid : T.sage) }),
    ...lathe([[0, 0], [0.5, 0], [0.5, 0.6], [0, 0.6]], { y: -1.9, segments: 12, tone: T.sage }),
    ...lathe(pot, { y: -1.0, segments: 22, tone: band }),
    ...lathe(spool, { x: 3.1, y: -1.9, z: 0.9, segments: 14, tone: (r) => (r >= 3 && r <= 4 ? T.lime : T.yellow) }),
    ...box(-3.0, -1.9, -0.6, 1.4, 1.0, 1.0, T.yellow, { smooth: false }),
  ];
  return { faces, view: turntable(0.42, -0.4, { dist: 15, focal: 450, cy: 128 }), ground: -1.9 };
}

// Perspective and viewpoint: blocks on a gridded ground; as the eye moves
// round, every set of parallel edges runs to its own vanishing point.
export function perspectiveScene() {
  const under = [];
  for (let k = -5; k <= 5; k++) {
    under.push({ a: [k, -1.5, -5], b: [k, -1.5, 5], tone: "var(--m-line)", width: 1 });
    under.push({ a: [-5, -1.5, k], b: [5, -1.5, k], tone: "var(--m-line)", width: 1 });
  }
  const faces = [
    ...box(-1.6, -1.5, -1.4, 1.6, 2.6, 1.6, T.lime, { smooth: false }),
    ...box(1.3, -1.5, -0.6, 1.6, 4.0, 1.6, T.yellow, { smooth: false }),
    ...box(-0.4, -1.5, 2.0, 1.6, 1.4, 1.6, T.sage, { smooth: false }),
    ...box(2.6, -1.5, 2.6, 1.0, 1.0, 1.0, T.orange, { smooth: false }),
  ];
  return { faces, under, view: t => ({ yaw: 0.7 + t * 0.28, pitch: -0.36 - 0.18 * Math.sin(t * 0.5), dist: 15, focal: 420, cy: 128 }), ground: -1.5 };
}

// Everyday physics: a convex lens bending a cone of parallel rays to one focus.
export function physicsScene() {
  const lens = [[0, -0.42], [0.8, -0.34], [1.35, -0.18], [1.6, 0], [1.35, 0.18], [0.8, 0.34], [0, 0.42]];
  const faces = turnZ(lathe(lens, { segments: 20, tone: T.lime }), Math.PI / 2).map(f => ({ ...f, opacity: 0.9 }));
  const focus = 3.2, over = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2, y = Math.cos(a) * 1.25, z = Math.sin(a) * 1.25;
    over.push({ a: [-4.2, y, z], b: [0, y, z], tone: T.orange, width: 1.6 });
    over.push({ a: [0, y, z], b: [focus, 0, 0], tone: T.orange, width: 1.6 });
  }
  over.push({ a: [-4.4, 0, 0], b: [4.4, 0, 0], tone: "var(--m-mid)", width: 1, dash: "4 4" });
  faces.push(...lathe([[0, -0.16], [0.12, -0.11], [0.16, 0], [0.12, 0.11], [0, 0.16]].map(([r, h]) => [r, h]), { x: focus, segments: 10, tone: T.yellow }));
  return { faces, over, view: sway(0.75, 0.6, -0.3, { dist: 13, focal: 480, cy: 118 }), ground: -2.6 };
}

export const scenes3D = { chairScene, monumentScene, craftsScene, perspectiveScene, physicsScene };
