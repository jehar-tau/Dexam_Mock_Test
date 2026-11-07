import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deflateSync, inflateSync } from "node:zlib";
import * as codec from "@imagemagick/magick-wasm";
import { prepareDrawingImage, DRAWING_MAX_BYTES } from "../supabase/functions/_shared/drawing-image.mjs";
import { createDrawingValidator } from "../supabase/functions/_shared/drawing-validation.mjs";
import { drawingRequestBody } from "../supabase/functions/_shared/drawing-request.mjs";
import { checkDrawingFiles, drawingMediaError, drawingUploadFailure } from "../src/drawing-upload.js";

const fixture = (name) => readFile(new URL(`./fixtures/drawing-images/${name}`, import.meta.url));
const wasm = () => readFile(new URL(import.meta.resolve("@imagemagick/magick-wasm/magick.wasm")));
const validate = createDrawingValidator(codec, wasm);
const formats = [["png", "image/png"], ["jpg", "image/jpeg"], ["webp", "image/webp"]];
const marker = "DMOCKS_FICTIONAL_PRIVATE_METADATA_2026";
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
  return value >>> 0;
});
function pngChunk(type, payload) {
  const out = Buffer.alloc(payload.length + 12); out.writeUInt32BE(payload.length); out.write(type, 4); out.set(payload, 8);
  let crc = 0xffffffff;
  for (const byte of out.subarray(4, -4)) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, out.length - 4); return out;
}
function pngParts(bytes) {
  const parts = [];
  for (let at = 8; at < bytes.length;) {
    const size = bytes.readUInt32BE(at); parts.push({ type: bytes.toString("ascii", at + 4, at + 8), data: bytes.subarray(at + 8, at + 8 + size) }); at += size + 12;
  }
  return parts;
}
const makePng = (parts) => Buffer.concat([pngSignature, ...parts.map(({ type, data }) => pngChunk(type, data))]);
function webpParts(bytes) {
  const parts = [];
  for (let at = 12; at < bytes.length;) {
    const size = bytes.readUInt32LE(at + 4); parts.push({ type: bytes.toString("ascii", at, at + 4), data: bytes.subarray(at + 8, at + 8 + size) }); at += 8 + size + size % 2;
  }
  return parts;
}
function makeWebp(parts) {
  const out = Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBP"), ...parts.map(({ type, data }) => {
    const chunk = Buffer.alloc(8 + data.length + data.length % 2); chunk.write(type); chunk.writeUInt32LE(data.length, 4); chunk.set(data, 8); return chunk;
  })]); out.writeUInt32LE(out.length - 8, 4); return out;
}
function jpegSegment(marker, data) {
  const out = Buffer.alloc(data.length + 4); out.set([255, marker]); out.writeUInt16BE(data.length + 2, 2); out.set(data, 4); return out;
}
function replaceJpegExif(bytes, exif) {
  const start = bytes.indexOf(Buffer.from("Exif\0\0")) - 4;
  assert.ok(start > 1); const end = start + 2 + bytes.readUInt16BE(start + 2);
  return Buffer.concat([bytes.subarray(0, start), jpegSegment(0xe1, Buffer.concat([Buffer.from("Exif\0\0"), exif])), bytes.subarray(end)]);
}
function exifOrientation(value, little = false) {
  const bytes = Buffer.alloc(26); bytes.write(little ? "II" : "MM");
  const short = (n, at) => little ? bytes.writeUInt16LE(n, at) : bytes.writeUInt16BE(n, at);
  const long = (n, at) => little ? bytes.writeUInt32LE(n, at) : bytes.writeUInt32BE(n, at);
  short(42, 2); long(8, 4); short(1, 8); short(274, 10); short(3, 12); long(1, 14); short(value, 18); return bytes;
}
function displayed(bytes) {
  return codec.ImageMagick.read(bytes, (image) => {
    image.autoOrient(); return { width: image.width, height: image.height, signature: image.signature, colorSpace: image.colorSpace };
  });
}

test("drawing validation strips personal metadata without re-encoding compressed drawing pixels", async () => {
  for (const [ext, mime] of formats) {
    const input = await fixture(`fictional-drawing.${ext}`), result = await validate(input, mime);
    assert.ok(input.includes(marker)); assert.equal(Buffer.from(result.bytes).includes(marker), false);
    assert.equal(Buffer.from(result.bytes).includes("Fictional fixture author"), false);
    assert.deepEqual([result.width, result.height, result.orientation], [6, 4, 6]);
    assert.deepEqual(displayed(result.bytes), displayed(input));
    assert.deepEqual([displayed(result.bytes).width, displayed(result.bytes).height], [4, 6]);
    assert.ok(result.bytes.length < input.length);
    if (ext === "png") assert.deepEqual(pngParts(Buffer.from(result.bytes)).map(part => part.type), ["IHDR", "eXIf", "IDAT", "IEND"]);
    if (ext === "webp") assert.deepEqual(webpParts(Buffer.from(result.bytes)).map(part => part.type), ["VP8X", "VP8L", "EXIF"]);
  }
});

test("all eight EXIF orientations in both TIFF byte orders survive metadata filtering", async () => {
  for (const [ext, mime] of formats) {
    const base = Buffer.from((await validate(await fixture(`fictional-drawing.${ext}`), mime)).bytes);
    for (const little of [false, true]) for (let value = 1; value <= 8; value++) {
      const exif = exifOrientation(value, little);
      const input = ext === "png" ? makePng(pngParts(base).map(part => part.type === "eXIf" ? { type: "eXIf", data: exif } : part))
        : ext === "jpg" ? replaceJpegExif(base, exif)
        : makeWebp(webpParts(base).map(part => part.type === "EXIF" ? { type: "EXIF", data: exif } : part));
      const result = await validate(input, mime);
      assert.equal(result.orientation, value); assert.deepEqual(displayed(result.bytes), displayed(input), `${ext}/${value}/${little}`);
    }
  }
});

test("palette transparency, alpha, 16-bit pixels, progressive JPEG and lossy WebP are preserved", async () => {
  for (const [name, mime] of [["palette.png", "image/png"], ["alpha.png", "image/png"], ["sixteen-bit.png", "image/png"],
    ["alpha.webp", "image/webp"], ["lossy.webp", "image/webp"], ["progressive.jpg", "image/jpeg"], ["cmyk.jpg", "image/jpeg"]]) {
    const input = await fixture(name), result = await validate(input, mime);
    assert.deepEqual(displayed(result.bytes), displayed(input), name);
    if (name.endsWith("png")) {
      assert.deepEqual(pngParts(Buffer.from(result.bytes)).filter(part => part.type === "IDAT"), pngParts(input).filter(part => part.type === "IDAT"));
    }
  }
});

test("bounded rendering colour profiles survive; PNG profile filenames do not", async () => {
  for (const [ext, mime] of formats) {
    let input = await fixture(`profile.${ext}`);
    if (ext === "png") input = makePng(pngParts(input).map(part => part.type === "iCCP"
      ? { type: part.type, data: Buffer.concat([Buffer.from(marker + "\0\0"), part.data.subarray(part.data.indexOf(0) + 2)]) } : part));
    const result = await validate(input, mime);
    assert.deepEqual(displayed(result.bytes), displayed(input));
    assert.equal(Buffer.from(result.bytes).includes(marker), false);
    if (ext === "png") {
      const before = pngParts(input).find(part => part.type === "iCCP").data, after = pngParts(Buffer.from(result.bytes)).find(part => part.type === "iCCP").data;
      assert.equal(after.subarray(0, 6).toString(), "Color\0");
      assert.deepEqual(inflateSync(after.subarray(7)), inflateSync(before.subarray(before.indexOf(0) + 2)));
    }
  }
});

test("JPEG comments, XMP, application metadata and JFIF thumbnails are removed", async () => {
  const input = await fixture("fictional-drawing.jpg"), privateBytes = Buffer.from(marker);
  const jfif = Buffer.alloc(14 + 3 * 4 * 4); jfif.write("JFIF\0"); jfif.set([1, 1, 0, 0, 1, 0, 1, 4, 4], 5); jfif.set(privateBytes, 14);
  const extra = Buffer.concat([input.subarray(0, 2), jpegSegment(0xfe, privateBytes), jpegSegment(0xe1, privateBytes),
    jpegSegment(0xe2, privateBytes), jpegSegment(0xed, privateBytes), jpegSegment(0xe0, jfif), input.subarray(2)]);
  const result = await validate(extra, "image/jpeg");
  assert.equal(Buffer.from(result.bytes).includes(marker), false); assert.deepEqual(displayed(result.bytes), displayed(input));
});

test("multiple PNG text fields and unknown WebP tail chunks are stripped", async () => {
  const input = await fixture("fictional-drawing.png"), parts = pngParts(input);
  parts.splice(1, 0, { type: "tEXt", data: Buffer.from("Filename\0" + marker) }, { type: "tEXt", data: Buffer.from("Author\0" + marker) });
  const png = await validate(makePng(parts), "image/png"); assert.equal(Buffer.from(png.bytes).includes(marker), false);
  const webp = await validate(makeWebp([...webpParts(await fixture("fictional-drawing.webp")), { type: "MISC", data: Buffer.from(marker) }]), "image/webp");
  assert.equal(Buffer.from(webp.bytes).includes(marker), false);
});

test("signature-only, MIME-spoofed, truncated, animated, corrupt and trailing payloads never validate", async () => {
  for (const [ext, mime] of formats) {
    const input = await fixture(`fictional-drawing.${ext}`);
    for (const bad of [input.subarray(0, 12), input.subarray(0, -1), Buffer.concat([input, Buffer.from("<script>private payload</script>")])]) {
      await assert.rejects(validate(bad, mime), error => error.code === "invalid_image");
    }
    await assert.rejects(validate(input, "image/svg+xml"), error => error.code === "invalid_image");
  }
  for (const [name, mime] of [["animated.png", "image/png"], ["animated.webp", "image/webp"]]) {
    await assert.rejects(validate(await fixture(name), mime), error => error.code === "invalid_image");
  }
  const badCrc = await fixture("fictional-drawing.png"); badCrc[badCrc.length - 1] ^= 1;
  await assert.rejects(validate(badCrc, "image/png"), error => error.code === "invalid_image");
});

test("a complete container with an undecodable pixel stream fails the real decoder", async () => {
  const png = makePng(pngParts(await fixture("fictional-drawing.png")).map(part => part.type === "IDAT" ? { ...part, data: Buffer.from([1, 2, 3, 4]) } : part));
  const jpg = await fixture("fictional-drawing.jpg"), scan = jpg.indexOf(Buffer.from([255, 218]));
  const entropy = scan + 2 + jpg.readUInt16BE(scan + 2), jpeg = Buffer.concat([jpg.subarray(0, entropy + 1), Buffer.from([255, 217])]);
  const webp = makeWebp(webpParts(await fixture("fictional-drawing.webp")).map(part => part.type === "VP8L" ? { ...part, data: part.data.subarray(0, 5) } : part));
  for (const [input, mime] of [[png, "image/png"], [jpeg, "image/jpeg"], [webp, "image/webp"]]) {
    await prepareDrawingImage(input, mime); // Structural validation alone must not admit this file.
    await assert.rejects(validate(input, mime), error => error.code === "invalid_image");
  }
});

test("dimension, byte, chunk, EXIF offset and inflated-profile bombs fail before decoder startup", async () => {
  let starts = 0;
  const bounded = createDrawingValidator({}, () => { starts++; throw new Error("Must not load"); });
  const input = await fixture("fictional-drawing.png"), parts = pngParts(input);
  const huge = Buffer.from(parts[0].data); huge.writeUInt32BE(6001, 0); huge.writeUInt32BE(4000, 4);
  await assert.rejects(bounded(makePng(parts.map((part, index) => index === 0 ? { ...part, data: huge } : part)), "image/png"), error => error.code === "image_dimensions");
  const wide = Buffer.from(huge); wide.writeUInt32BE(12001, 0); wide.writeUInt32BE(1, 4);
  await assert.rejects(bounded(makePng(parts.map((part, index) => index === 0 ? { ...part, data: wide } : part)), "image/png"), error => error.code === "image_dimensions");
  await assert.rejects(bounded(new Uint8Array(DRAWING_MAX_BYTES + 1), "image/png"), error => error.code === "image_size");
  const badExif = exifOrientation(6); badExif.writeUInt32BE(0xfffffff0, 4);
  await assert.rejects(bounded(makePng(parts.map(part => part.type === "eXIf" ? { ...part, data: badExif } : part)), "image/png"), error => error.code === "invalid_image");
  const bomb = { type: "iCCP", data: Buffer.concat([Buffer.from("Color\0\0"), deflateSync(Buffer.alloc(300_000))]) };
  await assert.rejects(bounded(makePng([parts[0], bomb, ...parts.slice(1)]), "image/png"), error => error.code === "invalid_image");
  const repeats = Array.from({ length: 2050 }, () => ({ type: "tEXt", data: Buffer.from("key\0value") }));
  await assert.rejects(bounded(makePng([parts[0], ...repeats, ...parts.slice(1)]), "image/png"), error => error.code === "invalid_image");
  assert.equal(starts, 0);
});

test("the real decoder accepts the inclusive 24MP and 12,000-pixel boundaries", async () => {
  for (const [width, height] of [[6000, 4000], [12000, 1]]) {
    const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8;
    const input = makePng([{ type: "IHDR", data: header }, { type: "IDAT", data: deflateSync(Buffer.alloc((width + 1) * height)) }, { type: "IEND", data: Buffer.alloc(0) }]);
    const result = await validate(input, "image/png"); assert.equal(result.width, width); assert.equal(result.height, height);
  }
});

test("concurrent validation is retryable and a failed codec initialization can recover", async () => {
  const input = await fixture("fictional-drawing.png"); let release, loads = 0;
  const fake = { initializeImageMagick: async () => { throw new Error("Fictional missing binary"); } };
  const waiting = createDrawingValidator(fake, () => { loads++; return new Promise(resolve => { release = resolve; }); });
  const first = waiting(input, "image/png");
  while (!release) await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(waiting(input, "image/png"), error => error.status === 429);
  release(new Uint8Array()); await assert.rejects(first, error => error.code === "validation_unavailable");
  fake.initializeImageMagick = async () => { throw new Error("Fictional retry"); };
  const second = waiting(input, "image/png"); while (loads < 2) await new Promise(resolve => setImmediate(resolve));
  release(new Uint8Array()); await assert.rejects(second, error => error.status === 503);
});

test("drawing request limits work without Content-Length and cancel oversized streams", async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(6)); controller.enqueue(new Uint8Array(6)); }, cancel() { cancelled = true; } });
  await assert.rejects(drawingRequestBody(new Request("https://example.invalid", { method: "POST", body, duplex: "half" }), 10), error => error.code === "request_size");
  assert.equal(cancelled, true);
  const request = (content, length) => new Request("https://example.invalid", { method: "POST", body: content, ...(length ? { headers: { "content-length": length } } : {}) });
  assert.deepEqual(Buffer.from(await drawingRequestBody(request("12345"), 5)), Buffer.from("12345"));
  await assert.rejects(drawingRequestBody(request("short", "11"), 10), error => error.status === 413);
  await assert.rejects(drawingRequestBody(request("too many bytes", "1"), 10), error => error.status === 413);
});

test("student upload errors are actionable and never reflect decoder/provider text", async () => {
  assert.equal(checkDrawingFiles([{ type: "image/png", size: DRAWING_MAX_BYTES }]), null);
  assert.match(checkDrawingFiles([{ type: "image/png", size: DRAWING_MAX_BYTES + 1 }]), /10 MB/);
  assert.match(checkDrawingFiles([{ type: "image/svg+xml", size: 10 }]), /still PNG/);
  const error = await drawingMediaError({ context: new Response(JSON.stringify({ code: "image_dimensions", error: "private implementation path" })) });
  assert.match(drawingUploadFailure(error), /24 megapixels/); assert.equal(error.message.includes("private implementation"), false);
  for (const code of ["__proto__", "constructor", "unknown"]) {
    const unknown = { context: new Response(JSON.stringify({ code, error: "private error" })) };
    assert.equal(await drawingMediaError(unknown), unknown); assert.match(drawingUploadFailure(unknown), /did not confirm/);
  }
});
