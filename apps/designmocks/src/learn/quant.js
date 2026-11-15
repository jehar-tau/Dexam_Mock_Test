// Number and quantity: the quantitative questions of UCEED and CEED, which
// are short puzzles more than drills. Every number is drawn from the seed and
// every answer is computed; the tests recompute each one another way (search,
// simulation or a formula). Specification: docs/learn/topics/quant.md.
import { pick, seededRandom, shuffle } from './random.js';

const rupees = n => `₹${n.toLocaleString('en-IN')}`;
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
function retry(seed, build) {
  for (let i = 0; i < 300; i++) { const q = build(seededRandom(seed * 1301 + i * 7919)); if (q) return q; }
  throw new Error('No quant question for seed ' + seed);
}
const mistakesFor = (value, list) => {
  const seen = new Set([value]);
  return list.filter(m => Number.isFinite(m.value) && m.value > 0 && Number.isInteger(m.value * 100) && !seen.has(m.value) && seen.add(m.value));
};
function singleFrom(rng, value, wrong, format = v => String(v)) {
  const seen = new Set([value]), picked = [];
  for (const w of wrong) if (Number.isFinite(w.value) && w.value > 0 && !seen.has(w.value) && picked.length < 3) { seen.add(w.value); picked.push(w); }
  for (const d of [1, -1, 2, 5, 10]) { if (picked.length >= 3) break; const v = value + d * Math.max(1, Math.round(value / 20)); if (!seen.has(v) && v > 0) { seen.add(v); picked.push({ value: v, reason: 'Close, but not what the working gives. Write each step down.' }); } }
  const options = shuffle(rng, [{ value, correct: true }, ...picked.map(p => ({ ...p, correct: false }))]).map((o, i) => ({ id: 'ABCD'[i], label: 'ABCD'[i], text: format(o.value), value: o.value, correct: o.correct, reason: o.reason ?? 'This follows from the working.' }));
  return { options, answer: options.find(o => o.correct).id };
}
const numeric = (value, unit, mistakes) => ({ answerMode: 'numeric', unit, answer: { value }, mistakes: mistakesFor(value, mistakes) });

// ---------- Foundations ----------
export function percentChange(seed) {
  return retry(seed, rng => {
    const P = pick(rng, [400, 800, 1200, 1600, 2000, 2400, 4000]), up = pick(rng, [10, 20, 25, 50]), down = pick(rng, [10, 20, 25, 50]);
    const value = (P * (100 + up) * (100 - down)) / 10000;
    if (!Number.isInteger(value)) return null;
    const { options, answer } = singleFrom(rng, value, [
      { value: (P * (100 + up - down)) / 100, reason: `Adding ${up}% and taking away ${down}% is not the same as a change of ${up - down}%. The second change is on the new, higher price.` },
      { value: (P * (100 + up)) / 100, reason: 'That is the price after the rise only.' },
      { value: (P * (100 - down)) / 100, reason: 'That is the price after the fall only, from the old price.' },
    ], rupees);
    return {
      kind: 'percent-change', seed, answerMode: 'single', figures: [], options, answer,
      prompt: `A price of ${rupees(P)} goes up by ${up}%, and then the new price comes down by ${down}%. What is the final price?`,
      explanation: `${rupees(P)} × ${(100 + up) / 100} = ${rupees((P * (100 + up)) / 100)}; then × ${(100 - down) / 100} = ${rupees(value)}.`,
    };
  });
}
export function ratioShare(seed) {
  return retry(seed, rng => {
    const parts = shuffle(rng, [1, 2, 3, 4, 5, 7]).slice(0, 3), total = parts.reduce((a, b) => a + b, 0), unit = pick(rng, [15, 20, 25, 30, 40, 60]), S = total * unit;
    const names = ['Asha', 'Bilal', 'Charu'], who = Math.floor(rng() * 3), value = parts[who] * unit;
    const { options, answer } = singleFrom(rng, value, [
      { value: S / 3, reason: 'That shares the money equally. The ratio says how many parts each gets.' },
      { value: parts[(who + 1) % 3] * unit, reason: `That is ${names[(who + 1) % 3]}'s share.` },
      { value: unit, reason: 'That is the value of one part. Multiply by the number of parts.' },
    ], rupees);
    return {
      kind: 'ratio-share', seed, answerMode: 'single', figures: [], options, answer,
      prompt: `${rupees(S)} is shared between ${names.join(', ')} in the ratio ${parts.join(' : ')}. How much does ${names[who]} get?`,
      explanation: `${parts.join(' + ')} = ${total} parts, so one part is ${rupees(S)} ÷ ${total} = ${rupees(unit)}. ${names[who]} has ${parts[who]} parts: ${rupees(value)}.`,
    };
  });
}
export function averageMissing(seed) {
  return retry(seed, rng => {
    const n = pick(rng, [4, 5, 6, 8, 9]), A = pick(rng, [12, 15, 18, 20, 24, 30, 35]), B = A + pick(rng, [1, 2, 3, 4]) * (rng() < 0.7 ? 1 : -1), value = (n + 1) * B - n * A;
    if (value <= 0) return null;
    const { options, answer } = singleFrom(rng, value, [{ value: B, reason: 'The new number is not the new average. It has to lift every other number\'s share too.' }, { value: B + (B - A), reason: 'The change in the average is spread over all the numbers, including the new one.' }, { value: n * B - n * A + A, reason: `Use totals: (${n} + 1) × ${B} − ${n} × ${A}.` }]);
    return {
      kind: 'average-missing', seed, answerMode: 'single', figures: [], options, answer,
      prompt: `The average of ${n} numbers is ${A}. When one more number is added, the average becomes ${B}. What is the number added?`,
      explanation: `Old total ${n} × ${A} = ${n * A}. New total ${n + 1} × ${B} = ${(n + 1) * B}. The new number is the difference: ${value}.`,
    };
  });
}
export function speedUnits(seed) {
  return retry(seed, rng => {
    const ms = pick(rng, [10, 12, 15, 20, 25, 30]), t = pick(rng, [8, 9, 10, 12, 15, 18]), L = ms * t, value = (ms * 18) / 5;
    const { options, answer } = singleFrom(rng, value, [{ value: ms, reason: `That is the speed in metres a second. Multiply by 18 ÷ 5 for kilometres an hour.` }, { value: (ms * 5) / 18, reason: 'The conversion is the other way round: from metres a second to kilometres an hour, multiply by 18 ÷ 5.' }, { value: ms * 36, reason: 'One metre a second is 3.6 km an hour, not 36.' }], v => `${Number.isInteger(v) ? v : v.toFixed(1)} km/h`);
    return {
      kind: 'speed-units', seed, answerMode: 'single', figures: [], options, answer,
      prompt: `A train ${L} m long passes a pole in ${t} seconds. What is its speed in km per hour?`,
      explanation: `To pass the pole the train travels its own length: ${L} m in ${t} s is ${ms} m/s. × 18 ÷ 5 = ${value} km/h.`,
    };
  });
}

// ---------- Exam standard ----------
// Discount slabs whose ranges double and whose discounts grow by doubling steps.
export function slabsOf({ end, d1, k }, count) {
  const out = [];
  let start = end / 2 + 1, stop = end, d = d1, step = k;
  for (let i = 0; i < count; i++) { out.push({ from: start, to: stop, discount: d }); start = stop + 1; stop *= 2; d += step; step *= 2; }
  return out;
}
export function slabQuestion(seed) {
  return retry(seed, rng => {
    const rule = { end: pick(rng, [200, 300, 400, 500]), d1: pick(rng, [9, 15, 19, 25, 29]), k: pick(rng, [10, 20, 30, 40]) };
    const shown = 5, target = shown + 2 + Math.floor(rng() * 3), all = slabsOf(rule, target), slab = all[target - 1];
    const amount = Math.round((slab.from + (slab.to - slab.from) * (0.3 + rng() * 0.4)) / 100) * 100;
    if (amount < slab.from || amount > slab.to) return null;
    const value = slab.discount, last = all[shown - 1].discount, diffs = all.slice(1, shown).map((s, i) => s.discount - all[i].discount);
    return {
      kind: 'slab-pattern', seed, ...numeric(value, 'rupees', [
        { value: last, reason: 'That is the last slab shown. The pattern carries on for larger purchases.' },
        { value: rule.d1 + (target - 1) * rule.k, reason: `The discount does not go up by the same amount each time: the increases are ${diffs.join(', ')}, doubling.` },
        { value: all[target - 2].discount, reason: 'That is the slab before the one the purchase falls in. Find the slab whose range contains the amount.' },
      ]),
      figures: [{ type: 'table', head: ['Purchase', 'Discount'], rows: all.slice(0, shown).map(s => [`${rupees(s.from)} – ${rupees(s.to)}`, rupees(s.discount)]) }],
      prompt: `A shop gives a festive discount by slabs, as in the table, and the pattern continues. What is the discount on a purchase of ${rupees(amount)}?`,
      explanation: `Each slab's range is double the last, and the discount rises by ${diffs.join(', ')}…, doubling each time. ${rupees(amount)} falls in the ${rupees(slab.from)} – ${rupees(slab.to)} slab, with a discount of ${rupees(value)}.`,
      hints: ['Look at how the ranges grow, and separately at how the discounts grow.', 'Write the increase between neighbouring discounts. Is that increase growing too?'],
      solution: [
        { text: `Ranges: each ends at double the last (${all.slice(0, 3).map(s => s.to).join(', ')}, …).` },
        { text: `Discount increases: ${diffs.join(', ')}. Each is double the one before.` },
        ...all.slice(shown).map(s => ({ text: `Next slab ${rupees(s.from)} – ${rupees(s.to)}: ${rupees(s.discount)}.` })),
        { text: `${rupees(amount)} is in the last of these: discount ${rupees(value)}.` },
      ],
    };
  });
}
export function ageQuestion(seed) {
  return retry(seed, rng => {
    const k = pick(rng, [2, 3, 4]), n = 2 + Math.floor(rng() * 5), Y = n + 3 + Math.floor(rng() * 20), m = Y * (k - 1) - k * n;
    if (m < 3 || m > 30) return null;
    const X = Y + m, askSum = rng() < 0.6, value = askSum ? X + Y : X;
    return {
      kind: 'age-puzzle', seed, ...numeric(value, 'years', [{ value: askSum ? X : X + Y, reason: askSum ? 'That is X\'s age only. Add Y\'s.' : 'That is the sum of both ages. The question asks for X.' }, { value: Y, reason: 'That is Y\'s present age.' }, { value: k * Y, reason: `X is ${k} times Y's age ${n} years ago, not Y's age now.` }]),
      figures: [],
      prompt: `X is ${k} times as old as Y was ${n} years ago. In ${m} years, Y will be as old as X is today. ${askSum ? 'What is the sum of their present ages?' : 'How old is X today?'}`,
      explanation: `X = ${k}(Y − ${n}) and Y + ${m} = X. So Y + ${m} = ${k}Y − ${k * n}, giving ${k - 1}Y = ${m + k * n}, Y = ${Y} and X = ${X}.`,
      hints: ['Write one equation for each sentence, using today\'s ages X and Y.', 'Replace X in one equation with what the other says it equals.'],
      solution: [{ text: `First sentence: X = ${k} × (Y − ${n}).` }, { text: `Second sentence: Y + ${m} = X.` }, { text: `So Y + ${m} = ${k}Y − ${k * n}: Y = ${Y}, X = ${X}.` }, { text: askSum ? `Sum: ${X} + ${Y} = ${X + Y}.` : `X is ${X}.` }],
    };
  });
}
const PERIODS = [{ name: 'day', hours: 24 }, { name: 'week', hours: 168 }, { name: 'year 2023', hours: 8760 }, { name: 'year 2024 (a leap year)', hours: 8784 }, { name: 'month of 30 days', hours: 720 }];
const FRACTIONS = [[1, 2], [1, 3], [1, 4], [1, 6], [1, 8], [1, 12], [1, 24]];
export function fractionTimeQuestion(seed) {
  return retry(seed, rng => {
    const period = pick(rng, PERIODS), parts = shuffle(rng, FRACTIONS).slice(0, 3), activities = ['working', 'sleeping', 'cooking'];
    const used = parts.reduce((s, [a, b]) => s + (period.hours * a) / b, 0), value = period.hours - used;
    if (!Number.isInteger(used) || value <= 0 || parts.reduce((s, [a, b]) => s + a / b, 0) >= 1) return null;
    const lead = parts.map(([a, b]) => (period.hours * a) / b);
    return {
      kind: 'fraction-time', seed, ...numeric(value, 'hours', [
        { value: period.hours - lead[0] - lead[1], reason: 'One of the three activities has been left out.' },
        ...(period.name.includes('leap') ? [{ value: Math.round(8760 * (value / 8784)), reason: '2024 is a leap year: 366 days, 8,784 hours.' }] : []),
        { value: Math.round(value / 24), reason: 'That is in days. The question asks for hours.' },
      ]),
      figures: [],
      prompt: `In one ${period.name}, a person spent ${parts.map(([a, b], i) => `${a}/${b} of the time ${activities[i]}`).join(', ')}, and the rest exercising. How many hours did they spend exercising?`,
      explanation: `The ${period.name} has ${period.hours.toLocaleString('en-IN')} hours. ${lead.join(' + ')} = ${used} hours are used, leaving ${value}.`,
      hints: [`How many hours are in a ${period.name}?`, 'Work out each fraction of that, add them, and take the total away.'],
      solution: [{ text: `Hours in the ${period.name}: ${period.hours.toLocaleString('en-IN')}.` }, ...parts.map(([a, b], i) => ({ text: `${activities[i]}: ${a}/${b} × ${period.hours} = ${lead[i]}.` })), { text: `Exercising: ${period.hours} − ${used} = ${value} hours.` }],
    };
  });
}
// Two trains: crossing each other, and a passenger watching the other train go by.
export function trainsQuestion(seed) {
  return retry(seed, rng => {
    const v = pick(rng, [36, 45, 54, 63, 72]), u = v + pick(rng, [18, 36]), sum = ((u + v) * 5) / 18, diff = ((u - v) * 5) / 18;
    const t2 = pick(rng, [12, 15, 18, 20, 24, 30]), t3 = pick(rng, [9, 12, 16, 20, 24, 27, 32]), Ls = diff * t2, Lf = diff * t3, t1 = (Ls + Lf) / sum;
    if (!Number.isInteger(t1) || t3 === t2) return null;
    return {
      kind: 'relative-speed', seed, ...numeric(t3, 'seconds', [{ value: t2, reason: 'That is how long the slower train is in view. Each passenger watches the other train, and the trains are different lengths.' }, { value: t1, reason: 'That is the time to cross each other when going opposite ways.' }, { value: Math.round(Lf / sum), reason: 'Going the same way, use the difference of the speeds, not the sum.' }]),
      figures: [],
      prompt: `Two trains run at ${u} km/h and ${v} km/h on parallel tracks. Going in opposite directions, they pass each other completely in ${t1} seconds. Going the same way, a passenger on the faster train sees the slower train for ${t2} seconds. Going the same way, how long does a passenger on the slower train see the faster train?`,
      explanation: `Opposite ways the closing speed is ${sum} m/s, so the two lengths add to ${sum} × ${t1} = ${Ls + Lf} m. Same way it is ${diff} m/s: the slower train is ${diff} × ${t2} = ${Ls} m, so the faster is ${Lf} m, seen for ${Lf} ÷ ${diff} = ${t3} s.`,
      hints: ['Opposite directions: add the speeds. Same direction: subtract them.', 'A passenger is a point: he sees the other train for the time it takes its length to slide past.'],
      solution: [{ text: `Speeds in m/s: sum ${u + v} × 5/18 = ${sum}, difference ${u - v} × 5/18 = ${diff}.` }, { text: `Both lengths together: ${sum} × ${t1} = ${Ls + Lf} m.` }, { text: `Slower train: ${diff} × ${t2} = ${Ls} m, so the faster train is ${Lf} m.` }, { text: `Faster train seen for ${Lf} ÷ ${diff} = ${t3} s.` }],
    };
  });
}
// Clock hands: the minute hand gains 5.5° a minute on the hour hand.
export function handsTime(h, target) {
  // Minutes after h:00 until the angle between the hands (minute behind hour) first equals target (0, 90, 180).
  const lead = (30 * (h % 12)) % 360, options = [lead - target, lead + target, lead - target + 360, lead + target - 360].filter(a => a > 1e-9 || (target === 0 && a === 0 && false));
  const gap = Math.min(...options.filter(a => a > 0));
  return (gap * 2) / 11; // minutes
}
export function clockHandsQuestion(seed) {
  return retry(seed, rng => {
    const h = 1 + Math.floor(rng() * 11), target = pick(rng, [0, 0, 180, 90]), exact = handsTime(h, target), value = Math.round(exact);
    if (exact > 60 || Math.abs(exact - value) > 0.49) return null;
    const words = { 0: 'together, one over the other', 180: 'in a straight line, pointing in opposite directions', 90: 'at right angles' }[target];
    const num = Math.round(exact * 11);
    return {
      kind: 'clock-hands', seed, ...numeric(value, 'minutes', [{ value: h * 5, reason: `The minute hand reaches the ${h} after ${h * 5} minutes, but by then the hour hand has moved on.` }, { value: Math.round((((30 * h + (target ? target : 0)) % 360) / 6)), reason: 'The hour hand moves too, half a degree a minute. Use the gain of 5.5° a minute.' }]),
      figures: [{ type: 'clock', h, m: 0 }],
      prompt: `It is exactly ${h} o'clock. After how many minutes will the hands next be ${words}? Give the nearest whole minute.`,
      explanation: `The minute hand gains 5.5° a minute. It must gain ${(exact * 5.5).toFixed(0)}°, which takes ${num}/11 ≈ ${exact.toFixed(2)} minutes, so about ${value} minutes.`,
      hints: ['Minute hand: 6° a minute. Hour hand: 0.5° a minute. So the minute hand gains 5.5° a minute.', `At ${h}:00 the hour hand is ${30 * h}° ahead of the minute hand.`],
      solution: [{ text: `At ${h}:00 the hour hand is ${30 * h}° ahead.` }, { text: `For the hands to be ${words}, the minute hand must gain ${Math.round(exact * 5.5)}°.` }, { text: `${Math.round(exact * 5.5)} ÷ 5.5 = ${num}/11 ≈ ${exact.toFixed(2)} minutes.` }, { text: `To the nearest minute: ${value}.` }],
    };
  });
}
export function cutSheetsQuestion(seed) {
  return retry(seed, rng => {
    const a = pick(rng, [15, 18, 20, 21, 24, 25, 30]), b = pick(rng, [12, 20, 25, 28, 32, 35, 40]), W = pick(rng, [120, 150, 180, 200, 240]), H = pick(rng, [90, 100, 120, 150]);
    if (a === b) return null;
    const one = Math.floor(W / a) * Math.floor(H / b), two = Math.floor(W / b) * Math.floor(H / a), value = Math.max(one, two), area = Math.floor((W * H) / (a * b));
    if (one === two || area === value) return null;
    return {
      kind: 'cut-sheets', seed, ...numeric(value, 'pieces', [{ value: area, reason: 'Dividing the areas assumes the leftover strips can be used. Pieces must be whole, cut edge to edge.' }, { value: Math.min(one, two), reason: 'Try the pieces the other way round too: one way fits more.' }]),
      figures: [],
      prompt: `How many pieces ${a} cm × ${b} cm can be cut from a sheet ${W} cm × ${H} cm, all lying the same way round, cutting edge to edge?`,
      explanation: `${a} along ${W}: ${Math.floor(W / a)} × ${Math.floor(H / b)} = ${one}. Turned round: ${Math.floor(W / b)} × ${Math.floor(H / a)} = ${two}. The most is ${value}.`,
      hints: ['How many fit along each side? Round down: part-pieces do not count.', 'Try both ways round.'],
      solution: [{ text: `One way: ⌊${W}/${a}⌋ × ⌊${H}/${b}⌋ = ${Math.floor(W / a)} × ${Math.floor(H / b)} = ${one}.` }, { text: `The other way: ⌊${W}/${b}⌋ × ⌊${H}/${a}⌋ = ${Math.floor(W / b)} × ${Math.floor(H / a)} = ${two}.` }, { text: `The most is ${value}.` }],
    };
  });
}
export function walkQuestion(seed) {
  return retry(seed, rng => {
    const [p, q] = pick(rng, [[3, 4], [5, 12], [8, 15], [6, 8], [9, 12], [7, 24]]), k = pick(rng, [1, 2, 3, 5]), a = p * k, b = q * k, same = rng() < 0.3;
    const value = same ? 2 * a : 2 * Math.hypot(a, b);
    return {
      kind: 'walk-distance', seed, ...numeric(value, 'metres', [{ value: 2 * (a + b), reason: 'Distances along two directions do not simply add. Use the straight line between the two people.' }, { value: Math.hypot(a, b), reason: 'That is one person\'s distance from the start. They are on opposite sides.' }, { value: same ? 2 * Math.hypot(a, b) : 2 * a, reason: same ? 'One turns left and the other right, so they end up on the same side of the starting line.' : 'Each turns left, which takes them to opposite sides of the starting line.' }]),
      figures: [],
      prompt: `Two people start at the same point and walk ${a} m in opposite directions. Then ${same ? 'one turns left and the other turns right' : 'each turns left'}, and each walks ${b} m. How far apart are they now, in metres?`,
      explanation: same ? `After the turns they walk in the same direction, so they stay ${2 * a} m apart.` : `Each turn to the left sends them opposite ways across the starting line. They are ${2 * a} m apart one way and ${2 * b} m the other: √(${2 * a}² + ${2 * b}²) = ${value} m.`,
      hints: ['Draw it. Mark where each person is after the first walk.', 'A left turn for someone walking east is north; for someone walking west it is south.'],
      solution: [{ text: `After the first walk they are ${2 * a} m apart.` }, { text: same ? 'One turns left, the other right: they now walk the same way, side by side.' : 'Turning left sends them in opposite directions, at right angles to their first walk.' }, { text: same ? `They stay ${2 * a} m apart.` : `Across ${2 * a} m, apart ${2 * b} m: √(${2 * a}² + ${2 * b}²) = ${value} m.` }],
    };
  });
}
export function piecesQuestion(seed) {
  return retry(seed, rng => {
    const n = 3 + Math.floor(rng() * 6), value = (n * (n + 1)) / 2 + 1;
    return {
      kind: 'max-pieces', seed, ...numeric(value, 'pieces', [{ value: 2 ** n, reason: 'Each cut does not double the pieces: it only splits the pieces it passes through.' }, { value: 2 * n, reason: 'That is what you get when every cut passes through the centre. Cuts that miss the centre make more.' }, { value: n + 1, reason: 'That is for parallel cuts. Cuts that cross each other make more.' }]),
      figures: [],
      prompt: `One straight cut divides a round sheet into 2 pieces; two crossing cuts make at most 4. What is the greatest number of pieces with ${n} straight cuts?`,
      explanation: `The k-th cut can cross all k − 1 earlier cuts and so passes through k pieces, adding k. Total: 1 + 1 + 2 + … + ${n} = ${value}.`,
      hints: ['How many pieces does the third cut pass through if it crosses both earlier cuts?', 'Each new cut adds one more piece than the cut before it.'],
      solution: [{ text: 'Start with 1 piece. The first cut adds 1, the second adds 2, the third adds 3, and so on.' }, { text: `1 + (1 + 2 + … + ${n}) = 1 + ${(n * (n + 1)) / 2}.` }, { text: `= ${value} pieces.` }],
    };
  });
}

// ---------- Exam hard ----------
export function twoLegsQuestion(seed) {
  return retry(seed, rng => {
    const [rn, rd] = pick(rng, [[3, 10], [1, 2], [1, 4], [2, 1], [3, 2], [3, 1]]), s = pick(rng, [2, 3]), x = pick(rng, [10, 12, 15, 18, 20, 24, 30]);
    // Overall average = total distance / total time, with first leg d and second leg r·d.
    const r = rn / rd, V = (x * (1 + r)) / (1 + r / s);
    if (Math.abs(V - Math.round(V)) > 1e-9) return null;
    const value = s * x;
    return {
      kind: 'two-legs', seed, ...numeric(value, 'km/h', [{ value: x, reason: 'That is the speed on the first leg.' }, { value: Math.round((2 * V) / (1 + 1 / s)), reason: 'The legs are different lengths, so the average speed is not a simple mean of the two speeds.' }, { value: V, reason: 'That is the average for the whole trip.' }]),
      figures: [],
      prompt: `Tim rides from home to a friend's house, then on to school without stopping. His average speed for the whole trip is ${Math.round(V)} km/h. The second leg is ${rd === 1 ? `${rn} times as long as` : `${rn}/${rd} of the length of`} the first, and he rides it at ${s} times his speed on the first leg. What is his speed on the second leg?`,
      explanation: `Let the first leg be d at speed x. Time = d/x + ${r}d/(${s}x). Average = ${1 + r}d ÷ time = x × ${1 + r} ÷ ${1 + r / s} = ${Math.round(V)}, so x = ${x} and the second leg is ${value} km/h.`,
      hints: ['Average speed = total distance ÷ total time, never the mean of the speeds.', 'Call the first leg d and the first speed x. Write the time for each leg.'],
      solution: [{ text: `First leg d at x km/h: time d/x. Second leg ${r}d at ${s}x: time ${r}d/(${s}x).` }, { text: `Average = ${1 + r}d ÷ (d/x × ${1 + r / s}) = ${((1 + r) / (1 + r / s)).toFixed(3).replace(/0+$/, '')}x.` }, { text: `${((1 + r) / (1 + r / s)).toFixed(3).replace(/0+$/, '')}x = ${Math.round(V)}, so x = ${x}.` }, { text: `Second leg: ${s} × ${x} = ${value} km/h.` }],
    };
  });
}
// Four people cross with one umbrella that covers two; it must be carried back.
export const crossingBest = ([a, b, c, d]) => Math.min(a + 3 * b + d, 2 * a + b + c + d);
export function crossingQuestion(seed) {
  return retry(seed, rng => {
    const times = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15]).slice(0, 4).sort((x, y) => x - y), [a, b, c, d] = times, value = crossingBest(times), other = Math.max(a + 3 * b + d, 2 * a + b + c + d);
    if (other === value) return null;
    const names = ['grandfather', 'father', 'son', 'daughter'], order = [3, 2, 1, 0];
    return {
      kind: 'crossing', seed, ...numeric(value, 'minutes', [{ value: other, reason: 'That plan works but is not the fastest. Compare the two ways of getting the two slowest across.' }, { value: a + b + c + d, reason: 'Someone has to bring the umbrella back each time; those trips count too.' }, { value: 2 * (b + c + d) - a, reason: 'Count each trip once: three crossings over and two back.' }]),
      figures: [],
      prompt: `A family of four must walk from the bus stop to home in the rain with one umbrella that covers two people. The ${order.map((i, k) => `${names[k]} takes ${times[i]} min`).join(', the ')} for the walk. Two walking together go at the slower one's pace, and someone must bring the umbrella back each time. What is the least total time for all four to get home dry?`,
      explanation: `Two plans: the fastest walker escorts everyone (${2 * a + b + c + d} min), or the two fastest go first, then the two slowest go together (${a + 3 * b + d} min). The better is ${value} min.`,
      hints: ['The two slowest should probably walk together, so their times overlap.', 'Compare: fastest escorts everyone, versus the two slowest crossing together.'],
      solution: [{ text: `Times: ${times.join(', ')} minutes.` }, { text: `Plan 1, fastest escorts each: ${d} + ${a} + ${c} + ${a} + ${b} = ${2 * a + b + c + d}.` }, { text: `Plan 2, slowest two together: ${b} (two fastest over) + ${a} (back) + ${d} (slowest two) + ${b} (back) + ${b} = ${a + 3 * b + d}.` }, { text: `The least is ${value} minutes.` }],
    };
  });
}
const digits = n => String(n).split('').reduce((s, ch) => s + Number(ch), 0);
export function clockDigitsQuestion(seed) {
  return retry(seed, rng => {
    const h = 1 + Math.floor(rng() * 12), from = pick(rng, [0, 0, 10, 20, 30]), to = from + pick(rng, [19, 29, 59]);
    if (to > 59) return null;
    let value = 0;
    for (let m = from; m <= to; m++) value += digits(h) + digits(m);
    const count = to - from + 1;
    return {
      kind: 'clock-digits', seed, ...numeric(value, '', [{ value: value - count * digits(h), reason: `The hour digits show every minute too: add ${count} × ${digits(h)}.` }, { value: value - count * digits(h) + digits(h), reason: 'The hour is on the display all the time, not once.' }]),
      figures: [],
      prompt: `A digital clock shows hours and minutes, like ${h}:${String(from).padStart(2, '0')}. At ${h}:${String(from).padStart(2, '0')} the digits add up to ${digits(h) + digits(from)}. Adding the digit sums for every minute from ${h}:${String(from).padStart(2, '0')} to ${h}:${String(to).padStart(2, '0')} inclusive, what is the total?`,
      explanation: `${count} minutes, each showing the hour ${h} (digit sum ${digits(h)}): ${count * digits(h)}. The minute digits from ${String(from).padStart(2, '0')} to ${to} add to ${value - count * digits(h)}. Total ${value}.`,
      hints: ['Split the display into the hour part and the minute part.', 'For the minutes, add the tens digits and the units digits separately.'],
      solution: [{ text: `Hour part: ${count} minutes × ${digits(h)} = ${count * digits(h)}.` }, { text: `Minute part: units digits 0 to 9 repeat; tens digits stay for ten minutes each. Together they add to ${value - count * digits(h)}.` }, { text: `Total: ${count * digits(h)} + ${value - count * digits(h)} = ${value}.` }],
    };
  });
}
export function displacementQuestion(seed) {
  return retry(seed, rng => {
    const [l, w, h] = pick(rng, [[20, 5, 10], [20, 10, 10], [25, 10, 8], [30, 10, 10], [40, 10, 10]]), V = l * w * h, brick = pick(rng, [[5, 2, 1], [4, 2, 2], [5, 4, 1], [2, 2, 5]]), v = brick[0] * brick[1] * brick[2];
    const p = pick(rng, [10, 20, 25, 30, 40, 50]), a = (v * p) / 100, n = 30 + Math.floor(rng() * 70), W = V - n * (v - a);
    if (!Number.isInteger(a) || !Number.isInteger(W) || W <= 0 || W > V / 2) return null;
    return {
      kind: 'displacement', seed, ...numeric(n, 'bricks', [{ value: Math.floor((V - W) / v), reason: 'Each brick soaks up some water, so it raises the level by less than its own volume.' }, { value: Math.floor((V - W) / (v + a)), reason: 'The soaked-up water leaves the tank\'s water, so it makes the level rise less, not more.' }]),
      figures: [],
      prompt: `A tank ${l} × ${w} × ${h} cm holds ${W} cc of water. Bricks ${brick.join(' × ')} cm are dropped in and are fully under water; each soaks up water equal to ${p}% of its own volume. Bricks are added until the water just fills the tank. How many bricks are used?`,
      explanation: `Tank ${V} cc. Each brick takes ${v} cc of space but removes ${a} cc of water, so it raises the filled volume by ${v - a} cc. (${V} − ${W}) ÷ ${v - a} = ${n}.`,
      hints: ['How much does one brick add to the space taken up, after it soaks up water?', 'Space to fill: tank volume minus the water already there.'],
      solution: [{ text: `Tank volume: ${l} × ${w} × ${h} = ${V} cc. Space left: ${V - W} cc.` }, { text: `One brick: ${v} cc, soaking up ${p}% of that = ${a} cc. Net rise: ${v - a} cc.` }, { text: `${V - W} ÷ ${v - a} = ${n} bricks.` }],
    };
  });
}
// A short procedure with a loop.
export function runProcedure({ x0, y0, op, stop }) {
  let x = x0, y = y0, steps = 0;
  for (;;) { x = op === 'times' ? x * y : op === 'plus' ? x + y : x + 2 * y; y += 1; steps++; if (y === stop || steps > 50) break; }
  return x;
}
export function procedureQuestion(seed) {
  return retry(seed, rng => {
    const op = pick(rng, ['times', 'plus', 'plus-double']), x0 = pick(rng, [1, 2, 3]), y0 = pick(rng, [1, 2, 3]), stop = y0 + 3 + Math.floor(rng() * 3);
    const value = runProcedure({ x0, y0, op, stop }), extra = op === 'times' ? value * stop : op === 'plus' ? value + stop : value + 2 * stop;
    const shy = runProcedure({ x0, y0, op, stop: stop - 1 });
    if (value > 5000) return null;
    const rule = { times: 'x = x × y', plus: 'x = x + y', 'plus-double': 'x = x + 2y' }[op];
    return {
      kind: 'procedure', seed, ...numeric(value, '', [{ value: extra, reason: `The test comes straight after y goes up. When y reaches ${stop} the procedure stops before using it.` }, { value: shy, reason: 'One pass too few: follow the loop until the test sends you to the end.' }]),
      figures: [{ type: 'table', head: ['Step', 'Instruction'], rows: [['1', `x = ${x0}, y = ${y0}`], ['2', rule], ['3', 'y = y + 1'], ['4', `If y = ${stop}, go to step 6; otherwise go to step 5`], ['5', 'Go to step 2'], ['6', 'Stop']] }],
      prompt: 'Follow the steps in the table. What is the value of x when it stops?',
      explanation: `x takes the values ${(() => { const out = []; let x = x0, y = y0; for (;;) { x = op === 'times' ? x * y : op === 'plus' ? x + y : x + 2 * y; out.push(x); y++; if (y === stop) break; } return out.join(', '); })()}; then y reaches ${stop} and it stops.`,
      hints: ['Keep a table with a column for x and a column for y. Update it one step at a time.', 'Check the test right after y changes.'],
      solution: [{ text: `Start: x = ${x0}, y = ${y0}.` }, ...(() => { const out = []; let x = x0, y = y0; for (;;) { x = op === 'times' ? x * y : op === 'plus' ? x + y : x + 2 * y; const yBefore = y; y++; out.push({ text: `With y = ${yBefore}: x = ${x}; y becomes ${y}${y === stop ? ', so stop' : ''}.` }); if (y === stop) break; } return out; })(), { text: `x = ${value}.` }],
    };
  });
}
// A basket puzzle: several ratios and two bounds pin down one total.
export function basketTotals({ p, q, r, max, min }) {
  const out = [];
  for (let good = 1; good <= max; good++) {
    const apples = good * (1 + p), oranges = r * apples;
    if (oranges % (1 + q)) continue;
    const total = apples + oranges;
    if (total > min && total <= max) out.push(total);
  }
  return out;
}
export function basketQuestion(seed) {
  return retry(seed, rng => {
    const p = pick(rng, [1, 2, 3]), q = pick(rng, [1, 2, 3]), r = pick(rng, [2, 3, 4]), max = pick(rng, [40, 50, 60, 72]), min = max - pick(rng, [8, 10, 12, 15]);
    const totals = basketTotals({ p, q, r, max, min });
    if (totals.length !== 1) return null;
    const value = totals[0], apples = value / (1 + r);
    return {
      kind: 'basket', seed, ...numeric(value, 'fruits', [{ value: max, reason: `${max} is only the limit. The total must also fit every ratio.` }, { value: apples, reason: 'That is the apples only. Add the oranges.' }, { value: value - apples, reason: 'That is the oranges only.' }]),
      figures: [],
      prompt: `A basket holds at most ${max} fruits, all apples and oranges. Rotten apples are ${p} times the good apples. Good oranges are ${q} times the rotten oranges. There are ${r} times as many oranges as apples, and more than ${min} fruits in all. How many fruits are in the basket?`,
      explanation: `Apples are a multiple of ${1 + p}; oranges are ${r} times the apples and a multiple of ${1 + q}. The total is ${1 + r} times the apples. Between ${min} and ${max}, only ${value} works.`,
      hints: [`Apples = good + rotten = good × ${1 + p}. So apples come in groups of ${1 + p}.`, `Oranges = rotten × ${1 + q}, and also ${r} × apples.`],
      solution: [{ text: `Apples are a multiple of ${1 + p}. Oranges are ${r} × apples and a multiple of ${1 + q}.` }, { text: `Total = apples × ${1 + r}. List totals that fit: ${basketTotals({ p, q, r, max: max * 2, min: 0 }).slice(0, 6).join(', ')}, …` }, { text: `Only ${value} is more than ${min} and at most ${max}.` }],
    };
  });
}
// A daily cycle of items with a break in the middle; which item on a given date.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayMs = 86400000, dateText = d => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
export function cycleItem({ start, gapFrom, gapTo, target, items }) {
  // Days before the break run the cycle from the start; after the break it restarts at the first item.
  if (target < gapFrom) return items[Math.round((target - start) / dayMs) % items.length];
  return items[Math.round((target - gapTo) / dayMs - 1) % items.length];
}
export function calendarQuestion(seed) {
  return retry(seed, rng => {
    const year = pick(rng, [2022, 2023, 2025]), month = pick(rng, [5, 6, 7]), start = Date.UTC(year, month, 3 + Math.floor(rng() * 20));
    const gapFrom = start + (30 + Math.floor(rng() * 40)) * dayMs, gapTo = gapFrom + (5 + Math.floor(rng() * 15)) * dayMs, target = gapTo + (10 + Math.floor(rng() * 40)) * dayMs;
    const items = ['A', 'B', 'C', 'D'].slice(0, pick(rng, [3, 4, 4])), truth = cycleItem({ start, gapFrom, gapTo, target, items });
    const noBreak = items[Math.round((target - start) / dayMs) % items.length];
    if (noBreak === truth) return null;
    const options = items.map(id => ({ id, label: id, text: `Item ${id}`, correct: id === truth, reason: id === truth ? 'Counting from the restart, this is the item on that date.' : id === noBreak ? 'That ignores the break: the cycle restarted at A after it.' : 'Count the days from the restart again; the remainder picks the item.' }));
    while (options.length < 4) options.push({ id: 'E', label: 'E', text: 'None: training had stopped', correct: false, reason: 'Training resumed after the break and continued daily.' });
    return {
      kind: 'calendar-cycle', seed, answerMode: 'single', figures: [], options: options.map((o, i) => ({ ...o, id: 'ABCD'[i], label: 'ABCD'[i] })), answer: 'ABCD'[options.findIndex(o => o.correct)],
      prompt: `From ${dateText(new Date(start))}, an athlete trains every day using kit ${items.join(', ')} in turn, one a day, starting with ${items[0]}. She misses ${dateText(new Date(gapFrom))} to ${dateText(new Date(gapTo))} inclusive, and when she starts again the next day she begins again with ${items[0]}. Which kit does she use on ${dateText(new Date(target))}?`,
      explanation: `After the break she restarts with ${items[0]} on ${dateText(new Date(gapTo + dayMs))}. ${Math.round((target - gapTo) / dayMs) - 1} days later is ${dateText(new Date(target))}: remainder ${(Math.round((target - gapTo) / dayMs) - 1) % items.length} in a cycle of ${items.length}, which is ${truth}.`,
      hints: ['Only the days after the break matter: the cycle restarts.', `Count days from the restart and divide by ${items.length}. The remainder picks the item.`],
      solution: [{ text: `Restart: ${dateText(new Date(gapTo + dayMs))} with ${items[0]}.` }, { text: `Days from the restart to ${dateText(new Date(target))}: ${Math.round((target - gapTo) / dayMs) - 1}.` }, { text: `${Math.round((target - gapTo) / dayMs) - 1} ÷ ${items.length} leaves ${(Math.round((target - gapTo) / dayMs) - 1) % items.length}: item ${truth}.` }, { text: `So the answer is ${'ABCD'[options.findIndex(o => o.correct)]}.` }],
    };
  });
}

export function quantQuestion(seed, kind) {
  const make = {
    'percent-change': percentChange, 'ratio-share': ratioShare, 'average-missing': averageMissing, 'speed-units': speedUnits,
    'slab-pattern': slabQuestion, 'age-puzzle': ageQuestion, 'fraction-time': fractionTimeQuestion, 'relative-speed': trainsQuestion, 'clock-hands': clockHandsQuestion, 'cut-sheets': cutSheetsQuestion, 'walk-distance': walkQuestion, 'max-pieces': piecesQuestion,
    'two-legs': twoLegsQuestion, crossing: crossingQuestion, 'clock-digits': clockDigitsQuestion, displacement: displacementQuestion, procedure: procedureQuestion, basket: basketQuestion, 'calendar-cycle': calendarQuestion,
  }[kind];
  if (!make) throw new Error('Unknown quant kind ' + kind);
  return make(seed);
}
export const QUANT_LEVELS = { 'percent-change': 1, 'ratio-share': 1, 'average-missing': 2, 'speed-units': 2, 'slab-pattern': 3, 'age-puzzle': 3, 'fraction-time': 3, 'relative-speed': 3, 'clock-hands': 3, 'cut-sheets': 3, 'walk-distance': 3, 'max-pieces': 3, 'two-legs': 4, crossing: 4, 'clock-digits': 4, displacement: 4, procedure: 4, basket: 4, 'calendar-cycle': 4 };
void gcd; void plural;
