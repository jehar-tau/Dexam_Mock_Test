import { DrawingImageError, DRAWING_MAX_BYTES } from "./drawing-image.mjs";

export const DRAWING_FORM_MAX_BYTES = DRAWING_MAX_BYTES + 64 * 1024;

// Content-Length is optional and untrusted; enforce the limit while consuming the stream too.
export async function drawingRequestBody(request, maxBytes) {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    throw new DrawingImageError("The upload request is too large.", "request_size", 413);
  }
  const reader = request.body?.getReader(), parts = [];
  let size = 0;
  if (!reader) throw new DrawingImageError("The drawing request is empty.");
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > maxBytes) { await reader.cancel(); throw new DrawingImageError("The upload request is too large.", "request_size", 413); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let at = 0;
  for (const part of parts) { bytes.set(part, at); at += part.length; }
  return bytes;
}
