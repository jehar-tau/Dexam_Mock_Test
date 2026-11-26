import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../scripts/diagram-only-figures.mjs';

const region = { page: 1, box: [72, 100, 520, 400] };
const figure = (box, extra = {}) => ({ id: 'q1-fig-1', page: 1, box, role: 'figure', canonical: { source: 'embedded', file: 'q1/fig-1.png' }, ...extra });
const mcqText = { type: 'MCQ', options: ['A', 'B'].map(key => ({ key, text: 'Fictional option ' + key })) };
const mcqImage = { type: 'MCQ', options: ['A', 'B'].map(key => ({ key, text: '' })) };

test('a figure that fills the question below its text switches to the clean crop', () => {
  assert.equal(decide({ regions: [region], figures: [{}], optionsInFigure: true }, { figures: [figure([72, 160, 520, 400])] }, mcqImage).decision, 'crop');
});

test('text options printed below the figure are safe because the page shows them as text', () => {
  assert.equal(decide({ regions: [region], figures: [{}] }, { figures: [figure([72, 160, 520, 300])] }, mcqText).decision, 'crop');
});

test('anything outside the crops that the page cannot show keeps the current image', () => {
  assert.deepEqual(decide({ regions: [region], figures: [{}] }, { figures: [figure([72, 160, 520, 300])] }, mcqImage).reasons, ['content-below-figure']);
  const two = [figure([72, 160, 520, 220]), { ...figure([72, 260, 520, 400]), id: 'q1-fig-2' }];
  assert.ok(decide({ regions: [region], figures: [{}, {}], optionsInFigure: true }, { figures: two }, mcqImage).reasons.includes('gap-between-figures'));
  assert.deepEqual(decide({ regions: [region], figures: [{}], vectorDrawings: 2 }, { figures: [figure([72, 160, 520, 400])] }, mcqImage).reasons, ['vector-drawings']);
  assert.deepEqual(decide({ regions: [region, region], figures: [{}] }, { figures: [figure([72, 160, 520, 400])] }, mcqImage).reasons, ['several-regions']);
  assert.deepEqual(decide({ regions: [region], figures: [{}], ocr: true }, { figures: [figure([72, 160, 520, 400])] }, mcqImage).reasons, ['scanned-page']);
});

test('a question with no figure and text options drops the image; image options keep it', () => {
  assert.equal(decide({ regions: [region], figures: [] }, { figures: [] }, mcqText).decision, 'text');
  assert.equal(decide({ regions: [region], figures: [] }, { figures: [] }, { type: 'NAT' }).decision, 'text');
  assert.equal(decide({ regions: [region], figures: [] }, { figures: [] }, mcqImage).decision, 'keep');
});
