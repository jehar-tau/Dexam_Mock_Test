#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const HEX40 = /^[0-9a-f]{40}$/i;

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

async function inventory(root) {
  const base = path.join(root, 'apps/designmocks/supabase');
  const groups = [
    ['migrations', 'migrations'],
    ['functions', 'functions'],
    ['config', 'config.toml'],
    ['project', 'project.json'],
    ['paid_mvp_profile', 'launch/paid-mvp.sql'],
    ['paid_mvp_grant_inventory', 'launch/paid-mvp-rpcs.json'],
  ];
  const files = [];
  const counts = {};
  for (const [name, rel] of groups) {
    const found = await walkFiles(base, rel);
    counts[name] = found.length;
    files.push(...found.map(file => `apps/designmocks/supabase/${file}`));
  }
  files.sort();
  const entries = [];
  for (const file of files) {
    const bytes = await readFile(path.join(root, file));
    entries.push({ path: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const canonical = entries.map(item => `${item.path}\0${item.bytes}\0${item.sha256}\n`).join('');
  return {
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

  const ignored = git(root, ['ls-files', '--others', '--ignored', '--exclude-standard', '-z', '--', 'apps/designmocks/supabase']);
  if (ignored) throw new Error(`Ignored/untracked backend override under apps/designmocks/supabase: ${ignored.split('\0').filter(Boolean).join(', ')}`);

  const source = await inventory(root);
  return {
    passed: true,
    scope: 'source-only backend inputs; no hosted calls or deployment authorization',
    expectedCommit: commit.toLowerCase(),
    expectedTree: tree.toLowerCase(),
    head: actualCommit,
    tree: actualTree,
    inventory: source,
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
