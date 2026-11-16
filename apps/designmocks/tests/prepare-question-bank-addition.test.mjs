import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { stableJson } from '../scripts/question-bank-import.mjs';
import { prepareAddition, prepareAdditions } from '../scripts/prepare-question-bank-addition.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const question = (key, extra = {}) => ({ externalKey: key, prompt: 'Synthetic prompt', type: 'DESCRIPTIVE', provenance: { exam: 'uceed' }, holds: [], ...extra });
async function fixture(t, existing = [question('existing')]) {
 const root = await mkdtemp(path.join(os.tmpdir(), 'bank-addition-test-')); t.after(() => rm(root, { recursive: true, force: true }));
 const repo = path.join(root, 'repo'); await mkdir(path.join(repo, 'server/data/exports'), { recursive: true });
 const raw = JSON.stringify({ schemaVersion: 1, metadata: { example: true }, questions: existing }, null, 1) + '\n';
 await writeFile(path.join(repo, 'server/data/exports/dexam-bank-export.json'), raw);
 const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
 git('init'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Test'); git('add', '.'); git('commit', '-m', 'fixture');
 const expectedSource = git('rev-parse', 'HEAD'); git('update-ref', 'refs/remotes/origin/main', expectedSource);
 let nextPacket = 0;
 async function packet(payload) {
  const number = String(++nextPacket).padStart(12, '0');
  const payloadText = JSON.stringify(payload), expected = hash(payloadText), packetPath = path.join(root, `packet-${number}.json`);
  await writeFile(packetPath, JSON.stringify({ format: 'dmocks-question-export-v1', artifactId: `11111111-1111-1111-1111-${number}`, externalKey: payload.externalKey, contentSha256: expected, payloadText, rightsNote: 'Synthetic rights confirmation', createdAt: '2026-01-01T00:00:00Z', sourceType: 'manual', publicationState: 'git-review-required' }));
  return { packetPath, expected, expectedSource, cwd: repo };
 }
 return { root, repo, raw, packet, expectedSource };
}
test('dry run and private output preserve the original export', async t => {
 const f = await fixture(t), opts = await f.packet(question('new'));
 assert.equal((await prepareAddition(opts)).mode, 'dry-run');
 const output = path.join(f.root, 'private'); const result = await prepareAddition({ ...opts, output });
 assert.equal(result.review, 'descriptive');
 const raw = await readFile(path.join(output, 'dexam-bank-export.json'), 'utf8');
 assert.ok(raw.startsWith(f.raw.slice(0, f.raw.lastIndexOf(']'))));
 assert.deepEqual(JSON.parse(raw).questions, [question('existing'), question('new')]);
 assert.equal(JSON.parse(await readFile(path.join(output, 'receipt.json'))).mode, 'staged');
 await assert.rejects(prepareAddition({ ...opts, output }));
 await assert.rejects(prepareAddition({ ...opts, output: path.join(f.repo, 'private') }));
});
test('rejects tampering, source mismatch, held and colliding keys', async t => {
 const f = await fixture(t, [question('held', { holds: ['review'] })]);
 const opts = await f.packet(question('new'));
 await assert.rejects(prepareAddition({ ...opts, expected: '0'.repeat(64) }));
 await assert.rejects(prepareAddition({ ...opts, expectedSource: '0'.repeat(40) }));
 await assert.rejects(prepareAddition(await f.packet(question('held'))));
 await assert.rejects(prepareAddition(await f.packet(question('new', { holds: ['review'] }))));
 await assert.rejects(prepareAddition(await f.packet(question('held', { holds: ['review'] }))));
});
test('the CLI reports corrective steps without printing private packet content or local paths', async t => {
 const f = await fixture(t);
 const script = fileURLToPath(new URL('../scripts/prepare-question-bank-addition.mjs', import.meta.url));
 const opts = await f.packet(question('new'));
 await writeFile(opts.packetPath, 'PRIVATE_FICTIONAL_QUESTION_TEXT');
 const run = (packet, commit) => spawnSync(process.execPath, [script, '--packet', packet,
  '--expect', opts.expected, '--expect-source', commit], {
   env: { ...process.env, GIT_DIR: path.join(f.repo, '.git'), GIT_WORK_TREE: f.repo }, encoding: 'utf8',
  });
 for (const [result, message] of [
  [run(opts.packetPath, '0'.repeat(40)), /origin\/main does not match/],
  [run(path.join(f.root, 'missing.json'), f.expectedSource), /Choose a readable question export packet/],
  [run(opts.packetPath, f.expectedSource), /Export the approved question again/],
 ]) {
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, message);
  assert.doesNotMatch(result.stderr, /PRIVATE_FICTIONAL_QUESTION_TEXT|bank-addition-test-/);
 }
});
test('validates required figures and rejects tampering', async t => {
 const f = await fixture(t), downloadsDir = path.join(f.root, 'downloads'); await mkdir(downloadsDir);
 const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082','hex');
 const digest = hash(png); await writeFile(path.join(downloadsDir, `${digest}.png`), png);
 const opts = await f.packet(question('figure', { assets: [{ path: 'figures/example.png', sha256: digest, width: 1, height: 1 }] }));
 await assert.rejects(prepareAddition(opts));
 const output = path.join(f.root, 'result'); assert.equal((await prepareAddition({ ...opts, downloadsDir, output })).figures, 1);
 assert.deepEqual(await readFile(path.join(output, 'media/figures/example.png')), png);
 await writeFile(path.join(downloadsDir, `${digest}.png`), Buffer.alloc(png.length));
 await assert.rejects(prepareAddition({ ...opts, downloadsDir }));
});
test('distinguishes incomplete objective review and exact no-op', async t => {
 const f = await fixture(t); const unchanged = await f.packet(question('existing'));
 assert.equal((await prepareAddition(unchanged)).mode, 'no-op');
 const incomplete = await f.packet(question('objective', { type: 'MCQ', answer: { raw: 'Z', status: 'verified' }, options: [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }] }));
 assert.equal((await prepareAddition(incomplete)).review, 'objective-incomplete');
 await assert.rejects(prepareAddition({ ...incomplete, output: path.join(f.root, 'incomplete') }));
 const complete = await f.packet(question('objective', { type: 'MCQ', answer: { raw: 'A', status: 'verified' }, options: ['A','B','C','D'].map(key => ({ key, text: key })) }));
 assert.equal((await prepareAddition(complete)).review, 'objective-complete');
});
test('rejects unsafe media paths and symlink escapes', async t => {
 const f = await fixture(t), mediaRoot = path.join(f.root, 'media'); await mkdir(mediaRoot);
 const unsafe = await f.packet(question('unsafe', { assets: [{ path: '../scan.png', sha256: 'a'.repeat(64), width: 1, height: 1 }] }));
 await assert.rejects(prepareAddition({ ...unsafe, mediaRoot }));
});
test('protects existing figure paths in eligible and held rows while allowing identical references', async t => {
 const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082','hex');
 const asset = { path: 'figures/shared.png', sha256: hash(png), width: 1, height: 1 };
 for (const holds of [[], ['review']]) {
  const f = await fixture(t, [question('prior', { holds, assets: [asset] })]);
  const downloadsDir = path.join(f.root, 'downloads'); await mkdir(downloadsDir); await writeFile(path.join(downloadsDir, `${asset.sha256}.png`), png);
  const conflict = await f.packet(question('new', { assets: [{ ...asset, width: 2 }] }));
  await assert.rejects(prepareAddition({ ...conflict, downloadsDir }), /conflicts with the source bank/);
  const safe = await f.packet(question('new', { assets: [asset] }));
  assert.equal((await prepareAddition({ ...safe, downloadsDir })).figures, 1);
 }
});
test('limits figures and recognizes complete visual choice reviews', async t => {
 const f = await fixture(t), downloadsDir = path.join(f.root, 'downloads'); await mkdir(downloadsDir);
 const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082','hex');
 const asset = { path: 'figures/choices.png', sha256: hash(png), width: 1, height: 1 };
 await writeFile(path.join(downloadsDir, `${asset.sha256}.png`), png);
 const visual = await f.packet(question('visual', { type: 'MCQ', visualDependency: true, assets: [asset], answer: { raw: 'A', status: 'verified' }, options: ['A','B','C','D'].map(key => ({ key, text: '' })) }));
 assert.equal((await prepareAddition({ ...visual, downloadsDir })).review, 'objective-complete');
 const tooMany = await f.packet(question('many', { assets: Array(9).fill(asset) }));
 await assert.rejects(prepareAddition({ ...tooMany, downloadsDir }), /Too many figures/);
});

test('prepares an exact-version correction while preserving siblings and provenance', async t => {
 const before = question('existing'), neighbour = question('neighbour');
 const f = await fixture(t, [neighbour, before, question('other')]);
 const corrected = { ...before, prompt: 'Corrected synthetic prompt' };
 const opts = await f.packet(corrected);
 const replaceExpected = hash(stableJson(before));
 await assert.rejects(prepareAddition(opts), /already exists/);
 await assert.rejects(prepareAddition({ ...opts, replaceExpected: '0'.repeat(64) }), /current question version/);
 const output = path.join(f.root, 'correction');
 const receipt = await prepareAddition({ ...opts, replaceExpected, output });
 assert.equal(receipt.replacesContentSha256, replaceExpected);
 const proposed = await readFile(path.join(output, 'dexam-bank-export.json'), 'utf8');
 assert.equal(proposed, JSON.stringify({ ...JSON.parse(f.raw), questions: [neighbour, corrected, question('other')] }, null, 1) + '\n');
 const changedSource = await f.packet({ ...corrected, provenance: { exam: 'ceed' } });
 await assert.rejects(prepareAddition({ ...changedSource, replaceExpected }), /preserve question provenance/);
});

test('rejects a correction to a held record even when its source version matches', async t => {
 const held = question('held', { holds: ['review'] });
 const f = await fixture(t, [held]);
 const opts = await f.packet(question('held'));
 await assert.rejects(prepareAddition({ ...opts, replaceExpected: hash(stableJson(held)) }), /Resolve canonical holds/);
});

test('prepares several reviewed questions in one private append-only export', async t => {
 const f = await fixture(t);
 const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082','hex');
 const asset = { path: 'figures/shared.png', sha256: hash(png), width: 1, height: 1 };
 const extra = { ...asset, path: 'figures/other.png' };
 const downloadsDir = path.join(f.root, 'downloads');
 await mkdir(downloadsDir);
 await writeFile(path.join(downloadsDir, `${asset.sha256}.png`), png);

 const first = question('batch-first', { assets: [asset] });
 const second = question('batch-second', { assets: [asset, extra] });
 const packets = await Promise.all([f.packet(first), f.packet(question('existing')), f.packet(second)]);
 const options = { packets, cwd: f.repo, expectedSource: f.expectedSource, downloadsDir };
 const dryRun = await prepareAdditions(options);
 assert.equal(dryRun.added, 2);
 assert.equal(dryRun.alreadyPresent, 1);
 assert.equal(dryRun.figures, 2);
 assert.equal(dryRun.reviews.descriptive, 2);
 assert.doesNotMatch(JSON.stringify(dryRun), /batch-first|batch-second|Synthetic prompt/);

 const script = fileURLToPath(new URL('../scripts/prepare-question-bank-addition.mjs', import.meta.url));
 const args = ['--expect-source', f.expectedSource, '--downloads-dir', downloadsDir,
  ...packets.flatMap(({ packetPath, expected }) => ['--packet', packetPath, '--expect', expected])];
 const run = moreArgs => spawnSync(process.execPath, [script, ...moreArgs], {
  env: { ...process.env, GIT_DIR: path.join(f.repo, '.git'), GIT_WORK_TREE: f.repo }, encoding: 'utf8',
 });
 const result = run(args);
 assert.equal(result.status, 0, result.stderr);
 assert.deepEqual(JSON.parse(result.stdout), dryRun);
 const unpaired = run(args.slice(0, -2));
 assert.equal(unpaired.status, 1);
 assert.match(unpaired.stderr, /one reviewed SHA-256 for every packet/);
 const duplicateSource = run([...args, '--expect-source', f.expectedSource]);
 assert.equal(duplicateSource.status, 1);
 assert.match(duplicateSource.stderr, /Repeat only packet paths and review digests/);

 const output = path.join(f.root, 'batch');
 const staged = await prepareAdditions({ ...options, output });
 assert.equal(staged.proposedSha256, dryRun.proposedSha256);
 const raw = await readFile(path.join(output, 'dexam-bank-export.json'), 'utf8');
 assert.ok(raw.startsWith(f.raw.slice(0, f.raw.lastIndexOf(']'))));
 assert.deepEqual(JSON.parse(raw).questions, [question('existing'), first, second]);
 assert.deepEqual(await readFile(path.join(output, 'media', asset.path)), png);
 assert.deepEqual(await readFile(path.join(output, 'media', extra.path)), png);
 const receipt = JSON.parse(await readFile(path.join(output, 'receipt.json')));
 assert.deepEqual(receipt.additions.map(item => item.externalKey), ['batch-first', 'batch-second']);
 assert.equal(receipt.existingArtifacts[0].externalKey, 'existing');
 assert.equal((await stat(output)).mode & 0o777, 0o700);
 assert.equal((await stat(path.join(output, 'receipt.json'))).mode & 0o777, 0o600);
});

test('leaves no partial export if any batch packet or figure fails review', async t => {
 const f = await fixture(t);
 const first = await f.packet(question('batch-first'));
 const second = await f.packet(question('batch-second', {
  type: 'MCQ',
  options: ['A','B','C','D'].map(key => ({ key, text: key })),
  answer: { raw: 'Z', status: 'verified' },
 }));
 const output = path.join(f.root, 'batch');
 const prepare = (packets, extra = {}) => prepareAdditions({ packets, cwd: f.repo, expectedSource: f.expectedSource, ...extra });
 assert.equal((await prepare([first, second])).reviews['objective-incomplete'], 1);
 await assert.rejects(prepare([first, second], { output }), /Objective review is incomplete/);
 await assert.rejects(prepare([first, first], { output }), /appears more than once/);
 await assert.rejects(prepare([first, { ...second, expected: 'b'.repeat(64) }], { output }));
 const asset = { path: 'figures/collision.png', sha256: 'a'.repeat(64), width: 1, height: 1 };
 const one = await f.packet(question('one', { assets: [asset] }));
 const two = await f.packet(question('two', { assets: [{ ...asset, sha256: 'b'.repeat(64) }] }));
 await assert.rejects(prepare([one, two], { output }), /Conflicting asset paths/);
 await assert.rejects(prepare([first, one], { output }), /Required figure is missing/);
 await assert.rejects(stat(output), { code: 'ENOENT' });
});

test('a batch already present in the pinned bank is an exact no-op', async t => {
 const questions = [question('first'), question('second')];
 const f = await fixture(t, questions);
 const packets = await Promise.all(questions.map(f.packet));
 const output = path.join(f.root, 'no-op');
 assert.deepEqual(await prepareAdditions({ packets, expectedSource: f.expectedSource, cwd: f.repo, output }),
  { mode: 'no-op', sourceCommit: f.expectedSource, added: 0, alreadyPresent: 2 });
 await assert.rejects(stat(output), { code: 'ENOENT' });
});
