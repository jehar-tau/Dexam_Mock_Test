export const COMMUNITY_MAX_BYTES = 5 * 1024 * 1024;
export const COMMUNITY_FORM_MAX_BYTES = COMMUNITY_MAX_BYTES + 64 * 1024;
export const COMMUNITY_MAX_IMAGES = 3;
export class CommunityMediaError extends Error {
  constructor(message, code = "invalid_image", status = 400) { super(message); this.code = code; this.status = status; }
}
export const communityTarget = (type, id) => ["post", "comment"].includes(type) && typeof id === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);

export async function validateCommunityImage(bytes, mime, decode) {
  if (!bytes?.length || bytes.length > COMMUNITY_MAX_BYTES) throw new CommunityMediaError("Use images no larger than 5 MB each.", "image_size", 413);
  const result = await decode(bytes, mime);
  if (!result.bytes?.length || result.bytes.length > COMMUNITY_MAX_BYTES) throw new CommunityMediaError("Use images no larger than 5 MB each.", "image_size", 413);
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", result.bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return { ...result, sha256: digest };
}

// Arbitrary database, Storage and decoder diagnostics stay out of member responses.
export function communityMediaFailure(error) {
  const code = error?.code;
  if (error instanceof CommunityMediaError) return { error: error.message, code, status: error.status };
  const known = {
    invalid_image: ["This image could not be fully read. Export a still PNG, JPEG or WebP and try again.",400],
    request_size: ["Use images no larger than 5 MB each.",413],
    image_size: ["Use images no larger than 5 MB each.",413],
    image_dimensions: ["Use images up to 24 megapixels and 12,000 pixels on either side.",400],
    drawing_busy: ["Another image is being checked. Try the remaining images again.",429],
    validation_unavailable: ["Image checks are temporarily unavailable. Try again.",503],
  };
  return Object.hasOwn(known, code) ? { error: known[code][0], code: code === "drawing_busy" ? "image_busy" : code, status: known[code][1] }
    : { error: "The image request did not confirm. Try the remaining images again.", code: "media_unavailable", status: 502 };
}
