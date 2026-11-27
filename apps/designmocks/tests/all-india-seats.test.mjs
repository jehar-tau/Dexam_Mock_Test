import assert from 'node:assert/strict';
import test from 'node:test';
import {catalogueInput, catalogueStartFailure, registrationInput, validateCatalogue, validatePublicAllIndiaUpcoming} from '../src/catalogue-data.js';

const base = {
  id: '10000000-0000-4000-8000-000000000196', exam: 'nid', title: 'Fictional NID All India Mock', state: 'scheduled',
  startsAt: '2026-12-11T00:00:00+05:30', endsAt: '2026-12-14T00:00:00+05:30', lastStartAt: '2026-12-13T20:50:00+05:30',
  reviewEndsAt: '2026-12-17T10:00:00+05:30', durationSeconds: 10800, uploadGraceSeconds: 600, qualityHeld: false,
  attemptId: null, result: null,
};

test('older events without seats still validate as uncapped pass events', () => {
  const [event] = validateCatalogue('allIndia', [base]);
  assert.deepEqual([event.entry, event.seatCap, event.seatsLeft, event.registered], ['pass', null, null, false]);
});

test('capped free events carry seats left and the student\'s reservation', () => {
  const [event] = validateCatalogue('allIndia', [{...base, entry: 'free', seatCap: 150, seatsLeft: 37, registered: true}]);
  assert.deepEqual([event.entry, event.seatCap, event.seatsLeft, event.registered], ['free', 150, 37, true]);
  for (const bad of [{seatCap: 150, seatsLeft: 151}, {seatCap: 150, seatsLeft: null}, {seatCap: 0, seatsLeft: 0},
    {seatCap: null, seatsLeft: 3}, {entry: 'paid'}, {registered: 'yes'}])
    assert.throws(() => validateCatalogue('allIndia', [{...base, entry: 'free', seatCap: 150, seatsLeft: 1, ...bad}]), /could not be verified/);
});

test('a seat can be reserved only before the window, once, while seats remain', () => {
  const scheduled = {...base, entry: 'free', seatCap: 150, seatsLeft: 1, registered: false};
  assert.deepEqual(registrationInput([scheduled], base.id), {p_event_id: base.id});
  for (const blocked of [{registered: true}, {seatsLeft: 0}, {state: 'review'}, {attemptId: '20000000-0000-4000-8000-000000000196'}])
    assert.throws(() => registrationInput([{...scheduled, ...blocked}], base.id), error => error.code === 'catalogue_selection');
  assert.throws(() => registrationInput([scheduled], '10000000-0000-4000-8000-000000000999'), error => error.code === 'catalogue_selection');
});

test('a full event blocks a start unless the student already holds a seat', () => {
  const open = {...base, state: 'open', entry: 'free', seatCap: 150, seatsLeft: 0};
  assert.throws(() => catalogueInput('allIndia', [{...open, registered: false}], base.id), error => error.code === 'catalogue_selection');
  assert.deepEqual(catalogueInput('allIndia', [{...open, registered: true}], base.id), {p_event_id: base.id});
});

test('seat rejections from the server are shown as definitive messages', () => {
  for (const message of ['All seats for this All India mock are taken', 'Registration for this All India mock has closed'])
    assert.deepEqual(catalogueStartFailure({code: 'P0001', message}), {definitive: true, message});
});

test('the public schedule exposes seats and timing only', () => {
  const {qualityHeld, attemptId, result, state, ...publicEvent} = base;
  const [event] = validatePublicAllIndiaUpcoming([{...publicEvent, entry: 'free', seatCap: 150, seatsLeft: 150}]);
  assert.equal(event.seatsLeft, 150);
  assert.equal(Object.hasOwn(event, 'attemptId'), false);
  assert.throws(() => validatePublicAllIndiaUpcoming([{...publicEvent, seatCap: 150, seatsLeft: 200}]), /could not be verified/);
  assert.throws(() => validatePublicAllIndiaUpcoming({}), /could not be verified/);
});
