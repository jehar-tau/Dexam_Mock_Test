// Actual PostgreSQL 17 dump/restore after the disposable authorization suites.
// Mock Storage here is supplemented by the isolated real-Supabase rehearsal.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {openRecoveryPostgres,checkRecoveryDatabaseSource,captureRecoverySnapshot,compareRecoverySnapshots,recoveryPostgresEnvironment} from '../../scripts/recovery-postgres.mjs';
import {createRecoveryBundle,verifyRecoveryBundle,RECOVERY_PROJECT} from '../../scripts/recovery-bundle.mjs';
import {recoverySeed,recoveryActor,quote} from './fixtures/recovery-state.mjs';
import {verifyPreUpgradeRecovery} from './pre-upgrade-recovery-roundtrip.mjs';

async function main(){
 const url=process.env.DESIGNMOCKS_TEST_DATABASE_URL,environment=recoveryPostgresEnvironment(url,{localOnly:true});
 assert.equal(environment.PGDATABASE,'designmocks_ci','Only the disposable bootstrap database is permitted');
 let container=process.env.DMOCKS_RECOVERY_TEST_CONTAINER;
 if(!container){
  assert.equal(process.env.GITHUB_ACTIONS,'true','Local recovery checks require an explicitly owned test container');
  const ids=execFileSync('docker',['ps','-q','--filter','ancestor=postgres:17'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim().split('\n').filter(Boolean);
  assert.ok(ids.length,'The CI PostgreSQL service is required');
  const services=JSON.parse(execFileSync('docker',['inspect',...ids],{encoding:'utf8',stdio:['ignore','pipe','pipe']})).filter(item=>item.Config.Image==='postgres:17'&&item.Config.Env.includes('POSTGRES_DB=designmocks_ci')&&item.Config.Env.includes('POSTGRES_USER=postgres'));
  assert.equal(services.length,1,'Exactly one disposable CI database service must match');container=services[0].Id;
 }
 assert.match(container??'',/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/);
 const info=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))[0];
 assert.ok(info.Config.Image==='postgres:17'&&info.Config.Env.includes('POSTGRES_DB=designmocks_ci')&&info.Config.Env.includes('POSTGRES_USER=postgres'),'Use the explicitly owned PostgreSQL 17 test service');
 function client(command,args,{env=environment}={}){
  assert.ok(['psql','pg_dump','pg_restore'].includes(command));
  return spawn('docker',['exec','-i',...['PGUSER','PGPASSWORD','PGDATABASE'].flatMap(key=>['-e',key+'='+env[key]]),container,command,...args],{stdio:['pipe','pipe','pipe']});
 }
 async function sql(statement,database=environment.PGDATABASE){
  const child=client('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],{env:{...environment,PGDATABASE:database}});let output='';
  child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.resume();const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});child.stdin.end(statement+'\n');assert.equal(await done,0,'Original recovery fixture database command failed');return output.trim();
 }
 async function restoreArchive(file, database) {
  const child = client('pg_restore', ['--exit-on-error', '--single-transaction', '--dbname=' + database]);
  child.stdout.resume();
  child.stderr.resume();
  const done = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  await pipeline(createReadStream(file), child.stdin);
  assert.equal(await done, 0, 'The private PostgreSQL archive must restore without ignored errors');
 }
 if (process.argv[2] === '--pre-upgrade') {
  await verifyPreUpgradeRecovery({client, sql, restoreArchive, url});
  return;
 }
 const workspace=await mkdtemp(path.join(tmpdir(),'dmocks-recovery-')),target='dmocks_recovery_restore_'+randomUUID().replaceAll('-','');let created=false,connection;
 const stagingTarget = target + '_stage';
 let stagingCreated = false;
 try{
  assert.equal(await sql('select(select count(*)from auth.users)+(select count(*)from dm_private.papers)+(select count(*)from dm_private.attempts)+(select count(*)from storage.objects);'),'0','Recovery CI starts only after rolled-back original fictional suites');
  const seeded=await sql(recoverySeed().source),state=JSON.parse(seeded.split('\n').findLast(line=>line.startsWith('{')&&line.includes('"auditMax"')));
  const bytes=Buffer.from('Original fictional private recovery bytes.');
  await sql(`insert into storage.objects(bucket_id,name,metadata)values('paper-media','papers/original-recovery.png',jsonb_build_object('mimetype','image/png','cacheControl','max-age=3600','size',${bytes.length}));`);
  connection=await openRecoveryPostgres(url,{localOnly:true,spawnClient:client});
  // A genuine server-side read-only transaction is part of the operator contract.
  const probe=await openRecoveryPostgres(url,{localOnly:true,spawnClient:client});
  try{await assert.rejects(probe.query('update public.launch_settings set sales_enabled=true'));}finally{await probe.close();}
  const snapshot=await captureRecoverySnapshot(connection),exported=await connection.exportSnapshot(),key=randomBytes(32).toString('hex'),directory=path.join(workspace,'bundle');
  await createRecoveryBundle({output:directory,key,source:{projectRef:RECOVERY_PROJECT,releaseSha:'a'.repeat(40)},snapshot,database:connection.dump(exported),objects:snapshot.objects,readObject:async()=>[bytes],assertUnchanged:async()=>true});await connection.close();connection=null;
  await assert.rejects(verifyRecoveryBundle({directory,key:randomBytes(32).toString('hex'),extractTo:path.join(workspace,'wrong-key')}));
  const verified=await verifyRecoveryBundle({directory,key,extractTo:path.join(workspace,'verified')});
  assert.equal(verified.privateObjects,1);assert.deepEqual(await readFile(path.join(verified.extractedDirectory,'payload-000001.bin')),bytes);
  await sql('create database '+target+';','postgres');created=true;
  await restoreArchive(path.join(verified.extractedDirectory,'payload-000000.bin'),target);
  const restoredUrl=new URL(url);restoredUrl.pathname='/'+target;
  connection=await openRecoveryPostgres(restoredUrl.href,{localOnly:true,spawnClient:client});
  compareRecoverySnapshots(snapshot,await captureRecoverySnapshot(connection));await connection.close();connection=null;
  const owned=JSON.parse((await sql(recoveryActor(state.owner,`select public.read_attempt(${quote(state.completed)})`),target)).split('\n').findLast(line=>line.startsWith('{')&&line.includes('"questions"')));
  assert.equal(owned.score,4);assert.equal(owned.total,200);assert.equal(owned.questions.length,57);assert.equal(owned.questions[0].answer,'1');
  assert.equal(await sql(`select (select count(*)=114 from dm_private.attempt_items)and(select answer_revision=9 and answer='"1"'::jsonb from dm_private.attempt_items where attempt_id=${quote(state.active)}and ordinal=2)and(select deadline=${quote(state.deadline)}::timestamptz and deadline=started_at+interval'7200 seconds'from dm_private.attempts where id=${quote(state.active)})and(select status='paid'and payment_id=${quote(state.payment)}from dm_private.orders where id=${quote(state.order)})and(select outcome='granted'from dm_private.payment_events where event_id=${quote(state.event)})and(select status='fixed'and admin_reply='Original fictional restored support reply.'from dm_private.bug_reports where id=${quote(state.report)});`,target),'t');
  const support = await sql(recoveryActor(state.owner, "select public.my_bug_report_page()#>'{items,0,purchase}'"), target);
  const purchase = JSON.parse(support.split('\n').findLast(line => line.startsWith('{')));
  assert.deepEqual(purchase, {reference: state.order, mode: 'test'});
  const pass=(await sql(recoveryActor(state.owner,'select public.my_pass()'),target)).split('\n').findLast(line=>line.startsWith('{'));assert.equal(JSON.parse(pass).active,true);
  await assert.rejects(sql(recoveryActor(state.other,`select public.read_attempt(${quote(state.completed)})`),target));
  await assert.rejects(sql(recoveryActor(state.owner,'select *from dm_private.payment_events'),target));
  await assert.rejects(sql('set role anon;select public.my_pass();',target));
  assert.equal(await sql(`insert into dm_private.launch_gate_audit(gate,approved,evidence,actor_id)values('backup_restore',false,'Original fictional recovery after restore.',${quote(state.admin)})returning id>${Number(state.auditMax)};`,target),'t');
  assert.equal(await sql("select not sales_enabled and dm_private.mvp_profile_permissions_valid()and(select mode='closed'from dm_private.registration_policy)from public.launch_settings;",target),'t');
  const expectedVersions = (await readdir(new URL('../../supabase/migrations', import.meta.url)))
    .filter(file => file.endsWith('.sql')).map(file => file.split('_')[0]).sort();
  const stagingCheck = {sourceStage: 'staging-before-permissions-repair', expectedVersions};
  async function withStagingSnapshot(operation, database = restoredUrl) {
    const session = await openRecoveryPostgres(database.href, {localOnly: true, spawnClient: client});
    try {
      return await operation(session);
    } finally {
      await session.close();
    }
  }
  await sql(`create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key);
    insert into supabase_migrations.schema_migrations values ${expectedVersions.map(version => '(' + quote(version) + ')').join(',')};`, target);
  const checkStage = session => checkRecoveryDatabaseSource(session, stagingCheck);
  await assert.rejects(withStagingSnapshot(checkStage), /Staging recovery requires/);
  await sql(`insert into dm_private.mvp_rpc_allowlist values ('public.community_thread(uuid)', 'student');
    grant execute on function public.community_thread(uuid) to authenticated;
    grant execute on function public.my_pass() to anon;`, target);
  await assert.rejects(withStagingSnapshot(session => captureRecoverySnapshot(session)), /exact MVP permissions/);
  for (const [open, close] of [
    ["update public.launch_settings set environment_mode='live'", "update public.launch_settings set environment_mode='test'"],
    ["update dm_private.registration_policy set mode='open'", "update dm_private.registration_policy set mode='testers'"],
    [`update dm_private.mvp_test_checkout_control set enabled=true, expires_at=clock_timestamp()-interval '1 minute',
      evidence='Fictional closed window', actor_id=${quote(state.admin)}`, 'update dm_private.mvp_test_checkout_control set enabled=false'],
  ]) {
    await sql(open, target);
    await assert.rejects(withStagingSnapshot(checkStage), /Staging recovery requires/);
    await sql(close, target);
  }
  // The fixture's drifted grants and private rows must survive a second isolated restore.
  const stagingDirectory = path.join(workspace, 'staging-bundle');
  const stagingSnapshot = await withStagingSnapshot(async session => {
    const snapshot = await captureRecoverySnapshot(session, stagingCheck);
    const exported = await session.exportSnapshot();
    await createRecoveryBundle({
      output: stagingDirectory, key, source: {projectRef: RECOVERY_PROJECT, releaseSha: 'a'.repeat(40)},
      snapshot, database: session.dump(exported), objects: snapshot.objects,
      readObject: async () => [bytes], assertUnchanged: async () => true,
    });
    return snapshot;
  });
  const stagingArchive = await verifyRecoveryBundle({
    directory: stagingDirectory, key, extractTo: path.join(workspace, 'staging-verified'),
  });
  await sql('create database ' + stagingTarget + ';', 'postgres');
  stagingCreated = true;
  await restoreArchive(path.join(stagingArchive.extractedDirectory, 'payload-000000.bin'), stagingTarget);
  const stagingUrl = new URL(restoredUrl);
  stagingUrl.pathname = '/' + stagingTarget;
  const stagingRestored = await withStagingSnapshot(session => captureRecoverySnapshot(session, stagingCheck), stagingUrl);
  compareRecoverySnapshots(stagingSnapshot, stagingRestored);
  const profileSql = await readFile(new URL('../../supabase/launch/paid-mvp.sql', import.meta.url), 'utf8');
  await sql('begin;\n' + profileSql + '\ncommit;', stagingTarget);
  await withStagingSnapshot(async session => {
    const repaired = await captureRecoverySnapshot(session, {expectedVersions});
    const preservedRows = snapshot => snapshot.rows.filter(row => row.schema !== 'dm_private' || row.name !== 'mvp_rpc_allowlist');
    assert.deepEqual(preservedRows(repaired), preservedRows(stagingRestored), 'Permissions repair changed captured application rows');
  }, stagingUrl);
  assert.equal(await sql(`select not has_function_privilege('anon', 'public.my_pass()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.community_thread(uuid)', 'EXECUTE')
    and not (select sales_enabled from public.launch_settings)
    and (select mode = 'testers' from dm_private.registration_policy)
    and not (select enabled from dm_private.mvp_test_checkout_control);`, stagingTarget), 't');
  console.log(JSON.stringify({stagingBeforePermissionsRepairRestored: true, permissionsRepairRehearsed: true, hostedWritesPerformed: false}));
  console.log(JSON.stringify({passed:true,actualPostgres17ArchiveRestored:true,exactSchemaRlsGrantsRowsAndSequences:true,originalQuestions:57,frozenItems:114,paidPassAndEventPreserved:true,purchaseSupportLinkPreserved:true,answerRevisionAndOriginalDeadlinePreserved:true,foreignAndAnonymousDenied:true,privateBytesVerified:true,storage:'mock-catalogue-only',registrationAndSalesClosed:true,hostedWritesPerformed:false}));
 }finally{
  await connection?.close();if(stagingCreated)await sql('drop database '+stagingTarget+' with(force);','postgres');if(created)await sql('drop database '+target+' with(force);','postgres');await rm(workspace,{recursive:true,force:true});
 }
}
main().catch(()=>{console.error('RECOVERY_ROUNDTRIP_FAILED');process.exitCode=1;});
