import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {capturePrivateRecovery, PRE_UPGRADE_LEDGER_VERSION} from '../../scripts/private-recovery.mjs';
import {RECOVERY_PROJECT, verifyRecoveryBundle} from '../../scripts/recovery-bundle.mjs';
import {captureRecoverySnapshot, checkRecoveryDatabaseSource, compareRecoverySnapshots, openRecoveryPostgres} from '../../scripts/recovery-postgres.mjs';
import {quote, recoveryActor} from './fixtures/recovery-state.mjs';
import {preUpgradeVersions, preUpgradeMediaPath, preUpgradePng, preUpgradeProtectedState, registerPreUpgradeMedia, seedPreUpgradeRecovery} from './fixtures/pre-upgrade-recovery.mjs';

export async function verifyPreUpgradeRecovery({client, sql, restoreArchive, url}) {
  const migrations = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(migrations)).filter(file => file.endsWith('.sql')).sort();
  const versionOf = file => file.split('_')[0];
  const installed = files.filter(file => preUpgradeVersions.includes(versionOf(file)));
  const pending = files.filter(file => !preUpgradeVersions.includes(versionOf(file)));
  assert.deepEqual(installed.map(versionOf), preUpgradeVersions);
  assert.equal(versionOf(pending[0]), '202611060006');

  const directory = await mkdtemp(path.join(tmpdir(), 'dmocks-pre-upgrade-roundtrip-'));
  const suffix = randomUUID().replaceAll('-', '');
  const source = `dmocks_pre_upgrade_source_${suffix}`, target = `dmocks_pre_upgrade_restore_${suffix}`;
  const created = new Set();
  async function create(database) {
    await sql(`create database ${database};`, 'postgres');
    created.add(database);
  }
  async function drop(database) {
    await sql(`drop database ${database} with (force);`, 'postgres');
    created.delete(database);
  }
  async function connect(database) {
    const localUrl = new URL(url);
    localUrl.pathname = `/${database}`;
    return openRecoveryPostgres(localUrl.href, {localOnly: true, spawnClient: client});
  }
  async function apply(file, database) {
    const contents = await readFile(new URL(file, migrations), 'utf8');
    await sql(`${contents}\ninsert into supabase_migrations.schema_migrations(version) values (${quote(versionOf(file))});`, database);
  }
  async function readAttempt(actor, attempt, database) {
    const output = await sql(recoveryActor(actor, `select public.read_attempt(${quote(attempt)})`), database);
    return JSON.parse(output.split('\n').findLast(line => line.startsWith('{') && line.includes('"questions"')));
  }

  try {
    await create(source);
    await sql(await readFile(new URL('bootstrap.sql', import.meta.url), 'utf8'), source);
    await sql('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key);', source);
    for (const file of installed) await apply(file, source);
    const seeded = await sql(seedPreUpgradeRecovery(), source);
    const state = JSON.parse(seeded.split('\n').findLast(line => line.startsWith('{') && line.includes('"deadline"')));
    await sql(`insert into storage.objects(bucket_id,name,metadata) values ('paper-media',${quote(preUpgradeMediaPath)},
      jsonb_build_object('mimetype','image/png','cacheControl','max-age=3600','size',${preUpgradePng.length}));`, source);
    await sql(registerPreUpgradeMedia, source);
    const protectedState = preUpgradeProtectedState(state);
    const original = JSON.parse(await sql(protectedState, source));
    assert.ok(Object.values(original).every(value => value !== null));
    assert.equal(original.sale, false);
    assert.equal(original.registration, 'closed');

    const key = randomBytes(32).toString('hex'), releaseSha = 'a'.repeat(40);
    const ledger = path.join(directory, 'ledger.json'), bundle = path.join(directory, 'bundle');
    await writeFile(ledger, JSON.stringify({
      version: PRE_UPGRADE_LEDGER_VERSION, projectRef: RECOVERY_PROJECT, releaseSha, migrationVersions: preUpgradeVersions,
    }), {mode: 0o600});
    const config = {
      url: `https://${RECOVERY_PROJECT}.supabase.co`,
      databaseUrl: `postgresql://postgres:fictional@db.${RECOVERY_PROJECT}.supabase.co/postgres`,
      key: 'sb_secret_fictional_fixture', recoveryKey: key, releaseSha, output: bundle,
    };
    const options = {
      connectionFactory: async address => {
        assert.equal(address, config.databaseUrl);
        const connection = await connect(source);
        try {
          assert.equal(await connection.query('show transaction_read_only'), 'on');
          return connection;
        } catch (error) {
          await connection.close();
          throw error;
        }
      },
      fetchImpl: async address => {
        assert.equal(address, `${config.url}/storage/v1/object/paper-media/${preUpgradeMediaPath}`);
        return new Response(preUpgradePng);
      },
    };
    await assert.rejects(capturePrivateRecovery(config, options), /Recovery database command failed/);
    const captured = await capturePrivateRecovery({...config, preUpgradeLedger: ledger}, options);
    assert.equal(captured.sourceStage, 'pre-upgrade');
    const verified = await verifyRecoveryBundle({directory: bundle, key, extractTo: path.join(directory, 'extracted')});
    assert.deepEqual(verified.snapshot.migrationVersions, preUpgradeVersions);
    assert.deepEqual(await readFile(path.join(verified.extractedDirectory, 'payload-000001.bin')), preUpgradePng);

    await drop(source);
    await create(target);
    await restoreArchive(path.join(verified.extractedDirectory, 'payload-000000.bin'), target);
    const restored = await connect(target);
    try {
      compareRecoverySnapshots(verified.snapshot, await captureRecoverySnapshot(restored, {
        sourceStage: 'pre-upgrade', expectedVersions: verified.source.migrationVersions,
      }));
    } finally {
      await restored.close();
    }
    assert.deepEqual(JSON.parse(await sql(protectedState, target)), original);
    assert.equal((await readAttempt(state.owner, state.completed, target)).score, 4);
    await assert.rejects(readAttempt(state.other, state.completed, target));

    for (const file of pending) await apply(file, target);
    const profile = await readFile(new URL('../../supabase/launch/paid-mvp.sql', import.meta.url), 'utf8');
    await sql(`begin;\n${profile}\ncommit;`, target);
    const upgraded = await connect(target);
    try {
      const allVersions = files.map(versionOf);
      await checkRecoveryDatabaseSource(upgraded, {expectedVersions: allVersions});
      await assert.rejects(checkRecoveryDatabaseSource(upgraded, {
        sourceStage: 'pre-upgrade', expectedVersions: allVersions,
      }), /before the MVP profile/);
    } finally {
      await upgraded.close();
    }
    assert.deepEqual(JSON.parse(await sql(protectedState, target)), original);
    assert.equal((await readAttempt(state.owner, state.active, target)).questions[0].answer, '1');
    await assert.rejects(readAttempt(state.other, state.active, target));
    await assert.rejects(sql('set role anon; select public.my_pass();', target));
    assert.equal(await sql('select count(*) from dm_private.mvp_paid_releases;', target), '0');
    console.log(JSON.stringify({
      passed: true, preUpgradeArchiveRestored: true, historicalMigrations: installed.length,
      pendingMigrationsAppliedAfterRestore: pending.length, exactSchemaRlsGrantsRowsAndSequences: true,
      historicalGapPreserved: true, bankMediaAccountAttemptPaymentAndSupportPreserved: true,
      foreignAndAnonymousDenied: true, storage: 'mock-catalogue-only',
      registrationAndSalesClosed: true, hostedWritesPerformed: false,
    }));
  } finally {
    try {
      for (const database of created) await drop(database);
    } finally {
      await rm(directory, {recursive: true, force: true});
    }
  }
}
