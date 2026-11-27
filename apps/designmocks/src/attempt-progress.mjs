export function hasAnswer(answer) {
  return Array.isArray(answer) ? answer.length > 0 : answer !== null && answer !== undefined && answer !== "";
}
export function isQuestionAnswered(item, answer, counts) {
  return hasAnswer(answer) || (item.kind === "drawing" && counts[item.id] > 0);
}
export function drawingCountStatus(questions, counts) {
  const drawing = questions.filter(q => q.kind === "drawing");
  if (drawing.some(q => counts[q.id] === null)) return "Saved drawing totals are unavailable.";
  if (drawing.some(q => counts[q.id] === undefined)) return "Checking saved drawing pages…";
  return "";
}
