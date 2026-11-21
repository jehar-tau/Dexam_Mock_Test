const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const version = /^[0-9a-f]{64}$/;
const reasons = new Set(["spam", "abuse", "copyright", "answer_leak", "personal_details", "safety", "other"]);
const mimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const actions = new Set(["hide", "dismiss", "restore", "lock", "unlock"]);
const isText = (value, maximum) => typeof value === "string" && value.length <= maximum;
const isDate = value => isText(value, 64) && Number.isFinite(Date.parse(value));
function invalid() { throw Object.assign(new Error("The report could not be verified. Reopen it and try again."), { code: "community_review_response" }); }

function asset(value) {
  if (!value || !uuid.test(value.id) || !Number.isInteger(value.ordinal) || value.ordinal < 1 || value.ordinal > 3 ||
    !mimeTypes.has(value.mimeType) || typeof value.available !== "boolean") invalid();
  const legacy = value.width === null && value.height === null && value.orientation === null;
  if (!legacy && (!Number.isInteger(value.width) || !Number.isInteger(value.height) || value.width < 1 || value.height < 1 ||
    value.width > 12000 || value.height > 12000 || value.width * value.height > 24000000 ||
    !Number.isInteger(value.orientation) || value.orientation < 1 || value.orientation > 8)) invalid();
  return { id: value.id, ordinal: value.ordinal, mimeType: value.mimeType, width: value.width, height: value.height,
    orientation: value.orientation, available: value.available };
}
export function validateCommunityReviewContent(value) {
  if (!value || !uuid.test(value.id) || !["post", "comment"].includes(value.kind) ||
    !(value.title === null || isText(value.title, 160)) || !isText(value.body, 20000) ||
    !(value.kind === "post" ? ["visible", "hidden", "locked"] : ["visible", "hidden"]).includes(value.status) ||
    !["uceed", "ceed", "nid", "nift"].includes(value.exam) || !isText(value.topic, 5000) ||
    !Array.isArray(value.assets) || value.assets.length > 3) invalid();
  const assets = value.assets.map(asset).sort((a, b) => a.ordinal - b.ordinal);
  if (new Set(assets.map(item => item.id)).size !== assets.length || new Set(assets.map(item => item.ordinal)).size !== assets.length) invalid();
  return { id: value.id, kind: value.kind, title: value.title, body: value.body, status: value.status,
    exam: value.exam, topic: value.topic, assets };
}

export function validateCommunityReviewHistory(value) {
  if (!Array.isArray(value) || value.length > 25) invalid();
  return value.map(event => {
    if (!event || !(isText(event.id, 128) && event.id || Number.isSafeInteger(event.id) && event.id > 0) ||
      !actions.has(event.action) || !(event.note === null || isText(event.note, 1000)) || !isDate(event.createdAt)) invalid();
    return { id: event.id, action: event.action, note: event.note ?? "", createdAt: event.createdAt };
  });
}

export function validateCommunityReport(value, expectedId) {
  if (!value || value.id !== expectedId || !uuid.test(value.id) || !uuid.test(value.targetId) ||
    !["post", "comment"].includes(value.targetType) || !reasons.has(value.reason) ||
    !(value.details === null || isText(value.details, 1000)) || !isDate(value.createdAt) ||
    !["open", "resolved"].includes(value.status) || !version.test(value.reviewVersion) || typeof value.canDismiss !== "boolean" ||
    !(value.status === "open" ? value.resolution === null : ["hide", "dismiss"].includes(value.resolution)) || !Array.isArray(value.history)) invalid();
  const target = validateCommunityReviewContent(value.target), post = validateCommunityReviewContent(value.post), parent = value.parent === null ? null : validateCommunityReviewContent(value.parent);
  if (target.id !== value.targetId || target.kind !== value.targetType || post.kind !== "post" ||
    target.exam !== post.exam || target.topic !== post.topic ||
    (value.targetType === "post" ? JSON.stringify(target) !== JSON.stringify(post) || parent !== null : target.id === post.id) ||
    (parent && (parent.kind !== "comment" || parent.id === target.id || parent.id === post.id || parent.exam !== post.exam || parent.topic !== post.topic))) invalid();
  const history = validateCommunityReviewHistory(value.history);
  const report = { id: value.id, targetType: value.targetType, targetId: value.targetId, reason: value.reason,
    details: value.details, createdAt: value.createdAt, status: value.status, resolution: value.resolution,
    reviewVersion: value.reviewVersion, canDismiss: value.canDismiss, target, post, parent, history };
  report.canDismiss = report.status === "open" && report.canDismiss && communityReviewGroups(report).every(group => group.content.assets.every(item => item.available));
  return report;
}

export function communityReviewGroups(report) {
  const groups = [{ context: "target", label: report.targetType === "post" ? "Reported discussion" : "Reported reply", content: report.target }];
  if (report.targetType === "comment") {
    if (report.parent) groups.push({ context: "parent", label: "Parent reply", content: report.parent });
    groups.push({ context: "post", label: "Discussion", content: report.post });
  }
  return groups;
}

export function communityReviewInput(report, resolution, note) {
  const reason = typeof note === "string" ? note.trim() : "";
  if (reason.length < 8 || reason.length > 1000) throw Object.assign(new Error("Enter a review reason of 8 to 1000 characters."), { code: "community_review_note" });
  if (!report || !uuid.test(report.id) || !version.test(report.reviewVersion) || report.status !== "open" || !["hide", "dismiss"].includes(resolution)) {
    throw Object.assign(new Error("Reopen the report before choosing a decision."), { code: "community_review_invalid" });
  }
  if (resolution === "dismiss" && !report.canDismiss) throw Object.assign(new Error("Some private images are unavailable. You can hide the content while they are checked."), { code: "community_review_incomplete" });
  return { p_report_id: report.id, p_expected_version: report.reviewVersion, p_resolution: resolution, p_note: reason };
}

const failures = {
  community_review_changed: { kind: "stale", message: "This report or its content changed. Reopen the report and review it again." },
  community_review_unavailable: { kind: "unavailable", message: "This report is unavailable or your review access has ended. Refresh the reports." },
  community_review_incomplete: { kind: "incomplete", message: "Some private images are unavailable. You can hide the content while they are checked." },
  community_review_invalid: { kind: "invalid", message: "Check the review reason and decision, or reopen the report." },
  community_review_required: { kind: "stale", message: "Reopen the report before recording a review." },
  community_review_response: { kind: "unavailable", message: "The report could not be verified. Reopen it and try again." },
  community_review_note: { kind: "invalid", message: "Enter a review reason of 8 to 1000 characters." },
  community_review_expired: { kind: "expired", message: "Private image links expired. Open the images again to continue." },
};
export async function communityReviewFailure(error) {
  let detail = error?.details, code = error?.code;
  const status = error?.context?.status ?? error?.status;
  try {
    const body = await error?.context?.clone().json();
    detail = body?.details ?? detail;
    code = body?.code ?? code;
  } catch { /* Provider diagnostics remain private. */ }
  if (status === 401 || status === 403) return failures.community_review_unavailable;
  if (Object.hasOwn(failures, detail)) return failures[detail];
  if (Object.hasOwn(failures, code)) return failures[code];
  if (code === "40001") return failures.community_review_changed;
  if (code === "42501") return failures.community_review_unavailable;
  return { kind: "retry", message: "Couldn’t complete this review request. Try again or reopen the report." };
}

export function communityReviewMedia(result, group, elapsed = 0) {
  const expected = group.content.assets;
  if (!Array.isArray(result?.media) || result.media.length !== expected.length || expected.some(item => !item.available) ||
    new Set(result.media.map(item => item?.id)).size !== expected.length) invalid();
  const media = result.media.map(page => {
    const original = expected.find(item => item.id === page?.id);
    if (!original || ["ordinal", "mimeType", "width", "height", "orientation"].some(key => page[key] !== original[key])) invalid();
    let url;
    try { url = new URL(page.url); } catch { invalid(); }
    if (url.username || url.password || !(url.protocol === "https:" || url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))) invalid();
    return { id: page.id, ordinal: page.ordinal, mimeType: page.mimeType, width: page.width, height: page.height,
      orientation: page.orientation, url: url.href };
  }).sort((a, b) => a.ordinal - b.ordinal);
  if (!isDate(result.serverNow) || !isDate(result.expiresAt) || !Number.isFinite(elapsed) || elapsed < 0) invalid();
  const duration = Date.parse(result.expiresAt) - Date.parse(result.serverNow);
  if (duration <= 0 || duration > 300000) invalid();
  return { media, lifetime: Math.max(0, duration - elapsed) };
}
