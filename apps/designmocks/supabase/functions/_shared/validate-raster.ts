import * as codec from "npm:@imagemagick/magick-wasm@0.0.46";
import { createDrawingValidator } from "./drawing-validation.mjs";

export const validateRaster = createDrawingValidator(codec, () =>
  Deno.readFile(new URL(import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.46/magick.wasm"))));
