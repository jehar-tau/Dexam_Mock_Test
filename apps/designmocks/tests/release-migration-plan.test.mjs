import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RECOVERY_PROJECT } from '../scripts/recovery-bundle.mjs';

const cli = fileURLToPath(new URL('../scripts/release-migration-plan.mjs', import.meta.url));
const migrations = [
  { version: '202611060005', filename: '202611060005_initial.sql', sql: 'select 1;\n' },
  { version: '202611060006', filename: '202611060006_older_gap.sql', sql: 'select 2;\n' },
  { version: '202611060101', filename: '202611060101_already_applied.sql', sql: 'select 3;\n' },
  { version: '202611060102', filename: '202611060102_latest.sql', sql: 'select 4;\n' },
];
const installed = [migrations[0].version, migrations[2].version];
const pending = [migrations[1], migrations[3]];
const [gap, latest] = pending.map(migration => migration.filename);
const dryRun = (files, overrides = {}) => JSON.stringify({
  upToDate: files.length === 0,
  dryRun: true,
  migrations: files,
  seeds: [],
  roles: [],
  message: files.length ? 'Finished supabase db push.' : 'Remote database is up to date.',
  target: { kind: 'linked', project_ref: RECOVERY_PROJECT, environment: 'production' },
  ...overrides,
}) + '\n';

async function fixture(t, { sourceProject = RECOVERY_PROJECT } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'dmocks-migration-plan-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'repository');
  const app = path.join(root, 'apps/designmocks');
  const backendFiles = {
    'config.toml': 'project_id = "fictional-migration-plan"\n',
    'project.json': JSON.stringify({ project_ref: sourceProject }),
    'functions/_shared/example.ts': 'export const fixture = true;\n',
    'launch/paid-mvp.sql': 'select true;\n',
    'launch/private-staging-api.sql': '-- fixture\n',
    'launch/paid-mvp-rpcs.json': '[]\n',
    ...Object.fromEntries(migrations.map(({ filename, sql }) => [`migrations/${filename}`, sql])),
  };
  for (const [file, content] of Object.entries(backendFiles)) {
    const target = path.join(app, 'supabase', file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  const git = (...args) => {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '-q');
  git('config', 'user.email', 'fixture@example.test');
  git('config', 'user.name', 'Fixture');
  git('add', '.');
  git('commit', '-qm', 'fictional candidate source');
  const commit = git('rev-parse', 'HEAD');
  const tree = git('rev-parse', 'HEAD^{tree}');
  const ledger = path.join(directory, 'approved-ledger.json');
  const log = path.join(directory, 'dry-run.log');

  return async ({ transcript, ledgerChanges, localRehearsal, ...release } = {}) => {
    await writeFile(ledger, JSON.stringify({
      version: 'dmocks-pre-upgrade-ledger-v1',
      projectRef: RECOVERY_PROJECT,
      releaseSha: commit,
      migrationVersions: installed,
      ...ledgerChanges,
    }));
    const args = [cli, '--commit', release.commit ?? commit, '--tree', release.tree ?? tree, '--ledger', ledger];
    if (transcript !== undefined) {
      await writeFile(log, transcript);
      args.push('--dry-run-log', log);
    }
    if (localRehearsal) args.push('--local-rehearsal');
    const result = spawnSync(process.execPath, args, { cwd: app, encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.doesNotMatch(result.stderr, /MODULE_NOT_FOUND/);
    return result;
  };
}

function readProof(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('computes and hashes every pending migration from the reviewed source, including an older gap', async t => {
  const invoke = await fixture(t);
  const proof = readProof(await invoke());
  assert.deepEqual(proof.installedVersions, installed);
  assert.deepEqual(proof.pendingMigrations, pending.map(({ version, filename, sql }) => ({
    version,
    filename,
    sha256: createHash('sha256').update(sql).digest('hex'),
  })));
  assert.equal(proof.dryRunVerified, false);

  const verified = readProof(await invoke({ transcript: dryRun([gap, latest]) }));
  assert.deepEqual(verified.installedVersions, proof.installedVersions);
  assert.deepEqual(verified.pendingMigrations, proof.pendingMigrations);
  assert.equal(verified.dryRunVerified, true);
  assert.deepEqual(verified.dryRunTarget, { kind: 'linked', projectRef: RECOVERY_PROJECT, environment: 'production' });
});

test('rejects mismatched, malformed, truncated and non-dry-run transcripts', async t => {
  const invoke = await fixture(t);
  const invalid = {
    'count-preserving substitution': dryRun([migrations[2].filename, latest]),
    'omitted older gap': dryRun([latest]),
    'unexpected additional migration': dryRun([gap, migrations[2].filename, latest]),
    'duplicate migration': dryRun([gap, gap, latest]),
    'wrong order': dryRun([latest, gap]),
    'malformed list entry': dryRun([{ filename: gap }, latest]),
    'missing completion': dryRun([gap, latest], { message: undefined }),
    'truncated JSON': dryRun([gap, latest]).trimEnd().slice(0, -1),
    'non-dry-run transcript': dryRun([gap, latest], { dryRun: false }),
    'non-boolean dry-run flag': dryRun([gap, latest], { dryRun: 'true' }),
    'missing dry-run flag': dryRun([gap, latest], { dryRun: undefined }),
    'non-boolean up-to-date flag': dryRun([gap, latest], { upToDate: 'false' }),
    'inconsistent up-to-date flag': dryRun([gap, latest], { upToDate: true }),
    'false up-to-date claim': dryRun([]),
    'unreviewed seed operation': dryRun([gap, latest], { seeds: ['fictional_seed.sql'] }),
    'unreviewed role operation': dryRun([gap, latest], { roles: ['fictional_role.sql'] }),
  };
  for (const [label, transcript] of Object.entries(invalid)) {
    const result = await invoke({ transcript });
    assert.notEqual(result.status, 0, label);
  }
});

test('verifies an up-to-date dry run only for an empty pending plan', async t => {
  const invoke = await fixture(t);
  const ledgerChanges = { migrationVersions: migrations.map(migration => migration.version) };
  const result = readProof(await invoke({ ledgerChanges, transcript: dryRun([]) }));
  assert.deepEqual(result.installedVersions, ledgerChanges.migrationVersions);
  assert.deepEqual(result.pendingMigrations, []);
  assert.equal(result.dryRunVerified, true);
  assert.notEqual((await invoke({ ledgerChanges, transcript: dryRun([latest]) })).status, 0);
});

test('binds a hosted plan to the reviewed project and keeps local rehearsals distinct', async t => {
  const invoke = await fixture(t);
  const local = { kind: 'local', host: '127.0.0.1', port: 6543 };
  const localReport = dryRun([gap, latest], { target: local });
  const rehearsal = readProof(await invoke({ transcript: localReport, localRehearsal: true }));
  assert.deepEqual(rehearsal.dryRunTarget, local);
  const invalid = [
    undefined,
    local,
    { kind: 'db-url', host: 'example.test', port: 5432 },
    { kind: 'linked', project_ref: 'fictional-foreign-project', environment: 'production' },
    { kind: 'linked', project_ref: RECOVERY_PROJECT, environment: 'unverified' },
  ];
  for (const target of invalid) {
    assert.notEqual((await invoke({ transcript: dryRun([gap, latest], { target }) })).status, 0);
  }
  assert.notEqual((await invoke({ transcript: dryRun([gap, latest]), localRehearsal: true })).status, 0);
  assert.notEqual((await invoke({ transcript: dryRun([gap, latest], { target: { ...local, host: 'example.test' } }), localRehearsal: true })).status, 0);
  assert.notEqual((await invoke({ localRehearsal: true })).status, 0);
});

test('rejects foreign, mismatched, duplicate, unknown and unordered reviewed ledgers', async t => {
  const invoke = await fixture(t);
  const invalid = [
    { projectRef: 'fictional-foreign-project' },
    { releaseSha: '0'.repeat(40) },
    { version: 'fictional-unknown-ledger-format' },
    { pendingMigrations: [gap, latest] },
    { migrationVersions: [installed[0], ...installed] },
    { migrationVersions: [...installed, '202611060999'] },
    { migrationVersions: [...installed].reverse() },
  ];
  for (const ledgerChanges of invalid) {
    const result = await invoke({ ledgerChanges });
    assert.notEqual(result.status, 0, JSON.stringify(ledgerChanges));
  }
});

test('rejects a reviewed ledger paired with a candidate for another project', async t => {
  const invoke = await fixture(t, { sourceProject: 'fictional-foreign-project' });
  assert.notEqual((await invoke()).status, 0);
});
