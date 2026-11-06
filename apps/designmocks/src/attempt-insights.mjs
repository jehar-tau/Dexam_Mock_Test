const correctOutcomes = new Set(["correct", "full_marks"]);

function summarize(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key) ?? { key, total: 0, answered: 0, correct: 0 };
    group.total += 1;
    if (item.answer !== null && item.answer !== undefined && item.answer !== "" && (!Array.isArray(item.answer) || item.answer.length)) group.answered += 1;
    if (correctOutcomes.has(item.outcome)) group.correct += 1;
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, accuracy: group.answered ? Math.round(group.correct * 100 / group.answered) : null }));
}

export function buildAttemptInsights(questions = []) {
  const objective = questions.filter((item) => item.kind !== "drawing" && item.outcome !== "dropped");
  const topics = summarize(objective, (item) => item.topic || "unclassified").sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  const sections = summarize(objective, (item) => String(item.kind || "other").toUpperCase()).sort((a, b) => a.key.localeCompare(b.key));
  const recommended = topics.filter((item) => item.answered > 0).sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered || a.key.localeCompare(b.key))[0] ?? null;
  return { topics, sections, recommended };
}
