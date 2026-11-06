import test from "node:test";
import assert from "node:assert/strict";
import { buildAttemptInsights } from "../src/attempt-insights.mjs";

test("released attempt insights exclude drawings and dropped questions",()=>{
  const value=buildAttemptInsights([
    {kind:"mcq",topic:"observation",answer:"A",outcome:"incorrect"},
    {kind:"mcq",topic:"observation",answer:"B",outcome:"correct"},
    {kind:"nat",topic:"spatial",answer:"",outcome:"unanswered"},
    {kind:"msq",topic:"ignored",answer:["A"],outcome:"dropped"},
    {kind:"drawing",topic:"drawing",answer:"notes",outcome:null},
  ]);
  assert.deepEqual(value.sections,[
    {key:"MCQ",total:2,answered:2,correct:1,accuracy:50},
    {key:"NAT",total:1,answered:0,correct:0,accuracy:null},
  ]);
  assert.equal(value.recommended.key,"observation");
  assert.equal(value.topics.some(item=>item.key==="drawing"||item.key==="ignored"),false);
});

test("weakest answered topic becomes the deterministic recommendation",()=>{
  const value=buildAttemptInsights([
    {kind:"mcq",topic:"visual",answer:"A",outcome:"correct"},
    {kind:"mcq",topic:"spatial",answer:"A",outcome:"incorrect"},
    {kind:"nat",topic:"spatial",answer:"2",outcome:"incorrect"},
  ]);
  assert.deepEqual(value.recommended,{key:"spatial",total:2,answered:2,correct:0,accuracy:0});
});

test("sealed outcomes and unanswered full-mark items cannot inflate reported accuracy", () => {
  const result = buildAttemptInsights([
    { kind: "mcq", topic: "sealed", answer: "A" },
    { kind: "mcq", topic: "layout", answer: "A", outcome: "correct" },
    { kind: "nat", topic: "layout", answer: null, outcome: "full_marks" },
  ]);
  assert.deepEqual(result.topics, [{ key: "layout", total: 2, answered: 1, correct: 1, accuracy: 100 }]);
});
