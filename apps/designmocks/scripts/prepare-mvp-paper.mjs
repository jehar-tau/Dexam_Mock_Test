import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { collectCanonicalMedia, readCanonicalAsset } from "./private-bank-media.mjs";
import { loadFromGit, sha256, stableJson } from "./question-bank-import.mjs";
import { RULES_2027, runtimeQuestion } from "./question-runtime.mjs";
import { validateOperationsConfiguration } from "./operations-sweep.mjs";

const digest = /^[a-f0-9]{64}$/;
const commit = /^[a-f0-9]{40}$/;
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const maxPacketBytes = 4 * 1024 * 1024;
const same = (left, right) => stableJson(left) === stableJson(right);

export async function compileMvpPaper(packet, expectedSha, canonical, mediaRoot) {
  const { manifestSha256, ...body } = packet ?? {};
  if (!digest.test(expectedSha ?? "") || manifestSha256 !== expectedSha || sha256(stableJson(body)) !== expectedSha) {
    throw new Error("The packet does not match the separately reviewed SHA-256");
  }
  const { exam, title, durationSeconds, source, questions } = body;
  if (!["uceed", "ceed"].includes(exam) || body.format !== "dmocks-private-mvp-paper-v1" || body.part !== "A"
    || body.published !== false || body.salesEnabled !== false || body.hostedWritesPerformed !== false
    || body.sourceLabelsPreserved !== true || typeof title !== "string"
    || title.length < 2 || title.length > 180 || !/\bpart\s+a\b/i.test(title)) {
    throw new Error("An unpublished objective Part A packet is required");
  }
  if (!commit.test(source?.commit ?? "") || source.path !== canonical.sourcePath || source.sha256 !== canonical.sourceSha256
    || source.total !== canonical.sourceTotal || source.eligible !== canonical.eligibleTotal) {
    throw new Error("The current main bank does not match the reviewed packet source");
  }
  const rule = RULES_2027[exam];
  const counts = Object.fromEntries(Object.entries(rule.sections).map(([kind, section]) => [kind.toLowerCase(), section.count]));
  const order = Object.entries(counts).flatMap(([kind, count]) => Array(count).fill(kind));
  if (body.rulesVersion !== rule.version || durationSeconds !== rule.durationSeconds || !same(body.counts, counts)
    || !Array.isArray(questions) || questions.length !== order.length
    || new Set(questions.map(question => question?.externalKey)).size !== order.length) {
    throw new Error("The reviewed Part A counts, order and clock are required");
  }

  const bank = new Map(canonical.records.map(record => [record.externalKey, record]));
  const selected = questions.map((question, index) => {
    const record = bank.get(question?.externalKey);
    if (!record || record.exam !== exam || record.type.toLowerCase() !== order[index]
      || !Array.isArray(record.payload.holds) || record.payload.holds.length !== 0
      || question.ordinal !== index + 1 || question.contentSha256 !== record.contentSha256
      || question.originalLicenceLabel !== record.licence || !same(question.payload, record.payload)) {
      throw new Error("A selected question differs from its hold-free canonical record");
    }
    return record;
  });
  const digests = new Set(selected.flatMap(record => (record.payload.assets ?? []).map(asset => asset.sha256)));
  const assets = collectCanonicalMedia(canonical).filter(asset => digests.has(asset.sha256));
  const catalogue = [];
  for (const asset of assets) {
    if (!mediaRoot) throw new Error("Set DMOCKS_MEDIA_ROOT to the read-only canonical media root");
    let bytes;
    try { bytes = await readCanonicalAsset(mediaRoot, asset); }
    catch { throw new Error("A private canonical figure failed its byte or dimension check"); }
    catalogue.push({ ...asset, path: asset.storagePath, byteSize: bytes.length });
  }
  if (!same(body.media, catalogue)) throw new Error("The verified figure inventory differs from the reviewed packet");

  const records = selected.map((record, index) => {
    const runtime = runtimeQuestion(record.payload, { rule, mediaCatalog: catalogue });
    if (!runtime || !same(runtime, questions[index].runtime)) throw new Error("A selected question no longer compiles to its reviewed runtime");
    const { externalKey, contentSha256, licence, payload } = record;
    return { externalKey, contentSha256, licence, payload, runtime };
  });
  const totalPoints = records.reduce((total, record) => total + record.runtime.points, 0);
  if (body.totalPoints !== totalPoints) throw new Error("The total points differ from the reviewed packet");
  return {
    summary: { packetSha256: expectedSha, sourceSha256: canonical.sourceSha256, exam,
      durationSeconds, questionCount: records.length, totalPoints, figureCount: catalogue.length },
    plan: { packetSha256: expectedSha, sourceSha256: canonical.sourceSha256, title, exam, durationSeconds,
      questions: records, media: catalogue.map(({ sha256, path, width, height, byteSize }) => ({ sha256, path, width, height, byteSize })) },
  };
}

export async function stageMvpPaper({ plan, summary }, config, fetchImpl = fetch) {
  const { origin } = validateOperationsConfiguration(config, "PREPARE_UNPUBLISHED_MVP_PAPER_ON");
  const host = new URL(origin).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !/^[a-z0-9]{20}\.supabase\.co$/.test(host)) {
    throw new Error("Paper preparation requires an approved Supabase project or loopback fixture");
  }
  let response;
  try {
    response = await fetchImpl(`${origin}/rest/v1/rpc/prepare_mvp_paper`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(30000),
      headers: { apikey: config.key, authorization: `Bearer ${config.key}`, "content-type": "application/json" },
      body: JSON.stringify({ p_plan: plan }),
    });
  } catch {
    throw new Error("The private paper preparation endpoint could not be reached");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new Error(`The private target rejected paper preparation (HTTP ${response.status})`);
  }
  const receipt = await response.json().catch(() => null);
  if (!uuid.test(receipt?.paperId ?? "") || !digest.test(receipt.manifestSha256 ?? "")
    || receipt.packetSha256 !== summary.packetSha256 || receipt.questionCount !== summary.questionCount
    || receipt.durationSeconds !== summary.durationSeconds || receipt.totalPoints !== summary.totalPoints
    || typeof receipt.created !== "boolean") throw new Error("The private target returned an invalid paper receipt");
  return { paperId: receipt.paperId, manifestSha256: receipt.manifestSha256, created: receipt.created };
}

async function main() {
  const { values } = parseArgs({ options: { packet: { type: "string" }, expect: { type: "string" }, apply: { type: "boolean" } } });
  if (!values.packet || !digest.test(values.expect ?? "")) throw new Error("Provide --packet and the reviewed --expect SHA-256");
  let packet;
  try {
    const info = await stat(values.packet);
    if (!info.isFile() || info.size > maxPacketBytes) throw new Error();
    packet = JSON.parse(await readFile(values.packet, "utf8"));
  } catch {
    throw new Error("The private packet is unreadable or exceeds the supported size");
  }
  let canonical;
  try { canonical = loadFromGit("origin/main"); }
  catch { throw new Error("The canonical bank cannot be read from origin/main"); }
  const env = process.env;
  const compiled = await compileMvpPaper(packet, values.expect, canonical, env.DMOCKS_MEDIA_ROOT);
  const receipt = values.apply ? await stageMvpPaper(compiled, {
    url: env.DMOCKS_SUPABASE_URL, key: env.DMOCKS_SUPABASE_SERVICE_ROLE_KEY,
    allowOrigin: env.DMOCKS_PAPER_ALLOW_ORIGIN, environment: env.DMOCKS_PAPER_ENVIRONMENT,
    productionAck: env.DMOCKS_PAPER_PRODUCTION_ACK,
  }) : {};
  console.log(JSON.stringify({ mode: values.apply ? "prepared-unpublished" : "dry-run", ...compiled.summary, ...receipt }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // The compiler uses fixed messages. Unexpected filesystem/provider diagnostics stay private.
    console.error(error instanceof TypeError ? "The paper preparation configuration is invalid" : error.message);
    process.exitCode = 1;
  });
}
