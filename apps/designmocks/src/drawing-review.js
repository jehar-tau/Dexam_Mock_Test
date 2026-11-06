export const MAX_DRAWING_CRITERIA = 12;

export function totalDrawingMarks(rows) {
  return rows.reduce((total, row) => total + Math.round(Number(row.mark) * 100), 0) / 100;
}

export function validateDrawingReviewInput({ rows, comments, overrideReason, maxScore, requiresOverride = false }) {
  if (rows.length < 1 || rows.length > MAX_DRAWING_CRITERIA) throw new Error("Use between 1 and 12 scoring criteria.");
  const entries = rows.map(({ name, mark }) => [name.trim(), String(mark).trim()]);
  if (entries.some(([name]) => name.length < 2 || name.length > 80)) {
    throw new Error("Enter a name between 2 and 80 characters for each criterion.");
  }
  if (new Set(entries.map(([name]) => name.toLowerCase())).size !== entries.length) {
    throw new Error("Use a different name for each criterion.");
  }
  if (entries.some(([, mark]) => !/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(mark) || !Number.isFinite(Number(mark)))) {
    throw new Error("Enter a non-negative mark with up to two decimal places for each criterion.");
  }
  const score = totalDrawingMarks(rows);
  if (!Number.isFinite(score) || !Number.isFinite(Number(maxScore)) || score > Number(maxScore)) {
    throw new Error(`The criterion total cannot exceed ${maxScore} marks.`);
  }
  const feedback = String(comments ?? "").trim();
  const reason = String(overrideReason ?? "").trim();
  if (feedback.length < 5 || feedback.length > 4000) throw new Error("Feedback must be between 5 and 4,000 characters.");
  if (requiresOverride && (reason.length < 5 || reason.length > 1000)) {
    throw new Error("Give an override reason between 5 and 1,000 characters.");
  }
  return {
    criteria: Object.fromEntries(entries.map(([name, mark]) => [name, Number(mark)])),
    comments: feedback,
    score,
    overrideReason: requiresOverride ? reason : null,
  };
}
