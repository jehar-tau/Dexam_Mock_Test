export function validAttemptAnswer(question, answer) {
  if (answer === null) return true;
  if (question.kind === "nat") return typeof answer === "string" && answer.length <= 64 && /^\s*-?\d+(\.\d+)?\s*$/.test(answer);
  if (question.kind === "drawing") return typeof answer === "string" && answer.length <= 4000;
  const hasOption = (id) => typeof id === "string" && Array.isArray(question.options)
    && question.options.some((option) => option.id === id);
  if (question.kind === "mcq") return hasOption(answer);
  return question.kind === "msq" && Array.isArray(answer) && answer.length <= 10 && answer.every(hasOption);
}

export function createAnswerSyncQueue({
  send, journal, onSaved = () => {}, onStatus = () => {}, revisionSeed = () => Date.now(),
}) {
  const pending = new Map();
  const revisions = new Map();
  let running = null;
  const status = (kind, error = null) => onStatus({
    kind, pending: pending.size, error, deviceSaved: [...pending.values()].every((entry) => entry.deviceSaved),
  });
  const flush = () => {
    if (running) return running;
    running = (async () => {
      while (pending.size) {
        const [questionId, entry] = pending.entries().next().value;
        status("saving");
        try {
          const result = await send({ questionId, answer: entry.answer, revision: entry.revision });
          if (!result || typeof result.accepted !== "boolean" || !Number.isSafeInteger(result.revision) ||
              result.revision < entry.revision || !Object.hasOwn(result, "answer") ||
              result.accepted && (result.revision !== entry.revision || JSON.stringify(result.answer) !== JSON.stringify(entry.answer))) {
            throw new Error("Couldn’t confirm the current saved answer.");
          }
          const revision = result.revision;
          const answer = result.answer;
          revisions.set(questionId, Math.max(revisions.get(questionId) ?? 0, revision));
          if (pending.get(questionId)?.revision <= revision) pending.delete(questionId);
          journal?.acknowledge(questionId, revision);
          onSaved({ questionId, answer, revision, accepted: result.accepted });
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
    restore(questions) {
      for (const question of questions) {
        const hasConfirmedAnswer = Number.isSafeInteger(question.answerRevision)
          && question.answerRevision > 0 && validAttemptAnswer(question, question.answer);
        const serverRevision = hasConfirmedAnswer ? question.answerRevision : 0;
        revisions.set(question.id, serverRevision);
        const record = journal?.read(question.id);
        if (!record) continue;
        if (record.revision <= serverRevision || !validAttemptAnswer(question, record.answer)) {
          journal.acknowledge(question.id, Math.max(serverRevision, record.revision));
          continue;
        }
        pending.set(question.id, { ...record, deviceSaved: true });
        revisions.set(question.id, record.revision);
      }
      status(pending.size ? "waiting" : "saved");
    },
    enqueue(questionId, answer, { defer = false } = {}) {
      const storedRevision = journal?.read(questionId)?.revision ?? 0;
      const revision = Math.max((revisions.get(questionId) ?? 0) + 1, storedRevision + 1, revisionSeed());
      revisions.set(questionId, revision);
      const deviceSaved = journal?.write(questionId, { answer, revision }) ?? false;
      pending.set(questionId, { answer, revision, deviceSaved });
      status("queued");
      if (!defer) return flush();
    },
    flush,
    discard() { pending.clear(); journal?.clear(); status("saved"); },
    hasPending(questionId) { return pending.has(questionId); },
    pendingAnswer(questionId) { return pending.get(questionId)?.answer; },
    pendingCount() { return pending.size; },
  };
}
