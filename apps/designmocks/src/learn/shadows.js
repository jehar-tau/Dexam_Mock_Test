// Shadows and light. Top view: x right, y up the page (north), z up out of
// the page. A light comes FROM a compass azimuth (degrees clockwise from
// north) at an elevation above the ground. Specification:
// docs/learn/topics/shadows-and-light.md.
import { pick, seededRandom, shuffle } from './random.js';

const LETTERS = 'ABCD';
const rad = d => (d * Math.PI) / 180;
export const COMPASS = Object.freeze({ north: 0, 'north-east': 45, east: 90, 'south-east': 135, south: 180, 'south-west': 225, west: 270, 'north-west': 315 });
export const compassName = az => Object.keys(COMPASS).find(k => COMPASS[k] === ((az % 360) + 360) % 360);
export const opposite = az => (az + 180) % 360;

// Where the top of something h high lands, measured from its foot.
export function offset(light, h) {
  const len = h / Math.tan(rad(light.elevation));
  return [-Math.sin(rad(light.azimuth)) * len, -Math.cos(rad(light.azimuth)) * len];
}
const add = ([x, y], [dx, dy]) => [x + dx, y + dy];
const r6 = v => Math.round(v * 1e6) / 1e6;
export function circle([cx, cy], r, n = 48) { return Array.from({ length: n }, (_, i) => [r6(cx + r * Math.cos((2 * Math.PI * i) / n)), r6(cy + r * Math.sin((2 * Math.PI * i) / n))]); }
export function rect([cx, cy], w, d) { return [[cx - w / 2, cy - d / 2], [cx + w / 2, cy - d / 2], [cx + w / 2, cy + d / 2], [cx - w / 2, cy + d / 2]]; }
export function hull(points) {
  const pts = [...new Map(points.map(p => [p.map(r6).join(), p.map(r6)])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-9) lower.pop(); lower.push(p); }
  for (const p of [...pts].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-9) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
export const shapeKey = polys => polys.map(p => hull(p).map(([x, y]) => `${Math.round(x * 100)},${Math.round(y * 100)}`).sort().join(';')).sort().join('|');

// A solid: { type: box|cylinder|cone|pyramid, at, size, h, base } (base: height of its bottom).
export function footprint(s) { return s.type === 'cylinder' || s.type === 'cone' ? circle(s.at, s.size / 2) : rect(s.at, s.size, s.size); }
export function shadowOf(s, light) {
  const base = footprint(s), lift = s.base ?? 0;
  const low = base.map(p => add(p, offset(light, lift)));
  if (s.type === 'cone' || s.type === 'pyramid') return hull([...low, add(s.at, offset(light, lift + s.h))]);
  return hull([...low, ...base.map(p => add(p, offset(light, lift + s.h)))]);
}
const SOLID_NAMES = { box: 'cube', cylinder: 'cylinder', cone: 'cone', pyramid: 'square pyramid' };
const topFigure = (solids, shadows, light, extra = {}) => ({ type: 'shadow-top', outlines: solids.map(footprint), apexes: solids.filter(s => s.type === 'cone' || s.type === 'pyramid').map(s => s.at), shadows, light: light ? light.azimuth : null, ...extra });

function retry(seed, build) {
  for (let i = 0; i < 400; i++) { const q = build(seededRandom(seed * 3307 + i * 7349)); if (q) return q; }
  throw new Error('No shadow question for seed ' + seed);
}
const lettered = (rng, list) => {
  const options = shuffle(rng, list).map((o, i) => ({ ...o, id: LETTERS[i], label: LETTERS[i] }));
  return { options, answer: options.find(o => o.correct).id };
};
const distinctFigures = list => new Set(list.map(o => shapeKey(o.figure.shadows))).size === list.length;

// ---------- foundations ----------
export function directionQuestion(seed) {
  return retry(seed, rng => {
    const from = pick(rng, Object.values(COMPASS)), askShadow = rng() < 0.6;
    const right = askShadow ? opposite(from) : from, given = askShadow ? from : opposite(from);
    const wrong = shuffle(rng, [opposite(right), (right + 90) % 360, (right + 270) % 360, (right + 45) % 360, (right + 315) % 360]).filter(a => a !== right).slice(0, 3);
    const { options, answer } = lettered(rng, [right, ...wrong].map(a => ({ correct: a === right, text: compassName(a).replace(/^./, c => c.toUpperCase()), reason: a === right ? 'Shadows point directly away from the light.' : a === opposite(right) ? (askShadow ? 'That is towards the sun. Shadows point away from it.' : 'That is where the shadow points; the sun is on the other side.') : 'Shadows run in a straight line away from the light, not off to one side.' })));
    return {
      kind: 'shadow-direction', seed, answerMode: 'single',
      prompt: askShadow ? `The sun is in the ${compassName(given)}. In which direction do shadows point?` : `A pole's shadow points ${compassName(given)}. Where is the sun?`,
      figures: [], options, answer,
      explanation: `A shadow lies on the side of the object away from the light. ${compassName(from).replace(/^./, c => c.toUpperCase())} sun, shadows to the ${compassName(opposite(from))}.`,
    };
  });
}
export function lengthCompareQuestion(seed) {
  return retry(seed, rng => {
    const form = pick(rng, ['lowest', 'equal', 'height']);
    if (form === 'equal') {
      const { options, answer } = lettered(rng, [45, 30, 60, 90].map(a => ({ correct: a === 45, text: `${a}°`, reason: a === 45 ? 'At 45° the rise and the run are equal, so shadow and height match.' : a < 45 ? 'At a lower sun the shadow is longer than the object.' : a === 90 ? 'Straight overhead there is almost no shadow.' : 'At a higher sun the shadow is shorter than the object.' })));
      return { kind: 'shadow-length-compare', seed, answerMode: 'single', prompt: 'At what height of the sun above the horizon is a pole’s shadow exactly as long as the pole is tall?', figures: [], options, answer, explanation: 'The sun’s ray, the pole and the shadow make a right triangle. At 45° its two short sides are equal.' };
    }
    if (form === 'lowest') {
      const angles = shuffle(rng, [15, 25, 35, 50, 60, 70]).slice(0, 4), askLong = rng() < 0.6, right = askLong ? Math.min(...angles) : Math.max(...angles);
      const { options, answer } = lettered(rng, angles.map(a => ({ correct: a === right, text: `Sun ${a}° above the horizon`, reason: a === right ? (askLong ? 'The lowest sun gives the longest shadow.' : 'The highest sun gives the shortest shadow.') : `A ${askLong ? 'lower' : 'higher'} sun than this is offered.` })));
      return { kind: 'shadow-length-compare', seed, answerMode: 'single', prompt: `The same pole is photographed at four times of day. When is its shadow ${askLong ? 'longest' : 'shortest'}?`, figures: [], options, answer, explanation: 'Low sun, long shadow; high sun, short shadow. Early morning and late evening shadows are the longest.' };
    }
    const heights = shuffle(rng, [2, 3, 4, 5, 6]).slice(0, 4), right = Math.max(...heights);
    const { options, answer } = lettered(rng, heights.map((h, i) => ({ correct: h === right, text: `A ${h} m ${['lamp post', 'flag pole', 'tree', 'wall'][i]}`, reason: h === right ? 'Under the same sun the shadow grows with the height.' : 'Something taller stands in the same sunlight.' })));
    return { kind: 'shadow-length-compare', seed, answerMode: 'single', prompt: 'Four objects stand in the same field at the same moment. Which casts the longest shadow?', figures: [], options, answer, explanation: 'At one moment every object’s shadow is the same multiple of its height, so the tallest casts the longest.' };
  });
}
export function flatShadowQuestion(seed) {
  return retry(seed, rng => {
    const shape = pick(rng, ['square', 'circle', 'triangle']), light = { azimuth: pick(rng, [90, 180, 270, 0]), elevation: 45 }, h = 2;
    const base = shape === 'circle' ? circle([0, 0], 1.2) : shape === 'square' ? rect([0, 0], 2, 2) : [[-1.2, -1], [1.2, -1], [0, 1.2]];
    const shift = p => p.map(q => add(q, offset(light, h)));
    const stretch = p => p.map(([x, y]) => { const [ox, oy] = offset(light, 1); return [x + x * Math.abs(ox) * 0.6, y + y * Math.abs(oy) * 0.6]; });
    const list = [
      { correct: true, figure: { type: 'shadow-top', outlines: [base], shadows: [shift(base)], light: null, dashed: true }, reason: 'Parallel to the ground in sunlight: the same shape and size, moved away from the sun.' },
      { correct: false, figure: { type: 'shadow-top', outlines: [base], shadows: [stretch(shift(base))], light: null, dashed: true }, reason: 'Stretched. A shape held level casts its own shape; only a tilted shape is stretched or squashed.' },
      { correct: false, figure: { type: 'shadow-top', outlines: [base], shadows: [shift(base).map(([x, y]) => [x * 1.45, y * 1.45])], light: null, dashed: true }, reason: 'Enlarged. Sun rays are parallel, so the shadow stays the same size.' },
      { correct: false, figure: { type: 'shadow-top', outlines: [base], shadows: [base.map(q => add(q, offset({ ...light, azimuth: opposite(light.azimuth) }, h)))], light: null, dashed: true }, reason: 'Moved towards the sun. The shadow falls on the far side.' },
    ];
    if (!distinctFigures(list)) return null;
    const { options, answer } = lettered(rng, list);
    return {
      kind: 'flat-shadow', seed, answerMode: 'single',
      prompt: `A thin ${shape} card is held level, 2 units above a table, with the sun in the ${compassName(light.azimuth)} at 45°. Seen from above, which shows its shadow (grey) and where the card is (dashed)?`,
      figures: [{ type: 'shadow-top', outlines: [], shadows: [], light: light.azimuth, compassOnly: true }],
      options, answer,
      explanation: 'Sun rays are parallel. A flat shape held level casts a shadow of the same shape and size, moved away from the sun by its height ÷ tan(sun height): here 2 units.',
    };
  });
}

// ---------- exam standard ----------
const TYPES = ['box', 'cylinder', 'cone', 'pyramid'];
const swapTip = t => ({ box: 'pyramid', pyramid: 'box', cylinder: 'cone', cone: 'cylinder' })[t];
export function solidShadowQuestion(seed) {
  return retry(seed, rng => {
    const type = pick(rng, TYPES), s = { type, at: [0, 0], size: 2, h: pick(rng, [2, 3]) };
    const light = { azimuth: pick(rng, Object.values(COMPASS)), elevation: 45 };
    const make = (solid, l, reason, correct = false) => ({ correct, figure: topFigure([s], [shadowOf(solid, l)], null), reason });
    const list = [
      make(s, light, `Base joined to the shadow of the top, ${s.h} units away from the sun.`, true),
      make(s, { ...light, azimuth: opposite(light.azimuth) }, 'This shadow falls towards the sun.'),
      make({ ...s, type: swapTip(type) }, light, type === 'cone' || type === 'pyramid' ? 'A pointed top casts a pointed shadow, not a flat end.' : 'A flat top casts a flat-ended shadow, not a point.'),
      make({ ...s, h: s.h / 2 }, light, `Too short: at 45° the shadow reaches as far as the solid is tall, ${s.h} units.`),
    ];
    if (!distinctFigures(list)) return null;
    const { options, answer } = lettered(rng, list);
    return {
      kind: 'solid-shadow', seed, answerMode: 'single', solid: s, light,
      prompt: `A ${SOLID_NAMES[type]} ${s.h} units tall stands on a table. The sun is in the ${compassName(light.azimuth)}, 45° above the horizon. Seen from above, which shows its shadow?`,
      figures: [topFigure([s], [], light)],
      options, answer,
      explanation: `Find where the top lands: ${s.h} units to the ${compassName(opposite(light.azimuth))}, because at 45° the shadow is as long as the solid is tall. Join that to the base.`,
      hints: ['Shadows point away from the sun.', 'At 45°, the top lands as far from the base as the solid is tall.'],
      solution: [{ text: `Sun in the ${compassName(light.azimuth)}: the shadow points ${compassName(opposite(light.azimuth))}.` }, { text: `The top is ${s.h} high, so at 45° it lands ${s.h} units away.` }, { text: type === 'cone' || type === 'pyramid' ? 'The apex is a single point, so the shadow narrows to a tip.' : 'The top is the same shape as the base, so the shadow is the base slid along and filled in.' }],
    };
  });
}
export function ratioQuestion(seed) {
  return retry(seed, rng => {
    const h1 = pick(rng, [2, 3, 4, 5, 6, 8]), s1 = pick(rng, [2, 3, 4, 5, 6, 8, 10]), k = pick(rng, [1.5, 2, 2.5, 3, 4]);
    if (h1 === s1) return null;
    const askHeight = rng() < 0.6, s2 = s1 * k, h2 = h1 * k;
    const value = askHeight ? h2 : s2;
    if (!Number.isInteger(value * 2) || !Number.isInteger(askHeight ? s2 * 2 : h2 * 2)) return null;
    const things = pick(rng, [['pole', 'tree'], ['person', 'building'], ['post', 'tower']]);
    const mistakes = [{ value: askHeight ? s2 * s1 / h1 : h2 * h1 / s1, reason: 'The ratio is turned upside down. Height ÷ shadow is the same for both.' }, { value: askHeight ? s2 + (h1 - s1) : h2 + (s1 - h1), reason: 'Adding the difference does not keep the ratio; scale by the same factor instead.' }].filter(m => m.value !== value && m.value > 0).map(m => ({ ...m, value: Math.round(m.value * 100) / 100 })).filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i);
    return {
      kind: 'shadow-ratio', seed, answerMode: 'numeric', unit: 'm',
      prompt: askHeight ? `A ${h1} m ${things[0]} casts a ${s1} m shadow. At the same moment a ${things[1]} casts a ${s2} m shadow. How tall is the ${things[1]}, in metres?` : `A ${h1} m ${things[0]} casts a ${s1} m shadow. At the same moment, how long is the shadow of a ${h2} m ${things[1]}, in metres?`,
      figures: [{ type: 'shadow-side', objects: [{ h: h1, s: s1, label: `${h1} m` }, { h: askHeight ? null : h2, s: askHeight ? s2 : null, label: askHeight ? '?' : `${h2} m` }] }],
      answer: { value }, mistakes,
      explanation: `The sun is at the same height for both, so height ÷ shadow is the same: ${h1} ÷ ${s1}. The ${things[1]} is ${k} times as ${askHeight ? 'long in shadow' : 'tall'}, so its ${askHeight ? 'height' : 'shadow'} is ${k} × ${askHeight ? h1 : s1} = ${value} m.`,
      hints: ['At one moment, every height ÷ shadow ratio is the same.', 'How many times longer is the second shadow (or height) than the first?'],
      solution: [{ text: `Ratio: ${h1} m tall to ${s1} m of shadow.` }, { text: `Scale factor: ${askHeight ? `${s2} ÷ ${s1}` : `${h2} ÷ ${h1}`} = ${k}.` }, { text: `${askHeight ? 'Height' : 'Shadow'} = ${k} × ${askHeight ? h1 : s1} = ${value} m.` }],
    };
  });
}
export function rowShadowsQuestion(seed) {
  return retry(seed, rng => {
    const types = shuffle(rng, TYPES).slice(0, 3), h = 2;
    const solids = types.map((type, i) => ({ type, at: [(i - 1) * 3.4, 0], size: 2, h }));
    const light = { azimuth: pick(rng, [0, 180, 45, 135, 225, 315]), elevation: 45 };
    const fig = (sol, l) => topFigure(solids, sol.map(s => shadowOf(s, l)), null);
    const swapped = [...types]; [swapped[0], swapped[1]] = [types[1], types[0]];
    const list = [
      { correct: true, figure: fig(solids, light), reason: 'Each shadow matches its solid and points away from the sun.' },
      { correct: false, figure: fig(solids, { ...light, azimuth: opposite(light.azimuth) }), reason: 'These shadows point towards the sun.' },
      { correct: false, figure: fig(solids.map((s, i) => ({ ...s, type: swapped[i] })), light), reason: `The first two shadows belong to the wrong solids: the ${SOLID_NAMES[types[0]]} and the ${SOLID_NAMES[types[1]]} are swapped.` },
      { correct: false, figure: fig(solids.map((s, i) => ({ ...s, h: i === 2 ? h * 2 : h })), light), reason: 'The solids are the same height, so their shadows reach equally far.' },
    ];
    if (!distinctFigures(list)) return null;
    const { options, answer } = lettered(rng, list);
    return {
      kind: 'row-shadows', seed, answerMode: 'single', solids, light,
      prompt: `A ${types.map(t => SOLID_NAMES[t]).join(', a ').replace(/, a ([^,]*)$/, ' and a $1')}, all 2 units tall, stand in a row from west to east. The sun is in the ${compassName(light.azimuth)} at 45°. Which top view shows their shadows?`,
      figures: [topFigure(solids, [], light)],
      options, answer,
      explanation: 'Equal heights under one sun give shadows of equal reach, all parallel and pointing away from the sun. A pointed solid ends in a tip; a flat-topped one ends in the shape of its top.',
      hints: ['All shadows are parallel and point away from the sun.', 'Check the end of each shadow: a tip for the cone and pyramid, a full shape for the cube and cylinder.'],
      solution: [{ text: `Direction: towards the ${compassName(opposite(light.azimuth))}.` }, { text: 'Equal heights, so equal reach: 2 units at 45°.' }, { text: `Tips: ${types.map(t => `${SOLID_NAMES[t]} ${t === 'cone' || t === 'pyramid' ? 'pointed' : 'flat'}`).join(', ')}.` }],
    };
  });
}

// ---------- exam hard ----------
export function stackedShadowQuestion(seed) {
  return retry(seed, rng => {
    const upper = pick(rng, ['cylinder', 'cone', 'pyramid']), light = { azimuth: pick(rng, Object.values(COMPASS)), elevation: 45 };
    const cube = { type: 'box', at: [0, 0], size: 2.4, h: 2 }, top = { type: upper, at: [0, 0], size: 1.4, h: 2, base: 2 };
    const fig = parts => topFigure([cube, top], parts.map(p => shadowOf(p, light)), null);
    const list = [
      { correct: true, figure: fig([cube, top]), reason: 'The upper solid starts 2 units up, so its shadow starts 2 units out and reaches 4.' },
      { correct: false, figure: fig([cube, { ...top, base: 0 }]), reason: 'This treats the upper solid as standing on the table. It starts on top of the cube.' },
      { correct: false, figure: fig([cube]), reason: 'The upper solid casts a shadow of its own beyond the cube’s.' },
      { correct: false, figure: fig([cube, { ...top, type: swapTip(upper) === 'box' ? 'box' : swapTip(upper) }]), reason: upper === 'cylinder' ? 'A flat top gives a flat end, not a tip.' : 'A pointed top gives a tip, not a flat end.' },
    ];
    if (!distinctFigures(list)) return null;
    const { options, answer } = lettered(rng, list);
    return {
      kind: 'stacked-shadow', seed, answerMode: 'single',
      prompt: `A ${SOLID_NAMES[upper]} 2 units tall stands centred on a cube 2 units tall. The sun is in the ${compassName(light.azimuth)} at 45°. Seen from above, which shows the whole shadow?`,
      figures: [topFigure([cube, top], [], light)],
      options, answer,
      explanation: 'Shadow each part on its own. The cube’s top lands 2 units away. The upper solid’s base is 2 units up, so it lands 2 units away, and its top, 4 units up, lands 4 units away.',
      hints: ['Treat the two solids separately.', 'Every point lands as far from its place on the plan as it is high.'],
      solution: [{ text: 'Cube: its top, 2 high, lands 2 units away.' }, { text: `${SOLID_NAMES[upper].replace(/^./, c => c.toUpperCase())}: its base, 2 high, lands 2 away; its top, 4 high, lands 4 away.` }, { text: 'Put the two shadows together.' }],
    };
  });
}
export function lampQuestion(seed) {
  return retry(seed, rng => {
    const H = pick(rng, [4, 5, 6, 8, 9, 10]), h = pick(rng, [1, 1.5, 2, 3]), D = pick(rng, [2, 3, 4, 5, 6, 8]);
    if (h >= H - 1) return null;
    const value = (D * h) / (H - h);
    if (!Number.isInteger(value * 2)) return null;
    const mistakes = [{ value: h, reason: 'That is the sun rule at 45°. A lamp is close, so use similar triangles.' }, { value: (D * h) / H, reason: 'Use the lamp height above the top of the post, H − h, not H.' }, { value: D + value, reason: 'That is the distance from the lamp to the shadow’s tip, not the shadow length.' }].map(m => ({ ...m, value: Math.round(m.value * 100) / 100 })).filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i);
    return {
      kind: 'lamp-shadow', seed, answerMode: 'numeric', unit: 'm',
      prompt: `A street lamp is ${H} m high. A ${h} m post stands ${D} m from the foot of the lamp. How long is the post's shadow, in metres?`,
      figures: [{ type: 'shadow-side', lamp: { H, D }, objects: [{ h, s: null, label: `${h} m` }] }],
      answer: { value }, mistakes,
      explanation: `The ray from the lamp grazes the top of the post. Similar triangles: shadow ÷ ${h} = (${D} + shadow) ÷ ${H}, so shadow = ${D} × ${h} ÷ (${H} − ${h}) = ${value} m.`,
      hints: ['Draw the ray from the lamp over the top of the post to the ground.', 'Two similar right triangles share the shadow tip.'],
      solution: [{ text: `Small triangle: post ${h} m over shadow s. Big triangle: lamp ${H} m over ${D} + s.` }, { text: `${h} ÷ s = ${H} ÷ (${D} + s), so ${h}(${D} + s) = ${H}s.` }, { text: `s = ${D} × ${h} ÷ (${H} − ${h}) = ${value} m.` }],
    };
  });
}
export const SILHOUETTES = Object.freeze({ sphere: ['circle'], cylinder: ['circle', 'rectangle'], cone: ['circle', 'triangle'], cube: ['square', 'rectangle', 'hexagon'], 'square pyramid': ['square', 'triangle'], 'triangular prism': ['triangle', 'rectangle'] });
export function silhouetteQuestion(seed) {
  return retry(seed, rng => {
    const outline = pick(rng, ['circle', 'triangle', 'rectangle', 'square']), solids = shuffle(rng, Object.keys(SILHOUETTES)).slice(0, 4);
    const right = solids.filter(s => SILHOUETTES[s].includes(outline));
    if (right.length < 1 || right.length > 3) return null;
    const options = solids.map((s, i) => ({ id: LETTERS[i], label: LETTERS[i], text: `A ${s}`, correct: right.includes(s), reason: right.includes(s) ? `Turned the right way, a ${s} casts a ${outline}.` : `A ${s} can cast ${SILHOUETTES[s].join(' or ')} outlines, never a ${outline}.` }));
    return {
      kind: 'silhouette-set', seed, answerMode: 'multi',
      prompt: `A solid is lit from one side and casts a ${outline} shadow on a wall. Which of these solids could it be? Choose all that could.`,
      figures: [{ type: 'silhouette', outline }],
      options, answer: options.filter(o => o.correct).map(o => o.id),
      explanation: 'A silhouette is the solid’s outline seen along the light. Turn each solid in your head and look at it from every side: end on, side on and corner on.',
      hints: ['Picture each solid seen from the end, from the side and from a corner.'],
      solution: [{ text: `Outline: ${outline}.` }, ...options.map(o => ({ text: `${o.text}: ${o.reason}` }))],
    };
  });
}
// The sun does not turn when a walker turns.
export function walkersQuestion(seed) {
  return retry(seed, rng => {
    const sun = pick(rng, Object.values(COMPASS).filter(a => a % 90 === 0)), turn = pick(rng, [90, -90, 45, -45]), heading = pick(rng, Object.values(COMPASS).filter(a => a % 90 === 0 && a !== sun && a !== opposite(sun)));
    const away = opposite(sun), len = 1.6;
    const tip = (p, az) => [p[0] + Math.sin(rad(az)) * len, p[1] + Math.cos(rad(az)) * len];
    const pos = [[-1.8, 0], [1.8, 0]], headings = [heading, (heading + turn + 360) % 360];
    const draw = dirs => ({ type: 'walkers', walkers: pos.map((p, i) => ({ at: p, heading: headings[i], shadow: [p, tip(p, dirs[i])] })), light: null });
    const list = [
      { correct: true, figure: draw([away, away]), reason: 'Both shadows parallel and pointing away from the sun, whatever way the walkers face.' },
      { correct: false, figure: draw([away, (away + turn + 360) % 360]), reason: 'The second shadow has turned with the walker. Shadows follow the sun, not the body.' },
      { correct: false, figure: draw([sun, sun]), reason: 'These shadows point towards the sun.' },
      { correct: false, figure: draw([(away + 90) % 360, (away + 90) % 360]), reason: 'Parallel, but at right angles to the sunlight.' },
    ];
    const { options, answer } = lettered(rng, list);
    return {
      kind: 'compass-shadows', seed, answerMode: 'single',
      prompt: `Two people walk ${compassName(heading)} with the sun in the ${compassName(sun)}. The second then turns ${Math.abs(turn)}° ${turn > 0 ? 'right' : 'left'}. Seen from above (north up), which drawing shows their shadows now?`,
      figures: [{ type: 'shadow-top', outlines: [], shadows: [], light: sun, compassOnly: true }],
      options, answer,
      explanation: `Turning changes which way a person faces, not where the sun is. Both shadows still point ${compassName(away)}.`,
      hints: ['Does the sun move when someone turns round?'],
      solution: [{ text: `Sun in the ${compassName(sun)}: shadows point ${compassName(away)}.` }, { text: 'The turn changes the walker’s heading only.' }, { text: 'So both shadows stay parallel, pointing away from the sun.' }],
    };
  });
}

export function shadowQuestion(seed, kind, level) {
  switch (kind) {
    case 'shadow-direction': return directionQuestion(seed);
    case 'shadow-length-compare': return lengthCompareQuestion(seed);
    case 'flat-shadow': return flatShadowQuestion(seed);
    case 'solid-shadow': return solidShadowQuestion(seed);
    case 'shadow-ratio': return ratioQuestion(seed);
    case 'row-shadows': return rowShadowsQuestion(seed);
    case 'stacked-shadow': return stackedShadowQuestion(seed);
    case 'compass-shadows': return walkersQuestion(seed);
    case 'lamp-shadow': return lampQuestion(seed);
    case 'silhouette-set': return silhouetteQuestion(seed);
    default: throw new Error('Unknown shadow kind ' + kind + ' at level ' + level);
  }
}
export const SHADOW_KINDS = Object.freeze({ 'shadow-direction': [1], 'shadow-length-compare': [2], 'flat-shadow': [2], 'solid-shadow': [3], 'shadow-ratio': [3], 'row-shadows': [3], 'stacked-shadow': [4], 'compass-shadows': [4], 'lamp-shadow': [4], 'silhouette-set': [4] });
