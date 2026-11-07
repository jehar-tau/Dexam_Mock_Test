export const DRAWING_LINK_SECONDS = 300;
export class DrawingLinksError extends Error {
  constructor(message) { super(message); this.name = "DrawingLinksError"; this.status = 502; }
}

export function sameDrawingPages(first, second) {
  const identity = pages => pages.map(page => [page.id, page.ordinal, page.storagePath, page.mimeType ?? null,
    page.width ?? null, page.height ?? null, page.orientation ?? null]);
  return Array.isArray(first) && Array.isArray(second) && JSON.stringify(identity(first)) === JSON.stringify(identity(second));
}

// Paths come only from the owner-bound service RPC or the assigned-reviewer RPC.
export async function signedDrawingPages(bucket, pages, now = Date.now()) {
  if (!Array.isArray(pages) || pages.length > 5) throw new DrawingLinksError("Drawing pages are unavailable.");
  const serverNow = new Date(now).toISOString();
  const expiresAt = new Date(now + DRAWING_LINK_SECONDS * 1000).toISOString();
  if (!pages.length) return { images: [], serverNow, expiresAt };
  const signed = await bucket.createSignedUrls(pages.map(page => page.storagePath), DRAWING_LINK_SECONDS);
  if (signed.error) throw new DrawingLinksError("Drawing pages could not be opened. Try again.");
  const links = new Map(signed.data.filter(entry => !entry.error && entry.signedUrl).map(entry => [entry.path, entry.signedUrl]));
  if (pages.some(page => !links.has(page.storagePath))) throw new DrawingLinksError("A drawing page could not be opened. Try again.");
  return { serverNow, expiresAt, images: pages.map(page => ({
    id: page.id, ordinal: page.ordinal, mimeType: page.mimeType ?? null,
    width: page.width ?? null, height: page.height ?? null, orientation: page.orientation ?? null,
    url: links.get(page.storagePath),
  })) };
}
