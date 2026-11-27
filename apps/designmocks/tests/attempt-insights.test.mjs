import test from "node:test";
import assert from "node:assert/strict";
import { buildAttemptInsights, reviewMarks, knownMarks, roundMarks, displayMarks } from "../src/attempt-insights.mjs";

test("released attempt insights exclude drawings and dropped questions",()=>{
  const value=buildAttemptInsights([
    {kind:"mcq",topic:"observation",answer:"A",outcome:"incorrect"},
    {kind:"mcq",topic:"observation",answer:"B",outcome:"correct"},
    {kind:"nat",topic:"spatial",answer:"",outcome:"unanswered"},
    {kind:"msq",topic:"ignored",answer:["A"],outcome:"dropped"},
    {kind:"drawing",topic:"drawing",answer:"notes",outcome:null},
  ]);
  assert.deepEqual(value.sections.map(({key,total,answered,correct,accuracy})=>({key,total,answered,correct,accuracy})),[
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

import { responseSummary } from "../src/attempt-insights.mjs";
import { releasedKeyLabel } from "../src/answer-key.js";
import { createPreviewPaper, previewPaperId } from "../src/preview-paper.mjs";

test("response breakdown preserves partial credit, skipped and awarded responses and excludes sealed results", () => {
  const rows = [
    {kind:"mcq",outcome:"correct",answer:"A"}, {kind:"msq",outcome:"partial",answer:["A"]},
    {kind:"mcq",outcome:"incorrect",answer:"B"}, {kind:"nat",outcome:"full_marks",answer:null},
    {kind:"nat",outcome:"unanswered",answer:null}, {kind:"nat",outcome:"dropped",answer:null},
    {kind:"drawing",outcome:"self_review",answer:"note"}, {kind:"mcq",answer:"A"},
  ];
  assert.deepEqual(responseSummary(rows),{total:5,answered:3,accuracy:33,counts:{correct:1,wrong:1,partial:1,unanswered:1,full_marks:1,dropped:0}});
});
test("review exposes single and multiple reviewed keys without losing decimal precision", () => {
  assert.equal(releasedKeyLabel({kind:"mcq",correct:["B"]}),"B");
  assert.equal(releasedKeyLabel({kind:"msq",correct:["A","D"]}),"A, D");
  assert.equal(releasedKeyLabel({kind:"nat",accepted:[{range:["0.0000000000001","0.0000000000002"]}]}),"0.0000000000001 to 0.0000000000002");
  assert.equal(releasedKeyLabel(null),null);
});
test("original preview paper holds its clock on reload, grades saved revisions and locks at its deadline", async () => {
  const map = new Map(), storage = {getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)};
  let time = Date.parse("2026-01-01T12:00:00Z");
  const options = {storage,now:()=>time};
  const paper = createPreviewPaper(options);
  const first = (await paper.readAttempt()).data;
  assert.equal(first.id, previewPaperId);
  assert.equal(first.questions.length, 6);
  assert.ok(first.questions.every(q => !Object.hasOwn(q,"correctKey")));
  const save = (p_question_id, p_answer, p_revision) => paper.rpc("save_answer_revision",{p_question_id,p_answer,p_revision});
  await save("tiles","9",2);
  assert.equal((await save("tiles","0",1)).accepted,false);
  await save("turn",["A"],3);
  await save("mirror","A",4);
  time += 5000;
  const resumed = (await createPreviewPaper(options).readAttempt()).data;
  assert.equal(resumed.deadline,first.deadline);
  assert.equal(resumed.questions[0].answer,"9");
  const example = (await createPreviewPaper({...options,example:true}).readAttempt()).data;
  assert.equal(example.status,"submitted");
  assert.equal((await paper.readAttempt()).data.status,"active");
  time = Date.parse(first.deadline);
  const result = (await paper.readAttempt()).data;
  assert.equal(result.status,"submitted");
  assert.equal(result.score,4);
  assert.deepEqual(result.questions.map(q=>q.outcome),["correct","unanswered","partial","unanswered","wrong","unanswered"]);
  await assert.rejects(save("tiles","3",5));
  assert.equal((await createPreviewPaper(options).readAttempt()).data.score,result.score);
});

test("review marks come only from the released outcome and the question's own marking", () => {
  const marking = { correct: 4, wrong: -1 };
  assert.equal(reviewMarks({ kind: "mcq", outcome: "correct", marking }), "+4");
  assert.equal(reviewMarks({ kind: "mcq", outcome: "incorrect", marking }), "−1");
  assert.equal(reviewMarks({ kind: "nat", outcome: "wrong", marking: { correct: 4, wrong: 0 } }), "0");
  assert.equal(reviewMarks({ kind: "mcq", outcome: "unanswered", marking }), "0");
  assert.equal(reviewMarks({ kind: "msq", outcome: "partial", marking }), null);
  assert.equal(reviewMarks({ kind: "mcq", outcome: "full_marks", points: 3 }), "+3");
  assert.equal(reviewMarks({ kind: "mcq", outcome: "wrong" }), null);
  assert.equal(reviewMarks({ kind: "drawing", outcome: "correct", marking }), null);
});

test("section marks add exact marks and flag partial credit until the server sends it", () => {
  const m = { correct: 4, wrong: -1 };
  const questions = [
    { kind: "mcq", outcome: "correct", answer: "A", marking: m },
    { kind: "mcq", outcome: "incorrect", answer: "B", marking: m },
    { kind: "mcq", outcome: "unanswered", answer: null, marking: m },
    { kind: "msq", outcome: "correct", answer: ["A"], marking: { correct: 4, wrong: -1, partial: true } },
    { kind: "msq", outcome: "partial", answer: ["A"], marking: { correct: 4, wrong: -1, partial: true } },
  ];
  const { sections } = buildAttemptInsights(questions);
  const mcq = sections.find(row => row.key === "MCQ"), msq = sections.find(row => row.key === "MSQ");
  assert.deepEqual([mcq.marks, mcq.available, mcq.partialPending], [3, 12, 0]);
  assert.deepEqual([msq.marks, msq.marksExcludingPartial, msq.partialPending], [null, 4, 1]);
  const withServer = buildAttemptInsights(questions.map((q, i) => i === 4 ? { ...q, awarded: 2 } : q)).sections.find(row => row.key === "MSQ");
  assert.equal(withServer.marks, 6);
  assert.equal(knownMarks({ kind: "msq", outcome: "partial", awarded: 1.5 }), 1.5);
  assert.equal(reviewMarks({ kind: "msq", outcome: "partial", awarded: 2 }), "+2");
});

test("section marks round away floating-point error from fractional negative marks", () => {
  const m = { correct: 3, wrong: -0.71 };
  const questions = [{ kind: "mcq", outcome: "correct", answer: "A", marking: m },
    ...Array.from({ length: 5 }, () => ({ kind: "mcq", outcome: "incorrect", answer: "B", marking: m }))];
  const mcq = buildAttemptInsights(questions).sections.find(row => row.key === "MCQ");
  assert.equal(3 + 5 * -0.71 === -0.55, false);
  assert.equal(mcq.marks, -0.55);
  assert.equal(mcq.marksExcludingPartial, -0.55);
  assert.equal(roundMarks(-0.004), 0);
  assert.ok(!Object.is(roundMarks(-0.004), -0));
  assert.equal(roundMarks(0.1 + 0.2), 0.3);
});

test("displayed scores round floating-point sums and leave missing values alone", () => {
  assert.equal(displayMarks(61.33333333), 61.33);
  assert.equal(displayMarks(3 + 5 * -0.71), -0.55);
  assert.equal(displayMarks("142"), 142);
  assert.equal(displayMarks(null), null);
  assert.equal(displayMarks(undefined), undefined);
});
