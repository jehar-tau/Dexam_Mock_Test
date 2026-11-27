import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ImageMagick, initializeImageMagick, MagickFormat } from "@imagemagick/magick-wasm";
import { prepareDrawingImage } from "../supabase/functions/_shared/drawing-image.mjs";

let codec;

function loadCodec() {
  codec ??= readFile(new URL(import.meta.resolve("@imagemagick/magick-wasm/magick.wasm")))
    .then(bytes => initializeImageMagick(bytes))
    .catch(error => {
      codec = null;
      throw error;
    });
  return codec;
}

export async function prepareAdvisoryImage(bytes, file, longEdge) {
  if (bytes.length !== file.byteSize ||
      (file.sha256 && createHash("sha256").update(bytes).digest("hex") !== file.sha256)) {
    throw new Error("A private image differs from its registered bytes");
  }
  const input = await prepareDrawingImage(bytes, file.mimeType);
  const orientationFromCanonicalBytes = file.role === "figure" && file.sha256 && file.orientation === undefined;
  if (input.width !== file.width || input.height !== file.height ||
      (!orientationFromCanonicalBytes && input.orientation !== file.orientation)) {
    throw new Error("A private image differs from its registered rendering metadata");
  }
  await loadCodec();
  return ImageMagick.read(input.bytes, image => {
    if (image.width !== file.width || image.height !== file.height) {
      throw new Error("The decoded image differs from its registered dimensions");
    }
    if (input.orientation === 1 && !longEdge) return input.bytes;
    image.orientation = input.orientation;
    image.autoOrient();
    const [width, height] = input.orientation >= 5 ? [input.height, input.width] : [input.width, input.height];
    if (image.orientation !== 1 || image.width !== width || image.height !== height) {
      throw new Error("A private image could not be normalized for advisory review");
    }
    if (longEdge) {
      const scale = Math.min(1, longEdge / Math.max(width, height));
      if (scale < 1) image.resize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
      image.strip();
    }
    return image.write(MagickFormat.Png, data => Uint8Array.from(data));
  });
}
