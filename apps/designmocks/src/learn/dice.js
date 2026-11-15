// Dice: opposite faces, rolling along a path, several pictures of one die,
// and stacks or rows of dice. Specification: docs/learn/topics/dice.md.
//
// A die lying on a table is { U, D, N, S, E, W }: the number on its top,
// bottom and four sides. "Front" is the south side and "right" the east side,
// so a picture of a die shows its top, front and right faces: U, S, E.
import { cubeNets, foldNet, oppositeIndex } from './cube-net.js';
import { pick, seededRandom, shuffle } from './random.js';

export const standardDie = () => ({ U: 1, D: 6, S: 2, N: 5, E: 3, W: 4 });
// Rolling over an edge: the top goes to the side it rolls toward and the far side comes up.
export function roll(d, dir) {
  if (dir === 'east') return { ...d, U: d.W, E: d.U, D: d.E, W: d.D };
  if (dir === 'west') return { ...d, U: d.E, W: d.U, D: d.W, E: d.D };
  if (dir === 'north') return { ...d, U: d.S, N: d.U, D: d.N, S: d.D };
  if (dir === 'south') return { ...d, U: d.N, S: d.U, D: d.S, N: d.D };
  throw new Error('Unknown roll ' + dir);
}
// Turning on the spot, clockwise seen from above: the north side goes to the east.
export const spin = d => ({ ...d, E: d.N, S: d.E, W: d.S, N: d.W });
export const keyOf = d => `${d.U}${d.D}${d.N}${d.S}${d.E}${d.W}`;
// All 24 ways the die can lie.
export function orientations(d) {
  const seen = new Map([[keyOf(d), d]]), queue = [d];
  while (queue.length) { const c = queue.shift(); for (const n of [roll(c, 'east'), roll(c, 'north'), spin(c)]) if (!seen.has(keyOf(n))) { seen.set(keyOf(n), n); queue.push(n); } }
  return [...seen.values()];
}
export const pictureOf = d => [d.U, d.S, d.E];
export const pairs = d => [[d.U, d.D], [d.N, d.S], [d.E, d.W]];
export const opposite = (d, n) => pairs(d).flatMap(([a, b]) => (a === n ? [b] : b === n ? [a] : []))[0];
export const mirrorDie = d => ({ ...d, E: d.W, W: d.E });
export const sameDie = (a, b) => orientations(a).some(o => keyOf(o) === keyOf(b));
// A die numbered 1–6 at random, in a random position.
export function randomDie(rng) {
  const n = shuffle(rng, [1, 2, 3, 4, 5, 6]);
  return { U: n[0], D: n[1], N: n[2], S: n[3], E: n[4], W: n[5] };
}
const isStandard = d => pairs(d).every(([a, b]) => a + b === 7);

// What the pictures prove: every two numbers seen together are neighbours; deduce opposites from that.
export function deduceOpposites(pictures) {
  const adj = new Map([1, 2, 3, 4, 5, 6].map(n => [n, new Set()]));
  for (const p of pictures) for (const a of p) for (const b of p) if (a !== b) adj.get(a).add(b);
  const known = new Map();
  for (let changed = true; changed;) {
    changed = false;
    for (let n = 1; n <= 6; n++) {
      if (known.has(n)) continue;
      const pairedElsewhere = new Set([...known.entries()].filter(([a]) => a !== n).flatMap(([a, b]) => [a, b]));
      const candidates = [1, 2, 3, 4, 5, 6].filter(m => m !== n && !adj.get(n).has(m) && !pairedElsewhere.has(m));
      if (candidates.length === 1) { known.set(n, candidates[0]); known.set(candidates[0], n); changed = true; }
    }
  }
  return { known, adj };
}

// A numbered net that folds into exactly this die (same pairs and the same handedness).
export function netFor(rng, die) {
  for (const net of shuffle(rng, cubeNets)) {
    const fold = foldNet(net.cells.map(c => ({ x: c.x, y: c.y })));
    if (!fold.ok) continue;
    const place = new Array(6), used = new Set(); let k = 0;
    for (let i = 0; i < 6; i++) { if (used.has(i)) continue; const j = oppositeIndex(fold, i); place[i] = pairs(die)[k][0]; place[j] = pairs(die)[k][1]; used.add(i); used.add(j); k++; }
    if (!sameDie(netToDie(net.cells, place, fold), die)) { const j = oppositeIndex(fold, 0); [place[0], place[j]] = [place[j], place[0]]; }
    if (sameDie(netToDie(net.cells, place, fold), die)) return { type: 'net', cells: net.cells.map((c, i) => ({ x: c.x, y: c.y, content: { glyph: String(place[i]) } })) };
  }
  throw new Error('No net for this die');
}
function retry(seed, build) {
  for (let i = 0; i < 400; i++) { const q = build(seededRandom(seed * 1601 + i * 7919)); if (q) return q; }
  throw new Error('No dice question for seed ' + seed);
}
const numberOptions = (rng, value, wrong) => {
  const seen = new Set([value]), list = [{ value, correct: true }];
  for (const w of wrong) if (!seen.has(w.value) && w.value >= 1 && w.value <= 6 && list.length < 4) { seen.add(w.value); list.push({ ...w, correct: false }); }
  for (let n = 1; n <= 6 && list.length < 4; n++) if (!seen.has(n)) { seen.add(n); list.push({ value: n, correct: false, reason: 'This number is seen next to it, so it cannot be opposite.' }); }
  const options = shuffle(rng, list).map((o, i) => ({ id: 'ABCD'[i], label: 'ABCD'[i], text: String(o.value), correct: o.correct, reason: o.reason ?? 'This follows from the faces.' }));
  return { options, answer: options.find(o => o.correct).id };
};
const dieFigure = d => ({ type: 'die', top: d.U, front: d.S, right: d.E });

// ---------- Foundations ----------
export function standardOppositeQuestion(seed) {
  return retry(seed, rng => {
    const d = pick(rng, orientations(standardDie())), ask = pick(rng, ['D', 'N', 'W']), value = d[ask];
    const words = { D: 'on the bottom', N: 'at the back', W: 'on the left' }[ask], seenFace = { D: 'U', N: 'S', W: 'E' }[ask];
    const made = numberOptions(rng, value, [{ value: d[seenFace], reason: 'That is the face you can see, not the one opposite it.' }, { value: 7 - d.U === value ? d.S : 7 - d.U, reason: 'That is opposite a different face. Opposite faces add up to 7.' }]);
    return { kind: 'die-opposite', seed, answerMode: 'single', figures: [dieFigure(d)], ...made, prompt: `On a standard die, opposite faces add up to 7. Which number is ${words}?`, explanation: `${words.replace(/^on the |^at the /, '').replace(/^./, c => c.toUpperCase())} is opposite the face showing ${d[seenFace]}, so it is 7 − ${d[seenFace]} = ${value}.` };
  });
}
export function netOppositeQuestion(seed) {
  return retry(seed, rng => {
    const shape = pick(rng, cubeNets), numbers = shuffle(rng, [1, 2, 3, 4, 5, 6]);
    const cells = shape.cells.map((c, i) => ({ x: c.x, y: c.y, content: { glyph: String(numbers[i]) } }));
    const fold = foldNet(cells.map(c => ({ x: c.x, y: c.y })));
    if (!fold.ok) return null;
    const i = Math.floor(rng() * 6), value = numbers[oppositeIndex(fold, i)], n = numbers[i];
    if (n + value === 7 && rng() < 0.7) return null;
    const neighbours = numbers.filter((m, j) => j !== i && m !== value);
    const made = numberOptions(rng, value, [{ value: 7 - n, reason: 'This die is not numbered like a standard die: use the net, not the 7 rule.' }, ...shuffle(rng, neighbours).map(m => ({ value: m, reason: `${m} shares an edge with ${n} when folded, so it is a neighbour.` }))]);
    return { kind: 'die-net-opposite', seed, answerMode: 'single', figures: [{ type: 'net', cells }], ...made, prompt: `This net is folded into a die. Which number is opposite ${n}?`, explanation: `In a line of three squares, the two ends are opposite. Folded, ${n} and ${value} face each other.` };
  });
}

// ---------- rolling ----------
const DIRS = ['north', 'east', 'south', 'west'], STEP = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] };
export function rollQuestion(seed, level) {
  return retry(seed, rng => {
    const nonStandard = level === 4, start = nonStandard ? randomDie(rng) : pick(rng, orientations(standardDie())), n = level === 2 ? 1 + Math.floor(rng() * 2) : level === 3 ? 3 + Math.floor(rng() * 2) : 5 + Math.floor(rng() * 3);
    const path = []; let prev = null;
    for (let i = 0; i < n; i++) { const options = DIRS.filter(d => !prev || STEP[d][0] !== -STEP[prev][0] || STEP[d][1] !== -STEP[prev][1]); prev = pick(rng, options); path.push(prev); }
    if (level >= 3 && new Set(path).size < 2) return null;
    let d = start; const states = [d];
    for (const dir of path) { d = roll(d, dir); states.push(d); }
    const value = d.U, lastBack = roll(states[states.length - 2], { north: 'south', south: 'north', east: 'west', west: 'east' }[path[path.length - 1]]).U;
    if (nonStandard && isStandard(start)) return null;
    const figures = [dieFigure(start), { type: 'die-path', path }];
    if (nonStandard) {
      // The die is given by its net as well, so every hidden face is known.
      figures.unshift(netFor(rng, start));
    }
    const base = {
      kind: 'die-roll', seed, figures, path, start,
      prompt: `The die starts as shown${nonStandard ? ' (its net is given, so you know every face)' : ''}. It rolls one square at a time: ${path.join(', ')}. Which number is on top at the end?`,
      explanation: `Track the top, front and right after each roll: ${states.slice(1).map((s, i) => `${path[i]}: top ${s.U}`).join('; ')}.`,
    };
    if (level === 2) {
      const made = numberOptions(rng, value, [{ value: lastBack, reason: 'That is the roll the other way. A die rolling north tips forward over its north edge, so the south face comes up.' }, { value: d.D, reason: 'That is the bottom face at the end.' }, { value: start.U, reason: 'That is the top before any roll.' }]);
      return { ...base, answerMode: 'single', ...made };
    }
    return {
      ...base, answerMode: 'numeric', unit: '', answer: { value },
      mistakes: [{ value: lastBack, reason: 'The last roll went the wrong way. Rolling east, the west face comes up.' }, { value: d.D, reason: 'That is the face on the bottom.' }, { value: start.U, reason: 'That is the top before rolling.' }].filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i),
      hints: ['Keep a small table: top, front, right. Update all three after every roll.', 'Rolling east, the west face comes up and the top goes to the east. Rolling north, the south (front) face comes up.'],
      solution: [{ text: `Start: top ${start.U}, front ${start.S}, right ${start.E}${nonStandard ? `; from the net, opposite pairs are ${pairs(start).map(p => p.join('–')).join(', ')}` : ''}.` }, ...states.slice(1).map((s, i) => ({ text: `Roll ${path[i]}: top ${s.U}, front ${s.S}, right ${s.E}.` })), { text: `On top at the end: ${value}.` }],
    };
  });
}

// ---------- several pictures of one die ----------
export function positionsQuestion(seed, level) {
  return retry(seed, rng => {
    const die = randomDie(rng), all = orientations(die), count = level === 3 ? 2 + Math.floor(rng() * 2) : 3, pictures = shuffle(rng, all).slice(0, count).map(pictureOf);
    const target = 1 + Math.floor(rng() * 6), value = opposite(die, target), { known, adj } = deduceOpposites(pictures);
    if (known.get(target) !== value) return null;
    const direct = adj.get(target).size === 4;
    if (level === 3 && !direct) return null;
    if (level === 4 && direct) return null;
    const neighbours = [...adj.get(target)].sort((a, b) => a - b);
    return {
      kind: 'die-positions', seed, answerMode: 'numeric', unit: '', die, pictures,
      prompt: `These are ${count} pictures of the same die. Which number is opposite ${target}?`,
      figures: pictures.map(([U, S, E]) => ({ type: 'die', top: U, front: S, right: E })),
      answer: { value },
      mistakes: [{ value: 7 - target, reason: 'This die is not numbered like a standard die; the 7 rule does not apply.' }, ...neighbours.slice(0, 2).map(m => ({ value: m, reason: `${m} is seen next to ${target}, so it cannot be opposite it.` }))].filter((m, i, l) => m.value !== value && m.value >= 1 && m.value <= 6 && l.findIndex(o => o.value === m.value) === i),
      explanation: direct ? `${target} is seen next to ${neighbours.join(', ')}. The only number never beside it is ${value}.` : `${target} is seen next to only ${neighbours.join(', ')}. Pair off the other numbers first: their opposites are fixed by what is seen beside them, and ${value} is the one left for ${target}.`,
      hints: [`List every number that appears in the same picture as ${target}. Those are its neighbours.`, 'A face has four neighbours and one opposite. If you cannot find four, find the opposites of other numbers first.'],
      solution: [{ text: `Seen beside ${target}: ${neighbours.join(', ')}.` }, { text: 'A face has four neighbours and one opposite. Numbers seen beside it can never be opposite it.' }, ...(direct ? [] : [...known.entries()].filter(([a, b]) => a < b && a !== target && b !== target).map(([a, b]) => ({ text: `${a} is seen beside every number except ${b}, so ${a} and ${b} are opposite.` }))), { text: `So ${value} is opposite ${target}.` }],
    };
  });
}
export function sameDieQuestion(seed) {
  return retry(seed, rng => {
    const die = randomDie(rng), ref = pictureOf(die), all = orientations(die).map(pictureOf).filter(p => p.join() !== ref.join());
    const mirrorPics = orientations(mirrorDie(die)).map(pictureOf).filter(p => !all.some(q => q.join() === p.join()) && p.join() !== ref.join());
    const [a, b] = pairs(die)[pick(rng, [0, 1, 2])], badPairs = all.flatMap(p => [p.map(x => (x === a ? b : x === b ? a : x))]).filter(p => !all.some(q => q.join() === p.join()) && p.join() !== ref.join() && new Set(p).size === 3);
    const right = 1 + Math.floor(rng() * 3), chosen = [...shuffle(rng, all).slice(0, right).map(p => ({ p, correct: true })), ...shuffle(rng, [...mirrorPics.map(p => ({ p, kind: 'mirror' })), ...badPairs.map(p => ({ p, kind: 'pair' }))]).slice(0, 4 - right).map(w => ({ ...w, correct: false }))];
    if (chosen.length < 4 || new Set(chosen.map(c => c.p.join())).size < 4) return null;
    const options = shuffle(rng, chosen).map((c, i) => ({ id: 'ABCD'[i], label: 'ABCD'[i], correct: c.correct, figure: { type: 'die', top: c.p[0], front: c.p[1], right: c.p[2] }, reason: c.correct ? 'The same die, turned.' : c.kind === 'mirror' ? 'These three numbers go round their corner the other way: this is the mirror-image die.' : `This shows ${a} or ${b} with the wrong neighbours: on the reference die they sit opposite each other.` }));
    const netFigure = netFor(rng, die);
    return {
      kind: 'same-die', seed, answerMode: 'multi', die,
      prompt: 'This net folds into the die shown. Which of the options are pictures of that same die? More than one may be.',
      figures: [netFigure, { type: 'die', top: ref[0], front: ref[1], right: ref[2] }],
      options, answer: options.filter(o => o.correct).map(o => o.id),
      explanation: 'A picture of the same die never shows two opposite faces together, and the three numbers round its corner go round the same way as on the die.',
      hints: ['First rule out any picture showing two numbers that are opposite on the net.', 'Then check the order round the corner: top, front, right, read clockwise.'],
      solution: [{ text: `Opposite pairs from the net: ${pairs(die).map(p => p.join('–')).join(', ')}.` }, { text: 'A picture with two of a pair together is wrong.' }, { text: 'For the rest, compare the clockwise order of the three numbers round the corner with the reference.' }, ...options.map(o => ({ text: `Option ${o.label}: ${o.reason}` }))],
    };
  });
}
// Fold a numbered net into a die lying with face 0 on top: read each face by its folded normal.
export function netToDie(cells, place, fold) {
  const at = {}, names = { '0,0,1': 'U', '0,0,-1': 'D', '1,0,0': 'E', '-1,0,0': 'W', '0,1,0': 'N', '0,-1,0': 'S' };
  fold.frames.forEach((f, i) => { at[names[f.n.join(',')]] = place[i]; });
  return at;
}

// ---------- stacks and rows ----------
export function stackSumQuestion(seed) {
  return retry(seed, rng => {
    const die = randomDie(rng), count = 3 + Math.floor(rng() * 2), stack = Array.from({ length: count }, () => pick(rng, orientations(die)));
    if (isStandard(die)) return null;
    const ask = pick(rng, ['parallel', 'hidden', 'table']);
    const vertical = stack.map(d => d.U + d.D), value = ask === 'parallel' ? vertical.reduce((a, b) => a + b, 0) : ask === 'hidden' ? vertical.reduce((a, b) => a + b, 0) - stack[0].U : stack[stack.length - 1].D;
    const netFigure = netFor(rng, die);
    return {
      kind: 'die-stack-sum', seed, answerMode: 'numeric', unit: '', die, stack,
      prompt: ask === 'parallel' ? `${count} identical dice, made from this net, are stacked. What is the sum of all the faces parallel to the ground (every top and every bottom)?` : ask === 'hidden' ? `${count} identical dice, made from this net, are stacked. What is the sum of all the faces you cannot see that are parallel to the ground: the faces between the dice and the one on the table?` : `${count} identical dice, made from this net, are stacked. Which number is on the face touching the table?`,
      figures: [netFigure, { type: 'die-stack', dice: stack.map((d, i) => ({ top: i === 0 ? d.U : null, front: d.S, right: d.E })) }],
      answer: { value },
      mistakes: [{ value: 7 * count - (ask === 'hidden' ? stack[0].U : 0), reason: 'These dice are not numbered like standard dice; opposite faces do not add to 7. Use the net.' }, { value: stack.reduce((s, d) => s + d.S + d.E, 0), reason: 'Those are the side faces you can see, not the faces parallel to the ground.' }, { value: vertical.reduce((a, b) => a + b, 0), reason: 'Leave out the top face of the top die: it can be seen.' }].filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i),
      explanation: `Each die's top and bottom are the opposite pair that contains neither of its two visible side faces. ${ask === 'table' ? `The bottom die's pair is ${stack[count - 1].U}–${stack[count - 1].D}, so ${value} touches the table.` : `Pair sums from the top die down: ${vertical.join(', ')}.`}`,
      hints: ['From the net, write the three opposite pairs.', 'For each die, two side faces are visible. Its top and bottom are the pair that contains neither of them.'],
      solution: [{ text: `Opposite pairs: ${pairs(die).map(p => p.join('–')).join(', ')}.` }, ...stack.map((d, i) => ({ text: `Die ${i + 1} from the top shows ${d.S} and ${d.E}: its top and bottom are ${d.U} and ${d.D}.` })), { text: ask === 'parallel' ? `Total: ${vertical.join(' + ')} = ${value}.` : ask === 'hidden' ? `All tops and bottoms ${vertical.reduce((a, b) => a + b, 0)}, minus the top face ${stack[0].U} you can see: ${value}.` : `The bottom die's bottom face is ${value}.` }],
    };
  });
}
export function rowHiddenQuestion(seed) {
  return retry(seed, rng => {
    const die = randomDie(rng), count = 2 + Math.floor(rng() * 2), row = Array.from({ length: count }, () => pick(rng, orientations(die)));
    if (isStandard(die)) return null;
    const sideSums = row.map(d => d.E + d.W), value = sideSums.reduce((a, b) => a + b, 0);
    // The asked sum must not depend on the die's handedness.
    if (sideSums.join() !== row.map(d => { const m = mirrorDie(d); return m.E + m.W; }).join()) return null;
    const netFigure = netFor(rng, die);
    return {
      kind: 'die-row-hidden', seed, answerMode: 'numeric', unit: '', die, row,
      prompt: `${count} identical dice, made from this net, stand in a row touching side to side. Each shows its top and its front. What is the sum of the left and right faces of all the dice?`,
      figures: [netFigure, { type: 'die-row', dice: row.map(d => ({ top: d.U, front: d.S })) }],
      answer: { value },
      mistakes: [{ value: 7 * count, reason: 'These are not standard dice: use the pairs from the net.' }, { value: row.reduce((s, d) => s + d.U + d.S, 0), reason: 'Those are the faces you can see. The left and right faces are the pair that contains neither.' }].filter((m, i, l) => m.value !== value && l.findIndex(o => o.value === m.value) === i),
      explanation: `For each die, the left and right faces are the opposite pair that contains neither its top nor its front: ${sideSums.join(' + ')} = ${value}.`,
      hints: ['Write the three opposite pairs from the net.', 'Top and front belong to two of the pairs. Left and right are the third.'],
      solution: [{ text: `Pairs: ${pairs(die).map(p => p.join('–')).join(', ')}.` }, ...row.map((d, i) => ({ text: `Die ${i + 1}: top ${d.U}, front ${d.S}, so left and right are ${d.E} and ${d.W}, sum ${d.E + d.W}.` })), { text: `Total ${value}.` }],
    };
  });
}

export function diceQuestion(seed, kind, level) {
  switch (kind) {
    case 'die-opposite': return standardOppositeQuestion(seed);
    case 'die-net-opposite': return netOppositeQuestion(seed);
    case 'die-roll': return rollQuestion(seed, level);
    case 'die-positions': return positionsQuestion(seed, level);
    case 'same-die': return sameDieQuestion(seed);
    case 'die-stack-sum': return stackSumQuestion(seed);
    case 'die-row-hidden': return rowHiddenQuestion(seed);
    default: throw new Error('Unknown dice kind ' + kind);
  }
}
export const DICE_KINDS = { 'die-opposite': [1], 'die-net-opposite': [2], 'die-roll': [2, 3, 4], 'die-positions': [3, 4], 'same-die': [3], 'die-stack-sum': [4], 'die-row-hidden': [4] };
