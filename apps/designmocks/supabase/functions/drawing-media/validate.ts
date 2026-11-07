import * as codec from "npm:@imagemagick/magick-wasm@0.0.46";
import { createDrawingValidator } from "../_shared/drawing-validation.mjs";

export const validateDrawing = createDrawingValidator(codec, () =>
  Deno.readFile(new URL(import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.46/magick.wasm"))));
