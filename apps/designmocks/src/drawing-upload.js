import { DRAWING_MAX_BYTES } from "../supabase/functions/_shared/drawing-limits.mjs";

const messages = {
  invalid_image: "An image could not be fully read. Export a still PNG, JPEG or WebP and try again.",
  image_size: "Use images no larger than 10 MB each.",
  request_size: "Use images no larger than 10 MB each.",
  image_dimensions: "Use images up to 24 megapixels and 12,000 pixels on either side.",
  drawing_busy: "Another image is being checked. Try the remaining pages again.",
  validation_unavailable: "Image checks are temporarily unavailable. Try the remaining pages again.",
};

export function checkDrawingFiles(files) {
  for (const file of files) {
    if (!file.size || file.size > DRAWING_MAX_BYTES) return messages.image_size;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return messages.invalid_image;
  }
  return null;
}

// Never reflect an arbitrary provider/decoder response into the student UI.
export async function drawingMediaError(error) {
  try {
    const data = await error?.context?.clone().json();
    if (typeof data?.code === "string" && Object.hasOwn(messages, data.code)) return Object.assign(new Error(messages[data.code]), { drawingCode: data.code });
  } catch { /* An absent/ambiguous receipt is reconciled from the saved-page list. */ }
  return error;
}

export function drawingUploadFailure(error) {
  const detail = Object.hasOwn(messages, error?.drawingCode) ? messages[error.drawingCode] : null;
  return detail
    ? `${detail} Check your saved pages before adding the remaining images.`
    : "An upload did not confirm. Check your saved pages before adding the remaining images.";
}

export function drawingInventory(result) {
  const items = result?.items;
  if (!Array.isArray(items) || items.length > 5 || items.some(item =>
    typeof item?.id !== "string" || !item.id || !Number.isInteger(item.ordinal) || item.ordinal < 1 || item.ordinal > 5) ||
    new Set(items.map(item => item.id)).size !== items.length ||
    new Set(items.map(item => item.ordinal)).size !== items.length) {
    throw new Error("Unconfirmed drawing inventory.");
  }
  return items;
}

export function planDrawingPages(files, savedPages) {
  const used = new Set(savedPages.map(page => page.ordinal));
  const free = [1, 2, 3, 4, 5].filter(ordinal => !used.has(ordinal));
  if (files.length > free.length) {
    return {error: free.length === 1 ? "Only one image slot is available. Select one image."
      : `Only ${free.length} image slots are available. Select fewer images.`};
  }
  return {pages: files.map((file, index) => ({file, ordinal: free[index]}))};
}

export function drawingPageReceipt(result, ordinal) {
  if (typeof result?.id !== "string" || !result.id || result.ordinal !== ordinal) {
    throw new Error("Unconfirmed drawing upload.");
  }
  return result.id;
}
