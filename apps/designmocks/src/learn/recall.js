// The recall pattern: questions built from a deck of facts. A deck has
// facts ({ name, type, ...fields }), labels for types and fields, and
// ordered sequences. Kinds: name-it, which-is-a, match the following, odd
// one out, put in order, and two conditions at once.
// Specification: docs/learn/topics/recall-pattern.md.
import { pick, seededRandom, shuffle } from './random.js';
import { imageFor } from './decks/images.js';

const LETTERS = 'ABCD';
function retry(seed, build) {
  for (let i = 0; i < 600; i++) { const q = build(seededRandom(seed * 4973 + i * 7559)); if (q) return q; }
  throw new Error('No recall question for seed ' + seed);
}
const lettered = (rng, list) => {
  const options = shuffle(rng, list).map((o, i) => ({ ...o, id: LETTERS[i], label: LETTERS[i] }));
  return { options, answer: options.find(o => o.correct).id };
};
const article = w => (/^[aeiou]/i.test(w) ? 'an' : 'a');

export function recallQuestion(deck, kind, seed, level) {
  const facts = deck.facts, fields = Object.keys(deck.fields);
  const withField = f => facts.filter(x => x[f] !== undefined);
  const base = { kind: `${deck.prefix}-${kind}`, seed };
  const lessonNote = fact => (fact.note ? ` ${fact.note}` : '');
  if (kind === 'name') return retry(seed, rng => {
    const f = pick(rng, fields), fact = pick(rng, withField(f)), right = fact[f];
    const wrong = [...new Set(shuffle(rng, withField(f).filter(x => x[f] !== right && x.type === fact.type)).concat(shuffle(rng, withField(f).filter(x => x[f] !== right))).map(x => x[f]))].slice(0, 3);
    if (wrong.length < 3) return null;
    const { options, answer } = lettered(rng, [right, ...wrong].map(t => ({ correct: t === right, text: t, reason: t === right ? `${fact.name}: ${right}.${lessonNote(fact)}` : `That fits ${facts.filter(x => x[f] === t).map(x => x.name).slice(0, 2).join(' and ')}, not ${fact.name}.` })));
    const pic = imageFor(fact.name);
    return { ...base, answerMode: 'single', prompt: deck.fields[f].replace('{name}', fact.name), figures: pic ? [{ type: 'photo', image: pic, alt: fact.name }] : [], options, answer, explanation: `${fact.name} — ${deck.types[fact.type]}: ${fields.filter(g => fact[g]).map(g => fact[g]).join('; ')}.` };
  });
  if (kind === 'identify') return retry(seed, rng => {
    const shown = facts.filter(x => imageFor(x.name)), fact = pick(rng, shown), label = deck.types[fact.type];
    const same = shuffle(rng, facts.filter(x => x !== fact && x.type === fact.type)), near = shuffle(rng, facts.filter(x => (deck.near?.[fact.type] ?? []).includes(x.type)));
    const wrong = [...same, ...near].filter((x, i, l) => l.indexOf(x) === i).slice(0, 3);
    if (wrong.length < 3) return null;
    const { options, answer } = lettered(rng, [fact, ...wrong].map(x => ({ correct: x === fact, text: x.name, reason: x === fact ? `This is ${fact.name}.${fact.how ? ' ' + fact.how + '.' : ''}` : `${x.name}${x.how ? ': ' + x.how.charAt(0).toLowerCase() + x.how.slice(1) : ''} — not what the picture shows.` })));
    return { ...base, answerMode: 'single', prompt: `This picture shows ${article(label)} ${label}. Which one?`, figures: [{ type: 'photo', image: imageFor(fact.name), alt: `A photograph of ${article(label)} ${label}` }], options, answer, explanation: `${fact.name}${fact.place ? ', ' + fact.place : ''}. ${fact.how ?? ''}`.trim(), ...(level >= 3 ? { hints: ['Look for the one feature that sets it apart: material, colour, pattern or shape.'], solution: [{ text: 'Name what kind of thing it is.' }, { text: `Look for its telling feature: ${fact.how ?? fact.name}.` }, { text: `It is ${fact.name}.` }] } : {}) };
  });
  if (kind === 'which') return retry(seed, rng => {
    const type = pick(rng, Object.keys(deck.types)), yes = facts.filter(x => x.type === type), no = facts.filter(x => x.type !== type && !(deck.near?.[type] ?? []).includes(x.type) ? true : x.type !== type);
    if (!yes.length || no.length < 3) return null;
    const right = pick(rng, yes), wrong = shuffle(rng, no).slice(0, 3);
    const { options, answer } = lettered(rng, [right, ...wrong].map(x => ({ correct: x === right, text: x.name, reason: x === right ? `${x.name} is ${article(deck.types[type])} ${deck.types[type]}.` : `${x.name} is ${article(deck.types[x.type])} ${deck.types[x.type]}.` })));
    return { ...base, answerMode: 'single', prompt: `Which of these is ${article(deck.types[type])} ${deck.types[type]}?`, figures: [], options, answer, explanation: `${right.name} is ${article(deck.types[type])} ${deck.types[type]}. The others: ${wrong.map(x => `${x.name} (${deck.types[x.type]})`).join(', ')}.` };
  });
  if (kind === 'match') return retry(seed, rng => {
    const f = pick(rng, fields), n = level >= 4 ? 4 : 3, pool = shuffle(rng, withField(f)), chosen = [];
    for (const x of pool) if (chosen.length < n && !chosen.some(c => c[f] === x[f])) chosen.push(x);
    if (chosen.length < n) return null;
    const values = shuffle(rng, chosen.map(c => c[f])), key = perm => chosen.map((c, i) => `${i + 1}–${LETTERS[perm[i]]}`).join(', ');
    const truth = chosen.map(c => values.indexOf(c[f])), seen = new Set([key(truth)]), wrongs = [];
    for (let g = 0; wrongs.length < 3 && g < 50; g++) { const p = [...truth], i = Math.floor(rng() * n), j = (i + 1 + Math.floor(rng() * (n - 1))) % n; [p[i], p[j]] = [p[j], p[i]]; if (rng() < 0.4) { const k2 = Math.floor(rng() * n), l2 = (k2 + 1) % n; [p[k2], p[l2]] = [p[l2], p[k2]]; } if (!seen.has(key(p))) { seen.add(key(p)); wrongs.push(p); } }
    if (wrongs.length < 3) return null;
    const { options, answer } = lettered(rng, [truth, ...wrongs].map(p => ({ correct: p === truth, text: key(p), reason: p === truth ? chosen.map(c => `${c.name}: ${c[f]}`).join('; ') + '.' : `This pairs ${chosen[p.findIndex((v, i) => v !== truth[i])].name} wrongly.` })));
    return { ...base, answerMode: 'single', prompt: `Match each item with its ${deck.fieldWords[f]}.`, figures: [{ type: 'table', head: ['', deck.fieldWords[f].replace(/^./, c => c.toUpperCase())], rows: chosen.map((c, i) => [`${i + 1}. ${c.name}`, `${LETTERS[i]}. ${values[i]}`]) }], options, answer, explanation: chosen.map(c => `${c.name}: ${c[f]}`).join('; ') + '.', hints: ['Start with the pair you are surest of; it rules out options.', 'Then the next surest.'], solution: [...chosen.map((c, i) => ({ text: `${i + 1}. ${c.name} → ${LETTERS[values.indexOf(c[f])]} (${c[f]}).` })), { text: `So: ${key(truth)}.` }].slice(0, Math.max(3, n + 1)) };
  });
  if (kind === 'odd') return retry(seed, rng => {
    const types = Object.keys(deck.types).filter(t => facts.filter(x => x.type === t).length >= 3), type = pick(rng, types), same = shuffle(rng, facts.filter(x => x.type === type)).slice(0, 3);
    const nearTypes = deck.near?.[type] ?? [], others = facts.filter(x => x.type !== type && (nearTypes.length ? nearTypes.includes(x.type) : true));
    if (same.length < 3 || !others.length) return null;
    const odd = pick(rng, others);
    const { options, answer } = lettered(rng, [odd, ...same].map(x => ({ correct: x === odd, text: x.name, reason: x === odd ? `${x.name} is ${article(deck.types[x.type])} ${deck.types[x.type]}; the others are ${deck.types[type]}s.` : `${x.name} is ${article(deck.types[type])} ${deck.types[type]}, like two of the others.` })));
    return { ...base, answerMode: 'single', prompt: 'Which one does not belong with the other three?', figures: [], options, answer, explanation: `${same.map(x => x.name).join(', ')} are ${deck.types[type]}s; ${odd.name} is ${article(deck.types[odd.type])} ${deck.types[odd.type]}.`, hints: ['Name what each one is.', 'Three share a group; find the one that does not.'], solution: [...same.map(x => ({ text: `${x.name}: ${deck.types[type]}.` })), { text: `${odd.name}: ${deck.types[odd.type]} — the odd one out.` }] };
  });
  if (kind === 'order') return retry(seed, rng => {
    const seq = pick(rng, deck.sequences), steps = seq.steps, n = steps.length, letters = shuffle(rng, steps.map((_, i) => i));
    const STEP = 'ABCDEF', shown = letters.map(i => steps[i]), say = order => order.map(i => STEP[letters.indexOf(i)]).join(', ');
    const truth = steps.map((_, i) => i), cands = [truth];
    for (let g = 0; cands.length < 4 && g < 60; g++) { const p = [...truth], i = Math.floor(rng() * (n - 1)); [p[i], p[i + 1]] = [p[i + 1], p[i]]; if (rng() < 0.5) { const j = Math.floor(rng() * (n - 1)); [p[j], p[j + 1]] = [p[j + 1], p[j]]; } if (!cands.some(c => c.join() === p.join())) cands.push(p); }
    if (cands.length < 4 || n > 6) return null;
    const { options, answer } = lettered(rng, cands.map(p => ({ correct: p === truth, text: say(p), reason: p === truth ? steps.join(' → ') + '.' : `${steps[p.findIndex((v, i) => v !== i)]} is out of place.` })));
    return { ...base, answerMode: 'single', prompt: `${seq.title} Put the steps in order.`, figures: [{ type: 'table', head: ['', 'Step'], rows: shown.map((s, i) => [STEP[i], s]) }], options, answer, explanation: `${steps.join(' → ')}.${seq.why ? ' ' + seq.why : ''}`, hints: ['Find the first step: what must happen before anything else?', 'Then ask what each step needs from the one before.'], solution: [{ text: `First: ${steps[0]}.` }, { text: `Then: ${steps.slice(1, -1).join(', then ')}.` }, { text: `Last: ${steps[n - 1]}.` }] };
  });
  if (kind === 'two') return retry(seed, rng => {
    const f = pick(rng, fields.filter(g => deck.twoFields.includes(g))), fact = pick(rng, withField(f)), type = fact.type, value = fact[f];
    const both = withField(f).filter(x => x.type === type && x[f] === value);
    if (both.length !== 1) return null;
    const onlyType = shuffle(rng, facts.filter(x => x.type === type && x[f] !== value)), onlyField = shuffle(rng, withField(f).filter(x => x.type !== type && x[f] === value)), neither = shuffle(rng, facts.filter(x => x.type !== type && x[f] !== value));
    const wrong = [...onlyType.slice(0, 1), ...onlyField.slice(0, 1), ...neither].filter((x, i, l) => l.indexOf(x) === i).slice(0, 3);
    if (wrong.length < 3) return null;
    const { options, answer } = lettered(rng, [fact, ...wrong].map(x => ({ correct: x === fact, text: x.name, reason: x === fact ? `${x.name} is ${article(deck.types[type])} ${deck.types[type]} and its ${deck.fieldWords[f]} is ${value}.` : x.type === type ? `Right group, but its ${deck.fieldWords[f]} is ${x[f] ?? 'different'}.` : x[f] === value ? `Right ${deck.fieldWords[f]}, but it is ${article(deck.types[x.type])} ${deck.types[x.type]}.` : 'Neither condition fits.' })));
    return { ...base, answerMode: 'single', prompt: `Which is ${article(deck.types[type])} ${deck.types[type]} whose ${deck.fieldWords[f]} is ${value}?`, figures: [], options, answer, explanation: `Only ${fact.name} meets both conditions.`, hints: ['Check each option against the first condition, then the second.'], solution: [{ text: `${deck.types[type].replace(/^./, c => c.toUpperCase())}s offered: ${[fact, ...wrong].filter(x => x.type === type).map(x => x.name).join(', ')}.` }, { text: `Of those, ${deck.fieldWords[f]} ${value}: ${fact.name}.` }, { text: `Answer: ${fact.name}.` }] };
  });
  throw new Error('Unknown recall kind ' + kind);
}
export const RECALL_LEVELS = Object.freeze({ name: [1], identify: [2, 3], which: [2], match: [3, 4], odd: [3], order: [4], two: [4] });
export const hasPictures = deck => deck.facts.filter(x => imageFor(x.name)).length >= 4;
export function recallKinds(deck) {
  return Object.fromEntries(Object.entries(RECALL_LEVELS).filter(([kind]) => (kind !== 'two' || deck.twoFields) && (kind !== 'identify' || hasPictures(deck))).map(([kind, levels]) => [`${deck.prefix}-${kind}`, { topic: deck.topic, levels, generate: (seed, level) => recallQuestion(deck, kind, seed, level) }]));
}
