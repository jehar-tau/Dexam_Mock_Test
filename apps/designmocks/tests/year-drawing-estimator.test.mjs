import assert from "node:assert/strict";
import test from "node:test";
import {estimateYearDrawing, yearDrawingCalibration, yearDrawingModels, yearDrawingProtocol} from "../scripts/year-drawing-estimator.mjs";
import {runYearDrawingJob} from "../scripts/year-drawing-worker.mjs";
import {prepareAdvisoryImage} from "../scripts/drawing-ai-image.mjs";
import {readFile} from "node:fs/promises";
import {initializeImageMagick, ImageMagick, MagickFormat, MagickColors} from "@imagemagick/magick-wasm";
const gate = "qwen2.5vl:3b@" + "a".repeat(64), score = "qwen2.5vl:7b@" + "b".repeat(64);
const criteria = [{id: "detail", label: "Detail", max: 5}, {id: "line", label: "Line", max: 3}];
const job = {prompt: "Fictional drawing prompt", drawing: {criteria, instructions: ["Use pencil"], maxImages: 3}, maxScore: 8};
const images = [{role: "drawing", ordinal: 1, bytes: Buffer.from([1])}];
const response = {criteria: [{id: "line", max: 3, score: 4, reason: "Visible lines."},
  {id: "detail", max: 5, score: 2.24, reason: "Some detail."}], flags: [], summary: "A drawing."};
function mockModel(outputs, identity = gate) {
  return {identity, calls: [], async structured(args) {
    this.calls.push(args);
    await args.beforeDispatch?.();
    const next = outputs.shift();
    if (next instanceof Error) throw next;
    return typeof next === "string" ? next : JSON.stringify(next);
  }};
}

test("pinned worker accepts only a loopback transport and explicit digests; the 7B model is optional", () => {
  assert.throws(() => yearDrawingModels({DMOCKS_DRAWING_AI_OLLAMA_URL: "https://example.org", DMOCKS_DRAWING_GATEKEEPER_SHA256: "a".repeat(64)}), /loopback/);
  assert.equal(yearDrawingModels({DMOCKS_DRAWING_AI_OLLAMA_URL: "http://127.0.0.1:11434", DMOCKS_DRAWING_GATEKEEPER_SHA256: "a".repeat(64)}).scorer, null);
});
test("requires a new matching private calibration for each model version; enforces both accuracy and repeatability", () => {
  const evidence = {protocol: yearDrawingProtocol, gatekeeper: gate, scorer: score, cases: Array.from({length: 30}, (_, i) =>
    ({inputSha256: i.toString(16).padStart(64, "0"), max: 20, teacher: 10, first: i < 24 ? 10.5 : 13, second: i < 24 ? 11.5 : 13}))};
  assert.match(yearDrawingCalibration(evidence, gate, score), /^[a-f0-9]{64}$/);
  assert.throws(() => yearDrawingCalibration(evidence, gate, "different"), /model pair/);
  assert.throws(() => yearDrawingCalibration({...evidence, cases: evidence.cases.slice(1)}, gate, score), /30–50/);
  assert.throws(() => yearDrawingCalibration({...evidence, cases: [...evidence.cases.slice(1), evidence.cases[1]]}, gate, score), /duplicate/);
  evidence.cases[0].first = 8;
  assert.equal(yearDrawingCalibration(evidence, gate, score), null);
  evidence.cases[0].first = 10.5;
  evidence.cases[0].second = 12;
  assert.equal(yearDrawingCalibration(evidence, gate, score), null);
});
test("every photo goes through the gate; zero flags short-circuit the 7B scorer and uncalibrated marks stay hidden", async () => {
  for (const flag of ["blank", "not_a_drawing", "off_task"]) {
    for (const calibration of [null, "c".repeat(64)]) {
      const gatekeeper = mockModel([{flags: [flag]}]), scorer = mockModel([]);
      const result = await estimateYearDrawing({job, gatekeeper, scorer, calibration, images});
      assert.equal(gatekeeper.calls[0].images, images);
      assert.equal(scorer.calls.length, 0);
      assert.equal(result.status, calibration ? "ready" : "awaiting_teacher");
      assert.deepEqual(result.flags, [flag]);
      assert.equal(result.total, calibration ? 0 : undefined);
    }
  }
});
test("scorer receives frozen rubric and anchors, sorts by criterion, clamps half marks, and preserves informative flags", async () => {
  const gatekeeper = mockModel([{flags: ["illegible"]}]), scorer = mockModel([response]);
  const result = await estimateYearDrawing({job, gatekeeper, scorer, calibration: true, images});
  assert.deepEqual(result.criteria.map(row => [row.id, row.score]), [["detail", 2], ["line", 3]]);
  assert.equal(result.total, 5);
  assert.deepEqual(result.flags, ["illegible"]);
  assert.match(scorer.calls[0].system, /25% attempted but weak/);
  assert.deepEqual(JSON.parse(scorer.calls[0].content).drawing.criteria, criteria);
});
test("strict rubric identity, validation retry, scorer offline fallback, and malformed flags", async () => {
  const wrong = {...response, criteria: [response.criteria[0], response.criteria[0]]};
  let scorer = mockModel([wrong, response]);
  const params = {job, images, calibration: true, gatekeeper: mockModel([{flags: []}]), scorer};
  assert.equal((await estimateYearDrawing(params)).total, 5);
  assert.equal(scorer.calls.length, 2);
  scorer = mockModel([wrong, wrong]);
  assert.deepEqual(await estimateYearDrawing({...params, gatekeeper: mockModel([{flags: []}]), scorer}), {status: "unavailable", flags: []});
  assert.deepEqual(await estimateYearDrawing({...params, gatekeeper: mockModel([{flags: ["illegible"]}]), scorer: mockModel([new Error("hardware offline")])}),
    {status: "awaiting_teacher", flags: ["illegible"]});
  await assert.rejects(estimateYearDrawing({...params, gatekeeper: mockModel([{flags: ["unknown"]}, "{"])}), /after two attempts/);
});

test("normalizes the actual input image to 1280 pixels before local inference", async () => {
  await initializeImageMagick(await readFile(new URL(import.meta.resolve("@imagemagick/magick-wasm/magick.wasm"))));
  const bytes = ImageMagick.read(MagickColors.White, 1920, 960, image => image.write(MagickFormat.Png, data => Uint8Array.from(data)));
  const normalized = await prepareAdvisoryImage(bytes, {role: "drawing", mimeType: "image/png", width: 1920, height: 960, byteSize: bytes.length, orientation: 1}, 1280);
  assert.deepEqual(ImageMagick.read(normalized, image => [image.width, image.height]), [1280, 640]);
});

test("worker checks storage bytes and rechecks frozen input before inference; changed evidence does not produce a score", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const gatekeeper = mockModel([{flags: []}]), scorer = mockModel([response], score);
  let reads = 0, saved;
  const backend = {async rpc(name, args) {
    if (name === "service_claim_year_drawing") return id;
    if (name === "service_year_drawing_context") return {...job, attemptId: id, contextSha256: (++reads === 1 ? "a" : "b").repeat(64),
      figures: [], pages: [{ordinal: 1, mimeType: "image/jpeg", width: 200, height: 100, orientation: 1, byteSize: 2, storagePath: `attempts/${id}/fictional-b1/1.jpg`}]};
    saved = args.p_result;
    return true;
  }, async download() { return Buffer.from([1, 2]); }};
  const state = await runYearDrawingJob({backend, scorer, gatekeeper, calibration: "c".repeat(64), prepareImage: async (b, _f, longEdge) => {
    assert.equal(longEdge, 1280); return b;
  }});
  assert.equal(state, "unavailable");
  assert.deepEqual(saved, {status: "unavailable", flags: []});
  assert.equal(scorer.calls.length, 0);
});

test("offline calibration exercises both exact local-model stages twice per case and creates a private evidence file", async () => {
  const {mkdtemp, writeFile, stat, rm} = await import("node:fs/promises");
  const {tmpdir} = await import("node:os");
  const {join} = await import("node:path");
  const {saveYearDrawingCalibration} = await import("../scripts/year-drawing-calibration.mjs");
  const directory = await mkdtemp(join(tmpdir(), "dmocks-synthetic-calibration-"));
  try {
    const cases = [];
    for (let i = 0; i < 30; i++) {
      const width = 30 + i;
      const name = `synthetic-${i}.png`;
      const bytes = ImageMagick.read(MagickColors.White, width, 30, img => img.write(MagickFormat.Png, data => Uint8Array.from(data)));
      await writeFile(join(directory, name), bytes);
      cases.push({job, teacher: 5, files: [{path: name, role: "drawing", mimeType: "image/png", width, height: 30, ordinal: 1, orientation: 1}]});
    }
    const plan = join(directory, "input.json"), output = join(directory, "output.json");
    await writeFile(plan, JSON.stringify({cases}));
    const gatekeeper = mockModel(Array(60).fill({flags: []})), scorer = mockModel(Array(60).fill(response), score);
    assert.deepEqual(await saveYearDrawingCalibration(plan, output, {gatekeeper, scorer}), {cases: 30, passed: true});
    assert.equal(gatekeeper.calls.length, 60);
    assert.equal(scorer.calls.length, 60);
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    const evidence = JSON.parse(await readFile(output, "utf8"));
    assert.equal(evidence.cases.length, 30);
    assert.deepEqual(Object.keys(evidence.cases[0]).sort(), ["first", "inputSha256", "max", "second", "teacher"]);
  } finally { await rm(directory, {recursive: true, force: true}); }
});
