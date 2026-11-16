import { execFileSync } from 'node:child_process';
import { mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildManifest, objectiveReady, sha256, stableJson, SOURCE_PATH } from './question-bank-import.mjs';
import { inspectRuntimeQuestion, RULES_2027 } from './question-runtime.mjs';
import { collectCanonicalMedia, readCanonicalAsset } from './private-bank-media.mjs';
import { verifyQuestionExportPacket } from '../src/question-export-packet.mjs';

function git(cwd, ...args) { return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd(); }
class BankAdditionError extends Error {}
function fail(message) { throw new BankAdditionError(message); }
function within(parent, candidate) { return candidate === parent || candidate.startsWith(parent + path.sep); }

async function readPacket({ packetPath, expected }) {
  if (!packetPath || !/^[a-f0-9]{64}$/.test(expected || '')) fail('A packet and its reviewed SHA-256 are required');
  const info = await stat(packetPath).catch(() => null);
  if (!info?.isFile() || info.size > 4 * 1024 * 1024) fail('Choose a readable question export packet of at most 4 MiB.');
  try {
    const input = JSON.parse(await readFile(packetPath, 'utf8'));
    return await verifyQuestionExportPacket(input, { contentSha256: expected });
  } catch {
    fail('The packet does not match the reviewed question checksum. Export the approved question again.');
  }
}

function registerFigure(byPath, asset) {
  const previous = byPath.get(asset.relativePath);
  if (previous && (previous.sha256 !== asset.sha256 || previous.width !== asset.width || previous.height !== asset.height)) {
    fail('Conflicting asset paths');
  }
  byPath.set(asset.relativePath, asset);
}

async function readFigure(asset, mediaRoot, downloadsDir) {
  if (mediaRoot) {
    try {
      return await readCanonicalAsset(mediaRoot, asset);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (downloadsDir) return readCanonicalAsset(downloadsDir, { ...asset, relativePath: `${asset.sha256}.png` });
  fail('Required figure is missing');
}

export function prepareAddition({ packetPath, expected, ...options }) {
  return prepareAdditions({ ...options, packets: [{ packetPath, expected }] });
}

export async function prepareAdditions({ packets, expectedSource, replaceExpected, output, mediaRoot, downloadsDir, cwd = process.cwd() }) {
  if (!Array.isArray(packets) || packets.length === 0 || !/^[a-f0-9]{40}$/.test(expectedSource || '')) {
    fail('Reviewed packets and a full source commit are required');
  }
  const single = packets.length === 1;
  if (replaceExpected !== undefined && !single) fail('Prepare a correction with one reviewed packet');
  const source = git(cwd, 'rev-parse', '--verify', 'refs/remotes/origin/main^{commit}');
  if (source !== expectedSource) fail('origin/main does not match the expected source commit');
  const raw = execFileSync('git', ['show', `${source}:${SOURCE_PATH}`], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const bank = JSON.parse(raw);
  buildManifest(bank, source);

  const seen = new Set();
  const additions = [];
  const alreadyPresent = [];
  const byPath = new Map();
  for (const input of packets) {
    const { packet, payload } = await readPacket(input);
    const key = payload.externalKey;
    if (seen.has(key)) fail('External key appears more than once in the packet batch');
    seen.add(key);
    const index = bank.questions.findIndex(question => question.externalKey === key);
    const previous = bank.questions[index];
    if (replaceExpected !== undefined) {
      if (!/^[a-f0-9]{64}$/.test(replaceExpected) || !previous || sha256(stableJson(previous)) !== replaceExpected) {
        fail('The correction requires the current question version SHA-256');
      }
      if (stableJson(previous.holds) !== '[]') fail('Resolve canonical holds before preparing a correction');
      if (stableJson(previous.provenance) !== stableJson(payload.provenance) ||
          previous.licence !== payload.licence || previous.sourceKind !== payload.sourceKind) {
        fail('A correction must preserve question provenance and source labels');
      }
    }
    if (previous && stableJson(previous) === stableJson(payload)) {
      alreadyPresent.push(packet);
      continue;
    }
    if (previous && replaceExpected === undefined) fail('External key already exists in the source bank');
    const one = buildManifest({ schemaVersion: 1, questions: [payload] }, source);
    if (one.eligibleTotal !== 1) fail('Question is not eligible');
    if (!Array.isArray(payload.assets ?? []) || (payload.visualDependency && !payload.assets?.length)) fail('Required figure is missing');
    if ((payload.assets || []).length > 8) fail('Too many figures');
    // Each path needs verification even if another path contains the same bytes.
    const assets = (payload.assets || []).flatMap(asset => collectCanonicalMedia({
      records: [{ payload: { holds: [], assets: [asset] } }],
    }));
    for (const asset of assets) registerFigure(byPath, asset);
    additions.push({ packet, payload, assets, index, previous });
  }

  if (!additions.length) {
    return { mode: 'no-op', sourceCommit: source, ...(single ? {} : { added: 0, alreadyPresent: alreadyPresent.length }) };
  }
  for (const question of bank.questions) {
    if (!Array.isArray(question.assets)) continue;
    for (const existingAsset of question.assets) {
      const incoming = byPath.get(existingAsset?.path);
      if (incoming && (incoming.sha256 !== existingAsset.sha256 || incoming.width !== existingAsset.width || incoming.height !== existingAsset.height)) fail('Figure path conflicts with the source bank');
    }
  }
  const verifiedMedia = new Map();
  for (const asset of byPath.values()) {
    const bytes = await readFigure(asset, mediaRoot, downloadsDir);
    verifiedMedia.set(asset.relativePath, {
      sha256: asset.sha256, path: asset.storagePath, width: asset.width, height: asset.height, byteSize: bytes.length,
    });
  }
  if (Object.keys(bank).at(-1) !== 'questions') fail('Questions must be the final top-level key');
  const end = /\](\s*\}\s*)$/.exec(raw);
  if (!end) fail('Unsupported source layout');
  const expectedQuestions = bank.questions.slice();
  let proposed;
  if (replaceExpected !== undefined) {
    const { previous, payload, index } = additions[0];
    // Preserve the original bytes around the exact current record.
    const indentRecord = record => JSON.stringify(record, null, 1).replaceAll('\n', '\n  ');
    const block = [indentRecord(previous), JSON.stringify(previous)].find(candidate => raw.includes(candidate));
    if (!block) fail('Cannot locate the exact source record');
    const location = raw.indexOf(block);
    if (location < 0 || raw.indexOf(block, location + block.length) >= 0) fail('Cannot locate the exact source record');
    proposed = raw.slice(0, location) + indentRecord(payload) + raw.slice(location + block.length);
    expectedQuestions[index] = payload;
  } else {
    const payloads = additions.map(({ packet }) => packet.payloadText).join(',\n');
    proposed = raw.slice(0, end.index) + (bank.questions.length ? ',' : '') + '\n' + payloads + '\n' + raw.slice(end.index);
    for (const { payload } of additions) expectedQuestions.push(payload);
  }
  const parsed = JSON.parse(proposed);
  if (stableJson(parsed.questions) !== stableJson(expectedQuestions) ||
      stableJson({ ...parsed, questions: [] }) !== stableJson({ ...bank, questions: [] })) fail('Source preservation check failed');
  buildManifest(parsed, source);

  const reviews = additions.map(({ packet, payload, assets }) => {
    const mediaCatalog = assets.map(asset => verifiedMedia.get(asset.relativePath));
    const answerIssues = inspectRuntimeQuestion(payload, { rule: RULES_2027[payload.provenance.exam], mediaCatalog })
      .issues.some(issue => /^(answer-|option-|choice-options)/.test(issue.code));
    const review = ['MCQ', 'MSQ', 'NAT'].includes(payload.type)
      ? (objectiveReady(payload) && !answerIssues ? 'objective-complete' : 'objective-incomplete')
      : 'descriptive';
    return { artifactId: packet.artifactId, externalKey: packet.externalKey, contentSha256: packet.contentSha256, review };
  });
  const counts = Object.fromEntries(['objective-complete', 'objective-incomplete', 'descriptive']
    .map(review => [review, reviews.filter(item => item.review === review).length]));
  const summary = {
    mode: output ? 'staged' : 'dry-run', sourceCommit: source, proposedSha256: sha256(proposed), figures: byPath.size,
    ...(replaceExpected !== undefined && { replacesContentSha256: replaceExpected }),
    ...(single
      ? { contentSha256: reviews[0].contentSha256, review: reviews[0].review }
      : { added: additions.length, alreadyPresent: alreadyPresent.length, reviews: counts }),
  };
  if (!output) return summary;
  if (counts['objective-incomplete']) fail('Objective review is incomplete');
  const parent = await realpath(path.dirname(path.resolve(output)));
  const target = path.join(parent, path.basename(path.resolve(output)));
  const repo = await realpath(git(cwd, 'rev-parse', '--show-toplevel'));
  if (within(repo, target)) fail('Output must be outside the repository');
  try { git(parent, 'rev-parse', '--show-toplevel'); fail('Output must be outside Git worktrees'); } catch (error) { if (error.message === 'Output must be outside Git worktrees') throw error; }
  let created = false;
  try {
    await mkdir(target, { mode: 0o700 }); created = true;
    await writeFile(path.join(target, 'dexam-bank-export.json'), proposed, { flag: 'wx', mode: 0o600 });
    for (const asset of byPath.values()) {
      // Recheck the bytes at write time. Keep at most one figure in memory.
      const bytes = await readFigure(asset, mediaRoot, downloadsDir);
      const dest = path.join(target, 'media', ...asset.relativePath.split('/'));
      await mkdir(path.dirname(dest), { recursive: true, mode: 0o700 });
      await writeFile(dest, bytes, { flag: 'wx', mode: 0o600 });
    }
    const details = single
      ? { artifactId: reviews[0].artifactId, externalKey: reviews[0].externalKey }
      : { additions: reviews, existingArtifacts: alreadyPresent.map(({ artifactId, contentSha256, externalKey }) => ({ artifactId, contentSha256, externalKey })) };
    await writeFile(path.join(target, 'receipt.json'), JSON.stringify({ ...summary, ...details }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  } catch (error) { if (created) await rm(target, { recursive: true, force: true }); throw error; }
  return summary;
}

async function main() {
  const options = {
    packet: { type: 'string', multiple: true },
    expect: { type: 'string', multiple: true },
    'expect-source': { type: 'string', multiple: true },
    'replace-expect': { type: 'string', multiple: true },
    output: { type: 'string', multiple: true },
    'media-root': { type: 'string', multiple: true },
    'downloads-dir': { type: 'string', multiple: true },
  };
  const { values } = parseArgs({ options });
  const { packet = [], expect = [] } = values;
  if (!packet.length || packet.length !== expect.length) fail('Supply one reviewed SHA-256 for every packet');
  const singles = ['expect-source', 'replace-expect', 'output', 'media-root', 'downloads-dir'];
  if (singles.some(name => values[name]?.length > 1)) fail('Repeat only packet paths and review digests');
  const result = await prepareAdditions({
    packets: packet.map((packetPath, index) => ({ packetPath, expected: expect[index] })),
    expectedSource: values['expect-source']?.[0], replaceExpected: values['replace-expect']?.[0],
    output: values.output?.[0], mediaRoot: values['media-root']?.[0],
    downloadsDir: values['downloads-dir']?.[0], cwd: fileURLToPath(new URL('../../..', import.meta.url)),
  });
  console.log(JSON.stringify(result));
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(error instanceof BankAdditionError ? error.message : 'Question addition preparation failed; check inputs and source.');
    process.exitCode = 1;
  });
}
