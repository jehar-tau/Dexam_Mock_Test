import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {capturePrivateRecovery, STAGING_RECOVERY_LEDGER_VERSION} from '../../scripts/private-recovery.mjs';
import {RECOVERY_PROJECT, verifyRecoveryBundle} from '../../scripts/recovery-bundle.mjs';
import {captureRecoverySnapshot, compareRecoverySnapshots, openRecoveryPostgres} from '../../scripts/recovery-postgres.mjs';
import {quote, recoveryActor, recoverySeed} from './fixtures/recovery-state.mjs';
import {withoutFreeYearPapers} from './fixtures/historic-paid-profile.mjs';

const migrationDirectory = new URL('../../supabase/migrations/', import.meta.url);
const launchDirectory = new URL('../../supabase/launch/', import.meta.url);
const rpcInventory = new URL('../../supabase/audit/staging-rpc-inventory.sql', import.meta.url);
const storageMigration = '202611140167_private_storage_boundary.sql';
const tester = '00000000-0000-4000-8000-000000000192';
const testerEmail = 'restore-approved@example.invalid';
const figurePath = 'papers/original-staging-recovery.png';
const figure = Buffer.from('Fictional private staging recovery fixture.');

export async function verifyCurrentStagingRecovery({client, sql, restoreArchive, url}) {
  const installed = (await readdir(migrationDirectory)).filter(file => /^\d{12}_.*\.sql$/.test(file) && file < storageMigration).sort();
  const versions = installed.map(file => file.split('_')[0]);
  assert.equal(versions.length, 90);
  assert.equal(versions.at(-1), '202611100166');
  const directory = await mkdtemp(join(tmpdir(), 'dmocks-current-staging-recovery-'));
  const suffix = randomUUID().replaceAll('-', '');
  const source = 'dmocks_stage_source_' + suffix;
  const target = 'dmocks_stage_restore_' + suffix;
  const created = new Set();
  async function create(database) {
    await sql('create database ' + database, 'postgres');
    created.add(database);
  }
  async function drop(database) {
    await sql('drop database ' + database + ' with (force)', 'postgres');
    created.delete(database);
  }
  async function connect(database) {
    const local = new URL(url);
    local.pathname = '/' + database;
    return openRecoveryPostgres(local.href, {localOnly: true, spawnClient: client});
  }
  async function apply(file, database) {
    await sql(await readFile(new URL(file, migrationDirectory), 'utf8'), database);
    await sql('insert into supabase_migrations.schema_migrations values (' + quote(file.split('_')[0]) + ')', database);
  }
  try {
    await create(source);
    await sql(await readFile(new URL('bootstrap.sql', import.meta.url), 'utf8'), source);
    await sql('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key);', source);
    for (const file of installed) await apply(file, source);
    await sql(withoutFreeYearPapers(await readFile(new URL('paid-mvp.sql', launchDirectory), 'utf8')), source);
    const seed = await sql(recoverySeed().source, source);
    const state = JSON.parse(seed.split('\n').findLast(line => line.startsWith('{') && line.includes('"auditMax"')));
    await sql(`update dm_private.registration_policy set mode='testers' where id;
      grant execute on function public.community_thread(uuid) to authenticated;
      insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data)
        values (${quote(tester)},${quote(testerEmail)},now(),'{"provider":"google"}');
      insert into dm_private.registration_testers(email) values (${quote(testerEmail)});
      insert into storage.objects(bucket_id,name,metadata) values ('paper-media',${quote(figurePath)},
        jsonb_build_object('mimetype','image/png','size',${figure.length}));`, source);

    const recoveryKey = randomBytes(32).toString('hex');
    const releaseSha = 'a'.repeat(40);
    const stagingLedger = join(directory, 'ledger.json');
    const output = join(directory, 'bundle');
    const backend = 'https://' + RECOVERY_PROJECT + '.supabase.co';
    await writeFile(stagingLedger, JSON.stringify({
      version: STAGING_RECOVERY_LEDGER_VERSION, projectRef: RECOVERY_PROJECT, releaseSha, migrationVersions: versions,
    }), {mode: 0o600});
    const captured = await capturePrivateRecovery({
      url: backend, key: 'sb_secret_fictional_fixture', recoveryKey, releaseSha, output, stagingLedger,
      databaseUrl: 'postgresql://postgres:fictional@db.' + RECOVERY_PROJECT + '.supabase.co/postgres',
    }, {
      expectedVersions: versions,
      connectionFactory: () => connect(source),
      fetchImpl: async address => {
        assert.equal(address, backend + '/storage/v1/object/paper-media/' + figurePath);
        return new Response(figure);
      },
    });
    assert.equal(captured.sourceStage, 'staging-before-permissions-repair');
    const verified = await verifyRecoveryBundle({directory: output, key: recoveryKey, extractTo: join(directory, 'extracted')});
    assert.deepEqual(await readFile(join(verified.extractedDirectory, 'payload-000001.bin')), figure);
    await drop(source);
    await create(target);
    await restoreArchive(join(verified.extractedDirectory, 'payload-000000.bin'), target);
    const restored = await connect(target);
    try {
      compareRecoverySnapshots(verified.snapshot, await captureRecoverySnapshot(restored, {
        sourceStage: 'staging-before-permissions-repair', expectedVersions: versions,
      }));
    } finally {
      await restored.close();
    }
    const inventoryQuery = await readFile(rpcInventory, 'utf8');
    const hookSetting = `select setting from pg_db_role_setting
      cross join lateral unnest(setconfig) as configured(setting)
      where setrole = 'authenticator'::regrole and setdatabase = (select oid from pg_database where datname = current_database())
        and split_part(setting, '=', 1) = 'pgrst.db_pre_request';`;
    assert.equal(await sql(hookSetting, target), '');
    const priorInventory = JSON.parse(await sql(inventoryQuery, target));
    const verifyPriorInventory = async () => {
      const current = JSON.parse(await sql(inventoryQuery, target));
      const correction = current.functions.find(row => row.signature === answerCorrectionSignature);
      assert.ok(correction && !correction.anon && !correction.authenticated);
      assert.deepEqual({ ...current, functions: current.functions.filter(row => row !== correction) }, priorInventory);
    };
    const directAuthenticatedGrants = `select coalesce(jsonb_agg(signature order by signature), '[]')
      from (select format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)) as signature
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prokind = 'f'
          and exists (select from aclexplode(p.proacl) a
            where a.grantee = 'authenticated'::regrole and a.privilege_type = 'EXECUTE')) grants;`;
    const priorDirectGrants = new Set(JSON.parse(await sql(directAuthenticatedGrants, target)));
    assert.ok(priorDirectGrants.has('public.community_thread(uuid)'));
    const answerCorrectionMigration = '202611140168_bank_answer_correction_packets.sql';
    const answerCorrectionSignature = 'public.admin_prepare_bank_answer_correction(text, text, text, text)';
    await apply(storageMigration, target);
    await apply(answerCorrectionMigration, target);
    await sql("revoke execute on function " + answerCorrectionSignature + " from authenticated", target);
    await sql(await readFile(new URL('private-staging-api.sql', launchDirectory), 'utf8'), target);
    await sql(await readFile(new URL('private-staging-portal-grants.sql', launchDirectory), 'utf8'), target);
    assert.equal(await sql(`select exists (select from pg_policies where schemaname='storage' and tablename='objects'
        and policyname='dmocks_private_objects_require_server' and permissive='RESTRICTIVE')
      and has_function_privilege('authenticated','public.admin_prepare_bank_answer_correction(text,text,text,text)','execute')
      and has_function_privilege('authenticated','public.community_feed(text,text,jsonb,integer)','execute')
      and not has_function_privilege('anon','public.public_all_india_top_ten()','execute')
      and not dm_private.mvp_test_checkout_allowed()
      and (select environment_mode='test' and not sales_enabled from public.launch_settings)
      and (select mode='testers' from dm_private.registration_policy);`, target), 't');
    await sql(recoveryActor(tester, 'select dm_staging_api.check_admission()'), target);
    await assert.rejects(sql(recoveryActor(state.other, 'select dm_staging_api.check_admission()'), target));
    const attempt = await sql(recoveryActor(state.owner, 'select public.read_attempt(' + quote(state.completed) + ')'), target);
    assert.equal(JSON.parse(attempt.split('\n').findLast(line => line.startsWith('{'))).score, 4);
    await assert.rejects(sql(recoveryActor(state.other, 'select public.read_attempt(' + quote(state.completed) + ')'), target));
    const expiredAttempt = quote(state.active);
    await sql(`update dm_private.attempts set started_at = now() - interval '7201 seconds',
      deadline = now() - interval '1 second' where id = ${expiredAttempt};`, target);
    await assert.rejects(sql(recoveryActor(tester, 'select public.finalize_expired_attempts(10)'), target));
    const sweep = () => sql(`begin; set local role service_role; set local "request.jwt.claim.role" = 'service_role';
      select public.finalize_expired_attempts(10); commit;`, target);
    assert.equal(await sweep(), '1');
    assert.equal(await sweep(), '0');
    assert.equal(await sql(`select a.status = 'submitted' and a.submitted_at = a.deadline
      and a.score = 4 and i.answer = '"1"'::jsonb and i.answer_revision = 9
      from dm_private.attempts a join dm_private.attempt_items i on i.attempt_id = a.id
      where a.id = ${expiredAttempt} and i.ordinal = 2;`, target), 't');
    const portalDirectGrants = JSON.parse(await sql(directAuthenticatedGrants, target));
    const addedGrants = portalDirectGrants.filter(signature => !priorDirectGrants.has(signature));
    assert.ok(addedGrants.includes('public.community_feed(text, text, jsonb, integer)'));
    await sql('revoke execute on function ' + addedGrants.join(', ') + ' from authenticated;', target);
    assert.deepEqual(new Set(JSON.parse(await sql(directAuthenticatedGrants, target))), priorDirectGrants);
    await verifyPriorInventory();
    await assert.rejects(sql(recoveryActor(state.other, 'select dm_staging_api.check_admission()'), target));
    assert.equal(await sql(hookSetting, target), 'pgrst.db_pre_request=dm_staging_api.check_admission');
    await sql(`alter role authenticator in database ${target} reset pgrst.db_pre_request;
      notify pgrst, 'reload config';`, target);
    assert.equal(await sql(hookSetting, target), '');
    assert.equal(await sql(`select exists (select from pg_policies where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'dmocks_private_objects_require_server' and permissive = 'RESTRICTIVE');`, target), 't');
    await verifyPriorInventory();
    await sql(await readFile(new URL('private-staging-api.sql', launchDirectory), 'utf8'), target);
    await sql(await readFile(new URL('private-staging-portal-grants.sql', launchDirectory), 'utf8'), target);
    assert.equal(await sql('select dm_private.mvp_profile_permissions_valid()', target), 'f');
    const paidProfile = withoutFreeYearPapers(await readFile(new URL('paid-mvp.sql', launchDirectory), 'utf8'));
    await sql(`begin;
${paidProfile}
commit;`, target);
    assert.equal(await sql(`select dm_private.mvp_profile_permissions_valid()
      and not (select enabled from dm_private.mvp_test_checkout_control where singleton)
      and (select environment_mode = 'test' and not sales_enabled from public.launch_settings where singleton)
      and (select mode = 'testers' from dm_private.registration_policy where id)
      and not has_function_privilege('authenticated', 'public.community_feed(text,text,jsonb,integer)', 'execute')
      and not has_function_privilege('authenticated', 'public.admin_prepare_bank_answer_correction(text,text,text,text)', 'execute')
      and not has_function_privilege('anon', 'public.public_all_india_top_ten()', 'execute')
      and has_function_privilege('service_role', 'public.prepare_mvp_paper(jsonb)', 'execute')
      and not has_function_privilege('authenticated', 'public.prepare_mvp_paper(jsonb)', 'execute');`, target), 't');
    assert.equal(await sql(hookSetting, target), 'pgrst.db_pre_request=dm_staging_api.check_admission');
    await sql(recoveryActor(tester, 'select dm_staging_api.check_admission()'), target);
    await assert.rejects(sql(recoveryActor(state.other, 'select dm_staging_api.check_admission()'), target));
    console.log('PASS: the 90-version staging archive rehearses rollout, exact grant rollback and the private paid-profile transition.');
  } finally {
    for (const database of created) await drop(database);
    await rm(directory, {recursive: true, force: true});
  }
}
