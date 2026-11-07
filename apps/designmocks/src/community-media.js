import { COMMUNITY_MAX_BYTES, COMMUNITY_MAX_IMAGES } from "../supabase/functions/_shared/community-image.mjs";

const messages = {
  invalid_image: "An image could not be fully read. Export a still PNG, JPEG or WebP and retry the remaining images.",
  image_size: "Use images no larger than 5 MB each.",
  request_size: "Use images no larger than 5 MB each.",
  image_dimensions: "Use images up to 24 megapixels and 12,000 pixels on either side.",
  image_busy: "Another image is being checked. Retry the remaining images shortly.",
  validation_unavailable: "Image checks are temporarily unavailable. Retry the remaining images shortly.",
  target_unavailable: "This post or reply is unavailable for uploads. Open the saved discussion to check its status.",
  slot_conflict: "This image position is already saved. Open the discussion to review it.",
};
export function checkCommunityFiles(files) {
  if (files.length > COMMUNITY_MAX_IMAGES) return "Choose no more than three images.";
  for (const file of files) {
    if (!file.size || file.size > COMMUNITY_MAX_BYTES) return messages.image_size;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return messages.invalid_image;
  }
  return null;
}
export async function communityUploadError(error) {
  try {
    const data = await error?.context?.clone().json();
    if (Object.hasOwn(messages, data?.code)) return new Error(messages[data.code]);
  } catch { /* Unknown provider diagnostics are never displayed. */ }
  return new Error("An image did not confirm. Retry the remaining images; your saved text will not be posted again.");
}
export async function resumeCommunityImages(job, invoke, signal, onProgress = () => {}) {
  const ordinals=job.ordinals??job.files.map((_,index)=>index+1);
  if(!Array.isArray(ordinals)||ordinals.length!==job.files.length||new Set(ordinals).size!==ordinals.length||
    ordinals.some(ordinal=>!Number.isInteger(ordinal)||ordinal<1||ordinal>3)||!Number.isInteger(job.next)||job.next<0||job.next>job.files.length)
    throw new Error("Refresh the discussion before adding images.");
  for (let index = job.next; index < job.files.length; index++) {
    signal?.throwIfAborted();
    const body = new FormData();
    body.set("targetType", job.targetType); body.set("targetId", job.targetId);
    body.set("ordinal", String(ordinals[index])); body.set("file", job.files[index]);
    const { data, error } = await invoke(body, signal);
    signal?.throwIfAborted();
    if (error) throw await communityUploadError(error);
    if (typeof data?.id !== "string" || data.ordinal !== ordinals[index]) throw await communityUploadError();
    job.next = index + 1; onProgress(job.next);
  }
}
export function communityLinkLifetime(result, elapsed = 0) {
  if (!Array.isArray(result?.media) || result.media.length > 3 || new Set(result.media.map(item => item.id)).size !== result.media.length ||
      result.media.some(item => typeof item.id !== "string" || !Number.isInteger(item.ordinal) || item.ordinal < 1 || item.ordinal > 3 || typeof item.url !== "string")) throw new Error("Invalid image response");
  const start = Date.parse(result.serverNow), end = Date.parse(result.expiresAt);
  return Math.max(0, Math.min(300_000, Number.isFinite(start) && Number.isFinite(end) ? end - start : 300_000) - Math.max(0, elapsed));
}
