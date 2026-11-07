import { DrawingImageError, DRAWING_MAX_DIMENSION, DRAWING_MAX_PIXELS, prepareDrawingImage } from "./drawing-image.mjs";

// The same implementation runs against the pinned Wasm codec in Edge and Node QA.
// Loading is lazy: denied callers, JSON actions and malformed containers do not boot a decoder.
export function createDrawingValidator(codec, loadWasm) {
  let ready, busy = false;
  return async function validateDrawing(bytes, mime) {
    if (busy) throw new DrawingImageError("Another image is being checked. Try this page again.", "drawing_busy", 429);
    busy = true;
    try {
      const result = await prepareDrawingImage(bytes, mime);
      if (!ready) ready = (async () => {
        await codec.initializeImageMagick(await loadWasm());
        const limits = codec.ResourceLimits;
        limits.width = BigInt(DRAWING_MAX_DIMENSION); limits.height = BigInt(DRAWING_MAX_DIMENSION);
        // The native reader briefly holds the empty image and the decoded image.
        // Animated/multiple-image containers have already been rejected above.
        // Native area admission is exclusive; the parser enforces our inclusive limit.
        limits.area = BigInt(DRAWING_MAX_PIXELS) + 1n; limits.listLength = 2n;
        limits.memory = 128n * 1024n * 1024n; limits.maxMemoryRequest = 128n * 1024n * 1024n;
        limits.disk = 0n; limits.maxProfileSize = 256n * 1024n;
      })().catch(() => { ready = undefined; throw new DrawingImageError("Image checks are temporarily unavailable. Try this page again.", "validation_unavailable", 503); });
      await ready;
      const image = codec.MagickImage.create();
      let warned = false;
      try {
        image.onWarning = () => { warned = true; };
        image.read(result.bytes, new codec.MagickReadSettings({
          format: codec.MagickFormat[result.mime === "image/png" ? "Png" : result.mime === "image/jpeg" ? "Jpeg" : "WebP"],
        }));
        // read() decodes the raster, rather than pinging the header. Touch the last
        // pixel of the populated cache without hashing/copying a second whole image.
        const lastPixel = image.getPixels((pixels) => pixels.getPixel(result.width - 1, result.height - 1));
        if (warned || !lastPixel?.length || image.width !== result.width || image.height !== result.height) throw new Error("Incomplete raster");
      } catch {
        throw new DrawingImageError("This image could not be fully read. Export a still PNG, JPEG or WebP and try again.");
      } finally { image.dispose(); }
      return result;
    } finally { busy = false; }
  };
}
