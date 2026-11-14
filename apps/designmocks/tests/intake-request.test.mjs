import assert from "node:assert/strict";
import test from "node:test";
import {readIntakeJson, readIntakeUpload} from "../supabase/functions/_shared/intake-request.mjs";
import {INTAKE_FIGURE_MAX_BYTES} from "../supabase/functions/_shared/intake-limits.mjs";

const id = "00000000-0000-4000-8000-000000000001";
const path = "https://fictional.example/intake";
const pdf = new File(["%PDF-1.7\nfictional"], "paper.pdf", {type: "application/pdf"});
const png = new File(["fixture"], "figure.png", {type: "image/png"});
const post = (body, headers) => new Request(path, {method: "POST", body, headers});
const withStatus = status => error => error.status === status;

test("intake reads the existing PDF and figure form shapes", async () => {
  const form = new FormData();
  form.set("file", pdf);
  const source = await readIntakeUpload(post(form));
  assert.equal(source.file.name, pdf.name);
  assert.equal(source.assetId, null);
  form.set("file", png);
  form.set("purpose", "figure");
  form.set("assetId", id);
  assert.equal((await readIntakeUpload(post(form))).assetId, id);
  assert.deepEqual(await readIntakeJson(post(JSON.stringify({assetId: id}), {"content-type": "application/json"})), {assetId: id});
});

test("intake rejects duplicate files and malformed upload envelopes", async () => {
  const form = new FormData();
  form.append("file", pdf);
  form.append("file", pdf);
  await assert.rejects(readIntakeUpload(post(form)), withStatus(400));
  await assert.rejects(readIntakeUpload(post("not multipart")), withStatus(415));
  await assert.rejects(readIntakeUpload(post("bad form", {"content-type": "multipart/form-data; boundary=x"})), withStatus(400));
  form.set("file", png);
  form.set("purpose", "figure");
  form.set("assetId", "../wrong");
  await assert.rejects(readIntakeUpload(post(form)), withStatus(400));
});

test("intake bounds streamed and declared request sizes before parsing", async () => {
  const stream = new ReadableStream({start(controller) { controller.enqueue(new Uint8Array(4097)); controller.close(); }});
  const request = new Request(path, {method: "POST", body: stream, duplex: "half", headers: {"content-type": "application/json", "content-length": "1"}});
  await assert.rejects(readIntakeJson(request), withStatus(413));
  await assert.rejects(readIntakeUpload(post("small", {"content-type": "multipart/form-data; boundary=x", "content-length": "30000000"})), withStatus(413));
  await assert.rejects(readIntakeJson(post("null", {"content-type": "application/json"})), withStatus(400));
  await assert.rejects(readIntakeJson(post("{}", {"content-type": "text/plain"})), withStatus(415));
});

test("the multipart figure limit matches the admin editor while larger source files remain valid", async () => {
  const bytes = new Uint8Array(INTAKE_FIGURE_MAX_BYTES + 1);
  const figure = new FormData();
  figure.set("file", new File([bytes], "figure.png", {type: "image/png"}));
  figure.set("purpose", "figure");
  figure.set("assetId", id);
  await assert.rejects(readIntakeUpload(post(figure)), withStatus(413));
  figure.set("file", new File([bytes.subarray(1)], "figure.png", {type: "image/png"}));
  assert.equal((await readIntakeUpload(post(figure))).file.size, INTAKE_FIGURE_MAX_BYTES);

  const source = new FormData();
  source.set("file", new File([bytes], "source.pdf", {type: "application/pdf"}));
  assert.equal((await readIntakeUpload(post(source))).file.size, bytes.length);
});
