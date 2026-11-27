import test from "node:test";
import assert from "node:assert/strict";
import { yearDrawingPhoto } from "../src/year-drawing-photo.mjs";

test("empty and oversized drawing selections are rejected before opening a decoder", async () => {
  await assert.rejects(yearDrawingPhoto(new File([], "empty.heic")), /up to 12 MB/);
  await assert.rejects(yearDrawingPhoto({ size: 12 * 1024 * 1024 + 1 }), /up to 12 MB/);
});

test("an unreadable file renamed to HEIC never starts the fallback worker", async () => {
  const originalImage = globalThis.Image;
  globalThis.Image = class { async decode() { throw new Error("Unrecognized pixels"); } };
  try {
    const pretend = new File(["this is text"], "photo.heic", { type: "image/heic" });
    await assert.rejects(yearDrawingPhoto(pretend), /couldn’t be read/);
  } finally {
    if (originalImage) globalThis.Image = originalImage;
    else delete globalThis.Image;
  }
});
