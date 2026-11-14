// Private operator CLI. Capture is read-only; no command restores a hosted DB.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir,lstat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRecoveryBundle,verifyRecoveryBundle,RECOVERY_PROJECT} from './recovery-bundle.mjs';
import {
  openRecoveryPostgres, captureRecoverySnapshot, checkRecoveryDatabaseSource,
  recoverySchemaQuery, recoveryBucketsQuery, recoveryObjectsQuery, recoveryPostgresEnvironment,
} from './recovery-postgres.mjs';
import {openPrivateDMocksTransport} from './private-bank-provider.mjs';
import {stableJson} from './question-bank-import.mjs';
const ledgerVersions = {
  'pre-upgrade': 'dmocks-pre-upgrade-ledger-v1',
  'staging-before-permissions-repair': 'dmocks-staging-recovery-ledger-v1',
};
export const PRE_UPGRADE_LEDGER_VERSION = ledgerVersions['pre-upgrade'];
export const STAGING_RECOVERY_LEDGER_VERSION = ledgerVersions['staging-before-permissions-repair'];
const hash=value=>createHash('sha256').update(stableJson(value)).digest('hex');
function claims(value){try{return JSON.parse(Buffer.from(value.split('.')[1],'base64url').toString());}catch{return null;}}
export function validateRecoveryCaptureConfiguration({url,key,databaseUrl,databaseCaFile,recoveryKey,releaseSha}){
 assert.ok(url===`https://${RECOVERY_PROJECT}.supabase.co`,'Only the standalone DMocks Storage origin is permitted');
 openPrivateDMocksTransport({url,serviceRoleKey:key,allowOrigin:url,environment:'staging'});
 recoveryPostgresEnvironment(databaseUrl, {databaseCaFile});
 assert.match(recoveryKey??'',/^[a-f0-9]{64}$/,'A private random 32-byte recovery key is required');assert.match(releaseSha??'',/^[a-f0-9]{40}$/,'Specify the exact approved database release SHA');return true;
}
const objectUrl=(origin,object)=>origin+'/storage/v1/object/'+[object.bucket,...object.name.split('/')].map(encodeURIComponent).join('/');
async function downloadObject(transport, object) {
 const response = await transport.fetch(objectUrl(transport.origin, object), {headers: {'accept-encoding': 'identity'}});
 if (response.status !== 200 || !response.body) {
  await response.body?.cancel().catch(() => {});
  throw new Error('Private recovery object download failed');
 }
 return response.body;
}
async function readRecoveryLedger(file, releaseSha, sourceVersions, sourceStage) {
  const label = sourceStage === 'pre-upgrade' ? 'Pre-upgrade ledger' : 'Staging recovery ledger';
  const info = await lstat(file);
  assert.ok(info.isFile() && info.size <= 16_384, `${label} must be a reviewed JSON file`);
  let ledger;
  try {
    ledger = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    throw new Error(`${label} must be readable JSON`);
  }
  assert.ok(ledger && Object.keys(ledger).sort().join(',') === 'migrationVersions,projectRef,releaseSha,version'
    && ledger.version === ledgerVersions[sourceStage] && ledger.projectRef === RECOVERY_PROJECT
    && ledger.releaseSha === releaseSha, `${label} must name the approved DMocks project and release`);
  const knownVersions = new Set(sourceVersions);
  assert.ok(Array.isArray(ledger.migrationVersions) && ledger.migrationVersions.length > 0
    && ledger.migrationVersions.every((version, index, versions) => typeof version === 'string'
      && knownVersions.has(version) && (index === 0 || versions[index - 1] < version)),
  `${label} must list known migration versions in order without duplicates`);
  if (sourceStage === 'staging-before-permissions-repair') {
    assert.deepEqual(ledger.migrationVersions, sourceVersions, 'Staging recovery ledger must match the complete source migration history');
  }
  return ledger;
}

export function readPreUpgradeLedger(file, releaseSha, sourceVersions) {
  return readRecoveryLedger(file, releaseSha, sourceVersions, 'pre-upgrade');
}

export async function capturePrivateRecovery(config, {
  connectionFactory = openRecoveryPostgres, fetchImpl = fetch, expectedVersions, profileSha256,
} = {}) {
  validateRecoveryCaptureConfiguration(config);
  assert.ok(config.output, 'Choose a new private recovery directory');
  const sourceVersions = expectedVersions ?? (await readdir(new URL('../supabase/migrations', import.meta.url)))
    .filter(file => file.endsWith('.sql')).map(file => file.split('_')[0]).sort();
  assert.ok(config.preUpgradeLedger === undefined || config.stagingLedger === undefined,
    'Choose only one recovery ledger');
  const sourceStage = config.stagingLedger !== undefined ? 'staging-before-permissions-repair'
    : config.preUpgradeLedger !== undefined ? 'pre-upgrade' : 'mvp';
  const ledger = sourceStage === 'mvp' ? null : await readRecoveryLedger(
    config.stagingLedger ?? config.preUpgradeLedger, config.releaseSha, sourceVersions, sourceStage,
  );
  const versions = ledger?.migrationVersions ?? sourceVersions;
  const profile = ledger ? null : profileSha256 ?? createHash('sha256')
    .update(await readFile(new URL('../supabase/launch/paid-mvp.sql', import.meta.url))).digest('hex');
  if (!ledger) assert.match(profile, /^[a-f0-9]{64}$/);

  const sourceCheck = {sourceStage, expectedVersions: versions};
  const databaseOptions = {databaseCaFile: config.databaseCaFile};
  const storage = openPrivateDMocksTransport({
    url: config.url, serviceRoleKey: config.key, allowOrigin: config.url, environment: 'staging',
  }, {fetchImpl, timeoutMs: 60000});
  const connection = await connectionFactory(config.databaseUrl, databaseOptions);
  try {
    const snapshot = await captureRecoverySnapshot(connection, sourceCheck);
    const exported = await connection.exportSnapshot();
    const objects = snapshot.objects.map(object => ({
      ...object,
      ...(object.bucket === 'paper-media' && /^papers\/canonical\/[a-f0-9]{64}\.png$/.test(object.name)
        ? {sha256: object.name.split('/').at(-1).slice(0, -4)} : {}),
    }));
    const summary = await createRecoveryBundle({
      output: config.output,
      key: config.recoveryKey,
      source: {
        projectRef: RECOVERY_PROJECT, releaseSha: config.releaseSha, profileSha256: profile,
        migrationVersions: versions, ...(ledger ? {approvedLedgerSha256: hash(ledger)} : {}),
      },
      snapshot,
      database: connection.dump(exported),
      objects,
      readObject: object => downloadObject(storage, object),
      assertUnchanged: async () => {
        const current = await connectionFactory(config.databaseUrl, databaseOptions);
        try {
          await checkRecoveryDatabaseSource(current, sourceCheck);
          if (sourceStage === 'staging-before-permissions-repair') {
            const schema = JSON.parse(await current.query(recoverySchemaQuery));
            assert.equal(hash(schema), snapshot.schemaSha256, 'Staging schema or grants changed during capture');
          }
          const buckets = JSON.parse(await current.query(recoveryBucketsQuery));
          const latest = JSON.parse(await current.query(recoveryObjectsQuery));
          return hash({buckets, objects: latest}) === snapshot.storageInventorySha256;
        } finally {
          await current.close();
        }
      },
    });
    return {...summary, sourceStage};
  } finally {
    await connection.close();
  }
}
export async function verifyPrivateRecovery(options) {
  const verified = await verifyRecoveryBundle(options);
  return {
    version: verified.version, bundleId: verified.bundleId, databaseArchives: 1,
    privateObjects: verified.privateObjects, plaintextBytes: verified.plaintextBytes,
    manifestSha256: verified.manifestSha256, sourceStage: verified.snapshot.sourceStage ?? 'mvp',
    extracted: Boolean(verified.extractedDirectory), databaseRestoreAccepted: false, hostedWritesPerformed: false,
  };
}
function localOrigin(value){let url;try{url=new URL(value);}catch{throw new Error('Invalid local recovery origin');}assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/','Private object restore permits only an isolated loopback target');return url.origin;}
export async function restoreLocalRecoveryObjects({verified,url,key,ownerKey,assertDatabaseRestored,assertStorageRestored},{fetchImpl=fetch}={}){
 const origin=localOrigin(url);
 const storage=openPrivateDMocksTransport({url:origin,serviceRoleKey:key,allowOrigin:origin,environment:'development'},{fetchImpl,timeoutMs:60000});
 assert.ok(verified?.extractedDirectory&&typeof assertDatabaseRestored==='function'&&typeof assertStorageRestored==='function','Fully verified extraction and restored-database checks are required');
 const objects=verified.entries.filter(row=>row.kind==='object');assert.ok(!objects.some(row=>row.object.owner!=null)||typeof ownerKey==='function','A local owner-preserving signing adapter is required');
 assert.equal(await assertDatabaseRestored(),true,'Restore the matching database snapshot before private object bytes');
 // Prepare and validate every request before writing the first object.
 const requests=[];for(const entry of objects){const object=entry.object,token=object.owner==null?key:await ownerKey(object.owner),jwt=claims(token??'');assert.ok(token&&(object.owner==null||jwt?.role==='service_role'&&jwt.sub===object.owner),'Local restoration must preserve the original Storage owner');
  assert.ok(object.cacheControl==null||typeof object.cacheControl==='string'&&!/[\u0000-\u001f]/.test(object.cacheControl),'Invalid original cache metadata');
  const headers={apikey:key,authorization:'Bearer '+token,'content-type':object.contentType,'content-length':String(entry.byteSize),'x-upsert':'true',...(object.cacheControl?{'cache-control':object.cacheControl}:{}),...(object.userMetadata?{'x-metadata':Buffer.from(JSON.stringify(object.userMetadata)).toString('base64')}:{})};
  assert.match(entry.slot,/^payload-\d{6}\.enc$/);const file=path.join(verified.extractedDirectory,entry.slot.replace('.enc','.bin'));const info=await lstat(file);assert.ok(info.isFile()&&!info.isSymbolicLink()&&info.size===entry.byteSize,'Recovered payload file changed');const checksum=createHash('sha256');for await(const chunk of createReadStream(file))checksum.update(chunk);assert.equal(checksum.digest('hex'),entry.sha256,'Recovered payload changed before restoration');requests.push({entry,object,token,headers,file});
 }
 for(const request of requests){const response=await fetchImpl(objectUrl(origin,request.object),{method:'POST',headers:request.headers,body:createReadStream(request.file),duplex:'half',redirect:'error',signal:AbortSignal.timeout(60000)});if(!response.ok){const error=new Error('Local private object restore failed');error.httpStatus=response.status;throw error;}await response.body?.cancel();
  const digest=createHash('sha256');let bytes=0;for await(const chunk of await downloadObject(storage,request.object)){digest.update(chunk);bytes+=chunk.length;}assert.equal(bytes,request.entry.byteSize,'Recovered private object size changed');assert.equal(digest.digest('hex'),request.entry.sha256,'Recovered private object bytes changed');
 }
 assert.equal(await assertStorageRestored(objects.map(row=>row.object)),true,'Recovered private object ownership or metadata differs');
 return{restoredObjects:objects.length,allBytesVerified:true,ownerAndMetadataVerified:true,target:'isolated-local-recovery',hostedWritesPerformed:false};
}
function parseArgs([operation, ...args]) {
  assert.ok(['capture', 'verify'].includes(operation), 'Choose capture or verify');
  const allowed = operation === 'capture'
    ? ['--output', '--release', '--pre-upgrade-ledger', '--staging-ledger']
    : ['--bundle', '--extract-to'];
  const options = {};
  for (let n = 0; n < args.length; n += 2) {
    const [flag, value] = args.slice(n, n + 2);
    assert.ok(allowed.includes(flag) && value && !Object.hasOwn(options, flag), 'Use each recovery option once with its value');
    options[flag] = value;
  }
  return {operation, options};
}

async function main() {
  const {operation, options} = parseArgs(process.argv.slice(2));
  const recoveryKey = process.env.DMOCKS_RECOVERY_KEY;
  if (operation === 'capture') {
    assert.ok(options['--output'] && options['--release']);
    const result = await capturePrivateRecovery({
      url: process.env.DMOCKS_SUPABASE_URL,
      key: process.env.DMOCKS_SUPABASE_SERVICE_ROLE_KEY,
      databaseUrl: process.env.DMOCKS_RECOVERY_DATABASE_URL,
      databaseCaFile: process.env.DMOCKS_RECOVERY_DATABASE_CA_FILE,
      recoveryKey, releaseSha: options['--release'], output: options['--output'],
      preUpgradeLedger: options['--pre-upgrade-ledger'], stagingLedger: options['--staging-ledger'],
    });
    console.log(JSON.stringify(result));
  } else {
    assert.ok(options['--bundle']);
    const result = await verifyPrivateRecovery({
      directory: options['--bundle'], key: recoveryKey, extractTo: options['--extract-to'],
    });
    console.log(JSON.stringify(result));
  }
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)main().catch(()=>{console.error('PRIVATE_RECOVERY_FAILED');process.exitCode=1;});
