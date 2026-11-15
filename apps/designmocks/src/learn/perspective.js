// Perspective and viewpoint, from a pinhole camera: eye level and the
// horizon, one-, two- and three-point drawings, vanishing points, the
// viewer's eye height, and which view a camera sees.
// Specification: docs/learn/topics/perspective.md.
import { pick, seededRandom, shuffle } from './random.js';

const LETTERS = 'ABCD';
function retry(seed, build) {
  for (let i = 0; i < 600; i++) { const q = build(seededRandom(seed * 7451 + i * 3613)); if (q) return q; }
  throw new Error('No perspective question for seed ' + seed);
}
const lettered = (rng, list) => {
  const options = shuffle(rng, list).map((o, i) => ({ ...o, id: LETTERS[i], label: LETTERS[i] }));
  return { options, answer: options.find(o => o.correct).id };
};
const rad = d => (d * Math.PI) / 180;

// World: x right, y forward (away), z up. Camera at `eye`, turned `yaw` degrees
// to the right about z, tilted `pitch` degrees up. Screen: u right, v up.
export function camera({ eye = [0, 0, 1.6], yaw = 0, pitch = 0, f = 6 } = {}) {
  const cy = Math.cos(rad(yaw)), sy = Math.sin(rad(yaw)), cp = Math.cos(rad(pitch)), sp = Math.sin(rad(pitch));
  const fwd = [sy * cp, cy * cp, sp], right = [cy, -sy, 0], up = [-sy * sp, -cy * sp, cp];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const project = p => { const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]], depth = dot(d, fwd); return depth <= 0.01 ? null : [(f * dot(d, right)) / depth, (f * dot(d, up)) / depth]; };
  const vanish = dir => { const depth = dot(dir, fwd); return Math.abs(depth) < 1e-9 ? null : [(f * dot(dir, right)) / depth, (f * dot(dir, up)) / depth]; };
  return { project, vanish, horizon: pitch === 0 ? 0 : (f * Math.tan(rad(-pitch))) };
}
export const BOX_EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
export function boxCorners([cx, cy, z0], [w, d, h], turn = 0) {
  const c = Math.cos(rad(turn)), s = Math.sin(rad(turn)), base = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
  return [...base.map(([x, y]) => [x, y, z0]), ...base.map(([x, y]) => [x, y, z0 + h])];
}
export function drawBox(cam, corners) {
  const pts = corners.map(cam.project);
  return pts.some(p => !p) ? null : BOX_EDGES.map(([a, b]) => [pts[a], pts[b]]);
}

// ---------- eye level ----------
export function eyeLevelQuestion(seed) {
  return retry(seed, rng => {
    const want = pick(rng, ['top', 'bottom', 'neither']), boxH = 1.2, z0 = pick(rng, [0, 0.4]);
    const eyeFor = k => (k === 'top' ? z0 + boxH + 0.9 : k === 'bottom' ? z0 - 0.9 : z0 + boxH / 2);
    const make = k => { const cam = camera({ eye: [0, 0, eyeFor(k)] }), lines = drawBox(cam, boxCorners([0.4, 4, z0], [1.4, 1.4, boxH])); return { type: 'persp', lines, horizon: 0 }; };
    const prompts = { top: 'we can see the top of the box', bottom: 'we can see the bottom of the box', neither: 'we see neither its top nor its bottom' };
    const { options, answer } = lettered(rng, [['Above the box', 'top'], ['Below the box', 'bottom'], ['Level with the middle of the box', 'neither'], ['It cannot be told from the drawing', null]].map(([text, k]) => ({ correct: k === want, text, reason: k === want ? 'The horizon is at the viewer’s eye level; things below it show their tops, things above it their bottoms.' : k === null ? 'The horizon line shows exactly where eye level is.' : `Then ${prompts[k]}.` })));
    return {
      kind: 'eye-level', seed, answerMode: 'single', want,
      prompt: 'In this drawing, where is the horizon line compared with the box?',
      figures: [make(want)], options, answer,
      explanation: 'The horizon is always at the viewer’s eye level. A box below eye level shows its top; above eye level, its bottom; at eye level, neither, and its top and bottom edges look like straight lines.',
    };
  });
}
// ---------- naming the perspective ----------
export function perspectiveTypeQuestion(seed) {
  return retry(seed, rng => {
    const kind = pick(rng, ['one', 'two', 'three']);
    const cam = camera({ eye: [0, 0, kind === 'three' ? 0.5 : 1.6], yaw: kind === 'one' ? 0 : pick(rng, [-1, 1]) * (20 + Math.floor(rng() * 15)), pitch: kind === 'three' ? 22 : 0 });
    const corners = boxCorners(kind === 'one' ? [0.5, 5, 0] : [0, 6, 0], [2, 2, kind === 'three' ? 4 : 2], kind === 'one' ? 0 : 0);
    const lines = drawBox(cam, corners);
    if (!lines) return null;
    const texts = { one: 'One-point perspective', two: 'Two-point perspective', three: 'Three-point perspective' };
    const { options, answer } = lettered(rng, [...Object.entries(texts), ['flat', 'No perspective: a flat orthographic view']].map(([k, t]) => ({ correct: k === kind, text: t, reason: k === kind ? { one: 'Only the edges running away from us meet; uprights stay upright and the front face is square on.', two: 'Both sets of level edges slope towards two points on the horizon; uprights stay upright.', three: 'Level edges meet at two points and the uprights lean towards a third, because we look up or down.' }[k] : 'Compare which sets of edges stay parallel in the drawing.' })));
    return {
      kind: 'perspective-type', seed, answerMode: 'single', persp: kind,
      prompt: 'Which kind of perspective is this box drawn in?',
      figures: [{ type: 'persp', lines, horizon: cam.horizon }], options, answer,
      explanation: 'Count the families of parallel edges that meet in the drawing. Front face square on: one point. Turned box, level gaze: two points, uprights stay upright. Looking up or down: the uprights meet too, three points.',
    };
  });
}

// ---------- vanishing points ----------
export function vanishingQuestion(seed) {
  return retry(seed, rng => {
    const yaw = pick(rng, [-1, 1]) * (25 + Math.floor(rng() * 20)), eyeZ = pick(rng, [0.6, 1.6, 2.6]), cam = camera({ eye: [0, 0, eyeZ], yaw, f: 4 });
    const ahead = [4.5 * Math.sin(rad(yaw)), 4.5 * Math.cos(rad(yaw))], corners = boxCorners([ahead[0], ahead[1], 0], [1.6, 1.6, 1.4]), lines = drawBox(cam, corners);
    if (!lines) return null;
    const us = lines.flat().map(p => p[0]), inBox = p => p[0] > Math.min(...us) - 0.4 && p[0] < Math.max(...us) + 0.4;
    const side = pick(rng, ['left', 'right']), dirs = [[1, 0, 0], [0, 1, 0]].map(d => cam.vanish(d)).filter(Boolean);
    if (dirs.length < 2) return null;
    const sorted = [...dirs].sort((a, b) => a[0] - b[0]), vp = side === 'left' ? sorted[0] : sorted[1], other = side === 'left' ? sorted[1] : sorted[0];
    if (Math.abs(vp[0]) > 14 || Math.abs(other[0]) > 14 || inBox(vp) || inBox(other) || inBox([(vp[0] + other[0]) / 2, 0])) return null;
    const decoys = [[vp[0], vp[1] + 2.2], [(vp[0] + other[0]) / 2, 0], other];
    const pts = [vp, ...decoys];
    const { options, answer } = lettered(rng, pts.map((p, i) => ({ correct: i === 0, text: '', point: p, reason: i === 0 ? 'The level edges going that way, extended, all pass through this point on the horizon.' : i === 1 ? 'Vanishing points of level edges lie on the horizon, at eye level.' : i === 2 ? 'This point is on the horizon, but no set of edges meets here.' : 'This is where the edges going the other way meet.' })));
    const labelled = options.map(o => ({ at: o.point, label: o.label }));
    options.forEach(o => { o.text = `Point ${o.label}`; delete o.point; });
    return {
      kind: 'vanishing-point', seed, answerMode: 'single', vp,
      prompt: `Extend the level edges of the box that run away to the ${side}. At which labelled point do they meet?`,
      figures: [{ type: 'persp', lines, horizon: 0, points: labelled, wide: true }], options, answer,
      explanation: 'Parallel level edges meet at one vanishing point on the horizon. Extend two of them with a ruler: where they cross is the point.',
      hints: ['Vanishing points of level edges lie on the horizon line.', 'Extend two parallel edges and see where they cross.'],
      solution: [{ text: `Pick two edges of the box that run to the ${side}.` }, { text: 'Extend them: they cross on the horizon.' }, { text: `They meet at point ${options.find(o => o.correct).label}.` }],
    };
  });
}

// ---------- eye height from people on flat ground ----------
export function eyeHeightQuestion(seed, level = 3) {
  return retry(seed, rng => {
    const H = pick(rng, [1.6, 1.8, 2]), eye = Math.round(H * (level <= 3 ? pick(rng, [0.5, 0.75]) : pick(rng, [1.5, 2, 2.5, 3])) * 100) / 100, cam = camera({ eye: [0, 0, eye], f: 5 });
    const people = [3, 5, 8, 12].map((dist, i) => ({ foot: cam.project([-2 + i * 1.3, dist, 0]), head: cam.project([-2 + i * 1.3, dist, H]) }));
    if (people.some(p => !p.foot || !p.head)) return null;
    const value = eye, ratio = eye / H;
    const mistakes = [{ value: H, reason: 'The horizon crosses the people at the viewer’s eye height, not at their full height.' }, { value: Math.round(H / ratio * 100) / 100, reason: 'Turned the wrong way round: where the horizon crosses a person, measured up from the feet, is the viewer’s eye height.' }, { value: Math.round((H - eye) * 100) / 100, reason: 'Measure up from the feet, not down from the head.' }].filter((m, i, l) => m.value > 0 && m.value !== value && l.findIndex(o => o.value === m.value) === i);
    return {
      kind: 'eye-height', seed, answerMode: 'numeric', unit: 'm', people,
      prompt: `People ${H} m tall stand at different distances on flat ground. ${ratio > 1 ? 'The horizon passes above every head, always the same number of body-heights up' : 'The horizon line crosses every person at the same point on their body'}, as drawn. How high above the ground is the viewer's eye, in metres?`,
      figures: [{ type: 'persp-people', people, horizon: 0 }],
      answer: { value }, mistakes,
      explanation: `On flat ground the horizon cuts everyone at the viewer’s eye height. Here it crosses at ${Math.round(ratio * 100) / 100} of a ${H} m person's height: ${value} m.`,
      hints: ['The horizon is at the viewer’s eye level.', 'Measure, on any person, how far up from the feet the horizon crosses, as a fraction of their height.'],
      solution: [{ text: 'Pick any person and compare where the horizon crosses with their height.' }, { text: `It crosses at ${Math.round(ratio * 100) / 100} × their height.` }, { text: `${Math.round(ratio * 100) / 100} × ${H} = ${value} m.` }],
    };
  });
}

// ---------- which view from where ----------
export const OBJECTS = ['tower', 'block', 'cone'];
export function viewFrom(objects, cam) {
  // Left to right as the camera sees them; nearer things larger.
  return objects.map(o => { const p = cam.project([o.at[0], o.at[1], 0]), dist = Math.hypot(o.at[0] - cam.eye[0], o.at[1] - cam.eye[1]); return p ? { type: o.type, u: p[0], size: 1 / dist } : null; }).filter(Boolean).sort((a, b) => a.u - b.u);
}
export function cameraViewQuestion(seed, level = 3) {
  return retry(seed, rng => {
    const objects = shuffle(rng, OBJECTS).map((type, i) => ({ type, at: [[-2, 0], [1.5, 1.5], [0.5, -2.2]][i] }));
    const spots = { south: [[0, -8], 0], east: [[8, 0], -90], north: [[0, 8], 180], west: [[-8, 0], 90] }, from = pick(rng, Object.keys(spots));
    const eyeFor = name => { const [[x, y], yaw] = spots[name]; const cam = camera({ eye: [x, y, 1.5], yaw, f: 5 }); cam.eye = [x, y]; return cam; };
    const strip = name => viewFrom(objects, eyeFor(name)).map(v => ({ type: v.type, size: Math.round(v.size * 100) / 100 }));
    const right = strip(from), order = r => r.map(v => v.type).join(' ');
    const wrongNames = Object.keys(spots).filter(n => n !== from && order(strip(n)) !== order(right));
    const wrongs = wrongNames.map(n => ({ strip: strip(n), reason: `That is the view from the ${n}.` }));
    const mirrored = { strip: [...right].reverse(), reason: 'Left and right are swapped: picture yourself standing at the camera, facing the scene.' };
    const all = [...wrongs, mirrored].filter((w, i, l) => order(w.strip) !== order(right) && l.findIndex(o => order(o.strip) === order(w.strip)) === i);
    if (all.length < 3) return null;
    const { options, answer } = lettered(rng, [{ correct: true, figure: { type: 'view-strip', items: right }, reason: 'Standing there and facing the middle, this is the order from left to right.' }, ...all.slice(0, 3).map(w => ({ correct: false, figure: { type: 'view-strip', items: w.strip }, reason: w.reason }))]);
    return {
      kind: 'camera-view', seed, answerMode: 'single', objects, from,
      prompt: `This plan shows three objects seen from above, north at the top. A camera stands at the ${from} edge, facing the middle. Which picture does it take?`,
      figures: [{ type: 'plan-view', objects, camera: spots[from][0] }], options, answer,
      explanation: 'Stand at the camera in your head and face the scene. Read the objects from your left hand to your right; the nearer one looks larger.',
      hints: ['Turn the plan so the camera is at the bottom, facing up the page.', 'Now read the objects from left to right.'],
      solution: [{ text: `Turn the plan so the ${from} edge is nearest you.` }, { text: 'Read left to right across the scene.' }, { text: `Order: ${right.map(v => v.type).join(', ')}.` }],
      level,
    };
  });
}

export function perspectiveQuestion(seed, kind, level) {
  switch (kind) {
    case 'eye-level': return eyeLevelQuestion(seed);
    case 'perspective-type': return perspectiveTypeQuestion(seed);
    case 'vanishing-point': return vanishingQuestion(seed);
    case 'eye-height': return eyeHeightQuestion(seed, level);
    case 'camera-view': return cameraViewQuestion(seed, level);
    default: throw new Error('Unknown perspective kind ' + kind);
  }
}
export const PERSPECTIVE_KINDS = Object.freeze({ 'eye-level': [2], 'perspective-type': [2], 'vanishing-point': [3], 'eye-height': [3, 4], 'camera-view': [3, 4] });
