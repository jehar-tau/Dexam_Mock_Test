import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { drawingRequestBody } from "../supabase/functions/_shared/drawing-request.mjs";
import { DRAWING_MAX_BYTES, DRAWING_MAX_DIMENSION, DRAWING_MAX_PIXELS } from "../supabase/functions/_shared/drawing-limits.mjs";
import { prepareAdvisoryImage } from "./drawing-ai-image.mjs";
import { openPrivateDMocksTransport } from "./private-bank-provider.mjs";

const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const digest = /^[a-f0-9]{64}$/;
const maxImageBytes = 100 * 1024 * 1024;
const mimes = new Set(["image/png", "image/jpeg", "image/webp"]);
const labelImage = role => role === "figure" ? "Prompt figure" : "Drawing page";

export function drawingAdviceTarget(env, fetchImpl = fetch) {
  const environment = env.DMOCKS_DRAWING_AI_ENVIRONMENT;
  if (env.DMOCKS_DRAWING_AI_ENABLED !== "true" || env.DMOCKS_DRAWING_AI_ISOLATED_MODEL !== "true" ||
      !["development", "staging"].includes(environment)) {
    throw new Error("Enable the private drawing worker and confirm an isolated model in development or staging");
  }
  const target = openPrivateDMocksTransport({
    url: env.DMOCKS_SUPABASE_URL, serviceRoleKey: env.DMOCKS_SUPABASE_SERVICE_ROLE_KEY,
    allowOrigin: env.DMOCKS_DRAWING_AI_ALLOW_ORIGIN, environment,
  }, { fetchImpl });
  if (environment === "staging" && env.DMOCKS_DRAWING_AI_STAGING_ACK !== `APPROVED_DRAWING_AI_ON_${target.origin}`) {
    throw new Error("Exact approved staging acknowledgement is required for drawing advice");
  }
  return {
    rpc: target.rpc,
    async download(file) {
      const bucket = file.role === "figure" ? "paper-media" : "drawing-submissions";
      const path = file.storagePath.split("/").map(encodeURIComponent).join("/");
      try {
        const response = await target.fetch(`${target.origin}/storage/v1/object/${bucket}/${path}`);
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error("Private image request failed");
        }
        return await drawingRequestBody(response, file.byteSize);
      } catch {
        throw new Error("A registered private review image could not be read");
      }
    },
  };
}

function imageList(items, role, limit) {
  if (!Array.isArray(items) || items.length > limit) throw new Error("Invalid private review image inventory");
  let previous = 0;
  return items.map(file => {
    if (!file || !Number.isInteger(file.ordinal) || file.ordinal <= previous || file.ordinal > limit ||
        !Number.isInteger(file.byteSize) || file.byteSize < 1 || file.byteSize > DRAWING_MAX_BYTES ||
        !Number.isInteger(file.width) || !Number.isInteger(file.height) || file.width < 1 || file.height < 1 ||
        file.width > DRAWING_MAX_DIMENSION || file.height > DRAWING_MAX_DIMENSION || file.width * file.height > DRAWING_MAX_PIXELS) {
      throw new Error("Invalid private review image metadata");
    }
    if (role === "figure") {
      if (file.mimeType !== "image/png" || !digest.test(file.sha256 ?? "") || file.storagePath !== `papers/canonical/${file.sha256}.png`) {
        throw new Error("A prompt figure lacks verified canonical media");
      }
    } else if (!mimes.has(file.mimeType) || !/^drawings\/[A-Za-z0-9_-]{1,100}\.(?:png|jpg|jpeg|webp)$/.test(file.storagePath ?? "") ||
        !Number.isInteger(file.orientation) || file.orientation < 1 || file.orientation > 8) {
      throw new Error("A drawing page lacks registered rendering metadata");
    }
    previous = file.ordinal;
    return { ...file, role, orientation: role === "figure" ? 1 : file.orientation };
  });
}

function checkedJob(value, reviewId) {
  if (value?.reviewId !== reviewId) throw new Error("The drawing job does not match the requested review");
  if (value.status === "existing" && uuid.test(value.suggestionId ?? "")) {
    return { status: "existing", reviewId, suggestionId: value.suggestionId };
  }
  if (value.status !== "ready" || !digest.test(value.contextSha256 ?? "") ||
      typeof value.prompt !== "string" || !value.prompt.trim() || value.prompt.length > 12000 ||
      !Array.isArray(value.rubric) || value.rubric.length < 1 || value.rubric.length > 12 ||
      !Number.isFinite(value.maxScore) || value.maxScore <= 0 || value.rubricVersion !== "nid-authored-practice-v1") {
    throw new Error("The frozen drawing advice job is incomplete");
  }
  const figures = imageList(value.figures, "figure", 10);
  const pages = imageList(value.pages, "drawing", 5);
  const files = [...figures, ...pages];
  if (!pages.length || files.reduce((sum, file) => sum + file.byteSize, 0) > maxImageBytes) {
    throw new Error("Drawing advice requires a complete bounded submission");
  }
  return { ...value, files, figureCount: figures.length, pageCount: pages.length };
}

export async function processDrawingAdvice({ backend, model, reviewId, apply = false, prepareImage = prepareAdvisoryImage }) {
  if (!uuid.test(reviewId ?? "")) throw new Error("Provide an exact drawing review UUID");
  const input = { p_review_id: reviewId, p_model_identity: model.identity };
  const readJob = async () => checkedJob(await backend.rpc("service_drawing_ai_job", input), reviewId);
  const job = await readJob();
  if (job.status === "existing") return job;
  if (!apply) return { status: "preview", reviewId, rubricVersion: job.rubricVersion, pageCount: job.pageCount, figureCount: job.figureCount };

  await model.verify();
  const images = [];
  let imageBytes = 0;
  for (const file of job.files) {
    const downloaded = await backend.download(file);
    let bytes;
    try { bytes = await prepareImage(downloaded, file); }
    catch { throw new Error("A private review image could not be verified for model input"); }
    imageBytes += bytes.length;
    if (imageBytes > maxImageBytes) throw new Error("Normalized drawing images exceed the advisory input limit");
    images.push({ role: file.role, ordinal: file.ordinal, bytes });
  }

  const advice = await model.suggest({
    prompt: job.prompt, rubric: job.rubric, images,
    async beforeDispatch() {
      const current = await readJob();
      if (current.status !== "ready" || current.contextSha256 !== job.contextSha256) {
        throw new Error("The drawing review changed. Open a fresh job before running the model");
      }
    },
  });
  const suggestionId = await backend.rpc("service_save_drawing_ai_advice", {
    ...input, p_context_sha256: job.contextSha256, p_criterion_marks: advice.criterionMarks,
    p_comments: advice.comments, p_confidence: advice.confidence,
    p_evidence: advice.evidence.map(item => `${labelImage(item.role)} ${item.ordinal}. ${item.observation}`),
  });
  if (!uuid.test(suggestionId ?? "")) throw new Error("Advisory receipt unavailable. Run the same review again to check saved advice");
  return { status: "recorded", reviewId, suggestionId, pageCount: job.pageCount, figureCount: job.figureCount };
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const { values } = parseArgs({ args: argv, options: { review: { type: "string" }, apply: { type: "boolean", default: false } } });
  if (!uuid.test(values.review ?? "")) throw new Error("Use --review with the drawing review UUID");
  const backend = drawingAdviceTarget(env);
  const { openLocalDrawingModel } = await import("./drawing-ai-local-model.mjs");
  const model = openLocalDrawingModel({
    url: env.DMOCKS_DRAWING_AI_OLLAMA_URL, tag: env.DMOCKS_DRAWING_AI_MODEL_TAG, digest: env.DMOCKS_DRAWING_AI_MODEL_SHA256,
  });
  console.log(JSON.stringify(await processDrawingAdvice({ backend, model, reviewId: values.review, apply: values.apply })));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
