export const initialBankFilters = { exam: "", type: "", status: "pending", topic: "", search: "", limit: 25 };

export function bankSearchInput(filters, offset = 0) {
  return {
    p_exam: filters.exam || null, p_type: filters.type || null, p_status: filters.status,
    p_topic: filters.topic.trim() || null, p_search: filters.search.trim() || null,
    p_limit: Number(filters.limit), p_offset: offset,
  };
}

export function sourceAnswerLabel(answer) {
  if (answer == null) return "Awaiting verification";
  const raw = typeof answer === "object" && !Array.isArray(answer) ? answer.raw : answer;
  const text = Array.isArray(raw) ? raw.join(", ") : String(raw ?? "");
  if (!text.trim()) return "Awaiting verification";
  return answer.status === "pending" ? `${text} · pending verification` : text;
}

export function deliveryAnswerLabel(key) {
  if (!key) return "Awaiting conversion";
  if (["mcq", "msq"].includes(key.kind) && Array.isArray(key.correct)) return key.correct.join(", ");
  if (key.kind === "nat" && Array.isArray(key.accepted)) return key.accepted.map(value =>
    value?.exact != null ? String(value.exact) : Array.isArray(value?.range) ? value.range.map(String).join(" to ") : "Awaiting verification"
  ).join(" or ");
  return key.kind === "drawing" ? "Human review against the task rubric" : "Awaiting verification";
}

export function bankReviewImages(images, expected) {
  if (!Array.isArray(images) || images.length !== expected.length ||
    new Set(images.map(image => image?.ordinal)).size !== expected.length ||
    images.some(image => !expected.some(figure => figure.ordinal === image?.ordinal) || typeof image?.url !== "string" || !image.url)) {
    throw new Error("The question figures are incomplete. Refresh the figures before approving.");
  }
  return [...images].sort((left, right) => left.ordinal - right.ordinal);
}
