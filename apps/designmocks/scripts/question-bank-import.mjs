import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SOURCE_PATH = "server/data/exports/dexam-bank-export.json";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

export function stableJson(value) { return JSON.stringify(stable(value)); }
export function sha256(value) { return createHash("sha256").update(value).digest("hex"); }

export function objectiveReady(question) {
  if (!["MCQ", "MSQ", "NAT"].includes(question.type)) return false;
  if (!question.answer || question.answer.status === "pending" || !String(question.answer.raw ?? "").trim()) return false;
  if (["MCQ", "MSQ"].includes(question.type)) {
    if (!Array.isArray(question.options) || question.options.length < 2) return false;
    if (new Set(question.options.map((option) => option?.key)).size !== question.options.length) return false;
  }
  return true;
}

export function buildManifest(bank, sourceCommit = "0".repeat(40)) {
  if (bank?.schemaVersion !== 1 || !Array.isArray(bank.questions)) throw new Error("Unsupported question-bank export");
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) throw new Error("A full Git commit SHA is required");
  const malformed = bank.questions.filter((question) => !Array.isArray(question.holds));
  if (malformed.length) throw new Error(`${malformed.length} questions have malformed holds`);
  const eligible = bank.questions.filter((question) => question.holds.length === 0);
  const records = eligible.map((question) => {
    if (!question.externalKey || !question.prompt || !question.provenance?.exam) throw new Error(`Eligible question is incomplete: ${question.externalKey || "missing-key"}`);
    return {
      externalKey: question.externalKey,
      contentSha256: sha256(stableJson(question)),
      exam: String(question.provenance.exam).toLowerCase(),
      type: question.type,
      topic: question.topic || "unclassified",
      licence: question.licence || "unknown",
      objectiveReady: objectiveReady(question),
      payload: question,
    };
  });
  if (new Set(records.map((record) => record.externalKey)).size !== records.length) throw new Error("Eligible external keys are not unique");
  return {
    schemaVersion: 1,
    sourceCommit,
    sourcePath: SOURCE_PATH,
    sourceSha256: sha256(stableJson(bank)),
    sourceTotal: bank.questions.length,
    eligibleTotal: records.length,
    heldTotal: bank.questions.length - records.length,
    objectiveReadyTotal: records.filter((record) => record.objectiveReady).length,
    records,
  };
}

export function loadFromGit(ref = "origin/main", cwd = new URL("../../..", import.meta.url)) {
  const root = cwd instanceof URL ? fileURLToPath(cwd) : cwd;
  const sourceCommit = execFileSync("git", ["rev-parse", ref], { cwd: root, encoding: "utf8" }).trim();
  const raw = execFileSync("git", ["show", `${ref}:${SOURCE_PATH}`], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return buildManifest(JSON.parse(raw), sourceCommit);
}

async function rpc(url, key, name, body) {
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${name} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

export async function applyManifest(manifest, { url, serviceRoleKey, batchSize = 100 }) {
  if (!url || !serviceRoleKey) throw new Error("DMOCKS_SUPABASE_URL and DMOCKS_SUPABASE_SERVICE_ROLE_KEY are required");
  const runId = await rpc(url, serviceRoleKey, "begin_question_bank_import", { p_source_commit: manifest.sourceCommit, p_source_path: manifest.sourcePath, p_source_sha256: manifest.sourceSha256, p_schema_version: manifest.schemaVersion, p_source_total: manifest.sourceTotal, p_eligible_total: manifest.eligibleTotal, p_held_total: manifest.heldTotal });
  for (let index = 0; index < manifest.records.length; index += batchSize) await rpc(url, serviceRoleKey, "import_question_bank_batch", { p_run_id: runId, p_records: manifest.records.slice(index, index + batchSize) });
  await rpc(url, serviceRoleKey, "finish_question_bank_import", { p_run_id: runId });
  return runId;
}

async function main() {
  const refIndex = process.argv.indexOf("--ref");
  const ref = refIndex >= 0 ? process.argv[refIndex + 1] : "origin/main";
  const manifest = loadFromGit(ref);
  const summary = Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== "records"));
  if (!process.argv.includes("--apply")) { console.log(JSON.stringify({ mode: "dry-run", ...summary }, null, 2)); return; }
  const runId = await applyManifest(manifest, { url: process.env.DMOCKS_SUPABASE_URL, serviceRoleKey: process.env.DMOCKS_SUPABASE_SERVICE_ROLE_KEY });
  console.log(JSON.stringify({ mode: "applied", runId, ...summary }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
