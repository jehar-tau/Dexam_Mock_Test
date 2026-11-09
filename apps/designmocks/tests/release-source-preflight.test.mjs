import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sourceScript = fileURLToPath(new URL('../scripts/release-source-preflight.mjs', import.meta.url));

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'dmocks-preflight-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const app = path.join(root, 'apps/designmocks');
  await mkdir(path.join(app, 'scripts'), { recursive: true });
  await mkdir(path.join(app, 'supabase/migrations'), { recursive: true });
  await mkdir(path.join(app, 'supabase/functions/_shared'), { recursive: true });
  await mkdir(path.join(app, 'supabase/launch'), { recursive: true });
  await copyFile(sourceScript, path.join(app, 'scripts/release-source-preflight.mjs'));
  await writeFile(path.join(app, 'supabase/config.toml'), 'project_id = "fixture"\n');
  await writeFile(path.join(app, 'supabase/project.json'), '{"project_ref":"fixture"}\n');
  await writeFile(path.join(app, 'supabase/migrations/001.sql'), 'select 1;\n');
  await writeFile(path.join(app, 'supabase/functions/_shared/shared.ts'), 'export const x = 1;\n');
  await writeFile(path.join(app, 'supabase/launch/paid-mvp.sql'), 'revoke all;\n');
  await writeFile(path.join(app, 'supabase/launch/paid-mvp-rpcs.json'), '{"rpcs":[]}\n');
  const runGit = (...args) => {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  runGit('init', '-q');
  runGit('config', 'user.email', 'fixture@example.test');
  runGit('config', 'user.name', 'Fixture');
  runGit('add', '.');
  runGit('commit', '-qm', 'fixture');
  const commit = runGit('rev-parse', 'HEAD');
  const tree = runGit('rev-parse', 'HEAD^{tree}');
  const invoke = (expectedCommit = commit, expectedTree = tree) => spawnSync('node', [path.join(app, 'scripts/release-source-preflight.mjs'), '--commit', expectedCommit, '--tree', expectedTree], { cwd: app, encoding: 'utf8' });
  return { root, app, runGit, commit, tree, invoke };
}

test('passes exact clean source and emits stable inventory counts and hashes', async t => {
  const f = await fixture(t);
  const result = f.invoke();
  assert.equal(result.status, 0, result.stderr);
  const proof = JSON.parse(result.stdout);
  assert.equal(proof.passed, true);
  assert.equal(proof.head, f.commit);
  assert.equal(proof.tree, f.tree);
  assert.deepEqual(proof.inventory.counts, { migrations: 1, functions: 1, config: 1, project: 1, paid_mvp_profile: 1, paid_mvp_grant_inventory: 1 });
  assert.match(proof.inventory.sha256, /^[0-9a-f]{64}$/);
  assert.equal(proof.inventory.files.length, 6);
  assert.deepEqual(JSON.parse(f.invoke().stdout), proof);
});

test('fails when expected commit or tree differs', async t => {
  const f = await fixture(t);
  const other = '0'.repeat(40);
  assert.match(f.invoke(other, f.tree).stderr, /HEAD mismatch/);
  assert.match(f.invoke(f.commit, other).stderr, /Tree mismatch/);
});

test('fails for tracked changes and untracked files anywhere in checkout', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.app, 'supabase/migrations/001.sql'), 'select 2;\n');
  assert.match(f.invoke().stderr, /tracked or untracked changes/);
  f.runGit('restore', 'apps/designmocks/supabase/migrations/001.sql');
  await writeFile(path.join(f.app, 'extra.txt'), 'untracked\n');
  assert.match(f.invoke().stderr, /tracked or untracked changes/);
});

test('fails when skip-worktree hides a tracked backend edit', async t => {
  const f = await fixture(t);
  const file = 'apps/designmocks/supabase/migrations/001.sql';
  f.runGit('update-index', '--skip-worktree', file);
  await writeFile(path.join(f.root, file), 'select 9;\n');
  const result = f.invoke();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /content differs from HEAD/);
  f.runGit('update-index', '--no-skip-worktree', file);
});

test('fails when the reviewed tree lacks a required deployment input', async t => {
  const f = await fixture(t);
  f.runGit('rm', 'apps/designmocks/supabase/launch/paid-mvp-rpcs.json');
  f.runGit('commit', '-qm', 'remove a deployment input');
  const result = f.invoke(f.runGit('rev-parse', 'HEAD'), f.runGit('rev-parse', 'HEAD^{tree}'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Required backend input is missing/);
});

test('fails for ignored backend overrides, including local environment files', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, '.gitignore'), 'apps/designmocks/supabase/.env.local\n');
  f.runGit('add', '.gitignore');
  f.runGit('commit', '-qm', 'ignore local backend env');
  const commit = f.runGit('rev-parse', 'HEAD');
  const tree = f.runGit('rev-parse', 'HEAD^{tree}');
  await writeFile(path.join(f.app, 'supabase/.env.local'), 'project override\n');
  const result = f.invoke(commit, tree);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Ignored\/untracked backend override/);
});
