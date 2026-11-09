import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { compileMvpPaper, stageMvpPaper, syncMvpPaperInputs } from "../scripts/prepare-mvp-paper.mjs";
import { collectCanonicalMedia } from "../scripts/private-bank-media.mjs";
import { buildManifest, sha256, stableJson } from "../scripts/question-bank-import.mjs";
import { RULES_2027, runtimeQuestion } from "../scripts/question-runtime.mjs";

const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlWKzQAAAAASUVORK5CYII=", "base64");
function sign(packet) {
  const { manifestSha256, ...body } = packet;
  return { ...body, manifestSha256: sha256(stableJson(body)) };
}
async function fixture(t, exam = "uceed", includeUnselected = false) {
  const root = await mkdtemp(join(tmpdir(), "dmocks-paper-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "figure.png"), image);
  const rule = RULES_2027[exam];
  const bankQuestions = Object.entries(rule.sections).flatMap(([type, section]) =>
    Array.from({ length: section.count }, (_, index) => ({
      externalKey: `fictional-${type}-${index}`, type, topic: "test", licence: "owner-provided",
      prompt: `Original fictional ${type} prompt ${index}`, provenance: { exam }, holds: [],
      options: type === "NAT" ? [] : ["A", "B", "C", "D"].map(key => ({ key, text: `Option ${key}` })),
      answer: { raw: type === "NAT" ? "0.25" : "A", status: "reviewed" },
      assets: type === "NAT" && index === 0 ? [{ path: "figure.png", sha256: sha256(image), width: 1, height: 1 }] : [],
    })));
  const unselected = { ...bankQuestions[0], externalKey: "fictional-unselected",
    assets: [{ path: "unselected.png", sha256: "f".repeat(64), width: 1, height: 1 }] };
  const canonical = buildManifest({ schemaVersion: 1, questions: includeUnselected ? [...bankQuestions, unselected] : bankQuestions }, "a".repeat(40));
  const selected = canonical.records.slice(0, bankQuestions.length);
  const media = collectCanonicalMedia({ records: selected }).map(asset => ({ ...asset, path: asset.storagePath, byteSize: image.length }));
  const questions = selected.map(({ externalKey, contentSha256, licence, payload }, index) => ({
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

const syncOrigin = "http://127.0.0.1:55421";
const syncTarget = { url: syncOrigin, allowOrigin: syncOrigin, environment: "staging", key: "sb_secret_fictional_fixture" };
const settingsPath = "/rest/v1/launch_settings";
const runtimePath = "/rest/v1/rpc/upsert_question_bank_runtime_batch";

function syncTransport(compiled, { mode = "test", changesAfterUpload = false, existing = false, corrupt = false,
  runtimeCount = compiled.plan.questions.length } = {}) {
  const calls = [];
  let settingsReads = 0;
  const asset = compiled.mediaPlan.assets[0];
  const fetchImpl = async (address, request) => {
    const url = new URL(address);
    assert.equal(url.origin, syncOrigin);
    assert.equal(request.redirect, "error");
    assert.equal(request.headers.get("apikey"), syncTarget.key);
    assert.equal(request.headers.has("authorization"), false);
    const method = request.method ?? "GET";
    calls.push(`${method} ${url.pathname}`);
    switch (url.pathname) {
      case "/rest/v1/rpc/admin_operational_health":
        return Response.json({ scope: "paid-mvp-v1", monitorVersion: 1, apiProfileReady: true });
      case settingsPath:
        assert.equal(method, "GET");
        assert.equal(url.searchParams.get("singleton"), "eq.true");
        settingsReads++;
        return Response.json([{ sales_enabled: changesAfterUpload && settingsReads === 2, environment_mode: mode }]);
      case "/storage/v1/bucket/paper-media":
        return Response.json({ public: false, allowed_mime_types: ["image/png"], file_size_limit: 10 * 1024 * 1024 });
      case `/storage/v1/object/paper-media/${asset.storagePath}`:
        return method === "POST"
          ? Response.json(existing ? { message: "already exists", statusCode: 409 } : { Key: asset.storagePath }, { status: existing ? 409 : 200 })
          : new Response(corrupt ? Buffer.concat([image, Buffer.of(0)]) : image);
      case "/rest/v1/rpc/register_bank_media_assets":
        assert.deepEqual(JSON.parse(request.body), { p_records: [{ sha256: asset.sha256, storagePath: asset.storagePath,
          width: asset.width, height: asset.height, byteSize: image.length }] });
        return Response.json(1);
      case runtimePath:
        assert.deepEqual(JSON.parse(request.body), { p_records: compiled.plan.questions.map(({ externalKey, contentSha256, runtime }) =>
          ({ externalKey, contentSha256, runtime })) });
        return Response.json(runtimeCount);
      default:
        assert.fail("Unexpected paper sync request");
    }
  };
  return { calls, fetchImpl };
}

test("sync uploads only the exact packet figures and records only its runtime with verified existing bytes on replay", async t => {
  const { packet, canonical, root } = await fixture(t, "uceed", true);
  const compiled = await compileMvpPaper(packet, packet.manifestSha256, canonical, root);
  assert.equal(canonical.records.length, 58);
  assert.equal(compiled.mediaPlan.assets.length, 1);
  assert.equal(compiled.mediaPlan.totalBytes, image.length);
  for (const existing of [false, true]) {
    const transport = syncTransport(compiled, { existing });
    assert.deepEqual(await syncMvpPaperInputs(compiled, syncTarget, root, transport.fetchImpl), {
      figuresRegistered: 1, figuresUploaded: existing ? 0 : 1, figuresReused: existing ? 1 : 0, runtimeRecorded: 57,
    });
    const asset = `/storage/v1/object/paper-media/${compiled.mediaPlan.assets[0].storagePath}`;
    assert.deepEqual(transport.calls.filter(call => call.includes("/object/")), [`POST ${asset}`, `GET ${asset}`]);
    assert.deepEqual(transport.calls.slice(-3), ["POST /rest/v1/rpc/register_bank_media_assets", `GET ${settingsPath}`, `POST ${runtimePath}`]);
  }
});

test("sync rejects a foreign target, a Live target and a sales change before runtime registration", async t => {
  const { packet, canonical, root } = await fixture(t);
  const compiled = await compileMvpPaper(packet, packet.manifestSha256, canonical, root);
  const live = syncTransport(compiled, { mode: "live" });
  await assert.rejects(syncMvpPaperInputs(compiled, { ...syncTarget, allowOrigin: "https://wrong.invalid" }, root, live.fetchImpl), /exactly match/);
  await assert.rejects(syncMvpPaperInputs(compiled, { ...syncTarget, environment: "production" }, root, live.fetchImpl), /acknowledgement/);
  assert.deepEqual(live.calls, []);
  await assert.rejects(syncMvpPaperInputs(compiled, syncTarget, root, live.fetchImpl), /Test target with sales closed/);
  assert.deepEqual(live.calls, ["POST /rest/v1/rpc/admin_operational_health", `GET ${settingsPath}`]);
  const switched = syncTransport(compiled, { changesAfterUpload: true });
  await assert.rejects(syncMvpPaperInputs(compiled, syncTarget, root, switched.fetchImpl), /Test target with sales closed/);
  assert.equal(switched.calls.at(-1), `GET ${settingsPath}`);
  assert.ok(!switched.calls.some(call => call.endsWith(runtimePath)));
});

test("sync stops on an incorrect figure download and rejects an incomplete runtime acknowledgement", async t => {
  const { packet, canonical, root } = await fixture(t);
  const compiled = await compileMvpPaper(packet, packet.manifestSha256, canonical, root);
  const corrupt = syncTransport(compiled, { corrupt: true });
  await assert.rejects(syncMvpPaperInputs(compiled, syncTarget, root, corrupt.fetchImpl), /could not verify or register/);
  assert.ok(!corrupt.calls.some(call => call.endsWith(runtimePath) || call.includes("register_bank_media_assets")));
  const incomplete = syncTransport(compiled, { runtimeCount: 56 });
  await assert.rejects(syncMvpPaperInputs(compiled, syncTarget, root, incomplete.fetchImpl), /incomplete paper runtime receipt/);
});
