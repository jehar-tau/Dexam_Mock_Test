const numericLabel = value => {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

export function numericAnswerLabel(value) {
  const exact = numericLabel(value?.exact);
  if (exact !== null) return exact;
  if (!Array.isArray(value?.range) || value.range.length !== 2) return null;
  const [first, last] = value.range.map(numericLabel);
  return first !== null && last !== null ? `${first} to ${last}` : null;
}

const choiceList = values => Array.isArray(values) && values.length > 0 &&
  values.every(value => typeof value === "string" && value.trim());

export function answerAlternativesLabel(key) {
  if (key?.kind === "mcq" && choiceList(key.correct) && key.correct.length > 1) {
    return key.correct.join(" or ");
  }
  if (key?.kind === "msq" && !Object.hasOwn(key, "correct") &&
      Array.isArray(key.alternatives) && key.alternatives.length > 1 && key.alternatives.every(choiceList)) {
    return key.alternatives.map(set => set.join(", ")).join(" or ");
  }
  if (key?.kind === "nat" && Array.isArray(key.accepted) && key.accepted.length > 1) {
    const labels = key.accepted.map(numericAnswerLabel);
    if (labels.every(Boolean)) return labels.join(" or ");
  }
  return null;
}

export function releasedKeyLabel(key) {
  const alternatives = answerAlternativesLabel(key);
  if (alternatives) return alternatives;
  if (["mcq", "msq"].includes(key?.kind) && choiceList(key.correct)) return key.correct.join(", ");
  if (key?.kind === "msq" && Array.isArray(key.alternatives) && key.alternatives.length === 1 && choiceList(key.alternatives[0])) return key.alternatives[0].join(", ");
  if (key?.kind === "nat" && key.accepted?.length === 1) return numericAnswerLabel(key.accepted[0]);
  return null;
}
