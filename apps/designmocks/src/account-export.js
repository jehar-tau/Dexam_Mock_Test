const exportError = () => new Error("Your export could not be verified. Refresh your account and try again.");
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const only = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
const arrayOf = (value, predicate) => Array.isArray(value) && value.every(predicate);
const score = value => value === null || typeof value === "number" && Number.isFinite(value);

export function validateAccountExport(data, accountId) {
  if (!only(data, ["schemaVersion", "exportedAt", "accountId", "profile", "access", "attempts", "results", "learningProgress", "community", "bugReports", "questionReports", "drawingUploads"]) ||
    data.schemaVersion !== 2 || typeof accountId !== "string" || !accountId || data.accountId !== accountId ||
    typeof data.exportedAt !== "string" || !Number.isFinite(Date.parse(data.exportedAt))) throw exportError();
  if (data.profile !== null && (!object(data.profile) || data.profile.user_id !== accountId)) throw exportError();
  if (!arrayOf(data.attempts, attempt => only(attempt, ["id", "paper", "exam", "status", "startedAt", "deadline", "submittedAt", "score", "total", "resultsPending", "responses"]) &&
    typeof attempt.resultsPending === "boolean" && score(attempt.score) && score(attempt.total) &&
    (!(attempt.status !== "submitted" || attempt.resultsPending) || attempt.score === null && attempt.total === null) &&
    arrayOf(attempt.responses, response => only(response, ["questionId", "ordinal", "topic", "kind", "answer"])))) throw exportError();
  if (!arrayOf(data.questionReports, report => only(report, ["id", "attemptId", "questionId", "reason", "details", "createdAt"]) &&
    [report.id, report.attemptId, report.questionId, report.createdAt].every(value => typeof value === "string" && value) &&
    ["incorrect", "incomplete", "media", "duplicate", "other"].includes(report.reason) && (report.details === null || typeof report.details === "string"))) throw exportError();
  const attempts = new Map(data.attempts.map(attempt => [attempt.id, attempt]));
  const published = attempt => attempt?.status === "submitted" && !attempt.resultsPending;
  const released = value => typeof value === "string" && Number.isFinite(Date.parse(value));
  if (!only(data.results, ["examMocks", "allIndia", "drawingReviews"]) ||
    !arrayOf(data.results.examMocks, report => only(report, ["sessionId", "exam", "partAAttemptId", "partBAttemptId", "state", "resultsPending", "objectiveScore", "objectiveTotal", "drawingScore", "drawingTotal", "combinedScore", "combinedTotal"]) &&
      typeof report.resultsPending === "boolean" && attempts.has(report.partAAttemptId) && (report.partBAttemptId === null || attempts.has(report.partBAttemptId)) &&
      (report.resultsPending || published(attempts.get(report.partAAttemptId)) && published(attempts.get(report.partBAttemptId))) &&
      ["objectiveScore", "objectiveTotal", "drawingScore", "drawingTotal", "combinedScore", "combinedTotal"].every(field => score(report[field]) && (!report.resultsPending || report[field] === null))) ||
    !arrayOf(data.results.allIndia, result => only(result, ["eventId", "attemptId", "exam", "title", "releasedAt", "score", "total", "rank", "alias", "cohortSize"]) &&
      released(result.releasedAt) && published(attempts.get(result.attemptId)) && score(result.score) && score(result.total) &&
      result.score === attempts.get(result.attemptId).score && result.total === attempts.get(result.attemptId).total) ||
    !arrayOf(data.results.drawingReviews, result => only(result, ["reviewId", "attemptId", "questionId", "score", "maxScore", "criteria", "comments", "releasedAt"]) &&
      released(result.releasedAt) && published(attempts.get(result.attemptId)) && score(result.score) && result.score !== null &&
      score(result.maxScore) && result.maxScore !== null && result.score >= 0 && result.score <= result.maxScore &&
      attempts.get(result.attemptId).responses.some(response => response.questionId === result.questionId && response.kind === "drawing"))) throw exportError();
  return data;
}

export function downloadAccountExport(data, accountId, documentRef = document, urlApi = URL) {
  validateAccountExport(data, accountId);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = urlApi.createObjectURL(blob);
  try {
    const anchor = documentRef.createElement("a");
    anchor.href = url;
    anchor.download = `dmocks-account-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
  } finally { urlApi.revokeObjectURL(url); }
}
