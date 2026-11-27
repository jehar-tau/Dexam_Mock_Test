import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {parseArgs} from "node:util";
import {setTimeout} from "node:timers/promises";
import {drawingAdviceTarget, imageList} from "./drawing-ai-advice.mjs";
import {prepareAdvisoryImage} from "./drawing-ai-image.mjs";
import {estimateYearDrawing, yearDrawingModels, yearDrawingCalibration} from "./year-drawing-estimator.mjs";

export async function runYearDrawingJob({backend, gatekeeper, scorer, calibration, prepareImage = prepareAdvisoryImage}) {
  const lease = await backend.rpc("service_claim_year_drawing", {p_gatekeeper: gatekeeper.identity, p_scorer: scorer?.identity ?? null, p_calibration_sha256: calibration});
  if (lease === null) return "idle";
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(lease)) throw new Error("Invalid drawing job lease");
  const read = () => backend.rpc("service_year_drawing_context", {p_lease: lease});
  let contextSha256 = null;
  let result;
  try {
    const job = await read();
    if (!/^[a-f0-9]{64}$/.test(job.contextSha256) || !Number.isSafeInteger(job.drawing?.maxImages)
        || job.drawing.maxImages < 1 || job.drawing.maxImages > 5) throw new Error("Invalid drawing job");
    contextSha256 = job.contextSha256;
    const files = [...imageList(job.figures, "figure", 10), ...imageList(job.pages, "drawing", job.drawing.maxImages, job.attemptId)];
    if (!job.pages.length || files.reduce((sum, f) => sum + f.byteSize, 0) > 100 * 1024 * 1024) throw new Error("Invalid drawing inventory");
    const images = [];
    for (const file of files) {
      const bytes = await prepareImage(await backend.download(file), file, 1280);
      images.push({role: file.role, ordinal: file.ordinal, bytes});
    }
    result = await estimateYearDrawing({job, images, gatekeeper, scorer, calibration, beforeDispatch: async () => {
      if ((await read()).contextSha256 !== contextSha256) throw new Error("Drawing context changed");
    }});
  } catch {
    // Never persist model errors, private prompts, storage URLs or image data in a failure record.
    result = {status: "unavailable", flags: []};
  }
  const saved = await backend.rpc("service_finish_year_drawing", {p_lease: lease, p_context_sha256: contextSha256, p_result: result});
  if (saved !== true) throw new Error("Drawing evaluation lease expired; result discarded");
  return result.status;
}

async function main() {
  const {values} = parseArgs({options: {apply: {type: "boolean"}, watch: {type: "boolean"},
    "calibration-plan": {type: "string"}, output: {type: "string"}}});
  const {gatekeeper, scorer} = yearDrawingModels(process.env);
  if (values["calibration-plan"] || values.output) {
    if (!values["calibration-plan"] || !values.output || values.apply || values.watch
        || process.env.DMOCKS_DRAWING_AI_ISOLATED_MODEL !== "true") {
      throw new Error("Offline calibration needs an isolated local model, --calibration-plan and --output");
    }
    const {saveYearDrawingCalibration} = await import("./year-drawing-calibration.mjs");
    const report = await saveYearDrawingCalibration(values["calibration-plan"], values.output, {gatekeeper, scorer});
    console.log(JSON.stringify(report));
    if (!report.passed) process.exitCode = 2;
    return;
  }
  const backend = drawingAdviceTarget(process.env);
  const path = process.env.DMOCKS_DRAWING_YEAR_CALIBRATION;
  let evidence;
  if (path) {
    try { evidence = JSON.parse(await readFile(path, "utf8")); }
    catch { throw new Error("The private drawing calibration file could not be read"); }
  }
  await gatekeeper.verify();
  const calibration = yearDrawingCalibration(evidence, gatekeeper.identity, scorer?.identity);
  if (!values.apply) {
    console.log(JSON.stringify({gatekeeper: "verified", scorer: scorer ? "configured" : "absent", calibration: calibration ? "passed" : "pending"}));
    return;
  }
  do {
    let availableScorer = scorer;
    if (availableScorer && calibration) {
      try { await scorer.verify(); } catch { availableScorer = null; }
    }
    const status = await runYearDrawingJob({backend, gatekeeper, scorer: availableScorer, calibration: availableScorer ? calibration : null});
    if (status !== "idle" || !values.watch) console.log(JSON.stringify({status}));
    if (values.watch && status === "idle") await setTimeout(5000);
  } while (values.watch);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
