import { rasterMimeType } from "./raster.mjs";
import { DRAWING_MAX_BYTES, DRAWING_MAX_PIXELS, DRAWING_MAX_DIMENSION } from "./drawing-limits.mjs";
export { DRAWING_MAX_BYTES, DRAWING_MAX_PIXELS, DRAWING_MAX_DIMENSION } from "./drawing-limits.mjs";

// Container contracts: https://www.w3.org/TR/png-3/
// https://www.w3.org/Graphics/JPEG/itu-t81.pdf
// https://developers.google.com/speed/webp/docs/riff_container
// These filters retain rendering data; the pinned decoder validates the pixel stream.

const PROFILE_LIMIT = 256 * 1024;
const CHUNK_LIMIT = 2048;
const ascii = (bytes, offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));
const text = (value) => new TextEncoder().encode(value);
const view = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const join = (parts) => {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
};

export class DrawingImageError extends Error {
  constructor(message, code = "invalid_image", status = 400) {
    super(message); this.name = "DrawingImageError"; this.code = code; this.status = status;
  }
}
const invalid = () => { throw new DrawingImageError("This image is incomplete or unsupported. Export a still PNG, JPEG or WebP and try again."); };
function dimensions(width, height) {
  if (!width || !height || width > DRAWING_MAX_DIMENSION || height > DRAWING_MAX_DIMENSION || width * height > DRAWING_MAX_PIXELS) {
    throw new DrawingImageError("Use an image up to 24 megapixels and 12,000 pixels on either side.", "image_dimensions", 413);
  }
}

// Inspect only IFD0. No GPS, maker notes, embedded thumbnail or other IFD survives.
function orientation(bytes) {
  if (ascii(bytes, 0, 6) === "Exif\0\0") bytes = bytes.subarray(6);
  if (bytes.length < 8) invalid();
  const little = ascii(bytes, 0, 2) === "II", data = view(bytes);
  if (!little && ascii(bytes, 0, 2) !== "MM" || data.getUint16(2, little) !== 42) invalid();
  const offset = data.getUint32(4, little);
  if (offset === 0) return 1;
  if (offset < 8 || offset + 2 > bytes.length) invalid();
  const count = data.getUint16(offset, little);
  if (count > CHUNK_LIMIT || offset + 2 + count * 12 + 4 > bytes.length) invalid();
  let result = 1, found = false;
  for (let at = offset + 2; at < offset + 2 + count * 12; at += 12) {
    if (data.getUint16(at, little) !== 274) continue;
    if (found || data.getUint16(at + 2, little) !== 3 || data.getUint32(at + 4, little) !== 1) invalid();
    found = true; result = data.getUint16(at + 8, little);
    if (result < 1 || result > 8) invalid();
  }
  return result;
}

function orientationOnly(value) {
  // A single SHORT tag, no next IFD and no pointers into the original file.
  const bytes = Uint8Array.from([77, 77, 0, 42, 0, 0, 0, 8, 0, 1, 1, 18, 0, 3, 0, 0, 0, 1, 0, value, 0, 0, 0, 0, 0, 0]);
  return bytes;
}

function checkProfile(bytes) {
  if (bytes.length < 128 || bytes.length > PROFILE_LIMIT || view(bytes).getUint32(0) !== bytes.length || ascii(bytes, 36, 4) !== "acsp") invalid();
}

async function inflateProfile(bytes) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
  const parts = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > PROFILE_LIMIT) { await reader.cancel(); invalid(); }
      parts.push(value);
    }
  } catch { invalid(); } finally { reader.releaseLock(); }
  checkProfile(join(parts));
}

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, payload) {
  const result = new Uint8Array(payload.length + 12), data = view(result);
  data.setUint32(0, payload.length); result.set(text(type), 4); result.set(payload, 8);
  data.setUint32(result.length - 4, crc32(result.subarray(4, result.length - 4)));
  return result;
}

async function png(bytes) {
  const data = view(bytes), kept = [], seen = new Set();
  let at = 8, width, height, depth, color, rotation = 1, idat = false, endedIdat = false, finished = false, chunks = 0;
  const colors = { cHRM: 32, gAMA: 4, sRGB: 1, cICP: 4, mDCV: 24, cLLI: 8 };
  while (at < bytes.length) {
    if (++chunks > CHUNK_LIMIT || at + 12 > bytes.length) invalid();
    const size = data.getUint32(at), end = at + size + 12, type = ascii(bytes, at + 4, 4);
    if (end > bytes.length || !/^[A-Za-z]{4}$/.test(type) || /[a-z]/.test(type[2]) ||
        data.getUint32(end - 4) !== crc32(bytes.subarray(at + 4, end - 4))) invalid();
    const payload = bytes.subarray(at + 8, end - 4);
    if (chunks === 1 && type !== "IHDR") invalid();
    if (["acTL", "fcTL", "fdAT"].includes(type)) invalid();
    if (type !== "IDAT" && idat) endedIdat = true;
    if (["IHDR", "PLTE", "IEND", "eXIf", "iCCP", "tRNS", "sBIT", "bKGD", ...Object.keys(colors)].includes(type) && seen.has(type)) invalid();
    seen.add(type);
    if (type === "IHDR") {
      if (chunks !== 1 || size !== 13) invalid();
      width = data.getUint32(at + 8); height = data.getUint32(at + 12); dimensions(width, height);
      depth = payload[8]; color = payload[9];
      if (!({ 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] })[color]?.includes(depth) ||
          payload[10] !== 0 || payload[11] !== 0 || payload[12] > 1) invalid();
      kept.push(bytes.subarray(at, end));
    } else if (type === "IDAT") {
      if (endedIdat || color === 3 && !seen.has("PLTE")) invalid();
      idat = true; kept.push(bytes.subarray(at, end));
    } else if (type === "IEND") {
      if (size || !idat || end !== bytes.length) invalid();
      finished = true; kept.push(bytes.subarray(at, end));
    } else if (type === "PLTE") {
      if (idat || color === 0 || color === 4 || !size || size % 3 || size > 768 || color === 3 && size / 3 > 2 ** depth) invalid();
      kept.push(bytes.subarray(at, end));
    } else if (type === "eXIf") {
      rotation = orientation(payload);
    } else if (type === "iCCP") {
      if (idat || seen.has("PLTE") || size > PROFILE_LIMIT) invalid();
      const zero = payload.indexOf(0);
      if (zero < 1 || zero > 79 || payload[zero + 1] !== 0) invalid();
      await inflateProfile(payload.subarray(zero + 2));
      // Profile names can contain filenames; retain colour data under a generic name.
      kept.push(pngChunk(type, join([text("Color\0\0"), payload.subarray(zero + 2)])));
    } else if (type in colors) {
      if (idat || seen.has("PLTE") || size !== colors[type]) invalid();
      kept.push(bytes.subarray(at, end));
    } else if (["tRNS", "sBIT", "bKGD"].includes(type)) {
      if (idat || size > 768) invalid();
      if (type === "tRNS" && (color === 3 ? !seen.has("PLTE") || !size : size !== ({ 0: 2, 2: 6 })[color])) invalid();
      kept.push(bytes.subarray(at, end));
    } else if (type[0] === type[0].toUpperCase()) invalid();
    // Drop text, dates, density, thumbnails and all other ancillary chunks.
    at = end;
  }
  if (!finished) invalid();
  const firstData = kept.findIndex((chunk) => ascii(chunk, 4, 4) === "IDAT");
  if (rotation !== 1) kept.splice(firstData, 0, pngChunk("eXIf", orientationOnly(rotation)));
  return { bytes: join([bytes.subarray(0, 8), ...kept]), width, height, orientation: rotation };
}

function jpegSegment(marker, payload) {
  const result = new Uint8Array(payload.length + 4);
  result.set([255, marker]); view(result).setUint16(2, payload.length + 2); result.set(payload, 4);
  return result;
}

function jpeg(bytes) {
  const data = view(bytes), kept = [bytes.subarray(0, 2)], profiles = new Map();
  let at = 2, width, height, rotation = 1, exif = false, scan = false, finished = false, count = 0, profileCount = 0, profileSize = 0;
  while (at < bytes.length) {
    if (++count > CHUNK_LIMIT || bytes[at] !== 255) invalid();
    const start = at++;
    while (bytes[at] === 255) at++;
    const marker = bytes[at++];
    if (marker === 0xd9) {
      if (!scan || !width || at !== bytes.length) invalid();
      kept.push(Uint8Array.from([255, 0xd9])); finished = true; break;
    }
    if (!marker || marker === 0xd8 || marker === 1 || marker >= 0xd0 && marker <= 0xd7 || at + 2 > bytes.length) invalid();
    const size = data.getUint16(at), end = at + size;
    if (size < 2 || end > bytes.length) invalid();
    const payload = bytes.subarray(at + 2, end);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (width || payload.length < 6 || payload.length !== 6 + payload[5] * 3) invalid();
      height = view(payload).getUint16(1); width = view(payload).getUint16(3); dimensions(width, height);
    }
    if (marker === 0xe1 && ascii(payload, 0, 6) === "Exif\0\0") {
      if (exif) invalid(); exif = true; rotation = orientation(payload);
    } else if (marker === 0xe2 && ascii(payload, 0, 12) === "ICC_PROFILE\0") {
      const sequence = payload[12], total = payload[13];
      profileSize += payload.length - 14;
      if (!sequence || sequence > total || profiles.has(sequence) || profileCount && profileCount !== total || profileSize > PROFILE_LIMIT) invalid();
      profileCount = total; profiles.set(sequence, payload.subarray(14)); kept.push(bytes.subarray(start, end));
    } else if (marker === 0xe0 && ascii(payload, 0, 5) === "JFIF\0") {
      if (payload.length < 14 || payload.length !== 14 + 3 * payload[12] * payload[13]) invalid();
      const header = payload.slice(0, 14); header[12] = 0; header[13] = 0;
      kept.push(jpegSegment(marker, header));
    } else if (marker === 0xee && ascii(payload, 0, 5) === "Adobe") {
      if (payload.length < 12) invalid(); kept.push(jpegSegment(marker, payload.subarray(0, 12)));
    } else if (!(marker >= 0xe0 && marker <= 0xef) && marker !== 0xfe) {
      kept.push(bytes.subarray(start, end));
    }
    at = end;
    if (marker === 0xda) {
      if (!width) invalid(); scan = true;
      const entropy = at;
      while (at < bytes.length) {
        if (bytes[at] !== 255) { at++; continue; }
        let next = at + 1;
        while (bytes[next] === 255) next++;
        if (bytes[next] === 0 || bytes[next] >= 0xd0 && bytes[next] <= 0xd7) { at = next + 1; continue; }
        break;
      }
      kept.push(bytes.subarray(entropy, at));
    }
  }
  if (!finished) invalid();
  if (profileCount) {
    if (profiles.size !== profileCount) invalid();
    checkProfile(join(Array.from({ length: profileCount }, (_, index) => profiles.get(index + 1))));
  }
  if (rotation !== 1) kept.splice(1, 0, jpegSegment(0xe1, join([text("Exif\0\0"), orientationOnly(rotation)])));
  return { bytes: join(kept), width, height, orientation: rotation };
}

function webpChunk(type, payload) {
  const result = new Uint8Array(8 + payload.length + payload.length % 2);
  result.set(text(type)); view(result).setUint32(4, payload.length, true); result.set(payload, 8);
  return result;
}
const uint24 = (bytes, at) => bytes[at] | bytes[at + 1] << 8 | bytes[at + 2] << 16;
function webp(bytes) {
  const data = view(bytes), seen = new Set(), kept = [];
  if (bytes.length < 20 || data.getUint32(4, true) + 8 !== bytes.length) invalid();
  let at = 12, width, height, rotation = 1, extended, alpha = false, image = false, count = 0;
  while (at < bytes.length) {
    if (++count > CHUNK_LIMIT || at + 8 > bytes.length) invalid();
    const type = ascii(bytes, at, 4), size = data.getUint32(at + 4, true), end = at + 8 + size + size % 2;
    if (end > bytes.length || size % 2 && bytes[end - 1] !== 0 || seen.has(type)) invalid();
    seen.add(type);
    const payload = bytes.subarray(at + 8, at + 8 + size);
    if (type === "VP8X") {
      if (count !== 1 || size !== 10 || payload[0] & 0xc3 || payload[1] || payload[2] || payload[3]) invalid();
      extended = payload; dimensions(uint24(payload, 4) + 1, uint24(payload, 7) + 1);
    } else if (type === "ANIM" || type === "ANMF") invalid();
    else if (type === "VP8 " || type === "VP8L") {
      if (image) invalid(); image = true;
      if (type === "VP8 ") {
        if (size < 10 || payload[0] & 1 || ascii(payload, 3, 3) !== "\x9d\x01\x2a") invalid();
        width = view(payload).getUint16(6, true) & 0x3fff; height = view(payload).getUint16(8, true) & 0x3fff;
        alpha = seen.has("ALPH");
      } else {
        if (size < 5 || payload[0] !== 0x2f || payload[4] & 0xe0 || seen.has("ALPH")) invalid();
        const header = view(payload).getUint32(1, true);
        width = (header & 0x3fff) + 1; height = (header >>> 14 & 0x3fff) + 1; alpha = !!(header & 0x10000000);
      }
      dimensions(width, height); kept.push(bytes.subarray(at, end));
    } else if (type === "ALPH") {
      if (!extended || image || !size) invalid(); kept.push(bytes.subarray(at, end));
    } else if (type === "ICCP") {
      if (!extended || image || seen.has("ALPH")) invalid(); checkProfile(payload); kept.push(bytes.subarray(at, end));
    } else if (type === "EXIF") {
      if (!extended || !image) invalid(); rotation = orientation(payload);
    } else if (type === "XMP ") {
      if (!extended || !image) invalid();
    } else if (!image) invalid();
    at = end;
  }
  if (!image) invalid();
  if (extended) {
    if (uint24(extended, 4) + 1 !== width || uint24(extended, 7) + 1 !== height ||
        !!(extended[0] & 0x20) !== seen.has("ICCP") || !!(extended[0] & 0x10) !== alpha ||
        !!(extended[0] & 8) !== seen.has("EXIF") || !!(extended[0] & 4) !== seen.has("XMP ")) invalid();
    const header = extended.slice(); header[0] = (seen.has("ICCP") ? 0x20 : 0) | (alpha ? 0x10 : 0) | (rotation !== 1 ? 8 : 0);
    kept.unshift(webpChunk("VP8X", header));
  }
  if (rotation !== 1) kept.push(webpChunk("EXIF", orientationOnly(rotation)));
  const result = join([text("RIFF\0\0\0\0WEBP"), ...kept]); view(result).setUint32(4, result.length - 8, true);
  return { bytes: result, width, height, orientation: rotation };
}

// Container filtering preserves the compressed pixels and rendering colour data.
// This is deliberately NOT a decoder or a general-purpose malware scanner.
export async function prepareDrawingImage(bytes, declaredMime) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > DRAWING_MAX_BYTES) {
    throw new DrawingImageError("Use an image no larger than 10 MB.", "image_size", 413);
  }
  const mime = rasterMimeType(bytes);
  if (!mime || mime !== declaredMime) invalid();
  const result = await (mime === "image/png" ? png(bytes) : mime === "image/jpeg" ? jpeg(bytes) : webp(bytes));
  if (result.bytes.length > DRAWING_MAX_BYTES) throw new DrawingImageError("Use an image no larger than 10 MB.", "image_size", 413);
  return { ...result, mime };
}
