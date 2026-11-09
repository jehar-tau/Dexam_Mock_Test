import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { prepareAddition } from '../scripts/prepare-question-bank-addition.mjs';
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
 async function packet(payload) {
  const payloadText = JSON.stringify(payload), expected = hash(payloadText), packetPath = path.join(root, 'packet.json');
  await writeFile(packetPath, JSON.stringify({ format: 'dmocks-question-export-v1', artifactId: '11111111-1111-1111-1111-111111111111', externalKey: payload.externalKey, contentSha256: expected, payloadText, rightsNote: 'Synthetic rights confirmation', createdAt: '2026-01-01T00:00:00Z', sourceType: 'manual', publicationState: 'git-review-required' }));
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
