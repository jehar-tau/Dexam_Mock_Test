import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bankProviderConfiguration, openPrivateBankProvider } from "./private-bank-provider.mjs";

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

// Runtime materialization is a separate explicit step with verified rules/media.
export { runtimeQuestion } from "./question-runtime.mjs";

export function buildManifest(bank, sourceCommit = "0".repeat(40)) {
  if (bank?.schemaVersion !== 1 || !Array.isArray(bank.questions)) throw new Error("Unsupported question-bank export");
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) throw new Error("A full Git commit SHA is required");
  const malformed = bank.questions.filter((question) => !Array.isArray(question.holds));
  if (malformed.length) throw new Error(`${malformed.length} questions have malformed holds`);
  const eligible = bank.questions.filter((question) => question.holds.length === 0);
  const records = eligible.map((question) => {
    if (!question.externalKey || !question.prompt || !question.provenance?.exam) throw new Error(`Eligible question is incomplete: ${question.externalKey || "missing-key"}`);
    const runtime = null;
    return {
      externalKey: question.externalKey,
      contentSha256: sha256(stableJson(question)),
      exam: String(question.provenance.exam).toLowerCase(),
      type: question.type,
      topic: question.topic || "unclassified",
      licence: question.licence || "unknown",
      objectiveReady: objectiveReady(question),
      runtime,
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
    runtimeReadyTotal: records.filter((record) => record.runtime).length,
    records,
  };
}

export function readBankSource(ref = "origin/main", cwd = new URL("../../..", import.meta.url)) {
  const root = cwd instanceof URL ? fileURLToPath(cwd) : cwd;
  const sourceCommit = execFileSync("git", ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`],
    { cwd: root, encoding: "utf8" }).trim();
  const raw = execFileSync("git", ["show", `${sourceCommit}:${SOURCE_PATH}`],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { sourceCommit, bank: JSON.parse(raw) };
}

export function loadFromGit(ref, cwd) {
  const { sourceCommit, bank } = readBankSource(ref, cwd);
  return buildManifest(bank, sourceCommit);
}

export async function applyManifest(manifest, { batchSize = 100, ...config }, fetchImpl = fetch) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 200) throw new Error("Invalid bank import batch size");
  const { rpc } = await openPrivateBankProvider(config, { fetchImpl });
  const runId = await rpc("begin_question_bank_import", { p_source_commit: manifest.sourceCommit, p_source_path: manifest.sourcePath, p_source_sha256: manifest.sourceSha256, p_schema_version: manifest.schemaVersion, p_source_total: manifest.sourceTotal, p_eligible_total: manifest.eligibleTotal, p_held_total: manifest.heldTotal });
  if (typeof runId !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(runId)) throw new Error("Invalid bank import receipt");
  for (let index = 0; index < manifest.records.length; index += batchSize) {
    const records = manifest.records.slice(index, index + batchSize);
    await rpc("import_question_bank_batch", { p_run_id: runId, p_records: records });
  }
  await rpc("finish_question_bank_import", { p_run_id: runId });
  return runId;
}

async function main() {
  const refIndex = process.argv.indexOf("--ref");
  const ref = refIndex >= 0 ? process.argv[refIndex + 1] : "origin/main";
  const manifest = loadFromGit(ref);
  const summary = Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== "records"));
  if (!process.argv.includes("--apply")) { console.log(JSON.stringify({ mode: "dry-run", ...summary }, null, 2)); return; }
  const runId = await applyManifest(manifest, bankProviderConfiguration(process.env));
  console.log(JSON.stringify({ mode: "applied", runId, ...summary }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
