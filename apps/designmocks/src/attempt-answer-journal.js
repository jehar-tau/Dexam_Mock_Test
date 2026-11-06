const prefixFor = (userId) => `dmocks:pending-answer:v1:${encodeURIComponent(userId)}:`;

function browserStorage() {
  try { return globalThis.localStorage; }
  catch { return null; }
}

function readRecord(storage, key) {
  try {
    const value = JSON.parse(storage?.getItem(key) ?? "null");
    if (!value || !Number.isSafeInteger(value.revision) || value.revision < 1 ||
      !Number.isFinite(value.deadline) || !Object.hasOwn(value, "answer")) return null;
    return value;
  } catch {
    return null;
  }
}

function removeMatching(storage, prefix, predicate = () => true) {
  try {
    for (let index = (storage?.length ?? 0) - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (key?.startsWith(prefix) && predicate(readRecord(storage, key))) storage.removeItem(key);
    }
  } catch {
    // Storage can be blocked or evicted. The server remains authoritative.
  }
}

export function clearDeviceAnswers(userId, storage = browserStorage()) {
  removeMatching(storage, prefixFor(userId));
}

export function pruneDeviceAnswers(userId, serverTime, storage = browserStorage()) {
  removeMatching(storage, prefixFor(userId), (record) => !record || record.deadline <= serverTime);
}

export function createAttemptAnswerJournal({ userId, attemptId, deadline, storage = browserStorage() }) {
  const prefix = `${prefixFor(userId)}${encodeURIComponent(attemptId)}:`;
  const keyFor = (questionId) => `${prefix}${encodeURIComponent(questionId)}`;
  const read = (questionId) => {
    const record = readRecord(storage, keyFor(questionId));
    return record?.deadline === deadline ? record : null;
  };
  return {
    read,
    write(questionId, { revision, answer }) {
      if (!storage || !Number.isFinite(deadline)) return false;
      try {
        if ((read(questionId)?.revision ?? 0) > revision) return false;
        storage.setItem(keyFor(questionId), JSON.stringify({ revision, answer, deadline }));
        return true;
      } catch {
        return false;
      }
    },
    acknowledge(questionId, revision) {
      try {
        const record = read(questionId);
        if (record && record.revision <= revision) storage.removeItem(keyFor(questionId));
      } catch {
        // An unremoved entry will be reconciled against the server revision on reload.
      }
    },
    clear() { removeMatching(storage, prefix); },
  };
}
