export function drawingUploadWindow(attempt, serverTime) {
  if (attempt.status !== "submitted" || !attempt.uploadDeadline) return null;
  const remainingSeconds = Math.ceil((Date.parse(attempt.uploadDeadline) - serverTime) / 1000);
  if (!(remainingSeconds > 0)) return null;
  const tasks = attempt.resultsPending
    ? attempt.drawingUploadTasks ?? []
    : attempt.questions.filter((item) => item.kind === "drawing");
  return tasks.length ? { remainingSeconds, tasks } : null;
}
