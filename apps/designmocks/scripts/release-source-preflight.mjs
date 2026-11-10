#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const HEX40 = /^[0-9a-f]{40}$/i;
const backendPath = 'apps/designmocks/supabase';
const sourceGroups = [
  ['migrations', 'migrations/'],
  ['functions', 'functions/'],
  ['config', 'config.toml'],
  ['project', 'project.json'],
  ['paid_mvp_profile', 'launch/paid-mvp.sql'],
  ['paid_mvp_grant_inventory', 'launch/paid-mvp-rpcs.json'],
];

function git(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.error?.message || '').trim()}`);
  }
  return result.stdout.trim();
}

function parseArgs(args) {
  const values = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!['--commit', '--tree'].includes(key) || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error('Usage: node scripts/release-source-preflight.mjs --commit <40-hex-commit> --tree <40-hex-tree>');
    }
    if (values[key]) throw new Error(`Duplicate ${key}`);
    values[key] = args[++i];
  }
  if (!HEX40.test(values['--commit'] || '') || !HEX40.test(values['--tree'] || '')) {
    throw new Error('Both --commit and --tree must be full 40-character Git object IDs');
  }
  return { commit: values['--commit'].toLowerCase(), tree: values['--tree'].toLowerCase() };
}

async function walkFiles(root, rel, output = []) {
  const abs = path.join(root, rel);
  const info = await lstat(abs);
  if (info.isSymbolicLink()) throw new Error(`Symlink in backend input path: ${rel}`);
  if (info.isFile()) {
    output.push(rel.split(path.sep).join('/'));
    return output;
  }
  if (!info.isDirectory()) throw new Error(`Non-regular backend input: ${rel}`);
  for (const entry of (await readdir(abs)).sort()) await walkFiles(root, path.join(rel, entry), output);
  return output;
}

function parseTree(root, commit) {
  const result = spawnSync('git', ['-C', root, 'ls-tree', '-rz', '--full-tree', commit, '--', backendPath], { encoding: 'buffer' });
  if (result.error || result.status !== 0) throw new Error(`git ls-tree failed: ${result.stderr?.toString().trim() || result.error?.message || ''}`);
  const tracked = new Map();
  for (const record of result.stdout.toString('utf8').split('\0').filter(Boolean)) {
    const match = /^(\d{6}) (\w+) ([0-9a-f]{40})\t(.+)$/.exec(record);
    if (!match) throw new Error(`Unable to parse backend tree entry: ${record}`);
    const [, mode, type, oid, file] = match;
    if (type !== 'blob' || !['100644', '100755'].includes(mode)) throw new Error(`Backend input must be an ordinary file blob: ${file} (${mode} ${type})`);
    tracked.set(file, oid);
  }
  return tracked;
}

async function verifiedInventory(root, commit) {
  let parent = root;
  for (const part of backendPath.split('/')) {
    parent = path.join(parent, part);
    const info = await lstat(parent);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Backend path must be a normal directory: ${path.relative(root, parent)}`);
  }
  const actualFiles = (await walkFiles(root, backendPath)).sort();
  const tracked = parseTree(root, commit);
  const actualSet = new Set(actualFiles);
  for (const file of tracked.keys()) {
    if (!actualSet.has(file)) throw new Error(`Tracked backend file is missing: ${file}`);
  }
  const counts = Object.fromEntries(sourceGroups.map(([name]) => [name, 0]));
  const entries = [];
  for (const file of actualFiles) {
    const expected = tracked.get(file);
    if (!expected) throw new Error(`Backend file is outside the reviewed tree: ${file}`);
    const bytes = await readFile(path.join(root, file));
    const oid = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (oid !== expected) throw new Error(`Backend file content differs from HEAD despite index/status flags: ${file}`);
    const relative = file.slice(backendPath.length + 1);
    const group = sourceGroups.find(([, prefix]) => prefix.endsWith('/') ? relative.startsWith(prefix) : relative === prefix);
    if (!group) continue;
    counts[group[0]]++;
    entries.push({ path: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  for (const [name, prefix] of sourceGroups) {
    if (!counts[name]) throw new Error(`Required backend input is missing: ${prefix}`);
  }
  const canonical = entries.map(item => `${item.path}\0${item.bytes}\0${item.sha256}\n`).join('');
  return {
    trackedFiles: tracked.size,
    counts,
    totalFiles: entries.length,
    totalBytes: entries.reduce((sum, item) => sum + item.bytes, 0),
    sha256: createHash('sha256').update(canonical).digest('hex'),
    files: entries,
  };
}

export async function runPreflight({ cwd = process.cwd(), commit, tree }) {
  if (!HEX40.test(commit || '') || !HEX40.test(tree || '')) throw new Error('Expected full 40-character commit and tree IDs');
  const root = git(cwd, ['rev-parse', '--show-toplevel']);
  const actualCommit = git(root, ['rev-parse', 'HEAD']);
  const actualTree = git(root, ['rev-parse', 'HEAD^{tree}']);
  if (actualCommit !== commit.toLowerCase()) throw new Error(`HEAD mismatch: expected ${commit}, found ${actualCommit}`);
  if (actualTree !== tree.toLowerCase()) throw new Error(`Tree mismatch: expected ${tree}, found ${actualTree}`);

  const status = spawnSync('git', ['-C', root, 'status', '--porcelain=v1', '-z', '--untracked-files=all'], { encoding: 'buffer' });
  if (status.error || status.status !== 0) throw new Error(`git status failed: ${status.stderr?.toString().trim() || status.error?.message || ''}`);
  if (status.stdout.length) throw new Error(`Checkout has tracked or untracked changes (${status.stdout.toString('utf8').split('\0').filter(Boolean).length} path entries)`);

  const ignored = git(root, ['ls-files', '--others', '--ignored', '--exclude-standard', '-z', '--', backendPath]);
  if (ignored) throw new Error(`Ignored/untracked backend override under apps/designmocks/supabase: ${ignored.split('\0').filter(Boolean).join(', ')}`);

  const inventory = await verifiedInventory(root, actualCommit);
  return {
    passed: true,
    scope: 'backend-source-inventory',
    expectedCommit: commit.toLowerCase(),
    expectedTree: tree.toLowerCase(),
    head: actualCommit,
    tree: actualTree,
    inventory,
  };
}

async function main() {
  const { commit, tree } = parseArgs(process.argv.slice(2));
  const result = await runPreflight({ cwd: process.cwd(), commit, tree });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(scriptPath)) {
  main().catch(error => {
    process.stderr.write(`release source preflight failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
