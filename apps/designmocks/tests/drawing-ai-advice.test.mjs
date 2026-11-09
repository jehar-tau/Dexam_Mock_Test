import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { drawingAdviceTarget, processDrawingAdvice } from "../scripts/drawing-ai-advice.mjs";
import { prepareAdvisoryImage } from "../scripts/drawing-ai-image.mjs";
import { prepareDrawingImage } from "../supabase/functions/_shared/drawing-image.mjs";

const reviewId = "10000000-0000-4000-8000-000000000001";
const suggestionId = "20000000-0000-4000-8000-000000000001";
const contextSha256 = "a".repeat(64);
const figureSha256 = "b".repeat(64);
const modelIdentity = "fixture-vision:3b@" + "c".repeat(64);
const page = { ordinal: 3, storagePath: "drawings/fictional.webp", mimeType: "image/webp",
  byteSize: 3, width: 1, height: 2, orientation: 6 };
const figure = { ordinal: 1, storagePath: `papers/canonical/${figureSha256}.png`, mimeType: "image/png",
  byteSize: 3, width: 2, height: 1, sha256: figureSha256 };
const job = {
  status: "ready", reviewId, contextSha256, rubricVersion: "nid-authored-practice-v1",
  prompt: "Original fictional drawing instruction.", maxScore: 10,
  rubric: [{ label: "Clarity", points: 10, guidance: "Check whether the central idea is legible." }],
  pages: [page], figures: [figure],
};

function setup(jobs = [job, job]) {
  const calls = [];
  const backend = {
    async rpc(name, args) {
      calls.push([name, args]);
      if (name === "service_drawing_ai_job") return jobs.shift();
      return suggestionId;
    },
    async download(file) {
      calls.push(["download", file.role, file.ordinal]);
      return Uint8Array.of(1, 2, 3);
    },
  };
  const model = {
    identity: modelIdentity,
    async verify() { calls.push(["verify"]); },
    async suggest({ beforeDispatch, ...input }) {
      await beforeDispatch();
      calls.push(["suggest", input]);
      return { criterionMarks: { Clarity: 6.25 }, comments: "The main shape is clear.",
        confidence: 0.6, evidence: [{ role: "drawing", ordinal: 3, observation: "A visible line frames the main shape." }] };
    },
  };
  return { calls, backend, model, reviewId, prepareImage: async bytes => bytes };
}

test("private worker configuration is opt-in and bound to a reviewed staging origin", () => {
  const env = {
    DMOCKS_DRAWING_AI_ENABLED: "true", DMOCKS_DRAWING_AI_ISOLATED_MODEL: "true",
    DMOCKS_DRAWING_AI_ENVIRONMENT: "staging", DMOCKS_SUPABASE_URL: "http://127.0.0.1:52120",
    DMOCKS_DRAWING_AI_ALLOW_ORIGIN: "http://127.0.0.1:52120", DMOCKS_SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fixture",
  };
  const fetcher = () => assert.fail("Configuration must not access the network");
  assert.throws(() => drawingAdviceTarget({ ...env, DMOCKS_DRAWING_AI_ENABLED: "false" }, fetcher), /Enable/);
  assert.throws(() => drawingAdviceTarget({ ...env, DMOCKS_DRAWING_AI_ENVIRONMENT: "production" }, fetcher), /staging/);
  assert.throws(() => drawingAdviceTarget(env, fetcher), /acknowledgement/);
  assert.throws(() => drawingAdviceTarget({ ...env, DMOCKS_DRAWING_AI_ALLOW_ORIGIN: "http://127.0.0.1:51201" }, fetcher), /exactly match/);
  const target = drawingAdviceTarget({ ...env, DMOCKS_DRAWING_AI_STAGING_ACK: "APPROVED_DRAWING_AI_ON_http://127.0.0.1:52120" }, fetcher);
  assert.equal(typeof target.download, "function");
});

test("private image reads use the fixed buckets, approved origin and bounded bodies", async () => {
  const calls = [];
  const target = drawingAdviceTarget({
    DMOCKS_DRAWING_AI_ENABLED: "true", DMOCKS_DRAWING_AI_ISOLATED_MODEL: "true",
    DMOCKS_DRAWING_AI_ENVIRONMENT: "development", DMOCKS_SUPABASE_URL: "http://127.0.0.1:52120",
    DMOCKS_DRAWING_AI_ALLOW_ORIGIN: "http://127.0.0.1:52120", DMOCKS_SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fixture",
  }, async (url, init) => {
    calls.push(url);
    assert.equal(init.redirect, "error");
    assert.equal(init.headers.get("apikey"), "sb_secret_fixture");
    assert.equal(init.headers.has("authorization"), false);
    return new Response(Uint8Array.of(1, 2, 3));
  });
  assert.deepEqual(await target.download({ ...page, role: "drawing" }), Uint8Array.of(1, 2, 3));
  assert.deepEqual(await target.download({ ...figure, role: "figure" }), Uint8Array.of(1, 2, 3));
  assert.deepEqual(calls, [
    "http://127.0.0.1:52120/storage/v1/object/drawing-submissions/drawings/fictional.webp",
    `http://127.0.0.1:52120/storage/v1/object/paper-media/papers/canonical/${figureSha256}.png`,
  ]);
  await assert.rejects(target.download({ ...page, role: "drawing", byteSize: 2 }), /could not be read/);
});

test("the preview and a previously saved review need only the current job read", async () => {
  const preview = setup();
  assert.deepEqual(await processDrawingAdvice(preview), { status: "preview", reviewId, rubricVersion: "nid-authored-practice-v1", pageCount: 1, figureCount: 1 });
  assert.deepEqual(preview.calls.map(([name]) => name), ["service_drawing_ai_job"]);
  const prior = setup([{ status: "existing", reviewId, suggestionId }]);
  assert.deepEqual(await processDrawingAdvice({ ...prior, apply: true }), { status: "existing", reviewId, suggestionId });
  assert.deepEqual(prior.calls.map(([name]) => name), ["service_drawing_ai_job"]);
});

test("one private job sends all ordered images and saves only the advisory fields", async () => {
  const fixture = setup();
  assert.deepEqual(await processDrawingAdvice({ ...fixture, apply: true }), { status: "recorded", reviewId, suggestionId, pageCount: 1, figureCount: 1 });
  assert.deepEqual(fixture.calls.map(([name]) => name),
    ["service_drawing_ai_job", "verify", "download", "download", "service_drawing_ai_job", "suggest", "service_save_drawing_ai_advice"]);
  const [, input] = fixture.calls.find(([name]) => name === "suggest");
  assert.deepEqual(Object.keys(input).sort(), ["images", "prompt", "rubric"]);
  assert.deepEqual(input.images.map(image => [image.role, image.ordinal]), [["figure", 1], ["drawing", 3]]);
  assert.ok(input.images.every(image => !Object.hasOwn(image, "storagePath")));
  assert.deepEqual(fixture.calls.at(-1)[1], {
    p_review_id: reviewId, p_model_identity: modelIdentity, p_context_sha256: contextSha256,
    p_criterion_marks: { Clarity: 6.25 }, p_comments: "The main shape is clear.", p_confidence: 0.6,
    p_evidence: ["Drawing page 3. A visible line frames the main shape."],
  });
});

test("changed jobs and unverified assets fail before private images reach the model", async () => {
  const changed = setup([job, { ...job, contextSha256: "f".repeat(64) }]);
  await assert.rejects(processDrawingAdvice({ ...changed, apply: true }), /review changed/);
  assert.equal(changed.calls.some(([name]) => ["suggest", "service_save_drawing_ai_advice"].includes(name)), false);
  const badPath = setup([{ ...job, pages: [{ ...page, storagePath: "../fixture.webp" }] }]);
  await assert.rejects(processDrawingAdvice({ ...badPath, apply: true }), /registered rendering/);
  assert.deepEqual(badPath.calls.map(([name]) => name), ["service_drawing_ai_job"]);
});

test("rotated photos are decoded upright and canonical figure bytes are hash-checked", async () => {
  const bytes = await readFile(new URL("../public/assets/drawing-orientation/probe.jpg", import.meta.url));
  const source = await prepareDrawingImage(bytes, "image/jpeg");
  assert.deepEqual([source.width, source.height, source.orientation], [1, 2, 6]);
  const original = { ...source, mimeType: source.mime, byteSize: bytes.length };
  const normalized = await prepareDrawingImage(await prepareAdvisoryImage(bytes, original), "image/png");
  assert.deepEqual([normalized.width, normalized.height, normalized.orientation], [2, 1, 1]);
  await assert.rejects(prepareAdvisoryImage(bytes, { ...original, sha256: figureSha256 }), /registered bytes/);
  await assert.rejects(prepareAdvisoryImage(bytes, { ...original, orientation: 1 }), /rendering metadata/);
});
