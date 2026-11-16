import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {evaluateDrawingCalibration} from "../scripts/drawing-ai-calibration.mjs";

const identity = {version: 1, taskSha256: "a".repeat(64), modelSha256: "b".repeat(64), configurationSha256: "c".repeat(64)};
const rubric = [{label: "Geometry", points: 10}, {label: "Line clarity", points: 5}];
const teacher = (caseId, digit, group, geometry, clarity) => ({
  caseId, inputSha256: digit.repeat(64), group, teacher: {Geometry: geometry, "Line clarity": clarity},
});

function fixture() {
  const plan = {
    ...identity, rubric, groups: ["baseline", "reference-only"],
    limits: {minScoredPerGroup: 2, minBelowFullPerCriterion: 1, minCoverage: 1,
      maxMeanAbsoluteError: 0.25, maxAbsoluteMeanBias: 0.15, maxFalseFullRate: 0},
    cases: [teacher("case-a", "1", "baseline", 10, 5), teacher("case-b", "2", "baseline", 4, 0),
      teacher("case-c", "3", "reference-only", 0, 4), teacher("case-d", "4", "reference-only", 7, 1)],
  };
  const predictions = {...identity, cases: plan.cases.map(({caseId, inputSha256, teacher}) => ({
    caseId, inputSha256, criterionMarks: {...teacher},
  }))};
  return {plan, predictions};
}

test("calibrates every criterion against exact snapshots in every prespecified group", () => {
  const {plan, predictions} = fixture();
  const report = evaluateDrawingCalibration(plan, predictions);
  assert.equal(report.passed, true);
  assert.deepEqual(report.results.map(group => [group.group, group.scored, group.coverage]), [
    ["baseline", 2, 1], ["reference-only", 2, 1],
  ]);
  assert.deepEqual(report.results[0].criteria[0], {
    criterion: "Geometry", meanAbsoluteError: 0, meanSignedError: 0, belowFull: 1, falseFull: 0, falseFullRate: 0, passed: true,
  });
  assert.doesNotMatch(JSON.stringify(report), /case-[a-d]/);
});

test("fails false full credit even when opposite errors cancel or an easier group passes", () => {
  const {plan, predictions} = fixture();
  plan.cases[2].teacher.Geometry = 8;
  predictions.cases[2].criterionMarks.Geometry = 10;
  predictions.cases[3].criterionMarks.Geometry = 5;
  const report = evaluateDrawingCalibration(plan, predictions);
  assert.equal(report.passed, false);
  assert.equal(report.results[0].passed, true);
  const geometry = report.results[1].criteria[0];
  assert.equal(geometry.meanSignedError, 0);
  assert.equal(geometry.meanAbsoluteError, 0.2);
  assert.equal(geometry.falseFullRate, 0.5);
  assert.equal(geometry.passed, false);
});

test("measures signed bias in both directions and accepts an exact decimal limit", () => {
  const {plan, predictions} = fixture();
  for (const adjustment of [1.5, -1.5]) {
    predictions.cases[2].criterionMarks.Geometry = adjustment + 2;
    predictions.cases[3].criterionMarks.Geometry = adjustment + 7;
    plan.cases[2].teacher.Geometry = 2;
    const geometry = evaluateDrawingCalibration(plan, predictions).results[1].criteria[0];
    assert.equal(geometry.meanSignedError, adjustment / 10);
    assert.equal(geometry.passed, true);
    plan.limits.maxAbsoluteMeanBias = 0.149;
    assert.equal(evaluateDrawingCalibration(plan, predictions).results[1].criteria[0].passed, false);
    plan.limits.maxAbsoluteMeanBias = 0.15;
  }
});

test("marks omitted cases, empty groups, and missing below-full coverage as failures without inventing metrics", () => {
  const {plan, predictions} = fixture();
  plan.groups.push("adverse-lighting");
  predictions.cases.splice(1, 1);
  const report = evaluateDrawingCalibration(plan, predictions);
  assert.equal(report.passed, false);
  assert.equal(report.results[0].coverage, 0.5);
  assert.equal(report.results[0].criteria[0].falseFullRate, null);
  assert.equal(report.results[0].criteria[0].passed, false);
  assert.equal(report.results[2].criteria[0].meanAbsoluteError, null);
  assert.equal(report.results[2].passed, false);
});

test("rejects mismatched model, configuration, images, marks and duplicate cases", () => {
  for (const mutate of [
    (_, predictions) => {predictions.modelSha256 = "e".repeat(64);},
    (_, predictions) => {predictions.configurationSha256 = "e".repeat(64);},
    (_, predictions) => {predictions.cases[0].inputSha256 = "e".repeat(64);},
    (_, predictions) => {predictions.cases[0].caseId = "case-unknown";},
    (_, predictions) => {predictions.cases[1] = predictions.cases[0];},
    (_, predictions) => {predictions.cases[1].criterionMarks.Geometry = 4.001;},
    (_, predictions) => {delete predictions.cases[1].criterionMarks.Geometry;},
    (plan) => {plan.cases[1] = plan.cases[0];},
    (plan) => {plan.cases[1].inputSha256 = plan.cases[0].inputSha256;},
    (plan) => {delete plan.limits.maxAbsoluteMeanBias;},
  ]) {
    const {plan, predictions} = fixture();
    mutate(plan, predictions);
    assert.throws(() => evaluateDrawingCalibration(plan, predictions), /calibration|prediction|case/i);
  }
});

test("CLI fingerprints inputs and returns 0, 2 and 1 for pass, failed calibration and invalid input", t => {
  const directory = mkdtempSync(join(tmpdir(), "drawing-calibration-test-"));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const planPath = join(directory, "plan.json");
  const predictionsPath = join(directory, "predictions.json");
  const script = fileURLToPath(new URL("../scripts/drawing-ai-calibration.mjs", import.meta.url));
  const run = () => spawnSync(process.execPath, [script, "--plan", planPath, "--predictions", predictionsPath], {encoding: "utf8"});
  const {plan, predictions} = fixture();
  const planJson = JSON.stringify(plan);
  writeFileSync(planPath, planJson);
  writeFileSync(predictionsPath, JSON.stringify(predictions));
  let result = run();
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).planSha256, createHash("sha256").update(planJson).digest("hex"));
  predictions.cases[2].criterionMarks.Geometry = 10;
  writeFileSync(predictionsPath, JSON.stringify(predictions));
  result = run();
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).passed, false);
  writeFileSync(predictionsPath, "private-marker invalid json");
  result = run();
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stderr, /private-marker/);
});
