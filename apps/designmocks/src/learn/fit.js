// Fit and embedded figures: which piece fills a gap, which two pieces make a
// shape, which piece is left over, and which drawing hides a figure.
// Pieces may be turned but not flipped over. Specification: docs/learn/topics/fit.md.
import { pick, seededRandom, shuffle } from './random.js';

const LETTERS = 'ABCD';
const key = c => c.join(',');
function retry(seed, build) {
  for (let i = 0; i < 800; i++) { const q = build(seededRandom(seed * 6131 + i * 9967)); if (q) return q; }
  throw new Error('No fit question for seed ' + seed);
}
const lettered = (rng, list) => {
  const options = shuffle(rng, list).map((o, i) => ({ ...o, id: LETTERS[i], label: LETTERS[i] }));
  return { options, answer: options.find(o => o.correct).id };
};

// ---------- polyominoes ----------
export const normalise = cells => { const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1])); return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); };
export const shapeKey = cells => normalise(cells).map(key).join(';');
export const turn = cells => normalise(cells.map(([x, y]) => [y, -x]));
export const flip = cells => normalise(cells.map(([x, y]) => [-x, y]));
export const turns = cells => { const out = [normalise(cells)]; for (let i = 0; i < 3; i++) out.push(turn(out[out.length - 1])); return out; };
export const sameUpToTurn = (a, b) => a.length === b.length && turns(a).some(t => shapeKey(t) === shapeKey(b));
const connected = cells => { if (!cells.length) return false; const has = new Set(cells.map(key)), seen = new Set([key(cells[0])]), st = [cells[0]]; while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key([x + dx, y + dy]); if (has.has(k) && !seen.has(k)) { seen.add(k); st.push([x + dx, y + dy]); } } } return seen.size === cells.length; };
function growPiece(rng, size, start, allowed) {
  const piece = new Map([[key(start), start]]);
  for (let guard = 0; piece.size < size && guard < 200; guard++) {
    const [x, y] = pick(rng, [...piece.values()]), [dx, dy] = pick(rng, [[1, 0], [-1, 0], [0, 1], [0, -1]]), c = [x + dx, y + dy];
    if (allowed(c)) piece.set(key(c), c);
  }
  return piece.size === size ? [...piece.values()] : null;
}
// Exact cover: can these pieces (turns allowed) tile the target exactly?
export function tiles(target, pieces) {
  const want = new Set(target.map(key));
  if (pieces.reduce((s, p) => s + p.length, 0) !== want.size) return false;
  const go = (left, rest) => {
    if (!rest.length) return left.size === 0;
    const first = [...left].map(k => k.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1])[0];
    for (let i = 0; i < rest.length; i++) for (const t of turns(rest[i])) {
      const anchor = t[0], placed = t.map(([x, y]) => [x - anchor[0] + first[0], y - anchor[1] + first[1]]);
      if (!placed.every(c => left.has(key(c)))) continue;
      const next = new Set(left); placed.forEach(c => next.delete(key(c)));
      if (go(next, rest.filter((_, j) => j !== i))) return true;
    }
    return false;
  };
  return go(want, pieces);
}
const randomTurn = (rng, cells) => turns(cells)[Math.floor(rng() * 4)];
const pieceFig = (cells, label) => ({ type: 'outline', cells: normalise(cells), holes: [], ...(label ? { label } : {}) });

// One piece fills the gap in a board.
export function gapQuestion(seed, level = 2) {
  return retry(seed, rng => {
    const [w, h] = level <= 2 ? [3, 3] : pick(rng, [[4, 3], [4, 4]]), size = level <= 2 ? pick(rng, [3, 4]) : pick(rng, [4, 5]);
    const inBoard = ([x, y]) => x >= 0 && y >= 0 && x < w && y < h;
    const gap = growPiece(rng, size, [Math.floor(rng() * w), Math.floor(rng() * h)], inBoard);
    if (!gap) return null;
    const gapKeys = new Set(gap.map(key)), board = [];
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (!gapKeys.has(key([x, y]))) board.push([x, y]);
    if (!connected(board)) return null;
    const right = normalise(gap), chiral = !sameUpToTurn(right, flip(right));
    if (level >= 3 && !chiral) return null;
    const wrong = [];
    if (chiral) wrong.push({ cells: flip(right), reason: 'This is the gap’s mirror image. Pieces can be turned but not flipped over.' });
    for (let guard = 0; wrong.length < 3 && guard < 60; guard++) {
      const moved = right.map(c => [...c]), i = Math.floor(rng() * moved.length), [dx, dy] = pick(rng, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
      moved[i] = [moved[i][0] + dx, moved[i][1] + dy];
      const cand = normalise(moved);
      if (new Set(cand.map(key)).size !== cand.length || !connected(cand) || sameUpToTurn(cand, right) || wrong.some(o => sameUpToTurn(o.cells, cand))) continue;
      if (chiral && sameUpToTurn(cand, flip(right))) continue;
      wrong.push({ cells: cand, reason: 'One square is in a different place, so it leaves a hole or sticks out.' });
    }
    if (wrong.length < 3) return null;
    const { options, answer } = lettered(rng, [{ cells: right, correct: true, reason: 'Turned the right way, it fills the gap exactly.' }, ...wrong.map(o => ({ ...o, correct: false }))].map(o => ({ correct: !!o.correct, reason: o.reason, figure: pieceFig(randomTurn(rng, o.cells)) })));
    return {
      kind: 'fill-gap', seed, answerMode: 'single', gap: right,
      prompt: 'Which piece fills the white gap exactly? Pieces may be turned but not flipped over.',
      figures: [{ type: 'outline', cells: board, holes: gap }],
      options, answer,
      explanation: 'Count the squares first: the piece must have as many as the gap. Then match its outline, turning it in your head. A mirror image never fits without flipping.',
      ...(level >= 3 ? { hints: ['Count the squares in the gap.', 'Find the gap’s most distinctive corner and look for it on each piece.'], solution: [{ text: `The gap has ${right.length} squares.` }, { text: 'Turn each piece until its long side lines up with the gap’s.' }, { text: 'Only one piece matches without flipping; the mirror image needs to be flipped.' }] } : {}),
    };
  });
}

// Split a target into pieces by growing regions from seeds.
function partition(rng, target, count) {
  const owner = new Map(), seeds = shuffle(rng, target).slice(0, count);
  seeds.forEach((c, i) => owner.set(key(c), i));
  const has = new Set(target.map(key));
  let changed = true;
  while (changed) { changed = false; for (const c of shuffle(rng, target)) { if (owner.has(key(c))) continue; const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => owner.get(key([c[0] + dx, c[1] + dy]))).filter(v => v !== undefined); if (nb.length) { owner.set(key(c), pick(rng, nb)); changed = true; } } }
  const pieces = Array.from({ length: count }, (_, i) => target.filter(c => owner.get(key(c)) === i));
  return pieces.every(p => p.length >= 2 && connected(p)) && has.size === target.length ? pieces : null;
}
export function twoPiecesQuestion(seed) {
  return retry(seed, rng => {
    const w = pick(rng, [3, 4]), h = 3, target = [];
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (rng() < 0.85) target.push([x, y]);
    if (target.length < 7 || !connected(target)) return null;
    const pair = partition(rng, target, 2);
    if (!pair || pair.some(p => p.length < 3)) return null;
    const wrongPairs = [];
    for (let guard = 0; wrongPairs.length < 3 && guard < 80; guard++) {
      const which = Math.floor(rng() * 2), other = pair[1 - which];
      let changed = rng() < 0.5 ? flip(pair[which]) : null;
      if (!changed || sameUpToTurn(changed, pair[which])) { const m = normalise(pair[which]).map(c => [...c]), i = Math.floor(rng() * m.length), [dx, dy] = pick(rng, [[1, 0], [-1, 0], [0, 1], [0, -1]]); m[i] = [m[i][0] + dx, m[i][1] + dy]; changed = normalise(m); }
      if (new Set(changed.map(key)).size !== changed.length || !connected(changed)) continue;
      const cand = which ? [other, changed] : [changed, other];
      if (tiles(target, cand) || wrongPairs.some(p => sameUpToTurn(p[0], cand[0]) && sameUpToTurn(p[1], cand[1]))) continue;
      wrongPairs.push(cand);
    }
    if (wrongPairs.length < 3) return null;
    const fig = p => ({ type: 'pieces', pieces: p.map(c => normalise(randomTurn(rng, c))) });
    const { options, answer } = lettered(rng, [{ correct: true, figure: fig(pair), reason: 'Turned the right way, these two fill the shape exactly with no overlap.' }, ...wrongPairs.map(p => ({ correct: false, figure: fig(p), reason: p.some(c => pair.some(q => sameUpToTurn(flip(q), c) && !sameUpToTurn(q, c))) ? 'One piece is a mirror image; it would have to be flipped over.' : 'The squares add up, but one piece has the wrong outline, so a gap or overlap is left.' }))]);
    return {
      kind: 'two-pieces', seed, answerMode: 'single', target: normalise(target),
      prompt: 'Which pair of pieces fits together to make this shape exactly? Pieces may be turned but not flipped over.',
      figures: [{ type: 'outline', cells: normalise(target), holes: [] }],
      options, answer,
      explanation: 'Every pair has the right number of squares, so outlines decide it. Place the more awkward piece first, in a corner of the shape that only it can fill, and see if the other piece fits what is left.',
      hints: ['Start from a corner of the shape that only one piece can fill.', 'Watch for mirror images: they cannot be flipped.'],
      solution: [{ text: `The shape has ${target.length} squares.` }, { text: 'Place one piece of the right pair in the shape’s most awkward corner.' }, { text: 'The other piece of that pair fills exactly what is left; in every other pair one piece cannot.' }],
    };
  });
}
export function oddPieceQuestion(seed) {
  return retry(seed, rng => {
    const [w, h] = pick(rng, [[4, 3], [4, 4], [5, 3]]), target = [];
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) target.push([x, y]);
    const three = partition(rng, target, 3);
    if (!three || three.some(p => p.length < 3 || p.length > 6)) return null;
    const base = pick(rng, three), extra = rng() < 0.5 ? flip(base) : (() => { const m = normalise(base).map(c => [...c]), i = Math.floor(rng() * m.length), [dx, dy] = pick(rng, [[1, 0], [-1, 0], [0, 1], [0, -1]]); m[i] = [m[i][0] + dx, m[i][1] + dy]; return normalise(m); })();
    if (new Set(extra.map(key)).size !== extra.length || !connected(extra) || three.some(p => sameUpToTurn(p, extra))) return null;
    const four = [...three, extra];
    const fits = four.map((_, i) => tiles(target, four.filter((__, j) => j !== i)));
    if (fits.filter(Boolean).length !== 1 || !fits[3]) return null;
    const { options, answer } = lettered(rng, four.map((p, i) => ({ correct: i === 3, figure: pieceFig(randomTurn(rng, p)), reason: i === 3 ? 'The other three fill the rectangle exactly, so this one is left over.' : 'Without this piece the rest cannot fill the rectangle.' })));
    return {
      kind: 'odd-piece', seed, answerMode: 'single', target, pieces: four,
      prompt: `Three of these pieces fit together to make a ${w} × ${h} rectangle. Which piece is left over? Pieces may be turned but not flipped over.`,
      figures: [{ type: 'outline', cells: target, holes: [] }],
      options, answer,
      explanation: `The rectangle has ${w * h} squares. Find the sets of three whose squares add up to ${w * h}, then try to fit them, starting with the largest piece in a corner.`,
      hints: [`Add up squares: the three pieces must total ${w * h}.`, 'If two pieces look alike, one may be a mirror image; only one of them can fit.'],
      solution: [{ text: `Squares: ${four.map(p => p.length).join(', ')}; the rectangle needs ${w * h}.` }, { text: 'Try each set of three with the right total, largest piece first, in a corner.' }, { text: 'Only one set fills the rectangle; the piece outside it is the answer.' }],
    };
  });
}

// ---------- hidden figures (unit lattice steps) ----------
const STEP = [[1, 0], [0, 1], [1, 1], [1, -1]];
export const stepKey = ([x, y], d) => `${x},${y},${d}`;
export function toSteps(segments) {
  const out = new Set();
  for (const [[x1, y1], [x2, y2]] of segments) {
    let [ax, ay, bx, by] = [x1, y1, x2, y2];
    if (ax > bx || (ax === bx && ay > by)) [ax, ay, bx, by] = [bx, by, ax, ay];
    const dx = Math.sign(bx - ax), dy = Math.sign(by - ay), n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)), d = STEP.findIndex(([sx, sy]) => sx === dx && sy === dy);
    for (let i = 0; i < n; i++) out.add(stepKey([ax + dx * i, ay + dy * i], d));
  }
  return out;
}
export const fromSteps = steps => [...steps].map(k => { const [x, y, d] = k.split(',').map(Number); return [[x, y], [x + STEP[d][0], y + STEP[d][1]]]; });
export function placements(target, drawing, n = 6) {
  const t = [...toSteps(target)].map(k => k.split(',').map(Number)), have = toSteps(drawing), found = [];
  for (let ox = -n; ox <= n; ox++) for (let oy = -n; oy <= n; oy++) if (t.every(([x, y, d]) => have.has(stepKey([x + ox, y + oy], d)))) found.push([ox, oy]);
  return found;
}
function randomFigure(rng, steps) {
  const out = new Set();
  let [x, y] = [0, 0];
  for (let guard = 0; out.size < steps && guard < 100; guard++) {
    const d = Math.floor(rng() * 4), back = rng() < 0.5, [sx, sy] = STEP[d], from = back ? [x - sx, y - sy] : [x, y];
    if (from[0] < 0 || from[1] < 0 || from[0] + sx > 3 || from[1] + sy > 3 || from[1] + sy < 0 || from[0] > 3) continue;
    out.add(stepKey(from, d)); [x, y] = back ? from : [x + sx, y + sy];
  }
  return out.size === steps ? fromSteps(out) : null;
}
const shift = (segs, [dx, dy]) => segs.map(s => s.map(([x, y]) => [x + dx, y + dy]));
const mirrorSegs = segs => { const mx = Math.max(...segs.flat().map(p => p[0])); return segs.map(s => s.map(([x, y]) => [mx - x, y])); };
const turnSegs = segs => { const my = Math.max(...segs.flat().map(p => p[1])); return segs.map(s => s.map(([x, y]) => [my - y, x])); };
export function hiddenQuestion(seed, level = 3) {
  return retry(seed, rng => {
    const target = randomFigure(rng, level >= 4 ? 5 : 4);
    if (!target) return null;
    const variants = [mirrorSegs(target), turnSegs(target)].filter(v => !placements(target, v, 4).length);
    if (!variants.length) return null;
    const box = 5, extraCount = level >= 4 ? 9 : 6;
    const decorate = core => {
      const steps = toSteps(shift(core, [Math.floor(rng() * 2), Math.floor(rng() * 2)]));
      for (let guard = 0; steps.size < toSteps(core).size + extraCount && guard < 200; guard++) { const x = Math.floor(rng() * box), y = Math.floor(rng() * box), d = Math.floor(rng() * 4), [sx, sy] = STEP[d]; if (x + sx <= box && y + sy >= 0 && y + sy <= box) steps.add(stepKey([x, y], d)); }
      return fromSteps(steps);
    };
    const right = decorate(target);
    const wrongs = [decorate(pick(rng, variants)), decorate(pick(rng, variants)), decorate(randomFigure(rng, 3) ?? [])];
    if (!placements(target, right).length || wrongs.some(wg => placements(target, wg).length)) return null;
    const unit = 22;
    const { options, answer } = lettered(rng, [{ correct: true, figure: { type: 'lines', segments: right, unit, label: 'A drawing made of straight lines' }, reason: 'The figure is in here, the same size and the same way up.' }, ...wrongs.map(wg => ({ correct: false, figure: { type: 'lines', segments: wg, unit, label: 'A drawing made of straight lines' }, reason: 'Something close is in here, but turned or flipped; the exact figure is not.' }))]);
    return {
      kind: 'hidden-figure', seed, answerMode: 'single', target,
      prompt: 'In which drawing is this figure hidden, the same size and the same way up?',
      figures: [{ type: 'lines', segments: target, unit, label: 'The figure to find' }],
      options, answer,
      explanation: 'Pick out the figure’s most unusual feature, such as a slanting line meeting a straight one, and hunt for it in each drawing. Then check every other line from there. A turned or mirrored copy does not count.',
      hints: ['Start from the figure’s most unusual corner.', 'Turned or flipped copies do not count.'],
      solution: [{ text: 'Find the figure’s most unusual corner.' }, { text: 'Look for that corner, the same way up, in each drawing.' }, { text: 'Check the remaining lines from there; only one drawing has them all.' }],
    };
  });
}
export function hiddenCountQuestion(seed) {
  return retry(seed, rng => {
    const target = randomFigure(rng, pick(rng, [2, 3]));
    if (!target) return null;
    let drawing = [];
    for (let k = 0; k < 2 + Math.floor(rng() * 3); k++) drawing = drawing.concat(shift(target, [Math.floor(rng() * 4), Math.floor(rng() * 4)]));
    for (let k = 0; k < 4; k++) { const x = Math.floor(rng() * 5), y = Math.floor(rng() * 5), d = Math.floor(rng() * 4), [sx, sy] = STEP[d]; if (y + sy >= 0) drawing.push([[x, y], [x + sx, y + sy]]); }
    const value = placements(target, drawing, 8).length, turned = [mirrorSegs(target), turnSegs(target)].map(v => placements(v, drawing, 8).length);
    if (value < 2 || value > 7 || placements(target, target, 4).length !== 1) return null;
    const merged = fromSteps(toSteps(drawing));
    return {
      kind: 'hidden-count', seed, answerMode: 'numeric', unit: '', target, drawing: merged,
      prompt: 'How many times does this figure appear in the drawing, the same size and the same way up? Copies may share lines.',
      figures: [{ type: 'lines', segments: target, unit: 22, label: 'The figure to count' }, { type: 'lines', segments: merged, unit: 22, label: 'The drawing' }],
      answer: { value }, mistakes: [{ value: value + turned[0], reason: 'Mirror-image copies do not count.' }, { value: value - 1, reason: 'Copies can share lines; check overlapping ones.' }].filter((m, i, l) => m.value > 0 && m.value !== value && l.findIndex(o => o.value === m.value) === i),
      explanation: 'Fix one feature of the figure, such as its slanting line, and find every place it occurs in the drawing. At each one, check whether the rest of the figure is there too.',
      hints: ['Count copies of the figure’s rarest line first.', 'At each, check the rest of the figure; copies may overlap.'],
      solution: [{ text: 'Find every copy of the rarest line in the figure.' }, { text: 'At each, check the remaining lines, the same way up.' }, { text: `${value} positions have the whole figure.` }],
    };
  });
}

export function fitQuestion(seed, kind, level) {
  switch (kind) {
    case 'fill-gap': return gapQuestion(seed, level);
    case 'two-pieces': return twoPiecesQuestion(seed);
    case 'odd-piece': return oddPieceQuestion(seed);
    case 'hidden-figure': return hiddenQuestion(seed, level);
    case 'hidden-count': return hiddenCountQuestion(seed);
    default: throw new Error('Unknown fit kind ' + kind);
  }
}
export const FIT_KINDS = Object.freeze({ 'fill-gap': [2, 3], 'hidden-figure': [3, 4], 'two-pieces': [3], 'odd-piece': [4], 'hidden-count': [4] });
