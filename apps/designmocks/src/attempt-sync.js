export function createAnswerSyncQueue({ send, onSaved = () => {}, onStatus = () => {}, revisionSeed = () => Date.now() }) {
  const pending = new Map(), revisions = new Map();
  let running = null;
  const status = (kind, error = null) => onStatus({ kind, pending: pending.size, error });
  const flush = () => {
    if (running) return running;
    running = (async () => {
      while (pending.size) {
        const [questionId, entry] = pending.entries().next().value;
        status("saving");
        try {
          await send({ questionId, answer: entry.answer, revision: entry.revision });
          if (pending.get(questionId)?.revision === entry.revision) pending.delete(questionId);
          onSaved({ questionId, answer: entry.answer, revision: entry.revision });
        } catch (error) {
          status("waiting", error);
          return { saved: false, pending: pending.size, error };
        }
      }
      status("saved");
      return { saved: true, pending: 0, error: null };
    })().finally(() => { running = null; });
    return running;
  };
  return {
    enqueue(questionId, answer) {
      const revision = Math.max((revisions.get(questionId) ?? 0) + 1, revisionSeed());
      revisions.set(questionId, revision);
      pending.set(questionId, { answer, revision });
      status("queued");
      return flush();
    },
    flush,
    discard() { pending.clear(); status("saved"); },
    hasPending(questionId) { return pending.has(questionId); },
    pendingAnswer(questionId) { return pending.get(questionId)?.answer; },
    pendingCount() { return pending.size; },
  };
}
