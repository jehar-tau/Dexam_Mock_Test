export function questionReportConfirmation(result) {
  const count = `${result.reportCount} unique student${result.reportCount === 1 ? "" : "s"}`;
  return result.held
    ? `Report received. ${count} reported this version. New attempts are held for human review; your attempt keeps its original clock.`
    : `Report received. ${count} reported this version; the review threshold is ${result.threshold}.`;
}

export function questionReviewInput(report, action, note) {
  const reason = note.trim();
  if (reason.length < 8 || reason.length > 1000) throw new Error("Enter a review reason of 8 to 1000 characters.");
  if (!["retire", "dismiss", "restore", "reopen", "fix"].includes(action)) throw new Error("Choose a review decision.");
  return { p_target_key: report.targetKey, p_action: action, p_note: reason,
    p_expected_revision: report.revision, p_expected_bank_version: report.bankVersion ?? null };
}
