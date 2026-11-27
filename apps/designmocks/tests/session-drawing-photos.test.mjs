import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { openSessionDrawingPhotos } from "../src/session-drawing-photos.js";
import { sessionDrawingResponse } from "../supabase/functions/_shared/session-drawing-pages.mjs";

const png = new Blob([await readFile(new URL("./fixtures/drawing-images/fictional-drawing.png", import.meta.url))]);
const jpeg = new Blob([await readFile(new URL("./fixtures/drawing-images/fictional-drawing.jpg", import.meta.url))]);
const scope = {attemptId: "fictional-attempt", questionId: "fictional-task"};
const page = {id: "saved-photo", ordinal: 1, storagePath: "fictional-attempt/1.png", orientation: 6, width: 6, height: 4};
const manifest = {
  delivery: "session", serverNow: "2026-11-27T12:00:00Z", expiresAt: "2026-11-27T12:05:00Z",
  images: [{id: page.id, ordinal: 1, mimeType: "image/png"}],
};
function server({rows = [page], current = rows, bytes = png, allowed = true} = {}) {
  let reads = 0;
  const downloads = [];
  const serve = pageId => sessionDrawingResponse({
    pagesForViewer: async () => ({data: reads++ === 0 ? rows : current}),
    bucket: {download: async path => {downloads.push(path); return {data: bytes};}},
    pageId, admitted: async () => allowed, headers: {"Content-Type": "application/json", "Cache-Control": "no-store"},
  });
  return {serve, downloads};
}

test("the photo manifest returns legacy raster metadata without a storage location or downloadable link", async () => {
  const handler = server();
  const response = await handler.serve();
  const data = await response.json();
  assert.equal(data.delivery, "session");
  assert.equal(Date.parse(data.expiresAt) - Date.parse(data.serverNow), 300000);
  assert.deepEqual(data.images, [{id: page.id, ordinal: 1, mimeType: "image/png", width: 6, height: 4, orientation: 6}]);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(handler.downloads, []);
});
test("a protected page request uses the authorized private path and returns the original raster bytes", async () => {
  const handler = server();
  const response = await handler.serve(page.id);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/octet-stream");
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  assert.equal(response.headers.get("location"), null);
  assert.deepEqual(await response.arrayBuffer(), await png.arrayBuffer());
  assert.deepEqual(handler.downloads, [page.storagePath]);
});
test("a missing or unauthorized page cannot start a Storage read", async () => {
  for (const rows of [[], null, [{...page, mimeType: "unsupported/type"}]]) {
    const handler = server({rows});
    assert.equal((await handler.serve(page.id)).status, 403);
    assert.deepEqual(handler.downloads, []);
  }
  const handler = server();
  assert.equal((await handler.serve("another-page")).status, 403);
  assert.deepEqual(handler.downloads, []);
});
test("a changed assignment, page set, or admission while reading discards the bytes", async () => {
  for (const settings of [{current: []}, {current: [{...page, storagePath:"fictional-replacement/1.png"}]}, {allowed:false}]) {
    const response = await server(settings).serve(page.id);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, "Drawing pages are unavailable for this account.");
  }
});
test("invalid, missing, or mismatched legacy raster bytes are withheld", async () => {
  for (const bytes of [null, new Blob([]), new Blob(["fictional non-raster"]), jpeg]) {
    assert.equal((await server({bytes}).serve(page.id)).status, 502);
  }
});
test("the browser uses authenticated POSTs and revokes its document URLs on account cleanup", async () => {
  const controller = new AbortController();
  const calls = [];
  const invoke = async (request, signal) => {
    assert.equal(signal, controller.signal);
    calls.push(request);
    return request.action === "pages" ? manifest : png;
  };
  const result = await openSessionDrawingPhotos(invoke, scope, controller.signal);
  assert.deepEqual(calls, [{...scope, action:"pages"}, {...scope, action:"page", id: page.id}]);
  const url = result.images[0].url;
  assert.match(url, /^blob:/);
  const local = await fetch(url);
  assert.equal(local.headers.get("content-type"), "image/png");
  assert.deepEqual(await local.arrayBuffer(), await png.arrayBuffer());
  controller.abort();
  await assert.rejects(fetch(url));
  result.dispose();
});
test("a late page failure releases every earlier document URL and never renders a partial gallery", async t => {
  const created = [];
  const actual = URL.createObjectURL.bind(URL);
  t.mock.method(URL, "createObjectURL", blob => {const url = actual(blob); created.push(url); return url;});
  const controller = new AbortController();
  const invoke = async request => {
    if (request.action === "pages") return {...manifest, images:[...manifest.images,{id:"page-two",ordinal:2,mimeType:"image/jpeg"}]};
    if (request.id === page.id) return png;
    throw new Error("Fictional assignment ended");
  };
  await assert.rejects(openSessionDrawingPhotos(invoke, scope, controller.signal));
  assert.equal(created.length, 1);
  await assert.rejects(fetch(created[0]));
});
test("legacy URL-only and malformed listings never schedule a photo read", async () => {
  for (const listing of [
    {images: [{id:page.id,ordinal:1,url:"https://example.invalid/fictional"}]},
    {...manifest,images:[null]}, {...manifest,images:[...manifest.images,...manifest.images]},
    {...manifest,expiresAt:manifest.serverNow},
  ]) {
    const calls=[];
    await assert.rejects(openSessionDrawingPhotos(async body=>{calls.push(body.action);return listing;},scope,new AbortController().signal));
    assert.deepEqual(calls,["pages"]);
  }
});
