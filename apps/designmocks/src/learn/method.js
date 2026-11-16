// The method pattern: a design brief worked step by step, checked with
// objective questions. A method deck holds authored items for each step of
// the method (each with one right answer, three wrong ones and why), plus
// ordered sequences. Specification: docs/learn/topics/method-pattern.md.
import { seededRandom, shuffle } from './random.js';

const LETTERS = 'ABCD';
export function methodQuestion(deck, kind, seed, level) {
  const items = deck.items[kind];
  if (!items?.length) throw new Error(`No ${kind} items in ${deck.prefix}`);
  const item = items[(seed - 1 + items.length * 1000) % items.length], rng = seededRandom(seed * 3389 + 17);
  const list = shuffle(rng, [{ text: item.right, correct: true, reason: item.why }, ...item.wrong.slice(0, 3).map(w => ({ text: typeof w === 'string' ? w : w.text, correct: false, reason: typeof w === 'string' ? deck.wrongWhy?.[kind] ?? 'This does not answer what the step asks.' : w.why }))]);
  const options = list.map((o, i) => ({ ...o, id: LETTERS[i], label: LETTERS[i] }));
  const method = deck.method[kind];
  return {
    kind: `${deck.prefix}-${kind}`, seed, answerMode: 'single',
    prompt: item.brief ? `${item.brief} ${item.prompt}` : item.prompt,
    figures: item.table ? [{ type: 'table', head: item.table.head, rows: item.table.rows }] : [],
    options, answer: options.find(o => o.correct).id,
    explanation: item.why,
    ...(level >= 3 ? { hints: [method.hint], solution: (item.steps ?? method.steps).map(text => ({ text })) } : {}),
  };
}
export function methodKinds(deck) {
  return Object.fromEntries(Object.entries(deck.levels).map(([kind, levels]) => [`${deck.prefix}-${kind}`, { topic: deck.topic, levels, generate: (seed, level) => methodQuestion(deck, kind, seed, level) }]));
}
