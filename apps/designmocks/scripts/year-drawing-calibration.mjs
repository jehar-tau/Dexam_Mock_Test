import {createHash} from "node:crypto";
import {open, realpath, stat, writeFile} from "node:fs/promises";
import {isAbsolute, relative, resolve, dirname, sep} from "node:path";
import {prepareAdvisoryImage} from "./drawing-ai-image.mjs";
import {estimateYearDrawing, yearDrawingCalibration, yearDrawingProtocol} from "./year-drawing-estimator.mjs";
import {DRAWING_MAX_BYTES} from "../supabase/functions/_shared/drawing-limits.mjs";

async function privateFile(root, name) {
  if (typeof name !== "string" || !name || isAbsolute(name)) throw new Error("Use relative private calibration image filenames");
  const file = await realpath(resolve(root, name));
  const rel = relative(root, file);
  if (!rel || rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) throw new Error("Calibration image must remain inside the private calibration directory");
  return file;
}

export async function collectYearDrawingCalibration({plan, directory, gatekeeper, scorer}) {
  if (!scorer || !Array.isArray(plan?.cases) || plan.cases.length < 30 || plan.cases.length > 50) {
    throw new Error("Provide both local models and 30–50 private teacher-scored cases");
  }
  const root = await realpath(directory);
  const evidence = {protocol: yearDrawingProtocol, gatekeeper: gatekeeper.identity, scorer: scorer.identity, cases: []};
  const seen = new Set();
  for (const {job, teacher, files} of plan.cases) {
    if (!Number.isFinite(teacher) || teacher < 0 || !Number.isFinite(job?.maxScore) || teacher > job.maxScore
        || !Array.isArray(files) || !files.length || files.length > 15) throw new Error("Invalid private calibration task");
    const hasher = createHash("sha256");
    const images = [];
    for (const {path, ...metadata} of files) {
      const file = await privateFile(root, path);
      const info = await stat(file);
      if (!info.isFile() || info.size < 1 || info.size > DRAWING_MAX_BYTES || !["figure", "drawing"].includes(metadata.role)) {
        throw new Error("Invalid private calibration image");
      }
      const handle = await open(file, "r");
      let bytes;
      try { bytes = await prepareAdvisoryImage(await handle.readFile(), {...metadata, byteSize: info.size}, 1280); }
      finally { await handle.close(); }
      images.push({role: metadata.role, ordinal: metadata.ordinal, bytes});
      if (metadata.role === "drawing") hasher.update(createHash("sha256").update(bytes).digest());
    }
    const inputSha256 = hasher.digest("hex");
    if (!images.some(image => image.role === "drawing") || seen.has(inputSha256)) throw new Error("Missing or repeated calibration drawing");
    seen.add(inputSha256);
    const totals = [];
    for (let run = 0; run < 2; run++) {
      // This offline calibration path has no database handle. No score can reach an account.
      const result = await estimateYearDrawing({job, images, gatekeeper, scorer, calibration: true});
      if (result.status !== "ready") throw new Error("A calibration drawing could not be scored on both runs");
      totals.push(result.total);
    }
    evidence.cases.push({inputSha256, max: job.maxScore, teacher, first: totals[0], second: totals[1]});
  }
  return evidence;
}

export async function saveYearDrawingCalibration(planPath, output, models) {
  const plan = await open(planPath, "r");
  let data;
  try { data = JSON.parse(await plan.readFile("utf8")); }
  catch { throw new Error("Private calibration plan is not valid JSON"); }
  finally { await plan.close(); }
  const evidence = await collectYearDrawingCalibration({plan: data, directory: dirname(resolve(planPath)), ...models});
  const digest = yearDrawingCalibration(evidence, models.gatekeeper.identity, models.scorer.identity);
  await writeFile(output, JSON.stringify(evidence, null, 2), {flag: "wx", mode: 0o600});
  return {cases: evidence.cases.length, passed: Boolean(digest)};
}
