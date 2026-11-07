import { CommunityMediaError, communityTarget } from "./community-image.mjs";
import { sameDrawingPages, signedDrawingPages } from "./drawing-links.mjs";

export function communityReviewInput(value) {
  if (!value || value.action !== "review" || Object.keys(value).length !== 4 ||
    !communityTarget("post", value.reportId) || typeof value.reviewVersion !== "string" || !/^[0-9a-f]{64}$/.test(value.reviewVersion) ||
    !["target", "post", "parent"].includes(value.context)) {
    throw new CommunityMediaError("Choose a current report and image context.", "community_review_invalid", 400);
  }
  return { p_report_id: value.reportId, p_expected_version: value.reviewVersion, p_context: value.context };
}

function unavailable(error) {
  const choices = {
    community_review_changed: ["This report changed. Reopen it before reviewing the images.", 409],
    community_review_unavailable: ["This community report is unavailable.", 403],
    community_review_incomplete: ["A registered image is unavailable. Reopen the report to review its status.", 409],
    community_review_invalid: ["Choose a current report and image context.", 400],
  };
  const code = Object.hasOwn(choices, error?.details) ? error.details : error?.code === "42501" ? "community_review_unavailable" : "media_unavailable";
  const [message, status] = choices[code] ?? ["Report images could not be opened. Try again.", 502];
  return new CommunityMediaError(message, code, status);
}

function pages(value) {
  if (!Array.isArray(value) || value.length > 3 || new Set(value.map(item => item?.id)).size !== value.length ||
    new Set(value.map(item => item?.ordinal)).size !== value.length || new Set(value.map(item => item?.path)).size !== value.length ||
    value.some(item => !item || !communityTarget("post", item.id) || !Number.isInteger(item.ordinal) || item.ordinal < 1 || item.ordinal > 3 ||
      typeof item.path !== "string" || !item.path || !["image/png", "image/jpeg", "image/webp"].includes(item.mimeType) ||
      !((item.width === null && item.height === null && item.orientation === null) ||
        (Number.isInteger(item.width) && item.width >= 1 && item.width <= 12000 && Number.isInteger(item.height) && item.height >= 1 &&
          item.height <= 12000 && item.width * item.height <= 24000000 && Number.isInteger(item.orientation) && item.orientation >= 1 && item.orientation <= 8)))) {
    throw unavailable();
  }
  return value.map(({ path, ...item }) => ({ ...item, storagePath: path }));
}

// The authorized RPC binds the report, inspected version, context and registered
// object state. A second read after signing discards every URL if that scope changes.
export async function signedCommunityReview(input, read, bucket) {
  const args = communityReviewInput(input);
  const initial = await read(args);
  if (initial.error) throw unavailable(initial.error);
  const first = pages(initial.data);
  let signed;
  try { signed = await signedDrawingPages(bucket, first); }
  catch { throw unavailable(); }
  const current = await read(args);
  if (current.error) throw unavailable(current.error);
  if (!sameDrawingPages(first, pages(current.data))) throw new CommunityMediaError("This report changed. Reopen it before reviewing the images.", "community_review_changed", 409);
  return { media: signed.images, serverNow: signed.serverNow, expiresAt: signed.expiresAt };
}
