import { DRAWING_MAX_BYTES } from '../supabase/functions/_shared/drawing-limits.mjs';

const rasterTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

// The account-scoped Edge invoker authenticates every POST. Blob URLs never leave this document.
export async function openSessionDrawingPhotos(invoke, scope, signal) {
  signal.throwIfAborted();
  const started = performance.now();
  const manifest = await invoke({...scope, action: 'pages'}, signal);
  const pages = manifest?.images;
  if (manifest?.delivery !== 'session' || !Array.isArray(pages) || pages.length > 5 ||
      pages.some(p => !p || typeof p.id !== 'string' || !p.id || !Number.isInteger(p.ordinal) ||
        p.ordinal < 1 || p.ordinal > 5 || !rasterTypes.has(p.mimeType)) ||
      new Set(pages.map(p => p.id)).size !== pages.length ||
      new Set(pages.map(p => p.ordinal)).size !== pages.length) {
    throw new Error('Could not open protected drawing pages.');
  }
  const lifetime = Date.parse(manifest.expiresAt) - Date.parse(manifest.serverNow);
  if (!Number.isFinite(lifetime) || lifetime <= 0) throw new Error('Drawing preview expired.');
  const ttl = Math.min(300000, lifetime);
  const images = [];
  const dispose = () => {
    for (const image of images.splice(0)) URL.revokeObjectURL(image.url);
    signal.removeEventListener('abort', dispose);
  };
  signal.throwIfAborted();
  signal.addEventListener('abort', dispose, {once:true});
  try {
    for (const {id, ordinal, mimeType, width, height, orientation} of pages) {
      const blob = await invoke({...scope, action: 'page', id}, signal);
      signal.throwIfAborted();
      if (!(blob instanceof Blob) || blob.size < 1 || blob.size > DRAWING_MAX_BYTES) throw new Error('Could not open protected photo.');
      images.push({id, ordinal, mimeType, width, height, orientation, url: URL.createObjectURL(blob.slice(0, blob.size, mimeType))});
    }
    const remaining = ttl - (performance.now() - started);
    if (remaining <= 0) throw new Error('Drawing preview expired.');
    return {images: images.slice(), remaining, serverNow: manifest.serverNow, expiresAt: manifest.expiresAt, dispose};
  } catch (error) {
    dispose();
    throw error;
  }
}
