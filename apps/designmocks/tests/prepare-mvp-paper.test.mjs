import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { compileMvpPaper, stageMvpPaper } from "../scripts/prepare-mvp-paper.mjs";
import { collectCanonicalMedia } from "../scripts/private-bank-media.mjs";
import { buildManifest, sha256, stableJson } from "../scripts/question-bank-import.mjs";
import { RULES_2027, runtimeQuestion } from "../scripts/question-runtime.mjs";

const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlWKzQAAAAASUVORK5CYII=", "base64");
function sign(packet) {
  const { manifestSha256, ...body } = packet;
  return { ...body, manifestSha256: sha256(stableJson(body)) };
}
async function fixture(t, exam = "uceed") {
  const root = await mkdtemp(join(tmpdir(), "dmocks-paper-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "figure.png"), image);
  const rule = RULES_2027[exam];
  const canonical = buildManifest({ schemaVersion: 1, questions: Object.entries(rule.sections).flatMap(([type, section]) =>
    Array.from({ length: section.count }, (_, index) => ({
      externalKey: `fictional-${type}-${index}`, type, topic: "test", licence: "owner-provided",
      prompt: `Original fictional ${type} prompt ${index}`, provenance: { exam }, holds: [],
      options: type === "NAT" ? [] : ["A", "B", "C", "D"].map(key => ({ key, text: `Option ${key}` })),
      answer: { raw: type === "NAT" ? "0.25" : "A", status: "reviewed" },
      assets: type === "NAT" && index === 0 ? [{ path: "figure.png", sha256: sha256(image), width: 1, height: 1 }] : [],
    }))),
  }, "a".repeat(40));
  const media = collectCanonicalMedia(canonical).map(asset => ({ ...asset, path: asset.storagePath, byteSize: image.length }));
  const questions = canonical.records.map(({ externalKey, contentSha256, licence, payload }, index) => ({
    externalKey, contentSha256, ordinal: index + 1, originalLicenceLabel: licence, payload: structuredClone(payload),
    runtime: runtimeQuestion(payload, { rule, mediaCatalog: media }),
  }));
  const packet = sign({
    exam, part: "A", title: `${exam.toUpperCase()} Part A fictional paper`, format: "dmocks-private-mvp-paper-v1",
    rulesVersion: rule.version, durationSeconds: rule.durationSeconds, sourceLabelsPreserved: true,
    published: false, salesEnabled: false, hostedWritesPerformed: false,
    source: { commit: canonical.sourceCommit, sha256: canonical.sourceSha256, path: canonical.sourcePath,
      eligible: canonical.eligibleTotal, total: canonical.sourceTotal },
    questions, counts: Object.fromEntries(Object.entries(rule.sections).map(([kind, section]) => [kind.toLowerCase(), section.count])),
    media, totalPoints: questions.reduce((total, question) => total + question.runtime.points, 0),
  });
  return { packet, canonical, root };
}

for (const [exam, questions, seconds, points] of [["uceed", 57, 7200, 200], ["ceed", 44, 3600, 150]]) {
  test(`compiles an exact reviewed ${exam.toUpperCase()} Part A packet and checks private image bytes`, async t => {
    const { packet, canonical, root } = await fixture(t, exam);
    const { plan, summary } = await compileMvpPaper(packet, packet.manifestSha256, canonical, root);
    assert.deepEqual(summary, { packetSha256: packet.manifestSha256, sourceSha256: canonical.sourceSha256, exam,
      durationSeconds: seconds, questionCount: questions, totalPoints: points, figureCount: 1 });
    assert.equal(plan.questions.length, questions);
    assert.deepEqual(plan.questions[0].runtime.key.accepted, [{ exact: "0.25" }]);
    assert.deepEqual(plan.media, [{ sha256: sha256(image), width: 1, height: 1, byteSize: image.length, path: `papers/canonical/${sha256(image)}.png` }]);
  });
}

test("rejects changed packet, source, order, question, key and inventory even with recomputed local hashes", async t => {
  const { packet, canonical, root } = await fixture(t);
  await assert.rejects(compileMvpPaper(packet, "f".repeat(64), canonical, root), /separately reviewed/);
  for (const [change, message] of [
    [value => { value.published = true; }, /unpublished/],
    [value => { value.source.sha256 = "e".repeat(64); }, /main bank/],
    [value => { value.questions[0].payload.holds.push("review"); }, /hold-free canonical record/],
    [value => { value.questions[0].ordinal = 2; }, /hold-free canonical record/],
    [value => { value.questions[1].externalKey = value.questions[0].externalKey; }, /counts, order and clock/],
    [value => { value.questions[0].runtime.key.accepted[0].exact = "9.5"; }, /reviewed runtime/],
    [value => { value.media[0].byteSize++; }, /figure inventory/],
  ]) {
    const changed = structuredClone(packet);
    change(changed);
    const signed = sign(changed);
    await assert.rejects(compileMvpPaper(signed, signed.manifestSha256, canonical, root), message);
  }
  const corrupt = Buffer.from(image);
  corrupt[30] ^= 1;
  await writeFile(join(root, "figure.png"), corrupt);
  await assert.rejects(compileMvpPaper(packet, packet.manifestSha256, canonical, root), /figure failed its byte or dimension check/);
});

test("preparation checks the target before sending the packet and only returns the verified receipt fields", async t => {
  const { packet, canonical, root } = await fixture(t);
  const compiled = await compileMvpPaper(packet, packet.manifestSha256, canonical, root);
  const target = "http://127.0.0.1:55421";
  const config = { url: target, allowOrigin: target, environment: "staging", key: "sb_secret_fictional_fixture" };
  const receipt = { paperId: "10000000-0000-4000-8000-000000000001", manifestSha256: "e".repeat(64), created: true };
  const health = { scope: "paid-mvp-v1", monitorVersion: 1, apiProfileReady: true };
  const sent = [];
  const fetchImpl = async (url, request) => {
    const path = new URL(url).pathname;
    sent.push(path);
    assert.equal(new URL(url).origin, target);
    assert.equal(request.redirect, "error");
    assert.equal(request.headers.get("apikey"), config.key);
    assert.equal(request.headers.has("authorization"), false);
    if (path.endsWith("/admin_operational_health")) {
      assert.deepEqual(JSON.parse(request.body), {});
      return Response.json(health);
    }
    assert.equal(path, "/rest/v1/rpc/prepare_mvp_paper");
    assert.deepEqual(JSON.parse(request.body), { p_plan: compiled.plan });
    return Response.json({ ...compiled.summary, ...receipt, privateField: "Fictional private payload" });
  };
  await assert.rejects(stageMvpPaper(compiled, { ...config, allowOrigin: "https://wrong.invalid" }, fetchImpl), /exactly match/);
  await assert.rejects(stageMvpPaper(compiled, { ...config, key: "sb_publishable_fake" }, fetchImpl), /server-only/);
  await assert.rejects(stageMvpPaper(compiled, { ...config, environment: "production" }, fetchImpl), /acknowledgement/);
  await assert.rejects(stageMvpPaper(compiled, { ...config, url: "https://wrong.invalid", allowOrigin: "https://wrong.invalid" }, fetchImpl), /approved Supabase/);
  assert.deepEqual(sent, []);
  assert.deepEqual(await stageMvpPaper(compiled, config, fetchImpl), receipt);
  assert.deepEqual(sent, ["/rest/v1/rpc/admin_operational_health", "/rest/v1/rpc/prepare_mvp_paper"]);
  const then = reply => async url => url.endsWith("/admin_operational_health") ? Response.json(health) : reply();
  await assert.rejects(stageMvpPaper(compiled, config, then(() => new Response("Private provider diagnostic", { status: 400 }))),
    { message: "The private target rejected paper preparation (HTTP 400)" });
  await assert.rejects(stageMvpPaper(compiled, config, then(() => Response.json({ ...receipt, ...compiled.summary, questionCount: 1 }))),
    /invalid paper receipt/);
});
