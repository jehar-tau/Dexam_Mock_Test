export function niftDrawingDuration(plan) {
  if (plan.exam !== "nift" || plan.timer !== "separate") return null;
  const [gat, cat] = plan.sections ?? [];
  if (plan.sections?.length !== 2 || gat?.plan !== "objective" || gat.label !== "GAT" ||
      gat.durationSeconds !== 7200 || gat.uploadGraceSeconds !== 0 || !cat ||
      cat.startsAfter !== "GAT" || cat.durationSeconds !== 10800 || plan.uploadGraceSeconds !== 600 ||
      (cat.uploadGraceSeconds !== undefined && cat.uploadGraceSeconds !== 600) ||
      plan.tasks.length !== 3 || plan.drawingMarksTotal !== 100 ||
      cat.questionKeys?.length !== 3 || !plan.tasks.every((task, i) => cat.questionKeys[i] === task.externalKey)) {
    throw new Error("Historical NIFT requires 120-minute GAT followed by 180-minute CAT, three drawing tasks and a 10-minute CAT upload window");
  }
  return gat.durationSeconds + cat.durationSeconds;
}
