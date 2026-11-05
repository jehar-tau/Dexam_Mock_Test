import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const refIndex = process.argv.indexOf("--ref");
const ref = refIndex >= 0 ? process.argv[refIndex + 1] : null;
if (refIndex >= 0 && !ref) throw new Error("--ref requires a Git ref");
const platformPromise = ref
  ? Promise.resolve(
      JSON.parse(
        execFileSync(
          "git",
          ["show", `${ref}:server/data/exports/dexam-bank-export.json`],
          { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
        ),
      ),
    )
  : read("server/data/exports/dexam-bank-export.json");
const [machine, platform, review] = await Promise.all([
  read("dexam-bank-machine-readable.json"),
  platformPromise,
  read("server/data/exports/dexam-review.json"),
]);

const ids = {
  machine: new Set(machine.questions.map((question) => question.id)),
  platform: new Set(platform.questions.map((question) => question.externalKey)),
  review: new Set(review.questions.map((question) => question.id)),
};
const normalized = Object.fromEntries(
  Object.entries(ids).map(([name, values]) => [
    name,
    new Set([...values].map((value) => value.toLowerCase())),
  ]),
);
const difference = (left, right) => [...left].filter((id) => !right.has(id));
const mismatches = {
  missingFromPlatformExport: difference(ids.machine, ids.platform),
  missingFromReviewExport: difference(ids.machine, ids.review),
  onlyInPlatformExport: difference(ids.platform, ids.machine),
  onlyInReviewExport: difference(ids.review, ids.machine),
};
const normalizedMismatches = {
  missingFromPlatformExport: difference(normalized.machine, normalized.platform),
  missingFromReviewExport: difference(normalized.machine, normalized.review),
  onlyInPlatformExport: difference(normalized.platform, normalized.machine),
  onlyInReviewExport: difference(normalized.review, normalized.machine),
};

const by = (items, value) =>
  Object.fromEntries(
    Object.entries(
      items.reduce((counts, item) => {
        const key = value(item) || "unknown";
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {}),
    ).sort(([a], [b]) => a.localeCompare(b)),
  );

const report = {
  generatedAt: new Date().toISOString(),
  source: {
    ref: ref || "working-tree",
    path: "server/data/exports/dexam-bank-export.json",
    schemaVersion: platform.schemaVersion,
    exportedAt: platform.exportedAt,
    eligibility: "Array.isArray(question.holds) && question.holds.length === 0",
  },
  counts: {
    machine: machine.questions.length,
    platformExport: platform.questions.length,
    reviewExport: review.questions.length,
    ownerProvided: review.questions.filter((question) => question.ownerProvided).length,
    holdFree: platform.questions.filter(
      (question) => Array.isArray(question.holds) && question.holds.length === 0,
    ).length,
    held: platform.questions.filter(
      (question) => !Array.isArray(question.holds) || question.holds.length > 0,
    ).length,
  },
  byExam: by(platform.questions, (question) => question.provenance?.exam?.toUpperCase()),
  eligibleByExam: by(
    platform.questions.filter((question) => Array.isArray(question.holds) && question.holds.length === 0),
    (question) => question.provenance?.exam?.toUpperCase(),
  ),
  invalidHolds: platform.questions.filter((question) => !Array.isArray(question.holds)).length,
  byCropReview: by(review.questions, (question) => question.cropReview),
  holdReasons: by(
    platform.questions.flatMap((question) =>
      Array.isArray(question.holds) ? question.holds : ["invalid-holds"],
    ),
    (hold) => hold,
  ),
  mismatches,
  normalizedMismatches,
  exactKeyMatch: Object.values(mismatches).every((items) => items.length === 0),
  localRepresentationsMatch: Object.values(normalizedMismatches).every(
    (items) => items.length === 0,
  ),
  deployedImportVerified: false,
};

console.log(JSON.stringify(report, null, 2));
if (report.invalidHolds > 0) process.exitCode = 1;
