import { rasterMimeType } from './raster.mjs';
import { DRAWING_MAX_BYTES } from './drawing-limits.mjs';
import { DRAWING_LINK_SECONDS, sameDrawingPages } from './drawing-links.mjs';

const rasterTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const fromExtension = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function mimeType(page) {
  if (page.mimeType != null) return rasterTypes.has(page.mimeType) ? page.mimeType : null;
  const ext = page.storagePath.split('.').at(-1).toLowerCase();
  return Object.hasOwn(fromExtension, ext) ? fromExtension[ext] : null;
}

// Both callbacks use the same authenticated account and the same owner/assignment check.
export async function sessionDrawingResponse({ pagesForViewer, bucket, pageId, admitted, headers }) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers});
  const denied = () => json({error: 'Drawing pages are unavailable for this account.'}, 403);
  const first = await pagesForViewer();
  if (first.error || !Array.isArray(first.data) || first.data.length > 5) return denied();
  const pages = first.data;
  if (pages.some(page => !page || typeof page.storagePath !== 'string' || !mimeType(page))) return denied();
  if (pageId === undefined) {
    if (!(await admitted())) return denied();
    const now = Date.now();
    return json({delivery: 'session', serverNow: new Date(now).toISOString(), expiresAt: new Date(now + DRAWING_LINK_SECONDS * 1000).toISOString(),
      images: pages.map(page => ({id: page.id, ordinal: page.ordinal, mimeType: mimeType(page),
        width: page.width ?? null, height: page.height ?? null, orientation: page.orientation ?? null}))});
  }
  const page = pages.find(candidate => candidate.id === pageId);
  if (!page) return denied();
  const file = await bucket.download(page.storagePath);
  if (file.error || !(file.data instanceof Blob) || file.data.size < 1 || file.data.size > DRAWING_MAX_BYTES) {
    return json({error: 'Could not open this drawing page.'}, 502);
  }
  const signature = new Uint8Array(await file.data.slice(0, 12).arrayBuffer());
  if (rasterMimeType(signature) !== mimeType(page)) return json({error: 'Could not open this drawing page.'}, 502);
  const current = await pagesForViewer();
  if (current.error || !sameDrawingPages(pages, current.data) || !(await admitted())) return denied();
  // The SDK decodes this response as a Blob. The browser supplies its validated raster MIME for display.
  return new Response(file.data, {headers: {...headers, 'Content-Type': 'application/octet-stream',
    'Cache-Control': 'private, no-store', 'Content-Disposition': 'attachment', 'X-Content-Type-Options': 'nosniff'}});
}
