import { drawingOrientationProbes } from "./drawing-orientation-probes.js";
import { DRAWING_MAX_DIMENSION, DRAWING_MAX_PIXELS } from "../supabase/functions/_shared/drawing-limits.mjs";

const matrices = [null, [1, 0, 0, 1], [-1, 0, 0, 1], [-1, 0, 0, -1], [1, 0, 0, -1],
  [0, 1, 1, 0], [0, 1, -1, 0], [0, -1, -1, 0], [0, -1, 1, 0]];
const multiply = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3]];

export function drawingRenderMetadata(value) {
  return !!value && ["image/png", "image/jpeg", "image/webp"].includes(value.mimeType) &&
    [value.width, value.height, value.orientation].every(Number.isInteger) && value.width > 0 && value.height > 0 &&
    value.width <= DRAWING_MAX_DIMENSION && value.height <= DRAWING_MAX_DIMENSION && value.width * value.height <= DRAWING_MAX_PIXELS &&
    value.orientation >= 1 && value.orientation <= 8;
}

export function drawingInspectionLayout({ width, height, orientation = 1, nativeOriented = null, turns = 0, mirrored = false, zoom = 1, viewportWidth, viewportHeight }) {
  if (![width, height, viewportWidth, viewportHeight].every(value => Number.isFinite(value) && value > 0)) return null;
  const base = nativeOriented === false && Number.isInteger(orientation) && orientation >= 1 && orientation <= 8 ? matrices[orientation] : matrices[1];
  const rotations = [matrices[1], matrices[6], matrices[3], matrices[8]];
  let matrix = multiply(rotations[((turns % 4) + 4) % 4] ?? matrices[1], base);
  if (mirrored) matrix = multiply(matrices[2], matrix);
  matrix = matrix.map(value => value === 0 ? 0 : value);
  const outputWidth = Math.abs(matrix[0]) * width + Math.abs(matrix[2]) * height;
  const outputHeight = Math.abs(matrix[1]) * width + Math.abs(matrix[3]) * height;
  const fitScale = Math.min(viewportWidth / outputWidth, viewportHeight / outputHeight);
  const nativeZoom = 1 / fitScale, minZoom = Math.min(1, nativeZoom), maxZoom = Math.max(4, nativeZoom);
  const boundedZoom = Math.max(minZoom, Math.min(maxZoom, Number.isFinite(zoom) && zoom > 0 ? zoom : 1)), scale = fitScale * boundedZoom;
  return { matrix, imageWidth: width * scale, imageHeight: height * scale, frameWidth: outputWidth * scale, frameHeight: outputHeight * scale,
    fitScale, nativeZoom, minZoom, maxZoom, zoom: boundedZoom, scale };
}

// Test actual decoding, rather than guessing from browser names or natural aspect ratios.
// A blocked/failed probe returns unknown so manual view controls remain available.
export function createDrawingOrientationProbe(makeImage, timeoutMs = 2000) {
  const cache = new Map();
  return mime => {
    if (!Object.hasOwn(drawingOrientationProbes, mime)) return Promise.resolve(null);
    if (!cache.has(mime)) cache.set(mime, new Promise(resolve => {
      let image, timer;
      const finish = value => {
        clearTimeout(timer);
        if (image) { image.onload = null; image.onerror = null; }
        resolve(value);
      };
      try {
        image = makeImage();
        timer = setTimeout(() => finish(null), timeoutMs);
        image.onload = () => finish(image.naturalWidth === 2 && image.naturalHeight === 1 ? true : image.naturalWidth === 1 && image.naturalHeight === 2 ? false : null);
        image.onerror = () => finish(null);
        image.src = drawingOrientationProbes[mime];
      } catch { finish(null); }
    }));
    return cache.get(mime);
  };
}
export const nativeDrawingOrientation = createDrawingOrientationProbe(() => new Image());
