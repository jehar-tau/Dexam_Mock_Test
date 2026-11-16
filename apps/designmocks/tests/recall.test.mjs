// Recall questions checked against the decks by plain lookups: every
// correct option must be what the deck says, and no wrong option may also be
// true. Decks are checked for duplicates and for groups with enough members.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RECALL_LEVELS, hasPictures, recallQuestion } from '../src/learn/recall.js';
import { IMAGES, imageFor } from '../src/learn/decks/images.js';
import { existsSync } from 'node:fs';
import { makingDeck, materialsDeck, textilesDeck } from '../src/learn/decks/crafts.js';
import { artDeck, designDeck, heritageDeck } from '../src/learn/decks/history.js';

const DECKS = [textilesDeck, materialsDeck, makingDeck, artDeck, heritageDeck, designDeck];
const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
const right = q => q.options.find(o => o.id === q.answer);

test('decks are well formed', () => {
  for (const deck of DECKS) {
    const names = deck.facts.map(f => f.name);
    assert.equal(new Set(names).size, names.length, `${deck.prefix}: duplicate names`);
    for (const f of deck.facts) assert.ok(deck.types[f.type], `${deck.prefix}: ${f.name} has an unknown type`);
    for (const seq of deck.sequences) assert.equal(new Set(seq.steps).size, seq.steps.length);
  }
});

test('every recall question agrees with its deck', () => {
  for (const deck of DECKS) for (const [kind, levels] of Object.entries(RECALL_LEVELS)) {
    if (kind === 'two' && !deck.twoFields) continue;
    if (kind === 'identify' && !hasPictures(deck)) continue;
    for (const level of levels) for (const seed of seeds) {
      const q = recallQuestion(deck, kind, seed, level), byName = Object.fromEntries(deck.facts.map(f => [f.name, f]));
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options.map(o => o.text)).size, 4, `${deck.prefix}-${kind} ${seed}`);
      if (level >= 3) { assert.ok(q.hints.length >= 1); assert.ok(q.solution.length >= 3); }
      if (kind === 'name') {
        const field = Object.keys(deck.fields).find(f => q.prompt === deck.fields[f].replace('{name}', q.prompt.match(deck.fields[f].replace('{name}', '(.+)').replace('?', '\\?'))?.[1]));
        const name = q.prompt.match(new RegExp(deck.fields[field].replace('{name}', '(.+)').replace('?', '\\?')))[1];
        for (const o of q.options) assert.equal(o.text === byName[name][field], o.correct, `${q.prompt} ${o.text}`);
      }
      if (kind === 'identify') {
        const shown = q.figures[0].image;
        for (const o of q.options) assert.equal(imageFor(o.text) === shown, o.correct, `${q.prompt} ${o.text}`);
        assert.ok(!q.figures[0].alt.toLowerCase().includes(right(q).text.toLowerCase()), 'the alt text must not name the answer');
      }
      if (kind === 'which') { const label = q.prompt.match(/is an? (.+)\?$/)[1], type = Object.keys(deck.types).find(t => deck.types[t] === label); for (const o of q.options) assert.equal(byName[o.text].type === type, o.correct, `${q.prompt} ${o.text}`); }
      if (kind === 'odd') { const types = q.options.map(o => byName[o.text].type), common = types.find(t => types.filter(x => x === t).length === 3); assert.ok(common); assert.notEqual(byName[right(q).text].type, common); }
      if (kind === 'match') {
        const rows = q.figures[0].rows, items = rows.map(r => r[0].replace(/^\d+\. /, '')), values = rows.map(r => r[1].replace(/^[A-D]\. /, ''));
        const field = Object.keys(deck.fields).find(f => items.every(n => values.includes(byName[n][f])));
        const truth = items.map((n, i) => `${i + 1}–${'ABCD'[values.indexOf(byName[n][field])]}`).join(', ');
        for (const o of q.options) assert.equal(o.text === truth, o.correct, `${q.prompt} ${o.text}`);
      }
      if (kind === 'order') {
        const rows = q.figures[0].rows, seq = deck.sequences.find(s => q.prompt.startsWith(s.title)), truth = seq.steps.map(st => rows.find(r => r[1] === st)[0]).join(', ');
        for (const o of q.options) assert.equal(o.text === truth, o.correct);
      }
      if (kind === 'two') {
        const [, label, word, value] = q.prompt.match(/^Which is an? (.+?) whose (.+?) is (.+)\?$/), type = Object.keys(deck.types).find(t => deck.types[t] === label), field = Object.keys(deck.fieldWords).find(f => deck.fieldWords[f] === word);
        for (const o of q.options) assert.equal(byName[o.text].type === type && byName[o.text][field] === value, o.correct, `${q.prompt} ${o.text}`);
      }
    }
  }
});

test('every image is on disk, credited and freely licensed', () => {
  for (const [id, im] of Object.entries(IMAGES)) {
    assert.ok(existsSync(new URL(`../public${im.src}`, import.meta.url)), `${id}: missing file`);
    assert.match(im.license, /^(Public domain|CC0|CC BY(-SA)? [0-9.]+( [a-z]{2})?)$/, `${id}: ${im.license}`);
    assert.ok(im.author && im.source.startsWith('https://commons.wikimedia.org/'), id);
  }
});
