export const communityReportReasons = Object.freeze([
  ["spam", "Spam or advertising"],
  ["abuse", "Abuse or harassment"],
  ["copyright", "Copyright or permission concern"],
  ["answer_leak", "Active assessment answer"],
  ["personal_details", "Shares personal or contact details"],
  ["safety", "I am worried about someone’s safety"],
  ["other", "Other issue"],
].map(([value, label]) => Object.freeze({ value, label })));
const reasons = new Set(communityReportReasons.map(item => item.value));
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const inputError = code => Object.assign(new Error("The report input is invalid."), { code });

export function communityReportTarget(target) {
  const postId = target?.postId ?? null, commentId = target?.commentId ?? null;
  if ((postId === null) === (commentId === null) || (postId !== null && (typeof postId !== "string" || !uuid.test(postId))) ||
    (commentId !== null && (typeof commentId !== "string" || !uuid.test(commentId)))) throw inputError("community_report_target");
  return Object.freeze({ postId: postId?.toLowerCase() ?? null, commentId: commentId?.toLowerCase() ?? null });
}

export function communityReportInput(target, reason, details = "") {
  const selected = communityReportTarget(target);
  if (!reasons.has(reason) || !(details === null || typeof details === "string")) throw inputError("community_report_invalid");
  const text = details?.trim() || "";
  if ([...text].length > 1000) throw inputError("community_report_invalid");
  return Object.freeze({ p_post_id: selected.postId, p_comment_id: selected.commentId, p_reason: reason, p_details: text || null });
}

export function communityReportAcknowledged(result) {
  return result === null || result === undefined;
}

const failures = Object.freeze({
  community_report_exists: { kind: "exists", message: "You already reported this content from this account. Your earlier reason and details remain unchanged." },
  community_report_limit: { kind: "rejected", message: "You’ve reached the report limit. Try again later." },
  community_report_unavailable: { kind: "rejected", message: "This discussion or reply is unavailable for a new report." },
  community_report_invalid: { kind: "rejected", message: "Choose a valid report reason and keep details within 1000 characters." },
  community_report_sign_in: { kind: "rejected", message: "Sign in again before reporting content." },
  community_report_target: { kind: "rejected", message: "Choose one discussion or reply to report." },
});
export async function communityReportFailure(error) {
  let details = error?.details, code = error?.code;
  try {
    const body = await error?.context?.clone().json();
    details = body?.details ?? details;
    code = body?.code ?? code;
  } catch { /* Provider diagnostics never become student-facing messages. */ }
  if (Object.hasOwn(failures, details)) return failures[details];
  if (Object.hasOwn(failures, code)) return failures[code];
  return { kind: "unconfirmed", message: "Your report hasn’t been confirmed and may already be saved. Retry the same report to check it, or close this dialog." };
}
