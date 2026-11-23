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
import {withoutFreeYearPapers} from './fixtures/historic-paid-profile.mjs';

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
      fetchImpl: async (address, request) => {
        assert.equal(address, `${config.url}/storage/v1/object/paper-media/${preUpgradeMediaPath}`);
        assert.equal(request.headers.get('apikey'), config.key);
        assert.equal(request.headers.has('authorization'), false);
        assert.equal(request.headers.get('accept-encoding'), 'identity');
        assert.equal(request.redirect, 'error');
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

    const profile = await readFile(new URL('../../supabase/launch/paid-mvp.sql', import.meta.url), 'utf8');
    // The historical 47/48/49-RPC companions predate free year papers. Rebuild
    // them from the reviewed current profile without referring to later RPCs.
    const legacyProfile = withoutFreeYearPapers(profile);
    const purchaseHistorySignature = 'public.my_purchase_page(timestamp with time zone,uuid)';
    const purchaseSupportSignature = 'public.submit_bug_report(text,text,text,uuid,uuid)';
    const purchaseHistoryEntry = ` ('${purchaseHistorySignature}','student'),\n`;
    const purchaseSupportEntry = `,\n ('${purchaseSupportSignature}','student');`;
    const withoutSupport = legacyProfile.split(purchaseSupportEntry);
    assert.equal(withoutSupport.length, 2, 'Expected exactly one purchase support entry in the current paid profile');
    const historyProfile = withoutSupport.join(';');
    const withoutHistory = historyProfile.split(purchaseHistoryEntry);
    assert.equal(withoutHistory.length, 2, 'Expected exactly one purchase history entry in the previous paid profile');
    const originalProfile = withoutHistory.join('');
    const installPaidProfile = profileSql => sql(`begin;\n${profileSql}\ncommit;`, target);
    const checkPurchaseProfile = (signature, count, authenticated) => sql(`select dm_private.mvp_profile_permissions_valid()
      and (select count(*) from dm_private.mvp_rpc_allowlist)=${count}
      and has_function_privilege('authenticated',${quote(signature)},'EXECUTE') = ${authenticated}
      and not exists (
        select 1 from unnest(array['anon','service_role']) roles(role)
        where has_function_privilege(role,${quote(signature)},'EXECUTE')
      );`, target);
    const existingReportRequest = randomUUID();
    const reportArguments = `'Original historical receipt', 'Fictional report before purchase support.', null, ${quote(existingReportRequest)}`;
    let existingReport;
    for (const file of pending) {
      const version = versionOf(file);
      if (version === '202611090158') {
        // Model the installed companion from before purchase history existed.
        await installPaidProfile(originalProfile);
      }
      if (version === '202611090161') {
        const result = await sql(recoveryActor(state.owner, `select public.submit_bug_report(${reportArguments})`), target);
        existingReport = result.split('\n').find(line => /^[a-f0-9-]{36}$/.test(line) && line !== state.owner);
        assert.ok(existingReport, 'The preceding paid profile accepted a four-argument support submission');
      }
      await apply(file, target);
      if (version === '202611090158') {
        assert.equal(await sql(`select dm_private.mvp_profile_permissions_valid()
          and (select count(*) from dm_private.mvp_rpc_allowlist)=47 and not exists (
          select 1 from unnest(array['anon','authenticated','service_role']) roles(role)
          cross join unnest(array['public.public_all_india_top_ten()','public.all_india_event_catalog()',
            'public.admin_open_all_india_ranking_publication(uuid,text,text)',
            'public.admin_close_all_india_ranking_publication(uuid,uuid,text)',
            'public.set_all_india_result_sharing(uuid,uuid,integer,boolean)']) signatures(signature)
          where has_function_privilege(role,signature,'EXECUTE')
            and (role<>'service_role' or signature not in ('public.public_all_india_top_ten()','public.all_india_event_catalog()'))
        );`, target), 't', 'ranking migration leaves the already installed paid profile closed and valid');
      }
      if (version === '202611090160') {
        assert.equal(await checkPurchaseProfile(purchaseHistorySignature, 47, false), 't',
          'purchase history migration preserves the installed paid profile until companion reapplication');
        await installPaidProfile(historyProfile);
        assert.equal(await checkPurchaseProfile(purchaseHistorySignature, 48, true), 't',
          'the preceding 48-RPC companion grants purchase history to authenticated callers');
      }
      if (version === '202611090161') {
        assert.equal(await checkPurchaseProfile(purchaseSupportSignature, 48, false), 't',
          'purchase support migration preserves the preceding 48-RPC companion');
      }
    }
    await installPaidProfile(profile);
    assert.equal(await checkPurchaseProfile(purchaseHistorySignature, 52, true), 't', 'purchase history remains enabled');
    assert.equal(await checkPurchaseProfile(purchaseSupportSignature, 52, true), 't',
      'the reviewed 52-RPC companion grants purchase support only to authenticated callers');
    const replay = await sql(recoveryActor(state.owner, `select public.submit_bug_report(${reportArguments}, null)`), target);
    assert.ok(replay.split('\n').includes(existingReport), 'new overload replays a pre-migration four-argument receipt');
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
      foreignAndAnonymousDenied: true, paidProfilePreservedThroughRankingAndPurchaseMigrations: true,
      purchaseHistoryEnabledByCompanionOnly: true, purchaseSupportEnabledByCompanionOnly: true, storage: 'mock-catalogue-only',
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
