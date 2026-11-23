// Local ingestion review page: answer checking, file guard, data merge and server rules.
// Every paper, key and solution here is fictional.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { request } from "node:http";
import { checkAnswer, describeKey, parseKey } from "../ingestion/review/answer-check.mjs";
import { createReviewServer, figureFile, listPapers, loadPaper } from "../ingestion/review/server.mjs";

test("answers are checked against keys in the bank's notation", () => {
  assert.equal(checkAnswer("16.8", "NAT", "16.8").result, "correct");
  assert.equal(checkAnswer("08", "NAT", "8").result, "correct");
  assert.equal(checkAnswer("470 to 480", "NAT", "476.2").result, "correct");
  assert.equal(checkAnswer("470 to 480", "NAT", "481").result, "wrong");
  assert.equal(checkAnswer("22 or 23", "NAT", "23").result, "correct");
  assert.equal(checkAnswer("16.8", "NAT", "sixteen").result, "not-a-number");
  assert.equal(checkAnswer("C", "MCQ", ["C"]).result, "correct");
  assert.equal(checkAnswer("A or B", "MCQ", ["B"]).result, "correct");
  assert.equal(checkAnswer("C", "MCQ", ["D"]).result, "wrong");
  assert.equal(checkAnswer("A,B,D", "MSQ", ["D", "B", "A"]).result, "correct");
  assert.equal(checkAnswer("A,B,D", "MSQ", ["A", "B"]).result, "partial");
  assert.equal(checkAnswer("A,B,D", "MSQ", ["A", "C"]).result, "wrong");
  assert.equal(checkAnswer("B,C or B,C,D", "MSQ", ["B", "C", "D"]).result, "correct");
  assert.equal(checkAnswer("A,B", "MSQ", []).result, "unanswered");
  assert.equal(checkAnswer(null, "MCQ", ["A"]).result, "no-key");
  assert.equal(parseKey("seven", "NAT"), null);
  assert.equal(describeKey("470 to 480", "NAT"), "470 to 480");
  assert.equal(describeKey("B,C or B,C,D", "MSQ"), "B,C or B,C,D");
});

async function fictionalWork() {
  const work = await mkdtemp(path.join(tmpdir(), "ingestion-review-"));
  const base = path.join(work, "uceed-2031");
  for (const stage of ["02-segments", "03-figures/q1", "04-key", "05-solutions"]) await mkdir(path.join(base, stage), { recursive: true });
  await writeFile(path.join(base, "02-segments/questions.json"), JSON.stringify({ exam: "uceed", year: 2031, report: {}, questions: [
    { key: "q1", part: "A", number: 1, type: "NAT", prompt: "How many fictional squares?", options: [], flags: [] },
    { key: "q2", part: "A", number: 2, type: "MCQ", prompt: "Which fictional city?", flags: ["animated-figure"],
      options: [{ key: "A", text: "Alpha", box: [0, 0, 1, 1] }, { key: "B", text: "Beta", box: [0, 0, 1, 1] }] },
  ] }));
  await writeFile(path.join(base, "03-figures/q1/fig-1.png"), Buffer.from("89504e470d0a1a0a", "hex"));
  await writeFile(path.join(base, "03-figures/figures.json"), JSON.stringify({ questions: [
    { key: "q1", block: null, figures: [{ id: "q1-fig-1", role: "figure", canonical: { file: "q1/fig-1.png", width: 40, height: 20, source: "embedded", notes: [] },
      vector: { status: "failed", reasons: ["inkIou"] }, textInside: [] }] },
    { key: "q2", block: null, figures: [] }] }));
  await writeFile(path.join(base, "04-key/key.json"), JSON.stringify({ source: { name: "fictional-key.pdf" }, report: {}, keys: {
    q1: { raw: "12", printed: "12", status: "official-key", readBy: "text", bank: "not-in-bank" } } }));
  await writeFile(path.join(base, "05-solutions/q1.json"), JSON.stringify({ schema: 1, answer: { value: "12" }, keyIdea: "Count rows.", steps: [{ text: "3 × 4 = 12." }] }));
  await writeFile(path.join(base, "05-solutions/q1.visual.json"), JSON.stringify({ schema: 1, answer: { value: "12" }, keyIdea: "Watch the rows fill.", steps: [{ text: "3 × 4 = 12.", overlay: "rows", motion: [{ target: "rows", type: "draw" }] }] }));
  await writeFile(path.join(base, "05-solutions/check.json"), JSON.stringify({ byStatus: { draft: 2 }, results: { q1: { status: "draft", errors: [], warnings: [] }, "q1.visual": { status: "draft", errors: [], warnings: [] } } }));
  await writeFile(path.join(work, "secret.txt"), "not a figure");
  await mkdir(path.join(work, "not-a-paper"));
  return work;
}

test("every stage's output is merged into one record per question", async () => {
  const work = await fictionalWork();
  try {
    assert.deepEqual(await listPapers(work), [{ id: "uceed-2031", stages: ["02-segments", "03-figures", "04-key", "05-solutions"] }]);
    const paper = await loadPaper(work, "uceed-2031");
    const [q1, q2] = paper.questions;
    assert.equal(paper.keySource, "fictional-key.pdf");
    assert.equal(q1.officialKey.raw, "12");
    assert.equal(q1.solution.answer.value, "12");
    assert.equal(q1.solutionCheck.status, "draft");
    assert.equal(q1.visual.keyIdea, "Watch the rows fill.");  // a visual version is kept beside the draft
    assert.equal(q1.visualCheck.status, "draft");
    assert.equal(q2.visual, null);
    assert.deepEqual(q1.figures[0].vector, { status: "failed", reasons: ["inkIou"] });
    assert.equal(q2.officialKey, null);
    assert.equal(q2.solution, null);
    assert.deepEqual(q2.options, [{ key: "A", text: "Alpha" }, { key: "B", text: "Beta" }]);
    assert.equal(await loadPaper(work, "../uceed-2031"), null);
    assert.equal(await loadPaper(work, "ceed-2031"), null);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test("only stage 3 images can be read, never anything outside them", async () => {
  const work = await fictionalWork();
  try {
    assert.ok((await figureFile(work, "uceed-2031", "q1/fig-1.png")).endsWith(path.join("03-figures", "q1", "fig-1.png")));
    for (const relative of ["../02-segments/questions.json", "q1/../../04-key/key.json", "/etc/passwd", "q1/fig-1.json", "q1/missing.png"]) {
      assert.equal(await figureFile(work, "uceed-2031", relative), null, relative);
    }
    await symlink(path.join(work, "secret.txt"), path.join(work, "uceed-2031/03-figures/q1/leak.png"));
    assert.equal(await figureFile(work, "uceed-2031", "q1/leak.png"), null);
    assert.equal(await figureFile(work, "../uceed-2031", "q1/fig-1.png"), null);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test("the server answers only local, read-only requests", async () => {
  const work = await fictionalWork();
  const server = createReviewServer({ work, port: 0 });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  // The allowed host list is built for the configured port, so rebuild with the real one.
  server.close();
  const live = createReviewServer({ work, port });
  await new Promise(resolve => live.listen(port, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${port}`;
  try {
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /INGESTION REVIEW · LOCAL ONLY/);
    assert.match(page.headers.get("content-security-policy"), /default-src 'self'/);
    const papers = await (await fetch(`${base}/api/papers`)).json();
    assert.deepEqual(papers.map(p => p.id), ["uceed-2031"]);
    assert.equal((await fetch(`${base}/api/papers/uceed-2031`)).status, 200);
    assert.equal((await fetch(`${base}/figures/uceed-2031/q1/fig-1.png`)).headers.get("content-type"), "image/png");
    assert.equal((await fetch(`${base}/figures/uceed-2031/..%2F04-key%2Fkey.json`)).status, 404);
    assert.equal((await fetch(`${base}/api/papers/uceed-2031`, { method: "POST" })).status, 405);
    // fetch() will not send a forged Host header, so use a raw request (DNS rebinding looks like this).
    const forged = await new Promise((resolve, reject) => {
      request({ host: "127.0.0.1", port, path: "/api/papers", headers: { Host: `attacker.example:${port}` } }, response => resolve(response.statusCode))
        .on("error", reject).end();
    });
    assert.equal(forged, 403);
  } finally {
    live.close();
    await rm(work, { recursive: true, force: true });
  }
});
