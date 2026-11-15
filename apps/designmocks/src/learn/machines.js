// More machines: lever classes and effort, pulley blocks, rigid frames,
// toppling and centre of gravity, and rolling. Part of the mechanisms
// programme; specification docs/learn/topics/mechanisms.md (more machines).
import { pick, seededRandom, shuffle } from './random.js';

const LETTERS = 'ABCD';
function retry(seed, build) {
  for (let i = 0; i < 800; i++) { const q = build(seededRandom(seed * 9241 + i * 5413)); if (q) return q; }
  throw new Error('No machines question for seed ' + seed);
}
const lettered = (rng, list) => {
  const options = shuffle(rng, list).map((o, i) => ({ ...o, id: LETTERS[i], label: LETTERS[i] }));
  return { options, answer: options.find(o => o.correct).id };
};
const dedupe = (value, list) => list.map(m => ({ ...m, value: Math.round(m.value * 100) / 100 })).filter((m, i, l) => m.value > 0 && m.value !== value && l.findIndex(o => o.value === m.value) === i);

// ---------- levers ----------
// Class by what sits in the middle: 1 fulcrum, 2 load, 3 effort.
export const LEVER_EXAMPLES = Object.freeze({ 'a see-saw': 1, 'a pair of scissors': 1, 'a crowbar lifting a stone': 1, 'pliers': 1, 'a wheelbarrow': 2, 'a nutcracker': 2, 'a bottle opener': 2, 'an oar rowing a boat': 2, 'a pair of tweezers': 3, 'a fishing rod': 3, 'a broom sweeping': 3, 'your forearm lifting a cup': 3 });
const CLASS_TEXT = ['Class 1: the pivot in the middle', 'Class 2: the load in the middle', 'Class 3: the effort in the middle', 'Not a lever'];
export function leverClassQuestion(seed) {
  return retry(seed, rng => {
    const fromFigure = rng() < 0.5;
    let cls, prompt, figures;
    if (fromFigure) {
      const order = shuffle(rng, ['F', 'L', 'E']), mid = order[1];
      cls = { F: 1, L: 2, E: 3 }[mid];
      prompt = 'Where the pivot (F), the load (L) and the effort (E) sit along this lever, which class is it?';
      figures = [{ type: 'lever-line', order }];
    } else {
      const name = pick(rng, Object.keys(LEVER_EXAMPLES)); cls = LEVER_EXAMPLES[name];
      prompt = `Which class of lever is ${name}?`; figures = [];
    }
    const { options, answer } = lettered(rng, CLASS_TEXT.map((t, i) => ({ correct: i + 1 === cls, text: t, reason: i + 1 === cls ? `${['The pivot', 'The load', 'The effort'][cls - 1]} sits between the other two.` : i === 3 ? 'It turns about a pivot under an effort and a load, so it is a lever.' : `For class ${i + 1}, ${['the pivot', 'the load', 'the effort'][i]} would have to be in the middle.` })));
    return { kind: 'lever-class', seed, answerMode: 'single', prompt, figures, options, answer, explanation: 'Name the middle one: pivot in the middle is class 1 (see-saw), load in the middle is class 2 (wheelbarrow), effort in the middle is class 3 (tweezers). Class 2 always saves effort; class 3 always costs effort but gains movement.' };
  });
}
export function leverEffortQuestion(seed) {
  return retry(seed, rng => {
    const cls = pick(rng, [1, 2, 3]), load = pick(rng, [60, 80, 90, 120, 150, 200, 240, 300]);
    let a = pick(rng, [0.2, 0.3, 0.4, 0.5, 0.6]), b = pick(rng, [0.4, 0.6, 0.8, 1, 1.2, 1.5]);
    // a: load to pivot, b: effort to pivot
    if (cls === 2 && b <= a) return null;
    if (cls === 3 && b >= a) [a, b] = [b, a];
    if (cls === 3 && b >= a) return null;
    const value = (load * a) / b;
    if (!Number.isInteger(value * 2)) return null;
    const words = cls === 1 ? `A crowbar pivots on a stone. The load of ${load} N is ${a} m from the pivot on one side; you push down ${b} m from the pivot on the other side.` : cls === 2 ? `A wheelbarrow carries ${load} N, ${a} m from the wheel's axle. You lift the handles ${b} m from the axle.` : `A forearm holds a ${load} N weight ${a} m from the elbow. The muscle pulls ${b} m from the elbow.`;
    return {
      kind: 'lever-effort', seed, answerMode: 'numeric', unit: 'N', cls,
      prompt: `${words} What effort balances it, in newtons?`,
      figures: [{ type: 'lever-line', order: cls === 1 ? ['L', 'F', 'E'] : cls === 2 ? ['F', 'L', 'E'] : ['F', 'E', 'L'], arms: { load: a, effort: b } }],
      answer: { value }, mistakes: dedupe(value, [{ value: (load * b) / a, reason: 'Arms swapped: load × load arm = effort × effort arm.' }, { value: load, reason: 'A lever changes the force needed unless the arms are equal.' }, { value: load * a * b, reason: 'Divide by the effort arm; do not multiply.' }]),
      explanation: `Turning effects balance: effort × ${b} = ${load} × ${a}, so effort = ${load} × ${a} ÷ ${b} = ${value} N.${cls === 3 ? ' The effort is more than the load: class 3 levers trade force for movement.' : ''}`,
      hints: ['Measure both arms from the pivot.', 'Effort × effort arm = load × load arm.'],
      solution: [{ text: `Load turning effect: ${load} × ${a} = ${load * a} N m.` }, { text: `Effort arm: ${b} m.` }, { text: `Effort = ${load * a} ÷ ${b} = ${value} N.` }],
    };
  });
}

// ---------- pulley blocks ----------
// strands: rope segments holding the moving block; endOnBlock: the rope's
// fixed end ties to the moving block (odd strands).
export function pulleyQuestion(seed, level = 3) {
  return retry(seed, rng => {
    const strands = level <= 3 ? pick(rng, [2, 3, 4]) : pick(rng, [3, 4, 5, 6]), load = pick(rng, [120, 180, 240, 300, 360, 420, 600]);
    const ask = level >= 4 ? pick(rng, ['effort', 'pull']) : 'effort', lift = pick(rng, [0.5, 1, 1.5, 2]);
    const value = ask === 'effort' ? load / strands : lift * strands;
    if (!Number.isInteger(value * 2)) return null;
    const pulleys = strands % 2 ? 'the rope’s fixed end is tied to the bottom block' : 'the rope’s fixed end is tied to the top block';
    return {
      kind: 'pulley-effort', seed, answerMode: 'numeric', unit: ask === 'effort' ? 'N' : 'm', strands,
      prompt: ask === 'effort' ? `A ${load} N load hangs from the bottom block of this pulley system (${pulleys}). Ignoring friction and the weight of the pulleys, what pull on the free end holds it up, in newtons?` : `With this pulley system, how much rope must be pulled through to lift the load ${lift} m, in metres?`,
      figures: [{ type: 'pulley-block', strands }],
      answer: { value }, mistakes: dedupe(value, ask === 'effort' ? [{ value: load / (strands - 1), reason: 'Count every rope strand that holds up the bottom block, including the one tied to it.' }, { value: load / (strands + 1), reason: 'The free end you pull is not holding the bottom block unless it leaves from that block.' }, { value: load, reason: 'Each strand holding the block shares the load.' }] : [{ value: lift, reason: 'Every holding strand must shorten by the lift, so you pull more rope.' }, { value: lift / strands, reason: 'Less force means more rope, not less.' }, { value: lift * (strands - 1), reason: 'Count all the strands holding the bottom block.' }]),
      explanation: ask === 'effort' ? `${strands} strands hold up the bottom block and share the load equally: ${load} ÷ ${strands} = ${value} N.` : `Each of the ${strands} holding strands must shorten by ${lift} m: ${strands} × ${lift} = ${value} m of rope. Less force, more rope.`,
      hints: ['Count the rope strands going into the bottom block.', ask === 'effort' ? 'They share the load equally.' : 'Each of those strands shortens by the lift height.'],
      solution: [{ text: `Strands holding the bottom block: ${strands}.` }, { text: ask === 'effort' ? `Each carries ${load} ÷ ${strands}.` : `Each shortens by ${lift} m.` }, { text: ask === 'effort' ? `Pull on the free end: ${value} N.` : `Rope pulled: ${value} m.` }],
    };
  });
}

// ---------- rigid frames ----------
// Rank of the 2D rigidity matrix by Gaussian elimination; rigid when rank = 2J − 3.
export function rigidityRank(points, bars) {
  const rows = bars.map(([i, j]) => { const r = Array(points.length * 2).fill(0), dx = points[i][0] - points[j][0], dy = points[i][1] - points[j][1]; r[2 * i] = dx; r[2 * i + 1] = dy; r[2 * j] = -dx; r[2 * j + 1] = -dy; return r; });
  let rank = 0;
  const cols = points.length * 2;
  for (let c = 0; c < cols && rank < rows.length; c++) {
    let p = rank; for (let r = rank + 1; r < rows.length; r++) if (Math.abs(rows[r][c]) > Math.abs(rows[p][c])) p = r;
    if (Math.abs(rows[p][c]) < 1e-9) continue;
    [rows[rank], rows[p]] = [rows[p], rows[rank]];
    for (let r = 0; r < rows.length; r++) if (r !== rank) { const f = rows[r][c] / rows[rank][c]; for (let k = c; k < cols; k++) rows[r][k] -= f * rows[rank][k]; }
    rank++;
  }
  return rank;
}
export const isRigid = (points, bars) => rigidityRank(points, bars) === 2 * points.length - 3;
function framePolygon(rng, n) {
  // A convex polygon with slightly jittered corners so no three are in line.
  return Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n + Math.PI / n + (rng() - 0.5) * 0.25, r = 2 + (rng() - 0.5) * 0.4; return [Math.round((2.5 + r * Math.cos(a)) * 100) / 100, Math.round((2.5 + r * Math.sin(a)) * 100) / 100]; });
}
function frame(rng, n, extra) {
  const points = framePolygon(rng, n), bars = points.map((_, i) => [i, (i + 1) % n]), diag = [];
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) if (!(i === 0 && j === n - 1)) diag.push([i, j]);
  return { points, bars: [...bars, ...shuffle(rng, diag).slice(0, extra)] };
}
const frameFig = f => ({ type: 'frame', points: f.points, bars: f.bars });
export function frameQuestion(seed, level = 3) {
  return retry(seed, rng => {
    if (level >= 4) {
      const n = pick(rng, [5, 6]), f = frame(rng, n, Math.floor(rng() * (n - 3))), value = 2 * n - 3 - rigidityRank(f.points, f.bars);
      if (value < 1) return null;
      return {
        kind: 'rigid-frame', seed, answerMode: 'numeric', unit: '', frame: f,
        prompt: 'This frame is made of bars pinned at their ends, so each joint can turn. What is the smallest number of extra bars needed to make it rigid?',
        figures: [frameFig(f)], answer: { value }, mistakes: dedupe(value, [{ value: value + 1, reason: 'Each well-placed bar removes one way to wobble; you need exactly as many as there are wobbles.' }, { value: n - 3 - (f.bars.length - n) + 1, reason: 'A frame of J joints needs 2J − 3 bars in total, placed so that every part is triangulated.' }]),
        explanation: `A pinned frame with ${n} joints needs 2 × ${n} − 3 = ${2 * n - 3} well-placed bars to be rigid. It has ${f.bars.length}, ${2 * n - 3 - value} of them doing useful work, so ${value} more are needed.`,
        hints: ['Triangles are rigid; any panel with four or more sides can fold.', 'Count the panels that are not triangles, and how many diagonals each needs.'],
        solution: [{ text: `Joints: ${n}. A rigid frame needs ${2 * n - 3} bars, all doing work.` }, { text: 'Look for panels that are not triangles: a four-sided panel needs one diagonal, a five-sided panel two.' }, { text: `Extra bars needed: ${value}.` }],
      };
    }
    const n = pick(rng, [4, 5]), rigid = frame(rng, n, n - 3), loose = [frame(rng, n, n - 4 < 0 ? 0 : n - 4), frame(rng, n + 1, n - 3), frame(rng, n, 0)];
    if (!isRigid(rigid.points, rigid.bars) || loose.some(f => isRigid(f.points, f.bars))) return null;
    const { options, answer } = lettered(rng, [{ correct: true, figure: frameFig(rigid), reason: 'Every panel is a triangle, so nothing can fold.' }, ...loose.map(f => ({ correct: false, figure: frameFig(f), reason: 'A panel with four or more sides is left, so the frame can fold out of shape.' }))]);
    return {
      kind: 'rigid-frame', seed, answerMode: 'single',
      prompt: 'Each frame is made of bars pinned at their ends, so the joints can turn. Which frame is rigid?',
      figures: [], options, answer,
      explanation: 'A triangle cannot change shape once its sides are fixed. Any panel with four or more sides can lean over like a parallelogram. A frame is rigid when diagonals split it into triangles.',
      hints: ['Look for any panel that is not a triangle.'], solution: [{ text: 'A triangle keeps its shape; a four-sided panel folds.' }, ...options.map(o => ({ text: `${o.label}: ${o.reason}` }))],
    };
  });
}

// ---------- toppling ----------
export function centroid(poly) {
  let a = 0, cx = 0, cy = 0;
  poly.forEach(([x, y], i) => { const [u, v] = poly[(i + 1) % poly.length], c = x * v - u * y; a += c; cx += (x + u) * c; cy += (y + v) * c; });
  return [cx / (3 * a), cy / (3 * a)];
}
function block(rng) {
  // A block standing on the ground (y = 0): leaning, or with an arm sticking out at the top.
  const w = 1 + Math.floor(rng() * 2), h = 2 + Math.floor(rng() * 3);
  if (rng() < 0.5) { const lean = pick(rng, [-3, -2, -1, 1, 2, 3]), wt = w + Math.floor(rng() * 2); return [[0, 0], [w, 0], [lean + wt, h], [lean, h]]; }
  const arm = 1 + Math.floor(rng() * 4), right = rng() < 0.5;
  const poly = [[0, 0], [w, 0], [w, h], [w + arm, h], [w + arm, h + 1], [0, h + 1]];
  return right ? poly : poly.map(([x, y]) => [w - x, y]).reverse();
}
export const topples = poly => { const [cx] = centroid(poly), base = poly.filter(p => p[1] === 0).map(p => p[0]); return cx < Math.min(...base) - 1e-9 || cx > Math.max(...base) + 1e-9; };
export function toppleQuestion(seed) {
  return retry(seed, rng => {
    const shapes = Array.from({ length: 4 }, () => block(rng));
    if (shapes.some(p => !Number.isFinite(centroid(p)[0]))) return null;
    const falls = shapes.map(topples), askFall = rng() < 0.5;
    if (falls.filter(f => f === askFall).length !== 1) return null;
    const margin = shapes.map(p => { const [cx] = centroid(p), base = p.filter(q => q[1] === 0).map(q => q[0]); return Math.min(Math.abs(cx - Math.min(...base)), Math.abs(cx - Math.max(...base))); });
    if (margin.some(m => m < 0.15)) return null;
    const { options, answer } = lettered(rng, shapes.map((p, i) => ({ correct: falls[i] === askFall, figure: { type: 'standing', poly: p }, reason: falls[i] ? 'Its centre of gravity lies beyond the edge of its base, so it tips over.' : 'Its centre of gravity is above its base, so it stands.' })));
    return {
      kind: 'topple', seed, answerMode: 'single',
      prompt: `Each solid block of even thickness stands on the ground as drawn. Which one ${askFall ? 'will fall over' : 'is the only one that stays standing'}?`,
      figures: [], options, answer,
      explanation: 'A standing object stays up while a plumb line from its centre of gravity falls inside its base. Heavy parts leaning out past the base pull the centre of gravity beyond the edge, and it tips.',
      hints: ['Find roughly where the middle of the mass is.', 'Drop a line straight down from it: does it land on the base?'],
      solution: [{ text: 'For each block, estimate the centre of gravity: the balance point of its area.' }, { text: 'Compare it with the ends of the base on the ground.' }, { text: `Only ${options.find(o => o.correct).label} ${askFall ? 'has its centre of gravity outside the base' : 'has its centre of gravity over the base'}.` }],
    };
  });
}

// ---------- rolling ----------
export function rollingQuestion(seed, level = 3) {
  return retry(seed, rng => {
    const form = level >= 4 ? pick(rng, ['outside', 'inside', 'plank']) : pick(rng, ['wheel', 'outside', 'plank']);
    if (form === 'wheel') {
      const d = pick(rng, [0.7, 1.4, 2.1]), turns = pick(rng, [10, 20, 25, 50, 100]);
      const nice = Math.round((22 / 7) * d * turns * 100) / 100;
      if (!Number.isInteger(nice * 10)) return null;
      return { kind: 'rolling', seed, answerMode: 'numeric', unit: 'm', prompt: `A wheel ${d} m across rolls without slipping and turns ${turns} times. Taking π as 22/7, how far does it travel, in metres?`, figures: [], answer: { value: nice }, mistakes: dedupe(nice, [{ value: (22 / 7) * (d / 2) * turns, reason: 'Use the diameter: one turn rolls out π × diameter, not π × radius.' }, { value: d * turns, reason: 'One turn moves the wheel its full rim length, π × diameter.' }]), explanation: `One turn rolls out the rim: π × ${d} m. ${turns} turns: 22/7 × ${d} × ${turns} = ${nice} m.`, hints: ['One turn rolls out one rim length.', 'Rim length = π × diameter.'], solution: [{ text: `Rim: 22/7 × ${d} m.` }, { text: `${turns} turns.` }, { text: `Distance: ${nice} m.` }] };
    }
    if (form === 'plank') {
      const roll = pick(rng, [1, 2, 3, 4, 5]), value = 2 * roll;
      return { kind: 'rolling', seed, answerMode: 'numeric', unit: 'm', prompt: `A heavy plank rests on round logs on the ground. The plank is pushed until the logs have rolled ${roll} m forward without slipping. How far has the plank moved over the ground, in metres?`, figures: [], answer: { value }, mistakes: dedupe(value, [{ value: roll, reason: 'The plank moves relative to the logs as well as with them.' }, { value: roll / 2, reason: 'The top of a rolling log moves twice as fast as its centre, not half.' }]), explanation: `The top of a log that rolls without slipping moves twice as far as its centre. The plank rides on top: 2 × ${roll} = ${value} m.`, hints: ['The bottom of a rolling log is still for an instant; the top moves twice as fast as the centre.'], solution: [{ text: `The logs' centres move ${roll} m.` }, { text: 'The tops move twice as far as the centres.' }, { text: `The plank moves ${value} m.` }] };
    }
    const r = 1, R = pick(rng, form === 'inside' ? [2, 3, 4] : [1, 2, 3]), value = form === 'outside' ? (R + r) / r : (R - r) / r;
    return { kind: 'rolling', seed, answerMode: 'numeric', unit: '', prompt: `A coin rolls without slipping ${form === 'outside' ? 'round the outside' : 'round the inside of a ring'} of a fixed coin ${R === 1 ? 'the same size' : `${R} times as wide`}${form === 'inside' ? ' (the ring is the fixed one)' : ''}, once all the way round. How many times does the rolling coin turn about its own centre?`, figures: [{ type: 'coins', R, r, inside: form === 'inside' }], answer: { value }, mistakes: dedupe(value, [{ value: R / r, reason: form === 'outside' ? 'Going round the outside adds one extra turn for the trip around the centre.' : 'Going round the inside takes one turn away.' }, { value: form === 'outside' ? (R - r) / r || R + 2 : (R + r) / r, reason: form === 'outside' ? 'Outside adds a turn; inside takes one away.' : 'Inside takes one turn away; outside adds one.' }]), explanation: `Rolling along its path gives ${R}/${r} = ${R / r} turns, and going once round the fixed coin ${form === 'outside' ? 'adds' : 'takes away'} one more: ${value}.`, hints: ['Count the turns from the path length, then add or take one for the trip round the centre.'], solution: [{ text: `Path length ÷ coin rim = ${R}.` }, { text: `${form === 'outside' ? 'Outside: add 1' : 'Inside: take away 1'} for one trip round.` }, { text: `${value} turns.` }] };
  });
}

export function machinesQuestion(seed, kind, level) {
  switch (kind) {
    case 'lever-class': return leverClassQuestion(seed);
    case 'lever-effort': return leverEffortQuestion(seed);
    case 'pulley-effort': return pulleyQuestion(seed, level);
    case 'rigid-frame': return frameQuestion(seed, level);
    case 'topple': return toppleQuestion(seed);
    case 'rolling': return rollingQuestion(seed, level);
    default: throw new Error('Unknown machines kind ' + kind);
  }
}
export const MACHINE_KINDS = Object.freeze({ 'lever-class': [2], 'lever-effort': [3], 'pulley-effort': [3, 4], 'rigid-frame': [3, 4], topple: [3], rolling: [3, 4] });
