import assert from "node:assert/strict";
import test from "node:test";
import { createAnswerSyncQueue, validAttemptAnswer } from "../src/attempt-sync.js";
import { clearDeviceAnswers, createAttemptAnswerJournal, pruneDeviceAnswers } from "../src/attempt-answer-journal.js";

test("failed answer remains queued and reconnect flushes the same revision", async () => {
  let online = false;
  const sent = [], states = [];
  const queue = createAnswerSyncQueue({ revisionSeed: () => 100, onStatus: state => states.push(state), send: async value => {
    sent.push(value);
    if (!online) throw new Error("offline");
    return {accepted:true,answer:value.answer,revision:value.revision};
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
    return {accepted:true,answer:value.answer,revision:value.revision};
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
  const queue = createAnswerSyncQueue({ revisionSeed: () => 300, send: async value => {sent.push(value);return {accepted:true,answer:value.answer,revision:value.revision};}, onStatus: value => states.push(value) });
  await Promise.all([queue.enqueue("q1", "private-A"), queue.enqueue("q2", "private-B")]);
  assert.deepEqual(sent.map(x => x.questionId), ["q1", "q2"]);
  assert.doesNotMatch(JSON.stringify(states), /private-A|private-B/);
});

test("confirmed submission can discard the remaining unsent intent", async () => {
  const queue = createAnswerSyncQueue({ send: async () => { throw new Error("offline"); } });
  await queue.enqueue("q1", "A");
  assert.equal(queue.pendingCount(), 1);
  queue.discard();
  assert.equal(queue.pendingCount(), 0);
});

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

const question = (answerRevision = 0) => ({ id: "q1", kind: "mcq", options: [{ id: "A" }, { id: "B" }], answer: answerRevision ? "A" : null, answerRevision });

test("device persistence precedes network writes and replays the same revision after reload", async () => {
  const storage = memoryStorage();
  const settings = { userId: "student", attemptId: "attempt", deadline: 900, storage };
  const before = createAttemptAnswerJournal(settings);
  const first = createAnswerSyncQueue({
    journal: before,
    revisionSeed: () => 100,
    send: async () => {
      assert.deepEqual(before.read("q1"), { revision: 100, answer: "B", deadline: 900 });
      throw new Error("offline");
    },
  });
  assert.equal((await first.enqueue("q1", "B")).saved, false);
  const after = createAttemptAnswerJournal(settings);
  const writes = [];
  const restored = createAnswerSyncQueue({ journal: after, send: async (value) => {writes.push(value);return {accepted:true,answer:value.answer,revision:value.revision};} });
  restored.restore([question()]);
  assert.equal(restored.pendingAnswer("q1"), "B");
  assert.equal((await restored.flush()).saved, true);
  assert.deepEqual(writes, [{ questionId: "q1", revision: 100, answer: "B" }]);
  assert.equal(after.read("q1"), null);
});

test("reload ignores answers superseded on the server and stale acknowledgements use the server answer", async () => {
  const journal = createAttemptAnswerJournal({ userId: "student", attemptId: "attempt", deadline: 900, storage: memoryStorage() });
  journal.write("q1", { answer: "B", revision: 10 });
  const updates = [];
  const queue = createAnswerSyncQueue({
    journal, revisionSeed: () => 1,
    send: async (entry) => {
      assert.equal(entry.revision, 12);
      return { accepted: false, revision: 13, answer: "A" };
    },
    onSaved: (value) => updates.push(value),
  });
  queue.restore([question(11)]);
  assert.equal(queue.pendingCount(), 0);
  assert.equal(journal.read("q1"), null);
  await queue.enqueue("q1", "B");
  assert.deepEqual(updates, [{ questionId: "q1", answer: "A", revision: 13, accepted: false }]);
  assert.equal(journal.read("q1"), null);
});

test("an invalid readback cannot acknowledge a device answer after reload", async () => {
  const journal = createAttemptAnswerJournal({ userId: "student", attemptId: "attempt", deadline: 900, storage: memoryStorage() });
  journal.write("q1", { answer: "B", revision: 10 });
  const queue = createAnswerSyncQueue({
    journal,
    send: async (entry) => {
      assert.deepEqual(entry, { questionId: "q1", answer: "B", revision: 10 });
      return { accepted: false, answer: "A", revision: 11 };
    },
  });
  queue.restore([{ ...question(11), answer: "unknown" }]);
  assert.equal(queue.pendingAnswer("q1"), "B");
  assert.equal(journal.read("q1").revision, 10);
  assert.equal((await queue.flush()).saved, true);
  assert.equal(journal.read("q1"), null);
});

test("reload preserves a pending answer until the server confirms a valid revision", () => {
  const journal = createAttemptAnswerJournal({ userId: "student", attemptId: "attempt", deadline: 900, storage: memoryStorage() });
  journal.write("q1", { answer: "B", revision: 10 });
  for (const answerRevision of ["11", 11.5, Number.MAX_SAFE_INTEGER + 1]) {
    const queue = createAnswerSyncQueue({ journal });
    queue.restore([{ ...question(), answer: "A", answerRevision }]);
    assert.equal(queue.pendingAnswer("q1"), "B");
    assert.equal(journal.read("q1").revision, 10);
  }

  const queue = createAnswerSyncQueue({ journal });
  queue.restore([{ ...question(11), answer: null }]);
  assert.equal(queue.pendingCount(), 0);
  assert.equal(journal.read("q1"), null);
});

test("pending device answers are scoped and pruned after their server deadline or sign-out", () => {
  const storage = memoryStorage();
  const journal = (userId, attemptId, deadline) => createAttemptAnswerJournal({ userId, attemptId, deadline, storage });
  const first = journal("student-1", "attempt", 900);
  const next = journal("student-1", "another-attempt", 1800);
  const other = journal("student-2", "attempt", 900);
  first.write("q1", { answer: "A", revision: 100 });
  assert.equal(other.read("q1"), null);
  assert.equal(journal("student-1", "attempt", 1800).read("q1"), null);
  next.write("q1", { answer: "B", revision: 110 });
  other.write("q1", { answer: "A", revision: 100 });
  pruneDeviceAnswers("student-1", 900, storage);
  assert.equal(first.read("q1"), null);
  assert.equal(next.read("q1").answer, "B");
  clearDeviceAnswers("student-1", storage);
  assert.equal(next.read("q1"), null);
  assert.equal(other.read("q1").answer, "A");
});

test("complete numerical answers and notes can be journaled before a debounced save", async () => {
  const numeric = { kind: "nat" };
  assert.equal(validAttemptAnswer(numeric, "-12.5"), true);
  assert.equal(validAttemptAnswer(numeric, "-"), false);
  assert.equal(validAttemptAnswer(numeric, "2."), false);
  assert.equal(validAttemptAnswer(numeric, null), true);
  assert.equal(validAttemptAnswer({ kind: "drawing" }, "x".repeat(4001)), false);
  const journal = createAttemptAnswerJournal({ userId: "student", attemptId: "attempt", deadline: 900, storage: memoryStorage() });
  const writes = [];
  const queue = createAnswerSyncQueue({ journal, revisionSeed: () => 1, send: async (value) => {writes.push(value);return {accepted:true,answer:value.answer,revision:value.revision};} });
  queue.enqueue("q1", "1", { defer: true });
  queue.enqueue("q1", "12.5", { defer: true });
  assert.equal(writes.length, 0);
  assert.equal(journal.read("q1").answer, "12.5");
  await queue.flush();
  assert.deepEqual(writes, [{ questionId: "q1", revision: 2, answer: "12.5" }]);
});
