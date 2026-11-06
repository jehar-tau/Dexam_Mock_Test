import assert from "node:assert/strict";
import test from "node:test";
import { createAnswerSyncQueue } from "../src/attempt-sync.js";

test("failed answer remains queued and reconnect flushes the same revision", async () => {
  let online = false;
  const sent = [], states = [];
  const queue = createAnswerSyncQueue({ revisionSeed: () => 100, onStatus: state => states.push(state), send: async value => {
    sent.push(value);
    if (!online) throw new Error("offline");
  } });
  const failed = await queue.enqueue("q1", "A");
  assert.equal(failed.saved, false);
  assert.equal(queue.pendingAnswer("q1"), "A");
  online = true;
  const retried = await queue.flush();
  assert.equal(retried.saved, true);
  assert.equal(queue.pendingCount(), 0);
  assert.deepEqual(sent.map(x => x.revision), [100, 100]);
  assert.equal(states.at(-1).kind, "saved");
});

test("newer answer supersedes an older queued answer without losing order", async () => {
  let release;
  const sent = [], saved = [];
  const first = new Promise(resolve => { release = resolve; });
  const queue = createAnswerSyncQueue({ revisionSeed: () => 200, onSaved: value => saved.push(value), send: async value => {
    sent.push(value);
    if (sent.length === 1) await first;
  } });
  const initial = queue.enqueue("q1", "A");
  const newer = queue.enqueue("q1", "B");
  release();
  await Promise.all([initial, newer]);
  assert.deepEqual(sent.map(x => [x.answer, x.revision]), [["A", 200], ["B", 201]]);
  assert.equal(saved.at(-1).answer, "B");
  assert.equal(queue.pendingCount(), 0);
});

test("questions flush sequentially and never expose answer data in status", async () => {
  const sent = [], states = [];
  const queue = createAnswerSyncQueue({ revisionSeed: () => 300, send: async value => sent.push(value), onStatus: value => states.push(value) });
  await Promise.all([queue.enqueue("q1", "private-A"), queue.enqueue("q2", "private-B")]);
  assert.deepEqual(sent.map(x => x.questionId), ["q1", "q2"]);
  assert.doesNotMatch(JSON.stringify(states), /private-A|private-B/);
});

test("deadline finalization can explicitly discard only unsent in-memory intent", async () => {
  const queue = createAnswerSyncQueue({ send: async () => { throw new Error("offline"); } });
  await queue.enqueue("q1", "A");
  assert.equal(queue.pendingCount(), 1);
  queue.discard();
  assert.equal(queue.pendingCount(), 0);
});
