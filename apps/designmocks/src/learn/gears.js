// Mechanisms: gears, belts, ropes over pulleys, and balancing levers.
// Specification: docs/learn/topics/mechanisms.md.
//
// Conventions. Figures use SCREEN coordinates: x to the right, y DOWN.
// A direction is +1 for clockwise as it looks on the screen, −1 for
// anticlockwise. A wheel at the right of its centre moving clockwise goes
// down the screen.
//
// A system is { wheels, links, driver, dir, speed }:
//   wheel: { id: 'A', x, y, r, size, toothed, plane }
//          `size` is what the ratio uses: teeth for a gear train, diameter
//          for a mixed system. `r` is the drawn radius, always in
//          proportion to `size` within one system.
//   link:  { type: 'mesh' | 'shaft' | 'open' | 'crossed', a, b } (wheel indices)
// Meshing gears turn opposite ways; a shared shaft or an open belt keeps
// the direction; a crossed belt reverses it. Speed × size is the same on
// both wheels of a mesh or a belt.
import { pick, seededRandom, shuffle } from './random.js';

export const CW = 1, ACW = -1;
export const dirWord = d => (d === CW ? 'clockwise' : 'anticlockwise');
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const frac = (n, d) => { const g = gcd(n, d) || 1; return { n: n / g, d: d / g }; };
const whole = f => (f.d === 1 ? f.n : null);
const LETTERS = 'ABCDEFGHIJKLMNOP';
const cap = text => text.charAt(0).toUpperCase() + text.slice(1);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---------- solving a system ----------
// Walk outward from the driver, one link at a time. A wheel reached twice with different
// results means the system is locked: it cannot turn at all.
export function solve(system) {
  const n = system.wheels.length, dir = Array(n).fill(0), speed = Array(n).fill(null), order = [];
  dir[system.driver] = system.dir; speed[system.driver] = frac(system.speed ?? 1, 1);
  const queue = [system.driver];
  let locked = false;
  while (queue.length) {
    const a = queue.shift();
    for (const link of system.links) {
      if (link.a !== a && link.b !== a) continue;
      const b = link.a === a ? link.b : link.a;
      const d = dir[a] * (link.type === 'mesh' || link.type === 'crossed' ? -1 : 1);
      const s = link.type === 'shaft' ? speed[a] : frac(speed[a].n * system.wheels[a].size, speed[a].d * system.wheels[b].size);
      if (dir[b] === 0) { dir[b] = d; speed[b] = s; queue.push(b); order.push({ from: a, to: b, type: link.type }); }
      else if (dir[b] !== d || speed[b].n * s.d !== s.n * speed[b].d) locked = true;
    }
  }
  return { dir, speed, locked, order };
}

// ---------- layout ----------
// Place a chain of wheels: each link joins wheel i to wheel i + 1. Meshing wheels touch; belted
// wheels stand apart; wheels on one shaft share a centre and the later one sits on a new plane,
// in front. Returns null if the wheels cannot be placed without confusion.
const ANGLES = [0, 25, -25, 50, -50, 75, -75].map(a => (a * Math.PI) / 180);
function place(rng, radii, types) {
  const wheels = [{ x: 0, y: 0, plane: 0 }];
  for (let i = 1; i < radii.length; i++) {
    const before = wheels[i - 1], type = types[i - 1];
    if (type === 'shaft') { wheels.push({ x: before.x, y: before.y, plane: before.plane + 1 }); continue; }
    const reach = radii[i - 1] + radii[i] + (type === 'mesh' ? 0 : 2 + Math.floor(rng() * 3) * 0.75);
    let spot = null;
    for (const angle of shuffle(rng, ANGLES)) {
      const x = before.x + reach * Math.cos(angle), y = before.y + reach * Math.sin(angle);
      const clear = wheels.every((w, j) => {
        if (j === i - 1) return true;
        const gap = Math.hypot(w.x - x, w.y - y);
        if (w.x === before.x && w.y === before.y) return gap >= Math.min(radii[j], radii[i]) + 0.8; // the other wheel on this shaft
        return w.plane === before.plane ? gap >= radii[j] + radii[i] + 0.6 : gap >= Math.max(radii[j], radii[i]) + 0.8;
      });
      if (clear) { spot = { x, y, plane: before.plane }; break; }
    }
    if (!spot) return null;
    wheels.push(spot);
  }
  return wheels;
}
// sizes: the ratio numbers; radiusOf(size) the drawn radius.
function chain(rng, sizes, types, radiusOf, { dir = CW, speed = null } = {}) {
  const radii = sizes.map(radiusOf);
  for (let attempt = 0; attempt < 40; attempt++) {
    const spots = place(rng, radii, types);
    if (!spots) continue;
    const wheels = spots.map((spot, i) => ({ id: LETTERS[i], ...spot, r: radii[i], size: sizes[i], toothed: types[i - 1] === 'mesh' || types[i] === 'mesh' }));
    return { wheels, links: types.map((type, i) => ({ type, a: i, b: i + 1 })), driver: 0, dir, speed };
  }
  return null;
}
const TEETH = [8, 10, 12, 15, 16, 20, 24];
const teethRadius = t => t / 4;        // one tooth per quarter unit of radius: all gears share a pitch
const diameterRadius = d => 1.5 * d;   // mixed systems are sized by diameter

// A ring of equal gears, each meshing with the next and the last with the first.
export function ring(n, teeth = 12, tail = false) {
  const r = teethRadius(teeth), R = r / Math.sin(Math.PI / n);
  const wheels = Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n - Math.PI / 2; return { id: LETTERS[i], x: R * Math.cos(a), y: R * Math.sin(a), r, size: teeth, toothed: true, plane: 0 }; });
  const links = wheels.map((_, i) => ({ type: 'mesh', a: i, b: (i + 1) % n }));
  if (tail) {
    const a = (2 * Math.PI * 1) / n - Math.PI / 2;
    wheels.push({ id: LETTERS[n], x: (R + 2 * r) * Math.cos(a), y: (R + 2 * r) * Math.sin(a), r, size: teeth, toothed: true, plane: 0 });
    links.push({ type: 'mesh', a: 1, b: n });
  }
  return { wheels, links, driver: 0, dir: CW, speed: null };
}
export function line(n, teeth = 12) {
  const r = teethRadius(teeth);
  return { wheels: Array.from({ length: n }, (_, i) => ({ id: LETTERS[i], x: 2 * r * i, y: 0, r, size: teeth, toothed: true, plane: 0 })), links: Array.from({ length: n - 1 }, (_, i) => ({ type: 'mesh', a: i, b: i + 1 })), driver: 0, dir: CW, speed: null };
}

// ---------- a rope over fixed pulleys ----------
// The rope runs from a weight, past each pulley on one side or the other, to the end that is
// pulled. `side` is +1 when the pulley's centre is on the right of the rope's travel (y down),
// which makes it turn clockwise as the rope moves towards the pulled end.
// tangent(a, b): the straight piece of rope leaving circle a and arriving at circle b.
function tangent(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), k = b.side * b.r - a.side * a.r;
  if (Math.abs(k) >= L * 0.97) return null;
  const beta = Math.atan2(dy, dx) - Math.asin(k / L), ux = Math.cos(beta), uy = Math.sin(beta);
  // A point p on the rope beside centre c satisfies c − p = σ·m with m = (−uy, ux).
  return { from: [a.x + a.side * a.r * uy, a.y - a.side * a.r * ux], to: [b.x + b.side * b.r * uy, b.y - b.side * b.r * ux], u: [ux, uy] };
}
const segmentGap = (p, q, c) => { const dx = q[0] - p[0], dy = q[1] - p[1], t = Math.max(0, Math.min(1, ((c.x - p[0]) * dx + (c.y - p[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(p[0] + t * dx - c.x, p[1] + t * dy - c.y); };
export function ropePath(rope) {
  const stops = [{ ...rope.weight, r: 0, side: 1 }, ...rope.pulleys, { ...rope.pull, r: 0, side: 1 }];
  const pieces = [];
  for (let i = 0; i + 1 < stops.length; i++) { const t = tangent(stops[i], stops[i + 1]); if (!t) return null; pieces.push(t); }
  const wraps = rope.pulleys.map((p, i) => {
    const a = Math.atan2(pieces[i].to[1] - p.y, pieces[i].to[0] - p.x), b = Math.atan2(pieces[i + 1].from[1] - p.y, pieces[i + 1].from[0] - p.x);
    let turn = (b - a) * p.side; while (turn < 0) turn += 2 * Math.PI; while (turn >= 2 * Math.PI) turn -= 2 * Math.PI;
    return turn;
  });
  return { pieces, wraps };
}
function ropeIsClear(rope) {
  const path = ropePath(rope);
  if (!path) return false;
  if (path.wraps.some(w => w < 0.6 || w > 4.6)) return false;
  for (let i = 0; i < rope.pulleys.length; i++) for (let j = i + 1; j < rope.pulleys.length; j++) if (Math.hypot(rope.pulleys[i].x - rope.pulleys[j].x, rope.pulleys[i].y - rope.pulleys[j].y) < rope.pulleys[i].r + rope.pulleys[j].r + 0.7) return false;
  return path.pieces.every((piece, i) => rope.pulleys.every((p, j) => j === i - 1 || j === i || segmentGap(piece.from, piece.to, p) > p.r + 0.35)
    && path.pieces.every((other, k) => k <= i || !crosses(piece, other) || k === i + 1));
}
function crosses(a, b) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return o(a.from, a.to, b.from) * o(a.from, a.to, b.to) < -1e-9 && o(b.from, b.to, a.from) * o(b.from, b.to, a.to) < -1e-9;
}
export function ropeSystem(rng, n) {
  for (let attempt = 0; attempt < 4000; attempt++) {
    const pulleys = [];
    let x = 0;
    for (let i = 0; i < n; i++) {
      x += i ? 2.4 + rng() * 1.6 : 0;
      pulleys.push({ id: LETTERS[i], x, y: (rng() - 0.5) * 6, r: pick(rng, [0.7, 0.9, 1.1, 1.3]), side: rng() < 0.5 ? 1 : -1 });
    }
    const first = pulleys[0], last = pulleys[n - 1];
    const rope = { pulleys, weight: { x: first.x - 1.6 - rng(), y: Math.max(...pulleys.map(p => p.y)) + 3 }, pull: { x: last.x + 1.6 + rng(), y: Math.max(...pulleys.map(p => p.y)) + 3 } };
    const sides = pulleys.filter(p => p.side === 1).length;
    if (sides >= 2 && n - sides >= 2 && ropeIsClear(rope)) return rope;
  }
  // Fallback that always works: a zig-zag, the rope over the top of high pulleys and under low ones.
  const pulleys = Array.from({ length: n }, (_, i) => ({ id: LETTERS[i], x: i * 3, y: i % 2 ? 2 : -2, r: 1, side: i % 2 ? -1 : 1 }));
  return { pulleys, weight: { x: -2, y: 5 }, pull: { x: (n - 1) * 3 + 2, y: n % 2 ? 5 : -5 } };
}
// Direction of every pulley when the rope moves towards the pulled end (`towardsPull`) or back.
export const ropeDirections = (rope, towardsPull = true) => rope.pulleys.map(p => p.side * (towardsPull ? 1 : -1));

// ---------- levers ----------
// A beam is { length, pivot, loads: [{ at, weight, label }] } with positions in whole units from the left end.
export const moment = beam => beam.loads.reduce((sum, load) => sum + load.weight * (load.at - beam.pivot), 0);
// A mobile is a stick { left, right, a, b }: `a` and `b` are arm lengths; each side is a weight
// { weight, name } or another stick. Sticks and strings weigh nothing.
export const mobileWeight = node => (node.weight !== undefined ? node.weight : mobileWeight(node.left) + mobileWeight(node.right));
export const mobileBalanced = node => node.weight !== undefined || (mobileWeight(node.left) * node.a === mobileWeight(node.right) * node.b && mobileBalanced(node.left) && mobileBalanced(node.right));

// ---------- question helpers ----------
const directionOptions = (truth, locked = false) => [
  { id: 'A', label: 'A', text: 'Clockwise', value: CW }, { id: 'B', label: 'B', text: 'Anticlockwise', value: ACW }, { id: 'C', label: 'C', text: 'It cannot turn', value: 0 }, { id: 'D', label: 'D', text: 'It rocks back and forth', value: 2 },
].map(o => ({ ...o, correct: locked ? o.value === 0 : o.value === truth }));
const linkWords = { mesh: 'meshes with', shaft: 'shares a shaft with', open: 'drives, by an open belt,', crossed: 'drives, by a crossed belt,' };
const linkRule = { mesh: 'meshing gears turn opposite ways', shaft: 'wheels on one shaft turn together', open: 'an open belt keeps the direction', crossed: 'a crossed belt reverses the direction' };
function walkSteps(system, result, withSpeed, sizeWord) {
  const id = i => system.wheels[i].id;
  const says = i => `${id(i)} turns ${dirWord(result.dir[i])}${withSpeed ? ` at ${speedText(result.speed[i])}` : ''}`;
  return [{ text: `Start at the driver: ${says(system.driver)}.` }, ...result.order.map(step => {
    const a = system.wheels[step.from], b = system.wheels[step.to];
    const sum = withSpeed && step.type !== 'shaft' ? ` Speed: ${speedText(result.speed[step.from])} × ${a.size} ÷ ${b.size} = ${speedText(result.speed[step.to])} (${sizeWord} ${a.size} drives ${sizeWord} ${b.size}).` : '';
    return { text: `${a.id} ${linkWords[step.type]} ${b.id}: ${linkRule[step.type]}, so ${says(step.to)}.${sum}` };
  })];
}
const speedText = f => (f.d === 1 ? `${f.n}` : `${f.n}/${f.d}`);
const gearsFigure = (system, extra = {}) => ({ type: 'gears', system, ...extra });
const describeLinks = system => system.links.map(l => `${system.wheels[l.a].id} ${linkWords[l.type]} ${system.wheels[l.b].id}`).join('; ');
function uniqueMistakes(answer, list) {
  const seen = new Set([answer]);
  return list.filter(m => Number.isFinite(m.value) && m.value >= 0 && !seen.has(m.value) && seen.add(m.value));
}
function retry(seed, build) {
  for (let i = 0; i < 80; i++) { const q = build(seededRandom(seed * 1009 + i * 7919)); if (q) return q; }
  throw new Error('No mechanism question for seed ' + seed);
}
const randomTypes = (rng, n, weights) => { const bag = Object.entries(weights).flatMap(([type, w]) => Array(w).fill(type)); return Array.from({ length: n - 1 }, () => pick(rng, bag)); };
// After a shaft the new wheel must be clearly smaller, so both wheels on the shaft can be seen.
function sizesFor(rng, types, pool) {
  const sizes = [pick(rng, pool)];
  for (let i = 0; i < types.length; i++) {
    const options = types[i] === 'shaft' ? pool.filter(s => s < sizes[i]) : pool;
    if (!options.length) return null;
    sizes.push(pick(rng, options));
  }
  return sizes;
}
const validTypes = types => types.every((t, i) => t !== 'shaft' || (i > 0 && types[i - 1] !== 'shaft' && i < types.length - 1 && types[i + 1] !== 'shaft'));

// ---------- direction questions ----------
function directionQuestion(seed, kind, level) {
  return retry(seed, rng => {
    let types;
    if (kind === 'belt-direction') types = Array.from({ length: 2 + Math.floor(rng() * 2) }, () => (rng() < 0.5 ? 'open' : 'crossed'));
    else if (level === 1) types = Array(1 + Math.floor(rng() * 3)).fill('mesh');
    else { types = randomTypes(rng, 4 + Math.floor(rng() * 3), { mesh: 6, shaft: 2, open: 1, crossed: 1 }); if (!validTypes(types) || types.every(t => t === 'mesh')) return null; }
    const mixed = types.some(t => t !== 'mesh');
    const sizes = sizesFor(rng, types, mixed ? [1, 2, 3] : TEETH.slice(0, 5));
    if (!sizes) return null;
    const system = chain(rng, sizes, types, mixed ? diameterRadius : teethRadius, { dir: rng() < 0.5 ? CW : ACW });
    if (!system) return null;
    const result = solve(system), target = system.wheels.length - 1, truth = result.dir[target];
    const options = directionOptions(truth).map(o => ({ ...o, reason: o.correct ? 'Each link in the chain was followed in turn.' : o.value === 0 ? 'Nothing here blocks the wheels: each one is driven along a single path.' : o.value === 2 ? 'Gears and belts pass on steady turning. Nothing here turns it into a rocking motion.' : 'A link was missed or counted twice. Mark an arrow on every wheel, one link at a time.' }));
    const flips = result.order.filter(s => s.type === 'mesh' || s.type === 'crossed').length;
    const driver = system.wheels[0].id, last = system.wheels[target].id;
    return {
      kind, seed, answerMode: 'single', system,
      prompt: `${kind === 'belt-direction' ? 'Pulley' : 'Wheel'} ${driver} turns ${dirWord(system.dir)}. Which way does ${last} turn?`,
      figures: [gearsFigure(system, { caption: mixed ? describeLinks(system) : null })],
      options, answer: options.find(o => o.correct).id,
      explanation: `The direction reverses ${plural(flips, 'time')} between ${driver} and ${last}, so ${last} turns ${dirWord(truth)}.`,
      hints: ['Put an arrow on the driver, then move one link at a time.', 'Meshing gears and crossed belts reverse the arrow. A shared shaft and an open belt copy it.'],
      solution: [...walkSteps(system, result, false), { text: `So ${last} turns ${dirWord(truth)}.` }],
    };
  });
}

// ---------- speed questions ----------
function speedQuestion(seed, kind, level) {
  return retry(seed, rng => {
    let types, pool = TEETH, radiusOf = teethRadius, sizeWord = 'teeth';
    if (kind === 'gear-speed') types = Array(level === 2 ? 1 : 2 + Math.floor(rng() * 2)).fill('mesh');
    else if (kind === 'compound-speed') types = ['mesh', 'shaft', 'mesh'];
    else {
      types = randomTypes(rng, 5 + Math.floor(rng() * 2), { mesh: 4, shaft: 2, open: 2, crossed: 2 });
      if (!validTypes(types) || !types.includes('shaft') || !types.some(t => t === 'open' || t === 'crossed') || !types.includes('mesh')) return null;
      pool = [1, 2, 3, 4]; radiusOf = diameterRadius; sizeWord = 'diameter';
    }
    const sizes = sizesFor(rng, types, pool);
    if (!sizes || new Set(sizes).size < Math.min(sizes.length, 2)) return null;
    const speed = pick(rng, [30, 40, 60, 90, 100, 120, 150, 180, 240, 300, 360]);
    const system = chain(rng, sizes, types, radiusOf, { dir: rng() < 0.5 ? CW : ACW, speed });
    if (!system) return null;
    const result = solve(system), target = system.wheels.length - 1, value = whole(result.speed[target]);
    if (value === null || value < 5 || value > 2000 || value === speed) return null;
    const first = system.wheels[0], last = system.wheels[target];
    const ignoreShafts = whole(frac(speed * first.size, last.size)), inverted = whole(frac(speed * last.size, first.size)), firstStep = whole(result.speed[1]);
    const mistakes = uniqueMistakes(value, [
      { value: inverted, reason: 'The ratio is upside down. A wheel driven by a bigger one turns faster, not slower.' },
      kind !== 'gear-speed' ? { value: ignoreShafts, reason: `That treats the whole system as one pair, ${first.id} and ${last.id}. Wheels on a shared shaft pass on their speed unchanged, so each stage has its own ratio.` } : { value: NaN },
      target > 1 ? { value: firstStep, reason: `That is the speed of ${system.wheels[1].id}. Carry on to ${last.id}.` } : { value: NaN },
      { value: speed, reason: `${last.id} is a different size from the wheel that drives it, so its speed changes.` },
    ]);
    const sizeList = system.wheels.map(w => `${w.id} ${w.size}`).join(', ');
    const base = {
      kind, seed, system, unit: 'turns a minute',
      prompt: `${first.id} makes ${speed} turns a minute. How many turns a minute does ${last.id} make? ${sizeWord === 'diameter' ? 'Diameters' : 'Teeth'}: ${sizeList}.`,
      figures: [gearsFigure(system, { showSizes: true, sizeWord, caption: types.some(t => t !== 'mesh') ? describeLinks(system) : null })],
      explanation: kind === 'gear-speed' && target > 1
        ? `Only the first and last gears set the ratio; the gears between them pass the same tooth speed along. ${speed} × ${first.size} ÷ ${last.size} = ${value}.`
        : `Speed × ${sizeWord} is the same on both wheels of a pair, and wheels on one shaft share a speed. ${last.id} makes ${value} turns a minute.`,
      hints: [`For two wheels joined by teeth or a belt: speed × ${sizeWord} is the same for both.`, 'Wheels on one shaft turn at the same speed. Write the speed beside each wheel as you go.'],
      solution: [...walkSteps(system, result, true, sizeWord), { text: `So ${last.id} makes ${value} turns a minute.` }],
    };
    if (kind === 'gear-speed' && level === 2) {
      const wrong = shuffle(rng, [...new Set([inverted, speed, value * 2, Math.round(value / 2), speed + value])].filter(v => Number.isFinite(v) && v !== value && v > 0)).slice(0, 3);
      if (wrong.length < 3) return null;
      const options = shuffle(rng, [{ value, correct: true }, ...wrong.map(v => ({ value: v, correct: false }))]).map((o, i) => ({ ...o, id: 'ABCD'[i], label: 'ABCD'[i], text: `${o.value} turns a minute`,
        reason: o.correct ? `${speed} × ${first.size} ÷ ${last.size} = ${value}.` : o.value === inverted ? 'The ratio is upside down: the smaller gear is the faster one.' : o.value === speed ? 'The gears are different sizes, so their speeds differ.' : `Use speed × teeth: ${speed} × ${first.size} = ${last.id}'s speed × ${last.size}.` }));
      return { ...base, answerMode: 'single', options, answer: options.find(o => o.correct).id };
    }
    return { ...base, answerMode: 'numeric', answer: { value }, mistakes };
  });
}

// ---------- counting clockwise wheels ----------
function countQuestion(seed) {
  return retry(seed, rng => {
    const types = randomTypes(rng, 5 + Math.floor(rng() * 3), { mesh: 5, shaft: 2, open: 2, crossed: 2 });
    if (!validTypes(types) || types.filter(t => t !== 'mesh').length < 2) return null;
    const sizes = sizesFor(rng, types, [1, 2, 3]);
    if (!sizes) return null;
    const system = chain(rng, sizes, types, diameterRadius, { dir: rng() < 0.5 ? CW : ACW });
    if (!system) return null;
    const result = solve(system), n = system.wheels.length, value = result.dir.filter(d => d === CW).length;
    const swap = (from, to) => solve({ ...system, links: system.links.map(l => (l.type === from ? { ...l, type: to } : l)) }).dir.filter(d => d === CW).length;
    if (value === 0 || value === n) return null;
    return {
      kind: 'count-clockwise', seed, answerMode: 'numeric', unit: 'wheels', system,
      prompt: `${system.wheels[0].id} turns ${dirWord(system.dir)}. How many of the ${n} wheels turn clockwise? Count ${system.wheels[0].id} if it does.`,
      figures: [gearsFigure(system, { caption: describeLinks(system) })],
      answer: { value },
      mistakes: uniqueMistakes(value, [
        { value: n - value, reason: 'That is the number turning anticlockwise.' },
        { value: swap('open', 'crossed'), reason: 'An open belt does not reverse the direction. Only a crossed belt does.' },
        { value: swap('crossed', 'open'), reason: 'A crossed belt reverses the direction.' },
        { value: swap('shaft', 'mesh'), reason: 'Two wheels on one shaft turn the same way.' },
      ]),
      explanation: `Clockwise: ${system.wheels.filter((_, i) => result.dir[i] === CW).map(w => w.id).join(', ')}. That is ${value}.`,
      hints: ['Draw an arrow on every wheel before you count.', 'Reverse at a mesh or a crossed belt. Copy at a shared shaft or an open belt.'],
      solution: [...walkSteps(system, result, false), { text: `Clockwise: ${system.wheels.filter((_, i) => result.dir[i] === CW).map(w => w.id).join(', ')}. The answer is ${value}.` }],
    };
  });
}

// ---------- a rope over many pulleys ----------
function ropeQuestion(seed) {
  const rng = seededRandom(seed * 31 + 5);
  const n = 6 + Math.floor(rng() * 4), rope = ropeSystem(rng, n), towardsPull = rng() < 0.6;
  const dirs = ropeDirections(rope, towardsPull), value = dirs.filter(d => d === CW).length;
  const names = rope.pulleys.filter((_, i) => dirs[i] === CW).map(p => p.id).join(', ');
  return {
    kind: 'rope-count', seed, answerMode: 'numeric', unit: 'pulleys', rope, towardsPull,
    prompt: `One rope runs from the weight past ${n} fixed pulleys to the end marked with an arrow. ${towardsPull ? 'The arrow end is pulled, so the weight rises.' : 'The arrow end is let out, so the weight goes down.'} How many pulleys turn clockwise?`,
    figures: [{ type: 'rope', rope, towardsPull }],
    answer: { value },
    mistakes: uniqueMistakes(value, [{ value: n - value, reason: 'That is the number turning anticlockwise. Check which way the rope is moving.' }, { value: Math.ceil(n / 2), reason: 'The pulleys do not simply alternate. The direction changes only where the rope crosses to the other side of a pulley.' }, { value: Math.floor(n / 2), reason: 'The pulleys do not simply alternate. The direction changes only where the rope crosses to the other side of a pulley.' }]),
    explanation: `Clockwise: ${names}. That is ${value} of the ${n}.`,
    hints: ['Follow the rope from one end to the other. Never judge a pulley on its own.', 'Where the rope touches a pulley, the rim moves with the rope. Rope moving right over the top turns the pulley clockwise.'],
    solution: [
      { text: `The rope moves ${towardsPull ? 'from the weight towards the arrow end' : 'from the arrow end towards the weight'}. Follow it in that direction.` },
      { text: 'At each pulley, see which part of the rim the rope touches. The rim moves the way the rope moves there.' },
      ...rope.pulleys.map((p, i) => ({ text: `${p.id}: ${dirWord(dirs[i])}.` })),
      { text: `Clockwise: ${names}. The answer is ${value}.` },
    ],
  };
}

// ---------- when do the marks meet again? ----------
function realignQuestion(seed) {
  const rng = seededRandom(seed * 17 + 3);
  const [a, b] = pick(rng, [[11, 8], [12, 8], [15, 10], [20, 12], [16, 12], [24, 16], [10, 8], [15, 12], [20, 16], [24, 10], [16, 10], [12, 10], [20, 8], [15, 8]]);
  const g = gcd(a, b), askB = rng() < 0.6;
  const system = { wheels: [{ id: 'A', x: 0, y: 0, r: teethRadius(a), size: a, toothed: true, plane: 0 }, { id: 'B', x: teethRadius(a) + teethRadius(b), y: 0, r: teethRadius(b), size: b, toothed: true, plane: 0 }], links: [{ type: 'mesh', a: 0, b: 1 }], driver: 0, dir: rng() < 0.5 ? CW : ACW, speed: null };
  const value = askB ? a / g : b / g, other = askB ? b / g : a / g, asked = askB ? 'B' : 'A';
  return {
    kind: 'gear-realign', seed, answerMode: 'numeric', unit: 'turns', system,
    prompt: `Gear A has ${a} teeth and gear B has ${b}. A mark on each gear is at the point where they touch. How many complete turns must gear ${asked} make before the two marks meet there again?`,
    figures: [gearsFigure(system, { showSizes: true, sizeWord: 'teeth', marks: true })],
    answer: { value },
    mistakes: uniqueMistakes(value, [{ value: other, reason: `That is the number of turns gear ${askB ? 'A' : 'B'} makes. The question asks about gear ${asked}.` }, { value: askB ? a : b, reason: 'The two tooth counts share a factor, so the marks meet sooner than that.' }, { value: (a * b) / g, reason: 'That is the number of teeth that pass, not the number of turns.' }]),
    explanation: `The marks meet when a whole number of turns of both gears has passed the same number of teeth: the lowest common multiple of ${a} and ${b}, which is ${(a * b) / g}. Gear ${asked} has ${askB ? b : a} teeth, so it makes ${(a * b) / g} ÷ ${askB ? b : a} = ${value} turns.`,
    hints: ['Count teeth, not turns. Each tooth that passes on A is one tooth on B.', `The marks are together again when the teeth passed is a multiple of both ${a} and ${b}.`],
    solution: [
      { text: 'Each tooth of A that passes the meeting point pushes one tooth of B past it.' },
      { text: `A's mark returns after every ${a} teeth, B's after every ${b}. Both are back together after a number of teeth that is a multiple of both.` },
      { text: `The lowest common multiple of ${a} and ${b} is ${(a * b) / g}.` },
      { text: `Gear ${asked} has ${askB ? b : a} teeth: ${(a * b) / g} ÷ ${askB ? b : a} = ${value} turns.` },
    ],
  };
}

// ---------- will it move? ----------
function moveQuestion(seed) {
  const rng = seededRandom(seed * 13 + 1);
  const pool = [['ring', 3, false], ['ring', 4, false], ['ring', 5, false], ['ring', 6, false], ['line', 3], ['line', 4], ['ring', 3, true], ['ring', 4, true], ['ring', 5, true], ['ring', 6, true]];
  let chosen, can;
  for (let guard = 0; guard < 50; guard++) {
    chosen = shuffle(rng, pool).slice(0, 4).map(([shape, n, tail]) => ({ shape, n, tail, system: shape === 'ring' ? ring(n, 12, tail) : line(n) }));
    can = chosen.map(c => !solve(c.system).locked);
    const count = can.filter(Boolean).length;
    if (count >= 1 && count <= 3) break;
  }
  const options = chosen.map((c, i) => ({
    id: 'ABCD'[i], label: 'ABCD'[i], correct: can[i], figure: gearsFigure(c.system, { plain: true }),
    reason: c.shape === 'line' ? 'A simple chain always turns: each gear is driven by one neighbour only.'
      : can[i] ? `${c.n} gears in a ring: going round, the direction reverses ${c.n} times, an even number, and arrives back unchanged. It turns${c.tail ? ', and the extra gear turns with it' : ''}.`
        : `${c.n} gears in a ring: going round, the direction reverses ${c.n} times, an odd number, so the first gear would have to turn both ways at once. It is locked${c.tail ? ', and the extra gear with it' : ''}.`,
  }));
  const right = options.filter(o => o.correct).map(o => o.id);
  return {
    kind: 'will-it-move', seed, answerMode: 'multi', figures: [],
    prompt: 'In each system every gear meshes with the gears it touches. Which of these systems can turn?',
    options, answer: right,
    explanation: 'A ring of meshing gears turns only if it has an even number of gears. A chain with free ends always turns.',
    hints: ['Mark gear A clockwise and go round the ring, reversing at each gear. Do you arrive back at A with the same arrow?', 'A gear hanging off a ring does whatever the ring does.'],
    solution: [{ text: 'Mark one gear clockwise. Go round, reversing the arrow at each mesh.' }, { text: 'If the ring has an odd number of gears, the arrow comes back reversed: the system is locked.' }, ...options.map(o => ({ text: `Option ${o.label}: ${o.reason}` })), { text: `So the answer is ${right.join(' and ')}.` }],
  };
}

// ---------- levers ----------
function leverQuestion(seed) {
  return retry(seed, rng => {
    const length = 8 + Math.floor(rng() * 5), pivot = 2 + Math.floor(rng() * (length - 3));
    const leftSpots = shuffle(rng, Array.from({ length: pivot }, (_, i) => i)).slice(0, rng() < 0.5 && pivot >= 2 ? 2 : 1);
    const loads = leftSpots.map((at, i) => ({ at, weight: pick(rng, [2, 3, 4, 5, 6, 8, 10, 12]), label: LETTERS[i] }));
    const need = -moment({ pivot, loads });
    const arms = Array.from({ length: length - pivot }, (_, i) => i + 1).filter(d => need % d === 0 && need / d <= 60 && need / d >= 1);
    if (!arms.length) return null;
    const arm = pick(rng, arms), weight = need / arm, askWeight = rng() < 0.6;
    if (!askWeight && arm < 2) return null;
    const unknown = LETTERS[loads.length];
    const beam = { length, pivot, loads: [...loads, { at: pivot + arm, weight, label: unknown, hidden: askWeight }] };
    const leftText = loads.map(l => `${l.weight} × ${pivot - l.at}`).join(' + ');
    const value = askWeight ? weight : arm;
    const totalLeft = loads.reduce((s, l) => s + l.weight, 0);
    return {
      kind: 'lever-balance', seed, answerMode: 'numeric', unit: askWeight ? 'kg' : 'units', beam,
      prompt: askWeight
        ? `The beam balances on the pivot. Each mark is 1 unit. ${loads.map(l => `${l.label} weighs ${l.weight} kg`).join(' and ')}. How many kilograms does ${unknown} weigh? The beam itself weighs nothing.`
        : `${loads.map(l => `${l.label} weighs ${l.weight} kg`).join(', ')} and ${unknown} weighs ${weight} kg. How many units from the pivot must ${unknown} hang for the beam to balance? The beam itself weighs nothing.`,
      figures: [{ type: 'beam', beam: askWeight ? beam : { ...beam, loads: loads }, ask: askWeight ? null : { label: unknown, weight } }],
      answer: { value },
      mistakes: uniqueMistakes(value, [
        { value: totalLeft, reason: 'Equal weights balance only at equal distances. Use weight × distance on each side.' },
        { value: askWeight ? need : need, reason: 'That is the turning effect of the left side. Divide it by the distance (or the weight) on the right.' },
        { value: askWeight ? Math.round(need / (pivot + arm)) : pivot + arm, reason: 'Measure distances from the pivot, not from the end of the beam.' },
      ]),
      explanation: `Turning effect = weight × distance from the pivot. Left side: ${leftText} = ${need}. Right side must match: ${need} ÷ ${askWeight ? arm : weight} = ${value}.`,
      hints: ['For each weight, multiply it by its distance from the pivot.', 'The totals on the two sides of the pivot must be equal.'],
      solution: [
        { text: `Left of the pivot: ${leftText} = ${need}.` },
        { text: askWeight ? `${unknown} hangs ${arm} ${arm === 1 ? 'unit' : 'units'} from the pivot. Its weight × ${arm} must equal ${need}.` : `${unknown} weighs ${weight} kg. ${weight} × its distance must equal ${need}.` },
        { text: `${need} ÷ ${askWeight ? arm : weight} = ${value}${askWeight ? ' kg' : ' units'}.` },
      ],
    };
  });
}
const COLOURS = [['red', '#d64b3c'], ['blue', '#3f78c9'], ['green', '#3f9d5e'], ['orange', '#e58a2c'], ['black', '#1e2a27']];
function mobileQuestion(seed) {
  return retry(seed, rng => {
    const levels = 3 + (rng() < 0.4 ? 1 : 0), names = shuffle(rng, COLOURS).slice(0, levels + 1);
    // Build from the bottom stick upward so every weight is a whole number.
    const [a, b] = pick(rng, [[1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2], [1, 1]]), k = pick(rng, [1, 2, 3, 5]);
    let node = { left: { weight: b * k, name: names[0] }, right: { weight: a * k, name: names[1] }, a, b };
    for (let level = 2; level <= levels; level++) {
      const total = mobileWeight(node);
      const arms = shuffle(rng, [[1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2], [1, 1], [1, 4], [4, 1]]).find(([c, d]) => (total * c) % d === 0 && (total * c) / d <= 90);
      if (!arms) return null;
      const [c, d] = arms, leaf = { weight: (total * c) / d, name: names[level] };
      // The sub-mobile hangs `c` from the string; the new weight hangs `d` from it. Alternate sides for a spread-out figure.
      node = level % 2 ? { left: leaf, right: node, a: d, b: c } : { left: node, right: leaf, a: c, b: d };
    }
    if (!mobileBalanced(node)) return null;
    const leaves = []; (function collect(nd) { if (nd.weight !== undefined) leaves.push(nd); else { collect(nd.left); collect(nd.right); } })(node);
    const known = leaves.find(l => l.name === names[0]), asked = leaves.find(l => l.name === names[levels]);
    if (asked.weight === known.weight) return null;
    const steps = []; (function explain(nd) {
      if (nd.weight !== undefined) return nd.weight;
      const l = explain(nd.left), r = explain(nd.right);
      // In this chain one side of every stick is a single weight; the other side is already known.
      const leafRight = nd.right.weight !== undefined && nd.right !== known;
      steps.push(leafRight ? `${l} × ${nd.a} = ${nd.right.name[0]} × ${nd.b}, so the ${nd.right.name[0]} weight is ${r} g. This stick carries ${l + r} g in all.`
        : `${r} × ${nd.b} = ${nd.left.name[0]} × ${nd.a}, so the ${nd.left.name[0]} weight is ${l} g. This stick carries ${l + r} g in all.`);
      return l + r;
    })(node);
    return {
      kind: 'mobile-balance', seed, answerMode: 'numeric', unit: 'g', mobile: node,
      prompt: `This hanging mobile is balanced. Each mark on a stick is 1 unit. The ${known.name[0]} weight is ${known.weight} g. How many grams is the ${asked.name[0]} weight? Sticks and strings weigh nothing.`,
      figures: [{ type: 'mobile', mobile: node, known: known.name[0] }],
      answer: { value: asked.weight },
      mistakes: uniqueMistakes(asked.weight, [{ value: mobileWeight(node) - asked.weight, reason: `That is everything hanging on the other end of the top stick. Balance it against the ${asked.name[0]} weight using the arm lengths.` }, { value: known.weight, reason: 'The arms are not equal, so the weights are not equal.' }, { value: mobileWeight(node), reason: 'That is the weight of the whole mobile.' }]),
      explanation: `Work up from the known weight, one stick at a time, using weight × arm on each side. The ${asked.name[0]} weight is ${asked.weight} g.`,
      hints: ['Start at the stick that holds the known weight. Weight × arm is the same on both sides.', 'Everything hanging from a stick pulls on the string above it: add the two sides before moving up.'],
      solution: [{ text: `Start at the lowest stick, with the ${known.name[0]} weight of ${known.weight} g.` }, ...steps.map(text => ({ text })), { text: `The ${asked.name[0]} weight is ${asked.weight} g.` }],
    };
  });
}

// ---------- registry ----------
export function mechanismQuestion(seed, kind, level) {
  switch (kind) {
    case 'gear-direction': case 'belt-direction': return directionQuestion(seed, kind, level);
    case 'gear-speed': case 'compound-speed': case 'system-speed': return speedQuestion(seed, kind, level);
    case 'count-clockwise': return countQuestion(seed);
    case 'rope-count': return ropeQuestion(seed);
    case 'gear-realign': return realignQuestion(seed);
    case 'will-it-move': return moveQuestion(seed);
    case 'lever-balance': return leverQuestion(seed);
    case 'mobile-balance': return mobileQuestion(seed);
    default: throw new Error('Unknown mechanism kind ' + kind);
  }
}

// ---------- presets for the tool ----------
export function presetSystem(name, { count = 3, crossed = false, big = false } = {}) {
  const rng = seededRandom(7);
  if (name === 'pair') return chain(rng, [big ? 20 : 12, 12], ['mesh'], teethRadius, { speed: 60 });
  if (name === 'chain') { const s = line(count); return { ...s, speed: 60 }; }
  if (name === 'belt') return { wheels: [{ id: 'A', x: 0, y: 0, r: 3, size: 2, toothed: false, plane: 0 }, { id: 'B', x: 9, y: 0, r: big ? 4.5 : 1.5, size: big ? 3 : 1, toothed: false, plane: 0 }], links: [{ type: crossed ? 'crossed' : 'open', a: 0, b: 1 }], driver: 0, dir: CW, speed: 60 };
  if (name === 'compound') return { wheels: [{ id: 'A', x: 0, y: 0, r: 2, size: 8, toothed: true, plane: 0 }, { id: 'B', x: 6, y: 0, r: 4, size: 16, toothed: true, plane: 0 }, { id: 'C', x: 6, y: 0, r: 2, size: 8, toothed: true, plane: 1 }, { id: 'D', x: 6 + (2 + 5) * Math.cos(-0.5), y: (2 + 5) * Math.sin(-0.5), r: 5, size: 20, toothed: true, plane: 1 }], links: [{ type: 'mesh', a: 0, b: 1 }, { type: 'shaft', a: 1, b: 2 }, { type: 'mesh', a: 2, b: 3 }], driver: 0, dir: CW, speed: 60 };
  if (name === 'ring') return { ...ring(count, 12), speed: 60 };
  // mixed: gears, a shaft and a belt
  return { wheels: [{ id: 'A', x: 0, y: 0, r: 4.5, size: 3, toothed: true, plane: 0 }, { id: 'B', x: 6, y: 0, r: 1.5, size: 1, toothed: true, plane: 0 }, { id: 'C', x: 10.5, y: 0, r: 3, size: 2, toothed: true, plane: 0 }, { id: 'D', x: 10.5, y: 0, r: 1.5, size: 1, toothed: false, plane: 1 }, { id: 'E', x: 19, y: 0, r: 4.5, size: 3, toothed: false, plane: 1 }], links: [{ type: 'mesh', a: 0, b: 1 }, { type: 'mesh', a: 1, b: 2 }, { type: 'shaft', a: 2, b: 3 }, { type: crossed ? 'crossed' : 'open', a: 3, b: 4 }], driver: 0, dir: CW, speed: 60 };
}
