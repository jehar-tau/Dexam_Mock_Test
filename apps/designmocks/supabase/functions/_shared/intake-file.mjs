import { rasterMimeType } from "./raster.mjs";
import { INTAKE_FIGURE_MAX_BYTES } from "./intake-limits.mjs";

export async function intakeFigureDescriptor(bytes, digest) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  const ending = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
  if (bytes.length < 45 || bytes.length > INTAKE_FIGURE_MAX_BYTES ||
    !signature.every((value, index) => bytes[index] === value) ||
    !ending.every((value, index) => bytes[bytes.length - 12 + index] === value)) {
    throw new Error("Use a complete PNG figure up to 10 MB.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16), height = view.getUint32(20);
  if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452 ||
    width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 16777216) {
    throw new Error("Use a PNG figure within 8192 pixels per side and 16 megapixels.");
  }
  const sha256 = [...new Uint8Array(await digest("SHA-256", bytes))]
    .map(value => value.toString(16).padStart(2, "0")).join("");
  return { role: "question", path: `intake/${sha256}.png`, sha256, width, height };
}

export function intakeFileMatches(bytes, mimeType) {
  if (mimeType === "application/pdf") {
    return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
  }
  return rasterMimeType(bytes) === mimeType;
}
