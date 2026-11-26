// Student-facing view of an AI drawing estimate (DRAWING_SECTION_SPEC.md §5).
// The server owns scoring; this only shapes what the student sees, and it
// re-applies the published rules so a malformed payload can never show a
// mark outside a criterion's range or a total the criteria don't add up to.

export const DRAWING_FLAG_LABELS = Object.freeze({
  blank: "The photo looks like a blank page",
  not_a_drawing: "The photo doesn’t show a drawing",
  off_task: "The drawing doesn’t answer this task",
  illegible: "Parts of the drawing are hard to make out",
  uses_colour_when_forbidden: "Colour was used where the task asked for pencil only",
  text_explanation_when_forbidden: "Written explanation was used where the task asked for none",
});

const zeroing = new Set(["blank", "not_a_drawing", "off_task"]);
const half = value => Math.round(value * 2) / 2;
const finite = value => typeof value === "number" && Number.isFinite(value);

// criteria: the task's own criteria [{id, label, max}]. Labels and maxima come
// from the task, never from the model output.
export function drawingEstimateView(estimate, criteria = []) {
  const max = criteria.reduce((sum, item) => sum + (finite(item.max) ? item.max : 0), 0);
  if (!estimate) return null;
  const status = estimate.status;
  if (status === "not_attempted") {
    return { status: "not_attempted", total: 0, max, criteria: [], flags: [], summary: "" };
  }
  if (status === "evaluating" || status === "unavailable") {
    return { status, total: null, max, criteria: [], flags: [], summary: "", canReevaluate: estimate.canReevaluate === true };
  }
  if (status !== "ready") return { status: "unavailable", total: null, max, criteria: [], flags: [], summary: "", canReevaluate: false };
  const byId = new Map((estimate.criteria ?? []).map(row => [row?.id, row]));
  const rows = criteria.map(({ id, label, max: criterionMax }) => {
    const row = byId.get(id);
    const raw = finite(row?.score) ? row.score : 0;
    return { id, label, max: criterionMax, score: Math.min(criterionMax, Math.max(0, half(raw))), reason: typeof row?.reason === "string" ? row.reason : "" };
  });
  const flags = [...new Set((estimate.flags ?? []).filter(flag => Object.hasOwn(DRAWING_FLAG_LABELS, flag)))];
  const zeroed = flags.some(flag => zeroing.has(flag));
  const total = zeroed ? 0 : rows.reduce((sum, row) => sum + row.score, 0);
  return {
    status: "ready", total, max, criteria: rows, flags, zeroed,
    summary: typeof estimate.summary === "string" ? estimate.summary : "",
    canReevaluate: estimate.canReevaluate === true,
    override: finite(estimate.override?.score) ? { score: Math.min(max, Math.max(0, half(estimate.override.score))), note: estimate.override.note ?? "" } : null,
  };
}

export function formatMarks(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function graceClock(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
