import test from"node:test";import assert from"node:assert/strict";import{buildAiDraftRequest,parseAiDraftResponse}from"../supabase/functions/_shared/ai-draft.mjs";
import { buildManifest, runtimeQuestion } from "../scripts/question-bank-import.mjs";
import { RULES_2027 } from "../scripts/question-runtime.mjs";
test("AI question request uses strict structured output and preserves basis",()=>{const request=buildAiDraftRequest({model:"configured-model",exam:"uceed",topic:"observation",questionType:"MCQ",instruction:"Create an original spatial question",basis:[{externalKey:"basis-1"}]});assert.equal(request.text.format.type,"json_schema");assert.equal(request.text.format.strict,true);assert.match(request.input[1].content,/basis-1/)});
test("AI response parser requires the human review hold",()=>{const payload={holds:["ai-generated-human-review"],prompt:"Original"};assert.deepEqual(parseAiDraftResponse({output:[{content:[{type:"output_text",text:JSON.stringify(payload)}]}]}),payload);assert.throws(()=>parseAiDraftResponse({output:[{content:[{type:"output_text",text:'{"holds":[]}'}]}]}),/human-review hold/)});

test("reviewed canonical AI drafts can import and compile after their hold is cleared", () => {
  const draft = {
    type: "MCQ", prompt: "Choose the clearest original wayfinding design.",
    options: ["A", "B", "C", "D"].map((key) => ({ key, text: "Fictional option " + key, asset: null })),
    answer: { raw: "B", status: "pending" }, explanation: "A clear visual hierarchy aids navigation.",
    topic: "observation", assets: [], visualDependency: false, sourceKind: "generated", licence: "original-ai-draft",
    holds: ["ai-generated-human-review"], provenance: { exam: "uceed", basisExternalKeys: ["ai-fixture-basis"] },
  };
  const rule = RULES_2027.uceed;
  assert.equal(buildManifest({ schemaVersion: 1, questions: [draft] }).eligibleTotal, 0);
  assert.equal(runtimeQuestion({ ...draft, holds: [] }, { rule }), null);
  const reviewed = { ...draft, externalKey: "ai-fixture-original", holds: [], answer: { ...draft.answer, status: "human-reviewed" } };
  const manifest = buildManifest({ schemaVersion: 1, questions: [reviewed] });
  assert.equal(manifest.objectiveReadyTotal, 1);
  assert.equal(manifest.records[0].exam, "uceed");
  assert.deepEqual(runtimeQuestion(manifest.records[0].payload, { rule }).key.correct, ["B"]);
});
