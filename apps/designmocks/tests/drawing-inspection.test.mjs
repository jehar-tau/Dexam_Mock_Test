import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDrawingOrientationProbe, drawingInspectionLayout, drawingRenderMetadata } from "../src/drawing-inspection.js";
import { drawingOrientationProbes } from "../src/drawing-orientation-probes.js";
import { prepareDrawingImage } from "../supabase/functions/_shared/drawing-image.mjs";
import { sameDrawingPages, signedDrawingPages } from "../supabase/functions/_shared/drawing-links.mjs";

const layout = extra => drawingInspectionLayout({ width: 6, height: 4, viewportWidth: 120, viewportHeight: 80, ...extra });
const corners = (matrix, width = 6, height = 4) => {
  const points = [[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => [matrix[0] * x + matrix[2] * y, matrix[1] * x + matrix[3] * y]);
  const minX = Math.min(...points.map(point => point[0])), minY = Math.min(...points.map(point => point[1]));
  return points.map(([x, y]) => [x - minX, y - minY]);
};

test("all EXIF orientations map drawing corners correctly without a native double rotation", () => {
  const expected = [null, [[0, 0], [6, 0], [0, 4], [6, 4]], [[6, 0], [0, 0], [6, 4], [0, 4]],
    [[6, 4], [0, 4], [6, 0], [0, 0]], [[0, 4], [6, 4], [0, 0], [6, 0]],
    [[0, 0], [0, 6], [4, 0], [4, 6]], [[4, 0], [4, 6], [0, 0], [0, 6]],
    [[4, 6], [4, 0], [0, 6], [0, 0]], [[0, 6], [0, 0], [4, 6], [4, 0]]];
  for (let orientation = 1; orientation <= 8; orientation++) {
    const result = layout({ orientation, nativeOriented: false });
    assert.deepEqual(corners(result.matrix), expected[orientation]);
    assert.deepEqual(corners(layout({ orientation, nativeOriented: true }).matrix), expected[1]);
    assert.deepEqual(corners(layout({ orientation, nativeOriented: null }).matrix), expected[1]);
    assert.ok(result.frameWidth <= 120 && result.frameHeight <= 80);
  }
});

test("view rotation, mirroring, fit and bounded zoom change geometry without modifying a drawing", () => {
  const base = { orientation: 6, nativeOriented: false };
  assert.deepEqual(corners(layout({ ...base, turns: 1 }).matrix), [[6, 4], [0, 4], [6, 0], [0, 0]]);
  assert.deepEqual(corners(layout({ ...base, mirrored: true }).matrix), [[0, 0], [0, 6], [4, 0], [4, 6]]);
  assert.deepEqual(layout({ ...base, turns: 4 }), layout(base));
  assert.deepEqual(layout({ ...base, turns: -1 }), layout({ ...base, turns: 3 }));
  assert.equal(layout({ zoom: 100 }).frameWidth, layout({ zoom: 4 }).frameWidth);
  assert.equal(layout({ zoom: -1 }).frameWidth, layout({ zoom: 1 }).frameWidth);
  assert.equal(layout({ zoom: NaN }).frameWidth, layout({ zoom: 1 }).frameWidth);
  for (const invalid of [{ width: 0 }, { height: -1 }, { viewportWidth: Infinity }, { viewportHeight: 0 }]) assert.equal(layout(invalid), null);
  const large = layout({ width: 6000, height: 4000, viewportWidth: 1000, viewportHeight: 800, zoom: 100 });
  assert.equal(large.scale, 1);assert.equal(large.maxZoom, 6);assert.equal(large.imageWidth, 6000);assert.equal(large.imageHeight, 4000);
  const small=layout({zoom:layout({}).nativeZoom});assert.equal(small.scale,1);assert.equal(small.imageWidth,6);assert.equal(small.imageHeight,4);
});

test("only complete bounded raster metadata enables automatic orientation", () => {
  const good = { width: 6000, height: 4000, orientation: 8, mimeType: "image/webp" };
  assert.equal(drawingRenderMetadata(good), true);
  for (const change of [{ width: null }, { width: 6001 }, { width: 12001, height: 1 }, { orientation: 0 }, { orientation: 9 }, { mimeType: "image/svg+xml" }]) {
    assert.equal(drawingRenderMetadata({ ...good, ...change }), false);
  }
  assert.equal(drawingRenderMetadata({ width: null, height: null, orientation: null }), false);
});

test("tiny capability probes contain only an original raster and its orientation", async () => {
  for (const [mime, url] of Object.entries(drawingOrientationProbes)) {
    assert.ok(url.startsWith("/assets/drawing-orientation/"));
    const bytes = await readFile(new URL("../public" + url, import.meta.url)), result = await prepareDrawingImage(bytes, mime);
    assert.deepEqual([result.width, result.height, result.orientation], [1, 2, 6]);
    assert.deepEqual(Buffer.from(result.bytes), bytes);
    assert.equal(bytes.includes("Fictional"), false);
  }
});

function imageFactory(outcome, count = { value: 0 }) {
  return () => {
    count.value++;
    const image = { naturalWidth: outcome === true ? 2 : 1, naturalHeight: outcome === true ? 1 : 2 };
    Object.defineProperty(image, "src", { set() { queueMicrotask(() => outcome === "error" ? image.onerror?.() : image.onload?.()); } });
    return image;
  };
}

test("native orientation is detected per format and cached without browser-name guesses", async () => {
  const count = { value: 0 }, probe = createDrawingOrientationProbe(imageFactory(true, count));
  const one = probe("image/png"); assert.equal(probe("image/png"), one); assert.equal(await one, true); assert.equal(count.value, 1);
  assert.equal(await probe("image/jpeg"), true); assert.equal(count.value, 2);
  assert.equal(await createDrawingOrientationProbe(imageFactory(false))("image/webp"), false);
  assert.equal(await probe("image/svg+xml"), null); assert.equal(count.value, 2);
});

test("blocked, unavailable or stalled probes leave manual view controls available", async () => {
  assert.equal(await createDrawingOrientationProbe(imageFactory("error"))("image/webp"), null);
  assert.equal(await createDrawingOrientationProbe(() => { throw new Error("Blocked"); })("image/png"), null);
  assert.equal(await createDrawingOrientationProbe(() => ({}), 5)("image/jpeg"), null);
});

test("signed page responses expose bounded rendering properties and expire in five minutes", async () => {
  const calls = [], source = [{ id: "one", ordinal: 1, storagePath: "drawings/private.png", mimeType: "image/png", width: 6, height: 4, orientation: 6,
    studentId: "private-student", score: 20 }];
  const bucket = { createSignedUrls: async (paths, seconds) => { calls.push([paths, seconds]); return { data: paths.map(path => ({ path, signedUrl: "https://private.invalid/" + path })) }; } };
  const result = await signedDrawingPages(bucket, source, Date.parse("2026-11-07T10:00:00Z"));
  assert.equal(result.expiresAt, "2026-11-07T10:05:00.000Z");
  assert.equal(result.serverNow, "2026-11-07T10:00:00.000Z");
  assert.deepEqual(calls, [[["drawings/private.png"], 300]]);
  assert.deepEqual(Object.keys(result.images[0]).sort(), ["height", "id", "mimeType", "ordinal", "orientation", "url", "width"]);
  assert.equal(JSON.stringify(result).includes("private-student"), false);
  assert.deepEqual((await signedDrawingPages(bucket, [{ id: "old", ordinal: 2, storagePath: "drawings/old.webp" }])).images[0].orientation, null);
  const before = calls.length; assert.deepEqual((await signedDrawingPages(bucket, [])).images, []); assert.equal(calls.length, before);
});

test("a missing signed page never produces a partial private gallery", async () => {
  const source = [{ id: "one", storagePath: "drawings/one.png" }, { id: "two", storagePath: "drawings/two.png" }];
  await assert.rejects(signedDrawingPages({ createSignedUrls: async () => ({ data: [{ path: source[0].storagePath, signedUrl: "https://private.invalid/one" }, { error: "missing" }] }) }, source), /could not be opened/);
  await assert.rejects(signedDrawingPages({ createSignedUrls: async () => ({ error: true }) }, source), /could not be opened/);
  await assert.rejects(signedDrawingPages({}, Array(6).fill(source[0])), /unavailable/);
});

test("a post-sign authorization check detects replaced, removed or changed page receipts", () => {
  const source=[{id:"one",ordinal:1,storagePath:"drawings/one.png",mimeType:"image/png",width:6,height:4,orientation:6}];
  assert.equal(sameDrawingPages(source,JSON.parse(JSON.stringify(source))),true);
  for(const change of [{id:"different"},{ordinal:2},{storagePath:"drawings/changed.png"},{orientation:8},{width:4},{mimeType:"image/webp"}]){
    assert.equal(sameDrawingPages(source,[{...source[0],...change}]),false);
  }
  assert.equal(sameDrawingPages(source,[]),false);assert.equal(sameDrawingPages(source,null),false);
});
