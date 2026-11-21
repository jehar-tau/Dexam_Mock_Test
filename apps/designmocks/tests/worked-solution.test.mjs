import assert from "node:assert/strict";
import test from "node:test";
import { inspectRuntimeQuestion, RULES_2027 } from "../scripts/question-runtime.mjs";
import { encodeWorkedExplanation, readWorkedExplanation } from "../src/worked-solution.js";

const figure = { sha256: "a".repeat(64), width: 80, height: 40 };
const mediaCatalog = [{ ...figure, path: `papers/canonical/${figure.sha256}.png`, byteSize: 128 }];
const question = {
  externalKey: "fictional-worked-solution", provenance: { exam: "uceed" }, type: "NAT", holds: [],
  prompt: "Fictional question about an arrangement.", options: [], assets: [figure], visualDependency: true,
  answer: { raw: "2", status: "official-key" }, explanation: "Count both fictional groups.",
  solutionReview: { fingerprint: "b".repeat(64), solutionSha256: "c".repeat(64) },
  workedSolution: {
    version: 1, figure, keyIdea: "Group the shapes.",
    steps: [
      { text: "Find the left group.", shapes: [{ tag: "rect", attrs: { x: "4", width: "8", stroke: "#2f5d46" } }] },
      { text: "Label the total.", shapes: [{ tag: "text", attrs: { x: "18" }, text: "2" }] },
    ],
  },
};

test("materializes the worked solution in the released explanation channel only", () => {
  const { runtime, issues } = inspectRuntimeQuestion(question, { rule: RULES_2027.uceed, mediaCatalog });
  assert.deepEqual(issues, []);
  assert.deepEqual(runtime.key.accepted, [{ exact: "2" }]);
  assert.deepEqual(Object.keys(runtime.key), ["kind", "accepted", "sourceExternalKey"]);
  assert.equal(runtime.media[0].sha256, figure.sha256);
  const released = readWorkedExplanation({ status: "submitted" }, runtime);
  assert.deepEqual(released, { explanation: question.explanation, solution: question.workedSolution });
  for (const attempt of [
    { status: "active" }, { status: "submitted", resultsPending: true },
    { status: "submitted", examResultsPending: true },
  ]) assert.deepEqual(readWorkedExplanation(attempt, runtime), { explanation: "", solution: null });
});

test("blocks raw SVG, event attributes, external paints and mismatched media", () => {
  const changes = [
    { tag: "foreignObject", attrs: {} }, { tag: "use", attrs: {} },
    { tag: "rect", attrs: { onclick: "run()" } },
    { tag: "rect", attrs: { fill: "url(remote)" } },
    { tag: "text", attrs: { href: "javascript:alert(1)" }, text: "blocked" },
  ];
  for (const annotation of changes) {
    const malformed = structuredClone(question);
    malformed.workedSolution.steps[0].shapes = [annotation];
    const { runtime, issues } = inspectRuntimeQuestion(malformed, { rule: RULES_2027.uceed, mediaCatalog });
    assert.equal(runtime, null);
    assert.ok(issues.some((issue) => issue.code === "worked-solution-invalid"));
  }
  const mismatch = { ...question.workedSolution, figure: { ...figure, width: 79 } };
  const explanation = encodeWorkedExplanation(question.explanation, mismatch);
  assert.deepEqual(readWorkedExplanation({ status: "submitted" }, { explanation, media: [figure] }),
    { explanation: question.explanation, solution: null });
});

test("legacy explanation and malformed envelope have predictable fallbacks", () => {
  assert.deepEqual(readWorkedExplanation({ status: "submitted" }, { explanation: "Fictional text." }),
    { explanation: "Fictional text.", solution: null });
  assert.deepEqual(readWorkedExplanation({ status: "submitted" }, { explanation: "dmocks:worked-solution-v1\n{" }),
    { explanation: "", solution: null });
});

test("requires canonical official-key and review metadata before freezing overlays", () => {
  for (const record of [
    { ...question, solutionReview: undefined },
    { ...question, answer: { raw: "2", status: "model-proposed" } },
  ]) {
    assert.equal(inspectRuntimeQuestion(record, { rule: RULES_2027.uceed, mediaCatalog }).runtime, null);
  }
});
