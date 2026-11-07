import test from "node:test";
import assert from "node:assert/strict";
import { learningPracticeLink, practicePools, practiceSelection } from "../src/practice-context.js";

const catalog = [
  { exam: "uceed", topic: "observation", questions: 40 },
  { exam: "ceed", topic: "observation", questions: 20 },
  { exam: "ceed", topic: "visual-hierarchy", questions: 10 },
  { exam: "nift", topic: "general-aptitude", questions: 30 },
  { exam: "ceed", topic: "small-pool", questions: 9 },
];

test("lesson practice links preserve exam and exact topic through URL encoding", () => {
  const topic = "line & space / colour? + figure=2";
  const link = learningPracticeLink({ exam: "ceed", topic });
  const url = new URL(link.to, "https://example.invalid");
  assert.equal(url.pathname, "/dashboard/practice");
  assert.deepEqual([...url.searchParams], [["exam", "ceed"], ["topic", topic]]);
  assert.equal(link.label, "Practise this topic");
});

test("lessons without a usable scalar context offer browsing without inventing an exam", () => {
  for (const topic of ["", "  ", null, undefined, ["observation"]]) {
    assert.deepEqual(learningPracticeLink({ exam: "ceed", topic }), { to: "/dashboard/practice?exam=ceed", label: "Browse practice" });
  }
  for (const exam of ["all", "unknown", null, undefined, ["uceed", "ceed"]]) {
    assert.deepEqual(learningPracticeLink({ exam, topic: "observation" }), { to: "/dashboard/practice", label: "Browse practice" });
  }
});

test("an exam-specific lesson selects its own pool despite a larger matching topic in another exam", () => {
  assert.deepEqual(practiceSelection(catalog, { exam: "ceed", topic: "observation" }), { exam: "ceed", topic: "observation", notice: "" });
  assert.deepEqual(practiceSelection(catalog, { exam: "ceed" }), { exam: "ceed", topic: "observation", notice: "" });
});

test("missing and undersized requested topics never substitute another topic or exam", () => {
  for (const topic of ["not-ready", "small-pool", "general-aptitude"]) {
    const selection = practiceSelection(catalog, { exam: "ceed", topic });
    assert.equal(selection.exam, "ceed");
    assert.equal(selection.topic, "");
    assert.match(selection.notice, /not ready for CEED/);
  }
  const absentExam = practiceSelection(catalog, { exam: "nid", topic: "observation" });
  assert.equal(absentExam.exam, "");
  assert.equal(absentExam.topic, "");
  assert.match(absentExam.notice, /NID is not ready/);
});

test("topic-only result links select a unique exam and require a choice when the topic is shared", () => {
  assert.deepEqual(practiceSelection(catalog, { topic: "general-aptitude" }), { exam: "nift", topic: "general-aptitude", notice: "" });
  const shared = practiceSelection(catalog, { topic: "observation" });
  assert.equal(shared.exam, "");
  assert.equal(shared.topic, "");
  assert.match(shared.notice, /several exams/);
  const absent = practiceSelection(catalog, { topic: "missing" });
  assert.equal(absent.exam, "");
  assert.equal(absent.topic, "");
  assert.match(absent.notice, /not ready/);
});

test("invalid exam context does not become a topic-only match or default selection", () => {
  for (const exam of ["unknown", "uceed,ceed", ["uceed", "ceed"]]) {
    const selection = practiceSelection(catalog, { exam, topic: "observation" });
    assert.equal(selection.exam, "");
    assert.equal(selection.topic, "");
    assert.match(selection.notice, /exam is unavailable/);
  }
  const malformedTopic = practiceSelection(catalog, { exam: "ceed", topic: ["observation"] });
  assert.equal(malformedTopic.exam, "");
  assert.equal(malformedTopic.topic, "");
  assert.match(malformedTopic.notice, /topic is unavailable/);
});

test("generic browsing starts with a ready pool and excludes unusable catalogue entries", () => {
  const values = [{ exam: "uceed", topic: "small", questions: 9 }, ...catalog,
    { exam: "unknown", topic: "observation", questions: 100 },
    { exam: "ceed", topic: "", questions: 100 },
    { exam: "ceed", topic: "wrong-count", questions: "40" }];
  assert.deepEqual(practiceSelection(values), { exam: "uceed", topic: "observation", notice: "" });
  assert.deepEqual(practicePools(values, 20), [catalog[0], catalog[1], catalog[3]]);
  assert.deepEqual(practiceSelection([]), { exam: "", topic: "", notice: "" });
  assert.equal(values[0].questions, 9);
});
