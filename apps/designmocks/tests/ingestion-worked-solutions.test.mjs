import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { convertSolution, parseOverlay } from '../scripts/ingestion-worked-solutions.mjs';

function png(width, height) {
  const chunk = (type, data) => { const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); data.copy(out, 8); return out; };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((width * 3 + 1) * height))), chunk('IEND', Buffer.alloc(0))]);
}
const draft = { keyIdea: 'Fictional key idea.', steps: [
  { text: 'Mark the first group.', overlay: 'first' }, { text: 'Count the rest.' }, { text: 'Mark the answer.', overlay: 'answer' }],
  overlay: { figure: 'q1-fig-1', viewBox: '0 0 80 40', steps: {
    first: '<g id="a"><rect x="4" y="4" width="10" height="10" rx="2" fill="none" stroke="#2f9d5a" stroke-width="2"/><text x="20" y="12" font-size="8">odd &amp; even</text></g>',
    answer: '<circle cx="60" cy="20" r="6" fill="none" stroke="#c24728"/><line x1="0" y1="1" x2="9" y2="9" stroke="#c24728"/>' } } };

test('overlay markup becomes allowed shapes without ids', () => {
  assert.deepEqual(parseOverlay(draft.overlay.steps.first), [{ tag: 'g', attrs: {}, children: [
    { tag: 'rect', attrs: { x: '4', y: '4', width: '10', height: '10', rx: '2', fill: 'none', stroke: '#2f9d5a', 'stroke-width': '2' } },
    { tag: 'text', attrs: { x: '20', y: '12', 'font-size': '8' }, text: 'odd & even' }] }]);
  assert.throws(() => parseOverlay('<g><rect x="1"></g>'));
  assert.deepEqual(parseOverlay('<line x1="1" y2="2"/>'), [{ tag: 'line', attrs: { x1: '1', y2: '2' } }]);
  assert.throws(() => parseOverlay("<rect x='1'/>"), /Unreadable overlay tag/);
});

test('a solution keeps its step text and is tied to the exact figure it was drawn on', () => {
  const { solution } = convertSolution(draft, png(80, 40));
  assert.equal(solution.figure.width, 80); assert.equal(solution.figure.sha256.length, 64);
  assert.deepEqual(solution.steps.map(step => [step.text, step.shapes.length]), [['Mark the first group.', 1], ['Count the rest.', 0], ['Mark the answer.', 2]]);
});

test('a figure larger than the drawing box scales the drawing to fit', () => {
  const { solution } = convertSolution(draft, png(160, 80));
  assert.equal(solution.steps[0].shapes[0].attrs.transform, 'scale(2 2) translate(0 0)');
});

test('solutions without an overlay or with too many steps are reported, not converted', () => {
  assert.equal(convertSolution({ ...draft, overlay: undefined }, png(80, 40)).problem, 'no-overlay');
  const long = { ...draft, steps: Array.from({ length: 9 }, () => ({ text: 'Step.', overlay: 'answer' })) };
  assert.equal(convertSolution(long, png(80, 40)).problem, 'too-many-steps');
});
