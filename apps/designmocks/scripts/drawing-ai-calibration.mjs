import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {parseArgs} from "node:util";

const sha256 = /^[a-f0-9]{64}$/;
const slug = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const isDigest = value => typeof value === "string" && sha256.test(value);
const rate = value => Number.isFinite(value) && value >= 0 && value <= 1;
const mark = (value, maximum) => Number.isFinite(value) && value >= 0 && value <= maximum &&
  Number(value.toFixed(2)) === value;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const fields = (value, names) => object(value) && Object.keys(value).length === names.length &&
  names.every(name => Object.hasOwn(value, name));

function scores(value, rubric) {
  return fields(value, rubric.map(({label}) => label)) &&
    rubric.every(({label, points}) => mark(value[label], points));
}

function criterionResults(rows, {label, points}, limits) {
  let signedError = 0;
  let absoluteError = 0;
  let belowFull = 0;
  let falseFull = 0;
  for (const {teacher, model} of rows) {
    const error = Math.round(model[label] * 100) - Math.round(teacher[label] * 100);
    signedError += error;
    absoluteError += Math.abs(error);
    if (teacher[label] < points) {
      belowFull++;
      if (model[label] === points) falseFull++;
    }
  }
  const scale = Math.round(points * 100) * rows.length;
  const meanAbsoluteError = scale ? absoluteError / scale : null;
  const meanSignedError = scale ? signedError / scale : null;
  const falseFullRate = belowFull ? falseFull / belowFull : null;
  const passed = belowFull >= limits.minBelowFullPerCriterion &&
    meanAbsoluteError <= limits.maxMeanAbsoluteError &&
    Math.abs(meanSignedError) <= limits.maxAbsoluteMeanBias &&
    falseFullRate <= limits.maxFalseFullRate;
  return {criterion: label, meanAbsoluteError, meanSignedError, belowFull, falseFull, falseFullRate, passed};
}

export function evaluateDrawingCalibration(plan, predictions) {
  assert.ok(plan?.version === 1 && isDigest(plan.taskSha256) &&
    isDigest(plan.modelSha256) && isDigest(plan.configurationSha256), "Invalid calibration identity");
  const {rubric, groups, limits, cases} = plan;
  assert.ok(Array.isArray(rubric) && rubric.length >= 1 && rubric.length <= 12 &&
    rubric.every(item => fields(item, ["label", "points"]) && typeof item.label === "string" &&
      item.label.length >= 3 && item.label.length <= 120 && item.label.trim() === item.label &&
      !/[\u0000-\u001f\u007f]/.test(item.label) && mark(item.points, 100) && item.points > 0) &&
    new Set(rubric.map(item => item.label.toLowerCase())).size === rubric.length, "Invalid calibration rubric");

  assert.ok(Array.isArray(groups) && groups.length >= 1 && groups.length <= 32 &&
    groups.every(group => typeof group === "string" && slug.test(group)) &&
    new Set(groups).size === groups.length, "Invalid calibration groups");
  assert.ok(fields(limits, ["minScoredPerGroup", "minBelowFullPerCriterion", "minCoverage", "maxMeanAbsoluteError",
    "maxAbsoluteMeanBias", "maxFalseFullRate"]) &&
    Number.isSafeInteger(limits.minScoredPerGroup) && limits.minScoredPerGroup >= 1 &&
    Number.isSafeInteger(limits.minBelowFullPerCriterion) && limits.minBelowFullPerCriterion >= 1 &&
    rate(limits.minCoverage) && limits.minCoverage > 0 && rate(limits.maxMeanAbsoluteError) &&
    rate(limits.maxAbsoluteMeanBias) && rate(limits.maxFalseFullRate), "Invalid explicit calibration thresholds");

  assert.ok(Array.isArray(cases) && cases.length >= 1 && cases.length <= 50000, "Invalid teacher-marked case set");
  const byGroup = new Map(groups.map(group => [group, {labelled: 0, rows: []}]));
  const byCase = new Map();
  const labelledInputs = new Set();
  for (const item of cases) {
    assert.ok(fields(item, ["caseId", "inputSha256", "group", "teacher"]) && typeof item.caseId === "string" &&
      slug.test(item.caseId) && !byCase.has(item.caseId) && byGroup.has(item.group) &&
      isDigest(item.inputSha256) && !labelledInputs.has(item.inputSha256) && scores(item.teacher, rubric),
    "Invalid or duplicate teacher-marked case");
    byCase.set(item.caseId, item);
    labelledInputs.add(item.inputSha256);
    byGroup.get(item.group).labelled++;
  }

  assert.ok(predictions?.version === 1 && predictions.taskSha256 === plan.taskSha256 &&
    predictions.modelSha256 === plan.modelSha256 && predictions.configurationSha256 === plan.configurationSha256 &&
    Array.isArray(predictions.cases) && predictions.cases.length <= cases.length, "Predictions must match the frozen task, model and configuration");
  const seen = new Set();
  for (const entry of predictions.cases) {
    const source = byCase.get(entry?.caseId);
    assert.ok(fields(entry, ["caseId", "inputSha256", "criterionMarks"]) && source &&
      source.inputSha256 === entry.inputSha256 &&
      !seen.has(entry.caseId) && scores(entry.criterionMarks, rubric), "Invalid, duplicate or unexpected model prediction");
    seen.add(entry.caseId);
    const {group, teacher} = source;
    byGroup.get(group).rows.push({teacher, model: entry.criterionMarks});
  }

  const results = [...byGroup].map(([group, {labelled, rows}]) => {
    const coverage = labelled ? rows.length / labelled : 0;
    const criteria = rubric.map(criterion => criterionResults(rows, criterion, limits));
    const passed = rows.length >= limits.minScoredPerGroup && coverage >= limits.minCoverage &&
      criteria.every(criterion => criterion.passed);
    return {group, labelled, scored: rows.length, coverage, criteria, passed};
  });
  return {version: 1, taskSha256: plan.taskSha256, modelSha256: plan.modelSha256,
    configurationSha256: plan.configurationSha256, limits, results, passed: results.every(group => group.passed)};
}

async function main() {
  const {values} = parseArgs({options: {plan: {type: "string"}, predictions: {type: "string"}}});
  assert.ok(values.plan && values.predictions, "Use --plan and --predictions with private JSON files");
  const [plan, predictions] = await Promise.all([readFile(values.plan), readFile(values.predictions)]);
  const report = evaluateDrawingCalibration(JSON.parse(plan), JSON.parse(predictions));
  const digest = bytes => createHash("sha256").update(bytes).digest("hex");
  console.log(JSON.stringify({...report, planSha256: digest(plan), predictionsSha256: digest(predictions)}, null, 2));
  if (!report.passed) process.exitCode = 2;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => {
    // Assertion messages are fixed and safe. JSON and file errors can echo private input.
    console.error(error.code === "ERR_ASSERTION" ? error.message : "Could not read the private calibration input as JSON.");
    process.exitCode = 1;
  });
}
