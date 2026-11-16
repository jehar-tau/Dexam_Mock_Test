// Method decks: every item has one right answer and three distinct wrong
// ones; computed items are re-checked (ramp slopes, process order).
import test from 'node:test';
import assert from 'node:assert/strict';
import { methodQuestion } from '../src/learn/method.js';
import { productDeck } from '../src/learn/decks/product.js';
import { posterDeck, storyDeck } from '../src/learn/decks/communication.js';

const DECKS = [productDeck, posterDeck, storyDeck];
test('every method item is well formed', () => {
  for (const deck of DECKS) for (const [kind, items] of Object.entries(deck.items)) {
    assert.ok(items.length >= 4, `${deck.prefix}-${kind} needs at least four items`);
    for (const item of items) {
      const texts = [item.right, ...item.wrong.map(w => (typeof w === 'string' ? w : w.text))];
      assert.equal(new Set(texts).size, texts.length, `${kind}: duplicate option in “${item.prompt}”`);
      assert.ok(item.wrong.length >= 3 && item.why.length > 10);
    }
    for (const [k, levels] of Object.entries(deck.levels)) for (const level of levels) for (let seed = 1; seed <= 12; seed++) {
      const q = methodQuestion(deck, k, seed, level);
      assert.equal(q.options.length, 4); assert.equal(q.options.filter(o => o.correct).length, 1);
      if (level >= 3) { assert.ok(q.hints.length >= 1); assert.ok(q.solution.length >= 3); }
    }
  }
});

test('ramps: the right answer has the gentlest slope', () => {
  for (const item of productDeck.items.context.filter(i => i.prompt.includes('ramp'))) {
    const slope = t => { const [h, l] = t.match(/[\d.]+/g).map(Number); return h / l; };
    const all = [item.right, ...item.wrong.map(w => w.text)];
    assert.equal(Math.min(...all.map(slope)), slope(item.right));
    assert.equal(all.filter(t => slope(t) === slope(item.right)).length, 1);
  }
});

test('process order: the right answer reads the phases in order', () => {
  const PHASES = ['Research the need', 'Analyse the findings', 'Generate ideas', 'Prototype and test', 'Develop the product', 'Take it to market'];
  for (const item of productDeck.items.process) {
    const truth = PHASES.map(p => item.table.rows.find(r => r[1] === p)[0]).join(', ');
    assert.equal(item.right, truth);
    for (const w of item.wrong) assert.notEqual(w.text, truth);
  }
});

test('pendulum frames: equal time steps follow a cosine', () => {
  for (const item of storyDeck.items.movement) {
    const A = Number(item.prompt.match(/from (\d+)°/)[1]), want = Array.from({ length: 5 }, (_, k) => Math.round(A * Math.cos((Math.PI * k) / 4)));
    assert.equal(item.right, want.map(x => `${x}°`).join(', '));
  }
});

test('drawn figures belong to real options', () => {
  for (const deck of DECKS) for (const [kind, items] of Object.entries(deck.items)) for (const item of items) {
    if (!item.optionFigures) continue;
    const texts = [item.right, ...item.wrong.map(w => (typeof w === 'string' ? w : w.text))];
    for (const t of texts) assert.ok(item.optionFigures[t], `${deck.prefix}-${kind}: “${t}” has no figure`);
    assert.equal(Object.keys(item.optionFigures).length, texts.length);
  }
});
