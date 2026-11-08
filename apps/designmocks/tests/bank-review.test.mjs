import test from "node:test";
import assert from "node:assert/strict";
import { bankReviewImages, bankSearchInput, conversionChecklist, deliveryAnswerLabel, initialBankFilters, questionUsage, sourceAnswerLabel } from "../src/bank-review.js";

test("bank searches trim wording, preserve literal wildcard characters and start new filters at page one", () => {
  assert.deepEqual(bankSearchInput({ ...initialBankFilters, exam: "ceed", type: "NAT", topic: " spatial ", search: " 50%_key ", limit: "50" }), {
    p_exam: "ceed", p_type: "NAT", p_status: "pending", p_topic: "spatial", p_search: "50%_key", p_limit: 50, p_offset: 0,
  });
  assert.deepEqual(bankSearchInput(initialBankFilters, 25), {
    p_exam: null, p_type: null, p_status: "pending", p_topic: null, p_search: null, p_limit: 25, p_offset: 25,
  });
});

test("source answers retain pending verification and decimal precision", () => {
  assert.equal(sourceAnswerLabel({ raw: "2.000000000000000001", status: "pending" }), "2.000000000000000001 · pending verification");
  assert.equal(sourceAnswerLabel({ raw: ["A", "C"], status: "human-reviewed" }), "A, C");
  assert.equal(sourceAnswerLabel("B"), "B");
  assert.equal(sourceAnswerLabel(0), "0");
  for (const value of [null, {}, { raw: "  " }]) assert.equal(sourceAnswerLabel(value), "Awaiting verification");
});

test("delivery keys distinguish exact numeric answers, ranges, choices and human marking", () => {
  assert.equal(deliveryAnswerLabel({ kind: "nat", accepted: [{ exact: "2.000000000000000001" }, { range: ["3.01", "3.09"] }] }), "2.000000000000000001 or 3.01 to 3.09");
  assert.equal(deliveryAnswerLabel({ kind: "msq", correct: ["A", "D"] }), "A, D");
  assert.equal(deliveryAnswerLabel({ kind: "drawing" }), "Human review against the task rubric");
  assert.equal(deliveryAnswerLabel({ kind: "nat", accepted: [null] }), "Awaiting verification");
  assert.equal(deliveryAnswerLabel(null), "Awaiting conversion");
});

test("review figures must cover every canonical ordinal exactly once before they can be displayed", () => {
  const expected = [{ ordinal: 1 }, { ordinal: 2 }];
  const images = [{ ordinal: 2, url: "https://fixture.invalid/2" }, { ordinal: 1, url: "https://fixture.invalid/1" }];
  assert.deepEqual(bankReviewImages(images, expected).map(image => image.ordinal), [1, 2]);
  assert.equal(images[0].ordinal, 2);
  for (const result of [null, [], images.slice(0, 1), [images[0], images[0]], [images[0], { ordinal: 3, url: "x" }],
    [images[0], { ordinal: 1, url: "" }], [images[0], null]]) {
    assert.throws(() => bankReviewImages(result, expected), /figures are incomplete/);
  }
  assert.deepEqual(bankReviewImages([], []), []);
});

test("blocked questions explain their conversion work and proposed exam use", () => {
  const nid = { exam:"nid", type:"DESCRIPTIVE", runtimeReady:false, answer:null, options:[], media:[{available:false}] };
  assert.equal(questionUsage(nid).section,"DAT Prelims creative practice");
  assert.match(conversionChecklist(nid).map(item=>item.label).join(" "),/NID delivery blueprint/);
  assert.match(conversionChecklist(nid).map(item=>item.label).join(" "),/private question figure/);
  const nidChoices={...nid,type:'MCQ',answer:{raw:'A',status:'human-reviewed'},options:['A','B','C'].map(key=>({key,text:key})),media:[]};
  assert.deepEqual(conversionChecklist(nidChoices),[{state:'blocked',label:'Verify the NID delivery blueprint, timing and marking/rubric before conversion.'}]);
  const nift = { exam:"nift", type:"MCQ", runtimeReady:false, answer:{raw:"1",status:"verified"}, options:[1,2,3,4].map(key=>({key:String(key),text:String(key)})), media:[] };
  assert.equal(questionUsage(nift).section,"B.Des. GAT");
  assert.deepEqual(conversionChecklist(nift),[{state:"queue",label:"Run the verified runtime materializer, then review the exact converted version."}]);
  const ready = {...nift,runtimeReady:true,marking:{correct:1,wrong:-0.25}};
  assert.equal(conversionChecklist(ready)[0].state,"ready");
});
test('conversion guidance detects duplicate option keys and missing media even on an earlier converted version',()=>{
 const question={exam:'uceed',type:'MCQ',runtimeReady:false,answer:{raw:'A',status:'human-reviewed'},options:['A','A','C','D'].map(key=>({key,text:key})),media:[]};
 assert.ok(conversionChecklist(question).some(item=>/four uniquely labelled/.test(item.label)));
 const converted={...question,runtimeReady:true,options:['A','B','C','D'].map(key=>({key,text:key})),media:[{ordinal:1,available:false}]};
 assert.ok(conversionChecklist(converted).some(item=>/private question figure/.test(item.label)));
});
