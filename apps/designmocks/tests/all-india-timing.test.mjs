import test from 'node:test';
import assert from 'node:assert/strict';
import { eventTiming, nextEventBoundary } from '../src/all-india-timing.js';

const at = time => `2026-11-21T10:00:${String(time).padStart(2, '0')}Z`;
const event = (state, boundary) => ({ state, [boundary]: at(10) });

test('each event phase asks for a fresh server status at its boundary', () => {
  for (const [state, field] of [
    ['scheduled', 'startsAt'], ['open', 'lastStartAt'],
    ['closing', 'endsAt'], ['review', 'reviewEndsAt'],
  ]) {
    const row = event(state, field);
    assert.deepEqual(eventTiming(row, Date.parse(at(9))), {
      needsRefresh: false, nextBoundary: Date.parse(at(10)),
    });
    assert.deepEqual(eventTiming(row, Date.parse(at(10))), {
      needsRefresh: true, nextBoundary: null,
    });
  }
  assert.deepEqual(eventTiming({ state: 'paused' }, Date.parse(at(10))), {
    needsRefresh: false, nextBoundary: null,
  });
});

test('the nearest future boundary drives one page timer', () => {
  const rows = [event('review', 'reviewEndsAt'),
    { state: 'open', lastStartAt: at(5) },
    { state: 'scheduled', startsAt: at(8) }];
  assert.equal(nextEventBoundary(rows, Date.parse(at(0))), Date.parse(at(5)));
  assert.equal(nextEventBoundary(rows, Date.parse(at(6))), Date.parse(at(8)));
  assert.equal(nextEventBoundary(rows, Date.parse(at(10))), null);
});
