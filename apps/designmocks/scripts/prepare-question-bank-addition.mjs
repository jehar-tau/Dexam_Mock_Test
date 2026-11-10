import { execFileSync } from 'node:child_process';
import { mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildManifest, objectiveReady, sha256, stableJson, SOURCE_PATH } from './question-bank-import.mjs';
import { inspectRuntimeQuestion, RULES_2027 } from './question-runtime.mjs';
import { collectCanonicalMedia, readCanonicalAsset } from './private-bank-media.mjs';
import { verifyQuestionExportPacket } from '../src/question-export-packet.mjs';

function git(cwd, ...args) { return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd(); }
function fail(message) { throw new Error(message); }
function within(parent, candidate) { return candidate === parent || candidate.startsWith(parent + path.sep); }

export async function prepareAddition({ packetPath, expected, expectedSource, output, mediaRoot, downloadsDir, cwd = process.cwd() }) {
  if (!packetPath || !/^[a-f0-9]{64}$/.test(expected || '') || !/^[a-f0-9]{40}$/.test(expectedSource || '')) fail('A packet, reviewed SHA-256 and full source commit are required');
  const source = git(cwd, 'rev-parse', '--verify', 'refs/remotes/origin/main^{commit}');
  if (source !== expectedSource) fail('origin/main does not match the expected source commit');
  const raw = execFileSync('git', ['show', `${source}:${SOURCE_PATH}`], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const bank = JSON.parse(raw);
  buildManifest(bank, source);
  const packetInfo = await stat(packetPath);
  if (!packetInfo.isFile() || packetInfo.size > 4 * 1024 * 1024) fail('Unsupported packet file');
  const { packet, payload } = await verifyQuestionExportPacket(JSON.parse(await readFile(packetPath, 'utf8')), { contentSha256: expected });
  const existing = bank.questions.filter(q => q.externalKey === payload.externalKey);
  if (existing.length) {
    if (existing.length === 1 && stableJson(existing[0]) === stableJson(payload)) return { mode: 'no-op', sourceCommit: source };
    fail('External key already exists in the source bank');
  }
  const one = buildManifest({ schemaVersion: 1, questions: [payload] }, source);
  if (one.eligibleTotal !== 1) fail('Question is not eligible');
  // Validate every path independently, including distinct paths sharing the same digest.
  if (!Array.isArray(payload.assets ?? []) || (payload.visualDependency && !payload.assets?.length)) fail('Required figure is missing');
  if ((payload.assets || []).length > 8) fail('Too many figures');
  const assets = (payload.assets || []).flatMap(asset => collectCanonicalMedia({ records: [{ payload: { holds: [], assets: [asset] } }] }));
  const byPath = new Map();
  for (const asset of assets) {
    const previous = byPath.get(asset.relativePath);
    if (previous && (previous.sha256 !== asset.sha256 || previous.width !== asset.width || previous.height !== asset.height)) fail('Conflicting asset paths');
    byPath.set(asset.relativePath, asset);
  }
  for (const question of bank.questions) {
    if (!Array.isArray(question.assets)) continue;
    for (const existingAsset of question.assets) {
      const incoming = byPath.get(existingAsset?.path);
      if (incoming && (incoming.sha256 !== existingAsset.sha256 || incoming.width !== existingAsset.width || incoming.height !== existingAsset.height)) fail('Figure path conflicts with the source bank');
    }
  }
  const media = [];
  for (const asset of byPath.values()) {
    let bytes;
    if (mediaRoot) {
      try { bytes = await readCanonicalAsset(mediaRoot, asset); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (!bytes && downloadsDir) bytes = await readCanonicalAsset(downloadsDir, { ...asset, relativePath: `${asset.sha256}.png` });
    if (!bytes) fail('Required figure is missing');
    media.push({ asset, bytes });
  }
  if (Object.keys(bank).at(-1) !== 'questions') fail('Questions must be the final top-level key');
  const end = /\](\s*\}\s*)$/.exec(raw);
  if (!end) fail('Unsupported source layout');
  const proposed = raw.slice(0, end.index) + (bank.questions.length ? ',' : '') + '\n' + packet.payloadText + '\n' + raw.slice(end.index);
  const parsed = JSON.parse(proposed);
  if (stableJson(parsed.questions.slice(0, -1)) !== stableJson(bank.questions) || stableJson({ ...parsed, questions: [] }) !== stableJson({ ...bank, questions: [] }) || stableJson(parsed.questions.at(-1)) !== stableJson(payload)) fail('Source preservation check failed');
  buildManifest(parsed, source);
  const mediaCatalog = media.map(({ asset, bytes }) => ({ sha256: asset.sha256, path: asset.storagePath, width: asset.width, height: asset.height, byteSize: bytes.length }));
  const answerIssues = inspectRuntimeQuestion(payload, { rule: RULES_2027[payload.provenance.exam], mediaCatalog }).issues.some(issue => /^(answer-|option-|choice-options)/.test(issue.code));
  const review = ['MCQ', 'MSQ', 'NAT'].includes(payload.type) ? (objectiveReady(payload) && !answerIssues ? 'objective-complete' : 'objective-incomplete') : 'descriptive';
  const summary = { mode: output ? 'staged' : 'dry-run', sourceCommit: source, contentSha256: packet.contentSha256, proposedSha256: sha256(proposed), review, figures: media.length };
  if (!output) return summary;
  if (review === 'objective-incomplete') fail('Objective review is incomplete');
  const parent = await realpath(path.dirname(path.resolve(output)));
  const target = path.join(parent, path.basename(path.resolve(output)));
  const repo = await realpath(git(cwd, 'rev-parse', '--show-toplevel'));
  if (within(repo, target)) fail('Output must be outside the repository');
  try { git(parent, 'rev-parse', '--show-toplevel'); fail('Output must be outside Git worktrees'); } catch (error) { if (error.message === 'Output must be outside Git worktrees') throw error; }
  let created = false;
  try {
    await mkdir(target, { mode: 0o700 }); created = true;
    await writeFile(path.join(target, 'dexam-bank-export.json'), proposed, { flag: 'wx', mode: 0o600 });
    for (const { asset, bytes } of media) {
      const dest = path.join(target, 'media', ...asset.relativePath.split('/'));
      await mkdir(path.dirname(dest), { recursive: true, mode: 0o700 });
      await writeFile(dest, bytes, { flag: 'wx', mode: 0o600 });
    }
    await writeFile(path.join(target, 'receipt.json'), JSON.stringify({ ...summary, artifactId: packet.artifactId, externalKey: packet.externalKey }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  } catch (error) { if (created) await rm(target, { recursive: true, force: true }); throw error; }
  return summary;
}

async function main() {
  const names = new Set(['--packet', '--expect', '--expect-source', '--output', '--media-root', '--downloads-dir']);
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!names.has(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options[args[i]]) fail('Invalid arguments');
    options[args[i]] = args[i + 1];
  }
  const result = await prepareAddition({ packetPath: options['--packet'], expected: options['--expect'], expectedSource: options['--expect-source'], output: options['--output'], mediaRoot: options['--media-root'], downloadsDir: options['--downloads-dir'], cwd: fileURLToPath(new URL('../../..', import.meta.url)) });
  console.log(JSON.stringify(result));
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(() => { console.error('Question addition preparation failed; check inputs and source.'); process.exitCode = 1; });
