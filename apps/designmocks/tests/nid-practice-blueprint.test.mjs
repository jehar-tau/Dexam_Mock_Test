import assert from "node:assert/strict";
import test from "node:test";
import { markHundredths, newNidBlueprint, nidBlueprintInput, nidPracticeSchema, validateNidPracticeBlueprint } from "../src/nid-practice-blueprint.js";

const objective = () => ({ schemaVersion: nidPracticeSchema, title: "Original fictional aptitude practice", purpose: "An authored observation exercise for private review.", durationMinutes: 23, uploadGraceMinutes: 0,
  sections: [{ label: "Observation", kind: "mcq", count: 3, points: 2.5, penalty: 0.25, rubric: [] }] });
const manual = () => ({ ...objective(), uploadGraceMinutes: 10, sections: [{ label: "Original visual practice", kind: "drawing", count: 2, points: 0.3, penalty: 0,
  rubric: [{ label: "Observation", points: 0.1, guidance: "Credit the clearly observed spatial relationships." }, { label: "Communication", points: 0.2, guidance: "Credit a legible visual explanation of the proposed solution." }] }] });

test("authored practice has no preset official counts, timing, marks or rubric", () => {
  const draft = newNidBlueprint();
  assert.equal(draft.durationMinutes, ""); assert.equal(draft.uploadGraceMinutes, "");
  assert.equal(draft.sections[0].count, ""); assert.equal(draft.sections[0].points, ""); assert.deepEqual(draft.sections[0].rubric, []);
  assert.throws(() => nidBlueprintInput(draft));
  assert.deepEqual(validateNidPracticeBlueprint(objective()), { questionCount: 3, totalPoints: 7.5, humanReview: false });
});
test("rubrics total in exact hundredths, including 0.1 plus 0.2", () => {
  assert.equal(markHundredths(0.29), 29);
  assert.deepEqual(validateNidPracticeBlueprint(manual()), { questionCount: 2, totalPoints: 0.6, humanReview: true });
  const p = manual(); p.sections[0].rubric[1].points = 0.19;
  assert.throws(() => validateNidPracticeBlueprint(p), /must equal/);
  for (const value of [-0.1, 0.001, 0.1 + 0.2, Infinity, NaN, "1e2", "1/2"]) assert.throws(() => markHundredths(value));
});
test("the reviewed payload shape cannot smuggle keys, runtime or official format claims", () => {
  for (const p of [null, [], { ...objective(), schemaVersion: "official-nid" }, { ...objective(), answerKey: "A" }, { ...objective(), runtimePayload: {} }, { ...objective(), sections: [{ ...objective().sections[0], rubric: [], correct: "A" }] }])
    assert.throws(() => validateNidPracticeBlueprint(p));
  const p = manual(); p.sections[0].rubric[0].answer = "A";
  assert.throws(() => validateNidPracticeBlueprint(p));
});
test("response types, upload time and rubric boundaries must agree", () => {
  for (const kind of ["mcq", "msq", "nat"]) assert.equal(validateNidPracticeBlueprint({ ...objective(), sections: [{ ...objective().sections[0], kind }] }).humanReview, false);
  for (const kind of ["drawing", "written"]) assert.equal(validateNidPracticeBlueprint({ ...manual(), sections: [{ ...manual().sections[0], kind }] }).humanReview, true);
  const invalid = [ { ...objective(), uploadGraceMinutes: 10 }, { ...manual(), uploadGraceMinutes: 0 }, { ...manual(), uploadGraceMinutes: 12 },
    { ...manual(), sections: [{ ...manual().sections[0], penalty: 0.1 }] }, { ...manual(), sections: [{ ...manual().sections[0], rubric: [] }] },
    { ...objective(), sections: [{ ...objective().sections[0], rubric: manual().sections[0].rubric }] } ];
  for (const p of invalid) assert.throws(() => validateNidPracticeBlueprint(p));
});
test("duplicate labels, oversized counts, decimals and malformed human guidance fail before a write", () => {
  const cases = [];
  for (const [key, value] of [["durationMinutes", 0], ["durationMinutes", 1.5], ["durationMinutes", 361], ["purpose", "too short"], ["title", " Leading space"]]) cases.push({ ...objective(), [key]: value });
  for (const [key, value] of [["count", 1.5], ["count", 101], ["points", 0], ["points", 100.01], ["points", "3"], ["points", 1.001], ["penalty", -1], ["penalty", 3], ["kind", "unknown"]]) cases.push({ ...objective(), sections: [{ ...objective().sections[0], [key]: value }] });
  cases.push({ ...objective(), sections: [objective().sections[0], { ...objective().sections[0], label: "OBSERVATION" }] });
  cases.push({ ...objective(), sections: [{ ...objective().sections[0], count: 99 }, { ...objective().sections[0], label: "Other section" }] });
  for (const [key, value] of [["label", "COMMUNICATION"], ["guidance", "too short"], ["points", -0.1]]) { const p = manual(); p.sections[0].rubric[0][key] = value; cases.push(p); }
  for (const p of cases) assert.throws(() => validateNidPracticeBlueprint(p));
});
test("form strings normalize once without rounding or hidden empty-number defaults", () => {
  const draft = objective(); Object.assign(draft, { title: "  Original practice  ", durationMinutes: "23", uploadGraceMinutes: "0" });
  Object.assign(draft.sections[0], { count: "3", points: "2.50", penalty: "0.25" });
  const p = nidBlueprintInput(draft);
  assert.equal(p.title, "Original practice"); assert.equal(p.sections[0].points, 2.5);
  for (const value of ["", " ", "0x10", "2e1", "1.001", "1/2", "1,2"]) assert.throws(() => nidBlueprintInput({ ...draft, durationMinutes: value }));
});
