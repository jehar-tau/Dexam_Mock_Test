import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes} from 'node:crypto';
import {mkdtemp, rm, writeFile, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {capturePrivateRecovery, PRE_UPGRADE_LEDGER_VERSION, verifyPrivateRecovery} from '../scripts/private-recovery.mjs';
import {RECOVERY_PROJECT, verifyRecoveryBundle} from '../scripts/recovery-bundle.mjs';
import {compareRecoverySnapshots, recoveryBucketsQuery, recoveryObjectsQuery, recoverySchemaQuery} from '../scripts/recovery-postgres.mjs';

const sourceVersions = ['202611060005', '202611060006', '202611060101'];
const historicalVersions = [sourceVersions[0], sourceVersions[2]];
const approvedLedger = {
  version: PRE_UPGRADE_LEDGER_VERSION,
  projectRef: RECOVERY_PROJECT,
  releaseSha: 'a'.repeat(40),
  migrationVersions: historicalVersions,
};

async function fixture(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'dmocks-pre-upgrade-'));
  const config = {
    url: `https://${RECOVERY_PROJECT}.supabase.co`,
    databaseUrl: `postgresql://postgres:fictional@db.${RECOVERY_PROJECT}.supabase.co/postgres`,
    key: 'sb_secret_fictional_fixture',
    recoveryKey: randomBytes(32).toString('hex'),
    releaseSha: approvedLedger.releaseSha,
    preUpgradeLedger: path.join(directory, 'ledger.json'),
    output: path.join(directory, 'backup'),
  };
  try {
    await writeFile(config.preUpgradeLedger, JSON.stringify(approvedLedger), {mode: 0o600});
    await run(config);
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
}

function source({versions = historicalVersions, freshVersions = versions, withProfile = false, ledgerPresent = true} = {}) {
  const calls = {connections: 0, exports: 0, closed: 0};
  const connectionFactory = async () => {
    const fresh = ++calls.connections > 1;
    return {
      async query(statement) {
        if (statement.includes('left(c.relname, 4)')) return withProfile ? 'f' : 't';
        if (statement.includes('mvp_profile_permissions_valid()')) return withProfile ? 't' : 'f';
        if (statement.includes("to_regclass('supabase_migrations.schema_migrations')")) return ledgerPresent ? 't' : 'f';
        if (statement.includes('jsonb_agg(version order by version)')) return JSON.stringify(fresh ? freshVersions : versions);
        if (statement === recoverySchemaQuery) return '{}';
        if (statement.includes("c.relkind in('r','p')") || statement.includes('from pg_sequences')
          || statement === recoveryBucketsQuery || statement === recoveryObjectsQuery) return '[]';
        if (statement.includes('server_version_num')) return '170006';
        assert.fail('Unexpected SQL in the recovery fixture');
      },
      async exportSnapshot() { calls.exports++; return '00000003-00000001-1'; },
      async *dump() { yield Buffer.from('PGDMP-fictional-pre-upgrade'); },
      async close() { calls.closed++; },
    };
  };
  return {calls, options: {connectionFactory, expectedVersions: sourceVersions}};
}

test('pre-upgrade capture authenticates the exact reviewed ledger including its historical gap', () => fixture(async config => {
  const {calls, options} = source();
  const databaseCaFile = path.join(path.dirname(config.output), 'project-root.crt');
  await writeFile(databaseCaFile, 'Certificate fixture for path validation.');
  const captured = await capturePrivateRecovery({...config, databaseCaFile}, {
    ...options,
    async connectionFactory(url, databaseOptions) {
      assert.equal(url, config.databaseUrl);
      assert.equal(databaseOptions.databaseCaFile, databaseCaFile);
      return options.connectionFactory();
    },
  });
  const verified = await verifyRecoveryBundle({directory: config.output, key: config.recoveryKey});
  const summary = await verifyPrivateRecovery({directory: config.output, key: config.recoveryKey});
  assert.equal(captured.sourceStage, 'pre-upgrade');
  assert.equal(summary.sourceStage, 'pre-upgrade');
  assert.equal(summary.databaseRestoreAccepted, false);
  assert.deepEqual(verified.source.migrationVersions, historicalVersions);
  assert.deepEqual(verified.snapshot.migrationVersions, historicalVersions);
  assert.equal(verified.source.releaseSha, approvedLedger.releaseSha);
  assert.match(verified.source.approvedLedgerSha256, /^[a-f0-9]{64}$/);
  assert.equal(verified.source.profileSha256, null);
  assert.deepEqual(calls, {connections: 2, exports: 1, closed: 2});
}));

test('unapproved, malformed and unknown pre-upgrade ledger entries are rejected before connecting', () => fixture(async config => {
  const {calls, options} = source();
  for (const change of [
    {projectRef: 'foreign-project'}, {releaseSha: 'f'.repeat(40)}, {version: 1},
    {extra: 'unreviewed'}, {migrationVersions: []},
    {migrationVersions: [historicalVersions[0], historicalVersions[0]]},
    {migrationVersions: [...historicalVersions].reverse()},
    {migrationVersions: ['202611060999']},
  ]) {
    await writeFile(config.preUpgradeLedger, JSON.stringify({...approvedLedger, ...change}));
    await assert.rejects(capturePrivateRecovery(config, options), /Pre-upgrade ledger/);
  }
  assert.equal(calls.connections, 0);
  await assert.rejects(stat(config.output), {code: 'ENOENT'});
}));

test('pre-upgrade capture rejects missing, extra and replaced installed ledger entries before export', () => fixture(async config => {
  for (const state of [
    {ledgerPresent: false}, {versions: []}, {versions: sourceVersions}, {versions: sourceVersions.slice(1)},
  ]) {
    const {calls, options} = source(state);
    await assert.rejects(capturePrivateRecovery(config, options), /Installed migration history/);
    assert.deepEqual(calls, {connections: 1, exports: 0, closed: 1});
  }
  await assert.rejects(stat(config.output), {code: 'ENOENT'});
}));

test('the explicit ledger path cannot bypass the companion profile guard', () => fixture(async config => {
  const profiled = source({withProfile: true});
  await assert.rejects(capturePrivateRecovery(config, profiled.options), /before the MVP profile/);
  assert.equal(profiled.calls.exports, 0);
  const legacy = source({versions: sourceVersions});
  const {preUpgradeLedger, ...defaultConfig} = config;
  await assert.rejects(capturePrivateRecovery(defaultConfig, legacy.options), /exact MVP permissions/);
  assert.equal(legacy.calls.exports, 0);
}));

test('migration drift during capture discards the partial encrypted directory', () => fixture(async config => {
  const {calls, options} = source({freshVersions: sourceVersions});
  await assert.rejects(capturePrivateRecovery(config, options), /Installed migration history/);
  assert.deepEqual(calls, {connections: 2, exports: 1, closed: 2});
  await assert.rejects(stat(config.output), {code: 'ENOENT'});
}));

test('restore comparison preserves the source stage and migration history', () => {
  const legacy = {sourceStage: 'pre-upgrade', migrationVersions: historicalVersions};
  assert.throws(() => compareRecoverySnapshots(legacy, {...legacy, sourceStage: 'mvp'}), /source stage/);
  assert.throws(() => compareRecoverySnapshots(legacy, {...legacy, migrationVersions: sourceVersions}), /migration history/);
});
